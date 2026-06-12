/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#4CBAD4', light: '#E0F4FA', bg: '#EFF6FA' },
        success: { DEFAULT: '#5BC68A', bg: '#EAFAF0', border: '#C3EEDA' },
        warning: { DEFAULT: '#F5A623', bg: '#FFF6E8', border: '#F5C872' },
        danger: { DEFAULT: '#E8636F', bg: '#FDE8EA' },
        text: { DEFAULT: '#2C3E50', mid: '#6B8A9E', light: '#A0BCC9' },
        border: { DEFAULT: '#D8E8EF', light: '#E8F0F5', dark: '#C0D8E2' },
      },
      fontFamily: {
        sans: ["'DM Sans'", 'sans-serif'],
        mono: ["'DM Mono'", 'monospace'],
      },
      fontSize: {
        // Named steps to replace arbitrary text-[10px]/text-[11px]: 2xs for
        // chips/badges only, xs+ for anything someone actually reads.
        '2xs': ['0.6875rem', { lineHeight: '0.9rem' }],
      },
      boxShadow: {
        card: '0 2px 8px rgba(76,186,212,0.08)',
      },
    },
  },
  plugins: [],
};
