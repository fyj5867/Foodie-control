/**
 * Health domain logic and reference values.
 *
 * Transplanted VERBATIM from the previous single-file App.jsx by
 * tools/extract-health.mjs — do not retype these by hand. Every threshold,
 * zone boundary and formula here traces back to a cited source listed in
 * CONTENT_REVIEW, with a review date. When adjusting any of these numbers,
 * update CONTENT_REVIEW.lastReviewed and its sources list in the same edit.
 */

const SYMPTOM_OPTIONS = [
  { id: "family", label: "家族糖尿病史" },
  { id: "gestational", label: "曾有妊娠糖尿病" },
  { id: "hypertension", label: "高血壓" },
  { id: "hyperlipidemia", label: "高血脂" },
  { id: "prediabetes", label: "醫師告知糖尿病前期／血糖偏高" },
  { id: "cardio", label: "心血管疾病史" },
  { id: "sedentary", label: "平時缺乏運動" },
  { id: "smoking", label: "有吸菸習慣" },
  { id: "waist", label: "腰圍過大（男≥90cm／女≥80cm）" },
];

/** Derives a sedentary/light/active category from self-reported weekly
 * exercise minutes by intensity, following the WHO/ADA weekly activity
 * guideline (≥150min moderate or ≥75min vigorous, or an equivalent mix,
 * counts as "active"). Downstream calorie/water/risk calculations key off
 * this derived value the same way they did with the old direct selector. */
function deriveActivityLevel(f) {
  const vigMin = f?.vigorousChecked ? Number(f.vigorousMinutes) || 0 : 0;
  const modMin = f?.moderateChecked ? Number(f.moderateMinutes) || 0 : 0;
  const ligMin = f?.lightChecked ? Number(f.lightMinutes) || 0 : 0;
  if (vigMin >= 75 || modMin >= 150 || vigMin * 2 + modMin >= 150) return "active";
  if (vigMin > 0 || modMin > 0 || ligMin > 0) return "light";
  return "sedentary";
}

const ACTIVITY_LOG_OPTIONS = [
  { id: "jog", label: "超慢跑", category: "aerobic" },
  { id: "cycle", label: "騎自行車／飛輪", category: "aerobic" },
  { id: "badminton", label: "羽球", category: "aerobic" },
  { id: "pickleball", label: "匹克球", category: "aerobic" },
  { id: "hiking", label: "爬山", category: "aerobic" },
  { id: "tennis_squash", label: "網球／壁球", category: "aerobic" },
  { id: "table_tennis", label: "桌球", category: "aerobic" },
  { id: "leisure_walk", label: "散步／休閒活動", category: "aerobic" },
  { id: "strength", label: "肌耐力／阻力訓練", category: "resistance" },
  { id: "flex", label: "伸展／太極／瑜伽", category: "flexibility" },
  { id: "other", label: "其他", category: "other" },
];

const ACTIVITY_CATEGORY_LABEL = { aerobic: "有氧", resistance: "阻力", flexibility: "柔軟度", other: "其他" };

const LIGHT_META = {
  green: { label: "綠燈　可安心食用", className: "pill-green" },
  yellow: { label: "黃燈　適量、留意份量", className: "pill-yellow" },
  red: { label: "紅燈　建議避免", className: "pill-red" },
};

const BMI_ZONES = [
  { y1: 15, y2: 18.5, bg: "#FBF0DC", label: "過輕 <18.5" },
  { y1: 18.5, y2: 24, bg: "#E4F5E7", label: "正常 18.5-24" },
  { y1: 24, y2: 27, bg: "#FDEBD3", label: "過重 24-27" },
  { y1: 27, y2: 32, bg: "#FAE6E3", label: "肥胖 ≥27" },
];

/** Body fat % reference zones, commonly cited by Taiwan hospital patient
 * education materials (e.g. 衛福部雙和醫院、國健署健康九九手冊）. Differs by
 * gender since normal body fat % ranges are not the same for men and women. */
function bodyFatZones(gender) {
  if (gender === "male") {
    return [
      { y1: 5, y2: 15, bg: "#FBF0DC", label: "偏低 <15%" },
      { y1: 15, y2: 25, bg: "#E4F5E7", label: "正常 15-25%" },
      { y1: 25, y2: 45, bg: "#FAE6E3", label: "偏高 ≥25%" },
    ];
  }
  return [
    { y1: 10, y2: 20, bg: "#FBF0DC", label: "偏低 <20%" },
    { y1: 20, y2: 30, bg: "#E4F5E7", label: "正常 20-30%" },
    { y1: 30, y2: 50, bg: "#FAE6E3", label: "偏高 ≥30%" },
  ];
}

/** Skeletal muscle % reference zones, commonly cited by Taiwan fitness/
 * health media (e.g. World Gym Taiwan、TVBS 衛教報導). These are general
 * population reference ranges, not a single strict government standard —
 * shown as an approximate guide rather than a precise medical cutoff. */
function skeletalMuscleZones(gender) {
  if (gender === "male") {
    return [
      { y1: 15, y2: 32, bg: "#FBF0DC", label: "偏低 <32%" },
      { y1: 32, y2: 34, bg: "#E4F5E7", label: "正常 32-34%" },
      { y1: 34, y2: 50, bg: "#E4F0F8", label: "偏高 ≥34%" },
    ];
  }
  return [
    { y1: 12, y2: 28, bg: "#FBF0DC", label: "偏低 <28%" },
    { y1: 28, y2: 30, bg: "#E4F5E7", label: "正常 28-30%" },
    { y1: 30, y2: 46, bg: "#E4F0F8", label: "偏高 ≥30%" },
  ];
}

/** Waist circumference reference zones per 衛生福利部國民健康署 metabolic
 * syndrome criteria: male ≥90cm / female ≥80cm indicates elevated risk. */
function waistZones(gender) {
  if (gender === "male") {
    return [
      { y1: 55, y2: 90, bg: "#E4F5E7", label: "正常 <90cm" },
      { y1: 90, y2: 130, bg: "#FAE6E3", label: "腰圍過大 ≥90cm" },
    ];
  }
  return [
    { y1: 50, y2: 80, bg: "#E4F5E7", label: "正常 <80cm" },
    { y1: 80, y2: 120, bg: "#FAE6E3", label: "腰圍過大 ≥80cm" },
  ];
}

/** Sleep duration reference zones for adults, per 衛生福利部國民健康署 health
 * promotion material and the US National Sleep Foundation's 2015 consensus
 * (adults 18-64: 7-9 hours nightly). Shown as a general guide — shift workers
 * and people with sleep disorders should follow their clinician's advice. */
function sleepZones() {
  return [
    { y1: 3, y2: 7, bg: "#FBF0DC", label: "偏少 <7 小時" },
    { y1: 7, y2: 9, bg: "#E4F5E7", label: "建議 7-9 小時" },
    { y1: 9, y2: 12, bg: "#E4F0F8", label: "偏多 >9 小時" },
  ];
}

/**
 * Health check report markers, and the published ranges they are read against.
 *
 * Everything here is a REFERENCE RANGE, not a diagnosis. A value outside a
 * range is a reason to ask a doctor about it, and that is the strongest thing
 * this app is ever allowed to say about it. Two consequences run through the
 * whole design:
 *
 *   - Zones carry the range in their label（"糖尿病前期範圍 100-125"）so what
 *     is on screen is a comparison a person can check, not a verdict they have
 *     to take on trust.
 *   - Every lab prints its own reference range on the report, and they differ
 *     between labs and methods. So the app says which standard it used and
 *     tells the person to go by their own report and their doctor.
 *
 * A zone matches when the value is below its `lt`; the last zone has no `lt`
 * and catches everything above. Markers whose ranges differ by sex take the
 * profile's gender, the same way bodyFatZones does.
 *
 * `plausible` is a data-hygiene bound, not a reference range: these numbers
 * are read off a photograph by a model, and a misplaced decimal point or a
 * value picked out of the neighbouring 「參考值」 column has to be rejected
 * rather than shown as an alarming finding.
 */
