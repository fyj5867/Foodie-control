/**
 * The daily line and the end-of-day summary.
 *
 * The daily line is a 真乘心語 saying from the user's own document (see
 * lib/quotes.js) — her words, passed through untouched. The summary is copy
 * the app writes, and the rules below govern that:
 *
 * - Talk about behaviour, never about worth. "喝水差 550cc" is a fact;
 *   "你不夠努力" is a judgement, and this app has no business making it.
 * - Never make a medical claim. Nothing here may imply a health outcome from
 *   a day's numbers.
 * - Always name something that went right before naming what is short. On the
 *   days when nothing was met, the thing that went right is opening the app.
 *
 * There is no push notification anywhere in this app — no backend to send one.
 * Both appear when the app is opened: the daily line during the day, the
 * summary from the evening on.
 */

import { WATER_GOAL_ML, EXERCISE_GOAL_MIN } from "./goals.js";
import { quoteForDate } from "./quotes.js";

/**
 * Before this hour the line is greeted as 早安; after it, the same line stays
 * but under a neutral title. From EVENING_FROM the summary takes over.
 */
export const MORNING_UNTIL = 11;
export const EVENING_FROM = 19;

/**
 * The daily line: one 真乘心語 saying, from the user's own document.
 *
 * These are her words, so nothing here rewrites, trims or re-punctuates them,
 * and the tone rules further down do not apply to them — those exist to
 * police copy the app writes itself. See lib/quotes.js.
 *
 * @param dateStr today, as YYYY-MM-DD
 * @param nickname what to call the person, may be empty
 * @param hour    used only to decide whether to greet
 */
export function dailyMessage({ dateStr, nickname = "", hour = null }) {
  const morning = hour == null || hour < MORNING_UNTIL;
  const greeting = morning ? (nickname ? `早安，${nickname}` : "早安") : "";
  return { title: "真乘心語", greeting, body: quoteForDate(dateStr) };
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
  // Name the two ways out, since age is optional and either one works.
  if (!day.calorieTarget) return "熱量目標還算不出來 —— 填年齡，或在體態紀錄填基礎代謝率";
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
 * Which message belongs on screen right now.
 *
 * There is always one: the daily line until the evening, then the summary.
 * An earlier version showed nothing between late morning and 7pm, which is
 * most of the waking day — so the daily line was effectively invisible.
 */
export function coachSlot(now = new Date()) {
  return now.getHours() >= EVENING_FROM ? "evening" : "morning";
}
