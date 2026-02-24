import { createSignal, For, Show } from 'solid-js';
import { createDiary, refreshAuthState } from '../../state/auth';
import {
  journals,
  activeJournalId,
  isSwitching,
  switchJournal,
  addJournal,
} from '../../state/journals';
import * as tauri from '../../lib/tauri';

export default function PasswordCreation() {
  const [password, setPassword] = createSignal('');
  const [repeatPassword, setRepeatPassword] = createSignal('');
  const [error, setError] = createSignal<string | null>(null);
  const [isCreating, setIsCreating] = createSignal(false);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError(null);

    const pwd = password();
    const repeat = repeatPassword();

    // Validation
    if (!pwd) {
      setError('Password is required');
      return;
    }

    if (pwd !== repeat) {
      setError('Passwords do not match');
      return;
    }

    if (pwd.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    try {
      setIsCreating(true);
      await createDiary(pwd);

      // Auto-register journal if this is a first-time user (no journals configured yet)
      if (journals().length === 0) {
        try {
          const path = await tauri.getDiaryPath();
          const dir = path.replace(/[/\\]diary\.db$/, '');
          await addJournal('My Journal', dir);
        } catch {
          // Non-fatal: journal registration failed but diary was created successfully
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div class="flex flex-col min-h-screen items-center bg-tertiary px-4 py-6">
      <div class="my-auto w-full max-w-md">
        <div class="rounded-lg bg-primary px-8 py-8 shadow-lg">
          <div class="mb-3 flex justify-center">
            <img src="/logo-transparent.svg" alt="Mini Diarium" class="h-16 w-16 rounded-xl" />
          </div>
          <h1 class="mb-2 text-center text-3xl font-bold text-primary">Welcome to Mini Diarium</h1>
          <p class="mb-5 text-center text-sm text-secondary">
            Create a password to secure your diary
          </p>

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
                disabled={isSwitching() || isCreating()}
                class="w-full rounded-md border border-primary px-4 py-2 bg-primary text-primary focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <For each={journals()}>{(j) => <option value={j.id}>{j.name}</option>}</For>
              </select>
            </div>
          </Show>

          <form onSubmit={handleSubmit} class="space-y-6">
            <div>
              <label for="password" class="mb-2 block text-sm font-medium text-secondary">
                Password
              </label>
              <input
                id="password"
                type="password"
                data-testid="password-create-input"
                value={password()}
                onInput={(e) => setPassword(e.currentTarget.value)}
                disabled={isCreating()}
                class="w-full rounded-md border border-primary px-4 py-2 text-primary focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-tertiary"
                placeholder="Enter your password"
                autocomplete="new-password"
              />
            </div>

            <div>
              <label for="repeat-password" class="mb-2 block text-sm font-medium text-secondary">
                Repeat Password
              </label>
              <input
                id="repeat-password"
                type="password"
                data-testid="password-repeat-input"
                value={repeatPassword()}
                onInput={(e) => setRepeatPassword(e.currentTarget.value)}
                disabled={isCreating()}
                class="w-full rounded-md border border-primary px-4 py-2 text-primary focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-tertiary"
                placeholder="Repeat your password"
                autocomplete="new-password"
              />
            </div>

            <Show when={error()}>
              <div class="rounded-md bg-error p-3">
                <p class="text-sm text-error">{error()}</p>
              </div>
            </Show>

            <button
              type="submit"
              data-testid="create-diary-button"
              disabled={isCreating()}
              class="w-full rounded-md bg-blue-600 px-4 py-3 font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreating() ? 'Creating...' : 'Create Diary'}
            </button>

            <div class="mt-4 text-center">
              <p class="text-xs text-tertiary">
                Your diary will be encrypted and stored locally on your device.
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
