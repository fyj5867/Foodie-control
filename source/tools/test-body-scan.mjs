/**
 * Checks reading 體態紀錄 off a photo of the scale.
 *
 * The failure that matters is a misread number landing in the record as if it
 * were measured. A model reading a seven-segment display will occasionally
 * turn 62.4 into 624, and 624% body fat is not a finding — it is a misread,
 * and it has to be reported rather than filled in.
 *
 * The second one is subtler: a reading must never blank a field it did not
 * contain. A scale that does not measure waist should not wipe the waist she
 * typed thirty seconds ago.
 *
 * Run from source/:  node tools/test-body-scan.mjs
 */
import {
  BODY_FIELDS,
  bodyField,
  isPlausibleBodyValue,
  cleanBodyValues,
  applyReadingToForm,
} from "../lib/bodyScan.js";
import { BODY_PROMPT } from "../lib/vision.js";

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

/* --- the field list --- */
const seen = new Set();
for (const field of BODY_FIELDS) {
  ok(`${field.key} is unique`, !seen.has(field.key), field.key);
  seen.add(field.key);
  ok(`${field.key} has a label`, Boolean(field.label), field.key);
  ok(`${field.key} has bounds`, Array.isArray(field.plausible) && field.plausible[0] < field.plausible[1], field.key);
  /* Every field has to be in the prompt or the model will never return it. */
  ok(`${field.key} is offered to the model`, BODY_PROMPT.includes(`${field.key}：`), field.key);
}
/* And the prompt may not offer a field the app does not know — that value
 * would be read off the scale and then silently dropped. */
const promptKeys = [...BODY_PROMPT.matchAll(/^- ([a-zA-Z]+)：/gm)].map((m) => m[1]);
for (const key of promptKeys) {
  ok(`the prompt's ${key} is a real field`, Boolean(bodyField(key)), key);
}

/* --- misreads --- */
ok("a real weight is plausible", isPlausibleBodyValue("weight", 62.4));
ok("a misplaced decimal is not", !isPlausibleBodyValue("weight", 624));
ok("a body fat over 70% is not", !isPlausibleBodyValue("bodyFat", 624));
ok("a negative value is not", !isPlausibleBodyValue("weight", -5));
ok("an unknown field is never plausible", !isPlausibleBodyValue("nonsense", 5));
/* Absent must stay absent: Number(null) is 0, and 0 is inside several of
 * these ranges. */
ok("null is not a value", !isPlausibleBodyValue("bmi", null));
ok("an empty string is not a value", !isPlausibleBodyValue("bmi", ""));

const cleaned = cleanBodyValues({
  weight: 62.4,
  bodyFat: 624, // misread
  bmi: "24.3",
  nonsense: 5,
  waist: null,
});
check("plausible values are kept", cleaned.values, { weight: 62.4, bmi: 24.3 });
check("a misread is rejected, not stored", cleaned.rejected.map((r) => r.key), ["bodyFat"]);
ok("and the rejection can be shown", cleaned.rejected[0].label.length > 0, JSON.stringify(cleaned.rejected));
check("an absent field is neither kept nor rejected", cleanBodyValues({ waist: null }), { values: {}, rejected: [] });
check("integers stay integers", cleanBodyValues({ visceralFat: 7.4 }).values.visceralFat, 7);

/* --- applying to the form --- */
const form = {
  date: "2026-09-10",
  weight: "",
  bmi: "",
  bodyFat: "",
  waist: "78",
  visceralFat: "",
  skeletalMuscle: "",
  bodyAge: "",
  bmr: "",
  sleepHours: "7",
};

const applied = applyReadingToForm(form, {
  date: "2026-09-09",
  values: { weight: 62.4, bmi: 24.3, bodyFat: 31.2, bmr: 1290 },
  unreadable: ["骨骼肌率"],
});
check("the form takes the values as strings", applied.form.weight, "62.4");
check("and the rest of them", [applied.form.bmi, applied.form.bodyFat, applied.form.bmr], ["24.3", "31.2", "1290"]);
/* A scale that does not measure waist must not wipe the waist she typed. */
check("a field the photo did not contain is left alone", applied.form.waist, "78");
check("and so is one she filled herself", applied.form.sleepHours, "7");
check("the date on the photo is used", applied.form.date, "2026-09-09");
check("what was filled is reported", applied.filled.length, 4);
check("and what could not be read", applied.unreadable, ["骨骼肌率"]);

const noDate = applyReadingToForm(form, { date: null, values: { weight: 62.4 } });
check("no date on the photo keeps the form's own", noDate.form.date, "2026-09-10");
const badDate = applyReadingToForm(form, { date: "09/09", values: { weight: 62.4 } });
check("an unparseable date is ignored", badDate.form.date, "2026-09-10");

const nothing = applyReadingToForm(form, { values: {} });
check("an empty reading changes nothing", nothing.form, form);
check("and says so", nothing.filled, []);
const rubbish = applyReadingToForm(form, null);
check("a failed reading changes nothing", rubbish.form, form);

const withMisread = applyReadingToForm(form, { values: { weight: 62.4, bodyFat: 624 } });
check("a misread does not reach the form", withMisread.form.bodyFat, "");
check("but is reported so she can type it", withMisread.rejected.map((r) => r.label), ["體脂肪率"]);

/* --- the prompt transcribes, it does not interpret --- */
/* The prompt must forbid interpretation outright. Testing for the mere
 * presence of 「建議」 was wrong — it appears as 「不要給建議」, which is the
 * prohibition itself. */
ok("it forbids interpreting", BODY_PROMPT.includes("不要解讀"), BODY_PROMPT.slice(0, 120));
ok("and commenting", BODY_PROMPT.includes("不要評論"));
ok("and giving advice", BODY_PROMPT.includes("不要給建議"));
for (const word of ["診斷", "評估你的", "健康狀況如何", "是否過重"]) {
  ok(`the body prompt never asks for 「${word}」`, !BODY_PROMPT.includes(word), word);
}
ok("it tells the model to skip rather than guess", BODY_PROMPT.includes("寧可漏掉也不要猜"));
ok("and to take the latest reading when several are shown", BODY_PROMPT.includes("最新"));

console.log(`${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("\nFAILURES:\n" + failures.map((f) => "  " + f).join("\n"));
  process.exit(1);
}
