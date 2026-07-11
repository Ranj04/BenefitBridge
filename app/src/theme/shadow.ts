import { Platform, type ViewStyle } from 'react-native';

// Warm, low, diffuse elevation — pine-tinted, never gray-blue.
// Web gets layered box-shadows; native gets shadow props + Android elevation.
export const cardShadow: ViewStyle = Platform.select({
  web: { boxShadow: '0 1px 3px rgba(27,58,49,0.06), 0 6px 20px rgba(27,58,49,0.07)' } as unknown as ViewStyle,
  default: {
    shadowColor: '#1B3A31',
    shadowOpacity: 0.09,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
})!;

// The hearth-glow: a gold bloom reserved for the money-owed moment.
export const glowShadow: ViewStyle = Platform.select({
  web: { boxShadow: '0 2px 10px rgba(229,166,59,0.28), 0 10px 46px rgba(229,166,59,0.34)' } as unknown as ViewStyle,
  default: {
    shadowColor: '#E5A63B',
    shadowOpacity: 0.45,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
})!;
