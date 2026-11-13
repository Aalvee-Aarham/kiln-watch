import { useEffect, useMemo, useState } from "react";
import { Events, LatestNews, NewsItem, PlaceNews, Reports, api } from "../api";
import { ReportList } from "../Detail";
import Loader, { STEPS } from "../Loader";
import { Offline, PageHead, PageProps } from "./shared";

const LANG: Record<string, string> = { en: "English", es: "Spanish", pt: "Portuguese", fr: "French", id: "Indonesian", hi: "Hindi", bn: "Bangla", ru: "Russian" };
const SRC_CLASS: Record<string, string> = { "Google News": "gn", GDACS: "gd", "NASA EONET": "eo", GDELT: "gl", ReliefWeb: "rw" };
const iso = (d: Date) => d.toISOString().slice(0, 10);

export default function News({ regions, online, openRegion, go }: PageProps) {
  return (
    <>
      <PageHead kicker="Corroboration" title="News and events" lead="What agencies and the press are reporting, in seven languages, next to what the satellites saw. Reports corroborate detections; their absence proves nothing." />
      {!online && <Offline what="News and event search" />}
      <Latest online={online} />
      <PlaceSearch online={online} go={go} />
      <OpenEvents online={online} regions={regions} openRegion={openRegion} />
      <Search regions={regions} online={online} />
    </>
  );
}

function Item({ it, i }: { it: NewsItem; i: number }) {
  return (
    <li style={{ animationDelay: `${Math.min(i, 20) * 35}ms` }}>
      <span className={`src ${SRC_CLASS[it.source] ?? ""}`}>{it.source === "Google News" ? (LANG[it.lang] ?? it.lang) : it.source}</span>
      <div>
        {it.url ? <a href={it.url} target="_blank" rel="noreferrer">{it.title || it.url}</a> : it.title}
        <div className="muted small">
          {[it.date, it.outlet, it.country].filter(Boolean).join(" · ")}
          {it.severity && <> · <b className={`gd-${(it.alert ?? "").toLowerCase()}`}>{it.severity}</b></>}
          {it.lat !== undefined && it.lat !== null && <> · {it.lat.toFixed(2)}°, {it.lon!.toFixed(2)}°</>}
        </div>
      </div>
    </li>
  );
}

/** Worldwide feed: Google News in 7 languages, GDACS and NASA EONET, newest first. */
function Latest({ online }: { online: boolean }) {
  const [days, setDays] = useState(3);
  const [res, setRes] = useState<LatestNews | null>(null);
  const [err, setErr] = useState("");
  const [lang, setLang] = useState("all");
  const [src, setSrc] = useState("all");
  const [n, setN] = useState(40);
  useEffect(() => {
    if (!online) return;
    setRes(null); setErr(""); setN(40);
    let live = true;
    api.latestNews(days).then((r) => live && setRes(r)).catch((e) => live && setErr(e.message));
    return () => { live = false; };
  }, [online, days]);
  const items = useMemo(() => (res?.items ?? []).filter((i) =>
    (src === "all" || i.source === src) && (lang === "all" || (i.source === "Google News" && i.lang === lang))), [res, lang, src]);
  const langs = [...new Set((res?.items ?? []).filter((i) => i.source === "Google News").map((i) => i.lang))];
  const sources = [...new Set((res?.items ?? []).map((i) => i.source))];
  return (
    <section>
      <h2><span className="live"><i />Live</span><br />Fire news worldwide <span className="muted small">Google News in 7 languages, GDACS and NASA EONET</span></h2>
      <div>
        <div className="seg" role="radiogroup" aria-label="Window">
          {[1, 3, 7, 14].map((d) => <button key={d} role="radio" aria-checked={days === d} className={days === d ? "on" : ""} onClick={() => setDays(d)}>{d === 1 ? "24 h" : `${d} days`}</button>)}
        </div>
      </div>
      {err && <p className="error">{err}</p>}
      {online && !res && !err && <Loader title="Gathering the world's fire news" steps={["Asking Google News in English, Spanish and Portuguese", "Adding French, Indonesian, Hindi and Bangla", "Reading GDACS disaster alerts", "Reading NASA EONET wildfire events", "Removing duplicates and sorting by date"]} expected={10} />}
      {res && <>
        <div className="srcchips">
          {res.sources.map((s) => <span key={s.name} className={s.error ? "bad" : ""} title={s.error ?? ""}>{s.name} <b>{s.count}</b></span>)}
        </div>
        <div className="row">
          <select value={src} onChange={(e) => setSrc(e.target.value)} aria-label="Source"><option value="all">All sources ({res.items.length})</option>{sources.map((s) => <option key={s}>{s}</option>)}</select>
          <select value={lang} onChange={(e) => setLang(e.target.value)} aria-label="Language"><option value="all">All languages</option>{langs.map((l) => <option key={l} value={l}>{LANG[l] ?? l}</option>)}</select>
          <span className="muted small">{items.length} items, {res.window[0]} to {res.window[1]}</span>
        </div>
        <ul className="news">{items.slice(0, n).map((it, i) => <Item key={(it.url ?? "") + i} it={it} i={i} />)}</ul>
        {items.length > n && <button className="btn ghost" onClick={() => setN(n + 60)}>Show more ({items.length - n} left)</button>}
        <p className="muted small">{res.note} Google News results are personal, non-commercial use of its public RSS feeds.</p>
      </>}
    </section>
  );
}

