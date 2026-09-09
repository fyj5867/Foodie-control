/**
 * Checks for the goal / growth / garden rules.
 *
 * These rules decide whether a day "counts", and everything the person sees —
 * the sprout's vitality, the stage, the garden — is derived from that one
 * judgement. Run from source/:  node tools/test-goals.mjs
 */
import {
  evaluateDay,
  gardenState,
  backfillSummaries,
  upsertSummary,
  stageForDays,
  nextStageForDays,
  canBackfill,
  toSummary,
  TREE_DAYS,
  WATER_GOAL_ML,
  EXERCISE_GOAL_MIN,
  FIELDS,
  CALORIE_CEILING,
  CALORIE_MIN_LOGGED,
  STAGES,
} from "../lib/goals.js";
import { daysAgoStr, todayStr } from "../lib/health.js";
import { readFileSync } from "node:fs";

let passed = 0;
const failures = [];

function check(name, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) passed += 1;
  else failures.push(`${name}\n    expected ${e}\n    actual   ${a}`);
}

function ok(name, cond, detail = "") {
  if (cond) passed += 1;
  else failures.push(`${name}${detail ? "\n    " + detail : ""}`);
}

const D = todayStr();
const target = 1680;

function day(food, water, exercise) {
  return evaluateDay(D, {
    foodLog: food == null ? [] : [{ date: D, estimatedCalories: food }],
    waterLog: water == null ? [] : [{ date: D, amountMl: water }],
    exerciseLog: exercise == null ? [] : [{ date: D, durationMin: exercise }],
    calorieTarget: target,
  });
}

/* --- the three conditions --- */
check("all three met", day(1410, 2000, 32).met, true);
check("all three metCount", day(1410, 2000, 32).metCount, 3);
check("water 50cc short fails", day(1410, 1950, 32).met, false);
check("water exactly at goal passes", day(1410, WATER_GOAL_ML, 32).water, true);
check("exercise exactly at goal passes", day(1410, 2000, EXERCISE_GOAL_MIN).exercise, true);
check("exercise 29 min fails", day(1410, 2000, 29).exercise, false);
/* The calorie rule is a flat ceiling the user set, not the profile-derived
 * target: under CALORIE_CEILING counts, at or above it does not. */
check("just under the ceiling passes", day(CALORIE_CEILING - 1, 2000, 32).calorie, true);
check("exactly at the ceiling fails", day(CALORIE_CEILING, 2000, 32).calorie, false);
check("over the ceiling fails", day(CALORIE_CEILING + 200, 2000, 32).calorie, false);
check("a day well under the ceiling passes", day(1200, 2000, 32).calorie, true);

/* --- the empty-log trap ---
 *
 * This is the whole reason there is a floor. "Under 1500" is trivially true
 * of an empty log, so without CALORIE_MIN_LOGGED, forgetting to record food
 * would count as perfect control and the garden would fill up on days nobody
 * tracked. */
check("no food logged does not count as calorie met", day(null, 2000, 32).calorie, false);
check("no food logged means day not met", day(null, 2000, 32).met, false);
check("zero calories does not count", day(0, 2000, 32).calorie, false);
check("a coffee-only log does not count", day(5, 2000, 32).calorie, false);
check("just under the floor does not count", day(CALORIE_MIN_LOGGED - 1, 2000, 32).calorie, false);
check("exactly at the floor counts", day(CALORIE_MIN_LOGGED, 2000, 32).calorie, true);

/* --- the verdict no longer depends on the profile ---
 *
 * All three conditions are flat numbers now, so an incomplete profile (no
 * age, no measured BMR) no longer makes the day unjudgeable. The personalised
 * target is still carried through for display. */
const noTarget = evaluateDay(D, {
  foodLog: [{ date: D, estimatedCalories: 1410 }],
  waterLog: [{ date: D, amountMl: 2000 }],
  exerciseLog: [{ date: D, durationMin: 32 }],
  calorieTarget: null,
});
check("no personalised target still judges calories", noTarget.calorie, true);
check("and the day can still be met", noTarget.met, true);

