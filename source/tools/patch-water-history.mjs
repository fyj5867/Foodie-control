/**
 * Collapses the water history down to today.
 *
 * The card already has a seven-day chart directly above this list, so seven
 * editable rows restated the same numbers and pushed everything else off the
 * screen. Today is the row you actually touch; the rest are there for the
 * occasional correction, so they sit behind a toggle.
 *
 * Run from source/:  node tools/patch-water-history.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';

const APP = 'App.jsx';
// git checks this file out with CRLF; normalise so multi-line patterns match.
let s = readFileSync(APP, 'utf8').replace(/\r\n/g, '\n');
const missed = [];
const rep = (a, b) => {
  if (!s.includes(a)) {
    missed.push(a.slice(0, 60).replace(/\n/g, '|'));
    return;
  }
  s = s.replace(a, b);
};

/* --- WaterCard needs local state for the toggle, and today split out --- */
rep(
  `}) {
  const [customAmount, setCustomAmount] = useState("");

  if (target == null) {`,
  `}) {
  const [customAmount, setCustomAmount] = useState("");
  const [showEarlierWater, setShowEarlierWater] = useState(false);

  // Split today from the rest so today can stay visible while the others
  // collapse. Hooks must run before the early return below.
  const waterRows = useMemo(() => {
    const t = todayStr();
    const entries = recentWaterEntries || [];
    return {
      today: entries.filter((e) => e.date === t),
      earlier: entries.filter((e) => e.date !== t),
    };
  }, [recentWaterEntries]);

  if (target == null) {`
);

rep(
  `      {recentWaterEntries.length > 0 && (
        <div className="water-history">
          <div className="water-history-title">最近7天每日總量（可直接修改毫升數）</div>
          {recentWaterEntries.map((entry) => (
            <div className="water-history-row" key={entry.id}>
              <span>💧 {entry.date === todayStr() ? "今天" : entry.date.slice(5)}</span>
              <span className="water-history-edit">
                <Pencil size={10} className="food-log-edit-icon" />
                <input
                  type="number"
                  className="cal-num-input-inline water-amount-input"
                  value={entry.amountMl}
                  onChange={(e) => onUpdateWaterEntry(entry.id, e.target.value)}
                  onBlur={() => onPersistWaterEntry(entry.id)}
                />
                <span>ml</span>
              </span>
              <button className="icon-btn" onClick={() => onDeleteWaterEntry(entry.id)}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}`,
  `      {recentWaterEntries.length > 0 && (
        <div className="water-history">
          {/* Today is the row you actually edit. The chart above already shows
              the other days, so they stay collapsed until you want to correct
              one. */}
          {waterRows.today.map((entry) => (
            <WaterHistoryRow
              key={entry.id}
              entry={entry}
              onUpdateWaterEntry={onUpdateWaterEntry}
              onPersistWaterEntry={onPersistWaterEntry}
              onDeleteWaterEntry={onDeleteWaterEntry}
            />
          ))}

          {waterRows.earlier.length > 0 && (
            <>
              {showEarlierWater ? (
                <>
                  <div className="water-history-title">前 {waterRows.earlier.length} 天（可直接修改毫升數）</div>
                  {waterRows.earlier.map((entry) => (
                    <WaterHistoryRow
                      key={entry.id}
                      entry={entry}
                      onUpdateWaterEntry={onUpdateWaterEntry}
                      onPersistWaterEntry={onPersistWaterEntry}
                      onDeleteWaterEntry={onDeleteWaterEntry}
                    />
                  ))}
                </>
              ) : null}
              <button
                type="button"
                className="water-history-toggle"
                onClick={() => setShowEarlierWater((v) => !v)}
              >
                {showEarlierWater ? "收起前幾天" : \`查看並修改前 \${waterRows.earlier.length} 天\`}
              </button>
            </>
          )}
        </div>
      )}`
);

/* --- the row, lifted out so today and the collapsed days share one shape --- */
rep(
  `function WaterMascot({ pct }) {`,
  `/** One editable day of water. */
function WaterHistoryRow({ entry, onUpdateWaterEntry, onPersistWaterEntry, onDeleteWaterEntry }) {
  const isToday = entry.date === todayStr();
  return (
    <div className={\`water-history-row \${isToday ? "is-today" : ""}\`}>
      <span>{isToday ? "今天" : entry.date.slice(5)}</span>
      <span className="water-history-edit">
        <Pencil size={10} className="food-log-edit-icon" />
        <input
          type="number"
          className="cal-num-input-inline water-amount-input"
          value={entry.amountMl}
          onChange={(e) => onUpdateWaterEntry(entry.id, e.target.value)}
          onBlur={() => onPersistWaterEntry(entry.id)}
          aria-label={\`\${isToday ? "今天" : entry.date} 的喝水量\`}
        />
        <span>ml</span>
      </span>
      <button className="icon-btn" onClick={() => onDeleteWaterEntry(entry.id)} aria-label="刪除這天的紀錄">
        <Trash2 size={14} />
      </button>
    </div>
  );
}

function WaterMascot({ pct }) {`
);

/* --- style the toggle and mark today's row --- */
rep(
  `        .water-history-title{`,
  `        .water-history-toggle{
          display:block; width:100%; min-height:40px; margin-top:6px;
          border:1px solid var(--line); border-radius:10px;
          background:transparent; color:var(--brand);
          font-size:12.5px; font-family:inherit; cursor:pointer;
        }
        .water-history-row.is-today span:first-child{ color:var(--ink); font-weight:600; }
        .water-history-title{`
);

writeFileSync(APP, s);
console.log(missed.length ? 'MISSED:\n' + missed.join('\n') : 'water history collapsed to today');
