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

/* --- stages ---
 *
 * Written against STAGES rather than against literal day numbers: the cycle
 * length is a product decision that has changed once already, and a test that
 * has to be rewritten every time it changes is a test that stops being read.
 * What has to hold is the shape. */
check("eight stages in all", STAGES.length, 8);
check("day zero is the first stage", stageForDays(0).key, STAGES[0].key);
check("the last stage lands exactly on a finished tree", STAGES[STAGES.length - 1].days, TREE_DAYS);
ok("stage days only ever increase", STAGES.every((s, i) => i === 0 || s.days > STAGES[i - 1].days));

/* Every stage is reached on its own day, and holds until the next one. */
for (let i = 0; i < STAGES.length; i++) {
  const stage = STAGES[i];
  const next = STAGES[i + 1];
  check(`${stage.days} days is ${stage.label}`, stageForDays(stage.days).key, stage.key);
  if (next) {
    check(`the day before ${next.label} is still ${stage.label}`, stageForDays(next.days - 1).key, stage.key);
    check(`the next stage from ${stage.days} is ${next.label}`, nextStageForDays(stage.days).days, next.days);
  }
}
check("no next stage once the tree is done", nextStageForDays(TREE_DAYS), null);

/* The point of the spacing: something changes on screen often enough to be
 * worth coming back for. This is what makes a shorter cycle motivating rather
 * than just shorter. */
const gaps = STAGES.slice(1).map((stage, i) => stage.days - STAGES[i].days);
ok("no stage lasts more than a few days", Math.max(...gaps) <= Math.ceil(TREE_DAYS / 4), JSON.stringify(gaps));
ok("the first change comes on day one", STAGES[1].days === 1, String(STAGES[1].days));

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
/* Counted in cycles, so this still means the same thing if TREE_DAYS moves. */
check("one day short finishes no tree", gardenState(metDays(TREE_DAYS - 1)).completedTrees, 0);
check("and is that far into the current one", gardenState(metDays(TREE_DAYS - 1)).currentDays, TREE_DAYS - 1);
check("a full cycle finishes one tree", gardenState(metDays(TREE_DAYS)).completedTrees, 1);
check("and resets the current one", gardenState(metDays(TREE_DAYS)).currentDays, 0);
check("three cycles and a bit is three trees", gardenState(metDays(TREE_DAYS * 3 + 6)).completedTrees, 3);
check("with the remainder still growing", gardenState(metDays(TREE_DAYS * 3 + 6)).currentDays, 6);
check("days to next tree from 6", gardenState(metDays(TREE_DAYS * 3 + 6)).daysToNextTree, TREE_DAYS - 6);

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
