/**
 * Sending a photo to an AI vision model, and the prompts we send with it.
 *
 * Two things use this: the food photo (a calorie estimate) and the health
 * check report (reading printed numbers off a page). They share everything
 * except the question asked — the same two providers, the same key handling,
 * the same "the model wrapped its JSON in a code fence again" cleanup, the
 * same mapping from HTTP status to something a person can act on. Only the
 * prompt differs, so only the prompt is passed in.
 *
 * The key is the user's own, entered on their device and stored there. It
 * leaves only in the request to the provider's own API; nothing is proxied
 * through anywhere else, because there is nowhere else — this app has no
 * server of its own.
 */

/** Free tier via Google AI Studio; the paid one is Anthropic's. */
const GEMINI_DEFAULT_MODEL = "gemini-3.6-flash";
const ANTHROPIC_MODEL = "claude-sonnet-4-6";

function missingKeyError(provider) {
  return new Error(
    provider === "gemini"
      ? "尚未設定 Google Gemini API Key，請先到「個人資料」頁下方的設定輸入金鑰。"
      : "尚未設定 Anthropic API Key，請先到「個人資料」頁下方的設定輸入金鑰。"
  );
}

/**
 * Pull the JSON object out of a model's reply.
 *
 * Models fence their JSON in ```json blocks often enough that stripping the
 * fence is not optional, and they sometimes add a sentence before it. Taking
 * the outermost braces is what makes the difference between "sorry, failed"
 * and a working read for a reply that was fine apart from its packaging.
 */
export function parseJsonReply(text) {
  if (typeof text !== "string" || !text.trim()) throw new Error("未取得辨識結果");
  const cleaned = text.replace(/```json|```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new Error("辨識結果格式不正確，請再試一次。");
  }
}

/**
 * Ask a vision model about an image and return the parsed JSON reply.
 *
 * @param prompt      what to ask — the only thing that differs between uses
 * @param base64Data  the image, base64 without the data: prefix
 * @param maxTokens   a report page holds far more numbers than a lunch does
 */
export async function askAboutImage({
  prompt,
  base64Data,
  mediaType,
  provider,
  apiKey,
  geminiModel,
  maxTokens = 1000,
}) {
  if (!apiKey) throw missingKeyError(provider);

  if (provider === "gemini") {
    const model = geminiModel && geminiModel.trim() ? geminiModel.trim() : GEMINI_DEFAULT_MODEL;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model
    )}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mediaType, data: base64Data } }] }],
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
    return parseJsonReply(textPart.text);
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: maxTokens,
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
  return parseJsonReply(textBlock.text);
}

export const FOOD_PROMPT = `請你以營養師角度分析這張食物照片，並「只」回傳純 JSON（不要任何前後文字、不要 markdown 符號），格式如下：
{"foodName": "食物名稱（繁體中文，多項用、分隔）", "estimatedCalories": 數字, "carbsG": 數字, "proteinG": 數字, "fatG": 數字, "portionNote": "份量估計簡短說明", "light": "green或yellow或red", "reason": "20字以內的燈號原因", "confidence": "low或medium或high", "sourceType": "label或estimate"}

重要：如果照片中拍到包裝食品的「營養標示」欄位（例如熱量、每份含量等印刷文字），請優先
「讀取」標示上實際印的數字作為 estimatedCalories 等數值，不要用外觀去估算份量；並將
sourceType 填 "label"，confidence 填 "high"，portionNote 註明是讀取自包裝標示。如果
標示上是「每100克」或「每份」而非整包的量，請依包裝上標示的總重量或總份數換算成整包
（或照片中呈現的實際份量）的總熱量。
如果沒有看到營養標示、只能靠外觀估算份量與熱量，sourceType 請填 "estimate"，並依實際
把握程度誠實填寫 confidence（份量或食材較難判斷時，請填 low 或 medium，不要為了看起來
準確而灌水成 high）。

燈號判斷原則（第二型糖尿病預防飲食）：
- green：原型食物、高纖蔬菜、全穀雜糧、瘦肉蛋白、烹調清淡（清蒸水煮烤）
- yellow：白飯白麵等精緻澱粉適量、水果、全脂乳品，份量需留意
- red：油炸、含糖飲料或甜點、加工肉品、高油勾芡，建議避免或大幅減量

若照片中有多種食物，estimatedCalories 等數值請加總為整餐估計。若無法辨識出食物，foodName 請填"無法辨識"，estimatedCalories 填 0，confidence 填 low。`;

/**
 * The report prompt asks the model to TRANSCRIBE, not to interpret.
 *
 * Judging what a value means is done in lib/health.js against published
 * reference ranges, and the wording of any advice is checked by tests. A
 * model asked to comment on a person's blood work will produce something that
 * sounds like a diagnosis, and that is the one thing this app must not do.
 * So the model's job here is strictly optical: read the printed numbers.
 *
 * It is also told to leave out what it cannot read rather than guess. A
 * plausible-looking invented lab value is far worse than a missing one — the
 * missing one gets typed in by hand, the invented one gets believed.
 */
export const LAB_PROMPT = `這是一張健康檢查報告的照片。請你「只做一件事」：把報告上印出來的檢驗數值抄下來。
不要解讀、不要診斷、不要給任何建議或評語，只要抄數字。

請「只」回傳純 JSON（不要任何前後文字、不要 markdown 符號），格式如下：
{"reportDate": "YYYY-MM-DD 或 null", "labName": "檢驗單位名稱或 null", "values": {"欄位代號": 數字}, "unreadable": ["看不清楚的項目名稱"], "confidence": "low或medium或high"}

values 只能使用下列欄位代號，報告上沒有的項目就不要放進去：
- fastingGlucose：空腹血糖 / 飯前血糖 / AC Sugar / Glucose(AC)，單位 mg/dL
- hba1c：糖化血色素 / HbA1c，單位 %
- totalCholesterol：總膽固醇 / T-CHO，單位 mg/dL
- triglycerides：三酸甘油酯 / TG，單位 mg/dL
- hdl：高密度脂蛋白 / HDL-C，單位 mg/dL
- ldl：低密度脂蛋白 / LDL-C，單位 mg/dL
- systolic：收縮壓，單位 mmHg
- diastolic：舒張壓，單位 mmHg
- uricAcid：尿酸 / UA，單位 mg/dL
- alt：GPT / ALT，單位 U/L
- ast：GOT / AST，單位 U/L
- creatinine：肌酸酐 / Cr，單位 mg/dL
- egfr：腎絲球過濾率 / eGFR
- waist：腰圍，單位 cm
- weight：體重，單位 kg

規則：
1. 只抄「這個人的檢驗結果」那一欄的數字，不要抄成旁邊的「參考值／正常範圍」那一欄。
2. 數字看不清楚、被遮住、或你不確定是哪一項，就不要放進 values，改把項目名稱放進 unreadable 陣列。**寧可漏掉也不要猜**，猜錯的數字比缺漏的數字危險得多。
3. 單位如果和上面列的不同（例如血糖用 mmol/L），請換算成上面指定的單位再填。
4. 如果整張照片都看不出是健康檢查報告，values 請回傳空物件 {}，confidence 填 low。`;
