/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#4CBAD4', light: '#E0F4FA', bg: '#EFF6FA' },
        success: { DEFAULT: '#5BC68A', bg: '#EAFAF0', border: '#C3EEDA' },
        warning: { DEFAULT: '#F5A623', bg: '#FFF6E8' },
        danger: { DEFAULT: '#E8636F', bg: '#FDE8EA' },
        text: { DEFAULT: '#2C3E50', mid: '#6B8A9E', light: '#A0BCC9' },
        border: { DEFAULT: '#D8E8EF', light: '#E8F0F5' },
      },
      fontFamily: {
        sans: ["'DM Sans'", 'sans-serif'],
        mono: ["'DM Mono'", 'monospace'],
      },
      boxShadow: {
        card: '0 2px 8px rgba(76,186,212,0.08)',
      },
    },
  },
  plugins: [],
};
