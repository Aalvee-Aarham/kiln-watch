import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Analyst from "./Analyst";
import { AgentReply, Cls, Health, Outlook, Region, RegionItem, SCALE_LABEL, SHORT, Scale, View, Warnings, api, fmt, periodLabel } from "./api";
import Detail, { RangeNews } from "./Detail";
import Loader, { STEPS } from "./Loader";
import MapView, { Basemap, FIRE_LAYERS, Focus, Layers, OUTLOOK_COLOR, OUTLOOK_LABEL, Projection } from "./Map";
import { Calendar, Continuity, Glance, SeasonView, useYearRange } from "./Record";
import { Create, Download } from "./pages/Data";
import { Mcp, N8n } from "./pages/Connect";
import MethodPage from "./pages/Method";
import News from "./pages/News";
import { LevelChip, PAGES, Page, PageProps, useSmoothScroll } from "./pages/shared";
import EarlyWarning from "./pages/Warning";
import Timeline from "./Timeline";

const Landing = lazy(() => import("./pages/Home")); // three.js + gsap load only on the home page

type Tab = "calendar" | "season" | "continuity";
const TABS: Tab[] = ["calendar", "season", "continuity"];
const PAGE_IDS = PAGES.map(([k]) => k) as string[];
const SCALES: Scale[] = ["hotspots", "viirs", "celldays", "raw"];
type Job = { id: string; status: string; done?: number; total?: number; stage?: string; error?: string };

const yesterday = () => new Date(Date.now() - 86400000).toISOString().slice(0, 10);
const clampDate = (d: string) => (d < "2000-11-01" ? "2000-11-01" : d > yesterday() ? yesterday() : d);
const shift = (d: string, days: number) => clampDate(new Date(Date.parse(d + "T00:00:00Z") + days * 86400000).toISOString().slice(0, 10));
const readHash = () => Object.fromEntries(new URLSearchParams(location.hash.slice(1)));

