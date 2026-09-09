/**
 * A small character for each kind of exercise.
 *
 * The weekly plan used to be a four-column table of text. A table is the
 * right shape for data you compare and the wrong shape for a week you are
 * meant to want to do, so it became seven rows with a character on each —
 * and these are those characters.
 *
 * Same hand as the bowl, shoe and drop in GoalIcons.jsx: one ink face, round
 * dot eyes, blush and a sparkle once a thing is done. The body colours are
 * opened-up versions of the app's greens for the same reason the others are —
 * an ink face laid on a chart-strength colour disappears.
 *
 * Three categories, matching ACTIVITY_LOG_OPTIONS: 有氧, 阻力, 柔軟度.
 */

import React from "react";

const INK = "#1E2A22";
const CHEEK = "#F6A6A6";
const SPARKLE = "#FFC94A";

const AEROBIC_BODY = "#79AE93";
const AEROBIC_DARK = "#3E7B62";
const RESIST_BODY = "#8FA6C4";
const RESIST_DARK = "#5A7796";
const FLEX_BODY = "#C7B0DA";
const FLEX_DARK = "#9578B0";

/** The shared face. `done` is the only state — same rule as the other icons. */
function Face({ cx, cy, done, scale = 1 }) {
  const r = 1.9 * scale;
  const dx = 4.2 * scale;
  const mouthY = cy + 4 * scale;
  const stroke = 1.5 * scale;

  return (
    <g>
      {done ? (
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
            d={`M${cx - 3 * scale} ${mouthY - 0.6 * scale} Q${cx} ${mouthY + 2.6 * scale} ${cx + 3 * scale} ${
              mouthY - 0.6 * scale
            }`}
            fill="none"
            stroke={INK}
            strokeWidth={stroke}
            strokeLinecap="round"
          />
        </>
      ) : (
        <>
          <circle cx={cx - dx} cy={cy} r={r} fill={INK} />
          <circle cx={cx + dx} cy={cy} r={r} fill={INK} />
          <path
            d={`M${cx - 2.6 * scale} ${mouthY} h${5.2 * scale}`}
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
      d={`M${x} ${y - 4 * s}L${x + 1.2 * s} ${y - 1.2 * s}L${x + 4 * s} ${y}L${x + 1.2 * s} ${y + 1.2 * s}L${x} ${
        y + 4 * s
      }L${x - 1.2 * s} ${y + 1.2 * s}L${x - 4 * s} ${y}L${x - 1.2 * s} ${y - 1.2 * s}Z`}
      fill={SPARKLE}
    />
  );
}

/** 有氧 — a shoe, mid-stride. */
export function AerobicIcon({ done = false, size = 30 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <path
        d="M6 27c0-4 1.5-7 4-8.5l3-1.8c1.4-.8 2-2 2.2-3.5l.4-2.6c.2-1.4 1.6-2.2 2.8-1.6 3.8 1.9 5.6 4.6 6.4 7.4l7 2.4c2.4.8 3.8 2.7 3.8 5V27z"
        fill={AEROBIC_BODY}
        stroke={INK}
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
      <path d="M6 27h29.6v2.6a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z" fill={AEROBIC_DARK} stroke={INK} strokeWidth="1.9" strokeLinejoin="round" />
      <Face cx={22} cy={21} done={done} scale={0.95} />
      {done ? <Sparkle x={33} y={12} s={1} /> : null}
    </svg>
  );
}

/** 阻力 — a dumbbell. */
export function ResistanceIcon({ done = false, size = 30 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <rect x="14" y="15.5" width="12" height="9" rx="2.4" fill={RESIST_BODY} stroke={INK} strokeWidth="1.9" />
      <rect x="5" y="11" width="8" height="18" rx="3" fill={RESIST_DARK} stroke={INK} strokeWidth="1.9" />
      <rect x="27" y="11" width="8" height="18" rx="3" fill={RESIST_DARK} stroke={INK} strokeWidth="1.9" />
      <Face cx={20} cy={19.4} done={done} scale={0.72} />
      {done ? <Sparkle x={34} y={7} s={0.95} /> : null}
    </svg>
  );
}

/** 柔軟度 — a rolled mat, seen end on. */
export function FlexibilityIcon({ done = false, size = 30 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <rect x="6" y="12" width="28" height="16" rx="8" fill={FLEX_BODY} stroke={INK} strokeWidth="1.9" />
      <path d="M28 12a8 8 0 0 1 0 16" fill={FLEX_DARK} stroke={INK} strokeWidth="1.9" strokeLinejoin="round" />
      <Face cx={17} cy={19} done={done} scale={0.9} />
      {done ? <Sparkle x={35} y={9} s={0.95} /> : null}
    </svg>
  );
}

export const EXERCISE_ICONS = {
  aerobic: AerobicIcon,
  resistance: ResistanceIcon,
  flexibility: FlexibilityIcon,
};

export const CATEGORY_LABEL = { aerobic: "有氧", resistance: "阻力", flexibility: "柔軟度" };
