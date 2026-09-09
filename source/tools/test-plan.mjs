/**
 * Checks for the seven-day plan and the monthly review.
 *
 * This is the part of the app that reads a person's blood work back to them,
 * so the wording is tested as strictly as the arithmetic. The rules, in order
 * of how much damage breaking them would do:
 *
 *   1. Never diagnose, never promise an outcome. Nobody can say a number will
 *      come down, and someone acting on that promise is worse off than someone
 *      who was told the truth.
 *   2. Kidney findings get no dietary advice at all — protein and salt targets
 *      there are a clinical decision.
 *   3. Say something done right before anything to improve, on every month,
 *      including a month with nothing recorded.
 *
 * Run from source/:  node tools/test-plan.mjs
 */
import {
  CYCLE_DAYS,
  addDays,
  daysBetween,
  monthOf,
  monthBounds,
  isMonthEnd,
  previousMonth,
  cycleFor,
  measureWindow,
  scoreFocus,
  weeklyFocuses,
  weeklyPlan,
  monthlyAnalysis,
  monthsWithData,
  FOCUS_RULES,
  BASELINE_FOCUS,
  MAX_FOCUSES,
  MEASURES,
  weekStart,
  weeklyPlanProgress,
  weeklyPlanSummary,
} from "../lib/plan.js";

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

/* --- date arithmetic --- */
check("adding days crosses a month", addDays("2026-01-31", 1), "2026-02-01");
check("and a leap year", addDays("2028-02-28", 1), "2028-02-29");
check("and a year", addDays("2026-12-31", 1), "2027-01-01");
check("subtracting works too", addDays("2026-03-01", -1), "2026-02-28");
check("days between", daysBetween("2026-09-01", "2026-09-08"), 7);
check("month of a date", monthOf("2026-09-08"), "2026-09");
check("a 30-day month ends on the 30th", monthBounds("2026-09").end, "2026-09-30");
check("a 31-day month on the 31st", monthBounds("2026-10").end, "2026-10-31");
check("February 2026", monthBounds("2026-02").end, "2026-02-28");
check("February 2028 is a leap year", monthBounds("2028-02").days, 29);
check("the last day of the month is month end", isMonthEnd("2026-09-30"), true);
check("the 30th of a 31-day month is not", isMonthEnd("2026-10-30"), false);
check("previous month crosses the year", previousMonth("2026-01"), "2025-12");

/* --- seven-day cycles, counted from the report --- */
const anchor = "2026-09-01";
check("the report date is day 1 of cycle 1", cycleFor(anchor, "2026-09-01").index, 1);
check("and day 1", cycleFor(anchor, "2026-09-01").dayInCycle, 1);
check("the seventh day is still cycle 1", cycleFor(anchor, "2026-09-07").index, 1);
check("the eighth starts cycle 2", cycleFor(anchor, "2026-09-08").index, 2);
check("cycle 2 starts on the eighth", cycleFor(anchor, "2026-09-08").start, "2026-09-08");
check("and ends on the fourteenth", cycleFor(anchor, "2026-09-08").end, "2026-09-14");
check("days left on day 1", cycleFor(anchor, "2026-09-01").daysLeft, CYCLE_DAYS - 1);
check("no days left on day 7", cycleFor(anchor, "2026-09-07").daysLeft, 0);
/* A date before the report is cycle 1, not a negative week. */
check("a date before the anchor is cycle 1", cycleFor(anchor, "2026-08-20").index, 1);

/* --- measuring a window --- */
const summaries = [
  { date: "2026-09-01", c: true, e: true, w: true },
  { date: "2026-09-02", c: true, e: false, w: true },
  { date: "2026-09-03", c: false, e: true, w: true },
  { date: "2026-09-08", c: true, e: true, w: true }, // outside the window
];
const foodLog = [
  { date: "2026-09-01", estimatedCalories: 1400, light: "green" },
  { date: "2026-09-01", estimatedCalories: 200, light: "red" },
  { date: "2026-09-02", estimatedCalories: 1600, light: "yellow" },
  { date: "2026-09-08", estimatedCalories: 900, light: "red" }, // outside
];
const exerciseLog = [
  { date: "2026-09-01", activityId: "jog", durationMin: 35 },
  { date: "2026-09-03", activityId: "strength", durationMin: 40 },
  { date: "2026-09-09", activityId: "jog", durationMin: 60 }, // outside
];
const waterLog = [
  { date: "2026-09-01", amountMl: 2100 },
  { date: "2026-09-02", amountMl: 1500 },
];

