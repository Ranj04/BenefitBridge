import './global.css';
import { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { api } from './src/api';
import type { ChatResponse, FilledApplication, AdversarialResult } from './src/types';
import { ResultCard } from './src/components/ResultCard';
import { VerificationConsole } from './src/components/VerificationConsole';
import { FilerPanel } from './src/components/FilerPanel';
import { LanguageSelector } from './src/components/LanguageSelector';
import { useVoiceInput } from './src/hooks/useVoiceInput';
import { useVoiceOutput } from './src/hooks/useVoiceOutput';
import { STRINGS, bcp47For, defaultLanguage, languageHint, type LangCode } from './src/i18n';
import offlineFixture from './fixtures/offline.json';

// Three one-click demo personas (Prompt 5 task 5).
const PERSONAS = [
  { key: 'p1', label: 'Single parent · $2,800/mo', text: "I'm a single mom in SF, I make about $2,800 a month, one kid, renting for $1,800" },
  { key: 'p2', label: 'Senior alone · $1,900/mo', text: "I'm 68, live alone in San Francisco on $1,900 a month social security, rent is $1,500" },
  { key: 'p3', label: 'Over threshold · $2,700/mo', text: 'Single, no kids, San Francisco, I earn $2,700 a month, not renting' },
] as const;

type Fixture = {
  personas: Record<string, ChatResponse>;
  filled: FilledApplication | null;
  adversarial: AdversarialResult | null;
};
const FIXTURE = offlineFixture as unknown as Fixture;

export default function App() {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chat, setChat] = useState<ChatResponse | null>(null);
  const [offline, setOffline] = useState(false);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [lang, setLang] = useState<LangCode>(defaultLanguage);
  const t = STRINGS[lang];

  // Voice is an input transform only: finalized speech appends to the SAME
  // editable field the user types into; the user reviews and hits Check.
  const voice = useVoiceInput({
    lang: bcp47For(lang),
    onFinal: (chunk) => setText((prev) => (prev.trim() ? `${prev.trim()} ${chunk}` : chunk)),
  });
  const tts = useVoiceOutput();

  const run = async (input: string, personaKey: string | null) => {
    setError(null);
    setChat(null);
    setConsoleOpen(false);
    tts.stop();
    if (offline) {
      // OFFLINE MODE: labeled replay of a committed REAL capture — never silent.
      setChat(FIXTURE.personas[personaKey ?? 'p1'] ?? FIXTURE.personas.p1 ?? null);
      return;
    }
    setBusy(true);
    try {
      setChat(await api.chat(input, languageHint(lang)));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView className="flex-1 bg-slate-100" edges={['top']}>
        <StatusBar style="light" />
        <View className="bg-brand-dark px-4 pb-4 pt-3">
          <View className="mx-auto w-full max-w-3xl">
            <View className="flex-row items-center justify-between">
              <Text className="text-xl font-extrabold text-white">BenefitBridge</Text>
              <Pressable
                className={`rounded-full border px-3 py-1 ${offline ? 'border-amber-300 bg-amber-400' : 'border-indigo-300'}`}
                onPress={() => setOffline((o) => !o)}
                accessibilityLabel="Toggle offline mode"
              >
                <Text className={`text-xs font-bold ${offline ? 'text-amber-950' : 'text-indigo-100'}`}>
                  {offline ? 'OFFLINE MODE ON' : 'Offline mode'}
                </Text>
              </Pressable>
            </View>
            <Text className="mt-1 text-xs text-indigo-200">
              Every figure below is an estimate, never a determination. The model does language; the math is deterministic code.
            </Text>
            <View className="mt-2">
              <LanguageSelector
                value={lang}
                onChange={(code) => {
                  tts.stop();
                  setLang(code);
                }}
              />
            </View>
          </View>
        </View>

        {offline && (
          <View className="bg-amber-400 px-4 py-1.5">
            <Text className="mx-auto w-full max-w-3xl text-center text-xs font-bold text-amber-950">
              OFFLINE — replaying a captured real result (recorded from the live system)
            </Text>
          </View>
        )}

        <ScrollView className="flex-1" contentContainerClassName="px-4 py-4">
          <View className="mx-auto w-full max-w-3xl">
            <Text className="text-sm font-semibold text-slate-700">{t.heading}</Text>
            <View className="mt-2 flex-row flex-wrap gap-2">
              {PERSONAS.map((p) => (
                <Pressable
                  key={p.key}
                  className="rounded-full border border-brand bg-white px-3 py-1.5"
                  onPress={() => {
                    setText(p.text);
                    void run(p.text, p.key);
                  }}
                  accessibilityLabel={`Try persona: ${p.label}`}
                >
                  <Text className="text-xs font-semibold text-brand-dark">{p.label}</Text>
                </Pressable>
              ))}
            </View>

            <View className="mt-3 flex-row items-end gap-2">
              {/* The text field is ALWAYS visible and authoritative — voice only populates it. */}
              <TextInput
                className="min-h-[48px] flex-1 rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900"
                multiline
                placeholder={t.placeholder}
                placeholderTextColor="#94a3b8"
                value={text}
                onChangeText={setText}
                accessibilityLabel="Describe your household"
              />
              {voice.supported && (
                <Pressable
                  className={`rounded-xl px-4 py-3 ${voice.listening ? 'bg-rose-600' : 'border border-brand bg-white'}`}
                  onPress={voice.toggle}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityLabel={voice.listening ? t.micStop : t.micStart}
                  accessibilityState={{ selected: voice.listening }}
                >
                  <Text className={`text-sm font-bold ${voice.listening ? 'text-white' : 'text-brand-dark'}`}>
                    {voice.listening ? '⏹' : '🎤'}
                  </Text>
                </Pressable>
              )}
              <Pressable
                className="rounded-xl bg-brand px-4 py-3"
                onPress={() => void run(text, null)}
                disabled={busy || !text.trim()}
                accessibilityRole="button"
                accessibilityLabel="Check my benefits"
              >
                <Text className="text-sm font-bold text-white">{t.check}</Text>
              </Pressable>
            </View>

            {/* ARIA live region: announces listening state + voice errors to screen readers. */}
            <View accessibilityLiveRegion="polite">
              {voice.listening && (
                <View className="mt-2 flex-row items-center gap-2 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2">
                  <View className="h-2.5 w-2.5 animate-pulse rounded-full bg-rose-600" />
                  <Text className="flex-1 text-xs font-semibold text-rose-700">{t.listening}</Text>
                </View>
              )}
              {voice.listening && !!voice.interim && (
                <Text className="mt-1 px-1 text-sm italic text-slate-500">{voice.interim}</Text>
              )}
              {voice.error && (
                <Text className="mt-2 text-xs text-amber-700">
                  {voice.error === 'denied' ? t.micDenied : voice.error === 'no-speech' ? t.micNoSpeech : voice.error === 'network' ? t.micNetwork : t.micUnavailable}
                </Text>
              )}
            </View>

            {busy && (
              <View className="mt-6 items-center">
                <ActivityIndicator size="large" color="#4f46e5" />
                <Text className="mt-2 text-xs text-slate-500">Reading your situation → running the deterministic screen…</Text>
              </View>
            )}
            {error && (
              <View className="mt-4 rounded-xl border border-rose-300 bg-rose-50 p-3">
                <Text className="text-xs text-rose-700">{error}</Text>
              </View>
            )}

            {chat?.needMoreInfo && (
              <View className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3">
                <Text className="text-sm font-bold text-amber-800">We need a bit more to screen honestly</Text>
                <Text className="mt-1 text-xs text-amber-900">
                  Missing: {chat.needMoreInfo.join(', ')}. We never invent a number — add your monthly income and household size and
                  we'll run the real screen.
                </Text>
              </View>
            )}

            {chat?.explanation && (
              <View className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                <View className="flex-row items-center justify-between">
                  <Text className="text-xs font-bold uppercase tracking-wide text-slate-500">What this means for you</Text>
                  {tts.supported && (
                    <Pressable
                      className={`rounded-full border px-3 py-1 ${tts.speaking ? 'border-rose-400 bg-rose-50' : 'border-brand bg-white'}`}
                      onPress={() =>
                        // Speaks the SAME disclaimered explanation shown above —
                        // never a bare figure restated as a guarantee.
                        tts.speaking ? tts.stop() : tts.speak(chat.explanation!, bcp47For(lang))
                      }
                      accessibilityRole="button"
                      accessibilityLabel={tts.speaking ? t.stopReading : t.readAloud}
                    >
                      <Text className={`text-xs font-bold ${tts.speaking ? 'text-rose-700' : 'text-brand-dark'}`}>
                        {tts.speaking ? `⏹ ${t.stopReading}` : `🔊 ${t.readAloud}`}
                      </Text>
                    </Pressable>
                  )}
                </View>
                <Text className="mt-1 text-sm leading-5 text-slate-800">{chat.explanation}</Text>
              </View>
            )}

            {chat?.results && (
              <View className="mt-4">
                {chat.results.map((r) => (
                  <ResultCard key={r.program} r={r} />
                ))}

                <Pressable
                  className="mb-3 self-start rounded-xl border border-slate-400 bg-white px-3 py-2"
                  onPress={() => setConsoleOpen((o) => !o)}
                  accessibilityLabel="Toggle verification console"
                >
                  <Text className="text-xs font-bold text-slate-700">{consoleOpen ? 'Hide' : 'Show'} the math — Verification Console</Text>
                </Pressable>

                {consoleOpen && chat.profile && (
                  <VerificationConsole
                    profile={chat.profile}
                    results={chat.results}
                    guard={chat.guard}
                    offline={offline}
                    offlineAdversarial={FIXTURE.adversarial}
                  />
                )}

                {chat.profile && chat.results.some((r) => r.program === 'CalFresh' && r.screening === 'likely_qualify') && (
                  <FilerPanel profile={chat.profile} offline={offline} offlineFilled={FIXTURE.filled} />
                )}
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
