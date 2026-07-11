import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import type { ChatResponse, FilledApplication, AdversarialResult } from '../types';
import type { Strings, LangCode } from '../i18n';
import { bcp47For } from '../i18n';
import type { useVoiceOutput } from '../hooks/useVoiceOutput';
import { heroTotals, cascadeFrom } from '../lib/derive';
import { cardShadow } from '../theme/shadow';
import { HeroAmount } from '../components/HeroAmount';
import { ProgramCard } from '../components/ProgramCard';
import { CascadeList } from '../components/CascadeList';
import { VerificationPanel } from '../components/VerificationPanel';
import { ExplanationText } from '../components/ExplanationText';
import { FilerPanel } from '../components/FilerPanel';
import { DisclaimerNote } from '../components/DisclaimerNote';
import { ResultsSkeleton, ErrorState, EmptyState } from '../components/States';

const ORDER: Record<string, number> = { likely_qualify: 0, need_more_info: 1, unlikely: 2 };

/**
 * The payoff: the hearth-glow amount, the per-program cards, the categorical
 * cascade, and the full "see how we know" trust panel — celebratory but
 * honest; every figure stays an estimate.
 */
export function ResultsScreen({
  t,
  lang,
  chat,
  busy,
  error,
  offline,
  offlineAdversarial,
  offlineFilled,
  tts,
  onRetry,
  onEdit,
  onStartOver,
}: {
  t: Strings;
  lang: LangCode;
  chat: ChatResponse | null;
  busy: boolean;
  error: string | null;
  offline: boolean;
  offlineAdversarial: AdversarialResult | null;
  offlineFilled: FilledApplication | null;
  tts: ReturnType<typeof useVoiceOutput>;
  onRetry: () => void;
  onEdit: () => void;
  onStartOver: () => void;
}) {
  const [verifyOpen, setVerifyOpen] = useState(false);

  return (
    <View className="w-full max-w-2xl self-center px-5 pb-16 pt-4">
      <View className="flex-row items-center justify-between">
        <Pressable className="min-h-[48px] justify-center pr-4" onPress={onEdit} accessibilityRole="button" accessibilityLabel={t.editAnswers}>
          <Text className="font-bodybold text-body text-pine">← {t.editAnswers}</Text>
        </Pressable>
        <Pressable className="min-h-[48px] justify-center" onPress={onStartOver} accessibilityRole="button" accessibilityLabel={t.startOver}>
          <Text className="font-bodybold text-body text-ink-muted">{t.startOver}</Text>
        </Pressable>
      </View>

      {busy ? (
        <View className="mt-6">
          <ResultsSkeleton message={t.checking} />
        </View>
      ) : error ? (
        <View className="mt-6">
          <ErrorState
            message="We couldn’t reach the benefits data just now."
            detail={`Your information is safe — nothing was lost. (${error})`}
            retryLabel="Try again"
            onRetry={onRetry}
          />
        </View>
      ) : chat?.needMoreInfo ? (
        <View className="mt-6 rounded-card bg-hearth-surface p-6" style={cardShadow}>
          <Text className="font-display text-h3 text-ink" accessibilityRole="header">
            We need a bit more to screen honestly
          </Text>
          <Text className="mt-2 font-body text-body leading-6 text-ink">
            We never invent a number. Still missing: <Text className="font-bodybold">{chat.needMoreInfo.join(', ')}</Text>. Add that and
            we’ll run the real math.
          </Text>
          <Pressable
            className="mt-4 min-h-[48px] items-center justify-center self-start rounded-full bg-pine px-6"
            onPress={onEdit}
            accessibilityRole="button"
            accessibilityLabel={t.editAnswers}
          >
            <Text className="font-bodybold text-body text-white">{t.editAnswers}</Text>
          </Pressable>
        </View>
      ) : chat?.results ? (
        <ResultsBody
          t={t}
          lang={lang}
          chat={chat}
          offline={offline}
          offlineAdversarial={offlineAdversarial}
          offlineFilled={offlineFilled}
          tts={tts}
          verifyOpen={verifyOpen}
          setVerifyOpen={setVerifyOpen}
          onEdit={onEdit}
        />
      ) : (
        <View className="mt-6">
          <EmptyState title="Nothing here yet" body={t.intakeHint} actionLabel={t.editAnswers} onAction={onEdit} />
        </View>
      )}
    </View>
  );
}

