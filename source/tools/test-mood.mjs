/**
 * Checks 今日心情 — four words, one per day.
 *
 * The important property is what this store does NOT do. A mood is asked for
 * at 23:00 and shown back; nothing computes with it. The moment it becomes a
 * 1-5 score, the temptation is to correlate it against calories or sleep and
 * write "你昨天心情不好可能是因為…" — an interpretation of someone's mental
 * state, which this app has no standing to make. So the tests below pin the
 * shape (four keys, one row a day, editable) and nothing numeric.
 *
 * Run from source/:  node tools/test-mood.mjs
 */
import { MOODS, isMoodKey, moodLabel, normalizeMoods, moodFor, setMood, MAX_MOODS } from "../lib/mood.js";

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

/* --- the four options, in the order the user gave them --- */
check("four options, no more", MOODS.length, 4);
check("and in her order", MOODS.map((m) => m.label), ["低落", "煩躁", "平和", "愉悅"]);
/* Stored as keys, not labels: rewording 「愉悅」 later must not orphan every row
 * already saved under it. */
ok("stored as stable keys", MOODS.every((m) => /^[a-z]+$/.test(m.key)), JSON.stringify(MOODS.map((m) => m.key)));
ok("every key has a label", MOODS.every((m) => moodLabel(m.key) === m.label));
check("an unknown key has no label", moodLabel("ecstatic"), "");
check("and is not a mood", isMoodKey("ecstatic"), false);
check("nor is nothing", isMoodKey(null), false);
/* Nothing here is ordered or scored — no rank, no weight, no number. */
ok(
  "no option carries a score",
  MOODS.every((m) => Object.keys(m).sort().join(",") === "key,label"),
  JSON.stringify(MOODS)
);

/* --- writing one down --- */
const d1 = "2026-09-18";
const d2 = "2026-09-19";
let moods = setMood([], d1, "calm");
check("a mood is recorded", moodFor(moods, d1), "calm");
check("and nothing is recorded for another day", moodFor(moods, d2), null);

/* Changing her mind replaces the day rather than adding to it. */
moods = setMood(moods, d1, "glad");
check("choosing another replaces it", moodFor(moods, d1), "glad");
check("still one row for that day", moods.length, 1);

/* Tapping the same one again clears it — a mis-tap needs a way back, and
 * "cleared" is the same state as "never answered", so it needs no fifth word. */
moods = setMood(moods, d1, "glad");
check("tapping the same option clears it", moodFor(moods, d1), null);
check("and the row is gone", moods.length, 0);

/* --- several days --- */
moods = setMood(setMood(setMood([], d1, "low"), d2, "irritable"), "2026-09-20", "calm");
check("each day keeps its own", [moodFor(moods, d1), moodFor(moods, d2)], ["low", "irritable"]);
check("stored oldest first", moods.map((m) => m.date), ["2026-09-18", "2026-09-19", "2026-09-20"]);

/* --- what comes back from storage or an edited backup file --- */
check("junk is dropped", normalizeMoods([null, 5, "x", {}]), []);
check("an unknown mood is dropped", normalizeMoods([{ date: d1, mood: "furious" }]), []);
check("a bad date is dropped", normalizeMoods([{ date: "9/18", mood: "calm" }]), []);
check("not an array is empty", normalizeMoods("nope"), []);
/* Two rows for one day means she edited it; the later one is the answer. */
check(
  "a duplicated day keeps the last",
  normalizeMoods([{ date: d1, mood: "low" }, { date: d1, mood: "calm" }]),
  [{ date: d1, mood: "calm" }]
);
check("extra fields are not carried through", normalizeMoods([{ date: d1, mood: "calm", note: "x" }]), [{ date: d1, mood: "calm" }]);
check("a missing date is not a mood", moodFor([{ date: d1, mood: "calm" }], ""), null);

/* --- the cap ---
 * Four words a day is tiny, so this keeps years of them; the cap only exists
 * so a corrupted file cannot grow without limit. */
const many = Array.from({ length: MAX_MOODS + 50 }, (_, i) => ({
  date: `20${20 + Math.floor(i / 365)}-01-01`.slice(0, 8) + String((i % 28) + 1).padStart(2, "0"),
  mood: "calm",
}));
ok("the cap holds", normalizeMoods(many).length <= MAX_MOODS, String(normalizeMoods(many).length));
ok("and it is years, not days", MAX_MOODS > 365, String(MAX_MOODS));

console.log(`${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("\nFAILURES:\n" + failures.map((f) => "  " + f).join("\n"));
  process.exit(1);
}
