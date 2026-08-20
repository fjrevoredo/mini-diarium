import { createResource, For, Show, Suspense } from 'solid-js';
import { Lock } from 'lucide-solid';
import { getTimelineEntries } from '../../lib/tauri';
import type { TimelineEntry } from '../../lib/tauri';
import { requestDateAndViewChange } from '../../state/ui';
import { entryDates, lockVersion } from '../../state/entries';
import { formatDate, formatDateWithStyle } from '../../lib/dates';
import { preferences } from '../../state/preferences';
import { useI18n } from '../../i18n';

/**
 * Timeline view — a two-column (date | title + preview) list of every entry,
 * newest first. Complements the calendar by giving a chronological overview.
 *
 * Re-fetches whenever the set of entry dates changes (entries added/removed),
 * so the list stays in sync after edits without manual refresh wiring.
 */
export default function Timeline() {
  const t = useI18n();

  // Keying the resource on both entryDates() and lockVersion() refreshes the list when
  // entries change or when a lock is toggled (so the passive lock indicator stays in sync).
  const [entries] = createResource<TimelineEntry[], readonly [string[], number]>(
    () => [entryDates(), lockVersion()] as const,
    () => getTimelineEntries(),
  );

  const openEntry = async (entry: TimelineEntry) => {
    await requestDateAndViewChange(entry.date, 'editor');
  };

  return (
    <div class="h-full overflow-y-auto px-6 pb-6">
      <div class="pt-6 mx-auto w-full max-w-3xl xl:max-w-5xl 2xl:max-w-6xl">
        <h2 class="mb-4 text-xl font-bold text-primary">{t('timeline.title')}</h2>

        <Suspense fallback={<p class="text-sm text-tertiary">{t('layout.loading')}</p>}>
          <Show
            when={(entries() ?? []).length > 0}
            fallback={<p class="text-sm text-tertiary">{t('timeline.empty')}</p>}
          >
            <ul class="divide-y divide-primary rounded-lg border border-primary bg-primary shadow-sm">
              <For each={entries()}>
                {(entry) => (
                  <li class="relative">
                    {/* The aria-label deliberately keeps the full date even when the visible
                        column uses 'short'/'iso' — those forms are ambiguous read aloud. */}
                    <button
                      type="button"
                      onClick={() => void openEntry(entry)}
                      class="flex w-full gap-4 px-4 py-3 text-left hover:bg-hover"
                      aria-label={t('timeline.openEntry', {
                        date: formatDate(entry.date, preferences().language),
                      })}
                    >
                      <span class="flex-shrink-0 whitespace-nowrap pt-0.5 text-sm font-medium text-tertiary">
                        {formatDateWithStyle(
                          entry.date,
                          preferences().timelineDateFormat,
                          preferences().language,
                        )}
                      </span>
                      <span class="min-w-0 flex-1">
                        <span class="block truncate font-semibold text-primary">
                          {entry.title.trim() || t('timeline.untitled')}
                        </span>
                        <Show when={preferences().showTimelinePreview && entry.preview}>
                          <span class="mt-0.5 block truncate text-sm text-secondary">
                            {entry.preview}
                          </span>
                        </Show>
                      </span>
                    </button>
                    {/* Passive (non-interactive) lock indicator — the toggle lives in the editor. */}
                    <Show when={entry.locked}>
                      <span
                        data-testid="timeline-lock-indicator"
                        class="pointer-events-none absolute right-3 top-3 text-tertiary"
                        title={t('timeline.lockedIndicator')}
                      >
                        <Lock size={14} aria-hidden="true" />
                        <span class="sr-only">{t('timeline.lockedIndicator')}</span>
                      </span>
                    </Show>
                  </li>
                )}
              </For>
            </ul>
          </Show>
        </Suspense>
      </div>
    </div>
  );
}