const LAB_MARKERS = [
  {
    key: "fastingGlucose",
    plausible: [20, 800],
    label: "空腹血糖",
    short: "血糖",
    unit: "mg/dL",
    decimals: 0,
    group: "sugar",
    /* 中華民國糖尿病學會／ADA 判讀切點。100-125 是「糖尿病前期」，也就是這個
       App 存在的原因，所以它是黃色而不是紅色：需要處理，不是壞消息。 */
    zones: [
      { lt: 70, tone: "yellow", label: "偏低 <70" },
      { lt: 100, tone: "green", label: "正常 <100" },
      { lt: 126, tone: "yellow", label: "糖尿病前期範圍 100-125" },
      { tone: "red", label: "已達糖尿病診斷切點 ≥126" },
    ],
  },
  {
    key: "hba1c",
    plausible: [3, 20],
    label: "糖化血色素",
    short: "HbA1c",
    unit: "%",
    decimals: 1,
    group: "sugar",
    note: "反映近 2-3 個月的平均血糖，比單次空腹血糖穩定。",
    zones: [
      { lt: 5.7, tone: "green", label: "正常 <5.7" },
      { lt: 6.5, tone: "yellow", label: "糖尿病前期範圍 5.7-6.4" },
      { tone: "red", label: "已達糖尿病診斷切點 ≥6.5" },
    ],
  },
  {
    key: "totalCholesterol",
    plausible: [50, 600],
    label: "總膽固醇",
    short: "總膽固醇",
    unit: "mg/dL",
    decimals: 0,
    group: "lipid",
    zones: [
      { lt: 200, tone: "green", label: "理想 <200" },
      { lt: 240, tone: "yellow", label: "邊緣偏高 200-239" },
      { tone: "red", label: "偏高 ≥240" },
    ],
  },
  {
    key: "triglycerides",
    plausible: [20, 3000],
    label: "三酸甘油酯",
    short: "三酸甘油酯",
    unit: "mg/dL",
    decimals: 0,
    group: "lipid",
    note: "對含糖飲料、精緻澱粉與酒精特別敏感，也是最容易靠飲食改變的一項。",
    zones: [
      { lt: 150, tone: "green", label: "正常 <150" },
      { lt: 200, tone: "yellow", label: "邊緣偏高 150-199" },
      { tone: "red", label: "偏高 ≥200" },
    ],
  },
  {
    key: "hdl",
    plausible: [10, 150],
    label: "高密度脂蛋白（HDL）",
    short: "HDL",
    unit: "mg/dL",
    decimals: 0,
    group: "lipid",
    higherIsBetter: true,
    note: "這一項是愈高愈好，規律有氧運動是少數確定能拉高它的方式。",
    zonesFor: (gender) =>
      gender === "male"
        ? [
            { lt: 40, tone: "red", label: "偏低 <40" },
            { lt: 60, tone: "green", label: "正常 40-59" },
            { tone: "green", label: "良好 ≥60" },
          ]
        : [
            { lt: 50, tone: "red", label: "偏低 <50" },
            { lt: 60, tone: "green", label: "正常 50-59" },
            { tone: "green", label: "良好 ≥60" },
          ],
  },
  {
    key: "ldl",
    plausible: [10, 400],
    label: "低密度脂蛋白（LDL）",
    short: "LDL",
    unit: "mg/dL",
    decimals: 0,
    group: "lipid",
    note: "已有心血管疾病或糖尿病的人，醫師設定的目標會比這裡的一般參考值更低。",
    zones: [
      { lt: 130, tone: "green", label: "正常 <130" },
      { lt: 160, tone: "yellow", label: "邊緣偏高 130-159" },
      { tone: "red", label: "偏高 ≥160" },
    ],
  },
  {
    key: "systolic",
    plausible: [60, 260],
    label: "收縮壓",
    short: "收縮壓",
    unit: "mmHg",
    decimals: 0,
    group: "pressure",
    zones: [
      { lt: 120, tone: "green", label: "正常 <120" },
      { lt: 130, tone: "yellow", label: "血壓升高 120-129" },
      { tone: "red", label: "偏高 ≥130" },
    ],
  },
  {
    key: "diastolic",
    plausible: [30, 180],
    label: "舒張壓",
    short: "舒張壓",
    unit: "mmHg",
    decimals: 0,
    group: "pressure",
    zones: [
      { lt: 80, tone: "green", label: "正常 <80" },
      { tone: "red", label: "偏高 ≥80" },
    ],
  },
  {
    key: "uricAcid",
    plausible: [1, 20],
    label: "尿酸",
    short: "尿酸",
    unit: "mg/dL",
    decimals: 1,
    group: "other",
    zonesFor: (gender) =>
      gender === "male"
        ? [
            { lt: 3.5, tone: "yellow", label: "偏低 <3.5" },
            { lt: 7.2, tone: "green", label: "正常 3.5-7.2" },
            { tone: "red", label: "偏高 >7.2" },
          ]
        : [
            { lt: 2.6, tone: "yellow", label: "偏低 <2.6" },
            { lt: 6.0, tone: "green", label: "正常 2.6-6.0" },
            { tone: "red", label: "偏高 >6.0" },
          ],
  },
  {
    key: "alt",
    plausible: [1, 2000],
    label: "肝功能 GPT（ALT）",
    short: "GPT",
    unit: "U/L",
    decimals: 0,
    group: "liver",
    /* Out of range here is a question for a clinician, not a
       lifestyle target — see REFERRAL_NOTES in lib/plan.js. */
    referral: true,
    zones: [
      { lt: 41, tone: "green", label: "正常 ≤40" },
      { lt: 81, tone: "yellow", label: "偏高 41-80" },
      { tone: "red", label: "明顯偏高 >80" },
    ],
  },
  {
    key: "ast",
    plausible: [1, 2000],
    label: "肝功能 GOT（AST）",
    short: "GOT",
    unit: "U/L",
    decimals: 0,
    group: "liver",
    /* Out of range here is a question for a clinician, not a
       lifestyle target — see REFERRAL_NOTES in lib/plan.js. */
    referral: true,
    zones: [
      { lt: 41, tone: "green", label: "正常 ≤40" },
      { lt: 81, tone: "yellow", label: "偏高 41-80" },
      { tone: "red", label: "明顯偏高 >80" },
    ],
  },
  {
    key: "creatinine",
    plausible: [0.1, 20],
    label: "肌酸酐",
    short: "肌酸酐",
    unit: "mg/dL",
    decimals: 2,
    group: "kidney",
    /* Out of range here is a question for a clinician, not a
       lifestyle target — see REFERRAL_NOTES in lib/plan.js. */
    referral: true,
    zonesFor: (gender) =>
      gender === "male"
        ? [
            { lt: 0.7, tone: "yellow", label: "偏低 <0.7" },
            { lt: 1.4, tone: "green", label: "正常 0.7-1.3" },
            { tone: "red", label: "偏高 ≥1.4" },
          ]
        : [
            { lt: 0.5, tone: "yellow", label: "偏低 <0.5" },
            { lt: 1.2, tone: "green", label: "正常 0.5-1.1" },
            { tone: "red", label: "偏高 ≥1.2" },
          ],
  },
  {
    key: "egfr",
    plausible: [1, 200],
    label: "腎絲球過濾率（eGFR）",
    short: "eGFR",
    unit: "mL/min/1.73m²",
    decimals: 0,
    group: "kidney",
    higherIsBetter: true,
    /* Out of range here is a question for a clinician, not a
       lifestyle target — see REFERRAL_NOTES in lib/plan.js. */
    referral: true,
    zones: [
      { lt: 30, tone: "red", label: "明顯下降 <30" },
      { lt: 60, tone: "red", label: "中度下降 30-59" },
      { lt: 90, tone: "yellow", label: "輕度下降 60-89" },
      { tone: "green", label: "正常 ≥90" },
    ],
  },
  {
    key: "postprandialGlucose",
    label: "飯後血糖",
    short: "飯後血糖",
    unit: "mg/dL",
    decimals: 0,
    group: "sugar",
    plausible: [40, 800],
    note: "一般指飯後 2 小時測得的血糖。",
    zones: [
      { lt: 140, tone: "green", label: "正常 <140" },
      { lt: 200, tone: "yellow", label: "偏高 140-199" },
      { tone: "red", label: "已達糖尿病診斷切點 ≥200" },
    ],
  },
  {
    key: "nonHdl",
    label: "非高密度脂蛋白膽固醇",
    short: "非HDL",
    unit: "mg/dL",
    decimals: 0,
    group: "lipid",
    plausible: [20, 500],
    note: "總膽固醇減去 HDL，代表所有「壞」膽固醇的總和。",
    zones: [
      { lt: 160, tone: "green", label: "正常 <160" },
      { lt: 190, tone: "yellow", label: "邊緣偏高 160-189" },
      { tone: "red", label: "偏高 ≥190" },
    ],
  },
  {
    key: "hb",
    label: "血色素",
    short: "血色素",
    unit: "g/dL",
    decimals: 1,
    group: "blood",
    plausible: [3, 25],
    /* Out of range here is a question for a clinician, not a
       lifestyle target — see REFERRAL_ONLY in lib/plan.js. */
    referral: true,
    note: "偏低常見於貧血，原因很多，需要醫師判斷。",
    zonesFor: (gender) =>
      gender === "male"
        ? [
              { lt: 13.5, tone: "yellow", label: "偏低 <13.5" },
              { lt: 17.6, tone: "green", label: "正常 13.5-17.5" },
              { tone: "yellow", label: "偏高 >17.5" },
          ]
        : [
              { lt: 12, tone: "yellow", label: "偏低 <12" },
              { lt: 16.1, tone: "green", label: "正常 12-16" },
              { tone: "yellow", label: "偏高 >16" },
          ],
  },
  {
    key: "hct",
    label: "血球容積比",
    short: "Hct",
    unit: "%",
    decimals: 1,
    group: "blood",
    plausible: [10, 70],
    /* Out of range here is a question for a clinician, not a
       lifestyle target — see REFERRAL_ONLY in lib/plan.js. */
    referral: true,
    zonesFor: (gender) =>
      gender === "male"
        ? [
              { lt: 40, tone: "yellow", label: "偏低 <40" },
              { lt: 52.1, tone: "green", label: "正常 40-52" },
              { tone: "yellow", label: "偏高 >52" },
          ]
        : [
              { lt: 36, tone: "yellow", label: "偏低 <36" },
              { lt: 48.1, tone: "green", label: "正常 36-48" },
              { tone: "yellow", label: "偏高 >48" },
          ],
  },
  {
    key: "rbc",
    label: "紅血球",
    short: "RBC",
    unit: "10⁶/µL",
    decimals: 2,
    group: "blood",
    plausible: [1, 10],
    /* Out of range here is a question for a clinician, not a
       lifestyle target — see REFERRAL_ONLY in lib/plan.js. */
    referral: true,
    zonesFor: (gender) =>
      gender === "male"
        ? [
              { lt: 4.5, tone: "yellow", label: "偏低 <4.5" },
              { lt: 6, tone: "green", label: "正常 4.5-5.9" },
              { tone: "yellow", label: "偏高 ≥6.0" },
          ]
        : [
              { lt: 4, tone: "yellow", label: "偏低 <4.0" },
              { lt: 5.3, tone: "green", label: "正常 4.0-5.2" },
              { tone: "yellow", label: "偏高 ≥5.3" },
          ],
  },
  {
    key: "wbc",
    label: "白血球",
    short: "WBC",
    unit: "10³/µL",
    decimals: 1,
    group: "blood",
    plausible: [0.5, 100],
    /* Out of range here is a question for a clinician, not a
       lifestyle target — see REFERRAL_ONLY in lib/plan.js. */
    referral: true,
    note: "偏高常與感染或發炎有關，偏低也需要醫師評估。",
    zones: [
      { lt: 4, tone: "yellow", label: "偏低 <4.0" },
      { lt: 10.1, tone: "green", label: "正常 4.0-10.0" },
      { tone: "yellow", label: "偏高 >10.0" },
    ],
  },
  {
    key: "platelet",
    label: "血小板",
    short: "血小板",
    unit: "10³/µL",
    decimals: 0,
    group: "blood",
    plausible: [5, 1500],
    /* Out of range here is a question for a clinician, not a
       lifestyle target — see REFERRAL_ONLY in lib/plan.js. */
    referral: true,
    zones: [
      { lt: 150, tone: "yellow", label: "偏低 <150" },
      { lt: 401, tone: "green", label: "正常 150-400" },
      { tone: "yellow", label: "偏高 >400" },
    ],
  },
  {
    key: "mcv",
    label: "平均紅血球體積",
    short: "MCV",
    unit: "fL",
    decimals: 1,
    group: "blood",
    plausible: [40, 150],
    /* Out of range here is a question for a clinician, not a
       lifestyle target — see REFERRAL_ONLY in lib/plan.js. */
    referral: true,
    note: "和血色素一起看，可以幫助醫師分辨貧血的類型。",
    zones: [
      { lt: 80, tone: "yellow", label: "偏低 <80" },
      { lt: 100.1, tone: "green", label: "正常 80-100" },
      { tone: "yellow", label: "偏高 >100" },
    ],
  },
  {
    key: "ggt",
    label: "γ-GT",
    short: "γ-GT",
    unit: "U/L",
    decimals: 0,
    group: "liver",
    plausible: [1, 2000],
    /* Out of range here is a question for a clinician, not a
       lifestyle target — see REFERRAL_ONLY in lib/plan.js. */
    referral: true,
    note: "對酒精與藥物特別敏感，需要醫師一起看其他肝指數。",
    zonesFor: (gender) =>
      gender === "male"
        ? [
              { lt: 51, tone: "green", label: "正常 ≤50" },
              { lt: 101, tone: "yellow", label: "偏高 51-100" },
              { tone: "red", label: "明顯偏高 >100" },
          ]
        : [
              { lt: 33, tone: "green", label: "正常 ≤32" },
              { lt: 65, tone: "yellow", label: "偏高 33-64" },
              { tone: "red", label: "明顯偏高 >64" },
          ],
  },
  {
    key: "alp",
    label: "鹼性磷酸酶",
    short: "ALP",
    unit: "U/L",
    decimals: 0,
    group: "liver",
    plausible: [5, 2000],
    /* Out of range here is a question for a clinician, not a
       lifestyle target — see REFERRAL_ONLY in lib/plan.js. */
    referral: true,
    zones: [
      { lt: 35, tone: "yellow", label: "偏低 <35" },
      { lt: 111, tone: "green", label: "正常 35-110" },
      { tone: "yellow", label: "偏高 >110" },
    ],
  },
  {
    key: "bilirubin",
    label: "總膽紅素",
    short: "膽紅素",
    unit: "mg/dL",
    decimals: 2,
    group: "liver",
    plausible: [0.05, 30],
    /* Out of range here is a question for a clinician, not a
       lifestyle target — see REFERRAL_ONLY in lib/plan.js. */
    referral: true,
    zones: [
      { lt: 1.3, tone: "green", label: "正常 ≤1.2" },
      { lt: 3, tone: "yellow", label: "偏高 1.3-2.9" },
      { tone: "red", label: "明顯偏高 ≥3.0" },
    ],
  },
  {
    key: "albumin",
    label: "白蛋白",
    short: "白蛋白",
    unit: "g/dL",
    decimals: 1,
    group: "liver",
    plausible: [1, 7],
    /* Out of range here is a question for a clinician, not a
       lifestyle target — see REFERRAL_ONLY in lib/plan.js. */
    referral: true,
    note: "反映營養與肝臟的合成能力。",
    zones: [
      { lt: 3.5, tone: "yellow", label: "偏低 <3.5" },
      { lt: 5.1, tone: "green", label: "正常 3.5-5.0" },
      { tone: "yellow", label: "偏高 >5.0" },
    ],
  },
  {
    key: "bun",
    label: "尿素氮",
    short: "BUN",
    unit: "mg/dL",
    decimals: 0,
    group: "kidney",
    plausible: [1, 300],
    /* Out of range here is a question for a clinician, not a
       lifestyle target — see REFERRAL_ONLY in lib/plan.js. */
    referral: true,
    zones: [
      { lt: 8, tone: "yellow", label: "偏低 <8" },
      { lt: 21, tone: "green", label: "正常 8-20" },
      { tone: "yellow", label: "偏高 >20" },
    ],
  },
  {
    key: "tsh",
    label: "甲狀腺刺激素",
    short: "TSH",
    unit: "mIU/L",
    decimals: 2,
    group: "thyroid",
    plausible: [0.005, 200],
    /* Out of range here is a question for a clinician, not a
       lifestyle target — see REFERRAL_ONLY in lib/plan.js. */
    referral: true,
    note: "甲狀腺功能異常的原因與處理都需要醫師判斷。",
    zones: [
      { lt: 0.4, tone: "yellow", label: "偏低 <0.4" },
      { lt: 4.1, tone: "green", label: "正常 0.4-4.0" },
      { tone: "yellow", label: "偏高 >4.0" },
    ],
  },
  {
    key: "freeT4",
    label: "游離甲狀腺素",
    short: "free T4",
    unit: "ng/dL",
    decimals: 2,
    group: "thyroid",
    plausible: [0.05, 15],
    /* Out of range here is a question for a clinician, not a
       lifestyle target — see REFERRAL_ONLY in lib/plan.js. */
    referral: true,
    zones: [
      { lt: 0.8, tone: "yellow", label: "偏低 <0.8" },
      { lt: 1.9, tone: "green", label: "正常 0.8-1.8" },
      { tone: "yellow", label: "偏高 >1.8" },
    ],
  },
  {
    key: "sodium",
    label: "鈉",
    short: "鈉",
    unit: "mEq/L",
    decimals: 0,
    group: "mineral",
    plausible: [100, 190],
    /* Out of range here is a question for a clinician, not a
       lifestyle target — see REFERRAL_ONLY in lib/plan.js. */
    referral: true,
    zones: [
      { lt: 135, tone: "yellow", label: "偏低 <135" },
      { lt: 146, tone: "green", label: "正常 135-145" },
      { tone: "yellow", label: "偏高 >145" },
    ],
  },
  {
    key: "potassium",
    label: "鉀",
    short: "鉀",
    unit: "mEq/L",
    decimals: 1,
    group: "mineral",
    plausible: [1, 10],
    /* Out of range here is a question for a clinician, not a
       lifestyle target — see REFERRAL_ONLY in lib/plan.js. */
    referral: true,
    note: "過高或過低都會影響心臟，異常時請儘快讓醫師知道。",
    zones: [
      { lt: 3.5, tone: "yellow", label: "偏低 <3.5" },
      { lt: 5.2, tone: "green", label: "正常 3.5-5.1" },
      { tone: "red", label: "偏高 >5.1" },
    ],
  },
  {
    key: "calcium",
    label: "鈣",
    short: "鈣",
    unit: "mg/dL",
    decimals: 1,
    group: "mineral",
    plausible: [3, 20],
    /* Out of range here is a question for a clinician, not a
       lifestyle target — see REFERRAL_ONLY in lib/plan.js. */
    referral: true,
    zones: [
      { lt: 8.6, tone: "yellow", label: "偏低 <8.6" },
      { lt: 10.4, tone: "green", label: "正常 8.6-10.3" },
      { tone: "yellow", label: "偏高 >10.3" },
    ],
  },
  {
    key: "vitaminD",
    label: "維生素 D（25-OH-D）",
    short: "維生素D",
    unit: "ng/mL",
    decimals: 1,
    group: "mineral",
    plausible: [1, 150],
    higherIsBetter: true,
    note: "曬太陽與飲食都會影響；要不要補充、補多少請問醫師。",
    zones: [
      { lt: 20, tone: "red", label: "缺乏 <20" },
      { lt: 30, tone: "yellow", label: "不足 20-29" },
      { tone: "green", label: "足夠 ≥30" },
    ],
  },
  {
    key: "ferritin",
    label: "鐵蛋白",
    short: "鐵蛋白",
    unit: "ng/mL",
    decimals: 0,
    group: "mineral",
    plausible: [1, 3000],
    /* Out of range here is a question for a clinician, not a
       lifestyle target — see REFERRAL_ONLY in lib/plan.js. */
    referral: true,
    zonesFor: (gender) =>
      gender === "male"
        ? [
              { lt: 30, tone: "yellow", label: "偏低 <30" },
              { lt: 401, tone: "green", label: "正常 30-400" },
              { tone: "yellow", label: "偏高 >400" },
          ]
        : [
              { lt: 13, tone: "yellow", label: "偏低 <13" },
              { lt: 151, tone: "green", label: "正常 13-150" },
              { tone: "yellow", label: "偏高 >150" },
          ],
  },
  {
    key: "hsCrp",
    label: "高敏感度C反應蛋白",
    short: "hs-CRP",
    unit: "mg/L",
    decimals: 2,
    group: "inflammation",
    plausible: [0.05, 300],
    note: "身體發炎的程度，也被用來看心血管風險；感染或受傷時會暫時升高。",
    zones: [
      { lt: 1, tone: "green", label: "低風險 <1" },
      { lt: 3, tone: "yellow", label: "中風險 1-3" },
      { tone: "red", label: "高風險 >3" },
    ],
  },
  {
    key: "afp",
    label: "胎兒蛋白（AFP）",
    short: "AFP",
    unit: "ng/mL",
    decimals: 1,
    group: "tumour",
    plausible: [0.1, 100000],
    /* Out of range here is a question for a clinician, not a
       lifestyle target — see REFERRAL_ONLY in lib/plan.js. */
    referral: true,
    zones: [
      { lt: 20, tone: "green", label: "參考值 <20" },
      { tone: "yellow", label: "高於參考值 ≥20" },
    ],
  },
  {
    key: "cea",
    label: "癌胚抗原（CEA）",
    short: "CEA",
    unit: "ng/mL",
    decimals: 1,
    group: "tumour",
    plausible: [0.1, 10000],
    /* Out of range here is a question for a clinician, not a
       lifestyle target — see REFERRAL_ONLY in lib/plan.js. */
    referral: true,
    zones: [
      { lt: 5, tone: "green", label: "參考值 <5" },
      { tone: "yellow", label: "高於參考值 ≥5" },
    ],
  },
  {
    key: "ca199",
    label: "CA-199",
    short: "CA-199",
    unit: "U/mL",
    decimals: 1,
    group: "tumour",
    plausible: [0.1, 100000],
    /* Out of range here is a question for a clinician, not a
       lifestyle target — see REFERRAL_ONLY in lib/plan.js. */
    referral: true,
    zones: [
      { lt: 37, tone: "green", label: "參考值 <37" },
      { tone: "yellow", label: "高於參考值 ≥37" },
    ],
  },
  {
    key: "psa",
    label: "前列腺特定抗原（PSA）",
    short: "PSA",
    unit: "ng/mL",
    decimals: 2,
    group: "tumour",
    plausible: [0.01, 5000],
    /* Out of range here is a question for a clinician, not a
       lifestyle target — see REFERRAL_ONLY in lib/plan.js. */
    referral: true,
    note: "男性檢查項目。",
    zones: [
      { lt: 4, tone: "green", label: "參考值 <4" },
      { tone: "yellow", label: "高於參考值 ≥4" },
    ],
  },
  {
    key: "boneT",
    label: "骨密度 T 值",
    short: "骨密度",
    unit: "T-score",
    decimals: 1,
    group: "bone",
    plausible: [-6, 6],
    higherIsBetter: true,
    note: "世界衛生組織的判定：≥-1 正常、-1 到 -2.5 骨質流失、≤-2.5 骨質疏鬆。",
    zones: [
      { lt: -2.5, tone: "red", label: "骨質疏鬆 ≤-2.5" },
      { lt: -1, tone: "yellow", label: "骨質流失 -2.5~-1" },
      { tone: "green", label: "正常 ≥-1" },
    ],
  },
  {
    key: "waist",
    plausible: [40, 200],
    label: "腰圍",
    short: "腰圍",
    unit: "cm",
    decimals: 1,
    group: "body",
    zonesFor: (gender) =>
      gender === "male"
        ? [
            { lt: 90, tone: "green", label: "正常 <90" },
            { tone: "red", label: "過大 ≥90" },
          ]
        : [
            { lt: 80, tone: "green", label: "正常 <80" },
            { tone: "red", label: "過大 ≥80" },
          ],
  },
  {
    key: "weight",
    plausible: [20, 300],
    label: "體重",
    short: "體重",
    unit: "kg",
    decimals: 1,
    group: "body",
    /* No zones: a weight on its own is not high or low, BMI is what the app
       already judges. Kept so a value read off the report is not thrown away. */
    zones: null,
  },
];

