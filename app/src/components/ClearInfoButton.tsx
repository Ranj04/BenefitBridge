import { useEffect, useRef, useState } from 'react';
import { Text, Pressable } from 'react-native';
import type { Strings } from '../i18n';

/**
 * "Clear my information" — always reachable in the header. Two-tap confirm
 * (works identically on web and native, where Alert diverges); the armed state
 * disarms itself after a few seconds if the second tap never comes.
 */
export function ClearInfoButton({ t, onClear }: { t: Strings; onClear: () => void }) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const press = () => {
    if (armed) {
      if (timer.current) clearTimeout(timer.current);
      setArmed(false);
      onClear();
      return;
    }
    setArmed(true);
    timer.current = setTimeout(() => setArmed(false), 4000);
  };

  return (
    <Pressable
      className={`min-h-[48px] justify-center rounded-full border px-3 ${armed ? 'border-ember bg-ember-soft' : 'border-fog bg-hearth-surface'}`}
      onPress={press}
      accessibilityRole="button"
      accessibilityLabel={armed ? t.clearConfirm : t.clearInfo}
    >
      <Text className={`font-bodybold text-caption ${armed ? 'text-ember-text' : 'text-ink-muted'}`}>
        {armed ? t.clearConfirm : t.clearInfo}
      </Text>
    </Pressable>
  );
}
