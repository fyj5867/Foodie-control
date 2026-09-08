/**
 * Adds sleep hours to the body-composition records, with its own trend chart.
 *
 * Sleep goes in alongside the scale readings rather than becoming a fourth
 * daily condition: the three conditions are the things the garden counts, and
 * quietly changing what "達標" means would rewrite the meaning of every day
 * already recorded.
 *
 * Run from source/:  node tools/patch-sleep.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';

const APP = 'App.jsx';
let s = readFileSync(APP, 'utf8').replace(/\r\n/g, '\n');
const missed = [];
const rep = (a, b) => {
  if (!s.includes(a)) {
    missed.push(a.slice(0, 60).replace(/\n/g, '|'));
    return;
  }
  s = s.replace(a, b);
};

/* --- import the new zones --- */
rep('  waistZones,', '  waistZones,\n  sleepZones,');

/* --- the field exists in three form shapes: initial, reset, and edit-load --- */
rep(
  `    bodyAge: "",
    bmr: "",
  });`,
  `    bodyAge: "",
    bmr: "",
    sleepHours: "",
  });`
);

rep(
  `      bodyAge: recordForm.bodyAge === "" ? null : Number(recordForm.bodyAge),`,
  `      bodyAge: recordForm.bodyAge === "" ? null : Number(recordForm.bodyAge),
      sleepHours: recordForm.sleepHours === "" ? null : Number(recordForm.sleepHours),`
);

rep(
  `          bodyAge: "",
          bmr: "",
        });`,
  `          bodyAge: "",
          bmr: "",
          sleepHours: "",
        });`
);

rep(
  `      bodyAge: record.bodyAge ?? "",
      bmr: record.bmr ?? "",
    });`,
  `      bodyAge: record.bodyAge ?? "",
      bmr: record.bmr ?? "",
      sleepHours: record.sleepHours ?? "",
    });`
);

/* --- the chart series --- */
rep(
  `    skeletalMuscle: r.skeletalMuscle != null ? r.skeletalMuscle : null,
  }));`,
  `    skeletalMuscle: r.skeletalMuscle != null ? r.skeletalMuscle : null,
    sleepHours: r.sleepHours != null ? r.sleepHours : null,
  }));`
);

/* --- the input, paired with BMR so the row stays two-up --- */
rep(
  `          <div className="field-row">
            <div className="field">
              <label>體年齡</label>
              <input type="number" step="1" value={recordForm.bodyAge} onChange={(e) => setRecordForm({ ...recordForm, bodyAge: e.target.value })} />
            </div>
            <div className="field">
              <label>基礎代謝率（kcal）</label>
              <input type="number" step="1" value={recordForm.bmr} onChange={(e) => setRecordForm({ ...recordForm, bmr: e.target.value })} />
            </div>
          </div>`,
  `          <div className="field-row">
            <div className="field">
              <label>體年齡</label>
              <input type="number" step="1" value={recordForm.bodyAge} onChange={(e) => setRecordForm({ ...recordForm, bodyAge: e.target.value })} />
            </div>
            <div className="field">
              <label>基礎代謝率（kcal）</label>
              <input type="number" step="1" value={recordForm.bmr} onChange={(e) => setRecordForm({ ...recordForm, bmr: e.target.value })} />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>昨晚睡眠（小時）</label>
              <input
                type="number"
                step="0.5"
                min="0"
                max="24"
                value={recordForm.sleepHours}
                onChange={(e) => setRecordForm({ ...recordForm, sleepHours: e.target.value })}
                placeholder="例：7.5"
              />
            </div>
            <div className="field" />
          </div>`
);

/* --- the trend chart, next to the other zoned ones --- */
rep(
  `      <div className="card">
        <div className="section-title">歷史紀錄</div>`,
  `      <MetricTrendChart
        title="睡眠時數趨勢"
        dataKey="sleepHours"
        unit="小時"
        color="#5A6E8A"
        chartData={chartData}
        zones={sleepZones()}
        zoneExplain="背景顏色為成人睡眠時數參考：黃色偏少（未達7小時）、綠色建議範圍（7-9小時）、藍色偏多（超過9小時）。輪班工作或有睡眠疾患者請依醫師建議。"
      />

      <div className="card">
        <div className="section-title">歷史紀錄</div>`
);

/* --- show it in the history row --- */
rep(
  `            {r.bmr != null ? \`BMR \${fmtNum(r.bmr, 0)}kcal\` : ""}`,
  `            {r.bmr != null ? \`BMR \${fmtNum(r.bmr, 0)}kcal\` : ""}
            {r.sleepHours != null ? \`\${r.bmr != null ? " ・ " : ""}睡眠 \${fmtNum(r.sleepHours)} 小時\` : ""}`
);

writeFileSync(APP, s);
console.log(missed.length ? 'MISSED:\n' + missed.join('\n') : 'sleep hours added');
