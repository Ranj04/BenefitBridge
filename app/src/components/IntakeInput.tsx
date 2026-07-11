import { useEffect, useRef } from 'react';
import { Animated, Easing, View, Text, TextInput, Pressable } from 'react-native';
import type { Strings } from '../i18n';
import type { useVoiceInput } from '../hooks/useVoiceInput';
import { cardShadow } from '../theme/shadow';
import { T } from '../theme/tokens';
import { useReducedMotion } from '../theme/useReducedMotion';

type Voice = ReturnType<typeof useVoiceInput>;

/**
 * The one conversation surface: an always-visible, always-editable text
 * field, a mic that only fills that field (never submits), the interim
 * transcript, and the submit button. Voice errors degrade to typing.
 */
export function IntakeInput({
  value,
  onChange,
  onSubmit,
  voice,
  busy,
  t,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  voice: Voice;
  busy: boolean;
  t: Strings;
}) {
  const reduced = useReducedMotion();
  const pulse = useRef(new Animated.Value(0)).current;

  // The listening pulse: a quiet breath on the mic ring, stilled by reduced motion.
  useEffect(() => {
    if (!voice.listening || reduced) {
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [voice.listening, reduced, pulse]);

  return (
    <View>
      <View className="rounded-card bg-hearth-surface p-2" style={cardShadow}>
        <TextInput
          className="min-h-[112px] rounded-card px-4 py-3 font-body text-bodylg leading-7 text-ink"
          style={{ color: T.ink }}
          multiline
          placeholder={t.placeholder}
          placeholderTextColor={T.muted}
          value={value}
          onChangeText={onChange}
          accessibilityLabel={t.intakeTitle}
          textAlignVertical="top"
        />
        <View className="flex-row items-center justify-between gap-3 px-2 pb-2 pt-1">
          {voice.supported ? (
            <Animated.View
              style={{
                borderRadius: 999,
                borderWidth: 2,
                borderColor: voice.listening ? T.glow : 'transparent',
                transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }],
              }}
            >
              <Pressable
                className={`h-[56px] w-[56px] items-center justify-center rounded-full border-2 ${
                  voice.listening ? 'border-pine bg-pine' : 'border-pine bg-hearth-surface'
                }`}
                onPress={voice.toggle}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel={voice.listening ? t.micStop : t.micStart}
                accessibilityState={{ selected: voice.listening }}
              >
                <Text className={`text-h3 ${voice.listening ? 'text-white' : 'text-pine'}`} importantForAccessibility="no">
                  {voice.listening ? '■' : '🎙'}
                </Text>
              </Pressable>
            </Animated.View>
          ) : (
            <View />
          )}
          <Pressable
            className={`min-h-[56px] flex-1 items-center justify-center rounded-full px-6 ${busy || !value.trim() ? 'bg-fog' : 'bg-pine'}`}
            onPress={onSubmit}
            disabled={busy || !value.trim()}
            accessibilityRole="button"
            accessibilityLabel={t.check}
            accessibilityState={{ disabled: busy || !value.trim() }}
          >
            <Text className={`font-bodybold text-bodylg ${busy || !value.trim() ? 'text-ink-muted' : 'text-white'}`}>{t.check}</Text>
          </Pressable>
        </View>
      </View>

      {/* ARIA live region: listening state, interim words, and voice errors. */}
      <View accessibilityLiveRegion="polite">
        {voice.listening ? (
          <View className="mt-3 flex-row items-center gap-2 rounded-card border border-glow bg-glow-soft px-4 py-3">
            <View className="h-2.5 w-2.5 rounded-full bg-ember" />
            <Text className="flex-1 font-body text-caption text-ink">{t.listening}</Text>
          </View>
        ) : null}
        {voice.listening && voice.interim ? (
          <Text className="mt-2 px-2 font-body text-body italic text-ink-muted">{voice.interim}</Text>
        ) : null}
        {voice.error ? (
          <Text className="mt-2 px-2 font-body text-caption text-ember-text">
            {voice.error === 'denied' ? t.micDenied : voice.error === 'no-speech' ? t.micNoSpeech : voice.error === 'network' ? t.micNetwork : t.micUnavailable}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
