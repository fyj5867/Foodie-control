/**
 * One command that produces the whole app: install, test, build, verify.
 *
 * The point of this file is that there is only one thing to remember. The
 * steps were four separate commands that had to be run in the right order from
 * the right directory, which is exactly the kind of thing that gets half-done
 * on a machine you have not used in three months.
 *
 * It also closes the gap that made the four-step version risky: the tests and
 * the build are not optional. `npm run build` on its own will happily produce
 * a bundle from code whose rules no longer hold, and that bundle is what gets
 * deployed. Here a failing test stops the build, and whether the bundle
 * actually changed is reported rather than assumed.
 *
 * Everything is run with this same node rather than through npm: Node 24 on
 * Windows refuses to spawn `.cmd` shims, and npm adds nothing here.
 *
 *   node tools/build-all.mjs          從 source/ 執行
 *   npm run rebuild                   同一件事
 */

import { execFileSync } from "node:child_process";
import { existsSync, statSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const source = fileURLToPath(new URL("..", import.meta.url));
const BUNDLE = fileURLToPath(new URL("../../app.bundle.js", import.meta.url));
const ESBUILD = fileURLToPath(new URL("../node_modules/esbuild/bin/esbuild", import.meta.url));

function step(label) {
  process.stdout.write(`\n── ${label}\n`);
}

function node(args, whatFailed) {
  try {
    execFileSync(process.execPath, args, { stdio: "inherit", cwd: source });
  } catch (e) {
    /* The step itself already printed why. A Node stack trace on top of that
       says nothing to anyone and hides the part that mattered. */
    process.stdout.write(`\n────────────────────────────────\n${whatFailed}\n`);
    process.exit(1);
  }
}

function hashBundle() {
  if (!existsSync(BUNDLE)) return null;
  return createHash("sha256").update(readFileSync(BUNDLE)).digest("hex").slice(0, 12);
}

const before = hashBundle();

if (!existsSync(ESBUILD)) {
  step("套件還沒裝，請先執行：npm install");
  process.stdout.write("（只有第一次需要，裝完再跑一次 npm run rebuild）\n");
  process.exit(1);
}

step("跑測試");
node(
  ["tools/run-tests.mjs"],
  "測試沒過，所以沒有打包 —— app.bundle.js 還是上一版。\n" +
    "上面列出的是沒過的項目；修好之後再跑一次 npm run rebuild。"
);

step("打包");
node([
  ESBUILD,
  "entry.jsx",
  "--bundle",
  "--minify",
  "--loader:.jsx=jsx",
  "--format=iife",
  '--define:process.env.NODE_ENV="production"',
  "--outfile=../app.bundle.js",
], "打包失敗，app.bundle.js 還是上一版。上面是 esbuild 說的原因。");

const after = hashBundle();
const size = existsSync(BUNDLE) ? (statSync(BUNDLE).size / 1024).toFixed(1) : "?";

process.stdout.write("\n────────────────────────────────\n");
process.stdout.write(`app.bundle.js  ${size} KB\n`);
process.stdout.write(
  before === after ? "產出與上次相同（原始碼沒有變）\n" : `產出已更新（${before || "無"} → ${after}）\n`
);
process.stdout.write("\n本機看實際畫面：  npm run serve\n");
process.stdout.write("然後開 http://localhost:4173/\n");
