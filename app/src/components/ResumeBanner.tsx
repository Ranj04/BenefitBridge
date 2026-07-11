import { View, Text, Pressable } from 'react-native';
import type { Strings } from '../i18n';
import { cardShadow } from '../theme/shadow';

/**
 * Shown on return when a non-expired saved session exists: a calm card, not a
 * modal — the welcome screen stays fully usable behind it. "Start fresh"
 * erases the saved session immediately (shared-device safety).
 */
export function ResumeBanner({ t, onResume, onStartFresh }: { t: Strings; onResume: () => void; onStartFresh: () => void }) {
  return (
    <View className="mx-auto w-full max-w-2xl px-5 pt-4">
      <View className="rounded-card border-2 border-pine bg-pine-soft p-4" style={cardShadow}>
        <Text className="font-display text-h3 text-ink" accessibilityRole="header">
          {t.resumeTitle}
        </Text>
        <Text className="mt-1 font-body text-caption leading-5 text-ink">{t.resumeBody}</Text>
        <View className="mt-3 flex-row flex-wrap gap-2">
          <Pressable
            className="min-h-[48px] items-center justify-center rounded-full bg-pine px-6"
            onPress={onResume}
            accessibilityRole="button"
            accessibilityLabel={t.resume}
          >
            <Text className="font-bodybold text-body text-white">{t.resume}</Text>
          </Pressable>
          <Pressable
            className="min-h-[48px] items-center justify-center rounded-full border-2 border-fog bg-hearth-surface px-6"
            onPress={onStartFresh}
            accessibilityRole="button"
            accessibilityLabel={t.startFresh}
          >
            <Text className="font-bodybold text-body text-ink">{t.startFresh}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
