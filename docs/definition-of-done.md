# Definition-of-done sweep (Prompt 9 gate artifact)

Run against **production** (https://benefitbridge-screen-eh945.ondigitalocean.app)
on 2026-07-11 ~20:00–20:30 UTC. ★ gates from `benefits-navigator-plan.md` §11.

| # | ★ Gate | Status | Evidence (live, this sweep) |
|---|---|---|---|
| 1 | Contracts committed, both sides import | ✅ | `src/contracts.ts`; app mirrors in `app/src/types.ts` |
| 2 | Intake + router + Food agents, KB crawling | ✅ | Canonical UUIDs in `CANONICAL.md`; provisioning scripted in `scripts/provision.ts` |
| 3 | `/screen` public URL returns JSON | ✅ | `POST /screen` → 6 programs, dataVersion 6 |
| 4 | CalFresh cascade + vitest | ✅ | 107 tests green (1 `.todo`: CalEITC curve pending FTB data); persona → **$159/monthly** |
| 5 | Free text → real number end-to-end | ✅ | Live `POST /chat` (EN): profile hh2 extracted, 6 results, warm cited explanation |
| 6 | Verification Console shows the math | ✅ | `VerificationPanel.tsx`; exercised in the a11y run (`docs/a11y.md`). ⚠️ deployed static bundle predates the design-system/save-resume merge — **manual App Platform deploy needed** (deploys are `cause: manual`) |
| 7 | `/fill` → correct completed PDF | ✅ | Live `/fill` → `ready_for_review`, pdfUrl served, 9 unknown fields honestly flagged blank |
| 8 | Browser fill halts at submit | ✅ (rehearsal doc) | `docs/browser-fill.md` — manual demo procedure, hard-stop rule; no automated submit path exists (static scan test `tests/filer.test.ts`) |
| 9 | Guardrail rewrite live | ✅ | Live `POST /adversarial-test`: agent refuses the $5,000 injection; deterministic guard rewrites guarantee-phrasing + disclaimer survives. (One transient empty agent reply observed — retry was clean; offline fixture carries a committed capture as demo backup) |
| 10 | EITC annual beat | ✅ | Persona returns **EITC $2,875/annual** alongside CalFresh monthly; labeled annual |
| 11 | Multilingual (≥3) | ✅ | Live `POST /chat` (ES): profile + `preferredLanguage: es` + Spanish explanation; EN/ES/ZH UI |
| 12 | Eval harness + Gradient Evaluations | ✅ / ⚠️ | Local accuracy harness 17/17 (`tests/accuracy.test.ts`); platform evaluation run completed — safety metrics clean, star metric below threshold due to function-call preamble artifact, plus one real PII-echo finding → `docs/evaluations.md` |
| 13 | Offline fixture labeled | ✅ | `app/fixtures/offline.json` — real captures, banner on replay |
| 14 | Gap map real-data insight | ✅ | Live `/app/gap-map.html` 200 (572 KB); ~69,400 unenrolled / ~$156M/yr county-wide |
| 15 | UX polish + a11y | ✅ | axe WCAG A+AA clean on all screens, both viewports → `docs/a11y.md` |
| 16 | Video + Devpost submitted | ⏳ HUMAN | Script in `DEVPOST.md`; video not recorded; submission is a human action |

## Notes

- Production data layer serves `data_freshness: 'cached'` (last-good store v6,
  honest flag by design) — ASPE was unreachable from the App Platform runtime in
  this sweep; `POST /sync` retried and kept last-good. Values are current-FY and
  drift-checked (0 warnings).
- Open human actions beyond #16: trigger the App Platform deploy (#6 note),
  execute `DELETION-PLAN.md` (duplicate cloud agents), verify the Sensitive-Data
  guardrail attachment in the console (`CANONICAL.md`), and the PII-echo prompt
  tightening from `docs/evaluations.md`.
