/**
 * Health domain logic and reference values.
 *
 * Transplanted VERBATIM from the previous single-file App.jsx by
 * tools/extract-health.mjs — do not retype these by hand. Every threshold,
 * zone boundary and formula here traces back to a cited source listed in
 * CONTENT_REVIEW, with a review date. When adjusting any of these numbers,
 * update CONTENT_REVIEW.lastReviewed and its sources list in the same edit.
 */

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

/** Derives a sedentary/light/active category from self-reported weekly
 * exercise minutes by intensity, following the WHO/ADA weekly activity
 * guideline (≥150min moderate or ≥75min vigorous, or an equivalent mix,
 * counts as "active"). Downstream calorie/water/risk calculations key off
 * this derived value the same way they did with the old direct selector. */
function deriveActivityLevel(f) {
  const vigMin = f?.vigorousChecked ? Number(f.vigorousMinutes) || 0 : 0;
  const modMin = f?.moderateChecked ? Number(f.moderateMinutes) || 0 : 0;
  const ligMin = f?.lightChecked ? Number(f.lightMinutes) || 0 : 0;
  if (vigMin >= 75 || modMin >= 150 || vigMin * 2 + modMin >= 150) return "active";
  if (vigMin > 0 || modMin > 0 || ligMin > 0) return "light";
  return "sedentary";
}

const ACTIVITY_LOG_OPTIONS = [
  { id: "jog", label: "超慢跑", category: "aerobic" },
  { id: "cycle", label: "騎自行車／飛輪", category: "aerobic" },
  { id: "badminton", label: "羽球", category: "aerobic" },
  { id: "pickleball", label: "匹克球", category: "aerobic" },
  { id: "hiking", label: "爬山", category: "aerobic" },
  { id: "tennis_squash", label: "網球／壁球", category: "aerobic" },
  { id: "table_tennis", label: "桌球", category: "aerobic" },
  { id: "leisure_walk", label: "散步／休閒活動", category: "aerobic" },
  { id: "strength", label: "肌耐力／阻力訓練", category: "resistance" },
  { id: "flex", label: "伸展／太極／瑜伽", category: "flexibility" },
  { id: "other", label: "其他", category: "other" },
];

const ACTIVITY_CATEGORY_LABEL = { aerobic: "有氧", resistance: "阻力", flexibility: "柔軟度", other: "其他" };

const LIGHT_META = {
  green: { label: "綠燈　可安心食用", className: "pill-green" },
  yellow: { label: "黃燈　適量、留意份量", className: "pill-yellow" },
  red: { label: "紅燈　建議避免", className: "pill-red" },
};

const BMI_ZONES = [
  { y1: 15, y2: 18.5, bg: "#FBF0DC", label: "過輕 <18.5" },
  { y1: 18.5, y2: 24, bg: "#E4F5E7", label: "正常 18.5-24" },
  { y1: 24, y2: 27, bg: "#FDEBD3", label: "過重 24-27" },
  { y1: 27, y2: 32, bg: "#FAE6E3", label: "肥胖 ≥27" },
];

/** Body fat % reference zones, commonly cited by Taiwan hospital patient
 * education materials (e.g. 衛福部雙和醫院、國健署健康九九手冊）. Differs by
 * gender since normal body fat % ranges are not the same for men and women. */
function bodyFatZones(gender) {
  if (gender === "male") {
    return [
      { y1: 5, y2: 15, bg: "#FBF0DC", label: "偏低 <15%" },
      { y1: 15, y2: 25, bg: "#E4F5E7", label: "正常 15-25%" },
      { y1: 25, y2: 45, bg: "#FAE6E3", label: "偏高 ≥25%" },
    ];
  }
  return [
    { y1: 10, y2: 20, bg: "#FBF0DC", label: "偏低 <20%" },
    { y1: 20, y2: 30, bg: "#E4F5E7", label: "正常 20-30%" },
    { y1: 30, y2: 50, bg: "#FAE6E3", label: "偏高 ≥30%" },
  ];
}

