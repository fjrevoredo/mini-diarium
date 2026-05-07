import { createSignal } from 'solid-js';
import { resetEntriesState } from './entries';
import { resetSearchState } from './search';
import { resetUiState } from './ui';

const [hasFocusedEditorOnUnlock, setHasFocusedEditorOnUnlock] = createSignal(false);

export function resetSessionState(): void {
  resetEntriesState();
  resetSearchState();
  resetUiState();
  setHasFocusedEditorOnUnlock(false);
}

export { hasFocusedEditorOnUnlock, setHasFocusedEditorOnUnlock };