const w = measureWindow({ start: "2026-09-01", end: "2026-09-07", summaries, foodLog, exerciseLog, waterLog });
check("window length", w.days, 7);
check("only days inside count", w.daysWithSummary, 3);
check("met days", w.metDays, 1);
check("exercise days from the summary", w.exerciseDays, 2);
check("exercise minutes inside the window", w.exerciseMinutes, 75);
check("aerobic minutes exclude resistance", w.aerobicMinutes, 35);
check("resistance sessions", w.resistanceSessions, 1);
check("red meals inside the window", w.redMeals, 1);
check("calories are summed per day then averaged", w.avgCalories, 1600);
/* 09-01 is 1400+200 and 09-02 is 1600 — both days reach the ceiling. */
check("days over the ceiling", w.daysOverCeiling, 2);
check("average water", w.avgWaterMl, 1800);

const empty = measureWindow({ start: "2026-01-01", end: "2026-01-07" });
check("an empty window has no average calories", empty.avgCalories, null);
check("and no average water", empty.avgWaterMl, null);
check("and counts nothing", empty.metDays, 0);

/* --- scoring --- */
check(
  "more is better for days",
  scoreFocus({ measure: "exerciseDays", target: 5 }, { exerciseDays: 5 }).done,
  true
);
check(
  "one short is not done",
  scoreFocus({ measure: "exerciseDays", target: 5 }, { exerciseDays: 4 }).done,
  false
);
/* Red meals are the other direction — a target is a ceiling, not a goal. */
check("fewer is better for red meals", scoreFocus({ measure: "redMeals", target: 3 }, { redMeals: 2 }).done, true);
check("over the ceiling is not done", scoreFocus({ measure: "redMeals", target: 3 }, { redMeals: 4 }).done, false);
check("a focus with no measure has no score", scoreFocus({ id: "refer" }, w), null);
ok("every measure a rule uses is defined", FOCUS_RULES.every((r) => !r.measure || MEASURES[r.measure]), "unknown measure");
ok("the baseline focus's measure is defined", Boolean(MEASURES[BASELINE_FOCUS.measure]));

/* --- turning a report into a plan --- */
check("no report gives the baseline focus", weeklyFocuses({}).map((f) => f.id), [BASELINE_FOCUS.id]);
check(
  "an all-normal report gives the baseline too",
  weeklyFocuses({ values: { fastingGlucose: 90, hba1c: 5.2 }, gender: "female" }).map((f) => f.id),
  [BASELINE_FOCUS.id]
);

const tgFocus = weeklyFocuses({ values: { triglycerides: 180 }, gender: "female" });
check("a high triglyceride gives the sugar focus", tgFocus.map((f) => f.id), ["tg-sugar"]);
ok("and the reason states the number", tgFocus[0].why.includes("180"), tgFocus[0].why);
ok("and the range it sits in", tgFocus[0].why.includes("150"), tgFocus[0].why);

const many = weeklyFocuses({
  values: { triglycerides: 300, fastingGlucose: 115, hdl: 38, systolic: 145, ldl: 180, uricAcid: 8 },
  gender: "female",
});
check("at most three focuses", many.length, MAX_FOCUSES);

/* Kidney and liver findings are handed to the doctor, and they come first —
 * they are the ones where acting on app advice could do harm. */
const kidney = weeklyFocuses({ values: { egfr: 45, triglycerides: 300 }, gender: "female" });
check("a kidney finding comes first", kidney[0].id, "kidney-refer");
check("and carries no measure to score", kidney[0].measure, undefined);
ok("and is marked as a referral", kidney[0].refer === true);
ok(
  "the kidney focus gives no dietary target",
  !/蛋白質\s*\d|每天\s*\d+\s*克|少吃|多吃/.test(kidney[0].action),
  kidney[0].action
);
ok("the kidney focus sends her to a doctor", kidney[0].action.includes("醫師"), kidney[0].action);

