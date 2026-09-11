/**
 * Throwaway harness: the photo-analysis card, in every state it can reach.
 *
 * The card only appears after a real AI call, which needs an API key, so this
 * is the only way to look at its wording without spending a request — and the
 * wording is the whole feature. Two things on this card change a number, or
 * cast doubt on one, and both have to say so in a sentence a person reads in
 * one go: the remembered figure, and the misread warnings.
 *
 * Build (from source/):
 *   ./node_modules/.bin/esbuild tools/preview-analysis.jsx --bundle \
 *     --loader:.jsx=jsx --format=iife --outfile=tools/preview-analysis.js
 * then serve the project (node source/tools/serve.mjs 4173) and open
 * http://localhost:4173/source/tools/preview-analysis.html
 */
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { AnalysisModal } from "../App.jsx";
import { normalizeFoodReading, mergeFoodReadings, applyPortion } from "../lib/foodEstimate.js";

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
  sourceType: "estimate",
  tags: ["refined_carb", "high_sodium", "processed_meat"],
};

/* A report with three values outside their range, so the personalised half of
   the food notes can be read — that is the part worth checking here. */
const REPORT = {
  date: "2026-08-15",
  values: { triglycerides: 186, systolic: 132, diastolic: 86, fastingGlucose: 108 },
};

/* A 1x1 transparent gif stands in for the photo — this page is about the
   text under it, not the picture. */
const PIXEL =
  "data:image/gif;base64,R0lGODlhAQABAIAAAMLCwgAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==";

const CASES = [
  {
    title: "沒記過這個食物 —— 就是 AI 估的數字",
    preview: { imageDataUrl: PIXEL, result: normalizeFoodReading(RESULT), memoryHint: null, aiCalories: 320 },
  },
  {
    title: "讀到包裝上的營養標示 —— 這種數字最準，要講出來",
    preview: {
      imageDataUrl: PIXEL,
      result: normalizeFoodReading({ ...RESULT, estimatedCalories: 251, sourceType: "label", confidence: "high", portionNote: "讀自包裝標示" }),
      memoryHint: null,
      aiCalories: 251,
    },
  },
  {
    title: "模型自己說沒把握 —— 不要讓它看起來像精確的數字",
    preview: {
      imageDataUrl: PIXEL,
      result: normalizeFoodReading({ ...RESULT, confidence: "low" }),
      memoryHint: null,
      aiCalories: 320,
    },
  },
  {
    title: "一頓對健康有幫助的餐（含分項）",
    preview: {
      imageDataUrl: PIXEL,
      result: normalizeFoodReading({
        ...RESULT,
        foodName: "鯖魚定食（糙米飯、燙青菜）",
        estimatedCalories: 620,
        carbsG: 72,
        proteinG: 34,
        fatG: 21,
        light: "green",
        reason: "原型食材、清淡烹調",
        items: [
          { name: "糙米飯", kcal: 280 },
          { name: "烤鯖魚", kcal: 260 },
          { name: "燙青菜", kcal: 45 },
          { name: "味噌湯", kcal: 35 },
        ],
        tags: ["omega3", "whole_grain", "vegetable", "light_cooking", "high_fiber"],
      }),
      memoryHint: null,
      aiCalories: 620,
    },
  },
  {
    title: "每 100 公克當成整包 —— 最常見的誤讀，數字本身看起來很正常",
    preview: {
      imageDataUrl: PIXEL,
      result: normalizeFoodReading({ ...RESULT, estimatedCalories: 2400, sourceType: "label", confidence: "high" }),
      memoryHint: null,
      aiCalories: 2400,
    },
  },
  {
    title: "熱量跟三大營養素互相矛盾 —— 模型自己看不出來的那種錯",
    preview: {
      imageDataUrl: PIXEL,
      result: normalizeFoodReading({ ...RESULT, estimatedCalories: 320, carbsG: 150, proteinG: 40, fatG: 30 }),
      memoryHint: null,
      aiCalories: 320,
    },
  },
  {
    title: "完全估不出熱量 —— 說出來，而不是填 0 大卡",
    preview: {
      imageDataUrl: PIXEL,
      result: normalizeFoodReading({ ...RESULT, foodName: "無法辨識", estimatedCalories: null, carbsG: null, proteinG: null, fatG: null, tags: [] }),
      memoryHint: null,
      aiCalories: 0,
    },
  },
  {
    title: "記過一次 —— 直接用她改過的 251",
    preview: {
      imageDataUrl: PIXEL,
      result: normalizeFoodReading({ ...RESULT, estimatedCalories: 251 }),
      memoryHint: { name: "御選肉鬆飯糰", calories: 251, estimate: 320, times: 1 },
      aiCalories: 320,
    },
  },
  {
    title: "改過好幾次 —— 順便講出來，這個數字是穩的",
    preview: {
      imageDataUrl: PIXEL,
      result: normalizeFoodReading({ ...RESULT, estimatedCalories: 251 }),
      memoryHint: { name: "御選肉鬆飯糰", calories: 251, estimate: 298, times: 4 },
      aiCalories: 298,
    },
  },
];

