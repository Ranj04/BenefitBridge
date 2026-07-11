// src/data/constantsStore.ts
// A versioned, provenance-stamped store for program constants.
// The engine reads from THIS (validated, versioned) store — never from a live scrape
// at request time. Freshness comes from the sync job (sync.ts); correctness/traceability
// come from the version + provenance on every entry.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { Provenance } from "./provenance.ts";

export type ConstantEntry = {
  key: string;
  value: number | string;
  provenance: Provenance;
};

export type ConstantsStore = {
  version: number; // bumps on every successful sync
  generated_at: string; // ISO timestamp of this version
  entries: Record<string, ConstantEntry>;
};

export async function loadStore(path: string): Promise<ConstantsStore | null> {
  try {
    const raw = await readFile(path, "utf8");
    return JSON.parse(raw) as ConstantsStore;
  } catch {
    return null; // no store yet (or unreadable) — caller decides what to do
  }
}

export async function saveStore(path: string, store: ConstantsStore): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(store, null, 2), "utf8");
}

export function getEntry(store: ConstantsStore, key: string): ConstantEntry {
  const e = store.entries[key];
  if (!e) throw new Error(`constant not found in store (v${store.version}): ${key}`);
  return e;
}

/** Convenience: numeric value + its provenance, or throw if missing/non-numeric. */
export function getNumber(store: ConstantsStore, key: string): { value: number; provenance: Provenance } {
  const e = getEntry(store, key);
  if (typeof e.value !== "number") throw new Error(`constant ${key} is not numeric`);
  return { value: e.value, provenance: e.provenance };
}

/** Diff two stores so a sync can report exactly which numbers changed. */
export function diffStores(
  prev: ConstantsStore | null,
  next: ConstantsStore
): { key: string; from: unknown; to: unknown }[] {
  const changes: { key: string; from: unknown; to: unknown }[] = [];
  const prevEntries = prev?.entries ?? {};
  for (const [key, entry] of Object.entries(next.entries)) {
    const before = prevEntries[key]?.value;
    if (before !== entry.value) changes.push({ key, from: before ?? null, to: entry.value });
  }
  return changes;
}