/* --- the whole plan --- */
const plan = weeklyPlan({
  report: { date: "2026-09-01", values: { triglycerides: 180 } },
  profile: { gender: "female" },
  summaries,
  foodLog,
  exerciseLog,
  waterLog,
  today: "2026-09-03",
});
check("the plan is anchored on the report", plan.anchor, "2026-09-01");
check("cycle 1, day 3", [plan.cycle.index, plan.cycle.dayInCycle], [1, 3]);
check("progress is measured to today, not the whole week", plan.measured.end, "2026-09-03");
ok("the focus has a score", plan.focuses[0].progress != null, JSON.stringify(plan.focuses[0]));
check("it knows there is a report", plan.hasReport, true);

const noReportPlan = weeklyPlan({ summaries, foodLog, exerciseLog, waterLog, today: "2026-09-03" });
check("without a report the plan still exists", noReportPlan.focuses.length, 1);
check("and says so", noReportPlan.hasReport, false);

/* --- the monthly review --- */
const records = [
  { date: "2026-09-02", weight: 62.5, waist: 84 },
  { date: "2026-09-28", weight: 61.2, waist: 82 },
];
const month = monthlyAnalysis({
  month: "2026-09",
  summaries,
  foodLog,
  exerciseLog,
  waterLog,
  records,
  today: "2026-09-30",
});
check("the month is bounded correctly", [month.bounds.start, month.bounds.end], ["2026-09-01", "2026-09-30"]);
check("weight change over the month", month.weight.delta, -1.3);
check("waist change", month.waist.delta, -2);
ok("something done right comes first", month.wins.length > 0, JSON.stringify(month));
ok("weight loss is reported as a win", month.wins.some((line) => line.includes("61.2")), JSON.stringify(month.wins));
ok("at most three things to watch", month.watch.length <= 3, JSON.stringify(month.watch));

/* A month with nothing in it still has to say something true and kind. */
const barren = monthlyAnalysis({ month: "2026-07", today: "2026-09-30" });
ok("an empty month still leads with a win", barren.wins.length > 0, JSON.stringify(barren.wins));
ok("and does not claim met days", !barren.wins[0].includes("全達標"), barren.wins[0]);

/* A month still running is only measured up to today. */
const partial = monthlyAnalysis({ month: "2026-09", summaries, today: "2026-09-10" });
check("a month in progress stops at today", partial.elapsedDays, 10);

check("months with data, newest first", monthsWithData({ summaries, foodLog, records }), ["2026-09"]);
check("no data means no months", monthsWithData({}), []);

/* --- the weekly exercise plan, lined up against what was logged ---
 *
 * The template is written 週一 to 週日, so it has to be anchored to a real
 * Monday. And the distinction that matters: a day still ahead is not a miss,
 * and a day where something else was done is not a miss either. */
check("the week starts on Monday", weekStart("2026-09-09"), "2026-09-07");
check("Monday is its own week start", weekStart("2026-09-07"), "2026-09-07");
check("Sunday belongs to the week that began six days earlier", weekStart("2026-09-13"), "2026-09-07");

const template = [
  { day: "週一", category: "aerobic", level: 2 },
  { day: "週二", category: "resistance", level: 2 },
  { day: "週三", category: "aerobic", level: 2 },
  { day: "週四", category: "flexibility", level: 1 },
  { day: "週五", category: "aerobic", level: 2 },
  { day: "週六", category: "resistance", level: 2 },
  { day: "週日", category: "aerobic", level: 1 },
];
const weekLog = [
  { date: "2026-09-07", activityId: "jog", durationMin: 35 },   // as planned
  { date: "2026-09-08", activityId: "cycle", durationMin: 40 }, // something else
];
const progress = weeklyPlanProgress({ weeklyTemplate: template, exerciseLog: weekLog, today: "2026-09-09" });

