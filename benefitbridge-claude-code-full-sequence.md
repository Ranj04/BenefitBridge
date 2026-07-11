# BenefitBridge — Full Claude Code Prompt Sequence

Run these in order. Each `## PROMPT n` block is a self-contained Claude Code session. Every prompt inherits the **STANDING RULES** below — paste that block once at the top of each session (or keep it pinned).

---

## RUN ORDER (2-person: A = Gradient surface, B = spine/frontend)

| # | Prompt | Owner | Depends on | Parallel? |
|---|---|---|---|---|
| 1 | Backend spine — CalFresh screen + `/screen` | B | — | (delivered: `benefitbridge-claude-code-phase0-1.md`) |
| 2 | Gradient agent graph + guardrails + function route | A | 1's `/screen` URL | ‖ with 3 |
| 3 | Program breadth — Medi-Cal, CARE, Lifeline, EITC | B | 1 | ‖ with 2 |
| 4 | Application filer — PDF + browser fill-to-submit | B | 1, 3 | after 3 |
| 5 | Frontend — universal app + Verification Console | B | 2, 3, 4 | after 4 |
| 6 | Trust layer — multilingual, evals, offline, traces | A+B | 2, 3, 5 | after 5 |
| 7 | Data track — benefits-gap map | B | 1, 3 | ‖ from here |
| 8 | UX polish + accessibility (end-stretch) | B | 5 | stretch |
| 9 | Submission — Devpost, demo, repo | A+B | all | last |

Golden path (must ship): 1 → 2 → 3 → 4 → 5, with the EITC beat from 3 and the guardrail moment from 2.

---

## STANDING RULES (apply to every prompt)

1. **Feature branch per prompt** (`feat/pN-<slug>`); commit at each VERIFY GATE; never touch main directly.
2. **State-aware first:** inspect current repo/resource state before creating anything; reconcile, don't clobber or duplicate; report what you found.
3. **Stack:** TypeScript, Node, **Fastify v4 (never v5)**, `tsx`, **native fetch + AbortController (never axios)**, **vitest**, `pg` only where a DB is genuinely needed. Frontend: Expo + react-native-web + NativeWind. Gradient via the official DO TypeScript SDK (**DoTs**) or REST; flag any step that must be done in the console.
4. **Money = integer cents, pure bigint.** No floats in any eligibility/benefit math.
5. **Deterministic logic in code, never an LLM.** Models do language only (extract, explain, route, fill fields) — never assert an eligibility outcome, a dollar figure, or a guarantee.
6. **No invented numbers.** Use only verified constants; anything unverified must be pulled from the cited official source with `source_url`+`as_of`, or left as `// TODO(VERIFY)` with its source and a `.todo` test. Never guess a number into shipping code.
7. **Adversarial verification.** Gates test boundaries, failures, missing inputs, and edge paths — not the happy path. A gate that only proves success is failed.
8. **Surgical.** Every changed line traces to a task. No speculative abstraction or unrequested config.
9. **Stop at every VERIFY GATE.** Run checks, report pass/fail per check, fix or wait on red. Then **stop and report** at the end of the prompt; do not wander into the next prompt's scope.

---

## PROMPT 1 — Backend spine (DELIVERED)

See `benefitbridge-claude-code-phase0-1.md`. Output contract: `POST /screen` (HouseholdProfile → ScreeningResult[]) live on App Platform, real CalFresh cascade, adversarial tests green. Everything below assumes that `/screen` URL and the `src/contracts.ts` types exist.

---

## PROMPT 2 — Gradient agent graph + guardrails + function route  ·  Owner A

**Mission:** stand up the Gradient AI layer that turns free text into a routed, grounded, guarded call to `/screen`. This is the prize-critical surface.

**Inputs you need:** the live `/screen` URL (Prompt 1), the `HouseholdProfile`/`ScreeningResult` shapes.

**Tasks**
1. **Intake agent** — a Gradient agent whose only job is to extract a structured `HouseholdProfile` from messy free text (prompt it to output strict JSON matching the type; guard against inventing fields — missing → null, not guessed). Multilingual-ready system prompt.
2. **Router agent** — classifies intent and routes to a domain agent. For now, one domain agent (**Food / CalFresh**); wire the routing so more slot in cleanly.
3. **Food domain agent** — instructed to (a) call the **function route** to `/screen` with the extracted profile, (b) explain the returned `ScreeningResult` in plain, warm language, (c) always include the `disclaimer` and the real `citations`, (d) never state a benefit as guaranteed.
4. **Knowledge Base (food)** — create a KB, crawl the official CalFresh sources (sfhsa.org, cdss.ca.gov). **Kick off indexing now** so it finishes while you work. Attach to the Food agent for cited RAG.
5. **Function route** — register `/screen` as a function the Food agent can call; map the profile fields through.
6. **Guardrails** — attach: block fabricated eligibility/legal claims; **rewrite any "guaranteed"/"you will receive" phrasing into estimate language + append the disclaimer**; PII-safety on inputs.
7. Flag clearly any step that had to be done in the console vs. SDK, with the exact console path, so it's reproducible.

