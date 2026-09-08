/**
 * Throwaway harness: every stage against every mood, on one page.
 *
 * Judging a character design one screenshot at a time does not work — the
 * whole point is whether the six stages read as one creature growing, and
 * whether the four faces read as the same creature in different moods.
 *
 * Build (from source/):
 *   ./node_modules/.bin/esbuild tools/preview-sprout.jsx --bundle \
 *     --loader:.jsx=jsx --format=iife --outfile=tools/preview-sprout.js
 * then serve the project (node source/tools/serve.mjs 4173) and open
 * http://localhost:4173/source/tools/preview-sprout.html
 * The built .js is gitignored; the harness itself is kept.
 */
import React from "react";
import { createRoot } from "react-dom/client";
import Sprout from "../components/Sprout.jsx";
import { STAGES, VITALITY } from "../lib/goals.js";

const MOOD_KEYS = VITALITY.map((v) => v.key);
const MOOD_LABELS = Object.fromEntries(VITALITY.map((v) => [v.key, `${v.metCount} 項・${v.label}`]));

function Grid() {
  return (
    <div className="wrap">
      <h1>樹苗 —— 六個階段 × 四種表情</h1>
      <div className="grid" style={{ gridTemplateColumns: `90px repeat(${STAGES.length}, 1fr)` }}>
        <div />
        {STAGES.map((s) => (
          <div className="col-head" key={s.key}>
            {s.label}
            <span>{s.days} 天</span>
          </div>
        ))}

        {MOOD_KEYS.map((mood) => (
          <React.Fragment key={mood}>
            <div className="row-head">{MOOD_LABELS[mood]}</div>
            {STAGES.map((s) => (
              <div className="cell" key={`${mood}-${s.key}`}>
                <Sprout stage={s.key} vitality={mood} glow={mood === "thriving"} />
              </div>
            ))}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<Grid />);
