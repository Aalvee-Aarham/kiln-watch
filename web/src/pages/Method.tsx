import { Suspense, lazy, useState } from "react";
import { Method as Evidence } from "../Record";
import { AreaSelect, PageHead, PageProps, useRegion } from "./shared";

const Satellite = lazy(() => import("./SatelliteFigure")); // the figure and its kit load only on this page

const STEPS: [string, string][] = [
  ["Data", "Every FIRMS detection (MODIS C6.1, VIIRS 375 m C2, standard and near-real-time), read from the public Portolan GeoParquet mirror with DuckDB. No key needed; CC0."],
  ["Filtering", "Drop VIIRS low-confidence and MODIS confidence below 30, with the effect on totals reported. Persistent heat sources (kilns, flares, industry) are separated into their own class."],
  ["Observing opportunity", "The share of days each satellite delivered data anywhere on Earth, measured per period from the data itself. Launches, gaps and the Suomi-NPP end are never hard-coded. Counts are divided by it."],
  ["Calibration", "A ratio of totals per calendar month, day and night separately, shrunk toward the pooled ratio by empirical Bayes. Chain: Terra to Aqua, Suomi-NPP to Aqua (before Aqua's orbit drift), NOAA-20 to Suomi-NPP, NOAA-21 to NOAA-20. Chain-closure mismatch is added to the error."],
  ["Stitching", "An inverse-variance mean of the satellites observing each period, with intervals widened to the coverage measured in the denial test."],
  ["Comparison", "Median, ratio, percentile and rank against the same period in other complete years. Fire counts are skewed, so there are no sigma thresholds. The Early warning level uses the same percentiles."],
];

const LIMITS = [
  "No cloud-cover denominator yet, so cloudy months read low for every satellite alike.",
  "Calibration is per area, calendar month and day/night. It is not stratified by land cover, fire size or scan angle, so a year with an unusual fire mix is biased.",
  "Terra to Aqua is the weakest link and is used only for 2000 to 2002. Aqua drifts after about 2021.",
  "MODIS changes collection (6.03 to 61.03) at the start of 2023; this is listed but not yet step-tested.",
  "Near-real-time rows cannot be compared with standard processing from the mirror, so those months are labelled provisional, not adjusted.",
  "Persistent heat sources are not validated against an independent kiln inventory, so they are labelled likely.",
  "GDELT search starts in 2017. Reports are matched by place and date only; Google News RSS returns at most about 100 items per query, so busy windows are split by year and language.",
  "The 30-day outlook uses Aqua MODIS alone, whose orbit has drifted since 2022; it is a climatology plus the present anomaly, never a forecast, and it has not yet been backtested against later seasons.",
  "The outlook drops cells whose typed history is 30% or more static sources; a new gas-flare field can look above normal until FIRMS types it.",
];

