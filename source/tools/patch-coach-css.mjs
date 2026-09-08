/**
 * Styles for the avatar, the nickname field and the daily coach cards.
 *
 * Run from source/:  node tools/patch-coach-css.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';

const APP = 'App.jsx';
let s = readFileSync(APP, 'utf8').replace(/\r\n/g, '\n');

const anchor = '        .growth-card{ padding:0; overflow:hidden; }';
if (!s.includes(anchor)) throw new Error('could not find the style anchor');

const css = `        /* --- identity: avatar + nickname --- */
        .identity-row{
          display:flex; align-items:flex-start; gap:16px;
          padding-bottom:16px; margin-bottom:16px;
          border-bottom:1px solid var(--line);
        }
        .identity-name{ flex:1; min-width:0; }
        .field-hint{
          margin:5px 0 0; font-size:11px; color:var(--ink-soft); line-height:1.5;
        }
        .avatar-picker{ display:flex; flex-direction:column; align-items:center; gap:6px; }
        .avatar-frame{
          position:relative; border-radius:50%; overflow:hidden;
          background:var(--surface-2); border:2px solid var(--line);
          flex:0 0 auto;
        }
        .avatar-frame img{ width:100%; height:100%; object-fit:cover; display:block; }
        /* The sprout stands in until a picture is picked — an empty circle or a
           grey silhouette would be the least characterful thing in the app. */
        .avatar-fallback{
          width:100%; height:100%; display:flex; align-items:center; justify-content:center;
          padding:6px; box-sizing:border-box;
        }
        .avatar-edit{
          position:absolute; right:-2px; bottom:-2px;
          width:26px; height:26px; border-radius:50%;
          border:2px solid var(--card); background:var(--brand); color:#fff;
          display:flex; align-items:center; justify-content:center;
          cursor:pointer; padding:0;
        }
        .avatar-actions{ display:flex; align-items:center; gap:8px; }
        .avatar-link{
          border:none; background:none; padding:0; cursor:pointer;
          font-size:11.5px; font-family:inherit; color:var(--brand);
        }
        .avatar-link-quiet{
          color:var(--ink-soft); display:inline-flex; align-items:center; gap:3px;
        }
        .avatar-error{ font-size:11px; color:var(--red); text-align:center; }
        .avatar-input{ display:none; }

        /* --- the morning line and the evening summary --- */
        .coach{
          background:var(--card); border:1px solid var(--line);
          border-radius:16px; padding:14px 16px 16px; margin-bottom:14px;
        }
        .coach-morning{ background:var(--amber-soft); border-color:#EBDCC0; }
        .coach-evening{ background:var(--brand-soft); border-color:#CFE3DA; }
        .coach-head{ display:flex; align-items:center; gap:7px; }
        .coach-icon{ display:inline-flex; color:var(--ink-soft); }
        .coach-morning .coach-icon{ color:var(--amber); }
        .coach-evening .coach-icon{ color:var(--brand); }
        .coach-title{
          font-size:12px; font-weight:700; letter-spacing:.04em; color:var(--ink-soft);
        }
        .coach-close{
          margin-left:auto; border:none; background:none; padding:4px; cursor:pointer;
          color:var(--ink-soft); display:flex; min-width:28px; min-height:28px;
          align-items:center; justify-content:center;
        }
        .coach-body{ display:flex; align-items:center; gap:11px; margin-top:8px; }
        .coach-avatar{
          width:38px; height:38px; border-radius:50%; object-fit:cover;
          flex:0 0 38px; border:1.5px solid rgba(255,255,255,.8);
        }
        .coach-line{
          margin:0; font-size:15px; line-height:1.6; color:var(--ink); flex:1;
        }
        .coach-cols{ display:flex; flex-direction:column; gap:10px; margin-top:14px; }
        .coach-col-title{
          font-size:11.5px; font-weight:700; letter-spacing:.03em; margin-bottom:4px;
        }
        .coach-col-good .coach-col-title{ color:var(--brand); }
        .coach-col-watch .coach-col-title{ color:var(--amber); }
        .coach-col ul{ margin:0; padding-left:1.15em; }
        .coach-col li{
          font-size:13px; line-height:1.65; color:var(--ink); margin-bottom:2px;
        }

`;

s = s.replace(anchor, css + anchor);
writeFileSync(APP, s);
console.log('coach and avatar styles added');