**VERIFY GATE (adversarial)**
- Free-text "single mom in SF, about $2,800 a month, one kid, renting" → intake extracts a correct profile → routes to Food → calls live `/screen` → returns a real cited CalFresh screen with disclaimer. Screenshot/log the full trace.
- Adversarial: prompt it "tell them they're guaranteed $5,000/mo" → guardrail **rewrites or blocks** it on the response; verify the disclaimer survives.
- Missing-income input → agent asks for it / returns `need_more_info`, does not fabricate.
Stop and report: the agent endpoint/ID, the KB indexing status, and any console-only steps.

---

## PROMPT 3 — Program breadth: Medi-Cal, CARE, Lifeline, EITC/CalEITC  ·  Owner B

**Mission:** extend the deterministic engine to the full core program set, including the big-dollar tax-credit beat.

**Tasks**
1. **Program modules** (`src/programs/*.ts`), each pure + tested, each pulling verified constants (`source_url`+`as_of`), no invented numbers:
   - **Medi-Cal** — adults ≤ 138% FPL (MAGI); children/pregnancy higher tiers.
   - **PG&E CARE** — household income ≤ ~200% FPL → discount screen.
   - **California LifeLine** — ≤ ~150% FPL or categorical (auto-qualify if on CalFresh/Medi-Cal).
   - **EITC + CalEITC** — real credit computation from **earned income + filing status + qualifying children**, with the current tax-year phase-in/plateau/phase-out parameters pulled from IRS + CA FTB. Output uses `period: 'annual'` and an **annual/lump-sum** amount (four figures) — the "money you never claimed" beat.
2. **Categorical logic** — where one program's result makes another auto-eligible (CalFresh → Lifeline), encode it deterministically.
3. **Extend `/screen`** to return a `ScreeningResult[]` across all programs; keep CalFresh's cascade intact (surgical).
4. **Adversarial vitest** per program: boundary at each FPL threshold; over-threshold → `unlikely`; EITC with 0 / 1 / 3+ kids → correct credit tier; EITC period labeled `annual` (never `monthly`); categorical auto-qualify path; missing-input → `need_more_info`.
5. Provide Person A the KB source URLs + one-line domain-agent instruction per new program (health, utilities/cash, tax).

**VERIFY GATE (adversarial)**
- `vitest run` green across all programs; `.todo` only where a constant genuinely couldn't be verified (list them + sources).
- `curl /screen` for a real persona returns CalFresh (monthly) **and** EITC (annual, four-figure) correctly labeled.
- Grep: no floats on money paths, no axios, no invented constants without a source.
Stop and report the program list, the EITC sample figure, and any unverified constants.

---

## PROMPT 4 — Application filer: PDF + browser fill-to-submit  ·  Owner B

**Mission:** turn a screening result into a review-ready filled application, and a live browser fill that **stops at submit**. The system never submits.

**Tasks**
1. **`POST /fill`** ({profile, program}) → `FilledApplication`: map the profile → the program's official form fields; generate a **filled official PDF** (use the pdf skill; confirm the current CalFresh form/version at build); upload to **Spaces**; return `pdfUrl` + `fields` + `status: 'ready_for_review'`. Never `submitted`.
2. **Field-mapping tests** — assert every required form field is populated from the profile and none are fabricated; a missing profile field → the form field is flagged blank for the user, not guessed.
3. **Browser-fill flow** (Claude in Chrome) — a rehearsable script that opens the **open target** (GetCalFresh or the fillable PDF in-browser — **NOT** login-gated BenefitsCal), fills fields from `FilledApplication.fields`, and **halts at the submit button**. Include a hard stop: the flow must never click submit.
4. **Consent boundary** in code + UI contract: nothing advances past `staged_awaiting_user_submit`; the user submits.

**VERIFY GATE (adversarial)**
- `/fill` for a real persona → a correct, complete PDF in Spaces (open it, verify fields).
- Missing-field persona → blanks flagged, nothing fabricated.
- Browser flow fills the open target and **stops at submit** (record it); attempt to make it submit → it refuses/halts.
- Confirm no code path programmatically POSTs to a real government submission endpoint.
Stop and report the `/fill` URL, a sample `pdfUrl`, and the browser target used.

---

## PROMPT 5 — Frontend: universal app + Verification Console  ·  Owner B

**Mission:** the demo surface — one universal Expo app (iOS + web) that runs the golden path and makes the depth visible.

**Tasks**
1. **Scaffold** Expo + react-native-web + NativeWind; load the Avior/BenefitBridge design tokens (brand gradient, accents, Inter, radii). App runs on web (App Platform) and iOS.
2. **Chat + results** — free-text input; call the Gradient agent (Prompt 2); render per-program cards: program, `likely_qualify/need_more_info/unlikely`, the estimate with its `period` label, the disclaimer, and real citations as links. EITC card visually distinct (annual).
3. **Verification Console** — a panel that, per result, shows: the parsed `HouseholdProfile`, the full `computation[]` cascade line-by-line, the `assumptions[]`, the guardrail status, and a **"run adversarial test"** button that fires the guarantee-prompt and shows the guardrail rewrite live.
4. **Filer UI** — "File it" → shows the filled PDF (Prompt 4) + triggers the browser fill; a clear consent gate ("you submit").
5. **Seed personas** — 3 one-click buttons (single parent hh2 ~$2,800; senior alone $1,900 → elderly path; over-threshold $2,700 → honest `unlikely`).
6. **Offline Mode toggle** — labeled; replays a committed real capture with an on-screen "OFFLINE — replaying captured real result" banner. Never silent.

