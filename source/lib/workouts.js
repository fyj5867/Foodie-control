/**
 * Exercise suggestions, tailored — and how they link to a video.
 *
 * Two decisions shape this file.
 *
 * **Why the links are searches, not video ids.** A static app has no way to
 * know that a video was deleted, made private, or replaced by something else
 * six months from now, and a dead link in the middle of a health plan is worse
 * than no link. A YouTube search URL with a well-chosen Chinese query cannot
 * rot: it always resolves, always returns current results, and lets the person
 * pick a teacher whose pace suits them. Where someone finds a video they like,
 * they can pin it to that exercise (`savedLink`) and it becomes one tap from
 * then on — which is the version of "my video" that actually lasts.
 *
 * **Why the suggestions are ranked rather than listed.** A catalogue of twelve
 * exercises is a catalogue; three with a reason attached is advice. Ranking
 * uses what the app already knows — the report's out-of-range values, the
 * profile's conditions, BMI, and what has actually been logged in the last
 * week — so the reason given is specific and checkable.
 *
 * Cautions are conservative on purpose. This app has no idea what else is
 * going on with someone, so anything that could go wrong quickly (breath
 * holding with high blood pressure, high-impact work on a heavy frame) is
 * flagged, and starting anything new is pointed at a doctor first.
 */

import { outOfRangeMarkers, calcBMI, ACTIVITY_LOG_OPTIONS } from "./health.js";

/** What a suggestion can be recommended *for*. Tags, not sentences, so the
 * ranking can reason about them and the wording stays in one place. */
export const GOALS = {
  glucose: "血糖相關數值",
  lipid: "血脂相關數值",
  pressure: "血壓",
  weight: "體重與腰圍",
  strength: "肌力",
  mobility: "柔軟度與放鬆",
};

/**
 * The catalogue.
 *
 * `activityId` maps onto the ids the exercise log already uses, so a
 * suggestion can be recorded without retyping it. `impact` is joint impact —
 * the axis that decides what to offer someone carrying more weight or nursing
 * a knee. `query` is what gets searched on YouTube; they are written the way a
 * person in Taiwan would search, because that is what returns usable results.
 */
export const WORKOUTS = [
  {
    id: "slow-jog",
    label: "超慢跑",
    activityId: "jog",
    category: "aerobic",
    impact: "low",
    minutes: 30,
    goals: ["glucose", "lipid", "weight"],
    level: "beginner",
    note: "在家原地就能做，速度比走路快一點就夠，能邊做邊講話的強度最剛好。",
    query: "超慢跑 教學 初學者 30分鐘",
  },
  {
    id: "post-meal-walk",
    label: "餐後散步",
    activityId: "leisure_walk",
    category: "aerobic",
    impact: "low",
    minutes: 15,
    goals: ["glucose"],
    level: "beginner",
    note: "飯後 30 分鐘內走 10-15 分鐘，一天分幾次累積也算數。",
    query: "飯後散步 健走 正確姿勢 教學",
  },
  {
    id: "indoor-cycle",
    label: "室內腳踏車／飛輪",
    activityId: "cycle",
    category: "aerobic",
    impact: "low",
    minutes: 30,
    goals: ["lipid", "weight", "pressure"],
    level: "beginner",
    note: "膝蓋負擔小，下雨天也不受影響。",
    query: "室內腳踏車 有氧 30分鐘 跟著騎",
  },
  {
    id: "water-aerobics",
    label: "游泳／水中有氧",
    activityId: "other",
    category: "aerobic",
    impact: "very-low",
    minutes: 30,
    goals: ["weight", "lipid", "mobility"],
    level: "beginner",
    note: "浮力把關節的負擔降到最低，體重較高或膝蓋不舒服時最合適。",
    query: "水中有氧 動作 教學 初學",
  },
  {
    id: "dance-aerobic",
    label: "有氧舞蹈",
    activityId: "other",
    category: "aerobic",
    impact: "medium",
    minutes: 30,
    goals: ["weight", "lipid"],
    level: "intermediate",
    note: "跟著音樂做比較不會覺得在運動，適合已經有點基礎的時候。",
    query: "有氧舞蹈 減脂 跟著跳 30分鐘",
  },
  {
    id: "brisk-hike",
    label: "健走／爬山",
    activityId: "hiking",
    category: "aerobic",
    impact: "medium",
    minutes: 40,
    goals: ["lipid", "weight", "pressure"],
    level: "intermediate",
    note: "上坡的強度就夠了，下坡對膝蓋的負擔反而比上坡大，慢慢走。",
    query: "健走 正確姿勢 教學 郊山 入門",
  },
  {
    id: "bodyweight-strength",
    label: "徒手肌力訓練",
    activityId: "strength",
    category: "resistance",
    impact: "low",
    minutes: 20,
    goals: ["strength", "glucose", "weight"],
    level: "beginner",
    note: "肌肉是身體用掉糖分的主要地方，一週兩次就有差。",
    query: "居家 徒手 肌力訓練 初學者 20分鐘",
  },
  {
    id: "band-strength",
    label: "彈力帶訓練",
    activityId: "strength",
    category: "resistance",
    impact: "low",
    minutes: 20,
    goals: ["strength", "mobility"],
    level: "beginner",
    note: "阻力可以自己調，比啞鈴容易上手，坐著也能做。",
    query: "彈力帶 全身訓練 初學者 跟著做",
  },
  {
    id: "chair-workout",
    label: "椅子運動",
    activityId: "other",
    category: "resistance",
    impact: "very-low",
    minutes: 15,
    goals: ["strength", "mobility"],
    level: "beginner",
    note: "全程坐著完成，膝蓋、腰背不舒服的日子也做得了。",
    query: "椅子運動 居家 銀髮 肌力 跟著做",
  },
  {
    id: "stretch",
    label: "伸展",
    activityId: "flex",
    category: "flexibility",
    impact: "very-low",
    minutes: 15,
    goals: ["mobility"],
    level: "beginner",
    note: "睡前做一輪，肩頸和下背會鬆很多。",
    query: "睡前伸展 15分鐘 全身 跟著做",
  },
  {
    id: "taichi",
    label: "太極／養生操",
    activityId: "flex",
    category: "flexibility",
    impact: "very-low",
    minutes: 20,
    goals: ["mobility", "pressure"],
    level: "beginner",
    note: "動作慢、不會喘，是把運動放進每天最沒有心理負擔的方式。",
    query: "太極 養生操 初學者 教學 跟著做",
  },
  {
    id: "yoga",
    label: "瑜伽",
    activityId: "flex",
    category: "flexibility",
    impact: "low",
    minutes: 25,
    goals: ["mobility", "pressure"],
    level: "beginner",
    note: "有高血壓時避開頭低於心臟的倒立類動作。",
    query: "瑜伽 初學者 舒緩 跟著做 25分鐘",
  },
];

