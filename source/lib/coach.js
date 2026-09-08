/**
 * The morning line and the end-of-day summary.
 *
 * Both are written to be read on a bad day as well as a good one, so a few
 * rules hold throughout:
 *
 * - Talk about behaviour, never about worth. "喝水差 550cc" is a fact;
 *   "你不夠努力" is a judgement, and this app has no business making it.
 * - Never make a medical claim. Nothing here may imply a health outcome from
 *   a day's numbers.
 * - Always name something that went right before naming what is short. On the
 *   days when nothing was met, the thing that went right is opening the app.
 *
 * There is no push notification anywhere in this app — no backend to send one.
 * These appear when the app is opened in the morning or the evening.
 */

import { WATER_GOAL_ML, EXERCISE_GOAL_MIN } from "./goals.js";

/** Before this hour, the morning line. From EVENING_FROM, the summary. */
export const MORNING_UNTIL = 11;
export const EVENING_FROM = 19;

/**
 * Morning lines. Deliberately small, concrete asks rather than cheerleading —
 * "先喝一杯水" is something you can do in ten seconds, and doing one thing is
 * what makes the rest of the day more likely.
 */
const MORNING_LINES = [
  "今天不用做到完美，做到就好。",
  "先喝一杯水吧，這是三項裡最容易先完成的。",
  "不用一次到位，先動十分鐘也算開始。",
  "昨天的份已經記在花園裡了，今天照著做就行。",
  "今天先顧好一項，其他的順著走。",
  "身體記得你做過的每一次，不會白費。",
  "今天的目標只有今天，不用想整個月。",
  "慢一點也是往前，別急。",
  "先吃好早餐，其他的今天再說。",
  "做不到全部沒關係，做到一項就是一項。",
];

/** Lines for a morning that follows a run of met days — earned, not generic. */
const MORNING_LINES_ON_STREAK = [
  "連續 {n} 天了，今天照舊就好。",
  "已經連續 {n} 天，這個節奏很適合你。",
  "第 {n} 天了。不用加碼，維持就是進步。",
];

/**
 * Pick a line by date so it changes daily but stays the same all morning —
 * a message that reshuffles every time the app opens reads as noise.
 */
function pickByDate(list, dateStr, offset = 0) {
  let hash = offset;
  for (let i = 0; i < dateStr.length; i++) hash = (hash * 31 + dateStr.charCodeAt(i)) % 100000;
  return list[hash % list.length];
}

/**
 * @param dateStr today, as YYYY-MM-DD
 * @param streak  current run of met days
 * @param nickname what to call the person, may be empty
 */
export function morningMessage({ dateStr, streak = 0, nickname = "" }) {
  const who = nickname ? `${nickname}，` : "";
  if (streak >= 3) {
    const line = pickByDate(MORNING_LINES_ON_STREAK, dateStr).replace("{n}", String(streak));
    return { title: "早安", body: `${who}${line}` };
  }
  return { title: "早安", body: `${who}${pickByDate(MORNING_LINES, dateStr)}` };
}

/** One concrete, small thing that would close this gap. */
function nudgeFor(key, day) {
  if (key === "water") {
    const short = Math.max(0, WATER_GOAL_ML - Math.round(day.waterMl || 0));
    return `喝水差 ${short.toLocaleString()} cc —— 睡前一杯就補得回來`;
  }
  if (key === "exercise") {
    const short = Math.max(0, EXERCISE_GOAL_MIN - Math.round(day.exerciseMin || 0));
    const done = Math.round(day.exerciseMin || 0);
    if (done === 0) return `今天還沒有運動紀錄 —— 明天先排十分鐘`;
    return `運動差 ${short} 分鐘 —— 已經動了 ${done} 分鐘，差一點`;
  }
  if (!day.calorieTarget) return "熱量目標還算不出來 —— 個人資料補齊就會有";
  const over = Math.round((day.calories || 0) - day.calorieTarget);
  if (over > 0) return `熱量超過目標 ${over.toLocaleString()} 大卡 —— 明天晚餐少一點澱粉`;
  return "飲食還沒記錄完 —— 補記完才算得準";
}

/** What went right, phrased as a fact rather than praise. */
function winFor(key, day) {
  if (key === "water") return `喝水 ${Math.round(day.waterMl || 0).toLocaleString()} cc，達標`;
  if (key === "exercise") {
    const done = Math.round(day.exerciseMin || 0);
    return done > EXERCISE_GOAL_MIN ? `運動 ${done} 分鐘，超過目標` : `運動 ${done} 分鐘，達標`;
  }
  return `熱量 ${Math.round(day.calories || 0).toLocaleString()} 大卡，控制在目標內`;
}

/**
 * The end-of-day summary: what to keep, what to watch.
 *
 * @param day       today's evaluation from evaluateDay
 * @param garden    the rolled-up garden state
 * @param nickname  what to call the person, may be empty
 */
export function eveningSummary({ day, garden, nickname = "" }) {
  const who = nickname || "今天";
  const met = day?.metCount || 0;

  const order = ["water", "exercise", "calorie"];
  const wins = [];
  const watch = [];

  for (const key of order) {
    if (day && day[key]) wins.push(winFor(key, day));
    else watch.push(nudgeFor(key, day || {}));
  }

  // Progress is worth stating even on a day nothing was met — it is the part
  // that does not go backwards.
  if (met === 3) {
    if (garden?.currentStreak > 1) wins.push(`連續達標第 ${garden.currentStreak} 天`);
    if (garden?.currentDays === 0 && garden?.completedTrees > 0) {
      wins.push(`第 ${garden.completedTrees} 棵完成了，種進花園`);
    } else if (garden?.daysToNextStage === 0 && garden?.stage) {
      wins.push(`長成${garden.stage.label}了`);
    }
  }

  let headline;
  if (met === 3) headline = `${who}三項全達標，這一天算數。`;
  else if (met === 0) headline = `${who}三項都還沒到 —— 有打開來看就是一件事。`;
  else headline = `${who}達成 ${met} 項。`;

  // Never leave the encouraging column empty.
  if (wins.length === 0) {
    wins.push(
      garden?.totalMetDays > 0
        ? `累計已經有 ${garden.totalMetDays} 個達標日，那些不會不見`
        : "來看一眼也是一種在意"
    );
  }

  return { title: "今天的總結", headline, wins, watch, met };
}

/**
 * Which message, if any, belongs on screen right now.
 *
 * Between late morning and evening there is nothing to say that the three
 * rows above do not already say better, so it shows nothing rather than
 * padding the screen.
 */
export function coachSlot(now = new Date()) {
  const hour = now.getHours();
  if (hour < MORNING_UNTIL) return "morning";
  if (hour >= EVENING_FROM) return "evening";
  return null;
}
