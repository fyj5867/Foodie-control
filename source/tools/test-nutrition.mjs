/**
 * Checks the per-food health notes.
 *
 * This is the feature most likely to do harm if the wording slips, because it
 * appears on every meal and it talks about disease. The model is deliberately
 * not allowed to write any of it — it returns tags, and every sentence comes
 * from lib/nutritionTags.js. So this file tests the sentences.
 *
 * The three rules, in order of how bad breaking them would be:
 *   1. No causal claim about her. 「增加血壓的負擔」 yes; 「會造成高血壓」 no.
 *   2. Risks are named as population associations, not predictions.
 *   3. Benefits are stated as plainly as burdens — a screen that only ever
 *      says what is wrong is a screen someone stops opening.
 *
 * Run from source/:  node tools/test-nutrition.mjs
 */
import {
  NUTRITION_TAGS,
  TAG_KEYS,
  nutritionTag,
  cleanTags,
  foodImpact,
  personalHeadline,
  MAX_PER_KIND,
} from "../lib/nutritionTags.js";
import { LAB_MARKERS } from "../lib/health.js";
import { FOOD_PROMPT } from "../lib/vision.js";

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

/* --- the catalogue is sound --- */
const markerKeys = new Set(LAB_MARKERS.map((m) => m.key));
const seen = new Set();
for (const tag of NUTRITION_TAGS) {
  ok(`${tag.key} is unique`, !seen.has(tag.key), tag.key);
  seen.add(tag.key);
  ok(`${tag.key} is a burden or a benefit`, ["burden", "benefit"].includes(tag.kind), tag.kind);
  ok(`${tag.key} has a label`, Boolean(tag.label && tag.label.length <= 12), tag.label);
  ok(`${tag.key} explains itself`, Boolean(tag.text && tag.text.length > 15), tag.key);
  /* Every marker a tag claims to bear on has to exist, or the personalised
   * line silently never fires. */
  ok(
    `${tag.key}'s markers all exist`,
    (tag.markers || []).every((m) => markerKeys.has(m)),
    JSON.stringify((tag.markers || []).filter((m) => !markerKeys.has(m)))
  );
  /* A burden without an alternative is a scolding. */
  if (tag.kind === "burden") ok(`${tag.key} offers something instead`, Boolean(tag.swap), tag.key);
}

ok("there are burdens", NUTRITION_TAGS.some((t) => t.kind === "burden"));
ok("and benefits", NUTRITION_TAGS.some((t) => t.kind === "benefit"));
/* Roughly balanced on purpose — see rule 3. */
const burdens = NUTRITION_TAGS.filter((t) => t.kind === "burden").length;
const benefits = NUTRITION_TAGS.filter((t) => t.kind === "benefit").length;
ok("burdens and benefits are roughly balanced", Math.abs(burdens - benefits) <= 4, `${burdens} vs ${benefits}`);

/* --- the model may only return tags we know --- */
check("unknown tags are dropped", cleanTags(["fried", "nonsense", "vegetable"]), ["fried", "vegetable"]);
check("duplicates collapse", cleanTags(["fried", "fried"]), ["fried"]);
check("garbage is no tags", cleanTags(null), []);
check("non-strings are ignored", cleanTags([1, {}, "fried"]), ["fried"]);
/* Tags come back in the catalogue's order, not the order the model listed
 * them, so two identical meals read the same way. */
check("order is the catalogue's", cleanTags(["vegetable", "fried"]), ["fried", "vegetable"]);

/* Every tag in the vocabulary has to be in the prompt, or the model will
 * never return it and the entry is dead weight. */
for (const key of TAG_KEYS) {
  ok(`${key} is offered to the model`, FOOD_PROMPT.includes(key), key);
}
/* And nothing in the prompt may be a tag the app does not know. */
/* Scoped to the tag section: the traffic-light rules above it are also
 * written as `- green：…` bullets and are not tags. */
const tagSection = FOOD_PROMPT.slice(FOOD_PROMPT.indexOf("tags："));
const promptTags = [...tagSection.matchAll(/^- ([a-z_]+)：/gm)].map((m) => m[1]);
for (const key of promptTags) {
  ok(`the prompt's ${key} is a real tag`, TAG_KEYS.includes(key), key);
}

