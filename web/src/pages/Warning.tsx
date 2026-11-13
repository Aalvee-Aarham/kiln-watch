import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import { AlertState, LEVEL_LABEL, Level, Outlook, Trigger, Warning, Warnings, api, fmt, ordinal, periodLabel } from "../api";
import Loader, { STEPS } from "../Loader";
import { NIGHT, OUTLOOK_COLOR, OUTLOOK_LABEL, SKY, addOutlookLayers, outlookPopup, pulseOutlook, setOutlook, spinGlobe } from "../Map";
import { AreaPicker, LevelChip, Offline, PageHead, PageProps, Saved, saveAlerts, savedAlerts } from "./shared";

const ORDER: Level[] = ["elevated", "watch", "normal", "quiet", "insufficient"];
type Job = { id: string; status: string; done?: number; total?: number; stage?: string; error?: string };
type Preset = { box: number[]; name: string; n: number };

const day = (d: string) => new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const around = (lon: number, lat: number) => [lon - 1, lat - 1, lon + 1, lat + 1].map((v, i) => Math.round(Math.max(i % 2 ? -90 : -180, Math.min(i % 2 ? 90 : 180, v)) * 100) / 100);

export default function EarlyWarning({ online, go, openRegion, refresh }: PageProps) {
  const [all, setAll] = useState<Warnings | null>(null);
  const [err, setErr] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  const [mine, setMine] = useState<Saved[]>(savedAlerts);
  const [v, setV] = useState(0); // bump to reload the watchlist after a new area is built
  const [o, setO] = useState<Outlook | null>(null);
  const [emailOn, setEmailOn] = useState<boolean | null>(null);
  const [preset, setPreset] = useState<Preset | null>(null);
  const formRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!online) return;
    api.warnings().then((w) => { setAll(w); setSel((s) => s ?? w.alerts[0]?.region_id ?? null); }).catch((e) => setErr(e.message));
  }, [online, v]);
  useEffect(() => {
    if (!online) return;
    api.outlook().then(setO).catch(() => undefined);
    api.health().then((h) => setEmailOn(!!h.email)).catch(() => undefined);
  }, [online]);

  const addAlert = (s: Saved) => { const l = [...mine.filter((m) => m.token !== s.token), s]; setMine(l); saveAlerts(l); };
  const dropAlert = (t: string) => { const l = mine.filter((m) => m.token !== t); setMine(l); saveAlerts(l); };
  const count = (l: Level) => all?.alerts.filter((a) => a.level === l).length ?? 0;
  const detail = { go, openRegion, onAlert: addAlert };
  const alertHere = (box: number[], name: string) => {
    setPreset({ box, name, n: Date.now() });
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <>
      <PageHead kicker="Climatological outlook" title="Early warning" lead="Where is fire activity running above normal, where is a fire season about to start, and is your place unusual this month? Every place on Earth, from 26 years of harmonized NASA satellite detections. Get an email when something changes.">
        <p className="tagline"><b>A climatological outlook, not a forecast.</b> It says what the coming weeks usually bring and how unusual the present is against every earlier year. It does not predict weather or fire behaviour and is not an official alert.</p>
      </PageHead>

      {!online && <Offline what="The early-warning check" />}

      {o && <OutlookSection o={o} onAlert={alertHere} onOpenMap={() => go("explore")} />}

      <section ref={formRef}>
        <h2>Email me when fire activity changes</h2>
        <EmailAlert online={online} emailOn={emailOn} preset={preset} onAlert={addAlert} go={go} />
      </section>

      <section>
        <h2>My alerts</h2>
        <MyAlerts mine={mine} online={online} onDrop={dropAlert} go={go} />
      </section>

      <section>
        <h2>Check any place now</h2>
        <CheckPlace online={online} onBuilt={() => { setV((x) => x + 1); refresh(); }} detail={detail} />
      </section>

      <section>
        <h2>Areas already built {all && <span className="muted small">data through {all.as_of}</span>}</h2>
        {err && <p className="error">Couldn't load the watchlist: {err}</p>}
        {online && !all && !err && <div className="skeleton tall" />}
        {all && (
          <>
            <ul className="levels" aria-label="Areas by level">
              {ORDER.map((l) => <li key={l} className={l}><b className="num">{count(l)}</b><span>{LEVEL_LABEL[l]}</span></li>)}
            </ul>
            <div className="scroll-x" style={{ marginTop: 14 }}>
              <table className="tbl click wl">
                <thead><tr><th>Level</th><th>Area</th><th>This month vs earlier years</th><th>Usual next 4 weeks</th></tr></thead>
                <tbody>
                  {all.alerts.map((a) => (
                    <tr key={a.region_id} className={sel === a.region_id ? "sel" : ""} onClick={() => setSel(a.region_id)} tabIndex={0}
                      onKeyDown={(e) => e.key === "Enter" && setSel(a.region_id)} aria-selected={sel === a.region_id}>
                      <td><LevelChip level={a.level} /></td>
                      <td>{a.name}{a.stale && <span className="tag">stale data</span>}</td>
                      <td className="num">{a.level === "insufficient" || a.percentile === null ? "–" : `${ordinal(Math.round(a.percentile))} percentile`}</td>
                      <td className="num">{a.level === "insufficient" || a.next_4_weeks_median === null ? "–" : `${fmt(a.next_4_weeks_median)} hotspots`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {sel && <Detail id={sel} {...detail} />}
            <p className="muted small">Every area you check is added here and refreshed from NASA FIRMS whenever its data is more than six hours old.</p>
          </>
        )}
      </section>

      <section className="how">
        <h2>How the levels are decided</h2>
        <p>{all?.rule ?? "Elevated: the month so far is at or above the 90th percentile of the same days in earlier years. Watch: at or above the 75th percentile, or the latest complete week at or above the 90th. Quiet: at or below the 10th. Not scored where there are too few hotspots to rank."}</p>
        {o && <p>{o.rule}</p>}
        <p className="muted small">Alerts fire when the month so far is above a multiple of the median of the same days in earlier years (and at least 5 hotspots), when the 30-day outlook in your box has watch cells, or when NASA EONET opens a wildfire event inside it. Percentiles use harmonized counts, because raw counts would rank every recent month as unusual: new satellites count smaller fires. See <button className="link" onClick={() => go("method")}>Methodology</button>.</p>
      </section>
    </>
  );
}

// ---------- worldwide outlook globe ----------

function OutlookSection({ o, onAlert, onOpenMap }: { o: Outlook; onAlert: (box: number[], name: string) => void; onOpenMap: () => void }) {
  const el = useRef<HTMLDivElement>(null);
  const alertRef = useRef(onAlert);
  alertRef.current = onAlert;
  const mapRef = useRef<maplibregl.Map | null>(null);
  useEffect(() => {
    const m = new maplibregl.Map({
      container: el.current!, center: [15, 5], zoom: window.innerWidth > 900 ? 1.25 : 0.7, attributionControl: { compact: true },
      style: { version: 8, sources: { night: { type: "raster", tiles: [NIGHT], tileSize: 256, maxzoom: 8, attribution: "NASA Black Marble · Kiln Watch outlook" } },
        layers: [{ id: "bg", type: "background", paint: { "background-color": "#02060D" } }, { id: "night", type: "raster", source: "night" }] },
    });
    mapRef.current = m;
    let stop = () => undefined as void;
    m.on("load", () => {
      m.setProjection({ type: "globe" });
      m.setSky(SKY);
      addOutlookLayers(m);
      setOutlook(m, o, true);
      stop = pulseOutlook(m);
      spinGlobe(m);
      m.on("click", "outlook-dots", (e) => {
        const f = e.features?.[0];
        if (!f || f.geometry.type !== "Point") return;
        const [lon, lat] = f.geometry.coordinates;
        const pp = new maplibregl.Popup({ className: "kw-pop", offset: 8, maxWidth: "300px" }).setLngLat([lon, lat])
          .setHTML(outlookPopup(f.properties, lat, lon, o, "Email me about this area")).addTo(m);
        pp.getElement().querySelector("button")?.addEventListener("click", () => { pp.remove(); alertRef.current(around(lon, lat), `Area around ${lat.toFixed(1)}°, ${lon.toFixed(1)}°`); });
      });
      m.on("mouseenter", "outlook-dots", () => (m.getCanvas().style.cursor = "pointer"));
      m.on("mouseleave", "outlook-dots", () => (m.getCanvas().style.cursor = ""));
    });
    return () => { stop(); m.remove(); };
  }, [o]);
  const fly = (b: number[]) => mapRef.current?.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: 40, duration: 1400, maxZoom: 5 });
  return (
    <section className="ow">
      <div className="ow-globe">
        <div ref={el} className="ow-map" aria-label="Worldwide 30-day fire-season outlook" />
        <div className="ow-stats">
          <span className="live"><i />Next 30 days · {day(o.next_30_days[0])} to {day(o.next_30_days[1])}</span>
          <div className="ow-nums">
            {(["watch", "above", "season"] as const).map((c, i) => (
              <div key={c} style={{ animationDelay: `${i * 120}ms` }}>
                <b className="num" style={{ color: OUTLOOK_COLOR[c] }}>{fmt(o.counts[c])}</b>
                <span>{OUTLOOK_LABEL[c]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="ow-side">
        <h2>Where to watch</h2>
        <p className="muted small">Groups of half-degree cells where the last 30 days ran far above the same days in {o.baseline_years[0]}–{o.baseline_years[1]}, most of them entering a season that is usually active now.</p>
        <ol className="oregions big">
          {o.regions.map((g, i) => {
            const x = g.usual_last_30 ? g.last_30 / g.usual_last_30 : null;
            return (
              <li key={i} style={{ animationDelay: `${i * 70}ms` }}>
                <button onClick={() => fly(g.bbox)} title="Show on the globe">
                  <b>{g.name.split(",").slice(0, 2).join(",")}</b>
                  <span className="muted small">{g.country} · last 30 days <b className="num">{fmt(g.last_30)}</b> hotspots{x ? <>, <b className="num" style={{ color: OUTLOOK_COLOR.watch }}>{x >= 10 ? Math.round(x) : x.toFixed(1)}×</b> usual</> : ""} · {g.watch_cells} watch cells</span>
                </button>
                <button className="link small" onClick={() => onAlert([g.lon - 2, g.lat - 2, g.lon + 2, g.lat + 2].map((v) => Math.round(v * 100) / 100), g.name.split(",")[0])}>Alert me</button>
              </li>
            );
          })}
        </ol>
        <div className="row">
          <button className="btn ghost" onClick={onOpenMap}>Open on the big globe</button>
        </div>
        <p className="muted small">{o.caveat}</p>
      </div>
    </section>
  );
}

// ---------- email subscription ----------

const TRIG: [Trigger, string, string][] = [
  ["anomaly", "This month tops the usual", "when the month so far is above your multiple of the median of the same days in earlier years"],
  ["outlook", "Fire-season watch", "when the 30-day outlook shows cells entering an active season while already above normal (at most weekly)"],
  ["events", "New wildfire events", "when NASA EONET opens a wildfire event inside the area"],
];
const RATIOS: [number, string][] = [[1, "tops the median"], [1.5, "is 1.5× the median"], [2, "is 2× the median"], [3, "is 3× the median"]];

function EmailAlert({ online, emailOn, preset, onAlert, go }: { online: boolean; emailOn: boolean | null; preset: Preset | null; onAlert: (s: Saved) => void; go: PageProps["go"] }) {
  const [box, setBox] = useState<number[] | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [trig, setTrig] = useState<Trigger[]>(["anomaly", "outlook", "events"]);
  const [ratio, setRatio] = useState(1);
  const [state, setState] = useState<"idle" | "saving" | "done">("idle");
  const [res, setRes] = useState<{ token: string; status: string | null | undefined } | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => { if (preset) { setBox(preset.box); setName(preset.name); setState("idle"); setRes(null); } }, [preset]);
  const valid = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email.trim());
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!box || !trig.length) return;
    setState("saving"); setErr("");
    api.createAlert({ bbox: box, name: name || undefined, ratio, triggers: trig, email: email.trim() || undefined })
      .then((a) => { onAlert({ token: a.token, name: name || a.name || "My area" }); setRes({ token: a.token, status: a.email_status }); setState("done"); })
      .catch((x) => { setErr(x.message); setState("idle"); });
  };
  if (state === "done" && res) {
    const sent = res.status === "confirmation_sent";
    return (
      <div className={`alertbox done ${sent ? "ok" : ""}`}>
        <div className="check-anim" aria-hidden><svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="24" /><path d="M15 27l7 7 15-16" /></svg></div>
        <div>
          <h3>{sent ? "Check your inbox" : "Alert created"}</h3>
          {sent ? <p>We sent a confirmation link to <b>{email}</b>. Click it to start the alerts; nothing is sent before that, and every email has a one-click unsubscribe.</p>
            : email ? <p className="warn small">The confirmation email could not be sent ({res.status?.replace("not_sent: ", "")}). The alert works; get it through n8n instead, or ask the server's operator to set SMTP.</p>
              : <p>Get it through n8n (download below) or check it any time under My alerts.</p>}
          <div className="row">
            <a className="btn ghost" href={api.workflowUrl(res.token)} download>n8n workflow</a>
            <button className="btn ghost" onClick={() => { setState("idle"); setRes(null); }}>Another alert</button>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="alertbox email">
      {!box ? (
        <>
          <p className="small">1. Choose the area: search a place, type its edges, or click a dot on the globe above.</p>
          <AreaPicker online={online} cta="Use this area" onPick={(b, n) => { setBox(b); setName(n ?? ""); }} />
        </>
      ) : (
        <form onSubmit={submit}>
          <div className="picked">
            <div><span className="muted small">Area</span><b>{name || "Custom area"}</b><span className="num small muted">{box.map((x) => x.toFixed(2)).join(", ")}</span></div>
            <button type="button" className="link small" onClick={() => setBox(null)}>Change</button>
          </div>
          <p className="small">2. What should we tell you about?</p>
          <div className="trigs">
            {TRIG.map(([k, l, d]) => (
              <label key={k} className={`trig ${trig.includes(k) ? "on" : ""}`}>
                <input type="checkbox" checked={trig.includes(k)} onChange={(e) => setTrig(e.target.checked ? [...trig, k] : trig.filter((t) => t !== k))} />
                <b>{l}</b><span className="muted small">{d}</span>
                {k === "anomaly" && trig.includes(k) && (
                  <select value={ratio} onChange={(e) => setRatio(+e.target.value)} aria-label="Threshold">
                    {RATIOS.map(([r, t]) => <option key={r} value={r}>Month {t}</option>)}
                  </select>
                )}
              </label>
            ))}
          </div>
          <p className="small">3. Where should it go?</p>
          <div className="row">
            <input className="grow" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.org" aria-label="Email address" autoComplete="email" />
            <button className="btn" disabled={!online || state === "saving" || !trig.length || (!!email && !valid)}>{state === "saving" ? "Saving…" : email ? "Email me" : "Create without email"}</button>
          </div>
          {emailOn === false && <p className="muted small">This server has no email settings yet (SMTP), so confirmation emails cannot go out. The alert still works through <button type="button" className="link" onClick={() => go("n8n")}>n8n</button>.</p>}
          <p className="muted small">Double opt-in: you confirm by email first. At most one anomaly email per month, one outlook email per week, one per new event. Unsubscribe in one click. New areas build their 26-year record in the background.</p>
          {err && <p className="error small">{err}</p>}
        </form>
      )}
    </div>
  );
}

// ---------- check a place ----------

/** Pick or draw any box, build its record if new, then show its early warning. */
function CheckPlace({ online, onBuilt, detail }: { online: boolean; onBuilt: () => void; detail: DetailProps }) {
  const [job, setJob] = useState<Job | null>(null);
  const [rid, setRid] = useState<string | null>(null);
  const [err, setErr] = useState("");

  const start = async (box: number[], name?: string) => {
    setErr(""); setRid(null);
    try {
      const j = await api.startAoi(box, name);
      if (j.status === "ready") { setRid(j.id); onBuilt(); } else setJob(j);
    } catch (e) { setErr((e as Error).message); }
  };
  useEffect(() => {
    if (!job || job.status !== "running") return;
    const t = setInterval(() => api.aoi(job.id).then((j) => {
      setJob(j);
      if (j.status === "ready") { setRid(j.id); setJob(null); onBuilt(); }
    }).catch(() => undefined), 2000);
    return () => clearInterval(t);
  }, [job]); // eslint-disable-line react-hooks/exhaustive-deps

  const busy = job?.status === "running";
  return (
    <>
      <AreaPicker online={online} cta="Check early warning" busy={busy} onPick={start} />
      {err && <p className="error">{err}</p>}
      {job && (job.status === "error" ? <p className="error">The build failed: {job.error}</p> : (
        <div style={{ marginTop: 12 }}>
          <Loader title="Building this place's 26-year record" steps={STEPS.build} expected={25} done={job.total ? job.done : undefined} total={job.total || undefined} />
          <p className="small muted" style={{ marginTop: 6 }}>{job.stage ?? "starting"}. The first time takes a little while; after that it is instant.</p>
        </div>
      ))}
      {rid && <div style={{ marginTop: 16 }}><Detail id={rid} {...detail} /></div>}
    </>
  );
}

type DetailProps = { go: PageProps["go"]; openRegion: PageProps["openRegion"]; onAlert: (s: Saved) => void };

function Detail({ id, go, openRegion, onAlert }: { id: string } & DetailProps) {
  const [w, setW] = useState<Warning | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    setW(null); setErr("");
    let live = true;
    api.warning(id).then((x) => live && setW(x)).catch((e) => live && setErr(e.message));
    return () => { live = false; };
  }, [id]);
  if (err) return <p className="error">Couldn't load this area: {err}</p>;
  if (!w) return <div className="skeleton" />;
  const m = w.month, n = w.next_4_weeks, y = w.year_to_date;
  return (
    <section className={`ew-detail ${w.level}`}>
      <header>
        <h2>{w.name} <LevelChip level={w.level} /></h2>
        <p>{w.headline}</p>
        {w.refreshing && <p className="muted small">Refreshing this area with the newest NASA data in the background; reload in a minute.</p>}
      </header>
      <div className="tiles">
        {m && <Tile label={`${periodLabel(m.period)} so far (${m.days} days)`} value={fmt(m.value)} sub={`median of earlier years ${fmt(m.median_same_days)}; rank ${m.rank} of ${m.of_years}`} />}
        <Tile label="Latest complete week" value={w.latest_complete_week_percentile === null ? "–" : `${ordinal(Math.round(w.latest_complete_week_percentile))}`} sub="percentile against the same week in earlier years" />
        {y && <Tile label={`This fire year (${y.weeks} weeks)`} value={`${ordinal(y.rank)} of ${y.n}`} sub={`${fmt(y.value)} hotspots; median year ${fmt(y.median)} by now`} />}
        <Tile label={`Usual ${n.weeks[0]}–${n.weeks[3]}`} value={n.median === null ? "–" : fmt(n.median)}
          sub={n.median === null ? "not enough earlier years" : `middle of earlier years; 10th to 90th percentile ${fmt(n.p10)} to ${fmt(n.p90)}${n.usual_share_of_year_pct !== null ? `; about ${fmt(n.usual_share_of_year_pct)}% of a year` : ""}`} />
      </div>
      <Weeks w={w} />
      <AlertForm regionId={id} name={w.name} median={m?.median_same_days ?? null} onAlert={onAlert} go={go} />
      <div className="row">
        <button className="btn ghost" onClick={() => openRegion(id)}>Open the calendar</button>
        <button className="btn ghost" onClick={() => go("news")}>News and events</button>
      </div>
      <p className="muted small">{w.caveat}</p>
    </section>
  );
}

function AlertForm({ regionId, name, median, onAlert, go }: { regionId: string; name: string; median: number | null; onAlert: (s: Saved) => void; go: PageProps["go"] }) {
  const [ratio, setRatio] = useState(1);
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "done">("idle");
  const [token, setToken] = useState("");
  const [status, setStatus] = useState<string | null | undefined>(null);
  const [err, setErr] = useState("");
  const create = () => {
    setState("saving"); setErr("");
    api.createAlert({ region_id: regionId, ratio, email: email.trim() || undefined, triggers: ["anomaly", "outlook", "events"] })
      .then((a) => { setToken(a.token); setStatus(a.email_status); onAlert({ token: a.token, name }); setState("done"); })
      .catch((e) => { setErr(e.message); setState("idle"); });
  };
  return (
    <div className="alertbox">
      <h3>Alert me about this area</h3>
      {state === "done" ? (
        <>
          <p>{status === "confirmation_sent" ? <>Confirmation sent to <b>{email}</b>: click the link in it to start the emails.</> : "Alert created."} You can also get it through n8n: import the workflow and add your email or chat credentials.</p>
          {status && status !== "confirmation_sent" && <p className="warn small">Email not sent: {status.replace("not_sent: ", "")}</p>}
          <div className="row">
            <a className="btn" href={api.workflowUrl(token)} download>Download n8n workflow</a>
            <button className="btn ghost" onClick={() => go("n8n")}>Setup steps</button>
          </div>
        </>
      ) : (
        <>
          <div className="row">
            <span>Notify me when the month so far</span>
            <select value={ratio} onChange={(e) => setRatio(+e.target.value)} aria-label="Threshold">{RATIOS.map(([r, l]) => <option key={r} value={r}>{l}</option>)}</select>
            <span>of the same days in earlier years{median !== null ? ` (now ${fmt(median)})` : ""}, the 30-day outlook turns to watch, or a new wildfire is reported.</span>
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            <input type="email" className="grow" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email (optional)" aria-label="Email address" />
            <button className="btn" onClick={create} disabled={state === "saving"}>Create alert</button>
          </div>
          {err && <p className="error small">{err}</p>}
        </>
      )}
    </div>
  );
}

function MyAlerts({ mine, online, onDrop, go }: { mine: Saved[]; online: boolean; onDrop: (t: string) => void; go: PageProps["go"] }) {
  const [state, setState] = useState<Record<string, AlertState | "gone" | "err">>({});
  const [test, setTest] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!online || mine.length === 0) return;
    let live = true;
    const load = () => mine.forEach((m) => api.alert(m.token)
      .then((a) => live && setState((s) => ({ ...s, [m.token]: a })))
      .catch((e) => live && setState((s) => ({ ...s, [m.token]: /unknown alert/.test(e.message) ? "gone" : "err" }))));
    load();
    const t = setInterval(load, 10000); // building areas finish within minutes
    return () => { live = false; clearInterval(t); };
  }, [mine, online]);
  const sendTest = (t: string) => {
    setTest((s) => ({ ...s, [t]: "sending…" }));
    api.sendTest(t).then((r) => setTest((s) => ({ ...s, [t]: r.sent ? `sent: ${r.subject}` : r.reason ?? "not sent" })))
      .catch((e) => setTest((s) => ({ ...s, [t]: e.message })));
  };

  if (mine.length === 0) return <p className="muted">No alerts yet. Pick an area above and choose what to be told about. <button className="link" onClick={() => go("n8n")}>Prefer n8n?</button></p>;
  return (
    <ul className="alerts">
      {mine.map((m, i) => {
        const a = state[m.token];
        const ok = a && typeof a === "object" ? a : null;
        const remove = () => { api.deleteAlert(m.token).catch(() => undefined); onDrop(m.token); };
        const oc = ok?.outlook?.counts;
        return (
          <li key={m.token} style={{ animationDelay: `${i * 60}ms` }}>
            <div>
              <b>{ok?.name ?? m.name}</b>
              <div className="achips">
                {ok?.email && <span className={ok.confirmed ? "ok" : "wait"}>{ok.confirmed ? "✓ " : "awaiting confirmation · "}{ok.email}</span>}
                {(ok?.triggers ?? []).map((t) => <span key={t}>{TRIG.find((x) => x[0] === t)?.[1] ?? t}</span>)}
              </div>
              {!a && <span className="muted small"> checking…</span>}
              {a === "gone" && <span className="error small"> this alert no longer exists</span>}
              {a === "err" && <span className="muted small"> status unavailable</span>}
              {ok?.status === "running" && <span className="muted small"> building its record: {ok.progress?.stage ?? "starting"}{ok.progress?.total ? ` (${ok.progress.done}/${ok.progress.total})` : ""}</span>}
              {ok?.status === "error" && <span className="error small"> build failed: {ok.error}</span>}
              {ok?.status === "ready" && ok.month && (
                <div className="small">
                  <span className={`lvl ${ok.triggered ? "elevated" : "normal"}`}>{ok.triggered ? "Above threshold" : "Below threshold"}</span>{" "}
                  {periodLabel(ok.month.period)} so far {fmt(ok.month.value)} hotspots; median of earlier years {fmt(ok.month.median_same_days)}. Alerts above {ok.ratio} × median.
                </div>
              )}
              {oc && <div className="small muted">30-day outlook: <b style={{ color: oc.watch ? OUTLOOK_COLOR.watch : undefined }}>{oc.watch} watch</b>, {oc.above} above normal, {oc.season} in season</div>}
              {ok?.events_in_box && <div className="small muted">{ok.events_in_box.length ? `${ok.events_in_box.length} open NASA EONET event${ok.events_in_box.length > 1 ? "s" : ""}: ${ok.events_in_box[0].title}` : "No open NASA EONET events inside"}</div>}
              {ok?.sent && ok.sent.length > 0 && <div className="small muted">Last email {ok.sent[ok.sent.length - 1].at.slice(0, 16).replace("T", " ")} UTC: {ok.sent[ok.sent.length - 1].subject}</div>}
              {test[m.token] && <div className="small">{test[m.token]}</div>}
            </div>
            <div className="row">
              {ok?.confirmed && <button className="btn ghost" onClick={() => sendTest(m.token)}>Send test email</button>}
              <a className="btn ghost" href={api.workflowUrl(m.token)} download>n8n</a>
              <button className="btn ghost" onClick={remove}>Delete</button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

const Tile = ({ label, value, sub }: { label: string; value: string; sub: string }) => (
  <div className="tile"><span className="muted small">{label}</span><b className="num">{value}</b><span className="muted small">{sub}</span></div>
);

/** Last 12 weeks: bar = harmonized hotspots, tick = median of the same week in earlier years, colour = percentile. */
function Weeks({ w }: { w: Warning }) {
  const rows = w.recent_weeks;
  const max = Math.max(1, ...rows.map((r) => Math.max(r.value ?? 0, r.median ?? 0)));
  const W = 480, H = 110, bw = W / rows.length;
  const col = (r: (typeof rows)[number]) =>
    r.partial ? "none" : r.percentile === null ? "#4A5B78" : r.percentile >= 90 ? "#EA7329" : r.percentile >= 75 ? "#F6C64F" : r.percentile <= 10 ? "#5B93D6" : "#7C8DAA";
  return (
    <figure className="fig">
      <svg viewBox={`0 0 ${W} ${H + 16}`} className="chart" role="img" aria-label="Weekly hotspots against the median of earlier years, last twelve weeks">
        {rows.map((r, i) => {
          const h = ((r.value ?? 0) / max) * (H - 6), mh = r.median === null ? null : (r.median / max) * (H - 6);
          return (
            <g key={r.period}>
              <rect className="abar" style={{ animationDelay: `${i * 40}ms` }} x={i * bw + 4} y={H - h} width={bw - 8} height={Math.max(h, 1)} fill={col(r)} stroke={r.partial ? "#E7EDF6" : "none"} strokeDasharray={r.partial ? "3 2" : undefined} fillOpacity={r.partial ? 0.2 : 1} />
              {mh !== null && <line x1={i * bw + 1} x2={i * bw + bw - 1} y1={H - mh} y2={H - mh} stroke="#F7F3E8" strokeWidth="1.6" />}
              <text x={i * bw + bw / 2} y={H + 12} className="axis" textAnchor="middle">{r.period.slice(6)}</text>
              <title>{periodLabel(r.period)}: {fmt(r.value)} hotspots{r.median !== null ? `, median ${fmt(r.median)}` : ""}{r.percentile !== null ? `, ${ordinal(Math.round(r.percentile))} percentile` : ""}{r.partial ? " (week in progress)" : ""}</title>
            </g>
          );
        })}
      </svg>
      <figcaption className="muted small">Last 12 ISO weeks of harmonized hotspots. White tick: median of the same week in earlier years. Orange: top tenth. Gold: top quarter. Blue: bottom tenth. Dashed: week in progress.</figcaption>
    </figure>
  );
}