check("每 day gets a real date", progress[0].date, "2026-09-07");
check("Monday matched the plan", [progress[0].done, progress[0].movedAnyway], [true, false]);
/* 40 minutes of cycling on a resistance day is not a failure. */
check("Tuesday did something else", [progress[1].done, progress[1].movedAnyway], [false, true]);
check("and its minutes still count", progress[1].minutes, 40);
check("today is marked", progress[2].isToday, true);
check("today is not in the past", progress[2].isPast, false);
check("days ahead are neither done nor past", [progress[4].done, progress[4].isPast], [false, false]);
check("Monday is in the past", progress[0].isPast, true);

const summary = weeklyPlanSummary(progress);
check("one day went to plan", summary.done, 1);
check("one day moved anyway", summary.moved, 1);
check("total minutes for the week", summary.minutes, 75);
check("seven days in the plan", summary.total, 7);

const quietWeek = weeklyPlanSummary(weeklyPlanProgress({ weeklyTemplate: template, exerciseLog: [], today: "2026-09-09" }));
check("an empty week counts nothing", [quietWeek.done, quietWeek.moved, quietWeek.minutes], [0, 0, 0]);

/* The real template must carry what the card needs to draw itself. */
import { buildExercisePlan } from "../lib/health.js";
const realPlan = buildExercisePlan({ gender: "female", height: 160, weight: 65, symptoms: [] });
check("the real template has seven days", realPlan.weeklyTemplate.length, 7);
for (const row of realPlan.weeklyTemplate) {
  ok(`${row.day} has a category`, ["aerobic", "resistance", "flexibility"].includes(row.category), JSON.stringify(row));
  ok(`${row.day} has an intensity level`, [1, 2, 3].includes(row.level), String(row.level));
  ok(`${row.day} has a short label for a phone`, Boolean(row.short && row.short.length <= 12), row.short);
  ok(`${row.day} still reads as a sentence`, Boolean(row.activity && row.duration && row.intensity), JSON.stringify(row));
}
ok(
  "the week includes resistance work",
  realPlan.weeklyTemplate.some((r) => r.category === "resistance")
);
ok(
  "and something gentle",
  realPlan.weeklyTemplate.some((r) => r.category === "flexibility")
);

/* --- the wording --- */
const copy = [
  ...FOCUS_RULES.map((r) => `${r.title} ${r.action}`),
  `${BASELINE_FOCUS.title} ${BASELINE_FOCUS.action} ${BASELINE_FOCUS.why}`,
  ...month.wins,
  ...month.watch,
  ...barren.wins,
  ...many.map((f) => `${f.title} ${f.action} ${f.why || ""}`),
].join(" | ");

/* Nothing here may predict what a number will do, or name a condition. The
 * app compares a value to a published range; that is the whole of its remit. */
const BANNED = [
  "會降",
  "就會",
  "保證",
  "一定能",
  "治好",
  "痊癒",
  "確診",
  "你有糖尿病",
  "診斷為",
  "停藥",
  "改吃藥",
  "失敗",
  "退步",
  "危險",
  "警告",
  "不合格",
];
for (const word of BANNED) {
  ok(`the plan never says 「${word}」`, !copy.includes(word), copy);
}

/* Every referral rule must send her to a clinician rather than advise. */
for (const rule of FOCUS_RULES.filter((r) => r.refer)) {
  ok(`${rule.id} defers to a doctor`, rule.action.includes("醫師"), rule.action);
  ok(`${rule.id} has nothing to score`, rule.measure == null, rule.id);
}

/* Every non-referral rule must be scoreable, or the week cannot be reviewed. */
for (const rule of FOCUS_RULES.filter((r) => !r.refer)) {
  ok(`${rule.id} can be scored`, Boolean(rule.measure && rule.target != null), rule.id);
  ok(`${rule.id} names a concrete action`, rule.action.length > 8, rule.action);
}

console.log(`${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("\nFAILURES:\n" + failures.map((f) => "  " + f).join("\n"));
  process.exit(1);
}
