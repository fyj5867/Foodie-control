/**
 * One-off transplant helper.
 *
 * Lifts the verified health domain logic out of the old single-file App.jsx
 * into lib/health.js VERBATIM — byte for byte, comments and all. These are
 * the numbers that cite 衛福部／國健署 sources and carry a review date; they
 * must not be retyped by hand, because a wrong digit here produces wrong
 * health advice without ever throwing an error.
 *
 * Run once from source/:  node tools/extract-health.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';

const SRC = 'App.jsx';
const OUT = 'lib/health.js';

/* This already ran once, and lib/health.js has been edited by hand since
 * (sleepZones and its CONTENT_REVIEW entry). Regenerating would silently drop
 * those edits, so refuse unless someone really means it. */
if (existsSync(OUT) && !process.argv.includes('--force')) {
  console.error(
    `${OUT} already exists and has been hand-edited since extraction.\n` +
      `Edit it directly. Pass --force only if you truly mean to regenerate and\n` +
      `lose any changes made since.`
  );
  process.exit(1);
}
const FIRST_LINE = 37;   // const SYMPTOM_OPTIONS = [
const LAST_LINE = 538;   // closing brace of buildWeeklyCalorieData

const lines = readFileSync(SRC, 'utf8').split('\n');

// Guard: fail loudly if App.jsx no longer matches the expected boundaries,
// rather than silently writing a truncated module.
const head = lines[FIRST_LINE - 1];
const tail = lines[LAST_LINE - 1];
if (!head.startsWith('const SYMPTOM_OPTIONS')) {
  throw new Error(`line ${FIRST_LINE} is not SYMPTOM_OPTIONS, got: ${head}`);
}
if (tail.trim() !== '}') {
  throw new Error(`line ${LAST_LINE} is not a closing brace, got: ${tail}`);
}
if (!lines.slice(LAST_LINE, LAST_LINE + 3).some((l) => l.startsWith('function fileToBase64'))) {
  throw new Error('boundary drifted: expected fileToBase64 to follow');
}

const body = lines.slice(FIRST_LINE - 1, LAST_LINE).join('\n');

// Collect every top-level name so the export list can never miss one.
const names = [];
for (const line of body.split('\n')) {
  const m = /^(?:const|function)\s+([A-Za-z_$][\w$]*)/.exec(line);
  if (m) names.push(m[1]);
}
const unique = [...new Set(names)];

const header = `/**
 * Health domain logic and reference values.
 *
 * Transplanted VERBATIM from the previous single-file App.jsx by
 * tools/extract-health.mjs — do not retype these by hand. Every threshold,
 * zone boundary and formula here traces back to a cited source listed in
 * CONTENT_REVIEW, with a review date. When adjusting any of these numbers,
 * update CONTENT_REVIEW.lastReviewed and its sources list in the same edit.
 */

`;

const footer = `\nexport {\n${unique.map((n) => `  ${n},`).join('\n')}\n};\n`;

mkdirSync('lib', { recursive: true });
writeFileSync(OUT, header + body + '\n' + footer);

console.log(`wrote ${OUT}`);
console.log(`lines ${FIRST_LINE}-${LAST_LINE} (${LAST_LINE - FIRST_LINE + 1} lines)`);
console.log(`exported ${unique.length} names:`);
console.log(unique.join(', '));
