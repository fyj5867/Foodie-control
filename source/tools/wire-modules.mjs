/**
 * One-off surgery on App.jsx.
 *
 * Replaces the inlined health domain logic with an import from lib/health.js,
 * so there is one copy rather than two that quietly drift apart, and wires in
 * the growth/garden hook next to the calorie target it depends on.
 *
 * Run from source/:  node tools/wire-modules.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';

const APP = 'App.jsx';
const lines = readFileSync(APP, 'utf8').split('\n');

const FIRST = 37; // const SYMPTOM_OPTIONS = [
const LAST = 538; // closing brace of buildWeeklyCalorieData

if (!lines[FIRST - 1].startsWith('const SYMPTOM_OPTIONS')) {
  throw new Error(`line ${FIRST} is not SYMPTOM_OPTIONS: ${lines[FIRST - 1]}`);
}
if (lines[LAST - 1].trim() !== '}') {
  throw new Error(`line ${LAST} is not a closing brace: ${lines[LAST - 1]}`);
}
if (!lines.slice(LAST, LAST + 3).some((l) => l.startsWith('function fileToBase64'))) {
  throw new Error('boundary drifted: expected fileToBase64 to follow');
}

// Take the export list straight from health.js so the import can never fall
// out of step with what that module actually provides.
const healthSource = readFileSync('lib/health.js', 'utf8');
const exportBlock = /export \{([\s\S]*?)\};/.exec(healthSource);
if (!exportBlock) throw new Error('could not find the export block in lib/health.js');
const healthNames = exportBlock[1]
  .split(',')
  .map((n) => n.trim())
  .filter(Boolean);

const importBlock = `/* ----------------------------------------------------------------------- */
/* Domain logic                                                            */
/*                                                                         */
/* Health reference values and calculations live in lib/health.js — they    */
/* carry cited sources and a review date, and must have exactly one home.   */
/* Growth and garden rules live in lib/goals.js.                           */
/* ----------------------------------------------------------------------- */

import {
${healthNames.map((n) => `  ${n},`).join('\n')}
} from "./lib/health.js";
import { STAGES, VITALITY, canBackfill, WATER_GOAL_ML, EXERCISE_GOAL_MIN, TREE_DAYS } from "./lib/goals.js";
import useGarden from "./lib/useGarden.js";
import Sprout from "./components/Sprout.jsx";
import GardenScene from "./components/Garden.jsx";
import Rings, { RingLegend } from "./components/Rings.jsx";`;

const head = lines.slice(0, FIRST - 1); // through line 36
const tail = lines.slice(LAST); // from line 539 on
let next = [...head, importBlock, ...tail];

// Wire the hook in right after the calorie target it consumes.
const text = next.join('\n');
const anchor =
  '  const dailyCalorieTarget = calorieOverrideValue != null ? calorieOverrideValue : calorieBreakdown ? calorieBreakdown.target : null;';
if (!text.includes(anchor)) throw new Error('could not find the dailyCalorieTarget line');

const hookBlock = `${anchor}

  /* Today's verdict against the three conditions, and the garden rolled up
   * from every day recorded so far. \`ready\` holds the one-time rebuild back
   * until the app's own data has finished loading — running it against empty
   * logs would record a month of days as unmet. */
  const {
    today: todayGoals,
    garden,
    recordDay: recordGardenDay,
    backfillReport,
    dismissBackfillReport,
  } = useGarden({
    foodLog,
    waterLog,
    exerciseLog,
    calorieTarget: dailyCalorieTarget,
    ready: !loading,
  });`;

const wired = text.replace(anchor, hookBlock);
writeFileSync(APP, wired);

const removed = LAST - FIRST + 1;
console.log(`replaced lines ${FIRST}-${LAST} (${removed} lines) with an import of ${healthNames.length} names`);
console.log(`App.jsx: ${lines.length} -> ${wired.split('\n').length} lines`);
