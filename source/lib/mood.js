/**
 * 今日心情 —— 一天一格，存在 `daily-mood`。
 *
 * 它出現在晚上十一點的總結裡，因為那是唯一一個她已經在回看這一天的時刻：
 * 早上問今天心情怎樣是在問一個還沒發生的問題。
 *
 * 四個選項就四個選項，**不做量表、不做分數、不拿去算任何東西**。這一點是刻意的：
 * 一旦心情變成 1-5 分，就會很想拿它跟熱量或睡眠做相關、然後寫出「你昨天心情不好
 * 可能是因為…」那種句子 —— 那是心理狀態的解讀，這個 App 沒有立場做，
 * 跟 `lib/nutritionTags.js` 不讓模型寫醫療句子是同一條界線。
 *
 * 所以程式對心情只做三件事：存起來、顯示出來、讓她改。沒有第四件。
 *
 * 選項的順序是低落 → 煩躁 → 平和 → 愉悅，照使用者給的順序，不重排、不加不減。
 */

/** 一天一筆、幾十個位元組，所以永久保留 —— 心情的價值幾乎完全在回看。 */
export const MAX_MOODS = 1200;

/**
 * 四個選項。
 *
 * `key` 是存進去的值（不會因為改文案就讓舊資料讀不到），`label` 是畫面上的字。
 */
export const MOODS = [
  { key: "low", label: "低落" },
  { key: "irritable", label: "煩躁" },
  { key: "calm", label: "平和" },
  { key: "glad", label: "愉悅" },
];

const BY_KEY = Object.fromEntries(MOODS.map((m) => [m.key, m]));

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** 認得的選項才算。存到一個沒有這個 key 的值，畫面上只會是一片空白。 */
export function isMoodKey(key) {
  return Boolean(key && BY_KEY[key]);
}

export function moodLabel(key) {
  return isMoodKey(key) ? BY_KEY[key].label : "";
}

/** 修好從 storage 或備份檔讀進來的東西。備份檔是她可以編輯的純文字。 */
export function normalizeMoods(rawList) {
  if (!Array.isArray(rawList)) return [];
  const byDate = new Map();
  for (const raw of rawList) {
    if (!raw || typeof raw !== "object") continue;
    const date = String(raw.date || "");
    if (!DATE_RE.test(date)) continue;
    if (!isMoodKey(raw.mood)) continue;
    /* 一天只有一筆。同一天出現兩次時後面的贏 —— 那是她後來改的。 */
    byDate.set(date, { date, mood: raw.mood });
  }
  const out = [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return out.slice(-MAX_MOODS);
}

/** 那一天記的心情，沒記就是 null。 */
export function moodFor(moods, date) {
  if (!DATE_RE.test(String(date || ""))) return null;
  const found = (moods || []).find((m) => m.date === date);
  return found ? found.mood : null;
}

/**
 * 記下（或改掉）某一天的心情。
 *
 * 再點同一個選項就是取消 —— 誤觸的時候要有路可以退，而「取消」跟「沒填」
 * 本來就是同一件事，不需要第五個選項來表示它。
 */
export function setMood(moods, date, mood) {
  if (!DATE_RE.test(String(date || ""))) return moods || [];
  const rest = (moods || []).filter((m) => m.date !== date);
  if (!isMoodKey(mood)) return normalizeMoods(rest);
  const current = moodFor(moods, date);
  if (current === mood) return normalizeMoods(rest);
  return normalizeMoods([...rest, { date, mood }]);
}
