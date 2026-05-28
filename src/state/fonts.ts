import { createSignal } from 'solid-js';

const [customFontsVersion, setCustomFontsVersion] = createSignal(1);
export { customFontsVersion };
export const incrementCustomFontsVersion = () => setCustomFontsVersion((v) => v + 1);
