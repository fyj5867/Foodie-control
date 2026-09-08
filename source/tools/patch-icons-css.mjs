/**
 * Styles for the goal character icons, and icons on the section headings.
 *
 * The screens were nearly all text, which reads as unfinished however good
 * the wording is. Each of the three conditions now has its own small
 * character in place of a coloured dot, and the card headings carry a glyph
 * so the eye has something to land on.
 *
 * Run from source/:  node tools/patch-icons-css.mjs
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

/* --- the character replaces the dot in the overview rows --- */
rep(
  `        .ring-dot{ width:9px; height:9px; border-radius:50%; flex:0 0 9px; align-self:center; }`,
  `        .ring-ico{
          flex:0 0 28px; width:28px; height:28px; align-self:center;
          display:flex; align-items:center; justify-content:center;
        }
        .ring-ico svg{ width:28px; height:28px; }
        .ring-dot{ width:9px; height:9px; border-radius:50%; flex:0 0 9px; align-self:center; }`
);

/* --- and sits above the label in the activity blocks --- */
rep(
  `        .ring-metric{
          display:flex; flex-direction:column; align-items:center; gap:1px;
          padding:10px 4px; border-radius:12px; background:var(--surface-2);
        }`,
  `        .ring-metric{
          display:flex; flex-direction:column; align-items:center; gap:1px;
          padding:9px 4px 10px; border-radius:12px; background:var(--surface-2);
        }
        .rm-icon{ margin-bottom:2px; }`
);

/* --- give the headings a glyph so they are not bare text --- */
rep(
  `        .section-title{`,
  `        .section-title-ico{
          display:inline-flex; align-items:center; gap:7px;
        }
        .section-title-ico svg{ flex:0 0 auto; color:var(--brand); }
        .section-title{`
);

writeFileSync(APP, s);
console.log(missed.length ? 'MISSED:\n' + missed.join('\n') : 'icon styles added');
