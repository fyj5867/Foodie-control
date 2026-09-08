/**
 * The sprout — a plant with a face.
 *
 * Deliberately drawn in the same language as the water mascot: dot eyes, a
 * stroked mouth, blush cheeks, closed-arc eyes when it is sleepy, and gold
 * sparkles at its best. The first version of this was a botanically tidy
 * plant with no face, and it read as a diagram rather than something you
 * would want to look after.
 *
 * A round body carries the face and grows with the stage; leaves sprout from
 * its crown and get fuller. Vitality only changes the face, the tint and the
 * leaf angle — never the size — so progress and mood stay readable as two
 * separate things.
 *
 * Face colours match the water mascot exactly (#1E2A22 ink, #F6A6A6 cheeks,
 * #FFC94A sparkles), so the two characters look like they come from the same
 * app. Those are literal rather than themed for the same reason the water
 * bottle is always blue: the character is an object, not a surface.
 */

import React from "react";

const LEAF_PATH = "M0 0 C -19 -7 -29 -28 -21 -48 C -2 -40 6 -19 0 0 Z";
const LEAF_VEIN = "M-1 -2 C -7 -14 -13 -28 -18 -41";

const INK = "#1E2A22";
const CHEEK = "#F6A6A6";
const SPARKLE = "#FFC94A";

/** Everything vitality changes: the face it wears, its tint, and leaf droop. */
const MOODS = {
  wilting: { face: "sleepy", droop: 30, body: "var(--leaf-dull)", leaf: "var(--leaf-dull)", stem: "var(--stem-dull)" },
  low: { face: "neutral", droop: 14, body: "var(--leaf)", leaf: "var(--leaf)", stem: "var(--stem)" },
  fair: { face: "happy", droop: 2, body: "var(--leaf)", leaf: "var(--leaf)", stem: "var(--stem)" },
  thriving: { face: "party", droop: -8, body: "var(--leaf-bright)", leaf: "var(--leaf-bright)", stem: "var(--stem)" },
};

/**
 * Stage geometry. The body sits on the soil line at y=164 and grows upward;
 * `leaves` are absolute positions in the same 200x200 space, and `back`
 * leaves are drawn behind the body in the darker green for depth.
 */
const STAGES_GEO = {
  seed: {
    bodyW: 18,
    bodyH: 14,
    stem: null,
    back: [],
    leaves: [],
  },
  sprout: {
    bodyW: 23,
    bodyH: 21,
    stem: { to: 112, width: 4 },
    back: [],
    leaves: [
      { x: 98, y: 114, rot: -18, s: 0.3 },
      { x: 102, y: 114, rot: -18, s: 0.3, mirror: true },
    ],
  },
  seedling: {
    bodyW: 28,
    bodyH: 27,
    stem: { to: 98, width: 4.5 },
    back: [],
    leaves: [
      { x: 97, y: 102, rot: -22, s: 0.38 },
      { x: 103, y: 102, rot: -22, s: 0.38, mirror: true },
      { x: 100, y: 96, rot: -4, s: 0.34 },
    ],
  },
  sapling: {
    bodyW: 33,
    bodyH: 33,
    stem: { to: 82, width: 5 },
    back: [{ x: 94, y: 100, rot: -34, s: 0.3 }, { x: 106, y: 100, rot: -34, s: 0.3, mirror: true }],
    leaves: [
      { x: 96, y: 88, rot: -24, s: 0.44 },
      { x: 104, y: 88, rot: -24, s: 0.44, mirror: true },
      { x: 100, y: 80, rot: -4, s: 0.4 },
    ],
  },
  tree: {
    bodyW: 38,
    bodyH: 39,
    stem: { to: 66, width: 5.5 },
    back: [
      { x: 92, y: 86, rot: -38, s: 0.36 },
      { x: 108, y: 86, rot: -38, s: 0.36, mirror: true },
    ],
    leaves: [
      { x: 94, y: 74, rot: -26, s: 0.5 },
      { x: 106, y: 74, rot: -26, s: 0.5, mirror: true },
      { x: 100, y: 64, rot: -4, s: 0.46 },
      { x: 96, y: 90, rot: -44, s: 0.34 },
      { x: 104, y: 90, rot: -44, s: 0.34, mirror: true },
    ],
  },
  bloom: {
    bodyW: 41,
    bodyH: 43,
    stem: { to: 56, width: 6 },
    back: [
      { x: 90, y: 80, rot: -40, s: 0.4 },
      { x: 110, y: 80, rot: -40, s: 0.4, mirror: true },
    ],
    leaves: [
      { x: 93, y: 66, rot: -28, s: 0.54 },
      { x: 107, y: 66, rot: -28, s: 0.54, mirror: true },
      { x: 100, y: 55, rot: -4, s: 0.5 },
      { x: 95, y: 84, rot: -46, s: 0.36 },
      { x: 105, y: 84, rot: -46, s: 0.36, mirror: true },
    ],
    blooms: [
      { x: 78, y: 58, s: 0.8 },
      { x: 122, y: 58, s: 0.72 },
      { x: 100, y: 42, s: 0.86 },
    ],
  },
};