const LAB_MARKER_BY_KEY = Object.fromEntries(LAB_MARKERS.map((m) => [m.key, m]));

function labMarker(key) {
  return LAB_MARKER_BY_KEY[key] || null;
}

/**
 * A lab value as a number, or null when there isn't one.
 *
 * Number(null) and Number("") are both 0, and 0 sits inside the 「正常」 band
 * of several markers — so passing a raw Number() through meant a value nobody
 * measured came back graded as normal. Absent has to stay absent.
 */
function labNumber(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** The zones for one marker, resolved for this person. */
function labZonesFor(key, gender) {
  const marker = labMarker(key);
  if (!marker) return null;
  if (marker.zonesFor) return marker.zonesFor(gender === "male" ? "male" : "female");
  return marker.zones;
}

/**
 * Which zone a value falls in. Returns null when there is nothing to judge —
 * an unknown marker, a missing value, or one this app deliberately does not
 * grade (weight).
 */
function labZone(key, value, gender) {
  const zones = labZonesFor(key, gender);
  if (!zones || !zones.length) return null;
  const n = labNumber(value);
  if (n == null) return null;
  for (const zone of zones) {
    if (zone.lt == null || n < zone.lt) return zone;
  }
  return zones[zones.length - 1];
}

/**
 * 代謝症候群自我檢查（衛生福利部國民健康署的五項條件）.
 *
 * This is the one place the app joins a report to what it already records:
 * waist comes from 體態紀錄, the other four from the report. Three or more
 * met is the published threshold.
 *
 * The official criteria also count "已在服用相關藥物" for blood pressure,
 * glucose and triglycerides. The app cannot know that, so it says so rather
 * than quietly reporting a lower count than a clinician would.
 */
const METABOLIC_SYNDROME_THRESHOLD = 3;

function metabolicSyndrome({ values = {}, waistCm = null, gender = "female" } = {}) {
  const male = gender === "male";
  const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);

  const waist = num(waistCm != null ? waistCm : values.waist);
  const sys = num(values.systolic);
  const dia = num(values.diastolic);
  const glucose = num(values.fastingGlucose);
  const tg = num(values.triglycerides);
  const hdl = num(values.hdl);

  const criteria = [
    {
      key: "waist",
      label: "腰圍",
      limit: male ? "≥90" : "≥80",
      unit: "cm",
      value: waist,
      met: waist != null && waist >= (male ? 90 : 80),
    },
    {
      key: "pressure",
      label: "血壓",
      limit: "≥130/85",
      unit: "mmHg",
      value: sys != null || dia != null ? `${sys ?? "—"}/${dia ?? "—"}` : null,
      met: (sys != null && sys >= 130) || (dia != null && dia >= 85),
    },
    {
      key: "glucose",
      label: "空腹血糖",
      limit: "≥100",
      unit: "mg/dL",
      value: glucose,
      met: glucose != null && glucose >= 100,
    },
    {
      key: "triglycerides",
      label: "三酸甘油酯",
      limit: "≥150",
      unit: "mg/dL",
      value: tg,
      met: tg != null && tg >= 150,
    },
    {
      key: "hdl",
      label: "高密度脂蛋白",
      short: "HDL",
      limit: male ? "<40" : "<50",
      unit: "mg/dL",
      value: hdl,
      met: hdl != null && hdl < (male ? 40 : 50),
    },
  ];

  const known = criteria.filter((c) => c.value != null).length;
  const met = criteria.filter((c) => c.met).length;

  return {
    criteria,
    met,
    known,
    total: criteria.length,
    threshold: METABOLIC_SYNDROME_THRESHOLD,
    /* Below the threshold with items unmeasured is not "you are fine" — it is
       "not enough was measured to say". The two must not read the same. */
    complete: known === criteria.length,
    reachesThreshold: met >= METABOLIC_SYNDROME_THRESHOLD,
  };
}

