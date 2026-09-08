/**
 * Wires in the avatar, the nickname, and the daily coach messages.
 *
 * Run from source/:  node tools/patch-coach-avatar.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';

const APP = 'App.jsx';
// git checks this file out with CRLF; normalise so multi-line patterns match.
let s = readFileSync(APP, 'utf8').replace(/\r\n/g, '\n');
const missed = [];
const rep = (a, b) => {
  if (!s.includes(a)) {
    missed.push(a.slice(0, 60).replace(/\n/g, '|'));
    return;
  }
  s = s.replace(a, b);
};

/* --- imports --- */
rep(
  'import DietDiary from "./components/DietDiary.jsx";',
  `import DietDiary from "./components/DietDiary.jsx";
import AvatarPicker from "./components/AvatarPicker.jsx";
import DailyCoach from "./components/DailyCoach.jsx";
import { coachSlot, morningMessage, eveningSummary } from "./lib/coach.js";`
);

/* --- the two new profile fields, in both places the form is initialised --- */
const formFields = `  const [form, setForm] = useState({
    age: "",
    gender: "female",`;
rep(
  formFields,
  `  const [form, setForm] = useState({
    nickname: "",
    avatar: "",
    age: "",
    gender: "female",`
);

rep(
  `    setForm({
      age: "",
      gender: "female",
      height: "",
      weight: "",
      symptoms: [],`,
  `    setForm({
      nickname: "",
      avatar: "",
      age: "",
      gender: "female",
      height: "",
      weight: "",
      symptoms: [],`
);

/* --- coach state: which message has been put away today --- */
rep(
  `  const [calorieOverride, setCalorieOverride] = useState("");`,
  `  const [calorieOverride, setCalorieOverride] = useState("");
  /* Which coach message has been dismissed, as "YYYY-MM-DD:slot". Kept so a
   * message you have already read does not come back on every open. */
  const [coachDismissed, setCoachDismissed] = useState("");`
);

rep(
  `      try {
        const co = await window.storage.get("calorie-target-override", false);`,
  `      try {
        const cd = await window.storage.get("coach-dismissed", false);
        if (cd && cd.value) setCoachDismissed(cd.value);
      } catch (e) {
        /* nothing dismissed yet */
      }
      try {
        const co = await window.storage.get("calorie-target-override", false);`
);

/* --- derive the message next to the goal state it describes --- */
rep(
  `  const garden = useMemo(() => gardenState(summaries), [summaries]);`,
  `  const garden = useMemo(() => gardenState(summaries), [summaries]);`
);

rep(
  `    ready: !loading,
  });`,
  `    ready: !loading,
  });

  /* The morning greeting or the evening summary, whichever the clock calls
   * for. Nothing shows in between — the three rows say it better by then. */
  const slot = coachSlot();
  const coachKey = \`\${todayStr()}:\${slot || "none"}\`;
  const coachVisible = Boolean(slot) && coachDismissed !== coachKey;
  const coachMorning = useMemo(
    () =>
      slot === "morning"
        ? morningMessage({
            dateStr: todayStr(),
            streak: garden.currentStreak,
            nickname: (profile && profile.nickname) || "",
          })
        : null,
    [slot, garden.currentStreak, profile]
  );
  const coachEvening = useMemo(
    () =>
      slot === "evening"
        ? eveningSummary({ day: todayGoals, garden, nickname: (profile && profile.nickname) || "" })
        : null,
    [slot, todayGoals, garden, profile]
  );

  async function dismissCoach() {
    setCoachDismissed(coachKey);
    try {
      await window.storage.set("coach-dismissed", coachKey, false);
    } catch (e) {
      /* dismissing is a convenience; losing it is harmless */
    }
  }`
);

/* --- render it on the overview --- */
rep(
  `              todayGoals={todayGoals}
              garden={garden}`,
  `              todayGoals={todayGoals}
              garden={garden}
              coachSlotName={coachVisible ? slot : null}
              coachMorning={coachMorning}
              coachEvening={coachEvening}
              onDismissCoach={dismissCoach}`
);

rep(
  `  goTracking,
  todayGoals,
  garden,
}) {
  if (!profile) {`,
  `  goTracking,
  todayGoals,
  garden,
  coachSlotName,
  coachMorning,
  coachEvening,
  onDismissCoach,
}) {
  if (!profile) {`
);

rep(
  `  return (
    <>
      {todayGoals && garden ? (
        <GrowthPanel day={todayGoals} garden={garden} onGoActivity={goExercise} />
      ) : null}`,
  `  return (
    <>
      {coachSlotName === "morning" ? (
        <DailyCoach
          slot="morning"
          message={coachMorning}
          nickname={profile.nickname}
          avatar={profile.avatar}
          onDismiss={onDismissCoach}
        />
      ) : null}

      {todayGoals && garden ? (
        <GrowthPanel day={todayGoals} garden={garden} onGoActivity={goExercise} />
      ) : null}

      {coachSlotName === "evening" ? (
        <DailyCoach
          slot="evening"
          summary={coachEvening}
          nickname={profile.nickname}
          avatar={profile.avatar}
          onDismiss={onDismissCoach}
        />
      ) : null}`
);

/* --- the profile fields --- */
rep(
  `        <p style={{ fontSize: "11.5px", color: "var(--ink-soft)", margin: "-4px 0 12px" }}>
          填寫年齡、身高、體重後會自動存檔，不用擔心忘記按儲存。
        </p>`,
  `        <p style={{ fontSize: "11.5px", color: "var(--ink-soft)", margin: "-4px 0 12px" }}>
          填寫年齡、身高、體重後會自動存檔，不用擔心忘記按儲存。
        </p>

        <div className="identity-row">
          <AvatarPicker
            avatar={form.avatar}
            nickname={form.nickname}
            onChange={(next) => setForm((f) => ({ ...f, avatar: next }))}
          />
          <div className="field identity-name">
            <label>稱謂</label>
            <input
              type="text"
              maxLength={12}
              value={form.nickname}
              onChange={(e) => setForm((f) => ({ ...f, nickname: e.target.value }))}
              placeholder="想被怎麼叫？"
            />
            <p className="field-hint">早晚的問候與總結會用這個稱謂。</p>
          </div>
        </div>`
);

writeFileSync(APP, s);
console.log(missed.length ? 'MISSED:\n' + missed.join('\n') : 'avatar, nickname and coach wired in');
