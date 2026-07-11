import { View, Text } from 'react-native';
import type { ScreeningResult } from '../types';
import type { Strings } from '../i18n';
import { cardShadow } from '../theme/shadow';

/**
 * The categorical unlock chain: qualifying for CalFresh opens doors the
 * household may not know exist. Rendered as a rooted chain — the engine's
 * own reasons, one line each; nothing inferred in the UI.
 */
export function CascadeList({ t, root, unlocked }: { t: Strings; root: ScreeningResult; unlocked: ScreeningResult[] }) {
  return (
    <View className="mb-4 rounded-card bg-pine-soft p-5" style={cardShadow}>
      <Text className="font-display text-h3 text-ink" accessibilityRole="header">
        {t.cascadeTitle}
      </Text>
      <Text className="mt-1 font-body text-body text-ink">
        {t.cascadeLead}
        <Text className="font-bodybold">{root.program}</Text>
        {t.cascadeTail}
      </Text>
      <View className="mt-4">
        {unlocked.map((r, i) => (
          <View key={r.program} className="flex-row">
            {/* chain spine */}
            <View className="mr-3 w-6 items-center">
              <View className="h-6 w-6 items-center justify-center rounded-full bg-moss">
                <Text className="font-bodybold text-caption text-white" importantForAccessibility="no">
                  ✓
                </Text>
              </View>
              {i < unlocked.length - 1 ? <View className="w-0.5 flex-1 bg-moss" /> : null}
            </View>
            <View className={`flex-1 ${i < unlocked.length - 1 ? 'pb-4' : ''}`}>
              <Text className="font-bodybold text-body text-ink">{r.program}</Text>
              <Text className="mt-0.5 font-body text-caption leading-5 text-ink-muted">{r.reason}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