/** Any place name, any window: geocode, then every source. No built area needed. */
function PlaceSearch({ online, go }: { online: boolean; go: PageProps["go"] }) {
  const today = new Date();
  const [q, setQ] = useState("");
  const [a, setA] = useState(iso(new Date(Date.now() - 30 * 86400000)));
  const [b, setB] = useState(iso(today));
  const [res, setRes] = useState<PlaceNews | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const run = (e: React.FormEvent) => {
    e.preventDefault();
    if (!q.trim()) return;
    setBusy(true); setErr(""); setRes(null);
    api.placeNews(q.trim(), a, b).then(setRes).catch((x) => setErr(x.message)).finally(() => setBusy(false));
  };
  const long = (Date.parse(b) - Date.parse(a)) / 86400000 > 120;
  return (
    <section>
      <h2>Search any place</h2>
      <p className="muted small">Type a district, park, city or region and a date window. Kiln Watch finds its local languages and searches Google News, GDELT, NASA EONET and GDACS.</p>
      <form className="row" onSubmit={run} role="search">
        <input className="grow" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. Kalimantan, Chaco, Sundarbans, Alberta" aria-label="Place" />
        <label className="small">From <input type="date" value={a} max={b} onChange={(e) => setA(e.target.value)} /></label>
        <label className="small">to <input type="date" value={b} min={a} max={iso(today)} onChange={(e) => setB(e.target.value)} /></label>
        <button className="btn" disabled={!online || busy || !q.trim()}>{busy ? "Searching…" : "Search"}</button>
      </form>
      {busy && <div style={{ marginTop: 12 }}><Loader title={`Searching reports for ${q.trim()}`} steps={STEPS.news} expected={long ? 30 : 18} /></div>}
      {err && <p className="error">{err}</p>}
      {res && (
        <div className="placeres">
          <div className="assess neutral"><b>{res.place.name}{res.place.country ? `, ${res.place.country}` : ""}</b><span>{res.items.length} reports · {res.window[0]} to {res.window[1]} · languages {res.languages.join(", ")}</span></div>
          <div className="srcchips">
            {res.sources.map((s) => <span key={s.name} className={s.error ? "bad" : ""} title={s.error ?? s.coverage}>{s.name} <b>{s.error ? "!" : s.count}</b></span>)}
          </div>
          {res.items.length === 0 ? <p className="muted">No matching reports in these sources. That does not mean nothing burned: coverage varies by language, outlet and year.</p>
            : <ul className="news">{res.items.slice(0, 80).map((it, i) => <Item key={(it.url ?? "") + i} it={it} i={i} />)}</ul>}
          <div className="row">
            <button className="btn ghost" onClick={() => go("warning")}>Check this place's fire record and alerts</button>
          </div>
          <p className="muted small">{res.caveat}</p>
        </div>
      )}
    </section>
  );
}

