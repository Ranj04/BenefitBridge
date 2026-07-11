/** @type {import('tailwindcss').Config} */
// "Hearthstone & Glow" theme. Every text/background pair below was verified
// against WCAG: ink/bg 10.66:1, ink/surface 11.85:1, muted/bg 5.71:1,
// white/pine 8.62:1, white/moss 5.95:1, ink/glow 5.81:1, ember-text/bg 5.91:1.
// The raw caution color (#B07A34) is 3.18:1 on bg — border/fill use only,
// never text; ember-text carries caution copy.
module.exports = {
  content: ['./App.tsx', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        hearth: { DEFAULT: '#F0EEE6', surface: '#FBFAF6' },
        ink: { DEFAULT: '#1B3A31', muted: '#5A5E54' },
        pine: { DEFAULT: '#245448', deep: '#1B3A31', soft: '#E3EBE2' },
        glow: { DEFAULT: '#E5A63B', soft: '#F7E8C8', ink: '#3A2A10' },
        moss: { DEFAULT: '#2A7050', text: '#1F5A3F', soft: '#E4EFE7' },
        ember: { DEFAULT: '#B07A34', text: '#7A5222', soft: '#F3E9DA' },
        fog: '#DAD6CA',
      },
      fontFamily: {
        display: ['Fraunces_600SemiBold'],
        displaybold: ['Fraunces_700Bold'],
        body: ['AtkinsonHyperlegible_400Regular'],
        bodybold: ['AtkinsonHyperlegible_700Bold'],
      },
      fontSize: {
        display: ['44px', { lineHeight: '52px' }],
        h1: ['32px', { lineHeight: '40px' }],
        h2: ['24px', { lineHeight: '32px' }],
        h3: ['20px', { lineHeight: '28px' }],
        bodylg: ['18px', { lineHeight: '28px' }],
        body: ['16px', { lineHeight: '24px' }],
        caption: ['14px', { lineHeight: '20px' }],
      },
      borderRadius: { card: '16px' },
    },
  },
  plugins: [],
};
