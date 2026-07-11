/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.tsx', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#4f46e5', dark: '#3730a3', light: '#eef2ff' },
        accent: { DEFAULT: '#0d9488', light: '#f0fdfa' },
        annual: { DEFAULT: '#b45309', light: '#fffbeb' },
      },
      borderRadius: { xl2: '1rem' },
    },
  },
  plugins: [],
};
