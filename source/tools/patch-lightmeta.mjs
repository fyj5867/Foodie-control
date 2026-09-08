/**
 * Guards the traffic-light lookups.
 *
 * LIGHT_META[entry.light] returns undefined for any value that is not
 * green/yellow/red, and reading .label off that takes the whole app down to a
 * blank screen. One of the three call sites was already guarded inline —
 * evidently after someone hit it — so this makes all three go through one
 * helper instead. Entries restored from an older backup, and items coming
 * back from the photo analysis, are both outside our control.
 *
 * Run from source/:  node tools/patch-lightmeta.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';

const APP = 'App.jsx';
let s = readFileSync(APP, 'utf8');
const missed = [];
const rep = (a, b) => {
  if (!s.includes(a)) {
    missed.push(a.slice(0, 70));
    return;
  }
  s = s.split(a).join(b);
};

const helper = `import Rings, { RingLegend } from "./components/Rings.jsx";

/** Traffic-light metadata for a value that may be missing or unrecognised.
 * Falls back to yellow — "watch the portion" is the safe thing to say when
 * we do not actually know. */
function lightMeta(light) {
  return LIGHT_META[light] || LIGHT_META.yellow;
}

/** Just the word, without the trailing guidance clause. */
function lightWord(light) {
  return lightMeta(light).label.split("\\u3000")[0];
}`;

rep('import Rings, { RingLegend } from "./components/Rings.jsx";', helper);

rep(
  '{LIGHT_META[["green", "yellow", "red"].includes(r.light) ? r.light : "yellow"].label.split("　")[0]}',
  '{lightWord(r.light)}'
);
rep('{LIGHT_META[entry.light].label.split("　")[0]}', '{lightWord(entry.light)}');
rep('{LIGHT_META[item.light].label.split("　")[0]}', '{lightWord(item.light)}');

// The remaining direct use is inside the Pill/meta helper, which already
// handles an unknown value; route it through the same fallback anyway.
rep('  const meta = LIGHT_META[light];', '  const meta = lightMeta(light);');

writeFileSync(APP, s);
console.log(missed.length ? 'MISSED:\n' + missed.join('\n') : 'all light lookups guarded');
