# Browser fill — rehearsable demo script (HALTS AT SUBMIT)

The live "it files" moment: a browser agent (Claude in Chrome) fills the
application on screen while the reviewed PDF sits alongside. **The flow stops
hard before any submit action — the human clicks submit, always.**

## Targets (open, assist-friendly — NEVER login-gated portals)

1. **Primary: the filled CF 285 PDF in the browser.** Zero external writes:
   `POST /fill` → open `pdfUrl` in Chrome → the form is already filled; walk
   the reviewer through `fields` and `blankFields`. This is the reliable
   artifact if anything wobbles mid-demo.
2. **Showpiece: GetCalFresh (getcalfresh.org).** Open front end by Code for
   America. Fill its steps from `FilledApplication.fields` live on screen.
   ⚠️ Only run this against GetCalFresh during the rehearsed demo — advancing
   its pages sends data to their servers. Do not automate BenefitsCal (login-
   gated, ToS-hostile) under any circumstances.

## The run (rehearse this exact sequence)

1. `curl -X POST $SCREEN_HOST/fill -d '{"profile": <persona>, "program": "CalFresh"}'`
   → keep the JSON: `fields` drives the fill, `blankFields` is the checklist.
2. Open `pdfUrl` in a Chrome tab — reviewer sees the completed official form.
3. (Showpiece) New tab → getcalfresh.org → "Apply now". For each page, fill
   ONLY values present in `fields`; leave everything else untouched. Say out
   loud what's being skipped and why ("we don't invent data").
4. **HARD STOP RULE: when any button reads Submit / Send / File / Sign, the
   agent stops, scrolls it into view, and says: "This is where I stop — you
   submit."** The instruction to the browser agent must include: never click
   an element whose text matches /submit|send application|file now|sign/i.
5. The human reviews `blankFields`, completes them, and clicks submit
   themselves. Status stays `staged_awaiting_user_submit` on our side.

## Why this boundary exists

Programmatic submission of a government application is a legal, PII, and
trust boundary. `FilledApplication.status` cannot represent "submitted" —
the type has no such value — and no code path POSTs to a government endpoint
(statically checked in tests/filer.test.ts).
