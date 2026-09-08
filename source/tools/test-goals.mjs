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
} from "../lib/goals.js";
import { daysAgoStr, todayStr } from "../lib/health.js";

let passed = 0;
const failures = [];

function check(name, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) passed += 1;
  else failures.push(`${name}\n    expected ${e}\n    actual   ${a}`);
}

const D = todayStr();
const target = 1680;

function day(food, water, exercise) {
  return evaluateDay(D, {
    foodLog: food == null ? [] : [{ date: D, estimatedCalories: food }],
    waterLog: water == null ? [] : [{ date: D, amountMl: water }],
    exerciseLog: exercise == null ? [] : [{ date: D, minutes: exercise }],
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
check("calorie exactly at target passes", day(1680, 2000, 32).calorie, true);
check("calorie over target fails", day(1681, 2000, 32).calorie, false);

/* --- the empty-log trap: no food recorded must NOT read as "under target" --- */
check("no food logged does not count as calorie met", day(null, 2000, 32).calorie, false);
check("no food logged means day not met", day(null, 2000, 32).met, false);
check("implausibly low intake fails", day(400, 2000, 32).calorie, false);
check("half of target passes", day(840, 2000, 32).calorie, true);

/* --- missing calorie target must not pass silently --- */
const noTarget = evaluateDay(D, {
  foodLog: [{ date: D, estimatedCalories: 1410 }],
  waterLog: [{ date: D, amountMl: 2000 }],
  exerciseLog: [{ date: D, minutes: 32 }],
  calorieTarget: null,
});
check("no calorie target cannot be met", noTarget.calorie, false);
check("no calorie target means day not met", noTarget.met, false);

/* --- multiple entries in a day add up --- */
const split = evaluateDay(D, {
  foodLog: [
    { date: D, estimatedCalories: 320 },
    { date: D, estimatedCalories: 480 },
    { date: D, estimatedCalories: 610 },
  ],
  waterLog: [{ date: D, amountMl: 1200 }, { date: D, amountMl: 800 }],
  exerciseLog: [{ date: D, minutes: 20 }, { date: D, minutes: 15 }],
  calorieTarget: target,
});
check("entries within a day sum", [split.calories, split.waterMl, split.exerciseMin], [1410, 2000, 35]);
check("summed day is met", split.met, true);

/* --- other days must not leak in --- */
const otherDay = evaluateDay(D, {
  foodLog: [{ date: daysAgoStr(1), estimatedCalories: 1410 }],
  waterLog: [{ date: D, amountMl: 2000 }],
  exerciseLog: [{ date: D, minutes: 32 }],
  calorieTarget: target,
});
check("yesterday's food does not count today", otherDay.calorie, false);

/* --- stages --- */
check("0 days is seed", stageForDays(0).key, "seed");
check("1 day is sprout", stageForDays(1).key, "sprout");
check("6 days still seedling", stageForDays(6).key, "seedling");
check("7 days is sapling", stageForDays(7).key, "sapling");
check("29 days is tree not bloom", stageForDays(29).key, "tree");
check("30 days is bloom", stageForDays(30).key, "bloom");
check("next stage from 3 is sapling at 7", nextStageForDays(3).days, 7);
check("no next stage at 30", nextStageForDays(30), null);

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
  exerciseLog: [{ date: daysAgoStr(2), minutes: 32 }],
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

console.log(`${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("\nFAILURES:\n" + failures.map((f) => "  " + f).join("\n"));
  process.exit(1);
}
