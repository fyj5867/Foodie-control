/**
 * The garden — every finished tree, kept.
 *
 * This is the long-term payoff: one tree per 30 met days, planted and never
 * removed. Trees are laid out on a shallow landscape and given small,
 * deterministic variations in size, position and leaf tint, so a row of them
 * reads as a grove rather than one drawing stamped repeatedly. The variation
 * is derived from the tree's index, so a given tree looks the same every time
 * the screen is opened.
 */

import React from "react";
import { PlantBody } from "./Sprout.jsx";

const VIEW_W = 358;
const VIEW_H = 300;

/** Where the still-growing tree stands: front-right, clear of the rows behind. */
const GROWING_X = 296;
const GROWING_Y = 262;
const GROWING_SCALE = 0.5;

/** Cheap deterministic pseudo-random in [0,1) from an integer seed. */
function jitter(seed, salt) {
  const x = Math.sin(seed * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

const LEAF_TINTS = ["var(--leaf)", "var(--leaf-bright)", "var(--leaf-dk)"];

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
    const baseY = 158 + (VIEW_H - 190) * (0.5 + 0.42 * (1 - depth));
    const slotW = VIEW_W / (inRow + 1);
    const baseX = slotW * (col + 1);

    spots.push({
      x: baseX + (jitter(i, 1) - 0.5) * slotW * 0.3,
      y: baseY + (jitter(i, 2) - 0.5) * 12,
      scale: 0.46 + depth * 0.28 + jitter(i, 3) * 0.1,
      tint: LEAF_TINTS[Math.floor(jitter(i, 4) * LEAF_TINTS.length)],
      seed: i,
    });
  }

  // Draw back rows first so front trees overlap them.
  return spots.sort((a, b) => a.y - b.y);
}

function GroundCover() {
  return (
    <>
      <ellipse cx="88" cy="238" rx="136" ry="36" fill="var(--soil)" opacity="0.7" />
      <ellipse cx="300" cy="250" rx="118" ry="32" fill="var(--soil)" opacity="0.55" />
      <ellipse cx="188" cy="288" rx="190" ry="48" fill="var(--soil-dk)" />
      <ellipse cx="188" cy="281" rx="190" ry="45" fill="var(--soil)" />
      <g stroke="var(--leaf-dk)" strokeWidth="2.4" strokeLinecap="round" fill="none" opacity="0.65">
        <path d="M40 268 C37 261 37 256 39 251" />
        <path d="M48 270 C47 263 49 258 53 254" />
        <path d="M330 266 C333 259 333 254 331 249" />
        <path d="M216 276 C214 270 215 265 218 261" />
      </g>
      <ellipse cx="130" cy="274" rx="13" ry="7" fill="var(--stone)" opacity="0.85" />
      <ellipse cx="286" cy="282" rx="10" ry="5.5" fill="var(--stone)" opacity="0.75" />
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
        <g
          key={spot.seed}
          transform={`translate(${spot.x - 100 * spot.scale},${spot.y - 158 * spot.scale}) scale(${spot.scale})`}
        >
          <PlantBody stage="bloom" vitality="fair" leafTint={spot.tint} />
        </g>
      ))}

      {/* The tree still being grown, ringed so it is findable at a glance.
          Base sits at (GROWING_X, GROWING_Y) — the ring is centred a little
          above that, around the body of the plant rather than its roots. */}
      <g
        transform={`translate(${GROWING_X - 100 * GROWING_SCALE},${GROWING_Y - 158 * GROWING_SCALE}) scale(${GROWING_SCALE})`}
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
