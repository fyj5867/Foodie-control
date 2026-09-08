/**
 * Checks for the morning line and the end-of-day summary.
 *
 * These are the only places the app speaks to the person in its own voice, so
 * the things worth guarding are not formatting details but promises:
 * something encouraging is always named first, the wording never judges the
 * person, and a bad day never comes back empty or blaming.
 *
 * Run from source/:  node tools/test-coach.mjs
 */
import { morningMessage, eveningSummary, coachSlot, MORNING_UNTIL, EVENING_FROM } from "../lib/coach.js";
import { evaluateDay, gardenState } from "../lib/goals.js";
import { todayStr, daysAgoStr } from "../lib/health.js";

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
const target = 1300;

function day(cal, water, ex) {
  return evaluateDay(D, {
    foodLog: cal == null ? [] : [{ date: D, estimatedCalories: cal }],
    waterLog: water == null ? [] : [{ date: D, amountMl: water }],
    exerciseLog: ex == null ? [] : [{ date: D, durationMin: ex }],
    calorieTarget: target,
  });
}

function metDays(n) {
  const out = [];
  for (let i = n; i >= 1; i--) out.push({ date: daysAgoStr(i), c: true, e: true, w: true });
  return out;
}

/* --- which slot is on screen --- */
check("early morning is the morning slot", coachSlot(new Date(2026, 8, 8, 7, 0)), "morning");
check("just before the cutoff is still morning", coachSlot(new Date(2026, 8, 8, MORNING_UNTIL - 1, 59)), "morning");
check("midday shows nothing", coachSlot(new Date(2026, 8, 8, 14, 0)), null);
check("evening cutoff shows the summary", coachSlot(new Date(2026, 8, 8, EVENING_FROM, 0)), "evening");
check("late night is still evening", coachSlot(new Date(2026, 8, 8, 23, 30)), "evening");

/* --- the morning line --- */
const m = morningMessage({ dateStr: D, streak: 0, nickname: "小宜" });
ok("morning line uses the nickname", m.body.startsWith("小宜，"), m.body);
ok("morning line is not empty", m.body.length > 6, m.body);

const mNoName = morningMessage({ dateStr: D, streak: 0, nickname: "" });
ok("morning line works with no nickname", !mNoName.body.includes("，，") && mNoName.body.length > 4, mNoName.body);

/* The same date must give the same line all morning; a message that
 * reshuffles on every open reads as noise rather than as a greeting. */
check(
  "morning line is stable for a given day",
  morningMessage({ dateStr: "2026-09-08", streak: 0 }).body,
  morningMessage({ dateStr: "2026-09-08", streak: 0 }).body
);
ok(
  "morning line differs across days",
  new Set(
    ["2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04", "2026-09-05"].map(
      (d) => morningMessage({ dateStr: d, streak: 0 }).body
    )
  ).size > 1
);

const mStreak = morningMessage({ dateStr: D, streak: 12, nickname: "小宜" });
ok("a streak is acknowledged with its number", mStreak.body.includes("12"), mStreak.body);

/* --- the evening summary --- */
const allMet = eveningSummary({ day: day(1200, 2100, 35), garden: gardenState(metDays(11)), nickname: "小宜" });
check("a full day reports three met", allMet.met, 3);
ok("a full day has nothing to watch", allMet.watch.length === 0, JSON.stringify(allMet.watch));
ok("a full day names three wins", allMet.wins.length >= 3, JSON.stringify(allMet.wins));
ok("headline uses the nickname", allMet.headline.startsWith("小宜"), allMet.headline);

const partial = eveningSummary({ day: day(1200, 1450, 0), garden: gardenState(metDays(4)), nickname: "小宜" });
check("a partial day counts the met ones", partial.met, 1);
ok("partial day still names a win first", partial.wins.length >= 1, JSON.stringify(partial.wins));
ok("partial day lists what is short", partial.watch.length === 2, JSON.stringify(partial.watch));
ok(
  "the water shortfall says how much",
  partial.watch.some((w) => w.includes("550")),
  JSON.stringify(partial.watch)
);
ok(
  "no-exercise phrasing does not say 差 30 分鐘 twice",
  partial.watch.some((w) => w.includes("還沒有運動紀錄")),
  JSON.stringify(partial.watch)
);

/* --- the worst case is the one that matters most --- */
const nothing = eveningSummary({ day: day(null, null, null), garden: gardenState([]), nickname: "小宜" });
check("an empty day reports zero met", nothing.met, 0);
ok("an empty day still has something encouraging", nothing.wins.length >= 1, JSON.stringify(nothing.wins));
ok("an empty day lists all three to watch", nothing.watch.length === 3, JSON.stringify(nothing.watch));

/* Nothing anywhere may judge the person or claim a health outcome. */
const BANNED = ["失敗", "不夠", "退步", "太懶", "沒用", "警告", "危險", "血糖會", "會生病", "不合格"];
const allText = [
  ...["2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04", "2026-09-05", "2026-09-06"].flatMap((d) => [
    morningMessage({ dateStr: d, streak: 0 }).body,
    morningMessage({ dateStr: d, streak: 5 }).body,
  ]),
  allMet.headline,
  ...allMet.wins,
  partial.headline,
  ...partial.wins,
  ...partial.watch,
  nothing.headline,
  ...nothing.wins,
  ...nothing.watch,
].join(" | ");

for (const word of BANNED) {
  ok(`never says 「${word}」`, !allText.includes(word), allText);
}

/* A day with intake over the ceiling should say so plainly, with the number. */
const over = eveningSummary({ day: day(1800, 2100, 35), garden: gardenState(metDays(2)), nickname: "" });
ok(
  "going over target is stated with the amount",
  over.watch.some((w) => w.includes("500")),
  JSON.stringify(over.watch)
);

/* Reaching a tree is worth saying out loud. */
const finished = eveningSummary({ day: day(1200, 2100, 35), garden: gardenState(metDays(30)), nickname: "" });
ok(
  "finishing a tree is called out",
  finished.wins.some((w) => w.includes("種進花園")),
  JSON.stringify(finished.wins)
);

console.log(`${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("\nFAILURES:\n" + failures.map((f) => "  " + f).join("\n"));
  process.exit(1);
}
