import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

/**
 * True when the user asked the OS/browser to reduce motion. The hearth-glow
 * reveal (and any other animation) must render its static fallback then.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && 'matchMedia' in window) {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    return false;
  });

  useEffect(() => {
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined' || !('matchMedia' in window)) return;
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
      // Older WebKit (Safari < 14) has no add/removeEventListener on
      // MediaQueryList — feature-detect and fall back to the legacy API.
      if (typeof mq.addEventListener === 'function') {
        mq.addEventListener('change', onChange);
        return () => mq.removeEventListener('change', onChange);
      }
      mq.addListener(onChange);
      return () => mq.removeListener(onChange);
    }
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((v) => mounted && setReduced(v));
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  return reduced;
}
