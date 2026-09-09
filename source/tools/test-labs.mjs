/**
 * Checks for health check report values: the reference ranges, the metabolic
 * syndrome count, and what is allowed into storage.
 *
 * These numbers are read off a photograph by a model and then shown to a
 * person as a judgement about their own body. Two failure modes matter more
 * than anything else here, and both are silent:
 *   - a misread value stored as if it were real, and
 *   - a value graded against the wrong sex's range.
 * Run from source/:  node tools/test-labs.mjs
 */
import {
  LAB_MARKERS,
  labMarker,
  labZone,
  labZonesFor,
  metabolicSyndrome,
  outOfRangeMarkers,
  isPlausibleLabValue,
  CONTENT_REVIEW,
} from "../lib/health.js";
import {
  cleanValues,
  normalizeReport,
  normalizeReports,
  upsertReport,
  removeReport,
  latestReport,
  markerHistory,
  markerChange,
  mergeReadings,
  MAX_PAGES,
} from "../lib/reports.js";

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

/* --- every marker is properly formed --- */
for (const marker of LAB_MARKERS) {
  ok(`${marker.key} has a label and unit`, Boolean(marker.label && marker.unit), marker.key);
  ok(`${marker.key} has plausibility bounds`, Array.isArray(marker.plausible) && marker.plausible.length === 2, marker.key);
  const zones = labZonesFor(marker.key, "female");
  if (zones) {
    ok(`${marker.key}'s last zone catches everything`, zones[zones.length - 1].lt == null, marker.key);
    ok(
      `${marker.key}'s zone bounds only increase`,
      zones.every((z, i) => i === 0 || z.lt == null || z.lt > zones[i - 1].lt),
      JSON.stringify(zones.map((z) => z.lt))
    );
    /* Every zone label carries its own numbers, so what is on screen is a
     * comparison the person can check rather than a verdict to trust. */
    ok(`${marker.key}'s zone labels state the range`, zones.every((z) => /\d/.test(z.label)), marker.key);
  }
}

/* --- the cutoffs this app exists for --- */
check("fasting glucose 99 is normal", labZone("fastingGlucose", 99, "female").tone, "green");
check("fasting glucose 100 is the prediabetes range", labZone("fastingGlucose", 100, "female").tone, "yellow");
check("fasting glucose 125 is still that range", labZone("fastingGlucose", 125, "female").tone, "yellow");
check("fasting glucose 126 reaches the diabetes cutoff", labZone("fastingGlucose", 126, "female").tone, "red");
check("HbA1c 5.6 is normal", labZone("hba1c", 5.6, "female").tone, "green");
check("HbA1c 5.7 is the prediabetes range", labZone("hba1c", 5.7, "female").tone, "yellow");
check("HbA1c 6.5 reaches the diabetes cutoff", labZone("hba1c", 6.5, "female").tone, "red");

/* The prediabetes band is deliberately yellow, not red. It is the reason this
 * app exists — something to act on, not a verdict. */
ok("the prediabetes band is never red", labZone("fastingGlucose", 110, "female").tone !== "red");

/* --- ranges that differ by sex --- */
check("HDL 45 is low for a woman", labZone("hdl", 45, "female").tone, "red");
check("HDL 45 is normal for a man", labZone("hdl", 45, "male").tone, "green");
check("waist 85 is over for a woman", labZone("waist", 85, "female").tone, "red");
check("waist 85 is fine for a man", labZone("waist", 85, "male").tone, "green");
ok("uric acid ranges differ by sex", labZone("uricAcid", 6.5, "female").tone !== labZone("uricAcid", 6.5, "male").tone);

/* --- things with no verdict --- */
check("weight is not graded", labZone("weight", 62, "female"), null);
check("an unknown marker has no zone", labZone("nonsense", 5, "female"), null);
check("a missing value has no zone", labZone("hba1c", null, "female"), null);
check("text has no zone", labZone("hba1c", "偏高", "female"), null);

