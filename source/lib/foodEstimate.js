/**
 * 把拍照辨識出來的那一餐，在顯示給她看之前先檢查一遍。
 *
 * 這個 App 裡每一個「模型從照片讀出來的數字」都要過合理範圍：健檢報告有
 * `LAB_MARKERS[].plausible`，體重計有 `BODY_FIELDS[].plausible`，理由寫在
 * CLAUDE.md —— 空腹血糖 1080 不是一個嚇人的發現，是一次誤讀。
 *
 * 只有食物的熱量一直沒有這一關。它直接 `Number(...) || 0` 就進日記，而日記的
 * 當日總和正好是決定花園今天長不長的那個數字。最常見的誤讀還特別安靜：包裝上
 * 印的是「每 100 公克 520 大卡」，整包 45 公克，模型抄了 520；或是反過來，
 * 「本包裝含 3 份」沒有乘回去。兩種都會得到一個看起來很正常的三位數。
 *
 * 但食物跟檢驗數值有一個關鍵差別，所以做法不一樣：
 * **檢驗值可以留空，一餐的熱量不行。** 一個被擋掉的血糖值就是「這項請自己
 * 輸入」，而一餐的熱量被擋掉只剩 0，那比一個可疑的數字更糟。所以這裡不擋，
 * 是**標出來**：數字照樣填好、照樣可以改，但旁邊會寫出哪裡看起來不對。
 *
 * 三道檢查，全部在本機算，不需要再問一次模型：
 *
 *   1. **熱量本身的範圍。** 負數和非數字直接歸零（那不是估算，是壞掉的回覆）；
 *      一餐超過 `MEAL_CALORIE_HIGH` 就提醒她確認是不是「每 100 克」的陷阱。
 *   2. **三大營養素要跟熱量對得起來。** 醣 4、蛋白質 4、脂肪 9 大卡/克是定義，
 *      不是估計值，所以兩邊差太多代表其中一個讀錯了 —— 而這是模型自己也
 *      察覺不到的那種錯，它會很有把握地給你兩個互相矛盾的數字。
 *   3. **各道菜加起來要等於總熱量。** 有了分項，她才看得出是哪一道被高估，
 *      而不是面對一個不知道怎麼改起的總數。
 *
 * 這裡的每一句提示都只講「這個估算可能哪裡不準」，不講任何健康或疾病的事 ——
 * 那些字一律在 `lib/nutritionTags.js`，規矩相同。
 */

/** 超過這個數字的一餐，幾乎一定是誤讀而不是大餐，直接歸零重來比較誠實。 */
export const MEAL_CALORIE_LIMIT = 5000;

/** 一餐到這裡就值得她自己看一眼包裝，不是錯，但錯的機會明顯變高。 */
export const MEAL_CALORIE_HIGH = 1800;

/** 單一營養素的上限；超過就是讀錯了欄位或掉了小數點。 */
export const MACRO_LIMITS = { carbsG: 500, proteinG: 400, fatG: 400 };

/** 醣 4、蛋白質 4、脂肪 9 —— 這是定義，不是估計值。 */
export const KCAL_PER_G = { carbsG: 4, proteinG: 4, fatG: 9 };

/** 差多少才算對不起來。三成是留給纖維、酒精、以及四捨五入的空間。 */
export const MACRO_TOLERANCE = 0.3;

/** 小餐的三成只有幾十大卡，為這個跳警告只是吵。 */
export const MACRO_MIN_GAP = 80;

/** 分項加總跟總熱量的容許差距（分項本來就是估的，給寬一點）。 */
export const ITEMS_TOLERANCE = 0.25;
export const ITEMS_MIN_GAP = 100;

/** 一餐最多列幾道菜。再多就不是清單，是一面牆。 */
export const MAX_ITEMS = 8;

/**
 * 容忍模型把數字寫成字串。
 *
 * 「320」「約 320 大卡」「320.5」都取得到 320；空值、null、看不出數字的
 * 一律回 null —— `Number(null)` 是 0，而 0 大卡是一個會被當真的答案。
 */
export function num(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const match = String(value).match(/-?\d+(\.\d+)?/);
  if (!match) return null;
  const n = Number(match[0]);
  return Number.isFinite(n) ? n : null;
}

function roundOrNull(value, max) {
  const n = num(value);
  if (n == null || n < 0) return null;
  if (max != null && n > max) return null;
  return Math.round(n);
}

/** 模型回的分項：只留有名字的，數字壞掉就留名字不留熱量。 */
function cleanItems(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const name = String(item.name == null ? "" : item.name).trim().slice(0, 30);
    if (!name) continue;
    out.push({ name, kcal: roundOrNull(item.kcal, MEAL_CALORIE_LIMIT) });
    if (out.length >= MAX_ITEMS) break;
  }
  return out;
}

/** 三大營養素換算回來的熱量；缺任何一項就不算（半套的比對會誤判）。 */
export function macroCalories(reading) {
  const c = num(reading && reading.carbsG);
  const p = num(reading && reading.proteinG);
  const f = num(reading && reading.fatG);
  if (c == null || p == null || f == null) return null;
  if (c < 0 || p < 0 || f < 0) return null;
  return Math.round(c * KCAL_PER_G.carbsG + p * KCAL_PER_G.proteinG + f * KCAL_PER_G.fatG);
}

/**
 * 這個估算是怎麼來的，用一句話講完。
 *
 * 「讀自包裝標示」和「看照片估的」是兩種完全不同可信度的數字，而原本畫面上
 * 兩者長得一模一樣。模型自己回報的 confidence 也一直沒有被顯示出來 ——
 * prompt 特地要求它誠實填，然後我們把它丟掉了。
 */
