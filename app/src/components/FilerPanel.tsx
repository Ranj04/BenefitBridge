import { useState } from 'react';
import { View, Text, Pressable, Linking, ActivityIndicator } from 'react-native';
import type { FilledApplication, NullableProfile } from '../types';
import type { Strings } from '../i18n';
import { api } from '../api';
import { cardShadow } from '../theme/shadow';
import { T } from '../theme/tokens';
import { ConsentGate } from './ConsentGate';

/**
 * "Get the paperwork started" — the consent-gated filer. The system prepares
 * the official CF 285 for review; THE USER submits it. Nothing here can
 * submit anything.
 */
export function FilerPanel({
  t,
  profile,
  offline,
  offlineFilled,
}: {
  t: Strings;
  profile: NullableProfile;
  offline: boolean;
  offlineFilled: FilledApplication | null;
}) {
  const [filled, setFilled] = useState<FilledApplication | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const fileIt = async () => {
    setFailed(false);
    if (offline) {
      setFilled(offlineFilled);
      return;
    }
    setBusy(true);
    try {
      setFilled(await api.fill(profile));
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View className="mb-4 rounded-card bg-hearth-surface p-5" style={cardShadow}>
      <Text className="font-display text-h3 text-ink" accessibilityRole="header">
        {t.filerTitle}
      </Text>
      <Text className="mt-1 font-body text-caption leading-5 text-ink-muted">{t.filerBody}</Text>

      {!filled ? (
        <Pressable
          className="mt-4 min-h-[48px] items-center justify-center self-start rounded-full bg-pine px-6"
          onPress={fileIt}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={t.filerPrepare}
        >
          {busy ? <ActivityIndicator color={T.surface} /> : <Text className="font-bodybold text-body text-white">{t.filerPrepare}</Text>}
        </Pressable>
      ) : null}
      {failed ? <Text className="mt-3 font-body text-caption text-ember-text">{t.filerError}</Text> : null}

      {filled ? (
        <View className="mt-4">
          <View className="self-start rounded-full border border-ember bg-ember-soft px-3 py-1.5">
            <Text className="font-bodybold text-caption text-ember-text">{t.filerStatus(filled.status)}</Text>
          </View>

          <Pressable
            className="mt-2 min-h-[48px] justify-center self-start"
            onPress={() => Linking.openURL(filled.pdfUrl)}
            accessibilityRole="link"
            accessibilityLabel={t.filerOpenPdf}
          >
            <Text className="font-bodybold text-body text-pine underline">{t.filerOpenPdf}</Text>
          </Pressable>

          <Text className="mt-3 font-bodybold text-body text-ink">{t.filerFilledFrom}</Text>
          <View className="mt-1 rounded-card border border-fog bg-hearth px-4 py-1">
            {Object.entries(filled.fields).map(([k, v]) => (
              <View key={k} className="flex-row items-baseline gap-2 border-b border-fog py-2 last:border-b-0">
                <Text className="font-bodybold text-caption text-moss-text" importantForAccessibility="no">
                  ✓
                </Text>
                <Text className="flex-1 font-body text-caption text-ink-muted">{k}</Text>
                <Text className="font-bodybold text-caption text-ink">{v}</Text>
              </View>
            ))}
          </View>

          {filled.blankFields?.length ? (
            <>
              <Text className="mt-3 font-bodybold text-body text-ink">{t.filerYouComplete}</Text>
              <View className="mt-1 rounded-card border border-fog bg-hearth px-4 py-1">
                {filled.blankFields.map((b) => (
                  <View key={b} className="flex-row items-baseline gap-2 border-b border-fog py-2 last:border-b-0">
                    <Text className="font-bodybold text-caption text-ink-muted" importantForAccessibility="no">
                      ○
                    </Text>
                    <Text className="flex-1 font-body text-caption text-ink">{b}</Text>
                  </View>
                ))}
              </View>
            </>
          ) : null}

          <View className="mt-4">
            <ConsentGate t={t} />
          </View>
        </View>
      ) : null}
    </View>
  );
}
