/**
 * 睡眠時數 —— 小時與分鐘。
 *
 * 原本只有一個「小時」欄位，`step="0.5"`，提示寫「例：7.5」。問題是睡眠本來就
 * 不是以半小時為單位發生的：七點十五分醒來就是 7:15，而那個欄位只有兩條路
 * ——湊成 7.5（多記了 15 分鐘），或者自己在心裡把 15 分鐘換算成 0.25。
 * 兩條都不對，而第二條還要求她每天早上做一次除法。
 *
 * 所以輸入改成兩格（小時／分鐘），**但存起來的還是同一個 `sleepHours` 小數**。
 * 這件事是刻意的：`body-records` 裡已經有的每一筆都是這個格式，睡眠趨勢圖也是
 * 拿這個數字畫的。換成「時、分兩個欄位」會讓既有的紀錄變成讀不到的孤兒，而
 * 使用者要的只是「填的時候不要被半小時綁住」，不是換一套資料格式。
 *
 * 於是這個檔案就是那層翻譯，而且只有這裡有：
 *   `joinSleep` 兩格 → 小數（存檔用）
 *   `splitSleep` 小數 → 兩格（載入既有紀錄來改的時候）
 *   `formatSleep` 小數 → 「7 小時 15 分」（畫面上給人看的）
 *
 * 分鐘是**整分鐘**進出的：7:20 是 7.3333…，四捨五入到一位小數會變成 7.3，
 * 也就是 7:18 —— 存回去再讀出來就跟她填的不一樣了。所以來回都以「總分鐘數」
 * 為準，這樣任何一個整分鐘的值都能原封不動地繞一圈回來。
 */

/** 一天就是 24 小時，睡眠時數不會超過它。 */
export const SLEEP_MAX_HOURS = 24;

const MIN_PER_HOUR = 60;

/** `Number("")` 和 `Number(null)` 都是 0，而 0 分鐘是一個合理的值 ——
 * 「沒填」必須跟「填了 0」分得出來。 */
function num(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** 小數的小時 → 整分鐘數。浮點數的雜訊（7.333333…）在這裡收乾淨。 */
export function toMinutes(hours) {
  const n = num(hours);
  return n == null ? null : Math.round(n * MIN_PER_HOUR);
}

/**
 * 兩格 → 存檔用的小數小時；兩格都空白時回傳 null（＝這天沒記睡眠）。
 *
 * 分鐘那格是**照總分鐘數加起來**，不是先檢查有沒有超過 59。
 * 「7 小時 90 分」在算術上就是 8.5 小時，而那大概也真的是她的意思；
 * 偷偷把它改成 59 分或是整筆擋掉，兩種都比直接加起來更難理解。
 * 存回去之後畫面會顯示正規化過的「8 小時 30 分」，她看得到發生了什麼事。
 */
export function joinSleep(hoursBox, minutesBox) {
  const h = num(hoursBox);
  const m = num(minutesBox);
  if (h == null && m == null) return null;
  const total = (h || 0) * MIN_PER_HOUR + (m || 0);
  if (!Number.isFinite(total) || total < 0) return null;
  return total / MIN_PER_HOUR;
}

/**
 * 存檔用的小數小時 → 兩格的字串。
 *
 * 沒有值的時候兩格都是空字串，不是 "0" —— 一個預先填好 0 的欄位看起來像
 * 「今天睡 0 小時」，而且她得先把它刪掉才能打字。
 */
export function splitSleep(hours) {
  const total = toMinutes(hours);
  if (total == null || total < 0) return { h: "", m: "" };
  return {
    h: String(Math.floor(total / MIN_PER_HOUR)),
    m: String(total % MIN_PER_HOUR),
  };
}

/**
 * 給人看的寫法：「7 小時 15 分」。
 *
 * 剛好整點時不寫「0 分」（「7 小時」就夠了），不到一小時時不寫「0 小時」
 * （小睡 45 分鐘就寫「45 分」）。
 */
export function formatSleep(hours) {
  const total = toMinutes(hours);
  if (total == null || total < 0) return "";
  const h = Math.floor(total / MIN_PER_HOUR);
  const m = total % MIN_PER_HOUR;
  if (h && m) return `${h} 小時 ${m} 分`;
  if (h) return `${h} 小時`;
  return `${m} 分`;
}
