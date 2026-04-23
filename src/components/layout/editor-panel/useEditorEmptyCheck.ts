import { createSignal, type Accessor } from 'solid-js';
import type { Editor } from '@tiptap/core';

/** Returns true if the editor document contains at least one image node. */
export function editorHasImages(editor: Editor): boolean {
  let found = false;
  editor.state.doc.descendants((node) => {
    if (node.type.name === 'image') {
      found = true;
    }
  });
  return found;
}

/**
 * Pure helper that mirrors the isContentEmpty check against a concrete editor
 * instance plus a content fallback string. Exposed so the shell and hooks can
 * reuse the same emptiness semantics, and so tests can drive it with mocks.
 */
export function computeIsEmpty(editor: Editor | null, content: string): boolean {
  if (editor && !editor.isDestroyed) {
    return editor.isEmpty || (editor.getText().trim() === '' && !editorHasImages(editor));
  }
  return !content.trim();
}

export interface UseEditorEmptyCheckOptions {
  editorInstance: Accessor<Editor | null>;
  content: Accessor<string>;
}

export interface EditorEmptyCheckHook {
  /**
   * Reactive trigger: updated by handleContentUpdate (user edits via onUpdate) and by
   * the onSetContent callback from DiaryEditor (programmatic loads via setContent).
   * Forces isContentEmpty() to re-evaluate AFTER TipTap updates editor.isEmpty.
   */
  editorIsEmpty: Accessor<boolean>;
  setEditorIsEmpty: (next: boolean) => boolean;
  /** Reactive accessor — reads editorIsEmpty to register as a dep; value comes from editor state. */
  isContentEmpty: () => boolean;
}

export function useEditorEmptyCheck(opts: UseEditorEmptyCheckOptions): EditorEmptyCheckHook {
  const [editorIsEmpty, setEditorIsEmpty] = createSignal(true);

  const isContentEmpty = () => {
    // Access editorIsEmpty() to add it as a reactive dependency. The check itself
    // reads editor.isEmpty directly so the answer reflects TipTap's current state.
    editorIsEmpty();
    return computeIsEmpty(opts.editorInstance(), opts.content());
  };

  return { editorIsEmpty, setEditorIsEmpty, isContentEmpty };
}
