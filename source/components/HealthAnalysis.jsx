/**
 * 健康分析 — the health check report, and what it means for this week.
 *
 * The screen is ordered by what a person can act on, not by what is easiest to
 * compute: this week's focus first, then the month, then the report itself,
 * then the form for adding another. A page that opens on a table of blood
 * values is a page about numbers; this one is meant to be about what to do
 * next, with the numbers behind it as evidence.
 *
 * Two things this screen must never do, both enforced by tools/test-plan.mjs:
 * diagnose anything, or predict what a number will do. Every value is shown
 * next to the published range it is being compared against, so what is on
 * screen is a comparison the reader can check rather than a verdict.
 *
 * The report photo is read and then thrown away — only the confirmed numbers
 * are stored. See lib/reports.js.
 */

import React, { useMemo, useState } from "react";
import { Camera, Image as ImageIcon, Trash2, Info, Check, Loader2, Plus, RefreshCw } from "lucide-react";
import {
  LAB_MARKERS,
  LAB_FLAGS,
  flagValues,
  isFlagPositive,
  labZone,
  labMarker,
  metabolicSyndrome,
  positiveFlags,
  fmtNum,
  todayStr,
} from "../lib/health.js";
import { cleanValues, emptyDraft, latestReport, markerChange, mergeReadings, MAX_PAGES } from "../lib/reports.js";
import { weeklyPlan, monthlyAnalysis, monthsWithData, monthOf, isMonthEnd, CYCLE_DAYS } from "../lib/plan.js";
import ClinicVisits from "./ClinicVisits.jsx";

const GROUP_LABEL = {
  sugar: "血糖",
  lipid: "血脂",
  pressure: "血壓",
  blood: "血液計數",
  liver: "肝功能",
  kidney: "腎功能",
  thyroid: "甲狀腺",
  mineral: "電解質與營養素",
  inflammation: "發炎指標",
  tumour: "腫瘤標記",
  eye: "眼睛",
  bone: "骨質",
  other: "其他",
  body: "身體數值",
};

/* Read in the order a report is usually laid out, and the order she is most
   likely to care about: the three this app is built around first. */
const GROUP_ORDER = [
  "sugar",
  "lipid",
  "pressure",
  "blood",
  "liver",
  "kidney",
  "thyroid",
  "mineral",
  "inflammation",
  "tumour",
  "eye",
  "bone",
  "other",
  "body",
];

/* Which groups the manual form opens with. Forty-one fields at once is a wall;
   these are the ones this app is actually about, and the rest are one tap
   away. Any group that already has a value is opened regardless. */
const DEFAULT_OPEN = ["sugar", "lipid", "pressure"];

/**
 * The one-word verdict.
 *
 * The zone label already carries the numbers（「糖尿病前期範圍 100-125」）, but a
 * range is something you read, not something you see. This is the word that
 * gets the colour and the size, with the range underneath it in small type as
 * the evidence.
 */
function verdictWord(zone, marker) {
  if (!zone) return null;
  if (zone.tone === "green") return "正常";
  if (zone.tone === "yellow") return "留意";
  return marker && marker.referral ? "需就醫" : "注意";
}

/**
 * How the whole report looks in three numbers.
 *
 * A report is forty rows of tiny type; this is the sentence a person actually
 * wants first. Values she cannot act on herself are counted separately from
 * values she can, because those are two different kinds of news.
 */
function summarise(report, gender) {
  const counts = { green: 0, watch: 0, refer: 0 };
  if (!report) return counts;

  for (const marker of LAB_MARKERS) {
    const value = report.values ? report.values[marker.key] : null;
    const zone = labZone(marker.key, value, gender);
    if (!zone) continue;
    if (zone.tone === "green") counts.green += 1;
    else if (marker.referral) counts.refer += 1;
    else counts.watch += 1;
  }
  for (const flag of LAB_FLAGS) {
    const value = report.flags ? report.flags[flag.key] : null;
    if (!value) continue;
    if (isFlagPositive(flag.key, value)) counts.refer += 1;
    else counts.green += 1;
  }
  return counts;
}

function ReportSummary({ counts }) {
  const total = counts.green + counts.watch + counts.refer;
  if (!total) return null;
  return (
    <div className="rs-strip">
      <div className="rs-cell green">
        <strong>{counts.green}</strong>
        <span>在範圍內</span>
      </div>
      <div className={`rs-cell watch ${counts.watch ? "" : "is-zero"}`}>
        <strong>{counts.watch}</strong>
        <span>要留意</span>
      </div>
      <div className={`rs-cell refer ${counts.refer ? "" : "is-zero"}`}>
        <strong>{counts.refer}</strong>
        <span>問醫師</span>
      </div>
    </div>
  );
}

