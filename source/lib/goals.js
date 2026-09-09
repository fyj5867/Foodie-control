/**
 * Daily goal evaluation, tree growth and garden accumulation.
 *
 * The rule the whole feature rests on: a day counts only when ALL THREE of
 * calorie control, 30 minutes of exercise and 2000cc of water are met. Days
 * accumulate — they do not have to be consecutive — and every 30 counted days
 * finishes one tree, which is then planted in the garden permanently.
 *
 * Accumulating rather than requiring a streak is deliberate. With three
 * all-or-nothing conditions a streak of 30 is rarely reachable, so a streak
 * rule would leave the garden empty and the long-term motivation dead. A
 * missed day costs a day, not the tree.
 */

import { daysAgoStr, todayStr } from "./health.js";

/** Daily thresholds. Water and exercise are flat targets the user set;
 * the calorie ceiling comes from the profile-derived daily target. */
export const WATER_GOAL_ML = 2000;
export const EXERCISE_GOAL_MIN = 30;

/**
 * The calorie ceiling for a day to count: intake under this is met.
 *
 * A flat figure the user set, rather than the profile-derived target. That
 * also means all three conditions are now plain numbers, so a day can be
 * judged even when the profile is incomplete — the personalised target from
 * calcDailyCalorieTarget stays on screen as guidance, but no longer decides
 * whether the day counts.
 */
export const CALORIE_CEILING = 1500;

/**
 * Below this the day is treated as not yet recorded rather than as met.
 *
 * Without a floor, an empty food log is 0 kcal, which is "under 1500", which
 * would mean forgetting to record food counted as perfect control — and the
 * garden would fill up on days nobody actually tracked. 500 kcal is low
 * enough not to reject a genuinely light day and high enough to catch a log
 * holding only a coffee, or nothing at all.
 */
export const CALORIE_MIN_LOGGED = 500;

/** One finished tree. 30 met days ≈ a month of full attendance; slipping a
 * few days just pushes the finish out, it never resets progress. */
export const TREE_DAYS = 30;

/**
 * Growth stages within one plant, keyed on met days accumulated toward it.
 *
 * Eight stages, names and order taken from the Health Forest 植物養成圖示系統
 * canvas — the artwork in components/Sprout.jsx is drawn for exactly these,
 * so the two lists have to stay in step. Days are spread over TREE_DAYS with
 * the early steps close together: the first few days are when a habit is
 * easiest to abandon, so that is where visible progress should come fastest.
 */
export const STAGES = [
  { key: "seed", label: "種子", days: 0, note: "開始養成" },
  { key: "sprout", label: "發芽", days: 1, note: "萌芽出土" },
  { key: "shoot", label: "幼芽", days: 3, note: "兩葉成長" },
  { key: "seedling", label: "小苗", days: 6, note: "葉片增加" },
  { key: "growing", label: "成長", days: 11, note: "枝葉茂盛" },
  { key: "mature", label: "成熟", days: 17, note: "花苞出現" },
  { key: "ready", label: "破土", days: 24, note: "準備移植" },
  { key: "forest", label: "森林之樹", days: TREE_DAYS, note: "種入森林" },
];

/** Vitality shown on the sprout: one level per number of conditions met,
 * so the four illustrations map one-to-one onto the four possible counts. */
export const VITALITY = [
  { metCount: 0, key: "wilting", label: "沒什麼精神" },
  { metCount: 1, key: "low", label: "有起色" },
  { metCount: 2, key: "fair", label: "快達標" },
  { metCount: 3, key: "thriving", label: "達標" },
];

/**
 * Field names as the app actually stores them. These are not interchangeable
 * guesses — reading the wrong key returns 0 without erroring, which silently
 * makes a condition impossible to meet. Exercise in particular is durationMin,
 * not minutes.
 */
export const FIELDS = {
  calories: "estimatedCalories",
  water: "amountMl",
  exercise: "durationMin",
};

function sumFor(log, date, field) {
  let total = 0;
  for (const entry of log || []) {
    if (entry.date === date) total += Number(entry[field]) || 0;
  }
  return total;
}

/**
 * Evaluate one calendar day against the three conditions.
 *
 * `calorieTarget` is the profile-derived daily ceiling (see
 * calcDailyCalorieTarget). When it is unavailable the calorie condition
 * cannot be judged and is treated as unmet rather than assumed met.
 */
export function evaluateDay(date, { foodLog, waterLog, exerciseLog, calorieTarget }) {
  const calories = sumFor(foodLog, date, FIELDS.calories);
  const waterMl = sumFor(waterLog, date, FIELDS.water);
  const exerciseMin = sumFor(exerciseLog, date, FIELDS.exercise);

  const calorie = calories >= CALORIE_MIN_LOGGED && calories < CALORIE_CEILING;
  const water = waterMl >= WATER_GOAL_ML;
  const exercise = exerciseMin >= EXERCISE_GOAL_MIN;

  const metCount = (calorie ? 1 : 0) + (exercise ? 1 : 0) + (water ? 1 : 0);

  return {
    date,
    calorie,
    exercise,
    water,
    met: metCount === 3,
    metCount,
    calories,
    waterMl,
    exerciseMin,
    calorieTarget,
  };
}