export default function App() {
  const h0 = useMemo(readHash, []);
  const [health, setHealth] = useState<Health | null>(null);
  const [online, setOnline] = useState(true);
  const [regions, setRegions] = useState<RegionItem[]>([]);
  const [regionId, setRegionId] = useState<string | null>(h0.r ?? null);
  const [region, setRegion] = useState<Region | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [granularity, setGranularity] = useState<"month" | "week">(h0.g === "week" ? "week" : "month");
  const [scale, setScale] = useState<Scale>((SCALES as string[]).includes(h0.s) ? (h0.s as Scale) : "hotspots");
  const [cls, setCls] = useState<Cls>(h0.c === "static" ? "static" : "veg");
  const [pg, setPg] = useState<Page>(PAGE_IDS.includes(h0.pg) ? (h0.pg as Page) : h0.r ? "explore" : "home");
  const [ew, setEw] = useState<Warnings | null>(null);
  const [tab, setTab] = useState<Tab>((TABS as string[]).includes(h0.t) ? (h0.t as Tab) : "calendar");
  const [view, setView] = useState<View>("value");
  const [period, setPeriod] = useState<string | null>(h0.p ?? null);
  const [date, setDate] = useState(clampDate(h0.d ?? yesterday()));
  const [layers, setLayers] = useState<Layers>({
    fires: { VIIRS_NOAA20_Thermal_Anomalies_375m_All: true, MODIS_Combined_Thermal_Anomalies_All: true },
    grid: true, statics: true, outlook: true,
  });
  const [basemap, setBasemap] = useState<Basemap>((["dark", "night", "satellite", "relief"] as string[]).includes(h0.b) ? (h0.b as Basemap) : "night");
  const [projection, setProjection] = useState<Projection>(h0.pj === "flat" ? "mercator" : "globe");
  const [outlook, setOutlook] = useState<Outlook | null>(null);
  const [layersOpen, setLayersOpen] = useState(window.innerWidth > 900);
  const [analystOpen, setAnalystOpen] = useState(false);
  const [newsOpen, setNewsOpen] = useState(false);
  const [seed, setSeed] = useState<string | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [draft, setDraft] = useState<number[] | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [focus, setFocus] = useState<Focus | null>(null);
  const [playing, setPlaying] = useState(false);
  const [search, setSearch] = useState("");
  const [searchErr, setSearchErr] = useState("");
  const pageRef = useRef<HTMLElement>(null);
  useSmoothScroll(pageRef, pg);

  const refreshRegions = useCallback(() => api.regions().then(setRegions).catch(() => setRegions([])), []);
  useEffect(() => {
    refreshRegions();
    api.health().then((h) => {
      setHealth(h); setOnline(true);
      api.warnings().then(setEw).catch(() => undefined);
      api.outlook().then(setOutlook).catch(() => undefined); // needs the global aggregate; the layer hides without it
    }).catch(() => setOnline(false));
  }, [refreshRegions]);

  useEffect(() => {
    setRegion(null);
    setLoadErr(null);
    if (!regionId) return;
    let live = true;
    api.region(regionId).then((r) => live && setRegion(r)).catch((e) => live && setLoadErr(e.message));
    return () => { live = false; };
  }, [regionId]);

  // shareable URL
  useEffect(() => {
    if (pg === "home") { history.replaceState(null, "", location.pathname + location.search); return; }
    const q = new URLSearchParams();
    q.set("pg", pg);
    if (regionId) q.set("r", regionId);
    if (period) q.set("p", period);
    q.set("d", date);
    if (granularity !== "month") q.set("g", granularity);
    if (scale !== "hotspots") q.set("s", scale);
    if (cls !== "veg") q.set("c", cls);
    if (tab !== "calendar") q.set("t", tab);
    if (basemap !== "night") q.set("b", basemap);
    if (projection !== "globe") q.set("pj", "flat");
    history.replaceState(null, "", "#" + q.toString());
  }, [pg, regionId, period, date, granularity, scale, cls, tab, basemap, projection]);

  // custom-area build polling
  useEffect(() => {
    if (!job || job.status !== "running") return;
    const t = setInterval(() => api.aoi(job.id).then((j) => {
      setJob(j);
      if (j.status === "ready") { refreshRegions().then(() => { setRegionId(j.id); setJob(null); setTab("calendar"); setPg((p) => (p === "create" ? "explore" : p)); }); }
    }).catch(() => undefined), 3000);
    return () => clearInterval(t);
  }, [job, refreshRegions]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (drawing) setDrawing(false);
      else if (draft) setDraft(null);
      else if (period) setPeriod(null);
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [drawing, draft, period]);

  const block = region ? (granularity === "week" ? region.weekly : region.monthly) : null;
  const [years, setYears, yearBounds] = useYearRange(region?.monthly ?? null);
  const month = date.slice(0, 7);
  const lastMonth = region?.meta.data_through.slice(0, 7) ?? yesterday().slice(0, 7);

  const openRegion = (id: string | null) => {
    setRegionId(id); setPeriod(null); setTab("calendar"); setPg("explore"); setNewsOpen(false);
    if (id) setLayersOpen(false); // keep the map clear once an area is open; the Layers button reopens it
  };
  const selectPeriod = (p: string) => {
    setPeriod(p);
    setGranularity(p.includes("-W") ? "week" : "month");
    if (!p.includes("-W")) setDate(clampDate(`${p}-15`));
    else {
      const [y, w] = [+p.slice(0, 4), +p.slice(6)];
      const jan4 = new Date(Date.UTC(y, 0, 4));
      const mon = new Date(jan4.getTime() - ((jan4.getUTCDay() + 6) % 7) * 86400000 + (w - 1) * 7 * 86400000);
      setDate(clampDate(mon.toISOString().slice(0, 10)));
    }
  };
  const onTimelineMonth = (m: string) => {
    setDate(clampDate(`${m}-${date.slice(8, 10) > "28" ? "28" : date.slice(8, 10)}`));
    if (period && !period.includes("-W")) setPeriod(m);
  };

  const onActions = (actions: AgentReply["actions"]) => {
    for (const a of actions) {
      if (a.name === "ui_select_region") openRegion(a.args.region_id);
      if (a.name === "ui_select_period" && a.args.period) selectPeriod(a.args.period);
      if (a.name === "ui_set_view") {
        if (a.args.granularity) setGranularity(a.args.granularity as "month" | "week");
        if ((SCALES as string[]).includes(a.args.scale)) setScale(a.args.scale as Scale);
        if (a.args.tab === "vs_median") { setTab("calendar"); setView("median"); }
        else if (a.args.tab === "calendar") { setTab("calendar"); setView("value"); }
        else if ((TABS as string[]).includes(a.args.tab)) { setPg("explore"); setTab(a.args.tab as Tab); }
      }
    }
  };

  const doSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setSearchErr("");
    const q = search.trim();
    if (!q) return;
    const hit = regions.find((r) => `${r.name} ${r.country}`.toLowerCase().includes(q.toLowerCase()));
    if (hit) { openRegion(hit.id); return; }
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(q)}`);
      const [p] = await r.json();
      if (!p) { setSearchErr(`No place called “${q}”.`); return; }
      const [s, n, w, ea] = p.boundingbox.map(Number);
      setFocus({ bbox: [w, s, ea, n], n: Date.now() });
    } catch { setSearchErr("Place search is unavailable right now."); }
  };

  const startBuild = async (box = draft, name?: string) => {
    if (!box) return;
    try {
      const j = await api.startAoi(box, name);
      setDraft(null);
      if (j.status === "ready") { await refreshRegions(); openRegion(j.id); } else setJob(j);
    } catch (e) { setJob({ id: "", status: "error", error: (e as Error).message }); setDraft(null); }
  };

  /** A 2° box around a clicked outlook cell becomes a draft area, ready to build. */
  const pickAround = (lon: number, lat: number) => {
    if (job?.status === "running") return;
    const r = (v: number) => Math.round(v * 100) / 100;
    const b = [r(Math.max(-180, lon - 1)), r(Math.max(-90, lat - 1)), r(Math.min(180, lon + 1)), r(Math.min(90, lat + 1))];
    setDrawing(false); setRegionId(null); setPeriod(null); setDraft(b); setFocus({ bbox: b, n: Date.now() });
  };

  const pageProps: PageProps = { regions, online, go: setPg, openRegion: (id) => openRegion(id), refresh: refreshRegions };
  const area = draft ? Math.abs((draft[2] - draft[0]) * (draft[3] - draft[1])) : 0;
  const context = { region_id: regionId, region_name: region?.meta.name, period, granularity, scale, class: cls, map_date: date };

  if (pg === "home") return <Suspense fallback={<div className="h3d" />}><Landing {...pageProps} /></Suspense>;

  return (
    <div className={`app ${analystOpen ? "with-analyst" : ""}`}>
      <header className="top">
        <a className="brand" href="#" onClick={(e) => { e.preventDefault(); openRegion(null); setPg("home"); }}>
          <svg viewBox="0 0 32 32" aria-hidden><path d="M16 4c2.2 5.4 7.5 7.6 7.5 14a7.5 7.5 0 0 1-15 0c0-3.3 2.1-5.4 3.2-7.5 1.1 3.2 2.2 4.3 4.3 4.3C15 10.5 15 7.3 16 4z" fill="#EA7329" /><path d="M16 17c1 2.2 3 3 3 5.5a3 3 0 0 1-6 0c0-1.6 1-2.6 1.6-3.5.4 1.2.9 1.6 1.4 1.6-.4-1.2-.4-2.4 0-3.6z" fill="#F6C64F" /></svg>
          <span>Kiln Watch</span>
        </a>
        <nav className="nav" aria-label="Pages">
          {PAGES.map(([k, l]) => (
            <button key={k} className={`navlink ${pg === k ? "on" : ""} ${k === "warning" ? "feature" : ""}`} aria-current={pg === k ? "page" : undefined}
              onClick={() => { setPg(k); if (k === "explore") setPeriod(null); }}>
              {l}{k === "warning" && ew && ew.alerts.some((a) => a.level === "elevated" || a.level === "watch") && <i className="pip" aria-label="areas above normal" />}
            </button>
          ))}
        </nav>
        {pg === "explore" && <>
        <form className="search" onSubmit={doSearch} role="search">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search a place or area" aria-label="Search a place or area" />
          {searchErr && <span className="search-err" role="alert">{searchErr}</span>}
        </form>
        <div className="datebox" aria-label="Map date">
          <button className="icon" onClick={() => setDate(shift(date, -1))} aria-label="Previous day">‹</button>
          <input type="date" value={date} min="2000-11-01" max={yesterday()} onChange={(e) => e.target.value && setDate(clampDate(e.target.value))} aria-label="Date shown on map" />
          <button className="icon" onClick={() => setDate(shift(date, 1))} aria-label="Next day">›</button>
        </div>
        <div className="top-actions">
          <button className={`btn ghost ${drawing ? "on" : ""}`} onClick={() => { setDrawing(!drawing); setDraft(null); }} disabled={!online} title={online ? "" : "Needs the Kiln Watch API"}>
            {drawing ? "Cancel drawing" : "Draw an area"}
          </button>
          <button className={`btn ${analystOpen ? "on" : ""}`} onClick={() => setAnalystOpen(!analystOpen)}>Analyst</button>
        </div>
        </>}
      </header>

      {pg !== "explore" ? (
        <main className="page" id="main" key={pg} ref={pageRef}>
          <div className="page-in">
            {pg === "warning" && <EarlyWarning {...pageProps} />}
            {pg === "news" && <News {...pageProps} />}
            {pg === "download" && <Download {...pageProps} />}
            {pg === "create" && <Create {...pageProps} job={job} build={(b, n) => startBuild(b, n)} goDraw={() => { setPg("explore"); setDrawing(true); }} />}
            {pg === "method" && <MethodPage {...pageProps} />}
            {pg === "mcp" && <Mcp {...pageProps} />}
            {pg === "n8n" && <N8n {...pageProps} />}
          </div>
        </main>
      ) : (
      <main className="stage">
        <MapView regions={regions} region={region} month={month} date={date} layers={layers} basemap={basemap}
          projection={projection} outlook={outlook} onOutlookPick={pickAround}
          drawing={drawing} focus={focus} onPickRegion={openRegion}
          onDrawn={(b) => { setDrawing(false); setDraft(b); }} />

        {outlook && layers.outlook && !layersOpen && <MapKey o={outlook} />}
        {drawing && <div className="hint" role="status">Drag a box over the area you want to analyse. Press Esc to cancel.</div>}

        <button className="layers-toggle btn ghost" onClick={() => setLayersOpen(!layersOpen)} aria-expanded={layersOpen}>Layers</button>
        {layersOpen && (
          <aside className="layers" aria-label="Map layers">
            <h2>View</h2>
            <Seg value={projection} onChange={setProjection} options={[["globe", "3D globe"], ["mercator", "Flat map"]]} />
            <h2>Early warning, next 30 days</h2>
            <label className="check"><input type="checkbox" checked={layers.outlook} onChange={(e) => setLayers({ ...layers, outlook: e.target.checked })} disabled={!outlook} /><i className="sw-pulse" />Worldwide fire-season outlook</label>
            {outlook ? <OutlookKey o={outlook} /> : <p className="muted small">{online ? "Loading the outlook…" : "Needs the Kiln Watch API."}</p>}
            <h2>Fire detections on {date}</h2>
            <p className="muted small">NASA FIRMS hotspots rendered by NASA GIBS for the selected day.</p>
            {FIRE_LAYERS.map((f) => (
              <label key={f.id} className={`check ${date < f.from ? "dim" : ""}`}>
                <input type="checkbox" checked={!!layers.fires[f.id]} onChange={(e) => setLayers({ ...layers, fires: { ...layers.fires, [f.id]: e.target.checked } })} />
                <i style={{ background: f.color }} />{f.label}
                {date < f.from && <span className="muted small"> from {f.from.slice(0, 4)}</span>}
              </label>
            ))}
            <h2>Kiln Watch</h2>
            <label className="check"><input type="checkbox" checked={layers.grid} onChange={(e) => setLayers({ ...layers, grid: e.target.checked })} /><i className="sw-grid" />Harmonized activity, {periodLabel(month)}</label>
            <label className="check"><input type="checkbox" checked={layers.statics} onChange={(e) => setLayers({ ...layers, statics: e.target.checked })} /><i style={{ background: "#C9A2F2" }} />Persistent heat sources (kilns, flares, industry)</label>
            {!region && <p className="muted small">Open an area to see these.</p>}
            <h2>Base map</h2>
            {([["night", "Night lights (NASA Black Marble)"], ["dark", "Dark map"], ["satellite", "Satellite image of the day"], ["relief", "Blue Marble relief"]] as const).map(([k, l]) => (
              <label key={k} className="check"><input type="radio" name="base" checked={basemap === k} onChange={() => setBasemap(k)} />{l}</label>
            ))}
          </aside>
        )}

        <section className="panel" aria-label="Area record">
          {job ? (
            <div className="pad">
              <h2>Building a record for your area</h2>
              {job.status === "error" ? <>
                <p className="error">{job.error}</p>
                <button className="btn" onClick={() => setJob(null)}>Back</button>
              </> : <>
                <Loader steps={STEPS.build} expected={25} done={job.total ? job.done : undefined} total={job.total || undefined} />
                <p className="small muted" style={{ marginTop: 8 }}>{job.stage ?? "starting"}. The first build reads every detection since 2000; after that the area opens instantly.</p>
              </>}
            </div>
          ) : draft ? (
            <div className="pad">
              <h2>Analyse this area?</h2>
              <p className="num">{draft[1].toFixed(2)}°, {draft[0].toFixed(2)}° to {draft[3].toFixed(2)}°, {draft[2].toFixed(2)}°</p>
              {area > 16 ? <p className="error">This box is {area.toFixed(1)} square degrees. Draw one up to 16 (about 4° × 4°).</p>
                : <p className="muted">About {Math.round(area * 12100).toLocaleString()} km². The first build takes a few minutes.</p>}
              <div className="row">
                <button className="btn" onClick={() => startBuild()} disabled={area > 16}>Build record</button>
                <button className="btn ghost" onClick={() => { setDraft(null); setDrawing(true); }}>Redraw</button>
                <button className="btn ghost" onClick={() => setDraft(null)}>Cancel</button>
              </div>
            </div>
          ) : !regionId ? (
            <Home ew={ew} outlook={outlook} onFly={(b) => setFocus({ bbox: b, n: Date.now() })} onPickAround={pickAround} onWarn={() => setPg("warning")} regions={regions} online={online} onOpen={openRegion} onDraw={() => setDrawing(true)}
              onBox={(b) => { setDraft(b); setFocus({ bbox: b, n: Date.now() }); }} />
          ) : loadErr ? (
            <div className="pad"><p className="error">Couldn't open this area: {loadErr}</p><button className="btn" onClick={() => openRegion(null)}>All areas</button></div>
          ) : !region || !block ? (
            <div className="pad"><div className="skeleton tall" /></div>
          ) : period && block.periods.includes(period) ? (
            <Detail r={region} period={period} scale={scale} cls={cls} online={online}
              onBack={() => setPeriod(null)} onDate={(d) => setDate(clampDate(d))}
              onPoint={(lon, lat, d) => { setDate(clampDate(d)); setFocus({ center: [lon, lat], zoom: 10, n: Date.now() }); }}
              onAsk={(q) => { setAnalystOpen(true); setSeed(q); }} />
          ) : (
            <div className="record">
              <header className="rec-head">
                <div>
                  <h2>{region.meta.name}</h2>
                  <p className="muted small">{region.meta.country ? `${region.meta.country}, ` : ""}data through {region.meta.data_through}</p>
                  {(() => { const w = ew?.alerts.find((a) => a.region_id === regionId); return w && <button className="chiplink" onClick={() => setPg("warning")} title={w.headline}>Early warning: <LevelChip level={w.level} /></button>; })()}
                </div>
                <button className="icon" onClick={() => openRegion(null)} aria-label="Close area">✕</button>
              </header>
              {region.meta.story && <p className="story">{region.meta.story}</p>}
              <nav className="tabs" role="tablist">
                {([["calendar", "Calendar"], ["season", "Season"], ["continuity", "Continuity"]] as const).map(([k, l]) => (
                  <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>
                ))}
              </nav>
              {tab !== "season" && (
                <div className="seg-row">
                  <Seg value={cls} onChange={setCls} options={[["veg", "Vegetation fires"], ["static", "Kilns & static heat"]]} />
                  {tab === "calendar" && <Seg value={granularity} onChange={(g) => { setGranularity(g); setPeriod(null); }} options={[["month", "Month"], ["week", "Week"]]} />}
                </div>
              )}
              {tab === "calendar" && (
                <>
                  <Glance meta={region.meta} />
                  <div className="seg-row">
                    <Seg value={view} onChange={setView} options={[["value", "Hotspots"], ["median", "vs. median"], ["recent", "vs. recent years"]]} />
                    {view === "value" && (
                      <select value={scale} onChange={(e) => setScale(e.target.value as Scale)} aria-label="Unit">
                        {SCALES.map((s) => <option key={s} value={s}>{SCALE_LABEL[s]}</option>)}
                      </select>
                    )}
                    <span className="years small">
                      <label>Years <select value={years[0]} onChange={(e) => setYears([+e.target.value, Math.max(+e.target.value, years[1])])} aria-label="From year">{range(yearBounds).map((y) => <option key={y}>{y}</option>)}</select></label>
                      <label> to <select value={years[1]} onChange={(e) => setYears([Math.min(years[0], +e.target.value), +e.target.value])} aria-label="To year">{range(yearBounds).map((y) => <option key={y}>{y}</option>)}</select></label>
                    </span>
                  </div>
                  {online && !newsOpen && (
                    <button className="btn ghost" onClick={() => setNewsOpen(true)}>News and reports for chosen years</button>
                  )}
                  {newsOpen && <RangeNews r={region} bounds={yearBounds} onOpen={selectPeriod}
                    onAsk={(q) => { setAnalystOpen(true); setSeed(q); }} onClose={() => setNewsOpen(false)} />}
                  {scale === "raw" && view === "value" && <p className="warn small">Raw counts rise with every satellite added and are not comparable across years. Use the Aqua or VIIRS scale for trends.</p>}
                  <Calendar block={block} scale={view !== "value" ? "hotspots" : scale} cls={cls} view={view} weekly={granularity === "week"} years={years} selected={period} onOpen={selectPeriod} />
                </>
              )}
              {tab === "season" && <SeasonView r={region} />}
              {tab === "continuity" && <Continuity r={region} cls={cls} />}
            </div>
          )}
        </section>

        {analystOpen && (
          <Analyst enabled={!!health?.agent} online={online} context={context} seed={seed} onSeedUsed={() => setSeed(null)}
            onActions={onActions} onClose={() => setAnalystOpen(false)} model={health?.model} />
        )}
      </main>
      )}

      <footer className="bottom">
        {pg === "explore" && <Timeline block={region?.monthly ?? null} cls={cls} sensors={region?.meta.sensors ?? null} month={month} lastMonth={lastMonth}
          onMonth={onTimelineMonth} playing={playing} onPlay={setPlaying} />}
        <div className="status small muted">
          {!online && <span className="offline">Offline mode: preset areas only.</span>}
          <Latest regions={regions} />
          <span>Data: NASA FIRMS (MODIS, VIIRS) via <a href="https://source.coop/portolan-mirrors/firms-catalog" target="_blank" rel="noreferrer">Portolan mirror</a>, imagery NASA GIBS. Not an official NASA product.</span>
        </div>
      </footer>
    </div>
  );
}

function Seg<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: readonly (readonly [T, string])[] }) {
  return (
    <div className="seg" role="radiogroup">
      {options.map(([k, l]) => <button key={k} role="radio" aria-checked={value === k} className={value === k ? "on" : ""} onClick={() => onChange(k)}>{l}</button>)}
    </div>
  );
}

const range = ([a, b]: [number, number]) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

/** Last day each satellite delivered data: live proof of launches and of the Suomi-NPP end. */
function Latest({ regions }: { regions: RegionItem[] }) {
  const last = regions.find((r) => r.sensors_last)?.sensors_last;
  if (!last) return null;
  const newest = Object.values(last).sort().pop()!;
  const items = (["VIIRS_NOAA20", "VIIRS_NOAA21", "VIIRS_SNPP", "MODIS_A", "MODIS_T"] as const).filter((s) => last[s]).map((s) => {
    const ended = (Date.parse(newest) - Date.parse(last[s])) / 86400000 > 3;
    return <span key={s}>{SHORT[s]} {ended ? <b className="ended">ended {last[s]}</b> : last[s]}</span>;
  });
  return <span className="latest">Latest data: {items}</span>;
}

function Home({ ew, outlook, onFly, onPickAround, onWarn, regions, online, onOpen, onDraw, onBox }: { ew: Warnings | null; outlook: Outlook | null; onFly: (b: number[]) => void; onPickAround: (lon: number, lat: number) => void; onWarn: () => void; regions: RegionItem[]; online: boolean; onOpen: (id: string) => void; onDraw: () => void; onBox: (b: number[]) => void }) {
  const presets = regions.filter((r) => r.preset), custom = regions.filter((r) => !r.preset);
  const [box, setBox] = useState(["", "", "", ""]);
  const nums = box.map(Number);
  const boxOk = box.every((v) => v.trim() !== "" && Number.isFinite(+v)) && nums[1] < nums[3] && Math.abs(nums[0]) <= 180 && Math.abs(nums[2]) <= 180 && Math.abs(nums[1]) <= 90 && Math.abs(nums[3]) <= 90;
  return (
    <div className="home pad">
      <h1>One fire record, 2000 to today</h1>
      <p>Satellites changed over 26 years, so raw hotspot counts jump whenever a new one launches. Kiln Watch calibrates MODIS and every VIIRS satellite onto one scale, shows the uncertainty, and lets you check each number against the detections and reports behind it.</p>
      {ew && <EwBanner ew={ew} onOpen={onWarn} />}
      {outlook && <OutlookCard o={outlook} onFly={onFly} onPickAround={onPickAround} />}
      <h2>Open an area</h2>
      {regions.length === 0 && <p className="muted">No areas built yet. Run <code>python -m kw.build</code> in <code>server/</code>.</p>}
      <ul className="areas">
        {presets.map((r) => (
          <li key={r.id}><button onClick={() => onOpen(r.id)}><b>{r.name}</b><span className="muted small">{r.country}</span><span className="small">{r.story}</span></button></li>
        ))}
      </ul>
      {custom.length > 0 && <>
        <h2>Your areas</h2>
        <ul className="areas compact">{custom.map((r) => <li key={r.id}><button onClick={() => onOpen(r.id)}><b>{r.name}</b><span className="muted small">built {r.built_at?.slice(0, 10)}</span></button></li>)}</ul>
      </>}
      <h2>Analyse any area</h2>
      <button className="btn" onClick={onDraw} disabled={!online}>Draw a box on the map</button>
      <form className="coords" onSubmit={(e) => { e.preventDefault(); if (boxOk) onBox(nums); }}>
        <p className="muted small">Or enter its edges in decimal degrees:</p>
        <div className="coord-grid">
          {(["West", "South", "East", "North"] as const).map((l, i) => (
            <label key={l}>{l}<input inputMode="decimal" value={box[i]} placeholder={["88.0", "23.0", "89.5", "24.5"][i]} onChange={(e) => setBox(box.map((v, j) => (j === i ? e.target.value : v)))} /></label>
          ))}
        </div>
        <button className="btn ghost" disabled={!online || !boxOk}>Check this area</button>
      </form>
      {!online && <p className="muted small">New areas need the Kiln Watch API.</p>}
    </div>
  );
}

function EwBanner({ ew, onOpen }: { ew: Warnings; onOpen: () => void }) {
  const hot = ew.alerts.filter((a) => a.level === "elevated" || a.level === "watch");
  return (
    <button className={`ew-banner ${hot.length ? "hot" : ""}`} onClick={onOpen}>
      <b>Early warning</b>
      <span>{hot.length ? `${hot.length} of ${ew.count} areas above normal now: ${hot.slice(0, 2).map((a) => a.name.split(",")[0]).join(", ")}${hot.length > 2 ? "…" : ""}` : `No area above normal as of ${ew.as_of}`}</span>
      <span className="go">See the watchlist ›</span>
    </button>
  );
}

const day = (d: string) => new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

function OutlookKey({ o }: { o: Outlook }) {
  return (
    <div className="okey">
      {(["watch", "above", "season"] as const).map((c) => (
        <div key={c}><i className={`od ${c}`} style={{ background: OUTLOOK_COLOR[c] }} /><span>{OUTLOOK_LABEL[c]} <b className="num">{fmt(o.counts[c])}</b></span></div>
      ))}
      <p className="muted small">0.5° cells, Aqua MODIS {o.baseline_years[0]}–{o.baseline_years[1]} against the last 30 days to {o.as_of}. A climatological outlook, not a forecast. Click a dot for details.</p>
    </div>
  );
}

function MapKey({ o }: { o: Outlook }) {
  return (
    <div className="mapkey" aria-label="Outlook legend">
      <b>Next 30 days · {day(o.next_30_days[0])} to {day(o.next_30_days[1])}</b>
      <span><i className="od watch" style={{ background: OUTLOOK_COLOR.watch }} />Watch {fmt(o.counts.watch)}</span>
      <span><i className="od" style={{ background: OUTLOOK_COLOR.above }} />Above normal {fmt(o.counts.above)}</span>
      <span><i className="od" style={{ background: OUTLOOK_COLOR.season }} />Season ahead {fmt(o.counts.season)}</span>
    </div>
  );
}

/** Explorer side panel: where the next 30 days look most serious, in words, with one click to analyse. */
function OutlookCard({ o, onFly, onPickAround }: { o: Outlook; onFly: (b: number[]) => void; onPickAround: (lon: number, lat: number) => void }) {
  return (
    <section className="ocard">
      <header>
        <span className="live"><i />Early warning</span>
        <b>Next 30 days, {day(o.next_30_days[0])} to {day(o.next_30_days[1])}</b>
      </header>
      <p className="small"><b className="num" style={{ color: OUTLOOK_COLOR.watch }}>{fmt(o.counts.watch)}</b> cells are entering a usually active fire season while already running above normal; <b className="num">{fmt(o.counts.rising)}</b> are in a season that usually ramps up now.</p>
      {o.regions.length > 0 && (
        <ol className="oregions">
          {o.regions.slice(0, 6).map((g, i) => {
            const x = g.usual_last_30 ? g.last_30 / g.usual_last_30 : null;
            return (
              <li key={i} style={{ animationDelay: `${i * 70}ms` }}>
                <button onClick={() => onFly(g.bbox)} title="Fly there">
                  <b>{g.name.split(",").slice(0, 2).join(",")}</b>
                  <span className="muted small">{g.country} · {g.cells} cells · last 30 days {fmt(g.last_30)} hotspots{x ? `, ${x >= 10 ? Math.round(x) : x.toFixed(1)}× usual` : ""}</span>
                </button>
                <button className="link small" onClick={() => onPickAround(g.lon, g.lat)}>Analyse</button>
              </li>
            );
          })}
        </ol>
      )}
      <p className="muted small">Aqua MODIS only, compared with the same days in {o.baseline_years[0]}–{o.baseline_years[1]}. It says what is usual and how unusual today is; it does not predict weather or fire.</p>
    </section>
  );
}
