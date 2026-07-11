/**
 * Prompt 7 — the benefits-gap map (Best Use of Data).
 * Pulls THREE real official sources, validates them adversarially, computes
 * eligible-but-unenrolled CalFresh population per SF Analysis Neighborhood,
 * and emits a self-contained choropleth page + a provenance JSON.
 *
 *   npx tsx scripts/build-gap-map.ts
 *
 * METHOD (stated on the page too — no black box):
 *  eligible(tract)   = ACS C17002 population under 200% FPL (CalFresh/BBCE
 *                      gross screen proxy; individual-level rules differ)
 *  eligible(nhood)   = Σ eligible(tract) via the DataSF tract→neighborhood
 *                      crosswalk
 *  participationRate = county CalFresh persons (CDSS CF 256, latest month)
 *                      ÷ county eligible
 *  unenrolled(nhood) = eligible(nhood) × (1 − participationRate)
 *                      — assumes a uniform county rate by neighborhood
 *                      (tract-level enrollment is not public); labeled.
 * Every number is an estimate and labeled as such.
 */
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';

const OUT_HTML = 'app/public/gap-map.html';
const OUT_JSON = 'data/gap-map.json';

const SOURCES = {
  acs: {
    url: 'https://api.censusreporter.org/1.0/data/show/latest?table_ids=C17002&geo_ids=140|05000US06075',
    cite: 'US Census Bureau ACS 5-year, table C17002 (ratio of income to poverty level), San Francisco County tracts — via Census Reporter API',
  },
  crosswalk: {
    url: 'https://data.sfgov.org/resource/sevw-6tgi.json?$limit=400&$select=geoid,neighborhoods_analysis_boundaries,the_geom,data_as_of',
    cite: 'DataSF: Analysis Neighborhoods — 2020 census tracts assigned to neighborhoods (sevw-6tgi)',
  },
  cf256: {
    url: 'https://www.cdss.ca.gov/Portals/9/Additional-Resources/Research-and-Data/DSSDS/Tables/CF256%20May%202024%20and%20Ongoing.xlsx',
    cite: "CDSS CF 256 — CalFresh participation and benefit issuance, 'May 2024 and Ongoing' workbook (extracted by scripts/extract-cf256.py)",
  },
};

// Sequential blue ramp (dataviz reference palette), light→dark, 5 classes.
const RAMP = ['#b7d3f6', '#86b6ef', '#3987e5', '#1c5cab', '#0d366b'];

