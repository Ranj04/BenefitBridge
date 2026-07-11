import { useState } from 'react';
import { View, Text, Pressable, Linking, ActivityIndicator } from 'react-native';
import type { FilledApplication, NullableProfile } from '../types';
import { api } from '../api';

/**
 * "File it" — the consent-gated filer. The system prepares the official
 * CF 285 for review; THE USER submits it. Nothing here can submit anything.
 */
export function FilerPanel({ profile, offline, offlineFilled }: { profile: NullableProfile; offline: boolean; offlineFilled: FilledApplication | null }) {
  const [filled, setFilled] = useState<FilledApplication | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileIt = async () => {
    setError(null);
    if (offline) {
      setFilled(offlineFilled);
      return;
    }
    setBusy(true);
    try {
      setFilled(await api.fill(profile));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View className="rounded-2xl border border-brand bg-white p-4 mb-3">
      <Text className="text-sm font-bold uppercase tracking-wide text-brand-dark">File it</Text>
      <Text className="mt-1 text-[11px] text-slate-600">
        BenefitBridge fills the official CalFresh application (CF 285) with what you told us — and stops. You review it, complete the
        personal items we never guess, sign it, and <Text className="font-bold">you submit it yourself</Text>.
      </Text>

      {!filled && (
        <Pressable className="mt-3 self-start rounded-xl bg-brand px-4 py-2.5" onPress={fileIt} disabled={busy} accessibilityLabel="Prepare my application">
          {busy ? <ActivityIndicator color="white" /> : <Text className="text-sm font-bold text-white">Prepare my application</Text>}
        </Pressable>
      )}
      {error && <Text className="mt-2 text-[11px] text-rose-700">{error}</Text>}

      {filled && (
        <View className="mt-3">
          <View className="flex-row items-center">
            <View className="rounded-full bg-amber-100 border border-amber-400 px-3 py-0.5">
              <Text className="text-xs font-semibold text-amber-800">Status: {filled.status.replace(/_/g, ' ')}</Text>
            </View>
          </View>

          <Pressable className="mt-2" onPress={() => Linking.openURL(filled.pdfUrl)} accessibilityLabel="Open the filled PDF">
            <Text className="text-sm font-bold text-brand underline">Open the filled CF 285 (PDF) →</Text>
          </Pressable>

          <Text className="mt-3 text-xs font-bold text-slate-700">Filled from your answers</Text>
          {Object.entries(filled.fields).map(([k, v]) => (
            <Text key={k} className="text-[11px] text-slate-600">
              ✓ {k}: <Text className="font-semibold">{v}</Text>
            </Text>
          ))}

          {filled.blankFields?.length ? (
            <>
              <Text className="mt-2 text-xs font-bold text-slate-700">You complete these (we never guess)</Text>
              {filled.blankFields.map((b) => (
                <Text key={b} className="text-[11px] text-slate-600">
                  ○ {b}
                </Text>
              ))}
            </>
          ) : null}

          <View className="mt-3 rounded-xl bg-brand-light p-3">
            <Text className="text-xs font-bold text-brand-dark">The consent gate</Text>
            <Text className="mt-0.5 text-[11px] leading-4 text-slate-700">
              This application has been prepared, not submitted. It will never advance past “staged awaiting your submission” on our
              side. When you're ready: review every page, sign, and submit it yourself — online, by mail, or in person.
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}
