/**
 * Checks 排定的檢查 — a suggestion with a date on it.
 *
 * This exists because the screening card could only ever say 「建議去做」, and
 * a suggestion with nowhere to put a date says the same thing next month. The
 * things worth testing are the ones that would break that loop quietly:
 *
 *   - a scheduled exam going silent once it is overdue (the app deciding for
 *     her that it stopped mattering),
 *   - a half-filled plan being stored as if it were scheduled,
 *   - and ids colliding, which would make deleting one delete another.
 *
 * Run from source/:  node tools/test-exam-plans.mjs
 */
import {
  emptyPlan,
  normalizePlan,
  normalizePlans,
  upsertPlan,
  removePlan,
  markPlanDone,
  planFor,
  duePlans,
  REMIND_WITHIN_DAYS,
  MAX_PLANS,
} from "../lib/examPlans.js";
import { SCREENING_RULES } from "../lib/screening.js";
import { DEPARTMENTS } from "../lib/visits.js";

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

/* --- what counts as scheduled --- */
/* Both halves are the point: a date with nothing named is not a plan, and a
 * name with no date is not scheduled. */
check("a plan needs a date", normalizePlan({ exam: "眼底檢查" }), null);
check("a bad date is rejected", normalizePlan({ exam: "眼底檢查", date: "2026/10/05" }), null);
check("a date alone is not a plan", normalizePlan({ date: "2026-10-05" }), null);
ok("an exam plus a date is enough", Boolean(normalizePlan({ exam: "眼底檢查", date: "2026-10-05" })));
ok("a department plus a date is enough", Boolean(normalizePlan({ department: "眼科", date: "2026-10-05" })));

const plan = normalizePlan({
  examId: "eye-fundus",
  exam: "眼底（視網膜）檢查",
  department: "眼科",
  date: "2026-10-05",
  note: "早上空腹",
});
check("the date is kept", plan.date, "2026-10-05");
check("the note is kept", plan.note, "早上空腹");
check("the suggestion it came from is kept", plan.examId, "eye-fundus");
check("a new plan starts unscheduled", emptyPlan().date, "");

/* Seeding from a suggestion is the whole point: one tap, then one date. */
const seeded = emptyPlan(SCREENING_RULES[0]);
check("a seeded plan carries the exam", seeded.exam, SCREENING_RULES[0].exam);
check("and the department", seeded.department, SCREENING_RULES[0].department);
check("and remembers which suggestion", seeded.examId, SCREENING_RULES[0].id);
ok("its department is a real one", DEPARTMENTS.includes(seeded.department), seeded.department);

/* --- the list --- */
check("garbage is no plans", normalizePlans(null), []);
const list = normalizePlans([
  { exam: "大腸鏡", date: "2026-12-01" },
  { exam: "眼底檢查", date: "2026-10-05" },
  { exam: "壞的", date: "nope" },
]);
check("plans read soonest first", list.map((p) => p.exam), ["眼底檢查", "大腸鏡"]);
/* Ids minted from Date.now() collide inside a millisecond, and then deleting
 * one plan deletes the other. */
ok("ids are unique", list[0].id !== list[1].id, JSON.stringify(list.map((p) => p.id)));
check("removing takes one out", removePlan(list, list[0].id).length, 1);
check("upsert replaces rather than duplicating", upsertPlan(list, { ...list[0], date: "2026-10-09" }).length, 2);
check("with the new date", upsertPlan(list, { ...list[0], date: "2026-10-09" })[0].date, "2026-10-09");
check("marking done sets the flag", markPlanDone(list, list[0].id)[0].done, true);
ok("there is a cap", MAX_PLANS > 0);

/* --- finding the plan for a suggestion --- */
const booked = normalizePlans([
  { examId: "eye-fundus", exam: "眼底檢查", date: "2026-10-05" },
  { examId: "colon", exam: "大腸鏡", date: "2026-11-01", done: true },
]);
check("an outstanding plan is found", planFor(booked, "eye-fundus").date, "2026-10-05");
/* A finished one must not keep the suggestion looking booked — otherwise the
 * card says 「已排定」 forever and she can never schedule the next one. */
