/**
 * Checks for the health calculations that have conditional inputs.
 *
 * Mostly this guards the optional-age paths: a measured BMR makes age
 * unnecessary, the formula fallback needs it, and neither present must produce
 * no target rather than a target built on a missing number.
 *
 * Run from source/:  node tools/test-health.mjs
 */
import {
  calcDailyCalorieTargetBreakdown,
  calcDailyCalorieTarget,
  calcRiskScore,
  calcWaterTarget,
  calcBMI,
  sleepZones,
  CONTENT_REVIEW,
} from "../lib/health.js";

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

const base = { gender: "female", height: 160, weight: 68, activityLevel: "light", symptoms: [] };

/* --- with age, no body record: the formula path --- */
const withAge = calcDailyCalorieTargetBreakdown({ ...base, age: 52 }, null);
ok("age alone gives a target", withAge != null);
check("formula BMR is used", withAge.bmrSource, "formula");
// 10*68 + 6.25*160 - 5*52 - 161 = 1259; *1.375 = 1731; BMI 26.6 >= 24 so -500
check("target matches Mifflin-St Jeor minus the deficit", withAge.target, 1231);
check("the deficit is reported", withAge.deficitApplied, true);

/* --- no age, no body record: nothing honest to say --- */
check("no age and no BMR gives no target", calcDailyCalorieTargetBreakdown({ ...base, age: "" }, null), null);
check("null age also gives no target", calcDailyCalorieTargetBreakdown({ ...base, age: null }, null), null);
check("a non-numeric age gives no target", calcDailyCalorieTargetBreakdown({ ...base, age: "abc" }, null), null);
check("calcDailyCalorieTarget mirrors that", calcDailyCalorieTarget({ ...base, age: "" }, null), null);

/* --- no age but a measured BMR: age is genuinely unnecessary --- */
const recordBmr = { date: "2026-09-06", bmr: "1300", weight: "67" };
const noAgeWithBmr = calcDailyCalorieTargetBreakdown({ ...base, age: "" }, recordBmr);
ok("a measured BMR works without age", noAgeWithBmr != null);
check("the record BMR is used", noAgeWithBmr.bmrSource, "record");
// 1300 * 1.375 = 1787.5; BMI 26.6 >= 24 so -500 -> 1288 (rounded)
check("target comes from the measured BMR", noAgeWithBmr.target, 1288);

/* --- a measured BMR wins over the formula even when age is present --- */
const bothKnown = calcDailyCalorieTargetBreakdown({ ...base, age: 52 }, recordBmr);
check("the measured BMR takes precedence", bothKnown.bmrSource, "record");

/* --- height and weight remain genuinely required --- */
check("no weight gives no target", calcDailyCalorieTargetBreakdown({ ...base, weight: "", age: 52 }, recordBmr), null);
check("no height gives no target", calcDailyCalorieTargetBreakdown({ ...base, height: "", age: 52 }, recordBmr), null);

/* --- the safety floor still applies --- */
const tiny = calcDailyCalorieTargetBreakdown(
  { gender: "female", height: 150, weight: 45, activityLevel: "sedentary", age: 70 },
  null
);
ok("a low estimate is floored, not left below the floor", tiny.target >= 1200, String(tiny.target));

/* --- risk score without age must not throw, and must not invent points --- */
const withAgeScore = calcRiskScore({ ...base, age: 52, symptoms: ["family"] });
const noAgeScore = calcRiskScore({ ...base, age: "", symptoms: ["family"] });
ok("risk score works without age", Number.isFinite(noAgeScore), String(noAgeScore));
check("the age term is worth 10 and is simply skipped", withAgeScore - noAgeScore, 10);
ok("score stays within bounds", noAgeScore >= 0 && noAgeScore <= 100, String(noAgeScore));

/* --- water target never needed age --- */
ok("water target works without age", calcWaterTarget({ ...base, age: "" }, null) != null);

/* --- sleep zones cover the recommended band --- */
const zones = sleepZones();
check("three sleep bands", zones.length, 3);
ok(
  "7-9 hours is the recommended band",
  zones.some((z) => z.y1 === 7 && z.y2 === 9),
  JSON.stringify(zones)
);
ok(
  "sleep has a cited source",
  CONTENT_REVIEW.sources.some((src) => src.includes("睡眠")),
  JSON.stringify(CONTENT_REVIEW.sources)
);

/* --- BMI sanity, since everything above leans on it --- */
ok("BMI of 68kg at 160cm is about 26.6", Math.abs(calcBMI(68, 160) - 26.5625) < 0.001);
check("BMI with no weight is null", calcBMI("", 160), null);

console.log(`${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("\nFAILURES:\n" + failures.map((f) => "  " + f).join("\n"));
  process.exit(1);
}
