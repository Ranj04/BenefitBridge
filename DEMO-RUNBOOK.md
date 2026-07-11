# DEMO-RUNBOOK — the golden path, click by click

Demo URL: **https://benefitbridge-screen-eh945.ondigitalocean.app/app/**
Gap map: **https://benefitbridge-screen-eh945.ondigitalocean.app/app/gap-map.html**

## Preflight (do this 15 minutes before, on the demo machine + browser)

1. Open the demo URL. Confirm the warm welcome screen loads (BenefitBridge ember, trust chips).
2. Click the **Single parent · $2,800/mo** chip once, end to end, and WAIT for results
   (~35–60s — the live agent chain is slow, not broken). This warms the path and
   confirms venue WiFi. Then click **Start over**.
3. Confirm the **Offline demo** pill is visible top-right — that's your escape hatch.
4. Keep one spare tab on the gap map.

## The 3-minute golden path

| Step | Click | Expect on screen |
|---|---|---|
| 1 (0:00) | Gap-map tab | Choropleth + "estimates, not determinations" banner. Say: "~$156M/yr unclaimed in SF; Tenderloin ~6,362 people." |
| 2 (0:25) | Demo tab → **Single parent · $2,800/mo** chip | Skeleton loader with "Reading what you told us…" — talk over the 35–60s wait: "live agent chain: intake extracts, router routes, the deterministic engine computes." |
| 3 | (results land) | Hero: **"You may be owed about $159 a month, plus $2,875 a year in tax credits."** Program cards; the EITC card carries the amber **Annual tax credit** badge — the big-dollar beat. |
| 4 (1:15) | **See how we know ▾** | Verification Console: parsed profile, 12-line deduction cascade, assumptions, provenance stamp (store version + fetched timestamp), guardrail chip. Say: "the model asserted none of these numbers." |
| 5 | **Run adversarial test** (inside the console) | Before/after: injection asks for "guaranteed $5,000/mo" → refusal + rewrite to estimate language, disclaimer intact. If the "before" comes back empty (rare transient), click it again — or use the Offline capture. |
| 6 (2:10) | **Prepare my application** (CalFresh card) | Filled official CF 285 PDF opens in a tab; back in the app, the blanks-we-refused-to-guess checklist + the consent gate: **"you review and submit — we never submit for you."** |
| 7 (2:35) | Back → **Start over** → Spanish selector (Español) → **Single parent** chip | Same real numbers, explanation in Spanish. Close on the gap map: the commercial wedge. |

Numbers you can say with confidence (all verified live today): **$159/mo CalFresh**,
**$2,875/yr federal EITC**, **6 programs**, **123 tests**, **~$156M/yr SF gap**.

## If the network dies (labeled fallback — real captures, never fabricated)

1. Tap **Offline demo** (top-right). An amber banner appears:
   *"Offline — replaying a captured real result (recorded from the live system)."*
2. Run the same personas — all three replay committed real captures
   (`app/fixtures/offline.json`, captured from the live system today), including
   the Verification Console, a real adversarial before/after, and the filled-PDF panel.
3. Say it straight: "we lost the network, so this is a labeled replay of a real
   run we captured earlier — nothing here is synthetic." That honesty IS the thesis.

## The guaranteed 90-second version (if everything is on fire)

Offline demo ON → Single parent chip → hero number → See how we know →
adversarial capture → filled-PDF panel → gap map. Entirely real captured data,
zero network dependence.

## Known risks and how to handle them

- **Live /chat latency (35–90s):** by design (two agent hops). Narrate over it. If it
  degrades, the app still shows the real engine numbers with a templated explanation.
- **Transient empty adversarial reply:** click the button again; second run has been clean.
- **Provenance shows "cached":** the honest last-good fallback (ASPE unreachable from
  the App Platform box). Phrase per CLAIMS-TRUTH.md row 7.
- **Do not** improvise: Chinese end-to-end (not re-verified today), the browser
  fill (manual procedure, not a button), or any program/number not listed above.
