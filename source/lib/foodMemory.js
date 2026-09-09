/**
 * Remembered calorie values — the same food, corrected once, kept as yours.
 *
 * The AI's photo estimate is a guess from appearance. For anything packaged
 * the true figure is printed on the label and never changes: 御選肉鬆飯糰 is
 * 251 kcal today and 251 kcal next month. Re-guessing it every time, and
 * being corrected by hand every time, is work the app should not be asking
 * for twice.
 *
 * So a correction is treated as a standing figure for that food. Storing it
 * is the easy half; the part that decides whether this feature helps or
 * quietly corrupts the diary is WHEN a number counts as a correction:
 *
 *   - The estimate the AI produced is NOT a correction. Learning it would
 *     turn a guess into a remembered "standard" and then apply that guess to
 *     every later photo, with nothing on screen admitting it was ever a
 *     guess. Only a figure the person actually changed or typed is learned.
 *   - Names are matched after normalising spacing and punctuation, and
 *     nothing else. No fuzzy or partial matching: 「白飯」 and 「白飯（大碗）」
 *     stay separate foods, because silently applying one portion's calories
 *     to a different portion is exactly the error this is supposed to prevent.
 *
 * Applying a remembered value is always visible and always reversible in one
 * tap — see the note the analysis card shows. A number that appears on its
 * own, with no way back, would be worse than the guess it replaced.
 */

/** Nothing outside this range is a plausible figure for one meal entry. */
export const MIN_CALORIES = 1;
export const MAX_CALORIES = 5000;

/** Names the AI uses when it recognised nothing — never learn these. */
export const UNKNOWN_NAMES = ["無法辨識", "未命名食物", "未知", "食物"];

/**
 * How many foods are remembered. Each row is well under 100 bytes, so this
 * cap is not about space — it is so the list stays something a person can
 * actually read through and correct. Least recently used goes first.
 */
export const MAX_ENTRIES = 200;

/**
 * The key used to match two names.
 *
 * Spacing and punctuation vary between what the AI writes and what gets typed
 * by hand（「御選 肉鬆飯糰」／「御選肉鬆飯糰」）, and those differences never
 * mean a different food. Everything else is left alone.
 */
export function normalizeName(name) {
  return String(name || "")
    .replace(/[\s　]/g, "")
    .replace(/[（）()［］\[\]「」【】、,，。.·・_/／\-–—~～!！?？:：;；'"]/g, "")
    .toLowerCase();
}

/** A number that could be one entry's calories. */
export function isValidCalories(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= MIN_CALORIES && n <= MAX_CALORIES;
}

/**
 * Whether a name and figure are worth remembering.
 *
 * A one-character name is not identifiable enough to match on later, and the
 * AI's placeholder names would collect corrections from unrelated meals under
 * a single row.
 */
export function isLearnable(name, calories) {
  const key = normalizeName(name);
  if (key.length < 2) return false;
  if (UNKNOWN_NAMES.some((u) => normalizeName(u) === key)) return false;
  return isValidCalories(calories);
}

export function lookup(memory, name) {
  const key = normalizeName(name);
  if (!key) return null;
  return (memory || []).find((e) => e.key === key) || null;
}

/**
 * Record a corrected figure for one food.
 *
 * Returns a new list — the caller persists it. Calling this with an unchanged
 * figure is not a no-op: it bumps `times`, which is what lets the UI say how
 * settled a figure is rather than treating one hasty edit the same as a value
 * confirmed six times.
 */
export function remember(memory, { name, calories, at = new Date().toISOString() }) {
  if (!isLearnable(name, calories)) return memory || [];

  const key = normalizeName(name);
  const value = Math.round(Number(calories));
  const previous = lookup(memory, name);
  const rest = (memory || []).filter((e) => e.key !== key);

  const entry = {
    key,
    name: String(name).trim(),
    calories: value,
    // A changed figure starts counting again: the old one was wrong, and the
    // number of times it was confirmed says nothing about the new one.
    times: previous && previous.calories === value ? (previous.times || 1) + 1 : 1,
    updatedAt: at,
  };

  const next = [entry, ...rest];
  return next.length > MAX_ENTRIES ? trimOldest(next) : next;
}

function trimOldest(entries) {
  const byRecency = [...entries].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  const kept = new Set(byRecency.slice(0, MAX_ENTRIES).map((e) => e.key));
  return entries.filter((e) => kept.has(e.key));
}

export function forget(memory, name) {
  const key = normalizeName(name);
  return (memory || []).filter((e) => e.key !== key);
}

/**
 * What to do with a fresh estimate for a food that has a remembered figure.
 *
 * `applied` is the figure to show; `estimate` is what the AI said, kept so the
 * screen can offer a way back to it. When the two already agree there is
 * nothing to say, and returning null keeps the card quiet — a note explaining
 * that a number was replaced by the same number is just noise.
 */
export function suggestion(memory, name, estimate) {
  const entry = lookup(memory, name);
  if (!entry) return null;

  const guess = Number(estimate);
  const same = Number.isFinite(guess) && Math.round(guess) === entry.calories;
  if (same) return null;

  return {
    name: entry.name,
    calories: entry.calories,
    estimate: Number.isFinite(guess) ? Math.round(guess) : null,
    times: entry.times || 1,
    updatedAt: entry.updatedAt,
  };
}

/** Most recently corrected first — the order the management list reads in. */
export function sortedMemory(memory) {
  return [...(memory || [])].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

/**
 * Repair whatever came out of storage or a backup file.
 *
 * This list is written by the app but read back after a restore from a file
 * the user could have edited, so a row missing its key or carrying a
 * nonsensical figure has to be dropped rather than trusted into the diary.
 */
export function normalizeMemory(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const out = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const name = row.name != null ? String(row.name) : "";
    if (!isLearnable(name, row.calories)) continue;
    const key = normalizeName(name);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      key,
      name: name.trim(),
      calories: Math.round(Number(row.calories)),
      times: Number(row.times) > 0 ? Math.round(Number(row.times)) : 1,
      updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : new Date().toISOString(),
    });
  }
  return out.slice(0, MAX_ENTRIES);
}
