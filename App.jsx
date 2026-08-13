import React, { useState, useEffect, useMemo } from "react";
import {
  Home,
  UserRound,
  Utensils,
  Dumbbell,
  Activity,
  Plus,
  Trash2,
  Info,
  RotateCcw,
  Camera,
  Image as ImageIcon,
  Loader2,
  Check,
  RefreshCw,
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  ReferenceLine,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

/* ----------------------------------------------------------------------- */
/* Constants & reference data                                              */
/* ----------------------------------------------------------------------- */

const SYMPTOM_OPTIONS = [
  { id: "family", label: "家族糖尿病史" },
  { id: "gestational", label: "曾有妊娠糖尿病" },
  { id: "hypertension", label: "高血壓" },
  { id: "hyperlipidemia", label: "高血脂" },
  { id: "prediabetes", label: "醫師告知糖尿病前期／血糖偏高" },
  { id: "cardio", label: "心血管疾病史" },
  { id: "sedentary", label: "平時缺乏運動" },
  { id: "smoking", label: "有吸菸習慣" },
  { id: "waist", label: "腰圍過大（男≥90cm／女≥80cm）" },
];

const ACTIVITY_LEVELS = [
  { id: "sedentary", label: "幾乎不運動（久坐為主）" },
  { id: "light", label: "偶爾運動（每週1-2次）" },
  { id: "active", label: "規律運動（每週3次以上）" },
];

const EXERCISE_TYPE_OPTIONS = {
  dynamic: [{ id: "badminton", label: "羽球" }],
  static: [{ id: "strength", label: "肌耐力" }],
};

const LIGHT_META = {
  green: { label: "綠燈　可安心食用", className: "pill-green" },
  yellow: { label: "黃燈　適量、留意份量", className: "pill-yellow" },
  red: { label: "紅燈　建議避免", className: "pill-red" },
};

const CONTENT_REVIEW = {
  lastReviewed: "2026-08-12",
  sources: [
    "衛生福利部國民健康署《我的餐盤》飲食指南與「顧血糖4招」衛教資訊",
    "衛生福利部國民健康署《糖尿病防治手冊》",
    "台北榮民總醫院護理部衛教資訊《糖尿病與運動》",
    "社團法人中華民國糖尿病學會《2022第2型糖尿病臨床照護指引》",
  ],
};

const FOOD_DB = [
  {
    id: "grain",
    name: "全穀雜糧類",
    tip: "以未精製全榖雜糧取代白飯白麵，纖維愈高愈能延緩血糖上升。",
    items: [
      { name: "糙米／燕麥／藜麥", light: "green" },
      { name: "地瓜／南瓜（適量）", light: "green" },
      { name: "全麥麵包／全麥麵條", light: "green" },
      { name: "白米飯（適量）", light: "yellow" },
      { name: "白吐司／冬粉／河粉", light: "yellow" },
      { name: "蘿蔔糕、油飯、甜年糕", light: "red" },
      { name: "精緻糕點、酥皮類點心", light: "red" },
    ],
  },
  {
    id: "protein",
    name: "豆魚蛋肉類",
    tip: "優先選擇清蒸、水煮、烤的烹調方式，並選瘦肉去皮。",
    items: [
      { name: "豆腐／無糖豆漿", light: "green" },
      { name: "魚類（清蒸、烤）", light: "green" },
      { name: "雞蛋／雞胸肉（去皮）", light: "green" },
      { name: "瘦豬肉、牛肉（適量）", light: "yellow" },
      { name: "培根、香腸、熱狗", light: "red" },
      { name: "炸雞、鹹酥雞、內臟油炸", light: "red" },
    ],
  },
  {
    id: "dairy",
    name: "乳品類",
    tip: "選擇無加糖、低脂的乳品，避免調味乳與煉乳。",
    items: [
      { name: "低脂／脫脂鮮奶", light: "green" },
      { name: "無糖優格", light: "green" },
      { name: "全脂鮮奶、起司（適量）", light: "yellow" },
      { name: "調味乳、煉乳、冰淇淋", light: "red" },
    ],
  },
  {
    id: "veg",
    name: "蔬菜類",
    tip: "每餐至少半碗至一平碗蔬菜，非澱粉類蔬菜幾乎可以放心多吃。",
    items: [
      { name: "葉菜類、菇類、瓜類、海藻", light: "green" },
      { name: "南瓜、玉米筍（澱粉稍高）", light: "yellow" },
      { name: "糖醋／大量勾芡烹調的蔬菜", light: "red" },
      { name: "高鹽醃漬蔬菜", light: "red" },
    ],
  },
  {
    id: "fruit",
    name: "水果類",
    tip: "每天約兩份拳頭大，選低GI原態水果，避免果汁與果乾。",
    items: [
      { name: "芭樂、小番茄、奇異果、蘋果", light: "green" },
      { name: "香蕉、葡萄、芒果（適量）", light: "yellow" },
      { name: "果汁、水果乾、糖漬水果罐頭", light: "red" },
    ],
  },
  {
    id: "fat",
    name: "油脂與堅果種子類",
    tip: "原味堅果一天一小把即可，避免油炸與反式脂肪。",
    items: [
      { name: "原味堅果（一小把）、橄欖油", light: "green" },
      { name: "無加糖花生醬（適量）", light: "yellow" },
      { name: "奶油、豬油、人造奶油", light: "red" },
      { name: "重複使用的油炸油", light: "red" },
    ],
  },
  {
    id: "sugar",
    name: "精緻糖／含糖飲料",
    tip: "含糖飲料是血糖與體重最大的隱形殺手，建議以白開水、無糖茶取代。",
    items: [
      { name: "白開水、無糖茶、無糖咖啡", light: "green" },
      { name: "70%以上黑巧克力（少量）", light: "yellow" },
      { name: "手搖飲、汽水、果汁飲料", light: "red" },
      { name: "蛋糕、糖果、煉乳、蜂蜜（大量）", light: "red" },
    ],
  },
  {
    id: "alcohol",
    name: "酒精及加工食品",
    tip: "加工食品普遍高油高鹽高糖，酒精則會影響肝臟代謝與血糖穩定。",
    items: [
      { name: "偶爾社交飲酒（適量）", light: "yellow" },
      { name: "各類酒精飲品（經常飲用）", light: "red" },
      { name: "泡麵、加工肉品、油炸速食", light: "red" },
    ],
  },
];

/* ----------------------------------------------------------------------- */
/* Helper / calculation functions                                          */
/* ----------------------------------------------------------------------- */

function calcBMI(weightKg, heightCm) {
  const w = parseFloat(weightKg);
  const h = parseFloat(heightCm);
  if (!w || !h) return null;
  const m = h / 100;
  return w / (m * m);
}

function bmiCategory(bmi) {
  if (bmi == null || isNaN(bmi)) return { label: "—", tone: "neutral" };
  if (bmi < 18.5) return { label: "體重過輕", tone: "yellow" };
  if (bmi < 24) return { label: "正常範圍", tone: "green" };
  if (bmi < 27) return { label: "體重過重", tone: "yellow" };
  return { label: "肥胖", tone: "red" };
}

function calcRiskScore(profile) {
  if (!profile) return 0;
  const bmi = calcBMI(profile.weight, profile.height);
  let score = 0;
  if (bmi != null) {
    if (bmi >= 27) score += 35;
    else if (bmi >= 24) score += 20;
  }
  const symptomCount = (profile.symptoms || []).length;
  score += Math.min(symptomCount * 8, 40);
  if (profile.activityLevel === "sedentary") score += 15;
  else if (profile.activityLevel === "light") score += 8;
  if (parseInt(profile.age, 10) >= 45) score += 10;
  return Math.max(0, Math.min(100, score));
}

function riskZone(score) {
  if (score <= 33)
    return { label: "低度關注", tone: "green", advice: "目前生活型態指標大致良好，請維持均衡飲食與規律運動習慣。" };
  if (score <= 66)
    return { label: "中度關注", tone: "yellow", advice: "建議加強飲食控制與運動頻率，並定期追蹤體態變化。" };
  return {
    label: "高度關注",
    tone: "red",
    advice: "建議盡快諮詢醫師或營養師，並安排血糖相關檢查以確認目前狀況。",
  };
}

function buildExercisePlan(profile) {
  const cautions = [];
  const symptoms = profile?.symptoms || [];
  const bmi = calcBMI(profile?.weight, profile?.height);
  const age = parseInt(profile?.age, 10) || 0;
  const isObese = bmi != null && bmi >= 27;
  const cardioRisk = symptoms.includes("hypertension") || symptoms.includes("cardio");

  if (age >= 65) {
    cautions.push("您的年齡建議優先選擇低衝擊運動（如快走、游泳、太極），運動前務必充分熱身。");
  }
  if (cardioRisk) {
    cautions.push("您有心血管相關風險因子，建議先諮詢醫師評估合適的運動強度，運動中留意心跳與不適感。");
  }
  if (isObese) {
    cautions.push("您的BMI偏高，建議優先選擇對關節負擔較小的運動，如游泳、飛輪、快走，待體能提升後再增加強度。");
  }
  if (symptoms.includes("sedentary")) {
    cautions.push("目前活動量較少，建議先從每天10分鐘快走開始，再逐週增加時間與強度。");
  }
  if (symptoms.includes("prediabetes")) {
    cautions.push(
      "您已被醫師告知糖尿病前期／血糖偏高，建議避免空腹或飯前運動，隨身攜帶方糖等含糖食物以防低血糖；若有測血糖習慣，血糖高於250mg/dL或低於80mg/dL時不宜運動。"
    );
  }

  const lowImpact = age >= 65 || cardioRisk || isObese;

  const dynamicPrefs = (profile?.exerciseTypes?.dynamic || [])
    .map((id) => EXERCISE_TYPE_OPTIONS.dynamic.find((o) => o.id === id)?.label)
    .filter(Boolean);
  const staticPrefs = (profile?.exerciseTypes?.static || [])
    .map((id) => EXERCISE_TYPE_OPTIONS.static.find((o) => o.id === id)?.label)
    .filter(Boolean);

  const aerobicBase = lowImpact
    ? ["快走", "游泳", "飛輪（固定式腳踏車）"]
    : ["快走", "慢跑", "游泳", "騎自行車"];
  const aerobicList = dynamicPrefs.length ? [...new Set([...dynamicPrefs, ...aerobicBase])] : aerobicBase;
  const aerobic = aerobicList.join("／");

  const resistanceLabel = staticPrefs.length
    ? `${staticPrefs.join("、")}訓練（彈力帶或自身體重：深蹲、伏地挺身）`
    : "阻力訓練（彈力帶或自身體重：深蹲、伏地挺身）";
  const resistanceLabelShort = staticPrefs.length ? `${staticPrefs.join("、")}訓練` : "阻力訓練";

  const weeklyTemplate = [
    { day: "週一", activity: aerobic, duration: "30 分鐘", intensity: "中等（有點喘但仍可說話）" },
    { day: "週二", activity: resistanceLabel, duration: "20-30 分鐘", intensity: "中等" },
    { day: "週三", activity: aerobic, duration: "30 分鐘", intensity: "中等" },
    { day: "週四", activity: "伸展／太極／瑜伽（主動恢復）", duration: "20 分鐘", intensity: "低" },
    { day: "週五", activity: aerobic, duration: "30 分鐘", intensity: "中等" },
    { day: "週六", activity: resistanceLabelShort, duration: "20-30 分鐘", intensity: "中等" },
    { day: "週日", activity: "戶外散步或喜愛的休閒活動", duration: "30-45 分鐘", intensity: "低至中等" },
  ];

  const dailyHabits = [
    "三餐飯後散步 15-20 分鐘，有助穩定飯後血糖上升幅度。",
    "每坐 1 小時起身活動 2-3 分鐘，避免長時間久坐。",
    "每週累積達到 150 分鐘中等強度有氧運動的目標。",
  ];

  return { cautions, weeklyTemplate, dailyHabits, weeklyMinutesTarget: 150 };
}

function todayStr() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function nowTimeStr() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function daysAgoStr(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const pad = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function fmtNum(v, digits = 1) {
  if (v === null || v === undefined || v === "" || isNaN(v)) return "—";
  return Number(v).toFixed(digits);
}

/** Estimate a reference daily calorie target. Uses the most recent logged BMR
 * if available, otherwise falls back to the Mifflin-St Jeor equation. A modest
 * ~500kcal reduction is applied when BMI indicates overweight/obesity, bounded
 * by a safety floor. This is a general estimate for reference only. */
function calcDailyCalorieTarget(profile, latestRecord) {
  if (!profile?.weight || !profile?.height || !profile?.age) return null;
  const weight = Number(profile.weight);
  const height = Number(profile.height);
  const age = Number(profile.age);

  let bmr;
  if (latestRecord?.bmr) {
    bmr = Number(latestRecord.bmr);
  } else if (profile.gender === "male") {
    bmr = 10 * weight + 6.25 * height - 5 * age + 5;
  } else {
    bmr = 10 * weight + 6.25 * height - 5 * age - 161;
  }

  const activityFactorMap = { sedentary: 1.2, light: 1.375, active: 1.55 };
  const factor = activityFactorMap[profile.activityLevel] || 1.2;
  let target = bmr * factor;

  const bmi = calcBMI(weight, height);
  if (bmi != null && bmi >= 24) target -= 500;

  const floor = profile.gender === "male" ? 1500 : 1200;
  return Math.round(Math.max(target, floor));
}

function calorieZone(consumed, target) {
  if (target == null) return "neutral";
  const ratio = consumed / target;
  if (ratio < 0.8) return "green";
  if (ratio <= 1.05) return "yellow";
  return "red";
}

function buildWeeklyCalorieData(foodLog) {
  const days = [];
  for (let i = 6; i >= 0; i--) days.push(daysAgoStr(i));
  return days.map((d) => {
    const total = foodLog.filter((e) => e.date === d).reduce((s, e) => s + (Number(e.estimatedCalories) || 0), 0);
    return { date: d.slice(5), total: Math.round(total) };
  });
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

/** Sends a food photo to an AI vision model for a rough calorie / traffic-light
 * estimate. Returns a parsed JSON object, or throws on failure.
 * This standalone build calls the provider's API directly from the browser
 * using a key the user enters and stores locally on their own device (see
 * Settings in the 個人資料 tab). The key never leaves the device except in
 * requests sent straight to the provider's own API. Supports:
 *  - "anthropic": Claude API (api.anthropic.com), paid, needs billing set up.
 *  - "gemini": Google Gemini API (generativelanguage.googleapis.com), has a
 *    genuine no-credit-card free tier via Google AI Studio.
 */
async function analyzeFoodPhoto(base64Data, mediaType, provider, apiKey, geminiModel) {
  if (!apiKey) {
    throw new Error(
      provider === "gemini"
        ? "尚未設定 Google Gemini API Key，請先到「個人資料」頁下方的設定輸入金鑰。"
        : "尚未設定 Anthropic API Key，請先到「個人資料」頁下方的設定輸入金鑰。"
    );
  }

  const prompt = `請你以營養師角度分析這張食物照片，並「只」回傳純 JSON（不要任何前後文字、不要 markdown 符號），格式如下：
{"foodName": "食物名稱（繁體中文，多項用、分隔）", "estimatedCalories": 數字, "carbsG": 數字, "proteinG": 數字, "fatG": 數字, "portionNote": "份量估計簡短說明", "light": "green或yellow或red", "reason": "20字以內的燈號原因", "confidence": "low或medium或high"}

燈號判斷原則（第二型糖尿病預防飲食）：
- green：原型食物、高纖蔬菜、全穀雜糧、瘦肉蛋白、烹調清淡（清蒸水煮烤）
- yellow：白飯白麵等精緻澱粉適量、水果、全脂乳品，份量需留意
- red：油炸、含糖飲料或甜點、加工肉品、高油勾芡，建議避免或大幅減量

若照片中有多種食物，estimatedCalories 等數值請加總為整餐估計。若無法辨識出食物，foodName 請填"無法辨識"，estimatedCalories 填 0，confidence 填 low。`;

  if (provider === "gemini") {
    const model = geminiModel && geminiModel.trim() ? geminiModel.trim() : "gemini-3.6-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }, { inline_data: { mime_type: mediaType, data: base64Data } }],
          },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 400 || response.status === 403)
        throw new Error("Gemini API Key 無效，請到設定重新輸入，或確認金鑰有效。");
      if (response.status === 404)
        throw new Error(`找不到模型「${model}」，Google 可能已更新模型名稱，請到設定的「進階」欄位更新模型名稱。`);
      if (response.status === 429) throw new Error("已達到 Gemini 免費額度上限（有速率限制），請稍後再試。");
      throw new Error("辨識服務暫時無法使用，請稍後再試。");
    }
    const data = await response.json();
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const textPart = parts.find((p) => typeof p.text === "string");
    if (!textPart) throw new Error("未取得辨識結果");
    const cleaned = textPart.text.replace(/```json|```/g, "").trim();
    return JSON.parse(cleaned);
  }

  // Anthropic Claude
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: base64Data } },
            { type: "text", text: prompt },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    if (response.status === 401) throw new Error("API Key 無效或已過期，請到設定重新輸入。");
    if (response.status === 429) throw new Error("已達到 API 使用額度上限，請稍後再試。");
    throw new Error("辨識服務暫時無法使用，請稍後再試。");
  }
  const data = await response.json();
  const textBlock = (data.content || []).find((b) => b.type === "text");
  if (!textBlock) throw new Error("未取得辨識結果");
  const cleaned = textBlock.text.replace(/```json|```/g, "").trim();
  const parsed = JSON.parse(cleaned);
  return parsed;
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
  const meta = LIGHT_META[light];
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