/* --- 一餐拍好幾張 ---
 * Several photos ADD UP, unlike the report's pages which fill each other's
 * gaps. That is what makes the same dish shot twice dangerous: on screen it is
 * only a slightly larger number. */
const RICE = { foodName: "白飯", estimatedCalories: 280, carbsG: 60, proteinG: 5, fatG: 1, light: "yellow", confidence: "high", sourceType: "estimate", tags: ["refined_carb"] };
const FISH = { foodName: "烤鯖魚", estimatedCalories: 260, carbsG: 0, proteinG: 24, fatG: 18, light: "green", confidence: "medium", sourceType: "estimate", tags: ["omega3", "lean_protein"] };
const GREENS = { foodName: "燙青菜", estimatedCalories: 45, carbsG: 6, proteinG: 3, fatG: 1, light: "green", confidence: "high", sourceType: "estimate", tags: ["vegetable", "high_fiber", "light_cooking"] };

function multi(readings) {
  const shots = readings.map((r) => ({ imageDataUrl: r ? PIXEL : null, reading: r }));
  const result = mergeFoodReadings(readings);
  return { shots, imageDataUrl: PIXEL, result, memoryHint: null, aiCalories: result.estimatedCalories };
}

CASES.push(
  { title: "一餐三盤 —— 加起來算成同一筆", preview: multi([RICE, FISH, GREENS]) },
  { title: "同一盤拍了兩次 —— 不講的話就會被算成兩份", preview: multi([RICE, FISH, RICE]) },
  { title: "其中一張讀不出來 —— 其餘的照樣合併", preview: multi([RICE, null, FISH]) }
);

/** Each card holds its own state so the 份量 chips can actually be pressed —
 * 「吃一半」 twice still being a half is the thing worth checking by hand. */
function Case({ title, preview, report }) {
  const [state, setState] = useState(preview);
  return (
    <div>
      <h3 style={{ font: "700 13px/1.4 sans-serif", margin: "0 0 8px" }}>{title}</h3>
      {/* Rendered inline rather than as a modal so they all read at once. */}
      <div style={{ maxWidth: "340px", border: "1px solid #ddd", borderRadius: "12px", overflow: "hidden" }}>
        <AnalysisModal
          analyzing={false}
          analysisError=""
          analysisPreview={state}
          onConfirm={() => {}}
          onDiscard={() => {}}
          onEditCalories={(v) => setState((s) => ({ ...s, result: { ...s.result, estimatedCalories: v } }))}
          onUseEstimate={() => setState((s) => ({ ...s, memoryHint: null, result: { ...s.result, estimatedCalories: s.aiCalories } }))}
          onSetPortion={(f) => setState((s) => ({ ...s, memoryHint: null, result: applyPortion(s.result, f) }))}
          onRemovePhoto={(i) =>
            setState((s) => {
              const shots = s.shots.filter((_, n) => n !== i);
              return { ...s, shots, result: mergeFoodReadings(shots.map((sh) => sh.reading)) };
            })
          }
          analysisProgress={null}
          report={report}
          gender="female"
        />
      </div>
    </div>
  );
}

function Grid() {
  return (
    <div className="diabetes-app" style={{ padding: "16px", display: "grid", gap: "20px" }}>
      {CASES.map((c) => (
        <Case key={c.title} title={c.title} preview={c.preview} report={"report" in c ? c.report : REPORT} />
      ))}
    </div>
  );
}

createRoot(document.getElementById("root")).render(<Grid />);
