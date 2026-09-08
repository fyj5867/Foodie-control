/**
 * The main screen's centrepiece: today's plant, and the garden behind it.
 *
 * Two views in one place — the plant you are growing now, and everything
 * already finished. They share a tab because they are the same story at two
 * timescales, and because the bottom nav has no room to spare.
 */

import React, { useState } from "react";
import Sprout from "./Sprout.jsx";
import GardenScene from "./Garden.jsx";
import { RingLegend } from "./Rings.jsx";
import { STAGES, TREE_DAYS, WATER_GOAL_ML } from "../lib/goals.js";

/** Which of the four vitality levels today's tally lands on. */
function vitalityFor(metCount) {
  if (metCount >= 3) return "thriving";
  if (metCount === 2) return "fair";
  if (metCount === 1) return "low";
  return "wilting";
}

const VITALITY_LINE = {
  thriving: { lead: "三項都達標了", tail: "葉子挺得最直" },
  fair: { lead: "還差一項", tail: "葉子快挺起來了" },
  low: { lead: "達成一項", tail: "葉子平展著" },
  wilting: { lead: "今天還沒有進度", tail: "葉子有點垂" },
};

/** What is still missing, in the order easiest to fix tonight. */
function missingLabel(day) {
  const gaps = [];
  if (!day.water) {
    const short = Math.max(0, WATER_GOAL_ML - Math.round(day.waterMl || 0));
    gaps.push(`喝水還差 ${short.toLocaleString()} cc`);
  }
  if (!day.exercise) gaps.push(`運動還差 ${Math.max(0, 30 - Math.round(day.exerciseMin || 0))} 分鐘`);
  if (!day.calorie) {
    if (!day.calorieTarget) gaps.push("熱量目標尚未設定");
    else if ((day.calories || 0) > day.calorieTarget) gaps.push("今天熱量已超過目標");
    else gaps.push("飲食還沒記錄完");
  }
  return gaps;
}

function StageTrack({ currentDays }) {
  return (
    <div className="stage-track">
      {STAGES.map((stage) => {
        const reached = currentDays >= stage.days;
        return (
          <div key={stage.key} className={`stage-dot ${reached ? "reached" : ""}`}>
            <span className="stage-mark" aria-hidden="true" />
            <span className="stage-label">{stage.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function GrowthPanel({ day, garden, onGoActivity }) {
  const [view, setView] = useState("today");
  const vitality = vitalityFor(day?.metCount || 0);
  const line = VITALITY_LINE[vitality];
  const gaps = missingLabel(day || {});
  const pct = Math.round((garden.currentDays / TREE_DAYS) * 100);

  return (
    <div className="card growth-card">
      <div className="growth-switch" role="tablist" aria-label="樹苗與花園">
        <button
          role="tab"
          aria-selected={view === "today"}
          className={`growth-switch-btn ${view === "today" ? "on" : ""}`}
          onClick={() => setView("today")}
        >
          今天的樹苗
        </button>
        <button
          role="tab"
          aria-selected={view === "garden"}
          className={`growth-switch-btn ${view === "garden" ? "on" : ""}`}
          onClick={() => setView("garden")}
        >
          我的花園
        </button>
      </div>

      {view === "today" ? (
        <>
          <div className="growth-scene">
            <Sprout
              stage={garden.stage.key}
              vitality={vitality}
              glow={vitality === "thriving"}
              title={`目前是${garden.stage.label}階段，${line.lead}`}
            />
          </div>

          <div className="growth-status">
            <div className="growth-lead">
              {line.lead} —— {line.tail}
            </div>
            {gaps.length ? <div className="growth-gap">{gaps.join("・")}</div> : null}
          </div>

          <RingLegend day={day} compact />

          <div className="growth-progress">
            <div className="growth-progress-head">
              <span>
                {garden.stage.label}
                {garden.nextStage ? ` → ${garden.nextStage.label}` : ""}
              </span>
              <b>
                {garden.currentDays} / {TREE_DAYS} 天
              </b>
            </div>
            <div className="growth-bar">
              <i style={{ width: `${pct}%` }} />
            </div>
            <StageTrack currentDays={garden.currentDays} />
            <div className="growth-note">
              {garden.nextStage
                ? `再 ${garden.daysToNextStage} 個達標日長成${garden.nextStage.label}`
                : `再 ${garden.daysToNextTree} 個達標日就完成這棵`}
            </div>
          </div>

          {onGoActivity ? (
            <button className="growth-link" onClick={onGoActivity}>
              看今天的三項細節
            </button>
          ) : null}
        </>
      ) : (
        <>
          <div className="growth-scene">
            <GardenScene
              completedTrees={garden.completedTrees}
              currentStage={garden.stage.key}
              vitality={vitality}
            />
          </div>

          <div className="garden-stats">
            <div className="garden-stat">
              <span className="gs-v">{garden.completedTrees}</span>
              <span className="gs-k">完成的樹</span>
            </div>
            <div className="garden-stat">
              <span className="gs-v">{garden.totalMetDays}</span>
              <span className="gs-k">累計達標天</span>
            </div>
            <div className="garden-stat">
              <span className="gs-v">{garden.longestStreak}</span>
              <span className="gs-k">最長連續</span>
            </div>
          </div>

          <div className="growth-note garden-note">
            {garden.completedTrees === 0
              ? `第一棵還差 ${garden.daysToNextTree} 個達標日。達標的日子會累加，中斷不會歸零。`
              : `第 ${garden.completedTrees + 1} 棵還差 ${garden.daysToNextTree} 個達標日。`}
          </div>
        </>
      )}
    </div>
  );
}
