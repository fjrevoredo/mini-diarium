import { For, createResource, createSignal, type Accessor } from 'solid-js';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { useI18n } from '../../../i18n';
import { preferences, setPreferences } from '../../../state/preferences';
import { customFontsVersion, incrementCustomFontsVersion } from '../../../state/fonts';
import { deleteCustomFontFamily, importCustomFont, listCustomFonts } from '../../../lib/tauri';
import { mapTauriError } from '../../../lib/errors';

const FONT_FILE_FILTERS = [{ name: 'Font files', extensions: ['ttf', 'otf', 'woff', 'woff2'] }];

interface PreferencesCustomFontsSectionProps {
  selectedFamily?: Accessor<string>;
  setSelectedFamily?: (value: string) => void;
}

function inferFamilyNameFromPath(path: string): string {
  const stem =
    path
      .split(/[\\/]/)
      .pop()
      ?.replace(/\.[^.]+$/, '') ?? '';
  return stem
    .replace(/[-_ ]?(regular|Regular)$/i, '')
    .replace(/[-_]/g, ' ')
    .trim();
}

export default function PreferencesCustomFontsSection(props: PreferencesCustomFontsSectionProps) {
  const t = useI18n();
  const [customFonts] = createResource(customFontsVersion, () => listCustomFonts());
  const [uploadFamily, setUploadFamily] = createSignal('');
  const [uploadRegularPath, setUploadRegularPath] = createSignal('');
  const [uploadBoldPath, setUploadBoldPath] = createSignal('');
  const [fontManagerError, setFontManagerError] = createSignal('');
  const [isUploading, setIsUploading] = createSignal(false);

  const pickRegular = async () => {
    try {
      const selected = await openDialog({ multiple: false, filters: FONT_FILE_FILTERS });
      if (typeof selected !== 'string') return;

      setUploadRegularPath(selected);
      if (!uploadFamily()) {
        const inferred = inferFamilyNameFromPath(selected);
        if (inferred) setUploadFamily(inferred);
      }
    } catch (err) {
      setFontManagerError(mapTauriError(err, t));
    }
  };

  const pickBold = async () => {
    try {
      const selected = await openDialog({ multiple: false, filters: FONT_FILE_FILTERS });
      if (typeof selected === 'string') {
        setUploadBoldPath(selected);
      }
    } catch (err) {
      setFontManagerError(mapTauriError(err, t));
    }
  };

  const handleAddFont = async () => {
    const family = uploadFamily().trim();
    const regularPath = uploadRegularPath();
    setFontManagerError('');

    if (!family) {
      setFontManagerError(t('prefs.writing.customFontFamilyRequired'));
      return;
    }
    if (!regularPath) {
      setFontManagerError(t('prefs.writing.customFontRegularRequired'));
      return;
    }

    setIsUploading(true);
    try {
      await importCustomFont(family, 'Regular', regularPath);
      const boldPath = uploadBoldPath();
      if (boldPath) {
        await importCustomFont(family, 'Bold', boldPath);
      }
      setUploadFamily('');
      setUploadRegularPath('');
      setUploadBoldPath('');
      incrementCustomFontsVersion();
    } catch (err) {
      setFontManagerError(mapTauriError(err, t));
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteFont = async (family: string) => {
    try {
      await deleteCustomFontFamily(family);
      incrementCustomFontsVersion();
      if (props.selectedFamily?.() === family) {
        props.setSelectedFamily?.('');
      }
      if (preferences().editorFontFamily === family) {
        setPreferences({ editorFontFamily: null });
      }
    } catch (err) {
      setFontManagerError(mapTauriError(err, t));
    }
  };

  return (
    <div>
      <h3 class="block text-sm font-medium text-secondary mb-2">
        {t('prefs.writing.customFontsLabel')}
      </h3>
      <p class="text-xs text-tertiary leading-relaxed mb-3">{t('prefs.writing.customFontsHint')}</p>

      <For each={customFonts() ?? []}>
        {(font) => (
          <div class="flex items-center justify-between py-2 border-b border-primary last:border-b-0">
            <div class="flex flex-col gap-0.5">
              <span class="text-sm text-primary">{font.family}</span>
              {!font.has_bold && (
                <span
                  class="text-xs text-yellow-600 dark:text-yellow-400"
                  data-testid={`custom-font-missing-bold-${font.family}`}
                >
                  {t('prefs.writing.customFontMissingBold')}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => handleDeleteFont(font.family)}
              aria-label={t('prefs.writing.customFontDeleteAriaLabel', { family: font.family })}
              class="text-xs text-red-500 hover:text-red-700 ml-4 shrink-0"
            >
              {t('prefs.writing.customFontDeleteButton')}
            </button>
          </div>
        )}
      </For>

      <div class="mt-4 space-y-3">
        <p class="text-xs text-tertiary leading-relaxed">
          {t('prefs.writing.customFontBoldPairHint')}
        </p>

        <div class="flex items-center gap-2">
          <span class="text-xs text-secondary w-48 shrink-0">
            {t('prefs.writing.customFontRegularLabel')}
          </span>
          <button
            type="button"
            onClick={pickRegular}
            class="text-xs px-2 py-1 border border-primary rounded bg-secondary text-primary hover:bg-hover"
          >
            {t('prefs.writing.customFontChooseFile')}
          </button>
          {uploadRegularPath() && (
            <span class="text-xs text-tertiary truncate max-w-[160px]" title={uploadRegularPath()}>
              {uploadRegularPath().split(/[\\/]/).pop()}
            </span>
          )}
        </div>

        <div class="flex items-center gap-2">
          <span class="text-xs text-secondary w-48 shrink-0">
            {t('prefs.writing.customFontBoldLabel')}
          </span>
          <button
            type="button"
            onClick={pickBold}
            class="text-xs px-2 py-1 border border-primary rounded bg-secondary text-primary hover:bg-hover"
          >
            {t('prefs.writing.customFontChooseFile')}
          </button>
          {uploadBoldPath() && (
            <span class="text-xs text-tertiary truncate max-w-[160px]" title={uploadBoldPath()}>
              {uploadBoldPath().split(/[\\/]/).pop()}
            </span>
          )}
        </div>

        <div class="flex items-center gap-2">
          <label for="custom-font-family-name" class="text-xs text-secondary w-48 shrink-0">
            {t('prefs.writing.customFontFamilyLabel')}
          </label>
          <input
            id="custom-font-family-name"
            type="text"
            value={uploadFamily()}
            onInput={(e) => setUploadFamily(e.currentTarget.value)}
            class="flex-1 px-2 py-1 border border-primary bg-primary text-primary text-xs rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            data-testid="custom-font-family-input"
          />
        </div>

        {fontManagerError() && (
          <p class="text-xs text-error" role="alert">
            {fontManagerError()}
          </p>
        )}

        <button
          type="button"
          onClick={handleAddFont}
          disabled={isUploading()}
          class="px-4 py-2 text-sm font-medium interactive-primary rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          data-testid="custom-font-add-button"
        >
          {t('prefs.writing.customFontAddButton')}
        </button>
      </div>
    </div>
  );
}
