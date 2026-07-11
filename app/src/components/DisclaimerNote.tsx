import { View, Text } from 'react-native';

/**
 * Calm information, never an alarm: warm amber tint, plain words.
 * Used for estimate framing, data-safety notes, "confirm with the office".
 */
export function DisclaimerNote({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <View className={`flex-row items-start gap-2 rounded-card bg-ember-soft px-4 py-3 ${className}`}>
      <Text className="font-bodybold text-body text-ember-text" accessibilityElementsHidden importantForAccessibility="no">
        ⓘ
      </Text>
      <Text className="flex-1 font-body text-caption leading-5 text-ember-text">{children}</Text>
    </View>
  );
}
