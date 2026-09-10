/**
 * Joining a health check report to what the app records every day.
 *
 * A report is a snapshot; the diary is what actually moves it. This module is
 * the bridge: it turns the values that fell outside their reference range into
 * a small number of things to do over the next seven days, each one attached
 * to something the app already counts — so at the end of the week the question
 * "did I do it" has an answer instead of an impression. Once a month it adds
 * up the whole month the same way.
 *
 * The hard rule everything here obeys: **describe, never diagnose.** A value
 * is reported as where it sits against a published range, and the action
 * suggested is a behaviour, never a treatment. There is no sentence in this
 * file that predicts what will happen to a number, because nobody can promise
 * that and a person acting on such a promise is worse off than one who was
 * told the truth. Kidney markers get no dietary advice at all — protein and
 * salt restriction is a clinical decision, so that finding is handed straight
 * to the doctor. tools/test-plan.mjs enforces the wording.
 */

import { outOfRangeMarkers, labMarker, positiveFlags, ACTIVITY_LOG_OPTIONS, todayStr } from "./health.js";
import { summaryMet, FIELDS, EXERCISE_GOAL_MIN, WATER_GOAL_ML, CALORIE_CEILING } from "./goals.js";

/** One planning cycle. Seven days is what the user asked for, and it is short
 * enough that a bad week is over quickly rather than becoming the whole month. */
export const CYCLE_DAYS = 7;

/* ---------------------------------------------------------------- dates -- */

export function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + n);
  const pad = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function daysBetween(a, b) {
  const ms = new Date(`${b}T00:00:00`) - new Date(`${a}T00:00:00`);
  return Math.round(ms / 86400000);
}

export function monthOf(dateStr) {
  return String(dateStr || "").slice(0, 7);
}

/** First and last date of a YYYY-MM month. */
export function monthBounds(month) {
  const [y, m] = String(month).split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  const pad = (x) => String(x).padStart(2, "0");
  return { start: `${y}-${pad(m)}-01`, end: `${y}-${pad(m)}-${pad(last)}`, days: last };
}

/** Whether a date is the last day of its month — when the monthly review is due. */
export function isMonthEnd(dateStr) {
  return dateStr === monthBounds(monthOf(dateStr)).end;
}

