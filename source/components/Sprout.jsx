/**
 * The sprout — a bean with a face.
 *
 * Drawn as a 豆苗: a bean at the base, a slender stem, and rounded paired
 * leaves. Two decisions carry the whole design:
 *
 * 1. **The bean never changes size.** It is the character; what grows is the
 *    stem and the number of leaf pairs. So progress is unmistakable at a
 *    glance, and the face stays equally readable at every stage. An earlier
 *    version grew the body instead, which made the face swell and the stages
 *    hard to tell apart.
 * 2. **Leaves are plain rounded ellipses, not botanical shapes.** One pair,
 *    then a bigger pair, then two, then three — the change between stages is
 *    something you can count.
 *
 * The face follows the water mascot exactly (#1E2A22 ink, #F6A6A6 cheeks,
 * #FFC94A sparkles, closed arcs when sleepy) so the two characters read as
 * coming from the same app. Those colours are literal rather than themed for
 * the same reason the water bottle is always blue: it is a character, not a
 * surface. Vitality changes the face, the tint and the leaf angle — never the
 * size — so mood and progress never get confused for each other.
 */

import React from "react";

const INK = "#1E2A22";
const CHEEK = "#F6A6A6";
const SPARKLE = "#FFC94A";

/** The bean, fixed at every stage. Sits on the soil line at y=168. */
const BEAN = { cx: 100, cy: 146, rx: 25, ry: 21 };

/**
 * Everything vitality changes. `droop` is added to each leaf's angle, so a
 * tired plant's leaves fall towards horizontal and a thriving one's lift.
 *
 * The bean stays beige even at the worst mood — a bean is beige whatever kind
 * of day it has had. Greying it out too made the whole thing look dead rather
 * than tired, which is the one thing this character must never do.
 */
const MOODS = {
  wilting: { face: "sleepy", droop: 30, leaf: "var(--leaf-dull)", bean: "#DFD9C0", stem: "var(--stem-dull)" },
  low: { face: "neutral", droop: 14, leaf: "var(--leaf)", bean: "#E9DFAE", stem: "var(--stem)" },
  fair: { face: "happy", droop: 0, leaf: "var(--leaf)", bean: "#EFE2AC", stem: "var(--stem)" },
  thriving: { face: "party", droop: -10, leaf: "var(--leaf-bright)", bean: "#F5EBBA", stem: "var(--stem)" },
};

/**
 * Stage geometry: how tall the stem is and which leaf pairs exist.
 * Each pair is {y, rx, ry, angle} — angle in degrees, mirrored on the right.
 * Counting pairs is the progress cue, so keep them visually distinct.
 */
const STAGES_GEO = {
  seed: { stem: null, pairs: [] },
  sprout: {
    stem: { to: 124, width: 4 },
    pairs: [{ y: 126, rx: 12, ry: 8, angle: -40 }],
  },
  seedling: {
    stem: { to: 106, width: 4.5 },
    pairs: [{ y: 108, rx: 17, ry: 10, angle: -38 }],
  },
  sapling: {
    stem: { to: 84, width: 5 },
    pairs: [
      { y: 120, rx: 14, ry: 9, angle: -36 },
      { y: 86, rx: 18, ry: 11, angle: -40 },
    ],
  },
  /* The last two stages actually become a tree rather than growing one more
   * pair of leaves. They are named 小樹 and 開花, and a stage that only adds
   * a leaf pair does not deliver on either name — the transformation is what
   * makes reaching them feel like arriving somewhere. */
  tree: {
    trunk: { to: 104, width: 9 },
    pairs: [{ y: 128, rx: 13, ry: 9, angle: -34 }],
    canopy: {
      back: [
        { cx: 82, cy: 88, r: 23 },
        { cx: 118, cy: 88, r: 23 },
      ],
      front: [
        { cx: 100, cy: 74, r: 28 },
        { cx: 79, cy: 80, r: 21 },
        { cx: 121, cy: 80, r: 21 },
      ],
    },
  },
  bloom: {
    trunk: { to: 100, width: 9.5 },
    pairs: [{ y: 128, rx: 13, ry: 9, angle: -34 }],
    canopy: {
      back: [
        { cx: 80, cy: 86, r: 25 },
        { cx: 120, cy: 86, r: 25 },
      ],
      front: [
        { cx: 100, cy: 70, r: 30 },
        { cx: 77, cy: 77, r: 23 },
        { cx: 123, cy: 77, r: 23 },
      ],
    },
    flowers: [
      { x: 100, y: 48, s: 0.62 },
      { x: 76, y: 62, s: 0.55 },
      { x: 124, y: 63, s: 0.55 },
      { x: 66, y: 88, s: 0.5 },
      { x: 134, y: 88, s: 0.5 },
      { x: 100, y: 86, s: 0.52 },
    ],
  },
};