/* --- impact without a report is still useful --- */
const general = foodImpact({ tags: ["fried", "high_sodium", "vegetable"] });
check("burdens are listed", general.burdens.map((b) => b.key), ["fried", "high_sodium"]);
check("so are benefits", general.benefits.map((b) => b.key), ["vegetable"]);
check("nothing is personal without a report", general.matchesReport, false);
check("and there is no personalised heading", personalHeadline(general), null);

/* --- with a report, what she is already watching comes first --- */
const report = {
  date: "2026-08-15",
  values: { triglycerides: 186, systolic: 132, diastolic: 86, fastingGlucose: 108 },
};
const personal = foodImpact({
  tags: ["organ_meat", "high_sodium", "sugary_drink", "vegetable", "fermented"],
  report,
  gender: "female",
});
ok(
  "a tag touching an out-of-range value comes first",
  ["high_sodium", "sugary_drink"].includes(personal.burdens[0].key),
  personal.burdens.map((b) => `${b.key}:${b.hitCount}`).join(",")
);
ok("and carries her own number", personal.burdens[0].personal.includes("13") || personal.burdens[0].personal.includes("186"), personal.burdens[0].personal);
ok("with the range it sits in", /（/.test(personal.burdens[0].personal), personal.burdens[0].personal);
check("it knows the meal relates to her report", personal.matchesReport, true);
ok("the headline names her values", Boolean(personalHeadline(personal)), String(personalHeadline(personal)));

/* A tag whose markers are all normal is not dressed up as personal. */
const normalReport = { date: "2026-08-15", values: { triglycerides: 100, systolic: 110, diastolic: 70 } };
const notPersonal = foodImpact({ tags: ["high_sodium"], report: normalReport, gender: "female" });
check("a normal value is not made personal", notPersonal.burdens[0].personal, null);
check("and the meal is not claimed to relate to her report", notPersonal.matchesReport, false);

/* --- the card stays readable --- */
const everything = foodImpact({ tags: TAG_KEYS, report, gender: "female" });
ok("burdens are capped", everything.burdens.length <= MAX_PER_KIND, String(everything.burdens.length));
ok("benefits are capped", everything.benefits.length <= MAX_PER_KIND, String(everything.benefits.length));

/* --- kidney tags defer rather than prescribe --- */
const phosphorus = nutritionTag("additive_phosphorus");
ok("the phosphorus tag leaves the limit to a doctor", phosphorus.text.includes("醫師"), phosphorus.text);
ok(
  "and names no gram target",
  !/\d+\s*(克|mg|毫克)/.test(phosphorus.text + phosphorus.swap),
  phosphorus.text + phosphorus.swap
);

/* --- the wording --- */
const copy = NUTRITION_TAGS.map((t) => `${t.label} ${t.text} ${t.risk || ""} ${t.swap || ""}`).join(" | ");

/* No causal claim, no promise, no prediction about her. */
const BANNED = [
  "會造成",
  "會導致",
  "會引發",
  "會得到",
  "一定會",
  "保證",
  "治好",
  "痊癒",
  "確診",
  "你有糖尿病",
  "診斷為",
  "停藥",
  "不用看醫生",
  "失敗",
  "危險",
];
for (const word of BANNED) {
  ok(`the food notes never say 「${word}」`, !copy.includes(word), copy.slice(0, 200));
}

/* Where a disease is named, it must be as an association. */
for (const tag of NUTRITION_TAGS.filter((t) => t.risk)) {
  ok(
    `${tag.key}'s risk is phrased as an association`,
    /風險有關|有關$|有關。|致癌物/.test(tag.risk),
    tag.risk
  );
}

/* The one thing that must be true of every burden line: it describes a load
 * on the body or a mechanism, and offers an alternative. */
for (const tag of NUTRITION_TAGS.filter((t) => t.kind === "burden")) {
  ok(`${tag.key} says what to do instead`, tag.swap.length > 5, tag.swap);
}

console.log(`${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("\nFAILURES:\n" + failures.map((f) => "  " + f).join("\n"));
  process.exit(1);
}
