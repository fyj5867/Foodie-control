/**
 * The garden — every finished tree, kept.
 *
 * This is the long-term payoff: one tree per 30 met days, planted and never
 * removed. Trees are laid out on a shallow landscape with small, deterministic
 * variations in size and position so a row of them reads as a grove rather
 * than one drawing stamped repeatedly. The variation is derived from the
 * tree's index, so a given tree looks the same every time the screen is
 * opened. Colour is deliberately NOT varied — the Health Forest canvas fixes
 * every outline at #3A4C3A over one set of fills, and retinting would break
 * that.
 */

import React from "react";
import { PlantBody, groundY } from "./Sprout.jsx";

const VIEW_W = 358;
const VIEW_H = 300;

/* PlantBody draws in the Health Forest canvas's own 96x96 space. Where the
 * plant meets the ground is not the same for every stage — the potted stages
 * rest on the bottom of the pot, the finished tree on its own grass mound —
 * so it comes from groundY(stage) rather than one constant. */
const PLANT_MID = 48;
const TREE_BASE = groundY("forest");

/** Where the still-growing plant stands: front-right, clear of the rows behind. */
const GROWING_X = 302;
const GROWING_Y = 278;
const GROWING_SCALE = 0.95;

/** Cheap deterministic pseudo-random in [0,1) from an integer seed. */
function jitter(seed, salt) {
  const x = Math.sin(seed * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/* The canvas draws one plant, not a palette of them, so finished plants vary
 * by size and position only — recolouring them would break the design's rule
 * that every outline is #3A4C3A over a fixed set of fills. */

/**
 * Place up to `perRow` trees across the width, in rows that step down the
 * canvas so nearer rows sit lower and larger — enough depth to read as a
 * space without needing real perspective.
 */
function layout(count) {
  if (count <= 0) return [];
  const perRow = count <= 3 ? 3 : count <= 8 ? 4 : 5;
  const rows = Math.ceil(count / perRow);
  const spots = [];

  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / perRow);
    const col = i % perRow;
    const inRow = Math.min(perRow, count - row * perRow);

    // Rows further back sit higher and smaller. The base offset keeps the
    // tallest tree's crown clear of the top edge — a clipped treetop reads
    // as a rendering bug rather than depth.
    const depth = rows === 1 ? 1 : 1 - row / rows;
    const baseY = TREE_BASE + (VIEW_H - 190) * (0.5 + 0.42 * (1 - depth));
    const slotW = VIEW_W / (inRow + 1);
    const baseX = slotW * (col + 1);

    spots.push({
      x: baseX + (jitter(i, 1) - 0.5) * slotW * 0.3,
      y: baseY + (jitter(i, 2) - 0.5) * 12,
      scale: 0.9 + depth * 0.5 + jitter(i, 3) * 0.18,
      seed: i,
    });
  }

  // Draw back rows first so front trees overlap them.
  return spots.sort((a, b) => a.y - b.y);
}

function GroundCover() {
  return (
    <>
      <ellipse cx="88" cy="240" rx="140" ry="34" fill="var(--soil)" opacity="0.16" />
      <ellipse cx="300" cy="252" rx="122" ry="30" fill="var(--soil)" opacity="0.13" />
      <ellipse cx="188" cy="286" rx="196" ry="44" fill="var(--soil)" opacity="0.26" />
      <path d="M0 262 Q90 246 188 254 Q286 262 358 250" stroke="var(--soil)" strokeWidth="1.6" fill="none" opacity="0.35" />
      <g stroke="var(--leaf-dk)" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.4">
        <path d="M40 268 C37 261 37 256 39 251" />
        <path d="M48 270 C47 263 49 258 53 254" />
        <path d="M330 266 C333 259 333 254 331 249" />
        <path d="M216 276 C214 270 215 265 218 261" />
      </g>
      <ellipse cx="130" cy="274" rx="12" ry="6" fill="var(--stone)" opacity="0.4" />
      <ellipse cx="286" cy="282" rx="9" ry="5" fill="var(--stone)" opacity="0.35" />
    </>
  );
}

/**
 * @param completedTrees how many trees are finished and planted
 * @param currentStage    the stage key of the tree still growing
 * @param vitality        today's vitality, applied to the growing tree only
 */
export default function Garden({ completedTrees = 0, currentStage = "seed", vitality = "fair" }) {
  const spots = layout(completedTrees);
  const growingBase = groundY(currentStage);
  const label =
    completedTrees === 0
      ? "花園裡還沒有完成的樹，第一棵正在長"
      : `花園裡有 ${completedTrees} 棵完成的樹，還有一棵正在長`;

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      role="img"
      aria-label={label}
      style={{ display: "block", width: "100%", height: "auto" }}
    >
      <rect width={VIEW_W} height={VIEW_H} fill="var(--surface-2)" />
      <circle cx="286" cy="66" r="74" fill="var(--glow)" opacity="0.5" />
      <circle cx="286" cy="66" r="44" fill="var(--glow)" opacity="0.45" />

      <GroundCover />

      {spots.map((spot) => (
        <g key={spot.seed}>
          <ellipse
            cx={spot.x}
            cy={spot.y + 3 * spot.scale}
            rx={20 * spot.scale}
            ry={3.4 * spot.scale}
            fill="var(--ink)"
            opacity="0.08"
          />
          <g
            transform={`translate(${spot.x - PLANT_MID * spot.scale},${spot.y - TREE_BASE * spot.scale}) scale(${spot.scale})`}
          >
            <PlantBody stage="forest" vitality="fair" />
          </g>
        </g>
      ))}

      {/* The tree still being grown, ringed so it is findable at a glance.
          Base sits at (GROWING_X, GROWING_Y) — the ring is centred a little
          above that, around the body of the plant rather than its roots. */}
      <ellipse
        cx={GROWING_X}
        cy={GROWING_Y + 3 * GROWING_SCALE}
        rx={20 * GROWING_SCALE}
        ry={3.4 * GROWING_SCALE}
        fill="var(--ink)"
        opacity="0.08"
      />
      <g
        transform={`translate(${GROWING_X - PLANT_MID * GROWING_SCALE},${GROWING_Y - growingBase * GROWING_SCALE}) scale(${GROWING_SCALE})`}
      >
        <PlantBody stage={currentStage} vitality={vitality} />
      </g>
      <circle
        cx={GROWING_X}
        cy={GROWING_Y - 22}
        r="38"
        fill="none"
        stroke="var(--move)"
        strokeWidth="1.6"
        strokeDasharray="4 5"
        opacity="0.6"
      />
    </svg>
  );
}
