import { createSignal, createEffect, For, Show, onCleanup } from 'solid-js';
import { useI18n } from '../../i18n';
import {
  type Tag,
  getTagsForEntry,
  createTag,
  addTagToEntry,
  removeTagFromEntry,
} from '../../lib/tauri';
import {
  allTags,
  activeTagFilter,
  setTagFilter,
  clearTagFilter,
  loadAllTags,
} from '../../state/tags';
import { setIsTagManagerOpen, setIsSidebarCollapsed } from '../../state/ui';
import { mapTauriError } from '../../lib/errors';

interface EntryTagsProps {
  entryId: number;
}

export default function EntryTags(props: EntryTagsProps) {
  const t = useI18n();

  const [entryTags, setEntryTags] = createSignal<Tag[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = createSignal(false);
  const [newTagName, setNewTagName] = createSignal('');
  const [error, setError] = createSignal<string | null>(null);

  let inputRef: HTMLInputElement | undefined;
  let dropdownRef: HTMLDivElement | undefined;

  // Load tags for this entry whenever entryId changes
  createEffect(() => {
    const id = props.entryId;
    void loadEntryTags(id);
  });

  const loadEntryTags = async (id: number) => {
    try {
      const tags = await getTagsForEntry(id);
      setEntryTags(tags);
    } catch (err) {
      setError(mapTauriError(err, t));
    }
  };

  const handleTagFilterClick = (tag: Tag) => {
    if (activeTagFilter()?.id === tag.id) {
      clearTagFilter();
    } else {
      void setTagFilter(tag);
      setIsSidebarCollapsed(false);
    }
  };

  const handleRemoveTag = async (tagId: number) => {
    try {
      await removeTagFromEntry(props.entryId, tagId);
      setEntryTags((prev) => prev.filter((t) => t.id !== tagId));
    } catch (err) {
      setError(mapTauriError(err, t));
    }
  };

  const handleAddExistingTag = async (tag: Tag) => {
    try {
      await addTagToEntry(props.entryId, tag.id);
      setEntryTags((prev) => {
        if (prev.some((t) => t.id === tag.id)) return prev;
        return [...prev, tag].sort((a, b) =>
          a.name.toLowerCase().localeCompare(b.name.toLowerCase()),
        );
      });
      setIsDropdownOpen(false);
      setNewTagName('');
    } catch (err) {
      setError(mapTauriError(err, t));
    }
  };

  const handleCreateTag = async () => {
    const name = newTagName().trim();
    if (!name) return;
    try {
      const tag = await createTag(name);
      await addTagToEntry(props.entryId, tag.id);
      await loadAllTags();
      setEntryTags((prev) => {
        if (prev.some((t) => t.id === tag.id)) return prev;
        return [...prev, tag].sort((a, b) =>
          a.name.toLowerCase().localeCompare(b.name.toLowerCase()),
        );
      });
      setIsDropdownOpen(false);
      setNewTagName('');
    } catch (err) {
      setError(mapTauriError(err, t));
    }
  };

  const handleInputKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void handleCreateTag();
    } else if (e.key === 'Escape') {
      setIsDropdownOpen(false);
      setNewTagName('');
    }
  };

  // Close dropdown when clicking outside
  const handleDocumentClick = (e: MouseEvent) => {
    if (
      dropdownRef &&
      !dropdownRef.contains(e.target as Node) &&
      !(e.target as Element).closest('[data-tag-add-button]')
    ) {
      setIsDropdownOpen(false);
      setNewTagName('');
    }
  };

  createEffect(() => {
    if (isDropdownOpen()) {
      document.addEventListener('mousedown', handleDocumentClick);
      // Focus input after open
      setTimeout(() => inputRef?.focus(), 0);
    } else {
      document.removeEventListener('mousedown', handleDocumentClick);
    }
    onCleanup(() => document.removeEventListener('mousedown', handleDocumentClick));
  });

  const availableTags = () => {
    const existing = new Set(entryTags().map((t) => t.id));
    return allTags().filter((t) => !existing.has(t.id));
  };

  const filteredTags = () => {
    const q = newTagName().trim().toLowerCase();
    if (!q) return availableTags();
    return availableTags().filter((t) => t.name.toLowerCase().includes(q));
  };

  return (
    <div class="flex flex-wrap items-center gap-1.5 text-xs">
      <For each={entryTags()}>
        {(tag) => (
          <span
            class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 border transition-colors"
            classList={{
              'bg-tertiary text-accent border-accent': activeTagFilter()?.id === tag.id,
              'bg-tertiary text-secondary border-primary': activeTagFilter()?.id !== tag.id,
            }}
          >
            <button
              type="button"
              onClick={() => handleTagFilterClick(tag)}
              class="hover:opacity-75"
              title={
                activeTagFilter()?.id === tag.id ? t('tags.clearFilter') : t('tags.filterByTag')
              }
            >
              {tag.name}
            </button>
            <button
              onClick={() => void handleRemoveTag(tag.id)}
              class="text-tertiary hover:text-primary leading-none"
              aria-label={`Remove tag ${tag.name}`}
              type="button"
            >
              ×
            </button>
          </span>
        )}
      </For>

      <div class="relative">
        <button
          data-tag-add-button
          onClick={() => setIsDropdownOpen((o) => !o)}
          class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 border border-dashed border-primary text-tertiary hover:text-secondary hover:border-secondary transition-colors"
          title={t('tags.addTag')}
          type="button"
        >
          + {t('tags.addTag')}
        </button>

        <Show when={isDropdownOpen()}>
          <div
            ref={(el) => {
              dropdownRef = el;
            }}
            class="absolute left-0 top-full z-50 mt-1 min-w-48 rounded-md border border-primary bg-secondary shadow-lg"
          >
            <div class="p-2 border-b border-primary">
              <input
                ref={(el) => {
                  inputRef = el;
                }}
                type="text"
                value={newTagName()}
                onInput={(e) => setNewTagName(e.currentTarget.value)}
                onKeyDown={handleInputKeyDown}
                placeholder={t('tags.newTag')}
                class="w-full rounded px-2 py-1 text-xs bg-primary text-primary border border-primary focus:outline-none focus:border-secondary"
              />
            </div>
            <div class="max-h-40 overflow-y-auto">
              <Show
                when={filteredTags().length > 0 || newTagName().trim()}
                fallback={<p class="px-3 py-2 text-xs text-tertiary">{t('tags.noTags')}</p>}
              >
                <For each={filteredTags()}>
                  {(tag) => (
                    <button
                      onClick={() => void handleAddExistingTag(tag)}
                      class="w-full px-3 py-1.5 text-left text-xs text-primary hover:bg-tertiary"
                      type="button"
                    >
                      {tag.name}
                    </button>
                  )}
                </For>
                <Show
                  when={
                    newTagName().trim() &&
                    !allTags().some(
                      (t) => t.name.toLowerCase() === newTagName().trim().toLowerCase(),
                    )
                  }
                >
                  <button
                    onClick={() => void handleCreateTag()}
                    class="w-full px-3 py-1.5 text-left text-xs text-accent hover:bg-tertiary"
                    type="button"
                  >
                    {t('tags.create', { name: newTagName().trim() })}
                  </button>
                </Show>
              </Show>
            </div>
          </div>
        </Show>
      </div>

      <button
        onClick={() => setIsTagManagerOpen(true)}
        class="text-tertiary hover:text-secondary underline"
        type="button"
      >
        {t('tags.manageTags')}
      </button>

      <Show when={error()}>
        <span class="text-error">{error()}</span>
      </Show>
    </div>
  );
}
