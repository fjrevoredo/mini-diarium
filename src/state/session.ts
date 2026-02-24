import { resetEntriesState } from './entries';
import { resetSearchState } from './search';
import { resetUiState } from './ui';

export function resetSessionState(): void {
  resetEntriesState();
  resetSearchState();
  resetUiState();
}
