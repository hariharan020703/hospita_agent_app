import type { Config } from 'tailwindcss';

/** Colours are CSS variables (see src/styles/index.css) so light and dark themes share one set of class names. */
const token = (name: string) => `rgb(var(--color-${name}) / <alpha-value>)`;

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      inherit: 'inherit',
      white: '#ffffff',
      black: '#000000',
      primary: {
        DEFAULT: token('primary'),
        hover: token('primary-hover'),
        soft: token('primary-soft'),
        ink: token('primary-ink'),
        fg: token('on-primary'),
      },
      success: { DEFAULT: token('success'), soft: token('success-soft'), ink: token('success-ink') },
      warning: { DEFAULT: token('warning'), soft: token('warning-soft'), ink: token('warning-ink') },
      danger: {
        DEFAULT: token('danger'),
        hover: token('danger-hover'),
        soft: token('danger-soft'),
        ink: token('danger-ink'),
      },
      info: { DEFAULT: token('info'), soft: token('info-soft'), ink: token('info-ink') },
      canvas: token('canvas'),
      surface: { DEFAULT: token('surface'), muted: token('surface-muted'), sunken: token('surface-sunken') },
      border: { DEFAULT: token('border'), strong: token('border-strong') },
      fg: {
        DEFAULT: token('text'),
        muted: token('text-muted'),
        subtle: token('text-subtle'),
        inverse: token('text-inverse'),
      },
      focus: token('focus'),
    },
    borderColor: ({ theme }) => ({ ...theme('colors'), DEFAULT: token('border') }),
    fontFamily: {
      sans: ['var(--font-sans)'],
      mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
    },
    extend: {
      boxShadow: {
        xs: '0 1px 2px 0 rgb(15 23 42 / 0.05)',
        sm: '0 1px 3px 0 rgb(15 23 42 / 0.08), 0 1px 2px -1px rgb(15 23 42 / 0.06)',
        md: '0 4px 12px -2px rgb(15 23 42 / 0.10), 0 2px 4px -2px rgb(15 23 42 / 0.06)',
        lg: '0 16px 32px -8px rgb(15 23 42 / 0.18)',
      },
      screens: { xs: '400px' },
      minHeight: { touch: '44px', kiosk: '64px' },
      minWidth: { touch: '44px', kiosk: '64px' },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'slide-up': { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'none' } },
        'slide-in-right': { from: { transform: 'translateX(100%)' }, to: { transform: 'none' } },
        'pulse-ring': {
          '0%': { transform: 'scale(1)', opacity: '0.5' },
          '100%': { transform: 'scale(1.6)', opacity: '0' },
        },
        wave: { '0%, 100%': { transform: 'scaleY(0.35)' }, '50%': { transform: 'scaleY(1)' } },
      },
      animation: {
        'fade-in': 'fade-in 150ms ease-out',
        'slide-up': 'slide-up 200ms ease-out',
        'slide-in-right': 'slide-in-right 220ms ease-out',
        'pulse-ring': 'pulse-ring 1.6s ease-out infinite',
        wave: 'wave 1s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
