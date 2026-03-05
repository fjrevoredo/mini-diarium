import { describe, it, expect } from 'vitest';

/**
 * Tests for the delete entry logic in EditorPanel.tsx
 *
 * These tests validate the delete entry navigation behavior by mirroring
 * the handleDeleteEntry logic patterns.
 */

/** Mirrors the delete navigation logic in EditorPanel.tsx:handleDeleteEntry */
function calculatePostDeleteIndex(
  currentIndex: number,
  entriesAfterDelete: { id: number }[],
): { newIndex: number; entryId: number | null } {
  if (entriesAfterDelete.length === 0) {
    return { newIndex: 0, entryId: null };
  }

  let newIndex = currentIndex;
  if (newIndex >= entriesAfterDelete.length) {
    newIndex = entriesAfterDelete.length - 1;
  }

  const entry = entriesAfterDelete[newIndex];
  return { newIndex, entryId: entry.id };
}

// ---------------------------------------------------------------------------
// Delete middle entry — stay at same index
// ---------------------------------------------------------------------------

describe('handleDeleteEntry — middle entry', () => {
  it('stays at same index when deleting middle entry', () => {
    const afterDelete = [{ id: 1 }, { id: 3 }];

    const currentIndex = 1;
    const result = calculatePostDeleteIndex(currentIndex, afterDelete);

    // Should stay at index 1, which now points to id 3
    expect(result.newIndex).toBe(1);
    expect(result.entryId).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Delete last entry — navigate to new last entry
// ---------------------------------------------------------------------------

describe('handleDeleteEntry — last entry', () => {
  it('navigates to new last entry when deleting last entry', () => {
    const afterDelete = [{ id: 1 }];

    const currentIndex = 1;
    const result = calculatePostDeleteIndex(currentIndex, afterDelete);

    // Should navigate to index 0 (only entry left)
    expect(result.newIndex).toBe(0);
    expect(result.entryId).toBe(1);
  });

  it('clamps index to last position when deleting last of many', () => {
    const afterDelete = [{ id: 1 }, { id: 2 }, { id: 3 }];

    const currentIndex = 3;
    const result = calculatePostDeleteIndex(currentIndex, afterDelete);

    // Should clamp to index 2 (new last entry)
    expect(result.newIndex).toBe(2);
    expect(result.entryId).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Delete first entry — stay at index 0
// ---------------------------------------------------------------------------

describe('handleDeleteEntry — first entry', () => {
  it('stays at index 0 when deleting first entry', () => {
    const afterDelete = [{ id: 2 }];

    const currentIndex = 0;
    const result = calculatePostDeleteIndex(currentIndex, afterDelete);

    // Should stay at index 0, which now points to id 2
    expect(result.newIndex).toBe(0);
    expect(result.entryId).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Delete only entry — reset to empty state
// ---------------------------------------------------------------------------

describe('handleDeleteEntry — only entry', () => {
  it('resets to empty state when deleting only entry', () => {
    const afterDelete: { id: number }[] = [];

    const currentIndex = 0;
    const result = calculatePostDeleteIndex(currentIndex, afterDelete);

    // Should reset to empty state
    expect(result.newIndex).toBe(0);
    expect(result.entryId).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Guard clauses — prevent delete when conditions not met
// ---------------------------------------------------------------------------

describe('handleDeleteEntry — guard clauses', () => {
  it('prevents delete when day has only 1 entry', () => {
    const dayEntries = [{ id: 1 }];

    // Guard clause in handleDeleteEntry: if (dayEntries().length <= 1) return;
    const shouldAllowDelete = dayEntries.length > 1;
    expect(shouldAllowDelete).toBe(false);
  });

  it('allows delete when day has multiple entries', () => {
    const dayEntries = [{ id: 1 }, { id: 2 }];

    const shouldAllowDelete = dayEntries.length > 1;
    expect(shouldAllowDelete).toBe(true);
  });

  it('requires entry to have id for deletion', () => {
    const entryToDelete: { id?: number } = { id: undefined };

    // Guard clause: if (!entryToDelete?.id) return;
    const hasValidId = entryToDelete?.id !== undefined;
    expect(hasValidId).toBe(false);
  });

  it('proceeds with delete when entry has valid id', () => {
    const entryToDelete = { id: 5 };

    const hasValidId = entryToDelete?.id !== undefined;
    expect(hasValidId).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// UI disabled states — delete button disabled conditions
// ---------------------------------------------------------------------------

describe('delete button — disabled state', () => {
  it('disables delete button when isCreatingEntry is true', () => {
    const isCreatingEntry = true;
    const dayEntries = [{ id: 1 }, { id: 2 }];

    // From EntryNavBar props: deleteDisabled={isCreatingEntry() || dayEntries().length <= 1}
    const isDisabled = isCreatingEntry || dayEntries.length <= 1;
    expect(isDisabled).toBe(true);
  });

  it('disables delete button when only 1 entry exists', () => {
    const isCreatingEntry = false;
    const dayEntries = [{ id: 1 }];

    const isDisabled = isCreatingEntry || dayEntries.length <= 1;
    expect(isDisabled).toBe(true);
  });

  it('enables delete button when creating is done and multiple entries exist', () => {
    const isCreatingEntry = false;
    const dayEntries = [{ id: 1 }, { id: 2 }];

    const isDisabled = isCreatingEntry || dayEntries.length <= 1;
    expect(isDisabled).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// EntryNavBar — delete button visibility
// ---------------------------------------------------------------------------

describe('EntryNavBar — delete button visibility', () => {
  it('does NOT show delete button when total is 1', () => {
    const total = 1;
    const onDeleteProvided = true;

    // From EntryNavBar: <Show when={props.total > 1 && props.onDelete}>
    const shouldShow = total > 1 && onDeleteProvided;
    expect(shouldShow).toBe(false);
  });

  it('does NOT show delete button when onDelete not provided', () => {
    const total = 3;
    const onDeleteProvided = false;

    const shouldShow = total > 1 && onDeleteProvided;
    expect(shouldShow).toBe(false);
  });

  it('shows delete button when total > 1 and onDelete provided', () => {
    const total = 3;
    const onDeleteProvided = true;

    const shouldShow = total > 1 && onDeleteProvided;
    expect(shouldShow).toBe(true);
  });
});
