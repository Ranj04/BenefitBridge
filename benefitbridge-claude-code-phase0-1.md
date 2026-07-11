# BenefitBridge — Claude Code Master Prompt · Phase 0 + Phase 1 (backend spine)

> Paste this into Claude Code. It owns **Person B's half**: the deterministic screening engine and the `/screen` endpoint. Gradient agents/KBs (Person A) are wired to this later via the function route — out of scope here.

---

## ROLE & MISSION

You are building the backend spine of **BenefitBridge**, a benefits screener. Your job this session: a **deterministic CalFresh screening engine** (pure, tested functions) exposed at `POST /screen`, deployed to DigitalOcean App Platform. The LLM layer never touches this math — every screening decision and dollar figure is computed here in code.

Success = a real, adversarially-tested CalFresh screen running end-to-end behind a public URL, with zero invented numbers.

---

## NON-NEGOTIABLE WORKING RULES

1. **Feature branch.** Do all work on `feat/phase0-1-screen-engine`. Commit at each VERIFY GATE with a clear message. Never commit to main.
2. **State-aware first.** Before creating anything, inspect the current repo state (`git status`, `ls`, read existing files). Reconcile with what's already there — do not clobber or duplicate. If the repo already has partial work, adapt to it and report what you found.
3. **Stack, exactly.** TypeScript, Node, **Fastify v4 (never v5)**, `tsx` to run TS, **native `fetch` + `AbortController` (never axios)**, **vitest** for tests. `pg` only if a DB is needed — it is NOT needed this phase. No new deps beyond these without flagging why.
4. **Money is integer cents, pure bigint.** No floats in the eligibility math. Convert dollars→cents at the boundary; compute in `bigint`; format back only for output. Apply the real SNAP rounding rules (below).
5. **Deterministic logic in code, never an LLM.** No model calls anywhere in the engine.
6. **No invented numbers.** Constants I provide below are verified — use them. Any constant NOT provided (max allotments, deduction amounts, caps) must be pulled from the cited official CDSS source and stored with a `source_url` + `as_of`. If you cannot verify one, leave a clearly-marked `// TODO(VERIFY): <what> from <source>` and make the dependent test `.todo` — **never guess a number into shipping code.**
7. **Verification is ADVERSARIAL, not happy-path.** Test boundaries, over-threshold failures, the elderly/disabled path, missing inputs, and rounding — not just one passing case. A gate that only proves the happy path is a failed gate.
8. **Surgical.** Every changed line traces to a task below. No speculative abstractions, no config that wasn't asked for.
9. **Stop at every VERIFY GATE.** Run the checks, report pass/fail per check. Do not proceed past a red gate — fix or report and wait.

---

## PROVIDED REAL CONSTANTS (verified, FY2026 · Oct 1 2025 – Sep 30 2026)

CalFresh monthly income limits, California (BBCE, 200% FPL gross / 100% FPL net):

```
GROSS (200% FPL, monthly USD):  1:2610  2:3526  3:4442  4:5360  5:6276  6:7192  7:8110  (+918 each addl)
NET   (100% FPL, monthly USD):  1:1305  2:1763  3:2221  4:2680  5:3138  6:3596  7:4055  (+459 each addl)
```
Source: CDSS / USDA FNS FY2026 (`as_of: 2026-07-10`). Store these in `constants.ts` with source + as_of.

**Must pull + verify from official CDSS FFY2026 chart (do NOT invent):**
max monthly allotment by household size · standard deduction by household size · 20% earned-income deduction (rule, not a table) · excess-shelter cap (~$744, verify) · SUA utility standard · medical-deduction threshold (~$35 over, verify) · minimum benefit for 1–2 person households.

---

## CONTRACTS (create exactly, in `src/contracts.ts`)

```ts
export type HouseholdProfile = {
  householdSize: number;
  monthlyGrossIncome: number;      // USD, boundary layer only
  earnedIncome: number;            // USD portion that is earned (for 20% deduction)
  hasChildren: boolean;
  childrenAges?: number[];
  hasElderlyOrDisabled: boolean;
  isRenter: boolean;
  monthlyRent?: number;
  monthlyUtilities?: number;
  dependentCareCost?: number;
  medicalExpenses?: number;        // elderly/disabled only
  countyFips: string;              // "06075" = SF
  immigrationStatus?: 'citizen' | 'lpr' | 'other';
  preferredLanguage: string;
};

export type Citation = { text: string; source_url: string; as_of: string };

export type ScreeningResult = {
  program: string;                 // "CalFresh"
  screening: 'likely_qualify' | 'need_more_info' | 'unlikely';
  estimatedBenefit:
    | { amount: number | { low: number; high: number };
        period: 'monthly' | 'annual' | 'one_time' }
    | null;
  computation: { label: string; value: number }[];  // the full shown cascade, in USD
  assumptions: string[];
  reason: string;
  citations: Citation[];
  applyUrl: string;
  disclaimer: string;              // "Estimate, not a determination. Confirm with SF HSA."
};

// POST /screen  body: HouseholdProfile  →  ScreeningResult[]
```

---

## PHASE 0 — scaffold + contracts + endpoint skeleton

**Task 0.1 — Repo + branch.** Inspect existing state; create/continue the repo; create branch `feat/phase0-1-screen-engine`. Init TS + Fastify v4 + vitest + tsx. `src/contracts.ts` with the types above.