check("a finished plan is not treated as booked", planFor(booked, "colon"), null);
check("a suggestion with no plan has none", planFor(booked, "kidney"), null);
check("no examId matches nothing", planFor(booked, ""), null);

/* --- reminders --- */
const today = "2026-09-10";
const due = duePlans(
  [
    { id: "a", exam: "眼底檢查", date: "2026-06-15", done: false },
    { id: "b", exam: "大腸鏡", date: "2026-09-13", done: false },
    { id: "c", exam: "骨密度", date: "2027-01-01", done: false },
    { id: "d", exam: "抹片", date: "2026-09-01", done: true },
  ],
  today
);
check("only the due and overdue are reminded", due.map((p) => p.id), ["a", "b"]);
check("overdue comes first", due[0].overdue, true);
check("and knows how overdue", due[0].days, -87);
check("the upcoming one is not overdue", due[1].overdue, false);
check("and how many days away", due[1].days, 3);
/* Never aged out: an exam she meant to have three months ago matters more
 * than one due next week. */
ok("a long-overdue exam is still reminded", due.some((p) => p.days < -30), JSON.stringify(due.map((p) => p.days)));
check("a finished plan stops reminding", due.some((p) => p.id === "d"), false);
check("nothing scheduled is no reminders", duePlans([], today), []);
ok("the window is a sensible couple of weeks", REMIND_WITHIN_DAYS >= 7 && REMIND_WITHIN_DAYS <= 30);

/* --- every suggestion can be scheduled ---
 * If a rule's id or department could not seed a plan, that suggestion would
 * show a 排定 button that produces nothing storable. */
for (const rule of SCREENING_RULES) {
  const draft = { ...emptyPlan(rule), date: "2026-10-05" };
  ok(`${rule.id} can be scheduled`, Boolean(normalizePlan(draft)), rule.id);
}


/* --- 醫院與醫師 ---
 * Both are optional on purpose: when the exam is still only a suggestion there
 * is nothing to put there yet, and refusing to store the plan until she knows
 * would push the date — the half that decides whether it happens — back out of
 * reach. */
check("a blank plan has room for both", [emptyPlan().hospital, emptyPlan().doctor], ["", ""]);

const where = normalizePlan({
  exam: "大腸鏡",
  department: "肝膽腸胃科",
  hospital: "  台大醫院  ",
  doctor: "  王大明醫師 ",
  date: "2026-10-05",
});
check("the hospital survives, trimmed", where.hospital, "台大醫院");
check("and the doctor", where.doctor, "王大明醫師");

const bare = normalizePlan({ exam: "大腸鏡", date: "2026-10-05" });
ok("a plan with neither is still a plan", Boolean(bare), "scheduling must never require knowing where yet");
check("missing ones are empty strings, not undefined", [bare.hospital, bare.doctor], ["", ""]);

/* A backup file is plain text she can edit, so these are capped the same way
 * every other free-text field is — cut, not rejected, because losing the whole
 * plan over a long name would be the worse failure. */
check(
  "an absurd hospital name is cut",
  normalizePlan({ exam: "x", date: "2026-10-05", hospital: "醫".repeat(200) }).hospital.length,
  40
);
check(
  "and an absurd doctor name",
  normalizePlan({ exam: "x", date: "2026-10-05", doctor: "王".repeat(200) }).doctor.length,
  20
);

/* The round trip the form actually does: fill both in, store it, read it back,
 * and have the reminder card still know them. */
const withWhere = upsertPlan([], {
  ...emptyPlan({ id: "colonoscopy", exam: "大腸鏡", department: "肝膽腸胃科" }),
  hospital: "馬偕醫院",
  doctor: "李醫師",
  date: "2026-11-02",
});
check("a stored plan keeps where and with whom", [withWhere[0].hospital, withWhere[0].doctor], ["馬偕醫院", "李醫師"]);
check("and the reminder carries them too", duePlans(withWhere, "2026-10-26")[0].hospital, "馬偕醫院");

console.log(`${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("\nFAILURES:\n" + failures.map((f) => "  " + f).join("\n"));
  process.exit(1);
}
