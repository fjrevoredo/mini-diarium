import { createSignal, createEffect, For, Show } from 'solid-js';
import { Dialog } from '@kobalte/core/dialog';
import { useI18n } from '../../i18n';
import { type Tag, renameTag, deleteTag } from '../../lib/tauri';
import { allTags, loadAllTags } from '../../state/tags';
import { mapTauriError } from '../../lib/errors';
import { X } from 'lucide-solid';

interface TagManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function TagManager(props: TagManagerProps) {
  const t = useI18n();

  const [editingId, setEditingId] = createSignal<number | null>(null);
  const [editName, setEditName] = createSignal('');
  const [error, setError] = createSignal<string | null>(null);

  createEffect(() => {
    if (props.isOpen) {
      void loadAllTags();
    }
  });

  const handleRenameStart = (tag: Tag) => {
    setEditingId(tag.id);
    setEditName(tag.name);
    setError(null);
  };

  const handleRenameConfirm = async (id: number) => {
    const name = editName().trim();
    if (!name) return;
    try {
      await renameTag(id, name);
      await loadAllTags();
      setEditingId(null);
    } catch (err) {
      setError(mapTauriError(err, t));
    }
  };

  const handleRenameKeyDown = (e: KeyboardEvent, id: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void handleRenameConfirm(id);
    } else if (e.key === 'Escape') {
      setEditingId(null);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteTag(id);
      await loadAllTags();
    } catch (err) {
      setError(mapTauriError(err, t));
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) props.onClose();
  };

  return (
    <Dialog open={props.isOpen} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay class="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content class="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-primary bg-secondary p-6 shadow-xl">
          <div class="mb-4 flex items-center justify-between">
            <Dialog.Title class="text-lg font-semibold text-primary">
              {t('tags.tagManager')}
            </Dialog.Title>
            <Dialog.CloseButton
              class="rounded p-1 text-tertiary hover:text-primary hover:bg-tertiary"
              aria-label={t('common.close')}
            >
              <X size={18} />
            </Dialog.CloseButton>
          </div>

          <Show when={error()}>
            <p class="mb-3 rounded bg-error px-3 py-2 text-sm text-error">{error()}</p>
          </Show>

          <Show
            when={allTags().length > 0}
            fallback={<p class="text-sm text-tertiary py-4 text-center">{t('tags.noTags')}</p>}
          >
            <ul class="divide-y divide-primary max-h-80 overflow-y-auto">
              <For each={allTags()}>
                {(tag) => (
                  <li class="flex items-center gap-2 py-2">
                    <Show
                      when={editingId() === tag.id}
                      fallback={
                        <>
                          <span class="flex-1 text-sm text-primary">{tag.name}</span>
                          <button
                            onClick={() => handleRenameStart(tag)}
                            class="text-xs text-secondary hover:text-primary"
                            type="button"
                          >
                            {t('tags.rename')}
                          </button>
                          <button
                            onClick={() => void handleDelete(tag.id)}
                            class="text-xs text-error hover:opacity-75"
                            type="button"
                            title={t('tags.deleteTag')}
                          >
                            ×
                          </button>
                        </>
                      }
                    >
                      <input
                        type="text"
                        value={editName()}
                        onInput={(e) => setEditName(e.currentTarget.value)}
                        onKeyDown={(e) => handleRenameKeyDown(e, tag.id)}
                        class="flex-1 rounded border border-primary bg-primary px-2 py-0.5 text-sm text-primary focus:outline-none focus:border-secondary"
                        autofocus
                      />
                      <button
                        onClick={() => void handleRenameConfirm(tag.id)}
                        class="text-xs text-primary hover:text-secondary"
                        type="button"
                      >
                        {t('common.save')}
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        class="text-xs text-tertiary hover:text-primary"
                        type="button"
                      >
                        {t('common.cancel')}
                      </button>
                    </Show>
                  </li>
                )}
              </For>
            </ul>
          </Show>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
