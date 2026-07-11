import { View, Text, Pressable, Platform } from 'react-native';
import type { Strings, LangCode } from '../i18n';
import { LanguageSelector } from '../components/LanguageSelector';
import { SeedPersonaChips, type Persona } from '../components/SeedPersonaChips';

/**
 * The front door: one warm line, plain trust cues, a language choice, Start.
 * Calm and uncrowded — the whole screen asks for nothing yet.
 */
export function WelcomeScreen({
  t,
  lang,
  onChangeLang,
  onStart,
  personas,
  onPersona,
}: {
  t: Strings;
  lang: LangCode;
  onChangeLang: (l: LangCode) => void;
  onStart: () => void;
  personas: readonly Persona[];
  onPersona: (p: Persona) => void;
}) {
  const trustCues = [t.trustFree, t.trustPrivate, t.trustNoAccount, t.trustNoStore];
  return (
    <View
      className="flex-1 items-center px-6 pb-12 pt-10"
      style={Platform.select({
        // A faint warmth rising from the top of the hearth — web only; native stays solid bone.
        web: { backgroundImage: 'radial-gradient(70% 42% at 50% 0%, rgba(229,166,59,0.14), rgba(240,238,230,0))' } as object,
        default: undefined,
      })}
    >
      <View className="w-full max-w-xl items-center">
        <View className="flex-row items-center gap-2">
          {/* the ember: the one speck of hearth-gold before the results moment */}
          <View className="h-3 w-3 rounded-full bg-glow" />
          <Text className="font-display text-h3 text-ink">BenefitBridge</Text>
        </View>

        <View className="mt-8">
          <LanguageSelector value={lang} onChange={onChangeLang} />
        </View>

        <Text className="mt-10 text-center font-displaybold text-display text-ink" accessibilityRole="header">
          {t.welcomeLine}
        </Text>
        <Text className="mt-4 max-w-md text-center font-body text-bodylg leading-7 text-ink-muted">{t.welcomeSub}</Text>

        <View className="mt-8 flex-row flex-wrap justify-center gap-2">
          {trustCues.map((cue) => (
            <View key={cue} className="flex-row items-center gap-1.5 rounded-full bg-pine-soft px-4 py-2">
              <Text className="font-bodybold text-caption text-moss-text" importantForAccessibility="no">
                ✓
              </Text>
              <Text className="font-bodybold text-caption text-ink">{cue}</Text>
            </View>
          ))}
        </View>

        {/* Precise privacy language: screening is remote; optional progress storage is on-device and clearable. */}
        <Text className="mt-3 max-w-md text-center font-body text-caption leading-5 text-ink-muted">{t.privacyLine}</Text>

        <Pressable
          className="mt-10 min-h-[56px] w-full max-w-xs items-center justify-center rounded-full bg-pine px-8"
          onPress={onStart}
          accessibilityRole="button"
          accessibilityLabel={t.start}
        >
          <Text className="font-bodybold text-bodylg text-white">{t.start}</Text>
        </Pressable>

        <Text className="mt-12 font-body text-caption text-ink-muted">{t.tryPersona}</Text>
        <View className="mt-3">
          <SeedPersonaChips personas={personas} onPick={onPersona} />
        </View>
      </View>
    </View>
  );
}