/** Whether a value could be a real reading for this marker — see `plausible`. */
function isPlausibleLabValue(key, value) {
  const marker = labMarker(key);
  if (!marker || !marker.plausible) return false;
  const n = labNumber(value);
  const [lo, hi] = marker.plausible;
  return n != null && n >= lo && n <= hi;
}

/** Report values that fall outside their reference range, worst first. */
function outOfRangeMarkers(values, gender) {
  const out = [];
  for (const marker of LAB_MARKERS) {
    const value = values ? values[marker.key] : null;
    const zone = labZone(marker.key, value, gender);
    if (!zone || zone.tone === "green") continue;
    out.push({ key: marker.key, label: marker.label, value: Number(value), unit: marker.unit, zone, marker });
  }
  const rank = { red: 0, yellow: 1 };
  return out.sort((a, b) => (rank[a.zone.tone] ?? 9) - (rank[b.zone.tone] ?? 9));
}

/**
 * The report items that are not a number but a yes or no.
 *
 * 糞便潛血, 尿蛋白, B型肝炎表面抗原 — every Taiwanese health check has some of
 * these, and leaving them out meant a whole page of the report could not be
 * recorded. They are kept deliberately simple: 陰性 or 陽性, nothing in
 * between, because that is all a person can read off their own report without
 * interpreting it.
 *
 * **Every one of these, when positive, is a referral and nothing else.** There
 * is no lifestyle advice this app could give about a positive faecal occult
 * blood test that would not be worse than saying "take this to your doctor".
 * That is the whole of the app's response, and it is the right one.
 */
