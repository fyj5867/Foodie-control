/**
 * Checks 就醫紀錄 and the screening suggestions.
 *
 * These two close the loop the referral cards open: a finding becomes a visit,
 * the visit becomes a follow-up date, and the date becomes a reminder. The
 * things worth testing are the ones that would quietly break that loop:
 *
 *   - an overdue follow-up going silent (the app deciding for her that it no
 *     longer matters),
 *   - a suggestion still nagging for something she has already done,
 *   - and any suggestion that names a treatment rather than an examination.
 *
 * Run from source/:  node tools/test-visits.mjs
 */
import {
  DEPARTMENTS,
  emptyVisit,
  normalizeVisit,
  normalizeVisits,
  upsertVisit,
  removeVisit,
  markVisitDone,
  dueReminders,
  lastVisitTo,
  REMIND_WITHIN_DAYS,
} from "../lib/visits.js";
import {
  SCREENING_RULES,
  PROGRAMME_RULES,
  screeningSuggestions,
  needsAgeForProgramme,
} from "../lib/screening.js";
import { LAB_MARKERS, LAB_FLAGS } from "../lib/health.js";

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

/* --- the stored shape --- */
check("a visit with no date is not a visit", normalizeVisit({ department: "眼科" }), null);
check("a bad date is rejected", normalizeVisit({ date: "2026/09/01", department: "眼科" }), null);
/* A date and nothing else says nothing at all. */
check("a date with no content is not a visit", normalizeVisit({ date: "2026-09-01" }), null);
ok("a department alone is enough", Boolean(normalizeVisit({ date: "2026-09-01", department: "眼科" })));
ok("a symptom alone is enough", Boolean(normalizeVisit({ date: "2026-09-01", symptom: "眼睛乾" })));

const visit = normalizeVisit({
  date: "2026-09-01",
  department: "眼科",
  symptom: "看東西模糊",
  advice: "先觀察，三個月後回診",
  nextDate: "2026-12-01",
});
check("the doctor's words are stored verbatim", visit.advice, "先觀察，三個月後回診");
check("the follow-up date is kept", visit.nextDate, "2026-12-01");
check("a bad follow-up date becomes empty", normalizeVisit({ ...visit, nextDate: "soon" }).nextDate, "");
check("a new visit starts blank", emptyVisit("2026-09-09").date, "2026-09-09");
ok("every department in the list is a plain name", DEPARTMENTS.every((d) => d.length <= 12), DEPARTMENTS.join(","));

/* Long free text is capped rather than refused — losing the whole record
 * because the advice was long would be worse than trimming it. */
const long = normalizeVisit({ date: "2026-09-01", department: "眼科", advice: "很".repeat(900) });
ok("long advice is trimmed, not rejected", long.advice.length === 500, String(long.advice.length));

check("garbage is no visits", normalizeVisits(null), []);
const list = normalizeVisits([
  { date: "2026-03-01", department: "眼科" },
  { date: "2026-09-01", department: "牙科" },
  { date: "nope", department: "眼科" },
]);
check("visits read newest first", list.map((v) => v.date), ["2026-09-01", "2026-03-01"]);
/* Ids minted from Date.now() collided inside a millisecond, and then deleting
 * one visit deleted the other. */
ok("ids are unique", list[0].id !== list[1].id, JSON.stringify(list.map((v) => v.id)));
check("removing takes one out", removeVisit(list, list[0].id).length, 1);
check("upsert replaces rather than duplicating", upsertVisit(list, { ...list[0], symptom: "改了" }).length, 2);
check("with the new text", upsertVisit(list, { ...list[0], symptom: "改了" })[0].symptom, "改了");
check("marking done sets the flag", markVisitDone(list, list[0].id)[0].done, true);
check("the newest visit to a department", lastVisitTo(list, "眼科").date, "2026-03-01");
check("a department never visited has no last visit", lastVisitTo(list, "腎臟科"), null);

