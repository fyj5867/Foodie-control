/**
 * What a food does, and what it does to *this* person.
 *
 * The photo analysis already gives a calorie figure and a traffic light. What
 * it did not give is the thing a person actually wants to know: what is this
 * loading, and does it matter for me. That is what this file is for.
 *
 * **The model returns tags; the wording lives here.** This is the whole design
 * and it is not a detail. A vision model asked to write health commentary on a
 * plate of food will produce fluent sentences that sound like a diagnosis —
 * "this will raise your blood sugar and lead to diabetes" — and nothing in a
 * static app can stop it. So the model's job is narrowed to recognising
 * ingredients and cooking methods and returning a fixed vocabulary of tags.
 * Every sentence the person reads is written here, reviewed, and checked by
 * tools/test-nutrition.mjs.
 *
 * Three rules the wording obeys:
 *
 *   1. **Burden, not causation.** 「增加血壓的負擔」, never 「會造成高血壓」.
 *      One meal does not cause a disease, and saying it does is both false and
 *      the kind of false that makes someone stop trusting the app.
 *   2. **Risks are named as population associations, never as predictions
 *      about her.** 「長期攝取過多與心血管疾病風險有關」 is what the evidence
 *      supports; 「你會得心臟病」 is not.
 *   3. **A benefit is stated as plainly as a burden.** A screen that only ever
 *      names what is wrong with the food is a screen someone stops opening.
 *
 * The personal half comes from the latest health check report: a tag whose
 * markers are already out of range for her is surfaced first and named with
 * her own number, so 「少喝含糖飲料」 becomes 「你的三酸甘油酯 186 在邊緣偏高，
 * 這一項對糖分特別敏感」.
 */

import { outOfRangeMarkers, labMarker } from "./health.js";

/**
 * The vocabulary. `kind` is burden or benefit; `markers` are the report values
 * this tag bears on, which is what makes the personalised line possible.
 *
 * `risk` is optional and is only present where there is a well-established
 * population-level association worth naming. Where the evidence is weaker the
 * field is simply absent rather than hedged into meaninglessness.
 */