const LAB_FLAGS = [
  {
    key: "stoolBlood",
    label: "糞便潛血",
    short: "糞便潛血",
    note: "國健署提供 50-74 歲每兩年一次免費篩檢。陽性代表需要進一步檢查，不代表就是癌症。",
  },
  {
    key: "urineProtein",
    label: "尿蛋白",
    short: "尿蛋白",
    note: "與腎臟功能有關，需要醫師搭配其他腎功能數值一起判讀。",
  },
  {
    key: "urineGlucose",
    label: "尿糖",
    short: "尿糖",
    note: "通常在血糖偏高時才會出現在尿液中。",
  },
  {
    key: "urineBlood",
    label: "尿中紅血球",
    short: "尿中紅血球",
    note: "原因很多（結石、發炎、女性生理期等），需要醫師判斷。",
  },
  {
    key: "hbsag",
    label: "B型肝炎表面抗原",
    short: "B肝抗原",
    note: "陽性代表帶有B型肝炎病毒，需要定期追蹤，請由醫師安排。",
  },
  {
    key: "antiHcv",
    label: "C型肝炎抗體",
    short: "C肝抗體",
    note: "陽性需要進一步確認，目前C型肝炎已有健保給付的治療，請找醫師討論。",
  },
  {
    key: "helicobacter",
    label: "幽門螺旋桿菌",
    short: "幽門桿菌",
    note: "與胃部疾病有關，是否需要治療由醫師評估。",
  },
];

