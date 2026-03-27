import { createSignal, Show } from 'solid-js';
import { PasswordStrengthIndicator } from './PasswordStrengthIndicator';
import { createJournal, goToJournalPicker } from '../../state/auth';
import { useI18n } from '../../i18n';

export default function PasswordCreation() {
  const t = useI18n();

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
      setError(t('auth.creation.passwordRequired'));
      return;
    }

    if (pwd !== repeat) {
      setError(t('auth.creation.passwordsMismatch'));
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
    <div class="flex flex-col h-full items-center bg-tertiary px-4 py-6">
      <div class="my-auto w-full max-w-md">
        <div class="rounded-lg bg-primary px-8 py-8 shadow-lg">
          <div class="mb-3 flex justify-center">
            <img src="/logo-transparent.svg" alt="Mini Diarium" class="h-16 w-16 rounded-xl" />
          </div>
          <h1 class="mb-2 text-center text-3xl font-bold text-primary">
            {t('auth.creation.title')}
          </h1>
          <p class="mb-5 text-center text-sm text-secondary">{t('auth.creation.subtitle')}</p>

          <form onSubmit={handleSubmit} class="space-y-6">
            <div>
              <label for="password" class="mb-2 block text-sm font-medium text-secondary">
                {t('auth.creation.passwordLabel')}{' '}
                <span class="text-xs text-tertiary">{t('auth.creation.passwordHint')}</span>
              </label>
              <input
                id="password"
                type="password"
                data-testid="password-create-input"
                value={password()}
                onInput={(e) => setPassword(e.currentTarget.value)}
                disabled={isCreating()}
                class="w-full rounded-md border border-primary bg-primary px-4 py-2 text-primary focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-tertiary"
                placeholder={t('auth.creation.passwordPlaceholder')}
                autocomplete="new-password"
              />
              <PasswordStrengthIndicator password={password()} />
            </div>

            <div>
              <label for="repeat-password" class="mb-2 block text-sm font-medium text-secondary">
                {t('auth.creation.repeatLabel')}
              </label>
              <input
                id="repeat-password"
                type="password"
                data-testid="password-repeat-input"
                value={repeatPassword()}
                onInput={(e) => setRepeatPassword(e.currentTarget.value)}
                disabled={isCreating()}
                class="w-full rounded-md border border-primary bg-primary px-4 py-2 text-primary focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-tertiary"
                placeholder={t('auth.creation.repeatPlaceholder')}
                autocomplete="new-password"
              />
            </div>

            <Show when={error()}>
              <div role="alert" class="rounded-md bg-error p-3">
                <p class="text-sm text-error">{error()}</p>
              </div>
            </Show>

            <button
              type="submit"
              data-testid="create-journal-button"
              disabled={isCreating()}
              class="w-full rounded-md interactive-primary px-4 py-3 font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreating() ? t('auth.creation.creating') : t('auth.creation.createButton')}
            </button>

            <div class="mt-4 text-center">
              <p class="text-xs text-tertiary">{t('auth.creation.localStorageNote')}</p>
            </div>

            <div class="mt-2 text-center">
              <button
                type="button"
                onClick={() => goToJournalPicker()}
                class="text-sm text-tertiary hover:text-secondary underline focus:outline-none"
              >
                {t('auth.creation.backToJournals')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
