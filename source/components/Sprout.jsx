/**
 * The plant.
 *
 * One leaf shape, placed repeatedly at different angles and scales, draws
 * every growth stage — so six stages and four vitality levels come out of one
 * set of geometry rather than twenty-four drawings. Vitality tilts the leaves
 * and shifts their colour; the stage decides how much plant there is.
 *
 * Vitality never makes the plant look dying: the worst state is drooping and
 * grey-green, not brown. A withered plant reads as failure, and this is an
 * app someone opens on the days that did not go well.
 */

import React from "react";

const LEAF_PATH = "M0 0 C -19 -7 -29 -28 -21 -48 C -2 -40 6 -19 0 0 Z";
const LEAF_VEIN = "M-1 -2 C -7 -14 -13 -28 -18 -41";

/** Degrees added to every leaf angle, and which green to use. */
const VITALITY_STYLE = {
  wilting: { droop: 34, leaf: "var(--leaf-dull)", stem: "var(--stem-dull)", dew: false },
  low: { droop: 16, leaf: "var(--leaf)", stem: "var(--stem)", dew: false },
  fair: { droop: 4, leaf: "var(--leaf)", stem: "var(--stem)", dew: false },
  thriving: { droop: -8, leaf: "var(--leaf-bright)", stem: "var(--stem)", dew: true },
};

/**
 * Per-stage geometry, all in one 200x190 space with the soil line at y=163.
 * `back` leaves are drawn behind the stem in the darker green, which is what
 * stops the fuller stages reading as a flat cut-out.
 */
const STAGE_GEOMETRY = {
  seed: {
    stem: null,
    branches: [],
    back: [],
    leaves: [],
    seed: true,
  },
  sprout: {
    stem: "M100 158 L100 136",
    stemWidth: 5,
    branches: [],
    back: [],
    leaves: [
      { x: 98, y: 138, rot: -16, s: 0.42 },
      { x: 102, y: 138, rot: -16, s: 0.42, mirror: true },
    ],
  },
  seedling: {
    stem: "M100 158 C100 142 98 128 100 116",
    stemWidth: 5.5,
    branches: [],
    back: [],
    leaves: [
      { x: 98, y: 118, rot: -16, s: 0.55 },
      { x: 102, y: 118, rot: -16, s: 0.55, mirror: true },
      { x: 97, y: 142, rot: -40, s: 0.36 },
      { x: 103, y: 142, rot: -40, s: 0.36, mirror: true },
    ],
  },
  sapling: {
    stem: "M100 158 C100 138 97 118 100 100",
    stemWidth: 5.8,
    branches: [
      { d: "M100 126 C92 121 85 115 79 108", w: 4.2 },
      { d: "M100 112 C108 107 115 101 121 94", w: 4.2 },
    ],
    back: [
      { x: 93, y: 124, rot: -34, s: 0.46 },
      { x: 107, y: 120, rot: -34, s: 0.46, mirror: true },
    ],
    leaves: [
      { x: 79, y: 108, rot: -20, s: 0.54 },
      { x: 121, y: 94, rot: -20, s: 0.54, mirror: true },
      { x: 98, y: 102, rot: -6, s: 0.6 },
      { x: 103, y: 103, rot: -6, s: 0.6, mirror: true },
    ],
  },
  tree: {
    stem: "M100 158 C100 132 96 106 100 80",
    stemWidth: 6.4,
    branches: [
      { d: "M100 120 C90 113 81 105 74 96", w: 4.6 },
      { d: "M100 104 C110 98 119 90 126 81", w: 4.6 },
      { d: "M100 136 C93 132 87 127 82 121", w: 3.8 },
    ],
    back: [
      { x: 88, y: 110, rot: -40, s: 0.56 },
      { x: 112, y: 104, rot: -40, s: 0.56, mirror: true },
      { x: 96, y: 84, rot: -16, s: 0.5 },
    ],
    leaves: [
      { x: 74, y: 96, rot: -22, s: 0.6 },
      { x: 126, y: 81, rot: -22, s: 0.6, mirror: true },
      { x: 82, y: 121, rot: -34, s: 0.46 },
      { x: 98, y: 82, rot: -6, s: 0.66 },
      { x: 103, y: 83, rot: -6, s: 0.66, mirror: true },
    ],
  },
  bloom: {
    stem: "M100 158 C100 130 95 102 100 74",
    stemWidth: 6.6,
    branches: [
      { d: "M100 116 C89 109 79 100 72 90", w: 4.8 },
      { d: "M100 100 C111 93 121 85 128 75", w: 4.8 },
      { d: "M100 134 C92 129 85 124 80 117", w: 4 },
    ],
    back: [
      { x: 86, y: 106, rot: -42, s: 0.6 },
      { x: 114, y: 100, rot: -42, s: 0.6, mirror: true },
      { x: 95, y: 78, rot: -16, s: 0.54 },
    ],
    leaves: [
      { x: 72, y: 90, rot: -24, s: 0.62 },
      { x: 128, y: 75, rot: -24, s: 0.62, mirror: true },
      { x: 80, y: 117, rot: -36, s: 0.48 },
      { x: 98, y: 76, rot: -6, s: 0.68 },
      { x: 103, y: 77, rot: -6, s: 0.68, mirror: true },
    ],
    blooms: [
      { x: 72, y: 72, s: 0.95 },
      { x: 129, y: 58, s: 0.85 },
      { x: 101, y: 46, s: 1 },
    ],
  },
};