/**
 * One leaflet.
 *
 * A plump lens shape rather than an ellipse: it narrows to a soft rounded tip
 * and bulges near the base, which is what makes it read as a leaf rather than
 * a disc. Drawn once at unit length pointing right, then scaled — so tuning
 * the silhouette is one path, not six sets of numbers.
 *
 * The gloss highlight is what does most of the charm work; without it the
 * leaves go flat and plasticky.
 */
const LEAFLET = "M0 0 C 0.10 -0.62, 0.48 -0.86, 0.74 -0.62 C 0.95 -0.42, 1.02 -0.14, 1 0 C 1.02 0.14, 0.95 0.42, 0.74 0.62 C 0.48 0.86, 0.10 0.62, 0 0 Z";
const LEAFLET_GLOSS = "M0.20 -0.20 C 0.34 -0.50, 0.56 -0.58, 0.70 -0.44 C 0.54 -0.34, 0.34 -0.18, 0.20 -0.20 Z";

function Leaflet({ x, y, rx, ry, angle, fill }) {
  // Unit path is 1 long and ±1 tall, so scale y by ry and x by leaf length.
  const len = rx * 1.9;
  return (
    <g transform={`translate(${x},${y}) rotate(${angle}) scale(${len},${ry})`}>
      <path d={LEAFLET} fill={fill} />
      <path d={LEAFLET_GLOSS} fill="#FFFFFF" opacity="0.28" />
      <path
        d="M0.06 0 Q 0.5 0.06 0.9 0"
        stroke="var(--leaf-dk)"
        strokeWidth={1.4 / Math.max(len, ry)}
        fill="none"
        opacity="0.28"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </g>
  );
}

function Flower({ x, y, s }) {
  return (
    <g transform={`translate(${x},${y}) scale(${s})`}>
      <circle cx="0" cy="-7" r="5" fill="var(--bloom)" />
      <circle cx="6.7" cy="-2.2" r="5" fill="var(--bloom)" />
      <circle cx="4.1" cy="5.7" r="5" fill="var(--bloom)" />
      <circle cx="-4.1" cy="5.7" r="5" fill="var(--bloom)" />
      <circle cx="-6.7" cy="-2.2" r="5" fill="var(--bloom)" />
      <circle cx="0" cy="0" r="3.6" fill="var(--bloom-mid)" />
    </g>
  );
}

/**
 * The face on the bean. Fixed size, because the bean is.
 *
 * Four expressions, one per number of daily conditions met — the same four
 * moods the water mascot uses.
 */
function Face({ mood }) {
  const { cx, cy } = BEAN;
  const eyeR = 4;
  const eyeDx = 8.5;
  const eyeY = cy - 1;
  const mouthY = eyeY + 9;
  const stroke = 2.4;

  if (mood === "sleepy") {
    return (
      <g fill="none" stroke={INK} strokeWidth={stroke} strokeLinecap="round">
        <path d={`M${cx - eyeDx - 4} ${eyeY} Q${cx - eyeDx} ${eyeY - 5} ${cx - eyeDx + 4} ${eyeY}`} />
        <path d={`M${cx + eyeDx - 4} ${eyeY} Q${cx + eyeDx} ${eyeY - 5} ${cx + eyeDx + 4} ${eyeY}`} />
        <path d={`M${cx - 3.5} ${mouthY} L${cx + 3.5} ${mouthY}`} />
      </g>
    );
  }

  const cheeky = mood === "happy" || mood === "party";

  return (
    <g>
      {cheeky ? (
        <>
          <circle cx={cx - 16} cy={eyeY + 4.5} r={mood === "party" ? 5 : 4.2} fill={CHEEK} opacity="0.75" />
          <circle cx={cx + 16} cy={eyeY + 4.5} r={mood === "party" ? 5 : 4.2} fill={CHEEK} opacity="0.75" />
        </>
      ) : null}

      <circle cx={cx - eyeDx} cy={eyeY} r={eyeR} fill={INK} />
      <circle cx={cx + eyeDx} cy={eyeY} r={eyeR} fill={INK} />

      {mood === "neutral" ? (
        <path
          d={`M${cx - 5} ${mouthY} L${cx + 5} ${mouthY}`}
          fill="none"
          stroke={INK}
          strokeWidth={stroke}
          strokeLinecap="round"
        />
      ) : (
        <path
          d={`M${cx - 6} ${mouthY - 2} Q${cx} ${mouthY + (mood === "party" ? 7 : 5)} ${cx + 6} ${mouthY - 2}`}
          fill="none"
          stroke={INK}
          strokeWidth={stroke * 1.15}
          strokeLinecap="round"
        />
      )}
    </g>
  );
}

