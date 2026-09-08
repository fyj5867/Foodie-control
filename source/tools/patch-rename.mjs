/**
 * Renames the app from 糖前哨 to Healthy Care.
 *
 * Only display strings and the service-worker cache name change.
 *
 * The localStorage keys (profile, body-records, food-log, water-log,
 * exercise-log, daily-summary, …) are deliberately left alone: they are how
 * the existing data is found, and renaming them would orphan every record
 * already on the phone. A rename is a label change, not a migration.
 *
 * The service-worker cache name IS bumped, because the old cache would
 * otherwise keep serving the old name for a while.
 *
 * Run from the project root:  node source/tools/patch-rename.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';

const NAME = 'Healthy Care';
const SLUG = 'healthy-care';
const SUBTITLE = '第二型糖尿病預防生活助手';

const edits = [];
function patch(file, pairs) {
  let s = readFileSync(file, 'utf8');
  const eol = s.includes('\r\n') ? '\r\n' : '\n';
  let body = s.replace(/\r\n/g, '\n');
  for (const [from, to] of pairs) {
    if (!body.includes(from)) {
      edits.push(`MISSED  ${file}: ${from.slice(0, 50)}`);
      continue;
    }
    body = body.split(from).join(to);
    edits.push(`ok      ${file}: ${from.slice(0, 46)}`);
  }
  writeFileSync(file, eol === '\r\n' ? body.replace(/\n/g, '\r\n') : body);
}

patch('index.html', [
  [`<title>糖前哨 - ${SUBTITLE}</title>`, `<title>${NAME} - ${SUBTITLE}</title>`],
  [`content="糖前哨"`, `content="${NAME}"`],
]);

patch('manifest.json', [
  [`"name": "糖前哨 - ${SUBTITLE}"`, `"name": "${NAME} - ${SUBTITLE}"`],
  [`"short_name": "糖前哨"`, `"short_name": "${NAME}"`],
]);

patch('sw.js', [
  // Bumped so the rename is not hidden behind a stale cache.
  [`const CACHE_NAME = "tang-qian-shao-v2";`, `const CACHE_NAME = "${SLUG}-v3";`],
]);

patch('source/App.jsx', [
  [`            糖前哨 <small>${SUBTITLE}</small>`, `            ${NAME} <small>${SUBTITLE}</small>`],
  [`title: "糖前哨資料備份"`, `title: "${NAME} 資料備份"`],
  // A marker in the backup file; nothing validates it, so it is safe to change.
  [`app: "tang-qian-shao",`, `app: "${SLUG}",`],
  [`const filename = \`tang-qian-shao-backup-\${todayStr()}.json\`;`, `const filename = \`${SLUG}-backup-\${todayStr()}.json\`;`],
]);

patch('source/lib/storage.js', [[`app: "tang-qian-shao",`, `app: "${SLUG}",`]]);

patch('.claude/launch.json', [[`"name": "糖前哨"`, `"name": "${NAME}"`]]);

patch('README.md', [
  ['# 糖前哨 — 獨立網頁版', `# ${NAME} — 獨立網頁版`],
  ['主畫面就會出現「糖前哨」的 App 圖示', `主畫面就會出現「${NAME}」的 App 圖示`],
]);

patch('CLAUDE.md', [
  ['# 糖前哨 App — 專案說明（給 Claude Code 的交接筆記）', `# ${NAME} App — 專案說明（給 Claude Code 的交接筆記）`],
]);

console.log(edits.join('\n'));
const missed = edits.filter((e) => e.startsWith('MISSED'));
if (missed.length) process.exit(1);
console.log(`\nrenamed to ${NAME}. localStorage keys untouched.`);
