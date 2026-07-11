#!/usr/bin/env python3
"""Extract San Francisco's latest CalFresh participation + issuance from the
official CDSS CF 256 workbook ("May 2024 and Ongoing") into data/cf256-sf.json.
Dev-time step (needs openpyxl); build-gap-map.ts consumes the JSON.

  python3 scripts/extract-cf256.py
"""
import json, io, sys, urllib.request, datetime
import openpyxl

URL = "https://www.cdss.ca.gov/Portals/9/Additional-Resources/Research-and-Data/DSSDS/Tables/CF256%20May%202024%20and%20Ongoing.xlsx"

def cell_num(v):
    if v in (None, "", "*", "-"):
        return 0
    return float(str(v).replace(",", ""))

raw = urllib.request.urlopen(URL, timeout=120).read()
wb = openpyxl.load_workbook(io.BytesIO(raw), read_only=True)
ws = wb["Data_External"]

rows = ws.iter_rows(values_only=True)
items = None
for r in rows:
    if r[0] == "Date":
        break
    items = r  # the Item-label header sits just above the Cell header

# Column indexes by Item label (robust to cell renumbering).
def col_of(prefix):
    for i, lab in enumerate(items):
        if lab and str(lab).replace("\n", " ").startswith(prefix):
            return i
    raise SystemExit(f"column not found: {prefix}")

c_pa_persons = col_of("Item 2.")
c_npa_persons = col_of("Item 4.")
c_pa_hh = col_of("Item 1.")
c_npa_hh = col_of("Item 3.")
c_issuance = col_of("Item 10.")

latest = None
for r in rows:
    if r[1] == "San Francisco" and (latest is None or r[0] > latest[0]):
        latest = r
if latest is None:
    raise SystemExit("no San Francisco rows found")

persons = cell_num(latest[c_pa_persons]) + cell_num(latest[c_npa_persons])
households = cell_num(latest[c_pa_hh]) + cell_num(latest[c_npa_hh])
issuance = cell_num(latest[c_issuance])

# Adversarial sanity: refuse implausible values rather than shipping them.
assert 30_000 < persons < 300_000, f"persons {persons} out of bounds"
assert 10_000 < households < persons, f"households {households} out of bounds"
if not (100 <= issuance / persons <= 400):
    issuance = 0  # dollars unavailable/implausible: omit rather than guess

out = {
    "report_month": str(latest[0])[:10],
    "county": "San Francisco",
    "persons": int(persons),
    "households": int(households),
    "issuance_usd": int(issuance) or None,
    "source_url": URL,
    "source": "CDSS CF 256 (CalFresh participation and benefit issuance), 'May 2024 and Ongoing' workbook",
    "fetched_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
}
with open("data/cf256-sf.json", "w") as f:
    json.dump(out, f, indent=1)
print(json.dumps(out, indent=1))