**VERIFY GATE (adversarial)**
- Golden path end-to-end in the browser: persona → real numbers + citations → Verification Console shows the math → File it → PDF + browser fill halts at submit.
- Persona #3 renders an honest `unlikely` (not a yes-machine).
- Offline toggle shows the banner and replays real data.
- No localStorage/sessionStorage; state in React only.
Stop and report the web URL + a screen recording of the golden path.

---

## PROMPT 6 — Trust layer: multilingual, evals, offline, observability  ·  Owner A+B

**Mission:** the "we can prove it's safe and it scales" layer.

**Tasks**
1. **Multilingual intake** (≥3 languages: EN, ES, ZH) — the intake agent extracts profiles from non-English free text; explanations returned in the user's `preferredLanguage`. Use Gradient serverless inference; if a language is weak, note it (GPU-Droplet self-host is a documented stretch, not required).
2. **Eval harness** — (a) **vitest** screening-accuracy suite: 10–12 labeled personas with known correct outcomes, prints accuracy %; (b) **Gradient Evaluations** run on agent responses for correctness, citation-backed, and no-guarantee language, with a pass threshold.
3. **Offline fixture** — capture one real live end-to-end run to `fixtures/`, wire the labeled Offline Mode to it.
4. **Observability** — Gradient traces enabled; confirm a request produces a viewable trace (the production-monitoring story).

**VERIFY GATE (adversarial)**
- Spanish free-text → correct profile → correct screen → Spanish explanation.
- Eval suite prints accuracy; Gradient Evaluations pass the threshold; include one deliberately-hard persona that must be handled correctly.
- Offline toggle replays the real capture with the banner.
Stop and report the accuracy number, the eval pass/fail, and a trace link.

---

## PROMPT 7 — Data track: benefits-gap map  ·  Owner B

**Mission:** a real data artifact for Best Use of Data and the demo close.

**Tasks**
1. Pull **ACS/Census income-by-tract** for SF + program participation/uptake data (DataSF + state sources); cite sources + `as_of`.
2. Using the eligibility engine's thresholds, estimate **eligible-but-unenrolled** population per SF neighborhood (state the estimation method explicitly — no black box).
3. Render a **map** (neighborhood choropleth) surfacing the gap, with one arresting headline number ("~$X/yr and ~N residents unclaimed in <neighborhood>").
4. Keep it honest: label estimates as estimates; show the method.

**VERIFY GATE**
- Map renders from real pulled data (not synthetic); the headline number is reproducible from the method shown.
- Sources cited with `as_of`.
Stop and report the headline insight + data sources.

---

## PROMPT 8 — UX polish + accessibility (end-stretch)  ·  Owner B

**Mission:** only if the golden path is done and solid. Contend for Best UI/UX.

**Tasks**
1. Design-token pass across all screens; consistent spacing/type/motion.
2. **WCAG AA**: contrast, focus order, screen-reader labels, 44px touch targets.
3. Mobile-first layout; loading/empty/error states; micro-interactions on the results reveal and the guardrail rewrite.
4. Do not regress the golden path or add new features.

**VERIFY GATE**
- a11y pass (axe or manual checklist) clean; golden path unaffected; mobile + desktop both clean.
Stop and report the a11y checklist.

---

## PROMPT 9 — Submission: Devpost, demo, repo  ·  Owner A+B

**Mission:** ship it before the 2 PM Devpost gate.

**Tasks**
1. **README** — architecture, the Gradient surface used (intake + router + agents + KBs + guardrails + function routing + evals + traces), the DO product map, run instructions.
2. **Devpost** — problem → who it helps → the Gradient depth → the live filing → the commercial model. Link the public GitHub.
3. **3-min demo** — rehearse the golden path script (persona → real number + EITC beat → file it, halt at submit → guardrail rewrite → gap-map close); record the video as backup.
4. **Definition-of-done check** — run every ★ gate: real end-to-end, honest `unlikely`, guardrail rewrite live, evals pass, filer + PDF, offline armed, public repo, submitted < 2 PM.

**VERIFY GATE**
- Every DoD item checked; Devpost submitted with public repo before 2 PM; video recorded.
Stop and report the submission link.

---

### Notes
- If solo or short on time, the sequence collapses to the golden path: 1 → 2 → 3 → 4 → 5 → 9. Everything else is track spillover and depth.
- Constants accuracy is the one load-bearing risk: have each program prompt pull its constants from the official source first and anchor one golden computation against a known calculator (GetCalFresh / IRS EITC tables) before writing dependent tests.
