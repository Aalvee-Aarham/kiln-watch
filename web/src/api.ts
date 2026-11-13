// Data access + shared types. Region files are static JSON (served by the API or any static host);
// evidence, reports, custom areas, hotspot CSVs and the analyst need the Python API.

const API = (import.meta.env.VITE_API_BASE as string | undefined) ?? "";

export type Num = number | null;
export type Band = { v: Num[]; lo: Num[]; hi: Num[] };
/** w* = recency-weighted baseline (exponential decay, 10-year half-life); absent in files built before it existed. */
export type History = { median: Num[]; ratio: Num[]; pct: Num[]; rank: Num[]; n: Num[]; wmedian?: Num[]; wratio?: Num[]; wpct?: Num[] };
export type View = "value" | "median" | "recent";
export type ClassBlock = {
  hotspots: Band & { sensors: string[][] };
  viirs_scale: Band & { modelled: boolean[] };
  celldays: Band;
  aqua_only: Num[];
  history: History;
};
export type RawSensor = { det: number[]; det_D: number[]; det_N: number[]; celldays: number[]; frp: number[]; static_det: number[] };
export type Block = {
  periods: string[]; partial: boolean[]; provisional: boolean[];
  coverage: Record<string, number[]>;
  classes: { veg: ClassBlock; static: ClassBlock };
  raw: Record<string, RawSensor> & { all_det: number[] };
  nrt_share: Num[];
};
export type Metric = { n: number; bias_pct?: Num; mae?: number; rmse?: number; spearman?: Num; interval_coverage?: Num; interval_coverage_raw?: Num };
export type Link = { sensor: string; reference: string; window: string[]; beta: number[]; pooled: number; sigma2: number; tau2: number; n_periods: number; calibrated: boolean };
export type Trend = { tau: Num; p: Num; z: Num; sen_per_year: Num; n: number; years: number[] };
export type Season = {
  fire_year_start_week: number; climatology: Num[];
  years: { fire_year: number; start: number; peak: number; end: number; length: number; total: number }[];
  median: { start: number; peak: number; end: number };
  trend: Record<"start" | "end" | "length", { tau: Num; p: Num; sen_weeks_per_decade: Num }>;
  envelope: [number, number, number][];
  current: { fire_year: number; cumulative: number[] };
  next_4_weeks_share_pct: Num;
  year_to_date: { value: number; weeks: number; rank: number; n: number; median: number } | null;
};
export type Meta = {
  id: string; name: string; country: string | null; story: string | null; places: string[]; bbox: number[];
  grid_deg: number; data_through: string; built_at: string;
  estimand: { primary: string; why_aqua: string; secondary: string[]; not: string };
  method: Record<string, string>;
  calibration: Record<string, Link[]>;
  closure: Record<string, { sensor: string; reference: string; window: string[]; direct: number; composed: number; mismatch_pct: number; n: number }[]>;
  validation: Record<string, { sensor: string; reference: string; train: string[]; test: string[]; ours_seasonal_eb: Metric; baseline_single_ratio: Metric; uncalibrated: Metric }[]>;
  transfer_validation: { train: string[]; test: string[]; calibrated_here: Metric; transferred_from_other_regions: Metric } | null;
  denial: {
    modis_ends_2016: { train: string[]; test: string[]; n: number; ours_seasonal_eb: Metric; baseline_single_ratio: Metric; uncalibrated: Metric; interval_scale: number;
      series?: { periods: string[]; aqua: Num[]; predicted: Num[]; lo: Num[]; hi: Num[] } };
    snpp_withheld: { window: string[]; n: number; inside_interval: Num; mean_abs_diff_pct: Num; series: { periods: string[]; all: Num[]; without_snpp: Num[] } } | null;
    snpp_cutover: { snpp_last_observed: string; periods: string[]; raw_all: number[]; harmonized: Num[]; lo: Num[]; hi: Num[]; partial: boolean[]; sensors: string[][] } | null;
  };
  interval_scale: number;
  steps: Record<string, { period: string; raw_all_sensors: Num; aqua_only: Num; harmonized: Num; raw_all_sensors_excess?: Num; harmonized_excess?: Num }>;
  placebo: { n: number; excess_p05: number; excess_median: number; excess_p95: number; dates: string } | null;
  trend: Record<"2003-2020" | "full", Record<"harmonized" | "aqua_only" | "raw_all_sensors", Trend>>;
  drift: Record<string, [number, number][]>;
  season: Season | null;
  current: { period: string; days: number; partial: boolean; value: number; lo: number; hi: number; median: number; higher_than: number; n_prior: number; rank: number; prior: [number, number][]; sentence: string } | null;
  answers: { peak_months: number[]; peak_share_pct: number; top_years: [number, number][]; sentences: string[] };
  frp_distribution: { available: boolean; reason?: string; q_aqua_test?: number[]; q_snpp_test?: number[]; q_snpp_mapped?: number[]; w2_raw?: number; w2_mapped?: number; note?: string; n?: Record<string, number> };
  filter_sensitivity: { dropped_share_by_sensor_daynight: Record<string, number>; annual_total_change_pct_if_unfiltered: { mean: Num; max_abs: Num }; note: string };
  versions: { sensor: string; version: string; first: string; last: string; detections: number }[];
  sensors: Record<string, { first: string; last: string; days: number }>;
  totals: { detections: number; static_detections: number; nrt_detections: number };
  provenance: { source: string; mirror: string; mirror_updated: string | null; license: string; acknowledgement: string; code_version: string; reproduce: string };
};
export type Grid = { deg: number; cells: [number, number][]; months: Record<string, [number, number][]>; unit: string };
export type StaticPts = { points: [number, number, number, number, number, number, number, number][] };
export type RegionItem = { id: string; name: string; country: string | null; bbox: number[]; story: string | null; data_through: string; built_at?: string; preset: boolean; sensors_last?: Record<string, string> };
export type Region = { meta: Meta; monthly: Block; weekly: Block; grid: Grid; statics: StaticPts };

