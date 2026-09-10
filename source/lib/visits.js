/**
 * 就醫紀錄 — when she saw a doctor, what for, and what she was told.
 *
 * The app keeps telling her to take things to a doctor. This is where what
 * the doctor said comes back in, and it closes the loop: a report finding
 * becomes a visit, the visit becomes a follow-up date, and the follow-up date
 * becomes a reminder. Without it the referral cards are a dead end.
 *
 * Two things it is deliberately not:
 *
 *   - **It is not interpreted.** 醫師建議 is stored and shown exactly as she
 *     typed it. The app has no business rephrasing a doctor's words, and
 *     nothing here reads that field to make a decision.
 *   - **It is not a diagnosis field.** 病症 is her own description of why she
 *     went, in her own words. It is a memory aid, not a coded condition, and
 *     nothing keys off it.
 *
 * A follow-up date is the one field the app does act on, and only to remind
 * her it is coming.
 */

/** Departments as they are named on a Taiwanese hospital's floor plan. */
export const DEPARTMENTS = [
  "家醫科",
  "新陳代謝／內分泌",
  "心臟內科",
  "腎臟科",
  "肝膽腸胃科",
  "眼科",
  "牙科",
  "骨科",
  "婦產科",
  "泌尿科",
  "耳鼻喉科",
  "皮膚科",
  "神經內科",
  "血液腫瘤科",
  "風濕免疫科",
  "健康檢查",
  "其他",
];

/** Visits are a few hundred bytes each, so they are kept for good. */
export const MAX_VISITS = 300;

/** How far ahead a follow-up starts being worth mentioning. */
export const REMIND_WITHIN_DAYS = 14;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function cleanDate(value) {
  return DATE_RE.test(String(value || "")) ? String(value) : null;
}

function trim(value, max) {
  return String(value == null ? "" : value)
    .trim()
    .slice(0, max);
}

export function emptyVisit(date) {
  return { id: `${Date.now()}`, date: date || "", department: "", symptom: "", advice: "", nextDate: "", done: false };
}

/**
 * @param fallbackId used when a restored record carries no id. Must differ per
 * record: ids minted from Date.now() collide within a millisecond, and then
 * deleting one visit deletes every visit that shares its id.
 */
export function normalizeVisit(raw, fallbackId) {
  if (!raw || typeof raw !== "object") return null;
  const date = cleanDate(raw.date);
  if (!date) return null;

  const department = trim(raw.department, 20);
  const symptom = trim(raw.symptom, 200);
  const advice = trim(raw.advice, 500);
  /* A visit with a date and nothing else says nothing. One filled field is
     enough — she may only remember which department it was. */
  if (!department && !symptom && !advice) return null;

  return {
    id: String(raw.id || fallbackId || `${date}-${Date.now()}`),
    date,
    department,
    symptom,
    advice,
    nextDate: cleanDate(raw.nextDate) || "",
    done: raw.done === true,
  };
}

/** Repair whatever storage or a backup file holds. Newest first. */
export function normalizeVisits(rawList) {
  if (!Array.isArray(rawList)) return [];
  const out = [];
  rawList.forEach((raw, i) => {
    const visit = normalizeVisit(raw, `${raw && raw.date ? raw.date : "visit"}-${i}`);
    if (visit) out.push(visit);
  });
  out.sort((a, b) => (a.date > b.date ? -1 : a.date < b.date ? 1 : 0));
  return out.slice(0, MAX_VISITS);
}

export function upsertVisit(visits, visit) {
  const clean = normalizeVisit(visit);
  if (!clean) return visits || [];
  return normalizeVisits([...(visits || []).filter((v) => v.id !== clean.id), clean]);
}

export function removeVisit(visits, id) {
  return (visits || []).filter((v) => v.id !== id);
}

/** Mark a follow-up as dealt with, so it stops being reminded about. */
export function markVisitDone(visits, id, done = true) {
  return (visits || []).map((v) => (v.id === id ? { ...v, done } : v));
}

function daysUntil(from, to) {
  const ms = new Date(`${to}T00:00:00`) - new Date(`${from}T00:00:00`);
  return Math.round(ms / 86400000);
}

/**
 * Follow-ups worth mentioning today: overdue first, then the ones coming up.
 *
 * Overdue ones are never hidden by age. A 回診 missed three months ago is more
 * worth saying than one due next week, and quietly dropping it after a while
 * would be the app deciding for her that it no longer matters.
 */
export function dueReminders(visits, today) {
  const out = [];
  for (const visit of visits || []) {
    if (!visit.nextDate || visit.done) continue;
    const days = daysUntil(today, visit.nextDate);
    if (days > REMIND_WITHIN_DAYS) continue;
    out.push({ ...visit, days, overdue: days < 0 });
  }
  out.sort((a, b) => a.days - b.days);
  return out;
}

/** The most recent visit to a given department, or null. */
export function lastVisitTo(visits, department) {
  const matches = (visits || []).filter((v) => v.department === department);
  return matches.length ? matches[0] : null;
}