/* --- multiple entries in a day add up --- */
const split = evaluateDay(D, {
  foodLog: [
    { date: D, estimatedCalories: 320 },
    { date: D, estimatedCalories: 480 },
    { date: D, estimatedCalories: 610 },
  ],
  waterLog: [{ date: D, amountMl: 1200 }, { date: D, amountMl: 800 }],
  exerciseLog: [{ date: D, durationMin: 20 }, { date: D, durationMin: 15 }],
  calorieTarget: target,
});
check("entries within a day sum", [split.calories, split.waterMl, split.exerciseMin], [1410, 2000, 35]);
check("summed day is met", split.met, true);

/* --- other days must not leak in --- */
const otherDay = evaluateDay(D, {
  foodLog: [{ date: daysAgoStr(1), estimatedCalories: 1410 }],
  waterLog: [{ date: D, amountMl: 2000 }],
  exerciseLog: [{ date: D, durationMin: 32 }],
  calorieTarget: target,
});
check("yesterday's food does not count today", otherDay.calorie, false);

/* --- stages --- */
/* Eight stages, matching the Health Forest canvas artwork. Every key here
 * must have a drawing in components/Sprout.jsx. */
check("0 days is seed", stageForDays(0).key, "seed");
check("1 day is sprout", stageForDays(1).key, "sprout");
check("3 days is shoot", stageForDays(3).key, "shoot");
check("5 days still shoot", stageForDays(5).key, "shoot");
check("6 days is seedling", stageForDays(6).key, "seedling");
check("11 days is growing", stageForDays(11).key, "growing");
check("17 days is mature", stageForDays(17).key, "mature");
check("24 days is ready", stageForDays(24).key, "ready");
check("29 days is still ready", stageForDays(29).key, "ready");
check("30 days is the forest tree", stageForDays(30).key, "forest");
check("next stage from 3 is seedling at 6", nextStageForDays(3).days, 6);
check("no next stage at 30", nextStageForDays(30), null);
check("eight stages in all", STAGES.length, 8);
check("the last stage lands exactly on a finished tree", STAGES[STAGES.length - 1].days, TREE_DAYS);
ok("stage days only ever increase", STAGES.every((s, i) => i === 0 || s.days > STAGES[i - 1].days));

/* Every stage must have a drawing. The artwork is transcribed from the
 * Health Forest canvas and keyed by these names, so adding a stage here
 * without adding its drawing would silently fall back to another plant.
 * Read as text because the component is JSX and cannot be imported here. */
const sproutSrc = readFileSync(new URL("../components/Sprout.jsx", import.meta.url), "utf8");
for (const stage of STAGES) {
  ok(`${stage.key} has artwork`, sproutSrc.includes(`\n  ${stage.key}: (`), stage.key);
}

/* --- garden accumulation --- */
function metDays(n, startDaysAgo = 200) {
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push({ date: daysAgoStr(startDaysAgo - i), c: true, e: true, w: true });
  }
  return out;
}

check("empty garden", gardenState([]).completedTrees, 0);
check("29 met days finishes no tree", gardenState(metDays(29)).completedTrees, 0);
check("29 met days is 29 into current", gardenState(metDays(29)).currentDays, 29);
check("30 met days finishes one tree", gardenState(metDays(30)).completedTrees, 1);
check("30 met days resets current to 0", gardenState(metDays(30)).currentDays, 0);
check("96 met days is 3 trees", gardenState(metDays(96)).completedTrees, 3);
check("96 met days leaves 6 growing", gardenState(metDays(96)).currentDays, 6);
check("days to next tree from 6", gardenState(metDays(96)).daysToNextTree, TREE_DAYS - 6);

/* --- unmet days never advance anything --- */
const mixed = [...metDays(10, 100), { date: daysAgoStr(50), c: true, e: false, w: true }];
check("a partial day does not count", gardenState(mixed).totalMetDays, 10);

/* --- gaps do not reset progress, which is the whole point --- */
const gapped = [
  { date: "2026-08-01", c: true, e: true, w: true },
  { date: "2026-08-02", c: true, e: true, w: true },
  { date: "2026-08-20", c: true, e: true, w: true },
];
check("gapped days still accumulate", gardenState(gapped).totalMetDays, 3);
check("gapped days give longest streak 2", gardenState(gapped).longestStreak, 2);
check("an old streak is not a live streak", gardenState(gapped).currentStreak, 0);

