import { useEffect, useState } from "react";
import { RegionItem, api } from "../api";
import Loader, { STEPS } from "../Loader";
import { AreaPicker, AreaSelect, Code, Offline, PageHead, PageProps } from "./shared";

const ACK = "We acknowledge the use of data and/or imagery from NASA's Fire Information for Resource Management System (FIRMS) (https://earthdata.nasa.gov/firms), part of NASA's Earth Observing System Data and Information System (EOSDIS).";
const COLS: [string, string][] = [
  ["hotspots_aqua_scale, ci95_lo, ci95_hi", "Harmonized hotspots on the Aqua MODIS scale with a 95% interval. The primary unit."],
  ["hotspots_viirs_scale, viirs_scale_modelled", "The same record on the VIIRS scale; modelled (1) before 2012."],
  ["fire_celldays_aqua_scale", "Grid cells with at least one detection on a day, summed. Secondary unit."],
  ["median_same_period, ratio_to_median, percentile, rank, of_years", "This period against the same month or week in other complete years."],
  ["satellites_used, coverage_*", "Which satellites fed the value and the share of days each observed."],
  ["raw_det_*, raw_detections_all_satellites", "Unadjusted counts. They rise whenever a satellite is added; do not trend them."],
  ["partial, provisional, nrt_share", "In-progress period; includes near-real-time data; share of near-real-time rows."],
];