const LAB_FLAG_BY_KEY = Object.fromEntries(LAB_FLAGS.map((f) => [f.key, f]));

/** The only two values a flag may hold. Anything else is not recorded. */
const FLAG_VALUES = ["陰性", "陽性"];

function labFlag(key) {
  return LAB_FLAG_BY_KEY[key] || null;
}

function isFlagValue(value) {
  return FLAG_VALUES.includes(String(value));
}

/** Flags that came back positive — each one a question for a clinician. */
function positiveFlags(flags) {
  const out = [];
  for (const flag of LAB_FLAGS) {
    if (flags && String(flags[flag.key]) === "陽性") out.push(flag);
  }
  return out;
}

const CONTENT_REVIEW = {
  lastReviewed: "2026-09-09",
  sources: [
    "衛生福利部國民健康署《我的餐盤》飲食指南與「顧血糖4招」衛教資訊",
    "衛生福利部國民健康署《糖尿病防治手冊》",
    "台北榮民總醫院護理部衛教資訊《糖尿病與運動》",
    "社團法人中華民國糖尿病學會《2022第2型糖尿病臨床照護指引》",
    "衛生福利部《國人膳食營養素參考攝取量》第九版飲水建議草案",
    "衛生福利部雙和醫院、國健署健康九九手冊：BMI／體脂肪率標準",
    "World Gym Taiwan、TVBS衛教報導：骨骼肌率參考範圍",
    "衛生福利部國民健康署代謝症候群學習手冊：腰圍標準",
    "衛生福利部食品藥物管理署《食品營養成分資料庫（新版）》：食物熱量查詢",
    "衛生福利部國民健康署睡眠健康衛教資訊、美國National Sleep Foundation 2015共識：成人每晚7-9小時",
    "衛生福利部國民健康署《代謝症候群判定標準》：腰圍、血壓、空腹血糖、三酸甘油酯、高密度脂蛋白五項，三項以上",
    "社團法人中華民國糖尿病學會／美國糖尿病學會：空腹血糖 100-125 mg/dL、糖化血色素 5.7-6.4% 為糖尿病前期",
    "衛生福利部國民健康署心血管疾病防治衛教：總膽固醇、三酸甘油酯、HDL、LDL 參考值",
    "2022年台灣高血壓治療指引（中華民國心臟學會／台灣高血壓學會）：130/80 mmHg 判定標準",
    "台灣慢性腎臟病臨床診療指引：eGFR 分期（≥90 正常、60-89 輕度下降、30-59 中度、<30 重度）",
    "衛生福利部國民健康署四大癌症篩檢：糞便潛血（50-74歲每兩年一次）",
    "台灣常見臨床檢驗參考範圍：血液計數（WBC／RBC／Hb／Hct／血小板／MCV）、肝功能（ALP／γ-GT／膽紅素／白蛋白）、腎功能（BUN）、甲狀腺（TSH／free T4）、電解質（鈉／鉀／鈣）",
    "美國內分泌學會與台灣骨質疏鬆症學會：維生素D 30 ng/mL 為足夠、世界衛生組織骨密度 T 值分期",
    "美國心臟協會 hs-CRP 心血管風險分層：<1 低、1-3 中、>3 高",
  ],
};

const FOOD_DB = [
  {
    id: "grain",
    name: "全穀雜糧類",
    tip: "以未精製全榖雜糧取代白飯白麵，纖維愈高愈能延緩血糖上升。",
    items: [
      { name: "糙米／燕麥／藜麥", light: "green" },
      { name: "地瓜／南瓜（適量）", light: "green" },
      { name: "全麥麵包／全麥麵條", light: "green" },
      { name: "白米飯（適量）", light: "yellow" },
      { name: "白吐司／冬粉／河粉", light: "yellow" },
      { name: "蘿蔔糕、油飯、甜年糕", light: "red" },
      { name: "精緻糕點、酥皮類點心", light: "red" },
    ],
  },
  {
    id: "protein",
    name: "豆魚蛋肉類",
    tip: "優先選擇清蒸、水煮、烤的烹調方式，並選瘦肉去皮。",
    items: [
      { name: "豆腐／無糖豆漿", light: "green" },
      { name: "魚類（清蒸、烤）", light: "green" },
      { name: "雞蛋／雞胸肉（去皮）", light: "green" },
      { name: "瘦豬肉、牛肉（適量）", light: "yellow" },
      { name: "培根、香腸、熱狗", light: "red" },
      { name: "炸雞、鹹酥雞、內臟油炸", light: "red" },
    ],
  },
  {
    id: "dairy",
    name: "乳品類",
    tip: "選擇無加糖、低脂的乳品，避免調味乳與煉乳。",
    items: [
      { name: "低脂／脫脂鮮奶", light: "green" },
      { name: "無糖優格", light: "green" },
      { name: "全脂鮮奶、起司（適量）", light: "yellow" },
      { name: "調味乳、煉乳、冰淇淋", light: "red" },
    ],
  },
  {
    id: "veg",
    name: "蔬菜類",
    tip: "每餐至少半碗至一平碗蔬菜，非澱粉類蔬菜幾乎可以放心多吃。",
    items: [
      { name: "葉菜類、菇類、瓜類、海藻", light: "green" },
      { name: "南瓜、玉米筍（澱粉稍高）", light: "yellow" },
      { name: "糖醋／大量勾芡烹調的蔬菜", light: "red" },
      { name: "高鹽醃漬蔬菜", light: "red" },
    ],
  },
  {
    id: "fruit",
    name: "水果類",
    tip: "每天約兩份拳頭大，選低GI原態水果，避免果汁與果乾。",
    items: [
      { name: "芭樂、小番茄、奇異果、蘋果", light: "green" },
      { name: "香蕉、葡萄、芒果（適量）", light: "yellow" },
      { name: "果汁、水果乾、糖漬水果罐頭", light: "red" },
    ],
  },
  {
    id: "fat",
    name: "油脂與堅果種子類",
    tip: "原味堅果一天一小把即可，避免油炸與反式脂肪。",
    items: [
      { name: "原味堅果（一小把）、橄欖油", light: "green" },
      { name: "無加糖花生醬（適量）", light: "yellow" },
      { name: "奶油、豬油、人造奶油", light: "red" },
      { name: "重複使用的油炸油", light: "red" },
    ],
  },
  {
    id: "sugar",
    name: "精緻糖／含糖飲料",
    tip: "含糖飲料是血糖與體重最大的隱形殺手，建議以白開水、無糖茶取代。",
    items: [
      { name: "白開水、無糖茶、無糖咖啡", light: "green" },
      { name: "70%以上黑巧克力（少量）", light: "yellow" },
      { name: "手搖飲、汽水、果汁飲料", light: "red" },
      { name: "蛋糕、糖果、煉乳、蜂蜜（大量）", light: "red" },
    ],
  },
  {
    id: "alcohol",
    name: "酒精及加工食品",
    tip: "加工食品普遍高油高鹽高糖，酒精則會影響肝臟代謝與血糖穩定。",
    items: [
      { name: "偶爾社交飲酒（適量）", light: "yellow" },
      { name: "各類酒精飲品（經常飲用）", light: "red" },
      { name: "泡麵、加工肉品、油炸速食", light: "red" },
    ],
  },
];

