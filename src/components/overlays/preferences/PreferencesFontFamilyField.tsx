import { For, Show, createMemo, createResource } from 'solid-js';
import { useI18n } from '../../../i18n';
import { customFontsVersion } from '../../../state/fonts';
import { listBundledFonts, listCustomFonts } from '../../../lib/tauri';

interface PreferencesFontFamilyFieldProps {
  value: string;
  onChange: (value: string) => void;
}

export default function PreferencesFontFamilyField(props: PreferencesFontFamilyFieldProps) {
  const t = useI18n();
  const [bundledFonts] = createResource(listBundledFonts);
  const [customFonts] = createResource(customFontsVersion, () => listCustomFonts());
  const selectableCustomFonts = createMemo(() =>
    (customFonts() ?? []).filter((font) => font.has_regular),
  );

  return (
    <div>
      <label for="editor-font-family" class="block text-sm font-medium text-secondary mb-2">
        {t('prefs.writing.fontFamilyLabel')}
      </label>
      <select
        id="editor-font-family"
        data-testid="editor-font-family-select"
        onChange={(e) => props.onChange(e.currentTarget.value)}
        disabled={bundledFonts.loading || customFonts.loading}
        class="w-full px-3 py-2 border border-primary bg-primary text-primary rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      >
        <option value="" selected={props.value === ''}>
          {t('prefs.writing.fontFamilySystemDefault')}
        </option>
        <For each={bundledFonts() ?? []}>
          {(font) => (
            <option value={font} selected={props.value === font}>
              {font}
            </option>
          )}
        </For>
        <Show when={selectableCustomFonts().length > 0}>
          <optgroup label={t('prefs.writing.customFontsGroupLabel')}>
            <For each={selectableCustomFonts()}>
              {(font) => (
                <option value={font.family} selected={props.value === font.family}>
                  {font.family}
                </option>
              )}
            </For>
          </optgroup>
        </Show>
      </select>
      <p class="mt-1 text-xs text-tertiary leading-relaxed">{t('prefs.writing.fontFamilyHint')}</p>
      <p class="mt-1 text-xs text-tertiary leading-relaxed">
        {t('prefs.writing.fontFamilyCustomFontsNote')}
      </p>
    </div>
  );
}
