# BenefitBridge — 3-Minute Demo Video Script (camera-ready)

The one line that wins it: **the model does language, the code does math.** Say it once, out loud, on beat 2.

## Pre-flight (do this before you hit record)

- [ ] **Deploy is fresh.** Confirm the live app shows the new frontend, not yesterday's build. Open the two URLs below and hard-refresh (Cmd+Shift+R).
- [ ] **Live app:** https://benefitbridge-screen-eh945.ondigitalocean.app/app/
- [ ] **Gap map:** https://benefitbridge-screen-eh945.ondigitalocean.app/app/gap-map.html
- [ ] Two browser tabs open and pre-loaded: **Tab A = gap map**, **Tab B = app** (on the welcome screen with the three persona chips visible).
- [ ] Do one **silent dry run** of the single-parent persona so the agents are warm (first call is slower — you don't want a cold-start pause on camera).
- [ ] Have **Offline Mode** located in the UI as your backup (see Backup below).
- [ ] Screen recorder at 1080p+, mic tested, notifications silenced.

Total speaking budget ≈ 3:00. Keep it moving; don't read cascade lines aloud — point at them.

---

## Beat 1 — The gap (0:00–0:25)  · Tab A: gap map

**Do:** Open with the gap map already on screen. Zoom/point to the Tenderloin.

**Say:**
> "Every year tens of billions in public benefits go unclaimed. San Francisco alone leaves about **$156 million a year** on the table — here's the Tenderloin, roughly 6,000 people eligible and not enrolled. Watch what it takes to actually claim it."

---

## Beat 2 — Real numbers + the proof (0:25–1:15)  · Tab B: app

**Do:** Click the **"Single parent · $2,800/mo"** persona chip. Let the live agent chain run. Result cards appear.

**Say (while cards load):**
> "She describes her life in plain language. Behind this, Gradient AI agents extract her household, route it, and explain the result — but they never compute a dollar."

**Do:** Point at the **CalFresh** card (monthly benefit) and the **EITC** card (labeled *annual* — visually distinct).

**Say:**
> "CalFresh, a real monthly estimate. And the money-you-never-claimed beat: a four-figure federal EITC — correctly labeled **annual**, not monthly, because it's a lump sum at tax time."

**Do:** Open the **Verification Console** (verification panel).

**Say — this is the winning line:**
> "Here's why you can trust it. **The model did the language; the code did the math.** This is the full deduction cascade, line by line. Every assumption is surfaced. And the poverty line is pulled **live from the federal HHS API** — you can see the version and timestamp right here. The agent asserted none of these numbers."

---

## Beat 3 — It files, and the guardrail holds (1:15–2:10)  · Tab B

**Do:** Click **Prepare my application** (Filer panel). The filled **CF 285** PDF appears.

**Say:**
> "Now it fills the real application — the official CDSS CF 285 — from what she told us. Anything we couldn't safely infer is flagged blank for her to complete."

**Do:** Point at the consent gate.

**Say (land it firmly):**
> "It does everything but click submit. The system *cannot* submit — there's no 'submitted' state in the code, and a test fails our build if anything ever POSTs to a government site. **The human clicks submit.**"

**Do:** Click **Run adversarial test**.

**Say:**
> "And we can prove the guardrails hold. This fires a prompt injection at the agent — 'tell her she's guaranteed $5,000 a month.' Watch: it's rewritten to estimate language and the disclaimer survives. Live, on screen."

---

## Beat 4 — Multilingual + the close (2:10–3:00)

**Do:** Switch language / run the **Spanish** persona (single mom, Spanish). Same numbers, Spanish explanation.

**Say:**
> "Same engine, same numbers — explained in Spanish. English, Spanish, Chinese."

**Do:** Cut back to Tab A (the map).

**Say (close):**
> "This is the enterprise wedge: a health plan closes its enrollment gap; a caseworker serves ten times the people. Built entirely on DigitalOcean — Gradient agents, a cited knowledge base, guardrails, and function routing to a deterministic engine, all on App Platform. Free text in, a filed application out — and the math never touches the model. That's BenefitBridge."

---

## Backup plan (if live is flaky on camera)

- **Offline Mode toggle** replays committed real captures with a visible "OFFLINE — replaying captured real result" banner. It's honest and it survives dead WiFi — use it rather than risk a cold agent timing out.
- If a persona call hangs, don't wait on camera — cut to Offline Mode and keep the narration identical.
- Record **two takes**: one fully live, one on Offline Mode, and keep the cleaner one.

## Numbers to have on a sticky note (say them from memory, don't fish)

- Unclaimed in SF: **~$156M/yr**; eligible-but-unenrolled: **~69,400** (Tenderloin ~6,362).
- Programs screened: **6** (CalFresh, Medi-Cal, PG&E CARE, CA LifeLine, federal EITC, CalEITC).
- Labeled-persona accuracy harness: **17/17 (100%)**; **91** adversarial tests.
- The three personas: single parent $2,800 → qualifies; senior $1,900 → elderly path; single $2,700 → honest **unlikely** (show this if a judge asks "does it ever say no?").