function Sparkles() {
  return (
    <g fill={SPARKLE}>
      <path d="M40 60 L43 67 L50 70 L43 73 L40 80 L37 73 L30 70 L37 67 Z" />
      <path d="M164 44 L166 50 L172 52 L166 54 L164 60 L162 54 L156 52 L162 50 Z" />
      <path d="M158 92 L160 96 L164 98 L160 100 L158 104 L156 100 L152 98 L156 96 Z" />
    </g>
  );
}

/**
 * The sprout as a bare <g>, for dropping into a larger scene such as the
 * garden. Drawn around x=100 with the bean resting on the soil line at y=168.
 */
export function PlantBody({ stage = "sapling", vitality = "fair", leafTint }) {
  const geo = STAGES_GEO[stage] || STAGES_GEO.sapling;
  const mood = MOODS[vitality] || MOODS.fair;
  const leafFill = leafTint || mood.leaf;

  const stalk = geo.trunk || geo.stem;

  return (
    <g>
      {stalk ? (
        <path
          d={`M100 ${BEAN.cy} L100 ${stalk.to}`}
          stroke={geo.trunk ? "var(--soil)" : mood.stem}
          strokeWidth={stalk.width}
          strokeLinecap="round"
        />
      ) : null}

      {geo.canopy ? (
        <g>
          {geo.canopy.back.map((c, i) => (
            <circle key={`cb${i}`} cx={c.cx} cy={c.cy} r={c.r} fill="var(--leaf-dk)" opacity={mood.face === "sleepy" ? 0.55 : 1} />
          ))}
          {geo.canopy.front.map((c, i) => (
            <circle key={`cf${i}`} cx={c.cx} cy={c.cy} r={c.r} fill={leafFill} />
          ))}
          {/* One gloss on the crown, same trick as the leaflets. */}
          <ellipse cx="88" cy={geo.canopy.front[0].cy - 12} rx="16" ry="8" fill="#FFFFFF" opacity="0.22" />
        </g>
      ) : null}

      {geo.pairs.map((pair, i) => (
        <g key={`p${i}`}>
          <g transform="scale(-1,1) translate(-200,0)">
            <Leaflet x={100} y={pair.y} rx={pair.rx} ry={pair.ry} angle={pair.angle + mood.droop} fill={leafFill} />
          </g>
          <Leaflet x={100} y={pair.y} rx={pair.rx} ry={pair.ry} angle={pair.angle + mood.droop} fill={leafFill} />
        </g>
      ))}

      {(geo.flowers || []).map((f, i) => (
        <Flower key={`fl${i}`} {...f} />
      ))}

      {/* The bean last, so the stem tucks behind it, and it carries the face.
          `leafTint` deliberately does NOT apply here: the garden tints leaves
          to vary its plants, and letting that reach the bean turned every
          finished plant's face green. */}
      <ellipse cx={BEAN.cx} cy={BEAN.cy} rx={BEAN.rx} ry={BEAN.ry} fill={mood.bean} />
      <ellipse
        cx={BEAN.cx - 4}
        cy={BEAN.cy - BEAN.ry * 0.4}
        rx={BEAN.rx * 0.5}
        ry={BEAN.ry * 0.3}
        fill="#FFFFFF"
        opacity="0.35"
      />
      <Face mood={mood.face} />
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
      viewBox="18 28 164 156"
      className={className}
      role="img"
      aria-label={title || "豆苗"}
      style={{ display: "block", width: "100%", height: "auto" }}
    >
      {glow ? <circle cx="100" cy="108" r="70" fill="var(--glow)" opacity="0.55" /> : null}

      {ground ? (
        <>
          <ellipse cx="100" cy="174" rx="56" ry="12" fill="var(--soil-dk)" />
          <ellipse cx="100" cy="170" rx="56" ry="11" fill="var(--soil)" />
        </>
      ) : null}

      <PlantBody stage={stage} vitality={vitality} />

      {mood.face === "party" ? <Sparkles /> : null}
    </svg>
  );
}

export { STAGES_GEO, MOODS, BEAN };
