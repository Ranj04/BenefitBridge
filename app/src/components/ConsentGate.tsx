import { View, Text } from 'react-native';

/**
 * The hard line the filer never crosses, stated as a promise to the user:
 * we prepare, you decide. Rendered wherever a prepared application appears.
 */
export function ConsentGate() {
  return (
    <View className="rounded-card border-2 border-pine bg-pine-soft p-4">
      <Text className="font-bodybold text-body text-ink" accessibilityRole="header">
        You review and submit — we never submit for you
      </Text>
      <Text className="mt-1 font-body text-caption leading-5 text-ink">
        This application is prepared, not sent. On our side it can never move past “staged, awaiting your submission.” When you’re
        ready: read every page, add anything we left blank, sign it, and submit it yourself — online, by mail, or in person.
      </Text>
    </View>
  );
}
