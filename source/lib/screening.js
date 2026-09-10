/**
 * 建議檢查項目與科別 — what to book, and which desk to book it at.
 *
 * The app already says "take this to a doctor". That is honest but not much
 * help: the practical question is *which* doctor and *what* to ask for, and
 * for someone who has never had to navigate a hospital's twenty departments,
 * that gap is where the advice stops working.
 *
 * So every suggestion carries four things: the examination, the department,
 * the reason drawn from her own data, and where the recommendation comes from.
 * Nothing here is invented — the intervals are the national screening
 * programme's or a professional body's, and the reason is always a number she
 * can look up on her own report.
 *
 * What this file must never do:
 *
 *   - **Suggest a treatment.** Only examinations and which department to ask.
 *   - **Predict what will be found.** 「建議做眼底檢查」 is a suggestion;
 *     「你可能有視網膜病變」 is a diagnosis, and not one an app gets to make.
 *   - **Nag about something already done.** A suggestion disappears once there
 *     is a visit to that department recent enough to cover it, because a list
 *     that keeps asking for what she has already done is a list she stops
 *     reading.
 *
 * tools/test-screening.mjs enforces the wording and the "already done" rule.
 */

import { outOfRangeMarkers, labMarker, positiveFlags } from "./health.js";
import { lastVisitTo } from "./visits.js";

const DAY = 86400000;

function monthsBetween(from, to) {
  return (new Date(`${to}T00:00:00`) - new Date(`${from}T00:00:00`)) / DAY / 30.4;
}

/**
 * The rules.
 *
 * `markers` / `flags` fire the rule from the report. `everyMonths` is how long
 * a visit to that department keeps the suggestion quiet. `always` rules are
 * the national programme's, which apply on age alone.
 */
export const SCREENING_RULES = [
  {
    id: "eye-fundus",
    exam: "眼底（視網膜）檢查",
    department: "眼科",
    markers: ["fastingGlucose", "hba1c", "postprandialGlucose"],
    flags: ["fundus"],
    everyMonths: 12,
    source: "糖尿病學會照護指引：血糖偏高者建議每年一次",
    note: "早期的視網膜變化不會有感覺，是靠檢查發現的，不是靠不舒服發現的。",
  },
  {
    id: "eye-pressure",
    exam: "眼壓與視神經檢查",
    department: "眼科",
    markers: ["iopR", "iopL", "visionR", "visionL"],
    everyMonths: 12,
    source: "眼壓偏高需搭配視神經與視野追蹤",
  },
  {
    id: "colon",
    exam: "大腸鏡（或再一次糞便潛血）",
    department: "肝膽腸胃科",
    flags: ["stoolBlood"],
    markers: ["cea", "ca199"],
    everyMonths: 12,
    source: "國健署糞便潛血篩檢：陽性需進一步檢查",
    note: "潛血陽性最常見的原因是痔瘡或息肉，但需要檢查才知道。",
  },
  {
    id: "liver",
    exam: "腹部超音波與肝功能追蹤",
    department: "肝膽腸胃科",
    markers: ["alt", "ast", "ggt", "afp", "bilirubin"],
    flags: ["hbsag", "antiHcv"],
    everyMonths: 6,
    source: "B、C型肝炎帶原者建議定期追蹤",
  },
  {
    id: "kidney",
    exam: "腎功能與尿液追蹤",
    department: "腎臟科",
    markers: ["egfr", "creatinine", "bun"],
    flags: ["urineProtein"],
    everyMonths: 6,
    source: "腎功能數值異常建議由腎臟科追蹤",
  },
  {
    id: "cardio",
    exam: "血壓追蹤與心臟評估",
    department: "心臟內科",
    markers: ["systolic", "diastolic", "hsCrp"],
    everyMonths: 12,
    source: "2022年台灣高血壓治療指引",
  },
  {
    id: "metabolic",
    exam: "血糖與血脂追蹤",
    department: "新陳代謝／內分泌",
    markers: ["fastingGlucose", "hba1c", "triglycerides", "ldl", "totalCholesterol", "nonHdl", "hdl", "tsh", "freeT4"],
    everyMonths: 6,
    source: "糖尿病前期建議每半年至一年追蹤一次",
  },
  {
    id: "blood",
    exam: "血液檢查追蹤（含鐵質相關）",
    department: "家醫科",
    markers: ["hb", "hct", "rbc", "wbc", "platelet", "mcv", "ferritin"],
    everyMonths: 6,
    source: "血液計數異常需由醫師判斷原因",
  },
  {
    id: "bone",
    exam: "骨密度追蹤",
    department: "家醫科",
    markers: ["boneT", "calcium", "vitaminD"],
    everyMonths: 24,
    source: "世界衛生組織骨密度分期；追蹤間隔由醫師決定",
  },
  {
    id: "gout",
    exam: "尿酸追蹤",
    department: "風濕免疫科",
    markers: ["uricAcid"],
    everyMonths: 12,
    source: "尿酸偏高建議追蹤，是否用藥由醫師評估",
  },
  {
    id: "urology",
    exam: "前列腺相關檢查",
    department: "泌尿科",
    markers: ["psa"],
    everyMonths: 12,
    source: "PSA 高於參考值需由泌尿科判讀",
  },
];

