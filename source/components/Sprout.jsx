/**
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
  seed: { cx: 48, eyeY: 79.4, eyeDx: 8.5, mouthY: 85.4, blushY: 81.9, blushDx: 14.5 },
  sprout: { cx: 48, eyeY: 79, eyeDx: 8.5, mouthY: 84.8, blushY: 81.5, blushDx: 14.5 },
  shoot: { cx: 48, eyeY: 79, eyeDx: 8.5, mouthY: 84.8, blushY: 81.5, blushDx: 14.5 },
  seedling: { cx: 48, eyeY: 79, eyeDx: 8.5, mouthY: 84.2, blushY: 81.5, blushDx: 14.5 },
  growing: { cx: 48, eyeY: 79, eyeDx: 8.5, mouthY: 84.2, blushY: 81.5, blushDx: 14.5 },
  mature: { cx: 48, eyeY: 80.4, eyeDx: 8.5, mouthY: 83.6, blushY: 82, blushDx: 15 },
  ready: { cx: 48, eyeY: 80.4, eyeDx: 8.5, mouthY: 83.6, blushY: 82.9, blushDx: 14.5 },
  forest: { cx: 48.5, eyeY: 24, eyeDx: 6.5, mouthY: 31.6, blushY: 30, blushDx: 13.75 },
};

/** Where each stage meets the ground, for standing it on a spot in a scene. */
const GROUND_Y = {
  seed: 91,
  sprout: 91,
  shoot: 91,
  seedling: 91,
  growing: 91,
  mature: 91,
  ready: 91,
  forest: 88,
};

