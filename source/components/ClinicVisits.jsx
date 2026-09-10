/**
 * 就醫紀錄與建議檢查 — the other half of every "go and ask a doctor".
 *
 * Three cards, in the order they are useful:
 *
 *   1. **回診提醒** — follow-up dates that are due or already past. Overdue
 *      ones are never aged out: a 回診 missed three months ago matters more
 *      than one due next week, and dropping it would be the app deciding for
 *      her that it stopped mattering.
 *   2. **就醫紀錄** — the editable log. 病症 is her own words for why she went,
 *      and 醫師建議 is stored and shown exactly as she typed it. The app does
 *      not read either field to decide anything; it has no business
 *      paraphrasing a doctor.
 *   3. **建議安排的檢查** — what to book and which department, with the reason
 *      taken from her own report. "Ask a doctor" is honest but not much help;
 *      for someone who has never had to navigate a hospital's twenty
 *      departments, naming the desk is most of the work. It sits after the log
 *      because the log is what makes it accurate — a visit recorded here is
 *      what tells the suggestions she has already been.
 */

import React, { useMemo, useState } from "react";
import { Plus, Trash2, Pencil, Check, X, CalendarClock, Stethoscope } from "lucide-react";
import { DEPARTMENTS, emptyVisit, dueReminders } from "../lib/visits.js";
import { screeningSuggestions, needsAgeForProgramme } from "../lib/screening.js";
import { todayStr } from "../lib/health.js";

