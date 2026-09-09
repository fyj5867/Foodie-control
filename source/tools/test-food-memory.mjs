/**
 * Checks for the remembered-calories rules.
 *
 * These decide what number ends up in the diary, and the diary is what the
 * garden counts, so a wrong figure applied silently would not just annoy —
 * it would change whether days counted as met. Run from source/:
 *   node tools/test-food-memory.mjs
 */
import {
  normalizeName,
  isValidCalories,
  isLearnable,
  lookup,
  remember,
  forget,
  suggestion,
  sortedMemory,
  normalizeMemory,
  MIN_CALORIES,
  MAX_CALORIES,
  MAX_ENTRIES,
} from "../lib/foodMemory.js";

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

const AT = "2026-09-09T08:00:00.000Z";

/* --- name matching --- */
check("spacing does not make a different food", normalizeName("御選 肉鬆飯糰"), normalizeName("御選肉鬆飯糰"));
check("full-width spaces too", normalizeName("御選　肉鬆飯糰"), normalizeName("御選肉鬆飯糰"));
check("brackets are ignored", normalizeName("茶葉蛋（大）"), normalizeName("茶葉蛋大"));
check("latin case is ignored", normalizeName("Latte"), normalizeName("latte"));
check("an empty name has no key", normalizeName("  "), "");

/* Portion wording is NOT ignored. Treating these as one food would apply a
 * bowl's calories to half a bowl, which is the error this feature exists to
 * avoid — a wrong number that appears on its own. */
ok("a different portion is a different food", normalizeName("白飯") !== normalizeName("白飯大碗"));
ok("a longer name is not the same food", normalizeName("飯糰") !== normalizeName("肉鬆飯糰"));

/* --- what is worth remembering --- */
ok("a real food and figure is learnable", isLearnable("御選肉鬆飯糰", 251));
ok("the AI's placeholder name is not", !isLearnable("無法辨識", 251));
ok("neither is the manual placeholder", !isLearnable("未命名食物", 400));
ok("a one-character name is not identifiable enough", !isLearnable("飯", 251));
ok("zero calories is not a figure", !isLearnable("御選肉鬆飯糰", 0));
ok("a negative figure is not", !isLearnable("御選肉鬆飯糰", -20));
ok("an absurd figure is not", !isLearnable("御選肉鬆飯糰", MAX_CALORIES + 1));
ok("text is not a figure", !isLearnable("御選肉鬆飯糰", "abc"));
ok("the floor itself is fine", isValidCalories(MIN_CALORIES));
ok("the ceiling itself is fine", isValidCalories(MAX_CALORIES));

/* --- remembering --- */
let mem = [];
mem = remember(mem, { name: "御選肉鬆飯糰", calories: 251, at: AT });
check("one food remembered", mem.length, 1);
check("the corrected figure is kept", lookup(mem, "御選肉鬆飯糰").calories, 251);
check("and found again despite spacing", lookup(mem, "御選 肉鬆飯糰").calories, 251);
check("first correction counts once", lookup(mem, "御選肉鬆飯糰").times, 1);

mem = remember(mem, { name: "御選肉鬆飯糰", calories: 251, at: AT });
check("confirming the same figure does not duplicate", mem.length, 1);
check("confirming the same figure counts up", lookup(mem, "御選肉鬆飯糰").times, 2);

/* A changed figure replaces the old one and starts counting again — the old
 * count was evidence for a number that has just been declared wrong. */
mem = remember(mem, { name: "御選肉鬆飯糰", calories: 268, at: AT });
check("a new figure replaces the old", lookup(mem, "御選肉鬆飯糰").calories, 268);
check("and its count starts over", lookup(mem, "御選肉鬆飯糰").times, 1);

/* Nothing unlearnable ever enters the list. */
const before = mem.length;
check("an unrecognised name is not learned", remember(mem, { name: "無法辨識", calories: 300 }).length, before);
check("a zero figure is not learned", remember(mem, { name: "滷肉飯", calories: 0 }).length, before);

/* --- forgetting --- */
check("a food can be forgotten", forget(mem, "御選肉鬆飯糰").length, before - 1);
check("forgetting matches on spacing too", forget(mem, "御選 肉鬆飯糰").length, before - 1);
check("forgetting something absent changes nothing", forget(mem, "沒記過的東西").length, before);

/* --- the suggestion shown on the analysis card --- */
let m2 = remember([], { name: "御選肉鬆飯糰", calories: 251, at: AT });
const s = suggestion(m2, "御選肉鬆飯糰", 320);
check("suggests the remembered figure", s.calories, 251);
check("and keeps the AI's guess for the way back", s.estimate, 320);

/* When the guess already matches, saying so would be noise. */
check("no suggestion when the guess already agrees", suggestion(m2, "御選肉鬆飯糰", 251), null);
check("rounding counts as agreeing", suggestion(m2, "御選肉鬆飯糰", 250.6), null);
check("no suggestion for a food never corrected", suggestion(m2, "牛肉麵", 600), null);
check("no suggestion from an empty memory", suggestion([], "御選肉鬆飯糰", 320), null);

/* --- ordering --- */
let m3 = [];
m3 = remember(m3, { name: "牛肉麵", calories: 600, at: "2026-09-01T00:00:00.000Z" });
m3 = remember(m3, { name: "御選肉鬆飯糰", calories: 251, at: "2026-09-08T00:00:00.000Z" });
m3 = remember(m3, { name: "茶葉蛋", calories: 75, at: "2026-09-05T00:00:00.000Z" });
check("most recently corrected reads first", sortedMemory(m3).map((e) => e.name), ["御選肉鬆飯糰", "茶葉蛋", "牛肉麵"]);

/* --- the cap --- */
let big = [];
for (let i = 0; i < MAX_ENTRIES + 25; i++) {
  const day = String((i % 28) + 1).padStart(2, "0");
  big = remember(big, { name: `食物編號${i}`, calories: 100 + i, at: `2026-09-${day}T00:00:00.000Z` });
}
check("the list is capped", big.length, MAX_ENTRIES);

/* --- reading back what storage or a backup file holds --- */
check("garbage is not a memory", normalizeMemory(null), []);
check("a non-array is not a memory", normalizeMemory({ a: 1 }), []);
const repaired = normalizeMemory([
  { name: "御選肉鬆飯糰", calories: "251", times: "3", updatedAt: AT },
  { name: "御選 肉鬆飯糰", calories: 900, updatedAt: AT }, // same food, later row
  { name: "無法辨識", calories: 300, updatedAt: AT },
  { calories: 200, updatedAt: AT },
  { name: "牛肉麵", calories: 99999, updatedAt: AT },
  null,
]);
check("only the sound rows survive", repaired.map((e) => e.name), ["御選肉鬆飯糰"]);
check("numbers stored as text are repaired", repaired[0].calories, 251);
check("counts stored as text are repaired", repaired[0].times, 3);
check("the first row wins a duplicate", repaired.length, 1);

/* A row with no timestamp still has to sort, so one is supplied. */
const noDate = normalizeMemory([{ name: "滷肉飯", calories: 500 }]);
ok("a row with no timestamp gets one", typeof noDate[0].updatedAt === "string" && noDate[0].updatedAt.length > 0);

console.log(`${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("\nFAILURES:\n" + failures.map((f) => "  " + f).join("\n"));
  process.exit(1);
}
