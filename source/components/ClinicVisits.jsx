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
 *   3. **建議安排的檢查** — collapsed, because it is reference. What she has
 *      actually scheduled is listed above the fold: an exam booked two months
 *      out is too far off for the reminder card, and hiding it inside a closed
 *      card would mean it appeared nowhere at all. Each one can be handed to
 *      the phone's calendar.
 *
 *      The suggestions themselves: what to book and which department, with the reason
 *      taken from her own report. "Ask a doctor" is honest but not much help;
 *      for someone who has never had to navigate a hospital's twenty
 *      departments, naming the desk is most of the work. It sits after the log
 *      because the log is what makes it accurate — a visit recorded here is
 *      what tells the suggestions she has already been.
 */

import React, { useMemo, useState } from "react";
import { Plus, Trash2, Pencil, Check, X, CalendarClock, CalendarPlus, Stethoscope } from "lucide-react";
import { DEPARTMENTS, emptyVisit, dueReminders } from "../lib/visits.js";
import { emptyPlan, duePlans, planFor } from "../lib/examPlans.js";
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

/**
 * The scheduling field.
 *
 * One date and an optional note, because the whole point is that turning a
 * suggestion into a plan should take one tap and one date — a second form as
 * long as the visit form would just move the friction rather than remove it.
 * A custom entry additionally needs a name, since nothing filled it in.
 */
