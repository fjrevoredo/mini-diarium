import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, fireEvent } from '@solidjs/testing-library';
import { renderWithI18n } from '../../../test/i18n-test-utils';
import { createSignal } from 'solid-js';
import * as authModule from '../../../state/auth';
import { setPreferences } from '../../../state/preferences';
import PreferencesOverlay from './PreferencesOverlay';

// Mock heavyweight tauri APIs so the real PreferencesOverlay + PreferencesSecurityTab
// shell can mount end-to-end. Auth methods list is empty so the AddPasswordForm path
// renders (we don't interact with it).
vi.mock('../../../lib/tauri', async () => {
  const actual = await vi.importActual<typeof import('../../../lib/tauri')>('../../../lib/tauri');
  return {
    ...actual,
    peekAuthSlotTypes: vi.fn(() => Promise.resolve({ slots: [], require_all_auth: false })),
    listBundledFonts: vi.fn(() => Promise.resolve([])),
    listJournals: vi.fn(() => Promise.resolve([])),
    getActiveJournalId: vi.fn(() => Promise.resolve(null)),
    changePassword: vi.fn(() => Promise.resolve()),
    verifyPassword: vi.fn(() => Promise.resolve()),
    generateKeypair: vi.fn(() =>
      Promise.resolve({ public_key_hex: 'aabb', private_key_hex: 'ccdd' }),
    ),
    registerKeypair: vi.fn(() => Promise.resolve()),
    writeKeyFile: vi.fn(() => Promise.resolve()),
    registerPassword: vi.fn(() => Promise.resolve()),
    removeAuthMethod: vi.fn(() => Promise.resolve()),
  };
});

vi.mock('../../../state/journals', () => ({
  journals: vi.fn(() => []),
  activeJournalId: vi.fn(() => null),
}));

describe('PreferencesOverlay — auto-lock save persists through shell', () => {
  beforeEach(() => {
    localStorage.clear();
    // Reset the in-memory preferences signal to defaults; clearing localStorage
    // alone does not reset the module-level signal, which would leak state
    // between tests.
    setPreferences({
      autoLockEnabled: false,
      autoLockTimeout: 300,
      language: 'en',
      escAction: 'none',
    });
    vi.spyOn(authModule, 'authState').mockReturnValue('unlocked');
    vi.spyOn(authModule, 'authMethods').mockReturnValue([
      {
        id: 1,
        slot_type: 'password',
        label: 'Password',
        public_key_hex: null,
        created_at: '2026-01-01T00:00:00Z',
        last_used: null,
      },
    ]);
    vi.spyOn(authModule, 'loadAuthMethods').mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('persists autoLockEnabled to localStorage after Save', async () => {
    const [isOpen, setIsOpen] = createSignal(true);
    renderWithI18n(() => <PreferencesOverlay isOpen={isOpen()} onClose={() => setIsOpen(false)} />);

    // Switch to the Security tab
    fireEvent.click(screen.getByRole('tab', { name: 'Security' }));

    const checkbox = screen.getByRole('checkbox', {
      name: /lock after inactivity/i,
    }) as HTMLInputElement;
    expect(checkbox).not.toBeChecked();

    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    const stored = JSON.parse(localStorage.getItem('preferences') ?? '{}');
    expect(stored.autoLockEnabled).toBe(true);
  });

  it('reflects current autoLockEnabled in the preferences signal when the overlay opens', async () => {
    setPreferences({ autoLockEnabled: true, autoLockTimeout: 120 });

    const [isOpen, setIsOpen] = createSignal(true);
    renderWithI18n(() => <PreferencesOverlay isOpen={isOpen()} onClose={() => setIsOpen(false)} />);

    fireEvent.click(screen.getByRole('tab', { name: 'Security' }));

    const checkbox = screen.getByRole('checkbox', {
      name: /lock after inactivity/i,
    }) as HTMLInputElement;
    expect(checkbox).toBeChecked();
  });

  it('persists escAction from General tab alongside autoLock from Security tab', async () => {
    const [isOpen, setIsOpen] = createSignal(true);
    renderWithI18n(() => <PreferencesOverlay isOpen={isOpen()} onClose={() => setIsOpen(false)} />);

    const escSelect = screen.getByLabelText(/esc key action/i) as HTMLSelectElement;
    fireEvent.change(escSelect, { target: { value: 'quit' } });
    expect(escSelect.value).toBe('quit');

    fireEvent.click(screen.getByRole('tab', { name: 'Security' }));
    const checkbox = screen.getByRole('checkbox', {
      name: /lock after inactivity/i,
    }) as HTMLInputElement;
    fireEvent.click(checkbox);

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    const stored = JSON.parse(localStorage.getItem('preferences') ?? '{}');
    expect(stored.escAction).toBe('quit');
    expect(stored.autoLockEnabled).toBe(true);
  });

  it('persists Writing tab settings (hideTitles) alongside other tabs', async () => {
    const [isOpen, setIsOpen] = createSignal(true);
    renderWithI18n(() => <PreferencesOverlay isOpen={isOpen()} onClose={() => setIsOpen(false)} />);

    fireEvent.click(screen.getByRole('tab', { name: 'Writing' }));
    const hideTitlesCheckbox = screen.getByLabelText(/hide entry titles/i) as HTMLInputElement;
    fireEvent.click(hideTitlesCheckbox);
    expect(hideTitlesCheckbox).toBeChecked();

    fireEvent.click(screen.getByRole('tab', { name: 'Security' }));
    const autoLockCheckbox = screen.getByRole('checkbox', {
      name: /lock after inactivity/i,
    }) as HTMLInputElement;
    fireEvent.click(autoLockCheckbox);

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    const stored = JSON.parse(localStorage.getItem('preferences') ?? '{}');
    expect(stored.hideTitles).toBe(true);
    expect(stored.autoLockEnabled).toBe(true);
  });

  it('persists autoLockEnabled when the user also modifies an earlier tab in the same Save', async () => {
    const [isOpen, setIsOpen] = createSignal(true);
    renderWithI18n(() => <PreferencesOverlay isOpen={isOpen()} onClose={() => setIsOpen(false)} />);

    // Modify the General tab (escAction). The General tab commits FIRST in the
    // Save iteration order, so its setPreferences call updates the preferences
    // signal before the Security tab's commit runs. This is the exact scenario
    // that previously clobbered Security's pending autoLock draft.
    const escSelect = screen.getByLabelText(/esc key action/i) as HTMLSelectElement;
    fireEvent.change(escSelect, { target: { value: 'quit' } });

    // Now switch to Security and toggle auto-lock.
    fireEvent.click(screen.getByRole('tab', { name: 'Security' }));
    const checkbox = screen.getByRole('checkbox', {
      name: /lock after inactivity/i,
    }) as HTMLInputElement;
    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    const stored = JSON.parse(localStorage.getItem('preferences') ?? '{}');
    expect(stored.autoLockEnabled).toBe(true);
    expect(stored.escAction).toBe('quit');
  });
});
