/**
 * 送去辨識之前，先把照片縮小。
 *
 * 使用者回報「拍照讀取失敗，大概八成」。原因不在模型，在我們送出去的東西：
 * 整張原始照片被 base64 編碼之後直接丟進請求裡。iPhone 一張 12MP 的照片是
 * 3-5MB，base64 之後會再膨脹約 33%，變成 4-7MB —— 而
 *
 *   - **Anthropic 單張圖片的上限就是 5MB**（base64 後），超過直接被拒；
 *   - Gemini 雖然寬一點，但在 4G 上傳 7MB 常常就是逾時；一餐五張就是 35MB；
 *   - iPhone 相簿有時候給的是 **HEIC**，兩家都不吃。
 *
 * 三個原因都指向同一個動作：**先用 canvas 重畫成小張的 JPEG**。重畫之後
 * 體積大約剩下二十分之一，格式一律變成 JPEG（HEIC 的問題跟著消失），
 * 上傳時間從幾十秒變成一兩秒。
 *
 * 解析度要留多少，取決於模型要在照片上讀什麼：
 *
 *   - **食物**只要認得出盤子上是什麼，1280px 綽綽有餘。
 *   - **健檢報告和體重計**是要**讀上面印的數字**，糊掉就整份報廢，所以留到
 *     2000px、品質也拉高。一張 2000px 的 JPEG 大約 300-500KB，離上限還很遠。
 *
 * 這個檔案只放「算得出來、測得到」的部分；真正動到 canvas 的程式在 App.jsx，
 * 因為那需要瀏覽器。
 */

/** 認出盤子上是什麼，這個尺寸就夠了。 */
export const VISION_MAX_DIM = 1280;

/** 報告與體重計要讀印出來的數字，糊掉等於整張作廢。 */
export const REPORT_MAX_DIM = 2000;

/**
 * 存進日記的縮圖。
 *
 * 日記裡它只被畫成 44×44（`.food-log-thumb`），就算是三倍螢幕也才 132px —— 原本
 * 存 640px 是實際需要的五倍。而它跟所有健康紀錄共用 localStorage 的那幾 MB：
 * 實測 640px/q0.55 一張約 36KB，一天三餐、放三十天就是 3.2MB，Safari 差不多
 * 就在這裡爆掉，然後每一次「加入紀錄」都失敗。400px 一張約 15KB。
 */
export const THUMB_MAX_DIM = 400;

/**
 * 保守的上限。
 *
 * Anthropic 的單張圖片上限是 5MB（base64 之後），Gemini 寬一些。抓 3.5MB 是
 * 為了留餘裕給 prompt 和其他欄位 —— 卡在上限邊緣失敗的請求，錯誤訊息通常
 * 看不出是大小問題。
 */
export const MAX_UPLOAD_BYTES = 3.5 * 1024 * 1024;

/**
 * 縮到框得下的尺寸，比例不變；本來就比較小的不放大。
 *
 * 放大沒有意義：畫面上多出來的像素是內插出來的，模型不會因此多看到什麼，
 * 檔案卻變大。
 */
export function fitWithin(width, height, maxDim) {
  const w = Number(width);
  const h = Number(height);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;
  const longest = Math.max(w, h);
  if (!Number.isFinite(maxDim) || maxDim <= 0 || longest <= maxDim) {
    return { width: Math.round(w), height: Math.round(h) };
  }
  const scale = maxDim / longest;
  return {
    /* 至少 1px：極端細長的圖四捨五入之後會變成 0，而 0 寬的 canvas 會丟例外。 */
    width: Math.max(1, Math.round(w * scale)),
    height: Math.max(1, Math.round(h * scale)),
  };
}

/** base64 字串實際代表多少位元組（每 4 個字元 3 個位元組，扣掉補的 =）。 */
export function base64Bytes(base64) {
  const len = typeof base64 === "string" ? base64.length : 0;
  if (!len) return 0;
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.floor((len * 3) / 4) - padding;
}

/**
 * 這張圖送得出去嗎？送不出去的時候，要說得出是為什麼。
 *
 * 原本失敗只會顯示「辨識服務暫時無法使用」，那句話對「照片太大」完全沒有幫助
 * —— 她會一直重拍同一張一樣大的照片。
 */
export function tooBigMessage(base64, label = "照片") {
  const bytes = base64Bytes(base64);
  if (bytes <= MAX_UPLOAD_BYTES) return null;
  const mb = (bytes / (1024 * 1024)).toFixed(1);
  return `這張${label}縮小之後還有 ${mb}MB，超過可以送出的大小。請改拍解析度低一點的照片，或改用手動輸入。`;
}
