# CLAIMS-TRUTH — every demo/Devpost claim vs. what actually runs

Verified 2026-07-11 afternoon against **production**
(https://benefitbridge-screen-eh945.ondigitalocean.app) and the committed repo.
"Backed" = I ran it or read the committed artifact today.

| # | Claim (Devpost / demo script) | Verdict | Evidence |
|---|---|---|---|
| 1 | ~$156M/yr unclaimed in SF; ~69,400 eligible-but-unenrolled; Tenderloin ~6,362 | **BACKED** | `data/gap-map.json` (`estUnclaimedPerYearUsd: 156260375`), method + ACS/DataSF/CDSS sources committed; live at `/app/gap-map.html` (200) |
| 2 | Real screens across six programs with real dollar estimates ($159/mo CalFresh) | **BACKED** | Live `POST /screen` today: CalFresh likely_qualify $159/monthly + 5 more programs, full cascade |
| 3 | Four-figure federal EITC, labeled *annual* | **BACKED** | Live: EITC $2,875/annual; UI renders the amber "Annual tax credit" badge |
| 4 | Verification Console: profile, cascade, assumptions, provenance, injection button | **BACKED** (one caution) | Component live-exercised; `POST /adversarial-test` fired today: agent refused, code guard rewrote. Caution: one transient empty agent reply was observed once — if it happens on stage, click again (retry was clean) or flip to Offline (committed real capture) |
| 5 | Fills the real CDSS CF 285 (8/21); refuses to guess; human submits | **BACKED** | Field-by-field AcroForm QA today: 5 profile fields match exactly, 9 blanks honestly blank; `status` type has no "submitted"; static scan test blocks .gov POSTs |
| 6 | English, Spanish, or Chinese | **PARTIAL** | EN and ES verified live end-to-end **today** (ES: profile + `preferredLanguage: es` + Spanish explanation). ZH: UI strings + agent support exist and were claimed verified in the p6 work, but there is **no committed ZH capture and it was not re-verified today**. Demo script uses ES — safe. **Don't ad-lib a Chinese demo without a rehearsal run first.** |
| 7 | FPL pulled live from HHS ASPE into a versioned, provenance-stamped store with drift checks | **BACKED, say it precisely** | The store IS live-fetched, versioned (v7/v8), checksummed, drift-checked (0 warnings). BUT production currently serves `data_freshness: 'cached'` (ASPE unreachable from App Platform runtime; honest last-good fallback by design). On stage say: "pulled from the government's structured API into a versioned store — here's the source, version, and timestamp," and let the honest `cached` flag be the resilience story if asked |
| 8 | "91 adversarial tests" (Devpost) | **STALE — UNDERCOUNT** | Suite is now 122 passed + 1 `.todo` (123). Update the number before submitting |
| 9 | Labeled-persona harness 17/17 (100%) | **BACKED** | `tests/accuracy.test.ts` — 12 personas / 17 checked outcomes, green in today's runs |
| 10 | Guardrails rewrite "guaranteed" phrasing; injection fails on screen | **BACKED** | Live today: refusal + deterministic guarantee→estimate rewrite + disclaimer survives. Platform Jailbreak guardrail attached (console-verified per CANONICAL.md); the rewrite itself is deterministic code — say "defense in depth", don't attribute the rewrite to the platform |
| 11 | Gradient platform evaluations | **BACKED with caveats** | A real evaluation ran today (run d47a7035…): toxicity 0, injection-resistance 100, guarantee prompt refused. Star metric scores low for a documented function-call-preamble reason, and it flagged the agent echoing income back (PII note). Full honesty in `docs/evaluations.md` — cite that doc, don't just say "evals pass" |
| 12 | Live browser agent fills the form and halts at submit | **PARTIAL — manual, not in demo path** | A rehearsed manual Claude-in-Chrome procedure (`docs/browser-fill.md`), QA'd today at the surface level (hard-stop matcher verified; zero writes sent). There is **no in-app button** and it is not in the 3-min script. Keep it out of the live demo; describe it as the documented procedure it is |
| 13 | Offline backup replays committed real captures, labeled | **BACKED** | `app/fixtures/offline.json`: real live captures (agentLayer "live", real provenance timestamps, real adversarial before/after); banner always shown |
| 14 | Function routing → DO Functions proxy → engine | **BACKED** | Canonical route `screen_calfresh` (CANONICAL.md); A3 verified live |
| 15 | "In one app on App Platform" (service + static site) | **BACKED** | Deployed today; `/app/` serves the current bundle (design system + save & resume live) |

## Cut/fix list before submitting
1. Devpost: change "91 adversarial tests" → current count (123 incl. 1 honest `.todo`).
2. Devpost line 34 "in three languages" → "in English and Spanish, with Chinese support built in" **or** run one rehearsed ZH end-to-end first.
3. Keep the browser-fill out of the live demo path (already out of the script) and phrase it as a rehearsed manual procedure.
4. If asked about "live FPL" on stage, use the precise phrasing from row 7.