function CalorieBar({ target, consumed, remaining, zone }) {
  if (target == null) {
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
          <div className="cal-bar-caption">今日建議攝取</div>
        </div>
      </div>
      <div className="cal-bar-track">
        <div className={`cal-bar-fill tone-${zone}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function MetricTrendChart({ title, dataKey, unit, color, chartData }) {
  const points = chartData.filter((d) => d[dataKey] != null);
  if (points.length < 2) return null;
  return (
    <div className="card">
      <div className="section-title">{title}</div>
      <div style={{ width: "100%", height: 180 }}>
        <ResponsiveContainer>
          <LineChart data={chartData} margin={{ top: 6, right: 10, left: -18, bottom: 0 }}>
            <CartesianGrid stroke="#DCE3DC" strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} domain={["auto", "auto"]} unit={unit} />
            <Tooltip />
            <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={{ r: 3 }} name={title} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function AnalysisModal({ analyzing, analysisError, analysisPreview, onConfirm, onDiscard, onEditCalories }) {
  if (!analyzing && !analysisError && !analysisPreview) return null;
  const r = analysisPreview?.result;

  return (
    <div className="modal-backdrop" onClick={analyzing ? undefined : onDiscard}>
      <div className="modal-card analysis-modal-card" onClick={(e) => e.stopPropagation()}>
        {analyzing && (
          <div className="analyzing-row" style={{ justifyContent: "center", padding: "24px 0" }}>
            <Loader2 size={20} className="spin" /> 正在分析照片中的食物與熱量…
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
            <img src={analysisPreview.imageDataUrl} alt="食物相片" />
            <div className="analysis-card-body">
              <div className="analysis-food-name">{r.foodName}</div>
              <div className="analysis-cal-row">
                <input
                  type="number"
                  className="cal-num-input"
                  value={r.estimatedCalories}
                  onChange={(e) => onEditCalories(e.target.value === "" ? "" : Number(e.target.value))}
                />
                <span style={{ fontSize: "11px", color: "var(--ink-soft)" }}>大卡（可微調）</span>
                <Pill light={["green", "yellow", "red"].includes(r.light) ? r.light : "yellow"}>
                  {LIGHT_META[["green", "yellow", "red"].includes(r.light) ? r.light : "yellow"].label.split("　")[0]}
                </Pill>
              </div>
              {(r.carbsG != null || r.proteinG != null || r.fatG != null) && (
                <div className="analysis-macro">
                  醣 {fmtNum(r.carbsG, 0)}g・蛋白質 {fmtNum(r.proteinG, 0)}g・脂肪 {fmtNum(r.fatG, 0)}g
                </div>
              )}
              {r.portionNote && <div className="analysis-macro">{r.portionNote}</div>}
              {r.reason && <div className="analysis-reason">{r.reason}</div>}
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
    age: "",
    gender: "female",
    height: "",
    weight: "",
    activityLevel: "light",
    symptoms: [],
    exerciseTypes: { dynamic: [], static: [] },
  });

  const [recordForm, setRecordForm] = useState({
    date: todayStr(),
    weight: "",
    bodyFat: "",
    visceralFat: "",
    skeletalMuscle: "",
    bodyAge: "",
    bmr: "",
  });

  const [foodLog, setFoodLog] = useState([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState("");
  const [analysisPreview, setAnalysisPreview] = useState(null); // { imageDataUrl, result }
  const [manualForm, setManualForm] = useState({ name: "", calories: "" });

  const [apiKey, setApiKey] = useState("");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [geminiKeyInput, setGeminiKeyInput] = useState("");
  const [geminiModel, setGeminiModel] = useState("");
  const [geminiModelInput, setGeminiModelInput] = useState("");
  const [aiProvider, setAiProvider] = useState("gemini");

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
          const withDefaults = {
            ...parsed,
            exerciseTypes: {
              dynamic: [],
              static: [],
              ...(parsed.exerciseTypes || {}),
            },
          };
          setProfile(withDefaults);
          setForm(withDefaults);
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
    if (!form.age || !form.height || !form.weight) return;
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

  function toggleExerciseType(group, id) {
    setForm((f) => {
      const current = f.exerciseTypes?.[group] || [];
      const has = current.includes(id);
      const next = has ? current.filter((s) => s !== id) : [...current, id];
      return { ...f, exerciseTypes: { ...f.exerciseTypes, [group]: next } };
    });
  }

  async function handleAddRecord(e) {
    e.preventDefault();
    if (!recordForm.weight) {
      flashSaved("請至少輸入體重");
      return;
    }
    const entry = {
      ...recordForm,
      weight: Number(recordForm.weight),
      bodyFat: recordForm.bodyFat === "" ? null : Number(recordForm.bodyFat),
      visceralFat: recordForm.visceralFat === "" ? null : Number(recordForm.visceralFat),
      skeletalMuscle: recordForm.skeletalMuscle === "" ? null : Number(recordForm.skeletalMuscle),
      bodyAge: recordForm.bodyAge === "" ? null : Number(recordForm.bodyAge),
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
          bodyFat: "",
          visceralFat: "",
          skeletalMuscle: "",
          bodyAge: "",
          bmr: "",
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

  async function persistFoodLog(next) {
    // keep the log bounded (entries may now include a small photo thumbnail,
    // so a shorter window keeps total storage size reasonable)
    const cutoff = daysAgoStr(30);
    const trimmed = next.filter((e) => e.date >= cutoff);
    await window.storage.set("food-log", JSON.stringify(trimmed), false);
    setFoodLog(trimmed);
  }

  async function handlePhotoFile(file) {
    if (!file) return;
    setAnalysisError("");
    setAnalyzing(true);
    setAnalysisPreview(null);
    try {
      const base64 = await fileToBase64(file);
      const mediaType = file.type || "image/jpeg";
      const imageDataUrl = `data:${mediaType};base64,${base64}`;
      const activeKey = aiProvider === "gemini" ? geminiKey : apiKey;
      const result = await analyzeFoodPhoto(base64, mediaType, aiProvider, activeKey, geminiModel);
      setAnalysisPreview({ imageDataUrl, result });
    } catch (e) {
      setAnalysisError(e.message || "照片分析失敗，請重新拍攝或改用手動輸入。");
    } finally {
      setAnalyzing(false);
    }
  }

  async function confirmAnalysisEntry() {
    if (!analysisPreview) return;
    const r = analysisPreview.result;
    let photo = null;
    try {
      photo = await compressImageDataUrl(analysisPreview.imageDataUrl);
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
      photo,
    };
    try {
      await persistFoodLog([...foodLog, entry]);
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
    setProfile(null);
    setRecords([]);
    setFoodLog([]);
    setForm({
      age: "",
      gender: "female",
      height: "",
      weight: "",
      activityLevel: "light",
      symptoms: [],
      exerciseTypes: { dynamic: [], static: [] },
    });
    setShowReset(false);
    setTab("overview");
  }

  async function handleExportBackup() {
    let blob;
    try {
      const backup = {
        app: "tang-qian-shao",
        exportedAt: new Date().toISOString(),
        profile,
        records,
        foodLog,
      };
      blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    } catch (e) {
      flashSaved("匯出失敗，請再試一次");
      return;
    }

    const filename = `tang-qian-shao-backup-${todayStr()}.json`;

    // Prefer the native share sheet when available (iOS Safari): this lets
    // the person pick "Save to Drive" / "Save to Files → Google Drive"
    // directly, instead of only downloading into the browser's Downloads.
    try {
      const file = new File([blob], filename, { type: "application/json" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "糖前哨資料備份" });
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
          activityLevel: "light",
          symptoms: [],
          exerciseTypes: { dynamic: [], static: [] },
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

  const bmi = useMemo(() => calcBMI(profile?.weight, profile?.height), [profile]);
  const bmiCat = bmiCategory(bmi);
  const riskScore = useMemo(() => calcRiskScore(profile), [profile]);
  const zone = riskZone(riskScore);
  const exercisePlan = useMemo(() => buildExercisePlan(profile), [profile]);
  const latestRecord = records.length ? records[records.length - 1] : null;

  const chartData = records.map((r) => ({
    date: r.date.slice(5),
    weight: r.weight,
    bmi: profile?.height && r.weight ? Number(calcBMI(r.weight, profile.height).toFixed(1)) : null,
    bodyFat: r.bodyFat != null ? r.bodyFat : null,
    skeletalMuscle: r.skeletalMuscle != null ? r.skeletalMuscle : null,
  }));

  const dailyCalorieTarget = useMemo(() => calcDailyCalorieTarget(profile, latestRecord), [profile, latestRecord]);
  const todayEntries = useMemo(() => foodLog.filter((e) => e.date === todayStr()), [foodLog]);
  const consumedToday = useMemo(
    () => todayEntries.reduce((sum, e) => sum + (Number(e.estimatedCalories) || 0), 0),
    [todayEntries]
  );
  const remainingToday = dailyCalorieTarget != null ? dailyCalorieTarget - consumedToday : null;
  const calZone = calorieZone(consumedToday, dailyCalorieTarget);
  const weeklyCalorieData = useMemo(() => buildWeeklyCalorieData(foodLog), [foodLog]);

  if (loading) {
    return (
      <div className="app-shell app-loading">
        <div className="loading-dot" />
        <span>載入中…</span>
      </div>
    );
  }

  return (
    <div className="app-shell">
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
        }

        .diabetes-app *{ box-sizing:border-box; }
        .diabetes-app{
          font-family:'Noto Sans TC', sans-serif;
          color:var(--ink);
          background:var(--paper);
        }
        .app-shell{
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

        .app-header{
          padding:18px 20px 14px;
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

        .gauge-wrap{
          display:flex;
          flex-direction:column;
          align-items:center;
          padding:4px 0 0;
        }
        .gauge-svg{ width:100%; max-width:260px; }
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
        .field-row{ display:grid; grid-template-columns:1fr 1fr; gap:10px; }

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

        .bottom-nav{
          position:sticky;
          bottom:0;
          display:grid;
          grid-template-columns:repeat(5,1fr);
          background:var(--card);
          border-top:1px solid var(--line);
          padding:6px 4px 10px;
        }
        .nav-btn{
          display:flex;
          flex-direction:column;
          align-items:center;
          gap:3px;
          background:none;
          border:none;
          color:var(--ink-soft);
          font-size:10.5px;
          padding:6px 2px;
          cursor:pointer;
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
        .analysis-modal-card{ max-width:340px; }
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

        .photo-input-label{
          cursor:pointer;
          margin-bottom:10px;
        }
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
        }
        .analysis-card img{
          width:76px;
          height:76px;
          object-fit:cover;
          border-radius:10px;
          flex-shrink:0;
        }
        .analysis-card-body{ flex:1; min-width:0; }
        .analysis-food-name{ font-weight:700; font-size:13.5px; margin-bottom:2px; }
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
          bottom:82px;
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
          bottom:144px;
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
            糖前哨 <small>第二型糖尿病預防生活助手</small>
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
              consumedToday={consumedToday}
              remainingToday={remainingToday}
              calZone={calZone}
              goProfile={() => setTab("profile")}
              goDiet={() => setTab("diet")}
              goExercise={() => setTab("exercise")}
              goTracking={() => setTab("tracking")}
            />
          )}

          {tab === "profile" && (
            <ProfileTab
              form={form}
              setForm={setForm}
              toggleSymptom={toggleSymptom}
              toggleExerciseType={toggleExerciseType}
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
              consumedToday={consumedToday}
              remainingToday={remainingToday}
              calZone={calZone}
              todayEntries={todayEntries}
              weeklyCalorieData={weeklyCalorieData}
              manualForm={manualForm}
              setManualForm={setManualForm}
              onPhotoFile={handlePhotoFile}
              onAddManualEntry={handleAddManualEntry}
              onDeleteFoodEntry={handleDeleteFoodEntry}
            />
          )}

          {tab === "exercise" && <ExerciseTab plan={exercisePlan} />}

          {tab === "tracking" && (
            <TrackingTab
              profile={profile}
              records={records}
              recordForm={recordForm}
              setRecordForm={setRecordForm}
              onAddRecord={handleAddRecord}
              onDeleteRecord={handleDeleteRecord}
              chartData={chartData}
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
            運動建議
          </button>
          <button className={`nav-btn ${tab === "tracking" ? "active" : ""}`} onClick={() => setTab("tracking")}>
            <Activity size={20} />
            體態紀錄
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
                  const file = e.target.files?.[0];
                  setShowCaptureMenu(false);
                  handlePhotoFile(file);
                  e.target.value = "";
                }}
              />
            </label>
            <label className="fab-menu-item photo-input-label">
              <ImageIcon size={17} /> 從相簿選擇
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  setShowCaptureMenu(false);
                  handlePhotoFile(file);
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
    </div>
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
  consumedToday,
  remainingToday,
  calZone,
  goProfile,
  goDiet,
  goExercise,
  goTracking,
}) {
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
      <div className="card">
        <div className="gauge-wrap">
          <Gauge score={riskScore} />
          <div className={`gauge-label tone-${zone.tone}`}>{zone.label}</div>
          <div className="gauge-advice">{zone.advice}</div>
        </div>
        <Disclaimer compact />
      </div>

      <div className="card">
        <div className="section-title">今日熱量</div>
        <CalorieBar target={dailyCalorieTarget} consumed={consumedToday} remaining={remainingToday} zone={calZone} />
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
  toggleExerciseType,
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
        <div className="field-row">
          <div className="field">
            <label>年齡</label>
            <input
              type="number"
              min="1"
              max="120"
              value={form.age}
              onChange={(e) => setForm({ ...form, age: e.target.value })}
              placeholder="例：45"
              required
            />
          </div>
          <div className="field">
            <label>性別</label>
            <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
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
              onChange={(e) => setForm({ ...form, height: e.target.value })}
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
              onChange={(e) => setForm({ ...form, weight: e.target.value })}
              placeholder="例：65"
              required
            />
          </div>
        </div>

        <div className="field">
          <label>平時活動量</label>
          <div className="segmented">
            {ACTIVITY_LEVELS.map((lvl) => (
              <div
                key={lvl.id}
                className={`chip ${form.activityLevel === lvl.id ? "active" : ""}`}
                onClick={() => setForm({ ...form, activityLevel: lvl.id })}
              >
                {lvl.label}
              </div>
            ))}
          </div>
        </div>

        <div className="field">
          <label>運動：動態項目（可複選）</label>
          <div className="chip-grid">
            {EXERCISE_TYPE_OPTIONS.dynamic.map((opt) => (
              <div
                key={opt.id}
                className={`chip ${form.exerciseTypes?.dynamic?.includes(opt.id) ? "active" : ""}`}
                onClick={() => toggleExerciseType("dynamic", opt.id)}
              >
                {opt.label}
              </div>
            ))}
          </div>
        </div>

        <div className="field">
          <label>運動：靜態項目（可複選）</label>
          <div className="chip-grid">
            {EXERCISE_TYPE_OPTIONS.static.map((opt) => (
              <div
                key={opt.id}
                className={`chip ${form.exerciseTypes?.static?.includes(opt.id) ? "active" : ""}`}
                onClick={() => toggleExerciseType("static", opt.id)}
              >
                {opt.label}
              </div>
            ))}
          </div>
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
        <div style={{ display: "flex", gap: "8px" }}>
          <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={onExportBackup}>
            匯出備份
          </button>
          <label className="btn btn-secondary photo-input-label" style={{ flex: 1 }}>
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
  profile,
  bmiCat,
  dailyCalorieTarget,
  consumedToday,
  remainingToday,
  calZone,
  todayEntries,
  weeklyCalorieData,
  manualForm,
  setManualForm,
  onPhotoFile,
  onAddManualEntry,
  onDeleteFoodEntry,
}) {
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
      <div className="card">
        <div className="section-title">今日熱量</div>
        <CalorieBar target={dailyCalorieTarget} consumed={consumedToday} remaining={remainingToday} zone={calZone} />
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
                const file = e.target.files?.[0];
                onPhotoFile(file);
                e.target.value = "";
              }}
            />
          </label>
          <label className="btn btn-secondary photo-input-label">
            <ImageIcon size={16} /> 從相簿選擇
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                onPhotoFile(file);
                e.target.value = "";
              }}
            />
          </label>
        </div>
        <p style={{ fontSize: "11.5px", color: "var(--ink-soft)", margin: "0 0 4px" }}>
          拍照後會自動分析，結果會以彈出視窗顯示，確認無誤後即可加入今日紀錄。
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

        <div className="disclaimer disclaimer-compact" style={{ marginTop: "12px" }}>
          <Info size={14} />
          <span>
            照片熱量為 AI 估算，僅供參考，實際數值可能有落差；若您正在接受飲食失調相關治療或對熱量紀錄感到壓力，建議暫停使用本功能並諮詢專業人員。
          </span>
        </div>
      </div>

      <div className="card">
        <div className="section-title">今日飲食紀錄</div>
        {todayEntries.length === 0 && <p className="food-log-empty">今天還沒有紀錄，拍張照片或手動輸入開始吧。</p>}
        {[...todayEntries].reverse().map((entry) => (
          <div className="record-row food-log-row" key={entry.id}>
            {entry.photo ? (
              <img src={entry.photo} alt={entry.foodName} className="food-log-thumb" />
            ) : (
              <div className="food-log-thumb food-log-thumb-placeholder">
                <Utensils size={16} />
              </div>
            )}
            <div className="food-log-row-main">
              <div className="record-date">
                {entry.time}　{entry.foodName}
              </div>
              <div className="record-meta">
                {Math.round(entry.estimatedCalories)} 大卡
                {entry.reason ? ` ・ ${entry.reason}` : ""}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Pill light={entry.light}>{LIGHT_META[entry.light].label.split("　")[0]}</Pill>
              <button className="icon-btn" onClick={() => onDeleteFoodEntry(entry.id)}>
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

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
                <Pill light={item.light}>{LIGHT_META[item.light].label.split("　")[0]}</Pill>
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

function ExerciseTab({ plan }) {
  return (
    <>
      <div className="card">
        <div className="section-title">每週運動目標：{plan.weeklyMinutesTarget} 分鐘中等強度有氧</div>
        {plan.cautions.length > 0 && (
          <ul className="caution-list" style={{ marginBottom: "10px" }}>
            {plan.cautions.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        )}
        <table className="plan-table">
          <thead>
            <tr>
              <th>日</th>
              <th>建議活動</th>
              <th>時間</th>
              <th>強度</th>
            </tr>
          </thead>
          <tbody>
            {plan.weeklyTemplate.map((row) => (
              <tr key={row.day}>
                <td className="day-cell">{row.day}</td>
                <td>{row.activity}</td>
                <td>{row.duration}</td>
                <td>{row.intensity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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

function TrackingTab({ profile, records, recordForm, setRecordForm, onAddRecord, onDeleteRecord, chartData }) {
  const sorted = [...records].sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <>
      <div className="card">
        <div className="section-title">新增今日紀錄</div>
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
              <label>體脂肪（%）</label>
              <input type="number" step="0.1" value={recordForm.bodyFat} onChange={(e) => setRecordForm({ ...recordForm, bodyFat: e.target.value })} />
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
          <button type="submit" className="btn btn-primary btn-block">
            <Plus size={15} /> 儲存紀錄
          </button>
        </form>
      </div>

      <MetricTrendChart title="體重趨勢" dataKey="weight" unit="kg" color="#2F6F5E" chartData={chartData} />
      <MetricTrendChart title="BMI 趨勢" dataKey="bmi" unit="" color="#B8863A" chartData={chartData} />
      <MetricTrendChart title="體脂肪率趨勢" dataKey="bodyFat" unit="%" color="#C63C34" chartData={chartData} />
      <MetricTrendChart title="骨骼肌率趨勢" dataKey="skeletalMuscle" unit="%" color="#2F6F5E" chartData={chartData} />

      <div className="card">
        <div className="section-title">歷史紀錄</div>
        {sorted.length === 0 && <p style={{ fontSize: "12.5px", color: "var(--ink-soft)" }}>尚無紀錄，新增第一筆體態資料吧。</p>}
        {sorted.map((r) => {
          const rBmi = profile?.height ? calcBMI(r.weight, profile.height) : null;
          return (
            <div className="record-row" key={r.date}>
              <div>
                <div className="record-date">{r.date}</div>
                <div className="record-meta">
                  體重 {fmtNum(r.weight)}kg
                  {rBmi ? ` ・ BMI ${fmtNum(rBmi)}` : ""}
                  {r.bodyFat != null ? ` ・ 體脂 ${fmtNum(r.bodyFat)}%` : ""}
                  {r.visceralFat != null ? ` ・ 內臟脂肪 ${fmtNum(r.visceralFat, 0)}` : ""}
                </div>
                <div className="record-meta">
                  {r.skeletalMuscle != null ? `骨骼肌 ${fmtNum(r.skeletalMuscle)}% ・ ` : ""}
                  {r.bodyAge != null ? `體年齡 ${fmtNum(r.bodyAge, 0)} ・ ` : ""}
                  {r.bmr != null ? `BMR ${fmtNum(r.bmr, 0)}kcal` : ""}
                </div>
              </div>
              <button className="icon-btn" onClick={() => onDeleteRecord(r.date)}>
                <Trash2 size={16} />
              </button>
            </div>
          );
        })}
      </div>

      <Disclaimer />
    </>
  );
}
