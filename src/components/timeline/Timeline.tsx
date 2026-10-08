import { createMemo, createResource, For, Show, Suspense } from 'solid-js';
import { Lock } from 'lucide-solid';
import { getTimelineEntries } from '../../lib/tauri';
import type { Tag, TimelineEntry } from '../../lib/tauri';
import { requestDateAndViewChange, setSelectedEntryId } from '../../state/ui';
import { entryDates, lockVersion } from '../../state/entries';
import { activeTagFilter, allTags, clearTagFilter, setTagFilter } from '../../state/tags';
import { formatDate, formatDateWithStyle } from '../../lib/dates';
import { preferences } from '../../state/preferences';
import { useI18n } from '../../i18n';

/**
 * Timeline view — a two-column (date | title + preview) list of every entry,
 * newest first. Complements the calendar by giving a chronological overview.
 *
 * Re-fetches whenever the set of entry dates changes (entries added/removed),
 * so the list stays in sync after edits without manual refresh wiring.
 *
 * When a tag filter is active, only the entries that carry that tag are listed.
 * The filter is per entry, not per date: an untagged sibling on the same day stays hidden.
 */
export default function Timeline() {
  const t = useI18n();

  // Keying the resource on both entryDates() and lockVersion() refreshes the list when
  // entries change or when a lock is toggled (so the passive lock indicator stays in sync).
  const [entries] = createResource<TimelineEntry[], readonly [string[], number]>(
    () => [entryDates(), lockVersion()] as const,
    () => getTimelineEntries(),
  );

  const visibleEntries = createMemo(() => {
    const all = entries() ?? [];
    const filter = activeTagFilter();
    if (!filter) return all;
    return all.filter((entry) => entry.tag_ids.includes(filter.id));
  });

  const openEntry = async (entry: TimelineEntry) => {
    // Set the entry deep-link before the date so the editor opens this exact entry
    // (a day can hold multiple entries) rather than the day's newest.
    setSelectedEntryId(entry.id);
    if (!(await requestDateAndViewChange(entry.date, 'editor'))) {
      // A denied navigation must not leave a stale deep-link for the next date load.
      setSelectedEntryId(null);
    }
  };

  // `allTags()` is sorted by name and holds only live tags, so ids of deleted tags drop out.
  const tagsOf = (entry: TimelineEntry): Tag[] =>
    allTags().filter((tag) => entry.tag_ids.includes(tag.id));

  const handleTagChipClick = (tag: Tag) => {
    if (activeTagFilter()?.id === tag.id) {
      clearTagFilter();
    } else {
      void setTagFilter(tag);
    }
  };

  return (
    <div class="h-full overflow-y-auto px-6 pb-6">
      <div class="pt-6 mx-auto w-full max-w-3xl xl:max-w-5xl 2xl:max-w-6xl">
        <h2 class="mb-4 text-xl font-bold text-primary">{t('timeline.title')}</h2>

        {/* At lg and up the Sidebar is always visible and shows its own filter banner.
            Below lg the Sidebar is collapsed by default, so this is the only indicator. */}
        <Show when={activeTagFilter()}>
          {(tag) => (
            <div
              data-testid="timeline-tag-filter-banner"
              class="mb-4 flex items-center gap-2 rounded-md border border-primary bg-tertiary px-3 py-1.5 text-xs text-accent lg:hidden"
            >
              <span class="flex-1 truncate">
                {t('tags.filterActiveLabel')} {tag().name}
              </span>
              <button
                type="button"
                onClick={clearTagFilter}
                class="flex-shrink-0 hover:opacity-75"
                aria-label={t('tags.clearFilter')}
              >
                ×
              </button>
            </div>
          )}
        </Show>

        <Suspense fallback={<p class="text-sm text-tertiary">{t('layout.loading')}</p>}>
          <Show
            when={(entries() ?? []).length > 0}
            fallback={<p class="text-sm text-tertiary">{t('timeline.empty')}</p>}
          >
            <Show
              when={visibleEntries().length > 0}
              fallback={
                <p class="text-sm text-tertiary">
                  {t('timeline.emptyForTag', { name: activeTagFilter()?.name ?? '' })}
                </p>
              }
            >
              <ul class="divide-y divide-primary rounded-lg border border-primary bg-primary shadow-sm">
                <For each={visibleEntries()}>
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
                      {/* Chips sit in a sibling of the row button: buttons must not nest. */}
                      <Show when={preferences().showTimelineTags && tagsOf(entry).length > 0}>
                        <div class="flex flex-wrap gap-1.5 px-4 pb-3 text-xs">
                          <For each={tagsOf(entry)}>
                            {(tag) => (
                              <button
                                type="button"
                                data-testid="timeline-tag-chip"
                                onClick={() => handleTagChipClick(tag)}
                                class="rounded-full border px-2 py-0.5 transition-colors hover:opacity-75"
                                classList={{
                                  'bg-tertiary text-accent border-accent':
                                    activeTagFilter()?.id === tag.id,
                                  'bg-tertiary text-secondary border-primary':
                                    activeTagFilter()?.id !== tag.id,
                                }}
                                title={
                                  activeTagFilter()?.id === tag.id
                                    ? t('tags.clearFilter')
                                    : t('tags.filterByTag')
                                }
                              >
                                {tag.name}
                              </button>
                            )}
                          </For>
                        </div>
                      </Show>
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
          </Show>
        </Suspense>
      </div>
    </div>
  );
}