const BODY_BOTTOM = 164;

function leafTransform({ x, y, rot, s, mirror }, droop) {
  const angle = rot + droop;
  return mirror
    ? `translate(${x},${y}) scale(${-s},${s}) rotate(${angle})`
    : `translate(${x},${y}) rotate(${angle}) scale(${s})`;
}

function Leaf({ spec, droop, fill }) {
  return (
    <g transform={leafTransform(spec, droop)}>
      <path d={LEAF_PATH} fill={fill} />
      <path d={LEAF_VEIN} stroke="var(--leaf-dk)" strokeWidth="1.8" fill="none" opacity="0.35" strokeLinecap="round" />
    </g>
  );
}

function Bloom({ x, y, s }) {
  return (
    <g transform={`translate(${x},${y}) scale(${s})`}>
      <circle cx="0" cy="-7" r="4.6" fill="var(--bloom)" />
      <circle cx="6.6" cy="-2.2" r="4.6" fill="var(--bloom)" />
      <circle cx="4.1" cy="5.7" r="4.6" fill="var(--bloom)" />
      <circle cx="-4.1" cy="5.7" r="4.6" fill="var(--bloom)" />
      <circle cx="-6.6" cy="-2.2" r="4.6" fill="var(--bloom)" />
      <circle cx="0" cy="0" r="3.4" fill="var(--bloom-mid)" />
    </g>
  );
}

/**
 * The face, sized to the body it sits on.
 *
 * Four expressions, one per number of daily conditions met — the same four
 * moods the water mascot uses, so the two read as siblings.
 */
function Face({ cx, cy, bodyW, mood }) {
  // Keep features generous on a small body but stop them ballooning on a big
  // one; a face that scales linearly looks wrong at both ends.
  const eyeR = Math.max(3, Math.min(bodyW * 0.15, 5.5));
  const eyeDx = bodyW * 0.36;
  const eyeY = cy - bodyW * 0.06;
  const mouthY = eyeY + eyeR * 2.6;
  const cheekDx = bodyW * 0.66;
  const cheekY = eyeY + eyeR * 1.4;
  const stroke = Math.max(2, eyeR * 0.5);

  if (mood === "sleepy") {
    return (
      <g>
        <path
          d={`M${cx - eyeDx - eyeR} ${eyeY} Q${cx - eyeDx} ${eyeY - eyeR * 1.3} ${cx - eyeDx + eyeR} ${eyeY}`}
          fill="none"
          stroke={INK}
          strokeWidth={stroke}
          strokeLinecap="round"
        />
        <path
          d={`M${cx + eyeDx - eyeR} ${eyeY} Q${cx + eyeDx} ${eyeY - eyeR * 1.3} ${cx + eyeDx + eyeR} ${eyeY}`}
          fill="none"
          stroke={INK}
          strokeWidth={stroke}
          strokeLinecap="round"
        />
        <path
          d={`M${cx - eyeR} ${mouthY} L${cx + eyeR} ${mouthY}`}
          fill="none"
          stroke={INK}
          strokeWidth={stroke}
          strokeLinecap="round"
        />
      </g>
    );
  }

  // The water mascot uses 0.6 opacity, but that sits on blue; the same pink
  // over a green body turns muddy grey. Same colour, more of it.
  const cheeks =
    mood === "happy" || mood === "party" ? (
      <>
        <circle cx={cx - cheekDx} cy={cheekY} r={eyeR * (mood === "party" ? 1.35 : 1.15)} fill={CHEEK} opacity="0.85" />
        <circle cx={cx + cheekDx} cy={cheekY} r={eyeR * (mood === "party" ? 1.35 : 1.15)} fill={CHEEK} opacity="0.85" />
      </>
    ) : null;

  const mouth =
    mood === "neutral" ? (
      <path
        d={`M${cx - eyeR * 1.4} ${mouthY} L${cx + eyeR * 1.4} ${mouthY}`}
        fill="none"
        stroke={INK}
        strokeWidth={stroke}
        strokeLinecap="round"
      />
    ) : (
      <path
        d={`M${cx - eyeR * 1.6} ${mouthY - eyeR * 0.5} Q${cx} ${mouthY + eyeR * (mood === "party" ? 2 : 1.5)} ${
          cx + eyeR * 1.6
        } ${mouthY - eyeR * 0.5}`}
        fill="none"
        stroke={INK}
        strokeWidth={stroke * 1.2}
        strokeLinecap="round"
      />
    );

  return (
    <g>
      {cheeks}
      <circle cx={cx - eyeDx} cy={eyeY} r={eyeR} fill={INK} />
      <circle cx={cx + eyeDx} cy={eyeY} r={eyeR} fill={INK} />
      {mouth}
    </g>
  );
}

