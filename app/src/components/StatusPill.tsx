import { View, Text } from 'react-native';
import type { ScreeningResult } from '../types';

// Warm semantics, never punishing: "unlikely" is quiet stone, not red.
const VARIANT: Record<ScreeningResult['screening'], { box: string; text: string; mark: string }> = {
  likely_qualify: { box: 'bg-moss-soft border-moss', text: 'text-moss-text', mark: '✓' },
  need_more_info: { box: 'bg-ember-soft border-ember', text: 'text-ember-text', mark: '…' },
  unlikely: { box: 'bg-hearth border-fog', text: 'text-ink-muted', mark: '—' },
};

export function StatusPill({ screening, label }: { screening: ScreeningResult['screening']; label: string }) {
  const v = VARIANT[screening];
  return (
    <View className={`flex-row items-center rounded-full border px-3 py-1.5 ${v.box}`} accessibilityLabel={label}>
      <Text className={`font-bodybold text-caption ${v.text}`}>
        {v.mark} {label}
      </Text>
    </View>
  );
}
