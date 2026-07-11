import { View, Text, Pressable } from 'react-native';
import type { Strings, LangCode } from '../i18n';
import type { useVoiceInput } from '../hooks/useVoiceInput';
import { LanguageSelector } from '../components/LanguageSelector';
import { SeedPersonaChips, type Persona } from '../components/SeedPersonaChips';
import { IntakeInput } from '../components/IntakeInput';
import { SaveToggle } from '../components/SaveToggle';

/**
 * The conversation: one gentle prompt, one surface to answer in — spoken or
 * typed, any of our languages. No form grid, no required-field asterisks.
 */
export function IntakeScreen({
  t,
  lang,
  onChangeLang,
  text,
  onChangeText,
  onSubmit,
  voice,
  busy,
  onBack,
  personas,
  onPersona,
  saveEnabled,
  onToggleSave,
}: {
  t: Strings;
  lang: LangCode;
  onChangeLang: (l: LangCode) => void;
  text: string;
  onChangeText: (v: string) => void;
  onSubmit: () => void;
  voice: ReturnType<typeof useVoiceInput>;
  busy: boolean;
  onBack: () => void;
  personas: readonly Persona[];
  onPersona: (p: Persona) => void;
  saveEnabled: boolean;
  onToggleSave: (on: boolean) => void;
}) {
  return (
    <View className="w-full max-w-2xl self-center px-5 pb-12 pt-4">
      <View className="flex-row items-center justify-between">
        <Pressable className="min-h-[48px] justify-center pr-4" onPress={onBack} accessibilityRole="button" accessibilityLabel={t.back}>
          <Text className="font-bodybold text-body text-pine">← {t.back}</Text>
        </Pressable>
        <LanguageSelector value={lang} onChange={onChangeLang} />
      </View>

      <Text className="mt-8 font-displaybold text-h1 text-ink" accessibilityRole="header">
        {t.intakeTitle}
      </Text>
      <Text className="mt-3 font-body text-bodylg leading-7 text-ink-muted">{t.intakeHint}</Text>

      <View className="mt-6">
        <IntakeInput value={text} onChange={onChangeText} onSubmit={onSubmit} voice={voice} busy={busy} t={t} />
      </View>

      <SaveToggle t={t} enabled={saveEnabled} onToggle={onToggleSave} />

      <Text className="mt-10 font-body text-caption text-ink-muted">{t.tryPersona}</Text>
      <View className="mt-3 items-start">
        <SeedPersonaChips personas={personas} onPick={onPersona} disabled={busy} />
      </View>
    </View>
  );
}
