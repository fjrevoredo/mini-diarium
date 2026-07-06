import { createSignal } from 'solid-js';
import {
  open as tauriOpen,
  save as tauriSave,
  confirm as tauriConfirm,
} from '@tauri-apps/plugin-dialog';
import type {
  OpenDialogOptions,
  OpenDialogReturn,
  SaveDialogOptions,
  ConfirmDialogOptions,
} from '@tauri-apps/plugin-dialog';

// Native dialogs (file pickers, confirm boxes) are separate OS windows that
// steal focus from the main window the same way alt-tabbing away does, which
// would otherwise trigger the focus-loss auto-lock (src/lib/focus-lock.ts)
// mid-export/import. Every call site that opens one of these must go through
// this wrapper instead of importing directly from '@tauri-apps/plugin-dialog',
// so the guard count covers all of them.
const [openDialogCount, setOpenDialogCount] = createSignal(0);

export const isDialogOpen = () => openDialogCount() > 0;

async function withDialogGuard<T>(run: () => Promise<T>): Promise<T> {
  setOpenDialogCount((n) => n + 1);
  try {
    return await run();
  } finally {
    setOpenDialogCount((n) => n - 1);
  }
}

export function open<T extends OpenDialogOptions>(options?: T): Promise<OpenDialogReturn<T>> {
  return withDialogGuard(() => tauriOpen(options));
}

export function save(options?: SaveDialogOptions): Promise<string | null> {
  return withDialogGuard(() => tauriSave(options));
}

export function confirm(
  message: string,
  options?: string | ConfirmDialogOptions,
): Promise<boolean> {
  return withDialogGuard(() => tauriConfirm(message, options));
}
