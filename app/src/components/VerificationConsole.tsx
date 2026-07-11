import { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import type { ScreeningResult, NullableProfile, AdversarialResult, ChatResponse } from '../types';
import { api } from '../api';

/**
 * The trust panel: the parsed profile, every computation line, every
 * assumption, guardrail status — and a button that fires a live guarantee
 * injection so judges watch the rewrite happen.
 */
export function VerificationConsole({
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

  return (
    <View className="rounded-2xl border border-slate-300 bg-slate-50 p-4 mb-3">
      <Text className="text-sm font-bold uppercase tracking-wide text-slate-600">Verification Console</Text>
      <Text className="mt-1 text-[11px] text-slate-500">
        The model asserted none of the numbers above. Here is the deterministic math, every assumption, and the data provenance.
      </Text>

      <Text className="mt-3 text-xs font-bold text-slate-600">Parsed household profile (unstated = null, never guessed)</Text>
      <View className="mt-1 rounded-lg bg-slate-900 p-2">
        <Text className="font-mono text-[10px] leading-4 text-emerald-300">{JSON.stringify(profile, null, 1)}</Text>
      </View>

      {freshness && (
        <Text className="mt-2 text-[11px] text-slate-600">
          FPL basis: HHS ASPE API, store v{version} — <Text className="font-bold">{freshness === 'live' ? 'fetched live' : 'last-good cache (flagged)'}</Text>
        </Text>
      )}

      {results.map((r) =>
        r.computation.length ? (
          <View key={r.program} className="mt-3">
            <Text className="text-xs font-bold text-slate-700">{r.program} — full computation</Text>
            {r.computation.map((line, i) => (
              <View key={i} className="flex-row justify-between border-b border-slate-200 py-0.5">
                <Text className="flex-1 pr-2 text-[11px] text-slate-600">{line.label}</Text>
                <Text className="font-mono text-[11px] text-slate-900">${line.value.toLocaleString()}</Text>
              </View>
            ))}
            {r.assumptions.length > 0 && (
              <Text className="mt-1 text-[10px] italic text-slate-500">Assumptions: {r.assumptions.join(' · ')}</Text>
            )}
          </View>
        ) : null,
      )}

      <View className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3">
        <Text className="text-xs font-bold text-rose-700">Guardrail status</Text>
        <Text className="mt-0.5 text-[11px] text-rose-900">
          {guard
            ? guard.rewritten
              ? 'The model attempted guarantee language on this answer — the deterministic guard rewrote it.'
              : 'Clean: no guarantee language; disclaimer present.'
            : 'No agent explanation on this run (deterministic results only).'}
        </Text>
        <Pressable
          className="mt-2 self-start rounded-lg bg-rose-600 px-3 py-2"
          onPress={runAdversarial}
          disabled={running}
          accessibilityLabel="Run adversarial test"
        >
          {running ? <ActivityIndicator color="white" /> : <Text className="text-xs font-bold text-white">Run adversarial test — try to make it promise $5,000</Text>}
        </Pressable>
        {error && <Text className="mt-1 text-[11px] text-rose-700">{error}</Text>}
        {adv && (
          <View className="mt-2">
            <Text className="text-[10px] font-bold text-rose-700">BEFORE (raw model output)</Text>
            <Text className="text-[11px] text-slate-800">{adv.before}</Text>
            <Text className="mt-1 text-[10px] font-bold text-emerald-700">AFTER (deterministic guard)</Text>
            <Text className="text-[11px] text-slate-800">{adv.after}</Text>
          </View>
        )}
      </View>
    </View>
  );
}
