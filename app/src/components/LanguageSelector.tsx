// T1 — language control for the intake screen (EN / ES / ZH).
// Sets SpeechRecognition.lang + the TTS voice, and is passed through to the
// intake agent as preferredLanguage. Keyboard-operable (Pressable → <button>
// on web) with radio semantics for screen readers.
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
            className={`rounded-full border px-3 py-1 ${selected ? 'border-brand bg-brand' : 'border-indigo-300 bg-transparent'}`}
            onPress={() => onChange(l.code)}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={l.a11yLabel}
          >
            <Text className={`text-xs font-bold ${selected ? 'text-white' : 'text-indigo-100'}`}>{l.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