**Task 0.2 — `/screen` skeleton.** Fastify v4 server, `POST /screen` that validates the body against `HouseholdProfile` and returns a hardcoded placeholder `ScreeningResult[]` (clearly marked placeholder). Native fetch only; no axios.

**Task 0.3 — App Platform deploy spec.** Add a minimal `Dockerfile` (or `.do/app.yaml`) to run the service on App Platform, listening on `$PORT`. Do not deploy yet.

> **VERIFY GATE 0 (adversarial):**
> - `tsx` runs the server locally; `curl -XPOST /screen` with a valid body → 200 + placeholder JSON.
> - `curl` with a **malformed** body (missing `householdSize`) → 400, not a crash.
> - `curl` with `householdSize: -1` and with `householdSize: 0` → both rejected, not silently accepted.
> - Confirm no axios, no Fastify v5, no floats introduced.
> Report each check pass/fail. Commit on green.

---

## PHASE 1 — real CalFresh cascade + adversarial tests + deploy

**Task 1.1 — `constants.ts`.** Store the verified gross/net limit tables (above) with `source_url`+`as_of`. Add `each-additional` extrapolation (+918 gross / +459 net per member beyond 7). Add typed placeholders + `// TODO(VERIFY)` for max allotment, standard deduction, shelter cap, SUA, medical threshold, minimum benefit — each with the CDSS source URL to pull from.

**Task 1.2 — CalFresh cascade (`src/programs/calfresh.ts`), pure functions, integer cents, bigint.** Implement the real rule:
1. **Gross test:** if `!hasElderlyOrDisabled` and `grossIncome > grossLimit[hh]` → `unlikely` (stop). Elderly/disabled are gross-exempt → skip to net.
2. **Net income:**
   - `earnedDeduction = 20% of earnedIncome`
   - `− standardDeduction[hh]`
   - `− dependentCareCost` (actual, if any)
   - `− medicalDeduction` (elderly/disabled: expenses over the $35 threshold)
   - `adjustedIncome = gross − above` (floor 0)
   - `excessShelter = max(0, (rent + utilities) − 0.5 × adjustedIncome)`, **capped at shelterCap unless elderly/disabled (then uncapped)**
   - `net = max(0, adjustedIncome − excessShelter)`
3. **Net test:** `net > netLimit[hh]` → `unlikely` (stop).
4. **Benefit:** `maxAllotment[hh] − round(0.30 × net)`; **round the 30%×net up to the nearest dollar, then benefit down to the whole dollar** (real SNAP rounding); apply the 1–2 person minimum benefit if result is below it but > 0. Floor at 0.
5. **screening:** `likely_qualify` if it passes both tests; `need_more_info` if a required input for the path is missing (e.g., renter with no rent/utilities, or earned/unearned split unknown); else `unlikely`.
6. Populate `computation[]` with every line (gross, each deduction, adjusted, excess shelter, net, allotment, 30% net, benefit) and `assumptions[]` (e.g., "SUA used for utilities", "standard deduction only"). Always set `disclaimer` and a real `citations[]` entry.

**Task 1.3 — wire `/screen`** to call the real CalFresh function; remove the placeholder. Returns `ScreeningResult[]` with one CalFresh entry.

**Task 1.4 — adversarial vitest (`calfresh.test.ts`).** Cover, at minimum:
- Boundary: gross **exactly** at limit → passes (≤); one cent over (non-elderly) → `unlikely`.
- Over-threshold non-elderly ($2,700 gross, hh 1) → `unlikely`, no benefit.
- Elderly single, $2,700 gross → gross-exempt → proceeds to net test.
- hh 4, high rent+utilities → excess shelter pulls net below limit → `likely_qualify`.
- Missing rent for a renter → `need_more_info`, not a silent 0.
- Net floored at 0 → benefit equals max allotment (once allotment constant filled).
- Rounding: assert the whole-dollar SNAP rounding on a known net.
- No-float guarantee: a test that the internal math path uses bigint (e.g., a value that would drift under float).
- Benefit tests that depend on unverified allotment/deduction constants → mark `.todo` until Task 1.1 constants are verified; screening-decision tests (which only need the verified limit tables) must be **green now**.

> **VERIFY GATE 1 (adversarial):**
> - `vitest run` → all non-`.todo` tests green; the `.todo` list printed so it's visible what's still pending real constants.
> - Manually `curl` the elderly-exempt case and the over-threshold case → correct `screening` values.
> - Grep the engine for `Number(` on money paths, `parseFloat`, `* 0.3` on floats, axios, Fastify v5 → none.
> Report each. Commit on green.

**Task 1.5 — Deploy to App Platform.** Deploy the service; confirm the public URL answers `POST /screen` with a real CalFresh screen via `curl`.

> **VERIFY GATE 2:** public URL returns a real (non-placeholder) CalFresh `ScreeningResult` for a valid body. Report the URL. Commit + push the branch.

---

## FINAL REPORT (end of session)

Report back, concisely:
1. Branch state + commits made.
2. What's green vs `.todo` (which real constants still need pulling, with their source URLs).
3. The live App Platform URL.
4. The exact `HouseholdProfile` → `ScreeningResult` for one real SF persona (single parent, hh 2, ~$2,800/mo, renter) as the end-to-end proof.
5. The one wiring instruction Person A needs: the `/screen` URL + body shape for the Gradient function route.

Do not build Phase 2 (the filer) or any Gradient wiring. Stop after the final report.
