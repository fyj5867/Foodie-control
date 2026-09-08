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
import { evaluateDay, gardenState, toSummary } from "./goals.js";
import { todayStr } from "./health.js";
import { loadSummaries, saveSummaries, backfillOnce } from "./storage.js";
import { upsertSummary } from "./goals.js";

function sameVerdict(a, b) {
  if (!a || !b) return false;
  return a.date === b.date && a.c === b.c && a.e === b.e && a.w === b.w;
}

export default function useGarden({ foodLog, waterLog, exerciseLog, calorieTarget, ready }) {
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

  /** Today's verdict, recomputed whenever any of the three logs move. */
  const today = useMemo(
    () => evaluateDay(todayStr(), { foodLog, waterLog, exerciseLog, calorieTarget }),
    [foodLog, waterLog, exerciseLog, calorieTarget]
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

  /* Keep today's row in step with the logs. Written only when the verdict
   * actually changes, so ordinary typing does not hammer storage. */
  useEffect(() => {
    if (!loaded || !ready) return;
    const verdict = toSummary(today);
    const stored = summaries.find((s) => s.date === verdict.date);

    /* A day with nothing recorded and no target to judge against is not a
     * failed day — it is a day that has not started. Writing it would stamp
     * "all three missed" on every day before the profile exists. Once
     * anything is logged, or a row already exists, keep it up to date. */
    const hasActivity = (today.calories || 0) > 0 || (today.waterMl || 0) > 0 || (today.exerciseMin || 0) > 0;
    if (!stored && !hasActivity) return;

    if (sameVerdict(stored, verdict) || sameVerdict(lastWritten.current, verdict)) return;

    lastWritten.current = verdict;
    const next = upsertSummary(summaries, today);
    setSummaries(next);
    saveSummaries(next).catch(() => {
      // Storage is full or unavailable — keep the in-memory value so the
      // screen stays correct for this session rather than reverting.
    });
  }, [loaded, ready, today, summaries]);

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

  return { today, garden, summaries, loaded, recordDay, backfillReport, dismissBackfillReport };
}