export function previousMonth(month) {
  const [y, m] = String(month).split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Which seven-day cycle today falls in, counting from an anchor date.
 *
 * The anchor is the report's date, so cycle 1 starts the day the report was
 * entered — the plan is a response to that report, and dating it from anywhere
 * else would make "week 3" mean nothing in particular. A date before the
 * anchor is treated as cycle 1 rather than a negative week.
 */
export function cycleFor(anchor, today = todayStr()) {
  const elapsed = Math.max(0, daysBetween(anchor, today));
  const index = Math.floor(elapsed / CYCLE_DAYS) + 1;
  const start = addDays(anchor, (index - 1) * CYCLE_DAYS);
  const end = addDays(start, CYCLE_DAYS - 1);
  const dayInCycle = daysBetween(start, today) + 1;
  return { index, start, end, dayInCycle, daysLeft: Math.max(0, CYCLE_DAYS - dayInCycle) };
}

/* ------------------------------------------------------------- measuring -- */

function inWindow(entry, start, end) {
  return entry && entry.date >= start && entry.date <= end;
}

function categoryOf(entry) {
  const opt = ACTIVITY_LOG_OPTIONS.find((o) => o.id === entry.activityId);
  return opt ? opt.category : "other";
}

/**
 * Everything a focus can be measured against, over one date window.
 *
 * All of it comes from records the app already keeps, which is the point: a
 * plan measured by something the person has to report separately is a plan
 * nobody ever scores.
 */
export function measureWindow({ start, end, summaries = [], foodLog = [], exerciseLog = [], waterLog = [] }) {
  const days = daysBetween(start, end) + 1;
  const rows = summaries.filter((s) => inWindow(s, start, end));
  const meals = foodLog.filter((e) => inWindow(e, start, end));
  const workouts = exerciseLog.filter((e) => inWindow(e, start, end));
  const drinks = waterLog.filter((e) => inWindow(e, start, end));

  const caloriesByDay = {};
  for (const meal of meals) {
    caloriesByDay[meal.date] = (caloriesByDay[meal.date] || 0) + (Number(meal[FIELDS.calories]) || 0);
  }
  const loggedDays = Object.keys(caloriesByDay);
  const totalCalories = loggedDays.reduce((sum, d) => sum + caloriesByDay[d], 0);

  const waterByDay = {};
  for (const drink of drinks) {
    waterByDay[drink.date] = (waterByDay[drink.date] || 0) + (Number(drink[FIELDS.water]) || 0);
  }
  const waterDaysLogged = Object.keys(waterByDay);

  const exerciseMinutes = workouts.reduce((sum, e) => sum + (Number(e[FIELDS.exercise]) || 0), 0);
  const aerobicMinutes = workouts
    .filter((e) => categoryOf(e) === "aerobic")
    .reduce((sum, e) => sum + (Number(e[FIELDS.exercise]) || 0), 0);
  const resistanceSessions = workouts.filter((e) => categoryOf(e) === "resistance").length;

  return {
    start,
    end,
    days,
    daysWithSummary: rows.length,
    metDays: rows.filter(summaryMet).length,
    calorieDays: rows.filter((r) => r.c).length,
    exerciseDays: rows.filter((r) => r.e).length,
    waterDays: rows.filter((r) => r.w).length,
    exerciseMinutes,
    aerobicMinutes,
    resistanceSessions,
    redMeals: meals.filter((m) => m.light === "red").length,
    mealCount: meals.length,
    loggedFoodDays: loggedDays.length,
    avgCalories: loggedDays.length ? Math.round(totalCalories / loggedDays.length) : null,
    daysOverCeiling: loggedDays.filter((d) => caloriesByDay[d] >= CALORIE_CEILING).length,
    avgWaterMl: waterDaysLogged.length
      ? Math.round(waterDaysLogged.reduce((s, d) => s + waterByDay[d], 0) / waterDaysLogged.length)
      : null,
  };
}

/** How a measure reads on screen, and how a target is scored. */
export const MEASURES = {
  metDays: { label: "三項全達標的天數", unit: "天", higherIsBetter: true },
  exerciseDays: { label: "運動達標的天數", unit: "天", higherIsBetter: true },
  waterDays: { label: "喝水達標的天數", unit: "天", higherIsBetter: true },
  calorieDays: { label: "熱量控制達標的天數", unit: "天", higherIsBetter: true },
  aerobicMinutes: { label: "有氧運動累計", unit: "分鐘", higherIsBetter: true },
  resistanceSessions: { label: "阻力訓練次數", unit: "次", higherIsBetter: true },
  redMeals: { label: "紅燈飲食次數", unit: "次", higherIsBetter: false },
};

export function scoreFocus(focus, measured) {
  if (!focus.measure) return null;
  const meta = MEASURES[focus.measure];
  const actual = measured[focus.measure];
  if (actual == null || !meta) return null;
  const done = meta.higherIsBetter ? actual >= focus.target : actual <= focus.target;
  return { measure: focus.measure, label: meta.label, unit: meta.unit, target: focus.target, actual, done };
}

/* ---------------------------------------------------------------- focus -- */

/**
 * What each out-of-range finding turns into for the next seven days.
 *
 * `when` looks at the report; `title` and `action` describe a behaviour. The
 * `why` is filled in with the actual number and the range it sits in, so the
 * person can see the reasoning rather than being told to trust it.
 *
 * Order is priority order: the first three that match are what gets shown.
 * Three is a plan, seven is a wish list.
 */
/**
 * What a referral says, by the part of the body it came from.
 *
 * Every marker flagged `referral` in lib/health.js ends up in one card rather
 * than one card each: with forty markers on a report, a card per abnormal
 * finding would bury the two or three things she can actually act on this
 * week. The note is per group because the reason to see a doctor differs —
 * and for kidney values the note exists specifically to say that this app is
 * NOT going to suggest a protein or salt target.
 */
export const REFERRAL_NOTES = {
  kidney: "飲食上的調整（例如蛋白質、鹽分）需要醫師依你的整體狀況決定，這個 App 不提供這方面的建議。",
  liver: "肝指數變化的原因很多，需要醫師判斷。生活面可以先做的是規律運動、減少含糖飲料與酒精。",
  blood: "血液計數的異常原因很多（缺鐵、發炎、其他），要靠醫師搭配其他數值一起看。",
  thyroid: "甲狀腺功能的判讀與後續都需要醫師安排。",
  mineral: "電解質與礦物質的異常請讓醫師知道，需不需要補充也由醫師決定。",
  inflammation: "發炎指標會受感染、受傷影響而暫時升高，請由醫師判斷代表什麼。",
  tumour: "腫瘤標記受很多因素影響，高於參考值不等於罹癌，也不能單靠它排除疾病，請由醫師安排後續。",
  eye: "視力與眼壓的變化需要眼科判讀（眼壓還要搭配視神經與視野一起看）。血糖偏高的人建議每年做一次眼底檢查。",
  bone: "骨密度的後續處理請由醫師評估。",
  other: "這一項請醫師判讀。",
};

export const FOCUS_RULES = [
  {
    id: "tg-sugar",
    markers: ["triglycerides"],
    title: "這 7 天，先減含糖飲料與精緻澱粉",
    action: "含糖飲料換成無糖茶或水；白飯白麵換成糙米或全麥；點心改成原型食物。",
    measure: "redMeals",
    target: 3,
  },
  {
    id: "glucose-move",
    markers: ["fastingGlucose", "hba1c", "postprandialGlucose"],
    title: "這 7 天，把運動放進每一天",
    action: "餐後散步 10-15 分鐘，一天 2-3 次也算數；累積到 30 分鐘就達標。",
    measure: "exerciseDays",
    target: 5,
  },
  {
    id: "hdl-aerobic",
    markers: ["hdl"],
    title: "這 7 天，累積有氧運動",
    action: "快走、超慢跑、騎車都算。分次做也可以，重點是總時間。",
    measure: "aerobicMinutes",
    target: 150,
  },
  {
    id: "bp-move",
    markers: ["systolic", "diastolic"],
    title: "這 7 天，規律有氧＋減鹽",
    action: "湯少喝、醬少沾、加工肉品減量；有氧運動每次 20-30 分鐘。",
    measure: "exerciseDays",
    target: 5,
  },
  {
    id: "ldl-fat",
    markers: ["ldl", "totalCholesterol", "nonHdl"],
    title: "這 7 天，油炸與加工肉品減量",
    action: "烹調換成清蒸、水煮、烤；加工肉品（香腸、培根、火腿）這週先停。",
    measure: "redMeals",
    target: 2,
  },
  {
    id: "uric-water",
    markers: ["uricAcid"],
    title: "這 7 天，把水喝足",
    action: "每天 2000cc 分次喝；內臟、濃湯與含糖飲料減量。",
    measure: "waterDays",
    target: 6,
  },
  {
    id: "crp-antiinflam",
    markers: ["hsCrp"],
    title: "這 7 天，油炸和含糖的先停",
    action: "油炸、加工肉品、含糖飲料這週先放一邊；蔬菜、深海魚、堅果多一些。規律運動本身也有幫助。",
    measure: "redMeals",
    target: 2,
  },
  {
    id: "vitd-outdoor",
    markers: ["vitaminD"],
    title: "這 7 天，每天到戶外走一走",
    action: "手臂或小腿曬到太陽 10-20 分鐘（避開正中午）；飲食上可以多鯖魚、秋刀魚、蛋黃、乾香菇。要不要吃補充劑、吃多少請問醫師。",
    measure: "exerciseDays",
    target: 4,
  },
  {
    id: "bone-resistance",
    markers: ["boneT"],
    title: "這 7 天，做兩次負重運動",
    action: "骨頭需要被「用到」才會留住鈣：快走、爬樓梯、彈力帶、深蹲都算。乳製品、小魚乾、深綠色蔬菜可以多一些。",
    measure: "resistanceSessions",
    target: 2,
  },
  {
    id: "waist-steady",
    markers: ["waist"],
    title: "這 7 天，三項一起顧",
    action: "腰圍會跟著整體生活習慣走，熱量、運動、喝水三項一起做最有效。",
    measure: "metDays",
    target: 5,
  },
];

/** What to work on when there is no report yet, or nothing is out of range. */
export const BASELINE_FOCUS = {
  id: "baseline",
  title: "這 7 天，先把三項基本功顧好",
  action: `熱量低於 ${CALORIE_CEILING} 大卡、運動 ${EXERCISE_GOAL_MIN} 分鐘、喝水 ${WATER_GOAL_ML}cc，三項都做到才算一天。`,
  measure: "metDays",
  target: 5,
  why: "還沒有健檢報告，或報告上的數值都在參考範圍內。",
};

/** At most this many focuses at once. Three is a plan; seven is a wish list. */
export const MAX_FOCUSES = 3;

function describeFinding(f) {
  const marker = labMarker(f.key);
  const decimals = marker ? marker.decimals : 0;
  return `${f.label} ${Number(f.value).toFixed(decimals)} ${f.unit}（${f.zone.label}）`;
}

/**
 * One card for everything that belongs to a clinician.
 *
 * Built from two sources: markers marked `referral` in lib/health.js, and any
 * yes/no item that came back 陽性. It carries no measure, because there is
 * nothing here for the app to score — and no dietary or dosing advice, which
 * is the point.
 */
export function referralFocus({ findings = [], positives = [] } = {}) {
  const items = [];

  for (const f of findings) {
    const marker = labMarker(f.key);
    if (!marker || !marker.referral) continue;
    items.push({
      key: f.key,
      label: f.label,
      detail: describeFinding(f),
      note: REFERRAL_NOTES[marker.group] || REFERRAL_NOTES.other,
    });
  }

  for (const flag of positives) {
    items.push({ key: flag.key, label: flag.label, detail: `${flag.label}：陽性`, note: flag.note });
  }

  if (!items.length) return null;

  return {
    id: "refer",
    refer: true,
    items,
    title: "這幾項請帶報告去問醫師",
    action: "這些是需要醫師判讀的項目，不是靠飲食或運動處理的。把報告帶到門診，讓醫師決定要不要進一步檢查。",
    why: items.map((i) => i.detail).join("、"),
  };
}

/**
 * Turn a report into what to do this week.
 *
 * Two layers, and the order matters. Anything a clinician has to look at comes
 * first, in a single card — with forty markers on a report, a card per finding
 * would bury the two or three things she can act on herself. Then up to two
 * lifestyle focuses, each named with its own number and the range it sits in
 * so the reason is checkable.
 *
 * **Nothing out of range is ever silently dropped.** Before this had a
 * catch-all, a marker that no rule mentioned — 血色素, 甲狀腺, 骨密度 — showed
 * in the table and produced no guidance at all, which reads as "the app looked
 * at it and had nothing to say".
 */
export function weeklyFocuses({ values = null, flags = null, gender = "female" } = {}) {
  const findings = values ? outOfRangeMarkers(values, gender) : [];
  const positives = positiveFlags(flags);
  const refer = referralFocus({ findings, positives });

  const lifestyle = [];
  const used = new Set();
  const room = MAX_FOCUSES - (refer ? 1 : 0);

  for (const rule of FOCUS_RULES) {
    if (lifestyle.length >= room) break;
    if (used.has(rule.id)) continue;
    const hits = findings.filter((f) => rule.markers.includes(f.key));
    if (!hits.length) continue;

    used.add(rule.id);
    lifestyle.push({ ...rule, why: hits.map(describeFinding).join("、"), findings: hits });
  }

  const out = refer ? [refer, ...lifestyle] : lifestyle;
  /* Nothing to report is not an empty screen: the three daily basics are
     always something to be getting on with. */
  return out.length ? out : [BASELINE_FOCUS];
}

/**
 * The plan for the current seven-day cycle, with how it is going so far.
 *
 * Progress is scored over the cycle to date, not the whole seven days, so a
 * target of five days does not read as failed on day two.
 */
export function weeklyPlan({
  report = null,
  profile = null,
  summaries = [],
  foodLog = [],
  exerciseLog = [],
  waterLog = [],
  today = todayStr(),
}) {
  const gender = profile && profile.gender === "male" ? "male" : "female";
  const anchor = report && report.date ? report.date : addDays(today, -(CYCLE_DAYS - 1));
  const cycle = cycleFor(anchor, today);
  const soFar = measureWindow({
    start: cycle.start,
    end: today < cycle.end ? today : cycle.end,
    summaries,
    foodLog,
    exerciseLog,
    waterLog,
  });

  const focuses = weeklyFocuses({
    values: report ? report.values : null,
    flags: report ? report.flags : null,
    gender,
  }).map((focus) => ({
    ...focus,
    progress: scoreFocus(focus, soFar),
  }));

  return { cycle, anchor, focuses, measured: soFar, hasReport: Boolean(report) };
}

/* ---------------------------------------------------------- weekly plan -- */

/**
 * The Monday of the week a date falls in.
 *
 * The exercise template is written 週一 to 週日, so lining it up with real
 * dates means starting the week on Monday — not on "seven days ago", which
 * would put 週一 on a different row every day.
 */
export function weekStart(today = todayStr()) {
  const d = new Date(`${today}T00:00:00`);
  return addDays(today, -((d.getDay() + 6) % 7));
}

/**
 * Line the weekly exercise template up against what was actually logged.
 *
 * `done` means the kind of thing planned for that day was done. A day where
 * something else was done instead is reported separately as `movedAnyway`
 * rather than as a miss: 40 minutes of cycling on a day the template said
 * stretching is not a failure, and drawing it as an empty circle would be
 * both wrong and discouraging.
 *
 * Days still ahead are neither done nor missed — `isPast` is what the screen
 * uses to tell "not yet" from "didn't".
 */
export function weeklyPlanProgress({ weeklyTemplate = [], exerciseLog = [], today = todayStr() }) {
  const start = weekStart(today);

  return weeklyTemplate.map((row, index) => {
    const date = addDays(start, index);
    const entries = (exerciseLog || []).filter((e) => e.date === date);
    const minutes = entries.reduce((sum, e) => sum + (Number(e[FIELDS.exercise]) || 0), 0);
    const categoryMinutes = entries
      .filter((e) => categoryOf(e) === row.category)
      .reduce((sum, e) => sum + (Number(e[FIELDS.exercise]) || 0), 0);

    return {
      ...row,
      date,
      isToday: date === today,
      isPast: date < today,
      minutes,
      categoryMinutes,
      done: categoryMinutes > 0,
      movedAnyway: categoryMinutes === 0 && minutes > 0,
    };
  });
}

/** How the whole planned week is going, for the header line. */
export function weeklyPlanSummary(progress) {
  const done = progress.filter((d) => d.done).length;
  const moved = progress.filter((d) => d.movedAnyway).length;
  const minutes = progress.reduce((sum, d) => sum + d.minutes, 0);
  return { done, moved, minutes, total: progress.length };
}

/* -------------------------------------------------------------- monthly -- */

function changeBetween(records, month, field) {
  const inMonth = (records || [])
    .filter((r) => monthOf(r.date) === month && Number.isFinite(Number(r[field])))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  if (inMonth.length < 2) return null;
  const first = Number(inMonth[0][field]);
  const last = Number(inMonth[inMonth.length - 1][field]);
  return { first, last, delta: Math.round((last - first) * 10) / 10, from: inMonth[0].date, to: inMonth[inMonth.length - 1].date };
}

/**
 * The whole month, added up — shown on the last day of the month and kept
 * available afterwards.
 *
 * Nothing is stored: it is all recomputed from the daily summary and the logs,
 * so there is no second copy of the month that can drift from the first. The
 * catch is that the water and exercise logs are trimmed at 60 and 90 days, so
 * for an older month the summary survives and the detail does not — which is
 * reported as "紀錄已超過保留期" rather than as a month of zeros.
 */
export function monthlyAnalysis({
  month,
  summaries = [],
  foodLog = [],
  exerciseLog = [],
  waterLog = [],
  records = [],
  report = null,
  profile = null,
  today = todayStr(),
}) {
  const bounds = monthBounds(month);
  const end = bounds.end > today ? today : bounds.end;
  const measured = measureWindow({ start: bounds.start, end, summaries, foodLog, exerciseLog, waterLog });
  const elapsedDays = daysBetween(bounds.start, end) + 1;

  const weight = changeBetween(records, month, "weight");
  const waist = changeBetween(records, month, "waist");

  const wins = [];
  const watch = [];

  /* Something done right always comes first — the same rule the daily coach
     follows. On a month with nothing recorded, opening the app is the thing
     that was done right. */
  if (measured.metDays > 0) {
    wins.push(`這個月有 ${measured.metDays} 天三項全達標。`);
  } else if (measured.daysWithSummary > 0) {
    wins.push(`這個月有 ${measured.daysWithSummary} 天有記錄，記錄本身就是在顧自己。`);
  } else {
    wins.push("這個月還沒有紀錄，從今天記一筆就開始了。");
  }

  if (measured.exerciseMinutes > 0) {
    const perWeek = Math.round((measured.exerciseMinutes / elapsedDays) * 7);
    wins.push(`運動累計 ${measured.exerciseMinutes} 分鐘，平均一週 ${perWeek} 分鐘。`);
  }
  if (weight && weight.delta < 0) wins.push(`體重從 ${weight.first} 降到 ${weight.last} kg。`);
  if (waist && waist.delta < 0) wins.push(`腰圍從 ${waist.first} 減到 ${waist.last} cm。`);

  if (measured.daysWithSummary < elapsedDays) {
    watch.push(`有 ${elapsedDays - measured.daysWithSummary} 天沒有記錄，補起來下個月的數字會更準。`);
  }
  if (measured.avgCalories != null && measured.avgCalories >= CALORIE_CEILING) {
    watch.push(`有記錄的日子平均 ${measured.avgCalories} 大卡，比 ${CALORIE_CEILING} 高。`);
  }
  if (measured.exerciseDays < Math.round(elapsedDays * 0.5)) {
    watch.push(`運動達標 ${measured.exerciseDays} 天，還不到這個月的一半。`);
  }
  if (measured.waterDays < Math.round(elapsedDays * 0.5)) {
    watch.push(`喝水達標 ${measured.waterDays} 天，這一項通常最容易補起來。`);
  }
  if (measured.redMeals > 0) {
    watch.push(`紅燈飲食 ${measured.redMeals} 次。`);
  }

  const stale = measured.mealCount === 0 && measured.daysWithSummary > 0;

  return {
    month,
    bounds,
    elapsedDays,
    measured,
    weight,
    waist,
    wins,
    watch: watch.slice(0, 3),
    /* Detail logs are trimmed; the summary is not. Say which of the two this
       month still has, rather than presenting missing detail as zeroes. */
    detailExpired: stale,
    reportUsed: report ? report.date : null,
  };
}

/** Months that have any record at all, newest first — what the picker offers. */
export function monthsWithData({ summaries = [], foodLog = [], records = [] }) {
  const months = new Set();
  for (const list of [summaries, foodLog, records]) {
    for (const row of list || []) if (row && row.date) months.add(monthOf(row.date));
  }
  return [...months].filter(Boolean).sort().reverse();
}
