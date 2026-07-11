// Opt-in, on-device-only persistence (save & resume). Platform adapter over
// localSession.core.ts:
//   native — expo-secure-store (iOS Keychain / Android Keystore, encrypted at rest)
//   web    — localStorage under one namespaced key (NOT encrypted; see core's
//            LIMITATION note — immigrationStatus is never written on web)
// There is deliberately no third backend and no network path here: saving and
// loading make zero server calls, keep it that way.
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import {
  SESSION_KEY,
  encodeSession,
  decodeSession,
  hasMeaningfulProgress,
  type SavedSession,
  type SessionInput,
} from './localSession.core';

type Backend = {
  get(): Promise<string | null>;
  set(value: string): Promise<void>;
  remove(): Promise<void>;
};

const isWeb = Platform.OS === 'web';

const webBackend: Backend = {
  // Feature-detected: private browsing / disabled storage degrades to "save unavailable", never a crash.
  async get() {
    try {
      return typeof localStorage !== 'undefined' ? localStorage.getItem(SESSION_KEY) : null;
    } catch {
      return null;
    }
  },
  async set(value) {
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(SESSION_KEY, value);
    } catch {
      // storage full or blocked — losing autosave must never break intake
    }
  },
  async remove() {
    try {
      if (typeof localStorage !== 'undefined') localStorage.removeItem(SESSION_KEY);
    } catch {
      // nothing to do — the key never existed if storage is blocked
    }
  },
};

const nativeBackend: Backend = {
  async get() {
    try {
      return await SecureStore.getItemAsync(SESSION_KEY);
    } catch {
      return null;
    }
  },
  async set(value) {
    try {
      await SecureStore.setItemAsync(SESSION_KEY, value);
    } catch {
      // Keystore unavailable (rare) — same rule as web: autosave failure is silent, intake continues
    }
  },
  async remove() {
    try {
      await SecureStore.deleteItemAsync(SESSION_KEY);
    } catch {
      // already gone
    }
  },
};

const backend: Backend = isWeb ? webBackend : nativeBackend;

/** Write the session. Caller gates this on the user's explicit opt-in. */
export async function saveSession(input: SessionInput): Promise<void> {
  await backend.set(encodeSession(input, new Date(), { excludeImmigrationStatus: isWeb }));
}

/**
 * Read the session. Expired (>7 days) or malformed blobs are wiped from the
 * store and reported as absent — a stale save on a shared device silently dies.
 */
export async function loadSession(): Promise<SavedSession | null> {
  const result = decodeSession(await backend.get(), new Date());
  if (!result.ok) {
    if (result.reason !== 'empty') await backend.remove();
    return null;
  }
  return result.session;
}

/** "Clear my information": delete the one namespaced key, immediately. */
export async function clearSession(): Promise<void> {
  await backend.remove();
}

export async function hasSession(): Promise<boolean> {
  return (await loadSession()) !== null;
}

export { hasMeaningfulProgress, type SavedSession };