function OpenEvents({ online, regions, openRegion }: Pick<PageProps, "online" | "regions" | "openRegion">) {
  const [ev, setEv] = useState<Events | null>(null);
  const [evErr, setEvErr] = useState("");
  const [onlyAreas, setOnlyAreas] = useState(false);
  useEffect(() => {
    if (online) api.events().then(setEv).catch((e) => setEvErr(e.message));
  }, [online]);
  const shown = (ev?.events ?? []).filter((e) => !onlyAreas || e.region_id).slice(0, 40);
  const name = (id: string | null) => regions.find((r) => r.id === id)?.name;
  return (
    <section>
      <h2>Open wildfire events <span className="muted small">NASA EONET</span></h2>
      {evErr && <p className="error">{evErr}</p>}
      {online && !ev && !evErr && <div className="skeleton" />}
      {ev && <>
        <label className="check"><input type="checkbox" checked={onlyAreas} onChange={(e) => setOnlyAreas(e.target.checked)} />Only events inside a Kiln Watch area</label>
        {shown.length === 0 ? <p className="muted">No open events{onlyAreas ? " inside your areas" : ""} right now.</p> : (
          <ul className="items wide">
            {shown.map((e, i) => (
              <li key={i}>
                {e.url ? <a href={e.url} target="_blank" rel="noreferrer">{e.title}</a> : e.title}
                <div className="muted small">
                  {e.date}, {e.lat.toFixed(2)}°, {e.lon.toFixed(2)}°
                  {e.region_id && <> · inside <button className="link" onClick={() => openRegion(e.region_id!)}>{name(e.region_id)}</button></>}
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="muted small">{ev.count} open events listed; showing the {shown.length} most recent. {ev.note}</p>
      </>}
    </section>
  );
}

function Search({ regions, online }: Pick<PageProps, "regions" | "online">) {
  const [rid, setRid] = useState("");
  const [month, setMonth] = useState("");
  const [rep, setRep] = useState<Reports | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [err, setErr] = useState("");
  const area = regions.find((r) => r.id === rid) ?? regions[0];
  const months = useMemo(() => {
    if (!area) return [];
    const [y, m] = area.data_through.split("-").map(Number);
    return Array.from({ length: 24 }, (_, i) => new Date(Date.UTC(y, m - 1 - i, 1)).toISOString().slice(0, 7));
  }, [area]);
  useEffect(() => { setRep(null); setState("idle"); }, [rid, month]);
  const pick = month || months[0];
  const run = () => {
    if (!area || !pick) return;
    setState("loading");
    api.reports(area.id, pick).then((x) => { setRep(x); setState("idle"); }).catch((e) => { setErr(e.message); setState("error"); });
  };
  return (
    <section>
      <h2>Reports for a built area and month</h2>
      <p className="muted small">Matched against that area's harmonized record: an unusually high month with reports is corroborated.</p>
      <div className="row">
        <select value={area?.id ?? ""} onChange={(e) => setRid(e.target.value)} aria-label="Area">{regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
        <select value={pick ?? ""} onChange={(e) => setMonth(e.target.value)} aria-label="Month">{months.map((m) => <option key={m}>{m}</option>)}</select>
        <button className="btn" onClick={run} disabled={!online || !area || state === "loading"}>{state === "loading" ? "Searching…" : "Search reports"}</button>
      </div>
      {state === "loading" && <div style={{ marginTop: 12 }}><Loader steps={STEPS.news} expected={18} compact /></div>}
      {state === "error" && <p className="error">{err}</p>}
      {rep && <div style={{ marginTop: 12 }}><ReportList rep={rep} /></div>}
    </section>
  );
}
