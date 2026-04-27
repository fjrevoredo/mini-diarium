import { createSignal, createMemo, For, onCleanup, onMount, createEffect } from 'solid-js';
import { useI18n } from '../../../i18n';
import { preferences, setPreferences } from '../../../state/preferences';
import { usePreferencesShell, type TabProps } from './shared';

export default function PreferencesWritingTab(props: TabProps) {
  const t = useI18n();
  const shell = usePreferencesShell();

  const FIRST_DAY_OPTIONS = createMemo(() => [
    { value: 'null', label: t('prefs.writing.firstDaySystem') },
    { value: '0', label: t('prefs.writing.firstDaySunday') },
    { value: '1', label: t('prefs.writing.firstDayMonday') },
    { value: '2', label: t('prefs.writing.firstDayTuesday') },
    { value: '3', label: t('prefs.writing.firstDayWednesday') },
    { value: '4', label: t('prefs.writing.firstDayThursday') },
    { value: '5', label: t('prefs.writing.firstDayFriday') },
    { value: '6', label: t('prefs.writing.firstDaySaturday') },
  ]);

  const [localAllowFutureEntries, setLocalAllowFutureEntries] = createSignal(
    preferences().allowFutureEntries,
  );
  const [localFirstDayOfWeek, setLocalFirstDayOfWeek] = createSignal<string>(
    preferences().firstDayOfWeek === null ? 'null' : String(preferences().firstDayOfWeek),
  );
  const [localHideTitles, setLocalHideTitles] = createSignal(preferences().hideTitles);
  const [localEnableSpellcheck, setLocalEnableSpellcheck] = createSignal(
    preferences().enableSpellcheck,
  );
  const [localAdvancedToolbar, setLocalAdvancedToolbar] = createSignal(
    preferences().advancedToolbar,
  );
  const [localEditorFontSize, setLocalEditorFontSize] = createSignal(preferences().editorFontSize);
  const [localShowEntryTimestamps, setLocalShowEntryTimestamps] = createSignal(
    preferences().showEntryTimestamps,
  );

  createEffect(() => {
    if (props.isOpen()) {
      setLocalAllowFutureEntries(preferences().allowFutureEntries);
      setLocalFirstDayOfWeek(
        preferences().firstDayOfWeek === null ? 'null' : String(preferences().firstDayOfWeek),
      );
      setLocalHideTitles(preferences().hideTitles);
      setLocalEnableSpellcheck(preferences().enableSpellcheck);
      setLocalAdvancedToolbar(preferences().advancedToolbar);
      setLocalEditorFontSize(preferences().editorFontSize);
      setLocalShowEntryTimestamps(preferences().showEntryTimestamps);
    }
  });

  onMount(() => {
    const unregister = shell.registerCommit(
      // Invoked imperatively from the shell's Save click handler (tracked scope);
      // signal reads inside are intentional snapshots of the buffered draft.
      // eslint-disable-next-line solid/reactivity
      () => {
        setPreferences({
          allowFutureEntries: localAllowFutureEntries(),
          firstDayOfWeek: localFirstDayOfWeek() === 'null' ? null : Number(localFirstDayOfWeek()),
          hideTitles: localHideTitles(),
          enableSpellcheck: localEnableSpellcheck(),
          advancedToolbar: localAdvancedToolbar(),
          editorFontSize: Math.min(24, Math.max(12, Number(localEditorFontSize()))),
          showEntryTimestamps: localShowEntryTimestamps(),
        });
      },
    );
    onCleanup(unregister);
  });

  return (
    <div
      id="pref-panel-writing"
      role="tabpanel"
      aria-labelledby="pref-tab-writing"
      tabIndex={0}
      class="space-y-6 focus:outline-none"
    >
      {/* First Day of Week */}
      <div>
        <label for="pref-first-day" class="block text-sm font-medium text-secondary mb-2">
          {t('prefs.writing.firstDayLabel')}
        </label>
        <select
          id="pref-first-day"
          value={localFirstDayOfWeek()}
          onChange={(e) => setLocalFirstDayOfWeek(e.currentTarget.value)}
          class="w-full px-3 py-2 border border-primary bg-primary text-primary rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <For each={FIRST_DAY_OPTIONS()}>
            {(option) => <option value={option.value}>{option.label}</option>}
          </For>
        </select>
      </div>

      {/* Allow Future Entries */}
      <div class="space-y-2">
        <div class="flex items-center">
          <input
            type="checkbox"
            id="allow-future"
            checked={localAllowFutureEntries()}
            onChange={(e) => setLocalAllowFutureEntries(e.currentTarget.checked)}
            class="h-4 w-4 rounded border-primary text-blue-600 focus:ring-blue-500"
          />
          <label for="allow-future" class="ml-3 text-sm text-secondary">
            {t('prefs.writing.allowFutureLabel')}
          </label>
        </div>
        <p class="ml-7 text-xs text-tertiary leading-relaxed">
          {t('prefs.writing.allowFutureHint')}
        </p>
      </div>

      {/* Hide Titles */}
      <div class="space-y-2">
        <div class="flex items-center">
          <input
            type="checkbox"
            id="hide-titles"
            checked={localHideTitles()}
            onChange={(e) => setLocalHideTitles(e.currentTarget.checked)}
            class="h-4 w-4 rounded border-primary text-blue-600 focus:ring-blue-500"
          />
          <label for="hide-titles" class="ml-3 text-sm text-secondary">
            {t('prefs.writing.hideTitlesLabel')}
          </label>
        </div>
        <p class="ml-7 text-xs text-tertiary leading-relaxed">
          {t('prefs.writing.hideTitlesHint')}
        </p>
      </div>

      {/* Show Entry Timestamps */}
      <div class="space-y-2">
        <div class="flex items-center">
          <input
            type="checkbox"
            id="show-timestamps"
            checked={localShowEntryTimestamps()}
            onChange={(e) => setLocalShowEntryTimestamps(e.currentTarget.checked)}
            class="h-4 w-4 rounded border-primary text-blue-600 focus:ring-blue-500"
          />
          <label for="show-timestamps" class="ml-3 text-sm text-secondary">
            {t('prefs.writing.showTimestampsLabel')}
          </label>
        </div>
        <p class="ml-7 text-xs text-tertiary leading-relaxed">
          {t('prefs.writing.showTimestampsHint')}
        </p>
      </div>

      {/* Enable Spellcheck */}
      <div class="space-y-2">
        <div class="flex items-center">
          <input
            type="checkbox"
            id="enable-spellcheck"
            checked={localEnableSpellcheck()}
            onChange={(e) => setLocalEnableSpellcheck(e.currentTarget.checked)}
            class="h-4 w-4 rounded border-primary text-blue-600 focus:ring-blue-500"
          />
          <label for="enable-spellcheck" class="ml-3 text-sm text-secondary">
            {t('prefs.writing.spellcheckLabel')}
          </label>
        </div>
        <p class="ml-7 text-xs text-tertiary leading-relaxed">
          {t('prefs.writing.spellcheckHint')}
        </p>
      </div>

      {/* Show Advanced Toolbar */}
      <div class="space-y-2">
        <div class="flex items-center">
          <input
            type="checkbox"
            id="advanced-toolbar"
            checked={localAdvancedToolbar()}
            onChange={(e) => setLocalAdvancedToolbar(e.currentTarget.checked)}
            class="h-4 w-4 rounded border-primary text-blue-600 focus:ring-blue-500"
          />
          <label for="advanced-toolbar" class="ml-3 text-sm text-secondary">
            {t('prefs.writing.advancedToolbarLabel')}
          </label>
        </div>
        <p class="ml-7 text-xs text-tertiary leading-relaxed">
          {t('prefs.writing.advancedToolbarHint')}
        </p>
      </div>

      {/* Editor Font Size */}
      <div>
        <div class="flex items-center justify-between mb-2">
          <label for="editor-font-size" class="text-sm font-medium text-secondary">
            {t('prefs.writing.fontSizeLabel')}
          </label>
          <span class="text-sm text-tertiary">
            {localEditorFontSize()} {t('prefs.writing.fontSizePxSuffix')}
          </span>
        </div>
        <input
          type="range"
          id="editor-font-size"
          min="12"
          max="24"
          step="1"
          value={localEditorFontSize()}
          onInput={(e) => setLocalEditorFontSize(Number(e.currentTarget.value))}
          class="w-full accent-blue-500"
        />
        <div class="flex justify-between mt-1">
          <span class="text-xs text-tertiary">{t('prefs.writing.fontSizeMin')}</span>
          <span class="text-xs text-tertiary">{t('prefs.writing.fontSizeMax')}</span>
        </div>
      </div>
    </div>
  );
}
