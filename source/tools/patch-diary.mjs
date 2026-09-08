/**
 * Turns the food log into a day-by-day diary.
 *
 * Three changes, in order of how much they matter:
 *
 * 1. Entries stop being deleted after 30 days. Only the photo is dropped;
 *    the text stays for good. A diary that forgets everything older than a
 *    month is not a diary, and text is cheap — it is photos that fill the
 *    browser's few megabytes.
 * 2. Photos are captured larger (640px rather than 180px), because they are
 *    now shown at roughly a sixth of the screen rather than as a 40px chip.
 * 3. The list becomes a diary grouped by day, newest first.
 *
 * Run from source/:  node tools/patch-diary.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';

const APP = 'App.jsx';
let s = readFileSync(APP, 'utf8');
const missed = [];
const rep = (a, b) => {
  if (!s.includes(a)) {
    missed.push(a.slice(0, 60).replace(/\n/g, '|'));
    return;
  }
  s = s.replace(a, b);
};

rep(
  'import ActivityPanel from "./components/ActivityPanel.jsx";',
  'import ActivityPanel from "./components/ActivityPanel.jsx";\nimport DietDiary from "./components/DietDiary.jsx";\nimport { agePhotos, PHOTO_DAYS, PHOTO_MAX_DIM } from "./lib/storage.js";'
);

/* --- 1. keep the text, drop only the photo --- */
rep(
  `  async function persistFoodLog(next) {
    // keep the log bounded (entries may now include a small photo thumbnail,
    // so a shorter window keeps total storage size reasonable)
    const cutoff = daysAgoStr(30);
    const trimmed = next.filter((e) => e.date >= cutoff);
    await window.storage.set("food-log", JSON.stringify(trimmed), false);
    setFoodLog(trimmed);
  }`,
  `  async function persistFoodLog(next) {
    // Photos are dropped once they pass the window; the entry's text is kept
    // indefinitely so the diary has a real history. See PHOTO_DAYS.
    const aged = agePhotos(next, PHOTO_DAYS);
    await window.storage.set("food-log", JSON.stringify(aged), false);
    setFoodLog(aged);
  }`
);

/* --- 2. capture at a size worth displaying --- */
rep(
  '      photo = await compressImageDataUrl(analysisPreview.imageDataUrl);',
  '      photo = await compressImageDataUrl(analysisPreview.imageDataUrl, PHOTO_MAX_DIM);'
);

/* --- 3. the diary replaces the flat 7-day list --- */
rep(
  `      <div className="card">
        <div className="section-title">飲食紀錄（最近7天）</div>
        <p style={{ fontSize: "11px", color: "var(--ink-soft)", margin: "-4px 0 10px" }}>
          點熱量數字旁的 ✏️ 圖示可以直接修改，例如包裝食品改成標示上的實際數字。
        </p>
        {recentFoodEntries.length === 0 && <p className="food-log-empty">還沒有紀錄，拍張照片或手動輸入開始吧。</p>}
        {recentFoodEntries.map((entry) => (
          <div className="record-row food-log-row" key={entry.id}>
            {entry.photo ? (
              <img src={entry.photo} alt={entry.foodName} className="food-log-thumb" />
            ) : (
              <div className="food-log-thumb food-log-thumb-placeholder">
                <Utensils size={16} />
              </div>
            )}
            <div className="food-log-row-main">
              <div className="record-date">
                {entry.date === todayStr() ? "今天" : entry.date.slice(5)}　{entry.time}　{entry.foodName}
              </div>
              <div className="record-meta food-log-cal-row">
                <Pencil size={11} className="food-log-edit-icon" />
                <input
                  type="number"
                  className="cal-num-input-inline"
                  value={entry.estimatedCalories}
                  onChange={(e) => onUpdateFoodEntryCalories(entry.id, e.target.value)}
                  onBlur={() => onPersistFoodEntryCalories(entry.id)}
                />
                <span>大卡</span>
                {entry.reason ? <span>・ {entry.reason}</span> : null}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Pill light={entry.light}>{lightWord(entry.light)}</Pill>
              <button className="icon-btn" onClick={() => onDeleteFoodEntry(entry.id)}>
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>`,
  `      <DietDiary
        entries={foodLog}
        summaries={summaries}
        dailyCalorieTarget={dailyCalorieTarget}
        onUpdateFoodEntryCalories={onUpdateFoodEntryCalories}
        onPersistFoodEntryCalories={onPersistFoodEntryCalories}
        onDeleteFoodEntry={onDeleteFoodEntry}
        lightWord={lightWord}
        PillComponent={Pill}
      />`
);

/* --- DietTab needs the full log and the verdicts --- */
rep(
  `function DietTab({`,
  `function DietTab({
  foodLog,
  summaries,`
);

rep(
  `              recentFoodEntries={recentFoodEntries}`,
  `              recentFoodEntries={recentFoodEntries}
              foodLog={foodLog}
              summaries={goalSummaries}`
);

writeFileSync(APP, s);
console.log(missed.length ? 'MISSED:\n' + missed.join('\n') : 'diary wired in');
