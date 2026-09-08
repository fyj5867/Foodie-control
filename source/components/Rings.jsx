/**
 * The three daily conditions, as concentric rings.
 *
 * Outer to inner: calorie control, exercise minutes, water. A ring fills to
 * its goal and stops there — overshooting 2000cc of water is not progress
 * worth drawing, and a ring that can exceed its own track stops being
 * readable at a glance.
 */

import React from "react";
import { WATER_GOAL_ML, EXERCISE_GOAL_MIN } from "../lib/goals.js";

const RINGS = [
  { key: "calorie", r: 74, color: "var(--cal)", label: "熱量控制" },
  { key: "exercise", r: 58, color: "var(--move)", label: "運動分鐘" },
  { key: "water", r: 42, color: "var(--water)", label: "喝水" },
];

const STROKE = 15;

function ratio(value, goal) {
  if (!goal || goal <= 0) return 0;
  return Math.max(0, Math.min(1, value / goal));
}

/**
 * Calorie control is the odd one out: it is a ceiling, not a target to
 * exceed. The ring fills as intake approaches the ceiling and reads as
 * complete when intake sits inside the acceptable band — so a nearly empty
 * ring means "barely eaten", not "doing well".
 */
function calorieRatio(consumed, target) {
  if (!target || target <= 0) return 0;
  return Math.max(0, Math.min(1, consumed / target));
}

export default function Rings({ day, size = 182 }) {
  const values = {
    calorie: calorieRatio(day?.calories || 0, day?.calorieTarget),
    exercise: ratio(day?.exerciseMin || 0, EXERCISE_GOAL_MIN),
    water: ratio(day?.waterMl || 0, WATER_GOAL_ML),
  };

  const met = [
    day?.calorie ? "熱量控制達標" : null,
    day?.exercise ? "運動達標" : null,
    day?.water ? "喝水達標" : null,
  ].filter(Boolean);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 180 180"
      role="img"
      aria-label={met.length ? `今天 ${met.join("、")}` : "今天三項都還沒達標"}
      style={{ display: "block" }}
    >
      <g transform="rotate(-90 90 90)" fill="none" strokeLinecap="round">
        {RINGS.map(({ key, r }) => (
          <circle key={`t${key}`} cx="90" cy="90" r={r} stroke="var(--surface-3)" strokeWidth={STROKE} />
        ))}
        {RINGS.map(({ key, r, color }) => {
          const c = 2 * Math.PI * r;
          const filled = c * values[key];
          return (
            <circle
              key={key}
              cx="90"
              cy="90"
              r={r}
              stroke={color}
              strokeWidth={STROKE}
              strokeDasharray={`${filled} ${c - filled + 1}`}
            />
          );
        })}
      </g>
    </svg>
  );
}

/** Row of value/goal lines that sits beside or under the rings. */
export function RingLegend({ day, compact = false }) {
  const rows = [
    {
      key: "calorie",
      color: "var(--cal)",
      label: "熱量",
      value: Math.round(day?.calories || 0).toLocaleString(),
      goal: day?.calorieTarget ? `/ ${day.calorieTarget.toLocaleString()} kcal` : "/ 尚未設定目標",
      met: day?.calorie,
    },
    {
      key: "exercise",
      color: "var(--move)",
      label: "運動",
      value: Math.round(day?.exerciseMin || 0),
      goal: `/ ${EXERCISE_GOAL_MIN} 分鐘`,
      met: day?.exercise,
    },
    {
      key: "water",
      color: "var(--water)",
      label: "喝水",
      value: Math.round(day?.waterMl || 0).toLocaleString(),
      goal: `/ ${WATER_GOAL_ML.toLocaleString()} cc`,
      met: day?.water,
    },
  ];

  return (
    <div className={`ring-legend ${compact ? "compact" : ""}`}>
      {rows.map((row) => (
        <div key={row.key} className={`ring-row ${row.met ? "met" : ""}`}>
          <span className="ring-dot" style={{ background: row.color }} />
          <span className="ring-k">{row.label}</span>
          <span className="ring-v">{row.value}</span>
          <span className="ring-g">{row.goal}</span>
          {row.met ? (
            <svg
              className="ring-check"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M5 12.5l4.5 4.5L19 7" />
            </svg>
          ) : null}
        </div>
      ))}
    </div>
  );
}
