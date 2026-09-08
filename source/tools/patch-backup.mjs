/**
 * Makes the garden survive backup, restore and reset.
 *
 * Three gaps found by actually clicking through the app:
 *
 * 1. The exported backup did not include daily-summary, so exporting and
 *    restoring silently wiped every met day and every finished tree — and
 *    because the rebuild flag is not in the backup either, nothing would grow
 *    it back. On a new device the garden would have been empty for good.
 * 2. The import ignored the field even when present.
 * 3. "Clear all data" left the summary behind, so a reset produced a garden
 *    full of trees grown from records that no longer existed.
 *
 * Run from source/:  node tools/patch-backup.mjs
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

/* --- take the new entry points from the hook --- */
rep(
  `    summaries: goalSummaries,
    recordDay: recordGardenDay,`,
  `    summaries: goalSummaries,
    recordDay: recordGardenDay,
    restoreSummaries,
    resetGarden,`
);

/* --- 1. export the met-day history --- */
rep(
  `      const backup = {
        app: "tang-qian-shao",
        exportedAt: new Date().toISOString(),
        profile,
        records,
        foodLog,
        waterLog,
        exerciseLog,
      };`,
  `      const backup = {
        app: "tang-qian-shao",
        exportedAt: new Date().toISOString(),
        profile,
        records,
        foodLog,
        waterLog,
        exerciseLog,
        // Without this the garden does not survive a restore: met days cannot
        // be recomputed once the detailed logs have aged out.
        dailySummary: goalSummaries,
      };`
);

/* --- 2. restore it; an older backup with no summary triggers a rebuild --- */
rep(
  `        restoredParts.push("運動紀錄");
      }

      if (restoredParts.length === 0) {`,
  `        restoredParts.push("運動紀錄");
      }

      // A backup made before the garden existed has no summary. Passing
      // undefined tells the hook to clear the rebuild flag so the one-time
      // backfill runs again over the logs just restored.
      await restoreSummaries(Array.isArray(data.dailySummary) ? data.dailySummary : undefined);
      if (Array.isArray(data.dailySummary)) {
        restoredParts.push(\`達標紀錄 \${data.dailySummary.length} 天\`);
      }

      if (restoredParts.length === 0) {`
);

/* --- 3. clearing everything clears the garden too --- */
rep(
  `    try {
      await window.storage.delete("exercise-log", false);
    } catch (e) {}
    setProfile(null);`,
  `    try {
      await window.storage.delete("exercise-log", false);
    } catch (e) {}
    try {
      // Otherwise the garden keeps standing on records that no longer exist.
      await resetGarden();
    } catch (e) {}
    setProfile(null);`
);

writeFileSync(APP, s);
console.log(missed.length ? 'MISSED:\n' + missed.join('\n') : 'export/import/reset wiring updated');