/* --- misreads must not become findings --- */
ok("a normal glucose is plausible", isPlausibleLabValue("fastingGlucose", 108));
ok("a misplaced decimal is not", !isPlausibleLabValue("fastingGlucose", 1080));
ok("an HbA1c in the wrong unit is not", !isPlausibleLabValue("hba1c", 58));
ok("a negative value is not", !isPlausibleLabValue("ldl", -120));
ok("an unknown marker is never plausible", !isPlausibleLabValue("nonsense", 5));

const cleaned = cleanValues({
  fastingGlucose: 108,
  hba1c: 5.9,
  ldl: 1450, // misread
  nonsense: 3,
  triglycerides: "180",
  hdl: null,
});
check("plausible values are kept", cleaned.values, { fastingGlucose: 108, hba1c: 5.9, triglycerides: 180 });
check("an implausible value is rejected, not stored", cleaned.rejected.map((r) => r.key), ["ldl"]);
ok("and the rejection is reportable", cleaned.rejected[0].label.length > 0, JSON.stringify(cleaned.rejected));

/* --- 代謝症候群, the one place a report meets the body records --- */
const msAll = metabolicSyndrome({
  values: { systolic: 135, diastolic: 82, fastingGlucose: 108, triglycerides: 180, hdl: 46 },
  waistCm: 84,
  gender: "female",
});
check("all five criteria can be met", msAll.met, 5);
check("and that reaches the published threshold", msAll.reachesThreshold, true);

/* 85 is the metabolic syndrome cutoff for diastolic, not the 80 used for the
 * blood pressure zones. Confusing the two would over-count. */
const msDia = metabolicSyndrome({ values: { diastolic: 82 }, gender: "female" });
check("diastolic 82 alone does not meet the pressure criterion", msDia.met, 0);
const msDia85 = metabolicSyndrome({ values: { diastolic: 85 }, gender: "female" });
check("diastolic 85 does", msDia85.met, 1);

const msNone = metabolicSyndrome({ values: {}, gender: "female" });
check("nothing measured is nothing met", msNone.met, 0);
check("and it says nothing was known", msNone.known, 0);
/* Below the threshold with items unmeasured is NOT "you are fine". */
check("an unmeasured report is not marked complete", msNone.complete, false);
check("a fully measured one is", msAll.complete, true);

const msMale = metabolicSyndrome({ values: { hdl: 45 }, waistCm: 85, gender: "male" });
check("male thresholds are used for a man", msMale.met, 0);
const msFemale = metabolicSyndrome({ values: { hdl: 45 }, waistCm: 85, gender: "female" });
check("female thresholds for a woman", msFemale.met, 2);

/* --- out of range, worst first --- */
const findings = outOfRangeMarkers({ fastingGlucose: 108, hba1c: 5.4, triglycerides: 180, ldl: 170 }, "female");
check("only out-of-range markers are returned", findings.map((f) => f.key), ["ldl", "fastingGlucose", "triglycerides"]);
check("red comes before yellow", findings[0].zone.tone, "red");
check("an all-normal report has no findings", outOfRangeMarkers({ fastingGlucose: 90, hba1c: 5.2 }, "female").length, 0);

/* --- the stored shape --- */
check("a report with no date is not a report", normalizeReport({ values: { hba1c: 5.9 } }), null);
check("a report with no usable value is not a report", normalizeReport({ date: "2026-09-01", values: { nonsense: 1 } }), null);
check("a bad date is rejected", normalizeReport({ date: "2026/09/01", values: { hba1c: 5.9 } }), null);

const report = normalizeReport({ date: "2026-09-01", values: { hba1c: 5.9, fastingGlucose: "108" }, title: "公司健檢" });
check("a good report survives", report.values, { hba1c: 5.9, fastingGlucose: 108 });
check("and keeps its title", report.title, "公司健檢");
/* The photo is never part of the stored shape — see the note in reports.js. */
ok("no photo is kept", !("photo" in report) && !("imageDataUrl" in report), JSON.stringify(Object.keys(report)));

