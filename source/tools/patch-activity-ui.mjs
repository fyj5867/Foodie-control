/**
 * Puts the rings and the week grid at the top of the exercise tab, which
 * becomes 活動力 — today's three conditions, then the week, then the existing
 * plan and logging UI underneath.
 *
 * Run from source/:  node tools/patch-activity-ui.mjs
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
  'import GrowthPanel from "./components/GrowthPanel.jsx";',
  'import GrowthPanel from "./components/GrowthPanel.jsx";\nimport ActivityPanel from "./components/ActivityPanel.jsx";'
);

/* --- expose the stored verdicts from the hook --- */
rep(
  `    today: todayGoals,
    garden,
    recordDay: recordGardenDay,`,
  `    today: todayGoals,
    garden,
    summaries: goalSummaries,
    recordDay: recordGardenDay,`
);

/* --- ExerciseTab takes the new props --- */
rep(
  `  onDeleteExerciseEntry,
  onUpdateExerciseEntry,
  onPersistExerciseEntry,
}) {
  const pctForBar = Math.min(feedback.pct, 100);

  return (`,
  `  onDeleteExerciseEntry,
  onUpdateExerciseEntry,
  onPersistExerciseEntry,
  todayGoals,
  summaries,
}) {
  const pctForBar = Math.min(feedback.pct, 100);

  return (`
);

/* --- render it first --- */
rep(
  `  const pctForBar = Math.min(feedback.pct, 100);

  return (
    <>`,
  `  const pctForBar = Math.min(feedback.pct, 100);

  return (
    <>
      {todayGoals ? (
        <ActivityPanel
          day={todayGoals}
          summaries={summaries}
          weeklyMinutes={feedback.totalMinutes}
          weeklyTarget={plan.weeklyMinutesTarget}
        />
      ) : null}
`
);

/* --- hand them down --- */
rep(
  `              feedback={exerciseWeeklyFeedback}`,
  `              feedback={exerciseWeeklyFeedback}
              todayGoals={todayGoals}
              summaries={goalSummaries}`
);

/* --- the tab is about all three conditions now, not only exercise --- */
rep(
  `            <Dumbbell size={20} />
            運動建議`,
  `            <Dumbbell size={20} />
            活動力`
);

/* --- styles --- */
rep(
  `        .garden-stats{`,
  `        .activity-card .section-title{ padding:0 0 4px; }
        .rings-wrap{ display:flex; justify-content:center; padding:6px 0 2px; }
        .activity-card .ring-legend{ padding:10px 0 0; }
        .activity-verdict{
          margin-top:12px; padding:10px 12px; border-radius:10px;
          background:var(--brand-soft); color:var(--brand);
          font-size:13px; text-align:center;
        }

        .week-block{ margin-top:18px; }
        .week-head{
          display:flex; justify-content:space-between; align-items:baseline;
          font-size:12.5px; color:var(--ink-soft); margin-bottom:8px;
        }
        .week-head b{ color:var(--ink); font-variant-numeric:tabular-nums; }
        .week-grid{
          display:grid; grid-template-columns:30px repeat(7,1fr);
          gap:5px; align-items:center;
        }
        .week-wd{ font-size:10.5px; color:var(--ink-soft); text-align:center; }
        .week-wd.today{ color:var(--brand); font-weight:700; }
        .week-rl{ font-size:10.5px; color:var(--ink-soft); text-align:right; padding-right:2px; }
        .week-cell{ height:18px; border-radius:5px; display:block; }
        .week-cell.missed{ background:var(--surface-3); }
        .week-cell.unknown{
          background:transparent; border:1px dashed var(--line);
        }
        .week-cell.sample{ width:14px; height:12px; display:inline-block; vertical-align:-1px; }
        .week-cell.sample.met{ background:var(--brand); }
        .week-legend{
          display:flex; gap:14px; margin-top:8px;
          font-size:11px; color:var(--ink-soft);
        }
        .week-legend span{ display:inline-flex; align-items:center; gap:5px; }
        .week-note{ margin-top:8px; font-size:11.5px; color:var(--ink-soft); line-height:1.6; }

        .garden-stats{`
);

writeFileSync(APP, s);
console.log(missed.length ? 'MISSED:\n' + missed.join('\n') : 'activity panel wired in');