/**
 * One measured value.
 *
 * Four columns: a colour bar you can scan down, the name, the number, and the
 * verdict as a pill. The range sits under the name in small type — it is the
 * evidence for the pill, not the headline.
 */
function ValueRow({ marker, value, gender, change }) {
  const zone = labZone(marker.key, value, gender);
  const tone = zone ? zone.tone : "none";
  const word = verdictWord(zone, marker);

  return (
    <div className={`v-row tone-${tone}`}>
      <div className="v-main">
        <div className="v-name">{marker.label}</div>
        <div className="v-range">{zone ? zone.label : "無參考區間"}</div>
      </div>
      <div className="v-num">
        {fmtNum(value, marker.decimals)}
        <span className="v-unit">{marker.unit}</span>
        {change ? (
          <span className={`v-change ${change.delta < 0 ? "down" : change.delta > 0 ? "up" : ""}`}>
            {change.delta > 0 ? "▲" : change.delta < 0 ? "▼" : "＝"}
            {Math.abs(change.delta)}
          </span>
        ) : null}
      </div>
      {word ? <span className={`v-pill tone-${tone}`}>{word}</span> : <span className="v-pill">—</span>}
    </div>
  );
}

/** A yes/no result, in the same shape as a measured value. */
function FlagRow({ flag, value }) {
  /* Per flag: a stool test answers 陰性／陽性 and an eye exam answers
     正常／異常, so which answer means "see a doctor" is the flag's to say. */
  const positive = isFlagPositive(flag.key, value);
  return (
    <div className={`v-row tone-${positive ? "red" : "green"}`}>
      <div className="v-main">
        <div className="v-name">{flag.label}</div>
        <div className="v-range">{positive ? flag.note : "在正常範圍"}</div>
      </div>
      <div className="v-num">{value}</div>
      <span className={`v-pill tone-${positive ? "red" : "green"}`}>{positive ? "需就醫" : "正常"}</span>
    </div>
  );
}

/**
 * 代謝症候群 — the count, big, then the five criteria as rows.
 *
 * These were five 53px boxes on a phone, which put the cutoff text at 8.5px.
 * Five rows are taller and legible, and the criterion that is met can carry a
 * colour across its whole width.
 */
function MetabolicCard({ result }) {
  const [showNote, setShowNote] = useState(false);
  return (
    <div className="ms-card">
      <div className="ms-top">
        <div className="ms-count">
          <strong className={result.reachesThreshold ? "tone-red" : ""}>{result.met}</strong>
          <span>/ {result.total} 項</span>
        </div>
        <div className="ms-title">
          代謝症候群自我檢查
          <span>{result.reachesThreshold ? "已達「三項以上」的判定標準" : "尚未達到三項"}</span>
        </div>
      </div>

      <div className="ms-rows">
        {result.criteria.map((c) => (
          <div key={c.key} className={`ms-row ${c.met ? "is-met" : ""} ${c.value == null ? "is-unknown" : ""}`}>
            <span className="ms-row-label">{c.short || c.label}</span>
            <span className="ms-row-limit">{c.limit}</span>
            <span className="ms-row-value">{c.value == null ? "未量" : c.value}</span>
          </div>
        ))}
      </div>

      {!result.complete && <p className="ms-warn">還有項目沒有數值，這個數字只是目前量到的部分。</p>}

      <button type="button" className="inline-toggle" onClick={() => setShowNote((v) => !v)}>
        {showNote ? "收起判定標準" : "判定標準與說明"}
      </button>
      {showNote && (
        <p className="ms-note">
          國民健康署的標準是「五項中符合三項以上」：腰圍（男 ≥90、女 ≥80 cm）、
          血壓（收縮 ≥130 或舒張 ≥85 mmHg）、空腹血糖 ≥100 mg/dL、三酸甘油酯 ≥150 mg/dL、
          高密度脂蛋白（男 &lt;40、女 &lt;50 mg/dL）。判定上「已在服藥控制」的項目也算符合，
          這個 App 不知道你有沒有在用藥，請以醫師的判讀為準。
        </p>
      )}
    </div>
  );
}

