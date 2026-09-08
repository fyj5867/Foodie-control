/**
 * The sprout — the plant itself has the face.
 *
 * The face always sits on whatever the plant's main mass is at that stage: on
 * the bean while it is a bean, on the canopy once it is a tree. An earlier
 * version kept a face-bearing bean at the base for every stage, which left a
 * full tree standing over a separate little creature — two characters instead
 * of one growing up. The water mascot works because the bottle has the face;
 * the same rule applies here.
 *
 * So the stages read as one thing becoming another:
 *   種子 bean → 冒芽 · 小苗 · 幼苗 sprout with leaf pairs → 小樹 tree → 開花
 *
 * Face colours follow the water mascot exactly (#1E2A22 ink, #F6A6A6 cheeks,
 * #FFC94A sparkles), so the two characters look drawn by one hand. Those are
 * literal rather than themed for the same reason the water bottle is always
 * blue: it is a character, not a surface.
 *
 * Vitality changes the face, the tint and the leaf angle — never the size —
 * so mood and progress never get mistaken for each other.
 */

import React from "react";

const INK = "#1E2A22";
const CHEEK = "#F6A6A6";
const SPARKLE = "#FFC94A";

/** The soil line every stage stands on. */
const GROUND = 170;

/**
 * Everything vitality changes. `droop` is added to each leaf's angle, so a
 * tired plant's leaves fall towards horizontal and a thriving one's lift.
 *
 * The bean stays beige even at the worst mood — a bean is beige whatever kind
 * of day it has had. Greying it out too made the whole thing look dead rather
 * than tired, which is the one thing this character must never do.
 */
const MOODS = {
  wilting: { face: "sleepy", droop: 30, leaf: "var(--leaf-dull)", bean: "#DFD9C0", stem: "var(--stem-dull)" },
  low: { face: "neutral", droop: 14, leaf: "var(--leaf)", bean: "#E9DFAE", stem: "var(--stem)" },
  fair: { face: "happy", droop: 0, leaf: "var(--leaf)", bean: "#EFE2AC", stem: "var(--stem)" },
  thriving: { face: "party", droop: -10, leaf: "var(--leaf-bright)", bean: "#F5EBBA", stem: "var(--stem)" },
};

/**
 * Stage geometry.
 *
 * `body` is the bean (stages 1-4); `canopy` is the crown (stages 5-6). Each
 * stage has exactly one of them, and `face` names which one the face sits on
 * and how big the features should be for that mass.
 *
 * Each stage also carries its own `view`. A single frame sized for the tallest
 * stage left the early ones as a bean floating in a mostly blank square. All
 * six share a 1.05 aspect ratio so the card does not jump in height when a
 * stage advances.
 */
const STAGES_GEO = {
  seed: {
    body: { rx: 24, ry: 20 },
    face: { on: "body", scale: 0.95 },
    view: "64.3 122 71.4 68",
  },
  sprout: {
    body: { rx: 25, ry: 21 },
    stem: { to: 122, width: 4 },
    pairs: [{ y: 124, rx: 12, ry: 8, angle: -40 }],
    face: { on: "body", scale: 1 },
    view: "51.2 97 97.6 93",
  },
  seedling: {
    body: { rx: 27, ry: 23 },
    stem: { to: 104, width: 4.5 },
    pairs: [{ y: 106, rx: 17, ry: 10, angle: -38 }],
    face: { on: "body", scale: 1.05 },
    view: "38 72 124 118",
  },
  sapling: {
    body: { rx: 29, ry: 25 },
    stem: { to: 82, width: 5 },
    pairs: [
      { y: 118, rx: 14, ry: 9, angle: -36 },
      { y: 84, rx: 18, ry: 11, angle: -40 },
    ],
    face: { on: "body", scale: 1.1 },
    view: "25 47 150 143",
  },
  /* From here the bean is gone: it has become the trunk, and the crown takes
   * the face. That handover is what makes 小樹 feel like arriving somewhere
   * rather than gaining one more leaf. */
  tree: {
    trunk: { to: 106, width: 10 },
    pairs: [{ y: 130, rx: 13, ry: 9, angle: -34 }],
    canopy: {
      back: [
        { cx: 78, cy: 92, r: 24 },
        { cx: 122, cy: 92, r: 24 },
      ],
      front: [
        { cx: 100, cy: 74, r: 34 },
        { cx: 74, cy: 84, r: 24 },
        { cx: 126, cy: 84, r: 24 },
      ],
    },
    face: { on: "canopy", cy: 80, scale: 1.35 },
    view: "18 34 164 156",
  },
  bloom: {
    trunk: { to: 102, width: 10.5 },
    pairs: [{ y: 130, rx: 13, ry: 9, angle: -34 }],
    canopy: {
      back: [
        { cx: 76, cy: 90, r: 26 },
        { cx: 124, cy: 90, r: 26 },
      ],
      front: [
        { cx: 100, cy: 70, r: 36 },
        { cx: 72, cy: 82, r: 26 },
        { cx: 128, cy: 82, r: 26 },
      ],
    },
    face: { on: "canopy", cy: 76, scale: 1.4 },
    flowers: [
      { x: 100, y: 36, s: 0.6 },
      { x: 70, y: 54, s: 0.54 },
      { x: 130, y: 54, s: 0.54 },
      { x: 54, y: 84, s: 0.5 },
      { x: 146, y: 84, s: 0.5 },
    ],
    view: "15 28 170 162",
  },
};