export type Evidence = {
  period: string; start: string; end: string;
  daily: { date: string; sensor: string; class: string; detections: number; frp_mw: number }[];
  top_detections: { time_utc: string; satellite: string; sensor: string; daynight: string; quality: string; version: string; class: string; lat: number; lon: number; frp_mw: number; confidence: string; scan: number; track: number }[];
  split: { class: string; daynight: string; quality: string; detections: number }[];
  peak_day: { date: string; detections: number } | null;
  low_confidence_excluded: { excluded: number; of: number };
  links: { firms_map: string; worldview: string };
};
export type Reports = {
  window: string[]; places: string[]; languages: string[];
  sources: { name: string; coverage: string; searched: boolean; count: number; error: string | null; query: string | null }[];
  items: { source: string; title: string; date: string; url: string; lang: string; outlet: string }[];
  assessment: { label: string; tone: string; rank: Num; of_years: Num; percentile: Num; reports_found: number; caveat: string; sources_failed: string[] };
};
export type ArticleFire = { period: string; value: Num; pct: Num; wpct: Num; unusual: boolean; too_few?: boolean };
export type RangeReports = Omit<Reports, "assessment" | "items"> & {
  items: (Reports["items"][number] & { relevant?: boolean; fire?: ArticleFire | null })[];
  relevance: { checked: boolean; reason?: string; model?: string; kept?: number; dropped?: number };
  article_check: { articles: number; in_unusual_weeks: number };
  months: { period: string; value: Num; percentile: Num; recent_percentile: Num; ratio: Num; recent_ratio: Num; unusual_vs: string[]; rank: Num; of_years: Num; partial: boolean; reports: number; verdict: string; label: string }[];
  verdict: { label: string; tone: string; unusual_months: number; corroborated: number; reported_typical: number; sources_failed: string[]; count_method: string };
  caveat: string;
};
export type AgentReply = { answer: string; trace: { tool: string; args: Record<string, unknown>; ok: boolean }[]; actions: { name: string; args: Record<string, string> }[]; model: string | null; fallback?: string; charts?: unknown[] };
export type Level = "elevated" | "watch" | "normal" | "quiet" | "insufficient";
export type WarningRow = { region_id: string; name: string; country: string | null; level: Level; headline: string; as_of: string; stale: boolean; percentile: Num; next_4_weeks_median: Num };
export type Warnings = { as_of: string | null; count: number; alerts: WarningRow[]; rule: string; disclaimer: string };
export type Warning = {
  region_id: string; name: string; level: Level; headline: string; as_of: string; stale: boolean; rule: string; caveat: string;
  month: { period: string; days: number; value: number; ci95: [number, number]; median_same_days: number; percentile: Num; rank: number; of_years: number } | null;
  latest_complete_week_percentile: Num;
  recent_weeks: { period: string; value: Num; percentile: Num; median: Num; partial: boolean }[];
  refreshing?: boolean;
  next_4_weeks: { weeks: string[]; years_used: number; p10: Num; median: Num; p90: Num; usual_share_of_year_pct: Num };
  year_to_date: { value: number; weeks: number; rank: number; n: number; median: number } | null;
};
export type Trigger = "anomaly" | "outlook" | "events";
export type AlertSub = {
  token: string; region_id: string; bbox: number[]; name: string | null; ratio: number; min_hotspots: number; created: string; last_notified: string | null;
  triggers?: Trigger[]; email?: string | null; confirmed?: boolean; email_status?: string | null;
};
export type AlertState = {
  token: string; region_id: string; name: string | null; ratio: number; min_hotspots: number; triggered: boolean; status: string;
  progress?: { done?: number; total?: number; stage?: string }; error?: string | null; already_notified?: boolean; level?: Level;
  as_of?: string; stale?: boolean; refreshing?: boolean; month?: Warning["month"]; rule?: string; message?: string;
  triggers?: Trigger[]; email?: string | null; confirmed?: boolean; sent?: { at: string; subject: string }[];
  outlook?: { as_of: string; next_30_days: [string, string]; counts: Record<OutlookClass, number>; rising: number } | null;
  events_in_box?: WildEvent[] | null; outlook_triggered?: boolean;
};
export type NewsItem = { source: string; title: string; date: string; url: string; lang: string; outlet: string; lat?: number; lon?: number; severity?: string; alert?: string; country?: string };
export type LatestNews = { window: [string, string]; sources: { name: string; count: number; error: string | null }[]; items: NewsItem[]; note: string };
export type PlaceNews = Omit<Reports, "assessment" | "items"> & { place: { name: string; country: string | null; lat: number; lon: number; bbox: number[] }; items: NewsItem[]; caveat: string };
export type Persona = { id: string; name: string; role: string; for: string; tagline: string; style: string; workflow: string; starters: string[]; system_prompt: string };
export type WildEvent = { title: string; date: string; lat: number; lon: number; url: string | null; region_id: string | null };
export type Events = { source: string; count: number; events: WildEvent[]; note: string };
export type OutlookClass = "watch" | "above" | "season";
/** [lat, lon, class, usual next 30 d, p90 next 30 d, last 30 d, percentile of last 30 d, rising 0/1, usual last 30 d] */
export type OutlookCell = [number, number, OutlookClass, number, number, number, Num, number, number];
export type OutlookRegion = { name: string; country: string | null; lat: number; lon: number; cells: number; watch_cells: number; last_30: number; usual_last_30: number; usual_next_30: number; bbox: number[] };
export type Outlook = {
  as_of: string; deg: number; sensor: string; next_30_days: [string, string]; last_30_days: [string, string]; baseline_years: [number, number];
  counts: Record<OutlookClass | "rising", number>; cells: OutlookCell[]; regions: OutlookRegion[]; rule: string; caveat: string;
};
export const LEVEL_LABEL: Record<Level, string> = { elevated: "Elevated", watch: "Watch", normal: "Normal", quiet: "Quiet", insufficient: "Not scored" };
export type Health = { ok: boolean; agent: boolean; email?: boolean; model: string | null; regions: number; data_through: string | null };
type Job = { id: string; status: string; done?: number; total?: number; stage?: string; error?: string };

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(API + url, init);
  if (!r.ok) {
    let msg = `${r.status} ${r.statusText}`;
    try { msg = (await r.json()).detail ?? msg; } catch { /* not JSON */ }
    throw new Error(msg);
  }
  if (!(r.headers.get("content-type") ?? "").includes("json")) {
    throw new Error("The API answered with a web page, not data. It is probably an older Kiln Watch server: restart it (uvicorn kw.api:app --port 8000, in server/).");
  }
  return r.json();
}

