# Person A — Gradient AI agent graph (Prompt 2)

The DigitalOcean Gradient layer that turns free text into a routed, grounded, guarded call to Person B's `/screen`. **The model does language only** — it never asserts an eligibility outcome, a dollar figure, or a guarantee. Every number comes from `/screen`.

Branch: `feat/p2-gradient-graph`. SDK: `@digitalocean/gradient` (the official DoTs SDK).

## Layout

| Path | What |
|---|---|
| `src/contracts.ts` | Shared `HouseholdProfile` / `ScreeningResult` types (do not change — Person B owns the response). |
| `src/prompts.ts` | Intake / Food / Router agent instructions + the guarantee-adversarial prompt. |
| `src/schemas.ts` | JSON Schemas for the function route. |
| `src/mock-screen.ts` | Local Fastify v4 mock of `/screen` (runs today, before Person B deploys). |
| `src/gradient.ts`, `src/config.ts` | Client factory + env/config. |
| `scripts/list-resources.ts` | State reconciliation — lists existing agents/KBs/models. |
| `scripts/provision.ts` | Idempotent provisioning of the whole graph. |
| `scripts/verify-a1.ts`, `scripts/verify-guardrail.ts` | Adversarial gates A1 / A2. |
| `do-function/` | The FaaS proxy that backs the Gradient function route → forwards to `SCREEN_URL`. |

## Setup

```bash
npm install
cp .env.example .env      # fill DO_API_TOKEN (GenAI scope); SCREEN_URL optional until Person B deploys
```

`DO_API_TOKEN` and `SCREEN_URL` are read from env only — never committed.

## Run order

```bash
# 1. Local mock (runs without any DO token) — the graph is buildable in parallel with Person B
npm run mock                 # POST http://localhost:8787/screen  → contract-valid ScreeningResult[]

# 2. Reconcile state (needs DO_API_TOKEN) — see what already exists, get model UUIDs
npm run resources:list

# 3. Provision the graph (idempotent: reconcile-by-name, never duplicates)
npm run provision            # intake + food agents, food KB + indexing, router + route to food
                             #  → writes .gradient-state.json

# 4. Adversarial gates
npm run verify:a1            # free text → profile (unstated=null) → cited answer + disclaimer; ES; missing-income
npm run verify:guardrail     # "guaranteed $5,000" → rewritten/blocked; disclaimer survives → guardrail-capture.json
```

## Two things that are NOT SDK-scriptable in this alpha (flagged per working rule 3)

### 1. Guardrails — DO Control Panel console step

The `@digitalocean/gradient` alpha exposes no guardrail create/attach method (guardrails appear only as read-only references on an agent). Create + attach them in the console:

> **Gradient AI Platform → Guardrails → Create guardrail**
> - **No-guarantee rewrite:** block/rewrite "guaranteed", "you will receive", "approved", definite-entitlement phrasing → estimate language; keep the disclaimer.
> - **PII safety:** don't echo/store raw sensitive PII (income, immigration status).
> Then **Agents → `bb-food-calfresh-agent` → Guardrails → Attach**, and the same for `bb-router-agent`.

`scripts/verify-guardrail.ts` proves it fires once attached.

### 2. Function route — backed by a DigitalOcean Function (FaaS), not a raw URL

Gradient function routes call a DigitalOcean Function, so `do-function/` is a thin proxy that forwards the profile to `SCREEN_URL` and returns `ScreeningResult[]`.

```bash
doctl serverless connect
SCREEN_URL=<person-B-url> doctl serverless deploy do-function
# note the namespace (fn-xxxx) and function path (benefits/screen), then:
FAAS_NAMESPACE=fn-xxxx FAAS_NAME=benefits/screen npm run provision
```

If `FAAS_NAMESPACE`/`FAAS_NAME` are unset, `provision` skips + flags the function-route step (everything else still provisions).

## Frontend entry point (for Prompt 5)

The frontend calls the **router** agent. After `provision`, `.gradient-state.json` holds `routerEndpoint` + `routerAgentKey`. Invoke via the OpenAI-compatible surface (`client.agents.chat.completions.create`, or `POST {routerEndpoint}/chat/completions` with `Authorization: Bearer {routerAgentKey}`). The captured guardrail before/after lives in `guardrail-capture.json` for the "run adversarial test" button.
