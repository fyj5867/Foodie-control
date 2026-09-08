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
import { STAGES, TREE_DAYS } from "../lib/goals.js";

/** Which of the four vitality levels today's tally lands on. */
function vitalityFor(metCount) {
  if (metCount >= 3) return "thriving";
  if (metCount === 2) return "fair";
  if (metCount === 1) return "low";
  return "wilting";
}

/* Written about the sprout's mood rather than its leaves, in the same voice
 * as the water mascot's lines — the character has a face now, and that is
 * what the person is actually looking at. */
const VITALITY_LINE = {
  thriving: { lead: "三項都達標了", tail: "今天心情最好" },
  fair: { lead: "還差一項", tail: "就快笑開了" },
  low: { lead: "達成一項", tail: "開始有精神了" },
  wilting: { lead: "今天還沒有進度", tail: "還有點想睡" },
};

/**
 * The headline: how many of the three are still open.
 *
 * This is the one thing worth reading first, so it gets the largest type on
 * the card. The per-condition detail now lives on the rows underneath, where
 * each shortfall sits next to the number it refers to.
 */
function headline(day) {
  const met = day?.metCount || 0;
  if (met === 3) return { text: "今天三項都達標了", tone: "done" };
  return { text: `今天還差 ${3 - met} 項`, tone: met === 0 ? "none" : "part" };
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
  const head = headline(day);
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
            <div className={`growth-head tone-${head.tone}`}>{head.text}</div>
            <div className="growth-mood">{line.tail}</div>
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
