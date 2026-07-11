import { useEffect, useRef } from 'react';
import { Animated, Easing, View, Text } from 'react-native';
import type { Strings } from '../i18n';
import type { HeroTotals } from '../lib/derive';
import { fmtUsd } from '../lib/derive';
import { glowShadow } from '../theme/shadow';
import { useReducedMotion } from '../theme/useReducedMotion';

/**
 * The hearth-glow: the one bold moment in the app. Hidden money comes to
 * light — the amount eases up out of the dark pine panel while a gold glow
 * blooms behind it. Dark ink sits on gold (5.81:1); gold is never used as
 * text. Under prefers-reduced-motion everything renders in its final, lit
 * state with no animation.
 *
 * NB: className must not land on Animated.View (NativeWind doesn't interop
 * it) — animated containers use inline styles; plain Views carry the theme.
 */
export function HeroAmount({ totals, t }: { totals: HeroTotals; t: Strings }) {
  const reduced = useReducedMotion();
  const rise = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  const bloom = useRef(new Animated.Value(reduced ? 1 : 0)).current;

  useEffect(() => {
    if (reduced) {
      rise.setValue(1);
      bloom.setValue(1);
      return;
    }
    Animated.sequence([
      Animated.delay(200),
      Animated.parallel([
        Animated.timing(rise, { toValue: 1, duration: 750, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
        Animated.timing(bloom, { toValue: 1, duration: 1100, easing: Easing.out(Easing.quad), useNativeDriver: false }),
      ]),
    ]).start();
  }, [reduced, rise, bloom]);

  const monthly = totals.monthly > 0 ? fmtUsd(totals.monthly) : null;
  const annual = totals.annual > 0 ? fmtUsd(totals.annual) : null;
  const sentence = t.heroLine(monthly, annual);
  const big = monthly ?? annual;
  const bigLabel = monthly ? t.perMonthLabel : t.perYearLabel;

  return (
    <View accessibilityRole="header" accessibilityLabel={sentence}>
      {/* One card, two hearths: quiet pine above, lit gold below. */}
      <Animated.View
        style={[
          glowShadow,
          {
            borderRadius: 24,
            overflow: 'hidden',
            opacity: rise,
            transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
          },
        ]}
      >
        <View className="bg-pine-deep px-6 pb-5 pt-6">
          <Text className="text-center font-bodybold text-caption uppercase tracking-widest text-glow-soft" importantForAccessibility="no">
            {t.heroKicker}
          </Text>
        </View>
        <Animated.View style={{ opacity: bloom }}>
          <View className="items-center bg-glow px-6 py-7">
            {big ? (
              <>
                <Text className="text-center font-displaybold text-display text-ink" importantForAccessibility="no">
                  {big}
                </Text>
                <Text className="mt-1 text-center font-bodybold text-bodylg text-glow-ink" importantForAccessibility="no">
                  {bigLabel}
                </Text>
                {monthly && annual ? (
                  <Text className="mt-3 text-center font-display text-h3 text-ink" importantForAccessibility="no">
                    {t.plusAnnualLine(annual)}
                  </Text>
                ) : null}
              </>
            ) : (
              <Text className="text-center font-display text-h2 text-ink" importantForAccessibility="no">
                {sentence}
              </Text>
            )}
          </View>
        </Animated.View>
      </Animated.View>
    </View>
  );
}
