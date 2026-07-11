# Benefit — Master Build Plan (v2: commercial, production-grade)

**Event:** AI for Social Good — MLH × DigitalOcean, SF
**Tracks targeted:** Best Use of Gradient AI (primary) · Best Use of Data · Best UI/UX
**Team:** 2 · **Demo:** 3-min live to judges · **Hard gate:** Devpost < 2:00 PM Sat
**Stack:** TypeScript / Fastify v4 / `tsx` / native fetch+AbortController / vitest · Expo + react-native-web + NativeWind (universal iOS+web) · DigitalOcean Gradient AI + App Platform + Spaces + Managed OpenSearch (+ optional Postgres, GPU Droplet)

---

## 0. What changed from v1, and why (continuity)

Three tweaks, reconciled against our earlier cons:

| Tweak | Decision | Con reconciliation |
|---|---|---|
| Agent **fills the application**, not "how to apply" | Agent produces a **review-ready filled application** + **human-consent gate before any submission**. No auto-submit of real gov forms. | New risk introduced (perjury/fraud/PII/ToS) → contained by the consent gate. |
| **Personalized real numbers**, not generic ranges | Encode the **full deduction cascade** → real per-person amount, shown as a transparent, disclaimed **estimate** with assumptions surfaced. | Con 1/5 (build time) dissolved by "time isn't an issue." Con 4 (liability) held by estimate-framing + disclaimer + guardrail. |
| **Commercial / multi-track / production-ready / complex** | Split into **production architecture** (full) + **demo slice** (golden path). Multi-track = depth spilling into Data + UI/UX, not dilution. | Con 3 (3-min demo) gets *harder* with scope → managed by the demo-slice discipline in §11–12. |

---

## 1. Product vision (the commercial skin)

**Benefit — the AI that finds every dollar you're owed and files for it.**

Tens of billions in public benefits go unclaimed every year — not because people are ineligible, but because the rules are unreadable and applications are exhausting. Benefit turns a plain-language description of someone's life into (1) a personalized list of programs they likely qualify for, (2) a real estimated dollar amount per program with its reasoning shown, and (3) a completed, review-ready application — in minutes, in their language.

**Who pays (B2B2C):** Medicaid managed-care plans and health systems (closing the social-determinants gap improves outcomes and star ratings), county human-services agencies (higher enrollment, lower cost-to-serve), community clinics and nonprofits (caseworker force-multiplier). Consumer-facing front end, enterprise buyer.

**Why now (real, cite live):** 2026 brought the largest CalFresh churn in decades — new work-requirement time limits (June 2026) and noncitizen eligibility changes (April 2026). Rule volatility = confusion = demand for a tool that's always current.

**Wedge:** start with one county (SF) and the highest-value programs; expand program-by-program and county-by-county (the rules corpus is the moat).

---

## 2. Two layers (this resolves "complex vs winnable")

- **Production architecture** (§3–§10): the full, ambitious, commercial system. Build as much of it as time allows.
- **Demo slice** (§11–§12): ONE golden path that must be flawless in 3 minutes — *free-text → personalized screen + real number → agent fills the application → trust panel*. Everything else is depth judges probe in Q&A, not screen time.

Rule: no feature counts unless it's either on the golden path or demoable in <15s during Q&A.

---

## 3. Architecture (full)

```
  free-text, any language ─►  GRADIENT: Intake Agent (multilingual)
                              extracts → HouseholdProfile (structured)
                                       │
                              GRADIENT: Router Agent (intent)
                     ┌─────────────────┼───────────────────┬───────────────┐
                     ▼                 ▼                   ▼               ▼
                Food Agent        Health Agent        Utilities/Cash    Tax Credit
                (CalFresh)        (Medi-Cal)          (CARE, CalWORKs,  (CalEITC/
                + KB:food         + KB:health          Lifeline)+KB      EITC)+KB
                     └─────────────────┴─── function route ──┴───────────────┘
                                       ▼
                    DETERMINISTIC BENEFIT ENGINE (our code)
                    Fastify · full deduction cascade · pure bigint math
                    real personalized amount + assumptions + citations
                                       ▼
                    GRADIENT: Application-Filer Agent
                    profile + chosen program → fills official form
                    → HUMAN CONSENT GATE → (PDF / browser / sim endpoint)
                                       ▼
        Spaces: store generated filled PDFs   ·   Gradient traces+evals: observability
        GUARDRAILS on every hop: no guarantees, PII-safety, no fabricated claims
```