function leafTransform({ x, y, rot, s, mirror }, droop) {
  const angle = rot + droop;
  return mirror
    ? `translate(${x},${y}) scale(${-s},${s}) rotate(${angle})`
    : `translate(${x},${y}) rotate(${angle}) scale(${s})`;
}

function Leaf({ spec, droop, fill, vein }) {
  return (
    <g transform={leafTransform(spec, droop)}>
      <path d={LEAF_PATH} fill={fill} />
      <path d={LEAF_VEIN} stroke={vein} strokeWidth="1.8" fill="none" opacity="0.38" strokeLinecap="round" />
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
 * The plant itself, as a bare <g> so it can be dropped into a larger scene.
 *
 * Drawn around x=100 with its base on y=158, matching the standalone
 * viewBox — the garden positions a plant by translating that base point.
 *
 * @param stage    one of the STAGES keys from lib/goals.js
 * @param vitality one of the VITALITY keys — how today went
 * @param leafTint overrides the leaf green, so a row of finished trees can
 *                 vary slightly instead of looking stamped from one mould
 */
export function PlantBody({ stage = "sapling", vitality = "fair", leafTint }) {
  const geo = STAGE_GEOMETRY[stage] || STAGE_GEOMETRY.sapling;
  const look = VITALITY_STYLE[vitality] || VITALITY_STYLE.fair;
  const droop = look.droop;
  const leafFill = leafTint || look.leaf;

  return (
    <g>
      {geo.seed ? (
        <>
          <ellipse cx="100" cy="152" rx="11" ry="8.5" fill="var(--soil-dk)" />
          <ellipse cx="97" cy="149" rx="4" ry="3" fill="var(--soil)" opacity="0.55" />
        </>
      ) : null}

      {geo.back.map((spec, i) => (
        <Leaf key={`b${i}`} spec={spec} droop={droop} fill="var(--leaf-dk)" vein="var(--soil-dk)" />
      ))}

      {geo.stem ? (
        <path
          d={geo.stem}
          stroke={look.stem}
          strokeWidth={geo.stemWidth}
          strokeLinecap="round"
          fill="none"
        />
      ) : null}

      {geo.branches.map((b, i) => (
        <path key={`br${i}`} d={b.d} stroke={look.stem} strokeWidth={b.w} strokeLinecap="round" fill="none" />
      ))}

      {geo.leaves.map((spec, i) => (
        <Leaf key={`l${i}`} spec={spec} droop={droop} fill={leafFill} vein="var(--leaf-dk)" />
      ))}

      {(geo.blooms || []).map((b, i) => (
        <Bloom key={`f${i}`} {...b} />
      ))}

      {look.dew && geo.leaves.length ? (
        <>
          <circle cx="86" cy="76" r="3.2" fill="#FFFFFF" opacity="0.85" />
          <circle cx="116" cy="66" r="2.6" fill="#FFFFFF" opacity="0.8" />
          <circle cx="95" cy="56" r="2.2" fill="#FFFFFF" opacity="0.7" />
        </>
      ) : null}
    </g>
  );
}

/**
 * A single plant on its own patch of soil — the main screen's centrepiece.
 *
 * @param ground draw the soil mound
 * @param glow   warm light behind, used at the best state
 */
export default function Sprout({
  stage = "sapling",
  vitality = "fair",
  ground = true,
  glow = false,
  title,
  className,
}) {
  return (
    <svg
      // Cropped in from the 200x190 drawing space so the plant fills the
      // frame instead of floating in it — the earlier full-box view left a
      // third of the height empty above the leaves.
      viewBox="26 30 148 152"
      className={className}
      role="img"
      aria-label={title || "樹苗"}
      style={{ display: "block", width: "100%", height: "auto" }}
    >
      {glow ? <circle cx="132" cy="60" r="40" fill="var(--glow)" opacity="0.5" /> : null}

      {ground ? (
        <>
          <ellipse cx="100" cy="168" rx="54" ry="13" fill="var(--soil-dk)" />
          <ellipse cx="100" cy="164" rx="54" ry="12" fill="var(--soil)" />
        </>
      ) : null}

      <PlantBody stage={stage} vitality={vitality} />
    </svg>
  );
}

export { STAGE_GEOMETRY, VITALITY_STYLE };
