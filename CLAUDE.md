# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Current state: planning stage, no code yet

This repo currently contains **only build-plan documents and tooling** — there is no application source, no `package.json`, no tests. The plan docs below are the specification for what gets built. Before writing any code, read the relevant plan doc; it defines contracts, constants, and verification gates you are expected to honor.

- `benefits-navigator-plan.md` — the master product/architecture plan (§9 interface contracts, §11 phased build).
- `benefitbridge-claude-code-phase0-1.md` — Person B, Phase 0+1: the deterministic CalFresh screening engine + `POST /screen`. Includes the verified FY2026 constants.
- `benefitbridge-claude-code-full-sequence.md` — the full 9-prompt run order; STANDING RULES apply to every session.
- `hearth-claude-code-prompt2-personA.md` — Person A, Prompt 2: the DigitalOcean Gradient AI agent graph that calls `/screen`.

Naming note: the product is referred to as **BenefitBridge**, **Benefit**, and **Hearth** across docs — same project.

## What this is

A benefits screener for a 2-person hackathon (MLH × DigitalOcean, AI for Social Good). Turns plain-language free text about someone's situation into (1) programs they likely qualify for, (2) a real personalized dollar estimate per program with the math shown, and (3) a review-ready filled application. Core programs: CalFresh, Medi-Cal, CARE, Lifeline, EITC/CalEITC.

## Architecture (as specified in the plans)

Two owners work in parallel against a shared HTTP contract:

- **Person A (Gradient surface):** DigitalOcean Gradient AI agents — intake (free text → `HouseholdProfile`), router, domain agents, KBs (cited RAG), guardrails, and a *function route* that calls Person B's `/screen`. The LLM does **language only**.
- **Person B (spine + frontend):** the deterministic screening engine (Fastify), the filer (`/fill` → PDF + browser fill), and the Expo universal app.

The load-bearing boundary: **the model never asserts an eligibility outcome, a dollar figure, or a guarantee.** Every number and yes/no comes from deterministic code in the engine. Agents extract, explain, route, and fill fields — nothing more.

### Core HTTP contracts (from `benefits-navigator-plan.md` §9)

- `POST /screen` — `HouseholdProfile` → `ScreeningResult[]`
- `POST /fill` — `{profile, program}` → `FilledApplication` (generates PDF, drives browser fill)
- There is **no** programmatic submit to any government endpoint. The filer stops at the submit button (`status: 'staged_awaiting_user_submit'`); the human clicks submit.

Define `src/contracts.ts` with the `HouseholdProfile` / `ScreeningResult` / `FilledApplication` types exactly as written in the plans — both owners import them.

## Non-negotiable engineering rules (STANDING RULES)

These come from the plan docs and override default habits:

1. **Stack, exactly:** TypeScript, Node, **Fastify v4 (never v5)**, `tsx` to run TS, **native `fetch` + `AbortController` (never axios)**, **vitest** for tests, `pg` only where a DB is genuinely needed. Frontend: Expo + react-native-web + NativeWind. Don't add deps beyond these without flagging why.
2. **Money is integer cents, pure `bigint`. No floats in any eligibility/benefit math.** Convert dollars→cents at the boundary, compute in bigint, format back only for output. Apply real SNAP rounding (round 30%×net up to the dollar, benefit down to the dollar).
3. **Deterministic logic in code, never an LLM.** No model calls anywhere in the engine.
4. **No invented numbers.** Use only the verified constants provided in the plans. Any unverified constant must be pulled from the cited official source and stored with `source_url` + `as_of`, or left as `// TODO(VERIFY): <what> from <source>` with its dependent test marked `.todo`. Never guess a number into shipping code.
5. **Verification is adversarial, not happy-path.** Gates must test boundaries, over-threshold failures, the elderly/disabled path, missing inputs, and rounding. A gate that only proves the happy path is a failed gate.
6. **Feature branch per prompt** (`feat/pN-<slug>` / `feat/phase0-1-screen-engine`); commit at each VERIFY GATE; **never commit to main.**
7. **State-aware first:** inspect existing repo state before creating anything; reconcile, don't clobber or duplicate; report what you found.
8. **Surgical:** every changed line traces to a task in the plan. No speculative abstractions or unrequested config.
9. **Stop at every VERIFY GATE:** run the checks, report pass/fail per check, don't proceed past a red gate. Stop and report at the end of a prompt's scope; don't wander into the next prompt's work.

## Verified constants already provided

`benefitbridge-claude-code-phase0-1.md` provides the CalFresh FY2026 gross (200% FPL) and net (100% FPL) monthly income limit tables by household size (`as_of: 2026-07-10`) — use these directly. Max allotment, standard deduction, excess-shelter cap, SUA, medical threshold, and minimum benefit are **not** provided and must be pulled from official CDSS FFY2026 sources.

## RocketRide (AI pipeline tooling)

If building AI pipelines, document processing, RAG, or data integration with RocketRide, read the docs in `.rocketride/docs/` first (start with `ROCKETRIDE_README.md`), per `.claude/rules/rocketride.md`. Component schemas live in `.rocketride/schema/`.
