# BenefitBridge — Claude Code Prompt · Live Data Layer (Prompt 3.5)

> Run AFTER Prompt 1 (backend spine). Integrates the drop-in `src/data/*` files (already added to the repo) so FPL comes **live from the official HHS ASPE API**, program thresholds derive from it, and every number carries **version + provenance** — killing the "you're just a scraper = Google AI" critique.

---

## CONTEXT (say this back to the judges too)

The critique was: *scrape a page + let an LLM read it = undifferentiated (Google AI search).* We don't do that. The LLM never reads a page to produce a number. We pull the **FPL basis live from the government's own structured API** (HHS ASPE Poverty Guidelines API), derive program thresholds deterministically, and store every value **versioned + provenance-stamped**. Freshness lives in a validated sync pipeline; the intelligence lives in the deterministic engine. That's a data pipeline, not a scraper.

## STANDING RULES (inherit)

Feature branch `feat/live-data-layer`. State-aware first (read the existing repo before changing anything; reconcile import extensions with the repo's module setting — the drop-in files use ESM `.js` import specifiers). Fastify v4, `tsx`, native fetch, vitest. **Integer cents / bigint** on money. **No invented numbers** — every constant traces to a source with `source_url` + `as_of`. Adversarial VERIFY GATEs. Surgical. Stop and report at each gate.

## FILES ALREADY IN THE REPO (don't recreate — integrate)

`src/data/povertyGuidelines.ts` (live ASPE client) · `src/data/fplRules.ts` (deterministic FPL→monthly derivation) · `src/data/constantsStore.ts` (versioned, provenance-stamped store) · `src/data/sync.ts` (validated sync job) · `src/data/provenance.ts`.

---

## TASKS

**T1 — Populate the store live.** Run `tsx src/data/sync.ts 2026`; confirm it writes `data/constants.json` with FPL entries for sizes 1–8, each carrying provenance (source_url, as_of, fetched_at, checksum) and a store `version`. → *verify: the file exists, values are plausible, provenance present.*

**T2 — Wire programs to the live FPL.** Replace hardcoded/scraped thresholds:
- **Medi-Cal (138%), CARE (200%), LifeLine (150%):** compute the monthly income limit from the live FPL via `deriveMonthlyLimitCents(annualFpl, pctBasisPoints)`. Fully live, no hardcoding.
- **CalFresh:** keep the OFFICIAL published CDSS monthly gross/net chart as the authoritative limits (with provenance = CDSS), AND add a **cross-check** that compares each published limit against the ASPE-derived value; if they diverge by more than $2, surface a flag (log + a `driftWarnings[]` on the sync result). The published chart wins; the cross-check proves freshness and catches a stale chart.
- Read all values through `constantsStore.getNumber()` so the engine depends on the versioned store, not literals.

**T3 — Provenance into the result.** Extend each `ScreeningResult` so its `citations`/`computation` carry the store `version` and the FPL provenance (source_url + as_of + fetched_at) for the thresholds used. This is what the Verification Console displays: "FPL pulled live from HHS ASPE API, v{N}, fetched {timestamp}."

**T4 — Runtime freshness + honest fallback.** On server start (and via a `POST /sync` route), run `syncPovertyGuidelines`; cache the store in memory with a TTL. If ASPE is unreachable, fall back to the **last-good versioned store** (which was itself fetched live) and mark responses with a `data_freshness: 'cached'` flag + the `fetched_at` of that version. Never silently present stale data as live; never hardcode a fallback number.

**T5 — Adversarial vitest (`data/*.test.ts`).** Mock `fetch`:
- Happy: valid ASPE JSON → store populated, provenance stamped.
- Garbage: `poverty_threshold` missing / non-numeric → throws, store NOT updated.
- Implausible: FPL(1) = $2 or non-increasing across sizes → `validateFpl` throws.
- Network error / timeout → falls back to last-good store, flagged `cached`.
- Derivation: `deriveMonthlyLimitCents` for CalFresh 200%/100% matches the verified published chart within $2 (anchor test); if not, the drift flag fires.
- `>8` extrapolation uses the live (7,8) increment.
- Provenance checksum changes when the value changes (drift detection).

---

## VERIFY GATES

- **Gate A (live):** `tsx src/data/sync.ts 2026` populates the store from the real ASPE API; `data/constants.json` shows real 2026 FPL with provenance. Report the FPL(1) value + version.
- **Gate B (derivation):** vitest green; CalFresh derived limits cross-check against the published chart within tolerance; drift flag proven to fire on a deliberately-wrong constant.
- **Gate C (resilience):** with `fetch` mocked to fail, a screen still returns using the last-good store, flagged `cached` — not a hardcoded number, not a crash.
- **Gate D (provenance surfaced):** a real `/screen` response carries the store version + FPL source_url + fetched_at, ready for the Verification Console.

## FINAL REPORT

The live FPL(1) 2026 value + store version; which programs now derive live vs. use published-with-cross-check; any drift flags; and the one-line demo claim to show on stage: *"FPL pulled live from the HHS ASPE API — here's the source, the version, and the timestamp. We don't scrape and summarize; we pull structured official data into a deterministic engine and compute a provable number."*

Do not touch the Gradient graph, the filer, or the frontend. Stop after the report.