/** Stages whose artwork already includes sparkles of its own. */
const OWN_SPARKLES = ["ready", "forest"];

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
          <path d={`M${cx - eyeDx - 3.5} ${eyeY}c1.6-2.4 5.4-2.4 7 0`} />
          <path d={`M${cx + eyeDx - 3.5} ${eyeY}c1.6-2.4 5.4-2.4 7 0`} />
        </g>
        <path
          d={`M${cx - 2.5} ${mouthY}c0.9 1.4 4.2 1.4 5.1 0`}
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
          d={`M${cx - 3.6} ${mouthY} h7.2`}
          stroke={INK}
          strokeWidth="2.9"
          strokeLinecap="round"
          fill="none"
        />
      ) : (
        <path
          d={`M${cx - 3.9} ${mouthY}c1.5 ${mood === "thriving" ? 3.1 : 2.1} 6.2 ${
            mood === "thriving" ? 3.1 : 2.1
          } 7.7 0`}
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
    `M${x} ${y - 5 * s}L${x + 1.5 * s} ${y - 1.5 * s}L${x + 5 * s} ${y}L${x + 1.5 * s} ${y + 1.5 * s}L${x} ${
      y + 5 * s
    }L${x - 1.5 * s} ${y + 1.5 * s}L${x - 5 * s} ${y}L${x - 1.5 * s} ${y - 1.5 * s}Z`;
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
  /* 種子 */
  seed: (
    <>
      <path d="M24 70h48l-5.2 16.4a7 7 0 0 1-6.7 4.6H35.9a7 7 0 0 1-6.7-4.6z" fill="#E3A063" stroke="#3A4C3A" strokeWidth="4.5" strokeLinejoin="round"/>
      <path d="M25 58c3-5 11-8 23-8s20 3 23 8z" fill="#8A6A4E" stroke="#3A4C3A" strokeWidth="4" strokeLinejoin="round"/>
      <g transform="translate(48,38) rotate(14)">
      <ellipse cx="0" cy="0" rx="9.2" ry="11.4" fill="#D9AE74" stroke="#3A4C3A" strokeWidth="4"/>
      <path d="M-2-5.8c-2.8 3.8-2.8 7.8 0 11.6" stroke="#3A4C3A" strokeWidth="2.4" strokeLinecap="round" opacity="0.5"/>
      </g>
      <rect x="19" y="57.5" width="58" height="13.5" rx="6" fill="#EFB278" stroke="#3A4C3A" strokeWidth="4.5"/>
    </>
  ),
  /* 發芽 */
  sprout: (
    <>
      <path d="M24 70h48l-5.2 16.4a7 7 0 0 1-6.7 4.6H35.9a7 7 0 0 1-6.7-4.6z" fill="#E3A063" stroke="#3A4C3A" strokeWidth="4.5" strokeLinejoin="round"/>
      <path d="M25 58c3-5 11-8 23-8s20 3 23 8z" fill="#8A6A4E" stroke="#3A4C3A" strokeWidth="4" strokeLinejoin="round"/>
      <path d="M48 56V46" stroke="#5D9E55" strokeWidth="5" strokeLinecap="round"/>
      <g stroke="#3A4C3A" strokeWidth="5.4" strokeLinejoin="round">
      <g transform="translate(48,48) rotate(14) scale(0.56)"><path d="M0 0C0-9 6-17 15-21 14-10 9-3 0 0Z" fill="#8CCB68"/></g>
      <g transform="translate(48,48) scale(-0.56,0.56) rotate(14)"><path d="M0 0C0-9 6-17 15-21 14-10 9-3 0 0Z" fill="#8CCB68"/></g>
      </g>
      <rect x="19" y="57.5" width="58" height="13.5" rx="6" fill="#EFB278" stroke="#3A4C3A" strokeWidth="4.5"/>
    </>
  ),
  /* 幼芽 */
  shoot: (
    <>
      <path d="M24 70h48l-5.2 16.4a7 7 0 0 1-6.7 4.6H35.9a7 7 0 0 1-6.7-4.6z" fill="#E3A063" stroke="#3A4C3A" strokeWidth="4.5" strokeLinejoin="round"/>
      <path d="M48 62V38" stroke="#5D9E55" strokeWidth="5.4" strokeLinecap="round"/>
      <g stroke="#3A4C3A" strokeWidth="4.6" strokeLinejoin="round">
      <g transform="translate(48,52) rotate(10) scale(0.78)"><path d="M0 0C0-9 6-17 15-21 14-10 9-3 0 0Z" fill="#5D9E55"/></g>
      <g transform="translate(48,52) scale(-0.78,0.78) rotate(10)"><path d="M0 0C0-9 6-17 15-21 14-10 9-3 0 0Z" fill="#8CCB68"/></g>
      </g>
      <rect x="19" y="57.5" width="58" height="13.5" rx="6" fill="#EFB278" stroke="#3A4C3A" strokeWidth="4.5"/>
    </>
  ),
  /* 小苗 */
  seedling: (
    <>
      <path d="M24 70h48l-5.2 16.4a7 7 0 0 1-6.7 4.6H35.9a7 7 0 0 1-6.7-4.6z" fill="#E3A063" stroke="#3A4C3A" strokeWidth="4.5" strokeLinejoin="round"/>
      <path d="M48 62V30" stroke="#5D9E55" strokeWidth="5.6" strokeLinecap="round"/>
      <g stroke="#3A4C3A" strokeWidth="4.4" strokeLinejoin="round">
      <g transform="translate(48,55) rotate(12) scale(0.86)"><path d="M0 0C0-9 6-17 15-21 14-10 9-3 0 0Z" fill="#3F7043"/></g>
      <g transform="translate(48,55) scale(-0.86,0.86) rotate(12)"><path d="M0 0C0-9 6-17 15-21 14-10 9-3 0 0Z" fill="#3F7043"/></g>
      <g transform="translate(48,42) rotate(-4) scale(0.74)"><path d="M0 0C0-9 6-17 15-21 14-10 9-3 0 0Z" fill="#5D9E55"/></g>
      <g transform="translate(48,42) scale(-0.74,0.74) rotate(-4)"><path d="M0 0C0-9 6-17 15-21 14-10 9-3 0 0Z" fill="#8CCB68"/></g>
      </g>
      <rect x="19" y="57.5" width="58" height="13.5" rx="6" fill="#EFB278" stroke="#3A4C3A" strokeWidth="4.5"/>
    </>
  ),
  /* 成長 */
  growing: (
    <>
      <path d="M24 70h48l-5.2 16.4a7 7 0 0 1-6.7 4.6H35.9a7 7 0 0 1-6.7-4.6z" fill="#E3A063" stroke="#3A4C3A" strokeWidth="4.5" strokeLinejoin="round"/>
      <path d="M48 62V18" stroke="#5D9E55" strokeWidth="6" strokeLinecap="round"/>
      <g stroke="#3A4C3A" strokeWidth="4.4" strokeLinejoin="round">
      <g transform="translate(48,56) rotate(16) scale(0.94)"><path d="M0 0C0-9 6-17 15-21 14-10 9-3 0 0Z" fill="#3F7043"/></g>
      <g transform="translate(48,56) scale(-0.94,0.94) rotate(16)"><path d="M0 0C0-9 6-17 15-21 14-10 9-3 0 0Z" fill="#3F7043"/></g>
      <g transform="translate(48,43) rotate(0) scale(0.82)"><path d="M0 0C0-9 6-17 15-21 14-10 9-3 0 0Z" fill="#5D9E55"/></g>
      <g transform="translate(48,43) scale(-0.82,0.82) rotate(0)"><path d="M0 0C0-9 6-17 15-21 14-10 9-3 0 0Z" fill="#5D9E55"/></g>
      <g transform="translate(48,30) rotate(-14) scale(0.7)"><path d="M0 0C0-9 6-17 15-21 14-10 9-3 0 0Z" fill="#8CCB68"/></g>
      <g transform="translate(48,30) scale(-0.7,0.7) rotate(-14)"><path d="M0 0C0-9 6-17 15-21 14-10 9-3 0 0Z" fill="#8CCB68"/></g>
      </g>
      <rect x="19" y="57.5" width="58" height="13.5" rx="6" fill="#EFB278" stroke="#3A4C3A" strokeWidth="4.5"/>
    </>
  ),
  /* 成熟 */
  mature: (
    <>
      <path d="M24 70h48l-5.2 16.4a7 7 0 0 1-6.7 4.6H35.9a7 7 0 0 1-6.7-4.6z" fill="#E3A063" stroke="#3A4C3A" strokeWidth="4.5" strokeLinejoin="round"/>
      <path d="M48 62V26" stroke="#5D9E55" strokeWidth="6" strokeLinecap="round"/>
      <g stroke="#3A4C3A" strokeWidth="4.4" strokeLinejoin="round">
      <g transform="translate(48,56) rotate(16) scale(0.92)"><path d="M0 0C0-9 6-17 15-21 14-10 9-3 0 0Z" fill="#3F7043"/></g>
      <g transform="translate(48,56) scale(-0.92,0.92) rotate(16)"><path d="M0 0C0-9 6-17 15-21 14-10 9-3 0 0Z" fill="#3F7043"/></g>
      <g transform="translate(48,44) rotate(-2) scale(0.78)"><path d="M0 0C0-9 6-17 15-21 14-10 9-3 0 0Z" fill="#5D9E55"/></g>
      <g transform="translate(48,44) scale(-0.78,0.78) rotate(-2)"><path d="M0 0C0-9 6-17 15-21 14-10 9-3 0 0Z" fill="#5D9E55"/></g>
      </g>
      <g transform="translate(48,20)">
      <g fill="#F4A6B7" stroke="#3A4C3A" strokeWidth="4.2" strokeLinejoin="round">
      <ellipse cx="0" cy="-10.5" rx="6.4" ry="8.2"/>
      <ellipse cx="0" cy="-10.5" rx="6.4" ry="8.2" transform="rotate(72)"/>
      <ellipse cx="0" cy="-10.5" rx="6.4" ry="8.2" transform="rotate(144)"/>
      <ellipse cx="0" cy="-10.5" rx="6.4" ry="8.2" transform="rotate(216)"/>
      <ellipse cx="0" cy="-10.5" rx="6.4" ry="8.2" transform="rotate(288)"/>
      </g>
      <circle cx="0" cy="0" r="6.2" fill="#F2C55C" stroke="#3A4C3A" strokeWidth="4.2"/>
      </g>
      <rect x="19" y="57.5" width="58" height="13.5" rx="6" fill="#EFB278" stroke="#3A4C3A" strokeWidth="4.5"/>
    </>
  ),
  /* 破土 */
  ready: (
    <>
      <path d="M24 70h48l-5.2 16.4a7 7 0 0 1-6.7 4.6H35.9a7 7 0 0 1-6.7-4.6z" fill="#E3A063" stroke="#3A4C3A" strokeWidth="4.5" strokeLinejoin="round"/>
      <path d="M48 62V22" stroke="#5D9E55" strokeWidth="6" strokeLinecap="round"/>
      <g stroke="#3A4C3A" strokeWidth="4.4" strokeLinejoin="round">
      <g transform="translate(48,54) rotate(20) scale(0.9)"><path d="M0 0C0-9 6-17 15-21 14-10 9-3 0 0Z" fill="#3F7043"/></g>
      <g transform="translate(48,54) scale(-0.9,0.9) rotate(20)"><path d="M0 0C0-9 6-17 15-21 14-10 9-3 0 0Z" fill="#3F7043"/></g>
      <g transform="translate(48,38) rotate(-6) scale(0.8)"><path d="M0 0C0-9 6-17 15-21 14-10 9-3 0 0Z" fill="#5D9E55"/></g>
      <g transform="translate(48,38) scale(-0.8,0.8) rotate(-6)"><path d="M0 0C0-9 6-17 15-21 14-10 9-3 0 0Z" fill="#5D9E55"/></g>
      <g transform="translate(48,24) rotate(-34) scale(0.62)"><path d="M0 0C0-9 6-17 15-21 14-10 9-3 0 0Z" fill="#8CCB68"/></g>
      </g>
      <g stroke="#F2C55C" strokeWidth="3.4" strokeLinecap="round"><path d="M80 30v6.6"/><path d="M76.7 33.3h6.6"/><path d="M14 44v6"/><path d="M11 47h6"/></g>
      <rect x="19" y="57.5" width="58" height="13.5" rx="6" fill="#EFB278" stroke="#3A4C3A" strokeWidth="4.5"/>
      <g stroke="#3A4C3A" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" fill="none">
      <path d="M31 72l3.6 5.4-3.6 4.6 2.6 5"/>
      <path d="M66 72l-3.4 5.6 3.4 4.4-2.4 5"/>
      </g>
      <g stroke="#A9764C" strokeWidth="4.2" strokeLinecap="round" fill="none">
      <path d="M39 91c-3.6 2.6-5.4 4.6-5.6 7"/>
      <path d="M57 91c3.6 2.6 5.4 4.6 5.6 7"/>
      </g>
    </>
  ),
  /* 森林之樹 */
  forest: (
    <>
      <path d="M8 88c7-10 20-15 40-15s33 5 40 15z" fill="#8CCB68" stroke="#3A4C3A" strokeWidth="4.6" strokeLinejoin="round"/>
      <path d="M48 78V50" stroke="#A9764C" strokeWidth="10" strokeLinecap="round"/>
      <path d="M48 62l-9-8" stroke="#A9764C" strokeWidth="6" strokeLinecap="round"/>
      <g fill="#5D9E55" stroke="#3A4C3A" strokeWidth="4.6">
      <circle cx="30" cy="40" r="16"/><circle cx="66" cy="40" r="16"/><circle cx="48" cy="24" r="19"/>
      </g>
      <g stroke="#F2C55C" strokeWidth="3.4" strokeLinecap="round"><path d="M82 16v6.6"/><path d="M78.7 19.3h6.6"/><path d="M13 26v5.6"/><path d="M10.2 28.8h5.6"/></g>
    </>
  ),
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