**LLM vs code (non-negotiable):** the model does language (extract profile, explain, route, fill form fields) and never asserts an eligibility outcome, a dollar figure, or a guarantee. Every number and yes/no comes from the deterministic engine.

---

## 4. Application-Filer agent — the boundary (locked)

**Principle: the agent prepares and stages everything; the human submits.** Our system never programmatically submits a government form. Locked build = **both** of:

- **(a) Filled official PDF** — generate the completed CalFresh application (confirm current form/version at build) via the PDF skill; the user reviews the real, complete artifact in-app.
- **(b) Live browser agent** — Claude in Chrome fills the application form live on screen and **stops at the submit button**. This is the demo's agentic wow.

Pipeline: `HouseholdProfile` → map to the program's official fields → agent fills (PDF + live browser) → user reviews → **the user clicks submit themselves**. Status never advances past `staged_awaiting_user_submit` from our side.

**Browser target — important practical call:** don't automate BenefitsCal directly — it gates applications behind account login, and auto-filling a gated gov portal with persona PII is both fragile and ToS-sketchy. Point the browser agent at an **open, assist-friendly front end (GetCalFresh, Code for America)** or the **fillable official PDF opened in-browser**, stopping at submit. Same wow, no gated-login automation. Confirm the exact target in Phase 2.

The filled PDF is the reliable artifact; the live browser fill is the showpiece. If the browser run wobbles mid-demo, the PDF carries the "it actually files" claim on its own.

---

## 5. Personalized computation (real numbers, held safe)

Encode the real cascade per program. CalFresh example (verified FY2026):
- Gross screen: ≤ 200% FPL (monthly: 1p $2,610 … 6p $7,192).
- Net income: gross − standard deduction (by HH size) − 20% earned-income − dependent-care − excess-shelter (only above 50% of adjusted income, capped $744 unless elderly/disabled) − medical (elderly/disabled).
- **Benefit = max allotment(HH size) − 0.30 × net.** Real personalized dollar amount.

Held safe (con 4):
- Labeled **"Estimated $X/mo — based on what you told us. This is an estimate, not a determination. Confirm at application."**
- The Verification Console shows the *full computation and every assumption* → transparency, not a black box.
- Guardrail rewrites any "guaranteed"/"you will receive" phrasing into estimate language.
- Missing inputs → the number is a range or "need more info," never a false-precision figure.

Program set (real, single or full-cascade):
CalFresh (full cascade) · Medi-Cal (138% FPL screen) · CARE (~200% FPL discount) · Lifeline (~150% FPL) · **CalEITC + federal EITC (COMMITTED) — annual/lump-sum credits worth thousands; the "you're also owed ~$X you never claimed" beat** · CalWORKs (stretch).

**Benefit period matters:** CalFresh/CARE/Lifeline are *monthly*; EITC is *annual/one-time*. The contract carries a `period` field so the UI never mislabels a lump-sum credit as monthly.

---

## 6. Data track (Best Use of Data)

A real analysis artifact, not decoration: **the benefits-gap map.** Pull ACS/Census income-by-tract + program participation/uptake data (DataSF + state) → estimate eligible-but-unenrolled population per SF neighborhood → map it. Commercial hook: "we show a county exactly which blocks leave money on the table, and how much." This doubles as the enterprise value prop and the Data-track submission.

---

## 7. DigitalOcean usage map (sponsor depth = the prize)

| DO product | Use |
|---|---|
| **Gradient AI — Agents** | Intake, router, 5 domain agents, application-filer (multi-agent routing) |
| **Gradient AI — Knowledge Bases** | One per domain, real official-doc crawl, citation-backed RAG (Spaces + OpenSearch under the hood) |
| **Gradient AI — Guardrails** | No-guarantee rewrite, PII safety, no fabricated claims |
| **Gradient AI — Function routing** | Agents → deterministic `/screen` and `/fill` endpoints |
| **Gradient AI — Evaluations + Traces** | Safety/correctness eval suite + production observability story |
| **Gradient AI — Serverless Inference** | Claude models for the language layer |
| **App Platform** | Host the Fastify API + the web build of the Expo app |
| **Spaces** | Store generated filled application PDFs + KB source docs |
| **Managed OpenSearch** | Vector store backing the KBs |
| **Managed Postgres** *(prod-ready)* | Minimal encrypted **audit log** of filing actions (NOT a PII user store) |
| **GPU Droplet** *(stretch)* | Self-hosted multilingual model for languages Gradient handles weakly, or the rules-extractor fine-tune |

