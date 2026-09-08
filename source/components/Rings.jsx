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
import { GOAL_ICONS } from "./GoalIcons.jsx";

/* Radii are spaced wider than the stroke so a clear gap separates the rings.
 * At 15px stroke on 74/58/42 they were a pixel apart and read as one solid
 * disc on a phone. */
const RINGS = [
  { key: "calorie", r: 72, color: "var(--cal)", label: "熱量控制" },
  { key: "exercise", r: 53, color: "var(--move)", label: "運動分鐘" },
  { key: "water", r: 34, color: "var(--water)", label: "喝水" },
];

const STROKE = 14;

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

/**
 * What is still missing on this condition, phrased as something to act on.
 *
 * This used to live in a separate run-on sentence above the numbers, which
 * meant the most actionable text on the screen was also the smallest, and the
 * same fact was stated twice. Putting it on the row it belongs to removes the
 * duplication and lets each line be read on its own.
 */
function shortfall(key, day) {
  if (key === "calorie") {
    // Say which of the two would unblock it, not just that it is missing.
    if (!day?.calorieTarget) return "需要年齡或基礎代謝率";
    const consumed = Math.round(day.calories || 0);
    if (consumed > day.calorieTarget) return `超過 ${(consumed - day.calorieTarget).toLocaleString()}`;
    return "還沒記錄完";
  }
  if (key === "exercise") {
    return `還差 ${Math.max(0, EXERCISE_GOAL_MIN - Math.round(day?.exerciseMin || 0))} 分鐘`;
  }
  return `還差 ${Math.max(0, WATER_GOAL_ML - Math.round(day?.waterMl || 0)).toLocaleString()} cc`;
}

/**
 * The three metrics in the shape Apple Fitness uses: label in the metric's
 * own colour, the achieved figure large in that colour, the goal small
 * underneath.
 *
 * Direct, because the number you want is the biggest thing on the block; and
 * detailed, because the denominator is right there rather than implied by how
 * full a ring looks. The overview keeps the shortfall-oriented rows instead —
 * there the question is "what is left", here it is "how far did I get".
 */
export function RingMetrics({ day }) {
  const metrics = [
    {
      key: "calorie",
      color: "var(--cal)",
      label: "熱量控制",
      value: Math.round(day?.calories || 0).toLocaleString(),
      goal: day?.calorieTarget ? `/ ${day.calorieTarget.toLocaleString()}` : "/ —",
      unit: "大卡",
      met: day?.calorie,
    },
    {
      key: "exercise",
      color: "var(--move)",
      label: "運動",
      value: Math.round(day?.exerciseMin || 0).toLocaleString(),
      goal: `/ ${EXERCISE_GOAL_MIN}`,
      unit: "分鐘",
      met: day?.exercise,
    },
    {
      key: "water",
      color: "var(--water)",
      label: "喝水",
      value: Math.round(day?.waterMl || 0).toLocaleString(),
      goal: `/ ${WATER_GOAL_ML.toLocaleString()}`,
      unit: "cc",
      met: day?.water,
    },
  ];

  return (
    <div className="ring-metrics">
      {metrics.map((m) => {
        const Icon = GOAL_ICONS[m.key];
        return (
          <div key={m.key} className={`ring-metric ${m.met ? "met" : ""}`}>
            <div className="rm-icon">
              <Icon met={m.met} />
            </div>
            <div className="rm-label" style={{ color: m.color }}>
              {m.label}
            </div>
            <div className="rm-value" style={{ color: m.color }}>
              {m.value}
            </div>
            <div className="rm-goal">
              {m.goal} {m.unit}
            </div>
          </div>
        );
      })}
    </div>
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
      goal: day?.calorieTarget ? `/ ${day.calorieTarget.toLocaleString()} kcal` : "kcal",
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
      {rows.map((row) => {
        const Icon = GOAL_ICONS[row.key];
        return (
        <div key={row.key} className={`ring-row ${row.met ? "met" : ""}`}>
          {/* The character in place of a coloured dot: same information, and
              it shows whether the goal is met by its own expression. */}
          <span className="ring-ico">
            <Icon met={row.met} />
          </span>
          <span className="ring-k">{row.label}</span>
          <span className="ring-v">{row.value}</span>
          <span className="ring-g">{row.goal}</span>
          {row.met ? (
            <span className="ring-done">
              <svg
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
              達標
            </span>
          ) : (
            <span className="ring-gap">{shortfall(row.key, day)}</span>
          )}
        </div>
        );
      })}
    </div>
  );
}
