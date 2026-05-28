import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, fireEvent } from '@solidjs/testing-library';
import { renderWithI18n } from '../../../test/i18n-test-utils';
import { createSignal } from 'solid-js';
import * as authModule from '../../../state/auth';
import { setPreferences } from '../../../state/preferences';
import PreferencesOverlay from './PreferencesOverlay';

vi.mock('../../../lib/tauri', async () => {
  const actual = await vi.importActual<typeof import('../../../lib/tauri')>('../../../lib/tauri');
  return {
    ...actual,
    peekAuthSlotTypes: vi.fn(() => Promise.resolve({ slots: [], require_all_auth: false })),
    listBundledFonts: vi.fn(() => Promise.resolve([])),
    listJournals: vi.fn(() => Promise.resolve([])),
    getActiveJournalId: vi.fn(() => Promise.resolve(null)),
    listCustomFonts: vi.fn(() => Promise.resolve([])),
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

describe('PreferencesOverlay — immediate persistence lifecycle', () => {
  beforeEach(() => {
    localStorage.clear();
    setPreferences({
      autoLockEnabled: false,
      autoLockTimeout: 300,
      hideTitles: false,
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

  it('persists General and Writing changes before the overlay is closed', () => {
    const [isOpen, setIsOpen] = createSignal(true);
    renderWithI18n(() => <PreferencesOverlay isOpen={isOpen()} onClose={() => setIsOpen(false)} />);

    const escSelect = screen.getByLabelText(/esc key action/i) as HTMLSelectElement;
    fireEvent.change(escSelect, { target: { value: 'quit' } });

    let stored = JSON.parse(localStorage.getItem('preferences') ?? '{}');
    expect(stored.escAction).toBe('quit');

    fireEvent.click(screen.getByRole('tab', { name: 'Writing' }));
    fireEvent.click(screen.getByLabelText(/hide entry titles/i));

    stored = JSON.parse(localStorage.getItem('preferences') ?? '{}');
    expect(stored.hideTitles).toBe(true);
  });

  it('persists Security auto-lock changes immediately and closes via close button only', () => {
    const onClose = vi.fn();
    const [isOpen, setIsOpen] = createSignal(true);
    renderWithI18n(() => (
      <PreferencesOverlay
        isOpen={isOpen()}
        onClose={() => {
          onClose();
          setIsOpen(false);
        }}
      />
    ));

    fireEvent.click(screen.getByRole('tab', { name: 'Security' }));
    fireEvent.click(screen.getByRole('checkbox', { name: /lock after inactivity/i }));

    let stored = JSON.parse(localStorage.getItem('preferences') ?? '{}');
    expect(stored.autoLockEnabled).toBe(true);

    const timeoutInput = screen.getByRole('spinbutton') as HTMLInputElement;
    fireEvent.input(timeoutInput, { target: { value: '120' } });
    fireEvent.blur(timeoutInput, { target: { value: '120' } });

    stored = JSON.parse(localStorage.getItem('preferences') ?? '{}');
    expect(stored.autoLockTimeout).toBe(120);

    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('heading', { name: 'Preferences' })).not.toBeInTheDocument();
  });
});