/** Where the body's centre sits so it rests on the soil. */
function bodyCy(body) {
  return GROUND - body.ry;
}

/**
 * One leaflet.
 *
 * A plump lens shape rather than an ellipse: it narrows to a soft rounded tip
 * and bulges near the base, which is what makes it read as a leaf rather than
 * a disc. Drawn once at unit length pointing right, then scaled — so tuning
 * the silhouette is one path, not six sets of numbers.
 *
 * The gloss highlight does most of the charm work; without it the leaves go
 * flat and plasticky.
 */
const LEAFLET =
  "M0 0 C 0.10 -0.62, 0.48 -0.86, 0.74 -0.62 C 0.95 -0.42, 1.02 -0.14, 1 0 C 1.02 0.14, 0.95 0.42, 0.74 0.62 C 0.48 0.86, 0.10 0.62, 0 0 Z";
const LEAFLET_GLOSS = "M0.20 -0.20 C 0.34 -0.50, 0.56 -0.58, 0.70 -0.44 C 0.54 -0.34, 0.34 -0.18, 0.20 -0.20 Z";

function Leaflet({ x, y, rx, ry, angle, fill }) {
  const len = rx * 1.9;
  return (
    <g transform={`translate(${x},${y}) rotate(${angle}) scale(${len},${ry})`}>
      <path d={LEAFLET} fill={fill} />
      <path d={LEAFLET_GLOSS} fill="#FFFFFF" opacity="0.28" />
      <path
        d="M0.06 0 Q 0.5 0.06 0.9 0"
        stroke="var(--leaf-dk)"
        strokeWidth="1.4"
        fill="none"
        opacity="0.28"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </g>
  );
}

/** A pair, mirrored about the stem. */
function LeafPair({ pair, droop, fill }) {
  const spec = { x: 100, y: pair.y, rx: pair.rx, ry: pair.ry, angle: pair.angle + droop, fill };
  return (
    <g>
      <g transform="scale(-1,1) translate(-200,0)">
        <Leaflet {...spec} />
      </g>
      <Leaflet {...spec} />
    </g>
  );
}

function Flower({ x, y, s }) {
  return (
    <g transform={`translate(${x},${y}) scale(${s})`}>
      <circle cx="0" cy="-7" r="5" fill="var(--bloom)" />
      <circle cx="6.7" cy="-2.2" r="5" fill="var(--bloom)" />
      <circle cx="4.1" cy="5.7" r="5" fill="var(--bloom)" />
      <circle cx="-4.1" cy="5.7" r="5" fill="var(--bloom)" />
      <circle cx="-6.7" cy="-2.2" r="5" fill="var(--bloom)" />
      <circle cx="0" cy="0" r="3.6" fill="var(--bloom-mid)" />
    </g>
  );
}

