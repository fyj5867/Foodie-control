/**
 * Everything the sprout and garden need, wrapped in one hook.
 *
 * Keeping this out of App.jsx is deliberate: the growth rules have to stay
 * readable on their own, and the app component is already carrying more than
 * it should. Feed it the logs and the day's calorie ceiling; it hands back
 * today's verdict, the garden rolled up from history, and a one-time backfill
 * report to show the person what could be recovered.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { evaluateDay, gardenState, recomputeRecent } from "./goals.js";
import { todayStr } from "./health.js";
import { loadSummaries, saveSummaries, backfillOnce, clearSummaries, clearBackfillFlag } from "./storage.js";
import { upsertSummary } from "./goals.js";

function sameDates(a, b) {
  return a.length === b.length && a.every((d, i) => d === b[i]);
}

export default function useGarden({ foodLog, waterLog, exerciseLog, calorieTarget, ready, dayKey = null }) {
  /* Which day "today" means.
   *
   * It has to come in from outside, or at least be able to: the verdict below
   * is memoised, and at midnight none of the logs change — so an app left open
   * overnight kept showing yesterday's rings against yesterday's date. The
   * caller re-renders on the hour boundaries and passes the new date in; the
   * fallback keeps this hook usable on its own. */
  const dateStr = dayKey || todayStr();
  const [summaries, setSummaries] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [backfillReport, setBackfillReport] = useState(null);

  // Guards so the one-time rebuild cannot be kicked off twice by a re-render
  // that happens while the first attempt is still awaiting storage.
  const backfillStarted = useRef(false);
  const lastWritten = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await loadSummaries();
      if (cancelled) return;
      setSummaries(stored);
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Today's verdict, recomputed when any of the three logs move — or when
   * the day itself does. */
  const today = useMemo(
    () => evaluateDay(dateStr, { foodLog, waterLog, exerciseLog, calorieTarget }),
    [dateStr, foodLog, waterLog, exerciseLog, calorieTarget]
  );

  /* One-time rebuild from whatever history the trimmed logs still hold.
   * Waits for the app's own data to finish loading, otherwise it would run
   * against empty logs and record a run of days as unmet. */
  useEffect(() => {
    if (!loaded || !ready || backfillStarted.current) return;
    backfillStarted.current = true;

    (async () => {
      try {
        const result = await backfillOnce({ foodLog, waterLog, exerciseLog, calorieTarget });
        if (result.ran) {
          setSummaries(result.summaries);
          setBackfillReport({ added: result.added });
        }
      } catch {
        // A failed rebuild is not worth blocking the app for; the garden
        // simply starts from today instead of from the last month.
        backfillStarted.current = false;
      }
    })();
  }, [loaded, ready, foodLog, waterLog, exerciseLog, calorieTarget]);

  /* Keep the recent days in step with the logs — not just today.
   *
   * This used to judge today alone, which meant a correction to an earlier day
   * never reached the garden: fill in Tuesday's water on Thursday and the
   * diary changed while the met-day count did not. The whole backfill window
   * is re-judged instead, so editing or adding to any day inside it counts the
   * same as recording it at the time.
   *
   * Nothing outside the window is touched, and a day with no entries at all is
   * left alone — see recomputeRecent for why both of those matter. */
  useEffect(() => {
    if (!loaded || !ready) return;
    const { summaries: next, changed } = recomputeRecent(
      summaries,
      { foodLog, waterLog, exerciseLog, calorieTarget },
      dateStr
    );
    if (!changed.length) return;
    /* Guard against a re-render racing the save: the same set of dates twice
       running means the write is already on its way. */
    if (sameDates(changed, lastWritten.current || [])) return;

    lastWritten.current = changed;
    setSummaries(next);
    saveSummaries(next).catch(() => {
      // Storage is full or unavailable — keep the in-memory value so the
      // screen stays correct for this session rather than reverting.
    });
  }, [loaded, ready, dateStr, foodLog, waterLog, exerciseLog, calorieTarget, summaries]);

  const garden = useMemo(() => gardenState(summaries), [summaries]);

  /** Record a backfilled day (yesterday only — see canBackfill). */
  const recordDay = useCallback(
    async (day) => {
      const next = upsertSummary(summaries, day);
      setSummaries(next);
      try {
        await saveSummaries(next);
      } catch {
        /* keep the in-memory value */
      }
      return next;
    },
    [summaries]
  );

  const dismissBackfillReport = useCallback(() => setBackfillReport(null), []);

  /**
   * Replace the whole history — used when restoring a backup.
   *
   * A backup written before the garden existed carries no summary. In that
   * case the rebuild flag is cleared so the one-time backfill runs again
   * against the logs that were just restored, which is the only way those
   * days can be recovered at all.
   */
  const restoreSummaries = useCallback(async (restored) => {
    const next = Array.isArray(restored) ? restored : [];
    setSummaries(next);
    lastWritten.current = null;
    await saveSummaries(next).catch(() => {});
    if (!Array.isArray(restored)) {
      await clearBackfillFlag().catch(() => {});
      backfillStarted.current = false;
    }
    return next;
  }, []);

  /** Wipe the history along with everything else, so a reset leaves no garden
   * standing on data that no longer exists. */
  const resetGarden = useCallback(async () => {
    setSummaries([]);
    setBackfillReport(null);
    lastWritten.current = null;
    backfillStarted.current = true; // nothing left to rebuild from
    await clearSummaries().catch(() => {});
  }, []);

  return {
    today,
    garden,
    summaries,
    loaded,
    recordDay,
    restoreSummaries,
    resetGarden,
    backfillReport,
    dismissBackfillReport,
  };
}