const post = (body: unknown): RequestInit => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export const api = {
  health: () => json<Health>("/api/health"),
  regions: () => json<{ regions: RegionItem[] }>("/data/regions/index.json").then((r) => r.regions),
  meta: (id: string) => json<Meta>(`/data/regions/${id}/meta.json`),
  monthly: (id: string) => json<Block>(`/data/regions/${id}/monthly.json`),
  region: async (id: string): Promise<Region> => {
    const f = (n: string) => json<any>(`/data/regions/${id}/${n}.json`);
    const [meta, monthly, weekly, grid, statics] = await Promise.all(["meta", "monthly", "weekly", "grid", "static"].map(f));
    return { meta, monthly, weekly, grid, statics };
  },
  warnings: () => json<Warnings>("/api/warnings"),
  warning: (id: string) => json<Warning>(`/api/regions/${id}/warning`),
  events: () => json<Events>("/api/events"),
  outlook: () => json<Outlook>("/api/outlook"),
  createAlert: (body: { region_id?: string; bbox?: number[]; name?: string; ratio: number; email?: string; triggers?: Trigger[] }) => json<AlertSub>("/api/alerts", post(body)),
  sendTest: (token: string) => json<{ sent: boolean; reason?: string; subject?: string }>(`/api/alerts/${token}/send-test`, { method: "POST" }),
  latestNews: (days: number) => json<LatestNews>(`/api/news/latest?days=${days}`),
  placeNews: (place: string, start: string, end: string) => json<PlaceNews>(`/api/news/search?place=${encodeURIComponent(place)}&start=${start}&end=${end}`),
  personas: () => json<{ personas: Persona[] }>("/api/personas").then((r) => r.personas),
  personaUrl: (id: string) => `${API}/api/personas/${id}.md`,
  alert: (token: string) => json<AlertState>(`/api/alerts/${token}`),
  deleteAlert: (token: string) => json<{ deleted: boolean }>(`/api/alerts/${token}`, { method: "DELETE" }),
  workflowUrl: (token: string) => `${API}/api/alerts/${token}/n8n.json`,
  evidence: (id: string, p: string) => json<Evidence>(`/api/regions/${id}/evidence?period=${p}`),
  reports: (id: string, p: string) => json<Reports>(`/api/regions/${id}/reports?period=${p}`),
  rangeReports: (id: string, start: string, end: string) => json<RangeReports>(`/api/regions/${id}/timeline-reports?start=${start}&end=${end}`),
  startAoi: (bbox: number[], name?: string) => json<Job>("/api/aoi", post({ bbox, name })),
  aoi: (id: string) => json<Job>(`/api/aoi/${id}`),
  ask: (message: string, history: { role: string; text: string }[], context: unknown) => json<AgentReply>("/api/agent", post({ message, history, context })),
  csvUrl: (id: string, g: string) => `${API}/api/regions/${id}/export.csv?granularity=${g}`,
  hotspotsUrl: (id: string, start: string, end: string) => `${API}/api/regions/${id}/hotspots.csv?start=${start}&end=${end}`,
  ratioTableUrl: () => `${API}/data/regions/calibration_table.csv`,
};

