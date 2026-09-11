/**
 * Checks the sanity pass over a food photo reading.
 *
 * The point of this file is one gap: every other number a vision model hands
 * this app is bounded before it is shown (lab markers, scale readings), and
 * the meal's calorie figure was not — it went straight into the diary, whose
 * daily total is what decides whether the garden grows.
 *
 * Food differs from a lab value in one way that shapes everything here: a
 * rejected lab value can simply stay empty, and a rejected meal is 0, which is
 * worse than a suspicious number. So almost nothing is thrown away — the
 * checks produce warnings next to a figure she can still edit.
 *
 * Run from source/:  node tools/test-food-estimate.mjs
 */
import {
  normalizeFoodReading,
  macroCalories,
  sourceNote,
  applyPortion,
  num,
  PORTIONS,
  MEAL_CALORIE_HIGH,
  MEAL_CALORIE_LIMIT,
  MACRO_TOLERANCE,
  KCAL_PER_G,
} from "../lib/foodEstimate.js";

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

const codes = (r) => r.warnings.map((w) => w.code);

/* A reading where everything agrees: 60g carb, 20g protein, 12g fat
 * = 240 + 80 + 108 = 428. */
const good = {
  foodName: "雞腿便當",
  estimatedCalories: 430,
  carbsG: 60,
  proteinG: 20,
  fatG: 12,
  light: "yellow",
  confidence: "medium",
  sourceType: "estimate",
  items: [
    { name: "白飯", kcal: 250 },
    { name: "烤雞腿", kcal: 150 },
    { name: "燙青菜", kcal: 30 },
  ],
};

/* --- the quiet case: nothing wrong, nothing said --- */
const clean = normalizeFoodReading(good);
check("a consistent reading raises nothing", codes(clean), []);
check("and keeps its number", clean.estimatedCalories, 430);
check("and its items", clean.items.length, 3);

/* --- numbers that are not numbers ---
 * `Number(null)` is 0 and `Number("約 320")` is NaN; both used to end up as a
 * silent 0 大卡, which reads as a real answer. */
check("a missing figure is reported, not assumed", codes(normalizeFoodReading({ foodName: "x" })), ["no-calories"]);
check("and left at 0 for her to fill in", normalizeFoodReading({ foodName: "x" }).estimatedCalories, 0);
check("a number written as a sentence still counts", num("約 320 大卡"), 320);
check("so does a decimal", num("320.5"), 320.5);
check("blank is not zero", num(""), null);
check("null is not zero", num(null), null);
check("and neither is prose", num("不確定"), null);
check("a negative meal is no meal", codes(normalizeFoodReading({ estimatedCalories: -50 })), ["no-calories"]);

/* --- the 每 100 公克 trap ---
 * The most common real misread: the packet says 520 kcal per 100g, the packet
 * holds 45g, and the model copies 520. The number looks perfectly ordinary. */
const high = normalizeFoodReading({ ...good, estimatedCalories: 2600, carbsG: null, proteinG: null, fatG: null, items: [] });
check("an oversized meal is flagged", codes(high), ["high"]);
check("but the figure is kept — it might be right", high.estimatedCalories, 2600);
ok(
  "the warning names the 每100公克 trap, which is the actual mistake",
  high.warnings[0].text.includes("每 100 公克"),
  high.warnings[0].text
);
const absurd = normalizeFoodReading({ ...good, estimatedCalories: 99000, carbsG: null, proteinG: null, fatG: null, items: [] });
check("an impossible one is cleared", absurd.estimatedCalories, 0);
check("and says so", codes(absurd), ["impossible"]);
ok("the boundary is between the two", MEAL_CALORIE_HIGH < MEAL_CALORIE_LIMIT, `${MEAL_CALORIE_HIGH} / ${MEAL_CALORIE_LIMIT}`);

