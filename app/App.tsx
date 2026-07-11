import './global.css';
import { useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { Fraunces_600SemiBold, Fraunces_700Bold } from '@expo-google-fonts/fraunces';
import { AtkinsonHyperlegible_400Regular, AtkinsonHyperlegible_700Bold } from '@expo-google-fonts/atkinson-hyperlegible';
import { api } from './src/api';
import type { ChatResponse, FilledApplication, AdversarialResult } from './src/types';
import { useVoiceInput } from './src/hooks/useVoiceInput';
import { useVoiceOutput } from './src/hooks/useVoiceOutput';
import { STRINGS, bcp47For, defaultLanguage, languageHint, type LangCode } from './src/i18n';
import { T } from './src/theme/tokens';
import { WelcomeScreen } from './src/screens/WelcomeScreen';
import { IntakeScreen } from './src/screens/IntakeScreen';
import { ResultsScreen } from './src/screens/ResultsScreen';
import type { Persona } from './src/components/SeedPersonaChips';
import offlineFixture from './fixtures/offline.json';

// Three one-click demo personas (Prompt 5 task 5).
const PERSONAS: readonly Persona[] = [
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

type Screen = 'welcome' | 'intake' | 'results';

export default function App() {
  const [fontsLoaded] = useFonts({
    Fraunces_600SemiBold,
    Fraunces_700Bold,
    AtkinsonHyperlegible_400Regular,
    AtkinsonHyperlegible_700Bold,
  });

  const [screen, setScreen] = useState<Screen>('welcome');
  const [text, setText] = useState('');
  const [lastRun, setLastRun] = useState<{ input: string; personaKey: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chat, setChat] = useState<ChatResponse | null>(null);
  const [offline, setOffline] = useState(false);
  const [lang, setLang] = useState<LangCode>(defaultLanguage);
  const t = STRINGS[lang];

  // Voice is an input transform only: finalized speech appends to the SAME
  // editable field the user types into; the user reviews and submits.
  const voice = useVoiceInput({
    lang: bcp47For(lang),
    onFinal: (chunk) => setText((prev) => (prev.trim() ? `${prev.trim()} ${chunk}` : chunk)),
  });
  const tts = useVoiceOutput();

  const run = async (input: string, personaKey: string | null) => {
    setError(null);
    setChat(null);
    setLastRun({ input, personaKey });
    setScreen('results');
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

  const pickPersona = (p: Persona) => {
    setText(p.text);
    void run(p.text, p.key);
  };

  if (!fontsLoaded) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: T.bg }}>
        <ActivityIndicator size="large" color={T.pine} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView className="flex-1 bg-hearth" edges={['top']}>
        <StatusBar style="dark" />

        {/* Warm, quiet header — brand only; the trust talk lives in the screens. */}
        <View className="border-b border-fog bg-hearth px-5 py-2">
          <View className="mx-auto w-full max-w-2xl flex-row items-center justify-between">
            {screen === 'welcome' ? (
              <View />
            ) : (
              <View className="flex-row items-center gap-2">
                <View className="h-2.5 w-2.5 rounded-full bg-glow" />
                <Text className="font-display text-body text-ink">BenefitBridge</Text>
              </View>
            )}
            <Pressable
              className={`min-h-[48px] justify-center rounded-full border px-3 ${offline ? 'border-ember bg-ember-soft' : 'border-fog bg-hearth-surface'}`}
              onPress={() => setOffline((o) => !o)}
              accessibilityRole="button"
              accessibilityLabel="Toggle offline demo mode"
              accessibilityState={{ selected: offline }}
            >
              <Text className={`font-bodybold text-caption ${offline ? 'text-ember-text' : 'text-ink-muted'}`}>
                {offline ? 'Offline demo: on' : 'Offline demo'}
              </Text>
            </Pressable>
          </View>
        </View>

        {offline ? (
          <View className="border-b border-ember bg-ember-soft px-5 py-2">
            <Text className="mx-auto w-full max-w-2xl text-center font-bodybold text-caption text-ember-text">
              Offline — replaying a captured real result (recorded from the live system)
            </Text>
          </View>
        ) : null}

        <ScrollView className="flex-1" contentContainerClassName="flex-grow">
          {screen === 'welcome' ? (
            <WelcomeScreen
              t={t}
              lang={lang}
              onChangeLang={(code) => {
                tts.stop();
                setLang(code);
              }}
              onStart={() => setScreen('intake')}
              personas={PERSONAS}
              onPersona={pickPersona}
            />
          ) : screen === 'intake' ? (
            <IntakeScreen
              t={t}
              lang={lang}
              onChangeLang={(code) => {
                tts.stop();
                setLang(code);
              }}
              text={text}
              onChangeText={setText}
              onSubmit={() => void run(text, null)}
              voice={voice}
              busy={busy}
              onBack={() => setScreen('welcome')}
              personas={PERSONAS}
              onPersona={pickPersona}
            />
          ) : (
            <ResultsScreen
              t={t}
              lang={lang}
              chat={chat}
              busy={busy}
              error={error}
              offline={offline}
              offlineAdversarial={FIXTURE.adversarial}
              offlineFilled={FIXTURE.filled}
              tts={tts}
              onRetry={() => lastRun && void run(lastRun.input, lastRun.personaKey)}
              onEdit={() => {
                tts.stop();
                setScreen('intake');
              }}
              onStartOver={() => {
                tts.stop();
                setText('');
                setChat(null);
                setError(null);
                setScreen('welcome');
              }}
            />
          )}
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
