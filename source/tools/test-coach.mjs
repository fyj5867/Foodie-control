/**
 * Checks for the daily line and the end-of-day summary.
 *
 * Two different things live here and they have different rules:
 *
 * - The daily line is a 真乘心語 saying from the user's own document. It must
 *   come through verbatim, and it must be the same all day. The app's tone
 *   rules do NOT apply to it — they exist to police copy the app writes.
 * - The summary IS copy the app writes, so it must always name something
 *   encouraging first, never judge the person, and never imply a health
 *   outcome from a day's numbers.
 *
 * Run from source/:  node tools/test-coach.mjs
 */
import {
  dailyMessage,
  eveningSummary,
  eveningReminder,
  coachSlot,
  MORNING_UNTIL,
  REMIND_FROM,
  EVENING_FROM,
} from "../lib/coach.js";
import { QUOTES, quoteForDate } from "../lib/quotes.js";
import { CALORIE_CEILING } from "../lib/goals.js";
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

/* --- which card is on screen ---
 *
 * There must always be one. Showing nothing between late morning and 7pm
 * meant the daily line was invisible for most of the waking day, which is
 * how a built feature comes to look like a missing one. */
/* Three slots now, and the boundaries are the whole specification:
 * 00:00 the saying, 20:00 the reminder, 23:00 the summary. */
check("the stroke of midnight is already the new day's saying", coachSlot(new Date(2026, 8, 8, 0, 0)), "morning");
check("early morning is the daily line", coachSlot(new Date(2026, 8, 8, 7, 0)), "morning");
check("late morning still shows the line", coachSlot(new Date(2026, 8, 8, MORNING_UNTIL, 30)), "morning");
check("mid-afternoon still shows the line", coachSlot(new Date(2026, 8, 8, 14, 0)), "morning");
check("a minute before eight is still the line", coachSlot(new Date(2026, 8, 8, REMIND_FROM - 1, 59)), "morning");
check("eight is the reminder", coachSlot(new Date(2026, 8, 8, REMIND_FROM, 0)), "remind");
check("and it holds until eleven", coachSlot(new Date(2026, 8, 8, EVENING_FROM - 1, 59)), "remind");
check("eleven is the summary", coachSlot(new Date(2026, 8, 8, EVENING_FROM, 0)), "evening");
check("late night is still the summary", coachSlot(new Date(2026, 8, 8, 23, 59)), "evening");
/* The reminder has to sit strictly between them, or one of the three has no
 * part of the day to itself. */
ok("the reminder comes before the summary", REMIND_FROM < EVENING_FROM, `${REMIND_FROM} / ${EVENING_FROM}`);
ok("and after the morning greeting", MORNING_UNTIL < REMIND_FROM, `${MORNING_UNTIL} / ${REMIND_FROM}`);

/* --- the 20:00 reminder ---
 * It exists because the summary cannot do this job: at 23:00 "還差 450cc" is
 * information with nowhere to go. Three hours earlier it is still actionable. */
const shortDay = { calories: 900, waterMl: 1200, exerciseMin: 10, calorie: false, water: false, exercise: false, metCount: 0 };
const remind = eveningReminder({ day: shortDay, nickname: "小美" });
check("the reminder is titled by its hour", remind.title, "晚上八點");
ok("it names what is left", remind.watch.length === 3, JSON.stringify(remind.watch));
/* Same rule as the summary: something that went right comes first. A card that
 * opens with failure, three hours before bed, gets dismissed for good. */
ok("and never leaves the encouraging column empty", remind.wins.length > 0, JSON.stringify(remind.wins));
ok("it says there is still time", /還有時間|來得及|先挑一件/.test(remind.headline), remind.headline);

/* A reminder that fires when there is nothing to remind about teaches her to
 * ignore it, so a finished day asks for nothing. */
const doneDay = { calories: 1200, waterMl: 2100, exerciseMin: 40, calorie: true, water: true, exercise: true, metCount: 3 };
const noneLeft = eveningReminder({ day: doneDay, nickname: "小美" });
check("a finished day has nothing outstanding", noneLeft.watch, []);
ok("and says so", /都到了/.test(noneLeft.headline), noneLeft.headline);

/* --- the sayings themselves --- */
ok("there are enough sayings to last two months", QUOTES.length >= 50, String(QUOTES.length));
// 36 characters is what reads in two lines on a phone card; longer entries in
// the source document are paragraphs and were left out.
ok("every saying fits a card", QUOTES.every((q) => q.length >= 12 && q.length <= 36));
ok("no saying is left with an unbalanced bracket", QUOTES.every((q) => {
  const pairs = [["(", ")"], ["（", "）"], ["「", "」"], ["『", "』"], ["{", "}"]];
  return pairs.every(([o, c]) => [...q].filter((ch) => ch === o).length === [...q].filter((ch) => ch === c).length);
}));
ok("no saying still carries a section heading", QUOTES.every((q) => !/[:：]\s*$/.test(q)));
ok("no duplicates", new Set(QUOTES).size === QUOTES.length);