/** A search URL, which — unlike a video id — cannot go dead. */
export function youtubeSearchUrl(query) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

/**
 * Whether a link the user pinned is safe to put in an href.
 *
 * Only http(s). The point is not to be strict about which site — a video she
 * likes on another platform is just as useful — it is to keep `javascript:`
 * and `data:` out of an attribute the app renders.
 */
export function isSafeLink(url) {
  const text = String(url || "").trim();
  if (!text) return false;
  try {
    const parsed = new URL(text);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch (e) {
    return false;
  }
}

export function normalizeLinks(raw) {
  const out = {};
  if (!raw || typeof raw !== "object") return out;
  const ids = new Set(WORKOUTS.map((w) => w.id));
  for (const [id, url] of Object.entries(raw)) {
    if (ids.has(id) && isSafeLink(url)) out[id] = String(url).trim();
  }
  return out;
}

/* ------------------------------------------------------------- cautions -- */

/**
 * Warnings that apply to this person whatever they pick.
 *
 * Kept general and few. A wall of warnings gets skipped, and the two that
 * matter — do not hold your breath under load with high blood pressure, and
 * stop if something feels wrong — are the ones worth reading.
 */
export function cautionsFor({ profile = null, report = null } = {}) {
  const symptoms = (profile && profile.symptoms) || [];
  const out = [];

  if (symptoms.includes("hypertension")) {
    out.push("有高血壓：做阻力訓練時不要憋氣，出力時吐氣、放鬆時吸氣；避免瞬間爆發用力的動作。");
  }
  if (symptoms.includes("prediabetes") || symptoms.includes("diabetes")) {
    out.push("運動前後身上帶一點方便吃的醣類，覺得心悸、手抖、冒冷汗就先停下來。");
  }
  const values = report ? report.values : null;
  if (values && (values.systolic >= 160 || values.diastolic >= 100)) {
    out.push("報告上的血壓偏高，開始新的運動計畫前建議先問過醫師。");
  }
  out.push("運動中若出現胸悶、胸痛、頭暈或異常喘，請立刻停下來並儘快就醫。");
  return out;
}

/* ------------------------------------------------------------- ranking --- */

const IMPACT_ORDER = { "very-low": 0, low: 1, medium: 2, high: 3 };

/** Which goals matter for this person right now, strongest first. */
export function goalsFor({ profile = null, report = null, latestRecord = null } = {}) {
  const gender = profile && profile.gender === "male" ? "male" : "female";
  const goals = [];
  const add = (g) => {
    if (g && !goals.includes(g)) goals.push(g);
  };

  const findings = report ? outOfRangeMarkers(report.values, gender) : [];
  for (const finding of findings) {
    if (["fastingGlucose", "hba1c"].includes(finding.key)) add("glucose");
    if (["triglycerides", "hdl", "ldl", "totalCholesterol"].includes(finding.key)) add("lipid");
    if (["systolic", "diastolic"].includes(finding.key)) add("pressure");
    if (finding.key === "waist") add("weight");
  }

  const symptoms = (profile && profile.symptoms) || [];
  if (symptoms.includes("prediabetes")) add("glucose");
  if (symptoms.includes("hyperlipidemia")) add("lipid");
  if (symptoms.includes("hypertension")) add("pressure");

  const weight = latestRecord && latestRecord.weight ? latestRecord.weight : profile && profile.weight;
  const height = profile && profile.height;
  const bmi = calcBMI(weight, height);
  if (bmi && bmi >= 24) add("weight");

  /* Everyone gets these two at the bottom: muscle is where the body uses up
     glucose, and something gentle has to be on the list for the bad days. */
  add("strength");
  add("mobility");
  return goals;
}

/**
 * Suggestions for this person, best first.
 *
 * The mix is deliberate rather than purely score-ordered: at least one
 * resistance and one flexibility option always make the list. A page of five
 * cardio videos is not a week's exercise, and on a day when someone feels
 * terrible the gentle option is the only one that will actually happen.
 */
export function recommendWorkouts({
  profile = null,
  report = null,
  latestRecord = null,
  exerciseLog = [],
  limit = 4,
} = {}) {
  const goals = goalsFor({ profile, report, latestRecord });
  const symptoms = (profile && profile.symptoms) || [];
  const weight = latestRecord && latestRecord.weight ? latestRecord.weight : profile && profile.weight;
  const bmi = calcBMI(weight, profile && profile.height);
  const heavyFrame = Boolean(bmi && bmi >= 27);

  /* Someone who has logged almost nothing needs the easiest thing that works,
     not the most effective thing they will not do. */
  const recentMinutes = (exerciseLog || []).reduce((sum, e) => sum + (Number(e.durationMin) || 0), 0);
  const isBeginner = recentMinutes < 60;

  const scored = WORKOUTS.map((workout) => {
    let score = 0;
    const reasons = [];

    workout.goals.forEach((goal) => {
      const rank = goals.indexOf(goal);
      if (rank >= 0) score += Math.max(1, 10 - rank * 2);
    });

    const primary = workout.goals.find((g) => goals.indexOf(g) === Math.min(...workout.goals.map((g2) => (goals.indexOf(g2) < 0 ? 99 : goals.indexOf(g2)))));
    if (primary && goals.includes(primary)) reasons.push(GOALS[primary]);

    if (isBeginner && workout.level === "beginner") score += 4;
    if (isBeginner && workout.level !== "beginner") score -= 4;

    /* Joint impact is the axis that decides what is actually doable. */
    if (heavyFrame) score -= IMPACT_ORDER[workout.impact] * 4;
    if (symptoms.includes("hypertension") && workout.impact === "high") score -= 6;

    return { workout, score, reasons };
  }).sort((a, b) => b.score - a.score);

  const chosen = [];
  const take = (predicate) => {
    const found = scored.find((s) => !chosen.includes(s) && predicate(s.workout));
    if (found) chosen.push(found);
  };

  take(() => true);
  take((wk) => wk.category === "resistance");
  take((wk) => wk.category === "flexibility");
  while (chosen.length < limit) {
    const next = scored.find((s) => !chosen.includes(s));
    if (!next) break;
    chosen.push(next);
  }

  return chosen.slice(0, limit).map(({ workout, reasons }, index) => ({
    ...workout,
    url: youtubeSearchUrl(workout.query),
    why: buildWhy(workout, reasons, { heavyFrame, isBeginner, isFirst: index === 0 }),
  }));
}

/**
 * The one line under each suggestion saying why it is there.
 *
 * "Start with this one" belongs on the first card only. Repeated on all four
 * it stops being a recommendation and becomes wallpaper — and then none of the
 * four reads as the one to start with.
 */
function buildWhy(workout, reasons, { heavyFrame, isBeginner, isFirst }) {
  const parts = [];
  if (reasons.length) parts.push(`針對${reasons[0]}`);
  if (heavyFrame && (workout.impact === "very-low" || workout.impact === "low")) parts.push("對膝蓋負擔小");
  if (isFirst && isBeginner && workout.level === "beginner") parts.push("從這一項開始最容易接上");
  if (!parts.length) parts.push("均衡搭配用");
  return parts.join("，");
}

/** The label the exercise log will show if this suggestion is recorded. */
export function activityLabelFor(workout) {
  const opt = ACTIVITY_LOG_OPTIONS.find((o) => o.id === workout.activityId);
  return opt && opt.id !== "other" ? opt.label : workout.label;
}