function PlanForm({ draft, setDraft, onSave, onCancel, withName = false }) {
  const set = (key, value) => setDraft((d) => ({ ...d, [key]: value }));
  const usable = draft.date && (draft.exam.trim() || draft.department);

  return (
    <div className="plan-form">
      {withName && (
        <div className="field">
          <label>檢查項目</label>
          <input
            type="text"
            value={draft.exam}
            placeholder="例：腹部超音波"
            onChange={(e) => set("exam", e.target.value)}
          />
        </div>
      )}
      {withName && (
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
      )}

      <div className="field-row">
        <div className="field">
          <label>排定日期</label>
          <input type="date" value={draft.date} onChange={(e) => set("date", e.target.value)} />
        </div>
        <div className="field">
          <label>備註（選填）</label>
          <input
            type="text"
            value={draft.note}
            placeholder="例：早上空腹"
            onChange={(e) => set("note", e.target.value)}
          />
        </div>
      </div>

      <div className="analysis-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          取消
        </button>
        <button type="button" className="btn btn-primary" onClick={onSave} disabled={!usable}>
          <Check size={13} /> 存排定
        </button>
      </div>
      {!usable && <p className="fine-print">要有日期，以及檢查項目或科別。</p>}
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
  plans = [],
  onSavePlan,
  onDeletePlan,
  onTogglePlanDone,
  onAddToCalendar,
  today = todayStr(),
}) {
  const [draft, setDraft] = useState(null);
  const [showAll, setShowAll] = useState(false);
  /* The suggestion list is reference: closed unless asked for. What is
     actionable — anything she has actually scheduled — surfaces in 回診提醒,
     which is always visible, so collapsing this hides nothing she needs. */
  const [showSuggestions, setShowSuggestions] = useState(false);
  /** Which suggestion's date field is open, or "custom" for a blank one. */
  const [planDraft, setPlanDraft] = useState(null);
  const [showAllPlans, setShowAllPlans] = useState(false);

  const reminders = useMemo(() => dueReminders(visits, today), [visits, today]);
  const dueExams = useMemo(() => duePlans(plans, today), [plans, today]);
  const scheduled = useMemo(() => {
    const open = (plans || []).filter((p) => !p.done);
    /* Self-added first — an exam a doctor asked for outranks one this app
       suggested — then by date within each group. */
    const isManual = (p) => !p.examId;
    return open.sort((a, b) => {
      if (isManual(a) !== isManual(b)) return isManual(a) ? -1 : 1;
      return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
    });
  }, [plans]);
  const suggestions = useMemo(
    () => screeningSuggestions({ report, profile, visits, today }),
    [report, profile, visits, today]
  );
  const outstanding = suggestions.filter((s) => !s.covered);
  const covered = suggestions.filter((s) => s.covered);
  const shown = showAll ? visits : visits.slice(0, 3);

  return (
    <>
      {(reminders.length > 0 || dueExams.length > 0) && (
        <div className="card">
          <div className="section-title">
            <CalendarClock size={17} /> 回診與檢查提醒
          </div>

          {/* Exams she scheduled herself. Listed with the follow-ups because
              from her side they are the same thing: something with a date on
              it that has not happened yet. */}
          {dueExams.map((e) => (
            <div className={`remind-row ${e.overdue ? "is-overdue" : ""}`} key={`plan-${e.id}`}>
              <div className="remind-main">
                <div className="remind-when">
                  {e.date}
                  <span>
                    {e.overdue ? `已過 ${Math.abs(e.days)} 天` : e.days === 0 ? "就是今天" : `還有 ${e.days} 天`}
                  </span>
                </div>
                <div className="remind-what">
                  {e.department ? `${e.department}・` : ""}
                  {e.exam || "排定的檢查"}
                </div>
                {e.note && <div className="remind-advice">{e.note}</div>}
              </div>
              <button type="button" className="btn btn-secondary remind-done" onClick={() => onTogglePlanDone(e.id, true)}>
                已完成
              </button>
            </div>
          ))}
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
      {(outstanding.length > 0 || covered.length > 0 || scheduled.length > 0) && (
        <div className="card">
          <button type="button" className="fold-head" onClick={() => setShowSuggestions((v) => !v)}>
            <Stethoscope size={17} />
            <span className="fold-title">建議安排的檢查</span>
            {outstanding.length > 0 && <span className="fold-count">{outstanding.length} 項</span>}
            {scheduled.length > 0 && <span className="fold-done">已排 {scheduled.length}</span>}
            <span className="fold-caret">{showSuggestions ? "▲" : "▼"}</span>
          </button>

          {/* Above the fold on purpose: what she has committed to, and the way
              to commit to something new. Both were reachable only by opening
              the card, which made scheduling feel like a hidden feature. */}
          <div className="plan-list">
            {scheduled.length > 0 && <div className="plan-list-title">已排定</div>}
              {(showAllPlans ? scheduled : scheduled.slice(0, 3)).map((plan) => (
                <div className="plan-row" key={plan.id}>
                  <div className="plan-main">
                    <div className="plan-when">{plan.date}</div>
                    <div className="plan-what">
                      {!plan.examId && <span className="plan-mine">自己排的</span>}
                      {plan.department ? `${plan.department}・` : ""}
                      {plan.exam || "排定的檢查"}
                    </div>
                    {plan.note && <div className="plan-note">{plan.note}</div>}
                    <div className="plan-acts">
                      <button type="button" className="inline-toggle" onClick={() => setPlanDraft({ ...plan })}>
                        改時間
                      </button>
                      <button type="button" className="inline-toggle" onClick={() => onTogglePlanDone(plan.id, true)}>
                        已完成
                      </button>
                      <button type="button" className="inline-toggle" onClick={() => onDeletePlan(plan.id)}>
                        取消
                      </button>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary plan-cal"
                    onClick={() => onAddToCalendar(plan)}
                  >
                    <CalendarPlus size={13} /> 加入行事曆
                  </button>
                </div>
              ))}
            {scheduled.length > 3 && (
              <button
                type="button"
                className="btn btn-secondary btn-block"
                style={{ marginTop: "4px" }}
                onClick={() => setShowAllPlans((v) => !v)}
              >
                {showAllPlans ? "收起" : `展開全部 ${scheduled.length} 項排定`}
              </button>
            )}

            {/* Somewhere to put an exam the doctor asked for that is not on
                the suggestion list. Without it the only options are "one of
                ours" or "nowhere". */}
            {planDraft && !planDraft.examId ? (
              <div className="plan-add">
                <div className="plan-list-title">自己加一項檢查</div>
                <PlanForm
                  draft={planDraft}
                  setDraft={setPlanDraft}
                  withName
                  onSave={() => {
                    onSavePlan(planDraft);
                    setPlanDraft(null);
                  }}
                  onCancel={() => setPlanDraft(null)}
                />
              </div>
            ) : (
              <button
                type="button"
                className="btn btn-secondary btn-block"
                style={{ marginTop: scheduled.length ? "6px" : "0" }}
                onClick={() => setPlanDraft(emptyPlan())}
              >
                <Plus size={14} /> 自己排一項檢查（醫師交代的、清單上沒有的）
              </button>
            )}
          </div>

          {showSuggestions && (
            <>
              <p className="fine-print" style={{ marginTop: "10px" }}>
                依你報告上的數值和年齡列出來的，含檢查項目與掛哪一科。要不要做、什麼時候做請由醫師決定。
                排好時間就填進去，到日期前這裡會提醒你。
              </p>

              {outstanding.map((s) => {
                const booked = planFor(plans, s.id);
                const editing = planDraft && planDraft.examId === s.id;
                return (
                  <div className="sug-row" key={s.id}>
                    <div className="sug-head">
                      <span className="sug-dept">{s.department}</span>
                      <span className="sug-exam">{s.exam}</span>
                    </div>
                    <div className="sug-why">{s.why}</div>
                    {s.note && <div className="sug-note">{s.note}</div>}
                    <div className="sug-source">{s.source}</div>

                    {booked && !editing && (
                      <div className="sug-booked">
                        已排定 {booked.date}
                        {booked.note ? `・${booked.note}` : ""}
                        <button type="button" className="inline-toggle" onClick={() => setPlanDraft({ ...booked })}>
                          改時間
                        </button>
                        <button type="button" className="inline-toggle" onClick={() => onDeletePlan(booked.id)}>
                          取消排定
                        </button>
                      </div>
                    )}

                    {!booked && !editing && (
                      <button
                        type="button"
                        className="btn btn-secondary sug-book-btn"
                        onClick={() => setPlanDraft(emptyPlan(s))}
                      >
                        <CalendarPlus size={13} /> 排定時間
                      </button>
                    )}

                    {editing && (
                      <PlanForm
                        draft={planDraft}
                        setDraft={setPlanDraft}
                        onSave={() => {
                          onSavePlan(planDraft);
                          setPlanDraft(null);
                        }}
                        onCancel={() => setPlanDraft(null)}
                      />
                    )}
                  </div>
                );
              })}

              {needsAgeForProgramme(profile) && (
                <p className="fine-print" style={{ marginTop: "10px" }}>
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
            </>
          )}
        </div>
      )}

    </>
  );
}