/* --- the line is stable within a day and moves across days --- */
check("same date gives the same saying", quoteForDate("2026-09-08"), quoteForDate("2026-09-08"));
ok(
  "different dates give different sayings",
  new Set(
    ["2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04", "2026-09-05", "2026-09-06", "2026-09-07"].map(
      quoteForDate
    )
  ).size >= 5
);
ok("a month of dates covers many sayings", (() => {
  const seen = new Set();
  for (let d = 1; d <= 28; d++) seen.add(quoteForDate(`2026-09-${String(d).padStart(2, "0")}`));
  return seen.size >= 18;
})());

/* --- the card --- */
const m = dailyMessage({ dateStr: D, nickname: "小宜", hour: 7 });
check("the card is titled 真乘心語", m.title, "真乘心語");
check("the morning greets by name", m.greeting, "早安，小宜");
ok("the body is one of the sayings, untouched", QUOTES.includes(m.body), m.body);

const noName = dailyMessage({ dateStr: D, nickname: "", hour: 7 });
check("no nickname still greets", noName.greeting, "早安");

const afternoon = dailyMessage({ dateStr: D, nickname: "小宜", hour: 15 });
check("after 11 there is no greeting", afternoon.greeting, "");
check("the title does not change", afternoon.title, "真乘心語");
check("and the saying is the same all day", afternoon.body, m.body);

/* The saying must never be prefixed, trimmed or otherwise edited. */
ok("the saying is not prefixed with the nickname", !m.body.startsWith("小宜"), m.body);
check("the saying matches the source list exactly", m.body, quoteForDate(D));

/* --- the evening summary --- */
const allMet = eveningSummary({ day: day(1200, 2100, 35), garden: gardenState(metDays(11)), nickname: "小宜" });
ok("a met calorie day is described against the ceiling", allMet.wins.some((w) => w.includes("1,500")), JSON.stringify(allMet.wins));
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
  "no-exercise phrasing does not repeat the full target",
  partial.watch.some((w) => w.includes("還沒有運動紀錄")),
  JSON.stringify(partial.watch)
);

/* --- the worst case is the one that matters most --- */
const nothing = eveningSummary({ day: day(null, null, null), garden: gardenState([]), nickname: "小宜" });
check("an empty day reports zero met", nothing.met, 0);
ok("an empty day still has something encouraging", nothing.wins.length >= 1, JSON.stringify(nothing.wins));
ok("an empty day lists all three to watch", nothing.watch.length === 3, JSON.stringify(nothing.watch));

/* Copy the app writes must not judge the person or claim a health outcome.
 * This deliberately excludes the sayings — those are the user's own words and
 * are not the app speaking. */
const BANNED = ["失敗", "退步", "太懶", "沒用", "警告", "危險", "血糖會", "會生病", "不合格"];
const appCopy = [
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
  ok(`the app never says 「${word}」`, !appCopy.includes(word), appCopy);
}

/* A day over the ceiling should say so plainly, and by how much — measured
 * against the flat ceiling, not the profile-derived target. */
const overBy = 300;
const over = eveningSummary({
  day: day(CALORIE_CEILING + overBy, 2100, 35),
  garden: gardenState(metDays(2)),
  nickname: "",
});
ok(
  "going over the ceiling is stated with the amount",
  over.watch.some((w) => w.includes(String(overBy))),
  JSON.stringify(over.watch)
);

/* An unrecorded day must not be described as if it were under control. */
const unlogged = eveningSummary({ day: day(null, 2100, 35), garden: gardenState(metDays(2)), nickname: "" });
ok(
  "an empty food log says there is no record, not that it was controlled",
  unlogged.watch.some((w) => w.includes("還沒有飲食紀錄")),
  JSON.stringify(unlogged.watch)
);

/* Reaching a tree is worth saying out loud. */
const finished = eveningSummary({ day: day(1200, 2100, 35), garden: gardenState(metDays(30)), nickname: "" });
ok(
  "finishing a tree is called out",
  finished.wins.some((w) => w.includes("種進花園")),
  JSON.stringify(finished.wins)
);

/* The reminder's own wording, checked against the same blacklist as every
 * other line the app writes about her day. */
for (const line of [remind.headline, ...remind.wins, ...remind.watch]) {
  ok(`reminder line avoids judgement: ${line}`, !BANNED.some((w) => line.includes(w)), line);
}

console.log(`${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("\nFAILURES:\n" + failures.map((f) => "  " + f).join("\n"));
  process.exit(1);
}
