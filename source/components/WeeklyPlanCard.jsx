/**
 * 每週運動目標 — the week as seven day-cards rather than a table.
 *
 * It was a four-column table of text: 日／建議活動／時間／強度. A table is the
 * right shape for data you compare across rows, and the wrong shape for a
 * week you are supposed to want to do. Nothing in it moved, nothing in it
 * knew what had already happened, and on a phone the intensity column wrapped
 * to three lines.
 *
 * Now each day is a row with the character for its kind of exercise, its
 * intensity as three dots instead of a parenthetical, and — the part that
 * makes it a plan rather than a poster — whether it has actually been done
 * this week. Today's row is marked, days still ahead read as "not yet"
 * rather than as misses, and a day where something else was done instead is
 * credited as 有動 rather than shown as a blank: forty minutes of cycling on
 * a stretching day is not a failure.
 */

import React from "react";
import { EXERCISE_ICONS, CATEGORY_LABEL } from "./ExerciseIcons.jsx";
import { weeklyPlanProgress, weeklyPlanSummary } from "../lib/plan.js";

const LEVEL_LABEL = { 1: "低", 2: "中等", 3: "高" };

function IntensityDots({ level }) {
  return (
    <span className="wp-dots" title={`強度：${LEVEL_LABEL[level] || "中等"}`}>
      {[1, 2, 3].map((n) => (
        <i key={n} className={n <= level ? "on" : ""} />
      ))}
      <span className="wp-dots-label">{LEVEL_LABEL[level] || "中等"}</span>
    </span>
  );
}

function DayRow({ day }) {
  const Icon = EXERCISE_ICONS[day.category] || EXERCISE_ICONS.aerobic;
  const state = day.done ? "is-done" : day.movedAnyway ? "is-moved" : day.isPast ? "is-missed" : "is-ahead";

  return (
    <div className={`wp-row ${state} ${day.isToday ? "is-today" : ""}`}>
      <span className="wp-day">{day.day.replace("週", "")}</span>
      <span className="wp-ico">
        <Icon done={day.done} size={30} />
      </span>
      <span className="wp-main">
        <span className="wp-act">{day.short || day.activity}</span>
        <span className="wp-meta">
          {CATEGORY_LABEL[day.category] || ""}・{day.duration}
        </span>
      </span>
      <span className="wp-right">
        {day.done ? (
          <span className="wp-badge done">✓ {day.minutes} 分</span>
        ) : day.movedAnyway ? (
          <span className="wp-badge moved">有動 {day.minutes} 分</span>
        ) : (
          <IntensityDots level={day.level || 2} />
        )}
      </span>
    </div>
  );
}

export default function WeeklyPlanCard({ plan, exerciseLog = [], today, weeklyMinutes = 0 }) {
  const progress = weeklyPlanProgress({ weeklyTemplate: plan.weeklyTemplate, exerciseLog, today });
  const summary = weeklyPlanSummary(progress);
  const target = plan.weeklyMinutesTarget || 150;
  const pct = Math.min(100, Math.round((summary.minutes / target) * 100));

  return (
    <div className="card">
      <div className="section-title">
        每週運動目標
        <span className="cycle-badge">
          本週 {summary.done} / {summary.total} 天照計畫
        </span>
      </div>

      {/* The week's total against the 150-minute guideline, which is a
          different thing from the daily 30-minute threshold — see the note
          under the rings. */}
      <div className="wp-bar-head">
        <span>
          本週累計 <strong>{summary.minutes}</strong> / {target} 分鐘
        </span>
        <span>{pct}%</span>
      </div>
      <div className="wp-bar">
        <div className="wp-bar-fill" style={{ width: `${pct}%` }} />
      </div>

      <div className="wp-list">
        {progress.map((day) => (
          <DayRow key={day.day} day={day} />
        ))}
      </div>

      <div className="wp-legend">
        <span>
          <i className="sw done" /> 照計畫完成
        </span>
        <span>
          <i className="sw moved" /> 做了別的
        </span>
        <span>
          <i className="sw ahead" /> 還沒到
        </span>
      </div>

      {plan.cautions.length > 0 && (
        <ul className="caution-list" style={{ marginTop: "10px" }}>
          {plan.cautions.map((c, i) => (
            <li key={i}>{c}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
