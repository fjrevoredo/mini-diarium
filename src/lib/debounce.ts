/**
 * Creates a debounced function that delays invoking func until after wait milliseconds
 * have elapsed since the last time the debounced function was invoked.
 *
 * @param func The function to debounce
 * @param wait The number of milliseconds to delay
 * @returns The debounced function
 */
export type Debounced<T extends (...args: unknown[]) => unknown> = ((
  ...args: Parameters<T>
) => void) & {
  cancel: () => void;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function debounce<T extends (...args: any[]) => any>(func: T, wait: number): Debounced<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const debounced = function (this: any, ...args: Parameters<T>) {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      func.apply(this, args);
      timeoutId = null;
    }, wait);
  } as Debounced<T>;

  debounced.cancel = () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  return debounced;
}

/**
 * Cancels a debounced function
 */
export function cancelDebounce(
  debouncedFn:
    | {
        cancel?: () => void;
      }
    | null
    | undefined,
): void {
  if (debouncedFn && debouncedFn.cancel) {
    debouncedFn.cancel();
  }
}
