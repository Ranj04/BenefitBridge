import { View, Text, Linking, Pressable } from 'react-native';
import type { ScreeningResult } from '../types';

const SCREENING_STYLE: Record<ScreeningResult['screening'], { label: string; badge: string; text: string }> = {
  likely_qualify: { label: 'Likely qualifies', badge: 'bg-accent-light border-accent', text: 'text-accent' },
  need_more_info: { label: 'Need more info', badge: 'bg-amber-50 border-amber-400', text: 'text-amber-700' },
  unlikely: { label: 'Unlikely', badge: 'bg-slate-100 border-slate-300', text: 'text-slate-500' },
};

function amountText(b: NonNullable<ScreeningResult['estimatedBenefit']>): string {
  const amt = typeof b.amount === 'number' ? `$${b.amount.toLocaleString()}` : `$${b.amount.low.toLocaleString()}–$${b.amount.high.toLocaleString()}`;
  return amt;
}

export function ResultCard({ r }: { r: ScreeningResult }) {
  const s = SCREENING_STYLE[r.screening];
  const isAnnual = r.estimatedBenefit?.period === 'annual';
  return (
    <View className={`rounded-2xl border bg-white p-4 mb-3 ${isAnnual && r.screening === 'likely_qualify' ? 'border-annual' : 'border-slate-200'}`}>
      <View className="flex-row items-center justify-between">
        <Text className="text-base font-bold text-slate-900">{r.program}</Text>
        <View className={`rounded-full border px-3 py-0.5 ${s.badge}`}>
          <Text className={`text-xs font-semibold ${s.text}`}>{s.label}</Text>
        </View>
      </View>

      {r.estimatedBenefit ? (
        <View className={`mt-3 rounded-xl p-3 ${isAnnual ? 'bg-annual-light' : 'bg-brand-light'}`}>
          <Text className={`text-2xl font-extrabold ${isAnnual ? 'text-annual' : 'text-brand-dark'}`}>
            {amountText(r.estimatedBenefit)}
            <Text className="text-sm font-semibold">
              {'  '}
              {r.estimatedBenefit.period === 'monthly' ? 'per month' : r.estimatedBenefit.period === 'annual' ? 'PER YEAR — one lump sum at tax filing' : 'one-time'}
            </Text>
          </Text>
          {isAnnual && <Text className="mt-1 text-xs font-semibold text-annual">Annual tax credit — not a monthly benefit</Text>}
        </View>
      ) : null}

      <Text className="mt-2 text-sm leading-5 text-slate-700">{r.reason}</Text>

      <View className="mt-2">
        {r.citations.map((c) => (
          <Pressable key={c.source_url + c.text} onPress={() => Linking.openURL(c.source_url)}>
            <Text className="text-xs text-brand underline" numberOfLines={1}>
              {c.text} (as of {c.as_of})
            </Text>
          </Pressable>
        ))}
      </View>

      {r.screening === 'likely_qualify' && (
        <Pressable className="mt-2" onPress={() => Linking.openURL(r.applyUrl)}>
          <Text className="text-xs font-semibold text-accent underline">How to apply →</Text>
        </Pressable>
      )}

      <Text className="mt-2 text-[11px] italic text-slate-400">{r.disclaimer}</Text>
    </View>
  );
}