/** Skeletal muscle % reference zones, commonly cited by Taiwan fitness/
 * health media (e.g. World Gym Taiwan、TVBS 衛教報導). These are general
 * population reference ranges, not a single strict government standard —
 * shown as an approximate guide rather than a precise medical cutoff. */
function skeletalMuscleZones(gender) {
  if (gender === "male") {
    return [
      { y1: 15, y2: 32, bg: "#FBF0DC", label: "偏低 <32%" },
      { y1: 32, y2: 34, bg: "#E4F5E7", label: "正常 32-34%" },
      { y1: 34, y2: 50, bg: "#E4F0F8", label: "偏高 ≥34%" },
    ];
  }
  return [
    { y1: 12, y2: 28, bg: "#FBF0DC", label: "偏低 <28%" },
    { y1: 28, y2: 30, bg: "#E4F5E7", label: "正常 28-30%" },
    { y1: 30, y2: 46, bg: "#E4F0F8", label: "偏高 ≥30%" },
  ];
}

/** Waist circumference reference zones per 衛生福利部國民健康署 metabolic
 * syndrome criteria: male ≥90cm / female ≥80cm indicates elevated risk. */
function waistZones(gender) {
  if (gender === "male") {
    return [
      { y1: 55, y2: 90, bg: "#E4F5E7", label: "正常 <90cm" },
      { y1: 90, y2: 130, bg: "#FAE6E3", label: "腰圍過大 ≥90cm" },
    ];
  }
  return [
    { y1: 50, y2: 80, bg: "#E4F5E7", label: "正常 <80cm" },
    { y1: 80, y2: 120, bg: "#FAE6E3", label: "腰圍過大 ≥80cm" },
  ];
}

/** Sleep duration reference zones for adults, per 衛生福利部國民健康署 health
 * promotion material and the US National Sleep Foundation's 2015 consensus
 * (adults 18-64: 7-9 hours nightly). Shown as a general guide — shift workers
 * and people with sleep disorders should follow their clinician's advice. */
function sleepZones() {
  return [
    { y1: 3, y2: 7, bg: "#FBF0DC", label: "偏少 <7 小時" },
    { y1: 7, y2: 9, bg: "#E4F5E7", label: "建議 7-9 小時" },
    { y1: 9, y2: 12, bg: "#E4F0F8", label: "偏多 >9 小時" },
  ];
}

