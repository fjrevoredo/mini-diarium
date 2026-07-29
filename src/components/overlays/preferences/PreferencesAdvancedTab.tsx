import { createSignal, createEffect, Show, For } from 'solid-js';
import { save } from '../../../lib/dialog';
import { openUrl } from '@tauri-apps/plugin-opener';
import { FEATURE_FLAGS, isFeatureEnabled, setFeatureFlag } from '../../../state/feature-flags';
import { buildClientState } from '../../../lib/debug-dump-payload';
import { getActiveTheme } from '../../../lib/theme';
import {
  saveThemeOverrides,
  applyThemeOverrides,
  resetThemeOverrides,
  getThemeOverridesJson,
  parseOverridesJson,
} from '../../../lib/theme-overrides';
import * as tauri from '../../../lib/tauri';
import { mapTauriError } from '../../../lib/errors';
import { useI18n } from '../../../i18n';
import type { TabProps } from './shared';
import PreferencesCustomFontsSection from './PreferencesCustomFontsSection';

export default function PreferencesAdvancedTab(props: TabProps) {
  const t = useI18n();

  // Theme overrides state
  const [localOverridesJson, setLocalOverridesJson] = createSignal('{}');
  const [overridesParseError, setOverridesParseError] = createSignal<string | null>(null);

  // Debug dump state
  const [dumpGenerating, setDumpGenerating] = createSignal(false);
  const [dumpStatus, setDumpStatus] = createSignal<'idle' | 'success' | 'error'>('idle');
  const [dumpError, setDumpError] = createSignal('');

  createEffect(() => {
    if (props.isOpen()) {
      setLocalOverridesJson(getThemeOverridesJson());
      setOverridesParseError(null);
      setDumpGenerating(false);
      setDumpStatus('idle');
      setDumpError('');
    }
  });

  const handleOverridesInput = (nextJson: string) => {
    setLocalOverridesJson(nextJson);
    const parsed = parseOverridesJson(nextJson);
    if (parsed === null) {
      setOverridesParseError(t('prefs.advanced.overridesParseError'));
      return;
    }
    saveThemeOverrides(parsed);
    applyThemeOverrides(getActiveTheme());
    setOverridesParseError(null);
  };

  const handleResetOverrides = () => {
    resetThemeOverrides();
    setLocalOverridesJson('{}');
    setOverridesParseError(null);
  };

  const handleGenerateDebugDump = async () => {
    setDumpGenerating(true);
    setDumpStatus('idle');
    setDumpError('');
    try {
      const filePath = await save({
        defaultPath: `mini-diarium-debug-${Date.now()}.json`,
        filters: [{ name: 'JSON Files', extensions: ['json'] }],
      });
      if (!filePath) {
        setDumpGenerating(false);
        return;
      }
      await tauri.generateDebugDump(filePath, JSON.stringify(buildClientState()));
      setDumpStatus('success');
    } catch (err) {
      setDumpError(mapTauriError(err, t));
      setDumpStatus('error');
    } finally {
      setDumpGenerating(false);
    }
  };

  return (
    <div
      id="pref-panel-advanced"
      role="tabpanel"
      aria-labelledby="pref-tab-advanced"
      tabIndex={0}
      class="space-y-6 focus:outline-none"
    >
      {/* Theme Overrides */}
      <div>
        <h3 class="text-sm font-medium text-primary mb-3">
          {t('prefs.advanced.themeOverridesTitle')}
        </h3>
        <p class="text-xs text-tertiary mb-3 leading-relaxed">
          {t('prefs.advanced.themeOverridesHint')}{' '}
          <button
            type="button"
            class="underline text-xs text-tertiary hover:text-primary focus:outline-none"
            onClick={() => openUrl('https://mini-diarium.com/docs/preferences/')}
          >
            {t('prefs.advanced.seeUserGuide')}
          </button>
        </p>
        <textarea
          rows="6"
          class="w-full text-xs font-mono bg-tertiary text-primary border border-primary rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
          value={localOverridesJson()}
          onInput={(e) => handleOverridesInput(e.currentTarget.value)}
          spellcheck={false}
        />
        <Show when={overridesParseError() !== null}>
          <p class="text-xs text-error mt-1">{overridesParseError()}</p>
        </Show>
        <div class="flex gap-2 mt-2">
          <button
            type="button"
            onClick={handleResetOverrides}
            class="px-3 py-1.5 text-sm font-medium text-destructive bg-primary border border-primary rounded-md hover:bg-hover focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            {t('prefs.advanced.resetToDefault')}
          </button>
        </div>
      </div>
      <div class="border-t border-primary pt-4 mt-4">
        <h3 class="text-sm font-medium text-primary mb-3">
          {t('prefs.advanced.diagnosticsTitle')}
        </h3>
        <p class="text-xs text-tertiary mb-3 leading-relaxed">
          {t('prefs.advanced.diagnosticsHint')}
        </p>
        <div class="space-y-2">
          <button
            type="button"
            onClick={handleGenerateDebugDump}
            disabled={dumpGenerating()}
            class="px-4 py-2 text-sm font-medium interactive-primary rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {dumpGenerating() ? t('prefs.advanced.generating') : t('prefs.advanced.generateDump')}
          </button>
          <Show when={dumpStatus() === 'success'}>
            <p class="text-sm text-success">{t('prefs.advanced.dumpSuccess')}</p>
          </Show>
          <Show when={dumpStatus() === 'error'}>
            <p class="text-sm text-error">{dumpError()}</p>
          </Show>
        </div>
      </div>
      <div class="border-t border-primary pt-4 mt-4">
        <PreferencesCustomFontsSection />
      </div>
      {/* Experimental features — rendered from the FEATURE_FLAGS registry, and hidden
          entirely while that registry is empty (the state since `inAppMenu` graduated
          in TODO-0065) so users never see an empty group. */}
      <Show when={FEATURE_FLAGS.length > 0}>
        <div class="border-t border-primary pt-4 mt-4">
          <h3 class="text-sm font-medium text-primary mb-3">
            {t('prefs.advanced.experimentalTitle')}
          </h3>
          <p class="text-xs text-tertiary mb-3 leading-relaxed">
            {t('prefs.advanced.experimentalHint')}
          </p>
          <div class="space-y-2">
            <For each={FEATURE_FLAGS}>
              {(def) => (
                <label class="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={isFeatureEnabled(def.flag)}
                    onChange={(e) => setFeatureFlag(def.flag, e.currentTarget.checked)}
                    class="h-4 w-4 rounded border-primary text-blue-600 focus:ring-blue-500"
                  />
                  <span class="text-sm text-secondary">{t(def.labelKey)}</span>
                </label>
              )}
            </For>
          </div>
        </div>
      </Show>
    </div>
  );
}
