/**
 * The food log as a diary — one block per day, newest first.
 *
 * Photos run near the full width at roughly a sixth of the screen height,
 * which fits a day's three meals on one screen and keeps each entry legible
 * as a memory rather than a row in a table. Entries older than the photo
 * window keep their text and lose their picture, so the history stays
 * complete even though the pictures cannot.
 */

import FoodImpact from "./FoodImpact.jsx";
import React, { useMemo, useState } from "react";
import { Pencil, Trash2, Utensils, ChevronDown } from "lucide-react";
import { todayStr, daysAgoStr } from "../lib/health.js";
import { summaryMet, CALORIE_CEILING } from "../lib/goals.js";

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

/** How many days are shown before the "show more" button appears. */
const INITIAL_DAYS = 5;

function dayLabel(date) {
  if (date === todayStr()) return "今天";
  if (date === daysAgoStr(1)) return "昨天";
  const [, m, d] = date.split("-");
  return `${Number(m)}月${Number(d)}日`;
}

function weekdayOf(date) {
  return WEEKDAYS[new Date(`${date}T00:00:00`).getDay()];
}

/** Group entries by date, newest day first and newest meal first within a day. */
function groupByDay(entries) {
  const byDate = new Map();
  for (const entry of entries || []) {
    if (!entry || !entry.date) continue;
    if (!byDate.has(entry.date)) byDate.set(entry.date, []);
    byDate.get(entry.date).push(entry);
  }

  return [...byDate.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([date, items]) => ({
      date,
      items: items.sort((a, b) => (b.time || "").localeCompare(a.time || "")),
      total: items.reduce((sum, e) => sum + (Number(e.estimatedCalories) || 0), 0),
    }));
}

function DayHeader({ date, total, target, met }) {
  const pct = target ? Math.min(100, Math.round((total / target) * 100)) : 0;
  const over = target != null && total > target;
  const remaining = target != null ? Math.round(target - total) : null;

  return (
    <div className="diary-day-head">
      <div className="diary-day-top">
        <span className="diary-date">{dayLabel(date)}</span>
        <span className="diary-weekday">星期{weekdayOf(date)}</span>
        {met ? <span className="diary-met">達標</span> : null}
      </div>
      <div className="diary-sum">
        <b>{Math.round(total).toLocaleString()}</b>
        {target != null ? <span> / {target.toLocaleString()} kcal</span> : <span> kcal</span>}
        {remaining != null ? (
          <span className={`diary-remain ${over ? "over" : ""}`}>
            {over ? `超過 ${Math.abs(remaining)}` : `還有 ${remaining}`}
          </span>
        ) : null}
      </div>
      {target != null ? (
        <div className="diary-bar">
          <i className={over ? "over" : ""} style={{ width: `${pct}%` }} />
        </div>
      ) : null}
    </div>
  );
}

function Entry({ entry, onUpdateCalories, onPersistCalories, onDelete, lightWord, PillComponent, report, gender }) {
  return (
    <div className="diary-post">
      {entry.photo ? (
        <div className="diary-photo">
          <img src={entry.photo} alt={entry.foodName || "餐點照片"} />
        </div>
      ) : entry.photoExpired ? (
        <div className="diary-photo diary-photo-gone">
          <Utensils size={18} />
          <span>照片已過保留期</span>
        </div>
      ) : null}

      <div className="diary-meta">
        <span>{entry.time || "—"}</span>
        {entry.light ? (
          <PillComponent light={entry.light}>{lightWord(entry.light)}</PillComponent>
        ) : null}
        <span className="diary-cal">
          <Pencil size={11} className="diary-edit-icon" />
          <input
            type="number"
            className="cal-num-input-inline"
            value={entry.estimatedCalories}
            onChange={(e) => onUpdateCalories(entry.id, e.target.value)}
            onBlur={() => onPersistCalories(entry.id)}
            aria-label={`${entry.foodName || "這一餐"}的熱量`}
          />
          <span>kcal</span>
        </span>
        <button className="icon-btn diary-del" onClick={() => onDelete(entry.id)} aria-label="刪除這筆紀錄">
          <Trash2 size={15} />
        </button>
      </div>

      <div className="diary-name">{entry.foodName || "未命名"}</div>
      {entry.reason ? <div className="diary-note">{entry.reason}</div> : null}
      {/* The tags outlive the photo: at 30 days the picture is dropped and this
          strip is what still says what the meal loaded. */}
      <FoodImpact tags={entry.tags} report={report} gender={gender} compact />
    </div>
  );
}

export default function DietDiary({
  entries,
  summaries,
  report = null,
  gender = "female",
  onUpdateFoodEntryCalories,
  onPersistFoodEntryCalories,
  onDeleteFoodEntry,
  lightWord,
  PillComponent,
}) {
  const [showAll, setShowAll] = useState(false);
  const days = useMemo(() => groupByDay(entries), [entries]);
  const metByDate = useMemo(() => {
    const map = new Map();
    for (const s of summaries || []) map.set(s.date, summaryMet(s));
    return map;
  }, [summaries]);

  const visible = showAll ? days : days.slice(0, INITIAL_DAYS);
  const hidden = days.length - visible.length;

  return (
    <div className="card diary-card">
      <div className="section-title">飲食日記</div>
      <p className="diary-hint">
        一天一則，往下就是前一天。點熱量數字可以直接改 —— 包裝食品建議改成標示上的實際數字。
      </p>

      {days.length === 0 ? (
        <p className="food-log-empty">還沒有紀錄，拍張照片或手動輸入開始吧。</p>
      ) : null}

      {visible.map((day) => (
        <div className="diary-day" key={day.date}>
          <DayHeader date={day.date} total={day.total} target={CALORIE_CEILING} met={metByDate.get(day.date)} />
          {day.items.map((entry) => (
            <Entry
              key={entry.id}
              entry={entry}
              onUpdateCalories={onUpdateFoodEntryCalories}
              onPersistCalories={onPersistFoodEntryCalories}
              report={report}
              gender={gender}
              onDelete={onDeleteFoodEntry}
              lightWord={lightWord}
              PillComponent={PillComponent}
            />
          ))}
        </div>
      ))}

      {hidden > 0 ? (
        <button className="diary-more" onClick={() => setShowAll(true)}>
          <ChevronDown size={15} />
          展開其餘 {hidden} 天
        </button>
      ) : null}
    </div>
  );
}