const CONTENT_REVIEW = {
  lastReviewed: "2026-09-08",
  sources: [
    "衛生福利部國民健康署《我的餐盤》飲食指南與「顧血糖4招」衛教資訊",
    "衛生福利部國民健康署《糖尿病防治手冊》",
    "台北榮民總醫院護理部衛教資訊《糖尿病與運動》",
    "社團法人中華民國糖尿病學會《2022第2型糖尿病臨床照護指引》",
    "衛生福利部《國人膳食營養素參考攝取量》第九版飲水建議草案",
    "衛生福利部雙和醫院、國健署健康九九手冊：BMI／體脂肪率標準",
    "World Gym Taiwan、TVBS衛教報導：骨骼肌率參考範圍",
    "衛生福利部國民健康署代謝症候群學習手冊：腰圍標準",
    "衛生福利部食品藥物管理署《食品營養成分資料庫（新版）》：食物熱量查詢",
    "衛生福利部國民健康署睡眠健康衛教資訊、美國National Sleep Foundation 2015共識：成人每晚7-9小時",
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
    cautions.push("您的年齡建議優先選擇低衝擊運動（如超慢跑、太極），運動前務必充分熱身。");
  }
  if (cardioRisk) {
    cautions.push("您有心血管相關風險因子，建議先諮詢醫師評估合適的運動強度，運動中留意心跳與不適感。");
  }
  if (isObese) {
    cautions.push("您的BMI偏高，建議優先選擇對關節負擔較小的運動，如超慢跑、飛輪，待體能提升後再增加強度。");
  }
  if (symptoms.includes("sedentary")) {
    cautions.push("目前活動量較少，建議先從每天10分鐘超慢跑開始，再逐週增加時間與強度。");
  }
  if (symptoms.includes("prediabetes")) {
    cautions.push(
      "您已被醫師告知糖尿病前期／血糖偏高，建議避免空腹或飯前運動，隨身攜帶方糖等含糖食物以防低血糖；若有測血糖習慣，血糖高於250mg/dL或低於80mg/dL時不宜運動。"
    );
  }

  const lowImpact = age >= 65 || cardioRisk || isObese;

  const aerobic = lowImpact ? "超慢跑／飛輪（固定式腳踏車）" : "超慢跑／騎自行車／羽球";
  const resistanceLabel = "阻力訓練（彈力帶或自身體重：深蹲、伏地挺身）";
  const resistanceLabelShort = "阻力訓練";

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

/** Compares actual logged exercise minutes (rolling 7 days) against the
 * weekly target, and checks whether aerobic/resistance/flexibility work is
 * reasonably balanced, returning a short list of encouraging suggestions. */
function buildExerciseWeeklyFeedback(exerciseLog, weeklyMinutesTarget) {
  const cutoff = daysAgoStr(6);
  const weekEntries = exerciseLog.filter((e) => e.date >= cutoff);
  const totalMinutes = weekEntries.reduce((s, e) => s + (Number(e.durationMin) || 0), 0);
  const pct = weeklyMinutesTarget ? Math.round((totalMinutes / weeklyMinutesTarget) * 100) : 0;

  const categoryCount = { aerobic: 0, resistance: 0, flexibility: 0, other: 0 };
  weekEntries.forEach((e) => {
    const opt = ACTIVITY_LOG_OPTIONS.find((o) => o.id === e.activityId);
    const cat = opt ? opt.category : "other";
    if (categoryCount[cat] != null) categoryCount[cat] += 1;
  });

  const suggestions = [];
  if (totalMinutes === 0) {
    suggestions.push("本週還沒有運動紀錄，先安排一次 10-15 分鐘的超慢跑開始吧！");
  } else if (pct >= 100) {
    suggestions.push(`本週已累積 ${totalMinutes} 分鐘，達成 ${weeklyMinutesTarget} 分鐘目標，非常棒，繼續保持！`);
  } else {
    const remain = Math.max(weeklyMinutesTarget - totalMinutes, 0);
    suggestions.push(`本週已累積 ${totalMinutes} 分鐘，還差 ${remain} 分鐘就能達成 ${weeklyMinutesTarget} 分鐘的目標。`);
  }
  if (categoryCount.resistance === 0) {
    suggestions.push("本週還沒有阻力／肌耐力訓練的紀錄，建議安排一次 15-20 分鐘。");
  }
  if (categoryCount.aerobic === 0 && totalMinutes > 0) {
    suggestions.push("本週還沒有有氧運動的紀錄，建議安排超慢跑、羽球等活動。");
  }

  return { totalMinutes, pct: Math.min(pct, 999), categoryCount, suggestions };
}

function buildWeeklyExerciseChartData(exerciseLog) {
  const days = [];
  for (let i = 6; i >= 0; i--) days.push(daysAgoStr(i));
  return days.map((d) => {
    const total = exerciseLog.filter((e) => e.date === d).reduce((s, e) => s + (Number(e.durationMin) || 0), 0);
    return { date: d.slice(5), total: Math.round(total) };
  });
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

/** Estimate a reference daily calorie target, returning a breakdown so the
 * UI can show whether it's using today's/latest logged BMR (e.g. from an
 * OMRON body-composition scale) or a formula-estimated fallback. A modest
 * ~500kcal reduction is applied when BMI indicates overweight/obesity,
 * bounded by a safety floor. This is a general estimate for reference only. */
function calcDailyCalorieTargetBreakdown(profile, latestRecord) {
  if (!profile?.weight || !profile?.height || !profile?.age) return null;
  const weight = Number(profile.weight);
  const height = Number(profile.height);
  const age = Number(profile.age);

  const hasRecordBmr = latestRecord?.bmr != null && latestRecord.bmr !== "";
  let bmr;
  if (hasRecordBmr) {
    bmr = Number(latestRecord.bmr);
  } else if (profile.gender === "male") {
    bmr = 10 * weight + 6.25 * height - 5 * age + 5;
  } else {
    bmr = 10 * weight + 6.25 * height - 5 * age - 161;
  }
  bmr = Math.round(bmr);

  const activityFactorMap = { sedentary: 1.2, light: 1.375, active: 1.55 };
  const factor = activityFactorMap[profile.activityLevel] || 1.2;
  let target = bmr * factor;

  const bmi = calcBMI(weight, height);
  const deficitApplied = bmi != null && bmi >= 24;
  if (deficitApplied) target -= 500;

  const floor = profile.gender === "male" ? 1500 : 1200;
  const flooredApplied = target < floor;
  target = Math.round(Math.max(target, floor));

  return {
    target,
    bmr,
    bmrSource: hasRecordBmr ? "record" : "formula",
    bmrSourceDate: hasRecordBmr ? latestRecord.date : null,
    activityFactor: factor,
    deficitApplied,
    flooredApplied,
  };
}

function calcDailyCalorieTarget(profile, latestRecord) {
  const breakdown = calcDailyCalorieTargetBreakdown(profile, latestRecord);
  return breakdown ? breakdown.target : null;
}

/** Estimate a reference daily water intake target in ml, returning a full
 * breakdown so the UI can show exactly how the number was derived. Uses the
 * higher of two commonly-cited methods: (a) 30ml per kg body weight, and (b)
 * Taiwan HPA's general adult baseline (male 2400ml / female 2100ml total
 * fluid intake), then adds a modest allowance for activity level.
 *
 * Prefers today's/most-recent OMRON body-tracking weight over the static
 * profile weight, so the target stays current as your measured weight
 * changes — same principle as the calorie target preferring the latest
 * logged BMR. This is a general wellness reference only — people with
 * kidney disease, heart failure, or other conditions requiring fluid
 * restriction should follow their doctor's guidance instead. */
function calcWaterTargetBreakdown(profile, latestRecord) {
  const usingLatest = latestRecord?.weight != null && latestRecord.weight !== "";
  const weight = Number(usingLatest ? latestRecord.weight : profile?.weight);
  if (!weight) return null;

  const weightBased = Math.round(weight * 30);
  const genderBase = profile?.gender === "male" ? 2400 : 2100;
  const baseTarget = Math.max(weightBased, genderBase);
  const usedWeightBased = weightBased >= genderBase;

  let activityAdd = 0;
  if (profile?.activityLevel === "active") activityAdd = 500;
  else if (profile?.activityLevel === "light") activityAdd = 200;

  const rawTarget = Math.min(baseTarget + activityAdd, 4000);
  const target = Math.round(rawTarget / 50) * 50;

  return {
    target,
    weight,
    weightSource: usingLatest ? "record" : "profile",
    weightSourceDate: usingLatest ? latestRecord.date : null,
    weightBased,
    genderBase,
    usedWeightBased,
    activityAdd,
  };
}

function calcWaterTarget(profile, latestRecord) {
  const breakdown = calcWaterTargetBreakdown(profile, latestRecord);
  return breakdown ? breakdown.target : null;
}

function waterMood(pct) {
  if (pct >= 100) return "party";
  if (pct >= 60) return "happy";
  if (pct >= 25) return "neutral";
  return "sleepy";
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

export {
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
};
