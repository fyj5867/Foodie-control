/**
 * Checks the plant artwork against the design it was transcribed from.
 *
 * components/Sprout.jsx is generated from the Health Forest canvas by
 * tools/gen-sprout.mjs, which does one delicate thing: it deletes each stage's
 * fixed face so the app can draw one of four expressions in its place. That
 * deletion has already gone wrong twice, both times silently —
 *
 *   - the finished tree's face was NOT deleted (it sits on the canopy, not on
 *     the pot like every other stage), so the tree rendered with its own face
 *     plus a second one floating on the ground below it;
 *   - the same tree's trunk and the grass mound it stands on WERE deleted,
 *     because they start at the same heights a mouth does, leaving the canopy
 *     hovering in mid-air.
 *
 * Neither threw. The rule below is what actually catches this: everything the
 * canvas drew must still be in the component, EXCEPT a couple of small marks
 * that sit at the face position the component itself recorded. A whole trunk
 * going missing fails it; a face left behind fails it.
 *
 * Run from source/:  node tools/test-sprout.mjs
 */
import { readFileSync } from "node:fs";
import { STAGES } from "../lib/goals.js";

let passed = 0;
const failures = [];

function ok(name, cond, detail = "") {
  if (cond) passed += 1;
  else failures.push(`${name}${detail ? "\n    " + detail : ""}`);
}

const canvas = JSON.parse(readFileSync(new URL("./health-forest-stages.json", import.meta.url), "utf8"))
  .filter((s) => s.viewBox === "-2 -2 100 100");
const src = readFileSync(new URL("../components/Sprout.jsx", import.meta.url), "utf8");

ok("the canvas file still holds all eight drawings", canvas.length === STAGES.length, `found ${canvas.length}`);

/** SVG attribute names JSX spells differently — the only edit the generator makes. */
const ATTR = {
  "stroke-width": "strokeWidth",
  "stroke-linejoin": "strokeLinejoin",
  "stroke-linecap": "strokeLinecap",
  "stroke-dasharray": "strokeDasharray",
  "fill-rule": "fillRule",
  "clip-rule": "clipRule",
};

/** Compare shapes, not formatting: the generator re-indents what it keeps. */
function norm(markup) {
  let out = markup;
  for (const [from, to] of Object.entries(ATTR)) out = out.replace(new RegExp(`\\b${from}=`, "g"), `${to}=`);
  return out.replace(/\s+/g, " ").replace(/>\s+</g, "><").trim();
}

/** Top-level elements only — a drawing is a flat list of shapes and groups. */
function topLevel(inner) {
  const out = [];
  const re = /<(\/?)([a-zA-Z][\w-]*)([^>]*?)(\/?)>/g;
  let depth = 0;
  let start = null;
  let m;
  while ((m = re.exec(inner))) {
    const closing = m[1] === "/";
    const self = m[4] === "/";
    if (!closing && depth === 0) start = m.index;
    if (!closing && !self) depth += 1;
    else if (closing) depth -= 1;
    if (depth === 0 && start !== null) {
      out.push(inner.slice(start, m.index + m[0].length));
      start = null;
    }
  }
  return out;
}

/** The component's artwork for one stage, as one normalised string. */
function artFor(key) {
  const start = src.indexOf(`\n  ${key}: (`);
  if (start < 0) return null;
  const end = src.indexOf("\n  ),", start);
  return norm(src.slice(start, end));
}

/** The recorded face position for one stage. */
function faceFor(key) {
  const m = src.match(new RegExp(`\\n  ${key}: \\{ cx: ([\\d.]+), eyeY: ([\\d.]+), eyeDx: ([\\d.]+), mouthY: ([\\d.]+)`));
  return m ? { cx: Number(m[1]), eyeY: Number(m[2]), eyeDx: Number(m[3]), mouthY: Number(m[4]) } : null;
}

/** Where an element sits vertically: the first cy, or the y its path starts at. */
function elementY(el) {
  const cy = el.match(/\bcy="([-\d.]+)"/);
  if (cy) return Number(cy[1]);
  const d = el.match(/\bd="M([\d.]+) ?([\d.]+)/);
  return d ? Number(d[2]) : null;
}

/** Nothing on a face is bigger than a few units across. */
function elementWidth(el) {
  const xs = [...el.matchAll(/\b(?:cx|x)="([-\d.]+)"/g)].map((m) => Number(m[1]));
  const dx = [...el.matchAll(/\bd="M([\d.]+)/g)].map((m) => Number(m[1]));
  const all = [...xs, ...dx];
  return all.length ? Math.max(...all) - Math.min(...all) : 0;
}

for (let i = 0; i < STAGES.length && i < canvas.length; i++) {
  const key = STAGES[i].key;
  const drawing = canvas[i];
  const art = artFor(key);
  const face = faceFor(key);

  ok(`${key} has artwork`, art != null, key);
  ok(`${key} has a recorded face position`, face != null, key);
  ok(`${key} has a recorded ground line`, new RegExp(`\\n  ${key}: \\d`).test(src.slice(src.indexOf("const GROUND_Y"))), key);
  if (!art || !face) continue;

  const inner = drawing.markup.replace(/^<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
  const dropped = topLevel(inner).filter((el) => !art.includes(norm(el)));

  // A face is two eyes, a mouth and sometimes blush: two or three marks.
  ok(`${key} drops only the face`, dropped.length >= 2 && dropped.length <= 3, `dropped ${dropped.length}`);

  for (const el of dropped) {
    const y = elementY(el);
    const near = y != null && y >= face.eyeY - 8 && y <= face.eyeY + 8;
    ok(`${key}: what was dropped sits at the face`, near, `y=${y}, face eyeY=${face.eyeY}\n    ${el.slice(0, 70)}`);
    ok(`${key}: what was dropped is face-sized`, elementWidth(el) < 32, `width ${elementWidth(el)}\n    ${el.slice(0, 70)}`);
  }

  // And the face really is gone — one left behind means two faces on screen.
  ok(`${key} keeps no eyes of its own`, !/fill="#3A4C3A"><circle/.test(art), key);
  ok(`${key} keeps no blush of its own`, !/fill="#F4A6B7"><circle/.test(art), key);
}

/* The forest tree is the one that broke: it must stand on something. */
const forestArt = artFor("forest");
ok("the forest tree keeps its trunk", forestArt.includes('d="M48 78V50"'), "trunk stroke missing");
ok("the forest tree keeps the ground it stands on", forestArt.includes('d="M8 88c7-10'), "grass mound missing");

console.log(`${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("\nFAILURES:\n" + failures.map((f) => "  " + f).join("\n"));
  process.exit(1);
}
