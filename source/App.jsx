import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Home,
  UserRound,
  Utensils,
  Dumbbell,
  Activity,
  HeartPulse,
  Plus,
  Trash2,
  Info,
  RotateCcw,
  Camera,
  Image as ImageIcon,
  Pencil,
  Loader2,
  Check,
  RefreshCw,
  AlertTriangle,
  ChevronDown,
  X,
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  ReferenceLine,
  ReferenceArea,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

/* ----------------------------------------------------------------------- */
/* Constants & reference data                                              */
/* ----------------------------------------------------------------------- */

/* ----------------------------------------------------------------------- */
/* Domain logic                                                            */
/*                                                                         */
/* Health reference values and calculations live in lib/health.js — they    */
/* carry cited sources and a review date, and must have exactly one home.   */
/* Growth and garden rules live in lib/goals.js.                           */
/* ----------------------------------------------------------------------- */

import {
  SYMPTOM_OPTIONS,
  deriveActivityLevel,
  ACTIVITY_LOG_OPTIONS,
  ACTIVITY_CATEGORY_LABEL,
  LIGHT_META,
  BMI_ZONES,
  bodyFatZones,
  skeletalMuscleZones,
  waistZones,
  sleepZones,
  CONTENT_REVIEW,
  FOOD_DB,
  calcBMI,
  bmiCategory,
  calcRiskScore,
  riskZone,
  buildExercisePlan,
  buildExerciseWeeklyFeedback,
  buildWeeklyExerciseChartData,
  todayStr,
  nowTimeStr,
  daysAgoStr,
  fmtNum,
  calcDailyCalorieTargetBreakdown,
  calcDailyCalorieTarget,
  calcWaterTargetBreakdown,
  calcWaterTarget,
  waterMood,
  calorieZone,
  buildWeeklyCalorieData,
} from "./lib/health.js";
import { STAGES, VITALITY, canBackfill, WATER_GOAL_ML, EXERCISE_GOAL_MIN, TREE_DAYS } from "./lib/goals.js";
import useGarden from "./lib/useGarden.js";
import Sprout from "./components/Sprout.jsx";
import GardenScene from "./components/Garden.jsx";
import Rings, { RingLegend } from "./components/Rings.jsx";
import GrowthPanel from "./components/GrowthPanel.jsx";
import ActivityPanel, { WeekCard } from "./components/ActivityPanel.jsx";
import DietDiary from "./components/DietDiary.jsx";
import AvatarPicker from "./components/AvatarPicker.jsx";
import DailyCoach from "./components/DailyCoach.jsx";
import { coachSlot, dailyMessage, eveningSummary } from "./lib/coach.js";
import { agePhotos, PHOTO_DAYS, PHOTO_MAX_DIM, KEYS, loadFoodMemory, saveFoodMemory } from "./lib/storage.js";
import { remember, forget, lookup, suggestion, sortedMemory, isLearnable } from "./lib/foodMemory.js";
import { askAboutImage, FOOD_PROMPT, LAB_PROMPT, BODY_PROMPT } from "./lib/vision.js";
import { applyReadingToForm } from "./lib/bodyScan.js";
import { upsertReport, removeReport, latestReport } from "./lib/reports.js";
import {
  loadReports,
  saveReports,
  loadWorkoutLinks,
  saveWorkoutLinks,
  loadVisits,
  saveVisits,
  loadPlans,
  savePlans,
  buildBackupFrom,
} from "./lib/storage.js";
import { upsertVisit, removeVisit, markVisitDone } from "./lib/visits.js";
import { upsertPlan, removePlan, markPlanDone } from "./lib/examPlans.js";
import { buildIcs, icsFilename } from "./lib/calendar.js";
import { joinSleep, splitSleep, formatSleep } from "./lib/sleep.js";
import { normalizeFoodReading, mergeFoodReadings, applyPortion, sourceNote, PORTIONS, MAX_FOOD_PHOTOS } from "./lib/foodEstimate.js";
import HealthAnalysis from "./components/HealthAnalysis.jsx";
import WorkoutSuggestions from "./components/WorkoutSuggestions.jsx";
import WeeklyPlanCard from "./components/WeeklyPlanCard.jsx";
import FoodImpact from "./components/FoodImpact.jsx";
import { cleanTags } from "./lib/nutritionTags.js";
import { AerobicIcon, ResistanceIcon, FlexibilityIcon } from "./components/ExerciseIcons.jsx";

/** Traffic-light metadata for a value that may be missing or unrecognised.
 * Falls back to yellow — "watch the portion" is the safe thing to say when
 * we do not actually know. */
function lightMeta(light) {
  return LIGHT_META[light] || LIGHT_META.yellow;
}

/** Just the word, without the trailing guidance clause. */
function lightWord(light) {
  return lightMeta(light).label.split("\u3000")[0];
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(new Error("讀取照片失敗"));
    reader.readAsDataURL(file);
  });
}

/** Shrinks an image data URL down to a small JPEG thumbnail so photos can be
 * stored alongside food-log entries without blowing up localStorage size. */
function compressImageDataUrl(dataUrl, maxDim = 180, quality = 0.55) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > height) {
        if (width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        }
      } else if (height > maxDim) {
        width = Math.round((width * maxDim) / height);
        height = maxDim;
      }
      try {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => reject(new Error("圖片縮圖處理失敗"));
    img.src = dataUrl;
  });
}

/**
 * Ask the vision model about a food photo.
 *
 * The transport, the two providers and the error wording all live in
 * lib/vision.js now — the health check report reads photos through the same
 * path, and two copies of the fetch-and-unwrap-the-JSON dance would drift.
 */
async function analyzeFoodPhoto(base64Data, mediaType, provider, apiKey, geminiModel) {
  return askAboutImage({ prompt: FOOD_PROMPT, base64Data, mediaType, provider, apiKey, geminiModel });
}

/**
 * Read the numbers off a scale's display.
 *
 * A web page cannot read Apple 健康 — there is no browser API for HealthKit —
 * so the daily 體態紀錄 was eight numbers typed in after every weigh-in. A
 * photo of the scale (or of the OMRON connect / Apple 健康 screen) gets the
 * same numbers in one tap and needs nothing from Apple.
 */
async function analyzeBodyPhoto(base64Data, mediaType, provider, apiKey, geminiModel) {
  return askAboutImage({ prompt: BODY_PROMPT, base64Data, mediaType, provider, apiKey, geminiModel });
}

/**
 * Read the printed numbers off a health check report.
 *
 * maxTokens is raised because a report page carries a whole panel of values,
 * not one meal. The model is asked only to transcribe: what the numbers mean
 * is decided in lib/health.js against published reference ranges.
 */
async function analyzeLabReport(base64Data, mediaType, provider, apiKey, geminiModel) {
  return askAboutImage({
    prompt: LAB_PROMPT,
    base64Data,
    mediaType,
    provider,
    apiKey,
    geminiModel,
    maxTokens: 2000,
  });
}

/* ----------------------------------------------------------------------- */
/* Small shared UI pieces                                                   */
/* ----------------------------------------------------------------------- */

function Disclaimer({ compact }) {
  return (
    <div className={`disclaimer ${compact ? "disclaimer-compact" : ""}`}>
      <Info size={14} />
      <span>
        本內容僅提供健康生活型態參考，非醫療診斷。如有不適症狀或已確診疾病，請諮詢醫師或營養師。
      </span>
    </div>
  );
}

