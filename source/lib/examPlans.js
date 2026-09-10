/**
 * 排定的檢查 — a suggestion turned into something with a date on it.
 *
 * The screening card could only ever say 「建議去做」. That is the easy half.
 * The half that decides whether anything happens is the date, and until now
 * there was nowhere to put one: she would read the suggestion, mean to book
 * it, and the card would say exactly the same thing next month.
 *
 * A plan is deliberately its own record rather than a field on the suggestion,
 * because suggestions are recomputed from the report every time and hold no
 * state. It is also not a 就醫紀錄: that means "I went", and this means
 * "I am going to". The two meet later — once she has been, she records a
 * visit, and the suggestion goes quiet on its own.
 *
 * The one thing a plan does beyond being written down: an upcoming or overdue
 * date shows up in 回診提醒, which is the card that is always visible. That is
 * what keeps a collapsed suggestion list from hiding something she needs.
 */

/** Plans are tiny, so they are kept. Done ones are the useful history. */
export const MAX_PLANS = 200;

/** How far ahead a scheduled exam starts being worth mentioning. */
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

/**
 * A blank plan.
 *
 * @param seed when it comes from a suggestion, its exam/department/id are
 * carried over so she only has to pick a date — the whole point is that
 * scheduling should be one field, not a form.
 */
export function emptyPlan(seed = {}) {
  return {
    id: `${Date.now()}`,
    examId: seed.examId || seed.id || "",
    exam: trim(seed.exam, 40),
    department: trim(seed.department, 20),
    date: "",
    note: "",
    done: false,
  };
}

export function normalizePlan(raw, fallbackId) {
  if (!raw || typeof raw !== "object") return null;

  const exam = trim(raw.exam, 40);
  const department = trim(raw.department, 20);
  /* A date with nothing named is not a plan, and a name with no date is not
     scheduled — both halves are the point. */
  const date = cleanDate(raw.date);
  if (!date || (!exam && !department)) return null;

  return {
    id: String(raw.id || fallbackId || `${date}-${Date.now()}`),
    examId: trim(raw.examId, 40),
    exam,
    department,
    date,
    note: trim(raw.note, 200),
    done: raw.done === true,
  };
}

/** Repair whatever storage or a backup file holds. Soonest first. */
export function normalizePlans(rawList) {
  if (!Array.isArray(rawList)) return [];
  const out = [];
  rawList.forEach((raw, i) => {
    const plan = normalizePlan(raw, `${raw && raw.date ? raw.date : "plan"}-${i}`);
    if (plan) out.push(plan);
  });
  out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return out.slice(0, MAX_PLANS);
}

export function upsertPlan(plans, plan) {
  const clean = normalizePlan(plan);
  if (!clean) return plans || [];
  return normalizePlans([...(plans || []).filter((p) => p.id !== clean.id), clean]);
}

export function removePlan(plans, id) {
  return (plans || []).filter((p) => p.id !== id);
}

export function markPlanDone(plans, id, done = true) {
  return (plans || []).map((p) => (p.id === id ? { ...p, done } : p));
}

/** The outstanding plan for a given suggestion, if there is one. */
export function planFor(plans, examId) {
  if (!examId) return null;
  return (plans || []).find((p) => p.examId === examId && !p.done) || null;
}

function daysUntil(from, to) {
  const ms = new Date(`${to}T00:00:00`) - new Date(`${from}T00:00:00`);
  return Math.round(ms / 86400000);
}

/**
 * Scheduled exams worth mentioning today: overdue first, then upcoming.
 *
 * Overdue ones are never aged out, for the same reason a missed 回診 is not:
 * an exam she meant to have three months ago matters more than one due next
 * week, and quietly dropping it would be the app deciding it stopped mattering.
 */
export function duePlans(plans, today) {
  const out = [];
  for (const plan of plans || []) {
    if (plan.done) continue;
    const days = daysUntil(today, plan.date);
    if (days > REMIND_WITHIN_DAYS) continue;
    out.push({ ...plan, days, overdue: days < 0 });
  }
  out.sort((a, b) => a.days - b.days);
  return out;
}
