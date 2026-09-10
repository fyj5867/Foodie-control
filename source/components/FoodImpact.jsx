/**
 * What this meal loads, what it helps, and which of her own numbers it touches.
 *
 * Shown under the calorie figure on the analysis card, and as a compact strip
 * of chips on each diary entry afterwards.
 *
 * Every sentence here comes from lib/nutritionTags.js — none of it is written
 * by the vision model, which only returns tags. See the note at the top of
 * that file for why that boundary exists.
 *
 * The order is not alphabetical or by severity in the abstract: a tag that
 * bears on a value already outside its range on her latest report comes first
 * and is named with her own figure. Everything else is general nutrition, and
 * general nutrition is what she can already read anywhere.
 */

import React, { useState } from "react";
import { foodImpact, personalHeadline } from "../lib/nutritionTags.js";

/**
 * The diary strip: chips, and the explanation behind whichever one is tapped.
 *
 * The chips alone were a summary of a summary — 「高鈉」 with nothing behind it
 * is a label, not information. Opening every explanation instead would undo
 * the point of a compact strip, so one opens at a time: tap a chip to see why
 * it is there, tap it again to close.
 */
function CompactImpact({ impact }) {
  const [openKey, setOpenKey] = useState(null);
  const all = [...impact.burdens, ...impact.benefits];
  const open = all.find((item) => item.key === openKey) || null;

  return (
    <div className="fi-compact">
      <div className="fi-chips">
        {all.map((item) => (
          <button
            type="button"
            key={item.key}
            className={`fi-chip ${item.kind} ${item.personal ? "is-personal" : ""} ${
              openKey === item.key ? "is-open" : ""
            }`}
            aria-expanded={openKey === item.key}
            onClick={() => setOpenKey(openKey === item.key ? null : item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {open && (
        <div className={`fi-open ${open.kind}`}>
          {open.personal && <div className="fi-personal">你的 {open.personal}</div>}
          <div className="fi-text">{open.text}</div>
          {open.risk && <div className="fi-risk">{open.risk}</div>}
          {open.swap && <div className="fi-swap">→ {open.swap}</div>}
        </div>
      )}
    </div>
  );
}

function ImpactRow({ item }) {
  return (
    <div className={`fi-row ${item.kind}`}>
      <div className="fi-head">
        <span className={`fi-chip ${item.kind}`}>{item.label}</span>
        {item.personal && <span className="fi-personal">你的 {item.personal}</span>}
      </div>
      <div className="fi-text">{item.text}</div>
      {item.risk && <div className="fi-risk">{item.risk}</div>}
      {item.swap && <div className="fi-swap">→ {item.swap}</div>}
    </div>
  );
}

export default function FoodImpact({ tags = [], report = null, gender = "female", compact = false }) {
  const impact = foodImpact({ tags, report, gender });
  if (!impact.burdens.length && !impact.benefits.length) return null;

  if (compact) return <CompactImpact impact={impact} />;

  const headline = personalHeadline(impact);

  return (
    <div className="food-impact">
      {headline && <div className="fi-headline">{headline}</div>}

      {impact.burdens.length > 0 && (
        <div className="fi-block">
          <div className="fi-block-title burden">要留意的</div>
          {impact.burdens.map((item) => (
            <ImpactRow item={item} key={item.key} />
          ))}
        </div>
      )}

      {impact.benefits.length > 0 && (
        <div className="fi-block">
          <div className="fi-block-title benefit">對你有幫助的</div>
          {impact.benefits.map((item) => (
            <ImpactRow item={item} key={item.key} />
          ))}
        </div>
      )}

      <div className="fi-note">
        以上是一般營養學上的關聯，不是針對你的診斷或預測。
        {!report && "上傳健檢報告後，這裡會比對你自己的數值。"}
      </div>
    </div>
  );
}