/* ----------------------------------------------------------------------- */
/* Helper / calculation functions                                          */
/* ----------------------------------------------------------------------- */

function calcBMI(weightKg, heightCm) {
  const w = parseFloat(weightKg);
  const h = parseFloat(heightCm);
  if (!w || !h) return null;
  const m = h / 100;
  return w / (m * m);
}

function bmiCategory(bmi) {
  if (bmi == null || isNaN(bmi)) return { label: "—", tone: "neutral" };
  if (bmi < 18.5) return { label: "體重過輕", tone: "yellow" };
  if (bmi < 24) return { label: "正常範圍", tone: "green" };
  if (bmi < 27) return { label: "體重過重", tone: "yellow" };
  return { label: "肥胖", tone: "red" };
}

function calcRiskScore(profile) {
  if (!profile) return 0;
  const bmi = calcBMI(profile.weight, profile.height);
  let score = 0;
  if (bmi != null) {
    if (bmi >= 27) score += 35;
    else if (bmi >= 24) score += 20;
  }
  const symptomCount = (profile.symptoms || []).length;
  score += Math.min(symptomCount * 8, 40);
  if (profile.activityLevel === "sedentary") score += 15;
  else if (profile.activityLevel === "light") score += 8;
  if (parseInt(profile.age, 10) >= 45) score += 10;
  return Math.max(0, Math.min(100, score));
}

function riskZone(score) {
  if (score <= 33)
    return { label: "低度關注", tone: "green", advice: "目前生活型態指標大致良好，請維持均衡飲食與規律運動習慣。" };
  if (score <= 66)
    return { label: "中度關注", tone: "yellow", advice: "建議加強飲食控制與運動頻率，並定期追蹤體態變化。" };
  return {
    label: "高度關注",
    tone: "red",
    advice: "建議盡快諮詢醫師或營養師，並安排血糖相關檢查以確認目前狀況。",
  };
}

function buildExercisePlan(profile) {
  const cautions = [];
  const symptoms = profile?.symptoms || [];
  const bmi = calcBMI(profile?.weight, profile?.height);
  const age = parseInt(profile?.age, 10) || 0;
  const isObese = bmi != null && bmi >= 27;
  const cardioRisk = symptoms.includes("hypertension") || symptoms.includes("cardio");

  if (age >= 65) {
    cautions.push("您的年齡建議優先選擇低衝擊運動（如超慢跑、太極），運動前務必充分熱身。");
  }
  if (cardioRisk) {
    cautions.push("您有心血管相關風險因子，建議先諮詢醫師評估合適的運動強度，運動中留意心跳與不適感。");
  }
  if (isObese) {
    cautions.push("您的BMI偏高，建議優先選擇對關節負擔較小的運動，如超慢跑、飛輪，待體能提升後再增加強度。");
  }
  if (symptoms.includes("sedentary")) {
    cautions.push("目前活動量較少，建議先從每天10分鐘超慢跑開始，再逐週增加時間與強度。");
  }
  if (symptoms.includes("prediabetes")) {
    cautions.push(
      "您已被醫師告知糖尿病前期／血糖偏高，建議避免空腹或飯前運動，隨身攜帶方糖等含糖食物以防低血糖；若有測血糖習慣，血糖高於250mg/dL或低於80mg/dL時不宜運動。"
    );
  }

  const lowImpact = age >= 65 || cardioRisk || isObese;

  const aerobic = lowImpact ? "超慢跑／飛輪（固定式腳踏車）" : "超慢跑／騎自行車／羽球";
  const aerobicShort = lowImpact ? "超慢跑／飛輪" : "超慢跑／騎車";
  const resistanceLabel = "阻力訓練（彈力帶或自身體重：深蹲、伏地挺身）";
  const resistanceLabelShort = "阻力訓練";

  /**
   * The week, as seven rows.
   *
   * `day`/`activity`/`duration`/`intensity` are the sentence a person reads.
   * The rest is what the screen needs to draw it as something other than a
   * table: `dow` to line a row up with a real weekday, `category` to pick the
   * character, `short` for the narrow phone layout, and `level` (1 低, 2 中等,
   * 3 高) so intensity can be three dots instead of a parenthetical.
   */
  const weeklyTemplate = [
    { day: "週一", dow: 1, category: "aerobic", short: aerobicShort, activity: aerobic, duration: "30 分鐘", minutes: 30, intensity: "中等（有點喘但仍可說話）", level: 2 },
    { day: "週二", dow: 2, category: "resistance", short: resistanceLabelShort, activity: resistanceLabel, duration: "20-30 分鐘", minutes: 20, intensity: "中等", level: 2 },
    { day: "週三", dow: 3, category: "aerobic", short: aerobicShort, activity: aerobic, duration: "30 分鐘", minutes: 30, intensity: "中等", level: 2 },
    { day: "週四", dow: 4, category: "flexibility", short: "伸展／太極／瑜伽", activity: "伸展／太極／瑜伽（主動恢復）", duration: "20 分鐘", minutes: 20, intensity: "低", level: 1 },
    { day: "週五", dow: 5, category: "aerobic", short: aerobicShort, activity: aerobic, duration: "30 分鐘", minutes: 30, intensity: "中等", level: 2 },
    { day: "週六", dow: 6, category: "resistance", short: resistanceLabelShort, activity: resistanceLabelShort, duration: "20-30 分鐘", minutes: 20, intensity: "中等", level: 2 },
    { day: "週日", dow: 0, category: "aerobic", short: "散步或喜愛的活動", activity: "戶外散步或喜愛的休閒活動", duration: "30-45 分鐘", minutes: 30, intensity: "低至中等", level: 1 },
  ];

  const dailyHabits = [
    "三餐飯後散步 15-20 分鐘，有助穩定飯後血糖上升幅度。",
    "每坐 1 小時起身活動 2-3 分鐘，避免長時間久坐。",
    "每週累積達到 150 分鐘中等強度有氧運動的目標。",
  ];

  return { cautions, weeklyTemplate, dailyHabits, weeklyMinutesTarget: 150 };
}

/** Compares actual logged exercise minutes (rolling 7 days) against the
 * weekly target, and checks whether aerobic/resistance/flexibility work is
 * reasonably balanced, returning a short list of encouraging suggestions. */
function buildExerciseWeeklyFeedback(exerciseLog, weeklyMinutesTarget) {
  const cutoff = daysAgoStr(6);
  const weekEntries = exerciseLog.filter((e) => e.date >= cutoff);
  const totalMinutes = weekEntries.reduce((s, e) => s + (Number(e.durationMin) || 0), 0);
  const pct = weeklyMinutesTarget ? Math.round((totalMinutes / weeklyMinutesTarget) * 100) : 0;

  const categoryCount = { aerobic: 0, resistance: 0, flexibility: 0, other: 0 };
  weekEntries.forEach((e) => {
    const opt = ACTIVITY_LOG_OPTIONS.find((o) => o.id === e.activityId);
    const cat = opt ? opt.category : "other";
    if (categoryCount[cat] != null) categoryCount[cat] += 1;
  });

  const suggestions = [];
  if (totalMinutes === 0) {
    suggestions.push("本週還沒有運動紀錄，先安排一次 10-15 分鐘的超慢跑開始吧！");
  } else if (pct >= 100) {
    suggestions.push(`本週已累積 ${totalMinutes} 分鐘，達成 ${weeklyMinutesTarget} 分鐘目標，非常棒，繼續保持！`);
  } else {
    const remain = Math.max(weeklyMinutesTarget - totalMinutes, 0);
    suggestions.push(`本週已累積 ${totalMinutes} 分鐘，還差 ${remain} 分鐘就能達成 ${weeklyMinutesTarget} 分鐘的目標。`);
  }
  if (categoryCount.resistance === 0) {
    suggestions.push("本週還沒有阻力／肌耐力訓練的紀錄，建議安排一次 15-20 分鐘。");
  }
  if (categoryCount.aerobic === 0 && totalMinutes > 0) {
    suggestions.push("本週還沒有有氧運動的紀錄，建議安排超慢跑、羽球等活動。");
  }

  return { totalMinutes, pct: Math.min(pct, 999), categoryCount, suggestions };
}

