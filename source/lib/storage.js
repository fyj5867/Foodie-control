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
import { normalizeMemory } from "./foodMemory.js";
import { normalizeReports } from "./reports.js";
import { normalizeLinks } from "./workouts.js";
import { normalizeVisits } from "./visits.js";

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
  /** Calorie figures the user has corrected, per food. */
  foodMemory: "food-calories",
  /** Health check reports — the confirmed numbers, never the photo. */
  healthReports: "health-reports",
  /** A video the user pinned to an exercise suggestion. */
  workoutLinks: "workout-links",
  /** 就醫紀錄: date, department, why she went, what she was told. */
  clinicVisits: "clinic-visits",
  calorieOverride: "calorie-target-override",
  anthropicKey: "anthropic-api-key",
  geminiKey: "gemini-api-key",
  geminiModel: "gemini-model",
  aiProvider: "ai-provider",
  lastTab: "last-tab",
};

/** Days of history each log keeps. */
export const RETENTION_DAYS = {
  waterLog: 60,
  exerciseLog: 90,
};

/**
 * How long a food photo is kept.
 *
 * Photos are the only thing in this store large enough to matter — roughly
 * 20KB each at display size, so three meals a day fills a browser's few
 * megabytes within months. The text of an entry is a few hundred bytes, which
 * is nothing, so after this window the photo is dropped and the entry itself
 * is kept for good. That is what makes a long-term diary possible at all: a
 * year of meals as text costs about a megabyte, a year as photos cannot fit.
 */
export const PHOTO_DAYS = 30;

/** Longest-dimension the captured photo is stored at, and what an aged entry
 * would be reduced to if photos were kept rather than dropped. */
export const PHOTO_MAX_DIM = 640;

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

/**
 * Drop photos past the window, keep every entry's text.
 *
 * Previously the whole entry was deleted after 30 days, which meant the diary
 * could never show anything older than a month. Now only the photo goes.
 */
export function agePhotos(entries, days = PHOTO_DAYS) {
  const cutoff = daysAgoStr(days);
  return (entries || []).map((entry) => {
    if (!entry || !entry.photo || entry.date >= cutoff) return entry;
    const { photo, ...rest } = entry;
    return { ...rest, photoExpired: true };
  });
}

export async function saveFoodLog(entries) {
  const aged = agePhotos(entries);
  await writeJson(KEYS.foodLog, aged);
  return aged;
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

/** Remove the whole history — part of "clear all data". */
export async function clearSummaries() {
  await remove(KEYS.dailySummary);
  await remove(KEYS.summaryBackfilled);
}

/** Let the one-time rebuild run again, e.g. after restoring an older backup
 * that carries logs but no summary. */
export async function clearBackfillFlag() {
  await remove(KEYS.summaryBackfilled);
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

/**
 * Reports and pinned links both go through their own repair pass on the way
 * in and out, for the same reason the food memory does: a backup file is
 * plain text the user can edit, and a nonsense lab value would be shown back
 * to them as a finding about their own body.
 */
export async function loadReports() {
  return normalizeReports(await readArray(KEYS.healthReports));
}

export async function saveReports(reports) {
  const clean = normalizeReports(reports);
  await writeJson(KEYS.healthReports, clean);
  return clean;
}

export async function loadVisits() {
  return normalizeVisits(await readArray(KEYS.clinicVisits));
}

export async function saveVisits(visits) {
  const clean = normalizeVisits(visits);
  await writeJson(KEYS.clinicVisits, clean);
  return clean;
}

export async function loadWorkoutLinks() {
  return normalizeLinks(await readJson(KEYS.workoutLinks, {}));
}

export async function saveWorkoutLinks(links) {
  const clean = normalizeLinks(links);
  await writeJson(KEYS.workoutLinks, clean);
  return clean;
}

export async function loadFoodMemory() {
  return normalizeMemory(await readArray(KEYS.foodMemory));
}

export async function saveFoodMemory(memory) {
  const clean = normalizeMemory(memory);
  await writeJson(KEYS.foodMemory, clean);
  return clean;
}

/**
 * Everything a backup file carries.
 *
 * This list exists so there is exactly one answer to "what gets exported".
 * The screen builds the file from React state rather than re-reading storage,
 * and when the two were written separately the screen quietly fell behind:
 * 熱量標準值 was added to the export here and the actual download never
 * included it. tools/test-backup.mjs now checks this list against what
 * restoreBackup reads, so anything restorable that is not exportable fails.
 */
export const BACKUP_FIELDS = [
  "profile",
  "records",
  "foodLog",
  "waterLog",
  "exerciseLog",
  /* Without the summary the garden does not survive a restore: met days
     cannot be recomputed once the detailed logs have aged out. */
  "dailySummary",
  /* The user's own corrections and uploads — re-doing them after a restore
     would be worse than losing a log entry. */
  "foodMemory",
  "healthReports",
  "workoutLinks",
  "clinicVisits",
];

/** Assemble a backup from values already in hand. Used by the export screen. */
export function buildBackupFrom(state) {
  const backup = { app: "healthy-care", exportedAt: new Date().toISOString() };
  for (const field of BACKUP_FIELDS) backup[field] = state[field] ?? null;
  return backup;
}

/** The same file, read straight out of storage. */
export async function buildBackup() {
  return buildBackupFrom({
    profile: await readJson(KEYS.profile, null),
    records: await readArray(KEYS.records),
    foodLog: await readArray(KEYS.foodLog),
    waterLog: await readArray(KEYS.waterLog),
    exerciseLog: await readArray(KEYS.exerciseLog),
    dailySummary: await readArray(KEYS.dailySummary),
    foodMemory: await loadFoodMemory(),
    healthReports: await loadReports(),
    workoutLinks: await loadWorkoutLinks(),
    clinicVisits: await loadVisits(),
  });
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
  if (Array.isArray(data.foodMemory)) {
    const saved = await saveFoodMemory(data.foodMemory);
    if (saved.length) restored.push(`熱量標準值 ${saved.length} 項`);
  }
  if (Array.isArray(data.healthReports)) {
    const saved = await saveReports(data.healthReports);
    if (saved.length) restored.push(`健檢報告 ${saved.length} 份`);
  }
  if (data.workoutLinks && typeof data.workoutLinks === "object") {
    const saved = await saveWorkoutLinks(data.workoutLinks);
    if (Object.keys(saved).length) restored.push("運動影片連結");
  }
  if (Array.isArray(data.clinicVisits)) {
    const saved = await saveVisits(data.clinicVisits);
    if (saved.length) restored.push(`就醫紀錄 ${saved.length} 筆`);
  }

  return restored;
}