/**
 * The face. Four expressions, one per number of daily conditions met — the
 * same four moods the water mascot uses.
 *
 * @param cx,cy centre of the mass it sits on
 * @param scale features scale with that mass, so they stay in proportion
 *              whether the face is on a bean or on a crown
 */
function Face({ cx, cy, scale, mood }) {
  const eyeR = 4 * scale;
  const eyeDx = 8.5 * scale;
  const eyeY = cy - 1 * scale;
  const mouthY = eyeY + 9 * scale;
  const stroke = 2.4 * scale;

  if (mood === "sleepy") {
    return (
      <g fill="none" stroke={INK} strokeWidth={stroke} strokeLinecap="round">
        <path d={`M${cx - eyeDx - 4 * scale} ${eyeY} Q${cx - eyeDx} ${eyeY - 5 * scale} ${cx - eyeDx + 4 * scale} ${eyeY}`} />
        <path d={`M${cx + eyeDx - 4 * scale} ${eyeY} Q${cx + eyeDx} ${eyeY - 5 * scale} ${cx + eyeDx + 4 * scale} ${eyeY}`} />
        <path d={`M${cx - 3.5 * scale} ${mouthY} L${cx + 3.5 * scale} ${mouthY}`} />
      </g>
    );
  }

  const cheeky = mood === "happy" || mood === "party";

  return (
    <g>
      {cheeky ? (
        <>
          <circle cx={cx - 16 * scale} cy={eyeY + 4.5 * scale} r={(mood === "party" ? 5 : 4.2) * scale} fill={CHEEK} opacity="0.85" />
          <circle cx={cx + 16 * scale} cy={eyeY + 4.5 * scale} r={(mood === "party" ? 5 : 4.2) * scale} fill={CHEEK} opacity="0.85" />
        </>
      ) : null}

      <circle cx={cx - eyeDx} cy={eyeY} r={eyeR} fill={INK} />
      <circle cx={cx + eyeDx} cy={eyeY} r={eyeR} fill={INK} />

      {mood === "neutral" ? (
        <path
          d={`M${cx - 5 * scale} ${mouthY} L${cx + 5 * scale} ${mouthY}`}
          fill="none"
          stroke={INK}
          strokeWidth={stroke}
          strokeLinecap="round"
        />
      ) : (
        <path
          d={`M${cx - 6 * scale} ${mouthY - 2 * scale} Q${cx} ${mouthY + (mood === "party" ? 7 : 5) * scale} ${
            cx + 6 * scale
          } ${mouthY - 2 * scale}`}
          fill="none"
          stroke={INK}
          strokeWidth={stroke * 1.15}
          strokeLinecap="round"
        />
      )}
    </g>
  );
}

/** A four-pointed star, sized and placed relative to the frame. */
function star(x, y, s) {
  return `M${x} ${y - 4 * s} L${x + 1.3 * s} ${y - 1.3 * s} L${x + 4 * s} ${y} L${x + 1.3 * s} ${y + 1.3 * s} L${x} ${
    y + 4 * s
  } L${x - 1.3 * s} ${y + 1.3 * s} L${x - 4 * s} ${y} L${x - 1.3 * s} ${y - 1.3 * s} Z`;
}

/**
 * Sparkles positioned from the frame, not from fixed coordinates — each stage
 * has its own viewBox, and fixed points would fall outside the small ones.
 */
function Sparkles({ vx, vy, vw, vh }) {
  const s = vh / 42;
  return (
    <g fill={SPARKLE}>
      <path d={star(vx + vw * 0.11, vy + vh * 0.24, s)} />
      <path d={star(vx + vw * 0.91, vy + vh * 0.13, s * 1.15)} />
      <path d={star(vx + vw * 0.87, vy + vh * 0.44, s * 0.8)} />
    </g>
  );
}

/**
 * The plant as a bare <g>, for dropping into a larger scene such as the
 * garden. Drawn around x=100 standing on the soil line at y=170.
 */
