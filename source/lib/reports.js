/**
 * Health check reports: the stored shape, and what is allowed into it.
 *
 * A report is a date plus a set of numbers. The numbers arrive one of two
 * ways — typed in, or read off a photograph by a vision model — and the second
 * of those is why this file is careful:
 *
 *   - **Every value is checked against a plausibility bound** before it is
 *     stored (see `plausible` in lib/health.js). A model reading a report
 *     photo can drop a decimal point, or pick a number out of the neighbouring
 *     「參考值」 column. A fasting glucose of 1080 is not a frightening finding,
 *     it is a misread, and showing it as a finding would be alarming for no
 *     reason.
 *   - **The photograph itself is never stored.** The numbers are what the app
 *     uses; the image is large and it is a medical document. Keeping a copy in
 *     the browser earns nothing and risks something.
 *   - **Nothing is saved until the person has seen the numbers.** The reading
 *     is a draft; confirming it is a separate act. The one thing worse than a
 *     misread value is a misread value nobody was shown.
 */

import { LAB_MARKERS, isPlausibleLabValue, labMarker, labNumber } from "./health.js";

/** Reports are small — a date and a dozen numbers — so they are kept for good. */
export const MAX_REPORTS = 60;

const KNOWN_KEYS = new Set(LAB_MARKERS.map((m) => m.key));

function cleanDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) ? String(value) : null;
}

/**
 * Keep only the values that are known markers and could be real readings.
 *
 * Returns the accepted values and the rejected ones, because a rejected value
 * has to be reported: silently dropping something the person can see on their
 * own report would look like the app lost it.
 */
export function cleanValues(raw) {
  const values = {};
  const rejected = [];
  for (const [key, value] of Object.entries(raw || {})) {
    if (!KNOWN_KEYS.has(key)) continue;
    /* Absent is not the same as wrong: a marker with no value is skipped
       quietly, only a value that is present and impossible is reported. */
    const n = labNumber(value);
    if (n == null) continue;
    if (!isPlausibleLabValue(key, n)) {
      const marker = labMarker(key);
      rejected.push({ key, label: marker ? marker.label : key, value: n });
      continue;
    }
    const marker = labMarker(key);
    const decimals = marker ? marker.decimals : 1;
    values[key] = Number(n.toFixed(decimals));
  }
  return { values, rejected };
}

/**
 * @param fallbackId used when the report carries no id of its own — from a
 * restored backup, say. It must differ per report: ids minted from Date.now()
 * collided for reports normalised in the same millisecond, and then deleting
 * one report deleted every report that shared its id.
 */
export function normalizeReport(raw, fallbackId) {
  if (!raw || typeof raw !== "object") return null;
  const date = cleanDate(raw.date);
  if (!date) return null;
  const { values } = cleanValues(raw.values);
  if (!Object.keys(values).length) return null;
  return {
    id: String(raw.id || fallbackId || `${date}-${Date.now()}`),
    date,
    title: String(raw.title || "").slice(0, 40),
    labName: String(raw.labName || "").slice(0, 40),
    note: String(raw.note || "").slice(0, 200),
    source: raw.source === "photo" ? "photo" : "manual",
    values,
  };
}

/** Repair whatever storage or a backup file holds. Newest last, like the logs. */
export function normalizeReports(rawList) {
  if (!Array.isArray(rawList)) return [];
  const out = [];
  rawList.forEach((raw, i) => {
    const report = normalizeReport(raw, `${raw && raw.date ? raw.date : "report"}-${i}`);
    if (report) out.push(report);
  });
  out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return out.slice(-MAX_REPORTS);
}

/** Insert or replace, keyed on id, keeping the list sorted by date. */
export function upsertReport(reports, report) {
  const clean = normalizeReport(report);
  if (!clean) return reports || [];
  const rest = (reports || []).filter((r) => r.id !== clean.id);
  return normalizeReports([...rest, clean]);
}

export function removeReport(reports, id) {
  return (reports || []).filter((r) => r.id !== id);
}

/** The report the weekly plan is built from: the most recent one. */
export function latestReport(reports) {
  const list = reports || [];
  return list.length ? list[list.length - 1] : null;
}

/**
 * One marker across every report that measured it, oldest first.
 *
 * A single value is a snapshot; two are a direction. Where there are two or
 * more this is what makes 「比上次低了 12」 possible, which is the sentence a
 * person actually wants from a second report.
 */
export function markerHistory(reports, key) {
  return (reports || [])
    .filter((r) => r.values && r.values[key] != null)
    .map((r) => ({ date: r.date, value: r.values[key] }));
}

/** Change in one marker between the two most recent reports that measured it. */
export function markerChange(reports, key) {
  const history = markerHistory(reports, key);
  if (history.length < 2) return null;
  const previous = history[history.length - 2];
  const latest = history[history.length - 1];
  const marker = labMarker(key);
  const decimals = marker ? marker.decimals : 1;
  return {
    from: previous.value,
    to: latest.value,
    delta: Number((latest.value - previous.value).toFixed(decimals)),
    fromDate: previous.date,
    toDate: latest.date,
  };
}

/** An empty draft for the manual form — every marker, nothing filled in. */
export function emptyDraft(date) {
  return {
    id: `${Date.now()}`,
    date: date || "",
    title: "",
    labName: "",
    note: "",
    source: "manual",
    values: {},
  };
}
