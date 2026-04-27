import { createContext, useContext, type Accessor } from 'solid-js';

export type Tab = 'general' | 'writing' | 'security' | 'data' | 'advanced';

export interface TabProps {
  isOpen: Accessor<boolean>;
  onClose: () => void;
}

export interface PreferencesShellApi {
  /**
   * Buffered tabs (General, Writing) call this on mount to register a callback
   * that the shell invokes when the user clicks Save. The returned function
   * unregisters and should be passed to onCleanup.
   */
  registerCommit: (commit: () => void) => () => void;
}

export const PreferencesShellContext = createContext<PreferencesShellApi>();

export function usePreferencesShell(): PreferencesShellApi {
  const ctx = useContext(PreferencesShellContext);
  if (!ctx) {
    throw new Error('usePreferencesShell must be called within PreferencesOverlay');
  }
  return ctx;
}
