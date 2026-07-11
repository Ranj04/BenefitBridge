import { View, Text, Pressable } from 'react-native';
import { cardShadow } from '../theme/shadow';
import type { NullableProfile } from '../types';

export type Persona = { key: string; label: string; text: string; profile: NullableProfile };

/** One-tap demo households — each fills the intake field and runs the screen. */
export function SeedPersonaChips({ personas, onPick, disabled }: { personas: readonly Persona[]; onPick: (p: Persona) => void; disabled?: boolean }) {
  return (
    <View className="flex-row flex-wrap justify-center gap-3">
      {personas.map((p) => (
        <Pressable
          key={p.key}
          className="min-h-[48px] justify-center rounded-full border border-fog bg-hearth-surface px-5 py-2"
          style={cardShadow}
          onPress={() => onPick(p)}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={`Try an example: ${p.label}`}
        >
          <Text className="font-bodybold text-caption text-ink">{p.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}
