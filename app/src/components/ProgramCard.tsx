import { useState } from 'react';
import { View, Text, Pressable, Linking } from 'react-native';
import type { ScreeningResult } from '../types';
import type { Strings } from '../i18n';
import { amountLabel } from '../lib/derive';
import { cardShadow } from '../theme/shadow';
import { StatusPill } from './StatusPill';
import { CitationLink } from './CitationLink';

const PILL_KEY: Record<ScreeningResult['screening'], keyof Pick<Strings, 'pillLikely' | 'pillMoreInfo' | 'pillUnlikely'>> = {
  likely_qualify: 'pillLikely',
  need_more_info: 'pillMoreInfo',
  unlikely: 'pillUnlikely',
};

/** One benefit program: status, estimate with its period, the plain "why",
 * and an expandable detail with sources + how to apply. */
export function ProgramCard({ r, t }: { r: ScreeningResult; t: Strings }) {
  const [open, setOpen] = useState(false);
  const b = r.estimatedBenefit;
  const annual = b?.period === 'annual';

  return (
    <View className="mb-4 rounded-card bg-hearth-surface p-5" style={cardShadow}>
      <View className="flex-row flex-wrap items-center justify-between gap-2">
        <Text className="font-display text-h3 text-ink" accessibilityRole="header">
          {r.program}
        </Text>
        <StatusPill screening={r.screening} label={t[PILL_KEY[r.screening]]} />
      </View>

      {b ? (
        <View className="mt-3 flex-row flex-wrap items-baseline gap-x-2">
          <Text className="font-displaybold text-h1 text-ink">{amountLabel(b)}</Text>
          <Text className="font-bodybold text-body text-ink-muted">
            {b.period === 'monthly' ? t.perMonthLabel : b.period === 'annual' ? t.perYearLabel : 'one-time'}
          </Text>
        </View>
      ) : null}
      {annual ? (
        <View className="mt-2 self-start rounded-full border border-ember bg-ember-soft px-3 py-1.5">
          <Text className="font-bodybold text-caption text-ember-text">Annual tax credit — one payment at tax time, not monthly</Text>
        </View>
      ) : null}

      <Text className="mt-3 font-body text-body leading-6 text-ink">{r.reason}</Text>
      {b ? <Text className="mt-2 font-body text-caption text-ink-muted">{t.estimateNote}</Text> : null}

      <Pressable
        className="mt-2 min-h-[48px] flex-row items-center gap-1 self-start"
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityLabel={`${open ? 'Hide' : 'Show'} sources and next steps for ${r.program}`}
        accessibilityState={{ expanded: open }}
      >
        <Text className="font-bodybold text-caption text-pine">{open ? 'Hide sources & next steps' : 'Sources & next steps'}</Text>
        <Text className="font-bodybold text-caption text-pine" importantForAccessibility="no">
          {open ? '▴' : '▾'}
        </Text>
      </Pressable>

      {open ? (
        <View className="mt-1 border-t border-fog pt-3">
          {r.citations.map((c) => (
            <CitationLink key={c.source_url + c.text} citation={c} />
          ))}
          {r.screening === 'likely_qualify' && r.applyUrl ? (
            <Pressable
              className="mt-2 min-h-[48px] items-center justify-center self-start rounded-full border-2 border-pine px-5"
              onPress={() => Linking.openURL(r.applyUrl)}
              accessibilityRole="link"
              accessibilityLabel={`How to apply for ${r.program}`}
            >
              <Text className="font-bodybold text-body text-pine">How to apply →</Text>
            </Pressable>
          ) : null}
          <Text className="mt-3 font-body text-caption italic leading-5 text-ink-muted">{r.disclaimer}</Text>
        </View>
      ) : null}
    </View>
  );
}
