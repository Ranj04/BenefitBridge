# 🚩 For Person B — deploy `/screen` + hand back the URL (needed for Phase A3, not A1)

**Owner:** Person B · **Blocks:** Prompt 2 **Phase A3** (real-data e2e) · **Raised:** 2026-07-10 · **Updated:** 2026-07-10 — A1 is NO LONGER blocked

## Status update (2026-07-10, later)

The `do-function/` FaaS proxy now has a **mock fallback**: with `SCREEN_URL` empty it returns the canned contract-valid `ScreeningResult[]` (mirrors `src/mock-screen.ts`). It is **deployed** to namespace **`fn-2b5e6189-5bf1-4e3e-bbce-2f963fb0e76e` (tor1** — same region as the agents**)** and registered on the Food agent as the `screen_calfresh` function route. Gate A1 therefore runs end-to-end on the mock, which the phase prompt explicitly allows ("mock ok").

> Note: an earlier attempt created namespace `fn-e8950fee-6e8a-4ccf-be4c-7c3672f4359e` (sfo3). It is unused — the live one is `fn-2b5e6189…` (tor1). The sfo3 one can be deleted in the console (Functions → Namespaces) once confirmed empty.

## What Person B still needs to do (for A3)

1. **Deploy `POST /screen`** to App Platform (Prompt 1 output): `HouseholdProfile` → `ScreeningResult[]`, matching `src/contracts.ts` exactly (`disclaimer`, `citations[]`, `estimatedBenefit.period`, `screening` enum all required).
2. **Hand Person A the live URL** (the full `.../screen` path).

Person A then: set the literal `SCREEN_URL` in `do-function/project.yml` (doctl's env substitution rejects empty values, so it's a literal there) → `doctl serverless deploy do-function` → re-run `npm run verify:a1` + `npm run verify:guardrail` → Gate A3.
