/**
 * Filling 體態紀錄 from a photograph instead of by hand.
 *
 * The daily routine was: stand on the OMRON, then type eight numbers into a
 * form. That is the kind of chore that quietly ends a tracking habit, and the
 * obvious fix — sync from Apple 健康 — is not available to a web app: there is
 * no browser API for HealthKit, and no amount of work on this side changes
 * that. Reading the numbers off a photo of the scale's own display needs
 * nothing from Apple, works on any scale, and takes one tap.
 *
 * The same two rules as the lab report, for the same reasons:
 *
 *   - **Every value is bounded before it is offered.** A model reading a
 *     seven-segment display will occasionally turn 62.4 into 624, and a body
 *     fat of 624% is not a finding, it is a misread. Out-of-range values are
 *     reported as unreadable rather than filled in.
 *   - **Nothing is saved until she has seen it.** The reading lands in the
 *     form, where it can be corrected, and the existing save button is still
 *     the thing that writes it. The photo itself is never stored.
 */

/** Field names exactly as 體態紀錄 stores them. Reading the wrong key returns
 * undefined and the value silently disappears, so they are listed once here. */
export const BODY_FIELDS = [
  { key: "weight", label: "體重", unit: "kg", decimals: 1, plausible: [20, 300] },
  { key: "bmi", label: "BMI", unit: "", decimals: 1, plausible: [8, 80] },
  { key: "bodyFat", label: "體脂肪率", unit: "%", decimals: 1, plausible: [3, 70] },
  { key: "visceralFat", label: "內臟脂肪等級", unit: "", decimals: 0, plausible: [1, 60] },
  { key: "skeletalMuscle", label: "骨骼肌率", unit: "%", decimals: 1, plausible: [5, 60] },
  { key: "bodyAge", label: "體年齡", unit: "歲", decimals: 0, plausible: [10, 120] },
  { key: "bmr", label: "基礎代謝率", unit: "kcal", decimals: 0, plausible: [500, 4000] },
  { key: "waist", label: "腰圍", unit: "cm", decimals: 1, plausible: [40, 200] },
  { key: "sleepHours", label: "睡眠時數", unit: "小時", decimals: 1, plausible: [0, 24] },
];

const BY_KEY = Object.fromEntries(BODY_FIELDS.map((f) => [f.key, f]));

export function bodyField(key) {
  return BY_KEY[key] || null;
}

/** Number(null) and Number("") are both 0, and 0 is inside several of these
 * ranges — absent has to stay absent. */
function num(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function isPlausibleBodyValue(key, value) {
  const field = bodyField(key);
  if (!field) return false;
  const n = num(value);
  const [lo, hi] = field.plausible;
  return n != null && n >= lo && n <= hi;
}

/**
 * Keep the values that are known fields and could be real readings.
 *
 * Rejected values are reported rather than dropped: something she can see on
 * her own scale vanishing without a word looks like the app lost it.
 */
export function cleanBodyValues(raw) {
  const values = {};
  const rejected = [];
  for (const [key, value] of Object.entries(raw || {})) {
    const field = bodyField(key);
    if (!field) continue;
    const n = num(value);
    if (n == null) continue;
    if (!isPlausibleBodyValue(key, n)) {
      rejected.push({ key, label: field.label, value: n });
      continue;
    }
    values[key] = Number(n.toFixed(field.decimals));
  }
  return { values, rejected };
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Turn a reading into the fields the form holds.
 *
 * The form keeps everything as strings — it is a set of controlled inputs —
 * so the numbers are converted here rather than at twenty call sites. Fields
 * the photo did not contain are left exactly as they were: a scale that does
 * not measure waist should not blank the waist she typed a moment ago.
 */
export function applyReadingToForm(form, reading) {
  const { values, rejected } = cleanBodyValues(reading && reading.values);
  const next = { ...form };
  const filled = [];

  for (const [key, value] of Object.entries(values)) {
    next[key] = String(value);
    filled.push(bodyField(key).label);
  }

  if (reading && DATE_RE.test(String(reading.date || ""))) next.date = reading.date;

  return { form: next, filled, rejected, unreadable: (reading && reading.unreadable) || [] };
}
