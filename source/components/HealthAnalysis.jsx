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
import { LAB_MARKERS, labZone, labMarker, metabolicSyndrome, fmtNum, todayStr } from "../lib/health.js";
import { cleanValues, emptyDraft, latestReport, markerChange } from "../lib/reports.js";
import { weeklyPlan, monthlyAnalysis, monthsWithData, monthOf, isMonthEnd, CYCLE_DAYS } from "../lib/plan.js";

const GROUP_LABEL = {
  sugar: "血糖",
  lipid: "血脂",
  pressure: "血壓",
  other: "肝腎與尿酸",
  body: "身體數值",
};
const GROUP_ORDER = ["sugar", "lipid", "pressure", "other", "body"];

function ValueRow({ marker, value, gender, change }) {
  const zone = labZone(marker.key, value, gender);
  const tone = zone ? zone.tone : null;
  return (
    <div className="lab-row">
      <div className="lab-name">
        {marker.label}
        <span className="lab-unit">{marker.unit}</span>
      </div>
      <div className="lab-value">
        {fmtNum(value, marker.decimals)}
        {change ? (
          <span className={`lab-change ${change.delta < 0 ? "down" : change.delta > 0 ? "up" : ""}`}>
            {change.delta > 0 ? "▲" : change.delta < 0 ? "▼" : "＝"}
            {Math.abs(change.delta)}
          </span>
        ) : null}
      </div>
      {zone ? <span className={`lab-zone tone-${tone}`}>{zone.label}</span> : <span className="lab-zone">—</span>}
    </div>
  );
}

function MetabolicCard({ result }) {
  return (
    <div className="ms-card">
      <div className="ms-head">
        <span>代謝症候群自我檢查</span>
        <strong className={result.reachesThreshold ? "tone-red" : ""}>
          符合 {result.met} / {result.total} 項
        </strong>
      </div>
      <div className="ms-grid">
        {result.criteria.map((c) => (
          <div key={c.key} className={`ms-item ${c.met ? "is-met" : ""} ${c.value == null ? "is-unknown" : ""}`}>
            <span className="ms-label">{c.short || c.label}</span>
            <span className="ms-limit">{c.limit}</span>
            <span className="ms-value">{c.value == null ? "未量" : c.value}</span>
          </div>
        ))}
      </div>
      <p className="ms-note">
        國民健康署的判定標準是「五項中符合三項以上」：腰圍（男 ≥90、女 ≥80 cm）、
        血壓（收縮 ≥130 或舒張 ≥85 mmHg）、空腹血糖 ≥100 mg/dL、三酸甘油酯 ≥150 mg/dL、
        高密度脂蛋白（男 &lt;40、女 &lt;50 mg/dL）。
        {!result.complete && "目前還有項目沒有數值，所以這個數字只是目前量到的部分。"}
        判定上「已在服藥控制」的項目也算符合，這個 App 不知道你有沒有在用藥，請以醫師的判讀為準。
      </p>
    </div>
  );
}

