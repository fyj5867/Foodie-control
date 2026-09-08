/**
 * Puts the sprout and garden on the main screen.
 *
 * The panel goes above the existing overview content rather than replacing
 * it: the calorie bar and water card are the actual input controls, and they
 * work. The risk gauge moves below the plant — it is a standing assessment,
 * not something that changes day to day, so it should not be the first thing
 * seen every morning.
 *
 * Run from source/:  node tools/patch-growth-ui.mjs
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

/* --- import --- */
rep(
  'import Rings, { RingLegend } from "./components/Rings.jsx";',
  'import Rings, { RingLegend } from "./components/Rings.jsx";\nimport GrowthPanel from "./components/GrowthPanel.jsx";'
);

/* --- palette: plant and garden colours, tuned to the existing green brand --- */
rep(
  `          --red:#C63C34;
          --red-soft:#FAE6E3;
        }`,
  `          --red:#C63C34;
          --red-soft:#FAE6E3;

          /* Plant and garden. Greens are pulled toward the existing brand
             green so the sprout belongs to the same app, not a sticker on it. */
          --leaf:#4E8A63;
          --leaf-dk:#3B6B4C;
          --leaf-dull:#8FA096;
          --leaf-bright:#63A87A;
          --stem:#4A7A57;
          --stem-dull:#8B968E;
          --soil:#9A7A5C;
          --soil-dk:#7C6049;
          --stone:#B3AB9C;
          --bloom:#D98C6A;
          --bloom-mid:#EFC98F;
          --glow:#F2EBD8;
          --surface-2:#F0F3EE;
          --surface-3:#DDE5DD;

          /* The three daily conditions keep one colour each, everywhere. */
          --cal:#B8863A;
          --move:#2F6F5E;
          --water:#3E7EA6;
        }

        .growth-card{ padding:0; overflow:hidden; }
        .growth-switch{
          display:flex; gap:4px; padding:10px 10px 0;
        }
        .growth-switch-btn{
          flex:1; min-height:38px; border:none; border-radius:10px;
          background:transparent; color:var(--ink-soft);
          font-size:14px; font-family:inherit; cursor:pointer;
        }
        .growth-switch-btn.on{ background:var(--brand-soft); color:var(--brand); font-weight:600; }
        .growth-scene{
          margin:10px 10px 0; border-radius:14px; overflow:hidden;
          background:var(--surface-2); border:1px solid var(--line);
        }
        .growth-status{ padding:12px 16px 0; text-align:center; }
        .growth-lead{ font-size:15px; color:var(--ink); }
        .growth-gap{ margin-top:3px; font-size:13px; color:var(--ink-soft); }

        .ring-legend{ display:flex; flex-direction:column; gap:6px; padding:12px 16px 0; }
        .ring-legend.compact{ padding:10px 16px 0; }
        .ring-row{ display:flex; align-items:baseline; gap:8px; font-size:13px; color:var(--ink-soft); }
        .ring-dot{ width:8px; height:8px; border-radius:50%; flex:0 0 8px; align-self:center; }
        .ring-k{ width:34px; flex:0 0 34px; }
        .ring-v{ font-weight:700; color:var(--ink); font-variant-numeric:tabular-nums; }
        .ring-g{ font-size:12px; }
        .ring-check{ margin-left:auto; color:var(--brand); flex:0 0 auto; align-self:center; }
        .ring-row.met .ring-v{ color:var(--brand); }

        .growth-progress{ padding:14px 16px 0; }
        .growth-progress-head{
          display:flex; justify-content:space-between; align-items:baseline;
          font-size:12.5px; color:var(--ink-soft); margin-bottom:6px;
        }
        .growth-progress-head b{ color:var(--ink); font-variant-numeric:tabular-nums; }
        .growth-bar{ height:6px; border-radius:3px; background:var(--surface-3); overflow:hidden; }
        .growth-bar i{ display:block; height:100%; border-radius:3px; background:var(--brand); }

        .stage-track{ display:flex; justify-content:space-between; margin-top:10px; }
        .stage-dot{ display:flex; flex-direction:column; align-items:center; gap:4px; flex:1; }
        .stage-mark{
          width:9px; height:9px; border-radius:50%;
          background:var(--surface-3); border:1.5px solid var(--surface-3);
        }
        .stage-dot.reached .stage-mark{ background:var(--brand); border-color:var(--brand); }
        .stage-label{ font-size:10.5px; color:var(--ink-soft); }
        .stage-dot.reached .stage-label{ color:var(--brand); font-weight:600; }

        .growth-note{ padding:10px 16px 0; font-size:12.5px; color:var(--ink-soft); text-align:center; }
        .garden-note{ padding-bottom:16px; }
        .growth-link{
          display:block; width:calc(100% - 32px); margin:12px 16px 16px;
          min-height:44px; border:1px solid var(--line); border-radius:12px;
          background:transparent; color:var(--brand); font-size:14px;
          font-family:inherit; cursor:pointer;
        }

        .garden-stats{ display:grid; grid-template-columns:repeat(3,1fr); gap:8px; padding:14px 16px 0; }
        .garden-stat{ display:flex; flex-direction:column; align-items:center; gap:1px; }
        .gs-v{ font-size:22px; font-weight:700; color:var(--ink); font-variant-numeric:tabular-nums; }
        .garden-stat:first-child .gs-v{ color:var(--brand); }
        .gs-k{ font-size:11px; color:var(--ink-soft); }`
);

/* --- render the panel above the overview, and pass what it needs --- */
rep(
  `  return (
    <>
      <div className="card">
        <div className="gauge-wrap">
          <Gauge score={riskScore} />`,
  `  return (
    <>
      {todayGoals && garden ? (
        <GrowthPanel day={todayGoals} garden={garden} onGoActivity={goExercise} />
      ) : null}

      <div className="card">
        <div className="gauge-wrap">
          <Gauge score={riskScore} />`
);

rep(
  `  goProfile,
  goDiet,
  goExercise,
  goTracking,
}) {
  if (!profile) {`,
  `  goProfile,
  goDiet,
  goExercise,
  goTracking,
  todayGoals,
  garden,
}) {
  if (!profile) {`
);

/* --- hand them down from App --- */
rep(
  `              goProfile={() => setTab("profile")}
              goDiet={() => setTab("diet")}
              goExercise={() => setTab("exercise")}
              goTracking={() => setTab("tracking")}`,
  `              goProfile={() => setTab("profile")}
              goDiet={() => setTab("diet")}
              goExercise={() => setTab("exercise")}
              goTracking={() => setTab("tracking")}
              todayGoals={todayGoals}
              garden={garden}`
);

writeFileSync(APP, s);
console.log(missed.length ? 'MISSED:\n' + missed.join('\n') : 'growth panel wired into the overview');
