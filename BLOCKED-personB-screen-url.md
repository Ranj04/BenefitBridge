# 🚩 BLOCKER for Person B — deploy `/screen` + hand back the URL (ASAP)

**Owner:** Person B · **Blocks:** Prompt 2 Gate A1 e2e leg (the prize-critical "real cited CalFresh screen" moment) · **Raised:** 2026-07-10

## What's blocked

Person A's Gradient graph is wired and live except the **router → Food → `/screen`** leg. The Food agent's `screen_calfresh` function route can't be registered because there is **no publicly-reachable `SCREEN_URL`** to forward to. Everything else on A1 is green (intake extraction 5/5, invoke path, KB indexing running).

## What Person A already did (so this is one step for you)

- `doctl` authed; DO Functions namespace **`fn-e8950fee-6e8a-4ccf-be4c-7c3672f4359e`** (sfo3) created + connected.
- `do-function/` transport shim is deploy-ready — it just needs a `SCREEN_URL`.

## What Person B needs to do (ASAP)

1. **Deploy `POST /screen`** to App Platform (Prompt 1 output): `HouseholdProfile` → `ScreeningResult[]`, matching `src/contracts.ts` exactly (`disclaimer`, `citations[]`, `estimatedBenefit.period`, `screening` enum all required).
2. **Hand Person A the live URL** (the full `.../screen` path).

That's it. Person A then runs: write `do-function/.env` (`SCREEN_URL=<your url>`) → `doctl serverless deploy do-function --env do-function/.env` → `FAAS_NAMESPACE=fn-e8950fee-6e8a-4ccf-be4c-7c3672f4359e FAAS_NAME=benefits/screen npm run provision` → `npm run verify:a1` → A1 e2e goes green.

## Fallback if `/screen` isn't ready in time

Person A can tunnel the local contract-valid mock (`npm run mock` + ngrok) to get a green demo — but that's a stopgap with an ephemeral URL. **Real `/screen` is the goal.**