check("garbage is not a report list", normalizeReports(null), []);
const list = normalizeReports([
  { date: "2026-09-01", values: { hba1c: 5.9 } },
  { date: "2026-03-01", values: { hba1c: 6.1 } },
  { date: "nope", values: { hba1c: 5.0 } },
]);
check("reports sort oldest first", list.map((r) => r.date), ["2026-03-01", "2026-09-01"]);
check("the latest is the newest", latestReport(list).date, "2026-09-01");
check("no reports means no latest", latestReport([]), null);

const replaced = upsertReport(list, { ...list[1], values: { hba1c: 5.5 } });
check("upsert replaces rather than duplicating", replaced.length, 2);
check("with the new value", latestReport(replaced).values.hba1c, 5.5);
check("removing takes one out", removeReport(list, list[0].id).length, 1);

/* --- a second report is what makes a direction --- */
check("one report is not a trend", markerChange(list.slice(0, 1), "hba1c"), null);
const change = markerChange(list, "hba1c");
check("two reports give a direction", change.delta, -0.2);
check("history is oldest first", markerHistory(list, "hba1c").map((h) => h.value), [6.1, 5.9]);
check("a marker nobody measured has no history", markerHistory(list, "egfr"), []);

/* --- several photos of one report ---
 *
 * A report is rarely one page. Merging is where a machine reading photographs
 * can quietly do damage, so the rules are: the first page to give a value
 * wins (otherwise the result depends on the order photos were picked in), and
 * a disagreement between pages is reported rather than resolved — one of the
 * two is a misread and the code cannot know which. */
const merged = mergeReadings([
  { reportDate: "2026-08-15", labName: "某健檢中心", values: { fastingGlucose: 108, hba1c: 5.9 }, unreadable: ["腰圍"] },
  null, // this photo failed
  { values: { triglycerides: 186, fastingGlucose: 112, ldl: 1450 } },
  { values: { hdl: 46, systolic: 132, diastolic: 86 } },
]);

check(
  "values from every page are merged",
  merged.values,
  { fastingGlucose: 108, hba1c: 5.9, triglycerides: 186, hdl: 46, systolic: 132, diastolic: 86 }
);
check("the first page to give a value wins", merged.values.fastingGlucose, 108);
check("a disagreement is reported, not resolved", merged.conflicts.length, 1);
check("with both numbers and both pages", [merged.conflicts[0].kept, merged.conflicts[0].other], [108, 112]);
check("and which page each came from", [merged.conflicts[0].keptPage, merged.conflicts[0].otherPage], [1, 3]);
check("an implausible value is still rejected", merged.rejected.map((r) => r.key), ["ldl"]);
check("and the page it came from is named", merged.rejected[0].page, 3);
check("a failed photo is reported", merged.failedPages, [2]);
check("the date comes from the first page that has one", merged.reportDate, "2026-08-15");
check("so does the lab name", merged.labName, "某健檢中心");
check("what the model could not read is passed on", merged.unreadable, ["腰圍"]);
check("the page count is kept", merged.pages, 4);

/* Pages that agree are not a conflict. */
const agreeing = mergeReadings([{ values: { hba1c: 5.9 } }, { values: { hba1c: 5.9 } }]);
check("agreeing pages are not a conflict", agreeing.conflicts.length, 0);
check("and the value is kept once", agreeing.values, { hba1c: 5.9 });

/* Nothing at all is not a crash. */
check("no readings is an empty merge", mergeReadings([]).values, {});
check("garbage is an empty merge", mergeReadings(null).values, {});
check("every page failing is reported", mergeReadings([null, null]).failedPages, [1, 2]);
ok("there is a cap on how many photos are read at once", MAX_PAGES >= 2 && MAX_PAGES <= 20, String(MAX_PAGES));

/* --- the sources are recorded --- */
ok(
  "the metabolic syndrome standard is cited",
  CONTENT_REVIEW.sources.some((s) => s.includes("代謝症候群判定標準")),
  CONTENT_REVIEW.sources.join(" | ")
);
ok(
  "the prediabetes cutoffs are cited",
  CONTENT_REVIEW.sources.some((s) => s.includes("糖尿病前期")),
  CONTENT_REVIEW.sources.join(" | ")
);

console.log(`${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("\nFAILURES:\n" + failures.map((f) => "  " + f).join("\n"));
  process.exit(1);
}
