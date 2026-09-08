/**
 * Styles for the diary.
 *
 * The photo is sized by aspect ratio rather than a fixed height so it holds
 * its proportion on any phone width, landing at roughly a sixth of the screen
 * — big enough to recognise the meal, small enough that a day's three meals
 * fit on one screen.
 *
 * Run from source/:  node tools/patch-diary-css.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';

const APP = 'App.jsx';
let s = readFileSync(APP, 'utf8');

const anchor = '        .activity-card .section-title{ padding:0 0 4px; }';
if (!s.includes(anchor)) throw new Error('could not find the style anchor');

const css = `        .diary-hint{
          font-size:11.5px; color:var(--ink-soft); line-height:1.6;
          margin:-4px 0 14px;
        }
        .diary-day{ padding-bottom:6px; }
        .diary-day + .diary-day{
          border-top:1px solid var(--line); margin-top:18px; padding-top:16px;
        }
        .diary-day-head{ margin-bottom:12px; }
        .diary-day-top{ display:flex; align-items:baseline; gap:8px; }
        .diary-date{ font-size:20px; font-weight:700; color:var(--ink); }
        .diary-weekday{ font-size:12px; color:var(--ink-soft); }
        .diary-met{
          margin-left:auto; font-size:11px; padding:2px 8px; border-radius:999px;
          background:var(--brand-soft); color:var(--brand); font-weight:600;
        }
        .diary-sum{
          margin-top:4px; display:flex; align-items:baseline; gap:4px;
          font-size:12px; color:var(--ink-soft);
        }
        .diary-sum b{
          font-size:15px; color:var(--ink); font-variant-numeric:tabular-nums;
        }
        .diary-remain{ margin-left:auto; color:var(--brand); }
        .diary-remain.over{ color:var(--red); }
        .diary-bar{
          margin-top:7px; height:5px; border-radius:3px;
          background:var(--surface-3); overflow:hidden;
        }
        .diary-bar i{ display:block; height:100%; border-radius:3px; background:var(--amber); }
        .diary-bar i.over{ background:var(--red); }

        .diary-post{ margin-bottom:16px; }
        .diary-post:last-child{ margin-bottom:4px; }
        /* Roughly a sixth of a phone screen; proportion holds at any width. */
        .diary-photo{
          aspect-ratio:16 / 6.5; border-radius:12px; overflow:hidden;
          background:var(--surface-2); border:1px solid var(--line);
          margin-bottom:8px;
        }
        .diary-photo img{ width:100%; height:100%; object-fit:cover; display:block; }
        .diary-photo-gone{
          display:flex; align-items:center; justify-content:center; gap:8px;
          color:var(--ink-soft); font-size:12px;
          border-style:dashed;
        }
        .diary-meta{
          display:flex; align-items:center; gap:8px;
          font-size:11.5px; color:var(--ink-soft);
        }
        .diary-cal{ margin-left:auto; display:inline-flex; align-items:center; gap:3px; }
        .diary-edit-icon{ color:var(--ink-soft); flex:0 0 auto; }
        .diary-del{ flex:0 0 auto; }
        .diary-name{ margin-top:5px; font-size:14.5px; color:var(--ink); line-height:1.5; }
        .diary-note{ margin-top:3px; font-size:12.5px; color:var(--ink-soft); line-height:1.65; }

        .diary-more{
          display:flex; align-items:center; justify-content:center; gap:6px;
          width:100%; min-height:44px; margin-top:10px;
          border:1px solid var(--line); border-radius:12px;
          background:transparent; color:var(--brand);
          font-size:13.5px; font-family:inherit; cursor:pointer;
        }

`;

s = s.replace(anchor, css + anchor);
writeFileSync(APP, s);
console.log('diary styles added');
