/**
 * 加入行事曆 — turning a scheduled exam into a calendar entry.
 *
 * A web page cannot write to the phone's calendar. There is no browser API
 * for it, and that is not something this app can work around. What it can do
 * is hand the phone an `.ics` file, which is the format every calendar app
 * reads: on iOS, opening one brings up 「加入行事曆」 with the event filled in.
 * It needs nothing from Apple and nothing from a server.
 *
 * The awkward part of iCalendar is not the shape, it is the details that only
 * break on someone else's phone:
 *
 *   - **Lines must be CRLF and folded at 75 octets** (RFC 5545). Folding by
 *     character count would split a Chinese character across two lines and
 *     the event title would arrive as mojibake, so folding here counts UTF-8
 *     bytes and only ever breaks between characters.
 *   - **An all-day event's DTEND is the next day.** Set to the same day it
 *     shows as a zero-length event, or vanishes.
 *   - **UID has to be stable.** Adding the same exam twice should update the
 *     entry, not leave two. It is derived from the plan's own id.
 */

const PRODID = "-//Healthy Care//Exam Plan//ZH-TW";

/** Escape a text value: RFC 5545 reserves these four. */
function escapeText(value) {
  return String(value == null ? "" : value)
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function byteLength(str) {
  let n = 0;
  for (const ch of str) {
    const code = ch.codePointAt(0);
    n += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
  }
  return n;
}

/**
 * Fold one logical line to 75 octets per physical line.
 *
 * Counting bytes rather than characters is the whole point: a Chinese
 * character is three bytes, so a 75-character line is 225 bytes and a naive
 * split lands in the middle of one. Continuation lines start with a space.
 */
export function foldLine(line) {
  const out = [];
  let current = "";
  let bytes = 0;
  /* Iterating the string yields whole code points, so a break can never fall
     inside a character. */
  for (const ch of line) {
    const size = byteLength(ch);
    const limit = out.length === 0 ? 75 : 74; // continuation lines carry a leading space
    if (bytes + size > limit) {
      out.push(current);
      current = ch;
      bytes = size;
    } else {
      current += ch;
      bytes += size;
    }
  }
  out.push(current);
  return out.map((part, i) => (i === 0 ? part : ` ${part}`)).join("\r\n");
}

function pad(n) {
  return String(n).padStart(2, "0");
}

/** YYYYMMDD, from a YYYY-MM-DD string. */
function toIcsDate(dateStr) {
  return String(dateStr || "").replace(/-/g, "");
}

/** The day after — an all-day event's DTEND is exclusive. */
function nextDay(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

function stamp(now) {
  const d = now || new Date();
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

/** What the calendar entry is called, and what it says. */
export function describePlan(plan) {
  const parts = [plan.department, plan.exam].filter(Boolean);
  const title = parts.length ? parts.join("・") : "排定的檢查";
  const lines = [];
  if (plan.note) lines.push(plan.note);
  lines.push("由 Healthy Care 排定");
  return { title, description: lines.join("\n") };
}

/**
 * One all-day event for a scheduled exam, with a reminder the day before.
 *
 * A day's notice is the useful amount: on the morning itself there is nothing
 * left to arrange, and a week out is forgotten again by the time it matters.
 */
export function buildIcs(plan, now) {
  if (!plan || !plan.date) return null;
  const { title, description } = describePlan(plan);

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${PRODID}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    /* Stable, so adding the same exam again replaces the entry instead of
       leaving two of them in the calendar. */
    `UID:healthy-care-${plan.id || toIcsDate(plan.date)}@fyj5867.github.io`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART;VALUE=DATE:${toIcsDate(plan.date)}`,
    `DTEND;VALUE=DATE:${nextDay(plan.date)}`,
    `SUMMARY:${escapeText(title)}`,
    `DESCRIPTION:${escapeText(description)}`,
    "BEGIN:VALARM",
    "TRIGGER:-P1D",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeText(`明天：${title}`)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return lines.map(foldLine).join("\r\n") + "\r\n";
}

/** A filename that says what it is without needing the file opened. */
export function icsFilename(plan) {
  return `healthy-care-${plan.date || "exam"}.ics`;
}
