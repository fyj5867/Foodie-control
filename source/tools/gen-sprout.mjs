/**
 * Turns the Health Forest stage drawings into source/components/Sprout.jsx.
 *
 * The artwork is copied verbatim from the design canvas — only the syntax is
 * translated (SVG attributes to JSX camelCase). Redrawing by hand would drift
 * from the design; this keeps the component a faithful transcription.
 *
 * The one thing not taken verbatim is the face. Each stage in the canvas is
 * drawn with a single fixed expression, but the app needs four — one per
 * number of daily conditions met. So the face is located in each drawing,
 * REMOVED, and its exact position recorded; the app then re-draws one of four
 * expressions at that same spot.
 *
 * Recording the position per stage rather than assuming one fixed spot matters:
 * the canvas puts the face on the pot for the seven potted stages but on the
 * CANOPY for the finished forest tree. Pinning every face to the pot's height
 * left the tree with a face floating on the ground beneath it.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const stages = JSON.parse(readFileSync(process.argv[2], 'utf8'));

/** The eight growth drawings, in order, ignoring the arrow separators. */
const KEYS = ['seed', 'sprout', 'shoot', 'seedling', 'growing', 'mature', 'ready', 'forest'];
const drawings = stages.filter((s) => s.viewBox === '-2 -2 100 100');
if (drawings.length !== KEYS.length) {
  throw new Error(`expected ${KEYS.length} drawings, found ${drawings.length}`);
}

const INK = '#3A4C3A';
const BLUSH = '#F4A6B7';

/** SVG attribute names that JSX spells differently. */
const ATTR = {
  'stroke-width': 'strokeWidth',
  'stroke-linejoin': 'strokeLinejoin',
  'stroke-linecap': 'strokeLinecap',
  'stroke-dasharray': 'strokeDasharray',
  'fill-rule': 'fillRule',
  'clip-rule': 'clipRule',
  'stop-color': 'stopColor',
  'font-size': 'fontSize',
  'font-weight': 'fontWeight',
  'text-anchor': 'textAnchor',
};

function toJsx(markup) {
  let out = markup;
  for (const [from, to] of Object.entries(ATTR)) {
    out = out.replace(new RegExp(`\\b${from}=`, 'g'), `${to}=`);
  }
  return out;
}

/**
 * Split markup into its top-level elements.
 *
 * Only top-level elements are considered when looking for the face. The first
 * version of this script matched loose paths anywhere, and swallowed the
 * forest tree's trunk and the grass mound it stands on because they happen to
 * start at the same heights a mouth does.
 */
