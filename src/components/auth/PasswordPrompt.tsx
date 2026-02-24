import { createSignal, For, Show } from 'solid-js';
import { unlockDiary, unlockWithKeypair, refreshAuthState } from '../../state/auth';
import { journals, activeJournalId, isSwitching, switchJournal } from '../../state/journals';
import { open } from '@tauri-apps/plugin-dialog';

type UnlockMode = 'password' | 'keyfile';

export default function PasswordPrompt() {
  const [mode, setMode] = createSignal<UnlockMode>('password');
  const [password, setPassword] = createSignal('');
  const [keyFilePath, setKeyFilePath] = createSignal('');
  const [error, setError] = createSignal<string | null>(null);
  const [isUnlocking, setIsUnlocking] = createSignal(false);

  const handlePasswordSubmit = async (e: Event) => {
    e.preventDefault();
    setError(null);

    const pwd = password();
    if (!pwd) {
      setError('Password is required');
      return;
    }

    try {
      setIsUnlocking(true);
      await unlockDiary(pwd);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setPassword('');
    } finally {
      setIsUnlocking(false);
    }
  };

  const handlePickKeyFile = async () => {
    try {
      const selected = await open({
        title: 'Select Private Key File',
        filters: [{ name: 'Key Files', extensions: ['key', 'txt', '*'] }],
        multiple: false,
        directory: false,
      });
      if (selected && typeof selected === 'string') {
        setKeyFilePath(selected);
        setError(null);
      }
    } catch {
      setError('Failed to open file picker');
    }
  };

  const handleKeyFileSubmit = async (e: Event) => {
    e.preventDefault();
    setError(null);

    const path = keyFilePath();
    if (!path) {
      setError('Please select a key file');
      return;
    }

    try {
      setIsUnlocking(true);
      await unlockWithKeypair(path);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setIsUnlocking(false);
    }
  };

  return (
    <div class="flex min-h-screen items-center justify-center bg-tertiary px-4 py-12">
      <div class="w-full max-w-md">
        <div class="rounded-lg bg-primary px-8 py-10 shadow-lg">
          <div class="mb-4 flex justify-center">
            <img src="/logo-transparent.svg" alt="Mini Diarium" class="h-16 w-16 rounded-xl" />
          </div>
          <h1 class="mb-2 text-center text-3xl font-bold text-primary">Mini Diarium</h1>
          <p class="mb-6 text-center text-sm text-secondary">Unlock your diary</p>

          {/* Journal selector — only shown when multiple journals exist */}
          <Show when={journals().length > 1}>
            <div class="mb-4">
              <label class="mb-2 block text-sm font-medium text-secondary">Journal</label>
              <select
                value={activeJournalId() ?? ''}
                onChange={async (e) => {
                  await switchJournal(e.currentTarget.value);
                  await refreshAuthState();
                }}
                disabled={isSwitching() || isUnlocking()}
                class="w-full rounded-md border border-primary px-4 py-2 bg-primary text-primary focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <For each={journals()}>{(j) => <option value={j.id}>{j.name}</option>}</For>
              </select>
            </div>
          </Show>

          {/* Mode toggle */}
          <div class="mb-6 flex rounded-md border border-primary overflow-hidden">
            <button
              type="button"
              onClick={() => {
                setMode('password');
                setError(null);
              }}
              class={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                mode() === 'password'
                  ? 'bg-blue-600 text-white'
                  : 'bg-primary text-secondary hover:bg-hover'
              }`}
            >
              Password
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('keyfile');
                setError(null);
              }}
              class={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                mode() === 'keyfile'
                  ? 'bg-blue-600 text-white'
                  : 'bg-primary text-secondary hover:bg-hover'
              }`}
            >
              Key File
            </button>
          </div>

          {/* Password form */}
          <Show when={mode() === 'password'}>
            <form onSubmit={handlePasswordSubmit} class="space-y-6">
              <div>
                <label for="password" class="mb-2 block text-sm font-medium text-secondary">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  data-testid="password-unlock-input"
                  value={password()}
                  onInput={(e) => setPassword(e.currentTarget.value)}
                  disabled={isUnlocking()}
                  autofocus
                  class="w-full rounded-md border border-primary px-4 py-2 text-primary focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-tertiary"
                  placeholder="Enter your password"
                  autocomplete="current-password"
                />
              </div>

              <Show when={error()}>
                <div class="rounded-md bg-error p-3">
                  <p class="text-sm text-error">{error()}</p>
                </div>
              </Show>

              <button
                type="submit"
                data-testid="unlock-diary-button"
                disabled={isUnlocking()}
                class="w-full rounded-md bg-blue-600 px-4 py-3 font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUnlocking() ? 'Unlocking...' : 'Unlock Diary'}
              </button>
            </form>
          </Show>

          {/* Key file form */}
          <Show when={mode() === 'keyfile'}>
            <form onSubmit={handleKeyFileSubmit} class="space-y-6">
              <div>
                <label class="mb-2 block text-sm font-medium text-secondary">
                  Private Key File
                </label>
                <div class="flex gap-2">
                  <input
                    type="text"
                    value={keyFilePath()}
                    readOnly
                    class="flex-1 rounded-md border border-primary px-4 py-2 text-primary bg-tertiary text-sm"
                    placeholder="No file selected"
                  />
                  <button
                    type="button"
                    onClick={handlePickKeyFile}
                    disabled={isUnlocking()}
                    class="rounded-md border border-primary px-3 py-2 text-sm font-medium text-secondary hover:bg-hover focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    Browse
                  </button>
                </div>
                <p class="mt-1 text-xs text-tertiary">
                  Select the private key file (.key) registered with this diary.
                </p>
              </div>

              <Show when={error()}>
                <div class="rounded-md bg-error p-3">
                  <p class="text-sm text-error">{error()}</p>
                </div>
              </Show>

              <button
                type="submit"
                disabled={isUnlocking() || !keyFilePath()}
                class="w-full rounded-md bg-blue-600 px-4 py-3 font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUnlocking() ? 'Unlocking...' : 'Unlock with Key File'}
              </button>
            </form>
          </Show>
        </div>
      </div>
    </div>
  );
}
