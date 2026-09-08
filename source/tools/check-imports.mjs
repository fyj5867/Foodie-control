/**
 * Catches names used from our own modules but never imported.
 *
 * esbuild validates named imports — importing something a module does not
 * export is a build error. What it does NOT catch is using a name you forgot
 * to import at all: that is just a free identifier, and it only blows up at
 * runtime. That already bit once (clearSummaries in useGarden.js), and the
 * throw landed in a try/catch that swallowed it, so "clear all data" silently
 * left the garden standing.
 *
 * Run from source/:  node tools/check-imports.mjs
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';

const OWN_MODULES = ['lib/health.js', 'lib/goals.js', 'lib/storage.js', 'lib/useGarden.js'];

/** Every name each of our modules exports. */
function exportsOf(file) {
  const src = readFileSync(file, 'utf8');
  const names = new Set();
  // `async` sits between `export` and `function`, and function* is a thing —
  // missing that is how this checker first failed to catch anything.
  for (const m of src.matchAll(
    /export\s+(?:default\s+)?(?:async\s+)?(?:const|let|var|function\s*\*?|class)\s+([A-Za-z_$][\w$]*)/g
  )) {
    names.add(m[1]);
  }
  for (const block of src.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const raw of block[1].split(',')) {
      const name = raw.trim().split(/\s+as\s+/).pop().trim();
      if (name) names.add(name);
    }
  }
  return names;
}

const exportMap = new Map();
for (const mod of OWN_MODULES) exportMap.set(mod, exportsOf(mod));

/** All source files that might consume them. */
function sourceFiles() {
  const out = ['App.jsx', 'entry.jsx'];
  for (const dir of ['lib', 'components']) {
    for (const f of readdirSync(dir)) {
      if (/\.(js|jsx)$/.test(f)) out.push(join(dir, f));
    }
  }
  return out;
}

/** Comments mention names on purpose ("see canBackfill"); only code counts. */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const problems = [];

for (const file of sourceFiles()) {
  const src = stripComments(readFileSync(file, 'utf8'));

  // Names this file brings in, from anywhere, plus what it declares itself.
  const available = new Set();
  for (const block of src.matchAll(/import\s*\{([^}]*)\}\s*from/g)) {
    for (const raw of block[1].split(',')) {
      const name = raw.trim().split(/\s+as\s+/).pop().trim();
      if (name) available.add(name);
    }
  }
  for (const m of src.matchAll(/import\s+([A-Za-z_$][\w$]*)\s*(?:,|from)/g)) available.add(m[1]);
  for (const m of src.matchAll(/(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/g)) available.add(m[1]);
  // Destructured locals, e.g. const { today: todayGoals } = useGarden(...)
  for (const block of src.matchAll(/(?:const|let)\s*\{([^}]*)\}\s*=/g)) {
    for (const raw of block[1].split(',')) {
      const name = raw.trim().split(':').pop().trim().split('=')[0].trim();
      if (name) available.add(name);
    }
  }
  // Function parameters, including destructured props.
  for (const block of src.matchAll(/function\s+[A-Za-z_$][\w$]*\s*\(\s*\{([^}]*)\}/g)) {
    for (const raw of block[1].split(',')) {
      const name = raw.trim().split(':').pop().trim().split('=')[0].trim();
      if (name) available.add(name);
    }
  }

  // Does it use any name one of our modules exports, without having it?
  for (const [mod, names] of exportMap) {
    if (resolve(mod) === resolve(file)) continue;
    for (const name of names) {
      if (available.has(name)) continue;
      // Word-boundary use, not inside a string or a longer identifier.
      const used = new RegExp(`(?<![\\w$.'"\`])${name}\\s*(?:\\(|\\.|\\[|,|\\)|;|\\s*[=<>+])`).test(src);
      if (used) problems.push(`${file}: uses ${name} (exported by ${mod}) but never imports it`);
    }
  }
}

if (problems.length) {
  console.log('PROBLEMS:\n' + problems.map((p) => '  ' + p).join('\n'));
  process.exit(1);
}
console.log(`checked ${sourceFiles().length} files — every name used from our own modules is imported`);