/* --- reminders --- */
const today = "2026-09-09";
const reminders = dueReminders(
  [
    { id: "a", date: "2026-06-01", department: "眼科", advice: "x", nextDate: "2026-06-15" }, // long overdue
    { id: "b", date: "2026-09-01", department: "牙科", advice: "x", nextDate: "2026-09-12" }, // soon
    { id: "c", date: "2026-09-01", department: "骨科", advice: "x", nextDate: "2027-01-01" }, // far off
    { id: "d", date: "2026-09-01", department: "眼科", advice: "x", nextDate: "" }, // none
    { id: "e", date: "2026-08-01", department: "眼科", advice: "x", nextDate: "2026-08-10", done: true },
  ],
  today
);
check("only the due and overdue are reminded", reminders.map((r) => r.id), ["a", "b"]);
check("overdue comes first", reminders[0].overdue, true);
check("and knows how overdue", reminders[0].days, -86);
check("the upcoming one is not overdue", reminders[1].overdue, false);
check("and how many days away", reminders[1].days, 3);
/* An overdue follow-up is never hidden by age — a 回診 missed three months ago
 * matters more than one due next week. */
ok("a very overdue visit is still reminded", reminders.some((r) => r.days < -30), JSON.stringify(reminders.map((r) => r.days)));
check("a visit marked done stops reminding", reminders.some((r) => r.id === "e"), false);
check("nothing due is no reminders", dueReminders([], today), []);
ok("the window is a sensible couple of weeks", REMIND_WITHIN_DAYS >= 7 && REMIND_WITHIN_DAYS <= 30, String(REMIND_WITHIN_DAYS));

/* --- the rules are sound --- */
const markerKeys = new Set(LAB_MARKERS.map((m) => m.key));
const flagKeys = new Set(LAB_FLAGS.map((f) => f.key));
for (const rule of [...SCREENING_RULES, ...PROGRAMME_RULES]) {
  ok(`${rule.id} names an examination`, Boolean(rule.exam), rule.id);
  ok(`${rule.id} names a department`, DEPARTMENTS.includes(rule.department), rule.department);
  ok(`${rule.id} cites where it comes from`, Boolean(rule.source && rule.source.length > 6), rule.id);
  ok(`${rule.id} has an interval`, rule.everyMonths > 0, rule.id);
  ok(
    `${rule.id}'s markers all exist`,
    (rule.markers || []).every((k) => markerKeys.has(k)),
    JSON.stringify((rule.markers || []).filter((k) => !markerKeys.has(k)))
  );
  ok(
    `${rule.id}'s flags all exist`,
    (rule.flags || []).every((k) => flagKeys.has(k)),
    JSON.stringify((rule.flags || []).filter((k) => !flagKeys.has(k)))
  );
}

/* Eyes were the reason this was asked for, so they must be covered. */
ok("there is an eye rule", SCREENING_RULES.some((r) => r.department === "眼科"));
ok(
  "the fundus check is suggested from blood sugar",
  SCREENING_RULES.some((r) => r.exam.includes("眼底") && r.markers.includes("hba1c")),
  "no fundus rule keyed on blood sugar"
);

/* --- suggestions from a report --- */
const report = {
  date: "2026-08-15",
  values: { hba1c: 5.9, fastingGlucose: 108, iopR: 24, egfr: 52 },
  flags: { stoolBlood: "陽性" },
};
const profile = { gender: "female", age: "52" };
const suggestions = screeningSuggestions({ report, profile, visits: [], today });

ok("blood sugar suggests the eye clinic", suggestions.some((s) => s.id === "eye-fundus"), JSON.stringify(suggestions.map((s) => s.id)));
ok("a raised eye pressure does too", suggestions.some((s) => s.id === "eye-pressure"));
ok("a positive stool test suggests 腸胃科", suggestions.some((s) => s.department === "肝膽腸胃科"));
ok("a low eGFR suggests 腎臟科", suggestions.some((s) => s.department === "腎臟科"));
ok("every suggestion says why", suggestions.every((s) => s.why && s.why.length > 3), JSON.stringify(suggestions.map((s) => s.why)));
/* Either her own figure, or the answer a yes/no test came back with — a flag
 * has no number to quote. Either way it is something she can look up on the
 * report rather than something the app asserted. */
