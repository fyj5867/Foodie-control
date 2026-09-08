/**
 * Styles the Apple-Fitness-style metric row under the rings.
 *
 * Run from source/:  node tools/patch-ring-metrics-css.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';

const APP = 'App.jsx';
let s = readFileSync(APP, 'utf8').replace(/\r\n/g, '\n');

const anchor = '        .week-block{ margin-top:18px; }';
if (!s.includes(anchor)) throw new Error('could not find the style anchor');

const css = `        /* Three metrics, Apple Fitness style: the figure is the biggest thing
           on the block and carries the metric's colour; the goal sits under it
           so the denominator is stated rather than implied by a ring's fill. */
        .ring-metrics{
          display:grid; grid-template-columns:repeat(3,1fr);
          gap:8px; margin-top:16px;
        }
        .ring-metric{
          display:flex; flex-direction:column; align-items:center; gap:1px;
          padding:10px 4px; border-radius:12px; background:var(--surface-2);
        }
        .ring-metric.met{ background:var(--brand-soft); }
        .rm-label{
          display:inline-flex; align-items:center; gap:3px;
          font-size:11px; font-weight:700; letter-spacing:.03em;
        }
        .rm-value{
          font-size:24px; font-weight:700; line-height:1.15;
          font-variant-numeric:tabular-nums; letter-spacing:-.02em;
        }
        .rm-goal{
          font-size:11px; color:var(--ink-soft); font-variant-numeric:tabular-nums;
        }

`;

s = s.replace(anchor, css + anchor);
writeFileSync(APP, s);
console.log('ring metric styles added');