export const NUTRITION_TAGS = [
  /* ---------------------------------------------------------- burdens --- */
  {
    key: "sugary_drink",
    label: "含糖飲料",
    kind: "burden",
    markers: ["fastingGlucose", "hba1c", "postprandialGlucose", "triglycerides", "waist"],
    text: "液體的糖吸收最快，飯後血糖上升的幅度比同樣熱量的固體食物大，也是三酸甘油酯最常見的來源。",
    risk: "長期過量與第二型糖尿病、脂肪肝的風險有關。",
    swap: "換成無糖茶、無糖豆漿或水。",
  },
  {
    key: "refined_sugar",
    label: "精緻糖／甜點",
    kind: "burden",
    markers: ["fastingGlucose", "hba1c", "postprandialGlucose", "triglycerides", "waist"],
    text: "糖除了熱量以外幾乎不帶其他營養，容易在不覺得吃很多的情況下累積。",
    risk: "長期過量與第二型糖尿病、肥胖的風險有關。",
    swap: "想吃甜的時候先換成完整水果。",
  },
  {
    key: "refined_carb",
    label: "精緻澱粉",
    kind: "burden",
    markers: ["fastingGlucose", "hba1c", "postprandialGlucose", "triglycerides"],
    text: "白飯、白麵、白吐司的纖維被磨掉了，血糖上升得比全穀類快。",
    swap: "一半換成糙米、全麥或加點豆類就有差。",
  },
  {
    key: "saturated_fat",
    label: "飽和脂肪",
    kind: "burden",
    markers: ["ldl", "totalCholesterol", "nonHdl"],
    text: "肥肉、奶油、椰奶、全脂乳製品裡的飽和脂肪，是影響低密度脂蛋白（壞膽固醇）最主要的飲食因素。",
    risk: "長期過量與心血管疾病的風險有關。",
    swap: "換成瘦肉、豆製品、魚，烹調改用植物油。",
  },
  {
    key: "trans_fat",
    label: "反式脂肪",
    kind: "burden",
    markers: ["ldl", "hdl", "totalCholesterol", "nonHdl"],
    text: "酥皮、油炸粉漿、部分烘焙產品裡的反式脂肪，會同時推高壞膽固醇、壓低好膽固醇。",
    risk: "與心血管疾病的風險有關，是各國衛生單位都建議盡量避免的一類油脂。",
    swap: "酥皮、千層、油炸的外殼盡量少。",
  },
  {
    key: "fried",
    label: "油炸",
    kind: "burden",
    markers: ["ldl", "totalCholesterol", "hsCrp", "waist"],
    text: "油炸會讓同一份食材的熱量翻倍以上，高溫用油也和身體的發炎反應有關。",
    swap: "同樣的食材改成清蒸、水煮、氣炸或烤。",
  },
  {
    key: "high_sodium",
    label: "高鈉",
    kind: "burden",
    markers: ["systolic", "diastolic"],
    text: "鈉會讓身體留住水分，血管裡的容量變大，血壓就跟著上去。醃漬、加工、湯、沾醬是主要來源。",
    risk: "長期過量與高血壓、腎臟負擔加重有關。",
    swap: "湯少喝、醬少沾、加工品減量，這三件就能拿掉大半的鈉。",
  },
  {
    key: "processed_meat",
    label: "加工肉品",
    kind: "burden",
    markers: ["systolic", "diastolic", "hsCrp"],
    text: "香腸、培根、火腿、熱狗同時帶有高鈉和亞硝酸鹽類添加物。",
    risk: "世界衛生組織將加工肉品列為第一類致癌物，與大腸癌的風險有關。",
    swap: "換成原型的肉、蛋或豆製品。",
  },
  {
    key: "high_purine",
    label: "高嘌呤",
    kind: "burden",
    markers: ["uricAcid"],
    text: "內臟、帶殼海鮮、濃湯、乾香菇的嘌呤含量高，代謝後會變成尿酸。",
    risk: "與痛風發作的風險有關。",
    swap: "湯不要喝、量減半，並且把水喝足。",
  },
  {
    key: "alcohol",
    label: "酒精",
    kind: "burden",
    markers: ["triglycerides", "alt", "ast", "ggt", "uricAcid"],
    text: "酒精會直接增加肝臟的工作量，也會推高三酸甘油酯和尿酸。",
    risk: "長期過量與脂肪肝、肝臟疾病的風險有關。",
    swap: "沒有非喝不可的量，能少就少。",
  },
  {
    key: "organ_meat",
    label: "內臟／高膽固醇食材",
    kind: "burden",
    markers: ["ldl", "totalCholesterol", "uricAcid"],
    text: "內臟、魚卵、蟹黃的膽固醇與嘌呤都高。飲食膽固醇對血中膽固醇的影響因人而異，但這類食材通常也伴隨較多飽和脂肪。",
    swap: "當成偶爾的份量，不要當主菜。",
  },
  {
    key: "additive_phosphorus",
    label: "磷／鉀添加物",
    kind: "burden",
    markers: ["egfr", "creatinine", "bun", "potassium"],
    /* Framed as "tell your doctor", not as a target: how much phosphorus or
       potassium is too much depends on kidney function, and that is a clinical
       judgement this app does not make. */
    text: "加工食品、火鍋料、含磷酸鹽的飲料裡有額外添加的磷和鉀。腎功能數值異常的人需要留意，但該限制多少要由醫師決定。",
    swap: "以原型食物為主，加工品減量。",
  },
  {
    key: "large_portion",
    label: "份量偏大",
    kind: "burden",
    markers: ["waist", "triglycerides"],
    text: "食材本身沒問題，是份量把熱量帶上去了。",
    swap: "先減三分之一，或分成兩餐吃。",
  },

  /* --------------------------------------------------------- benefits --- */
  {
    key: "high_fiber",
    label: "高膳食纖維",
    kind: "benefit",
    markers: ["fastingGlucose", "hba1c", "postprandialGlucose", "ldl", "totalCholesterol"],
    text: "纖維會讓醣類吸收得慢一些，飯後血糖的曲線比較平；也能帶走一部分膽固醇。",
  },
  {
    key: "whole_grain",
    label: "全穀雜糧",
    kind: "benefit",
    markers: ["fastingGlucose", "hba1c", "postprandialGlucose", "ldl"],
    text: "保留麩皮與胚芽，纖維、B群和礦物質都比精緻穀類多。",
  },
  {
    key: "vegetable",
    label: "蔬菜",
    kind: "benefit",
    markers: ["systolic", "diastolic", "fastingGlucose", "hba1c"],
    text: "體積大、熱量低、纖維和鉀多。鉀有助於平衡鈉，先吃菜也能讓整餐的血糖比較平穩。",
  },
  {
    key: "fruit_whole",
    label: "完整水果",
    kind: "benefit",
    markers: ["systolic", "diastolic"],
    text: "連著纖維一起吃，和榨成果汁完全是兩件事 —— 果汁把纖維濾掉了，剩下的是快吸收的糖。",
  },
  {
    key: "lean_protein",
    label: "優質蛋白",
    kind: "benefit",
    markers: ["fastingGlucose", "hba1c", "boneT"],
    text: "蛋白質幫助維持肌肉，而肌肉是身體消耗血糖的主要去處；也比較有飽足感。",
  },
  {
    key: "soy",
    label: "豆製品",
    kind: "benefit",
    markers: ["ldl", "totalCholesterol", "nonHdl"],
    text: "植物性蛋白不帶膽固醇，用來取代部分紅肉時對血脂比較友善。",
  },
  {
    key: "omega3",
    label: "深海魚（Omega-3）",
    kind: "benefit",
    markers: ["triglycerides", "hdl", "hsCrp"],
    text: "鯖魚、秋刀魚、鮭魚這類魚的 Omega-3，是少數確定對三酸甘油酯有幫助的飲食成分。",
  },
  {
    key: "nuts",
    label: "堅果",
    kind: "benefit",
    markers: ["hdl", "ldl", "triglycerides"],
    text: "不飽和脂肪、纖維和鎂都不錯。一天一小把就夠，熱量不低。",
  },
  {
    key: "unsaturated_oil",
    label: "好油",
    kind: "benefit",
    markers: ["hdl", "ldl", "nonHdl"],
    text: "橄欖油、酪梨、芝麻這類單元不飽和脂肪，用來取代飽和脂肪時對膽固醇的組成比較有利。",
  },
  {
    key: "dairy_calcium",
    label: "鈣質來源",
    kind: "benefit",
    markers: ["boneT", "calcium"],
    text: "乳製品、小魚乾、豆干、深綠色蔬菜。骨質要留得住，鈣和負重運動都需要。",
  },
  {
    key: "fermented",
    label: "發酵食品",
    kind: "benefit",
    markers: [],
    text: "無糖優格、泡菜、味噌這類發酵食品對腸道菌相有幫助（要留意的是鈉和加糖）。",
  },
  {
    key: "low_gi",
    label: "低GI",
    kind: "benefit",
    markers: ["fastingGlucose", "hba1c", "postprandialGlucose"],
    text: "這一餐的醣類吸收比較慢，飯後血糖不會一下衝上去。",
  },
  {
    key: "light_cooking",
    label: "清淡烹調",
    kind: "benefit",
    markers: ["ldl", "totalCholesterol", "waist"],
    text: "清蒸、水煮、烤、涼拌，食材原本的熱量沒有被油和糖放大。",
  },
];