function ResultsBody({
  t,
  lang,
  chat,
  offline,
  offlineAdversarial,
  offlineFilled,
  tts,
  verifyOpen,
  setVerifyOpen,
  onEdit,
}: {
  t: Strings;
  lang: LangCode;
  chat: ChatResponse;
  offline: boolean;
  offlineAdversarial: AdversarialResult | null;
  offlineFilled: FilledApplication | null;
  tts: ReturnType<typeof useVoiceOutput>;
  verifyOpen: boolean;
  setVerifyOpen: (fn: (o: boolean) => boolean) => void;
  onEdit: () => void;
}) {
  const results = chat.results!;
  const totals = heroTotals(results);
  const cascade = cascadeFrom(results);
  const sorted = [...results].sort((a, b) => ORDER[a.screening] - ORDER[b.screening]);
  const calfreshLikely = chat.profile && results.some((r) => r.program === 'CalFresh' && r.screening === 'likely_qualify');

  return (
    <View className="mt-6">
      <Text className="font-display text-h2 text-ink" accessibilityRole="header">
        {t.resultsTitle}
      </Text>

      <View className="mt-4">
        {totals.likelyCount > 0 ? (
          <HeroAmount totals={totals} t={t} />
        ) : (
          <EmptyState
            title="No likely match from what you told us"
            body="That can change with one detail — rent, childcare, or medical costs often tip the math. Add anything you left out and we’ll run it again."
            actionLabel={t.editAnswers}
            onAction={onEdit}
          />
        )}
      </View>

      {totals.likelyCount > 0 ? (
        <View className="mt-4">
          <DisclaimerNote>{t.estimateNote}</DisclaimerNote>
        </View>
      ) : null}

      {chat.explanation ? (
        <View className="mt-6 rounded-card bg-hearth-surface p-5" style={cardShadow}>
          <View className="flex-row flex-wrap items-center justify-between gap-2">
            <Text className="font-display text-h3 text-ink" accessibilityRole="header">
              What this means for you
            </Text>
            {tts.supported ? (
              <Pressable
                className={`min-h-[48px] items-center justify-center rounded-full border-2 px-4 ${tts.speaking ? 'border-ember bg-ember-soft' : 'border-pine bg-hearth-surface'}`}
                onPress={() => (tts.speaking ? tts.stop() : tts.speak(chat.explanation!, bcp47For(lang)))}
                accessibilityRole="button"
                accessibilityLabel={tts.speaking ? t.stopReading : t.readAloud}
              >
                <Text className={`font-bodybold text-caption ${tts.speaking ? 'text-ember-text' : 'text-pine'}`}>
                  {tts.speaking ? `■ ${t.stopReading}` : `🔊 ${t.readAloud}`}
                </Text>
              </Pressable>
            ) : null}
          </View>
          <View className="mt-2">
            <ExplanationText text={chat.explanation} />
          </View>
        </View>
      ) : null}

      {cascade ? (
        <View className="mt-6">
          <CascadeList root={cascade.root} unlocked={cascade.unlocked} />
        </View>
      ) : null}

      <View className="mt-2">
        {sorted.map((r) => (
          <ProgramCard key={r.program} r={r} t={t} />
        ))}
      </View>

      <Pressable
        className="mb-4 mt-2 min-h-[48px] flex-row items-center justify-center gap-2 self-start rounded-full border-2 border-fog bg-hearth-surface px-5"
        onPress={() => setVerifyOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityLabel={`${verifyOpen ? 'Hide' : 'Show'} how we know — the full verification panel`}
        accessibilityState={{ expanded: verifyOpen }}
      >
        <Text className="font-bodybold text-body text-ink">{verifyOpen ? 'Hide how we know ▴' : 'See how we know ▾'}</Text>
      </Pressable>

      {verifyOpen && chat.profile ? (
        <VerificationPanel
          profile={chat.profile}
          results={results}
          guard={chat.guard}
          offline={offline}
          offlineAdversarial={offlineAdversarial}
        />
      ) : null}

      {calfreshLikely ? <FilerPanel profile={chat.profile!} offline={offline} offlineFilled={offlineFilled} /> : null}

      <DisclaimerNote className="mt-2">
        Benefit amounts are set by the office that handles your case — bring your questions to them, and treat everything here as a
        well-sourced head start, not a decision.
      </DisclaimerNote>
    </View>
  );
}
