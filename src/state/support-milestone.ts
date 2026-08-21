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

const [pendingRungState, setPendingRung] = createSignal<number | null>(null);
let pendingJournalId: string | null = null;
let checkGeneration = 0;

function clearPendingMilestone(): void {
  pendingJournalId = null;
  setPendingRung(null);
}

function isCurrentCheck(generation: number, journalId: string): boolean {
  return generation === checkGeneration && activeJournalId() === journalId;
}

export async function checkSupportMilestone(): Promise<void> {
  const generation = ++checkGeneration;
  const journalId = activeJournalId();
  if (journalId === null) {
    clearPendingMilestone();
    return;
  }

  try {
    const stats = await getStatistics();
    if (!isCurrentCheck(generation, journalId)) return;

    const firstSeenRaw = localStorage.getItem(firstSeenKey(journalId));
    const firstSeenMs = firstSeenRaw !== null ? Number(firstSeenRaw) : Date.now();
    const highestShownRung = Number(localStorage.getItem(shownKey(journalId)) ?? '0');
    const rung = computePendingMilestone(
      stats.best_streak,
      firstSeenMs,
      Date.now(),
      highestShownRung,
    );

    pendingJournalId = rung === null ? null : journalId;
    setPendingRung(rung);
  } catch {
    // Statistics are optional support-prompt data. A transient IPC failure should not
    // interrupt unlock or become an unhandled rejection from App's fire-and-forget call.
    if (isCurrentCheck(generation, journalId)) clearPendingMilestone();
  }
}

export function dismissSupportMilestone(): void {
  const rung = pendingRung();
  const journalId = activeJournalId();
  if (rung !== null && journalId !== null && pendingJournalId === journalId) {
    localStorage.setItem(shownKey(journalId), rung.toString());
  }
  clearPendingMilestone();
}

// Session-scoped, per-journal state — must be cleared on lock (session.ts:resetSessionState())
// so a pending rung from one journal can't survive into another journal's session and be
// wrongly attributed/dismissed there.
export function resetSupportMilestoneState(): void {
  checkGeneration++;
  clearPendingMilestone();
}

// Keep the consumer contract as a number-or-null getter, but make the journal ownership
// check reactive so a journal switch cannot render an old journal's pending rung before
// its session reset completes.
export function pendingRung(): number | null {
  const journalId = activeJournalId();
  return journalId !== null && pendingJournalId === journalId ? pendingRungState() : null;
}
