// Raw "Hearthstone & Glow" values for the few places NativeWind classes can't
// reach (ActivityIndicator color, placeholderTextColor, Animated styles).
// Single source: keep in lockstep with tailwind.config.js.
export const T = {
  bg: '#F0EEE6',
  surface: '#FBFAF6',
  ink: '#1B3A31',
  muted: '#5A5E54',
  pine: '#245448',
  glow: '#E5A63B',
  glowSoft: '#F7E8C8',
  moss: '#2A7050',
  ember: '#B07A34',
  emberText: '#7A5222',
  fog: '#DAD6CA',
} as const;

export const FONT = {
  display: 'Fraunces_600SemiBold',
  displayBold: 'Fraunces_700Bold',
  body: 'AtkinsonHyperlegible_400Regular',
  bodyBold: 'AtkinsonHyperlegible_700Bold',
} as const;