async function fetchJson<T>(url: string): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 120_000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`${res.status} for ${url}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(t);
  }
}

const num = (s: unknown): number => {
  const n = Number(String(s ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : NaN;
};

async function main() {
  const fetched_at = new Date().toISOString();

  // ---- 1. ACS: under-200%-FPL population per tract -------------------------
  type CR = { release: { name: string }; data: Record<string, { C17002: { estimate: Record<string, number> } }> };
  const acs = await fetchJson<CR>(SOURCES.acs.url);
  const tracts = new Map<string, { under200: number; total: number }>();
  for (const [geoid, d] of Object.entries(acs.data)) {
    const e = d.C17002.estimate;
    const under200 = e.C17002002 + e.C17002003 + e.C17002004 + e.C17002005 + e.C17002006 + e.C17002007;
    const total = e.C17002001;
    // adversarial: parts must not exceed the universe
    if (under200 > total) throw new Error(`ACS inconsistency at ${geoid}: under200 ${under200} > total ${total}`);
    tracts.set(geoid.replace('14000US', ''), { under200, total });
  }
  if (tracts.size < 200) throw new Error(`expected ~244 SF tracts, got ${tracts.size} — refusing`);

  // ---- 2. DataSF crosswalk + tract geometry --------------------------------
  type XRow = { geoid: string; neighborhoods_analysis_boundaries: string; the_geom: { type: string; coordinates: number[][][][] }; data_as_of?: string };
  const xwalk = await fetchJson<XRow[]>(SOURCES.crosswalk.url);
  if (xwalk.length < 200) throw new Error(`crosswalk returned ${xwalk.length} tracts — refusing`);

  // ---- 3. CDSS CF 256: county persons + issuance (extract-cf256.py) --------
  const cf256 = JSON.parse(readFileSync('data/cf256-sf.json', 'utf8')) as {
    report_month: string; persons: number; issuance_usd: number | null; fetched_at: string;
  };
  const persons = cf256.persons;
  if (persons < 30_000 || persons > 300_000) throw new Error(`SF persons ${persons} outside sane bounds — refusing`);
  const ageDays = (Date.now() - new Date(cf256.fetched_at).getTime()) / 86_400_000;
  if (ageDays > 60) throw new Error(`cf256-sf.json is ${ageDays.toFixed(0)} days old — re-run scripts/extract-cf256.py`);
  const issuance: number | null = cf256.issuance_usd;
  const latest = { Date: cf256.report_month };

  // ---- compute ---------------------------------------------------------------
  type Hood = { eligible: number; totalPop: number; tracts: XRow[] };
  const hoods = new Map<string, Hood>();
  let countyEligible = 0;
  for (const row of xwalk) {
    const t = tracts.get(row.geoid);
    if (!t) continue;
    const h = hoods.get(row.neighborhoods_analysis_boundaries) ?? { eligible: 0, totalPop: 0, tracts: [] };
    h.eligible += t.under200;
    h.totalPop += t.total;
    h.tracts.push(row);
    hoods.set(row.neighborhoods_analysis_boundaries, h);
    countyEligible += t.under200;
  }
  const rate = persons / countyEligible;
  if (rate <= 0 || rate >= 1.2) throw new Error(`participation rate ${rate.toFixed(2)} implausible — refusing`);
  const effRate = Math.min(rate, 1);

  const perHood = [...hoods.entries()]
    .map(([name, h]) => ({
      name,
      eligible: h.eligible,
      unenrolled: Math.round(h.eligible * (1 - effRate)),
      shareUnder200: h.totalPop ? h.eligible / h.totalPop : 0,
    }))
    .sort((a, b) => b.unenrolled - a.unenrolled);

  const top = perHood[0];
  const countyUnenrolled = Math.round(countyEligible * (1 - effRate));
  const avgPerPerson = issuance ? issuance / persons : null;
  const unclaimedYear = avgPerPerson ? Math.round(countyUnenrolled * avgPerPerson * 12) : null;

  // ---- render ----------------------------------------------------------------
  // Equirectangular projection over the SF bbox; y flipped for SVG.
  // The Farallon Islands (lon < -122.55) belong to SF County but would squash
  // the city — omitted from DISPLAY only; their population stays in the numbers.
  const offshore = (ring: [number, number][]) => ring.every(([lon]) => lon < -122.55);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  const each = (cb: (lon: number, lat: number) => void) => {
    for (const h of hoods.values())
      for (const t of h.tracts)
        for (const poly of t.the_geom.coordinates)
          for (const ring of poly) {
            if (offshore(ring as unknown as [number, number][])) continue;
            for (const [lon, lat] of ring as unknown as [number, number][]) cb(lon, lat);
          }
  };
  each((lon, lat) => { minX = Math.min(minX, lon); maxX = Math.max(maxX, lon); minY = Math.min(minY, lat); maxY = Math.max(maxY, lat); });
  const W = 720, K = Math.cos(((minY + maxY) / 2) * Math.PI / 180);
  const H = Math.round(W * ((maxY - minY) / ((maxX - minX) * K)));
  const px = (lon: number) => ((lon - minX) / (maxX - minX)) * W;
  const py = (lat: number) => H - ((lat - minY) / (maxY - minY)) * H;

  // 5 classes by quantile over neighborhood unenrolled values.
  const vals = perHood.map((h) => h.unenrolled).sort((a, b) => a - b);
  const q = (p: number) => vals[Math.min(vals.length - 1, Math.floor(p * vals.length))];
  const breaks = [q(0.2), q(0.4), q(0.6), q(0.8)];
  const classOf = (v: number) => (v <= breaks[0] ? 0 : v <= breaks[1] ? 1 : v <= breaks[2] ? 2 : v <= breaks[3] ? 3 : 4);

  const hoodValue = new Map(perHood.map((h) => [h.name, h]));
  let paths = '';
  for (const [name, h] of hoods) {
    const v = hoodValue.get(name)!;
    const color = RAMP[classOf(v.unenrolled)];
    let d = '';
    for (const t of h.tracts)
      for (const poly of t.the_geom.coordinates)
        for (const ring of poly) {
          if (offshore(ring as unknown as [number, number][])) continue;
          d += (ring as unknown as [number, number][]).map(([lon, lat], i) => `${i ? 'L' : 'M'}${px(lon).toFixed(1)},${py(lat).toFixed(1)}`).join('') + 'Z';
        }
    const label = `${name}: ~${v.unenrolled.toLocaleString()} likely unenrolled (of ~${v.eligible.toLocaleString()} income-eligible)`;
    paths += `<path d="${d}" fill="${color}" stroke="#ffffff" stroke-width="0.6" data-label="${label.replace(/"/g, '&quot;')}"><title>${label}</title></path>\n`;
  }

  const legend = RAMP.map((c, i) => {
    const lo = i === 0 ? 0 : breaks[i - 1] + 1;
    const hi = i === 4 ? Math.max(...vals) : breaks[i];
    return `<span class="lg"><span class="sw" style="background:${c}"></span>${lo.toLocaleString()}–${hi.toLocaleString()}</span>`;
  }).join('');

  const tableRows = perHood
    .map((h) => `<tr><td>${h.name}</td><td>${h.eligible.toLocaleString()}</td><td>${h.unenrolled.toLocaleString()}</td><td>${(h.shareUnder200 * 100).toFixed(0)}%</td></tr>`)
    .join('\n');

  const dollarLine = unclaimedYear
    ? `<div class="stat"><div class="n">$${(unclaimedYear / 1e6).toFixed(0)}M<span class="per">/yr</span></div><div class="l">estimated unclaimed CalFresh benefits county-wide (${countyUnenrolled.toLocaleString()} people × $${avgPerPerson!.toFixed(0)}/mo avg × 12)</div></div>`
    : '';

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>BenefitBridge — the SF benefits gap</title>
<style>
  body{margin:0;font:14px/1.45 -apple-system,'Segoe UI',Roboto,sans-serif;background:#f6f5f2;color:#1f2937}
  .wrap{max-width:880px;margin:0 auto;padding:20px 16px 48px}
  h1{font-size:22px;margin:0 0 2px} .sub{color:#6b7280;font-size:13px;margin-bottom:18px}
  .stats{display:flex;gap:14px;flex-wrap:wrap;margin:14px 0}
  .stat{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:14px 18px;min-width:230px;flex:1}
  .stat .n{font-size:30px;font-weight:800;color:#104281}.stat .per{font-size:15px;font-weight:600;color:#6b7280}
  .stat .l{font-size:12px;color:#4b5563;margin-top:2px}
  .card{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin:14px 0;overflow-x:auto}
  svg{width:100%;height:auto;display:block} path{cursor:pointer} path:hover{stroke:#111827;stroke-width:1.4}
  .legend{display:flex;gap:12px;flex-wrap:wrap;font-size:12px;color:#4b5563;margin-top:8px}
  .lg{display:inline-flex;align-items:center;gap:5px}.sw{width:14px;height:14px;border-radius:3px;display:inline-block}
  table{border-collapse:collapse;width:100%;font-size:13px} th,td{text-align:left;padding:5px 10px;border-bottom:1px solid #eef0f2}
  th{color:#6b7280;font-weight:600;font-size:12px} td:nth-child(n+2),th:nth-child(n+2){text-align:right}
  .method{font-size:12px;color:#4b5563} .method a{color:#256abf} .est{color:#92400e;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:8px 12px;font-size:12px;margin:10px 0}
  #tip{position:fixed;pointer-events:none;background:#111827;color:#fff;font-size:12px;padding:6px 9px;border-radius:7px;display:none;max-width:300px}
</style></head><body>
<div class="wrap">
  <h1>Where San Francisco leaves food benefits unclaimed</h1>
  <div class="sub">CalFresh eligibility vs. enrollment, by Analysis Neighborhood — BenefitBridge data layer</div>
  <div class="stats">
    <div class="stat"><div class="n">~${top.unenrolled.toLocaleString()}</div><div class="l">income-eligible residents in <b>${top.name}</b> alone are likely not enrolled in CalFresh — the city's largest gap</div></div>
    <div class="stat"><div class="n">~${countyUnenrolled.toLocaleString()}</div><div class="l">likely unenrolled county-wide (${(effRate * 100).toFixed(0)}% participation among ~${countyEligible.toLocaleString()} income-eligible)</div></div>
    ${dollarLine}
  </div>
  <div class="est"><b>These are estimates, not determinations.</b> Income-eligibility is proxied by population under 200% of the federal poverty level; the county participation rate is applied uniformly to every neighborhood because tract-level enrollment is not public. The method is fully stated below.</div>
  <div class="card">
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Choropleth of estimated unenrolled CalFresh-eligible residents by SF neighborhood">${paths}</svg>
    <div class="legend"><b style="font-size:12px;color:#374151">Estimated unenrolled residents:</b>${legend}</div>
  </div>
  <div class="card"><table>
    <thead><tr><th>Neighborhood</th><th>Income-eligible (&lt;200% FPL)</th><th>Est. unenrolled</th><th>Share of residents &lt;200% FPL</th></tr></thead>
    <tbody>${tableRows}</tbody>
  </table></div>
  <div class="card method">
    <b>Method.</b> eligible(tract) = ACS C17002 population below 200% FPL · eligible(neighborhood) = Σ tracts via the DataSF crosswalk ·
    participation = county CalFresh persons (CDSS DFA256, ${latest.Date}) ÷ county eligible = ${(rate * 100).toFixed(1)}% ·
    unenrolled(neighborhood) = eligible × (1 − participation), uniform-rate assumption.
    ${avgPerPerson ? `Dollar figure uses the same DFA256 month's issuance ÷ persons = $${avgPerPerson.toFixed(0)}/person/month.` : ''}
    <br><b>Sources</b> (fetched ${fetched_at}):
    <br>· ${SOURCES.acs.cite} (${acs.release.name})
    <br>· ${SOURCES.crosswalk.cite} (as_of ${xwalk[0]?.data_as_of ?? 'n/a'})
    <br>· ${SOURCES.cf256.cite} (report month ${latest.Date})
  </div>
</div>
<div id="tip"></div>
<script>
  const tip = document.getElementById('tip');
  document.querySelectorAll('path[data-label]').forEach(p => {
    p.addEventListener('mousemove', e => { tip.style.display='block'; tip.textContent=p.dataset.label; tip.style.left=(e.clientX+12)+'px'; tip.style.top=(e.clientY+12)+'px'; });
    p.addEventListener('mouseleave', () => tip.style.display='none');
  });
</script>
</body></html>`;

  mkdirSync('app/public', { recursive: true });
  writeFileSync(OUT_HTML, html);
  writeFileSync(
    OUT_JSON,
    JSON.stringify(
      {
        fetched_at,
        sources: SOURCES,
        acs_release: acs.release.name,
        dfa256_month: latest.Date,
        county: { eligible: countyEligible, enrolled: persons, participationRate: rate, unenrolled: countyUnenrolled, avgBenefitPerPersonMonth: avgPerPerson, estUnclaimedPerYearUsd: unclaimedYear },
        neighborhoods: perHood,
      },
      null,
      1,
    ),
  );
  console.log(`county: eligible ${countyEligible.toLocaleString()} | enrolled ${persons.toLocaleString()} (${(rate * 100).toFixed(1)}%) | unenrolled ~${countyUnenrolled.toLocaleString()}`);
  console.log(`headline: ${top.name} ~${top.unenrolled.toLocaleString()} unenrolled${unclaimedYear ? ` | ~$${(unclaimedYear / 1e6).toFixed(0)}M/yr unclaimed county-wide` : ''}`);
  console.log(`wrote ${OUT_HTML} and ${OUT_JSON}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