---

## 8. Track strategy (honest)

- **Best Use of Gradient AI (primary):** most Gradient surface used well — intake + routing + 6 agents + KBs + guardrails + function calling + evals + the agentic filer. Concentrate here.
- **Best Use of Data (natural spillover):** the benefits-gap map is a genuine data artifact; lead the demo's closing beat with one surprising number from it.
- **Best UI/UX (end-stretch — flagged, not a primary target):** your Expo + NativeWind + Avior design tokens *can* contend, but only chase it at the end if the golden path is done and solid. Kept on the radar; not costing golden-path time.
- **Best Beginner:** you're ineligible (multi-hackathon placer). Ignore.

The multi-track win comes from the core being deep enough that Data and UX fall out of it — not from splitting attention four ways.

---

## 9. Interface contracts (define first → parallel work)

```ts
type HouseholdProfile = {
  householdSize: number;
  monthlyGrossIncome: number;
  earnedIncome: number;            // vs unearned, for the 20% deduction
  hasChildren: boolean; childrenAges?: number[];
  hasElderlyOrDisabled: boolean;
  isRenter: boolean; monthlyRent?: number; monthlyUtilities?: number;
  dependentCareCost?: number; medicalExpenses?: number;
  countyFips: string;              // "06075" = SF
  immigrationStatus?: 'citizen' | 'lpr' | 'other';
  preferredLanguage: string;
};

type Citation = { text: string; source_url: string; as_of: string };

type ScreeningResult = {
  program: string;
  screening: 'likely_qualify' | 'need_more_info' | 'unlikely';
  estimatedBenefit:
    | { amount: number | { low: number; high: number };
        period: 'monthly' | 'annual' | 'one_time' }
    | null;
  computation: { label: string; value: number }[];   // the full shown cascade
  assumptions: string[];
  reason: string; citations: Citation[]; applyUrl: string;
  disclaimer: string;
};

type FilledApplication = {
  program: string;
  fields: Record<string, string>;   // official form field → value
  pdfUrl: string;                   // Spaces URL to generated filled PDF
  status: 'draft' | 'ready_for_review' | 'staged_awaiting_user_submit'; // we never submit
};

// POST /screen  HouseholdProfile → ScreeningResult[]
// POST /fill    {profile, program} → FilledApplication (generates PDF + drives browser fill)
// Browser agent stops at the submit button; the USER submits. No programmatic /submit to gov.
```

---

## 10. Production-ready concerns (the "complex/real" credibility)

