/**
 * Storage access.
 *
 * Everything goes through window.storage (see storage-shim.js), which backs
 * onto the browser's own localStorage. Values are stored as JSON strings
 * under flat keys; nothing ever leaves the device.
 *
 * The detailed logs are deliberately trimmed on write to keep the store from
 * growing without bound — food to 30 days, water to 60, exercise to 90. That
 * trimming is why DAILY_SUMMARY exists: a met/unmet day has to outlive the
 * logs it was computed from, or the garden would quietly lose its history
 * every month.
 */

import { daysAgoStr } from "./health.js";
import { backfillSummaries, upsertSummary } from "./goals.js";

export const KEYS = {
  profile: "profile",
  records: "body-records",
  foodLog: "food-log",
  waterLog: "water-log",
  exerciseLog: "exercise-log",
  /** One tiny row per day, kept forever. Added by this redesign. */
  dailySummary: "daily-summary",
  /** Set once, so the one-time rebuild from existing logs never runs twice. */
  summaryBackfilled: "daily-summary-backfilled",
  calorieOverride: "calorie-target-override",
  anthropicKey: "anthropic-api-key",
  geminiKey: "gemini-api-key",
  geminiModel: "gemini-model",
  aiProvider: "ai-provider",
  lastTab: "last-tab",
};

/** Days of history each log keeps. Matches the previous behaviour exactly. */
export const RETENTION_DAYS = {
  foodLog: 30,
  waterLog: 60,
  exerciseLog: 90,
};

async function readRaw(key) {
  try {
    const res = await window.storage.get(key, false);
    return res && res.value != null ? res.value : null;
  } catch {
    return null;
  }
}

/** Read and parse a JSON value, falling back rather than throwing — a single
 * corrupted key must not stop the whole app from loading. */
export async function readJson(key, fallback) {
  const raw = await readRaw(key);
  if (raw == null) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return parsed == null ? fallback : parsed;
  } catch {
    return fallback;
  }
}

export async function readArray(key) {
  const value = await readJson(key, []);
  return Array.isArray(value) ? value : [];
}

export async function writeJson(key, value) {
  return window.storage.set(key, JSON.stringify(value), false);
}

export async function readString(key) {
  return readRaw(key);
}

export async function writeString(key, value) {
  return window.storage.set(key, value, false);
}

export async function remove(key) {
  return window.storage.delete(key, false);
}

/** Drop entries older than the retention window before writing a log back. */
export function trimLog(entries, days) {
  const cutoff = daysAgoStr(days);
  return (entries || []).filter((e) => e && e.date >= cutoff);
}

export async function saveFoodLog(entries) {
  const trimmed = trimLog(entries, RETENTION_DAYS.foodLog);
  await writeJson(KEYS.foodLog, trimmed);
  return trimmed;
}

export async function saveWaterLog(entries) {
  const trimmed = trimLog(entries, RETENTION_DAYS.waterLog);
  await writeJson(KEYS.waterLog, trimmed);
  return trimmed;
}

export async function saveExerciseLog(entries) {
  const trimmed = trimLog(entries, RETENTION_DAYS.exerciseLog);
  await writeJson(KEYS.exerciseLog, trimmed);
  return trimmed;
}

/** The summary is never trimmed. One row is a date and three booleans, so a
 * decade of daily rows is a few tens of kilobytes. */
export async function loadSummaries() {
  return readArray(KEYS.dailySummary);
}

export async function saveSummaries(summaries) {
  await writeJson(KEYS.dailySummary, summaries);
  return summaries;
}

/** Record today's (or a backfilled day's) verdict and persist it. */
export async function recordDay(summaries, day) {
  const next = upsertSummary(summaries, day);
  await saveSummaries(next);
  return next;
}

/**
 * One-time rebuild of the summary from logs that already exist.
 *
 * Only reaches as far back as the food log survives (30 days), because the
 * calorie condition cannot be judged without it. Anything older has no data
 * left to recover — that history is simply gone, and the garden starts from
 * what can be proven. Runs once and marks itself done.
 */
export async function backfillOnce({ foodLog, waterLog, exerciseLog, calorieTarget }) {
  const alreadyDone = await readRaw(KEYS.summaryBackfilled);
  if (alreadyDone) return { ran: false, added: 0, summaries: await loadSummaries() };

  const existing = await loadSummaries();
  const rebuilt = backfillSummaries({
    foodLog,
    waterLog,
    exerciseLog,
    calorieTarget,
    days: RETENTION_DAYS.foodLog,
  });

  // Anything already recorded wins: a stored verdict was made when the full
  // detail was available, so it is more trustworthy than one recomputed now.
  let merged = existing;
  for (const entry of rebuilt) {
    if (existing.some((e) => e.date === entry.date)) continue;
    merged = upsertSummary(merged, {
      date: entry.date,
      calorie: entry.c,
      exercise: entry.e,
      water: entry.w,
    });
  }

  await saveSummaries(merged);
  await writeString(KEYS.summaryBackfilled, new Date().toISOString());
  return { ran: true, added: merged.length - existing.length, summaries: merged };
}

/** Everything the backup file carries. The summary is included so a restore
 * brings the garden back with it. */
export async function buildBackup() {
  return {
    app: "tang-qian-shao",
    exportedAt: new Date().toISOString(),
    profile: await readJson(KEYS.profile, null),
    records: await readArray(KEYS.records),
    foodLog: await readArray(KEYS.foodLog),
    waterLog: await readArray(KEYS.waterLog),
    exerciseLog: await readArray(KEYS.exerciseLog),
    dailySummary: await readArray(KEYS.dailySummary),
  };
}

/**
 * Restore from a backup file.
 *
 * Backups written before this redesign have no dailySummary; those restore
 * with an empty garden and let the one-time backfill rebuild what it can
 * from the logs in the same file.
 */
export async function restoreBackup(data) {
  if (!data || typeof data !== "object") throw new Error("備份檔格式不正確");

  const restored = [];
  if (data.profile) {
    await writeJson(KEYS.profile, data.profile);
    restored.push("個人資料");
  }
  if (Array.isArray(data.records)) {
    await writeJson(KEYS.records, data.records);
    restored.push(`體態紀錄 ${data.records.length} 筆`);
  }
  if (Array.isArray(data.foodLog)) {
    await saveFoodLog(data.foodLog);
    restored.push(`飲食紀錄 ${data.foodLog.length} 筆`);
  }
  if (Array.isArray(data.waterLog)) {
    await saveWaterLog(data.waterLog);
    restored.push(`喝水紀錄 ${data.waterLog.length} 筆`);
  }
  if (Array.isArray(data.exerciseLog)) {
    await saveExerciseLog(data.exerciseLog);
    restored.push(`運動紀錄 ${data.exerciseLog.length} 筆`);
  }
  if (Array.isArray(data.dailySummary)) {
    await saveSummaries(data.dailySummary);
    // A restored summary is authoritative; don't let the backfill second-guess it.
    await writeString(KEYS.summaryBackfilled, new Date().toISOString());
    restored.push(`達標紀錄 ${data.dailySummary.length} 天`);
  } else {
    // Older backup: allow the backfill to run against the logs just restored.
    await remove(KEYS.summaryBackfilled);
  }

  return restored;
}
