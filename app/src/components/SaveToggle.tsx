import { View, Text, Pressable } from 'react-native';
import type { Strings } from '../i18n';

/**
 * The opt-in: nothing is ever written to the device until this is on. A calm
 * choice, not a nag — one row, plainly worded, with the on-device-only promise
 * right under it. Per-session: it always starts OFF (shared devices).
 */
export function SaveToggle({ t, enabled, onToggle }: { t: Strings; enabled: boolean; onToggle: (on: boolean) => void }) {
  return (
    <View className="mt-4">
      <Pressable
        className="min-h-[48px] flex-row items-center gap-3"
        onPress={() => onToggle(!enabled)}
        accessibilityRole="switch"
        accessibilityLabel={t.saveProgress}
        accessibilityState={{ checked: enabled }}
      >
        <View
          className={`h-7 w-12 justify-center rounded-full border-2 px-0.5 ${enabled ? 'border-pine bg-pine' : 'border-fog bg-hearth-surface'}`}
        >
          <View className={`h-5 w-5 rounded-full bg-white ${enabled ? 'self-end' : 'self-start'}`} />
        </View>
        <Text className="flex-1 font-bodybold text-body text-ink">{t.saveProgress}</Text>
      </Pressable>
      {enabled ? <Text className="mt-1 pl-[60px] font-body text-caption leading-5 text-ink-muted">{t.saveProgressNote}</Text> : null}
    </View>
  );
}