function Sparkles() {
  return (
    <g fill={SPARKLE}>
      <path d="M34 44 L37 51 L44 54 L37 57 L34 64 L31 57 L24 54 L31 51 Z" />
      <path d="M168 30 L170 36 L176 38 L170 40 L168 46 L166 40 L160 38 L166 36 Z" />
      <path d="M162 74 L164 78 L168 80 L164 82 L162 86 L160 82 L156 80 L160 78 Z" />
    </g>
  );
}

/**
 * The plant as a bare <g>, for dropping into a larger scene such as the
 * garden. Drawn around x=100 with its base on the soil line at y=164.
 */
export function PlantBody({ stage = "sapling", vitality = "fair", leafTint }) {
  const geo = STAGES_GEO[stage] || STAGES_GEO.sapling;
  const mood = MOODS[vitality] || MOODS.fair;
  const cy = BODY_BOTTOM - geo.bodyH;
  const leafFill = leafTint || mood.leaf;

  return (
    <g>
      {geo.back.map((spec, i) => (
        <Leaf key={`b${i}`} spec={spec} droop={mood.droop} fill="var(--leaf-dk)" />
      ))}

      {geo.stem ? (
        <path
          d={`M100 ${cy} L100 ${geo.stem.to}`}
          stroke={mood.stem}
          strokeWidth={geo.stem.width}
          strokeLinecap="round"
        />
      ) : null}

      {geo.leaves.map((spec, i) => (
        <Leaf key={`l${i}`} spec={spec} droop={mood.droop} fill={leafFill} />
      ))}

      {/* The body goes on top of the stem so the join is hidden, and carries
          the face. Slightly wider than tall at the base for a settled look. */}
      <ellipse cx="100" cy={cy} rx={geo.bodyW} ry={geo.bodyH} fill={leafTint || mood.body} />
      <ellipse
        cx="100"
        cy={cy - geo.bodyH * 0.35}
        rx={geo.bodyW * 0.62}
        ry={geo.bodyH * 0.4}
        fill="#FFFFFF"
        opacity="0.12"
      />

      <Face cx={100} cy={cy} bodyW={geo.bodyW} mood={mood.face} />

      {(geo.blooms || []).map((b, i) => (
        <Bloom key={`f${i}`} {...b} />
      ))}
    </g>
  );
}

/**
 * A single sprout on its own patch of soil — the main screen's centrepiece.
 *
 * @param stage    one of the STAGES keys from lib/goals.js
 * @param vitality one of the VITALITY keys — how today went
 * @param ground   draw the soil mound
 * @param glow     warm light behind, used at the best state
 */
export default function Sprout({
  stage = "sapling",
  vitality = "fair",
  ground = true,
  glow = false,
  title,
  className,
}) {
  const mood = MOODS[vitality] || MOODS.fair;

  return (
    <svg
      viewBox="14 22 172 164"
      className={className}
      role="img"
      aria-label={title || "樹苗"}
      style={{ display: "block", width: "100%", height: "auto" }}
    >
      {glow ? <circle cx="100" cy="104" r="72" fill="var(--glow)" opacity="0.55" /> : null}

      {ground ? (
        <>
          <ellipse cx="100" cy="172" rx="58" ry="13" fill="var(--soil-dk)" />
          <ellipse cx="100" cy="168" rx="58" ry="12" fill="var(--soil)" />
        </>
      ) : null}

      <PlantBody stage={stage} vitality={vitality} />

      {mood.face === "party" ? <Sparkles /> : null}
    </svg>
  );
}

export { STAGES_GEO, MOODS };
