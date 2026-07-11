import { useEffect, useRef } from 'react';
import { Animated, Easing, View, Text, Pressable } from 'react-native';
import { cardShadow } from '../theme/shadow';
import { useReducedMotion } from '../theme/useReducedMotion';

/** Soft pulsing placeholder block; holds still under reduced motion.
 * The Animated.View is style-only (NativeWind can't class it); the sizing
 * classes ride on the plain outer View. */
export function Skeleton({ className = '' }: { className?: string }) {
  const reduced = useReducedMotion();
  const opacity = useRef(new Animated.Value(0.6)).current;
  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        Animated.timing(opacity, { toValue: 0.6, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduced, opacity]);
  return (
    <View className={`overflow-hidden rounded-card ${className}`}>
      <Animated.View style={{ width: '100%', height: '100%', backgroundColor: '#DAD6CA', opacity: reduced ? 0.7 : opacity }} />
    </View>
  );
}

/** Results are on their way: shaped like the page it becomes, plus a plain status line. */
export function ResultsSkeleton({ message }: { message: string }) {
  return (
    <View accessibilityLiveRegion="polite" accessibilityLabel={message}>
      <View className="items-center rounded-card bg-hearth-surface p-6" style={cardShadow}>
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-4 h-12 w-56" />
        <Skeleton className="mt-3 h-4 w-64" />
      </View>
      <Text className="mt-4 text-center font-body text-body text-ink-muted">{message}</Text>
      {[0, 1].map((i) => (
        <View key={i} className="mt-4 rounded-card bg-hearth-surface p-5" style={cardShadow}>
          <View className="flex-row items-center justify-between">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-7 w-28 rounded-full" />
          </View>
          <Skeleton className="mt-4 h-4 w-full" />
          <Skeleton className="mt-2 h-4 w-3/4" />
        </View>
      ))}
    </View>
  );
}

/** Something went wrong: direction, not apology — and the user's info is safe. */
export function ErrorState({ message, detail, retryLabel, onRetry }: { message: string; detail?: string; retryLabel?: string; onRetry?: () => void }) {
  return (
    <View className="rounded-card bg-hearth-surface p-6" style={cardShadow} accessibilityLiveRegion="assertive">
      <Text className="font-display text-h3 text-ink">{message}</Text>
      {detail ? <Text className="mt-2 font-body text-caption text-ink-muted">{detail}</Text> : null}
      {retryLabel && onRetry ? (
        <Pressable
          className="mt-4 min-h-[48px] items-center justify-center self-start rounded-full bg-pine px-6"
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel={retryLabel}
        >
          <Text className="font-bodybold text-body text-white">{retryLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Nothing to show yet — an invitation, not a dead end. */
export function EmptyState({ title, body, actionLabel, onAction }: { title: string; body: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <View className="items-center rounded-card border border-fog bg-hearth-surface p-8">
      <Text className="text-center font-display text-h3 text-ink">{title}</Text>
      <Text className="mt-2 max-w-md text-center font-body text-body text-ink-muted">{body}</Text>
      {actionLabel && onAction ? (
        <Pressable
          className="mt-5 min-h-[48px] items-center justify-center rounded-full bg-pine px-6"
          onPress={onAction}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
        >
          <Text className="font-bodybold text-body text-white">{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
