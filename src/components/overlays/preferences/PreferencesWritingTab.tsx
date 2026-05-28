import { createSignal, createMemo, createEffect, For, onCleanup, onMount } from 'solid-js';
import { ChevronUp, ChevronDown } from 'lucide-solid';
import { useI18n } from '../../../i18n';
import { preferences, setPreferences } from '../../../state/preferences';
import type { ToolbarItem, ToolbarItemKey } from '../../../state/preferences';
import { usePreferencesShell, type TabProps } from './shared';
import PreferencesFontFamilyField from './PreferencesFontFamilyField';

export default function PreferencesWritingTab(_props: TabProps) {
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

  const ITEM_LABELS = createMemo(
    () =>
      ({
        headings: t('prefs.writing.toolbarItem.headings'),
        underline: t('prefs.writing.toolbarItem.underline'),
        strikethrough: t('prefs.writing.toolbarItem.strikethrough'),
        textColor: t('prefs.writing.toolbarItem.textColor'),
        highlightColor: t('prefs.writing.toolbarItem.highlightColor'),
        blockquote: t('prefs.writing.toolbarItem.blockquote'),
        inlineCode: t('prefs.writing.toolbarItem.inlineCode'),
        bulletList: t('prefs.writing.toolbarItem.bulletList'),
        orderedList: t('prefs.writing.toolbarItem.orderedList'),
        horizontalRule: t('prefs.writing.toolbarItem.horizontalRule'),
        insertImage: t('prefs.writing.toolbarItem.insertImage'),
        importMarkdown: t('prefs.writing.toolbarItem.importMarkdown'),
        insertTimestamp: t('prefs.writing.toolbarItem.insertTimestamp'),
        textDirection: t('prefs.writing.toolbarItem.textDirection'),
        alignment: t('prefs.writing.toolbarItem.alignment'),
        fontFamily: t('prefs.writing.toolbarItem.fontFamily'),
        fontSize: t('prefs.writing.toolbarItem.fontSize'),
      }) satisfies Record<ToolbarItemKey, string>,
  );

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
  const [localToolbarItems, setLocalToolbarItems] = createSignal<ToolbarItem[]>(
    preferences().toolbarItems,
  );
  const [localEditorFontSize, setLocalEditorFontSize] = createSignal(preferences().editorFontSize);
  const [localEditorFontFamily, setLocalEditorFontFamily] = createSignal(
    preferences().editorFontFamily ?? '',
  );
  const [localShowEntryTimestamps, setLocalShowEntryTimestamps] = createSignal(
    preferences().showEntryTimestamps,
  );

  createEffect(() => {
    if (preferences().editorFontFamily === null) {
      setLocalEditorFontFamily('');
    }
  });

  const selectAll = () =>
    setLocalToolbarItems((prev) => prev.map((item) => ({ ...item, enabled: true })));
  const selectNone = () =>
    setLocalToolbarItems((prev) => prev.map((item) => ({ ...item, enabled: false })));

  const moveUp = (i: number) => {
    const arr = [...localToolbarItems()];
    [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]];
    setLocalToolbarItems(arr);
  };

  const moveDown = (i: number) => {
    const arr = [...localToolbarItems()];
    [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]];
    setLocalToolbarItems(arr);
  };

  const toggleItem = (i: number, enabled: boolean) => {
    setLocalToolbarItems((prev) =>
      prev.map((item, idx) => (idx === i ? { ...item, enabled } : item)),
    );
  };

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
          toolbarItems: localToolbarItems(),
          editorFontSize: Math.min(24, Math.max(12, Number(localEditorFontSize()))),
          editorFontFamily: localEditorFontFamily() || null,
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

      {/* Toolbar Items */}
      <div>
        <div class="flex items-center justify-between mb-1">
          <label class="block text-sm font-medium text-secondary">
            {t('prefs.writing.toolbarItemsLabel')}
          </label>
          <div class="flex gap-3">
            <button type="button" onClick={selectAll} class="text-xs text-blue-500 hover:underline">
              {t('prefs.writing.toolbarItemSelectAll')}
            </button>
            <button
              type="button"
              onClick={selectNone}
              class="text-xs text-blue-500 hover:underline"
            >
              {t('prefs.writing.toolbarItemSelectNone')}
            </button>
          </div>
        </div>
        <p class="text-xs text-tertiary leading-relaxed mb-3">
          {t('prefs.writing.toolbarItemsHint')}
        </p>
        <div class="border border-primary rounded-md divide-y divide-primary">
          <For each={localToolbarItems()}>
            {(item, index) => (
              <div class="flex items-center gap-2 px-3 py-2">
                <div class="flex flex-col">
                  <button
                    type="button"
                    disabled={index() === 0}
                    onClick={() => moveUp(index())}
                    class="p-0.5 text-tertiary hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed"
                    aria-label={t('prefs.writing.toolbarItemMoveUp')}
                  >
                    <ChevronUp size={12} />
                  </button>
                  <button
                    type="button"
                    disabled={index() === localToolbarItems().length - 1}
                    onClick={() => moveDown(index())}
                    class="p-0.5 text-tertiary hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed"
                    aria-label={t('prefs.writing.toolbarItemMoveDown')}
                  >
                    <ChevronDown size={12} />
                  </button>
                </div>
                <input
                  type="checkbox"
                  id={`toolbar-item-${item.key}`}
                  checked={item.enabled}
                  onChange={(e) => toggleItem(index(), e.currentTarget.checked)}
                  class="h-4 w-4 rounded border-primary text-blue-600 focus:ring-blue-500"
                />
                <label
                  for={`toolbar-item-${item.key}`}
                  class="ml-1 text-sm text-secondary cursor-pointer flex-1"
                >
                  {ITEM_LABELS()[item.key]}
                </label>
              </div>
            )}
          </For>
        </div>
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

      <PreferencesFontFamilyField
        value={localEditorFontFamily()}
        onChange={setLocalEditorFontFamily}
      />
    </div>
  );
}
