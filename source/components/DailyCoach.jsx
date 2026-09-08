/**
 * The morning line and the end-of-day summary, on the overview.
 *
 * Sits above the sprout in the morning (a greeting comes first) and below the
 * three rows in the evening (by then the numbers are the context the summary
 * refers to). Shows nothing in between — see coachSlot.
 *
 * It can be dismissed for the day, because a message you have read and cannot
 * put away stops being a message and becomes furniture.
 */

import React from "react";
import { Sun, Moon, X } from "lucide-react";

export default function DailyCoach({ slot, message, summary, nickname, avatar, onDismiss }) {
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

        <div className="coach-cols">
          <div className="coach-col coach-col-good">
            <div className="coach-col-title">值得鼓勵</div>
            <ul>
              {summary.wins.map((w, i) => (
                <li key={`w${i}`}>{w}</li>
              ))}
            </ul>
          </div>

          {summary.watch.length > 0 ? (
            <div className="coach-col coach-col-watch">
              <div className="coach-col-title">可以再顧一下</div>
              <ul>
                {summary.watch.map((w, i) => (
                  <li key={`c${i}`}>{w}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return null;
}
