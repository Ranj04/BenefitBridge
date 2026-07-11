# CLAUDE.md

Guidance for Codex sessions in this repo. BenefitBridge is a public-benefits screener built for the AI for Social Good hackathon (MLH × DigitalOcean). Read `README.md` for the product and architecture; read `benefitbridge-claude-code-full-sequence.md` for the phased build plan before starting any implementation work.

## Current state

Early implementation. The repo holds the master plan, the per-phase Claude Code prompts, and the first landed code (Person A's Gradient graph scaffold under `src/`, `scripts/`, `do-function/` — see `README-personA.md`). Implementation lands phase by phase. Before creating anything, inspect what already exists (`git status`, `ls`, read the files) and reconcile with it — never clobber or duplicate partial work.

## Architecture rule (non-negotiable)

**The model does language, the code does math.** LLMs extract profiles, route intent, explain results, and fill form fields. They never assert an eligibility outcome, compute a dollar figure, or make a guarantee. All screening decisions and benefit amounts come from the deterministic engine.

## Stack (exact — do not substitute)

- TypeScript, Node, **Fastify v4 (never v5)**, `tsx` to run TS, **vitest** for tests
- **Native `fetch` + `AbortController` — axios is banned**
- `pg` only where a database is genuinely needed
- Frontend: Expo + react-native-web + NativeWind (universal iOS + web)
- Gradient AI via the official DigitalOcean TypeScript SDK (`@digitalocean/gradient`), falling back to the REST API; flag any step that requires the DO console, with the exact console path
- No new dependencies beyond these without flagging why

## Money math

Integer cents, pure `bigint`, everywhere. No floats on any money path. Convert dollars to cents at the boundary, compute in `bigint`, format back only for output. Apply the real SNAP rounding rules (30%-of-net rounds up to the nearest dollar; the benefit rounds down to the whole dollar). Verify gates grep for `parseFloat`, `Number(` on money paths, and float multiplication — keep them clean.

## No invented numbers

Constants marked verified in the phase prompts can be used as given. Anything else (allotments, deductions, caps, thresholds) must be pulled from the cited official source (CDSS, USDA FNS, IRS, CA FTB) and stored with `source_url` + `as_of`. If a constant can't be verified, leave `// TODO(VERIFY): <what> from <source>` and mark the dependent test `.todo`. Never guess a number into shipping code.

**Already verified (usable as given):** `benefitbridge-claude-code-phase0-1.md` provides the CalFresh FY2026 gross (200% FPL) and net (100% FPL) monthly income-limit tables by household size (`as_of: 2026-07-10`). Max allotment, standard deduction, excess-shelter cap, SUA, and medical threshold are NOT provided — pull them from official CDSS FFY2026 sources.

## The filer boundary

The system prepares applications; the human submits. No code path may programmatically submit to a government endpoint. Application status never advances past `staged_awaiting_user_submit`. The browser-fill flow halts hard at the submit button. Browser targets are open front ends (GetCalFresh, fillable PDFs) — never login-gated portals like BenefitsCal.

## PII

We collect income and immigration status. Profiles are ephemeral — no PII persisted. Encrypt in transit. Audit logs store actions and hashes, not raw personal data. Never echo raw sensitive PII in agent responses, logs, or fixtures.

## Honesty in output

Every figure is an estimate, labeled with a disclaimer, never a determination. Missing inputs produce `need_more_info` or a range, not a silent zero or a false-precision number. Guardrails rewrite "guaranteed" / "you will receive" phrasing into estimate language.

## Workflow

- One feature branch per phase prompt (`feat/pN-<slug>`); commit at each verify gate. Direct pushes to main only when the user explicitly asks.
- **Verify gates are adversarial.** Test boundaries (exactly at the limit, one cent over), over-threshold failures, the elderly/disabled path, missing inputs, and rounding — not just the happy path. A gate that only proves success is a failed gate. Stop at every gate, report pass/fail per check, and don't proceed past a red one.
- Surgical changes only: every changed line traces to a task in the active phase prompt. No speculative abstractions or unrequested config.
- Stop at the end of the active prompt's scope; don't wander into the next phase.

## Contracts

The shared types (`HouseholdProfile`, `ScreeningResult`, `FilledApplication`) are defined in the phase prompts and land in `src/contracts.ts`. Person A (Gradient layer) and Person B (engine/frontend) both build against them — don't change a contract unilaterally. `ScreeningResult.estimatedBenefit.period` distinguishes monthly benefits from annual lump sums (EITC); the UI must never mislabel one as the other.

## Key files

| File | Purpose |
|---|---|
| `README.md` | Product overview + architecture |
| `README-personA.md` | Person A's Gradient graph: run order, console-only steps, frontend entry point |
| `benefits-navigator-plan.md` | Master plan: vision, architecture, risks, demo script |
| `benefitbridge-claude-code-full-sequence.md` | All nine phase prompts, run order, standing rules |
| `benefitbridge-claude-code-phase0-1.md` | Phase 0–1: CalFresh engine + `/screen` endpoint |
| `benefitbridge-claude-code-prompt2-personA.md` | Phase 2: Gradient agent graph + guardrails |
| `benefitbridge-claude-code-prompt3.5-live-data.md` | Phase 3.5: live FPL data layer (HHS ASPE API) |
