/**
 * 運動建議 — what to do this week, and somewhere to watch how.
 *
 * The suggestions are ranked from the profile, the latest report and what has
 * actually been logged (see lib/workouts.js). Each one carries the reason it
 * is being suggested, because "do more cardio" is advice anyone could give and
 * "your triglycerides are in the raised band, and this is the kind of exercise
 * that band responds to" is advice about her.
 *
 * The video link is a YouTube search, not a fixed video: a static app cannot
 * know when a video is deleted, and a dead link in a health plan is worse than
 * no link. Once she finds a video she likes she can pin it here, and from then
 * on it is one tap — which is the version of "my video" that survives.
 */

import React, { useMemo, useState } from "react";
import { PlayCircle, Plus, Link2, Check, X, AlertTriangle } from "lucide-react";
import { recommendWorkouts, cautionsFor, isSafeLink, activityLabelFor } from "../lib/workouts.js";

function WorkoutCard({ workout, savedLink, onSaveLink, onQuickAdd }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(savedLink || "");
  const invalid = editing && value.trim() !== "" && !isSafeLink(value);

  return (
    <div className="workout-card">
      <div className="workout-head">
        <span className="workout-name">{workout.label}</span>
        <span className="workout-minutes">{workout.minutes} 分鐘</span>
      </div>
      <div className="workout-why">{workout.why}</div>
      <div className="workout-note">{workout.note}</div>

      <div className="workout-actions">
        <a
          className="btn btn-secondary"
          href={savedLink || workout.url}
          target="_blank"
          rel="noreferrer noopener"
        >
          <PlayCircle size={14} /> {savedLink ? "我的影片" : "找影片"}
        </a>
        <button type="button" className="btn btn-secondary" onClick={() => onQuickAdd(workout)}>
          <Plus size={14} /> 加入紀錄
        </button>
      </div>

      {!editing ? (
        <button type="button" className="workout-link-toggle" onClick={() => setEditing(true)}>
          <Link2 size={12} /> {savedLink ? "換一支我的影片" : "把喜歡的影片存成這項的預設"}
        </button>
      ) : (
        <div className="workout-link-edit">
          <input
            type="url"
            inputMode="url"
            placeholder="貼上影片網址"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <button
            type="button"
            className="icon-btn"
            aria-label="儲存影片連結"
            disabled={invalid}
            onClick={() => {
              onSaveLink(workout.id, value.trim());
              setEditing(false);
            }}
          >
            <Check size={15} />
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label="取消"
            onClick={() => {
              setValue(savedLink || "");
              setEditing(false);
            }}
          >
            <X size={15} />
          </button>
        </div>
      )}
      {invalid && <div className="workout-link-warn">網址看起來不正確，要以 https:// 開頭。</div>}
    </div>
  );
}

export default function WorkoutSuggestions({
  profile,
  latestRecord,
  report = null,
  exerciseLog = [],
  savedLinks = {},
  onSaveLink,
  onQuickAdd,
}) {
  const picks = useMemo(
    () => recommendWorkouts({ profile, report, latestRecord, exerciseLog }),
    [profile, report, latestRecord, exerciseLog]
  );
  const cautions = useMemo(() => cautionsFor({ profile, report }), [profile, report]);

  return (
    <div className="card">
      <div className="section-title">給你的運動建議</div>
      <p className="muted-line">
        依你的個人資料
        {report ? "、最新的健檢報告" : ""}
        和最近的運動紀錄排出來的。點「找影片」會用挑好的關鍵字到 YouTube 搜尋，你可以挑一支順眼的老師跟著做。
      </p>

      {picks.map((workout) => (
        <WorkoutCard
          key={workout.id}
          workout={workout}
          savedLink={savedLinks[workout.id]}
          onSaveLink={onSaveLink}
          onQuickAdd={(w) => onQuickAdd(w.activityId, activityLabelFor(w), w.minutes)}
        />
      ))}

      <div className="workout-cautions">
        <div className="workout-cautions-head">
          <AlertTriangle size={13} /> 開始前先看一下
        </div>
        {cautions.map((line, i) => (
          <div className="workout-caution-line" key={i}>
            {line}
          </div>
        ))}
      </div>
    </div>
  );
}
