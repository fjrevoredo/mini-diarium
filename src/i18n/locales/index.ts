export interface LocaleInfo {
  code: string;
  name: string; // English name
  nativeName: string; // Name in its own language
}

export const AVAILABLE_LOCALES: LocaleInfo[] = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano' },
  { code: 'pt-BR', name: 'Portuguese (Brazil)', nativeName: 'Português (Brasil)' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
];