// ---------- shared helpers ----------

export const SENSORS = ["MODIS", "VIIRS_SNPP", "VIIRS_NOAA20", "VIIRS_NOAA21"] as const;
export const OBSERVERS = ["MODIS_A", "MODIS_T", "VIIRS_SNPP", "VIIRS_NOAA20", "VIIRS_NOAA21"] as const;
export const SENSOR_LABEL: Record<string, string> = {
  MODIS: "MODIS Terra+Aqua", MODIS_A: "Aqua MODIS", MODIS_T: "Terra MODIS",
  VIIRS_SNPP: "Suomi-NPP VIIRS", VIIRS_NOAA20: "NOAA-20 VIIRS", VIIRS_NOAA21: "NOAA-21 VIIRS",
};
export const SHORT: Record<string, string> = { MODIS_A: "Aqua", MODIS_T: "Terra", VIIRS_SNPP: "Suomi-NPP", VIIRS_NOAA20: "NOAA-20", VIIRS_NOAA21: "NOAA-21", MODIS: "MODIS" };
// Okabe–Ito colour-blind-safe set
export const SENSOR_COLOR: Record<string, string> = {
  MODIS: "#E69F00", MODIS_A: "#E69F00", MODIS_T: "#CC79A7", VIIRS_SNPP: "#56B4E9", VIIRS_NOAA20: "#009E73", VIIRS_NOAA21: "#F0E442",
};

