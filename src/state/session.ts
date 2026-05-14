import { createSignal } from 'solid-js';
import { resetEntriesState } from './entries';
import { resetSearchState } from './search';
import { resetUiState } from './ui';
import { resetTagsState } from './tags';

const [hasFocusedEditorOnUnlock, setHasFocusedEditorOnUnlock] = createSignal(false);

export function resetSessionState(): void {
  resetEntriesState();
  resetSearchState();
  resetUiState();
  resetTagsState();
  setHasFocusedEditorOnUnlock(false);
}

export { hasFocusedEditorOnUnlock, setHasFocusedEditorOnUnlock };
