# DELETION PLAN — DigitalOcean resources (HUMAN EXECUTES; nothing deleted yet)

Cross-checked against `CANONICAL.md` on 2026-07-11 via the live DO API.
Execute in the console (Agent Platform → Agents / Functions → Namespaces)
after review. Delete agents before considering the KB question — there is no
KB deletion here at all.

## ✅ Safe to delete — duplicate agent graph (superseded branch-stack set, GLM-5.2, no function route, no guardrails)

| Agent | UUID | Reason |
|---|---|---|
| `bb-intake` | `99df3931-7ce3-11f1-aee4-4e013e2ddde4` | Duplicate of canonical `bb-intake-agent` |
| `bb-food-calfresh` | `9a65fedd-7ce3-11f1-aee4-4e013e2ddde4` | Duplicate of canonical `bb-food-calfresh-agent`; holds no function route (verified). Attached to the shared KB — detach/delete of the agent does not delete the KB. |
| `bb-router` | `9ab10102-7ce3-11f1-aee4-4e013e2ddde4` | Duplicate of canonical `bb-router-agent`; child route only to the duplicate food agent |

## ✅ Safe to delete — test strays

| Agent | UUID | Reason |
|---|---|---|
| `bb-test2-1783744992069` | `05eda01c-7ce3-11f1-aee4-4e013e2ddde4` | Throwaway provisioning test |
| `bb-p1783744914079` | `d76be202-7ce2-11f1-aee4-4e013e2ddde4` | Throwaway provisioning test |

## ⚠️ Delete after one manual check — unused Functions namespace

| Resource | ID | Reason |
|---|---|---|
| Namespace `bb-benefits` (sfo3) | `fn-e8950fee-6e8a-4ccf-be4c-7c3672f4359e` | Earlier wrong-region attempt per `BLOCKED-personB-screen-url.md`; the live proxy is in tor1. **Confirm it contains no functions in the console before deleting** (Functions → Namespaces → fn-e8950fee… → Functions tab empty). |

## 🚫 DO NOT DELETE — canonical (see CANONICAL.md)

| Resource | UUID |
|---|---|
| Router entry `bb-router-agent` | `38c7cbc6-7ce3-11f1-aee4-4e013e2ddde4` |
| Food agent `bb-food-calfresh-agent` (holds live `screen_calfresh` route) | `37c460cf-7ce3-11f1-aee4-4e013e2ddde4` |
| Intake `bb-intake-agent` | `12e74db0-7ce3-11f1-aee4-4e013e2ddde4` |
| KB `bb-kb-food-calfresh` (shared; still indexing) | `5fc08ddd-7ce2-11f1-aee4-4e013e2ddde4` |
| Functions namespace `benefitbridge` (tor1) — backs the live route | `fn-2b5e6189-5bf1-4e3e-bbce-2f963fb0e76e` |

Post-deletion sanity check: `npm run resources:list` should show exactly the
three canonical agents and one KB; the Food agent detail should still show the
`screen_calfresh` function route.