/* --- a streak ending today is live --- */
const liveRun = [
  { date: daysAgoStr(2), c: true, e: true, w: true },
  { date: daysAgoStr(1), c: true, e: true, w: true },
  { date: todayStr(), c: true, e: true, w: true },
];
check("streak ending today is live", gardenState(liveRun).currentStreak, 3);

/* --- upsert replaces rather than duplicating --- */
let sums = [];
sums = upsertSummary(sums, day(1410, 2000, 32));
sums = upsertSummary(sums, day(1410, 1000, 32));
check("upsert keeps one entry per day", sums.length, 1);
check("upsert overwrites with the later value", sums[0].w, false);

/* --- upsert keeps the list sorted --- */
let s2 = [];
s2 = upsertSummary(s2, { date: "2026-09-05", calorie: true, exercise: true, water: true });
s2 = upsertSummary(s2, { date: "2026-09-01", calorie: true, exercise: true, water: true });
check("upsert sorts by date", s2.map((s) => s.date), ["2026-09-01", "2026-09-05"]);

/* --- backfill only covers days that actually have data --- */
const bf = backfillSummaries({
  foodLog: [{ date: daysAgoStr(2), estimatedCalories: 1410 }],
  waterLog: [{ date: daysAgoStr(2), amountMl: 2000 }],
  exerciseLog: [{ date: daysAgoStr(2), durationMin: 32 }],
  calorieTarget: target,
});
check("backfill produces one day", bf.length, 1);
check("backfill marks it met", bf[0], { date: daysAgoStr(2), c: true, e: true, w: true });

const bfEmpty = backfillSummaries({ foodLog: [], waterLog: [], exerciseLog: [], calorieTarget: target });
check("backfill of nothing is empty", bfEmpty.length, 0);

/* --- backfill window is limited to yesterday --- */
check("yesterday can be backfilled", canBackfill(daysAgoStr(1)), true);
check("today is not a backfill", canBackfill(todayStr()), false);
check("two days ago cannot be backfilled", canBackfill(daysAgoStr(2)), false);

/* --- summary shape stays compact --- */
check("summary has only four keys", Object.keys(toSummary(day(1410, 2000, 32))), ["date", "c", "e", "w"]);

/* --- field names must match what the app actually writes ---
 *
 * This exists because it already went wrong once: the rules read `minutes`
 * while the app has always stored `durationMin`. Nothing threw — the sum came
 * back 0, exercise silently never passed, and the tests agreed because they
 * used the same wrong name. Reading an absent key is a 0, not an error, so
 * the only defence is asserting the names against the app's own shapes. */
check("calorie field name", FIELDS.calories, "estimatedCalories");
check("water field name", FIELDS.water, "amountMl");
check("exercise field name", FIELDS.exercise, "durationMin");

const wrongField = evaluateDay(D, {
  foodLog: [{ date: D, estimatedCalories: 1410 }],
  waterLog: [{ date: D, amountMl: 2000 }],
  exerciseLog: [{ date: D, minutes: 32 }], // the old, wrong key
  calorieTarget: target,
});
check("an entry keyed on the wrong field reads as zero", wrongField.exerciseMin, 0);
check("and therefore does not meet the day", wrongField.met, false);

/* An entry shaped exactly as handleAddExerciseEntry writes it must pass. */
const realShape = evaluateDay(D, {
  foodLog: [{ id: "1", date: D, time: "12:30", name: "便當", estimatedCalories: 1410, light: "green" }],
  waterLog: [{ id: "2", date: D, amountMl: 2000 }],
  exerciseLog: [{ id: "3", date: D, activityId: "jog", activityLabel: "超慢跑", durationMin: 32 }],
  calorieTarget: target,
});
check("entries in the app's real shape are met", realShape.met, true);

console.log(`${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("\nFAILURES:\n" + failures.map((f) => "  " + f).join("\n"));
  process.exit(1);
}