/* --- macros against calories ---
 * 4/4/9 kcal per gram is a definition, not an estimate, so a large gap means
 * one of the two was misread — and it is exactly the kind of error the model
 * cannot see in itself: it will hand you both numbers with equal confidence. */
check("the macro arithmetic", macroCalories({ carbsG: 60, proteinG: 20, fatG: 12 }), 428);
check("a half-filled set cannot be checked", macroCalories({ carbsG: 60, proteinG: 20 }), null);
check("nor can an empty one", macroCalories({}), null);
const mismatch = normalizeFoodReading({ ...good, estimatedCalories: 430, carbsG: 150, proteinG: 40, fatG: 30, items: [] });
ok("macros that do not add up are flagged", codes(mismatch).includes("macro-mismatch"), JSON.stringify(codes(mismatch)));
ok(
  "and the warning shows both numbers so she can see which is wrong",
  /1030/.test(mismatch.warnings.find((w) => w.code === "macro-mismatch").text) &&
    /430/.test(mismatch.warnings.find((w) => w.code === "macro-mismatch").text),
  mismatch.warnings.find((w) => w.code === "macro-mismatch").text
);
/* Fibre, alcohol and rounding all live inside the tolerance, so ordinary
 * readings must stay quiet — a check that cries wolf gets ignored. */
const nearly = normalizeFoodReading({ ...good, estimatedCalories: 470, carbsG: 60, proteinG: 20, fatG: 12, items: [] });
check("a reading inside the tolerance says nothing", codes(nearly), []);
ok("the tolerance is generous but not meaningless", MACRO_TOLERANCE >= 0.2 && MACRO_TOLERANCE <= 0.4, String(MACRO_TOLERANCE));
/* A small meal's 30% is a few dozen calories; nagging about that is noise. */
const tinyGap = normalizeFoodReading({ foodName: "咖啡", estimatedCalories: 120, carbsG: 10, proteinG: 5, fatG: 5, items: [] });
check("a small absolute gap is not worth a warning", codes(tinyGap), []);
check("the four/four/nine constants are the real ones", KCAL_PER_G, { carbsG: 4, proteinG: 4, fatG: 9 });

/* --- the per-dish breakdown ---
 * The breakdown is what makes the total auditable: without it a wrong number
 * is a number she cannot see into. */
const itemGap = normalizeFoodReading({
  ...good,
  estimatedCalories: 430,
  carbsG: null,
  proteinG: null,
  fatG: null,
  items: [
    { name: "白飯", kcal: 250 },
    { name: "炸雞腿", kcal: 600 },
  ],
});
ok("items that do not sum to the total are flagged", codes(itemGap).includes("items-mismatch"), JSON.stringify(codes(itemGap)));
/* One item cannot disagree with itself in a useful way — the total is simply
 * that item, and a warning would only be telling her the model rounded. */
const single = normalizeFoodReading({
  foodName: "飯糰",
  estimatedCalories: 251,
  carbsG: null, proteinG: null, fatG: null,
  items: [{ name: "飯糰", kcal: 300 }],
});
check("a single item raises nothing", codes(single), []);
const partialItems = normalizeFoodReading({
  ...good,
  carbsG: null, proteinG: null, fatG: null,
  items: [{ name: "白飯", kcal: 250 }, { name: "配菜" }],
});
check("items missing their own figure are not summed", codes(partialItems), []);
check("but they are still listed", partialItems.items.length, 2);
check("an item with no name is dropped", normalizeFoodReading({ items: [{ kcal: 50 }] }).items, []);
check("junk in the items array is ignored", normalizeFoodReading({ items: ["白飯", null, 5] }).items, []);
check("items are capped", normalizeFoodReading({ items: Array.from({ length: 40 }, (_, i) => ({ name: `菜${i}`, kcal: 10 })) }).items.length, 8);

/* --- individually impossible macros --- */
check("500g of fat in one meal is a misread", normalizeFoodReading({ estimatedCalories: 400, fatG: 900 }).fatG, null);
check("and a sane one survives", normalizeFoodReading({ estimatedCalories: 400, fatG: 12 }).fatG, 12);

