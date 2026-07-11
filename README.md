# BenefitBridge

**The AI that finds every dollar you're owed in public benefits, then fills out the application for you.**

Built for **AI for Social Good** (MLH × DigitalOcean, San Francisco), targeting the Best Use of Gradient AI, Best Use of Data, and Best UI/UX tracks.

## The problem

Tens of billions of dollars in public benefits go unclaimed every year in the US. Not because people are ineligible, but because the rules are unreadable and the applications are exhausting. A single parent in San Francisco who wants to know if she qualifies for CalFresh has to work through gross income tests, a deduction cascade with five different line items, and an excess-shelter calculation that changes depending on whether anyone in her household is elderly or disabled. Most people give up before they start.

2026 made this worse: new CalFresh work-requirement time limits landed in June, noncitizen eligibility changed in April, and the resulting churn is the largest California has seen in decades. Rule volatility means confusion, and confusion means unclaimed money.

## What it does

You describe your situation in plain language, in any language. BenefitBridge gives you back three things:

1. **A personalized list of programs you likely qualify for** — CalFresh, Medi-Cal, PG&E CARE, California LifeLine, and federal + California EITC.
2. **A real estimated dollar amount for each one**, with the full computation shown line by line. Not "you may be eligible for assistance," but an estimated dollar figure per month with the math behind it. The EITC screen often surfaces four figures in annual tax credits people never claimed.
3. **A completed, review-ready application.** The system fills the official form (as a PDF and via a live browser agent) and stops at the submit button. You review it; you click submit. Always.

## How it works

```
free text, any language ──► Intake Agent (Gradient AI)
                            extracts a structured HouseholdProfile
                                      │
                            Router Agent (intent classification)
                   ┌──────────────────┼──────────────────┬──────────────┐
                   ▼                  ▼                  ▼              ▼
              Food Agent         Health Agent       Utilities/Cash   Tax Credit
              (CalFresh)         (Medi-Cal)         (CARE, LifeLine) (EITC/CalEITC)
              + Knowledge Base   + KB               + KB             + KB
                   └──────────────────┴── function route ┴──────────────┘
                                      ▼
                   DETERMINISTIC BENEFIT ENGINE (our code, not a model)
                   Fastify · full deduction cascade · integer-cent bigint math
                   real personalized amount + assumptions + citations
                                      ▼
                   Application-Filer Agent
                   profile + chosen program → fills the official form
                   → HUMAN CONSENT GATE → filled PDF + live browser fill
```

The architectural rule that everything else hangs on: **the model does language, the code does math.** LLMs extract the household profile, route the request, explain the results, and fill form fields. They never assert an eligibility outcome, compute a dollar figure, or make a guarantee. Every number and every yes/no comes from a deterministic engine written in TypeScript, tested with vitest, computing in integer cents with `bigint` so no float ever touches money.

### The eligibility engine