function VisitForm({ draft, setDraft, onSave, onCancel }) {
  const set = (key, value) => setDraft((d) => ({ ...d, [key]: value }));
  const usable = draft.date && (draft.department || draft.symptom.trim() || draft.advice.trim());

  return (
    <div className="draft-box">
      <div className="field-row">
        <div className="field">
          <label>就醫日期</label>
          <input type="date" value={draft.date} onChange={(e) => set("date", e.target.value)} />
        </div>
        <div className="field">
          <label>下次回診（選填）</label>
          <input type="date" value={draft.nextDate} onChange={(e) => set("nextDate", e.target.value)} />
        </div>
      </div>

      <div className="field">
        <label>科別</label>
        <div className="chip-grid">
          {DEPARTMENTS.map((d) => (
            <button
              type="button"
              key={d}
              className={`chip ${draft.department === d ? "active" : ""}`}
              onClick={() => set("department", draft.department === d ? "" : d)}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label>病症／為什麼去</label>
        <input
          type="text"
          value={draft.symptom}
          placeholder="例：右眼看東西模糊"
          onChange={(e) => set("symptom", e.target.value)}
        />
      </div>

      <div className="field">
        <label>醫師建議</label>
        <textarea
          rows={3}
          value={draft.advice}
          placeholder="醫師怎麼說，照原話記下來就好"
          onChange={(e) => set("advice", e.target.value)}
        />
      </div>

      <div className="analysis-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          取消
        </button>
        <button type="button" className="btn btn-primary" onClick={onSave} disabled={!usable}>
          <Check size={13} /> 儲存
        </button>
      </div>
      {!usable && <p className="fine-print">日期，加上科別、病症或醫師建議其中一項。</p>}
    </div>
  );
}

export default function ClinicVisits({
  visits = [],
  report = null,
  profile = null,
  onSaveVisit,
  onDeleteVisit,
  onToggleDone,
  today = todayStr(),
}) {
  const [draft, setDraft] = useState(null);
  const [showAll, setShowAll] = useState(false);

  const reminders = useMemo(() => dueReminders(visits, today), [visits, today]);
  const suggestions = useMemo(
    () => screeningSuggestions({ report, profile, visits, today }),
    [report, profile, visits, today]
  );
  const outstanding = suggestions.filter((s) => !s.covered);
  const covered = suggestions.filter((s) => s.covered);
  const shown = showAll ? visits : visits.slice(0, 3);

  return (
    <>
      {reminders.length > 0 && (
        <div className="card">
          <div className="section-title">
            <CalendarClock size={17} /> 回診提醒
          </div>
          {reminders.map((r) => (
            <div className={`remind-row ${r.overdue ? "is-overdue" : ""}`} key={r.id}>
              <div className="remind-main">
                <div className="remind-when">
                  {r.nextDate}
                  <span>
                    {r.overdue ? `已過 ${Math.abs(r.days)} 天` : r.days === 0 ? "就是今天" : `還有 ${r.days} 天`}
                  </span>
                </div>
                <div className="remind-what">
                  {r.department || "回診"}
                  {r.symptom ? `・${r.symptom}` : ""}
                </div>
                {r.advice && <div className="remind-advice">{r.advice}</div>}
              </div>
              <button type="button" className="btn btn-secondary remind-done" onClick={() => onToggleDone(r.id, true)}>
                已完成
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <div className="section-title">就醫紀錄</div>

        {!draft && (
          <button type="button" className="btn btn-secondary btn-block" onClick={() => setDraft(emptyVisit(today))}>
            <Plus size={14} /> 新增一筆就醫紀錄
          </button>
        )}

        {draft && (
          <VisitForm
            draft={draft}
            setDraft={setDraft}
            onSave={() => {
              onSaveVisit(draft);
              setDraft(null);
            }}
            onCancel={() => setDraft(null)}
          />
        )}

        {visits.length === 0 && !draft && (
          <p className="fine-print" style={{ marginTop: "10px" }}>
            看過醫師之後記一筆，回診日期到了這裡會提醒你，建議的檢查也會知道你已經看過了。
          </p>
        )}

        {shown.map((v) => (
          <div className={`visit-row ${v.done ? "is-done" : ""}`} key={v.id}>
            <div className="visit-head">
              <span className="visit-date">{v.date}</span>
              {v.department && <span className="visit-dept">{v.department}</span>}
              <button
                type="button"
                className="icon-btn"
                aria-label={`編輯 ${v.date} 的紀錄`}
                onClick={() => setDraft({ ...v })}
              >
                <Pencil size={14} />
              </button>
              <button
                type="button"
                className="icon-btn"
                aria-label={`刪除 ${v.date} 的紀錄`}
                onClick={() => onDeleteVisit(v.id)}
              >
                <Trash2 size={14} />
              </button>
            </div>
            {v.symptom && <div className="visit-symptom">{v.symptom}</div>}
            {v.advice && <div className="visit-advice">{v.advice}</div>}
            {v.nextDate && (
              <div className="visit-next">
                下次回診 {v.nextDate}
                {v.done && "・已完成"}
                {v.done ? (
                  <button type="button" className="inline-toggle" onClick={() => onToggleDone(v.id, false)}>
                    改回未完成
                  </button>
                ) : null}
              </div>
            )}
          </div>
        ))}

        {visits.length > 3 && (
          <button
            type="button"
            className="btn btn-secondary btn-block"
            style={{ marginTop: "10px" }}
            onClick={() => setShowAll((v) => !v)}
          >
            {showAll ? "收起" : `展開全部 ${visits.length} 筆`}
          </button>
        )}
      </div>
      {(outstanding.length > 0 || covered.length > 0) && (
        <div className="card">
          <div className="section-title">
            <Stethoscope size={17} /> 建議安排的檢查
          </div>
          <p className="fine-print">
            依你報告上的數值和年齡列出來的，含檢查項目與掛哪一科。要不要做、什麼時候做請由醫師決定。
          </p>

          {outstanding.map((s) => (
            <div className="sug-row" key={s.id}>
              <div className="sug-head">
                <span className="sug-dept">{s.department}</span>
                <span className="sug-exam">{s.exam}</span>
              </div>
              <div className="sug-why">{s.why}</div>
              {s.note && <div className="sug-note">{s.note}</div>}
              <div className="sug-source">{s.source}</div>
            </div>
          ))}

          {needsAgeForProgramme(profile) && (
            <p className="fine-print">
              個人資料裡填了年齡之後，這裡還會加上國健署依年齡提供的公費篩檢項目。
            </p>
          )}

          {covered.length > 0 && (
            <div className="sug-covered">
              {covered.map((s) => (
                <div key={s.id}>
                  ✓ {s.department}・{s.exam}（{s.covered} 已看過）
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </>
  );
}
