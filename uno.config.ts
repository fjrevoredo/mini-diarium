import { defineConfig, presetUno, presetIcons, presetTypography } from 'unocss';

export default defineConfig({
  // Generate CSS faster in dev mode
  mode: 'global',

  presets: [
    presetUno(),
    presetTypography(),
    presetIcons({
      scale: 1.2,
      extraProperties: {
        display: 'inline-block',
        'vertical-align': 'middle',
      },
    }),
  ],

  // Safelist commonly used classes to prevent delay
  safelist: [
    // Layout
    'flex', 'flex-col', 'flex-1', 'items-center', 'justify-center', 'justify-between',
    'h-full', 'w-full', 'h-screen', 'w-screen',
    // Spacing
    'p-4', 'p-6', 'px-4', 'py-2', 'px-3', 'py-3', 'gap-2', 'gap-3', 'gap-4', 'space-y-4',
    // Colors
    'bg-white', 'bg-gray-50', 'bg-gray-100', 'bg-blue-600', 'bg-blue-700',
    'text-gray-900', 'text-gray-700', 'text-gray-600', 'text-white',
    'border-gray-200', 'border-gray-300',
    // Typography
    'text-sm', 'text-lg', 'text-xl', 'text-2xl', 'font-semibold', 'font-medium', 'font-bold',
    // Borders & Radius
    'rounded', 'rounded-md', 'rounded-lg', 'border', 'border-0',
    // Effects
    'shadow', 'shadow-sm', 'shadow-lg', 'hover:bg-gray-100', 'hover:bg-blue-700',
    'focus:outline-none', 'focus:ring-2', 'focus:ring-blue-500',
  ],
  theme: {
    colors: {
      primary: {
        50: '#f0f9ff',
        100: '#e0f2fe',
        200: '#bae6fd',
        300: '#7dd3fc',
        400: '#38bdf8',
        500: '#0ea5e9',
        600: '#0284c7',
        700: '#0369a1',
        800: '#075985',
        900: '#0c4a6e',
      },
    },
  },
});