const TAG_BY_KEY = Object.fromEntries(NUTRITION_TAGS.map((t) => [t.key, t]));

/** The tag keys the vision model is allowed to return. */
export const TAG_KEYS = NUTRITION_TAGS.map((t) => t.key);

export function nutritionTag(key) {
  return TAG_BY_KEY[key] || null;
}

/** Keep only tags we know, in the catalogue's own order, without duplicates. */
export function cleanTags(raw) {
  if (!Array.isArray(raw)) return [];
  const wanted = new Set(raw.filter((k) => typeof k === "string"));
  return NUTRITION_TAGS.filter((t) => wanted.has(t.key)).map((t) => t.key);
}

/** How many of each kind a card shows. More than this and it stops being read. */
export const MAX_PER_KIND = 3;

/**
 * What this meal means, and what it means for her.
 *
 * A tag is "personal" when one of its markers is already outside its reference
 * range on her latest report. Those come first and carry her own number, which
 * is the difference between general nutrition advice and advice about her.
 */
export function foodImpact({ tags = [], report = null, gender = "female" } = {}) {
  const keys = cleanTags(tags);
  const findings = report && report.values ? outOfRangeMarkers(report.values, gender) : [];
  const findingByKey = Object.fromEntries(findings.map((f) => [f.key, f]));

  const decorate = (key) => {
    const tag = nutritionTag(key);
    if (!tag) return null;
    const hits = (tag.markers || []).map((m) => findingByKey[m]).filter(Boolean);
    return {
      key: tag.key,
      label: tag.label,
      kind: tag.kind,
      text: tag.text,
      risk: tag.risk || null,
      swap: tag.swap || null,
      /* Named with her own figure and the range it sits in — the same rule the
         weekly plan follows, so what is on screen stays checkable. */
      personal: hits.length ? hits.map(describeHit).join("、") : null,
      hitCount: hits.length,
    };
  };

  const all = keys.map(decorate).filter(Boolean);
  const byRelevance = (a, b) => b.hitCount - a.hitCount;

  return {
    burdens: all.filter((t) => t.kind === "burden").sort(byRelevance).slice(0, MAX_PER_KIND),
    benefits: all.filter((t) => t.kind === "benefit").sort(byRelevance).slice(0, MAX_PER_KIND),
    /* Whether anything here touches a value she is already watching. Used to
       decide if the card says "對你的影響" or just general information. */
    matchesReport: all.some((t) => t.hitCount > 0),
    tags: keys,
  };
}

function describeHit(finding) {
  const marker = labMarker(finding.key);
  const decimals = marker ? marker.decimals : 0;
  return `${finding.label} ${Number(finding.value).toFixed(decimals)}（${finding.zone.label}）`;
}

/**
 * One line summarising which of her own values this meal bears on.
 *
 * Returns null when there is no report or nothing lines up — an empty
 * personalised heading is worse than no heading.
 */
export function personalHeadline(impact) {
  if (!impact || !impact.matchesReport) return null;
  const labels = [];
  for (const item of [...impact.burdens, ...impact.benefits]) {
    if (item.personal) for (const part of item.personal.split("、")) labels.push(part.split(" ")[0]);
  }
  const unique = [...new Set(labels)].slice(0, 3);
  if (!unique.length) return null;
  return `這一餐和你報告上的 ${unique.join("、")} 有關`;
}
