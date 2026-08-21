import { createSignal } from 'solid-js';
import { activeJournalId } from './journals';
import { getStatistics } from '../lib/tauri/statistics';

const firstSeenKey = (journalId: string) => `first-seen-${journalId}`;
const shownKey = (journalId: string) => `support-milestone-shown-${journalId}`;

export const SUPPORT_MILESTONE_RUNGS = [7, 66, 365] as const;

export function recordFirstSeenIfAbsent(journalId: string): void {
  const key = firstSeenKey(journalId);
  if (localStorage.getItem(key) === null) {
    localStorage.setItem(key, Date.now().toString());
  }
}

export function computePendingMilestone(
  bestStreak: number,
  firstSeenMs: number,
  nowMs: number,
  highestShownRung: number,
): number | null {
  for (let i = SUPPORT_MILESTONE_RUNGS.length - 1; i >= 0; i--) {
    const rung = SUPPORT_MILESTONE_RUNGS[i];
    if (bestStreak >= rung && nowMs - firstSeenMs >= rung * 86_400_000 && rung > highestShownRung) {
      return rung;
    }
  }
  return null;
}

const [pendingRung, setPendingRung] = createSignal<number | null>(null);

export async function checkSupportMilestone(): Promise<void> {
  const journalId = activeJournalId();
  if (journalId === null) return;

  const stats = await getStatistics();
  const firstSeenRaw = localStorage.getItem(firstSeenKey(journalId));
  const firstSeenMs = firstSeenRaw !== null ? Number(firstSeenRaw) : Date.now();
  const highestShownRung = Number(localStorage.getItem(shownKey(journalId)) ?? '0');

  setPendingRung(
    computePendingMilestone(stats.best_streak, firstSeenMs, Date.now(), highestShownRung),
  );
}

export function dismissSupportMilestone(): void {
  const rung = pendingRung();
  const journalId = activeJournalId();
  if (rung !== null && journalId !== null) {
    localStorage.setItem(shownKey(journalId), rung.toString());
  }
  setPendingRung(null);
}

// Session-scoped, per-journal state — must be cleared on lock (session.ts:resetSessionState())
// so a pending rung from one journal can't survive into another journal's session and be
// wrongly attributed/dismissed there.
export function resetSupportMilestoneState(): void {
  setPendingRung(null);
}

export { pendingRung };
