import { useEffect, useState } from "react";
import {
  Cls, Evidence, Num, OBSERVERS, RangeReports, Region, Reports, SCALE_UNIT, SENSOR_COLOR, SENSOR_LABEL, SHORT, Scale, api, fmt, ordinal, periodLabel, pick,
} from "./api";
import Loader, { STEPS } from "./Loader";

type Props = {
  r: Region; period: string; scale: Scale; cls: Cls; online: boolean;
  onBack: () => void; onDate: (d: string) => void; onPoint: (lon: number, lat: number, date: string) => void;
  onAsk: (q: string) => void;
};

const STACK = ["MODIS", "VIIRS_SNPP", "VIIRS_NOAA20", "VIIRS_NOAA21"];

export default function Detail(p: Props) {
  const weekly = p.period.includes("-W");
  const b = weekly ? p.r.weekly : p.r.monthly;
  const i = b.periods.indexOf(p.period);
  const s = pick(b, p.scale, p.cls);
  const c = b.classes[p.cls];
  const h = c.history;
  const used = c.hotspots.sensors[i] ?? [];
  const [ev, setEv] = useState<Evidence | null>(null);
  const [evErr, setEvErr] = useState<string | null>(null);
  const [rep, setRep] = useState<Reports | null>(null);
  const [repState, setRepState] = useState<"idle" | "loading" | "error">("idle");
  const [repErr, setRepErr] = useState("");

  useEffect(() => {
    setEv(null); setEvErr(null); setRep(null); setRepState("idle");
    if (!p.online) return;
    let live = true;
    api.evidence(p.r.meta.id, p.period).then((e) => {
      if (!live) return;
      setEv(e);
      if (e.peak_day) p.onDate(e.peak_day.date);
    }).catch((e) => live && setEvErr(e.message));
    return () => { live = false; };
  }, [p.r.meta.id, p.period, p.online]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadReports = () => {
    setRepState("loading");
    api.reports(p.r.meta.id, p.period).then((x) => { setRep(x); setRepState("idle"); })
      .catch((e) => { setRepErr(e.message); setRepState("error"); });
  };

  if (i < 0) return null;
  const unit = weekly ? "week" : "month";
  return (
    <div className="detail">
      <button className="back" onClick={p.onBack}>‹ Back to calendar</button>
      <header>
        <h2>{periodLabel(p.period)}</h2>
        <p className="muted">{p.r.meta.name}{b.partial[i] ? ", still in progress: values to date" : b.provisional[i] ? ", provisional: includes near-real-time data" : ""}</p>
      </header>

      <section className="headline">
        <div>
          <div className="big num">{fmt(s.v[i], 0)}</div>
          <div className="muted small">{SCALE_UNIT[p.scale]}{p.cls === "static" ? ", persistent heat sources" : ""}</div>
          {s.lo[i] !== null && <div className="small">95% interval {fmt(s.lo[i], 0)} to {fmt(s.hi[i], 0)}</div>}
          {s.modelled?.[i] && <div className="tag">Before VIIRS: modelled from MODIS</div>}
        </div>
        <div className={`rankchip ${h.pct[i] !== null && h.pct[i]! >= 90 ? "hot" : h.pct[i] !== null && h.pct[i]! <= 10 ? "cold" : ""}`}>
          {h.rank[i] === null ? <span>Not enough history to compare</span> : <>
            <b className="num">{ordinal(h.rank[i]!)}</b>
            <span>highest of {h.n[i]} {unit === "month" ? periodLabel(p.period).split(" ")[0] + "s" : `week-${+p.period.slice(6)}s`}</span>
            {h.ratio[i] !== null && <span>×{h.ratio[i]!.toFixed(1)} the median ({fmt(h.median[i], 0)})</span>}
            {h.wpct?.[i] != null && <span title="Recency-weighted: each year counts half as much as one 10 years newer">vs. recent years: {ordinal(Math.round(h.wpct[i]!))} percentile{h.wratio?.[i] != null ? `, ×${h.wratio[i]!.toFixed(1)} the weighted median` : ""}</span>}
          </>}
        </div>
      </section>

      <section>
        <h3>Satellites behind this value</h3>
        <table className="tbl">
          <thead><tr><th>Satellite</th><th>Days observed</th><th>Raw detections</th></tr></thead>
          <tbody>
            {OBSERVERS.filter((sn) => (b.coverage[sn]?.[i] ?? 0) > 0 || (b.raw[sn]?.det[i] ?? 0) > 0).map((sn) => {
              const on = used.includes(sn);
              const why = !on && sn === "MODIS_T" && used.includes("MODIS_A") ? "not used: Aqua covers this period" : "not used";
              return (
                <tr key={sn} className={on ? "" : "dim"}>
                  <td><i className="dot" style={{ background: SENSOR_COLOR[sn] }} />{SENSOR_LABEL[sn]}{!on && <span className="muted small"> {why}</span>}</td>
                  <td className="num">{Math.round((b.coverage[sn]?.[i] ?? 0) * 100)}%</td>
                  <td className="num">{fmt(p.cls === "veg" ? b.raw[sn].det[i] : b.raw[sn].static_det[i])}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="muted small">
          Raw total {fmt(b.raw.all_det[i])} vegetation detections. Each satellite's day and night counts are put on the Aqua scale with their own calibration factors, then averaged by precision. Terra is used only when Aqua is not observing.
          {b.nrt_share[i] ? ` ${Math.round(b.nrt_share[i]! * 100)}% near-real-time rows.` : ""}
        </p>
      </section>

      <section>
        <h3>Day by day</h3>
        {!p.online && <p className="muted small">Day-level detections need the Kiln Watch API. The calendar values above are complete.</p>}
        {evErr && <p className="error">Couldn't load detections: {evErr}</p>}
        {p.online && !ev && !evErr && <Loader steps={STEPS.evidence} expected={4} compact />}
        {ev && <Daily ev={ev} cls={p.cls} onDate={p.onDate} />}
      </section>

      {ev && (
        <section>
          <h3>Strongest detections</h3>
          <table className="tbl click">
            <thead><tr><th>Time (UTC)</th><th>Satellite</th><th>FRP MW</th><th>Source</th></tr></thead>
            <tbody>
              {ev.top_detections.slice(0, 8).map((d, k) => (
                <tr key={k} onClick={() => p.onPoint(d.lon, d.lat, d.time_utc.slice(0, 10))} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && p.onPoint(d.lon, d.lat, d.time_utc.slice(0, 10))}>
                  <td className="num">{d.time_utc.slice(5)}</td>
                  <td>{d.satellite}</td>
                  <td className="num">{fmt(d.frp_mw, 0)}</td>
                  <td>{d.class === "static" ? "static source" : "vegetation"}{d.quality === "nrt" ? ", NRT" : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted small">Click a row to fly the map there. Coordinates are pixel centres, not exact fire locations. {fmt(ev.low_confidence_excluded.excluded)} of {fmt(ev.low_confidence_excluded.of)} detections in this period were low confidence and are excluded, as in the calendar.</p>
          <div className="row">
            <a className="btn ghost" href={api.hotspotsUrl(p.r.meta.id, ev.start, ev.end)} download>Download these hotspots (CSV)</a>
            <a className="btn ghost" href={ev.links.firms_map} target="_blank" rel="noreferrer">Open in NASA FIRMS</a>
            <a className="btn ghost" href={ev.links.worldview} target="_blank" rel="noreferrer">Open in Worldview</a>
          </div>
        </section>
      )}

      <section>
        <h3>News and event reports</h3>
        {!p.online ? <p className="muted small">Report search needs the Kiln Watch API.</p> : repState === "idle" && !rep ? (
          <>
            <p className="muted small">Searches NASA EONET and GDELT news (2017 onward) for {p.r.meta.places?.slice(0, 3).join(", ") || p.r.meta.name}, in local languages.</p>
            <button className="btn" onClick={loadReports}>Search reports</button>
          </>
        ) : repState === "loading" ? <Loader steps={STEPS.news.slice(0, 6)} expected={16} compact /> : repState === "error" ? <p className="error">{repErr} <button className="link" onClick={loadReports}>Try again</button></p> : rep && <ReportList rep={rep} />}
      </section>

      <button className="btn ask" onClick={() => p.onAsk(`Explain ${periodLabel(p.period)} in ${p.r.meta.name}: how does it compare with other years, which satellites contributed, and what is the evidence?`)}>
        Ask the analyst about this period
      </button>
    </div>
  );
}

function Daily({ ev, cls, onDate }: { ev: Evidence; cls: Cls; onDate: (d: string) => void }) {
  const days: string[] = [];
  for (let d = new Date(ev.start + "T00:00:00Z"); d <= new Date(ev.end + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + 1)) days.push(d.toISOString().slice(0, 10));
  const by = new Map<string, Record<string, number>>();
  for (const r of ev.daily) if (r.class === cls) {
    const o = by.get(r.date) ?? {};
    o[r.sensor] = (o[r.sensor] ?? 0) + r.detections;
    by.set(r.date, o);
  }
  const max = Math.max(1, ...[...by.values()].map((o) => Object.values(o).reduce((a, c) => a + c, 0)));
  const W = 420, H = 90, bw = W / days.length;
  return (
    <>
      <svg viewBox={`0 0 ${W} ${H + 14}`} className="chart daily" role="img" aria-label="Raw detections per day by satellite">
        {days.map((d, k) => {
          let y = H;
          const o = by.get(d) ?? {};
          return (
            <g key={d} onClick={() => onDate(d)} className="cell">
              <rect x={k * bw} y={0} width={bw} height={H} fill="transparent" />
              {STACK.map((sn) => {
                const hh = ((o[sn] ?? 0) / max) * (H - 4);
                y -= hh;
                return hh > 0 ? <rect key={sn} x={k * bw + 0.5} y={y} width={Math.max(1, bw - 1)} height={hh} fill={SENSOR_COLOR[sn]} /> : null;
              })}
              <title>{d}: {Object.entries(o).map(([s, n]) => `${SHORT[s] ?? s} ${n}`).join(", ") || "none"}</title>
            </g>
          );
        })}
        <text x={0} y={H + 12} className="axis">{days[0].slice(5)}</text>
        <text x={W} y={H + 12} className="axis" textAnchor="end">{days[days.length - 1].slice(5)}</text>
      </svg>
      <ul className="chart-key inline">{STACK.map((s) => <li key={s}><i style={{ background: SENSOR_COLOR[s] }} />{SHORT[s]}</li>)}</ul>
      <p className="muted small">Raw detections per day, stacked by satellite. Click a day to show it on the map.{ev.peak_day && ` Busiest day: ${ev.peak_day.date}.`}</p>
    </>
  );
}

/** News and reports for the calendar's selected years, matched month by month against the record. */
export function RangeNews({ r, bounds, onOpen, onAsk, onClose }: {
  r: Region; bounds: [number, number]; onOpen: (p: string) => void; onAsk: (q: string) => void; onClose: () => void;
}) {
  const [yrs, setYrs] = useState<[number, number]>([Math.max(bounds[0], bounds[1] - 1), bounds[1]]);
  const [query, setQuery] = useState<[string, string] | null>(null);
  const [rep, setRep] = useState<RangeReports | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    setRep(null); setErr("");
    if (!query) return;
    let live = true;
    api.rangeReports(r.meta.id, ...query).then((x) => live && setRep(x)).catch((e) => live && setErr(e.message));
    return () => { live = false; };
  }, [r.meta.id, query]);
  const [start, end] = query ?? ["", ""];
  const all = Array.from({ length: bounds[1] - bounds[0] + 1 }, (_, i) => bounds[0] + i);
  const v = rep?.verdict;
  return (
    <section className="range-news reports" aria-live="polite">
      <header className="row-between"><h3>News and reports</h3><button className="icon" onClick={onClose} aria-label="Close news">✕</button></header>
      <form className="row" onSubmit={(e) => { e.preventDefault(); setQuery([`${yrs[0]}-01`, `${yrs[1]}-12`]); }}>
        <label className="small">From <select value={yrs[0]} onChange={(e) => setYrs([+e.target.value, Math.max(+e.target.value, yrs[1])])} aria-label="News from year">{all.map((y) => <option key={y}>{y}</option>)}</select></label>
        <label className="small">to <select value={yrs[1]} onChange={(e) => setYrs([Math.min(yrs[0], +e.target.value), +e.target.value])} aria-label="News to year">{all.map((y) => <option key={y}>{y}</option>)}</select></label>
        <button className="btn">Search</button>
      </form>
      {yrs[1] < 2017 && <p className="muted small">Before 2017 only NASA EONET is searched (GDELT news starts in 2017), so expect few reports.</p>}
      {!query ? <p className="muted small">Pick any years, then Search. Each month is matched against the record, both against all years and against recent years.</p>
        : err ? <p className="error">{err}</p> : !rep ? <>
        <Loader title={`News for ${r.meta.places?.slice(0, 2).join(", ") || r.meta.name}, ${start.slice(0, 4)}–${end.slice(0, 4)}`}
          steps={[...STEPS.news.slice(0, 6), "Gemini is reading every headline to drop off-topic stories", ...STEPS.news.slice(6)]}
          expected={Math.min(90, 22 + 6 * (+end.slice(0, 4) - +start.slice(0, 4)))} />
        <p className="muted small">The first search for a range takes a while (news services limit how fast we may ask); repeats are instant.</p>
      </> : <>
        <div className={`assess ${v!.tone}`}><b>{v!.label}</b><span>{rep.items.length} item{rep.items.length === 1 ? "" : "s"} listed</span></div>
        {rep.months.length > 0 && (
          <table className="tbl click">
            <thead><tr><th>Month</th><th>Hotspots</th><th title="Percentile against the same month in all other years">vs. all years</th><th title="Percentile against a recency-weighted baseline: each year counts half as much as one 10 years newer">vs. recent years</th><th>Reports</th><th>Match</th></tr></thead>
            <tbody>
              {rep.months.map((m) => (
                <tr key={m.period} className={`mv-${m.verdict}`} tabIndex={0} onClick={() => onOpen(m.period)} onKeyDown={(e) => e.key === "Enter" && onOpen(m.period)}>
                  <td>{periodLabel(m.period)}{m.partial ? " (so far)" : ""}</td>
                  <td className="num">{fmt(m.value, 0)}</td>
                  <td className={`num ${m.percentile !== null && m.percentile >= 90 ? "hot" : ""}`}>{m.rank === null ? "–" : `${ordinal(m.rank)} of ${m.of_years}`}</td>
                  <td className={`num ${m.recent_percentile !== null && m.recent_percentile >= 90 ? "hot" : ""}`}>{m.recent_percentile === null ? "–" : `${ordinal(Math.round(m.recent_percentile))} pct`}</td>
                  <td className="num">{fmt(m.reports)}</td>
                  <td>{m.label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="muted small">Months listed are the unusually high ones (top 10% for that month against all years or against recent years; highlighted) and any month with reports. Click a row to open it. Counts: {v!.count_method}.</p>
        <Sources sources={rep.sources} />
        <p className="muted small">
          {rep.relevance.checked
            ? <>Gemini ({rep.relevance.model}) read every headline: {rep.relevance.kept} are about a vegetation fire here, {rep.relevance.dropped} set aside (other fires, other places, politics, retrospectives). Set-aside articles are not counted in the listed-item counts.</>
            : <>Headlines were not checked for relevance ({rep.relevance.reason}); every matching article is shown and counted.</>}
        </p>
        <Articles rep={rep} onOpen={onOpen} />
        <p className="muted small">{rep.caveat}</p>
        <button className="btn ghost" onClick={() => onAsk(`Use timeline_reports for region ${r.meta.id} from ${start} to ${end}. Do the news reports agree with the satellite record? Give a short verdict, then go month by month through the unusually high months and the months with reports, citing the numbers and comparing the all-years percentile with the recent-years (recency-weighted) percentile. Also report article_check: how many wildfire articles were published in weeks the satellites rated unusually high. Remember that missing reports are not evidence of absence.`)}>
          Ask the analyst (Gemini) for a written verdict
        </button>
      </>}
    </section>
  );
}

/** Article list with an optional check of each article against the satellite record in the week it was published. */
function Articles({ rep, onOpen }: { rep: RangeReports; onOpen: (p: string) => void }) {
  const [cmp, setCmp] = useState(false);
  const [onlyRel, setOnlyRel] = useState(true);
  const [onlyHot, setOnlyHot] = useState(false);
  const ac = rep.article_check;
  const shown = [...rep.items]
    .filter((it) => !(onlyRel && it.relevant === false) && !(cmp && onlyHot && !it.fire?.unusual))
    .sort((a, b) => b.date.localeCompare(a.date));
  if (!rep.items.length) return null;
  const pc = (x: Num) => (x === null ? "–" : ordinal(Math.round(x)));
  return (
    <div className="articles">
      <div className="row">
        <button className={`btn ${cmp ? "on" : ""}`} onClick={() => setCmp(!cmp)} aria-pressed={cmp}>
          {cmp ? "Hide fire data" : "Compare articles with fire data"}
        </button>
        {rep.relevance.checked && <label className="check small"><input type="checkbox" checked={onlyRel} onChange={(e) => setOnlyRel(e.target.checked)} />Only wildfire articles</label>}
        {cmp && <label className="check small"><input type="checkbox" checked={onlyHot} onChange={(e) => setOnlyHot(e.target.checked)} />Only when fire was unusually high</label>}
      </div>
      {cmp && (
        <div className={`assess ${ac.articles && ac.in_unusual_weeks / ac.articles >= 0.5 ? "confirmed" : ac.in_unusual_weeks ? "unverified" : "neutral"}`}>
          <b>{ac.articles ? `${ac.in_unusual_weeks} of ${ac.articles} ${rep.relevance.checked ? "wildfire " : ""}articles were published when satellites saw unusually high fire activity` : "No dated articles fall inside the satellite record"}</b>
          <span>same or previous week</span>
        </div>
      )}
      <ul className="items">
        {shown.slice(0, 80).map((it) => (
          <li key={it.url} className={it.relevant === false ? "dim" : ""}>
            <a href={it.url} target="_blank" rel="noreferrer">{it.title || it.url}</a>
            <div className="muted small">{[it.source, it.outlet, it.date, it.lang].filter(Boolean).join(", ")}{it.relevant === false ? " · not about a wildfire here (Gemini)" : ""}</div>
            {cmp && (it.fire ? (
              <button className={`firecheck ${it.fire.unusual ? "hot" : ""}`} onClick={() => onOpen(it.fire!.period)} title="Open this week in the record">
                <b>{it.fire.unusual ? "Fire unusually high" : it.fire.too_few ? "Almost no fire detected" : "Fire activity typical"}</b> in {periodLabel(it.fire.period)}: {fmt(it.fire.value, 0)} hotspots{it.fire.too_few ? "" : `, ${pc(it.fire.pct)} percentile vs. all years, ${pc(it.fire.wpct)} vs. recent years`} ›
              </button>
            ) : <div className="muted small">No satellite record for this date.</div>)}
          </li>
        ))}
      </ul>
      {shown.length === 0 && <p className="muted small">No articles match these filters.</p>}
      {cmp && <p className="muted small">Each article is matched to the week it was published and the week before (news often lags the fire); the more unusual week is shown. Unusually high = top 10% for that week of the year against all years or against recent years.</p>}
    </div>
  );
}

function Sources({ sources }: { sources: Reports["sources"] }) {
  return (
    <ul className="sources">
      {sources.map((s) => (
        <li key={s.name}>
          <b>{s.name}</b>{" "}
          {s.error ? <span className="error">not searched: {s.error}</span> : !s.searched ? <span className="muted">{s.query}</span> : <span className="muted">{s.count} listed</span>}
          <div className="muted small">{s.coverage}</div>
        </li>
      ))}
    </ul>
  );
}

export function ReportList({ rep }: { rep: Reports }) {
  const a = rep.assessment;
  return (
    <div className="reports">
      <div className={`assess ${a.tone}`}><b>{a.label}</b><span>{a.reports_found} report{a.reports_found === 1 ? "" : "s"} found</span></div>
      <Sources sources={rep.sources} />
      {rep.items.length > 0 && (
        <ul className="items">
          {rep.items.slice(0, 40).map((it) => (
            <li key={it.url}>
              <a href={it.url} target="_blank" rel="noreferrer">{it.title || it.url}</a>
              <div className="muted small">{[it.source, it.outlet, it.date, it.lang].filter(Boolean).join(", ")}</div>
            </li>
          ))}
        </ul>
      )}
      <p className="muted small">{a.caveat}</p>
    </div>
  );
}