/* --- where the number came from ---
 * The prompt asks the model to be honest about confidence and to say when it
 * read a printed label; the card then threw both away, so a guess and a
 * transcription looked identical. */
/* No number, nothing to explain: describing how a figure was derived when
 * there is no figure is just words around an empty box. */
check("no calories means no source line", sourceNote({ sourceType: "label", confidence: "high", estimatedCalories: 0 }), null);
check("and nothing at all means nothing", sourceNote(null), null);
ok("a label reading is called out as the reliable one", sourceNote({ sourceType: "label", confidence: "high", estimatedCalories: 251 }).tone === "good");
ok("low confidence is passed on rather than hidden", sourceNote({ sourceType: "estimate", confidence: "low", estimatedCalories: 251 }).tone === "warn");
check("the middle case is plain", sourceNote({ sourceType: "estimate", confidence: "medium", estimatedCalories: 251 }).tone, "plain");
ok("every note actually says something", ["label", "estimate"].every((t) => ["low", "medium", "high"].every((c) => sourceNote({ sourceType: t, confidence: c, estimatedCalories: 251 }).text.length > 6)));
/* These sentences are about the estimate, never about her health — that wording
 * all lives in lib/nutritionTags.js and is checked there. */
const BANNED = ["血糖", "疾病", "糖尿病", "建議你吃", "會造成", "診斷", "治療"];
for (const t of ["label", "estimate"]) {
  for (const c of ["low", "medium", "high"]) {
    const text = sourceNote({ sourceType: t, confidence: c, estimatedCalories: 251 }).text;
    ok(`${t}/${c} says nothing medical`, !BANNED.some((w) => text.includes(w)), text);
  }
}
const allWarnings = [high, absurd, mismatch, itemGap, normalizeFoodReading({})].flatMap((r) => r.warnings.map((w) => w.text));
for (const text of allWarnings) {
  ok("a warning stays about the estimate", !BANNED.some((w) => text.includes(w)), text);
  ok("and tells her what to do or what was found", text.length > 8, text);
}

/* --- 吃了多少 ---
 * Half a photographed bento is the commonest correction there is, and doing it
 * by hand means arithmetic at the table. */
const base = normalizeFoodReading(good);
const half = applyPortion(base, 0.5);
check("half a meal is half the calories", half.estimatedCalories, 215);
check("and half the macros", [half.carbsG, half.proteinG, half.fatG], [30, 10, 6]);
check("and the breakdown follows", half.items.map((i) => i.kcal), [125, 75, 15]);
const twice = applyPortion(base, 2);
check("two portions double it", twice.estimatedCalories, 860);
/* Always from the original, never from what is on screen: compounding would
 * turn two taps of 「吃一半」 into a quarter with nothing saying so. */
check("pressing 吃一半 twice is still a half, not a quarter", applyPortion(applyPortion(base, 0.5), 0.5).estimatedCalories, 215);
check("and 整份 returns the whole thing", applyPortion(applyPortion(base, 0.5), 1).estimatedCalories, 430);
check("and two portions after a half is a clean double", applyPortion(applyPortion(base, 0.5), 2).estimatedCalories, 860);
check("a missing macro stays missing", applyPortion(normalizeFoodReading({ estimatedCalories: 200 }), 0.5).carbsG, null);
check("a nonsense factor changes nothing", applyPortion(base, 0).estimatedCalories, 430);
ok("there is a plain 整份 to come back to", PORTIONS.some((p) => p.factor === 1), JSON.stringify(PORTIONS.map((p) => p.factor)));
ok("every portion has a label and a positive factor", PORTIONS.every((p) => p.label && p.factor > 0));

console.log(`${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("\nFAILURES:\n" + failures.map((f) => "  " + f).join("\n"));
  process.exit(1);
}
