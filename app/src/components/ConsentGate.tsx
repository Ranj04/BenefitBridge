import { View, Text } from 'react-native';
import type { Strings } from '../i18n';

/**
 * The hard line the filer never crosses, stated as a promise to the user:
 * we prepare, you decide. Rendered wherever a prepared application appears.
 */
export function ConsentGate({ t }: { t: Strings }) {
  return (
    <View className="rounded-card border-2 border-pine bg-pine-soft p-4">
      <Text className="font-bodybold text-body text-ink" accessibilityRole="header">
        {t.consentTitle}
      </Text>
      <Text className="mt-1 font-body text-caption leading-5 text-ink">{t.consentBody}</Text>
    </View>
  );
}
