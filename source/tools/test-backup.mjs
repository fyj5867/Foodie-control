/**
 * Checks that everything a restore can read is something an export writes.
 *
 * This exists because the two halves drifted, silently and for real: the
 * export screen assembled the backup file from React state by listing fields
 * by hand, while restore and lib/storage.js knew about more of them. 熱量標準值
 * was added to the restore side and to buildBackup(), and the file the user
 * actually downloaded never contained it — so it restored as empty and nobody
 * would find out until the day they needed it.
 *
 * A backup is only worth anything on the day something has gone wrong, which
 * is exactly the day it is too late to notice a missing field. Hence a test
 * that reads the source of restoreBackup and demands the export cover it.
 *
 * Run from source/:  node tools/test-backup.mjs
 */
import { readFileSync } from "node:fs";
import { BACKUP_FIELDS, buildBackupFrom } from "../lib/storage.js";

let passed = 0;
const failures = [];

function ok(name, cond, detail = "") {
  if (cond) passed += 1;
  else failures.push(`${name}${detail ? "\n    " + detail : ""}`);
}

const storageSrc = readFileSync(new URL("../lib/storage.js", import.meta.url), "utf8");
const appSrc = readFileSync(new URL("../App.jsx", import.meta.url), "utf8");

/* Every `data.xxx` restoreBackup touches is a field a backup has to carry. */
const restoreBody = storageSrc.slice(storageSrc.indexOf("export async function restoreBackup"));
const restored = [...restoreBody.matchAll(/\bdata\.([A-Za-z][\w]*)/g)].map((m) => m[1]);
const wanted = [...new Set(restored)];

ok("restoreBackup reads some fields", wanted.length > 0, JSON.stringify(wanted));
for (const field of wanted) {
  ok(`the backup carries ${field}`, BACKUP_FIELDS.includes(field), `BACKUP_FIELDS: ${BACKUP_FIELDS.join(", ")}`);
}

/* And the shape actually produced holds all of them. */
const file = buildBackupFrom({ profile: { a: 1 }, records: [], foodLog: [] });
for (const field of BACKUP_FIELDS) {
  ok(`${field} is present in the file`, field in file, JSON.stringify(Object.keys(file)));
}
ok("the file is tagged as this app's", file.app === "healthy-care", file.app);
ok("and stamped", typeof file.exportedAt === "string" && file.exportedAt.length > 0, file.exportedAt);

/* A field with nothing in it is written as null rather than dropped, so a
 * restore can tell "there was none" from "this backup predates the field". */
ok("a missing field is written as null, not omitted", file.foodMemory === null, JSON.stringify(file.foodMemory));

/* The export screen must not hand-roll the object again — that is the exact
 * mistake this file exists to prevent. */
ok(
  "the export screen uses the shared builder",
  appSrc.includes("buildBackupFrom({"),
  "handleExportBackup should call buildBackupFrom"
);
/* The end marker has to be searched for AFTER the start, not from the top of
 * the file: `const filename =` also appears in the calendar handler six hundred
 * lines earlier, so the naive two-argument form sliced backwards and produced
 * an empty string — and every assertion below it passed by examining nothing.
 * A test that silently stops testing is worse than no test, so the slice is
 * asserted to contain what it is supposed to contain. */
const exportStart = appSrc.indexOf("async function handleExportBackup");
const exportBody = appSrc.slice(exportStart, appSrc.indexOf("const filename =", exportStart));
ok("the export function was found", exportStart >= 0, "handleExportBackup is missing from App.jsx");
ok(
  "and the slice really holds its body",
  exportBody.includes("buildBackupFrom({") && exportBody.length > 100,
  `sliced ${exportBody.length} chars`
);
ok(
  "and does not build a backup literal of its own",
  !/app:\s*"healthy-care"/.test(exportBody),
  exportBody.slice(0, 300)
);

/* Everything the export screen passes in must be a field the file keeps. */
const passedIn = [...exportBody.matchAll(/^\s{8}([A-Za-z][\w]*)[,:]/gm)].map((m) => m[1]);
/* ...and the reverse, which is the direction that actually bites.
 *
 * buildBackupFrom writes `state[field] ?? null`, so a field added to
 * BACKUP_FIELDS but never passed in by the export screen still APPEARS in the
 * downloaded file — as null. The key is there, the data is not, and the backup
 * looks complete right up to the day it is needed. That is exactly what
 * happened with 熱量標準值, and it nearly happened again with 心情. */
for (const field of BACKUP_FIELDS) {
  ok(
    `the export screen actually passes ${field}`,
    passedIn.includes(field),
    `handleExportBackup passes: ${passedIn.join(", ")}`
  );
}
for (const field of passedIn) {
  ok(`${field} passed by the screen is a real backup field`, BACKUP_FIELDS.includes(field), JSON.stringify(passedIn));
}

console.log(`${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("\nFAILURES:\n" + failures.map((f) => "  " + f).join("\n"));
  process.exit(1);
}