function FocusCard({ focus }) {
  const p = focus.progress;
  const pct = p ? Math.min(100, Math.round((p.actual / Math.max(p.target, 1)) * 100)) : 0;
  return (
    <div className={`focus-card ${focus.refer ? "is-refer" : ""}`}>
      <div className="focus-title">
        {focus.refer && <span className="focus-tag">請就醫</span>}
        {focus.title}
      </div>
      {focus.why && !focus.items && <div className="focus-why">{focus.why}</div>}
      <div className="focus-action">{focus.action}</div>

      {focus.items && focus.items.length > 0 && (
        <div className="refer-items">
          {focus.items.map((item) => (
            <div className="refer-item" key={item.key}>
              <div className="refer-item-head">{item.detail}</div>
              <div className="refer-item-note">{item.note}</div>
            </div>
          ))}
        </div>
      )}

      {p ? (
        <div className="focus-progress">
          <div className="focus-progress-head">
            <span>{p.label}</span>
            <strong className={p.done ? "tone-green" : ""}>
              {p.actual} / {p.target} {p.unit}
              {p.done ? " ✓" : ""}
            </strong>
          </div>
          <div className="focus-bar">
            <div className={`focus-bar-fill ${p.done ? "is-done" : ""}`} style={{ width: `${pct}%` }} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** The draft read off the photos, or typed in, before it is saved. */
function DraftEditor({ draft, setDraft, rejected, notes, onSave, onCancel, gender }) {
  const setValue = (key, raw) =>
    setDraft((d) => {
      const values = { ...d.values };
      if (raw === "") delete values[key];
      else values[key] = raw;
      return { ...d, values };
    });

  const setFlag = (key, value) =>
    setDraft((d) => {
      const flags = { ...(d.flags || {}) };
      if (value == null) delete flags[key];
      else flags[key] = value;
      return { ...d, flags };
    });

  const filled = LAB_MARKERS.filter((m) => draft.values[m.key] != null && draft.values[m.key] !== "");
  const flagCount = Object.keys(draft.flags || {}).length;
  const { rejected: nowRejected } = cleanValues(draft.values);

  /* Groups start open when they hold something — a photo that read fifteen
     values across six panels should show all fifteen without hunting. */
  const [openGroups, setOpenGroups] = useState(() => {
    const withValues = GROUP_ORDER.filter((g) =>
      LAB_MARKERS.some((m) => m.group === g && draft.values[m.key] != null && draft.values[m.key] !== "")
    );
    const flagsOpen = Object.keys(draft.flags || {}).length ? ["flags"] : [];
    return [...new Set([...DEFAULT_OPEN, ...withValues, ...flagsOpen])];
  });
  const toggleGroup = (group) =>
    setOpenGroups((list) => (list.includes(group) ? list.filter((g) => g !== group) : [...list, group]));

  return (
    <div className="draft-box">
      <div className="section-title" style={{ fontSize: "13px", marginBottom: "4px" }}>
        確認報告內容
      </div>
      <p className="draft-hint">
        辨識可能有誤，請對照報告核對後再儲存。空白的欄位表示沒有讀到，可以自己補上；不需要的留白即可。
      </p>

      {rejected && rejected.length > 0 && (
        <div className="draft-warn">
          <Info size={13} />
          <span>
            {rejected
              .map((r) => `${r.label}（${r.page ? `第 ${r.page} 張，` : ""}讀到 ${r.value}）`)
              .join("、")}
            看起來不像正常的檢驗值，已經先不填入，請自己對照報告輸入。
          </span>
        </div>
      )}

      {/* A disagreement between two photos means one of them was misread, and
          which one is not something the app can know — so both numbers are
          shown rather than one being picked quietly. */}
      {notes && notes.conflicts && notes.conflicts.length > 0 && (
        <div className="draft-warn">
          <Info size={13} />
          <span>
            有幾項在不同張照片上讀到不一樣的數字：
            {notes.conflicts
              .map(
                (c) =>
                  `${c.label} 第 ${c.keptPage} 張是 ${c.kept}、第 ${c.otherPage} 張是 ${c.other}（先採用 ${c.kept}）`
              )
              .join("；")}
            。請對照報告確認哪一個才對。
          </span>
        </div>
      )}

      {notes && notes.failedPages && notes.failedPages.length > 0 && (
        <div className="draft-warn">
          <Info size={13} />
          <span>第 {notes.failedPages.join("、")} 張讀不出來，那幾張上的數值請自己補上。</span>
        </div>
      )}

      {notes && notes.unreadable && notes.unreadable.length > 0 && (
        <div className="draft-warn">
          <Info size={13} />
          <span>這幾項照片上看不清楚：{notes.unreadable.join("、")}，請自己對照報告輸入。</span>
        </div>
      )}

      <div className="field-row">
        <div className="field">
          <label>報告日期</label>
          <input type="date" value={draft.date} onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))} />
        </div>
        <div className="field">
          <label>名稱（選填）</label>
          <input
            type="text"
            value={draft.title}
            placeholder="例：公司健檢"
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
          />
        </div>
      </div>

      {GROUP_ORDER.map((group) => {
        const markers = LAB_MARKERS.filter((m) => m.group === group);
        if (!markers.length) return null;
        const filledHere = markers.filter((m) => draft.values[m.key] != null && draft.values[m.key] !== "").length;
        const open = openGroups.includes(group);
        return (
          <div key={group} className="draft-group">
            <button type="button" className="draft-group-toggle" onClick={() => toggleGroup(group)}>
              <span>{GROUP_LABEL[group]}</span>
              {filledHere > 0 && <span className="draft-group-count">{filledHere} 項</span>}
              <span className="draft-group-caret">{open ? "▲" : "▼"}</span>
            </button>
            {open &&
              markers.map((m) => (
                <div className="draft-field" key={m.key}>
                  <label>
                    {m.label}
                    <span className="lab-unit">{m.unit}</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    inputMode="decimal"
                    value={draft.values[m.key] ?? ""}
                    onChange={(e) => setValue(m.key, e.target.value)}
                  />
                </div>
              ))}
          </div>
        );
      })}

      {/* The yes/no page of the report. Three states, because "not tested" and
          "tested and negative" are different things and next year's comparison
          needs to tell them apart. */}
      <div className="draft-group">
        <button type="button" className="draft-group-toggle" onClick={() => toggleGroup("flags")}>
          <span>其他檢查（眼睛、尿液、糞便、肝炎）</span>
          {flagCount > 0 && <span className="draft-group-count">{flagCount} 項</span>}
          <span className="draft-group-caret">{openGroups.includes("flags") ? "▲" : "▼"}</span>
        </button>
        {openGroups.includes("flags") &&
          LAB_FLAGS.map((f) => (
            <div className="draft-flag" key={f.key}>
              <span className="draft-flag-label">{f.label}</span>
              <span className="draft-flag-chips">
                {flagValues(f.key).map((value) => (
                  <button
                    type="button"
                    key={value}
                    className={`chip ${draft.flags && draft.flags[f.key] === value ? "active" : ""}`}
                    onClick={() => setFlag(f.key, draft.flags && draft.flags[f.key] === value ? null : value)}
                  >
                    {value}
                  </button>
                ))}
              </span>
            </div>
          ))}
      </div>

      {nowRejected.length > 0 && (
        <div className="draft-warn">
          <Info size={13} />
          <span>{nowRejected.map((r) => r.label).join("、")}的數值超出合理範圍，儲存時會略過，請再核對一次。</span>
        </div>
      )}

      <div className="analysis-actions" style={{ marginTop: "10px" }}>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          取消
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={onSave}
          disabled={!draft.date || (!filled.length && !flagCount)}
        >
          <Check size={13} /> 儲存報告
        </button>
      </div>
      {!draft.date && <p className="draft-hint">請先填報告日期。</p>}
    </div>
  );
}

/**
 * 其他資訊 —— the four reference lists, one open at a time.
 *
 * They were four full cards stacked below the page: the report's values, the
 * follow-up reminders, the screening suggestions and the report history, well
 * over four thousand pixels of it, and on any given visit she wants one of
 * them. An accordion keeps every one findable at a fixed, small cost.
 *
 * 回診與檢查提醒 is the default because it is the only one of the four that can
 * be overdue — the rest are things she goes looking for.
 */
const OTHER_SECTIONS = [
  /* Red, and carrying the number of items, because this is the one fold whose
     contents are markers a doctor has to read. Folded away with a plain header
     it would be indistinguishable from the reference lists; folded away with a
     red one it is still the thing that catches the eye on this card. */
  {
    key: "refer",
    label: "這幾項請帶報告去問醫師",
    tone: "alert",
    only: (c) => Boolean(c.refer),
    badge: (c) => (c.refer ? c.refer.items.length : 0),
    render: (c) => c.referCard,
  },
  { key: "reminders", label: "回診與檢查提醒", render: (c) => c.reminders },
  { key: "report", label: "健檢報告數值", render: (c) => c.report },
  { key: "suggestions", label: "建議安排的檢查", render: (c) => c.suggestions },
  /* The card inside only renders with more than one report, so the fold must
     appear on the same condition — otherwise it opens onto nothing. */
  { key: "history", label: "報告紀錄", only: (c) => c.historyCount > 1, badge: (c) => c.historyCount, render: (c) => c.history },
];

export default function HealthAnalysis({
  profile,
  latestRecord,
  records = [],
  reports = [],
  summaries = [],
  foodLog = [],
  exerciseLog = [],
  waterLog = [],
  onAnalyzeReportPhoto,
  onSaveReport,
  onDeleteReport,
  visits = [],
  onSaveVisit,
  onDeleteVisit,
  onToggleVisitDone,
  plans = [],
  onSavePlan,
  onDeletePlan,
  onTogglePlanDone,
  onAddToCalendar,
  today = todayStr(),
}) {
  const [draft, setDraft] = useState(null);
  const [rejected, setRejected] = useState([]);
  const [notes, setNotes] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  /** Which photo of how many is being read, so a five-page report does not
   *  look like the app has hung. */
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState("");
  const [month, setMonth] = useState(monthOf(today));
  const [showHistory, setShowHistory] = useState(false);
  /* The uploader sits at the top of the page but folded: the entry point has to
     be findable, the space does not have to be permanently given up for
     something used once or twice a year. */
  const [showUpload, setShowUpload] = useState(false);
  /* Which of the four reference lists is open. Reminders to start with: it is
     the only one of them that can be overdue. */
  const [otherOpen, setOtherOpen] = useState("reminders");
  /* The in-range values start collapsed. They are the majority of a report and
     the least useful part of it: a page that opens on thirty 「正常」 rows buries
     the three that are not. */
  const [showNormal, setShowNormal] = useState(false);

  const gender = profile && profile.gender === "male" ? "male" : "female";
  const report = latestReport(reports);

  const plan = useMemo(
    () => weeklyPlan({ report, profile, summaries, foodLog, exerciseLog, waterLog, today }),
    [report, profile, summaries, foodLog, exerciseLog, waterLog, today]
  );

  const months = useMemo(() => {
    const found = monthsWithData({ summaries, foodLog, records });
    return found.length ? found : [monthOf(today)];
  }, [summaries, foodLog, records, today]);

  const review = useMemo(
    () => monthlyAnalysis({ month, summaries, foodLog, exerciseLog, waterLog, records, report, profile, today }),
    [month, summaries, foodLog, exerciseLog, waterLog, records, report, profile, today]
  );

  const counts = useMemo(() => summarise(report, gender), [report, gender]);

  /* Split once, here, so both the summary and the list agree on what counts
     as needing attention. */
  const rows = useMemo(() => {
    if (!report) return { attention: [], normal: [] };
    const attention = [];
    const normal = [];
    for (const marker of LAB_MARKERS) {
      const value = report.values ? report.values[marker.key] : null;
      if (value == null) continue;
      const zone = labZone(marker.key, value, gender);
      const entry = { marker, value, zone };
      if (zone && zone.tone !== "green") attention.push(entry);
      else normal.push(entry);
    }
    /* Worst first: red before yellow, so the top of the list is the top of
       her list too. */
    const rank = { red: 0, yellow: 1 };
    attention.sort((a, b) => (rank[a.zone.tone] ?? 9) - (rank[b.zone.tone] ?? 9));
    return { attention, normal };
  }, [report, gender]);

  const flagRows = useMemo(() => {
    if (!report || !report.flags) return { positive: [], negative: [] };
    const recorded = LAB_FLAGS.filter((f) => report.flags[f.key]);
    const positive = recorded.filter((f) => isFlagPositive(f.key, report.flags[f.key]));
    const negative = recorded.filter((f) => !isFlagPositive(f.key, report.flags[f.key]));
    return { positive, negative };
  }, [report]);

  const ms = useMemo(
    () =>
      metabolicSyndrome({
        values: report ? report.values : {},
        waistCm: latestRecord && latestRecord.waist ? latestRecord.waist : null,
        gender,
      }),
    [report, latestRecord, gender]
  );

  /**
   * Read one or more photos of the same report into a single draft.
   *
   * Read one at a time rather than all at once: the free Gemini tier is rate
   * limited, and ten parallel requests would fail as a batch where ten
   * sequential ones succeed. A page that fails is recorded and the rest carry
   * on — losing one page of a five-page report should not lose the other four.
   */
  async function handlePhotos(fileList) {
    const files = [...(fileList || [])].slice(0, MAX_PAGES);
    if (!files.length) return;

    setError("");
    setNotes(null);
    setRejected([]);
    setDraft(null);
    setAnalyzing(true);

    const readings = [];
    let lastError = null;

    for (let i = 0; i < files.length; i++) {
      setProgress({ done: i, total: files.length });
      try {
        readings.push(await onAnalyzeReportPhoto(files[i]));
      } catch (e) {
        lastError = e;
        readings.push(null);
      }
    }
    setProgress(null);
    setAnalyzing(false);

    const merged = mergeReadings(readings);
    setRejected(merged.rejected);
    setNotes(merged);

    if (!Object.keys(merged.values).length && !Object.keys(merged.flags || {}).length) {
      setError(
        lastError && files.length === 1
          ? lastError.message || "報告辨識失敗，請再試一次，或用手動輸入。"
          : "這些照片讀不到檢驗數值，可以改拍清楚一點，或直接用手動輸入。"
      );
      return;
    }

    setDraft({
      ...emptyDraft(merged.reportDate || today),
      title: merged.labName || "",
      labName: merged.labName || "",
      source: "photo",
      values: merged.values,
      flags: merged.flags || {},
    });
  }

  function saveDraft() {
    onSaveReport(draft);
    setDraft(null);
    setRejected([]);
    setNotes(null);
  }

  const monthEnd = isMonthEnd(today);

  /* 本週重點 is what she can do this week; 「請帶報告去問醫師」 is not that —
     it is a list of markers only a doctor can read, and it sat at the top of
     the card pushing the actual week down. It moves into the folds below,
     where its header is red so folding it does not mean hiding it. */
  const referFocus = plan.focuses.find((f) => f.refer) || null;
  const weekFocuses = plan.focuses.filter((f) => !f.refer);

  /* What the four folds render. Built here rather than inline so the list of
     sections above stays a list of sections. */
  const ctx = {
    reminders: (
      <ClinicVisits part="reminders"      
        visits={visits}
        report={report}
        profile={profile}
        onSaveVisit={onSaveVisit}
        onDeleteVisit={onDeleteVisit}
        onToggleDone={onToggleVisitDone}
        plans={plans}
        onSavePlan={onSavePlan}
        onDeletePlan={onDeletePlan}
        onTogglePlanDone={onTogglePlanDone}
        onAddToCalendar={onAddToCalendar}
        today={today}
      />
    ),
    suggestions: (
      <ClinicVisits part="suggestions"      
        visits={visits}
        report={report}
        profile={profile}
        onSaveVisit={onSaveVisit}
        onDeleteVisit={onDeleteVisit}
        onToggleDone={onToggleVisitDone}
        plans={plans}
        onSavePlan={onSavePlan}
        onDeletePlan={onDeletePlan}
        onTogglePlanDone={onTogglePlanDone}
        onAddToCalendar={onAddToCalendar}
        today={today}
      />
    ),
    report: <>      {/* --- the report ---
          Ordered by what she needs to see: three counts, then everything out
          of range, then the metabolic syndrome check, and the in-range values
          folded away. A report is mostly normal results, and showing thirty of
          them first buries the three that are not. */}
      {report && (
        <div className="card">
          <div className="section-title">
            健檢報告
            <span className="cycle-badge">
              {report.date}
              {report.title ? `・${report.title}` : ""}
            </span>
          </div>

          <ReportSummary counts={counts} />

          {rows.attention.length + flagRows.positive.length > 0 ? (
            <div className="v-block">
              <div className="v-block-title watch">需要注意的項目</div>
              {flagRows.positive.map((f) => (
                <FlagRow key={f.key} flag={f} value={report.flags[f.key]} />
              ))}
              {rows.attention.map(({ marker, value }) => (
                <ValueRow
                  key={marker.key}
                  marker={marker}
                  value={value}
                  gender={gender}
                  change={markerChange(reports, marker.key)}
                />
              ))}
            </div>
          ) : (
            <div className="v-allclear">這份報告量到的項目都在參考範圍內。</div>
          )}

          <MetabolicCard result={ms} />

          {(rows.normal.length > 0 || flagRows.negative.length > 0) && (
            <>
              <button type="button" className="btn btn-secondary btn-block" onClick={() => setShowNormal((v) => !v)}>
                {showNormal
                  ? "收起在範圍內的項目"
                  : `看在範圍內的 ${rows.normal.length + flagRows.negative.length} 項`}
              </button>
              {showNormal && (
                <div className="v-block">
                  {GROUP_ORDER.map((group) => {
                    const inGroup = rows.normal.filter((r) => r.marker.group === group);
                    if (!inGroup.length) return null;
                    return (
                      <div key={group} className="v-group">
                        <div className="v-group-title">{GROUP_LABEL[group]}</div>
                        {inGroup.map(({ marker, value }) => (
                          <ValueRow
                            key={marker.key}
                            marker={marker}
                            value={value}
                            gender={gender}
                            change={markerChange(reports, marker.key)}
                          />
                        ))}
                      </div>
                    );
                  })}
                  {flagRows.negative.length > 0 && (
                    <div className="v-group">
                      <div className="v-group-title">其他檢查</div>
                      {flagRows.negative.map((f) => (
                        <FlagRow key={f.key} flag={f} value={report.flags[f.key]} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          <p className="fine-print">
            分區依據衛福部國民健康署與相關臨床指引的一般成人參考值。各實驗室印在報告上的參考範圍可能不同，
            判讀請以你的報告與醫師的說明為準。
          </p>
        </div>
      )}</>,
    history: <>      {/* --- history --- */}
      {reports.length > 1 && (
        <div className="card">
          <div className="section-title">報告紀錄（{reports.length} 份）</div>
          {(showHistory ? [...reports].reverse() : [...reports].reverse().slice(0, 3)).map((r) => (
            <div className="memory-row" key={r.id}>
              <span className="memory-name">
                {r.date}
                {r.title ? `　${r.title}` : ""}
              </span>
              <span className="memory-times">{Object.keys(r.values).length} 項數值</span>
              <button
                type="button"
                className="icon-btn"
                aria-label={`刪除 ${r.date} 的報告`}
                onClick={() => onDeleteReport(r.id)}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {reports.length > 3 && (
            <button
              type="button"
              className="btn btn-secondary btn-block"
              style={{ marginTop: "10px" }}
              onClick={() => setShowHistory((v) => !v)}
            >
              {showHistory ? "收起" : `展開全部 ${reports.length} 份`}
            </button>
          )}
        </div>
      )}</>,
    historyCount: reports.length,
    refer: referFocus,
    referCard: referFocus ? <FocusCard focus={referFocus} /> : null,
  };

  return (
    <div className="health-page">
      {/* 1. 自行排定的檢查 —— 她自己決定要去做的事，放在最前面。 */}
      <ClinicVisits part="plans"      
        visits={visits}
        report={report}
        profile={profile}
        onSaveVisit={onSaveVisit}
        onDeleteVisit={onDeleteVisit}
        onToggleDone={onToggleVisitDone}
        plans={plans}
        onSavePlan={onSavePlan}
        onDeletePlan={onDeletePlan}
        onTogglePlanDone={onTogglePlanDone}
        onAddToCalendar={onAddToCalendar}
        today={today}
      />

      {/* 上傳擺在最前面，但預設收起來。它本來是這一頁的最後一張卡，在 4600px
          的位置 —— 手上拿著剛拿到的健檢報告時，要從頭捲到底才找得到。
          收起來是因為它一年才用一兩次：入口要找得到，版面不用一直讓給它。 */}
      <div className="card">
        {showUpload ? (
          <>
            <div className="section-title">上傳健檢報告</div>
        <p className="fine-print">
          拍下有數值的頁面，會自動把數字讀出來讓你核對。好幾頁的話，從相簿一次選最多
          {" "}
          {MAX_PAGES} 張，會合併成同一份。<strong>照片不會被儲存</strong>，只留你確認過的數值。
        </p>

        {!draft && (
          <>
            <div className="photo-input-row">
              <label className="btn btn-primary photo-input-label">
                <Camera size={16} /> 拍照
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => {
                    handlePhotos(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
              <label className="btn btn-secondary photo-input-label">
                <ImageIcon size={16} /> 相簿（可多選）
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => {
                    handlePhotos(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-block"
              style={{ marginTop: "8px" }}
              onClick={() => {
                setError("");
                setRejected([]);
                setNotes(null);
                setDraft(emptyDraft(today));
              }}
            >
              <Plus size={14} /> 手動輸入數值
            </button>
          </>
        )}

        {analyzing && (
          <div className="analyzing-row" style={{ justifyContent: "center", padding: "16px 0" }}>
            <Loader2 size={18} className="spin" />
            {progress && progress.total > 1
              ? `正在讀取第 ${progress.done + 1} / ${progress.total} 張…`
              : "正在讀取報告上的數值…"}
          </div>
        )}

        {error && (
          <div className="analysis-error" style={{ marginTop: "8px" }}>
            {error}
            <button
              type="button"
              className="btn btn-secondary btn-block"
              style={{ marginTop: "8px" }}
              onClick={() => {
                setError("");
                setDraft(emptyDraft(today));
              }}
            >
              <RefreshCw size={13} /> 改用手動輸入
            </button>
          </div>
        )}

        {draft && (
          <DraftEditor
            draft={draft}
            setDraft={setDraft}
            rejected={rejected}
            notes={notes}
            gender={gender}
            onSave={saveDraft}
            onCancel={() => {
              setDraft(null);
              setRejected([]);
              setNotes(null);
            }}
          />
        )}
            <button
              type="button"
              className="btn btn-secondary btn-block"
              style={{ marginTop: "10px" }}
              onClick={() => setShowUpload(false)}
            >
              收起
            </button>
          </>
        ) : (
          <button type="button" className="btn btn-primary btn-block" onClick={() => setShowUpload(true)}>
            <Plus size={15} /> 上傳健檢報告
          </button>
        )}
      </div>

      {/* 3. 就醫紀錄 —— 收成一行行的日期，點開才有病症與醫師建議。 */}
      <ClinicVisits part="visits"      
        visits={visits}
        report={report}
        profile={profile}
        onSaveVisit={onSaveVisit}
        onDeleteVisit={onDeleteVisit}
        onToggleDone={onToggleVisitDone}
        plans={plans}
        onSavePlan={onSavePlan}
        onDeletePlan={onDeletePlan}
        onTogglePlanDone={onTogglePlanDone}
        onAddToCalendar={onAddToCalendar}
        today={today}
      />

      {/* --- this week --- */}
      <div className="card">
        <div className="section-title">
          本週重點
          <span className="cycle-badge">
            第 {plan.cycle.index} 週・第 {Math.min(plan.cycle.dayInCycle, CYCLE_DAYS)}/{CYCLE_DAYS} 天
          </span>
        </div>
        <p className="fine-print">
          {plan.hasReport
            ? `依 ${plan.anchor} 的報告安排，這一輪到 ${plan.cycle.end}`
            : "還沒有健檢報告，先顧每天的三項基本目標。上傳報告後這裡會跟著調整。"}
        </p>
        {weekFocuses.map((focus) => (
          <FocusCard key={focus.id} focus={focus} />
        ))}
        {/* Never let it vanish silently: the card says how many there are and
            where they went. */}
        {referFocus && (
          <p className="refer-pointer">
            另有 {referFocus.items.length} 項需要醫師判讀，在下方「其他資訊 → 這幾項請帶報告去問醫師」。
          </p>
        )}
        {weekFocuses.length === 0 && !referFocus && null}
      </div>

      {/* --- the month --- */}
      <div className="card">
        <div className="section-title">
          {monthEnd && month === monthOf(today) ? "本月總分析" : "每月分析"}
          <select className="month-select" value={month} onChange={(e) => setMonth(e.target.value)}>
            {months.map((m) => (
              <option key={m} value={m}>
                {m.replace("-", " 年 ")} 月
              </option>
            ))}
          </select>
        </div>
        {monthEnd && month === monthOf(today) && (
          <p className="fine-print">今天是這個月的最後一天，這是這個月的總結。</p>
        )}

        <div className="month-stats">
          <div>
            <strong>{review.measured.metDays}</strong>
            <span>達標天數</span>
          </div>
          <div>
            <strong>{review.measured.exerciseMinutes}</strong>
            <span>運動分鐘</span>
          </div>
          <div>
            <strong>{review.measured.avgCalories == null ? "—" : review.measured.avgCalories}</strong>
            <span>平均熱量</span>
          </div>
          <div>
            <strong>{review.measured.avgWaterMl == null ? "—" : review.measured.avgWaterMl}</strong>
            <span>平均喝水</span>
          </div>
        </div>

        {review.detailExpired && (
          <p className="fine-print">這個月的飲食／喝水／運動明細已超過保留期限，只剩每天的達標紀錄。</p>
        )}

        {/* A tick or an exclamation on every line, so good and not-yet are
            told apart by shape and colour rather than by remembering which
            heading you are under. */}
        <div className="verdict-list">
          {review.wins.map((line, i) => (
            <div className="verdict-line good" key={`w${i}`}>
              <span className="verdict-mark">✓</span>
              <span>{line}</span>
            </div>
          ))}
          {review.watch.map((line, i) => (
            <div className="verdict-line watch" key={`t${i}`}>
              <span className="verdict-mark">!</span>
              <span>{line}</span>
            </div>
          ))}
        </div>
        {(review.weight || review.waist) && (
          <div className="trend-line">
            {review.weight && (
              <span>
                體重 {review.weight.first} → <strong>{review.weight.last}</strong> kg
              </span>
            )}
            {review.waist && (
              <span>
                腰圍 {review.waist.first} → <strong>{review.waist.last}</strong> cm
              </span>
            )}
          </div>
        )}
      </div>

      {/* 6. 其他資訊 —— 全部是「查得到就好」的東西。一次只開一項：四張攤開的
             卡片加起來有四千多像素，而她多半只想看其中一件。
             回診提醒預設是開的那一項，因為它是唯一會逾期的東西。 */}
      <div className="card">
        <div className="section-title">其他資訊</div>
        {OTHER_SECTIONS.filter((sec) => !sec.only || sec.only(ctx)).map((sec) => {
          const open = otherOpen === sec.key;
          return (
            <div className="fold-section" key={sec.key}>
              <button
                type="button"
                className={`fold-head ${sec.tone === "alert" ? "is-alert" : ""}`}
                aria-expanded={open}
                onClick={() => setOtherOpen(open ? null : sec.key)}
              >
                <span className="fold-title">{sec.label}</span>
                {sec.badge && sec.badge(ctx) > 0 && <span className="fold-count">{sec.badge(ctx)}</span>}
                <span className="fold-caret">{open ? "▲" : "▼"}</span>
              </button>
              {open && <div className="fold-body">{sec.render(ctx)}</div>}
            </div>
          );
        })}
      </div>

      <div className="disclaimer">
        <Info size={14} />
        <span>
          這一頁把報告上的數值和衛福部等單位公布的一般成人參考範圍做比較，並依此安排生活型態上的重點，
          <strong>不是診斷，也不能取代醫師的判讀</strong>。任何用藥、治療或飲食限制的決定，請與你的醫師或營養師討論。
        </span>
      </div>
    </div>
  );
}
