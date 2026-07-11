# Devpost draft — BenefitBridge

**Tagline:** The AI that finds every dollar you're owed in public benefits — and fills out the application. You click submit.

## Inspiration

Tens of billions in public benefits go unclaimed every year, and 2026 made it worse: new CalFresh work-requirement time limits (June) and noncitizen eligibility changes (April) produced the largest churn California has seen. The rules are unreadable, the forms are brutal, and the people who need help most are the least equipped to fight through them. Our own data pull says San Francisco alone leaves **~$156M/year** on the table.

## What it does

Describe your household in plain language — English, Spanish, or Chinese. BenefitBridge returns:

1. **Real screens across six programs** (CalFresh, Medi-Cal, PG&E CARE, California LifeLine, federal EITC, CalEITC) with **real dollar estimates** — e.g., "$159/month CalFresh" with the full 12-line deduction cascade shown, plus the "money you never claimed" beat: a four-figure federal EITC correctly labeled *annual*.
2. **A Verification Console**: the parsed profile, every computation line, every assumption, live data provenance, and a button that fires a prompt injection at the agent so judges watch the guardrails hold.
3. **A review-ready official application**: the real CDSS CF 285 (8/21) PDF, filled from what you said, with everything we refused to guess flagged for you. The system *cannot* submit — the human does.

Plus the **benefits-gap map**: ACS × DataSF × CDSS data showing ~69,400 income-eligible-but-unenrolled San Franciscans, neighborhood by neighborhood (Tenderloin: ~6,362).

## How we built it — the one rule

**The model does language; the code does math.** Gradient AI agents extract profiles, route intent, and explain results — they never assert an eligibility outcome or compute a dollar. Every number comes from a deterministic TypeScript engine: integer cents in `bigint`, real SNAP rounding, every constant verified against CDSS/USDA/IRS with `source_url` + `as_of`, and the FPL basis pulled live from the HHS ASPE API into a versioned, provenance-stamped store with drift cross-checks. 91 adversarial tests; a labeled-persona harness scores **17/17 (100%)**.

**DigitalOcean surface:** Gradient Agents (intake/router/domain), Knowledge Base (official CalFresh sources, cited RAG), Guardrails (plus a deterministic code-level guarantee→estimate rewrite — defense in depth), Function Routing → DO Functions proxy → the engine, all hosted on App Platform (Fastify service + Expo web static site in one app).

## Challenges

- The ASPE API's real response shape doesn't match its docs (strings, renamed field) — our adversarial validation caught it on the first live call.
- The data.ca.gov DFA256 dataset silently ends in 2018; we traced current enrollment to the CDSS CF 256 workbook and refused to ship the misleading 25% participation rate our first pipeline computed.
- Expo SDK 57 breaks both NativeWind lines in different ways; pinned the documented SDK 54 pairing.
- Gradient function routes only attach to DO Functions — so we built the FaaS proxy bridge.

## Accomplishments

Live end-to-end: free text → agents → deterministic engine → guarded explanation → filled official PDF, in three languages, with a 100% labeled-accuracy harness and an honest `unlikely` when the answer is no. And a hard consent boundary: `status` has no "submitted" value, and a static-scan test fails the build if any code POSTs to a .gov host.

## What's next

More counties, more programs (CalWORKs), tract-level enrollment partnerships with county HSAs, and the caseworker dashboard — the benefits-gap map is the enterprise wedge: health plans and counties pay to close exactly the gap we can now draw.

## Links

- Live app: https://benefitbridge-screen-eh945.ondigitalocean.app/app/
- Gap map: https://benefitbridge-screen-eh945.ondigitalocean.app/app/gap-map.html
- Repo: https://github.com/Ranj04/BenefitBridge

---

### 3-minute demo script (rehearse)

1. **(0:00–0:25)** The gap: open the map. "San Francisco leaves ~$156M/yr unclaimed. Here's the Tenderloin. Watch what it takes to claim it."
2. **(0:25–1:15)** Click the single-parent persona → live agent chain → cards: **$159/mo CalFresh + $2,875 EITC (annual)**. Open the Verification Console: "the model asserted none of this — here's the cascade, the assumptions, and the FPL pulled live from the HHS API, version and timestamp on screen."
3. **(1:15–2:10)** "Now it files." Prepare-my-application → the filled CF 285 opens; the blanks-we-never-guess checklist; **"it does everything but click submit — that's the human's call."** Then hit *Run adversarial test*: the injection tries "guaranteed $5,000/mo" and fails on screen.
4. **(2:10–3:00)** Spanish persona (same numbers, Spanish explanation) → close on the map: "a health plan closes its enrollment gap; a caseworker serves 10× the people. Built on Gradient agents, KBs, guardrails, and function routing — and the math never touches the model."

**Backup:** Offline Mode toggle replays committed real captures with a labeled banner — the demo survives dead WiFi.