export function Download({ regions, online }: PageProps) {
  const [rid, setRid] = useState("");
  const area = regions.find((r) => r.id === rid) ?? regions[0];
  const end = area?.data_through ?? "";
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  useEffect(() => {
    if (end) { setTo(end); setFrom(new Date(Date.parse(end) - 30 * 86400000).toISOString().slice(0, 10)); }
  }, [end, rid]);
  const days = from && to ? (Date.parse(to) - Date.parse(from)) / 86400000 : 0;
  const bad = !online || !area || days < 0 || days > 366;
  const base = location.origin;
  return (
    <>
      <PageHead kicker="Open data" title="Download the data" lead="The harmonized calendar for every area as CSV or JSON, and the detections behind it. Every file carries its units, sources and the code version that made it." />
      {!online && <Offline what="CSV exports" />}

      <section>
        <h2>Calendar by area</h2>
        <div className="scroll-x">
          <table className="tbl">
            <thead><tr><th>Area</th><th>Monthly CSV</th><th>Weekly CSV</th><th>JSON</th></tr></thead>
            <tbody>
              {regions.map((r) => (
                <tr key={r.id}>
                  <td>{r.name}<div className="muted small">through {r.data_through}</div></td>
                  <td><a href={api.csvUrl(r.id, "month")} download>monthly.csv</a></td>
                  <td><a href={api.csvUrl(r.id, "week")} download>weekly.csv</a></td>
                  <td className="small"><a href={`/data/regions/${r.id}/monthly.json`}>monthly</a> · <a href={`/data/regions/${r.id}/meta.json`}>meta</a> · <a href={`/data/regions/${r.id}/grid.json`}>grid</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted small">Calibration factors for all areas: <a href={api.ratioTableUrl()} download>calibration_table.csv</a>. CSV files start with <code>#</code> comment lines (unit, source, code version); skip them when reading.</p>
      </section>

      <section>
        <h2>Hotspots behind the calendar</h2>
        <p className="muted small">Individual detections in FIRMS columns plus satellite, product version, a static-source flag and whether the row was used in the calendar. Up to 366 days.</p>
        <div className="row">
          {area && <AreaSelect regions={regions} value={area.id} onChange={setRid} />}
          <input type="date" value={from} min="2000-11-01" max={to} onChange={(e) => setFrom(e.target.value)} aria-label="From" />
          <input type="date" value={to} min={from} max={end} onChange={(e) => setTo(e.target.value)} aria-label="To" />
          <a className="btn" aria-disabled={bad} style={bad ? { opacity: 0.45, pointerEvents: "none" } : undefined} href={area ? api.hotspotsUrl(area.id, from, to) : "#"} download>Download CSV</a>
        </div>
        {days > 366 && <p className="error small">Choose at most 366 days.</p>}
      </section>

      <section>
        <h2>Columns in the calendar CSV</h2>
        <table className="tbl">
          <tbody>{COLS.map(([c, d]) => <tr key={c}><td><code>{c}</code></td><td>{d}</td></tr>)}</tbody>
        </table>
        <p className="muted small">Detections are not fires and not burned area. A calendar value is hotspots a reference satellite would have recorded, not a count of fires.</p>
      </section>

      <section>
        <h2>Use it in code</h2>
        <Code text={`curl -o punjab-monthly.csv "${base}/api/regions/punjab/export.csv?granularity=month"`} />
        <Code text={`import pandas as pd\ndf = pd.read_csv("${base}/api/regions/punjab/export.csv?granularity=month", comment="#")\nprint(df[["period", "hotspots_aqua_scale", "percentile"]].tail())`} />
        <p className="muted small">AI assistants can read the same data through the <b>MCP</b> page.</p>
      </section>

      <section>
        <h2>Cite and credit</h2>
        <Code text={ACK} />
        <p className="muted small">Detections come from the public Portolan GeoParquet mirror of NASA FIRMS (CC0). Kiln Watch is an independent project, not an official NASA product. Check the terms of GDELT, EONET and any news you reuse.</p>
      </section>
    </>
  );
}

type Job = { id: string; status: string; done?: number; total?: number; stage?: string; error?: string };

export function Create({ regions, online, job, build, openRegion, goDraw }: PageProps & {
  job: Job | null; build: (box: number[], name?: string) => void; goDraw: () => void;
}) {
  const mine = regions.filter((r: RegionItem) => !r.preset);
  const busy = job?.status === "running";
  return (
    <>
      <PageHead kicker="Any place on Earth" title="Create your dataset" lead="Give any box up to 16 square degrees (about 4° × 4°). Kiln Watch reads every MODIS and VIIRS detection since 2000, calibrates them onto one scale and builds the calendar, season and validation for it." />
      {!online && <Offline what="Building a new area" />}

      <section>
        <h2>Choose the place</h2>
        <AreaPicker online={online} cta="Build the dataset" busy={busy} onPick={(box, name) => build(box, name)} onDraw={goDraw} />
      </section>

      {job && (
        <section>
          <h2>{job.status === "error" ? "The build failed" : "Building"}</h2>
          {job.status === "error" ? <p className="error">{job.error}</p> : <>
            <Loader title="Building the 26-year record" steps={STEPS.build} expected={25} done={job.total ? job.done : undefined} total={job.total || undefined} />
            <p className="small muted" style={{ marginTop: 8 }}>{job.stage ?? "starting"}. The area opens in the Explorer when ready.</p>
          </>}
        </section>
      )}

      {mine.length > 0 && (
        <section>
          <h2>Your areas</h2>
          <ul className="areas compact">{mine.map((r) => <li key={r.id}><button onClick={() => openRegion(r.id)}><b>{r.name}</b><span className="muted small">built {r.built_at?.slice(0, 10)}</span></button></li>)}</ul>
          <p className="muted small">Each is on the Early warning watchlist and downloadable from the Download page.</p>
        </section>
      )}

      <section>
        <h2>What you get</h2>
        <ul className="plain small">
          <li>A 2000-to-today monthly and weekly calendar on the Aqua MODIS scale, with 95% intervals.</li>
          <li>Season timing, this year against every earlier year, and the early-warning status.</li>
          <li>Calibration, sensor-denial tests and provenance, on the Methodology page.</li>
          <li>The same files as the preset areas: CSV, JSON and MCP access.</li>
        </ul>
      </section>
    </>
  );
}