function buildWeeklyExerciseChartData(exerciseLog) {
  const days = [];
  for (let i = 6; i >= 0; i--) days.push(daysAgoStr(i));
  return days.map((d) => {
    const total = exerciseLog.filter((e) => e.date === d).reduce((s, e) => s + (Number(e.durationMin) || 0), 0);
    return { date: d.slice(5), total: Math.round(total) };
  });
}

function todayStr() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function nowTimeStr() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function daysAgoStr(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const pad = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function fmtNum(v, digits = 1) {
  if (v === null || v === undefined || v === "" || isNaN(v)) return "—";
  return Number(v).toFixed(digits);
}

/** Estimate a reference daily calorie target, returning a breakdown so the
 * UI can show whether it's using today's/latest logged BMR (e.g. from an
 * OMRON body-composition scale) or a formula-estimated fallback. A modest
 * ~500kcal reduction is applied when BMI indicates overweight/obesity,
 * bounded by a safety floor. This is a general estimate for reference only. */
function calcDailyCalorieTargetBreakdown(profile, latestRecord) {
  if (!profile?.weight || !profile?.height) return null;
  const weight = Number(profile.weight);
  const height = Number(profile.height);

  const hasRecordBmr = latestRecord?.bmr != null && latestRecord.bmr !== "";
  const hasAge = profile.age !== "" && profile.age != null && !isNaN(Number(profile.age));

  /* Age is optional. A measured BMR from the scale needs no age at all; the
   * Mifflin-St Jeor fallback does, so without either there is no honest way
   * to state a target and we return none rather than inventing one. The UI
   * explains which of the two would unblock it. */
  if (!hasRecordBmr && !hasAge) return null;

  const age = Number(profile.age);
  let bmr;
  if (hasRecordBmr) {
    bmr = Number(latestRecord.bmr);
  } else if (profile.gender === "male") {
    bmr = 10 * weight + 6.25 * height - 5 * age + 5;
  } else {
    bmr = 10 * weight + 6.25 * height - 5 * age - 161;
  }
  bmr = Math.round(bmr);

  const activityFactorMap = { sedentary: 1.2, light: 1.375, active: 1.55 };
  const factor = activityFactorMap[profile.activityLevel] || 1.2;
  let target = bmr * factor;

  const bmi = calcBMI(weight, height);
  const deficitApplied = bmi != null && bmi >= 24;
  if (deficitApplied) target -= 500;

  const floor = profile.gender === "male" ? 1500 : 1200;
  const flooredApplied = target < floor;
  target = Math.round(Math.max(target, floor));

  return {
    target,
    bmr,
    bmrSource: hasRecordBmr ? "record" : "formula",
    bmrSourceDate: hasRecordBmr ? latestRecord.date : null,
    activityFactor: factor,
    deficitApplied,
    flooredApplied,
  };
}

function calcDailyCalorieTarget(profile, latestRecord) {
  const breakdown = calcDailyCalorieTargetBreakdown(profile, latestRecord);
  return breakdown ? breakdown.target : null;
}

/** Estimate a reference daily water intake target in ml, returning a full
 * breakdown so the UI can show exactly how the number was derived. Uses the
 * higher of two commonly-cited methods: (a) 30ml per kg body weight, and (b)
 * Taiwan HPA's general adult baseline (male 2400ml / female 2100ml total
 * fluid intake), then adds a modest allowance for activity level.
 *
 * Prefers today's/most-recent OMRON body-tracking weight over the static
 * profile weight, so the target stays current as your measured weight
 * changes — same principle as the calorie target preferring the latest
 * logged BMR. This is a general wellness reference only — people with
 * kidney disease, heart failure, or other conditions requiring fluid
 * restriction should follow their doctor's guidance instead. */
function calcWaterTargetBreakdown(profile, latestRecord) {
  const usingLatest = latestRecord?.weight != null && latestRecord.weight !== "";
  const weight = Number(usingLatest ? latestRecord.weight : profile?.weight);
  if (!weight) return null;

  const weightBased = Math.round(weight * 30);
  const genderBase = profile?.gender === "male" ? 2400 : 2100;
  const baseTarget = Math.max(weightBased, genderBase);
  const usedWeightBased = weightBased >= genderBase;

  let activityAdd = 0;
  if (profile?.activityLevel === "active") activityAdd = 500;
  else if (profile?.activityLevel === "light") activityAdd = 200;

  const rawTarget = Math.min(baseTarget + activityAdd, 4000);
  const target = Math.round(rawTarget / 50) * 50;

  return {
    target,
    weight,
    weightSource: usingLatest ? "record" : "profile",
    weightSourceDate: usingLatest ? latestRecord.date : null,
    weightBased,
    genderBase,
    usedWeightBased,
    activityAdd,
  };
}

function calcWaterTarget(profile, latestRecord) {
  const breakdown = calcWaterTargetBreakdown(profile, latestRecord);
  return breakdown ? breakdown.target : null;
}

function waterMood(pct) {
  if (pct >= 100) return "party";
  if (pct >= 60) return "happy";
  if (pct >= 25) return "neutral";
  return "sleepy";
}

function calorieZone(consumed, target) {
  if (target == null) return "neutral";
  const ratio = consumed / target;
  if (ratio < 0.8) return "green";
  if (ratio <= 1.05) return "yellow";
  return "red";
}

function buildWeeklyCalorieData(foodLog) {
  const days = [];
  for (let i = 6; i >= 0; i--) days.push(daysAgoStr(i));
  return days.map((d) => {
    const total = foodLog.filter((e) => e.date === d).reduce((s, e) => s + (Number(e.estimatedCalories) || 0), 0);
    return { date: d.slice(5), total: Math.round(total) };
  });
}

export {
  LAB_MARKERS,
  labMarker,
  labZonesFor,
  labZone,
  metabolicSyndrome,
  METABOLIC_SYNDROME_THRESHOLD,
  outOfRangeMarkers,
  isPlausibleLabValue,
  labNumber,
  LAB_FLAGS,
  FLAG_VALUES,
  labFlag,
  isFlagValue,
  positiveFlags,
  SYMPTOM_OPTIONS,
  deriveActivityLevel,
  ACTIVITY_LOG_OPTIONS,
  ACTIVITY_CATEGORY_LABEL,
  LIGHT_META,
  BMI_ZONES,
  bodyFatZones,
  skeletalMuscleZones,
  waistZones,
  sleepZones,
  CONTENT_REVIEW,
  FOOD_DB,
  calcBMI,
  bmiCategory,
  calcRiskScore,
  riskZone,
  buildExercisePlan,
  buildExerciseWeeklyFeedback,
  buildWeeklyExerciseChartData,
  todayStr,
  nowTimeStr,
  daysAgoStr,
  fmtNum,
  calcDailyCalorieTargetBreakdown,
  calcDailyCalorieTarget,
  calcWaterTargetBreakdown,
  calcWaterTarget,
  waterMood,
  calorieZone,
  buildWeeklyCalorieData,
};
