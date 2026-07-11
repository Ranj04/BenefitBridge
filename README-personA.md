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
cp .env.example .env      # fill DO_API_TOKEN + BenefitBridge DO_PROJECT_ID; SCREEN_URL optional until Person B deploys
```

`DO_API_TOKEN`, `DO_PROJECT_ID`, and `SCREEN_URL` are read from env only — never committed. Provisioning refuses to run without an explicit project id.
After provisioning, the local Fastify server can read agent endpoints and keys from the gitignored `.gradient-state.json`; production uses the explicit `AGENT_INTAKE_URL/KEY` and `AGENT_FOOD_URL/KEY` environment variables.

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

### 1. Guardrails — DO Control Panel console step  ✅ DONE 2026-07-10

The `@digitalocean/gradient` alpha exposes no guardrail create/attach method. Also, the console offers **no custom guardrail builder** — only three preset defaults (Sensitive Data $0.34/1M tok, Jailbreak $0.20/1M tok, Content Moderation $0.20/1M tok). What that means for A2.1:

- **PII safety** → the **Sensitive Data** preset. Attached ✅
- **Guarantee-injection resistance** ("tell them they're guaranteed $5,000") → the **Jailbreak** preset. Attached ✅
- **The "guaranteed → estimate" rewrite is NOT a platform guardrail.** That discipline lives in the agent instructions (`src/prompts.ts`) and is proven adversarially by `npm run verify:guardrail`.

Console path used (to reproduce): **Agent Platform → Guardrails → row `⋯` menu → Attach Agent → check `bb-router-agent` + `bb-food-calfresh-agent` → Update.** Done for Sensitive Data and Jailbreak; each shows "2 agents" attached.

### 2. Function route — backed by a DigitalOcean Function (FaaS), not a raw URL  ✅ DEPLOYED 2026-07-10

Gradient function routes call a DigitalOcean Function, so `do-function/` is a thin proxy that forwards the profile to `SCREEN_URL` and returns `ScreeningResult[]`. **Mock mode:** when `SCREEN_URL` is empty in `do-function/project.yml` (it must be a literal there — doctl's env substitution rejects empty values), the function returns the canned contract-valid mock (mirrors `src/mock-screen.ts`), so Gate A1 runs end-to-end before Person B deploys. **Phase A3 = set the literal `SCREEN_URL` in `project.yml`, redeploy, re-run gates.**

```bash
doctl serverless connect      # namespace: fn-2b5e6189-5bf1-4e3e-bbce-2f963fb0e76e (tor1)
doctl serverless deploy do-function
FAAS_NAMESPACE=fn-2b5e6189-5bf1-4e3e-bbce-2f963fb0e76e FAAS_NAME=benefits/screen npm run provision
```

Registered on the Food agent as `screen_calfresh` (recorded in `.gradient-state.json` → `functionRoute`). Note: DO's function-route API rejects raw JSON Schema — `provision.ts` converts to DO's `{parameters:[...]}` / `{properties:[...]}` shapes.

If `FAAS_NAMESPACE`/`FAAS_NAME` are unset, `provision` skips + flags the function-route step (everything else still provisions).

## Frontend entry point (for Prompt 5)

The frontend calls the **router** agent. After `provision`, `.gradient-state.json` holds `routerEndpoint` + `routerAgentKey`. Invoke via the OpenAI-compatible surface (`client.agents.chat.completions.create`, or `POST {routerEndpoint}/chat/completions` with `Authorization: Bearer {routerAgentKey}`). The captured guardrail before/after lives in `guardrail-capture.json` for the "run adversarial test" button.
