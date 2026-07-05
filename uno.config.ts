import { defineConfig, presetUno, presetIcons, presetTypography } from 'unocss';

export default defineConfig({
  // Generate CSS faster in dev mode
  mode: 'global',

  // Scan these files for classes
  content: {
    filesystem: [
      'src/**/*.{ts,tsx}',
      'index.html',
    ],
  },

  // Enable dark mode with class strategy
  darkMode: 'class',

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
    'h-full', 'w-full',
    'max-w-md', 'max-w-3xl',
    // Spacing - Comprehensive
    'p-3', 'p-4', 'p-6', 'px-4', 'px-8', 'py-2', 'py-3', 'py-10', 'py-12',
    'gap-2', 'gap-3', 'gap-4', 'space-y-4', 'space-y-6',
    'mb-2', 'mb-4', 'mb-8', 'mt-4',
    // Colors - Auth screens
    'bg-white', 'bg-gray-50', 'bg-gray-100', 'bg-gray-400',
    'bg-red-50',
    'text-gray-900', 'text-gray-700', 'text-gray-600', 'text-gray-500', 'text-white', 'text-red-800',
    'border-gray-200', 'border-gray-300', 'border-blue-500',
    // Typography
    'text-xs', 'text-sm', 'text-lg', 'text-xl', 'text-2xl', 'text-3xl',
    'font-semibold', 'font-medium', 'font-bold',
    'text-center',
    // Borders & Radius
    'rounded', 'rounded-md', 'rounded-lg', 'border',
    // Effects
    'shadow', 'shadow-lg',
    // States - Complete
    'hover:bg-gray-100',
    'focus:outline-none', 'focus:ring-2', 'focus:ring-blue-500', 'focus:ring-offset-2', 'focus:border-blue-500',
    'disabled:bg-gray-100', 'disabled:bg-gray-400',
    'transition-colors',
    // Block display
    'block',
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

  // Semantic theme tokens backed by CSS custom properties (src/index.css :root/.dark).
  // Registered as static rules (not theme.colors) because bg-/text-/border- share a
  // name (e.g. "primary") but resolve to different CSS vars with different values.
  // Static rules make UnoCSS's variant engine (hover:, focus:, disabled:, data-[...]:,
  // group-hover:) compile against them — see docs/best-practices/FRONTEND_BEST_PRACTICES.md.
  rules: [
    ['bg-primary', { 'background-color': 'var(--bg-primary)' }],
    ['bg-secondary', { 'background-color': 'var(--bg-secondary)' }],
    ['bg-tertiary', { 'background-color': 'var(--bg-tertiary)' }],
    ['bg-hover', { 'background-color': 'var(--bg-hover)' }],
    ['bg-active', { 'background-color': 'var(--bg-active)' }],

    ['text-primary', { color: 'var(--text-primary)' }],
    ['text-secondary', { color: 'var(--text-secondary)' }],
    ['text-tertiary', { color: 'var(--text-tertiary)' }],
    ['text-muted', { color: 'var(--text-muted)' }],

    ['border-primary', { 'border-color': 'var(--border-primary)' }],
    ['border-secondary', { 'border-color': 'var(--border-secondary)' }],

    ['bg-success', { 'background-color': 'var(--status-success-bg)' }],
    ['bg-error', { 'background-color': 'var(--status-error-bg)' }],
    ['bg-warning', { 'background-color': 'var(--status-warning-bg)' }],
    ['bg-info', { 'background-color': 'var(--status-info-bg)' }],

    ['border-success', { 'border-color': 'var(--status-success-border)' }],
    ['border-error', { 'border-color': 'var(--status-error-border)' }],
    ['border-warning', { 'border-color': 'var(--status-warning-border)' }],
    ['border-info', { 'border-color': 'var(--status-info-border)' }],

    ['text-success', { color: 'var(--status-success-text)' }],
    ['text-error', { color: 'var(--status-error-text)' }],
    ['text-warning', { color: 'var(--status-warning-text)' }],
    ['text-info', { color: 'var(--status-info-text)' }],
  ],
});