function topLevel(inner) {
  const out = [];
  const re = /<(\/?)([a-zA-Z][\w-]*)([^>]*?)(\/?)>/g;
  let depth = 0;
  let start = null;
  let m;
  while ((m = re.exec(inner))) {
    const closing = m[1] === '/';
    const self = m[4] === '/';
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

const num = (s) => Number(s);
function attr(el, name) {
  const m = el.match(new RegExp(`\\b${name}="([^"]*)"`));
  return m ? m[1] : null;
}
function circles(el) {
  return [...el.matchAll(/<circle\b([^>]*)\/>/g)].map((c) => ({
    cx: num(attr(c[0], 'cx')),
    cy: num(attr(c[0], 'cy')),
    r: num(attr(c[0], 'r')),
  }));
}
function paths(el) {
  return [...el.matchAll(/<path\b([^>]*)\/>/g)].map((p) => p[0]);
}

/** A closed, sleeping eye: one short arc, no line segments. */
const EYE_ARC = /^M([\d.]+) ([\d.]+)c[-\d., ]+ ([-\d.]+) [-\d.]+$/;

/**
 * Find and remove the face, returning the body and where the face sat.
 *
 * The face is a small cluster: two eyes (dots or closed arcs), a mouth just
 * below them, and sometimes two blush circles. Everything is located relative
 * to the eyes, so the same rule works whether the face is on the pot or 55
 * units higher up on the tree's canopy.
 */
function stripFace(inner) {
  const els = topLevel(inner);
  const kept = [];
  const removed = [];
  let eyes = null;
  let blush = null;
  let mouthY = null;

  // Pass 1: the eyes, which anchor everything else.
  for (const el of els) {
    if (eyes || !el.startsWith('<g')) continue;
    const isInkFill = attr(el, 'fill') === INK && !attr(el, 'stroke');
    const cs = circles(el);
    if (isInkFill && cs.length === 2 && cs.every((c) => c.r <= 4 && c.cy === cs[0].cy)) {
      eyes = { y: cs[0].cy, cx: (cs[0].cx + cs[1].cx) / 2, dx: Math.abs(cs[1].cx - cs[0].cx) / 2, r: cs[0].r, closed: false };
      removed.push(el);
      continue;
    }
    // Closed eyes: a group of exactly two short arcs, nothing else. The
    // attribute list must be exactly stroke/width/linecap — the roots on the
    // 破土 stage are also two symmetric paths in an ink group, but they carry
    // stroke-linejoin and fill, and they use line segments.
    const isArcGroup =
      /^<g stroke="#3A4C3A" stroke-width="[\d.]+" stroke-linecap="round">$/.test(el.slice(0, el.indexOf('>') + 1));
    const ps = paths(el);
    if (isArcGroup && ps.length === 2) {
      const a = attr(ps[0], 'd').match(EYE_ARC);
      const b = attr(ps[1], 'd').match(EYE_ARC);
      if (a && b) {
        const c1 = num(a[1]) + num(a[3]) / 2;
        const c2 = num(b[1]) + num(b[3]) / 2;
        eyes = {
          y: num(a[2]),
          cx: (c1 + c2) / 2,
          dx: Math.abs(c2 - c1) / 2,
          r: num(attr(el, 'stroke-width')) / 2,
          closed: true,
        };
        removed.push(el);
        continue;
      }
    }
  }
  if (!eyes) throw new Error('no eyes found in a stage drawing');

  // Pass 2: blush and mouth, both judged relative to the eyes.
  for (const el of els) {
    if (removed.includes(el)) continue;

    if (el.startsWith('<g') && attr(el, 'fill') === BLUSH && !attr(el, 'stroke')) {
      const cs = circles(el);
      if (cs.length === 2 && cs.every((c) => c.r <= 4)) {
        blush = { y: cs[0].cy, dx: Math.abs(cs[1].cx - cs[0].cx) / 2, r: cs[0].r };
        removed.push(el);
        continue;
      }
    }

    if (el.startsWith('<path')) {
      const d = attr(el, 'd') || '';
      const m = d.match(/^M([\d.]+) ?([\d.]+)/);
      if (m) {
        const x = num(m[1]);
        const y = num(m[2]);
        const near = Math.abs(x - eyes.cx) < 12 && y > eyes.y && y < eyes.y + 12;
        const inky = attr(el, 'stroke') === INK || attr(el, 'fill') === INK;
        if (near && inky) {
          mouthY = y;
          removed.push(el);
        }
      }
    }
  }
  if (mouthY == null) throw new Error('no mouth found in a stage drawing');

  for (const el of els) if (!removed.includes(el)) kept.push(el);

  return {
    body: kept.join('\n').trim(),
    face: {
      cx: eyes.cx,
      eyeY: eyes.y,
      eyeDx: eyes.dx,
      mouthY,
      blushY: blush ? blush.y : Math.round((eyes.y + 2.5) * 10) / 10,
      blushDx: blush ? blush.dx : eyes.dx + 6,
    },
    removed,
  };
}

/**
 * Where the plant meets the ground, per stage — needed to stand a plant on a
 * spot in the garden. The potted stages rest on the bottom of the pot; the
 * forest tree stands on its own grass mound, which is higher up.
 */
function groundY(key) {
  if (key === 'forest') return 88;
  return 91;
}

const parts = drawings.map((d, i) => {
  const key = KEYS[i];
  // The face is located and removed in the ORIGINAL SVG, then what remains
  // is translated to JSX — the face rules read plain SVG attribute names.
  const inner = d.markup.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').trim();
  const { body, face, removed } = stripFace(inner);
  return {
    key,
    label: d.label,
    body: toJsx(body),
    face,
    ground: groundY(key),
    // 破土 and 森林之樹 are drawn with sparkles of their own; adding the
    // app's set on top of those would double them up. The flower centre on
    // 成熟 is the same yellow but a fill, not a sparkle stroke.
    hasSparkle: body.includes('stroke="#F2C55C"'),
    removedCount: removed.length,
  };
});

for (const p of parts) {
  console.log(
    `${p.key.padEnd(9)} ${p.label.padEnd(6)} face removed: ${p.removedCount}  ` +
      `eyes y${p.face.eyeY} mouth y${p.face.mouthY}  ground y${p.ground}` +
      (p.hasSparkle ? '  (own sparkles)' : '')
  );
}

const artEntries = parts
  .map(
    (p) => `  /* ${p.label} */
  ${p.key}: (
    <>
${p.body
  .split('\n')
  .map((l) => '      ' + l.trim())
  .join('\n')}
    </>
  ),`
  )
  .join('\n');

const faceEntries = parts
  .map(
    (p) =>
      `  ${p.key}: { cx: ${p.face.cx}, eyeY: ${p.face.eyeY}, eyeDx: ${p.face.eyeDx}, mouthY: ${p.face.mouthY}, blushY: ${p.face.blushY}, blushDx: ${p.face.blushDx} },`
  )
  .join('\n');

const groundEntries = parts.map((p) => `  ${p.key}: ${p.ground},`).join('\n');
const ownSparkles = parts.filter((p) => p.hasSparkle).map((p) => `"${p.key}"`).join(', ');

const file = `/**
 * The plant — artwork from the Health Forest 植物養成圖示系統 canvas.
 *
 * Every stage below is copied verbatim from that design; only the SVG
 * attribute syntax was translated to JSX by tools/gen-sprout.mjs. Do not
 * redraw these by hand — regenerate from the canvas so the app and the design
 * stay the same drawing.
 *
 * The canvas draws each stage with one fixed expression. The app needs four,
 * one per number of daily conditions met, so the face is removed from the
 * stage art and re-drawn from a shared set — at that stage's OWN face position
 * (FACE_AT), read out of the drawing itself. The position is not the same for
 * every stage: the potted stages wear their face on the pot, the finished
 * forest tree wears it on the canopy. Assuming one fixed spot put a face on
 * the ground under the tree.
 *
 * Canvas rules carried over: 96×96 box (viewBox -2 -2 100 100), every outline
 * #3A4C3A at 4.5, round caps and joins.
 */

import React from "react";

/** Outline and blush colours, per the canvas token sheet. */
const INK = "#3A4C3A";
const BLUSH = "#F4A6B7";

/** Where each stage's face sits, read from the canvas drawings. */
const FACE_AT = {
${faceEntries}
};

/** Where each stage meets the ground, for standing it on a spot in a scene. */
const GROUND_Y = {
${groundEntries}
};

/** Stages whose artwork already includes sparkles of its own. */
const OWN_SPARKLES = [${ownSparkles}];

export function groundY(stage) {
  return GROUND_Y[stage] ?? GROUND_Y.seedling;
}

/**
 * The four expressions, one per number of daily conditions met.
 *
 * Only the face changes with mood — never the plant — so progress and how the
 * day went stay readable as two separate things.
 */
function Face({ mood, at }) {
  const { cx, eyeY, eyeDx, mouthY, blushY, blushDx } = at;

  if (mood === "wilting") {
    // Closed, sleeping eyes: tired, never unwell. This is the same shape the
    // canvas uses on the 種子 and 破土 stages.
    return (
      <g>
        <g stroke={INK} strokeWidth="3" strokeLinecap="round" fill="none">
          <path d={\`M\${cx - eyeDx - 3.5} \${eyeY}c1.6-2.4 5.4-2.4 7 0\`} />
          <path d={\`M\${cx + eyeDx - 3.5} \${eyeY}c1.6-2.4 5.4-2.4 7 0\`} />
        </g>
        <path
          d={\`M\${cx - 2.5} \${mouthY}c0.9 1.4 4.2 1.4 5.1 0\`}
          stroke={INK}
          strokeWidth="2.8"
          strokeLinecap="round"
          fill="none"
        />
      </g>
    );
  }

  const cheeky = mood === "fair" || mood === "thriving";
  const r = mood === "thriving" ? 3.4 : 3.2;

  return (
    <g>
      {cheeky ? (
        <g fill={BLUSH}>
          <circle cx={cx - blushDx} cy={blushY} r={mood === "thriving" ? 3 : 2.8} />
          <circle cx={cx + blushDx} cy={blushY} r={mood === "thriving" ? 3 : 2.8} />
        </g>
      ) : null}

      <g fill={INK}>
        <circle cx={cx - eyeDx} cy={eyeY} r={r} />
        <circle cx={cx + eyeDx} cy={eyeY} r={r} />
      </g>

      {mood === "low" ? (
        <path
          d={\`M\${cx - 3.6} \${mouthY} h7.2\`}
          stroke={INK}
          strokeWidth="2.9"
          strokeLinecap="round"
          fill="none"
        />
      ) : (
        <path
          d={\`M\${cx - 3.9} \${mouthY}c1.5 \${mood === "thriving" ? 3.1 : 2.1} 6.2 \${
            mood === "thriving" ? 3.1 : 2.1
          } 7.7 0\`}
          stroke={INK}
          strokeWidth="2.9"
          strokeLinecap="round"
          fill="none"
        />
      )}
    </g>
  );
}

/** A small four-pointed sparkle, for the day everything is met. */
function Sparkles() {
  const star = (x, y, s) =>
    \`M\${x} \${y - 5 * s}L\${x + 1.5 * s} \${y - 1.5 * s}L\${x + 5 * s} \${y}L\${x + 1.5 * s} \${y + 1.5 * s}L\${x} \${
      y + 5 * s
    }L\${x - 1.5 * s} \${y + 1.5 * s}L\${x - 5 * s} \${y}L\${x - 1.5 * s} \${y - 1.5 * s}Z\`;
  return (
    <g fill="#F2C55C">
      <path d={star(13, 26, 1)} />
      <path d={star(84, 17, 1.2)} />
      <path d={star(88, 45, 0.8)} />
    </g>
  );
}

/** Stage artwork, faces removed. Keys match STAGES in lib/goals.js. */
const STAGE_ART = {
${artEntries}
};

/**
 * The plant as a bare <g>, for dropping into a larger scene such as the
 * garden. Drawn in the canvas's own 96×96 space.
 */
export function PlantBody({ stage = "seedling", vitality = "fair" }) {
  return (
    <g>
      {STAGE_ART[stage] || STAGE_ART.seedling}
      <Face mood={vitality} at={FACE_AT[stage] || FACE_AT.seedling} />
    </g>
  );
}

/**
 * A single plant — the main screen's centrepiece.
 *
 * @param stage    one of the STAGES keys from lib/goals.js
 * @param vitality one of the VITALITY keys — how today went
 * @param glow     warm light behind, used when all three are met
 */
export default function Sprout({ stage = "seedling", vitality = "fair", glow = false, title, className }) {
  return (
    <svg
      viewBox="-2 -2 100 100"
      className={className}
      role="img"
      aria-label={title || "植物"}
      fill="none"
      style={{ display: "block" }}
    >
      {glow ? <circle cx="48" cy="48" r="46" fill="#F7EFD4" opacity="0.75" /> : null}
      <PlantBody stage={stage} vitality={vitality} />
      {vitality === "thriving" && !OWN_SPARKLES.includes(stage) ? <Sparkles /> : null}
    </svg>
  );
}

export { STAGE_ART, FACE_AT };
`;

writeFileSync(process.argv[3], file);
console.log(`\nwrote ${process.argv[3]}`);
