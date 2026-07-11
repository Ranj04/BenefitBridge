import { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, Platform } from 'react-native';
import type { ScreeningResult, NullableProfile, AdversarialResult, ChatResponse } from '../types';
import type { Strings, LangCode } from '../i18n';
import { fieldLabel } from '../i18n';
import { api } from '../api';
import { fmtUsd } from '../lib/derive';
import { cardShadow } from '../theme/shadow';
import { T } from '../theme/tokens';
import { ProvenanceStamp } from './ProvenanceStamp';

const MONO = Platform.select({ web: 'ui-monospace, SFMono-Regular, Menlo, monospace', default: 'Courier' });

function friendly(v: unknown, t: Strings): string {
  if (v === null || v === undefined) return t.verifyNotStated;
  if (typeof v === 'boolean') return v ? t.verifyYes : t.verifyNo;
  if (typeof v === 'number') return v >= 100 ? fmtUsd(v) : String(v);
  if (Array.isArray(v)) return v.join(', ');
  return String(v);
}

/**
 * "See how we know" — the whole chain of custody for every number above:
 * what we understood, the deterministic math line by line, the assumptions,
 * where the data came from, and the guardrail that keeps the model honest —
 * with a button that attacks it live.
 */
export function VerificationPanel({
  t,
  lang,
  profile,
  results,
  guard,
  offline,
  offlineAdversarial,
}: {
  t: Strings;
  lang: LangCode;
  profile: NullableProfile;
  results: ScreeningResult[];
  guard: ChatResponse['guard'];
  offline: boolean;
  offlineAdversarial: AdversarialResult | null;
}) {
  const [adv, setAdv] = useState<AdversarialResult | null>(null);
  const [running, setRunning] = useState(false);
  const [failed, setFailed] = useState(false);
  const [showRaw, setShowRaw] = useState(false);

  const runAdversarial = async () => {
    setFailed(false);
    if (offline) {
      setAdv(offlineAdversarial);
      return;
    }
    setRunning(true);
    try {
      setAdv(await api.adversarial());
    } catch {
      // No raw error codes to the user — the translated friendly copy renders below.
      setFailed(true);
    } finally {
      setRunning(false);
    }
  };

  const freshness = results.find((r) => r.data_freshness)?.data_freshness;
  const version = results.find((r) => r.dataVersion)?.dataVersion;
  const guardClean = guard ? !guard.rewritten : null;

  return (
    <View className="mb-4 rounded-card bg-hearth-surface p-5" style={cardShadow}>
      <Text className="font-display text-h3 text-ink" accessibilityRole="header">
        {t.verifyTitle}
      </Text>
      <Text className="mt-1 font-body text-caption leading-5 text-ink-muted">{t.verifySub}</Text>

      {/* 1 — what we understood */}
      <Text className="mt-5 font-bodybold text-body text-ink" accessibilityRole="header">
        {t.verifyUnderstood}
      </Text>
      <View className="mt-2 rounded-card border border-fog bg-hearth px-4 py-1">
        {Object.entries(profile).map(([k, v]) => (
          <View key={k} className="flex-row items-baseline justify-between gap-3 border-b border-fog py-2 last:border-b-0">
            <Text className="flex-1 font-body text-caption text-ink-muted">{fieldLabel(lang, k)}</Text>
            <Text className={`font-bodybold text-caption ${v === null || v === undefined ? 'text-ink-muted' : 'text-ink'}`}>
              {friendly(v, t)}
            </Text>
          </View>
        ))}
      </View>
      <Pressable
        className="min-h-[48px] justify-center self-start"
        onPress={() => setShowRaw((s) => !s)}
        accessibilityRole="button"
        accessibilityLabel={showRaw ? t.verifyHideRaw : t.verifyShowRaw}
        accessibilityState={{ expanded: showRaw }}
      >
        <Text className="font-bodybold text-caption text-pine">{showRaw ? t.verifyHideRaw : t.verifyShowRaw}</Text>
      </Pressable>
      {showRaw ? (
        <View className="rounded-card bg-pine-deep p-3">
          <Text style={{ fontFamily: MONO, fontSize: 12, lineHeight: 18 }} className="text-glow-soft">
            {JSON.stringify(profile, null, 2)}
          </Text>
        </View>
      ) : null}

      {/* 2 — the math, line by line */}
      {results.map((r) =>
        r.computation.length ? (
          <View key={r.program} className="mt-5">
            <Text className="font-bodybold text-body text-ink" accessibilityRole="header">
              {t.verifyMathTitle(r.program)}
            </Text>
            <View className="mt-2 rounded-card border border-fog bg-hearth px-4 py-1">
              {r.computation.map((line, i) => (
                <View key={i} className="flex-row items-baseline justify-between gap-3 border-b border-fog py-2 last:border-b-0">
                  <Text className="flex-1 font-body text-caption text-ink-muted">{line.label}</Text>
                  <Text className="font-bodybold text-caption text-ink" style={{ fontVariant: ['tabular-nums'] }}>
                    {fmtUsd(line.value)}
                  </Text>
                </View>
              ))}
            </View>
            {r.assumptions.length > 0 ? (
              <Text className="mt-2 font-body text-caption italic leading-5 text-ink-muted">
                {t.verifyAssumptions(r.assumptions.join(' · '))}
              </Text>
            ) : null}
          </View>
        ) : null,
      )}

      {/* 3 — provenance */}
      {freshness ? (
        <View className="mt-5">
          <ProvenanceStamp freshness={freshness} version={version} />
        </View>
      ) : null}

      {/* 4 — guardrail status + live test */}
      <View className={`mt-5 rounded-card border p-4 ${guardClean === false ? 'border-ember bg-ember-soft' : 'border-moss bg-moss-soft'}`}>
        <View className="flex-row items-center gap-2">
          <View className={`h-2.5 w-2.5 rounded-full ${guardClean === false ? 'bg-ember' : 'bg-moss'}`} />
          <Text className={`font-bodybold text-body ${guardClean === false ? 'text-ember-text' : 'text-moss-text'}`}>
            {guardClean === false ? t.verifyGuardCaught : t.verifyGuardClean}
          </Text>
        </View>
        <Text className={`mt-1 font-body text-caption leading-5 ${guardClean === false ? 'text-ember-text' : 'text-moss-text'}`}>
          {guard ? (guard.rewritten ? t.verifyGuardCaughtBody : t.verifyGuardCleanBody) : t.verifyGuardNoModelBody}
        </Text>

        <Pressable
          className="mt-3 min-h-[48px] items-center justify-center self-start rounded-full bg-pine px-5"
          onPress={runAdversarial}
          disabled={running}
          accessibilityRole="button"
          accessibilityLabel={t.verifyRunTest}
        >
          {running ? (
            <ActivityIndicator color={T.surface} />
          ) : (
            <Text className="font-bodybold text-body text-white">{t.verifyRunTest}</Text>
          )}
        </Pressable>
        {failed ? <Text className="mt-2 font-body text-caption text-ember-text">{t.verifyTestError}</Text> : null}

        {adv ? (
          <View className="mt-3" accessibilityLiveRegion="polite">
            <Text className="font-bodybold text-caption uppercase tracking-wide text-ember-text">{t.verifyBefore}</Text>
            <View className="mt-1 rounded-card border border-ember bg-hearth-surface p-3">
              <Text className="font-body text-caption leading-5 text-ink">{adv.before}</Text>
            </View>
            <Text className="mt-3 font-bodybold text-caption uppercase tracking-wide text-moss-text">{t.verifyAfter}</Text>
            <View className="mt-1 rounded-card border border-moss bg-hearth-surface p-3">
              <Text className="font-body text-caption leading-5 text-ink">{adv.after}</Text>
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
}
