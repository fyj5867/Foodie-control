/**
 * Today's three conditions in full, plus the week behind them.
 *
 * The week is a three-by-seven grid rather than seven small ring trios: at
 * the size a phone gives you, a 28px ring cannot show whether it is full, and
 * the thing worth seeing is *which* of the three keeps slipping. A grid
 * answers that at a glance; seven tiny rings do not.
 */

import React from "react";
import Rings, { RingLegend } from "./Rings.jsx";
import { daysAgoStr } from "../lib/health.js";

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

const CONDITIONS = [
  { key: "c", label: "熱量", color: "var(--cal)" },
  { key: "e", label: "運動", color: "var(--move)" },
  { key: "w", label: "喝水", color: "var(--water)" },
];

/** The last seven days, oldest first, each with whatever verdict we hold. */
function lastSevenDays(summaries, today) {
  const byDate = new Map((summaries || []).map((s) => [s.date, s]));
  const out = [];
  for (let i = 6; i >= 0; i--) {
    const date = daysAgoStr(i);
    const stored = byDate.get(date);
    // Today's verdict comes from the live evaluation, which is fresher than
    // whatever was last written to storage.
    const entry = i === 0 && today ? { c: today.calorie, e: today.exercise, w: today.water } : stored;
    out.push({
      date,
      weekday: WEEKDAYS[new Date(`${date}T00:00:00`).getDay()],
      entry: entry || null,
      isToday: i === 0,
    });
  }
  return out;
}

function WeekGrid({ summaries, today }) {
  const days = lastSevenDays(summaries, today);
  const first = days[0].date.slice(5).replace("-", "/");
  const last = days[6].date.slice(5).replace("-", "/");

  return (
    <div className="week-block">
      <div className="week-head">
        <span>本週</span>
        <b>
          {first} – {last}
        </b>
      </div>
      <div className="week-grid">
        <span />
        {days.map((d) => (
          <span key={`h${d.date}`} className={`week-wd ${d.isToday ? "today" : ""}`}>
            {d.weekday}
          </span>
        ))}

        {CONDITIONS.map((cond) => (
          <React.Fragment key={cond.key}>
            <span className="week-rl">{cond.label}</span>
            {days.map((d) => {
              const met = d.entry ? d.entry[cond.key] : null;
              return (
                <i
                  key={`${cond.key}${d.date}`}
                  className={`week-cell ${met === null ? "unknown" : met ? "met" : "missed"}`}
                  style={met ? { background: cond.color } : undefined}
                  title={`${d.date} ${cond.label}${met === null ? "：沒有紀錄" : met ? "：達標" : "：未達標"}`}
                />
              );
            })}
          </React.Fragment>
        ))}
      </div>
      <div className="week-legend">
        <span>
          <i className="week-cell met sample" /> 達標
        </span>
        <span>
          <i className="week-cell missed sample" /> 未達標
        </span>
        <span>
          <i className="week-cell unknown sample" /> 沒有紀錄
        </span>
      </div>
    </div>
  );
}

/**
 * @param day        today's evaluation from useGarden
 * @param summaries  the stored per-day verdicts
 * @param weeklyMinutes  exercise minutes so far this week
 * @param weeklyTarget   the weekly minutes goal (150 per WHO/ADA)
 */
export default function ActivityPanel({ day, summaries, weeklyMinutes, weeklyTarget = 150 }) {
  const weekPct = weeklyTarget ? Math.min(100, Math.round((weeklyMinutes / weeklyTarget) * 100)) : 0;

  return (
    <div className="card activity-card">
      <div className="section-title">今天的三項</div>

      <div className="rings-wrap">
        <Rings day={day} size={178} />
      </div>

      <RingLegend day={day} />

      <div className="activity-verdict">
        {day?.met ? "三項全達標，今天這一天算數。" : `達成 ${day?.metCount || 0} 項，三項全中才計入成長。`}
      </div>

      <WeekGrid summaries={summaries} today={day} />

      <div className="week-block">
        <div className="week-head">
          <span>每週運動</span>
          <b>
            {Math.round(weeklyMinutes)} / {weeklyTarget} 分鐘
          </b>
        </div>
        <div className="growth-bar">
          <i style={{ width: `${weekPct}%`, background: "var(--move)" }} />
        </div>
        <div className="week-note">
          每日 30 分鐘是達標門檻；每週 150 分鐘是 WHO 與 ADA 的活動量建議，兩者分開看。
        </div>
      </div>
    </div>
  );
}