function ContentSources() {
  return (
    <div className="content-sources">
      <div className="content-sources-title">資料來源與最後校對日期：{CONTENT_REVIEW.lastReviewed}</div>
      <ul>
        {CONTENT_REVIEW.sources.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ul>
    </div>
  );
}

function Pill({ light, children }) {
  const meta = lightMeta(light);
  return <span className={`pill ${meta.className}`}>{children}</span>;
}

function Gauge({ score }) {
  const cx = 100;
  const cy = 100;
  const r = 80;

  function polarToCartesian(angleInDegrees) {
    const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
    return {
      x: cx + r * Math.cos(angleInRadians),
      y: cy + r * Math.sin(angleInRadians),
    };
  }
  function describeArc(startAngle, endAngle) {
    const start = polarToCartesian(endAngle);
    const end = polarToCartesian(startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
  }

  const needleAngle = -90 + (score / 100) * 180;
  const needleLen = r * 0.78;
  const needleRad = ((needleAngle - 90) * Math.PI) / 180;
  const nx = cx + needleLen * Math.cos(needleRad);
  const ny = cy + needleLen * Math.sin(needleRad);

  return (
    <svg viewBox="0 0 200 118" className="gauge-svg">
      <path d={describeArc(-90, -30)} className="gauge-arc gauge-arc-green" />
      <path d={describeArc(-30, 30)} className="gauge-arc gauge-arc-yellow" />
      <path d={describeArc(30, 90)} className="gauge-arc gauge-arc-red" />
      <line x1={cx} y1={cy} x2={nx} y2={ny} className="gauge-needle" />
      <circle cx={cx} cy={cy} r="6" className="gauge-hub" />
      <text x={cx} y={cy + 34} textAnchor="middle" className="gauge-score">
        {Math.round(score)}
      </text>
    </svg>
  );
}

function CalorieBar({ target, consumed, remaining, zone, breakdown, override, overrideInput, setOverrideInput, onSaveOverride, onClearOverride }) {
  if (target == null && !breakdown) {
    return (
      <div className="cal-empty">
        <p>請先在「個人資料」填寫年齡、身高、體重，即可估算今日建議熱量與剩餘額度。</p>
      </div>
    );
  }
  const pct = Math.min(100, Math.round((consumed / target) * 100));
  const over = remaining < 0;
  return (
    <div className="cal-bar-wrap">
      <div className="cal-bar-numbers">
        <div>
          <div className="cal-bar-value">{Math.round(consumed)}</div>
          <div className="cal-bar-caption">已攝取（大卡）</div>
        </div>
        <div className={`cal-bar-remaining tone-${zone}`}>
          <div className="cal-bar-value">{over ? `+${Math.abs(Math.round(remaining))}` : Math.round(remaining)}</div>
          <div className="cal-bar-caption">{over ? "已超出建議攝取量" : "今日剩餘可攝取"}</div>
        </div>
        <div>
          <div className="cal-bar-value">{target}</div>
          <div className="cal-bar-caption">{override ? "今日建議攝取（自訂）" : "今日建議攝取"}</div>
        </div>
      </div>
      <div className="cal-bar-track">
        <div className={`cal-bar-fill tone-${zone}`} style={{ width: `${pct}%` }} />
      </div>

      {breakdown && (
        <details className="calc-breakdown">
          <summary>這個目標怎麼算出來的？／改成自己的目標</summary>
          <div className="calc-breakdown-body">
            <div>
              基礎代謝率（BMR）：{breakdown.bmr} kcal
              {breakdown.bmrSource === "record"
                ? `（取自 ${breakdown.bmrSourceDate} 體態紀錄的量測值，例如 OMRON 體組成計）`
                : "（尚無體態紀錄，改用年齡/性別/身高/體重公式估算）"}
            </div>
            <div>活動量係數：× {breakdown.activityFactor}</div>
            {breakdown.deficitApplied && <div>BMI偏高，已扣除 500 kcal 熱量赤字</div>}
            {breakdown.flooredApplied && <div>已套用安全下限，避免建議熱量過低</div>}
            <div style={{ fontWeight: 700, margin: "4px 0" }}>系統計算參考值：{breakdown.target} kcal</div>

            <div className="override-row">
              <span>自訂目標（例如醫師/營養師的建議量）：</span>
              <input
                type="number"
                className="cal-num-input-inline"
                value={overrideInput}
                onChange={(e) => setOverrideInput(e.target.value)}
                placeholder={String(breakdown.target)}
              />
              <button type="button" className="btn btn-secondary" onClick={() => onSaveOverride(overrideInput)}>
                套用
              </button>
              {override && (
                <button type="button" className="btn btn-danger" onClick={onClearOverride}>
                  改回系統計算
                </button>
              )}
            </div>
          </div>
        </details>
      )}
    </div>
  );
}

function MetricTrendChart({ title, dataKey, unit, color, chartData, zones, zoneExplain, formatValue }) {
  const points = chartData.filter((d) => d[dataKey] != null);
  if (points.length < 2) return null;
  const domain = zones ? [zones[0].y1, zones[zones.length - 1].y2] : ["auto", "auto"];
  return (
    <div className="card">
      <div className="section-title">{title}</div>
      {zones && (
        <>
          <div className="chart-zone-legend">
            {zones.map((z, i) => (
              <span key={i} className="chart-zone-tag" style={{ background: z.bg }}>
                {z.label}
              </span>
            ))}
          </div>
          {zoneExplain && <p className="chart-zone-explain">{zoneExplain}</p>}
        </>
      )}
      <div style={{ width: "100%", height: 180 }}>
        <ResponsiveContainer>
          <LineChart data={chartData} margin={{ top: 6, right: 10, left: -18, bottom: 0 }}>
            <CartesianGrid stroke="#DCE3DC" strokeDasharray="3 3" />
            {zones &&
              zones.map((z, i) => (
                <ReferenceArea key={i} y1={z.y1} y2={z.y2} fill={z.bg} fillOpacity={0.7} strokeOpacity={0} ifOverflow="extendDomain" />
              ))}
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} domain={domain} unit={unit} />
            {/* Sleep is the one metric whose number is not how it is read:
                the axis has to stay decimal to draw the line, but a tooltip
                saying 7.25 小時 makes her do the conversion the two input
                boxes just removed. */}
            <Tooltip formatter={formatValue ? (v) => formatValue(v) : undefined} />
            <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2.5} dot={{ r: 3 }} name={title} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

const WATER_MOOD_META = {
  sleepy: { label: "才剛開始，慢慢補充水分吧", face: "sleepy" },
  neutral: { label: "有喝到一些了，繼續加油！", face: "neutral" },
  happy: { label: "快達標了，再喝一點！", face: "happy" },
  party: { label: "太棒了，今天的水分達標！", face: "party" },
};

/** One editable day of water. */
function WaterHistoryRow({ entry, onUpdateWaterEntry, onPersistWaterEntry, onDeleteWaterEntry }) {
  const isToday = entry.date === todayStr();
  return (
    <div className={`water-history-row ${isToday ? "is-today" : ""}`}>
      <span>{isToday ? "今天" : entry.date.slice(5)}</span>
      <span className="water-history-edit">
        <Pencil size={10} className="food-log-edit-icon" />
        <input
          type="number"
          className="cal-num-input-inline water-amount-input"
          value={entry.amountMl}
          onChange={(e) => onUpdateWaterEntry(entry.id, e.target.value)}
          onBlur={() => onPersistWaterEntry(entry.id)}
          aria-label={`${isToday ? "今天" : entry.date} 的喝水量`}
        />
        <span>ml</span>
      </span>
      <button className="icon-btn" onClick={() => onDeleteWaterEntry(entry.id)} aria-label="刪除這天的紀錄">
        <Trash2 size={14} />
      </button>
    </div>
  );
}

function WaterMascot({ pct }) {
  const fillPct = Math.max(0, Math.min(pct, 100));
  const fillHeight = 128 * (fillPct / 100);
  const fillY = 154 - fillHeight;
  const mood = waterMood(pct);

  return (
    <svg viewBox="0 0 120 176" className="water-mascot-svg">
      <defs>
        <clipPath id="waterBottleClip">
          <rect x="18" y="26" width="84" height="128" rx="20" />
        </clipPath>
      </defs>

      {mood === "party" && (
        <g className="water-sparkle">
          <path d="M14 14 L17 20 L23 22 L17 24 L14 30 L11 24 L5 22 L11 20 Z" />
          <path d="M100 8 L102 13 L107 15 L102 17 L100 22 L98 17 L93 15 L98 13 Z" />
          <path d="M104 40 L106 44 L110 46 L106 48 L104 52 L102 48 L98 46 L102 44 Z" />
        </g>
      )}

      <rect x="48" y="8" width="24" height="20" rx="6" className="water-bottle-outline" />
      <rect x="18" y="26" width="84" height="128" rx="20" className="water-bottle-outline" />

      <g clipPath="url(#waterBottleClip)">
        <rect x="18" y={fillY} width="84" height={fillHeight + 12} className="water-fill" />
      </g>

      <rect x="18" y="26" width="84" height="128" rx="20" className="water-bottle-border" />

      {mood === "sleepy" && (
        <g className="water-face">
          <path d="M40 80 Q46 75 52 80" className="water-face-line" />
          <path d="M68 80 Q74 75 80 80" className="water-face-line" />
          <path d="M53 101 L67 101" className="water-face-line" />
          <text x="92" y="18" className="water-zzz">z z</text>
        </g>
      )}
      {mood === "neutral" && (
        <g className="water-face">
          <circle cx="46" cy="80" r="5" className="water-face-fill" />
          <circle cx="74" cy="80" r="5" className="water-face-fill" />
          <path d="M48 101 L72 101" className="water-face-line" />
        </g>
      )}
      {mood === "happy" && (
        <g className="water-face">
          <circle cx="40" cy="90" r="6" className="water-cheek" />
          <circle cx="80" cy="90" r="6" className="water-cheek" />
          <circle cx="46" cy="80" r="5" className="water-face-fill" />
          <circle cx="74" cy="80" r="5" className="water-face-fill" />
          <path d="M46 96 Q60 110 74 96" className="water-face-line water-face-line-thick" />
        </g>
      )}
      {mood === "party" && (
        <g className="water-face">
          <circle cx="38" cy="90" r="7" className="water-cheek" />
          <circle cx="82" cy="90" r="7" className="water-cheek" />
          <circle cx="46" cy="79" r="5.5" className="water-face-fill" />
          <circle cx="74" cy="79" r="5.5" className="water-face-fill" />
          <path d="M42 94 Q60 116 78 94" className="water-face-line water-face-line-thick" />
        </g>
      )}
    </svg>
  );
}

function WaterCard({
  target,
  breakdown,
  consumedToday,
  todayWaterEntries,
  recentWaterEntries,
  weeklyWaterChartData,
  onAddWater,
  onDeleteWaterEntry,
  onUpdateWaterEntry,
  onPersistWaterEntry,
}) {
  const [customAmount, setCustomAmount] = useState("");
  const [showEarlierWater, setShowEarlierWater] = useState(false);

  // Split today from the rest so today can stay visible while the others
  // collapse. Hooks must run before the early return below.
  const waterRows = useMemo(() => {
    const t = todayStr();
    const entries = recentWaterEntries || [];
    return {
      today: entries.filter((e) => e.date === t),
      earlier: entries.filter((e) => e.date !== t),
    };
  }, [recentWaterEntries]);

  if (target == null) {
    return (
      <div className="card">
        <div className="section-title">今日喝水量</div>
        <p style={{ fontSize: "12.5px", color: "var(--ink-soft)", margin: 0 }}>
          請先在「個人資料」填寫性別與體重，即可估算今日建議飲水量。
        </p>
      </div>
    );
  }

  const pct = Math.round((consumedToday / target) * 100);
  const mood = waterMood(pct);

  return (
    <div className="card">
      <div className="section-title">今日喝水量</div>
      <div className="water-wrap">
        <WaterMascot pct={pct} />
        <div className="water-numbers">
          <div className="water-value">
            {consumedToday}
            <span> / {target} ml</span>
          </div>
          <div className="water-mood-label">{WATER_MOOD_META[mood].label}</div>
        </div>
      </div>

      {breakdown && (
        <details className="calc-breakdown">
          <summary>這個目標怎麼算出來的？</summary>
          <div className="calc-breakdown-body">
            <div>
              體重依據：{breakdown.weight} kg
              {breakdown.weightSource === "record"
                ? `（取自 ${breakdown.weightSourceDate} 體態紀錄的量測值）`
                : "（個人資料設定值，尚無體態紀錄）"}
            </div>
            <div>
              體重基準（{breakdown.weight}kg × 30ml）：{breakdown.weightBased} ml
            </div>
            <div>官方基準（{breakdown.genderBase === 2400 ? "男性" : "女性"}）：{breakdown.genderBase} ml</div>
            <div>取兩者較大值：{Math.max(breakdown.weightBased, breakdown.genderBase)} ml</div>
            {breakdown.activityAdd > 0 && <div>活動量調整：+{breakdown.activityAdd} ml</div>}
            <div style={{ fontWeight: 700, marginTop: "4px" }}>合計目標：{breakdown.target} ml</div>
          </div>
        </details>
      )}

      <div className="water-quick-row">
        <button type="button" className="water-quick-btn" onClick={() => onAddWater(200)}>
          🥤 +200ml
        </button>
        <button type="button" className="water-quick-btn" onClick={() => onAddWater(350)}>
          🍶 +350ml
        </button>
        <button type="button" className="water-quick-btn" onClick={() => onAddWater(600)}>
          🧴 +600ml
        </button>
      </div>
      <form
        className="water-custom-row"
        onSubmit={(e) => {
          e.preventDefault();
          const v = Number(customAmount);
          if (v > 0) {
            onAddWater(v);
            setCustomAmount("");
          }
        }}
      >
        <input
          type="number"
          value={customAmount}
          onChange={(e) => setCustomAmount(e.target.value)}
          placeholder="自訂毫升數"
        />
        <button type="submit" className="btn btn-secondary">
          <Plus size={15} />
        </button>
      </form>

      {weeklyWaterChartData.some((d) => d.total > 0) && (
        <div style={{ width: "100%", height: 160, marginTop: "12px" }}>
          <ResponsiveContainer>
            <BarChart data={weeklyWaterChartData} margin={{ top: 6, right: 10, left: -18, bottom: 0 }}>
              <CartesianGrid stroke="#DCE3DC" strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              {target != null && (
                <ReferenceLine y={target} stroke="#2C6E9B" strokeDasharray="4 4" label={{ value: "目標", fontSize: 10, fill: "#2C6E9B", position: "insideTopRight" }} />
              )}
              <Bar dataKey="total" fill="#6FB6E0" radius={[4, 4, 0, 0]} name="喝水量(ml)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {recentWaterEntries.length > 0 && (
        <div className="water-history">
          {/* Today is the row you actually edit. The chart above already shows
              the other days, so they stay collapsed until you want to correct
              one. */}
          {waterRows.today.map((entry) => (
            <WaterHistoryRow
              key={entry.id}
              entry={entry}
              onUpdateWaterEntry={onUpdateWaterEntry}
              onPersistWaterEntry={onPersistWaterEntry}
              onDeleteWaterEntry={onDeleteWaterEntry}
            />
          ))}

          {waterRows.earlier.length > 0 && (
            <>
              {showEarlierWater ? (
                <>
                  <div className="water-history-title">前 {waterRows.earlier.length} 天（可直接修改毫升數）</div>
                  {waterRows.earlier.map((entry) => (
                    <WaterHistoryRow
                      key={entry.id}
                      entry={entry}
                      onUpdateWaterEntry={onUpdateWaterEntry}
                      onPersistWaterEntry={onPersistWaterEntry}
                      onDeleteWaterEntry={onDeleteWaterEntry}
                    />
                  ))}
                </>
              ) : null}
              <button
                type="button"
                className="water-history-toggle"
                onClick={() => setShowEarlierWater((v) => !v)}
              >
                {showEarlierWater ? "收起前幾天" : `查看並修改前 ${waterRows.earlier.length} 天`}
              </button>
            </>
          )}
        </div>
      )}

      <p style={{ fontSize: "11px", color: "var(--ink-soft)", marginTop: "10px", lineHeight: 1.5 }}>
        飲水量為一般成人參考值，若有腎臟疾病、心臟衰竭等需限制水分的情況，請依醫師指示調整，不套用本試算。
      </p>
    </div>
  );
}

export function AnalysisModal({ analyzing, analysisProgress, analysisError, analysisPreview, onConfirm, onDiscard, onEditCalories, onEditName, onUseEstimate, onSetPortion, onRemovePhoto, report, gender }) {
  if (!analyzing && !analysisError && !analysisPreview) return null;
  const r = analysisPreview?.result;

  return (
    <div className="modal-backdrop" onClick={analyzing ? undefined : onDiscard}>
      <div className="modal-card analysis-modal-card" onClick={(e) => e.stopPropagation()}>
        {analyzing && (
          <div className="analyzing-row" style={{ justifyContent: "center", padding: "24px 0" }}>
            <Loader2 size={20} className="spin" />{" "}
            {analysisProgress
              ? `正在分析第 ${analysisProgress.done + 1} / ${analysisProgress.total} 張…`
              : "正在分析照片中的食物與熱量…"}
          </div>
        )}

        {!analyzing && analysisError && (
          <>
            <h3>分析未成功</h3>
            <div className="analysis-error">{analysisError}</div>
            <button className="btn btn-secondary btn-block" onClick={onDiscard}>
              關閉
            </button>
          </>
        )}

        {!analyzing && analysisPreview && r && (
          <div className="analysis-card" style={{ border: "none", padding: 0, marginBottom: 0 }}>
            {analysisPreview.imageDataUrl && <img src={analysisPreview.imageDataUrl} alt="食物相片" />}
            <div className="analysis-card-body">
              {/* Editable, because the name is the thing the model gets wrong
                  most often and everything downstream hangs off it: the diary
                  entry, and the 熱量標準值 that is looked up and stored under
                  exactly this text. A wrong name that cannot be fixed teaches
                  the wrong standard. */}
              <input
                type="text"
                className="analysis-food-name"
                value={r.foodName}
                onChange={(e) => onEditName(e.target.value)}
                placeholder="這是什麼食物？"
                aria-label="食物名稱"
              />
              <div className="analysis-cal-row">
                <input
                  type="number"
                  className="cal-num-input"
                  value={r.estimatedCalories}
                  onChange={(e) => onEditCalories(e.target.value === "" ? "" : Number(e.target.value))}
                />
                <span style={{ fontSize: "11px", color: "var(--ink-soft)" }}>大卡（可微調）</span>
                <Pill light={["green", "yellow", "red"].includes(r.light) ? r.light : "yellow"}>
                  {lightWord(r.light)}
                </Pill>
              </div>
              {analysisPreview.memoryHint && (
                <div className="cal-memory-note">
                  <Info size={13} style={{ flexShrink: 0, marginTop: "1px" }} />
                  <span>
                    {/* one line on purpose — a JSX line break becomes a space, and a space before 「，」 reads as a typo */}
                    已直接用你之前改的 <strong>{analysisPreview.memoryHint.calories} 大卡</strong>{analysisPreview.memoryHint.times > 1 ? `，改過 ${analysisPreview.memoryHint.times} 次了` : ""}。AI 這次估 {analysisPreview.memoryHint.estimate} 大卡。
                    <br />
                    <button type="button" onClick={onUseEstimate}>
                      這次改用 AI 估的 {analysisPreview.memoryHint.estimate} 大卡
                    </button>
                  </span>
                </div>
              )}
              {/* One row per photo, each removable. Adding the plates up is
                  what makes several photos worth taking, and it is also the
                  one way this can go wrong that she would never spot: the same
                  dish shot twice becomes two portions, and on screen that is
                  just a slightly larger number. */}
              {analysisPreview.shots && analysisPreview.shots.length > 1 && (
                <div className="shot-list">
                  {analysisPreview.shots.map((sh, i) => (
                    <div className={`shot-row ${sh.reading ? "" : "is-dead"}`} key={i}>
                      {sh.imageDataUrl ? (
                        <img src={sh.imageDataUrl} alt="" className="shot-thumb" />
                      ) : (
                        <span className="shot-thumb is-blank" />
                      )}
                      <span className="shot-name">
                        {sh.reading ? sh.reading.foodName : `第 ${i + 1} 張讀不出來`}
                      </span>
                      <span className="shot-kcal">
                        {sh.reading ? `${Math.round(Number(sh.reading.estimatedCalories) || 0)} 大卡` : "—"}
                      </span>
                      <button type="button" className="icon-btn" aria-label="移除這張" onClick={() => onRemovePhoto(i)}>
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Where the number came from. The prompt asks the model to say
                  when it read a printed label and to be honest about how sure
                  it is; both were being thrown away, so a transcription and a
                  guess looked exactly alike on this card. */}
              {(() => {
                const note = sourceNote(r);
                return note ? <div className={`analysis-source is-${note.tone}`}>{note.text}</div> : null;
              })()}

              {/* Usually empty. When it is not, it is because two numbers on
                  this card disagree in a way the model cannot see in itself. */}
              {(r.warnings || []).map((w) => (
                <div className="analysis-warn" key={w.code}>
                  <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: "1px" }} />
                  <span>{w.text}</span>
                </div>
              ))}

              {/* Half a photographed bento is the commonest correction there
                  is, and doing it by hand means arithmetic at the table. */}
              <div className="portion-row">
                <span className="portion-label">實際吃了</span>
                {PORTIONS.map((p) => {
                  const current = r.portionFactor == null ? 1 : r.portionFactor;
                  return (
                    <button
                      type="button"
                      key={p.key}
                      className={`portion-chip ${current === p.factor ? "is-on" : ""}`}
                      onClick={() => onSetPortion(p.factor)}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>

              {/* The breakdown is what makes the total auditable: without it a
                  wrong number is a number she cannot see into, and the only
                  repair available is to overwrite the whole thing. */}
              {(() => {
                /* With several photos the strip above IS the breakdown, one
                   line per plate. Repeating it as an item list would be the
                   same three rows twice, in a card that has run past the
                   bottom of the screen before — so it only appears when a
                   photo broke down into more than itself. */
                const shots = analysisPreview.shots || [];
                const alive = shots.filter((sh) => sh.reading).length;
                return r.items && r.items.length > 1 && (shots.length <= 1 || r.items.length > alive);
              })() && (
                <div className="analysis-items">
                  {r.items.map((it, i) => (
                    <div className="analysis-item" key={`${it.name}-${i}`}>
                      <span>{it.name}</span>
                      <span>{it.kcal != null ? `${it.kcal} 大卡` : "—"}</span>
                    </div>
                  ))}
                </div>
              )}

              {(r.carbsG != null || r.proteinG != null || r.fatG != null) && (
                <div className="analysis-macro">
                  醣 {fmtNum(r.carbsG, 0)}g・蛋白質 {fmtNum(r.proteinG, 0)}g・脂肪 {fmtNum(r.fatG, 0)}g
                </div>
              )}
              {r.portionNote && <div className="analysis-macro">{r.portionNote}</div>}
              {r.reason && <div className="analysis-reason">{r.reason}</div>}
              <FoodImpact tags={r.tags} report={report} gender={gender} />
              <div className="analysis-actions">
                <button className="btn btn-secondary" onClick={onDiscard}>
                  <RefreshCw size={13} /> 重新選擇
                </button>
                <button className="btn btn-primary" onClick={onConfirm}>
                  <Check size={13} /> 加入紀錄
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------- */
/* Main App                                                                 */
/* ----------------------------------------------------------------------- */

export default function App() {
  const [tab, setTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [records, setRecords] = useState([]);
  const [showReset, setShowReset] = useState(false);
  const [showCaptureMenu, setShowCaptureMenu] = useState(false);
  const [saveNote, setSaveNote] = useState("");

  const [form, setForm] = useState({
    nickname: "",
    avatar: "",
    age: "",
    gender: "female",
    height: "",
    weight: "",
    symptoms: [],
    vigorousChecked: false,
    vigorousMinutes: "",
    moderateChecked: false,
    moderateMinutes: "",
    lightChecked: false,
    lightMinutes: "",
  });

  const [recordForm, setRecordForm] = useState({
    date: todayStr(),
    weight: "",
    bmi: "",
    waist: "",
    bodyFat: "",
    visceralFat: "",
    skeletalMuscle: "",
    bodyAge: "",
    bmr: "",
    sleepH: "",
    sleepM: "",
  });

  const [foodLog, setFoodLog] = useState([]);
  const [waterLog, setWaterLog] = useState([]);
  const [exerciseLog, setExerciseLog] = useState([]);
  const [exerciseForm, setExerciseForm] = useState({ date: todayStr(), activityId: "walk", customLabel: "", durationMin: "" });
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState("");
  const [analysisPreview, setAnalysisPreview] = useState(null); // { photos, result }
  const [analysisProgress, setAnalysisProgress] = useState(null); // { done, total }
  const [manualForm, setManualForm] = useState({ name: "", calories: "" });
  /** Calorie figures corrected by hand, per food. See lib/foodMemory.js. */
  const [foodMemory, setFoodMemory] = useState([]);
  /** Health check reports — confirmed numbers only, never the photo. */
  const [reports, setReports] = useState([]);
  /** Videos pinned to an exercise suggestion, by workout id. */
  const [workoutLinks, setWorkoutLinks] = useState({});
  /** 就醫紀錄 — the other half of every "go and ask a doctor". */
  const [visits, setVisits] = useState([]);
  /** 排定的檢查 — a suggestion with a date on it. */
  const [examPlans, setExamPlans] = useState([]);
  /** Reading 體態紀錄 off a photo of the scale. */
  const [bodyScanning, setBodyScanning] = useState(false);
  const [bodyScanNote, setBodyScanNote] = useState(null);
  /* Which diary rows had their calories actually typed in this session. A
     figure only counts as a correction if the person changed it — reading
     back an untouched row would teach the AI's own guess as a standard. */
  const editedCaloriesRef = useRef(new Set());

  const [apiKey, setApiKey] = useState("");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [geminiKeyInput, setGeminiKeyInput] = useState("");
  const [geminiModel, setGeminiModel] = useState("");
  const [geminiModelInput, setGeminiModelInput] = useState("");
  const [aiProvider, setAiProvider] = useState("gemini");
  const [calorieOverride, setCalorieOverride] = useState("");
  /* Which coach message has been dismissed, as "YYYY-MM-DD:slot". Kept so a
   * message you have already read does not come back on every open. */
  const [coachDismissed, setCoachDismissed] = useState("");
  const [calorieOverrideInput, setCalorieOverrideInput] = useState("");

  useEffect(() => {
    if (loading) return;
    window.storage.set("last-tab", tab, false).catch(() => {});
  }, [tab, loading]);

  useEffect(() => {
    (async () => {
      try {
        const lt = await window.storage.get("last-tab", false);
        if (lt && lt.value && ["overview", "profile", "diet", "exercise", "tracking"].includes(lt.value)) {
          setTab(lt.value);
        }
      } catch (e) {
        /* no saved tab yet; default to overview */
      }
      try {
        const p = await window.storage.get("profile", false);
        if (p && p.value) {
          const parsed = JSON.parse(p.value);
          setProfile(parsed);
          setForm((f) => ({ ...f, ...parsed }));
        }
      } catch (e) {
        /* no profile saved yet */
      }
      let loadedRecords = [];
      try {
        const r = await window.storage.get("body-records", false);
        if (r && r.value) loadedRecords = JSON.parse(r.value);
      } catch (e) {
        /* no records saved yet */
      }
      setRecords(loadedRecords);
      try {
        const fl = await window.storage.get("food-log", false);
        if (fl && fl.value) setFoodLog(JSON.parse(fl.value));
      } catch (e) {
        /* no food log saved yet */
      }
      try {
        setFoodMemory(await loadFoodMemory());
      } catch (e) {
        /* nothing corrected yet */
      }
      try {
        setReports(await loadReports());
      } catch (e) {
        /* no health check report uploaded yet */
      }
      try {
        setWorkoutLinks(await loadWorkoutLinks());
      } catch (e) {
        /* no video pinned yet */
      }
      try {
        setVisits(await loadVisits());
      } catch (e) {
        /* no clinic visit recorded yet */
      }
      try {
        setExamPlans(await loadPlans());
      } catch (e) {
        /* nothing scheduled yet */
      }
      try {
        const wl = await window.storage.get("water-log", false);
        if (wl && wl.value) {
          const rawLog = JSON.parse(wl.value);
          // Migrate any legacy multi-entry-per-day logs into one aggregated
          // entry per date (older versions logged a separate timestamped
          // entry per tap of the quick-add buttons).
          const byDate = {};
          rawLog.forEach((e) => {
            byDate[e.date] = (byDate[e.date] || 0) + (Number(e.amountMl) || 0);
          });
          const migrated = Object.keys(byDate).map((d) => ({ id: d, date: d, amountMl: byDate[d] }));
          setWaterLog(migrated);
          if (migrated.length !== rawLog.length) {
            window.storage.set("water-log", JSON.stringify(migrated), false).catch(() => {});
          }
        }
      } catch (e) {
        /* no water log saved yet */
      }
      try {
        const el = await window.storage.get("exercise-log", false);
        if (el && el.value) setExerciseLog(JSON.parse(el.value));
      } catch (e) {
        /* no exercise log saved yet */
      }
      let hasAnthropicKey = false;
      try {
        const k = await window.storage.get("anthropic-api-key", false);
        if (k && k.value) {
          setApiKey(k.value);
          setApiKeyInput(k.value);
          hasAnthropicKey = true;
        }
      } catch (e) {
        /* no api key saved yet */
      }
      let hasGeminiKey = false;
      try {
        const gk = await window.storage.get("gemini-api-key", false);
        if (gk && gk.value) {
          setGeminiKey(gk.value);
          setGeminiKeyInput(gk.value);
          hasGeminiKey = true;
        }
      } catch (e) {
        /* no gemini key saved yet */
      }
      try {
        const gm = await window.storage.get("gemini-model", false);
        if (gm && gm.value) {
          setGeminiModel(gm.value);
          setGeminiModelInput(gm.value);
        }
      } catch (e) {
        /* no custom gemini model saved yet */
      }
      try {
        const prov = await window.storage.get("ai-provider", false);
        if (prov && prov.value) {
          // explicit saved preference always wins
          setAiProvider(prov.value);
        } else if (hasAnthropicKey && !hasGeminiKey) {
          // an existing user who already set up Anthropic before this
          // feature existed shouldn't be silently switched to Gemini
          setAiProvider("anthropic");
        } else {
          setAiProvider("gemini");
        }
      } catch (e) {
        setAiProvider(hasAnthropicKey && !hasGeminiKey ? "anthropic" : "gemini");
      }
      try {
        const cd = await window.storage.get("coach-dismissed", false);
        if (cd && cd.value) setCoachDismissed(cd.value);
      } catch (e) {
        /* nothing dismissed yet */
      }
      try {
        const co = await window.storage.get("calorie-target-override", false);
        if (co && co.value) {
          setCalorieOverride(co.value);
          setCalorieOverrideInput(co.value);
        }
      } catch (e) {
        /* no calorie override saved yet */
      }

      setLoading(false);
    })();
  }, []);

  function flashSaved(msg) {
    setSaveNote(msg);
    setTimeout(() => setSaveNote(""), 2200);
  }

  async function persistProfile(rawForm) {
    const cleaned = {
      ...rawForm,
      age: rawForm.age === "" ? "" : Number(rawForm.age),
      height: rawForm.height === "" ? "" : Number(rawForm.height),
      weight: rawForm.weight === "" ? "" : Number(rawForm.weight),
      activityLevel: deriveActivityLevel(rawForm),
    };
    const res = await window.storage.set("profile", JSON.stringify(cleaned), false);
    if (res) setProfile(cleaned);
    return res;
  }

  // Auto-save: persist the profile ~700ms after the user stops editing, once
  // the minimum required fields are present. This means data survives a
  // refresh or tab switch even if the person never taps "儲存個人資料".
  useEffect(() => {
    if (loading) return;
    // Age is optional, so it is not part of the "enough to save" test.
    if (!form.height || !form.weight) return;
    const timer = setTimeout(() => {
      persistProfile(form).catch(() => {
        /* silent: the explicit Save button will surface errors if this keeps failing */
      });
    }, 700);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, loading]);

  async function handleSaveProfile(e) {
    e.preventDefault();
    try {
      const res = await persistProfile(form);
      if (res) {
        flashSaved("個人資料已儲存");
        setTab("overview");
      }
    } catch (e) {
      flashSaved("儲存失敗，請再試一次");
    }
  }

  function toggleSymptom(id) {
    setForm((f) => {
      const has = f.symptoms.includes(id);
      const symptoms = has ? f.symptoms.filter((s) => s !== id) : [...f.symptoms, id];
      return { ...f, symptoms };
    });
  }

  async function handleAddRecord(e) {
    e.preventDefault();
    if (!recordForm.weight) {
      flashSaved("請至少輸入體重");
      return;
    }
    /* sleepH/sleepM belong to the form, not to the record — the record has
       kept a single decimal `sleepHours` since the first version and every
       stored night is in that shape. Spreading the form wholesale would quietly
       add two extra fields to every row from here on. */
    const { sleepH, sleepM, ...formFields } = recordForm;
    const entry = {
      ...formFields,
      weight: Number(recordForm.weight),
      bmi: recordForm.bmi === "" ? null : Number(recordForm.bmi),
      waist: recordForm.waist === "" ? null : Number(recordForm.waist),
      bodyFat: recordForm.bodyFat === "" ? null : Number(recordForm.bodyFat),
      visceralFat: recordForm.visceralFat === "" ? null : Number(recordForm.visceralFat),
      skeletalMuscle: recordForm.skeletalMuscle === "" ? null : Number(recordForm.skeletalMuscle),
      bodyAge: recordForm.bodyAge === "" ? null : Number(recordForm.bodyAge),
      sleepHours: joinSleep(sleepH, sleepM),
      bmr: recordForm.bmr === "" ? null : Number(recordForm.bmr),
    };
    const others = records.filter((r) => r.date !== entry.date);
    const next = [...others, entry].sort((a, b) => (a.date < b.date ? -1 : 1));
    try {
      const res = await window.storage.set("body-records", JSON.stringify(next), false);
      if (res) {
        setRecords(next);
        flashSaved("紀錄已儲存");
        setRecordForm({
          date: todayStr(),
          weight: "",
          bmi: "",
          waist: "",
          bodyFat: "",
          visceralFat: "",
          skeletalMuscle: "",
          bodyAge: "",
          bmr: "",
          sleepH: "",
          sleepM: "",
        });
      }
    } catch (e) {
      flashSaved("儲存失敗，請再試一次");
    }
  }

  async function handleDeleteRecord(date) {
    const next = records.filter((r) => r.date !== date);
    try {
      await window.storage.set("body-records", JSON.stringify(next), false);
      setRecords(next);
    } catch (e) {
      flashSaved("刪除失敗，請再試一次");
    }
  }

  function handleEditRecord(record) {
    /* The record keeps one decimal; the form has two boxes. */
    const sleep = splitSleep(record.sleepHours);
    setRecordForm({
      date: record.date,
      weight: record.weight ?? "",
      bmi: record.bmi ?? "",
      waist: record.waist ?? "",
      bodyFat: record.bodyFat ?? "",
      visceralFat: record.visceralFat ?? "",
      skeletalMuscle: record.skeletalMuscle ?? "",
      bodyAge: record.bodyAge ?? "",
      bmr: record.bmr ?? "",
      sleepH: sleep.h,
      sleepM: sleep.m,
    });
    flashSaved(`已載入 ${record.date} 的紀錄，修改後按「更新紀錄」`);
  }

  /**
   * Record a corrected calorie figure for a food.
   *
   * Only ever called with a number the person supplied — a diary row they
   * typed into, a manual entry, or a photo entry whose figure they changed
   * before saving. Never with the model's own estimate.
   */
  async function rememberCalories(name, calories) {
    if (!isLearnable(name, calories)) return;
    const next = remember(foodMemory, { name, calories });
    setFoodMemory(next);
    try {
      await saveFoodMemory(next);
    } catch (e) {
      /* The entry itself is already saved. A lost correction costs one more
         edit later; failing the save would cost the meal. */
    }
  }

  /**
   * Read a health check report photo.
   *
   * Returns the parsed reading to the screen that asked for it — nothing is
   * stored here. The photo is not kept at all and the numbers are not saved
   * until she has seen them and pressed save. See lib/reports.js.
   */
  async function analyzeReportPhoto(file) {
    const base64 = await fileToBase64(file);
    const mediaType = file.type || "image/jpeg";
    const activeKey = aiProvider === "gemini" ? geminiKey : apiKey;
    return analyzeLabReport(base64, mediaType, aiProvider, activeKey, geminiModel);
  }

  /**
   * Fill the 體態紀錄 form from a photo of the scale.
   *
   * The reading lands in the form rather than in storage: it is a draft until
   * she presses 儲存紀錄, exactly as if she had typed it. Fields the photo did
   * not contain are left alone — a scale that does not measure waist must not
   * wipe the waist she typed a moment ago.
   */
  async function handleBodyPhoto(file) {
    if (!file) return;
    setBodyScanning(true);
    setBodyScanNote(null);
    try {
      const base64 = await fileToBase64(file);
      const mediaType = file.type || "image/jpeg";
      const activeKey = aiProvider === "gemini" ? geminiKey : apiKey;
      const reading = await analyzeBodyPhoto(base64, mediaType, aiProvider, activeKey, geminiModel);
      const applied = applyReadingToForm(recordForm, reading);
      setRecordForm(applied.form);
      setBodyScanNote({
        filled: applied.filled,
        rejected: applied.rejected,
        unreadable: applied.unreadable,
        error: applied.filled.length ? "" : "這張照片讀不到數值，可以拍清楚一點，或直接手動輸入。",
      });
    } catch (e) {
      setBodyScanNote({ filled: [], rejected: [], unreadable: [], error: e.message || "辨識失敗，請再試一次。" });
    } finally {
      setBodyScanning(false);
    }
  }

  async function handleSaveReport(draft) {
    const next = upsertReport(reports, draft);
    setReports(next);
    try {
      await saveReports(next);
      flashSaved("已儲存健檢報告");
    } catch (e) {
      flashSaved("儲存失敗，請再試一次");
    }
  }

  async function handleDeleteReport(id) {
    const next = removeReport(reports, id);
    setReports(next);
    try {
      await saveReports(next);
    } catch (e) {
      flashSaved("刪除失敗，請再試一次");
    }
  }

  async function persistVisits(next) {
    setVisits(next);
    try {
      return await saveVisits(next);
    } catch (e) {
      flashSaved("儲存失敗，請再試一次");
      return next;
    }
  }

  async function handleSaveVisit(draft) {
    const saved = await persistVisits(upsertVisit(visits, draft));
    setVisits(saved);
    flashSaved("已儲存就醫紀錄");
  }

  async function handleDeleteVisit(id) {
    setVisits(await persistVisits(removeVisit(visits, id)));
  }

  async function handleToggleVisitDone(id, done) {
    setVisits(await persistVisits(markVisitDone(visits, id, done)));
  }

  async function persistPlans(next) {
    setExamPlans(next);
    try {
      return await savePlans(next);
    } catch (e) {
      flashSaved("儲存失敗，請再試一次");
      return next;
    }
  }

  /**
   * Hand a scheduled exam to the phone's calendar.
   *
   * A web page cannot write to the calendar — there is no API for it. What it
   * can do is produce the .ics every calendar app reads: on iOS, opening one
   * brings up 「加入行事曆」 with the event already filled in.
   *
   * The share sheet is tried first because on a phone that is where it wants
   * to go, and a plain download falls back for desktop. A cancelled share is
   * not a failure and must not then force a download — that would leave a
   * file she deliberately declined sitting in Downloads.
   */
  async function handleAddToCalendar(plan) {
    const text = buildIcs(plan);
    if (!text) return;
    const filename = icsFilename(plan);
    const blob = new Blob([text], { type: "text/calendar;charset=utf-8" });

    try {
      const file = new File([blob], filename, { type: "text/calendar" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "加入行事曆" });
        flashSaved("已開啟行事曆選單");
        return;
      }
    } catch (e) {
      /* AbortError just means she closed the sheet. Falling through to a
         download would save a file she just declined. */
      if (e && e.name === "AbortError") return;
    }

    try {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      flashSaved("已下載行事曆檔案，點開即可加入");
    } catch (e) {
      flashSaved("加入行事曆失敗，請再試一次");
    }
  }

  async function handleSavePlan(draft) {
    setExamPlans(await persistPlans(upsertPlan(examPlans, draft)));
    flashSaved("已排定");
  }

  async function handleDeletePlan(id) {
    setExamPlans(await persistPlans(removePlan(examPlans, id)));
  }

  async function handleTogglePlanDone(id, done) {
    setExamPlans(await persistPlans(markPlanDone(examPlans, id, done)));
  }

  async function handleSaveWorkoutLink(id, url) {
    const next = { ...workoutLinks };
    if (url) next[id] = url;
    else delete next[id];
    const clean = await saveWorkoutLinks(next).catch(() => next);
    setWorkoutLinks(clean);
  }

  /** Record a suggested workout without retyping it into the form. */
  async function handleQuickAddWorkout(activityId, label, minutes) {
    const entry = {
      id: `${Date.now()}`,
      date: todayStr(),
      activityId,
      activityLabel: label,
      durationMin: Math.round(Number(minutes)) || 0,
    };
    try {
      await persistExerciseLog([...exerciseLog, entry]);
      flashSaved(`已記錄 ${label} ${entry.durationMin} 分鐘`);
    } catch (e) {
      flashSaved("儲存失敗，請再試一次");
    }
  }

  async function forgetCalories(name) {
    const next = forget(foodMemory, name);
    setFoodMemory(next);
    try {
      await saveFoodMemory(next);
    } catch (e) {
      /* same reasoning as above */
    }
  }

  async function persistFoodLog(next) {
    // Photos are dropped once they pass the window; the entry's text is kept
    // indefinitely so the diary has a real history. See PHOTO_DAYS.
    const aged = agePhotos(next, PHOTO_DAYS);
    await window.storage.set("food-log", JSON.stringify(aged), false);
    setFoodLog(aged);
  }

  async function persistWaterLog(next) {
    const cutoff = daysAgoStr(60);
    const trimmed = next.filter((e) => e.date >= cutoff);
    await window.storage.set("water-log", JSON.stringify(trimmed), false);
    setWaterLog(trimmed);
  }

  async function handleAddWater(amountMl) {
    const amount = Math.round(Number(amountMl));
    if (!amount || amount <= 0) return;
    const today = todayStr();
    const existingIdx = waterLog.findIndex((e) => e.date === today);
    let next;
    if (existingIdx >= 0) {
      next = [...waterLog];
      next[existingIdx] = { ...next[existingIdx], amountMl: next[existingIdx].amountMl + amount };
    } else {
      next = [...waterLog, { id: `${Date.now()}`, date: today, amountMl: amount }];
    }
    try {
      await persistWaterLog(next);
      flashSaved(`已記錄 ${amount} ml`);
    } catch (e) {
      flashSaved("儲存失敗，請再試一次");
    }
  }

  async function handleDeleteWaterEntry(id) {
    const next = waterLog.filter((e) => e.id !== id);
    try {
      await persistWaterLog(next);
    } catch (e) {
      flashSaved("刪除失敗，請再試一次");
    }
  }

  function handleUpdateWaterEntry(id, rawValue) {
    setWaterLog((prev) => prev.map((e) => (e.id === id ? { ...e, amountMl: rawValue } : e)));
  }

  async function handlePersistWaterEntry(id) {
    const entry = waterLog.find((e) => e.id === id);
    if (!entry) return;
    const cleaned = Math.round(Number(entry.amountMl)) || 0;
    try {
      await persistWaterLog(waterLog.map((e) => (e.id === id ? { ...e, amountMl: cleaned } : e)));
    } catch (e) {
      flashSaved("更新失敗，請再試一次");
    }
  }

  async function persistExerciseLog(next) {
    const cutoff = daysAgoStr(90);
    const trimmed = next.filter((e) => e.date >= cutoff);
    await window.storage.set("exercise-log", JSON.stringify(trimmed), false);
    setExerciseLog(trimmed);
  }

  async function handleAddExerciseEntry(e) {
    e.preventDefault();
    const duration = Number(exerciseForm.durationMin);
    if (!duration || duration <= 0) {
      flashSaved("請輸入運動時間（分鐘）");
      return;
    }
    const opt = ACTIVITY_LOG_OPTIONS.find((o) => o.id === exerciseForm.activityId);
    const label = exerciseForm.activityId === "other" ? exerciseForm.customLabel.trim() || "其他運動" : opt?.label || "運動";
    const entry = {
      id: `${Date.now()}`,
      date: exerciseForm.date || todayStr(),
      activityId: exerciseForm.activityId,
      activityLabel: label,
      durationMin: duration,
    };
    try {
      await persistExerciseLog([...exerciseLog, entry]);
      setExerciseForm({ date: todayStr(), activityId: "walk", customLabel: "", durationMin: "" });
      flashSaved("已加入運動紀錄");
    } catch (err) {
      flashSaved("儲存失敗，請再試一次");
    }
  }

  async function handleDeleteExerciseEntry(id) {
    const next = exerciseLog.filter((e) => e.id !== id);
    try {
      await persistExerciseLog(next);
    } catch (e) {
      flashSaved("刪除失敗，請再試一次");
    }
  }

  function handleUpdateExerciseEntry(id, rawValue) {
    setExerciseLog((prev) => prev.map((e) => (e.id === id ? { ...e, durationMin: rawValue } : e)));
  }

  async function handlePersistExerciseEntry(id) {
    const entry = exerciseLog.find((e) => e.id === id);
    if (!entry) return;
    const cleaned = Math.round(Number(entry.durationMin)) || 0;
    try {
      await persistExerciseLog(exerciseLog.map((e) => (e.id === id ? { ...e, durationMin: cleaned } : e)));
    } catch (e) {
      flashSaved("更新失敗，請再試一次");
    }
  }

  /**
   * Analyse one to five photos of the same meal.
   *
   * Several photos are read one at a time rather than in parallel, for the
   * same reason the report pages are: the free Gemini tier is rate limited,
   * and five requests at once fail as a batch where five in a row succeed.
   *
   * Only the first photo is kept as the diary's thumbnail. Five compressed
   * images per meal would be roughly a hundred kilobytes a day into a
   * localStorage shared with every health record there is, and the photos
   * have already done their job by this point.
   */
  async function handlePhotoFile(fileList) {
    const files = [...(fileList instanceof FileList || Array.isArray(fileList) ? fileList : [fileList])]
      .filter(Boolean)
      .slice(0, MAX_FOOD_PHOTOS);
    if (!files.length) return;

    setAnalysisError("");
    setAnalyzing(true);
    setAnalysisPreview(null);
    setAnalysisProgress(files.length > 1 ? { done: 0, total: files.length } : null);

    const activeKey = aiProvider === "gemini" ? geminiKey : apiKey;
    const shots = [];
    let lastError = null;

    for (let i = 0; i < files.length; i++) {
      if (files.length > 1) setAnalysisProgress({ done: i, total: files.length });
      const file = files[i];
      const mediaType = file.type || "image/jpeg";
      try {
        const base64 = await fileToBase64(file);
        shots.push({
          imageDataUrl: `data:${mediaType};base64,${base64}`,
          reading: await analyzeFoodPhoto(base64, mediaType, aiProvider, activeKey, geminiModel),
        });
      } catch (e) {
        lastError = e;
        /* A photo that failed keeps its place in the list: 「第 2 張讀不出來」
           only means something if the numbering matches what she picked. */
        shots.push({ imageDataUrl: null, reading: null });
      }
    }

    setAnalysisProgress(null);
    setAnalyzing(false);

    if (shots.every((sh) => !sh.reading)) {
      setAnalysisError(lastError?.message || "照片分析失敗，請重新拍攝或改用手動輸入。");
      return;
    }

    setAnalysisPreview(buildAnalysisPreview(shots));
  }

  /**
   * Turn the photos in hand into what the card shows.
   *
   * Kept separate because removing a photo has to redo all of it — the total,
   * the checks, and whether a remembered figure still applies.
   */
  function buildAnalysisPreview(shots) {
    const alive = shots.filter((sh) => sh.reading);
    /* Everything a vision model reads off a photo goes through a bounds check
       before it is shown — lab markers and scale readings always did, and the
       meal's calorie figure was the one that did not, even though the day's
       total is what decides whether the garden grows. Nothing is thrown away:
       the checks produce notes beside a figure she can still edit, because a
       blanked-out meal is worse than a suspect one. */
    const result =
      alive.length === 1 && shots.length === 1
        ? normalizeFoodReading(shots[0].reading)
        : mergeFoodReadings(shots.map((sh) => sh.reading));

    // A figure this person already corrected for this exact food beats a fresh
    // guess from a photo — a packaged item's label does not change. It is
    // applied rather than merely offered because the correction was deliberate,
    // but the card says so and offers the estimate back in one tap. aiCalories
    // is kept so a value nobody touched is never learned.
    //
    // Only ever for a single photo: a remembered 御選肉鬆飯糰 is a figure for
    // that one thing, and 「白飯、烤鯖魚、燙青菜」 is not a food anyone corrected.
    const memoryHint =
      shots.length === 1 ? suggestion(foodMemory, result.foodName, result.estimatedCalories) : null;

    return {
      shots,
      imageDataUrl: shots.find((sh) => sh.imageDataUrl)?.imageDataUrl || null,
      result: memoryHint ? { ...result, estimatedCalories: memoryHint.calories } : result,
      memoryHint,
      aiCalories: Number(result.estimatedCalories) || 0,
    };
  }

  /** Drop one photo and redo the sum — the only cure for a dish shot twice. */
  function removeAnalysisPhoto(index) {
    setAnalysisPreview((prev) => {
      if (!prev || !prev.shots) return prev;
      const shots = prev.shots.filter((_, i) => i !== index);
      if (!shots.some((sh) => sh.reading)) return prev;
      return buildAnalysisPreview(shots);
    });
  }

  async function confirmAnalysisEntry() {
    if (!analysisPreview) return;
    const r = analysisPreview.result;
    let photo = null;
    try {
      photo = await compressImageDataUrl(analysisPreview.imageDataUrl, PHOTO_MAX_DIM);
    } catch (e) {
      photo = null; // don't block saving the entry just because the thumbnail failed
    }
    const entry = {
      id: `${Date.now()}`,
      date: todayStr(),
      time: nowTimeStr(),
      foodName: r.foodName || "未命名食物",
      estimatedCalories: Number(r.estimatedCalories) || 0,
      carbsG: r.carbsG != null ? Number(r.carbsG) : null,
      proteinG: r.proteinG != null ? Number(r.proteinG) : null,
      fatG: r.fatG != null ? Number(r.fatG) : null,
      light: ["green", "yellow", "red"].includes(r.light) ? r.light : "yellow",
      reason: r.reason || "",
      confidence: r.confidence || "medium",
      source: "photo",
      /* Kept with the entry so the diary can still say what a meal loaded
         weeks later, once the photo itself has aged out. */
      tags: cleanTags(r.tags),
      photo,
    };
    try {
      await persistFoodLog([...foodLog, entry]);
      // Learn only what the person changed. Accepting a remembered figure
      // counts too — it confirms the standard rather than setting a new one.
      //
      // But never learn from a part-portion. 「吃一半」 on a 251 大卡 rice ball
      // is 126 for today, not a new standard of 126 for every rice ball after
      // it — and the standard is applied automatically next time, so getting
      // this wrong would quietly halve that food for good.
      const wholePortion = !(r.portionFactor != null && r.portionFactor !== 1);
      if (wholePortion && entry.estimatedCalories !== analysisPreview.aiCalories) {
        await rememberCalories(entry.foodName, entry.estimatedCalories);
      }
      setAnalysisPreview(null);
      flashSaved("已加入今日飲食紀錄");
    } catch (e) {
      flashSaved("儲存失敗，請再試一次");
    }
  }

  function discardAnalysis() {
    setAnalysisPreview(null);
    setAnalysisError("");
  }

  /** Put the model's own estimate back, and drop the note explaining the
   * remembered figure — there is nothing left to explain once it is gone. */
  function useAnalysisEstimate() {
    setAnalysisPreview((prev) => {
      if (!prev) return prev;
      return { ...prev, memoryHint: null, result: { ...prev.result, estimatedCalories: prev.aiCalories } };
    });
  }

  /** 吃了多少：倍數一律乘在最初那份估算上（見 lib/foodEstimate.js）。 */
  function setAnalysisPortion(factor) {
    setAnalysisPreview((prev) => {
      if (!prev) return prev;
      /* A remembered figure is a whole portion of that food, so scaling it is
         still meaningful — but the note explaining it no longer matches what
         is on screen, so it goes. */
      return { ...prev, memoryHint: null, result: applyPortion(prev.result, factor) };
    });
  }

  /**
   * Correct what the photo was read as.
   *
   * The name is not decoration: 熱量標準值 is looked up and stored under exactly
   * this text, so renaming「肉鬆飯糰」to「御選肉鬆飯糰」is also the moment her own
   * corrected figure for that food becomes findable. It is offered rather than
   * applied — she may have already typed the calories for this particular one.
   */
  function updateAnalysisName(value) {
    setAnalysisPreview((prev) => {
      if (!prev) return prev;
      const result = { ...prev.result, foodName: value };
      /* Only while the figure is still the model own guess. Once she has typed
         a number for this particular plate, a remembered standard must not
         come along and overwrite it just because the name now matches. */
      const untouched = Number(prev.result.estimatedCalories) === Number(prev.aiCalories);
      const hint = untouched ? suggestion(foodMemory, value, prev.aiCalories) : null;
      if (!hint) return { ...prev, result, memoryHint: null };
      return { ...prev, result: { ...result, estimatedCalories: hint.calories }, memoryHint: hint };
    });
  }

  function updateAnalysisCalories(value) {
    setAnalysisPreview((prev) => {
      if (!prev) return prev;
      return { ...prev, result: { ...prev.result, estimatedCalories: value } };
    });
  }

  async function handleAddManualEntry(e) {
    e.preventDefault();
    if (!manualForm.name || !manualForm.calories) {
      flashSaved("請輸入食物名稱與熱量");
      return;
    }
    const entry = {
      id: `${Date.now()}`,
      date: todayStr(),
      time: nowTimeStr(),
      foodName: manualForm.name,
      estimatedCalories: Number(manualForm.calories) || 0,
      carbsG: null,
      proteinG: null,
      fatG: null,
      light: "yellow",
      reason: "手動輸入",
      confidence: "manual",
      source: "manual",
    };
    try {
      await persistFoodLog([...foodLog, entry]);
      // A hand-typed figure is a standard for that food by definition.
      await rememberCalories(entry.foodName, entry.estimatedCalories);
      setManualForm({ name: "", calories: "" });
      flashSaved("已加入今日飲食紀錄");
    } catch (e) {
      flashSaved("儲存失敗，請再試一次");
    }
  }

  async function handleDeleteFoodEntry(id) {
    const next = foodLog.filter((e) => e.id !== id);
    try {
      await persistFoodLog(next);
    } catch (e) {
      flashSaved("刪除失敗，請再試一次");
    }
  }

  function handleUpdateFoodEntryCalories(id, rawValue) {
    // onChange only fires when the value actually changes, which is exactly
    // the definition of a correction being wanted here.
    editedCaloriesRef.current.add(id);
    setFoodLog((prev) => prev.map((e) => (e.id === id ? { ...e, estimatedCalories: rawValue } : e)));
  }

  async function handlePersistFoodEntryCalories(id) {
    const entry = foodLog.find((e) => e.id === id);
    if (!entry) return;
    const cleaned = Number(entry.estimatedCalories) || 0;
    const wasEdited = editedCaloriesRef.current.has(id);
    editedCaloriesRef.current.delete(id);
    try {
      await persistFoodLog(foodLog.map((e) => (e.id === id ? { ...e, estimatedCalories: cleaned } : e)));
      if (wasEdited) await rememberCalories(entry.foodName, cleaned);
    } catch (e) {
      flashSaved("更新失敗，請再試一次");
    }
  }

  async function handleResetAll() {
    try {
      await window.storage.delete("profile", false);
    } catch (e) {}
    try {
      await window.storage.delete("body-records", false);
    } catch (e) {}
    try {
      await window.storage.delete("food-log", false);
    } catch (e) {}
    try {
      await window.storage.delete("water-log", false);
    } catch (e) {}
    try {
      await window.storage.delete("exercise-log", false);
    } catch (e) {}
    try {
      // Otherwise the garden keeps standing on records that no longer exist.
      await resetGarden();
    } catch (e) {}
    try {
      await window.storage.delete(KEYS.foodMemory, false);
    } catch (e) {}
    try {
      await window.storage.delete(KEYS.healthReports, false);
    } catch (e) {}
    try {
      await window.storage.delete(KEYS.workoutLinks, false);
    } catch (e) {}
    try {
      await window.storage.delete(KEYS.clinicVisits, false);
    } catch (e) {}
    try {
      await window.storage.delete(KEYS.examPlans, false);
    } catch (e) {}
    setProfile(null);
    setRecords([]);
    setFoodLog([]);
    setFoodMemory([]);
    setReports([]);
    setWorkoutLinks({});
    setVisits([]);
    setExamPlans([]);
    setWaterLog([]);
    setExerciseLog([]);
    setForm({
      nickname: "",
      avatar: "",
      age: "",
      gender: "female",
      height: "",
      weight: "",
      symptoms: [],
      vigorousChecked: false,
      vigorousMinutes: "",
      moderateChecked: false,
      moderateMinutes: "",
      lightChecked: false,
      lightMinutes: "",
    });
    setShowReset(false);
    setTab("overview");
  }

  async function handleExportBackup() {
    let blob;
    try {
      // Assembled by lib/storage.js so the file always carries every field
      // a restore knows how to read. Listing them here by hand is how the
      // corrected calorie figures went missing from the download.
      const backup = buildBackupFrom({
        profile,
        records,
        foodLog,
        waterLog,
        exerciseLog,
        dailySummary: goalSummaries,
        foodMemory,
        healthReports: reports,
        workoutLinks,
        clinicVisits: visits,
        examPlans,
      });
      blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    } catch (e) {
      flashSaved("匯出失敗，請再試一次");
      return;
    }

    const filename = `healthy-care-backup-${todayStr()}.json`;

    // Prefer the native share sheet when available (iOS Safari): this lets
    // the person pick "Save to Drive" / "Save to Files → Google Drive"
    // directly, instead of only downloading into the browser's Downloads.
    try {
      const file = new File([blob], filename, { type: "application/json" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "Healthy Care 資料備份" });
        flashSaved("備份已開啟分享選單");
        return;
      }
    } catch (e) {
      // AbortError just means the person cancelled the share sheet — that's
      // fine, don't fall back to a forced download in that case.
      if (e && e.name === "AbortError") return;
      /* otherwise fall through to the direct-download fallback below */
    }

    try {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      flashSaved("備份檔案已下載");
    } catch (e) {
      flashSaved("匯出失敗，請再試一次");
    }
  }

  async function handleImportBackup(file) {
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      let restoredParts = [];

      if (data.profile && typeof data.profile === "object") {
        await window.storage.set("profile", JSON.stringify(data.profile), false);
        setProfile(data.profile);
        setForm({
          age: "",
          gender: "female",
          height: "",
          weight: "",
          symptoms: [],
          vigorousChecked: false,
          vigorousMinutes: "",
          moderateChecked: false,
          moderateMinutes: "",
          lightChecked: false,
          lightMinutes: "",
          ...data.profile,
        });
        restoredParts.push("個人資料");
      }
      if (Array.isArray(data.records)) {
        await window.storage.set("body-records", JSON.stringify(data.records), false);
        setRecords(data.records);
        restoredParts.push("體態紀錄");
      }
      if (Array.isArray(data.foodLog)) {
        await window.storage.set("food-log", JSON.stringify(data.foodLog), false);
        setFoodLog(data.foodLog);
        restoredParts.push("飲食紀錄");
      }
      if (Array.isArray(data.waterLog)) {
        await window.storage.set("water-log", JSON.stringify(data.waterLog), false);
        setWaterLog(data.waterLog);
        restoredParts.push("喝水紀錄");
      }
      if (Array.isArray(data.exerciseLog)) {
        await window.storage.set("exercise-log", JSON.stringify(data.exerciseLog), false);
        setExerciseLog(data.exerciseLog);
        restoredParts.push("運動紀錄");
      }
      if (Array.isArray(data.healthReports)) {
        setReports(await saveReports(data.healthReports));
        restoredParts.push("健檢報告");
      }
      if (data.workoutLinks && typeof data.workoutLinks === "object") {
        setWorkoutLinks(await saveWorkoutLinks(data.workoutLinks));
      }
      if (Array.isArray(data.clinicVisits)) {
        setVisits(await saveVisits(data.clinicVisits));
        restoredParts.push("就醫紀錄");
      }
      if (Array.isArray(data.examPlans)) {
        setExamPlans(await savePlans(data.examPlans));
        restoredParts.push("排定的檢查");
      }
      if (Array.isArray(data.foodMemory)) {
        // Saved through the same repair pass a normal load uses — a backup
        // file is editable, and a nonsense figure here would land in meals.
        setFoodMemory(await saveFoodMemory(data.foodMemory));
        restoredParts.push("熱量標準值");
      }

      // A backup made before the garden existed has no summary. Passing
      // undefined tells the hook to clear the rebuild flag so the one-time
      // backfill runs again over the logs just restored.
      await restoreSummaries(Array.isArray(data.dailySummary) ? data.dailySummary : undefined);
      if (Array.isArray(data.dailySummary)) {
        restoredParts.push(`達標紀錄 ${data.dailySummary.length} 天`);
      }

      if (restoredParts.length === 0) {
        flashSaved("這個檔案裡沒有可還原的資料");
      } else {
        flashSaved(`已還原：${restoredParts.join("、")}`);
      }
    } catch (e) {
      flashSaved("還原失敗，檔案格式不正確");
    }
  }

  async function handleSaveApiKey() {
    const trimmed = apiKeyInput.trim();
    try {
      if (!trimmed) {
        await window.storage.delete("anthropic-api-key", false);
        setApiKey("");
        flashSaved("已清除 API Key");
        return;
      }
      const res = await window.storage.set("anthropic-api-key", trimmed, false);
      if (res) {
        setApiKey(trimmed);
        flashSaved("API Key 已儲存在此裝置");
      }
    } catch (e) {
      flashSaved("儲存失敗，請再試一次");
    }
  }

  async function handleClearApiKey() {
    try {
      await window.storage.delete("anthropic-api-key", false);
    } catch (e) {}
    setApiKey("");
    setApiKeyInput("");
    flashSaved("已清除 API Key");
  }

  async function handleSaveGeminiKey() {
    const trimmed = geminiKeyInput.trim();
    try {
      if (!trimmed) {
        await window.storage.delete("gemini-api-key", false);
        setGeminiKey("");
        flashSaved("已清除 Gemini API Key");
        return;
      }
      const res = await window.storage.set("gemini-api-key", trimmed, false);
      if (res) {
        setGeminiKey(trimmed);
        flashSaved("Gemini API Key 已儲存在此裝置");
      }
    } catch (e) {
      flashSaved("儲存失敗，請再試一次");
    }
  }

  async function handleClearGeminiKey() {
    try {
      await window.storage.delete("gemini-api-key", false);
    } catch (e) {}
    setGeminiKey("");
    setGeminiKeyInput("");
    flashSaved("已清除 Gemini API Key");
  }

  async function handleSaveGeminiModel() {
    const trimmed = geminiModelInput.trim();
    try {
      if (!trimmed) {
        await window.storage.delete("gemini-model", false);
        setGeminiModel("");
        return;
      }
      await window.storage.set("gemini-model", trimmed, false);
      setGeminiModel(trimmed);
      flashSaved("模型名稱已更新");
    } catch (e) {
      flashSaved("儲存失敗，請再試一次");
    }
  }

  async function handleChangeProvider(next) {
    setAiProvider(next);
    try {
      await window.storage.set("ai-provider", next, false);
    } catch (e) {}
  }

  async function handleSaveCalorieOverride(value) {
    const trimmed = String(value).trim();
    try {
      if (!trimmed) {
        await window.storage.delete("calorie-target-override", false);
        setCalorieOverride("");
        setCalorieOverrideInput("");
        return;
      }
      await window.storage.set("calorie-target-override", trimmed, false);
      setCalorieOverride(trimmed);
      setCalorieOverrideInput(trimmed);
      flashSaved("已設定自訂熱量目標");
    } catch (e) {
      flashSaved("儲存失敗，請再試一次");
    }
  }

  async function handleClearCalorieOverride() {
    try {
      await window.storage.delete("calorie-target-override", false);
    } catch (e) {}
    setCalorieOverride("");
    setCalorieOverrideInput("");
    flashSaved("已改回系統計算值");
  }

  const latestRecord = records.length ? records[records.length - 1] : null;
  const bmiWeight = latestRecord?.weight != null && latestRecord.weight !== "" ? latestRecord.weight : profile?.weight;
  const bmi = useMemo(() => calcBMI(bmiWeight, profile?.height), [bmiWeight, profile]);
  const bmiCat = bmiCategory(bmi);
  const riskScore = useMemo(() => calcRiskScore(profile), [profile]);
  const zone = riskZone(riskScore);
  const exercisePlan = useMemo(() => buildExercisePlan(profile), [profile]);
  const exerciseWeeklyFeedback = useMemo(
    () => buildExerciseWeeklyFeedback(exerciseLog, exercisePlan.weeklyMinutesTarget),
    [exerciseLog, exercisePlan.weeklyMinutesTarget]
  );
  const weeklyExerciseChartData = useMemo(() => buildWeeklyExerciseChartData(exerciseLog), [exerciseLog]);
  const thisWeekExerciseEntries = useMemo(() => {
    const cutoff = daysAgoStr(6);
    return exerciseLog.filter((e) => e.date >= cutoff).sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [exerciseLog]);

  const chartData = records.map((r) => ({
    date: r.date.slice(5),
    weight: r.weight,
    bmi: r.bmi != null ? r.bmi : profile?.height && r.weight ? Number(calcBMI(r.weight, profile.height).toFixed(1)) : null,
    waist: r.waist != null ? r.waist : null,
    bodyFat: r.bodyFat != null ? r.bodyFat : null,
    skeletalMuscle: r.skeletalMuscle != null ? r.skeletalMuscle : null,
    sleepHours: r.sleepHours != null ? r.sleepHours : null,
  }));

  const calorieBreakdown = useMemo(() => calcDailyCalorieTargetBreakdown(profile, latestRecord), [profile, latestRecord]);
  const calorieOverrideValue = calorieOverride && !isNaN(Number(calorieOverride)) ? Number(calorieOverride) : null;
  const dailyCalorieTarget = calorieOverrideValue != null ? calorieOverrideValue : calorieBreakdown ? calorieBreakdown.target : null;

  /* Today's verdict against the three conditions, and the garden rolled up
   * from every day recorded so far. `ready` holds the one-time rebuild back
   * until the app's own data has finished loading — running it against empty
   * logs would record a month of days as unmet. */
  const {
    today: todayGoals,
    garden,
    summaries: goalSummaries,
    recordDay: recordGardenDay,
    restoreSummaries,
    resetGarden,
    backfillReport,
    dismissBackfillReport,
  } = useGarden({
    foodLog,
    waterLog,
    exerciseLog,
    calorieTarget: dailyCalorieTarget,
    ready: !loading,
  });

  /* The morning greeting or the evening summary, whichever the clock calls
   * for. Nothing shows in between — the three rows say it better by then. */
  const slot = coachSlot();
  const coachKey = `${todayStr()}:${slot || "none"}`;
  const coachVisible = Boolean(slot) && coachDismissed !== coachKey;
  const coachMorning = useMemo(
    () =>
      slot === "morning"
        ? dailyMessage({
            dateStr: todayStr(),
            nickname: (profile && profile.nickname) || "",
            hour: new Date().getHours(),
          })
        : null,
    [slot, profile]
  );
  const coachEvening = useMemo(
    () =>
      slot === "evening"
        ? eveningSummary({ day: todayGoals, garden, nickname: (profile && profile.nickname) || "" })
        : null,
    [slot, todayGoals, garden, profile]
  );

  async function dismissCoach() {
    setCoachDismissed(coachKey);
    try {
      await window.storage.set("coach-dismissed", coachKey, false);
    } catch (e) {
      /* dismissing is a convenience; losing it is harmless */
    }
  }
  const todayEntries = useMemo(() => foodLog.filter((e) => e.date === todayStr()), [foodLog]);
  const recentFoodEntries = useMemo(() => {
    const cutoff = daysAgoStr(6);
    return foodLog
      .filter((e) => e.date >= cutoff)
      .sort((a, b) => {
        if (a.date !== b.date) return a.date < b.date ? 1 : -1;
        return (b.time || "").localeCompare(a.time || "");
      });
  }, [foodLog]);
  const consumedToday = useMemo(
    () => todayEntries.reduce((sum, e) => sum + (Number(e.estimatedCalories) || 0), 0),
    [todayEntries]
  );
  const remainingToday = dailyCalorieTarget != null ? dailyCalorieTarget - consumedToday : null;
  const calZone = calorieZone(consumedToday, dailyCalorieTarget);
  const weeklyCalorieData = useMemo(() => buildWeeklyCalorieData(foodLog), [foodLog]);

  const waterBreakdown = useMemo(() => calcWaterTargetBreakdown(profile, latestRecord), [profile, latestRecord]);
  const waterTarget = waterBreakdown ? waterBreakdown.target : null;
  const todayWaterEntries = useMemo(() => waterLog.filter((e) => e.date === todayStr()), [waterLog]);
  const recentWaterEntries = useMemo(() => {
    const cutoff = daysAgoStr(6);
    return waterLog.filter((e) => e.date >= cutoff).sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [waterLog]);
  const weeklyWaterChartData = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) days.push(daysAgoStr(i));
    return days.map((d) => {
      const entry = waterLog.find((e) => e.date === d);
      return { date: d.slice(5), total: entry ? Math.round(entry.amountMl) : 0 };
    });
  }, [waterLog]);
  const consumedWaterToday = useMemo(
    () => todayWaterEntries.reduce((sum, e) => sum + (Number(e.amountMl) || 0), 0),
    [todayWaterEntries]
  );

  if (loading) {
    return (
      <div className="app-shell app-loading">
        <div className="loading-dot" />
        <span>載入中…</span>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@600;700&family=Noto+Sans+TC:wght@400;500;700&family=JetBrains+Mono:wght@500;700&display=swap');

        :root{
          --paper:#F3F5F1;
          --card:#FFFFFF;
          --ink:#1E2A22;
          --ink-soft:#5B6960;
          --brand:#2F6F5E;
          --brand-soft:#E1EEE8;
          --amber:#B8863A;
          --amber-soft:#F6ECDA;
          --line:#DCE3DC;
          --green:#2F9E44;
          --green-soft:#E4F5E7;
          --yellow:#C9891F;
          --yellow-soft:#FBF0DC;
          --red:#C63C34;
          --red-soft:#FAE6E3;

          /* Plant and garden. Greens are pulled toward the existing brand
             green so the sprout belongs to the same app, not a sticker on it. */
          --leaf:#4E8A63;
          --leaf-dk:#3B6B4C;
          --leaf-dull:#8FA096;
          --leaf-bright:#63A87A;
          --stem:#4A7A57;
          --stem-dull:#8B968E;
          --soil:#9A7A5C;
          --soil-dk:#7C6049;
          --stone:#B3AB9C;
          --bloom:#D98C6A;
          --bloom-mid:#EFC98F;
          --glow:#F2EBD8;
          --surface-2:#F0F3EE;
          --surface-3:#DDE5DD;

          /* The three daily conditions keep one colour each, everywhere. */
          --cal:#D2554B;
          --cal-over:#9E2F26;
          --move:#2F6F5E;
          --water:#3E7EA6;
        }

        /* --- identity: avatar + nickname --- */
        .identity-row{
          display:flex; align-items:flex-start; gap:16px;
          padding-bottom:16px; margin-bottom:16px;
          border-bottom:1px solid var(--line);
        }
        .identity-name{ flex:1; min-width:0; }
        .field-hint{
          margin:5px 0 0; font-size:11px; color:var(--ink-soft); line-height:1.5;
        }
        .avatar-picker{ display:flex; flex-direction:column; align-items:center; gap:6px; }
        .avatar-frame{
          position:relative; border-radius:50%; overflow:hidden;
          background:var(--surface-2); border:2px solid var(--line);
          flex:0 0 auto;
        }
        .avatar-frame img{ width:100%; height:100%; object-fit:cover; display:block; }
        /* The sprout stands in until a picture is picked — an empty circle or a
           grey silhouette would be the least characterful thing in the app. */
        .avatar-fallback{
          width:100%; height:100%; display:flex; align-items:center; justify-content:center;
          padding:6px; box-sizing:border-box;
        }
        .avatar-edit{
          position:absolute; right:-2px; bottom:-2px;
          width:26px; height:26px; border-radius:50%;
          border:2px solid var(--card); background:var(--brand); color:#fff;
          display:flex; align-items:center; justify-content:center;
          cursor:pointer; padding:0;
        }
        .avatar-actions{ display:flex; align-items:center; gap:8px; }
        .avatar-link{
          border:none; background:none; padding:0; cursor:pointer;
          font-size:11.5px; font-family:inherit; color:var(--brand);
        }
        .avatar-link-quiet{
          color:var(--ink-soft); display:inline-flex; align-items:center; gap:3px;
        }
        .avatar-error{ font-size:11px; color:var(--red); text-align:center; }
        .avatar-input{ display:none; }

        /* --- the morning line and the evening summary --- */
        .coach{
          background:var(--card); border:1px solid var(--line);
          border-radius:16px; padding:14px 16px 16px; margin-bottom:14px;
        }
        .coach-morning{ background:var(--amber-soft); border-color:#EBDCC0; }
        .coach-evening{ background:var(--brand-soft); border-color:#CFE3DA; }
        .coach-head{ display:flex; align-items:center; gap:7px; }
        .coach-icon{ display:inline-flex; color:var(--ink-soft); }
        .coach-morning .coach-icon{ color:var(--amber); }
        .coach-evening .coach-icon{ color:var(--brand); }
        .coach-title{
          font-size:12px; font-weight:700; letter-spacing:.04em; color:var(--ink-soft);
        }
        .coach-close{
          margin-left:auto; border:none; background:none; padding:4px; cursor:pointer;
          color:var(--ink-soft); display:flex; min-width:28px; min-height:28px;
          align-items:center; justify-content:center;
        }
        .coach-greeting{
          margin-top:7px; font-size:13px; color:var(--ink-soft);
        }
        .coach-body{ display:flex; align-items:center; gap:11px; margin-top:8px; }
        /* A saying, not a UI string: a touch more line height and a quiet
           left rule so it reads as quoted rather than as app copy. */
        .coach-quote{
          font-size:15.5px; line-height:1.85;
          padding-left:11px; border-left:2px solid rgba(184,134,58,.35);
        }
        .coach-avatar{
          width:38px; height:38px; border-radius:50%; object-fit:cover;
          flex:0 0 38px; border:1.5px solid rgba(255,255,255,.8);
        }
        .coach-line{
          margin:0; font-size:15px; line-height:1.6; color:var(--ink); flex:1;
        }
        .coach-cols{ display:flex; flex-direction:column; gap:10px; margin-top:14px; }
        .coach-col-title{
          font-size:11.5px; font-weight:700; letter-spacing:.03em; margin-bottom:4px;
        }
        .coach-col-good .coach-col-title{ color:var(--brand); }
        .coach-col-watch .coach-col-title{ color:var(--amber); }
        .coach-col ul{ margin:0; padding-left:1.15em; }
        .coach-col li{
          font-size:13px; line-height:1.65; color:var(--ink); margin-bottom:2px;
        }

        .growth-card{ padding:0; overflow:hidden; }
        .growth-switch{
          display:flex; gap:4px; padding:10px 10px 0;
        }
        .growth-switch-btn{
          flex:1; min-height:38px; border:none; border-radius:10px;
          background:transparent; color:var(--ink-soft);
          font-size:14px; font-family:inherit; cursor:pointer;
        }
        .growth-switch-btn.on{ background:var(--brand-soft); color:var(--brand); font-weight:600; }
        /* Held to a fixed height so the illustration stays a modest header.
           At full width it dominated the card, and every rough edge scaled up
           with it. */
        .growth-scene{
          margin:10px 10px 0; border-radius:14px; overflow:hidden;
          background:var(--surface-2); border:1px solid var(--line);
        }
        /* The sprout is capped so the illustration stays a modest header; at
           full width it dominated the card and every rough edge scaled with it. */
        .growth-scene.is-sprout{
          /* 118 rather than 160: it is a header, not the content. The plant is
             drawn to fill its own canvas, so it simply renders smaller —
             nothing is cropped. */
          height:118px; display:flex; align-items:center; justify-content:center;
          background:#FBF8EE;
        }
        .growth-scene.is-sprout svg{ height:100%; width:auto; max-width:100%; }
        /* The garden is a landscape — it keeps its own aspect. */
        .growth-scene.is-garden svg{ width:100%; height:auto; }
        .avatar-fallback svg{ width:100%; height:auto; }
        .growth-status{ padding:14px 16px 0; text-align:center; }
        .growth-head{
          font-size:21px; font-weight:700; letter-spacing:-.01em; line-height:1.3;
        }
        .growth-head.tone-done{ color:var(--brand); }
        .growth-head.tone-part{ color:var(--ink); }
        .growth-head.tone-none{ color:var(--ink); }
        .growth-mood{ margin-top:2px; font-size:13px; color:var(--ink-soft); }

        .ring-legend{ display:flex; flex-direction:column; gap:2px; padding:14px 16px 0; }
        .ring-legend.compact{ padding:12px 16px 0; }
        /* Three columns: the character, the reading, the verdict. A grid
           rather than a flex row because the verdict has to hold the right
           edge at every width — when this was one flex row that could wrap,
           a narrow screen left 「達標」 stranded on a line by itself. */
        .ring-row{
          display:grid;
          grid-template-columns:auto minmax(0,1fr) auto;
          align-items:center; gap:2px 8px;
          font-size:14px; color:var(--ink-soft);
          padding:6px 9px; border-radius:10px; background:var(--surface-2);
        }
        .ring-main{
          display:flex; flex-wrap:wrap; align-items:baseline; gap:0 6px;
          min-width:0;
        }
        .ring-ico{
          flex:0 0 32px; width:32px; height:32px; align-self:center;
          display:flex; align-items:center; justify-content:center;
        }
        .ring-ico svg{ width:32px; height:32px; }
        .ring-dot{ width:9px; height:9px; border-radius:50%; flex:0 0 9px; align-self:center; }
        .ring-k{ width:34px; flex:0 0 34px; color:var(--ink); }
        .ring-v{ font-size:16px; font-weight:700; color:var(--ink); font-variant-numeric:tabular-nums; }
        .ring-g{ font-size:12px; white-space:nowrap; }
        /* The shortfall is the point of the row, so it holds the right edge
           and stays legible rather than trailing off in small grey text. */
        .ring-gap{
          justify-self:end; font-size:13px; font-weight:500;
          color:var(--amber); white-space:nowrap;
        }
        .ring-done{
          justify-self:end; display:inline-flex; align-items:center; gap:4px;
          font-size:12.5px; color:var(--brand); align-self:center;
        }
        .ring-row.met{ background:var(--brand-soft); }
        .ring-row.met .ring-v{ color:var(--brand); }

        .growth-progress{ padding:14px 16px 0; }
        .growth-progress-head{
          display:flex; justify-content:space-between; align-items:baseline;
          font-size:12.5px; color:var(--ink-soft); margin-bottom:6px;
        }
        .growth-progress-head b{ color:var(--ink); font-variant-numeric:tabular-nums; }
        .growth-bar{ height:6px; border-radius:3px; background:var(--surface-3); overflow:hidden; }
        .growth-bar i{ display:block; height:100%; border-radius:3px; background:var(--brand); }

        /* Eight steps on a phone width: the labels have to be allowed to sit
           tight, and the last one ("森林之樹") is wider than the rest. */
        .stage-track{ display:flex; justify-content:space-between; margin-top:10px; gap:2px; }
        .stage-dot{ display:flex; flex-direction:column; align-items:center; gap:4px; flex:1 1 0; min-width:0; }
        .stage-mark{
          width:9px; height:9px; border-radius:50%;
          background:var(--surface-3); border:1.5px solid var(--surface-3);
        }
        .stage-dot.reached .stage-mark{ background:var(--brand); border-color:var(--brand); }
        .stage-label{
          font-size:9.5px; color:var(--ink-soft);
          white-space:normal; word-break:break-all;
          line-height:1.2; min-height:2.4em; display:block;
        }
        .stage-dot.reached .stage-label{ color:var(--brand); font-weight:600; }

        .gauge-caveat{
          margin-top:8px; font-size:11.5px; color:var(--ink-soft);
          line-height:1.6; text-align:center;
        }
        .growth-note{ padding:10px 16px 0; font-size:13.5px; color:var(--ink-soft); text-align:center; }
        .garden-note{ padding-bottom:16px; }
        .growth-link{
          display:block; width:calc(100% - 32px); margin:12px 16px 16px;
          min-height:44px; border:1px solid var(--line); border-radius:12px;
          background:transparent; color:var(--brand); font-size:14px;
          font-family:inherit; cursor:pointer;
        }

        .diary-hint{
          font-size:11.5px; color:var(--ink-soft); line-height:1.6;
          margin:-4px 0 14px;
        }
        .diary-day{ padding-bottom:6px; }
        .diary-day + .diary-day{
          border-top:1px solid var(--line); margin-top:18px; padding-top:16px;
        }
        .diary-day-head{ margin-bottom:12px; }
        .diary-day-top{ display:flex; align-items:baseline; gap:8px; }
        .diary-date{ font-size:20px; font-weight:700; color:var(--ink); }
        .diary-weekday{ font-size:12px; color:var(--ink-soft); }
        .diary-met{
          margin-left:auto; font-size:11px; padding:2px 8px; border-radius:999px;
          background:var(--brand-soft); color:var(--brand); font-weight:600;
        }
        .diary-sum{
          margin-top:4px; display:flex; align-items:baseline; gap:4px;
          font-size:12px; color:var(--ink-soft);
        }
        .diary-sum b{
          font-size:15px; color:var(--ink); font-variant-numeric:tabular-nums;
        }
        .diary-remain{ margin-left:auto; color:var(--brand); }
        .diary-remain.over{ color:var(--red); }
        .diary-bar{
          margin-top:7px; height:5px; border-radius:3px;
          background:var(--surface-3); overflow:hidden;
        }
        .diary-bar i{ display:block; height:100%; border-radius:3px; background:var(--amber); }
        .diary-bar i.over{ background:var(--cal-over); }

        .diary-post{ margin-bottom:16px; }
        .diary-post:last-child{ margin-bottom:4px; }
        /* 4:3 — the shape a phone camera actually produces, so a landscape
           photo shows essentially uncropped. The earlier letterbox was sized
           to a sixth of the screen but cut the top and bottom off every shot. */
        .diary-photo{
          aspect-ratio:4 / 3; border-radius:12px; overflow:hidden;
          background:var(--surface-2); border:1px solid var(--line);
          margin-bottom:8px;
        }
        .diary-photo img{ width:100%; height:100%; object-fit:cover; display:block; }
        /* An expired photo should not reserve a full 4:3 of empty space —
           past the photo window every entry would be a big blank box. */
        .diary-photo-gone{
          aspect-ratio:auto; padding:14px 0;
          display:flex; align-items:center; justify-content:center; gap:8px;
          color:var(--ink-soft); font-size:12px;
          border-style:dashed;
        }
        .diary-meta{
          display:flex; align-items:center; gap:8px;
          font-size:11.5px; color:var(--ink-soft);
        }
        .diary-cal{ margin-left:auto; display:inline-flex; align-items:center; gap:3px; }
        .diary-edit-icon{ color:var(--ink-soft); flex:0 0 auto; }
        .diary-del{ flex:0 0 auto; }
        .diary-name{ margin-top:5px; font-size:14.5px; color:var(--ink); line-height:1.5; }
        .diary-note{ margin-top:3px; font-size:12.5px; color:var(--ink-soft); line-height:1.65; }

        .diary-more{
          display:flex; align-items:center; justify-content:center; gap:6px;
          width:100%; min-height:44px; margin-top:10px;
          border:1px solid var(--line); border-radius:12px;
          background:transparent; color:var(--brand);
          font-size:13.5px; font-family:inherit; cursor:pointer;
        }

        .activity-card .section-title{ padding:0 0 4px; }
        .rings-wrap{ display:flex; justify-content:center; padding:2px 0 0; }
        .activity-card .ring-legend{ padding:10px 0 0; }
        .activity-verdict{
          margin-top:10px; padding:8px 12px; border-radius:10px;
          background:var(--brand-soft); color:var(--brand);
          font-size:13px; text-align:center;
        }

        /* Three metrics, Apple Fitness style: the figure is the biggest thing
           on the block and carries the metric's colour; the goal sits under it
           so the denominator is stated rather than implied by a ring's fill. */
        .ring-metrics{
          display:grid; grid-template-columns:repeat(3,1fr);
          gap:6px; margin-top:10px;
        }
        .ring-metric{
          display:flex; flex-direction:column; align-items:center; gap:0;
          /* 「/ 1,500 大卡以下」 is far the longest of the three, so the blocks
             take all the width the row has rather than sitting in comfortable
             padding — at 320px the difference is whether it wraps. */
          padding:7px 3px 8px; border-radius:12px; background:var(--surface-2);
        }
        /* The character is what makes these read as a state rather than a
           table, so it shrinks rather than going away. */
        .rm-icon{ margin-bottom:0; transform:scale(.82); height:26px; }
        .ring-metric.met{ background:var(--brand-soft); }
        .rm-label{
          display:inline-flex; align-items:center; gap:3px;
          font-size:11px; font-weight:700; letter-spacing:.03em;
        }
        .rm-value{
          font-size:21px; font-weight:700; line-height:1.15;
          font-variant-numeric:tabular-nums; letter-spacing:-.02em;
        }
        .rm-goal{
          font-size:10px; color:var(--ink-soft); font-variant-numeric:tabular-nums;
          text-align:center; line-height:1.35;
        }
        .rm-goal span{ white-space:nowrap; }

        .week-block{ margin-top:18px; }
        /* On its own now, so it brings its own top spacing rather than
           inheriting a gap meant for sitting under something. */
        .activity-week-card .week-block{ margin-top:0; }
        .week-head{
          display:flex; justify-content:space-between; align-items:baseline;
          font-size:12.5px; color:var(--ink-soft); margin-bottom:8px;
        }
        .week-head b{ color:var(--ink); font-variant-numeric:tabular-nums; }
        .week-grid{
          display:grid; grid-template-columns:30px repeat(7,1fr);
          gap:5px; align-items:center;
        }
        .week-wd{ font-size:10.5px; color:var(--ink-soft); text-align:center; }
        .week-wd.today{ color:var(--brand); font-weight:700; }
        .week-rl{ font-size:10.5px; color:var(--ink-soft); text-align:right; padding-right:2px; }
        .week-cell{ height:18px; border-radius:5px; display:block; }
        .week-cell.missed{ background:var(--surface-3); }
        .week-cell.unknown{
          background:transparent; border:1px dashed var(--line);
        }
        .week-cell.sample{ width:14px; height:12px; display:inline-block; vertical-align:-1px; }
        .week-cell.sample.met{ background:var(--brand); }
        .week-legend{
          display:flex; gap:14px; margin-top:8px;
          font-size:11px; color:var(--ink-soft);
        }
        .week-legend span{ display:inline-flex; align-items:center; gap:5px; }
        .week-note{ margin-top:8px; font-size:11.5px; color:var(--ink-soft); line-height:1.6; }

        .garden-stats{ display:grid; grid-template-columns:repeat(3,1fr); gap:8px; padding:14px 16px 0; }
        .garden-stat{ display:flex; flex-direction:column; align-items:center; gap:1px; }
        .gs-v{ font-size:22px; font-weight:700; color:var(--ink); font-variant-numeric:tabular-nums; }
        .garden-stat:first-child .gs-v{ color:var(--brand); }
        .gs-k{ font-size:11px; color:var(--ink-soft); }

        .diabetes-app *{ box-sizing:border-box; }
        .diabetes-app{
          font-family:'Noto Sans TC', sans-serif;
          color:var(--ink);
          background:var(--paper);
        }
        .app-shell{
          /* width + min-width:0 are the guard rails: without them one
             un-shrinkable row inside makes the whole page wider than the
             screen, and the only way to read it is to pinch-zoom out. */
          width:100%;
          min-width:0;
          max-width:480px;
          margin:0 auto;
          min-height:100vh;
          display:flex;
          flex-direction:column;
          background:var(--paper);
          position:relative;
        }
        .app-loading{
          align-items:center;
          justify-content:center;
          flex-direction:row;
          gap:8px;
          color:var(--ink-soft);
          height:100vh;
        }
        .loading-dot{
          width:8px;height:8px;border-radius:50%;background:var(--brand);
          animation:pulse 1s infinite ease-in-out;
        }
        @keyframes pulse{ 0%,100%{opacity:.3;} 50%{opacity:1;} }

        /* A solid strip behind the status bar.
           The header scrolls away with the page, and under a translucent status
           bar that would leave whatever is scrolling past sliding beneath the
           clock and the battery. Fixed rather than part of the layout, so it
           keeps that strip opaque without costing a pixel of height. Below the
           modal backdrop (z-index 100) on purpose: a dialog is allowed to cover
           the whole screen. */
        .app-shell::before{
          content:"";
          position:fixed;
          top:0;
          left:0;
          right:0;
          height:env(safe-area-inset-top);
          background:var(--card);
          z-index:60;
          pointer-events:none;
        }

        .app-header{
          /* index.html asks for viewport-fit=cover and a translucent status
             bar. That is what lets the header colour run right to the top edge
             of an iPhone — but it also means the web view starts UNDERNEATH the
             clock and the battery, and nothing here accounted for it, so the
             title sat behind them. env() adds exactly the strip the phone
             reserves, and resolves to 0 where there is nothing to avoid, so
             desktop and Android are unaffected. */
          padding:calc(18px + env(safe-area-inset-top)) calc(20px + env(safe-area-inset-right)) 14px
            calc(20px + env(safe-area-inset-left));
          border-bottom:1px solid var(--line);
          background:var(--card);
        }
        .app-title{
          font-family:'Noto Serif TC', serif;
          font-weight:700;
          font-size:20px;
          letter-spacing:.02em;
          margin:0;
          display:flex;
          align-items:baseline;
          gap:8px;
        }
        .app-title small{
          font-family:'Noto Sans TC', sans-serif;
          font-weight:500;
          font-size:11px;
          color:var(--ink-soft);
        }

        .app-main{
          flex:1;
          overflow-y:auto;
          padding:16px 16px 96px;
        }

        .section-title-ico{
          display:inline-flex; align-items:center; gap:7px;
        }
        .section-title-ico svg{ flex:0 0 auto; color:var(--brand); }
        .section-title{
          font-family:'Noto Serif TC', serif;
          font-weight:700;
          font-size:16px;
          margin:4px 0 10px;
        }

        .card{
          background:var(--card);
          border:1px solid var(--line);
          border-radius:16px;
          padding:16px;
          margin-bottom:14px;
        }

        .disclaimer{
          display:flex;
          gap:8px;
          align-items:flex-start;
          font-size:11.5px;
          line-height:1.5;
          color:var(--ink-soft);
          background:var(--brand-soft);
          border-radius:12px;
          padding:10px 12px;
          margin-bottom:14px;
        }
        .disclaimer svg{ flex-shrink:0; margin-top:2px; color:var(--brand); }
        .disclaimer-compact{ margin-top:10px; margin-bottom:0; }

        /* One row: the word, the number, and a chevron. Everything that
           explains them is behind the tap. */
        .risk-summary{
          display:flex; align-items:center; gap:8px; width:100%;
          padding:2px 0; border:none; background:none; cursor:pointer;
          font-family:'Noto Sans TC', sans-serif; text-align:left;
        }
        .risk-k{ font-size:13px; font-weight:700; color:var(--ink); }
        .risk-v{ font-size:13px; font-weight:700; }
        .risk-v.tone-green{ color:var(--green); }
        .risk-v.tone-yellow{ color:var(--yellow); }
        .risk-v.tone-red{ color:var(--red); }
        /* Pushed to the right so the chevron lands where a chevron belongs. */
        .risk-n{
          margin-left:auto; font-size:13px; font-weight:700; color:var(--ink-soft);
          font-variant-numeric:tabular-nums;
        }
        .risk-chev{ flex:none; color:var(--ink-soft); transition:transform .15s; }
        .risk-chev.open{ transform:rotate(180deg); }

        .gauge-wrap{
          display:flex;
          flex-direction:column;
          align-items:center;
          padding:4px 0 0;
        }
        .gauge-svg{ width:100%; max-width:200px; }
        .gauge-arc{ fill:none; stroke-width:18; stroke-linecap:round; }
        .gauge-arc-green{ stroke:var(--green); }
        .gauge-arc-yellow{ stroke:var(--yellow); }
        .gauge-arc-red{ stroke:var(--red); }
        .gauge-needle{ stroke:var(--ink); stroke-width:3; stroke-linecap:round; }
        .gauge-hub{ fill:var(--ink); }
        .gauge-score{
          font-family:'JetBrains Mono', monospace;
          font-size:30px;
          font-weight:700;
          fill:var(--ink);
        }
        .gauge-label{
          font-weight:700;
          font-size:14px;
          margin-top:2px;
        }
        .gauge-label.tone-green{ color:var(--green); }
        .gauge-label.tone-yellow{ color:var(--yellow); }
        .gauge-label.tone-red{ color:var(--red); }
        .gauge-advice{
          font-size:12.5px;
          color:var(--ink-soft);
          text-align:center;
          margin-top:6px;
          line-height:1.5;
        }

        .stat-grid{
          display:grid;
          grid-template-columns:repeat(2,1fr);
          gap:10px;
          margin-top:4px;
        }
        .stat-box{
          background:var(--brand-soft);
          border-radius:12px;
          padding:12px;
        }
        .stat-box .label{ font-size:11px; color:var(--ink-soft); margin-bottom:4px; }
        .stat-box .value{
          font-family:'JetBrains Mono', monospace;
          font-weight:700;
          font-size:20px;
        }
        .stat-box .value span{ font-size:12px; font-weight:500; margin-left:2px; }

        .empty-cta{
          text-align:center;
          padding:20px 10px;
        }
        .empty-cta p{ color:var(--ink-soft); font-size:13px; margin:0 0 12px; }

        .btn{
          display:inline-flex;
          align-items:center;
          justify-content:center;
          gap:6px;
          border:none;
          border-radius:10px;
          padding:10px 16px;
          font-family:'Noto Sans TC', sans-serif;
          font-weight:700;
          font-size:13.5px;
          cursor:pointer;
        }
        .btn-primary{ background:var(--brand); color:#fff; }
        .btn-secondary{ background:var(--brand-soft); color:var(--brand); }
        .btn-danger{ background:var(--red-soft); color:var(--red); }
        .btn-block{ width:100%; }

        .field{ margin-bottom:14px; }
        .field label{
          display:block;
          font-size:12.5px;
          font-weight:700;
          color:var(--ink-soft);
          margin-bottom:6px;
        }
        .field input, .field select{
          width:100%;
          border:1px solid var(--line);
          border-radius:10px;
          padding:10px 12px;
          font-size:14px;
          font-family:'Noto Sans TC', sans-serif;
          background:#fff;
          color:var(--ink);
        }
        /* One value that takes two numbers: a single bordered box split by a
           hairline, so it reads as one answer rather than two questions. The
           inputs lose their own border and inherit the box's. */
        .split-input{
          display:flex;
          align-items:stretch;
          border:1px solid var(--line);
          border-radius:10px;
          background:#fff;
          overflow:hidden;
        }
        .split-input:focus-within{ border-color:var(--brand); }
        .field .split-input input{
          flex:1 1 0;
          /* Flex children refuse to shrink below their content by default, and
             a number input's content includes its spinner — without this the
             two cells push the box past the card's edge at 320px. */
          min-width:0;
          width:auto;
          border:none;
          border-radius:0;
          background:transparent;
          text-align:center;
          padding-left:4px;
          padding-right:4px;
        }
        /* The hairline between the two cells is the whole visual idea, so the
           spinners have to go: at half a row's width they would eat the space
           the numbers need, and they are useless for a value typed once a day. */
        .field .split-input input::-webkit-outer-spin-button,
        .field .split-input input::-webkit-inner-spin-button{ -webkit-appearance:none; margin:0; }
        .field .split-input input[type="number"]{ -moz-appearance:textfield; }
        .field .split-input input + input{ border-left:1px solid var(--line); }
        .field .split-input input:focus{ outline:none; }

        .field-row{ display:grid; grid-template-columns:1fr 1fr; gap:10px; }
        /* Grid and flex children refuse to shrink below their content by
           default (min-width:auto), so one wide field pushes the whole row
           past the card's edge instead of the two columns sharing the space. */
        .field-row > .field{ min-width:0; }
        /* iOS renders date and time inputs as native controls sized by their
           own content and ignores width:100%, which pushed the 日期 field out
           over the right edge of the card. Turning the native appearance off
           makes them lay out like every other input here. Desktop browsers
           already fit, so this changes nothing there. */
        .field input[type="date"], .field input[type="time"]{
          -webkit-appearance:none;
          appearance:none;
          display:block;
          min-width:0;
          max-width:100%;
          text-align:left;
        }

        .chip-grid{ display:flex; flex-wrap:wrap; gap:8px; }
        .chip{
          border:1px solid var(--line);
          background:#fff;
          border-radius:999px;
          padding:7px 13px;
          font-size:12.5px;
          cursor:pointer;
          color:var(--ink-soft);
        }
        .chip.active{
          background:var(--brand);
          border-color:var(--brand);
          color:#fff;
        }

        .segmented{ display:flex; gap:8px; }
        .segmented .chip{ flex:1; text-align:center; }

        .intensity-row{
          display:flex;
          align-items:center;
          gap:10px;
          margin-bottom:8px;
        }
        .intensity-check{
          display:flex;
          align-items:center;
          gap:6px;
          font-size:13.5px;
          font-weight:700;
          color:var(--ink);
          min-width:56px;
        }
        .intensity-check input[type="checkbox"]{
          width:18px;
          height:18px;
          accent-color:var(--brand);
        }
        .intensity-minutes{
          width:80px;
          border:1px solid var(--line);
          border-radius:8px;
          padding:7px 10px;
          font-size:13px;
        }
        .intensity-minutes:disabled{ background:var(--paper); color:var(--ink-soft); }
        .intensity-unit{ font-size:12px; color:var(--ink-soft); }

        .pill{
          display:inline-flex;
          align-items:center;
          border-radius:999px;
          padding:4px 10px;
          font-size:11px;
          font-weight:700;
          white-space:nowrap;
        }
        .pill-green{ background:var(--green-soft); color:var(--green); }
        .pill-yellow{ background:var(--yellow-soft); color:var(--yellow); }
        .pill-red{ background:var(--red-soft); color:var(--red); }

        .food-cat{ margin-bottom:16px; }
        .food-cat:last-child{ margin-bottom:0; }
        .food-cat-name{
          font-family:'Noto Serif TC', serif;
          font-weight:700;
          font-size:14.5px;
          margin-bottom:4px;
        }
        .food-cat-tip{
          font-size:11.5px;
          color:var(--ink-soft);
          margin-bottom:8px;
          line-height:1.5;
        }
        .food-item-row{
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:10px;
          padding:8px 0;
          border-top:1px solid var(--line);
        }
        .food-item-row:first-of-type{ border-top:none; }
        .food-item-name{ font-size:13px; }

        .caution-list{ margin:0; padding-left:18px; font-size:12.5px; color:var(--ink-soft); line-height:1.6; }
        .caution-list li{ margin-bottom:4px; }

        table.plan-table{ width:100%; border-collapse:collapse; font-size:12.5px; }
        table.plan-table th{
          text-align:left;
          font-size:11px;
          color:var(--ink-soft);
          padding:6px 4px;
          border-bottom:1px solid var(--line);
        }
        table.plan-table td{
          padding:8px 4px;
          border-bottom:1px solid var(--line);
          vertical-align:top;
        }
        table.plan-table td.day-cell{ font-weight:700; white-space:nowrap; }

        .habit-list{ margin:10px 0 0; padding-left:18px; font-size:12.5px; line-height:1.6; }

        .record-row{
          display:flex;
          align-items:center;
          justify-content:space-between;
          padding:10px 0;
          border-top:1px solid var(--line);
        }
        .record-row:first-of-type{ border-top:none; }
        .record-row-clickable{ cursor:pointer; }
        .record-row-clickable:active{ background:var(--brand-soft); }
        .history-month-header{
          font-size:12px;
          font-weight:700;
          color:var(--brand);
          background:var(--brand-soft);
          border-radius:8px;
          padding:5px 10px;
          margin:12px 0 4px;
        }
        .history-month-header:first-child{ margin-top:0; }
        .record-date{ font-weight:700; font-size:13px; }
        .record-meta{ font-size:11.5px; color:var(--ink-soft); margin-top:2px; }
        .icon-btn{
          border:none; background:none; color:var(--ink-soft); cursor:pointer;
          padding:6px;
        }

        .food-log-row{ gap:10px; align-items:flex-start; }
        .food-log-row-main{ flex:1; min-width:0; }
        .food-log-thumb{
          width:44px;
          height:44px;
          border-radius:10px;
          object-fit:cover;
          flex-shrink:0;
          background:var(--brand-soft);
        }
        .food-log-thumb-placeholder{
          display:flex;
          align-items:center;
          justify-content:center;
          color:var(--brand);
        }

        .save-toast{
          position:absolute;
          top:14px;
          left:50%;
          transform:translateX(-50%);
          background:var(--ink);
          color:#fff;
          font-size:12.5px;
          padding:8px 16px;
          border-radius:999px;
          z-index:50;
        }

        /* --- 這一餐的影響 -------------------------------------------------
           Burdens are amber and benefits green, not red and green: red on a
           meal she has already eaten is a telling-off, and the point is the
           next meal. */
        .food-impact{
          border-top:1px solid var(--line);
          margin:8px 0 10px; padding-top:9px;
        }
        .fi-headline{
          font-size:11.5px; font-weight:700; color:var(--brand);
          background:var(--brand-soft); border-radius:8px;
          padding:6px 8px; margin-bottom:8px; line-height:1.5;
        }
        .fi-block{ margin-bottom:8px; }
        .fi-block-title{ font-size:11px; font-weight:700; margin-bottom:4px; }
        .fi-block-title.burden{ color:var(--amber); }
        .fi-block-title.benefit{ color:var(--green); }
        .fi-row{ margin-bottom:7px; }
        .fi-row:last-child{ margin-bottom:0; }
        .fi-head{ display:flex; flex-wrap:wrap; align-items:baseline; gap:4px 6px; margin-bottom:2px; }
        .fi-chip{
          font-size:10.5px; font-weight:700; border-radius:999px;
          padding:2px 8px; white-space:nowrap;
        }
        .fi-chip.burden{ background:var(--amber-soft); color:var(--amber); }
        .fi-chip.benefit{ background:var(--green-soft); color:var(--green); }
        /* A chip that touches one of her own out-of-range values gets an
           outline, so the diary strip still shows which ones were about her. */
        .fi-chip.is-personal{ box-shadow:inset 0 0 0 1px var(--amber); }
        .fi-personal{ font-size:10px; color:var(--ink); font-weight:700; }
        .fi-text{ font-size:11px; color:var(--ink-soft); line-height:1.65; }
        .fi-risk{ font-size:10.5px; color:var(--amber); line-height:1.6; margin-top:2px; }
        .fi-swap{ font-size:10.5px; color:var(--brand); line-height:1.6; margin-top:2px; }
        .fi-note{ font-size:10px; color:var(--ink-soft); line-height:1.6; margin-top:6px; }
        .fi-chips{ display:flex; flex-wrap:wrap; gap:4px; margin-top:5px; }
        .fi-compact button.fi-chip{
          border:none; font-family:inherit; cursor:pointer;
        }
        .fi-compact .fi-chip.is-open{ box-shadow:inset 0 0 0 2px currentColor; }
        .fi-open{
          margin-top:6px; padding:8px 10px; border-radius:10px;
          background:var(--surface-2);
        }
        .fi-open.burden{ background:var(--amber-soft); }
        .fi-open.benefit{ background:var(--green-soft); }
        .fi-open .fi-personal{ display:block; margin-bottom:3px; }

        /* --- 每週運動目標 ------------------------------------------------
           Seven day rows, not a table. Every row is a grid so the day chip,
           the character, the activity and the verdict each hold their own
           column at any width — the old table's intensity column wrapped to
           three lines on a phone. */
        .wp-bar-head{
          display:flex; justify-content:space-between; align-items:baseline;
          font-size:11.5px; color:var(--ink-soft); margin:2px 0 5px;
        }
        .wp-bar-head strong{
          font-family:'JetBrains Mono', monospace; font-size:14px; color:var(--brand);
        }
        .wp-bar{ height:7px; border-radius:999px; background:var(--line); overflow:hidden; margin-bottom:12px; }
        .wp-bar-fill{ height:100%; border-radius:999px; background:var(--brand); }

        .wp-list{ display:flex; flex-direction:column; gap:5px; }
        .wp-row{
          display:grid;
          grid-template-columns:22px 30px minmax(0,1fr) auto;
          align-items:center; gap:8px;
          padding:6px 8px; border-radius:10px;
          background:var(--surface-2);
          border:1px solid transparent;
        }
        .wp-row.is-done{ background:var(--brand-soft); }
        .wp-row.is-moved{ background:var(--amber-soft); }
        /* A day still ahead is faded, not marked wrong — "not yet" and
           "didn't" must not look the same. */
        .wp-row.is-ahead{ opacity:0.68; }
        .wp-row.is-today{ border-color:var(--brand); }

        .wp-day{
          font-size:12px; font-weight:700; text-align:center;
          color:var(--ink-soft);
        }
        .wp-row.is-today .wp-day{ color:var(--brand); }
        .wp-ico{ display:flex; align-items:center; justify-content:center; }
        .wp-ico svg{ display:block; }
        .wp-main{ min-width:0; display:flex; flex-direction:column; gap:1px; }
        .wp-act{ font-size:12.5px; color:var(--ink); overflow-wrap:anywhere; }
        .wp-meta{ font-size:10px; color:var(--ink-soft); }
        .wp-right{ justify-self:end; }

        .wp-badge{
          font-size:10.5px; font-weight:700; white-space:nowrap;
          padding:3px 7px; border-radius:999px;
        }
        .wp-badge.done{ background:var(--brand); color:#fff; }
        .wp-badge.moved{ background:var(--amber); color:#fff; }

        .wp-dots{ display:inline-flex; align-items:center; gap:3px; }
        .wp-dots i{
          width:5px; height:5px; border-radius:50%;
          background:var(--line); display:block;
        }
        .wp-dots i.on{ background:var(--amber); }
        .wp-dots-label{ font-size:10px; color:var(--ink-soft); margin-left:2px; white-space:nowrap; }

        .wp-legend{
          display:flex; flex-wrap:wrap; gap:4px 12px; margin-top:9px;
          font-size:10px; color:var(--ink-soft);
        }
        .wp-legend span{ display:inline-flex; align-items:center; gap:4px; }
        .wp-legend .sw{ width:9px; height:9px; border-radius:3px; display:block; }
        .wp-legend .sw.done{ background:var(--brand-soft); border:1px solid var(--brand); }
        .wp-legend .sw.moved{ background:var(--amber-soft); border:1px solid var(--amber); }
        .wp-legend .sw.ahead{ background:var(--surface-2); border:1px solid var(--line); }

        .ex-category-row span{ display:inline-flex; align-items:center; gap:4px; }

        /* --- 健康分析 and 運動建議 --------------------------------------- */

        /* --- 健康分析: a larger type scale ------------------------------
           This page is read, not glanced at, and it is the one page where the
           smallest text was carrying the most important meaning. The verdict
           is now a coloured pill at 12px instead of 9.5px grey text on the
           right edge, values are 19px, and the explanatory prose is demoted to
           .fine-print or folded behind a toggle. */
        /* Flex so the date/week badge is pushed to the right edge instead of
           running straight on from the title — .section-title is a plain block
           elsewhere, where nothing sits beside it. */
        .health-page .section-title{
          font-size:17px;
          display:flex; align-items:baseline; gap:8px; flex-wrap:wrap;
        }
        .health-page .card{ padding:16px; }
        .fine-print{ font-size:11px; color:var(--ink-soft); line-height:1.6; margin:0 0 10px; }

        /* Three counts: the shape of the whole report before any of its rows. */
        .health-page .month-stats strong{ font-size:24px; }
        .health-page .month-stats span{ font-size:11px; }
        .health-page .focus-title{ font-size:15.5px; }
        .health-page .focus-action{ font-size:13.5px; line-height:1.75; }
        .health-page .focus-why{ font-size:12px; }
        .health-page .focus-progress-head{ font-size:12px; }
        .health-page .focus-progress-head strong{ font-size:13.5px; }
        .health-page .focus-bar{ height:9px; }
        .health-page .refer-item-head{ font-size:13px; }
        .health-page .refer-item-note{ font-size:11.5px; }
        .health-page .cycle-badge{ font-size:11.5px; }
        .health-page .draft-field label{ font-size:13px; }
        .health-page .draft-field input{ font-size:14px; width:96px; }
        .health-page .draft-group-toggle{ font-size:13px; }
        .health-page .draft-flag-label{ font-size:13px; }
        .focus-tag{
          display:inline-block; font-size:11px; font-weight:700; color:#fff;
          background:var(--red); border-radius:999px;
          padding:2px 8px; margin-right:6px; vertical-align:2px;
        }

        /* 代謝症候群: the count big, then five readable rows. Five 53px boxes
           put the cutoff text at 8.5px, which nobody read. */
        .ms-top{ display:flex; align-items:center; gap:12px; margin-bottom:10px; }
        .ms-count strong{
          font-family:'JetBrains Mono', monospace; font-size:30px; line-height:1;
        }
        .ms-count span{ font-size:12px; color:var(--ink-soft); margin-left:2px; }
        .ms-title{ font-size:13.5px; font-weight:700; line-height:1.4; }
        .ms-title span{ display:block; font-size:11.5px; font-weight:500; color:var(--ink-soft); }
        .ms-rows{ display:flex; flex-direction:column; gap:4px; }
        .ms-row{
          display:grid; grid-template-columns:minmax(0,1fr) auto auto;
          align-items:center; gap:10px;
          background:#fff; border-radius:8px; padding:7px 10px;
          border-left:4px solid var(--line);
        }
        .ms-row.is-met{ border-left-color:var(--red); background:var(--red-soft); }
        .ms-row.is-unknown{ opacity:0.55; }
        .ms-row-label{ font-size:13px; font-weight:700; }
        .ms-row-limit{ font-size:11px; color:var(--ink-soft); white-space:nowrap; }
        .ms-row-value{
          font-family:'JetBrains Mono', monospace; font-weight:700;
          font-size:14px; white-space:nowrap; min-width:56px; text-align:right;
        }
        .ms-warn{ font-size:11.5px; color:var(--amber); line-height:1.6; margin:8px 0 0; }

        .rs-strip{
          display:grid; grid-template-columns:repeat(3,1fr); gap:8px;
          margin:2px 0 14px;
        }
        .rs-cell{
          text-align:center; border-radius:12px; padding:10px 4px;
          border:1.5px solid var(--line); background:var(--surface-2);
        }
        .rs-cell strong{
          display:block; font-family:'JetBrains Mono', monospace;
          font-size:26px; line-height:1.1;
        }
        .rs-cell span{ font-size:11.5px; color:var(--ink-soft); }
        .rs-cell.green{ border-color:var(--green); background:var(--green-soft); }
        .rs-cell.green strong{ color:var(--green); }
        .rs-cell.watch{ border-color:var(--yellow); background:var(--yellow-soft); }
        .rs-cell.watch strong{ color:var(--yellow); }
        .rs-cell.refer{ border-color:var(--red); background:var(--red-soft); }
        .rs-cell.refer strong{ color:var(--red); }
        /* A zero is not news. Faded so the eye goes to the counts that matter. */
        .rs-cell.is-zero{ border-color:var(--line); background:var(--surface-2); }
        .rs-cell.is-zero strong{ color:var(--ink-soft); }

        /* --- 回診提醒／建議檢查／就醫紀錄 --------------------------------- */

        .remind-row{
          display:flex; align-items:flex-start; gap:10px;
          border-radius:12px; padding:11px 12px; margin-bottom:8px;
          background:var(--brand-soft);
          border-left:4px solid var(--brand);
        }
        /* Overdue is red and stays red however long ago it was: a 回診 missed
           three months ago matters more than one due next week. */
        .remind-row.is-overdue{ background:var(--red-soft); border-left-color:var(--red); }
        .remind-main{ flex:1; min-width:0; }
        .remind-when{
          font-family:'JetBrains Mono', monospace; font-weight:700; font-size:14px;
        }
        .remind-when span{
          font-family:'Noto Sans TC', sans-serif; font-weight:700;
          font-size:11.5px; margin-left:8px; color:var(--brand);
        }
        .remind-row.is-overdue .remind-when span{ color:var(--red); }
        .remind-what{ font-size:13.5px; font-weight:700; margin-top:2px; }
        .remind-advice{ font-size:12px; color:var(--ink-soft); line-height:1.6; margin-top:3px; }
        .remind-done{ flex-shrink:0; padding:6px 10px; font-size:11.5px; }

        .sug-row{
          border:1px solid var(--line); border-radius:12px;
          padding:11px 12px; margin-bottom:8px;
        }
        .sug-head{ display:flex; flex-wrap:wrap; align-items:baseline; gap:6px 8px; }
        .sug-dept{
          font-size:12px; font-weight:700; color:#fff;
          background:var(--brand); border-radius:999px; padding:3px 10px;
          white-space:nowrap;
        }
        .sug-exam{ font-size:14px; font-weight:700; }
        .sug-why{ font-size:12px; color:var(--ink); margin-top:5px; line-height:1.6; }
        .sug-note{ font-size:11.5px; color:var(--ink-soft); margin-top:3px; line-height:1.6; }
        .sug-source{ font-size:10.5px; color:var(--ink-soft); margin-top:4px; }
        .fold-done{
          font-size:11px; font-weight:700; color:var(--green);
          background:var(--green-soft); border-radius:999px; padding:2px 9px;
        }
        .plan-list-title{
          font-size:12px; font-weight:700; color:var(--ink-soft);
          margin:2px 0 6px;
        }
        .plan-add{ margin-top:6px; }
        /* Marks the ones a doctor asked for, so they are told apart from the
           ones this app suggested. */
        .plan-mine{
          display:inline-block; font-size:10.5px; font-weight:700;
          color:#fff; background:var(--amber); border-radius:999px;
          padding:1px 7px; margin-right:5px; vertical-align:1px;
        }
        .plan-row{
          display:flex; align-items:flex-start; gap:8px;
          border-radius:10px; padding:9px 10px; margin-bottom:6px;
          background:var(--brand-soft);
          border-left:4px solid var(--brand);
        }
        .plan-row.is-done{ background:var(--surface-2); border-left-color:var(--line); opacity:0.7; }
        .plan-main{ flex:1; min-width:0; }
        .plan-when{ font-family:'JetBrains Mono', monospace; font-weight:700; font-size:13.5px; }
        .plan-what{ font-size:13px; font-weight:700; margin-top:2px; overflow-wrap:anywhere; }
        .plan-where{ font-size:12px; color:var(--brand); font-weight:700; margin-top:2px; }
        .plan-note{ font-size:11.5px; color:var(--ink-soft); margin-top:2px; line-height:1.6; }
        .plan-acts{ display:flex; flex-wrap:wrap; gap:4px 10px; margin-top:5px; }
        .plan-acts .inline-toggle{ margin-top:0; }
        .plan-cal{
          flex-shrink:0; padding:6px 9px; font-size:11.5px;
          display:inline-flex; align-items:center; gap:4px;
        }

        .sug-book-btn{ margin-top:8px; padding:6px 12px; font-size:12px; }
        .sug-booked{
          margin-top:8px; padding:7px 9px; border-radius:8px;
          background:var(--brand-soft); color:var(--brand);
          font-size:12px; font-weight:700; line-height:1.7;
        }
        .sug-booked .inline-toggle{ margin-left:10px; margin-top:0; }
        .plan-form{
          margin-top:8px; padding-top:8px; border-top:1px solid var(--line);
        }
        .plan-form .field{ margin-bottom:8px; }

        .sug-covered{
          border-top:1px solid var(--line); margin-top:8px; padding-top:8px;
          font-size:11.5px; color:var(--green); line-height:1.8;
        }

        .visit-row{
          border-bottom:1px solid var(--line); padding:10px 0;
        }
        .visit-row:last-child{ border-bottom:none; }
        .visit-row.is-done{ opacity:0.65; }
        .visit-head{ display:flex; align-items:center; gap:8px; }
        .visit-date{
          font-family:'JetBrains Mono', monospace; font-weight:700; font-size:13px;
        }
        .visit-dept{
          font-size:11.5px; font-weight:700; color:var(--brand);
          background:var(--brand-soft); border-radius:999px; padding:2px 9px;
        }
        .visit-head .icon-btn:first-of-type{ margin-left:auto; }
        .visit-symptom{ font-size:13.5px; margin-top:5px; }
        /* The doctor's words, kept as typed — the app does not paraphrase them
           and nothing reads this field to decide anything. */
        .visit-advice{
          font-size:12.5px; color:var(--ink-soft); line-height:1.7; margin-top:4px;
          border-left:2px solid var(--line); padding-left:9px;
          white-space:pre-wrap; overflow-wrap:anywhere;
        }
        .visit-next{ font-size:11.5px; color:var(--brand); margin-top:5px; }
        .visit-next .inline-toggle{ margin-left:8px; margin-top:0; }

        .health-page textarea{
          width:100%; border:1px solid var(--line); border-radius:10px;
          padding:10px 12px; font-size:14px; font-family:'Noto Sans TC', sans-serif;
          background:#fff; color:var(--ink); resize:vertical; line-height:1.6;
        }

        .v-block{ margin-bottom:12px; }
        .v-block-title{ font-size:13px; font-weight:700; margin:0 0 6px; }
        .v-block-title.watch{ color:var(--yellow); }
        .v-group{ margin-bottom:10px; }
        .v-group-title{ font-size:11.5px; font-weight:700; color:var(--ink-soft); margin-bottom:4px; }
        .v-allclear{
          font-size:13px; color:var(--green); font-weight:700;
          background:var(--green-soft); border-radius:10px;
          padding:12px; text-align:center; margin-bottom:12px;
        }

        /* One measured value: a colour bar to scan down, the name, the number,
           and the verdict as a pill. */
        .v-row{
          display:grid; grid-template-columns:minmax(0,1fr) auto auto;
          align-items:center; gap:4px 10px;
          padding:9px 10px 9px 12px; margin-bottom:5px;
          border-radius:10px; background:var(--surface-2);
          border-left:4px solid var(--line);
        }
        .v-row.tone-green{ border-left-color:var(--green); }
        .v-row.tone-yellow{ border-left-color:var(--yellow); background:var(--yellow-soft); }
        .v-row.tone-red{ border-left-color:var(--red); background:var(--red-soft); }
        .v-main{ min-width:0; }
        .v-name{ font-size:14px; font-weight:700; line-height:1.35; overflow-wrap:anywhere; }
        .v-range{ font-size:11px; color:var(--ink-soft); line-height:1.45; margin-top:1px; }
        .v-num{
          font-family:'JetBrains Mono', monospace; font-weight:700;
          font-size:19px; white-space:nowrap; text-align:right;
        }
        .v-unit{ font-size:10px; font-weight:500; color:var(--ink-soft); margin-left:3px; }
        .v-change{ display:block; font-size:11px; font-weight:500; color:var(--ink-soft); }
        .v-change.down{ color:var(--green); }
        .v-change.up{ color:var(--amber); }
        .v-pill{
          font-size:12px; font-weight:700; white-space:nowrap;
          border-radius:999px; padding:4px 10px;
          background:#fff; color:var(--ink-soft); border:1px solid var(--line);
        }
        .v-pill.tone-green{ background:var(--green); color:#fff; border-color:var(--green); }
        .v-pill.tone-yellow{ background:var(--yellow); color:#fff; border-color:var(--yellow); }
        .v-pill.tone-red{ background:var(--red); color:#fff; border-color:var(--red); }

        .inline-toggle{
          border:none; background:none; padding:0; margin-top:6px;
          font-family:inherit; font-size:11.5px; color:var(--brand);
          text-decoration:underline; cursor:pointer;
        }

        /* Good and not-yet told apart by shape and colour, not by which
           heading you happen to be under. */
        .verdict-list{ display:flex; flex-direction:column; gap:7px; margin:4px 0 10px; }
        .verdict-line{
          display:flex; gap:8px; align-items:flex-start;
          font-size:13.5px; line-height:1.6;
        }
        .verdict-mark{
          flex:0 0 20px; width:20px; height:20px; border-radius:50%;
          display:flex; align-items:center; justify-content:center;
          font-size:12px; font-weight:700; color:#fff; margin-top:1px;
        }
        .verdict-line.good .verdict-mark{ background:var(--green); }
        .verdict-line.watch .verdict-mark{ background:var(--yellow); }

        .trend-line{
          display:flex; flex-wrap:wrap; gap:4px 16px;
          font-size:12.5px; color:var(--ink-soft);
          border-top:1px solid var(--line); padding-top:9px;
        }
        .trend-line strong{ color:var(--ink); font-family:'JetBrains Mono', monospace; }

        .scan-row{ display:flex; gap:8px; }
        .scan-btn{ flex:1; padding:9px 8px; font-size:12.5px; }
        .scan-note{
          display:flex; gap:6px; align-items:flex-start;
          font-size:11.5px; line-height:1.65;
          background:var(--brand-soft); border-radius:10px;
          padding:9px 10px; margin-bottom:10px;
        }
        .scan-note.is-error{ background:var(--amber-soft); }
        .scan-note .icon-btn{ margin-left:auto; flex-shrink:0; }

        .muted-line{ font-size:11.5px; color:var(--ink-soft); line-height:1.65; margin:0 0 10px; }
        .tone-green{ color:var(--green); }
        .tone-yellow{ color:var(--yellow); }
        .tone-red{ color:var(--red); }

        .cycle-badge{
          font-size:10.5px; font-weight:500; color:var(--ink-soft);
          margin-left:auto; white-space:nowrap;
        }
        .month-select{
          margin-left:auto; font-size:11.5px; font-family:inherit;
          border:1px solid var(--line); border-radius:8px; padding:3px 6px;
          background:#fff; color:var(--ink);
        }

        /* One focus for the week. The reason sits between the title and the
           action on purpose: the number is why this line is here at all. */
        .focus-card{
          border:1px solid var(--line); border-left:3px solid var(--brand);
          border-radius:10px; padding:10px 12px; margin-bottom:10px;
          background:var(--card);
        }
        .focus-card.is-refer{ border-left-color:var(--amber); background:var(--amber-soft); }
        .focus-title{ font-size:13.5px; font-weight:700; margin-bottom:4px; }
        .focus-why{ font-size:11px; color:var(--ink-soft); margin-bottom:6px; }
        .focus-action{ font-size:12.5px; line-height:1.7; }
        .focus-progress{ margin-top:9px; }
        .focus-progress-head{
          display:flex; justify-content:space-between; align-items:baseline;
          font-size:11px; color:var(--ink-soft); margin-bottom:4px;
        }
        .focus-progress-head strong{ font-family:'JetBrains Mono', monospace; }
        .focus-bar{ height:6px; border-radius:999px; background:var(--line); overflow:hidden; }
        .focus-bar-fill{ height:100%; background:var(--brand); border-radius:999px; }
        .focus-bar-fill.is-done{ background:var(--green); }

        .month-stats{
          display:grid; grid-template-columns:repeat(4,1fr); gap:6px;
          margin:4px 0 12px; text-align:center;
        }
        .month-stats strong{
          display:block; font-family:'JetBrains Mono', monospace;
          font-size:17px; color:var(--brand);
        }
        .month-stats span{ font-size:10px; color:var(--ink-soft); }

        .review-block{ margin-bottom:10px; }
        .review-head{ font-size:12px; font-weight:700; margin-bottom:4px; }
        .review-line{
          font-size:12px; line-height:1.75; color:var(--ink);
          padding-left:12px; position:relative;
        }
        .review-line::before{
          content:"・"; position:absolute; left:0; color:var(--ink-soft);
        }

        /* 代謝症候群: five boxes, because the standard is "three of five" and a
           count means nothing without seeing which ones. */
        .ms-card{
          border:1px solid var(--line); border-radius:12px;
          padding:13px; margin-bottom:12px; background:var(--paper);
        }
        .ms-note{ font-size:11.5px; color:var(--ink-soft); line-height:1.7; margin:8px 0 0; }

        /* A referral card lists what it is referring, each with its own
           reason — one card for the lot, because with forty markers on a
           report a card per finding would bury the two things she can act on
           this week. */
        .refer-items{ margin-top:8px; display:flex; flex-direction:column; gap:6px; }
        .refer-item{
          background:#fff; border-radius:8px; padding:7px 9px;
          border:1px solid var(--line);
        }
        .refer-item-head{ font-size:12px; font-weight:700; }
        .refer-item-note{ font-size:10.5px; color:var(--ink-soft); line-height:1.6; margin-top:2px; }

        .draft-group-toggle{
          display:flex; align-items:center; gap:6px; width:100%;
          background:none; border:none; padding:6px 0; cursor:pointer;
          font-family:inherit; font-size:11.5px; font-weight:700;
          color:var(--ink-soft); border-bottom:1px solid var(--line);
          margin-bottom:4px;
        }
        .draft-group-count{
          font-size:10px; font-weight:500; color:var(--brand);
          background:var(--brand-soft); border-radius:999px; padding:1px 6px;
        }
        .draft-group-caret{ margin-left:auto; font-size:8px; }

        .draft-flag{
          display:flex; align-items:center; gap:8px; padding:4px 0;
        }
        .draft-flag-label{ flex:1; min-width:0; font-size:12px; }
        .draft-flag-chips{ display:flex; gap:4px; flex-shrink:0; }
        .draft-flag-chips .chip{ padding:4px 10px; font-size:11px; }

        .lab-group{ margin-bottom:10px; }
        .lab-group-title{ font-size:11.5px; font-weight:700; color:var(--ink-soft); margin-bottom:4px; }
        .lab-row{
          display:flex; align-items:center; gap:8px;
          padding:6px 0; border-bottom:1px solid var(--line);
        }
        .lab-row:last-child{ border-bottom:none; }
        .lab-name{ flex:1; min-width:0; font-size:12px; }
        .lab-unit{ font-size:9.5px; color:var(--ink-soft); margin-left:4px; }
        .lab-value{
          font-family:'JetBrains Mono', monospace; font-weight:700;
          font-size:13px; white-space:nowrap;
        }
        .lab-change{ font-size:10px; margin-left:4px; color:var(--ink-soft); }
        .lab-change.down{ color:var(--green); }
        .lab-change.up{ color:var(--amber); }
        .lab-zone{
          font-size:9.5px; text-align:right; width:96px; flex-shrink:0;
          color:var(--ink-soft); line-height:1.35;
        }

        .draft-box{
          border-top:1px solid var(--line); margin-top:12px; padding-top:12px;
        }
        .draft-hint{ font-size:11px; color:var(--ink-soft); line-height:1.65; margin:0 0 10px; }
        .draft-warn{
          display:flex; gap:6px; align-items:flex-start;
          font-size:11px; line-height:1.6; color:var(--ink);
          background:var(--amber-soft); border-radius:8px;
          padding:8px 10px; margin-bottom:10px;
        }
        .draft-group{ margin-bottom:10px; }
        .draft-group-title{ font-size:11.5px; font-weight:700; color:var(--ink-soft); margin-bottom:4px; }
        .draft-field{
          display:flex; align-items:center; gap:8px; padding:3px 0;
        }
        .draft-field label{ flex:1; min-width:0; font-size:12px; font-weight:500; }
        .draft-field input{
          width:88px; flex-shrink:0;
          border:1px solid var(--line); border-radius:8px; padding:6px 8px;
          font-size:13px; font-family:'JetBrains Mono', monospace;
          background:#fff; color:var(--ink);
        }

        .workout-card{
          border:1px solid var(--line); border-radius:10px;
          padding:10px 12px; margin-bottom:10px;
        }
        .workout-head{ display:flex; align-items:baseline; gap:8px; margin-bottom:3px; }
        .workout-name{ font-size:13.5px; font-weight:700; }
        .workout-minutes{
          margin-left:auto; font-size:10.5px; color:var(--ink-soft);
          font-family:'JetBrains Mono', monospace;
        }
        .workout-why{ font-size:11px; color:var(--brand); font-weight:700; margin-bottom:4px; }
        .workout-note{ font-size:11.5px; color:var(--ink-soft); line-height:1.65; margin-bottom:8px; }
        .workout-actions{ display:flex; gap:8px; }
        .workout-actions .btn{ flex:1; padding:7px 8px; font-size:12px; text-decoration:none; }
        .workout-link-toggle{
          margin-top:7px; border:none; background:none; padding:0;
          font-size:10.5px; color:var(--ink-soft); font-family:inherit;
          cursor:pointer; display:flex; align-items:center; gap:4px;
        }
        .workout-link-edit{ display:flex; gap:6px; align-items:center; margin-top:7px; }
        .workout-link-edit input{
          flex:1; min-width:0; border:1px solid var(--line); border-radius:8px;
          padding:6px 8px; font-size:12px; font-family:inherit;
          background:#fff; color:var(--ink);
        }
        .workout-link-warn{ font-size:10.5px; color:var(--red); margin-top:4px; }
        .workout-cautions{
          border-radius:10px; background:var(--amber-soft);
          padding:10px 12px; margin-top:4px;
        }
        .workout-cautions-head{
          display:flex; align-items:center; gap:5px;
          font-size:11.5px; font-weight:700; color:var(--amber); margin-bottom:5px;
        }
        .workout-caution-line{
          font-size:11px; line-height:1.7; color:var(--ink);
          padding-left:11px; position:relative;
        }
        .workout-caution-line::before{ content:"・"; position:absolute; left:0; }

        .bottom-nav{
          position:sticky;
          bottom:0;
          display:grid;
          /* Six items on a 375px screen leaves about 60px each; the labels are
             all four characters or fewer, so they fit at 10px. */
          grid-template-columns:repeat(6,1fr);
          background:var(--card);
          border-top:1px solid var(--line);
          /* The same at the other end: the home indicator sits over the last
             few millimetres of the screen, and the nav labels were ending up
             underneath it. */
          padding:6px 4px calc(10px + env(safe-area-inset-bottom));
        }
        .nav-btn{
          display:flex;
          flex-direction:column;
          align-items:center;
          gap:3px;
          background:none;
          border:none;
          color:var(--ink-soft);
          font-size:10px;
          padding:6px 1px;
          cursor:pointer;
          white-space:nowrap;
        }
        .nav-btn.active{ color:var(--brand); }

        .modal-backdrop{
          position:fixed; inset:0; background:rgba(0,0,0,.35);
          display:flex; align-items:center; justify-content:center;
          z-index:100; padding:20px;
        }
        .modal-card{
          background:#fff; border-radius:16px; padding:20px; max-width:320px; width:100%;
        }
        .analysis-modal-card{
          max-width:340px;
          /* Never taller than the screen, and never taller than the space
             left once the keyboard is up on iOS (dvh, with vh as fallback). */
          max-height:88vh;
          max-height:88dvh;
          display:flex;
          flex-direction:column;
          overflow:hidden;
        }
        .modal-card h3{ font-family:'Noto Serif TC', serif; font-size:15px; margin:0 0 8px; }
        .modal-card p{ font-size:13px; color:var(--ink-soft); margin:0 0 16px; line-height:1.5; }
        .modal-actions{ display:flex; gap:10px; }
        .modal-actions .btn{ flex:1; }

        .cal-empty p{ font-size:12.5px; color:var(--ink-soft); margin:0; line-height:1.5; }

        .cal-bar-wrap{ padding:2px 0 0; }
        .cal-bar-numbers{
          display:flex;
          justify-content:space-between;
          align-items:flex-end;
          margin-bottom:10px;
        }
        .cal-bar-value{
          font-family:'JetBrains Mono', monospace;
          font-weight:700;
          font-size:20px;
          text-align:center;
        }
        .cal-bar-remaining .cal-bar-value{ font-size:24px; }
        .cal-bar-caption{
          font-size:10.5px;
          color:var(--ink-soft);
          text-align:center;
          margin-top:2px;
        }
        .cal-bar-remaining.tone-green .cal-bar-value{ color:var(--green); }
        .cal-bar-remaining.tone-yellow .cal-bar-value{ color:var(--yellow); }
        .cal-bar-remaining.tone-red .cal-bar-value{ color:var(--red); }
        .cal-bar-track{
          width:100%;
          height:10px;
          border-radius:999px;
          background:var(--line);
          overflow:hidden;
        }
        .cal-bar-fill{ height:100%; border-radius:999px; }
        .cal-bar-fill.tone-green{ background:var(--green); }
        .cal-bar-fill.tone-yellow{ background:var(--yellow); }
        .cal-bar-fill.tone-red{ background:var(--red); }
        .cal-bar-fill.tone-neutral{ background:var(--brand); }

        .water-wrap{
          display:flex;
          align-items:center;
          gap:16px;
        }
        .water-mascot-svg{ width:88px; height:auto; flex-shrink:0; }
        .water-bottle-outline{ fill:none; }
        .water-bottle-border{
          fill:none;
          stroke:#3A7CA5;
          stroke-width:3;
        }
        .water-fill{ fill:#6FB6E0; }
        .water-face-line{
          fill:none;
          stroke:#1E2A22;
          stroke-width:2.5;
          stroke-linecap:round;
        }
        .water-face-line-thick{ stroke-width:3; }
        .water-face-fill{ fill:#1E2A22; }
        .water-cheek{ fill:#F6A6A6; opacity:0.6; }
        .water-zzz{ font-size:11px; font-weight:700; fill:#8FB8D6; font-family:'Noto Sans TC', sans-serif; }
        .water-sparkle path{ fill:#FFC94A; }

        .water-numbers{ flex:1; }
        .water-value{
          font-family:'JetBrains Mono', monospace;
          font-weight:700;
          font-size:24px;
          color:#2C6E9B;
        }
        .water-value span{ font-size:13px; font-weight:500; color:var(--ink-soft); }
        .water-mood-label{
          font-size:12px;
          color:var(--ink-soft);
          margin-top:4px;
          line-height:1.5;
        }

        .water-quick-row{
          display:flex;
          gap:8px;
          margin-top:14px;
        }
        .water-quick-btn{
          flex:1;
          border:1px solid var(--line);
          background:#F0F8FC;
          border-radius:10px;
          padding:9px 4px;
          font-size:12.5px;
          font-weight:700;
          color:#2C6E9B;
          cursor:pointer;
        }
        .water-quick-btn:active{ transform:scale(0.97); }

        .water-custom-row{
          display:flex;
          gap:8px;
          margin-top:8px;
        }
        .water-custom-row input{
          flex:1;
          border:1px solid var(--line);
          border-radius:10px;
          padding:9px 12px;
          font-size:13px;
        }
        .water-custom-row .btn{ padding:8px 14px; }

        .calc-breakdown{
          margin-top:10px;
          font-size:12px;
        }
        .calc-breakdown summary{
          cursor:pointer;
          color:var(--brand);
          font-weight:700;
          font-size:12px;
        }
        .calc-breakdown-body{
          margin-top:8px;
          padding:10px 12px;
          background:var(--brand-soft);
          border-radius:10px;
          color:var(--ink-soft);
          line-height:1.7;
        }
        .override-row{
          display:flex;
          flex-wrap:wrap;
          align-items:center;
          gap:6px;
          margin-top:8px;
          padding-top:8px;
          border-top:1px solid rgba(0,0,0,0.08);
        }
        .override-row .btn{ padding:6px 10px; font-size:11.5px; }

        .water-history{
          margin-top:10px;
          border-top:1px solid var(--line);
          padding-top:8px;
        }
        .water-history-toggle{
          display:block; width:100%; min-height:40px; margin-top:6px;
          border:1px solid var(--line); border-radius:10px;
          background:transparent; color:var(--brand);
          font-size:12.5px; font-family:inherit; cursor:pointer;
        }
        .water-history-row.is-today span:first-child{ color:var(--ink); font-weight:600; }
        .water-history-title{
          font-size:11px;
          font-weight:700;
          color:var(--ink-soft);
          margin-bottom:6px;
        }
        .water-history-row{
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:8px;
          font-size:12px;
          color:var(--ink-soft);
          padding:4px 0;
        }
        .water-history-edit{
          display:flex;
          align-items:center;
          gap:4px;
          flex-shrink:0;
        }
        .water-amount-input{ width:50px; }

        .ex-bar-numbers{ margin-bottom:8px; }
        .ex-bar-value{
          font-family:'JetBrains Mono', monospace;
          font-weight:700;
          font-size:26px;
          color:var(--brand);
        }
        .ex-bar-caption{ font-size:12px; color:var(--ink-soft); margin-top:2px; }
        .ex-category-row{
          display:flex;
          justify-content:space-between;
          gap:6px;
          margin-top:10px;
          font-size:12px;
          color:var(--ink-soft);
          background:var(--brand-soft);
          border-radius:10px;
          padding:8px 10px;
        }

        .chart-zone-legend{
          display:flex;
          flex-wrap:wrap;
          gap:6px;
          margin-bottom:6px;
        }
        .chart-zone-tag{
          font-size:10.5px;
          font-weight:700;
          color:var(--ink);
          padding:3px 8px;
          border-radius:999px;
        }
        .chart-zone-explain{
          font-size:11px;
          color:var(--ink-soft);
          line-height:1.5;
          margin:0 0 8px;
        }

        .photo-input-label{
          cursor:pointer;
          margin-bottom:10px;
        }
        /* Two buttons side by side, the same size. A <label> wrapping a file
           input and a <button> are not interchangeable by default: the label
           carries .photo-input-label's bottom margin and the button does not,
           which is why 匯入備份 and 匯出備份 came out different heights. */
        .btn-row{ display:flex; gap:8px; align-items:stretch; }
        .btn-row > .btn{ flex:1; margin:0; }
        .photo-input-label input{ display:none; }

        .spin{ animation:spin 1s linear infinite; }
        @keyframes spin{ from{ transform:rotate(0deg); } to{ transform:rotate(360deg); } }

        .analyzing-row{
          display:flex;
          align-items:center;
          gap:8px;
          font-size:12.5px;
          color:var(--ink-soft);
          padding:10px 2px;
        }

        .analysis-error{
          font-size:12.5px;
          color:var(--red);
          background:var(--red-soft);
          border-radius:10px;
          padding:10px 12px;
          margin-bottom:10px;
        }

        .analysis-card{
          border:1px solid var(--line);
          border-radius:14px;
          padding:12px;
          margin-bottom:12px;
          display:flex;
          gap:12px;
          /* min-height:0 is what lets a flex child actually shrink and hand
             its overflow to the scrolling body below. */
          min-height:0;
        }
        /* Inside the modal the card is a column: the photo on top, then the
           readable part, so the notes get the full width to wrap into. */
        .analysis-modal-card .analysis-card{
          flex-direction:column;
          border:none;
          padding:0;
          margin-bottom:0;
          gap:10px;
          flex:1;
          overflow:hidden;
        }
        .analysis-modal-card .analysis-card img{
          width:100%;
          height:132px;
        }
        .analysis-modal-card .analysis-card-body{
          overflow-y:auto;
          -webkit-overflow-scrolling:touch;
          min-height:0;
          flex:1;
        }
        /* Pinned to the bottom of the scroll area. Before this, a long reading
           pushed the buttons past the bottom of the screen and the entry could
           not be saved at all. */
        .shot-list{ margin-top:10px; }
        .shot-row{
          display:flex;
          align-items:center;
          gap:8px;
          padding:5px 0;
          border-bottom:1px solid var(--line);
          font-size:12px;
        }
        .shot-row.is-dead{ color:var(--ink-soft); opacity:.75; }
        .shot-thumb{
          width:32px;
          height:32px;
          flex:none;
          border-radius:8px;
          object-fit:cover;
          background:var(--line);
        }
        .shot-thumb.is-blank{ display:inline-block; }
        /* Flex children do not shrink below their content, so a long dish name
           would push the calories and the remove button off the card. */
        .shot-name{ flex:1 1 auto; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .shot-kcal{ flex:none; font-weight:700; color:var(--ink-soft); }

        .analysis-source{
          font-size:11.5px;
          line-height:1.5;
          margin-top:6px;
          color:var(--ink-soft);
        }
        .analysis-source.is-good{ color:var(--brand); font-weight:700; }
        .analysis-source.is-warn{ color:#8A5A3B; font-weight:700; }
        .analysis-warn{
          display:flex;
          gap:6px;
          align-items:flex-start;
          margin-top:8px;
          padding:8px 10px;
          border-radius:10px;
          background:var(--amber-soft);
          color:#8A5A3B;
          font-size:11.5px;
          line-height:1.6;
        }
        .portion-row{
          display:flex;
          flex-wrap:wrap;
          align-items:center;
          gap:6px;
          margin-top:10px;
        }
        .portion-label{ font-size:11.5px; font-weight:700; color:var(--ink-soft); }
        .portion-chip{
          border:1px solid var(--line);
          background:#fff;
          color:var(--ink-soft);
          border-radius:999px;
          padding:4px 10px;
          font-family:'Noto Sans TC', sans-serif;
          font-size:11.5px;
          font-weight:700;
          cursor:pointer;
        }
        .portion-chip.is-on{ background:var(--brand); border-color:var(--brand); color:#fff; }
        .analysis-items{
          margin-top:10px;
          border-top:1px solid var(--line);
        }
        .analysis-item{
          display:flex;
          justify-content:space-between;
          gap:10px;
          padding:5px 0;
          font-size:12px;
          color:var(--ink-soft);
          border-bottom:1px solid var(--line);
        }
        .analysis-item span:last-child{ flex:none; font-weight:700; }

        .analysis-modal-card .analysis-actions{
          position:sticky;
          bottom:0;
          background:#fff;
          padding:10px 0 2px;
          margin-top:6px;
          box-shadow:0 -10px 12px -10px rgba(0,0,0,0.25);
        }
        .analysis-card img{
          width:76px;
          height:76px;
          object-fit:cover;
          border-radius:10px;
          flex-shrink:0;
        }
        .analysis-card-body{ flex:1; min-width:0; }
        /* Looks like the heading it replaced until it is tapped — a box with
           a visible border here would read as an empty field to fill in rather
           than a name to correct. */
        .analysis-food-name{
          font-weight:700; font-size:13.5px; margin-bottom:2px;
          width:100%; border:1px solid transparent; border-radius:8px;
          padding:3px 6px; margin-left:-6px; background:transparent;
          color:var(--ink); font-family:'Noto Sans TC', sans-serif;
        }
        .analysis-food-name:hover{ border-color:var(--line); }
        .analysis-food-name:focus{ border-color:var(--brand); outline:none; background:#fff; }
        .analysis-cal-row{
          display:flex;
          align-items:center;
          gap:8px;
          margin:4px 0;
        }
        .analysis-cal-row .cal-num{
          font-family:'JetBrains Mono', monospace;
          font-weight:700;
          font-size:16px;
        }
        .cal-num-input{
          font-family:'JetBrains Mono', monospace;
          font-weight:700;
          font-size:16px;
          width:70px;
          border:1px solid var(--line);
          border-radius:8px;
          padding:4px 6px;
          background:#fff;
          color:var(--ink);
        }
        .food-log-cal-row{
          display:flex;
          align-items:center;
          gap:5px;
          flex-wrap:wrap;
        }
        .food-log-edit-icon{ color:var(--brand); flex-shrink:0; }
        .cal-num-input-inline{
          font-family:'JetBrains Mono', monospace;
          font-weight:700;
          font-size:13px;
          width:58px;
          border:1.5px solid var(--brand);
          border-radius:6px;
          padding:3px 6px;
          background:var(--brand-soft);
          color:var(--ink);
        }
        /* The note saying a remembered figure was used instead of the AI's
           guess. It has to be plainly visible: a number that changed itself
           without saying so is worse than the guess it replaced. */
        .cal-memory-note{
          display:flex;
          align-items:flex-start;
          gap:6px;
          font-size:11px;
          line-height:1.5;
          color:var(--ink-soft);
          background:var(--brand-soft);
          border-radius:8px;
          padding:7px 9px;
          margin:2px 0 6px;
        }
        .cal-memory-note strong{ color:var(--ink); }
        .cal-memory-note button{
          border:none;
          background:none;
          padding:0;
          margin-top:3px;
          font-size:11px;
          font-weight:700;
          color:var(--brand);
          text-decoration:underline;
          cursor:pointer;
          font-family:inherit;
          text-align:left;
        }
        .cal-memory-chip{
          display:block;
          width:100%;
          text-align:left;
          margin-top:6px;
          border:1px dashed var(--brand);
          background:var(--brand-soft);
          border-radius:8px;
          padding:6px 9px;
          font-size:11.5px;
          color:var(--ink);
          cursor:pointer;
          font-family:inherit;
        }
        /* A card that is closed until asked for: title, count, caret. */
        .fold-head{
          display:flex; align-items:center; gap:8px; width:100%;
          background:none; border:none; padding:0; cursor:pointer;
          font-family:inherit; text-align:left; color:var(--ink);
        }
        .fold-title{
          font-family:'Noto Serif TC', serif; font-weight:700; font-size:16px;
        }
        .fold-count{
          font-size:11px; font-weight:700; color:var(--brand);
          background:var(--brand-soft); border-radius:999px; padding:2px 9px;
        }
        .fold-caret{ margin-left:auto; font-size:9px; color:var(--ink-soft); }

        /* 其他資訊: four folds in one card, one open at a time. A hairline
           between them so the closed ones read as a list rather than four
           headings floating in space. */
        .fold-section + .fold-section{ border-top:1px solid var(--line); }
        .fold-section .fold-head{ padding:11px 0; }
        .fold-section .fold-title{ font-size:14px; }
        /* The one fold whose contents need a doctor. Folded away with a plain
           header it would look like the three reference lists next to it. */
        .fold-head.is-alert .fold-title{ color:var(--red); }
        .fold-head.is-alert .fold-count{ background:var(--red-soft); color:var(--red); }
        .fold-head.is-alert .fold-caret{ color:var(--red); }
        .refer-pointer{
          margin:10px 0 0; padding:8px 10px; border-radius:10px;
          background:var(--red-soft); color:var(--red);
          font-size:12px; font-weight:700; line-height:1.6;
        }
        /* The cards inside a fold already have their own padding and border;
           nested in here they would be a box inside a box. */
        .fold-body > .card{ padding:0; border:none; box-shadow:none; margin:0 0 10px; background:none; }
        .fold-body > .card:last-child{ margin-bottom:4px; }

        .memory-row{
          display:flex;
          align-items:center;
          gap:8px;
          padding:7px 0;
          border-bottom:1px solid var(--line);
          font-size:12.5px;
        }
        .memory-row:last-child{ border-bottom:none; }
        .memory-row .memory-name{ flex:1; min-width:0; overflow-wrap:anywhere; }
        .memory-row .memory-cal{
          font-family:'JetBrains Mono', monospace;
          font-weight:700;
          color:var(--cal);
        }
        .memory-row .memory-times{ font-size:10.5px; color:var(--ink-soft); }
        .analysis-macro{ font-size:11px; color:var(--ink-soft); margin-bottom:4px; }
        .analysis-reason{ font-size:11px; color:var(--ink-soft); margin-bottom:8px; line-height:1.4; }
        .analysis-actions{ display:flex; gap:8px; }
        .analysis-actions .btn{ flex:1; padding:8px 10px; font-size:12px; }

        .manual-entry-row{ display:flex; gap:8px; align-items:flex-end; }
        .manual-entry-row .field{ margin-bottom:0; flex:1; }
        .manual-entry-row .btn{ padding:10px 14px; }

        .food-log-empty{ font-size:12.5px; color:var(--ink-soft); }

        .content-sources{
          font-size:11px;
          color:var(--ink-soft);
          line-height:1.6;
          margin-top:6px;
          padding:10px 12px;
          border-top:1px solid var(--line);
        }
        .content-sources-title{ font-weight:700; margin-bottom:4px; }
        .content-sources ul{ margin:0; padding-left:16px; }

        .fab{
          position:absolute;
          right:16px;
          /* Clears the nav bar, which is now taller by the home indicator. */
          bottom:calc(82px + env(safe-area-inset-bottom));
          width:54px;
          height:54px;
          border-radius:50%;
          background:var(--brand);
          color:#fff;
          display:flex;
          align-items:center;
          justify-content:center;
          box-shadow:0 8px 20px rgba(30,42,34,.28);
          cursor:pointer;
          z-index:45;
          margin:0;
          border:none;
          padding:0;
          font:inherit;
        }
        .fab:active{ transform:scale(0.96); }

        .fab-menu-backdrop{
          position:fixed;
          inset:0;
          z-index:44;
          background:transparent;
        }
        .fab-menu{
          position:absolute;
          right:16px;
          /* Sits above the fab, so it moves by the same amount. */
          bottom:calc(144px + env(safe-area-inset-bottom));
          z-index:46;
          display:flex;
          flex-direction:column;
          gap:8px;
          align-items:flex-end;
        }
        .fab-menu-item{
          display:flex;
          align-items:center;
          gap:8px;
          background:#fff;
          color:var(--ink);
          border:1px solid var(--line);
          border-radius:999px;
          padding:10px 16px;
          font-size:13px;
          font-weight:700;
          box-shadow:0 6px 16px rgba(0,0,0,.15);
          white-space:nowrap;
          cursor:pointer;
        }

        .two-btn-row{
          display:flex;
          gap:8px;
          margin-bottom:10px;
        }
        .two-btn-row .btn{ flex:1; }
      `}</style>

      <div className="diabetes-app app-shell">
        {saveNote && <div className="save-toast">{saveNote}</div>}

        <header className="app-header">
          <h1 className="app-title">
            Healthy Care
          </h1>
        </header>

        <main className="app-main">
          {tab === "overview" && (
            <OverviewTab
              profile={profile}
              bmi={bmi}
              bmiCat={bmiCat}
              riskScore={riskScore}
              zone={zone}
              latestRecord={latestRecord}
              dailyCalorieTarget={dailyCalorieTarget}
              calorieBreakdown={calorieBreakdown}
              calorieOverride={calorieOverride}
              calorieOverrideInput={calorieOverrideInput}
              setCalorieOverrideInput={setCalorieOverrideInput}
              onSaveCalorieOverride={handleSaveCalorieOverride}
              onClearCalorieOverride={handleClearCalorieOverride}
              consumedToday={consumedToday}
              remainingToday={remainingToday}
              calZone={calZone}
              waterTarget={waterTarget}
              waterBreakdown={waterBreakdown}
              consumedWaterToday={consumedWaterToday}
              todayWaterEntries={todayWaterEntries}
              recentWaterEntries={recentWaterEntries}
              weeklyWaterChartData={weeklyWaterChartData}
              onAddWater={handleAddWater}
              onDeleteWaterEntry={handleDeleteWaterEntry}
              onUpdateWaterEntry={handleUpdateWaterEntry}
              onPersistWaterEntry={handlePersistWaterEntry}
              goProfile={() => setTab("profile")}
              goDiet={() => setTab("diet")}
              goExercise={() => setTab("exercise")}
              goTracking={() => setTab("tracking")}
              todayGoals={todayGoals}
              garden={garden}
              coachSlotName={coachVisible ? slot : null}
              coachMorning={coachMorning}
              coachEvening={coachEvening}
              onDismissCoach={dismissCoach}
            />
          )}

          {tab === "profile" && (
            <ProfileTab
              form={form}
              setForm={setForm}
              toggleSymptom={toggleSymptom}
              onSave={handleSaveProfile}
              onRequestReset={() => setShowReset(true)}
              hasProfile={!!profile}
              aiProvider={aiProvider}
              onChangeProvider={handleChangeProvider}
              apiKey={apiKey}
              apiKeyInput={apiKeyInput}
              setApiKeyInput={setApiKeyInput}
              onSaveApiKey={handleSaveApiKey}
              onClearApiKey={handleClearApiKey}
              geminiKey={geminiKey}
              geminiKeyInput={geminiKeyInput}
              setGeminiKeyInput={setGeminiKeyInput}
              onSaveGeminiKey={handleSaveGeminiKey}
              onClearGeminiKey={handleClearGeminiKey}
              geminiModelInput={geminiModelInput}
              setGeminiModelInput={setGeminiModelInput}
              onSaveGeminiModel={handleSaveGeminiModel}
              onExportBackup={handleExportBackup}
              onImportBackup={handleImportBackup}
            />
          )}

          {tab === "diet" && (
            <DietTab
              profile={profile}
              bmiCat={bmiCat}
              dailyCalorieTarget={dailyCalorieTarget}
              calorieBreakdown={calorieBreakdown}
              calorieOverride={calorieOverride}
              calorieOverrideInput={calorieOverrideInput}
              setCalorieOverrideInput={setCalorieOverrideInput}
              onSaveCalorieOverride={handleSaveCalorieOverride}
              onClearCalorieOverride={handleClearCalorieOverride}
              consumedToday={consumedToday}
              remainingToday={remainingToday}
              calZone={calZone}
              todayEntries={todayEntries}
              recentFoodEntries={recentFoodEntries}
              foodLog={foodLog}
              summaries={goalSummaries}
              weeklyCalorieData={weeklyCalorieData}
              manualForm={manualForm}
              setManualForm={setManualForm}
              onPhotoFile={handlePhotoFile}
              onAddManualEntry={handleAddManualEntry}
              onDeleteFoodEntry={handleDeleteFoodEntry}
              onUpdateFoodEntryCalories={handleUpdateFoodEntryCalories}
              onPersistFoodEntryCalories={handlePersistFoodEntryCalories}
              foodMemory={foodMemory}
              onForgetCalories={forgetCalories}
              report={latestReport(reports)}
            />
          )}

          {tab === "exercise" && (
            <ExerciseTab
              plan={exercisePlan}
              feedback={exerciseWeeklyFeedback}
              todayGoals={todayGoals}
              summaries={goalSummaries}
              weeklyChartData={weeklyExerciseChartData}
              thisWeekEntries={thisWeekExerciseEntries}
              exerciseForm={exerciseForm}
              setExerciseForm={setExerciseForm}
              onAddExerciseEntry={handleAddExerciseEntry}
              onDeleteExerciseEntry={handleDeleteExerciseEntry}
              onUpdateExerciseEntry={handleUpdateExerciseEntry}
              onPersistExerciseEntry={handlePersistExerciseEntry}
              suggestions={
                <WorkoutSuggestions
                  profile={profile}
                  latestRecord={latestRecord}
                  report={latestReport(reports)}
                  exerciseLog={thisWeekExerciseEntries}
                  savedLinks={workoutLinks}
                  onSaveLink={handleSaveWorkoutLink}
                  onQuickAdd={handleQuickAddWorkout}
                />
              }
            />
          )}

          {tab === "health" && (
            <HealthAnalysis
              profile={profile}
              latestRecord={latestRecord}
              records={records}
              reports={reports}
              summaries={goalSummaries}
              foodLog={foodLog}
              exerciseLog={exerciseLog}
              waterLog={waterLog}
              onAnalyzeReportPhoto={analyzeReportPhoto}
              onSaveReport={handleSaveReport}
              onDeleteReport={handleDeleteReport}
              visits={visits}
              onSaveVisit={handleSaveVisit}
              onDeleteVisit={handleDeleteVisit}
              onToggleVisitDone={handleToggleVisitDone}
              plans={examPlans}
              onSavePlan={handleSavePlan}
              onDeletePlan={handleDeletePlan}
              onTogglePlanDone={handleTogglePlanDone}
              onAddToCalendar={handleAddToCalendar}
            />
          )}

          {tab === "tracking" && (
            <TrackingTab
              profile={profile}
              records={records}
              recordForm={recordForm}
              setRecordForm={setRecordForm}
              onAddRecord={handleAddRecord}
              onDeleteRecord={handleDeleteRecord}
              onEditRecord={handleEditRecord}
              chartData={chartData}
              onBodyPhoto={handleBodyPhoto}
              bodyScanning={bodyScanning}
              bodyScanNote={bodyScanNote}
              onDismissBodyScan={() => setBodyScanNote(null)}
            />
          )}
        </main>

        <nav className="bottom-nav">
          <button className={`nav-btn ${tab === "overview" ? "active" : ""}`} onClick={() => setTab("overview")}>
            <Home size={20} />
            總覽
          </button>
          <button className={`nav-btn ${tab === "profile" ? "active" : ""}`} onClick={() => setTab("profile")}>
            <UserRound size={20} />
            個人資料
          </button>
          <button className={`nav-btn ${tab === "diet" ? "active" : ""}`} onClick={() => setTab("diet")}>
            <Utensils size={20} />
            飲食建議
          </button>
          <button className={`nav-btn ${tab === "exercise" ? "active" : ""}`} onClick={() => setTab("exercise")}>
            <Dumbbell size={20} />
            活動力
          </button>
          <button className={`nav-btn ${tab === "tracking" ? "active" : ""}`} onClick={() => setTab("tracking")}>
            <Activity size={20} />
            體態紀錄
          </button>
          <button className={`nav-btn ${tab === "health" ? "active" : ""}`} onClick={() => setTab("health")}>
            <HeartPulse size={20} />
            健康分析
          </button>
        </nav>

        {showCaptureMenu && (
          <div className="fab-menu">
            <label className="fab-menu-item photo-input-label">
              <Camera size={17} /> 拍照
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => {
                  setShowCaptureMenu(false);
                  handlePhotoFile(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
            <label className="fab-menu-item photo-input-label">
              <ImageIcon size={17} /> 相簿（可多選）
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => {
                  setShowCaptureMenu(false);
                  handlePhotoFile(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
        )}
        <button
          className="fab"
          title="拍照或選擇食物相片分析熱量"
          onClick={() => setShowCaptureMenu((v) => !v)}
        >
          <Camera size={22} />
        </button>
      </div>

      {showCaptureMenu && <div className="fab-menu-backdrop" onClick={() => setShowCaptureMenu(false)} />}

      <AnalysisModal
        analyzing={analyzing}
        analysisError={analysisError}
        analysisPreview={analysisPreview}
        onConfirm={confirmAnalysisEntry}
        onDiscard={discardAnalysis}
        onEditCalories={updateAnalysisCalories}
        onEditName={updateAnalysisName}
        onUseEstimate={useAnalysisEstimate}
        onSetPortion={setAnalysisPortion}
        onRemovePhoto={removeAnalysisPhoto}
        analysisProgress={analysisProgress}
        report={latestReport(reports)}
        gender={profile && profile.gender === "male" ? "male" : "female"}
      />

      {showReset && (
        <div className="modal-backdrop" onClick={() => setShowReset(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>清除所有資料？</h3>
            <p>這將刪除您的個人資料與所有體態紀錄，且無法復原。</p>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowReset(false)}>
                取消
              </button>
              <button className="btn btn-danger" onClick={handleResetAll}>
                確定清除
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ----------------------------------------------------------------------- */
/* Tabs                                                                     */
/* ----------------------------------------------------------------------- */

function OverviewTab({
  profile,
  bmi,
  bmiCat,
  riskScore,
  zone,
  latestRecord,
  dailyCalorieTarget,
  calorieBreakdown,
  calorieOverride,
  calorieOverrideInput,
  setCalorieOverrideInput,
  onSaveCalorieOverride,
  onClearCalorieOverride,
  consumedToday,
  remainingToday,
  calZone,
  waterTarget,
  waterBreakdown,
  consumedWaterToday,
  todayWaterEntries,
  recentWaterEntries,
  weeklyWaterChartData,
  onAddWater,
  onDeleteWaterEntry,
  onUpdateWaterEntry,
  onPersistWaterEntry,
  goProfile,
  goDiet,
  goExercise,
  goTracking,
  todayGoals,
  garden,
  coachSlotName,
  coachMorning,
  coachEvening,
  onDismissCoach,
}) {
  const [showRisk, setShowRisk] = useState(false);

  if (!profile) {
    return (
      <div className="card empty-cta">
        <p>尚未建立個人資料，先完成基本資料設定，即可獲得個人化的飲食與運動建議。</p>
        <button className="btn btn-primary" onClick={goProfile}>
          <Plus size={16} /> 建立個人資料
        </button>
      </div>
    );
  }

  return (
    <>
      {coachSlotName === "morning" ? (
        <DailyCoach
          slot="morning"
          message={coachMorning}
          nickname={profile.nickname}
          avatar={profile.avatar}
          onDismiss={onDismissCoach}
        />
      ) : null}

      {/* 喝水在最上面，因為它是這一頁唯一一個一天要碰好幾次的東西。
          原本它排在樹苗、風險評分和今日熱量後面，每次補記一杯都要先捲過
          一千四百像素 —— 一個常用的動作被擺在不常看的東西後面。 */}
      <WaterCard
        target={waterTarget}
        breakdown={waterBreakdown}
        consumedToday={consumedWaterToday}
        todayWaterEntries={todayWaterEntries}
        recentWaterEntries={recentWaterEntries}
        weeklyWaterChartData={weeklyWaterChartData}
        onAddWater={onAddWater}
        onDeleteWaterEntry={onDeleteWaterEntry}
        onUpdateWaterEntry={onUpdateWaterEntry}
        onPersistWaterEntry={onPersistWaterEntry}
      />

      {todayGoals && garden ? (
        <GrowthPanel day={todayGoals} garden={garden} onGoActivity={goExercise} />
      ) : null}

      {coachSlotName === "evening" ? (
        <DailyCoach
          slot="evening"
          summary={coachEvening}
          nickname={profile.nickname}
          avatar={profile.avatar}
          onDismiss={onDismissCoach}
        />
      ) : null}

      {/* 收合成一行。這個分數是慢慢變的東西 —— 今天看和下個月看多半一樣 ——
          但它本來用了 335px 的半圓儀表來講一個詞，把一天要記好幾次的喝水
          推到畫面外。結論（那個詞和分數）永遠看得到，儀表和說明點開才有。 */}
      <div className="card risk-card">
        <button
          type="button"
          className="risk-summary"
          aria-expanded={showRisk}
          onClick={() => setShowRisk((v) => !v)}
        >
          <span className="risk-k">健康關注度</span>
          <span className={`risk-v tone-${zone.tone}`}>{zone.label}</span>
          <span className="risk-n">{Math.round(riskScore)}</span>
          <ChevronDown size={15} className={`risk-chev ${showRisk ? "open" : ""}`} />
        </button>

        {showRisk && (
          <>
            <div className="gauge-wrap">
              <Gauge score={riskScore} />
              <div className={`gauge-label tone-${zone.tone}`}>{zone.label}</div>
              <div className="gauge-advice">{zone.advice}</div>
              {!profile.age ? (
                <div className="gauge-caveat">
                  沒有填年齡，這個估算沒有計入年齡因素，實際關注程度可能更高。
                </div>
              ) : null}
            </div>
            <Disclaimer compact />
          </>
        )}
      </div>

      <div className="card">
        <div className="section-title">今日熱量</div>
        <CalorieBar
          target={dailyCalorieTarget}
          consumed={consumedToday}
          remaining={remainingToday}
          zone={calZone}
          breakdown={calorieBreakdown}
          override={calorieOverride}
          overrideInput={calorieOverrideInput}
          setOverrideInput={setCalorieOverrideInput}
          onSaveOverride={onSaveCalorieOverride}
          onClearOverride={onClearCalorieOverride}
        />
      </div>

      <div className="stat-grid">
        <div className="stat-box">
          <div className="label">BMI</div>
          <div className="value">
            {fmtNum(bmi)} <span>{bmiCat.label}</span>
          </div>
        </div>
        <div className="stat-box">
          <div className="label">目前體重</div>
          <div className="value">
            {latestRecord ? fmtNum(latestRecord.weight) : fmtNum(profile.weight)} <span>kg</span>
          </div>
        </div>
        <div className="stat-box">
          <div className="label">內臟脂肪等級</div>
          <div className="value">{latestRecord ? fmtNum(latestRecord.visceralFat, 0) : "—"}</div>
        </div>
        <div className="stat-box">
          <div className="label">基礎代謝率</div>
          <div className="value">
            {latestRecord ? fmtNum(latestRecord.bmr, 0) : "—"} <span>kcal</span>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="section-title">快速前往</div>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <button className="btn btn-secondary btn-block" onClick={goDiet}>
            <Camera size={15} /> 拍照分析今天吃的食物
          </button>
          <button className="btn btn-secondary btn-block" onClick={goExercise}>
            查看本週運動建議
          </button>
          <button className="btn btn-secondary btn-block" onClick={goTracking}>
            新增今日體態紀錄
          </button>
        </div>
      </div>
    </>
  );
}

function ProfileTab({
  form,
  setForm,
  toggleSymptom,
  onSave,
  onRequestReset,
  hasProfile,
  aiProvider,
  onChangeProvider,
  apiKey,
  apiKeyInput,
  setApiKeyInput,
  onSaveApiKey,
  onClearApiKey,
  geminiKey,
  geminiKeyInput,
  setGeminiKeyInput,
  onSaveGeminiKey,
  onClearGeminiKey,
  geminiModelInput,
  setGeminiModelInput,
  onSaveGeminiModel,
  onExportBackup,
  onImportBackup,
}) {
  return (
    <form onSubmit={onSave}>
      <div className="card">
        <div className="section-title">基本資料</div>
        <p style={{ fontSize: "11.5px", color: "var(--ink-soft)", margin: "-4px 0 12px" }}>
          填寫年齡、身高、體重後會自動存檔，不用擔心忘記按儲存。
        </p>

        <div className="identity-row">
          <AvatarPicker
            avatar={form.avatar}
            nickname={form.nickname}
            onChange={(next) => setForm((f) => ({ ...f, avatar: next }))}
          />
          <div className="field identity-name">
            <label>稱謂</label>
            <input
              type="text"
              maxLength={12}
              value={form.nickname}
              onChange={(e) => setForm((f) => ({ ...f, nickname: e.target.value }))}
              placeholder="想被怎麼叫？"
            />
            <p className="field-hint">早晚的問候與總結會用這個稱謂。</p>
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label>年齡（選填）</label>
            <input
              type="number"
              min="1"
              max="120"
              value={form.age}
              onChange={(e) => setForm((f) => ({ ...f, age: e.target.value }))}
              placeholder="例：45"
            />
            <p className="field-hint">
              不填也可以。年齡只用來估算基礎代謝率；體態紀錄裡填過基礎代謝率的話就用不到。
            </p>
          </div>
          <div className="field">
            <label>性別</label>
            <select value={form.gender} onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}>
              <option value="female">女性</option>
              <option value="male">男性</option>
              <option value="other">其他／不透露</option>
            </select>
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label>身高（cm）</label>
            <input
              type="number"
              min="100"
              max="230"
              value={form.height}
              onChange={(e) => setForm((f) => ({ ...f, height: e.target.value }))}
              placeholder="例：160"
              required
            />
          </div>
          <div className="field">
            <label>目前體重（kg）</label>
            <input
              type="number"
              min="20"
              max="250"
              step="0.1"
              value={form.weight}
              onChange={(e) => setForm((f) => ({ ...f, weight: e.target.value }))}
              placeholder="例：65"
              required
            />
          </div>
        </div>

        <div className="field">
          <label>平時活動量（每週平均）</label>
          <div className="intensity-row">
            <label className="intensity-check">
              <input
                type="checkbox"
                checked={form.vigorousChecked}
                onChange={(e) => setForm((f) => ({ ...f, vigorousChecked: e.target.checked }))}
              />
              強度
            </label>
            <input
              type="number"
              min="0"
              className="intensity-minutes"
              value={form.vigorousMinutes}
              onChange={(e) => setForm((f) => ({ ...f, vigorousMinutes: e.target.value }))}
              placeholder="分鐘"
              disabled={!form.vigorousChecked}
            />
            <span className="intensity-unit">分鐘／週</span>
          </div>
          <div className="intensity-row">
            <label className="intensity-check">
              <input
                type="checkbox"
                checked={form.moderateChecked}
                onChange={(e) => setForm((f) => ({ ...f, moderateChecked: e.target.checked }))}
              />
              中度
            </label>
            <input
              type="number"
              min="0"
              className="intensity-minutes"
              value={form.moderateMinutes}
              onChange={(e) => setForm((f) => ({ ...f, moderateMinutes: e.target.value }))}
              placeholder="分鐘"
              disabled={!form.moderateChecked}
            />
            <span className="intensity-unit">分鐘／週</span>
          </div>
          <div className="intensity-row">
            <label className="intensity-check">
              <input
                type="checkbox"
                checked={form.lightChecked}
                onChange={(e) => setForm((f) => ({ ...f, lightChecked: e.target.checked }))}
              />
              輕度
            </label>
            <input
              type="number"
              min="0"
              className="intensity-minutes"
              value={form.lightMinutes}
              onChange={(e) => setForm((f) => ({ ...f, lightMinutes: e.target.value }))}
              placeholder="分鐘"
              disabled={!form.lightChecked}
            />
            <span className="intensity-unit">分鐘／週</span>
          </div>
          <p style={{ fontSize: "11px", color: "var(--ink-soft)", margin: "6px 0 0" }}>
            勾選你平常會做的運動強度，並填每週累積分鐘數，用來估算熱量、飲水量等每日建議值。
          </p>
        </div>
      </div>

      <div className="card">
        <div className="section-title">主要病徵／風險因子（可複選）</div>
        <div className="chip-grid">
          {SYMPTOM_OPTIONS.map((s) => (
            <div key={s.id} className={`chip ${form.symptoms.includes(s.id) ? "active" : ""}`} onClick={() => toggleSymptom(s.id)}>
              {s.label}
            </div>
          ))}
        </div>
      </div>

      <button type="submit" className="btn btn-primary btn-block">
        儲存個人資料
      </button>

      <div className="card" style={{ marginTop: "14px" }}>
        <div className="section-title">資料備份</div>
        <p style={{ fontSize: "12px", color: "var(--ink-soft)", lineHeight: 1.6, margin: "0 0 10px" }}>
          資料存在這台裝置的瀏覽器裡；建議偶爾匯出備份存起來，換裝置、清除瀏覽器資料，或
          任何原因造成資料不見時，都可以用備份檔案救回。點「匯出備份」會跳出分享選單，
          可以選擇存到 Google Drive、iCloud 雲端硬碟或其他雲端空間。
        </p>
        <div className="btn-row">
          <button type="button" className="btn btn-secondary" onClick={onExportBackup}>
            匯出備份
          </button>
          <label className="btn btn-secondary photo-input-label">
            匯入備份
            <input
              type="file"
              accept="application/json,.json"
              onChange={(e) => {
                const file = e.target.files?.[0];
                onImportBackup(file);
                e.target.value = "";
              }}
            />
          </label>
        </div>
      </div>

      {hasProfile && (
        <button type="button" className="btn btn-danger btn-block" style={{ marginTop: "10px" }} onClick={onRequestReset}>
          <RotateCcw size={15} /> 清除所有資料
        </button>
      )}

      <Disclaimer />

      <div className="card">
        <div className="section-title">AI 拍照分析設定</div>
        <p style={{ fontSize: "12px", color: "var(--ink-soft)", lineHeight: 1.6, margin: "0 0 10px" }}>
          「拍照分析熱量」功能需要你自己申請 AI 服務的 API Key。金鑰只會儲存在這台裝置的瀏覽器裡，不會上傳到任何伺服器；請避免在公用電腦上保存。
        </p>

        <div className="field">
          <label>選擇要使用的 AI 服務</label>
          <div className="segmented">
            <div className={`chip ${aiProvider === "gemini" ? "active" : ""}`} onClick={() => onChangeProvider("gemini")}>
              Google Gemini（免費）
            </div>
            <div className={`chip ${aiProvider === "anthropic" ? "active" : ""}`} onClick={() => onChangeProvider("anthropic")}>
              Anthropic Claude（付費）
            </div>
          </div>
        </div>

        {aiProvider === "gemini" ? (
          <>
            <p style={{ fontSize: "12px", color: "var(--ink-soft)", lineHeight: 1.6, margin: "10px 0" }}>
              Google AI Studio 提供不需信用卡的免費額度（有速率限制）。前往{" "}
              <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer">
                aistudio.google.com
              </a>{" "}
              用 Google 帳號登入，點「Create API Key」建立金鑰即可。
            </p>
            <div className="field">
              <label>Google Gemini API Key</label>
              <input
                type="password"
                value={geminiKeyInput}
                onChange={(e) => setGeminiKeyInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    onSaveGeminiKey();
                  }
                }}
                placeholder="AIza..."
                autoComplete="off"
              />
            </div>
            <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
              <button type="button" className="btn btn-primary" style={{ flex: 1 }} onClick={onSaveGeminiKey}>
                儲存金鑰
              </button>
              {geminiKey && (
                <button type="button" className="btn btn-danger" onClick={onClearGeminiKey}>
                  清除
                </button>
              )}
            </div>
            <details>
              <summary style={{ fontSize: "12px", color: "var(--ink-soft)", cursor: "pointer" }}>進階：自訂模型名稱</summary>
              <div className="field" style={{ marginTop: "8px" }}>
                <label>Gemini 模型名稱（預設 gemini-3.6-flash）</label>
                <input
                  type="text"
                  value={geminiModelInput}
                  onChange={(e) => setGeminiModelInput(e.target.value)}
                  onBlur={onSaveGeminiModel}
                  placeholder="gemini-3.6-flash"
                  autoComplete="off"
                />
              </div>
              <p style={{ fontSize: "11px", color: "var(--ink-soft)", lineHeight: 1.5 }}>
                如果辨識失敗並顯示「找不到模型」，表示 Google 可能已更新模型名稱，可到{" "}
                <a href="https://ai.google.dev/gemini-api/docs/models" target="_blank" rel="noreferrer">
                  官方模型列表
                </a>{" "}
                查詢目前可用的名稱並填在這裡。
              </p>
            </details>
            <p style={{ fontSize: "11px", color: geminiKey ? "var(--green)" : "var(--ink-soft)", marginTop: "10px" }}>
              {geminiKey ? "✓ 已設定 Gemini 金鑰，拍照分析功能可以使用" : "尚未設定金鑰，拍照分析功能暫時無法使用"}
            </p>
          </>
        ) : (
          <>
            <p style={{ fontSize: "12px", color: "var(--ink-soft)", lineHeight: 1.6, margin: "10px 0" }}>
              前往{" "}
              <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">
                console.anthropic.com
              </a>{" "}
              建立金鑰（需要先加值/綁定付款方式，建議同時設定用量上限）。
            </p>
            <div className="field">
              <label>Anthropic API Key</label>
              <input
                type="password"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    onSaveApiKey();
                  }
                }}
                placeholder="sk-ant-..."
                autoComplete="off"
              />
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button type="button" className="btn btn-primary" style={{ flex: 1 }} onClick={onSaveApiKey}>
                儲存金鑰
              </button>
              {apiKey && (
                <button type="button" className="btn btn-danger" onClick={onClearApiKey}>
                  清除
                </button>
              )}
            </div>
            <p style={{ fontSize: "11px", color: apiKey ? "var(--green)" : "var(--ink-soft)", marginTop: "8px" }}>
              {apiKey ? "✓ 已設定金鑰，拍照分析功能可以使用" : "尚未設定金鑰，拍照分析功能暫時無法使用"}
            </p>
          </>
        )}
      </div>
    </form>
  );
}

function DietTab({
  foodLog,
  summaries,
  profile,
  bmiCat,
  dailyCalorieTarget,
  calorieBreakdown,
  calorieOverride,
  calorieOverrideInput,
  setCalorieOverrideInput,
  onSaveCalorieOverride,
  onClearCalorieOverride,
  consumedToday,
  remainingToday,
  calZone,
  todayEntries,
  recentFoodEntries,
  weeklyCalorieData,
  manualForm,
  setManualForm,
  onPhotoFile,
  onAddManualEntry,
  onDeleteFoodEntry,
  onUpdateFoodEntryCalories,
  onPersistFoodEntryCalories,
  foodMemory,
  onForgetCalories,
  report,
}) {
  const [showMemory, setShowMemory] = useState(false);
  /* What is already remembered for the name being typed by hand. Offered,
     never filled in on its own: a name typed from scratch is often a new
     portion of something with the same name. */
  const manualMemory = lookup(foodMemory, manualForm.name);
  const manualMemoryFits =
    manualMemory && String(manualForm.calories).trim() !== String(manualMemory.calories);
  const remembered = sortedMemory(foodMemory);
  const symptoms = profile?.symptoms || [];
  const cautionNotes = [];
  if (symptoms.includes("hypertension")) {
    cautionNotes.push("您有高血壓，加工／醃漬類高鹽食品建議一律視為紅燈，並落實「少鹽」原則。");
  }
  if (symptoms.includes("hyperlipidemia")) {
    cautionNotes.push("您有高血脂，油炸與肥肉類食物建議降級為紅燈，並增加膳食纖維攝取。");
  }
  if (bmiCat.tone === "red") {
    cautionNotes.push("您的BMI偏高，精緻澱粉與含糖飲料的紅燈原則需嚴格遵守，並留意整體熱量攝取。");
  }
  if (symptoms.includes("prediabetes")) {
    cautionNotes.push("您已被醫師告知糖尿病前期，除本建議外，請務必定期回診追蹤血糖並遵循醫囑。");
  }

  return (
    <>
      {/* 記錄擺在讀數前面。這一頁真正要做的事是「把剛吃的東西記下來」，
          而它本來排在今日熱量和本週趨勢後面 —— 兩張只是給人看的卡片擋在
          一個每天要用三次的動作前面。 */}
      <div className="card">
        <div className="section-title">拍照分析熱量</div>

        <div className="two-btn-row">
          <label className="btn btn-primary photo-input-label">
            <Camera size={16} /> 拍照
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => {
                onPhotoFile(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
          <label className="btn btn-secondary photo-input-label">
            <ImageIcon size={16} /> 相簿（可多選）
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => {
                onPhotoFile(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
        </div>
        <p style={{ fontSize: "11.5px", color: "var(--ink-soft)", margin: "0 0 4px" }}>
          拍照後會自動分析，結果會以彈出視窗顯示，確認無誤後即可加入今日紀錄。
          一餐有好幾盤時，可以從相簿一次選最多 {MAX_FOOD_PHOTOS} 張，熱量會加起來算成同一筆。
        </p>

        <div className="section-title" style={{ marginTop: "14px", fontSize: "13px" }}>
          或手動輸入
        </div>
        <form onSubmit={onAddManualEntry} className="manual-entry-row">
          <div className="field">
            <label>食物名稱</label>
            <input
              type="text"
              value={manualForm.name}
              onChange={(e) => setManualForm({ ...manualForm, name: e.target.value })}
              placeholder="例：便當"
            />
            {manualMemoryFits && (
              <button
                type="button"
                className="cal-memory-chip"
                onClick={() => setManualForm({ ...manualForm, calories: String(manualMemory.calories) })}
              >
                「{manualMemory.name}」你之前記的是 {manualMemory.calories} 大卡 —— 點這裡套用
              </button>
            )}
          </div>
          <div className="field" style={{ maxWidth: "110px" }}>
            <label>熱量(大卡)</label>
            <input
              type="number"
              value={manualForm.calories}
              onChange={(e) => setManualForm({ ...manualForm, calories: e.target.value })}
              placeholder="600"
            />
          </div>
          <button type="submit" className="btn btn-secondary">
            <Plus size={15} />
          </button>
        </form>

        <p style={{ fontSize: "11px", color: "var(--ink-soft)", margin: "8px 0 0", lineHeight: 1.6 }}>
          不確定熱量多少？可以查{" "}
          <a href="https://consumer.fda.gov.tw/Food/TFND.aspx?nodeID=178" target="_blank" rel="noreferrer">
            衛福部食品藥物管理署「食品營養成分資料庫」
          </a>
          ，輸入食品分類或關鍵字即可查到官方標準熱量與營養成分，比 AI 拍照估算更準確
          （包裝食品也建議直接看包裝上的營養標示）。
        </p>

        <div className="disclaimer disclaimer-compact" style={{ marginTop: "12px" }}>
          <Info size={14} />
          <span>
            照片熱量為 AI 估算，僅供參考，實際數值可能有落差；若您正在接受飲食失調相關治療或對熱量紀錄感到壓力，建議暫停使用本功能並諮詢專業人員。
          </span>
        </div>
      </div>

      <div className="card">
        <div className="section-title">今日熱量</div>
        <CalorieBar
          target={dailyCalorieTarget}
          consumed={consumedToday}
          remaining={remainingToday}
          zone={calZone}
          breakdown={calorieBreakdown}
          override={calorieOverride}
          overrideInput={calorieOverrideInput}
          setOverrideInput={setCalorieOverrideInput}
          onSaveOverride={onSaveCalorieOverride}
          onClearOverride={onClearCalorieOverride}
        />
      </div>

      {weeklyCalorieData.some((d) => d.total > 0) && (
        <div className="card">
          <div className="section-title">本週熱量趨勢</div>
          <div style={{ width: "100%", height: 200 }}>
            <ResponsiveContainer>
              <BarChart data={weeklyCalorieData} margin={{ top: 6, right: 10, left: -18, bottom: 0 }}>
                <CartesianGrid stroke="#DCE3DC" strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                {dailyCalorieTarget != null && (
                  <ReferenceLine
                    y={dailyCalorieTarget}
                    stroke="#C63C34"
                    strokeDasharray="4 4"
                    label={{ value: "建議攝取", fontSize: 10, fill: "#C63C34", position: "insideTopRight" }}
                  />
                )}
                <Bar dataKey="total" fill="#2F6F5E" radius={[4, 4, 0, 0]} name="攝取熱量" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {remembered.length > 0 && (
        <div className="card">
          {/* Closed by default. These figures do their work silently when a
              photo is taken; the only reason to open this is to correct or
              delete one, and that is rare. */}
          <button type="button" className="fold-head" onClick={() => setShowMemory((v) => !v)}>
            <span className="fold-title">我的熱量標準值</span>
            <span className="fold-count">{remembered.length} 項</span>
            <span className="fold-caret">{showMemory ? "▲" : "▼"}</span>
          </button>

          {showMemory && (
            <>
              <p style={{ fontSize: "11.5px", color: "var(--ink-soft)", margin: "8px 0", lineHeight: 1.6 }}>
                你改過熱量的食物會記在這裡，下次拍到同一樣東西就直接用這個數字，不必再改一次。
                數字記錯了就刪掉，下次會重新讓 AI 估。
              </p>
              {remembered.map((item) => (
                <div className="memory-row" key={item.key}>
                  <span className="memory-name">{item.name}</span>
                  <span className="memory-cal">{item.calories}</span>
                  <span className="memory-times">大卡{item.times > 1 ? `・改過 ${item.times} 次` : ""}</span>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`刪除 ${item.name} 的標準值`}
                    onClick={() => onForgetCalories(item.name)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      <DietDiary
        entries={foodLog}
        summaries={summaries}
        report={report}
        gender={profile && profile.gender === "male" ? "male" : "female"}
        onUpdateFoodEntryCalories={onUpdateFoodEntryCalories}
        onPersistFoodEntryCalories={onPersistFoodEntryCalories}
        onDeleteFoodEntry={onDeleteFoodEntry}
        lightWord={lightWord}
        PillComponent={Pill}
      />

      {cautionNotes.length > 0 && (
        <div className="card">
          <div className="section-title">依您的狀況特別提醒</div>
          <ul className="caution-list">
            {cautionNotes.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="card">
        <div className="section-title">飲食紅綠燈指南</div>
        {FOOD_DB.map((cat) => (
          <div className="food-cat" key={cat.id}>
            <div className="food-cat-name">{cat.name}</div>
            <div className="food-cat-tip">{cat.tip}</div>
            {cat.items.map((item, i) => (
              <div className="food-item-row" key={i}>
                <span className="food-item-name">{item.name}</span>
                <Pill light={item.light}>{lightWord(item.light)}</Pill>
              </div>
            ))}
          </div>
        ))}
        <ContentSources />
      </div>

      <Disclaimer />
    </>
  );
}

function ExerciseTab({
  plan,
  feedback,
  weeklyChartData,
  thisWeekEntries,
  exerciseForm,
  setExerciseForm,
  onAddExerciseEntry,
  onDeleteExerciseEntry,
  onUpdateExerciseEntry,
  onPersistExerciseEntry,
  todayGoals,
  summaries,
  /** The 運動建議 card, rendered just above 日常小習慣. */
  suggestions,
}) {
  const [showAllExercise, setShowAllExercise] = useState(false);
  const [showExerciseForm, setShowExerciseForm] = useState(false);
  const pctForBar = Math.min(feedback.pct, 100);

  return (
    <>
      {todayGoals ? <ActivityPanel day={todayGoals} /> : null}

      {/* Straight under the three rings, because this is the card she comes
          to this page to use: look at today, add what she did, see it land.
          It used to sit below the weekly plan and the achievement bar — two
          screens of reading before the one thing that needed a tap.

          Entry and記錄 are one card rather than two: they are one action seen
          from both ends, and a separate 「新增」 card with a date field and
          twelve chips permanently open pushed everything else off the screen. */}
      <div className="card">
        <div className="section-title">運動紀錄</div>

        {/* Collapsed by default. The form is only wanted for the few seconds
            after she has actually exercised; the list is wanted every time. */}
        {showExerciseForm ? (
          <form onSubmit={onAddExerciseEntry}>
            <div className="field">
              <label>日期</label>
              <input
                type="date"
                value={exerciseForm.date}
                onChange={(e) => setExerciseForm((f) => ({ ...f, date: e.target.value }))}
              />
            </div>
            <div className="field">
              <label>運動內容</label>
              <div className="chip-grid">
                {ACTIVITY_LOG_OPTIONS.map((opt) => (
                  <div
                    key={opt.id}
                    className={`chip ${exerciseForm.activityId === opt.id ? "active" : ""}`}
                    onClick={() => setExerciseForm((f) => ({ ...f, activityId: opt.id }))}
                  >
                    {opt.label}
                  </div>
                ))}
              </div>
            </div>
            {exerciseForm.activityId === "other" && (
              <div className="field">
                <label>自訂運動名稱</label>
                <input
                  type="text"
                  value={exerciseForm.customLabel}
                  onChange={(e) => setExerciseForm((f) => ({ ...f, customLabel: e.target.value }))}
                  placeholder="例：登山、跳繩"
                />
              </div>
            )}
            <div className="field">
              <label>運動時間（分鐘）</label>
              <input
                type="number"
                value={exerciseForm.durationMin}
                onChange={(e) => setExerciseForm((f) => ({ ...f, durationMin: e.target.value }))}
                placeholder="例：30"
              />
            </div>
            <div className="btn-row">
              <button type="button" className="btn btn-secondary" onClick={() => setShowExerciseForm(false)}>
                收起
              </button>
              <button type="submit" className="btn btn-primary">
                <Plus size={15} /> 加入紀錄
              </button>
            </div>
          </form>
        ) : (
          <button type="button" className="btn btn-primary btn-block" onClick={() => setShowExerciseForm(true)}>
            <Plus size={15} /> 自行輸入一筆運動
          </button>
        )}

        <div className="section-title" style={{ marginTop: "14px", fontSize: "13px" }}>
          本週紀錄
        </div>
        <p style={{ fontSize: "11px", color: "var(--ink-soft)", margin: "-4px 0 10px" }}>
          點分鐘數旁的 ✏️ 圖示可以直接修改時間。
        </p>
        {thisWeekEntries.length === 0 && <p className="food-log-empty">這週還沒有運動紀錄，記錄第一筆吧。</p>}
        {/* Three open, the rest folded — the same rule every record list in
            the app follows, so none of them surprises her. */}
        {(showAllExercise ? thisWeekEntries : thisWeekEntries.slice(0, 3)).map((entry) => (
          <div className="record-row" key={entry.id}>
            <div>
              <div className="record-date">
                {entry.date === todayStr() ? "今天" : entry.date.slice(5)}　{entry.activityLabel}
              </div>
              <div className="record-meta food-log-cal-row">
                <Pencil size={11} className="food-log-edit-icon" />
                <input
                  type="number"
                  className="cal-num-input-inline"
                  value={entry.durationMin}
                  onChange={(e) => onUpdateExerciseEntry(entry.id, e.target.value)}
                  onBlur={() => onPersistExerciseEntry(entry.id)}
                />
                <span>分鐘</span>
              </div>
            </div>
            <button className="icon-btn" onClick={() => onDeleteExerciseEntry(entry.id)}>
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        {thisWeekEntries.length > 3 && (
          <button
            type="button"
            className="btn btn-secondary btn-block"
            style={{ marginTop: "10px" }}
            onClick={() => setShowAllExercise((v) => !v)}
          >
            {showAllExercise ? "收起" : `展開全部 ${thisWeekEntries.length} 筆`}
          </button>
        )}
      </div>

      <WeekCard summaries={summaries} today={todayGoals} />

      <WeeklyPlanCard plan={plan} exerciseLog={thisWeekEntries} today={todayStr()} />

      <div className="card">
        <div className="section-title">本週運動達成率（近7天累積）</div>
        <div className="ex-bar-numbers">
          <div className="ex-bar-value">{feedback.totalMinutes}</div>
          <div className="ex-bar-caption">已累積分鐘 ／ 目標 {plan.weeklyMinutesTarget} 分鐘（{feedback.pct}%）</div>
        </div>
        <div className="cal-bar-track">
          <div className="cal-bar-fill tone-green" style={{ width: `${pctForBar}%` }} />
        </div>

        {/* The same three characters the plan uses, so the two cards read as
            one feature rather than two. Emoji rendered differently on every
            device and did not match anything else in the app. */}
        <div className="ex-category-row">
          <span>
            <AerobicIcon done={feedback.categoryCount.aerobic > 0} size={22} /> 有氧 {feedback.categoryCount.aerobic} 次
          </span>
          <span>
            <ResistanceIcon done={feedback.categoryCount.resistance > 0} size={22} /> 阻力 {feedback.categoryCount.resistance} 次
          </span>
          <span>
            <FlexibilityIcon done={feedback.categoryCount.flexibility > 0} size={22} /> 柔軟度 {feedback.categoryCount.flexibility} 次
          </span>
        </div>

        <ul className="caution-list" style={{ marginTop: "10px", color: "var(--ink-soft)" }}>
          {feedback.suggestions.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>

        {weeklyChartData.some((d) => d.total > 0) && (
          <div style={{ width: "100%", height: 180, marginTop: "12px" }}>
            <ResponsiveContainer>
              <BarChart data={weeklyChartData} margin={{ top: 6, right: 10, left: -18, bottom: 0 }}>
                <CartesianGrid stroke="#DCE3DC" strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="total" fill="#2F6F5E" radius={[4, 4, 0, 0]} name="運動分鐘" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {suggestions}

      <div className="card">
        <div className="section-title">日常小習慣</div>
        <ul className="habit-list">
          {plan.dailyHabits.map((h, i) => (
            <li key={i}>{h}</li>
          ))}
        </ul>
        <ContentSources />
      </div>

      <Disclaimer />
    </>
  );
}

function TrackingTab({
  profile,
  records,
  recordForm,
  setRecordForm,
  onAddRecord,
  onDeleteRecord,
  onEditRecord,
  chartData,
  onBodyPhoto,
  bodyScanning,
  bodyScanNote,
  onDismissBodyScan,
}) {
  const [showFullHistory, setShowFullHistory] = useState(false);
  const sorted = [...records].sort((a, b) => (a.date < b.date ? 1 : -1));
  const isEditing = records.some((r) => r.date === recordForm.date);
  /* Only today is left open. A body record is one row per day and three rows
     tall, and the trends underneath already say what the last week looked
     like — so the list's job is "check or fix what I just entered", and that
     is one day. If nothing is recorded today the most recent stands in: an
     empty history card reads as the app having lost everything. */
  const todayRecord = sorted.find((r) => r.date === todayStr());
  const openRows = todayRecord ? [todayRecord] : sorted.slice(0, 1);

  function monthLabel(key) {
    const [y, m] = key.split("-");
    return `${y}年${parseInt(m, 10)}月`;
  }

  function renderRecordRow(r) {
    const rBmi = r.bmi != null ? r.bmi : profile?.height ? calcBMI(r.weight, profile.height) : null;
    return (
      <div className="record-row record-row-clickable" key={r.date} onClick={() => onEditRecord(r)}>
        <div>
          <div className="record-date">{r.date}</div>
          <div className="record-meta">
            體重 {fmtNum(r.weight)}kg
            {rBmi != null ? ` ・ BMI ${fmtNum(rBmi)}` : ""}
            {r.waist != null ? ` ・ 腰圍 ${fmtNum(r.waist)}cm` : ""}
            {r.bodyFat != null ? ` ・ 體脂 ${fmtNum(r.bodyFat)}%` : ""}
            {r.visceralFat != null ? ` ・ 內臟脂肪 ${fmtNum(r.visceralFat, 0)}` : ""}
          </div>
          <div className="record-meta">
            {r.skeletalMuscle != null ? `骨骼肌 ${fmtNum(r.skeletalMuscle)}% ・ ` : ""}
            {r.bodyAge != null ? `體年齡 ${fmtNum(r.bodyAge, 0)} ・ ` : ""}
            {r.bmr != null ? `BMR ${fmtNum(r.bmr, 0)}kcal` : ""}
            {r.sleepHours != null ? `${r.bmr != null ? " ・ " : ""}睡眠 ${formatSleep(r.sleepHours)}` : ""}
          </div>
        </div>
        <button
          className="icon-btn"
          onClick={(e) => {
            e.stopPropagation();
            onDeleteRecord(r.date);
          }}
        >
          <Trash2 size={16} />
        </button>
      </div>
    );
  }

  let monthGroups = null;
  if (showFullHistory) {
    monthGroups = {};
    sorted.forEach((r) => {
      const key = r.date.slice(0, 7);
      (monthGroups[key] = monthGroups[key] || []).push(r);
    });
  }

  return (
    <>
      <div className="card">
        <div className="section-title">{isEditing ? "編輯紀錄" : "新增今日紀錄"}</div>
        <p style={{ fontSize: "11px", color: "var(--ink-soft)", margin: "-4px 0 10px" }}>
          點下方「歷史紀錄」裡的任一筆，就會載入這裡讓你修改。
        </p>

        {/* Reading the scale instead of typing it.
            A web page cannot read Apple 健康 — there is no browser API for
            HealthKit — so the practical way to stop typing eight numbers a day
            is to photograph the display. Works on any scale, needs nothing from
            Apple, and the numbers land in the form where they can be corrected
            before saving. */}
        <div className="scan-row">
          <label className="btn btn-secondary photo-input-label scan-btn">
            <Camera size={15} /> 拍體重計自動填入
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => {
                onBodyPhoto(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
          <label className="btn btn-secondary photo-input-label scan-btn">
            <ImageIcon size={15} /> 相簿
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                onBodyPhoto(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
        </div>
        <p style={{ fontSize: "10.5px", color: "var(--ink-soft)", margin: "6px 0 10px", lineHeight: 1.6 }}>
          拍體重計的顯示螢幕，或 OMRON connect／Apple 健康的畫面截圖都可以。讀出來的數字會填進下面的欄位，
          你核對後再按儲存。照片不會被留下來。
        </p>

        {bodyScanning && (
          <div className="analyzing-row" style={{ justifyContent: "center", padding: "10px 0" }}>
            <Loader2 size={16} className="spin" /> 正在讀取數值…
          </div>
        )}

        {bodyScanNote && (
          <div className={`scan-note ${bodyScanNote.error ? "is-error" : ""}`}>
            <Info size={13} />
            <span>
              {bodyScanNote.error ? (
                bodyScanNote.error
              ) : (
                <>
                  已填入 {bodyScanNote.filled.join("、")}。請核對後再儲存。
                  {bodyScanNote.rejected.length > 0 &&
                    `　${bodyScanNote.rejected.map((r) => r.label).join("、")}讀到的數字不合理，沒有填入。`}
                  {bodyScanNote.unreadable.length > 0 && `　看不清楚：${bodyScanNote.unreadable.join("、")}。`}
                </>
              )}
            </span>
            <button type="button" className="icon-btn" aria-label="關閉" onClick={onDismissBodyScan}>
              <X size={14} />
            </button>
          </div>
        )}
        <form onSubmit={onAddRecord}>
          <div className="field">
            <label>日期</label>
            <input type="date" value={recordForm.date} onChange={(e) => setRecordForm({ ...recordForm, date: e.target.value })} />
          </div>
          <div className="field-row">
            <div className="field">
              <label>體重（kg）</label>
              <input
                type="number"
                step="0.1"
                value={recordForm.weight}
                onChange={(e) => setRecordForm({ ...recordForm, weight: e.target.value })}
                required
              />
            </div>
            <div className="field">
              <label>BMI</label>
              <input type="number" step="0.1" value={recordForm.bmi} onChange={(e) => setRecordForm({ ...recordForm, bmi: e.target.value })} />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>體脂肪（%）</label>
              <input type="number" step="0.1" value={recordForm.bodyFat} onChange={(e) => setRecordForm({ ...recordForm, bodyFat: e.target.value })} />
            </div>
            <div className="field">
              <label>腰圍（cm）</label>
              <input type="number" step="0.1" value={recordForm.waist} onChange={(e) => setRecordForm({ ...recordForm, waist: e.target.value })} />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>內臟脂肪等級</label>
              <input type="number" step="1" value={recordForm.visceralFat} onChange={(e) => setRecordForm({ ...recordForm, visceralFat: e.target.value })} />
            </div>
            <div className="field">
              <label>骨骼肌率（%）</label>
              <input
                type="number"
                step="0.1"
                value={recordForm.skeletalMuscle}
                onChange={(e) => setRecordForm({ ...recordForm, skeletalMuscle: e.target.value })}
              />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>體年齡</label>
              <input type="number" step="1" value={recordForm.bodyAge} onChange={(e) => setRecordForm({ ...recordForm, bodyAge: e.target.value })} />
            </div>
            <div className="field">
              <label>基礎代謝率（kcal）</label>
              <input type="number" step="1" value={recordForm.bmr} onChange={(e) => setRecordForm({ ...recordForm, bmr: e.target.value })} />
            </div>
          </div>
          {/* One night's sleep is one value, so it gets one label and one box
              with a line down the middle — not two fields side by side, which
              read as two unrelated things to fill in. The two halves exist
              because sleep does not happen in half hours: a single decimal
              field left her either rounding 7:15 up to 7.5 or doing the
              division herself every morning.

              The box stays in the left column, exactly where the old single
              「昨晚睡眠（小時）」 field sat — it holds two two-digit numbers,
              and stretched across the whole card it read as a large empty
              container rather than a field. */}
          <div className="field-row">
            <div className="field">
              <label>昨晚睡眠（時/分）</label>
              {/* No 時/分 suffixes inside the cells: the label already says
                  which order they come in, and two-digit numbers in a
                  half-width box have no room to spare. */}
              <div className="split-input">
                <input
                  type="number"
                  step="1"
                  min="0"
                  max="24"
                  inputMode="numeric"
                  aria-label="睡眠小時"
                  value={recordForm.sleepH}
                  onChange={(e) => setRecordForm((f) => ({ ...f, sleepH: e.target.value }))}
                  placeholder="7"
                />
                {/* step must stay 1: with step="5" the browser's own validation
                    rejects 12 分 and blocks the submit without saying why — and
                    being free of the half-hour grid is the entire point here. */}
                <input
                  type="number"
                  step="1"
                  min="0"
                  max="59"
                  inputMode="numeric"
                  aria-label="睡眠分鐘"
                  value={recordForm.sleepM}
                  onChange={(e) => setRecordForm((f) => ({ ...f, sleepM: e.target.value }))}
                  placeholder="15"
                />
              </div>
            </div>
            <div className="field" />
          </div>
          <button type="submit" className="btn btn-primary btn-block">
            <Plus size={15} /> {isEditing ? "更新紀錄" : "儲存紀錄"}
          </button>
        </form>
      </div>

      {/* Above the trends on purpose: this is the card she acts on — check
          today's numbers, tap to fix a typo — and the charts are what she
          looks at afterwards. It used to sit under six of them. */}
      <div className="card">
        <div className="section-title">歷史紀錄</div>
        <p style={{ fontSize: "11px", color: "var(--ink-soft)", margin: "-4px 0 10px" }}>
          點任一筆可載入上方表單編輯。{!showFullHistory && sorted.length > 0 && (todayRecord ? "目前只展開今天，其餘收在下方。" : "今天還沒記錄，先顯示最近的一筆。")}
        </p>
        {sorted.length === 0 && <p style={{ fontSize: "12.5px", color: "var(--ink-soft)" }}>尚無紀錄，新增第一筆體態資料吧。</p>}

        {!showFullHistory && openRows.map(renderRecordRow)}

        {showFullHistory &&
          Object.keys(monthGroups).map((key) => (
            <div key={key}>
              <div className="history-month-header">
                {monthLabel(key)}（{monthGroups[key].length}筆）
              </div>
              {monthGroups[key].map(renderRecordRow)}
            </div>
          ))}

        {sorted.length > openRows.length && (
          <button type="button" className="btn btn-secondary btn-block" style={{ marginTop: "10px" }} onClick={() => setShowFullHistory((v) => !v)}>
            {showFullHistory ? "收合紀錄" : `展開全部歷史紀錄（共 ${sorted.length} 筆，依月份歸納）`}
          </button>
        )}
      </div>

      <MetricTrendChart title="體重趨勢" dataKey="weight" unit="kg" color="#2F6F5E" chartData={chartData} />
      <MetricTrendChart
        title="BMI 趨勢"
        dataKey="bmi"
        unit=""
        color="#B8863A"
        chartData={chartData}
        zones={BMI_ZONES}
        zoneExplain="背景顏色代表衛福部 BMI 分類區間：黃色過輕／過重、綠色正常、紅色肥胖，曲線落在綠色區塊代表體重在健康範圍內。"
      />
      <MetricTrendChart
        title="體脂肪率趨勢"
        dataKey="bodyFat"
        unit="%"
        color="#C63C34"
        chartData={chartData}
        zones={bodyFatZones(profile?.gender)}
        zoneExplain="背景顏色為常見醫療衛教標準：黃色偏低/偏高、綠色正常範圍（男性15-25%、女性20-30%）。"
      />
      <MetricTrendChart
        title="骨骼肌率趨勢"
        dataKey="skeletalMuscle"
        unit="%"
        color="#2F6F5E"
        chartData={chartData}
        zones={skeletalMuscleZones(profile?.gender)}
        zoneExplain="背景顏色為一般參考範圍：黃色偏低、綠色正常（男性32-34%、女性28-30%）、藍色偏高（肌肉量較多）。"
      />

      <MetricTrendChart
        title="腰圍趨勢"
        dataKey="waist"
        unit="cm"
        color="#8A5A3B"
        chartData={chartData}
        zones={waistZones(profile?.gender)}
        zoneExplain="背景顏色代表衛福部代謝症候群腰圍標準：綠色正常、紅色腰圍過大（男性≥90cm、女性≥80cm，代謝症候群風險較高）。"
      />

      <MetricTrendChart
        title="睡眠時數趨勢"
        dataKey="sleepHours"
        unit="小時"
        formatValue={formatSleep}
        color="#5A6E8A"
        chartData={chartData}
        zones={sleepZones()}
        zoneExplain="背景顏色為成人睡眠時數參考：黃色偏少（未達7小時）、綠色建議範圍（7-9小時）、藍色偏多（超過9小時）。輪班工作或有睡眠疾患者請依醫師建議。"
      />

      <Disclaimer />
    </>
  );
}
