/**
 * Checks the .ics a scheduled exam turns into.
 *
 * A calendar file is the kind of thing that looks fine here and arrives broken
 * on someone else's phone, so the tests are about the details that only fail
 * there:
 *
 *   - folding at 75 OCTETS, not 75 characters — a Chinese character is three
 *     bytes, so counting characters splits one in half and the event title
 *     arrives as mojibake,
 *   - an all-day event's DTEND being the NEXT day, or it shows as
 *     zero-length and some calendars drop it,
 *   - a stable UID, so adding the same exam twice updates the entry instead
 *     of leaving two.
 *
 * Run from source/:  node tools/test-calendar.mjs
 */
import { buildIcs, foldLine, describePlan, icsFilename } from "../lib/calendar.js";

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

const NOW = new Date("2026-09-10T02:00:00Z");
const plan = {
  id: "p1",
  exam: "大腸鏡（或再一次糞便潛血）",
  department: "肝膽腸胃科",
  date: "2026-09-15",
  note: "早上空腹，前一天要清腸",
};

const ics = buildIcs(plan, NOW);

/* --- the shape --- */
ok("it is a calendar", ics.startsWith("BEGIN:VCALENDAR\r\n"), ics.slice(0, 40));
ok("and it ends properly", ics.endsWith("END:VCALENDAR\r\n"), ics.slice(-40));
ok("with one event", (ics.match(/BEGIN:VEVENT/g) || []).length === 1);
ok("every line ends CRLF", !/[^\r]\n/.test(ics), "found a bare LF");
ok("it declares a version", ics.includes("VERSION:2.0"));

/* --- the date --- */
ok("the start is the scheduled day", ics.includes("DTSTART;VALUE=DATE:20260915"), ics);
/* An all-day event's DTEND is exclusive: same-day shows as zero length. */
ok("the end is the next day", ics.includes("DTEND;VALUE=DATE:20260916"), ics);
const monthEnd = buildIcs({ ...plan, date: "2026-09-30" }, NOW);
ok("the end crosses a month", monthEnd.includes("DTEND;VALUE=DATE:20261001"), monthEnd);
const yearEnd = buildIcs({ ...plan, date: "2026-12-31" }, NOW);
ok("and a year", yearEnd.includes("DTEND;VALUE=DATE:20270101"), yearEnd);
const leap = buildIcs({ ...plan, date: "2028-02-28" }, NOW);
ok("and a leap day", leap.includes("DTEND;VALUE=DATE:20280229"), leap);

/* --- the reminder --- */
ok("there is an alarm", ics.includes("BEGIN:VALARM"));
ok("a day before", ics.includes("TRIGGER:-P1D"), ics);

/* --- identity --- */
ok("the UID is derived from the plan", ics.includes("healthy-care-p1@"), ics);
const again = buildIcs(plan, new Date("2026-09-11T00:00:00Z"));
const uidOf = (text) => (text.match(/UID:(.+)\r\n/) || [])[1];
check("the same plan keeps the same UID", uidOf(again), uidOf(ics));
ok("a different plan gets a different UID", uidOf(buildIcs({ ...plan, id: "p2" }, NOW)) !== uidOf(ics));

/* --- text --- */
const summary = ics.split("\r\n").find((l) => l.startsWith("SUMMARY:"));
ok("the title names the department and the exam", summary.includes("肝膽腸胃科"), summary);
/* Commas and semicolons are reserved in iCalendar text values. */
const comma = buildIcs({ ...plan, exam: "抽血, 驗尿; 照X光\\測試" }, NOW);
ok("commas are escaped", comma.includes("\\,"), comma);
ok("semicolons are escaped", comma.includes("\\;"), comma);
ok("backslashes are escaped", comma.includes("\\\\"), comma);
const multiline = buildIcs({ ...plan, note: "第一行\n第二行" }, NOW);
ok("newlines become \\n", multiline.includes("\\n第二行") || multiline.includes("\\n"), multiline);

/* --- folding, the part that breaks on a phone ---
 *
 * Folding must count bytes and break between characters. A 40-character
 * Chinese title is 120 bytes and has to be folded; if the fold lands inside a
 * character the title arrives corrupted. */
const long = buildIcs({ ...plan, exam: "超級長的檢查項目名稱".repeat(6) }, NOW);
const bytes = (str) => Buffer.byteLength(str, "utf8");
for (const line of long.split("\r\n")) {
  ok(`a folded line stays within 75 octets (${bytes(line)})`, bytes(line) <= 75, line);
}
ok("continuation lines start with a space", long.split("\r\n").some((l) => l.startsWith(" ")), long);
/* Unfolding must give the original text back — this is what proves no
 * character was cut in half. */
const unfolded = long.replace(/\r\n /g, "");
ok(
  "unfolding restores the title intact",
  unfolded.includes("超級長的檢查項目名稱".repeat(6)),
  unfolded.split("\r\n").find((l) => l.startsWith("SUMMARY:"))
);

/* foldLine on its own */
check("a short line is not folded", foldLine("SUMMARY:短"), "SUMMARY:短");
const foldedAscii = foldLine("X".repeat(200));
ok("a long ascii line is folded", foldedAscii.includes("\r\n "), foldedAscii.slice(0, 90));
for (const line of foldedAscii.split("\r\n")) ok("each ascii piece fits", bytes(line) <= 75, String(bytes(line)));

/* --- naming and defaults --- */
check("the filename carries the date", icsFilename(plan), "healthy-care-2026-09-15.ics");
check("a plan with no name still gets a title", describePlan({ date: "2026-09-15" }).title, "排定的檢查");
check("no date means no file", buildIcs({ id: "x" }, NOW), null);
check("nothing means no file", buildIcs(null, NOW), null);
ok(
  "the description says where it came from",
  describePlan(plan).description.includes("Healthy Care"),
  describePlan(plan).description
);

console.log(`${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("\nFAILURES:\n" + failures.map((f) => "  " + f).join("\n"));
  process.exit(1);
}