/** Compact on-disk shape. One met/unmet day is a few dozen bytes, so the
 * summary can be kept forever while the detailed logs stay trimmed. */
export function toSummary(day) {
  return { date: day.date, c: day.calorie, e: day.exercise, w: day.water };
}

export function summaryMet(entry) {
  return Boolean(entry && entry.c && entry.e && entry.w);
}

export function summaryMetCount(entry) {
  if (!entry) return 0;
  return (entry.c ? 1 : 0) + (entry.e ? 1 : 0) + (entry.w ? 1 : 0);
}

/** Insert or replace one day in the summary list, keeping it sorted by date. */
export function upsertSummary(summaries, day) {
  const entry = toSummary(day);
  const next = (summaries || []).filter((s) => s.date !== entry.date);
  next.push(entry);
  next.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return next;
}

export function stageForDays(days) {
  let current = STAGES[0];
  for (const stage of STAGES) {
    if (days >= stage.days) current = stage;
  }
  return current;
}

export function nextStageForDays(days) {
  for (const stage of STAGES) {
    if (days < stage.days) return stage;
  }
  return null;
}

/** Longest and current runs of met days. Streaks no longer gate growth, but
 * they are still worth showing — they are the thing a person feels. */
function streaks(sortedMetDates) {
  let longest = 0;
  let current = 0;
  let prev = null;

  for (const date of sortedMetDates) {
    if (prev && isNextDay(prev, date)) current += 1;
    else current = 1;
    if (current > longest) longest = current;
    prev = date;
  }

  // The current streak only counts if it reaches today or yesterday —
  // otherwise it ended some time ago and is history, not a live streak.
  const today = todayStr();
  const yesterday = daysAgoStr(1);
  const live = prev === today || prev === yesterday;

  return { longest, current: live ? current : 0 };
}

function isNextDay(a, b) {
  const d = new Date(`${a}T00:00:00`);
  d.setDate(d.getDate() + 1);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` === b;
}

/**
 * Roll the whole summary history up into the garden.
 *
 * Trees are whole multiples of TREE_DAYS met days; the remainder is the tree
 * currently growing. Nothing here is stored — it is all derived from the
 * summary list, so there is no second copy of the truth to drift out of sync.
 */
export function gardenState(summaries) {
  const metDates = (summaries || [])
    .filter(summaryMet)
    .map((s) => s.date)
    .sort();

  const totalMetDays = metDates.length;
  const completedTrees = Math.floor(totalMetDays / TREE_DAYS);
  const currentDays = totalMetDays % TREE_DAYS;
  const stage = stageForDays(currentDays);
  const next = nextStageForDays(currentDays);
  const { longest, current } = streaks(metDates);

  return {
    totalMetDays,
    completedTrees,
    currentDays,
    stage,
    nextStage: next,
    daysToNextStage: next ? next.days - currentDays : 0,
    daysToNextTree: TREE_DAYS - currentDays,
    longestStreak: longest,
    currentStreak: current,
  };
}

/**
 * Rebuild summary entries from the detailed logs.
 *
 * Only useful for the recent past: the food log is trimmed to 30 days, the
 * water log to 60 and the exercise log to 90, so days older than the food
 * window cannot have their calorie condition judged and are skipped rather
 * than recorded as unmet. Anything before that simply has no data to recover.
 */
export function backfillSummaries({ foodLog, waterLog, exerciseLog, calorieTarget, days = 30 }) {
  const out = [];
  for (let i = days; i >= 0; i--) {
    const date = daysAgoStr(i);
    const hasAnything =
      (foodLog || []).some((e) => e.date === date) ||
      (waterLog || []).some((e) => e.date === date) ||
      (exerciseLog || []).some((e) => e.date === date);
    if (!hasAnything) continue;
    out.push(toSummary(evaluateDay(date, { foodLog, waterLog, exerciseLog, calorieTarget })));
  }
  return out;
}

/**
 * Whether the end-of-day nudge should appear.
 *
 * Shown only when it is late enough to matter, something is still missing,
 * and the gap is small enough to actually close tonight — a reminder that
 * fires when the day is already lost is just noise.
 */
export function shouldNudge(day, now = new Date()) {
  if (!day || day.met) return false;
  if (now.getHours() < 19) return false;
  if (day.metCount < 2) return false;
  if (!day.water) return day.waterMl >= WATER_GOAL_ML * 0.5;
  if (!day.exercise) return false; // 30 minutes of exercise at 8pm is not a nudge
  return false;
}

/** Backfilling is limited to yesterday: being able to fill in a whole week
 * afterwards would make the met-day count stop meaning anything. */
export function canBackfill(date) {
  return date === daysAgoStr(1);
}
