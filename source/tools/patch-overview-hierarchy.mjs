/**
 * Fixes the overview's type hierarchy.
 *
 * The most actionable text on the screen — what is still missing today — was
 * the smallest and lightest on the card, wrapped across two lines and joined
 * by "・", while the same facts were repeated in the numbers underneath.
 *
 * Now: a headline says how many conditions are still open, the mood line is
 * clearly secondary, and each shortfall sits on the row of the number it
 * refers to.
 *
 * Run from source/:  node tools/patch-overview-hierarchy.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';

const APP = 'App.jsx';
// git checks this file out with CRLF (core.autocrlf=true), so multi-line
// patterns written with \n never match. Normalise first; git restores CRLF.
let s = readFileSync(APP, 'utf8').replace(/\r\n/g, '\n');
const missed = [];
const rep = (a, b) => {
  if (!s.includes(a)) {
    missed.push(a.slice(0, 60).replace(/\n/g, '|'));
    return;
  }
  s = s.replace(a, b);
};

rep(
  `        .growth-status{ padding:12px 16px 0; text-align:center; }
        .growth-lead{ font-size:15px; color:var(--ink); }
        .growth-gap{ margin-top:3px; font-size:13px; color:var(--ink-soft); }`,
  `        .growth-status{ padding:14px 16px 0; text-align:center; }
        .growth-head{
          font-size:21px; font-weight:700; letter-spacing:-.01em; line-height:1.3;
        }
        .growth-head.tone-done{ color:var(--brand); }
        .growth-head.tone-part{ color:var(--ink); }
        .growth-head.tone-none{ color:var(--ink); }
        .growth-mood{ margin-top:2px; font-size:13px; color:var(--ink-soft); }`
);

rep(
  `        .ring-legend{ display:flex; flex-direction:column; gap:6px; padding:12px 16px 0; }
        .ring-legend.compact{ padding:10px 16px 0; }
        .ring-row{ display:flex; align-items:baseline; gap:8px; font-size:13px; color:var(--ink-soft); }
        .ring-dot{ width:8px; height:8px; border-radius:50%; flex:0 0 8px; align-self:center; }
        .ring-k{ width:34px; flex:0 0 34px; }
        .ring-v{ font-weight:700; color:var(--ink); font-variant-numeric:tabular-nums; }
        .ring-g{ font-size:12px; }
        .ring-check{ margin-left:auto; color:var(--brand); flex:0 0 auto; align-self:center; }
        .ring-row.met .ring-v{ color:var(--brand); }`,
  `        .ring-legend{ display:flex; flex-direction:column; gap:2px; padding:14px 16px 0; }
        .ring-legend.compact{ padding:12px 16px 0; }
        .ring-row{
          display:flex; align-items:baseline; gap:8px;
          font-size:14px; color:var(--ink-soft);
          padding:7px 10px; border-radius:10px; background:var(--surface-2);
        }
        .ring-dot{ width:9px; height:9px; border-radius:50%; flex:0 0 9px; align-self:center; }
        .ring-k{ width:36px; flex:0 0 36px; color:var(--ink); }
        .ring-v{ font-size:16px; font-weight:700; color:var(--ink); font-variant-numeric:tabular-nums; }
        .ring-g{ font-size:12px; }
        /* The shortfall is the point of the row, so it holds the right edge
           and stays legible rather than trailing off in small grey text. */
        .ring-gap{
          margin-left:auto; flex:0 0 auto; font-size:13px; font-weight:500;
          color:var(--amber);
        }
        .ring-done{
          margin-left:auto; flex:0 0 auto; display:inline-flex; align-items:center; gap:4px;
          font-size:12.5px; color:var(--brand); align-self:center;
        }
        .ring-row.met{ background:var(--brand-soft); }
        .ring-row.met .ring-v{ color:var(--brand); }`
);

rep(
  `        .growth-note{ padding:10px 16px 0; font-size:12.5px; color:var(--ink-soft); text-align:center; }`,
  `        .growth-note{ padding:10px 16px 0; font-size:13.5px; color:var(--ink-soft); text-align:center; }`
);

writeFileSync(APP, s);
console.log(missed.length ? 'MISSED:\n' + missed.join('\n') : 'overview hierarchy restyled');