function FocusCard({ focus }) {
  const p = focus.progress;
  const pct = p ? Math.min(100, Math.round((p.actual / Math.max(p.target, 1)) * 100)) : 0;
  return (
    <div className={`focus-card ${focus.refer ? "is-refer" : ""}`}>
      <div className="focus-title">{focus.title}</div>
      {focus.why && <div className="focus-why">{focus.why}</div>}
      <div className="focus-action">{focus.action}</div>
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

/** The draft read off a photo, or typed in, before it is saved. */
function DraftEditor({ draft, setDraft, rejected, onSave, onCancel, gender }) {
  const setValue = (key, raw) =>
    setDraft((d) => {
      const values = { ...d.values };
      if (raw === "") delete values[key];
      else values[key] = raw;
      return { ...d, values };
    });

  const filled = LAB_MARKERS.filter((m) => draft.values[m.key] != null && draft.values[m.key] !== "");
  const { rejected: nowRejected } = cleanValues(draft.values);

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
            {rejected.map((r) => `${r.label}（讀到 ${r.value}）`).join("、")}
            看起來不像正常的檢驗值，已經先不填入，請自己對照報告輸入。
          </span>
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
        return (
          <div key={group} className="draft-group">
            <div className="draft-group-title">{GROUP_LABEL[group]}</div>
            {markers.map((m) => (
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
        <button type="button" className="btn btn-primary" onClick={onSave} disabled={!draft.date || !filled.length}>
          <Check size={13} /> 儲存報告
        </button>
      </div>
      {!draft.date && <p className="draft-hint">請先填報告日期。</p>}
    </div>
  );
}

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
  today = todayStr(),
}) {
  const [draft, setDraft] = useState(null);
  const [rejected, setRejected] = useState([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [month, setMonth] = useState(monthOf(today));
  const [showHistory, setShowHistory] = useState(false);

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

  const ms = useMemo(
    () =>
      metabolicSyndrome({
        values: report ? report.values : {},
        waistCm: latestRecord && latestRecord.waist ? latestRecord.waist : null,
        gender,
      }),
    [report, latestRecord, gender]
  );

  async function handlePhoto(file) {
    if (!file) return;
    setError("");
    setAnalyzing(true);
    setDraft(null);
    try {
      const result = await onAnalyzeReportPhoto(file);
      const { values, rejected: bad } = cleanValues(result && result.values);
      setRejected(bad);
      if (!Object.keys(values).length) {
        setError("這張照片讀不到檢驗數值，可以改拍清楚一點，或直接用手動輸入。");
        setAnalyzing(false);
        return;
      }
      setDraft({
        ...emptyDraft(result.reportDate || today),
        title: result.labName || "",
        labName: result.labName || "",
        source: "photo",
        values,
      });
    } catch (e) {
      setError(e.message || "報告辨識失敗，請再試一次，或用手動輸入。");
    } finally {
      setAnalyzing(false);
    }
  }

  function saveDraft() {
    onSaveReport(draft);
    setDraft(null);
    setRejected([]);
  }

  const monthEnd = isMonthEnd(today);

  return (
    <>
      {/* --- this week --- */}
      <div className="card">
        <div className="section-title">
          本週重點
          <span className="cycle-badge">
            第 {plan.cycle.index} 週・第 {Math.min(plan.cycle.dayInCycle, CYCLE_DAYS)}/{CYCLE_DAYS} 天
          </span>
        </div>
        <p className="muted-line">
          {plan.hasReport
            ? `從 ${plan.anchor} 那份健檢報告開始，每 7 天一輪。這一輪到 ${plan.cycle.end}。`
            : "還沒有健檢報告，先以每天的三項基本目標為主。上傳報告後，這裡會依報告的數值調整。"}
        </p>
        {plan.focuses.map((focus) => (
          <FocusCard key={focus.id} focus={focus} />
        ))}
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
          <p className="muted-line">今天是這個月的最後一天，這是這個月的總結。</p>
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
          <p className="muted-line">這個月的飲食／喝水／運動明細已經超過保留期限，只剩下每天的達標紀錄。</p>
        )}

        <div className="review-block">
          <div className="review-head tone-green">做到的</div>
          {review.wins.map((line, i) => (
            <div className="review-line" key={i}>
              {line}
            </div>
          ))}
        </div>
        {review.watch.length > 0 && (
          <div className="review-block">
            <div className="review-head">可以再調整的</div>
            {review.watch.map((line, i) => (
              <div className="review-line" key={i}>
                {line}
              </div>
            ))}
          </div>
        )}
        {(review.weight || review.waist) && (
          <p className="muted-line">
            {review.weight && `體重 ${review.weight.first} → ${review.weight.last} kg　`}
            {review.waist && `腰圍 ${review.waist.first} → ${review.waist.last} cm`}
          </p>
        )}
      </div>

      {/* --- the report --- */}
      {report && (
        <div className="card">
          <div className="section-title">
            最新健檢報告
            <span className="cycle-badge">
              {report.date}
              {report.title ? `・${report.title}` : ""}
            </span>
          </div>

          <MetabolicCard result={ms} />

          {GROUP_ORDER.map((group) => {
            const markers = LAB_MARKERS.filter((m) => m.group === group && report.values[m.key] != null);
            if (!markers.length) return null;
            return (
              <div key={group} className="lab-group">
                <div className="lab-group-title">{GROUP_LABEL[group]}</div>
                {markers.map((m) => (
                  <ValueRow
                    key={m.key}
                    marker={m}
                    value={report.values[m.key]}
                    gender={gender}
                    change={markerChange(reports, m.key)}
                  />
                ))}
              </div>
            );
          })}

          <p className="muted-line">
            分區依據衛福部國民健康署與相關臨床指引的一般成人參考值。每家實驗室印在報告上的參考範圍可能不同，
            判讀請以你的報告與醫師的說明為準。
          </p>
        </div>
      )}

      {/* --- adding one --- */}
      <div className="card">
        <div className="section-title">上傳健檢報告</div>
        <p className="muted-line">
          拍下報告上有數值的那一頁，會自動把數字讀出來讓你核對。
          <strong>照片本身不會被儲存</strong>，只留下你確認過的數值。
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
                    handlePhoto(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </label>
              <label className="btn btn-secondary photo-input-label">
                <ImageIcon size={16} /> 從相簿選擇
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    handlePhoto(e.target.files?.[0]);
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
                setDraft(emptyDraft(today));
              }}
            >
              <Plus size={14} /> 手動輸入數值
            </button>
          </>
        )}

        {analyzing && (
          <div className="analyzing-row" style={{ justifyContent: "center", padding: "16px 0" }}>
            <Loader2 size={18} className="spin" /> 正在讀取報告上的數值…
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
            gender={gender}
            onSave={saveDraft}
            onCancel={() => {
              setDraft(null);
              setRejected([]);
            }}
          />
        )}
      </div>

      {/* --- history --- */}
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
      )}

      <div className="disclaimer">
        <Info size={14} />
        <span>
          這一頁把報告上的數值和衛福部等單位公布的一般成人參考範圍做比較，並依此安排生活型態上的重點，
          <strong>不是診斷，也不能取代醫師的判讀</strong>。任何用藥、治療或飲食限制的決定，請與你的醫師或營養師討論。
        </span>
      </div>
    </>
  );
}
