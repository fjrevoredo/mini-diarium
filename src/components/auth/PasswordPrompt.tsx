import { createSignal, Show } from 'solid-js';
import { unlockDiary } from '../../state/auth';

export default function PasswordPrompt() {
  const [password, setPassword] = createSignal('');
  const [error, setError] = createSignal<string | null>(null);
  const [isUnlocking, setIsUnlocking] = createSignal(false);

  const handleSubmit = async (e: Event) => {
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
      // Success - auth state will update automatically
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      // Clear password on error
      setPassword('');
    } finally {
      setIsUnlocking(false);
    }
  };

  return (
    <div class="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
      <div class="w-full max-w-md">
        <div class="rounded-lg bg-white px-8 py-10 shadow-lg">
          <h1 class="mb-2 text-center text-3xl font-bold text-gray-900">Mini Diarium</h1>
          <p class="mb-8 text-center text-sm text-gray-600">
            Enter your password to unlock your diary
          </p>

          <form onSubmit={handleSubmit} class="space-y-6">
            <div>
              <label for="password" class="mb-2 block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password()}
                onInput={(e) => setPassword(e.currentTarget.value)}
                disabled={isUnlocking()}
                autofocus
                class="w-full rounded-md border border-gray-300 px-4 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                placeholder="Enter your password"
                autocomplete="current-password"
              />
            </div>

            <Show when={error()}>
              <div class="rounded-md bg-red-50 p-3">
                <p class="text-sm text-red-800">{error()}</p>
              </div>
            </Show>

            <button
              type="submit"
              disabled={isUnlocking()}
              class="w-full rounded-md bg-blue-600 px-4 py-3 font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-400"
            >
              {isUnlocking() ? 'Unlocking...' : 'Unlock Diary'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
