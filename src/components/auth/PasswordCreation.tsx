import { createSignal, Show } from 'solid-js';
import { PasswordStrengthIndicator } from './PasswordStrengthIndicator';
import { createJournal, goToJournalPicker } from '../../state/auth';

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

    try {
      setIsCreating(true);
      await createJournal(pwd);
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
            Create a password to secure your journal
          </p>

          <form onSubmit={handleSubmit} class="space-y-6">
            <div>
              <label for="password" class="mb-2 block text-sm font-medium text-secondary">
                Password <span class="text-xs text-tertiary">(1+ characters, 12+ recommended)</span>
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
              <PasswordStrengthIndicator password={password()} />
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
              data-testid="create-journal-button"
              disabled={isCreating()}
              class="w-full rounded-md bg-blue-600 px-4 py-3 font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreating() ? 'Creating...' : 'Create Journal'}
            </button>

            <div class="mt-4 text-center">
              <p class="text-xs text-tertiary">
                Your journal will be encrypted and stored locally on your device.
              </p>
            </div>

            <div class="mt-2 text-center">
              <button
                type="button"
                onClick={() => goToJournalPicker()}
                class="text-sm text-tertiary hover:text-secondary underline focus:outline-none"
              >
                ← Back to Journals
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
