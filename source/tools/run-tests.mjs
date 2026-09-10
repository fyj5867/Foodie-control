/**
 * Runs every test in this folder.
 *
 * The list used to be spelled out in package.json, which meant a new test file
 * only ran if someone remembered to add it there — and a test that does not
 * run is worse than no test, because it looks like coverage. Globbing removes
 * the chance to forget.
 *
 * check-imports goes first: it catches a name used but never imported, which
 * esbuild does not (it catches missing *named exports*, not free identifiers),
 * and which would otherwise show up as a blank screen rather than as a failure.
 *
 *   node tools/run-tests.mjs        從 source/ 執行
 *   npm test                        同一件事
 */

import { readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));
const source = fileURLToPath(new URL("..", import.meta.url));

const tests = readdirSync(here)
  .filter((name) => name.startsWith("test-") && name.endsWith(".mjs"))
  .sort();

if (!tests.length) {
  console.error("找不到任何 test-*.mjs，這本身就是問題");
  process.exit(1);
}

const files = ["check-imports.mjs", ...tests];
let failed = 0;

for (const file of files) {
  try {
    /* Run with this same node, not through npm: Node 24 on Windows refuses to
       spawn .cmd files, and going through npm buys nothing here anyway. */
    execFileSync(process.execPath, [`tools/${file}`], { stdio: "inherit", cwd: source });
  } catch (e) {
    failed += 1;
  }
}

console.log(`\n${files.length - failed} / ${files.length} 個檔案通過`);
if (failed) process.exit(1);
