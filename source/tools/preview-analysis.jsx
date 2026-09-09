/**
 * Throwaway harness: the photo-analysis card, with and without a remembered
 * calorie figure.
 *
 * The card only appears after a real AI call, which needs an API key, so this
 * is the only way to look at the wording of the "we used your corrected
 * figure" note without spending a request — and the wording is the whole
 * feature. A number that changes itself has to say so in a sentence a person
 * reads in one go.
 *
 * Build (from source/):
 *   ./node_modules/.bin/esbuild tools/preview-analysis.jsx --bundle \
 *     --loader:.jsx=jsx --format=iife --outfile=tools/preview-analysis.js
 * then serve the project (node source/tools/serve.mjs 4173) and open
 * http://localhost:4173/source/tools/preview-analysis.html
 */
import React from "react";
import { createRoot } from "react-dom/client";
import { AnalysisModal } from "../App.jsx";

const RESULT = {
  foodName: "御選肉鬆飯糰",
  estimatedCalories: 320,
  carbsG: 48,
  proteinG: 8,
  fatG: 9,
  light: "yellow",
  reason: "白飯為主，配料含加工肉鬆",
  portionNote: "一個超商飯糰",
  confidence: "medium",
};

/* A 1x1 transparent gif stands in for the photo — this page is about the
   text under it, not the picture. */
const PIXEL =
  "data:image/gif;base64,R0lGODlhAQABAIAAAMLCwgAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==";

const CASES = [
  {
    title: "沒記過這個食物 —— 就是 AI 估的數字",
    preview: { imageDataUrl: PIXEL, result: RESULT, memoryHint: null, aiCalories: 320 },
  },
  {
    title: "記過一次 —— 直接用她改過的 251",
    preview: {
      imageDataUrl: PIXEL,
      result: { ...RESULT, estimatedCalories: 251 },
      memoryHint: { name: "御選肉鬆飯糰", calories: 251, estimate: 320, times: 1 },
      aiCalories: 320,
    },
  },
  {
    title: "改過好幾次 —— 順便講出來，這個數字是穩的",
    preview: {
      imageDataUrl: PIXEL,
      result: { ...RESULT, estimatedCalories: 251 },
      memoryHint: { name: "御選肉鬆飯糰", calories: 251, estimate: 298, times: 4 },
      aiCalories: 298,
    },
  },
];

function Grid() {
  return (
    <div className="diabetes-app" style={{ padding: "16px", display: "grid", gap: "20px" }}>
      {CASES.map((c) => (
        <div key={c.title}>
          <h3 style={{ font: "700 13px/1.4 sans-serif", margin: "0 0 8px" }}>{c.title}</h3>
          {/* Rendered inline rather than as a modal so all three read at once. */}
          <div style={{ maxWidth: "340px", border: "1px solid #ddd", borderRadius: "12px", overflow: "hidden" }}>
            <AnalysisModal
              analyzing={false}
              analysisError=""
              analysisPreview={c.preview}
              onConfirm={() => {}}
              onDiscard={() => {}}
              onEditCalories={() => {}}
              onUseEstimate={() => {}}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

createRoot(document.getElementById("root")).render(<Grid />);