- **PII (critical — we collect income + immigration status):** ephemeral profiles, no PII persisted; encrypt in transit; consent gate before submission; audit log stores actions + hashes, not raw PII. Say this out loud in the pitch — it's a maturity signal.
- **Human-in-the-loop:** mandatory consent before any submission action.
- **Multilingual:** intake + explanations in ≥3 languages (SF HSA publishes in 6) — social-good *and* technical depth.
- **Accessibility:** WCAG AA; benefits populations include disabled and low-literacy users; mobile-first (they're phone-first).
- **Observability:** Gradient traces + an eval suite = "we can prove it's safe" story.
- **Freshness:** every threshold carries `source_url` + `as_of`; auto-reindex KBs.

---

## 11. Phased build with verification gates

Golden-path (demo-slice) steps are marked ★ — these must ship. Others are depth.

**Phase 0 — contracts + scaffolding**
1. ★ Repo, commit the §9 contracts. → *both import the types.*
2. ★ Gradient: intake + router + Food agent; create KBs; start overnight crawl. → *indexing running.*
3. ★ Fastify `/screen` skeleton, deploy to App Platform. → *public URL returns JSON.*

**Phase 1 — real personalized number (the core wow)**
4. ★ Full CalFresh cascade in code + vitest. → *a real profile yields the correct benefit; an over-threshold profile yields `unlikely`.*
5. ★ Wire router→Food→`/screen`. → *free-text produces a real personalized CalFresh number end-to-end.*
6. ★ Verification Console showing the full computation + assumptions. → *judge sees the math.*

**Phase 2 — the filer (the second wow)**
7. ★ `/fill` maps profile → official form fields; generate filled PDF to Spaces. → *download a correct, completed application.*
8. ★ Live browser agent (Claude in Chrome) fills the open target form on screen and **stops at submit**; user reviews the PDF alongside. → *judge watches it fill a real form and halt at the submit button.*
9. ★ Guardrail: no-guarantee rewrite, live. → *"guaranteed $5,000" → honest estimate language on screen.*

**Phase 3 — breadth + trust**
10. ★ **EITC/CalEITC** (annual credit, big number) + Medi-Cal, CARE, Lifeline screens (real thresholds pulled live). → *vitest green; EITC surfaces a real ~$-thousands figure.*
11. Multilingual intake (≥3 languages). → *Spanish free-text works end-to-end.*
12. Eval harness + Gradient Evaluations. → *accuracy % + safety evals pass.*
13. Offline-mode fixture (labeled). → *replays a captured real run.*

**Phase 4 — track spillover**
14. Benefits-gap map (Data track). → *map renders one real under-enrollment insight.*
15. UI/UX polish pass (if pursuing UX track). → *design-token pass, a11y, mobile.*

**Phase 5 — submission**
16. ★ 3-min video, Devpost writeup (problem → Gradient depth → live filing → commercial), public GitHub, submit < 2 PM.

---

## 12. Demo script (3 min, golden path)

1. **(0:00–0:25)** The gap + the money. "Billions unclaimed because the rules are unreadable and the forms are brutal. Watch."
2. **(0:25–1:15)** Click seed persona (or type live). Intake extracts the profile; router fans out; returns real programs with a **real personalized dollar estimate** each, cited, disclaimed — including the **EITC beat: "you're also owed ~$X in tax credits you never claimed."** Open Verification Console: "the model asserted none of this — here's the actual CalFresh cascade and every assumption."
3. **(1:15–2:10)** "Now it files." Live browser agent fills the real application form on screen and **stops at the submit button**; the completed PDF sits alongside for review. "It does everything but click submit — that's the human's call." Then the adversarial test: guardrail **rewrites a 'guaranteed $5,000' hallucination** live.
4. **(2:10–3:00)** Close with the benefits-gap map (one arresting number) + the commercial line: "a health plan closes its enrollment gap; a caseworker serves 10x more people." Name the Gradient stack in one breath.

---

## 13. Risk register

| Risk | Mitigation |
|---|---|
| Scope sprawl kills the demo | Golden-path discipline (§2, ★ steps); everything else is Q&A depth. |
| Auto-submitting gov forms = legal/PII risk | Agent stops at submit; user submits. No programmatic submission. |
| Precise number implies certainty | Estimate framing + disclaimer + guardrail + full transparency in console. |
| Benefit math subtly wrong | Test the cascade against a known calculator (GetCalFresh) in vitest; cite the rule for each line. |
| Live browser fill fragile mid-demo | It's the showpiece, not the proof — the filled PDF carries "it files" if the browser wobbles. Rehearse the exact run; pin the target page. |
| Browser target gated by login (BenefitsCal) | Point at an open front end (GetCalFresh) or the fillable PDF in-browser; confirm in Phase 2. |
| EITC mislabeled as monthly | `period` field on every benefit; UI renders annual/one-time distinctly. |
| PII exposure | Ephemeral, no PII persistence, encrypt in transit, audit hashes only. |
| KB indexing slow | Kicked off overnight. |
| WiFi dies mid-demo | Labeled Offline Mode replays a captured real run. |

---

## 14. Locked decisions

- **Filing:** live browser agent (fills the open target, **stops at submit**) **+** filled official PDF for review. No programmatic submission; the user clicks submit. Browser target = GetCalFresh / fillable PDF, not gated BenefitsCal.
- **Tax credits:** **EITC + CalEITC committed** as a core program — the big-dollar "money you never claimed" beat. `period` field distinguishes its annual/lump-sum amount from monthly benefits.
- **UI/UX track:** end-stretch only, flagged for reference; never costs golden-path time.
- **Team:** 2. Realistic reach = the ★ golden path + Phase 3 breadth; Phase 4 (data map, UX polish) is genuine stretch.

**Still worth confirming when you start:** the exact current CalFresh application form/version and the exact GetCalFresh fields, both pulled/verified at build (thresholds already verified for CalFresh FY2026).
