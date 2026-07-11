// src/data/runtime.ts
// Runtime freshness with an honest fallback (Prompt 3.5 T4).
// On demand (server start, TTL expiry, POST /sync) we re-sync from the live
// ASPE API. If the API is unreachable we fall back to the LAST-GOOD versioned
// store on disk — itself fetched live earlier — and flag responses 'cached'
// with that version's fetched_at. Never a hardcoded fallback number, never
// stale data silently presented as live, never a crash.

import { syncPovertyGuidelines, type DriftWarning } from "./sync.ts";
import { loadStore, getNumber, type ConstantsStore } from "./constantsStore.ts";
import type { Provenance } from "./provenance.ts";

export type DataContext = {
  store: ConstantsStore;
  freshness: "live" | "cached";
  driftWarnings: DriftWarning[];
};

const DEFAULT_TTL_MS = 6 * 60 * 60 * 1000; // re-sync at most every 6h
let cache: { ctx: DataContext; at: number } | null = null;

export function resetDataCache(): void {
  cache = null;
}

/**
 * Returns the current data context, syncing live when the TTL has lapsed.
 * Returns null only when there is no live API AND no last-good store — the
 * engine then runs on its published-chart constants with no FPL citation.
 */
export async function ensureDataContext(opts?: {
  storePath?: string;
  year?: number;
  ttlMs?: number;
  force?: boolean;
}): Promise<DataContext | null> {
  const storePath = opts?.storePath ?? "data/constants.json";
  const year = opts?.year ?? new Date().getFullYear();
  const ttl = opts?.ttlMs ?? DEFAULT_TTL_MS;

  if (!opts?.force && cache && Date.now() - cache.at < ttl) return cache.ctx;

  try {
    const { store, driftWarnings } = await syncPovertyGuidelines({ year, storePath });
    cache = { ctx: { store, freshness: "live", driftWarnings }, at: Date.now() };
  } catch (err) {
    const store = await loadStore(storePath);
    if (!store) {
      console.error("[data] live sync failed and no last-good store exists:", (err as Error).message);
      return null;
    }
    console.warn(`[data] live sync failed (${(err as Error).message}) — serving last-good store v${store.version}, flagged 'cached'`);
    cache = { ctx: { store, freshness: "cached", driftWarnings: [] }, at: Date.now() };
  }
  return cache.ctx;
}

/** FPL basis for the FPL-percentage programs (Medi-Cal, CARE, LifeLine). */
export function getFplBasis(ctx: DataContext, year = new Date().getFullYear()) {
  try {
    const annual: Record<number, number> = {};
    let provenance: Provenance | null = null;
    for (let hh = 1; hh <= 8; hh++) {
      const e = getNumber(ctx.store, `fpl.annual.${year}.us.hh${hh}`);
      annual[hh] = e.value;
      if (hh === 1) provenance = e.provenance;
    }
    return {
      year,
      annualUsdFor: (hh: number) =>
        hh <= 8 ? annual[Math.max(1, hh)] : annual[8] + (annual[8] - annual[7]) * (hh - 8),
      provenance: provenance!,
    };
  } catch {
    return null;
  }
}

/** The slice of data context the engine embeds into a ScreeningResult. */
export type ScreenDataContext = {
  version: number;
  freshness: "live" | "cached";
  fplProvenance: Provenance;
};

export function toScreenContext(ctx: DataContext, year = new Date().getFullYear()): ScreenDataContext | null {
  try {
    const { provenance } = getNumber(ctx.store, `fpl.annual.${year}.us.hh1`);
    return { version: ctx.store.version, freshness: ctx.freshness, fplProvenance: provenance };
  } catch {
    return null;
  }
}
