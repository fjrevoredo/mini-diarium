import { createSignal } from 'solid-js';

const STORAGE_KEY = 'project-support-checklist';

export type SupportChecklistItem =
  'star' | 'review' | 'share' | 'newsletter' | 'contribute' | 'donate';

function loadInitialDoneItems(): Set<SupportChecklistItem> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed as SupportChecklistItem[]);
  } catch {
    return new Set();
  }
}

const [doneItems, setDoneItems] = createSignal<Set<SupportChecklistItem>>(loadInitialDoneItems());

export function isChecklistItemDone(item: SupportChecklistItem): boolean {
  return doneItems().has(item);
}

export function toggleChecklistItem(item: SupportChecklistItem): void {
  const next = new Set(doneItems());
  if (next.has(item)) {
    next.delete(item);
  } else {
    next.add(item);
  }
  setDoneItems(next);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(next)));
}

export function checklistDoneCount(): number {
  return doneItems().size;
}
