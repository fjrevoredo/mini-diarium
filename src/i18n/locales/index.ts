export interface LocaleInfo {
  code: string;
  name: string; // English name
  nativeName: string; // Name in its own language
}

export const AVAILABLE_LOCALES: LocaleInfo[] = [
  { code: 'en', name: 'English', nativeName: 'English' },
];