export function PlantBody({ stage = "sapling", vitality = "fair", leafTint }) {
  const geo = STAGES_GEO[stage] || STAGES_GEO.sapling;
  const mood = MOODS[vitality] || MOODS.fair;
  const leafFill = leafTint || mood.leaf;

  const cy = geo.body ? bodyCy(geo.body) : null;
  const stalk = geo.trunk ? { ...geo.trunk, from: GROUND } : geo.stem ? { ...geo.stem, from: cy } : null;

  const faceAt = geo.face.on === "canopy" ? { cx: 100, cy: geo.face.cy } : { cx: 100, cy };

  return (
    <g>
      {stalk ? (
        <path
          d={`M100 ${stalk.from} L100 ${stalk.to}`}
          stroke={geo.trunk ? "var(--soil)" : mood.stem}
          strokeWidth={stalk.width}
          strokeLinecap="round"
        />
      ) : null}

      {geo.pairs ? geo.pairs.map((pair, i) => <LeafPair key={`p${i}`} pair={pair} droop={mood.droop} fill={leafFill} />) : null}

      {geo.canopy ? (
        <g>
          {geo.canopy.back.map((c, i) => (
            <circle
              key={`cb${i}`}
              cx={c.cx}
              cy={c.cy}
              r={c.r}
              fill="var(--leaf-dk)"
              opacity={mood.face === "sleepy" ? 0.55 : 1}
            />
          ))}
          {geo.canopy.front.map((c, i) => (
            <circle key={`cf${i}`} cx={c.cx} cy={c.cy} r={c.r} fill={leafFill} />
          ))}
          <ellipse cx="80" cy={geo.canopy.front[0].cy - 16} rx="17" ry="9" fill="#FFFFFF" opacity="0.2" />
        </g>
      ) : null}

      {geo.body ? (
        <>
          <ellipse cx="100" cy={cy} rx={geo.body.rx} ry={geo.body.ry} fill={mood.bean} />
          <ellipse
            cx="96"
            cy={cy - geo.body.ry * 0.4}
            rx={geo.body.rx * 0.5}
            ry={geo.body.ry * 0.3}
            fill="#FFFFFF"
            opacity="0.35"
          />
        </>
      ) : null}

      <Face cx={faceAt.cx} cy={faceAt.cy} scale={geo.face.scale} mood={mood.face} />

      {(geo.flowers || []).map((f, i) => (
        <Flower key={`fl${i}`} {...f} />
      ))}
    </g>
  );
}

/**
 * A single sprout on its own patch of soil — the main screen's centrepiece.
 *
 * @param stage    one of the STAGES keys from lib/goals.js
 * @param vitality one of the VITALITY keys — how today went
 * @param ground   draw the soil mound
 * @param glow     warm light behind, used at the best state
 */
export default function Sprout({
  stage = "sapling",
  vitality = "fair",
  ground = true,
  glow = false,
  title,
  className,
}) {
  const geo = STAGES_GEO[stage] || STAGES_GEO.sapling;
  const mood = MOODS[vitality] || MOODS.fair;

  // The glow follows the frame rather than a fixed point, so it stays behind
  // the character at every stage instead of drifting out of the box.
  const [vx, vy, vw, vh] = geo.view.split(" ").map(Number);

  return (
    <svg
      viewBox={geo.view}
      className={className}
      role="img"
      aria-label={title || "豆苗"}
      style={{ display: "block", width: "100%", height: "auto" }}
    >
      {glow ? (
        <circle cx={vx + vw / 2} cy={vy + vh * 0.46} r={vh * 0.44} fill="var(--glow)" opacity="0.55" />
      ) : null}

      {ground ? (
        <>
          <ellipse cx="100" cy={GROUND + 4} rx="56" ry="12" fill="var(--soil-dk)" />
          <ellipse cx="100" cy={GROUND} rx="56" ry="11" fill="var(--soil)" />
        </>
      ) : null}

      <PlantBody stage={stage} vitality={vitality} />

      {mood.face === "party" ? <Sparkles vx={vx} vy={vy} vw={vw} vh={vh} /> : null}
    </svg>
  );
}

export { STAGES_GEO, MOODS, GROUND };