Take CalFresh, the deepest cascade. The engine implements the real FY2026 rules: a gross-income screen at 200% of the federal poverty level ($2,610/mo for a household of one, $7,192 for six), then net income after the standard deduction, the 20% earned-income deduction, dependent care, medical expenses for elderly or disabled members, and excess shelter costs above half of adjusted income (capped at $744 unless someone is elderly or disabled, in which case it's uncapped). The final benefit is the maximum allotment for the household size minus 30% of net income, with the actual SNAP rounding rules applied.

Every constant in the engine carries a `source_url` and an `as_of` date pointing at the official CDSS or IRS publication it came from. Anything that couldn't be verified against an official source ships as a `// TODO(VERIFY)` with a `.todo` test, never as a guessed number.

### Honesty as a feature

Precise numbers can imply certainty, and certainty about government benefits is a liability. So the system holds the line in four places:

- Every figure is labeled an **estimate**, with a disclaimer, never a determination.
- A **Verification Console** in the UI shows the parsed profile, the full computation cascade, and every assumption the engine made. Judges (and users) can see there's no black box.
- **Gradient AI guardrails** rewrite any "guaranteed" or "you will receive" phrasing into estimate language before it reaches the screen. There's a live adversarial-test button that tries to make the agent promise $5,000/mo, so you can watch the rewrite happen.
- Missing inputs produce a range or `need_more_info`, not a false-precision number.

### The filer boundary

The agent prepares everything; the human submits. This is locked. The system generates the completed official CalFresh application as a PDF for review, and a Claude-in-Chrome browser agent fills the live form on screen, halting hard at the submit button. Application status never advances past `staged_awaiting_user_submit` from our side, and no code path POSTs to a government submission endpoint. The browser agent targets open, assist-friendly front ends (GetCalFresh) rather than login-gated portals like BenefitsCal.

Since we collect income and immigration status, PII handling is strict: profiles are ephemeral and never persisted, everything is encrypted in transit, and the audit log stores actions and hashes rather than raw personal data.

## Stack

| Layer | Choice |
|---|---|
| Engine + API | TypeScript, Fastify v4, `tsx`, native fetch + AbortController, vitest |
| Agents | DigitalOcean Gradient AI — agents, knowledge bases, guardrails, function routing, evaluations, traces |
| Frontend | Expo + react-native-web + NativeWind (one universal iOS + web app) |
| Hosting | DO App Platform (API + web), Spaces (filled PDFs, KB sources), Managed OpenSearch (KB vectors) |
| Data track | ACS/Census income-by-tract + DataSF uptake data → a benefits-gap map of eligible-but-unenrolled residents per SF neighborhood |

Money math is integer cents in `bigint`, end to end. Fastify stays on v4, axios is banned in favor of native fetch, and no eligibility logic ever runs through a model.

## API contract

```ts
// POST /screen   HouseholdProfile → ScreeningResult[]
// POST /fill     { profile, program } → FilledApplication

type ScreeningResult = {
  program: string;
  screening: 'likely_qualify' | 'need_more_info' | 'unlikely';
  estimatedBenefit:
    | { amount: number | { low: number; high: number };
        period: 'monthly' | 'annual' | 'one_time' }
    | null;
  computation: { label: string; value: number }[];  // the full shown cascade
  assumptions: string[];
  reason: string;
  citations: { text: string; source_url: string; as_of: string }[];
  applyUrl: string;
  disclaimer: string;
};
```

The `period` field exists because CalFresh is monthly and EITC is an annual lump sum; the UI must never label a one-time tax credit as recurring income. Full contracts (including `HouseholdProfile` and `FilledApplication`) live in the planning docs and will land in `src/contracts.ts`.

## Repo status and layout

This repo is currently in the planning stage: it holds the build plan and the Claude Code session prompts that drive each phase. Code lands phase by phase on feature branches.

| File | What it is |
|---|---|
| `benefits-navigator-plan.md` | The master build plan: product vision, architecture, track strategy, risk register, demo script |
| `benefitbridge-claude-code-full-sequence.md` | The full nine-prompt build sequence with standing rules and run order |
| `benefitbridge-claude-code-phase0-1.md` | Prompt 1 — the backend spine: CalFresh cascade + `/screen` endpoint |
| `benefitbridge-claude-code-prompt2-personA.md` | Prompt 2 — the Gradient agent graph, knowledge bases, and guardrails |
| `benefitbridge-claude-code-prompt3.5-live-data.md` | Prompt 3.5 — live FPL data layer from HHS ASPE API |

### Build sequence

Two people, split by surface. Person B owns the deterministic spine and frontend; Person A owns the Gradient AI layer. The golden path that must ship: backend spine → agent graph → program breadth → application filer → frontend. The trust layer (multilingual intake in English, Spanish, and Chinese; eval harness; offline demo fixture; traces), the benefits-gap map, and the accessibility pass follow as depth.

Every phase ends at an adversarial verify gate: boundary values at each FPL threshold, over-threshold profiles that must return an honest `unlikely`, elderly/disabled paths, missing inputs that must not silently become zeros, and a grep for floats on money paths. A gate that only proves the happy path counts as failed.

## Who this is for

The front end serves people; the business serves institutions. Medicaid managed-care plans and health systems close social-determinants gaps that hurt outcomes and star ratings, county human-services agencies raise enrollment while cutting cost-to-serve, and community clinics turn one caseworker into ten. The benefits-gap map is the enterprise pitch in one picture: here are the blocks in your county leaving money on the table, and here's how much.

The wedge is one county (San Francisco) and the highest-value programs, expanding program by program and county by county. The rules corpus, kept current with cited sources and `as_of` dates, is the moat.

## License

Not yet chosen. Ask before reusing.
