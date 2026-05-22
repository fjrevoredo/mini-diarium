import { createSignal, createMemo, For, onCleanup, onMount } from 'solid-js';
import { useI18n } from '../../../i18n';
import { AVAILABLE_LOCALES } from '../../../i18n/locales/index';
import { preferences, setPreferences, type EscAction } from '../../../state/preferences';
import { getThemePreference, setTheme, type ThemePreference } from '../../../lib/theme';
import { usePreferencesShell, type TabProps } from './shared';

export default function PreferencesGeneralTab(_props: TabProps) {
  const t = useI18n();
  const shell = usePreferencesShell();

  const LANGUAGE_OPTIONS = createMemo(() =>
    AVAILABLE_LOCALES.map((l) => ({ value: l.code, label: l.nativeName })),
  );

  // Drafts are seeded from current preferences on mount. The dialog re-mounts
  // on each open (Kobalte Portal), so no explicit resync effect is needed —
  // and adding one that reads `preferences()` would track it as a dependency,
  // causing the effect to fire when other tabs' commits write to preferences
  // during a single Save click, clobbering the user's pending draft.
  const [localLanguage, setLocalLanguage] = createSignal(preferences().language);
  const [localTheme, setLocalTheme] = createSignal<ThemePreference>(getThemePreference());
  const [localEscAction, setLocalEscAction] = createSignal<EscAction>(preferences().escAction);

  onMount(() => {
    const unregister = shell.registerCommit(
      // Invoked imperatively from the shell's Save click handler (tracked scope);
      // signal reads inside are intentional snapshots of the buffered draft.
      // eslint-disable-next-line solid/reactivity
      () => {
        setTheme(localTheme());
        setPreferences({
          language: localLanguage(),
          escAction: localEscAction(),
        });
      },
    );
    onCleanup(unregister);
  });

  return (
    <div
      id="pref-panel-general"
      role="tabpanel"
      aria-labelledby="pref-tab-general"
      tabIndex={0}
      class="space-y-6 focus:outline-none"
    >
      {/* Theme */}
      <div>
        <label for="pref-theme" class="block text-sm font-medium text-secondary mb-2">
          {t('prefs.general.themeLabel')}
        </label>
        <select
          id="pref-theme"
          value={localTheme()}
          onChange={(e) => setLocalTheme(e.currentTarget.value as ThemePreference)}
          class="w-full px-3 py-2 border border-primary bg-primary text-primary rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="auto">{t('prefs.general.themeAuto')}</option>
          <option value="light">{t('prefs.general.themeLight')}</option>
          <option value="dark">{t('prefs.general.themeDark')}</option>
        </select>
        <p class="mt-2 text-xs text-tertiary leading-relaxed">{t('prefs.general.themeHint')}</p>
      </div>

      {/* Language */}
      <div>
        <label for="pref-language" class="block text-sm font-medium text-secondary mb-2">
          {t('prefs.general.languageLabel')}
        </label>
        <select
          id="pref-language"
          value={localLanguage()}
          onChange={(e) => setLocalLanguage(e.currentTarget.value)}
          class="w-full px-3 py-2 border border-primary bg-primary text-primary rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <For each={LANGUAGE_OPTIONS()}>
            {(option) => <option value={option.value}>{option.label}</option>}
          </For>
        </select>
        <p class="mt-2 text-xs text-tertiary leading-relaxed">{t('prefs.general.languageHint')}</p>
      </div>

      {/* ESC key action */}
      <div>
        <label for="pref-esc-action" class="block text-sm font-medium text-secondary mb-2">
          {t('prefs.general.escLabel')}
        </label>
        <select
          id="pref-esc-action"
          value={localEscAction()}
          onChange={(e) => setLocalEscAction(e.currentTarget.value as EscAction)}
          class="w-full px-3 py-2 border border-primary bg-primary text-primary rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="none">{t('prefs.general.escNone')}</option>
          <option value="quit">{t('prefs.general.escQuit')}</option>
        </select>
        <p class="mt-2 text-xs text-tertiary leading-relaxed">{t('prefs.general.escHint')}</p>
      </div>
    </div>
  );
}
