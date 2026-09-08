/**
 * A small character for each of the three daily conditions.
 *
 * A bowl, a shoe and a drop — each with the same face the water mascot and
 * the sprout use, so the whole app looks like it was drawn by one hand. The
 * face is the state: dot eyes and a flat mouth while the condition is open,
 * smiling eyes with blush and a sparkle once it is met. A plain tick told you
 * the same thing without any of the reward.
 *
 * Each icon keeps its condition's hue so it reads as belonging to that ring,
 * but at a lighter value than the ring itself — see the note on the body
 * colours below.
 */

import React from "react";

const INK = "#1E2A22";
const CHEEK = "#F6A6A6";
const SPARKLE = "#FFC94A";

/*
 * Character bodies are lighter than the ring tokens they belong to.
 *
 * The tokens are chart colours, chosen to read as lines against a pale card;
 * the ink face laid on top of them disappeared, most of all on --move, which
 * is nearly the same value as the ink. These are the same hues opened up
 * until the face reads — the same reason the water mascot's fill is a light
 * blue rather than its stroke colour.
 */
const BOWL_BODY = "#E58A80";
const SHOE_BODY = "#79AE93";
const SHOE_SOLE = "#3E7B62";
const DROP_BODY = "#6FB6E0";

/**
 * The shared face, positioned per icon.
 *
 * @param cx,cy centre of the face
 * @param met   met conditions get smiling eyes, blush and a lifted mouth
 * @param scale shrinks the features on the smaller shapes
 */
function Face({ cx, cy, met, scale = 1 }) {
  const r = 1.9 * scale;
  const dx = 4.2 * scale;
  const mouthY = cy + 4 * scale;
  const stroke = 1.5 * scale;

  return (
    <g>
      {met ? (
        <>
          <circle cx={cx - dx - 2.6 * scale} cy={cy + 1.6 * scale} r={2.2 * scale} fill={CHEEK} opacity="0.85" />
          <circle cx={cx + dx + 2.6 * scale} cy={cy + 1.6 * scale} r={2.2 * scale} fill={CHEEK} opacity="0.85" />
          <path
            d={`M${cx - dx - r} ${cy} Q${cx - dx} ${cy - r * 1.8} ${cx - dx + r} ${cy}`}
            fill="none"
            stroke={INK}
            strokeWidth={stroke}
            strokeLinecap="round"
          />
          <path
            d={`M${cx + dx - r} ${cy} Q${cx + dx} ${cy - r * 1.8} ${cx + dx + r} ${cy}`}
            fill="none"
            stroke={INK}
            strokeWidth={stroke}
            strokeLinecap="round"
          />
          <path
            d={`M${cx - 2.6 * scale} ${mouthY - 1 * scale} Q${cx} ${mouthY + 2.4 * scale} ${cx + 2.6 * scale} ${
              mouthY - 1 * scale
            }`}
            fill="none"
            stroke={INK}
            strokeWidth={stroke * 1.15}
            strokeLinecap="round"
          />
        </>
      ) : (
        <>
          <circle cx={cx - dx} cy={cy} r={r} fill={INK} />
          <circle cx={cx + dx} cy={cy} r={r} fill={INK} />
          <path
            d={`M${cx - 2.4 * scale} ${mouthY} L${cx + 2.4 * scale} ${mouthY}`}
            fill="none"
            stroke={INK}
            strokeWidth={stroke}
            strokeLinecap="round"
          />
        </>
      )}
    </g>
  );
}

function Sparkle({ x, y, s = 1 }) {
  return (
    <path
      d={`M${x} ${y - 4 * s} L${x + 1.2 * s} ${y - 1.2 * s} L${x + 4 * s} ${y} L${x + 1.2 * s} ${y + 1.2 * s} L${x} ${
        y + 4 * s
      } L${x - 1.2 * s} ${y + 1.2 * s} L${x - 4 * s} ${y} L${x - 1.2 * s} ${y - 1.2 * s} Z`}
      fill={SPARKLE}
    />
  );
}

function Wrap({ label, children }) {
  return (
    <svg viewBox="0 0 44 44" width="34" height="34" role="img" aria-label={label} style={{ display: "block" }}>
      {children}
    </svg>
  );
}

/** A bowl of food, for the calorie condition. */
export function BowlIcon({ met }) {
  return (
    <Wrap label={met ? "熱量控制已達標" : "熱量控制"}>
      {met ? <Sparkle x={37} y={9} s={1.1} /> : null}
      {/* What's in the bowl, peeking over the rim. */}
      <ellipse cx="22" cy="21" rx="13" ry="6.5" fill="#EFE2AC" />
      <ellipse cx="18" cy="19.5" rx="4" ry="2" fill="#FFFFFF" opacity="0.5" />
      <path d="M7 21 L37 21 Q37 36 22 36 Q7 36 7 21 Z" fill={BOWL_BODY} />
      <path d="M5 20.5 L39 20.5" stroke={BOWL_BODY} strokeWidth="3.4" strokeLinecap="round" />
      <Face cx={22} cy={27} met={met} scale={0.95} />
    </Wrap>
  );
}

/** A trainer, for the exercise condition. */
export function ShoeIcon({ met }) {
  return (
    <Wrap label={met ? "運動已達標" : "運動"}>
      {met ? <Sparkle x={37} y={10} s={1.1} /> : null}
      <path
        d="M7 20 Q7 11 15 11 Q22 11 26 17 L34 22 Q38 24 38 28 L38 30 Q38 32 36 32 L9 32 Q7 32 7 30 Z"
        fill={SHOE_BODY}
      />
      {/* Sole, so it reads as a shoe rather than a blob. */}
      <path d="M6 31 L38 31 Q40 31 40 33.5 Q40 36 37.5 36 L8.5 36 Q6 36 6 33.5 Z" fill={SHOE_SOLE} />
      <path d="M14 13 Q19 13 23 18" stroke="#FFFFFF" strokeWidth="1.8" fill="none" opacity="0.45" strokeLinecap="round" />
      <Face cx={19} cy={22} met={met} scale={0.92} />
    </Wrap>
  );
}

/** A drop, for the water condition — the same character as the big mascot. */
export function DropIcon({ met }) {
  return (
    <Wrap label={met ? "喝水已達標" : "喝水"}>
      {met ? <Sparkle x={37} y={11} s={1.1} /> : null}
      <path d="M22 5 Q33 20 33 26 A11 11 0 1 1 11 26 Q11 20 22 5 Z" fill={DROP_BODY} />
      <ellipse cx="16" cy="20" rx="3.4" ry="5" fill="#FFFFFF" opacity="0.3" transform="rotate(-18 16 20)" />
      <Face cx={22} cy={26} met={met} scale={1} />
    </Wrap>
  );
}

/** Look up by condition key, so callers stay data-driven. */
export const GOAL_ICONS = {
  calorie: BowlIcon,
  exercise: ShoeIcon,
  water: DropIcon,
};

export default GOAL_ICONS;