ok(
  "and the report-driven ones quote something off her report",
  suggestions.filter((s) => s.kind === "report").every((s) => /\d|陽性|異常/.test(s.why)),
  JSON.stringify(suggestions.filter((s) => s.kind === "report").map((s) => s.why))
);

/* The national programme comes in on age alone. */
ok("age brings in the programme checks", suggestions.some((s) => s.kind === "programme"), "no programme suggestions");
ok("a woman gets the cervical screen", suggestions.some((s) => s.id === "cervical"));
const male = screeningSuggestions({ report, profile: { gender: "male", age: "52" }, visits: [], today });
check("a man does not", male.some((s) => s.id === "cervical"), false);
ok("a man over 45 still gets the colon programme", male.some((s) => s.id === "colon-programme"));
const young = screeningSuggestions({ report, profile: { gender: "female", age: "28" }, visits: [], today });
check("a 28-year-old is not offered the 45+ screens", young.some((s) => s.id === "colon-programme"), false);

/* Age is optional in this app, so a profile without one is a normal state. */
const noAge = screeningSuggestions({ report, profile: { gender: "female" }, visits: [], today });
check("no age means no programme suggestions", noAge.some((s) => s.kind === "programme"), false);
ok("but the report-driven ones still appear", noAge.some((s) => s.kind === "report"));
ok("and the missing age is detectable", needsAgeForProgramme({ gender: "female" }));
ok("a filled age is not flagged", !needsAgeForProgramme({ age: "52" }));

/* --- already done --- */
const seenEyeRecently = screeningSuggestions({
  report,
  profile,
  visits: normalizeVisits([{ date: "2026-08-20", department: "眼科", advice: "眼底檢查正常" }]),
  today,
});
const eye = seenEyeRecently.find((s) => s.id === "eye-fundus");
check("a recent visit marks the suggestion as covered", eye.covered, "2026-08-20");
/* Kept rather than hidden: "you already went, on this date" is useful, and
 * removing it entirely would look like the app forgot. */
ok("but it is still listed for reference", Boolean(eye), "the covered suggestion vanished");
ok(
  "outstanding suggestions come before covered ones",
  seenEyeRecently.findIndex((s) => s.covered) > 0,
  JSON.stringify(seenEyeRecently.map((s) => `${s.id}:${s.covered || "-"}`))
);

const seenLongAgo = screeningSuggestions({
  report,
  profile,
  visits: normalizeVisits([{ date: "2024-01-01", department: "眼科", advice: "x" }]),
  today,
});
check("a visit older than the interval does not cover it", seenLongAgo.find((s) => s.id === "eye-fundus").covered, null);

/* An all-normal report suggests nothing from the report side. */
const clean = screeningSuggestions({
  report: { date: "2026-08-15", values: { hba1c: 5.2, fastingGlucose: 90 }, flags: {} },
  profile: { gender: "female", age: "28" },
  visits: [],
  today,
});
check("a normal report and a young profile suggests nothing", clean.length, 0);
check("no report at all suggests nothing from findings", screeningSuggestions({ profile: { gender: "female" } }).length, 0);

/* --- the wording --- */
const copy = [...SCREENING_RULES, ...PROGRAMME_RULES]
  .map((r) => `${r.exam} ${r.source} ${r.note || ""}`)
  .join(" | ");

/* Examinations and departments only. No treatment, no drug, no prediction. */
const BANNED = ["吃藥", "服藥", "劑量", "手術", "開刀", "治療方式", "會得", "確診", "一定要", "保證", "危險"];
for (const word of BANNED) {
  ok(`the screening copy never says 「${word}」`, !copy.includes(word), copy.slice(0, 200));
}
/* Every rule offers an examination, never a therapy. */
for (const rule of [...SCREENING_RULES, ...PROGRAMME_RULES]) {
  ok(
    `${rule.id} suggests an examination`,
    /檢查|篩檢|追蹤|抹片|攝影|超音波|大腸鏡|眼壓|眼底/.test(rule.exam),
    rule.exam
  );
}

console.log(`${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("\nFAILURES:\n" + failures.map((f) => "  " + f).join("\n"));
  process.exit(1);
}