/**
 * The national programme, which applies on age and sex rather than on a
 * finding. Included because these are free, easy to forget, and the reason
 * they exist is that they work.
 */
export const PROGRAMME_RULES = [
  {
    id: "adult-checkup",
    exam: "成人預防保健健康檢查",
    department: "健康檢查",
    minAge: 40,
    everyMonths: 36,
    source: "國健署成人預防保健：40-64 歲每 3 年 1 次",
    note: "65 歲以上每年一次。",
  },
  {
    id: "colon-programme",
    exam: "糞便潛血篩檢",
    department: "健康檢查",
    minAge: 45,
    maxAge: 74,
    everyMonths: 24,
    source: "國健署四癌篩檢：45-74 歲每 2 年 1 次",
  },
  {
    id: "mammogram",
    exam: "乳房攝影",
    department: "健康檢查",
    gender: "female",
    minAge: 45,
    maxAge: 74,
    everyMonths: 24,
    source: "國健署四癌篩檢：45-69 歲每 2 年 1 次（40-44 歲有家族史者亦適用）",
  },
  {
    id: "cervical",
    exam: "子宮頸抹片",
    department: "婦產科",
    gender: "female",
    minAge: 30,
    everyMonths: 36,
    source: "國健署四癌篩檢：30 歲以上建議每 3 年至少 1 次",
  },
  {
    id: "oral",
    exam: "口腔黏膜檢查",
    department: "牙科",
    minAge: 30,
    everyMonths: 24,
    source: "國健署四癌篩檢：30 歲以上有嚼檳榔或吸菸者每 2 年 1 次",
    note: "沒有這些習慣的話，一般牙科定期檢查就好。",
  },
];

function describe(finding) {
  const marker = labMarker(finding.key);
  const decimals = marker ? marker.decimals : 0;
  const unit = marker && marker.unit ? ` ${marker.unit}` : "";
  return `${finding.label} ${Number(finding.value).toFixed(decimals)}${unit}（${finding.zone.label}）`;
}

/**
 * What to book, and why.
 *
 * Report-driven suggestions come first — those have a reason attached to one
 * of her own numbers. The national programme's follow, because they apply to
 * everyone her age and are the easier kind to explain.
 */
export function screeningSuggestions({
  report = null,
  profile = null,
  visits = [],
  today = new Date().toISOString().slice(0, 10),
} = {}) {
  const gender = profile && profile.gender === "male" ? "male" : "female";
  const age = parseInt(profile && profile.age, 10) || null;
  const findings = report && report.values ? outOfRangeMarkers(report.values, gender) : [];
  const positives = positiveFlags(report ? report.flags : null);
  const findingByKey = Object.fromEntries(findings.map((f) => [f.key, f]));
  const positiveKeys = new Set(positives.map((f) => f.key));

  const out = [];

  const coveredBy = (rule) => {
    const last = lastVisitTo(visits, rule.department);
    if (!last) return null;
    const months = monthsBetween(last.date, today);
    return months <= rule.everyMonths ? last : null;
  };

  for (const rule of SCREENING_RULES) {
    const markerHits = (rule.markers || []).map((k) => findingByKey[k]).filter(Boolean);
    const flagHits = (rule.flags || []).filter((k) => positiveKeys.has(k));
    if (!markerHits.length && !flagHits.length) continue;

    const covered = coveredBy(rule);
    const reasons = [
      ...markerHits.map(describe),
      ...flagHits.map((k) => {
        const flag = positives.find((f) => f.key === k);
        return `${flag.label}：${(report.flags || {})[k]}`;
      }),
    ];

    out.push({
      id: rule.id,
      exam: rule.exam,
      department: rule.department,
      source: rule.source,
      note: rule.note || null,
      why: reasons.join("、"),
      /* Kept rather than filtered out: "you already went, on this date" is
         useful to see, and hiding it would look like the app forgot. */
      covered: covered ? covered.date : null,
      kind: "report",
    });
  }

  for (const rule of PROGRAMME_RULES) {
    if (rule.gender && rule.gender !== gender) continue;
    /* Without an age on the profile the programme rules cannot be judged, and
       guessing would either nag or stay silent for the wrong reason. Age is an
       optional field here, so this is a normal state, not an error. */
    if (age == null) continue;
    if (rule.minAge && age < rule.minAge) continue;
    if (rule.maxAge && age > rule.maxAge) continue;

    const covered = coveredBy(rule);
    out.push({
      id: rule.id,
      exam: rule.exam,
      department: rule.department,
      source: rule.source,
      note: rule.note || null,
      why: `${age} 歲適用的公費篩檢`,
      covered: covered ? covered.date : null,
      kind: "programme",
    });
  }

  /* Outstanding first: a suggestion she has already acted on is reference,
     not a to-do. */
  return out.sort((a, b) => Number(Boolean(a.covered)) - Number(Boolean(b.covered)));
}

/** Whether the profile is missing the age the programme rules need. */
export function needsAgeForProgramme(profile) {
  return !(parseInt(profile && profile.age, 10) || null);
}
