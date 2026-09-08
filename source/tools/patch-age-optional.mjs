/**
 * Makes 年齡 optional.
 *
 * Age is not just a label — two calculations lean on it, so removing the
 * `required` attribute alone would have quietly broken things:
 *
 * - The Mifflin-St Jeor BMR formula needs age. A measured BMR from the scale
 *   does not, so the calorie target still works if there is a body record;
 *   without either there is no honest number and the app now says so instead
 *   of showing a target built on a guess.
 * - The risk score has an age term. parseInt("") is NaN so it simply does not
 *   fire, which is the right arithmetic — but it means the score is computed
 *   on incomplete information, and the screen should admit that rather than
 *   presenting a confident-looking figure.
 *
 * Run from source/:  node tools/patch-age-optional.mjs
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

/* --- the field itself: optional, and say what it is for --- */
rep(
  `            <label>年齡</label>
            <input
              type="number"
              min="1"
              max="120"
              value={form.age}
              onChange={(e) => setForm((f) => ({ ...f, age: e.target.value }))}
              placeholder="例：45"
              required
            />`,
  `            <label>年齡（選填）</label>
            <input
              type="number"
              min="1"
              max="120"
              value={form.age}
              onChange={(e) => setForm((f) => ({ ...f, age: e.target.value }))}
              placeholder="例：45"
            />
            <p className="field-hint">
              不填也可以。年齡只用來估算基礎代謝率；體態紀錄裡填過基礎代謝率的話就用不到。
            </p>`
);

/* --- auto-save no longer waits for age --- */
rep(
  `    if (!form.age || !form.height || !form.weight) return;`,
  `    // Age is optional, so it is not part of the "enough to save" test.
    if (!form.height || !form.weight) return;`
);

/* --- be honest that the risk estimate is missing a factor --- */
rep(
  `          <div className="gauge-advice">{zone.advice}</div>
        </div>`,
  `          <div className="gauge-advice">{zone.advice}</div>
          {!profile.age ? (
            <div className="gauge-caveat">
              沒有填年齡，這個估算沒有計入年齡因素，實際關注程度可能更高。
            </div>
          ) : null}
        </div>`
);

/* --- explain what would unblock the calorie target --- */
rep(
  `        .growth-note{`,
  `        .gauge-caveat{
          margin-top:8px; font-size:11.5px; color:var(--ink-soft);
          line-height:1.6; text-align:center;
        }
        .growth-note{`
);

writeFileSync(APP, s);
console.log(missed.length ? 'MISSED:\n' + missed.join('\n') : 'age is now optional');
