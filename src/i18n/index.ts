import { translator, flatten, resolveTemplate } from '@solid-primitives/i18n';
import { createSignal, createContext, useContext, createComponent, type JSX } from 'solid-js';
import en from './locales/en';

// Pre-flatten the English dictionary once at module load time.
// flatten() converts the nested object to dot-notation keys so the translator
// can look up e.g. 'auth.picker.empty' without deep traversal.
const flatEn = flatten(en);
type FlatEn = typeof flatEn;

// Reactive locale signal — starts with English flat dict.
// When a new locale is loaded, update this signal to switch all t() calls.
const [activeLocaleDict, setActiveLocaleDict] = createSignal(flatEn);

// Switch the active locale. For now only 'en' is available; future locales
// should dynamically import their JSON file, flatten it, and call
// setActiveLocaleDict(flattenedLocale) here.
export function setLocale(_code: string): void {
  setActiveLocaleDict(flatEn);
}

// T is the typed translator function: t(key, params?) → string (never undefined).
// The raw @solid-primitives/i18n translator returns string | undefined for
// safety, but since en.ts is the source of truth all keys are always present.
// Wrapping here removes the undefined so call sites don't need non-null assertions.
export type T = (key: keyof FlatEn, params?: Record<string, string | number>) => string;

// The first argument to translator() must be a reactive getter (() => dict),
// not a plain dict — this is required by @solid-primitives/i18n v2 for SolidJS
// reactivity. Passing the signal accessor means all t(key) calls inside JSX
// are reactive: when activeLocaleDict changes, affected components re-render.
// eslint-disable-next-line solid/reactivity -- activeLocaleDict is a reactive getter passed to translator(); the library calls it inside its own tracking scope, so reactivity is preserved even though ESLint can't see the internal call site
const _rawT = translator(activeLocaleDict, resolveTemplate);

// Wrap the raw translator so T always returns string.
// Falls back to the key name if a key is somehow missing (aids debugging).
function wrapTranslator(): T {
  // Cast through unknown because the raw translator types its return as the union
  // of all dict values (including nested objects for intermediate keys). At runtime
  // only leaf string values are reachable via keyof FlatEn.
  return (key, params) => (_rawT(key, params) as string | undefined) ?? String(key);
}

// Exported so that unit tests can exercise the translator directly without
// rendering a component tree.
export const defaultT: T = wrapTranslator();

const I18nContext = createContext<T>(defaultT);

export function I18nProvider(props: { children: JSX.Element }) {
  // createComponent avoids JSX in this .ts file while providing identical
  // behaviour to <I18nContext.Provider value={defaultT}>{children}</I18nContext.Provider>.
  return createComponent(I18nContext.Provider, {
    value: defaultT,
    get children() {
      return props.children;
    },
  });
}

export function useI18n(): T {
  return useContext(I18nContext);
}
