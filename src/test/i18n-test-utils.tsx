import { render } from '@solidjs/testing-library';
import { I18nProvider } from '../i18n';
import type { JSX } from 'solid-js';

/**
 * Renders a SolidJS component wrapped in I18nProvider.
 *
 * Use this in place of bare `render()` for any component that calls useI18n()
 * or renders text that goes through the translation system. Because English
 * strings are identical to the hardcoded values that were there before, all
 * existing getByText() assertions continue to pass without changes.
 *
 * Tests also catch missing translation keys: a missing key renders as
 * `undefined` or throws, which fails the test immediately.
 */
export function renderWithI18n(component: () => JSX.Element) {
  return render(() => <I18nProvider>{component()}</I18nProvider>);
}