export type Scale = "hotspots" | "viirs" | "celldays" | "raw";
export type Cls = "veg" | "static";
export const SCALE_LABEL: Record<Scale, string> = { hotspots: "Hotspots, Aqua scale", viirs: "Hotspots, VIIRS scale", celldays: "Fire cell-days", raw: "Raw detections" };
export const SCALE_UNIT: Record<Scale, string> = {
  hotspots: "hotspots, Aqua MODIS scale", viirs: "hotspots, Suomi-NPP VIIRS scale", celldays: "fire cell-days, Aqua scale", raw: "raw detections, all satellites",
};

export function pick(b: Block, scale: Scale, cls: Cls): Band & { modelled?: boolean[]; sensors?: string[][] } {
  const c = b.classes[cls];
  if (scale === "hotspots") return c.hotspots;
  if (scale === "viirs") return c.viirs_scale;
  if (scale === "celldays") return c.celldays;
  const v = cls === "veg" ? b.raw.all_det : b.periods.map((_, i) => SENSORS.reduce((a, s) => a + (b.raw[s]?.static_det[i] ?? 0), 0));
  return { v, lo: v.map(() => null), hi: v.map(() => null) };
}

export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const MONTH_SHORT = MONTHS.map((m) => m.slice(0, 3));

export function periodLabel(p: string) {
  if (p.includes("-W")) return `Week ${+p.slice(6)}, ${p.slice(0, 4)}`;
  return `${MONTHS[+p.slice(5, 7) - 1]} ${p.slice(0, 4)}`;
}

export function fmt(v: Num | undefined, digits = 0) {
  if (v === null || v === undefined || Number.isNaN(v)) return "–";
  if (Math.abs(v) >= 10000) return Math.round(v).toLocaleString("en-US");
  return v.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}
export function compact(v: Num) {
  if (v === null) return "";
  if (v >= 9950) return `${Math.round(v / 1000)}k`;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return v >= 10 ? String(Math.round(v)) : v > 0 ? v.toFixed(1).replace(/\.0$/, "") : "0";
}
export function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/** Inferno: perceptually uniform, colour-blind-safe sequential ramp (same family as viridis/cividis). */
const INFERNO = ["#000004", "#1B0C41", "#4A0C6B", "#781C6D", "#A52C60", "#CF4446", "#ED6925", "#FB9B06", "#F7D13D", "#FCFFA4"];
export function heat(t: number) {
  const x = Math.max(0, Math.min(1, t)) * (INFERNO.length - 1);
  const i = Math.min(INFERNO.length - 2, Math.floor(x));
  return mix(INFERNO[i], INFERNO[i + 1], x - i);
}
/** Colour-blind-safe diverging ramp (blue ↔ orange) for the ratio to the median, log2 scale clipped to ×¼…×4. */
export function diverging(ratio: number) {
  const t = Math.max(-1, Math.min(1, Math.log2(Math.max(ratio, 1e-6)) / 2));
  return t < 0 ? mix("#3A4A63", "#3D7DD8", -t) : mix("#3A4A63", "#F08A24", t);
}
export const textOn = (t: number) => (t > 0.62 ? "#120A1E" : "#F3EEF8");
function mix(a: string, b: string, t: number) {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(",")})`;
}

/** Download an on-screen SVG chart as a file. */
export function downloadSvg(svg: SVGSVGElement | null, name: string) {
  if (!svg) return;
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
  style.textContent = "text{font-family:Archivo,sans-serif;fill:#93A4BD;font-size:9px}.gridline{stroke:#2A3D5A}";
  clone.prepend(style);
  const url = URL.createObjectURL(new Blob([clone.outerHTML], { type: "image/svg+xml" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: `${name}.svg` });
  a.click();
  URL.revokeObjectURL(url);
}
