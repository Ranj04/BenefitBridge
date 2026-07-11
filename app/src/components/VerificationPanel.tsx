import { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, Platform } from 'react-native';
import type { ScreeningResult, NullableProfile, AdversarialResult, ChatResponse } from '../types';
import { api } from '../api';
import { fmtUsd } from '../lib/derive';
import { cardShadow } from '../theme/shadow';
import { T } from '../theme/tokens';
import { ProvenanceStamp } from './ProvenanceStamp';

const MONO = Platform.select({ web: 'ui-monospace, SFMono-Regular, Menlo, monospace', default: 'Courier' });

// Plain-language names for the parsed profile fields.
const FIELD_LABEL: Record<string, string> = {
  householdSize: 'People in your household',
  monthlyGrossIncome: 'Monthly income (before taxes)',
  earnedIncome: 'Of that, earned from work',
  hasChildren: 'Children at home',
  childrenAges: 'Children’s ages',
  hasElderlyOrDisabled: 'Anyone 60+ or disabled',
  isRenter: 'Renting your home',
  monthlyRent: 'Monthly rent',
  monthlyUtilities: 'Monthly utilities',
  dependentCareCost: 'Child or dependent care costs',
  medicalExpenses: 'Medical expenses',
  countyFips: 'County',
  immigrationStatus: 'Immigration status',
  preferredLanguage: 'Preferred language',
};

function friendly(v: unknown): string {
  if (v === null || v === undefined) return 'not stated — we never guess';
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
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
  profile,
  results,
  guard,
  offline,
  offlineAdversarial,
}: {
  profile: NullableProfile;
  results: ScreeningResult[];
  guard: ChatResponse['guard'];
  offline: boolean;
  offlineAdversarial: AdversarialResult | null;
}) {
  const [adv, setAdv] = useState<AdversarialResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);

  const runAdversarial = async () => {
    setError(null);
    if (offline) {
      setAdv(offlineAdversarial);
      return;
    }
    setRunning(true);
    try {
      setAdv(await api.adversarial());
    } catch (e) {
      setError((e as Error).message);
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
        See how we know
      </Text>
      <Text className="mt-1 font-body text-caption leading-5 text-ink-muted">
        The AI only reads and explains. Every number comes from deterministic code you can check — here is all of it.
      </Text>

      {/* 1 — what we understood */}
      <Text className="mt-5 font-bodybold text-body text-ink" accessibilityRole="header">
        Here’s what we understood
      </Text>
      <View className="mt-2 rounded-card border border-fog bg-hearth px-4 py-1">
        {Object.entries(profile).map(([k, v]) => (
          <View key={k} className="flex-row items-baseline justify-between gap-3 border-b border-fog py-2 last:border-b-0">
            <Text className="flex-1 font-body text-caption text-ink-muted">{FIELD_LABEL[k] ?? k}</Text>
            <Text className={`font-bodybold text-caption ${v === null || v === undefined ? 'text-ink-muted' : 'text-ink'}`}>
              {friendly(v)}
            </Text>
          </View>
        ))}
      </View>
      <Pressable
        className="min-h-[48px] justify-center self-start"
        onPress={() => setShowRaw((s) => !s)}
        accessibilityRole="button"
        accessibilityLabel={showRaw ? 'Hide the raw parsed profile' : 'Show the raw parsed profile'}
        accessibilityState={{ expanded: showRaw }}
      >
        <Text className="font-bodybold text-caption text-pine">{showRaw ? 'Hide raw profile ▴' : 'Raw profile (JSON) ▾'}</Text>
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
              {r.program} — the math, line by line
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
                Assumptions we made (and tell you about): {r.assumptions.join(' · ')}
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
            Guardrail: {guardClean === false ? 'caught and rewrote a promise' : 'clean'}
          </Text>
        </View>
        <Text className={`mt-1 font-body text-caption leading-5 ${guardClean === false ? 'text-ember-text' : 'text-moss-text'}`}>
          {guard
            ? guard.rewritten
              ? 'The model tried to phrase this as a guarantee — the deterministic guard rewrote it into honest estimate language before you saw it.'
              : 'No guarantee language in this answer, and the estimate disclaimer is present.'
            : 'No model explanation on this run — these results are deterministic output only.'}
        </Text>

        <Pressable
          className="mt-3 min-h-[48px] items-center justify-center self-start rounded-full bg-pine px-5"
          onPress={runAdversarial}
          disabled={running}
          accessibilityRole="button"
          accessibilityLabel="Run a test: try to make the model promise five thousand dollars"
        >
          {running ? (
            <ActivityIndicator color={T.surface} />
          ) : (
            <Text className="font-bodybold text-body text-white">Run a test — try to make it promise $5,000</Text>
          )}
        </Pressable>
        {error ? <Text className="mt-2 font-body text-caption text-ember-text">{error}</Text> : null}

        {adv ? (
          <View className="mt-3" accessibilityLiveRegion="polite">
            <Text className="font-bodybold text-caption uppercase tracking-wide text-ember-text">What the model tried to say</Text>
            <View className="mt-1 rounded-card border border-ember bg-hearth-surface p-3">
              <Text className="font-body text-caption leading-5 text-ink">{adv.before}</Text>
            </View>
            <Text className="mt-3 font-bodybold text-caption uppercase tracking-wide text-moss-text">What the guard let through</Text>
            <View className="mt-1 rounded-card border border-moss bg-hearth-surface p-3">
              <Text className="font-body text-caption leading-5 text-ink">{adv.after}</Text>
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
}
