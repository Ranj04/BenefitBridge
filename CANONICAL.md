# CANONICAL — single source of truth for live resource identifiers

Every prompt, person, and frontend wire-up reads endpoint identifiers from THIS
file. If a resource isn't listed here, don't build against it (see
`DELETION-PLAN.md` for the duplicates and why they exist).

Verified live against the DigitalOcean API on 2026-07-11.

## Agent graph (canonical = the root-level stack on `main`)

| Role | Agent | UUID | Endpoint |
|---|---|---|---|
| **Router — THE frontend entry point** | `bb-router-agent` | `38c7cbc6-7ce3-11f1-aee4-4e013e2ddde4` | `https://pjz3iqqbx3hix3o3ec4mxykh.agents.do-ai.run` |
| Food domain (CalFresh) | `bb-food-calfresh-agent` | `37c460cf-7ce3-11f1-aee4-4e013e2ddde4` | `https://k27cwswncylretywmhlgmjrr.agents.do-ai.run` |
| Intake (free text → HouseholdProfile) | `bb-intake-agent` | `12e74db0-7ce3-11f1-aee4-4e013e2ddde4` | `https://wldkgxkzoccd2m6rm7vxokus.agents.do-ai.run` |

Model: OpenAI GPT-4o. Router child-routes to the Food agent. Chat is the
OpenAI-compatible `POST {endpoint}/api/v1/chat/completions` with an agent
access key (keys live in `.gradient-state.json` / `.env` on the provisioning
machine — never in git, never in this file).

## Knowledge base

| Name | UUID | Notes |
|---|---|---|
| `bb-kb-food-calfresh` | `5fc08ddd-7ce2-11f1-aee4-4e013e2ddde4` | Sources: sfhsa.org CalFresh + cdss.ca.gov/calfresh. Shared by both stacks — canonical, do not touch. |

## Function route (the /screen bridge)

- Route name: **`screen_calfresh`** on the Food agent above
- Backing DigitalOcean Function: **`benefits/screen`** in namespace **`fn-2b5e6189-5bf1-4e3e-bbce-2f963fb0e76e` (tor1)**
- Source: `do-function/packages/benefits/screen/index.js`; config `do-function/project.yml`

## SCREEN_URL — LIVE (Person B deployed 2026-07-11)

```
SCREEN_URL = https://benefitbridge-screen-eh945.ondigitalocean.app/screen
```

App Platform app `benefitbridge-screen` (`407a28a4-2d79-4187-ab50-df793d4bc37f`,
region tor, branch `feat/phase0-1-screen-engine`, health check `/health`).
Verified live: real persona → `likely_qualify` $159/monthly, 3 citations,
disclaimer, no mock markers; malformed body → 400.

The one edit to go live (Phase A3): put the literal URL into
`do-function/project.yml` (`SCREEN_URL: ''` → the real URL; doctl rejects
empty env substitution, hence the literal), then
`doctl serverless deploy do-function` and re-run `npm run verify:a1` +
`npm run verify:guardrail`. Also record the URL here.

## Guardrails

Attached in the console (no public API): **Jailbreak** confirmed on the router
and Food agents via the API. The README additionally claims **Sensitive Data**
— the API detail doesn't list it, so verify in the console (Agent Platform →
Guardrails). Defense in depth: the deterministic no-guarantee guard
(`src/guard.ts`) rewrites guarantee phrasing in code regardless of platform
guardrails.
