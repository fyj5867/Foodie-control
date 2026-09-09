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
const exportBody = appSrc.slice(appSrc.indexOf("async function handleExportBackup"), appSrc.indexOf("const filename ="));
ok(
  "and does not build a backup literal of its own",
  !/app:\s*"healthy-care"/.test(exportBody),
  exportBody.slice(0, 300)
);

/* Everything the export screen passes in must be a field the file keeps. */
const passedIn = [...exportBody.matchAll(/^\s{8}([A-Za-z][\w]*)[,:]/gm)].map((m) => m[1]);
for (const field of passedIn) {
  ok(`${field} passed by the screen is a real backup field`, BACKUP_FIELDS.includes(field), JSON.stringify(passedIn));
}

console.log(`${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("\nFAILURES:\n" + failures.map((f) => "  " + f).join("\n"));
  process.exit(1);
}
