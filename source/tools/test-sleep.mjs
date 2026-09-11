/**
 * Checks the hours/minutes ↔ decimal-hours translation for 睡眠時數.
 *
 * The whole reason this layer exists is that the input changed shape and the
 * stored record did not: `body-records` has held a single decimal `sleepHours`
 * since the first version, and every night already recorded is in that shape.
 * So the thing worth testing is the round trip — type 7:15, store it, load it
 * back to edit, and get 7:15 again — plus the case that motivated the change
 * (a quarter of an hour, which the old 0.5-step field could not express).
 *
 * Run from source/:  node tools/test-sleep.mjs
 */
import { joinSleep, splitSleep, formatSleep, toMinutes, SLEEP_MAX_HOURS } from "../lib/sleep.js";

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

/* --- the case she asked for --- */
check("7:15 is a quarter past seven", joinSleep("7", "15"), 7.25);
check("and reads back as she typed it", splitSleep(7.25), { h: "7", m: "15" });
check("and is shown in words", formatSleep(7.25), "7 小時 15 分");

/* --- the round trip, every minute of an hour ---
 * This is the assertion that actually protects the feature: rounding the
 * stored value to one decimal place would turn 7:20 into 7:18, and nothing
 * else in the app would notice. */
for (let m = 0; m < 60; m += 1) {
  const stored = joinSleep("7", String(m));
  const back = splitSleep(stored);
  ok(`7:${String(m).padStart(2, "0")} survives the round trip`, back.h === "7" && back.m === String(m), JSON.stringify(back));
}

/* --- whole hours still behave --- */
check("a round 8 hours", joinSleep("8", ""), 8);
check("splits with no minutes", splitSleep(8), { h: "8", m: "0" });
check("and drops the 0 分 when writing it out", formatSleep(8), "8 小時");
check("half an hour is still half an hour", joinSleep("7", "30"), 7.5);
check("an old 7.5 record opens in the two boxes", splitSleep(7.5), { h: "7", m: "30" });

/* --- nothing entered is not zero ---
 * An empty field has to stay empty: `Number("")` is 0, and 0 hours of sleep is
 * a value someone could mean. */
check("both boxes blank means no reading", joinSleep("", ""), null);
check("and blank stays blank, not 0", splitSleep(null), { h: "", m: "" });
check("a record with no sleep shows nothing", formatSleep(null), "");
check("nor does an undefined one", formatSleep(undefined), "");
check("zero, however, is a real answer", splitSleep(0), { h: "0", m: "0" });

/* --- a nap, or only minutes filled in --- */
check("45 minutes on its own", joinSleep("", "45"), 0.75);
check("and is written without a 0 小時", formatSleep(0.75), "45 分");

/* --- more than 59 in the minutes box ---
 * Adding it up is what she wrote, arithmetically; silently clamping to 59 or
 * refusing the whole entry would both be harder to understand, and the saved
 * record shows the normalised form straight back to her. */
check("7 小時 90 分 adds up", joinSleep("7", "90"), 8.5);
check("and comes back normalised", splitSleep(joinSleep("7", "90")), { h: "8", m: "30" });

/* --- junk --- */
check("letters are not a time", joinSleep("abc", "xyz"), null);
check("negatives are not a night's sleep", joinSleep("-3", "0"), null);
check("and a negative stored value shows nothing", formatSleep(-1), "");

/* --- the shared rounding helper --- */
check("minutes from decimal hours", toMinutes(7.25), 435);
check("float noise is rounded off", toMinutes(7 + 20 / 60), 440);
check("no value means no minutes", toMinutes(""), null);

ok("a day is still 24 hours", SLEEP_MAX_HOURS === 24, String(SLEEP_MAX_HOURS));

/* --- the boxes are strings, because the form's inputs are controlled ---
 * Returning numbers here would put `0` in a box she then has to delete before
 * she can type. */
const split = splitSleep(6.5);
ok("both halves come back as strings", typeof split.h === "string" && typeof split.m === "string", JSON.stringify(split));

console.log(`${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("\nFAILURES:\n" + failures.map((f) => "  " + f).join("\n"));
  process.exit(1);
}
