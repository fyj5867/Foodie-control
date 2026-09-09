/**
 * Checks for the exercise suggestions and their video links.
 *
 * The two things that would quietly ruin this feature:
 *   - a link that goes nowhere (which is why they are searches, not video ids),
 *   - a list of four cardio videos handed to someone who cannot do cardio.
 * Run from source/:  node tools/test-workouts.mjs
 */
import {
  WORKOUTS,
  GOALS,
  youtubeSearchUrl,
  isSafeLink,
  normalizeLinks,
  cautionsFor,
  goalsFor,
  recommendWorkouts,
  activityLabelFor,
} from "../lib/workouts.js";
import { ACTIVITY_LOG_OPTIONS } from "../lib/health.js";

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

/* --- the catalogue is well formed --- */
const ids = new Set();
const activityIds = new Set(ACTIVITY_LOG_OPTIONS.map((o) => o.id));
for (const wk of WORKOUTS) {
  ok(`${wk.id} has a unique id`, !ids.has(wk.id), wk.id);
  ids.add(wk.id);
  ok(`${wk.id} maps to a real activity`, activityIds.has(wk.activityId), wk.activityId);
  ok(`${wk.id} has a search query`, Boolean(wk.query && wk.query.length > 4), wk.id);
  ok(`${wk.id}'s goals are all defined`, wk.goals.every((g) => GOALS[g]), JSON.stringify(wk.goals));
  ok(`${wk.id} has minutes`, wk.minutes > 0, wk.id);
  ok(`${wk.id} says something useful`, wk.note.length > 8, wk.id);
}
ok("there is at least one resistance option", WORKOUTS.some((w) => w.category === "resistance"));
ok("and one flexibility option", WORKOUTS.some((w) => w.category === "flexibility"));
ok("and something for the worst days", WORKOUTS.some((w) => w.impact === "very-low"));

/* --- links --- */
const url = youtubeSearchUrl("超慢跑 教學 初學者 30分鐘");
ok("a search url points at YouTube", url.startsWith("https://www.youtube.com/results?search_query="), url);
ok("the query is encoded", !url.includes(" "), url);
/* No workout may carry a hard-coded video id: those go dead and the app has
 * no way to find out. See the note at the top of lib/workouts.js. */
for (const wk of WORKOUTS) {
  ok(`${wk.id} has no pinned video id`, !/watch\?v=|youtu\.be\//.test(JSON.stringify(wk)), wk.id);
}

ok("an https link is safe", isSafeLink("https://www.youtube.com/watch?v=abc123"));
ok("an http link is safe", isSafeLink("http://example.com/v"));
ok("a javascript: url is not", !isSafeLink("javascript:alert(1)"));
ok("a data: url is not", !isSafeLink("data:text/html,<script>x</script>"));
ok("empty is not", !isSafeLink(""));
ok("nonsense is not", !isSafeLink("not a url"));

check(
  "only known ids with safe links are kept",
  normalizeLinks({ "slow-jog": "https://youtu.be/x", nope: "https://y", stretch: "javascript:x" }),
  { "slow-jog": "https://youtu.be/x" }
);
check("garbage is no links", normalizeLinks(null), {});

/* --- what matters for this person --- */
const prediabetic = { gender: "female", height: 160, weight: 70, symptoms: ["prediabetes"] };
ok("prediabetes puts blood sugar on the list", goalsFor({ profile: prediabetic }).includes("glucose"));
ok("a BMI over 24 puts weight on the list", goalsFor({ profile: prediabetic }).includes("weight"));
ok("strength is always on the list", goalsFor({}).includes("strength"));
ok("so is something gentle", goalsFor({}).includes("mobility"));

const lipidReport = { date: "2026-09-01", values: { triglycerides: 260, hdl: 38 } };
ok("a lipid finding puts lipids first", goalsFor({ profile: prediabetic, report: lipidReport })[0] === "lipid");

/* --- the mix --- */
const picks = recommendWorkouts({ profile: prediabetic, report: lipidReport, exerciseLog: [] });
check("four suggestions", picks.length, 4);
ok("always one resistance option", picks.some((p) => p.category === "resistance"), picks.map((p) => p.id).join(","));
ok("always one flexibility option", picks.some((p) => p.category === "flexibility"), picks.map((p) => p.id).join(","));
ok("every suggestion has a reason", picks.every((p) => p.why && p.why.length > 2), JSON.stringify(picks.map((p) => p.why)));
/* Only the first card says "start here" — on all four it is wallpaper. */
ok(
  "only one suggestion is marked as the place to start",
  picks.filter((p) => p.why.includes("開始最容易接上")).length <= 1,
  picks.map((p) => p.why).join(" / ")
);
ok("every suggestion has a working link", picks.every((p) => p.url.startsWith("https://www.youtube.com/")));
ok("no duplicates", new Set(picks.map((p) => p.id)).size === picks.length);

/* Someone who has logged nothing gets things they can actually start. */
const beginnerPicks = recommendWorkouts({ profile: prediabetic, exerciseLog: [] });
ok(
  "a beginner is not sent straight to the hard options",
  beginnerPicks.filter((p) => p.level === "beginner").length >= 3,
  beginnerPicks.map((p) => `${p.id}:${p.level}`).join(",")
);

/* Carrying more weight changes what is offered, not how much. */
const heavy = recommendWorkouts({
  profile: { gender: "female", height: 158, weight: 82, symptoms: [] },
  exerciseLog: [],
});
check("still four suggestions", heavy.length, 4);
ok(
  "nothing medium or high impact for a heavier frame",
  heavy.every((p) => p.impact === "low" || p.impact === "very-low"),
  heavy.map((p) => `${p.id}:${p.impact}`).join(",")
);

/* --- cautions --- */
const bpCautions = cautionsFor({ profile: { symptoms: ["hypertension"] } });
ok("high blood pressure warns about breath holding", bpCautions.some((c) => c.includes("憋氣")), JSON.stringify(bpCautions));
const always = cautionsFor({});
ok("everyone is told when to stop", always.some((c) => c.includes("胸悶") && c.includes("就醫")), JSON.stringify(always));
const veryHigh = cautionsFor({ profile: {}, report: { values: { systolic: 168, diastolic: 102 } } });
ok(
  "a very high reading sends her to a doctor first",
  veryHigh.some((c) => c.includes("醫師")),
  JSON.stringify(veryHigh)
);
ok("cautions stay short enough to read", always.length <= 4, JSON.stringify(always));

/* --- recording a suggestion --- */
check("a mapped activity uses the log's own label", activityLabelFor(WORKOUTS.find((w) => w.id === "slow-jog")), "超慢跑");
check(
  "an unmapped one keeps its own",
  activityLabelFor(WORKOUTS.find((w) => w.id === "chair-workout")),
  "椅子運動"
);

/* --- wording --- */
const copy = [
  ...WORKOUTS.map((w) => `${w.label} ${w.note}`),
  ...cautionsFor({ profile: { symptoms: ["hypertension", "prediabetes"] } }),
  ...picks.map((p) => p.why),
].join(" | ");
for (const word of ["保證", "一定會", "治好", "痊癒", "會降", "失敗", "危險"]) {
  ok(`the exercise copy never says 「${word}」`, !copy.includes(word), copy);
}

console.log(`${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("\nFAILURES:\n" + failures.map((f) => "  " + f).join("\n"));
  process.exit(1);
}