export default function MethodPage({ regions }: PageProps) {
  const [rid, setRid] = useState("");
  const id = rid || regions.find((r) => r.preset)?.id || regions[0]?.id || null;
  const { region, err } = useRegion(id);
  return (
    <>
      <PageHead kicker="How it works" title="Methodology" lead="How MODIS and every VIIRS satellite are put on one scale, how that is tested on years the calibration never saw, and what the result does not mean." />

      <section>
        <h2>The reference instrument</h2>
        <Suspense fallback={<div className="skeleton tall" />}><Satellite /></Suspense>
      </section>

      <section>
        <h2>The question</h2>
        <p>Can MODIS and VIIRS detections be combined into one record whose level does not change when satellites arrive or leave, and how accurate is it on data the calibration never saw?</p>
        <p><b>Primary unit: hotspots on the Aqua MODIS scale</b>, the vegetation-fire detections Aqua MODIS would have recorded in its early-afternoon and post-midnight passes. That orbit is the only one observed continuously from 2002 through Suomi-NPP, NOAA-20 and NOAA-21. Converting VIIRS down to the MODIS scale discards information and is well-posed; the reverse would have to invent small fires MODIS never saw, so the VIIRS-scale view is marked <i>modelled</i> before 2012.</p>
      </section>

      <section>
        <h2>Six steps</h2>
        <ol className="steps long">{STEPS.map(([t, d]) => <li key={t}><b>{t}.</b> {d}</li>)}</ol>
      </section>

      <section>
        <h2>The 30-day outlook</h2>
        <p>The globe in the Explorer and on Early warning shows, for every half-degree cell on Earth, two things measured from the same instrument since 2003: <b>what the next 30 calendar days usually bring</b> (median and 90th percentile of earlier years) and <b>how unusual the last 30 days were</b> (percentile against the same days in each earlier year). Aqua MODIS is used alone because it is the one sensor observed every year since 2003, so no calibration enters the comparison.</p>
        <ul className="plain">
          <li><b style={{ color: "#F6C64F" }}>Season ahead</b>: the next 30 days usually bring at least 5 hotspots.</li>
          <li><b style={{ color: "#FF9A3C" }}>Above normal</b>: the last 30 days are at or above the 90th percentile of the same days in earlier years, and at least 5 hotspots.</li>
          <li><b style={{ color: "#FF3B2F" }}>Watch</b>: both at once, a usually active season starting while already above normal. These pulse on the globe and can trigger email alerts.</li>
          <li><b>Rising</b>: the usual next 30 days are at least twice the usual last 30, so the season normally ramps up now.</li>
        </ul>
        <p className="muted small">One pass over the whole-Earth aggregate (about 10 seconds), cached per data day. Watch cells are grouped and named with OpenStreetMap so a person can read where to look.</p>
      </section>

      <section>
        <h2>News and events</h2>
        <table className="tbl">
          <thead><tr><th>Source</th><th>What it adds</th><th>Coverage</th></tr></thead>
          <tbody>
            <tr><td>NASA EONET</td><td>Curated natural-event records with coordinates</td><td>mostly 2016 onward</td></tr>
            <tr><td>GDACS (EU JRC, UN OCHA)</td><td>Wildfire alerts with burned area from GWIS</td><td>2017 onward, global</td></tr>
            <tr><td>Google News RSS</td><td>Local outlets in English, Spanish, Portuguese, French, Indonesian, Hindi and Bangla</td><td>all years, about 100 items per query</td></tr>
            <tr><td>GDELT DOC 2.0</td><td>Global online news in 65 languages, monthly volume timelines</td><td>2017 onward</td></tr>
            <tr><td>ReliefWeb (optional)</td><td>Humanitarian situation reports</td><td>with an approved app name</td></tr>
          </tbody>
        </table>
        <p className="muted small">Each source is listed with its count and any error, so a failed source is never read as "no reports". Gemini may only drop headlines that are not about a vegetation fire there; it never adds data.</p>
      </section>

      <section>
        <h2>What this is not</h2>
        <ul className="plain">
          <li>Detections are not fires, and not burned area.</li>
          <li>Missing news is never evidence that nothing happened, and a report is never proof of a detection.</li>
          <li>The early warning compares with history. It does not forecast.</li>
          <li>Nothing on screen is typed in: every number comes from the pipeline, and each file records its code version.</li>
        </ul>
      </section>

      <section>
        <h2>Evidence for an area</h2>
        <p className="muted small">Hold-out tests, sensor-denial rehearsals, placebo steps, chain closure, calibration factors and provenance, computed for the area you pick.</p>
        {id && <AreaSelect regions={regions} value={id} onChange={setRid} />}
        <div className="method-body">
          {err && <p className="error">{err}</p>}
          {!region && !err && <div className="skeleton tall" />}
          {region && <Evidence r={region} cls="veg" />}
        </div>
      </section>

      <section>
        <h2>Known limitations</h2>
        <ul className="plain">{LIMITS.map((l) => <li key={l}>{l}</li>)}</ul>
      </section>

      <section>
        <h2>Data and credits</h2>
        <p className="small">We acknowledge the use of data and/or imagery from NASA's Fire Information for Resource Management System (FIRMS) (https://earthdata.nasa.gov/firms), part of NASA's Earth Observing System Data and Information System (EOSDIS). Detections via the Portolan FIRMS mirror (CC0). Imagery: NASA GIBS. Night lights: NASA Black Marble (VIIRS Day/Night Band) via GIBS. Events: NASA EONET and GDACS (European Commission JRC, UN OCHA). News: The GDELT Project and Google News RSS (personal, non-commercial use). Place names: OpenStreetMap Nominatim. Base map: OpenFreeMap and OpenStreetMap contributors. Kiln Watch is an independent project and not an official NASA product.</p>
      </section>
    </>
  );
}
