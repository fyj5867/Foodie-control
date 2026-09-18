/**
 * 真乘心語、晚上八點的提醒、晚上十一點的總結。
 *
 * 三個時段照時鐘輪替（`lib/coach.js` 的 `coachSlot`）：00:00 起是今天的心語，
 * 20:00 起是「還差什麼」，23:00 起是總結，加上只有這個時候問才有意義的一題 ——
 * 今天心情如何。
 *
 * 提醒和總結的版面刻意一樣（同一組「值得鼓勵／可以再顧一下」欄位），因為它們
 * 講的是同一件事，差別只在還來不來得及做。
 *
 * 每一種都可以關掉：一則讀過了又收不起來的訊息，就不再是訊息，是家具。
 */

import React from "react";
import { Sun, Moon, BellRing, X } from "lucide-react";
import { MOODS } from "../lib/mood.js";

/** 值得鼓勵／可以再顧一下 —— 提醒和總結共用。 */
function Columns({ wins, watch }) {
  return (
    <div className="coach-cols">
      <div className="coach-col coach-col-good">
        <div className="coach-col-title">值得鼓勵</div>
        <ul>
          {wins.map((w, i) => (
            <li key={`w${i}`}>{w}</li>
          ))}
        </ul>
      </div>

      {watch.length > 0 ? (
        <div className="coach-col coach-col-watch">
          <div className="coach-col-title">可以再顧一下</div>
          <ul>
            {watch.map((w, i) => (
              <li key={`c${i}`}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export default function DailyCoach({
  slot,
  message,
  summary,
  reminder,
  nickname,
  avatar,
  mood = null,
  onPickMood,
  onDismiss,
}) {
  if (slot === "morning" && message) {
    return (
      <div className="coach coach-morning">
        <div className="coach-head">
          <span className="coach-icon" aria-hidden="true">
            <Sun size={15} />
          </span>
          <span className="coach-title">{message.title}</span>
          {onDismiss ? (
            <button type="button" className="coach-close" onClick={onDismiss} aria-label="關閉今天的問候">
              <X size={14} />
            </button>
          ) : null}
        </div>
        {message.greeting ? <div className="coach-greeting">{message.greeting}</div> : null}

        <div className="coach-body">
          {avatar ? <img className="coach-avatar" src={avatar} alt="" /> : null}
          <p className="coach-line coach-quote">{message.body}</p>
        </div>
      </div>
    );
  }

  if (slot === "remind" && reminder) {
    return (
      <div className="coach coach-remind">
        <div className="coach-head">
          <span className="coach-icon" aria-hidden="true">
            <BellRing size={15} />
          </span>
          <span className="coach-title">{reminder.title}</span>
          {onDismiss ? (
            <button type="button" className="coach-close" onClick={onDismiss} aria-label="關閉今天的提醒">
              <X size={14} />
            </button>
          ) : null}
        </div>

        <div className="coach-body">
          {avatar ? <img className="coach-avatar" src={avatar} alt="" /> : null}
          <p className="coach-line">{reminder.headline}</p>
        </div>

        <Columns wins={reminder.wins} watch={reminder.watch} />
      </div>
    );
  }

  if (slot === "evening" && summary) {
    return (
      <div className="coach coach-evening">
        <div className="coach-head">
          <span className="coach-icon" aria-hidden="true">
            <Moon size={15} />
          </span>
          <span className="coach-title">{summary.title}</span>
          {onDismiss ? (
            <button type="button" className="coach-close" onClick={onDismiss} aria-label="關閉今天的總結">
              <X size={14} />
            </button>
          ) : null}
        </div>

        <div className="coach-body">
          {avatar ? <img className="coach-avatar" src={avatar} alt="" /> : null}
          <p className="coach-line">{summary.headline}</p>
        </div>

        <Columns wins={summary.wins} watch={summary.watch} />

        {/* 只有這個時候問才有意義：早上問「今天心情如何」，是在問一件還沒發生的事。
            點同一個就取消 —— 誤觸要有路可以退，而「取消」和「沒填」是同一個狀態。 */}
        {onPickMood ? (
          <div className="mood-block">
            <div className="coach-col-title">今天心情</div>
            <div className="mood-row">
              {MOODS.map((m) => (
                <button
                  type="button"
                  key={m.key}
                  className={`mood-chip ${mood === m.key ? "is-on" : ""}`}
                  aria-pressed={mood === m.key}
                  onClick={() => onPickMood(m.key)}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return null;
}