export function sourceNote(reading) {
  const level = reading && reading.confidence;
  /* 沒有數字的時候不要描述這個數字是怎麼來的。那一格會有自己的提示，
     再加一句「看照片估算的」只是在解釋一個不存在的東西。 */
  if (!reading || !num(reading.estimatedCalories)) return null;
  if (reading && reading.sourceType === "label") {
    return { tone: "good", text: "讀自包裝上的營養標示，通常這個數字最準。" };
  }
  if (level === "high") return { tone: "plain", text: "看照片估算的，食材和份量都算清楚。" };
  if (level === "low") return { tone: "warn", text: "看照片估算的，這次不太有把握，請當成大概的數字。" };
  return { tone: "plain", text: "看照片估算的，份量只能抓個大概。" };
}

/**
 * 檢查一份辨識結果，回傳整理過的數字和「哪裡看起來不對」。
 *
 * 不丟掉任何東西：所有警告都是給她看的提示，數字照樣填在可以改的欄位裡。
 */
export function normalizeFoodReading(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  const warnings = [];

  let calories = num(source.estimatedCalories);
  if (calories == null || calories < 0) {
    calories = 0;
    warnings.push({
      code: "no-calories",
      text: "這張照片沒有估出熱量，請直接在上面填入你知道的數字。",
    });
  } else {
    calories = Math.round(calories);
    if (calories > MEAL_CALORIE_LIMIT) {
      /* 這個量級不可能是一餐，留著它只會讓她以為今天完蛋了。 */
      warnings.push({
        code: "impossible",
        text: `估出 ${calories} 大卡，這對一餐來說不合理，已清成 0，請自己填。`,
      });
      calories = 0;
    } else if (calories > MEAL_CALORIE_HIGH) {
      warnings.push({
        code: "high",
        text: `${calories} 大卡對一餐偏高。如果是看包裝標示來的，請確認那是「整包」還是「每 100 公克」。`,
      });
    }
  }

  const macros = {};
  for (const key of Object.keys(MACRO_LIMITS)) {
    macros[key] = roundOrNull(source[key], MACRO_LIMITS[key]);
  }

  /* 醣 4／蛋白質 4／脂肪 9 是定義，所以兩邊差太多不是估得不準，是有一個讀錯。
     這種錯模型自己看不出來 —— 它會很有把握地給你兩個互相矛盾的數字。 */
  const fromMacros = macroCalories(macros);
  if (fromMacros != null && calories > 0) {
    const gap = Math.abs(fromMacros - calories);
    if (gap > MACRO_MIN_GAP && gap / calories > MACRO_TOLERANCE) {
      warnings.push({
        code: "macro-mismatch",
        text: `三大營養素換算起來是 ${fromMacros} 大卡，跟上面的 ${calories} 大卡對不太起來，其中一個可能看錯了。`,
      });
    }
  }

  const items = cleanItems(source.items);
  const itemsTotal = items.reduce((sum, it) => (it.kcal != null ? sum + it.kcal : sum), 0);
  const allItemsCounted = items.length > 0 && items.every((it) => it.kcal != null);
  if (allItemsCounted && calories > 0 && items.length > 1) {
    const gap = Math.abs(itemsTotal - calories);
    if (gap > ITEMS_MIN_GAP && gap / calories > ITEMS_TOLERANCE) {
      warnings.push({
        code: "items-mismatch",
        text: `各項加起來是 ${itemsTotal} 大卡，跟總計 ${calories} 大卡不一樣。`,
      });
    }
  }

  return {
    ...source,
    foodName: String(source.foodName == null ? "" : source.foodName).trim().slice(0, 60) || "未命名食物",
    estimatedCalories: calories,
    carbsG: macros.carbsG,
    proteinG: macros.proteinG,
    fatG: macros.fatG,
    items,
    light: ["green", "yellow", "red"].includes(source.light) ? source.light : "yellow",
    confidence: ["low", "medium", "high"].includes(source.confidence) ? source.confidence : "medium",
    sourceType: source.sourceType === "label" ? "label" : "estimate",
    warnings,
  };
}

/** 吃了幾份。整份、一半、一份半、兩份 —— 蓋掉大部分「跟照片不一樣多」的情況。 */
export const PORTIONS = [
  { key: "half", label: "吃一半", factor: 0.5 },
  { key: "full", label: "整份", factor: 1 },
  { key: "one-half", label: "1.5 份", factor: 1.5 },
  { key: "double", label: "兩份", factor: 2 },
];

/**
 * 依份量重算熱量與三大營養素。
 *
 * 倍數一律**乘在最初那份估算上**，不是乘在畫面上現在的數字上：按了「吃一半」
 * 再按一次「吃一半」應該還是一半，不是四分之一，而按「整份」要能完整回到原點。
 * 這個規則靠的是把未經縮放的那份留在 `basePortion` 裡，而不是靠呼叫端記得每次
 * 都傳原始值 —— 「呼叫端要記得」的規則遲早會有一個地方忘記，而且不會報錯，
 * 只會讓熱量悄悄縮水。
 *
 * `basePortion` 只活在畫面的狀態裡。寫進日記的那一筆是逐個欄位組出來的，
 * 不會把它帶進去。
 */
export function applyPortion(reading, factor) {
  const f = num(factor);
  if (!reading || f == null || f <= 0) return reading;
  const base = reading.basePortion || reading;
  const scale = (value) => (value == null ? null : Math.round(value * f));
  return {
    ...base,
    estimatedCalories: scale(base.estimatedCalories) ?? 0,
    carbsG: scale(base.carbsG),
    proteinG: scale(base.proteinG),
    fatG: scale(base.fatG),
    items: (base.items || []).map((it) => ({ ...it, kcal: scale(it.kcal) })),
    basePortion: base,
    portionFactor: f,
  };
}
