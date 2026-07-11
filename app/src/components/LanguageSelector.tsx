// Language control (EN / ES / ZH). Sets SpeechRecognition.lang + the TTS
// voice, and is passed through to the intake agent as preferredLanguage.
// Keyboard-operable (Pressable → <button> on web) with radio semantics.
import { View, Text, Pressable } from 'react-native';
import { LANGUAGES, STRINGS, type LangCode } from '../i18n';

export function LanguageSelector({ value, onChange }: { value: LangCode; onChange: (code: LangCode) => void }) {
  return (
    <View className="flex-row items-center gap-2" accessibilityRole="radiogroup" accessibilityLabel={STRINGS[value].languagePicker}>
      {LANGUAGES.map((l) => {
        const selected = l.code === value;
        return (
          <Pressable
            key={l.code}
            className={`min-h-[48px] justify-center rounded-full border px-4 ${selected ? 'border-pine bg-pine' : 'border-fog bg-hearth-surface'}`}
            onPress={() => onChange(l.code)}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            aria-checked={selected}
            accessibilityLabel={l.a11yLabel}
          >
            <Text className={`font-bodybold text-caption ${selected ? 'text-white' : 'text-ink'}`}>{l.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
