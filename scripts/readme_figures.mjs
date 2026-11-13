// Draws every README figure from the built pipeline files in data/regions (no typed-in numbers).
// Run from the repo root:  node scripts/readme_figures.mjs   -> docs/readme/*.svg + docs/readme/numbers.json
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";

const REG = "data/regions", OUT = "docs/readme";
const PRESETS = ["dhaka-kilns", "punjab", "la-rioja", "rondonia", "alberta", "se-australia", "n-california", "parana-delta", "niger-delta"];
const read = (id, f) => JSON.parse(readFileSync(`${REG}/${id}/${f}.json`, "utf8"));
const metas = Object.fromEntries(PRESETS.filter((id) => existsSync(`${REG}/${id}/meta.json`)).map((id) => [id, read(id, "meta")]));

// ---------- look ----------
const C = { bg: "#0B1220", edge: "#1C2940", grid: "#1E2B42", text: "#E8EEF9", mute: "#8FA0BC", raw: "#58A6FF", harm: "#FF9A3C", red: "#FF6B5E", ok: "#3DDC97", zero: "#111A2B" };
const FONT = "ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const INFERNO = ["#1b0c41", "#4a0c6b", "#781c6d", "#a52c60", "#cf4446", "#ed6925", "#fb9b06", "#f7d13d", "#fcffa4"];
const SAT = { MODIS_T: ["Terra MODIS", "#E879A6"], MODIS_A: ["Aqua MODIS", "#F5B041"], VIIRS_SNPP: ["Suomi-NPP VIIRS", "#58A6FF"], VIIRS_NOAA20: ["NOAA-20 VIIRS", "#3DDC97"], VIIRS_NOAA21: ["NOAA-21 VIIRS", "#F4E04D"] };
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const n1 = (v) => (Math.round(v * 10) / 10).toString();
const big = (v) => (v >= 1e6 ? n1(v / 1e6) + " M" : v >= 1e4 ? Math.round(v / 1e3) + "k" : v >= 1e3 ? n1(v / 1e3) + "k" : String(Math.round(v)));
const T = (x, y, s, o = {}) =>
  `<text x="${x}" y="${y}" fill="${o.fill ?? C.text}" font-size="${o.size ?? 15}" font-weight="${o.w ?? 400}" text-anchor="${o.a ?? "start"}"${o.ls ? ` letter-spacing="${o.ls}"` : ""}${o.op ? ` opacity="${o.op}"` : ""}>${esc(s)}</text>`;
const svg = (w, h, body, defs = "") =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="${FONT}" role="img">` +
  `<defs><pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="${C.zero}"/><line x1="0" y1="0" x2="0" y2="6" stroke="#33415C" stroke-width="2"/></pattern>${defs}</defs>` +
  `<rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="14" fill="${C.bg}" stroke="${C.edge}"/>${body}</svg>`;
const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
function ramp(t) { // 0..1 -> inferno colour
  const p = Math.min(0.9999, Math.max(0, t)) * (INFERNO.length - 1), i = Math.floor(p), f = p - i;
  const a = hex(INFERNO[i]), b = hex(INFERNO[i + 1]);
  return "#" + a.map((v, k) => Math.round(v + (b[k] - v) * f).toString(16).padStart(2, "0")).join("");
}
const heat = (v, max) => (v == null ? "url(#hatch)" : v < 0.5 ? C.zero : ramp(Math.log(v + 1) / Math.log(max + 1)));
const path = (pts) => pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join("");
const save = (name, s) => { writeFileSync(`${OUT}/${name}.svg`, s); console.log("wrote", name, (s.length / 1024).toFixed(0) + " kB"); };
mkdirSync(OUT, { recursive: true });
const numbers = {};

// ---------- 1. hero: raw vs harmonized, one area ----------
function hero(id) {
  const m = metas[id], b = read(id, "monthly"), veg = b.classes.veg;
  const years = {};
  b.periods.forEach((p, i) => {
    const y = +p.slice(0, 4), o = (years[y] ??= { n: 0, raw: 0, harm: 0, aqua: 0, bad: false });
    if (b.partial[i] || veg.hotspots.v[i] == null) o.bad = true;
    o.n++; o.raw += b.raw.all_det[i]; o.harm += veg.hotspots.v[i] ?? 0; o.aqua += veg.aqua_only[i] ?? 0;
  });
  const ys = Object.keys(years).map(Number).filter((y) => years[y].n === 12 && !years[y].bad).sort((a, b) => a - b);
  const W = 1000, H = 500, L = 70, R = 30, Tp = 168, B = 58;
  const X = (y) => L + ((y - ys[0]) / (ys.at(-1) - ys[0])) * (W - L - R);
  const max = Math.max(...ys.map((y) => years[y].raw)) * 1.06;
  const Y = (v) => H - B - (v / max) * (H - B - Tp);
  const st = m.steps.VIIRS_SNPP;
  let g = "";
  for (let k = 0; k <= 4; k++) { const v = (max / 1.06) * k / 4; g += `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="${C.grid}"/>` + T(L - 10, Y(v) + 5, big(v), { a: "end", fill: C.mute, size: 13 }); }
  for (const y of ys.filter((y) => y % 4 === 0)) g += T(X(y), H - B + 22, y, { a: "middle", fill: C.mute, size: 13 });
  const joins = [["VIIRS_SNPP", "+ Suomi-NPP"], ["VIIRS_NOAA20", "+ NOAA-20"], ["VIIRS_NOAA21", "+ NOAA-21"]];
  for (const [s, label] of joins) {
    const y = +m.steps[s].period.slice(0, 4), x = X(y - 0.5);
    g += `<line x1="${x}" x2="${x}" y1="${Tp - 8}" y2="${H - B}" stroke="${SAT[s][1]}" stroke-dasharray="4 5" opacity="0.8"/>` + T(x + 6, Tp + 4, label, { fill: SAT[s][1], size: 13, w: 600 });
  }
  const line = (k) => path(ys.map((y) => [X(y), Y(years[y][k])]));
  g += `<path d="${line("raw")}" fill="none" stroke="${C.raw}" stroke-width="3" stroke-linejoin="round"/>`;
  g += `<path d="${line("aqua")}" fill="none" stroke="${C.text}" stroke-width="1.5" stroke-dasharray="3 5" opacity="0.7"/>`;
  g += `<path d="${line("harm")}" fill="none" stroke="${C.harm}" stroke-width="4" stroke-linejoin="round"/>`;
  g += ys.map((y) => `<circle cx="${X(y)}" cy="${Y(years[y].harm)}" r="3" fill="${C.harm}"/>`).join("");
  const last = ys.at(-1);
  const peak = ys.reduce((a, y) => (years[y].raw > years[a].raw ? y : a), ys[0]);
  g += T(X(2014.5), Y(years[peak].raw * 0.72), "Raw counts, all satellites", { a: "middle", fill: C.raw, size: 15, w: 700 });
  g += T(X(ys[4]), Y(years[ys[4]].harm) - 34, "Kiln Watch harmonized", { fill: C.harm, size: 15, w: 700 });
  g += T(X(ys[4]), Y(years[ys[4]].harm) - 16, "dashed: Aqua MODIS alone", { fill: C.mute, size: 12 });
  // header
  g += `<path d="M46 36c3 8 11 11 11 21a11 11 0 0 1-22 0c0-5 3-8 5-11 1 5 3 6 6 6-2-6-2-11 0-16z" fill="${C.harm}"/>`;
  g += T(68, 60, "KILN WATCH", { size: 15, w: 700, ls: 3, fill: C.mute });
  g += T(40, 104, "26 years of fire. Five satellites. One scale.", { size: 34, w: 700 });
  g += T(40, 134, `${m.name}: raw hotspot counts jump ${n1(st.raw_all_sensors_excess)}× when a sharper satellite arrives. The harmonized record moves ${st.harmonized_excess.toFixed(2)}×.`, { size: 15, fill: C.mute });
  g += T(40, H - 10, `Hotspots per year · built from NASA FIRMS data through ${m.data_through}`, { size: 11, fill: C.mute });
  numbers.hero = { area: m.name, raw_step: st.raw_all_sensors_excess, harmonized_step: st.harmonized_excess, years: [ys[0], last] };
  save("hero", svg(W, H, g));
}

// ---------- 2. stat tiles ----------
function stats() {
  const all = Object.values(metas), W = 1000, H = 132;
  const raw = all.map((m) => m.steps.VIIRS_SNPP.raw_all_sensors_excess), hm = all.map((m) => m.steps.VIIRS_SNPP.harmonized_excess);
  const cov = all.map((m) => m.denial.modis_ends_2016.ours_seasonal_eb.interval_coverage * 100);
  const det = all.reduce((a, m) => a + m.totals.detections, 0);
  const first = all.map((m) => m.sensors.MODIS.first).sort()[0], lastD = all.map((m) => m.data_through).sort().at(-1);
  const span = Math.round((Date.parse(lastD) - Date.parse(first)) / (365.25 * 864e5));
  const tiles = [
    [`${span} years`, `${first.slice(0, 7)} to ${lastD.slice(0, 7)}, one record`],
    [`${Math.min(...raw).toFixed(1)}–${Math.max(...raw).toFixed(1)}×`, "raw jump when Suomi-NPP arrives"],
    [`${Math.min(...hm).toFixed(2)}–${Math.max(...hm).toFixed(2)}×`, "the same step after harmonization"],
    [`${big(det)}`, `detections processed, ${all.length} test regions`],
  ];
  const w = (W - 5 * 16) / 4;
  const g = tiles.map(([a, b], i) => {
    const x = 16 + i * (w + 16);
    return `<rect x="${x}" y="16" width="${w}" height="${H - 32}" rx="10" fill="#0F1A2E" stroke="${C.edge}"/>` +
      T(x + 18, 66, a, { size: 32, w: 700, fill: i === 1 ? C.raw : i === 2 ? C.harm : C.text }) + T(x + 18, 94, b, { size: 13, fill: C.mute });
  }).join("");
  numbers.stats = { span_years: span, first, last: lastD, raw_step: [Math.min(...raw), Math.max(...raw)], harmonized_step: [Math.min(...hm), Math.max(...hm)], coverage_pct: [Math.min(...cov), Math.max(...cov)], detections: det, regions: all.length };
  save("stats", svg(W, H, g));
}

// ---------- 3. calendars: raw vs harmonized on one colour scale ----------
function grid(x0, y0, cw, ch, years, cell, max, markYear) {
  let g = "";
  years.forEach((y, c) => {
    for (let mo = 0; mo < 12; mo++) {
      const v = cell(y, mo);
      if (v === undefined) continue;
      g += `<rect x="${x0 + c * cw}" y="${y0 + mo * ch}" width="${cw - 1.5}" height="${ch - 1.5}" rx="2" fill="${heat(v, max)}"/>`;
    }
    if (y % 2 === 0) g += T(x0 + c * cw + cw / 2, y0 - 8, y, { a: "middle", size: 11, fill: C.mute });
  });
  MON.forEach((mn, i) => { g += T(x0 - 10, y0 + i * ch + ch - 4, mn, { a: "end", size: 11, fill: C.mute }); });
  if (markYear) { const x = x0 + years.indexOf(markYear) * cw - 1; g += `<line x1="${x}" x2="${x}" y1="${y0 - 4}" y2="${y0 + 12 * ch}" stroke="${C.text}" stroke-width="1.5" stroke-dasharray="3 3"/>`; }
  return g;
}
function legend(x, y, w, max, label) {
  let g = "";
  for (let i = 0; i < 60; i++) g += `<rect x="${x + (i * w) / 60}" y="${y}" width="${w / 60 + 0.6}" height="10" fill="${ramp(i / 59)}"/>`;
  const ticks = [1, 10, 100, 1000, 10000, 100000].filter((t) => t <= max);
  for (const t of ticks) { const tx = x + (Math.log(t + 1) / Math.log(max + 1)) * w; g += T(tx, y + 25, big(t), { a: "middle", size: 11, fill: C.mute }); }
  g += T(x - 10, y + 10, label, { a: "end", size: 12, fill: C.mute });
  g += `<rect x="${x + w + 28}" y="${y}" width="14" height="10" fill="url(#hatch)"/>` + T(x + w + 48, y + 10, "not observed", { size: 12, fill: C.mute });
  return g;
}
function calendars(id) {
  const m = metas[id], b = read(id, "monthly"), veg = b.classes.veg;
  const at = Object.fromEntries(b.periods.map((p, i) => [p, i]));
  const years = [...new Set(b.periods.map((p) => +p.slice(0, 4)))];
  const key = (y, mo) => `${y}-${String(mo + 1).padStart(2, "0")}`;
  const raw = (y, mo) => { const i = at[key(y, mo)]; return i === undefined ? undefined : b.raw.all_det[i]; };
  const hm = (y, mo) => { const i = at[key(y, mo)]; return i === undefined ? undefined : veg.hotspots.v[i]; };
  const max = Math.max(...b.raw.all_det);
  const W = 1000, H = 626, x0 = 78, cw = (W - x0 - 30) / years.length, ch = 15;
  let g = T(40, 44, "The same place, the same years", { size: 24, w: 700 });
  g += T(40, 68, `${m.name}. Top: what the satellites counted. Bottom: what Kiln Watch reports. One colour scale.`, { size: 14, fill: C.mute });
  g += T(x0, 108, "RAW  ·  every satellite's detections added up", { size: 13, w: 700, fill: C.raw, ls: 1 });
  g += grid(x0, 136, cw, ch, years, raw, max, 2012);
  g += T(x0 + years.indexOf(2012) * cw + 6, 108, "Suomi-NPP arrives: the record brightens", { size: 12, fill: C.text });
  g += T(x0, 352, "HARMONIZED  ·  hotspots on the Aqua MODIS scale", { size: 13, w: 700, fill: C.harm, ls: 1 });
  g += grid(x0, 380, cw, ch, years, hm, max, 2012);
  g += legend(x0 + 190, H - 44, 420, max, "hotspots per month (log)");
  save("calendars", svg(W, H, g));
}

// ---------- 4. step test across all areas ----------
function steps() {
  const rows = Object.values(metas).map((m) => ({ name: m.name, raw: m.steps.VIIRS_SNPP.raw_all_sensors_excess, hm: m.steps.VIIRS_SNPP.harmonized_excess, pl: m.placebo }))
    .sort((a, b) => b.raw - a.raw);
  const W = 1000, rh = 34, top = 132, H = top + rows.length * rh + 50, L = 380, R = 70;
  const X = (v) => L + ((Math.log(v) - Math.log(0.7)) / (Math.log(12) - Math.log(0.7))) * (W - L - R);
  let g = T(40, 44, "Does the record jump when a new satellite arrives?", { size: 24, w: 700 });
  g += T(40, 68, "Level change across January 2012 (Suomi-NPP joins), relative to Aqua MODIS alone. 1.0 = no artificial step.", { size: 14, fill: C.mute });
  g += `<circle cx="46" cy="96" r="6" fill="${C.raw}"/>` + T(60, 101, "raw counts", { size: 13, fill: C.mute });
  g += `<circle cx="166" cy="96" r="6" fill="${C.harm}"/>` + T(180, 101, "harmonized", { size: 13, fill: C.mute });
  g += `<rect x="290" y="90" width="26" height="12" rx="3" fill="${C.ok}" opacity="0.28"/>` + T(324, 101, "normal range at dates with no satellite change (placebo)", { size: 13, fill: C.mute });
  for (const t of [1, 2, 5, 10]) g += `<line x1="${X(t)}" x2="${X(t)}" y1="${top - 6}" y2="${H - 44}" stroke="${t === 1 ? C.text : C.grid}" stroke-width="${t === 1 ? 1.5 : 1}" ${t === 1 ? 'stroke-dasharray="4 4"' : ""}/>` + T(X(t), H - 22, t + "×", { a: "middle", size: 13, fill: C.mute });
  rows.forEach((r, i) => {
    const y = top + i * rh + rh / 2;
    g += T(L - 78, y + 5, r.name, { a: "end", size: 14 }) + T(L - 22, y + 5, r.hm.toFixed(2) + "×", { a: "end", size: 14, fill: C.harm, w: 700 });
    if (r.pl) g += `<rect x="${X(r.pl.excess_p05)}" y="${y - 10}" width="${Math.max(3, X(r.pl.excess_p95) - X(r.pl.excess_p05))}" height="20" rx="4" fill="${C.ok}" opacity="0.28"/>`;
    g += `<line x1="${X(r.hm)}" x2="${X(r.raw)}" y1="${y}" y2="${y}" stroke="${C.raw}" stroke-width="2" opacity="0.35"/>`;
    g += `<circle cx="${X(r.raw)}" cy="${y}" r="7" fill="${C.raw}"/>` + T(X(r.raw) + 13, y + 5, r.raw.toFixed(1) + "×", { size: 13, fill: C.raw, w: 600 });
    g += `<circle cx="${X(r.hm)}" cy="${y}" r="7" fill="${C.harm}" stroke="${C.bg}" stroke-width="1.5"/>`;
  });
  numbers.steps = rows.map((r) => ({ area: r.name, raw: r.raw, harmonized: r.hm, placebo: r.pl && [r.pl.excess_p05, r.pl.excess_p95], inside: r.pl ? r.hm >= r.pl.excess_p05 && r.hm <= r.pl.excess_p95 : null }));
  save("steps", svg(W, H, g));
}

// ---------- 5. MODIS-denial rehearsal ----------
function denial(id) {
  const m = metas[id], b = read(id, "monthly"), d = m.denial.modis_ends_2016, s = d.series;
  const at = Object.fromEntries(b.periods.map((p, i) => [p, i]));
  const viirs = s.periods.map((p) => b.raw.VIIRS_SNPP.det[at[p]]);
  const W = 1000, H = 470, L = 70, R = 30, Tp = 128, B = 52, n = s.periods.length;
  const X = (i) => L + (i / (n - 1)) * (W - L - R);
  const lo = 1, hi = Math.max(...viirs, ...s.hi) * 1.3;
  const Y = (v) => H - B - ((Math.log(Math.max(v, lo)) - Math.log(lo)) / (Math.log(hi) - Math.log(lo))) * (H - B - Tp);
  let g = T(40, 44, "We switched MODIS off for four years. VIIRS rebuilt it.", { size: 24, w: 700 });
  g += T(40, 68, `${m.name}. Calibrated on ${d.train[0].slice(0, 4)}–${d.train[1].slice(0, 4)} only; ${d.test[0].slice(0, 4)}–${d.test[1].slice(0, 4)} rebuilt from VIIRS alone, never shown to the calibration.`, { size: 14, fill: C.mute });
  const leg = [[C.raw, "raw VIIRS detections"], [C.harm, "rebuilt from VIIRS, with 95% interval"], [C.text, "what Aqua MODIS actually saw"]];
  let lx = 40; for (const [c, t] of leg) { g += `<line x1="${lx}" x2="${lx + 22}" y1="96" y2="96" stroke="${c}" stroke-width="3"/>` + T(lx + 30, 101, t, { size: 13, fill: C.mute }); lx += 60 + t.length * 7.2; }
  for (const t of [1, 10, 100, 1000, 10000, 100000].filter((t) => t <= hi)) g += `<line x1="${L}" x2="${W - R}" y1="${Y(t)}" y2="${Y(t)}" stroke="${C.grid}"/>` + T(L - 10, Y(t) + 5, big(t), { a: "end", size: 13, fill: C.mute });
  s.periods.forEach((p, i) => { if (p.endsWith("-01")) g += `<line x1="${X(i)}" x2="${X(i)}" y1="${Tp}" y2="${H - B}" stroke="${C.grid}"/>` + T(X(i) + 6, H - B + 22, p.slice(0, 4), { size: 13, fill: C.mute }); });
  const band = path(s.hi.map((v, i) => [X(i), Y(v)])) + path(s.lo.map((v, i) => [X(i), Y(v)]).reverse()).replace("M", "L") + "Z";
  g += `<path d="${band}" fill="${C.harm}" opacity="0.16"/>`;
  g += `<path d="${path(viirs.map((v, i) => [X(i), Y(v)]))}" fill="none" stroke="${C.raw}" stroke-width="2" opacity="0.9"/>`;
  g += `<path d="${path(s.predicted.map((v, i) => [X(i), Y(v)]))}" fill="none" stroke="${C.harm}" stroke-width="3.5"/>`;
  g += `<path d="${path(s.aqua.map((v, i) => [X(i), Y(v)]))}" fill="none" stroke="${C.text}" stroke-width="1.8" stroke-dasharray="1 5" stroke-linecap="round"/>`;
  const sign = (v) => (v > 0 ? "+" : "") + v.toFixed(1) + "%";
  g += T(W - R, H - 12, `Total error: uncalibrated ${sign(d.uncalibrated.bias_pct)}  ·  Kiln Watch ${sign(d.ours_seasonal_eb.bias_pct)}  ·  rank correlation ${d.ours_seasonal_eb.spearman.toFixed(2)}  ·  hotspots per month, log scale`, { a: "end", size: 12, fill: C.mute });
  numbers.denial = { area: m.name, train: d.train, test: d.test, uncalibrated_bias_pct: d.uncalibrated.bias_pct, ours_bias_pct: d.ours_seasonal_eb.bias_pct, spearman: d.ours_seasonal_eb.spearman, coverage: d.ours_seasonal_eb.interval_coverage };
  save("denial", svg(W, H, g));
}

// ---------- 6. satellites, measured from the data ----------
function sensors() {
  const all = Object.values(metas), W = 1000, rh = 34, top = 96, keys = Object.keys(SAT), H = top + keys.length * rh + 44, L = 190, R = 40;
  const span = (k) => [all.map((m) => m.sensors[k]?.first).filter(Boolean).sort()[0], all.map((m) => m.sensors[k]?.last).filter(Boolean).sort().at(-1)];
  const t0 = Date.UTC(2000, 0, 1), t1 = Date.UTC(2027, 6, 1), X = (d) => L + ((Date.parse(d) - t0) / (t1 - t0)) * (W - L - R);
  const end = all.map((m) => m.data_through).sort().at(-1);
  let g = T(40, 44, "Five satellites, read from the data", { size: 24, w: 700 });
  g += T(40, 68, "First and last detection of each satellite, measured from the data. No launch or end date is typed in.", { size: 14, fill: C.mute });
  for (let y = 2000; y <= 2026; y += 2) g += `<line x1="${X(y + "-01-01")}" x2="${X(y + "-01-01")}" y1="${top - 8}" y2="${H - 40}" stroke="${C.grid}"/>` + T(X(y + "-01-01"), H - 20, y, { a: "middle", size: 12, fill: C.mute });
  numbers.sensors = {};
  keys.forEach((k, i) => {
    const [a, b] = span(k), y = top + i * rh, ended = Date.parse(end) - Date.parse(b) > 3 * 864e5;
    numbers.sensors[k] = { first: a, last: b, ended };
    g += T(L - 16, y + 19, SAT[k][0], { a: "end", size: 14 });
    g += `<rect x="${X(a)}" y="${y + 6}" width="${X(b) - X(a)}" height="18" rx="5" fill="${SAT[k][1]}"/>`;
    g += T(X(a) - 6, y + 19, a.slice(0, 4), { a: "end", size: 11, fill: C.mute });
    if (ended) g += `<circle cx="${X(b)}" cy="${y + 15}" r="7" fill="${C.bg}" stroke="${C.red}" stroke-width="2.5"/>` + T(X(b) - 14, y + 2, `ended ${b}`, { a: "end", size: 12, fill: C.red, w: 700 });
  });
  save("sensors", svg(W, H, g));
}

// ---------- 7. local: the kiln season ----------
function kilns(id) {
  const m = metas[id], b = read(id, "monthly"), st = b.classes.static.viirs_scale, pts = read(id, "static");
  const idx = b.periods.map((p, i) => i).filter((i) => !st.modelled[i]);
  const at = Object.fromEntries(idx.map((i) => [b.periods[i], i]));
  const years = [...new Set(idx.map((i) => +b.periods[i].slice(0, 4)))];
  const cell = (y, mo) => { const i = at[`${y}-${String(mo + 1).padStart(2, "0")}`]; return i === undefined ? undefined : st.v[i]; };
  const max = Math.max(...idx.map((i) => st.v[i] ?? 0));
  const med = MON.map((_, mo) => { // complete months only
    const xs = years.map((y) => at[`${y}-${String(mo + 1).padStart(2, "0")}`]).filter((i) => i !== undefined && !b.partial[i] && st.v[i] != null).map((i) => st.v[i]).sort((p, q) => p - q);
    return xs.length ? xs[Math.floor(xs.length / 2)] : 0;
  });
  const W = 1000, H = 436, x0 = 78, gw = 560, cw = gw / years.length, ch = 18, top = 124;
  const c = pts.columns, col = (n) => c.indexOf(n);
  const viirsDet = pts.points.reduce((a, p) => a + p[col("detections")], 0), modisDet = pts.points.reduce((a, p) => a + p[col("modis_detections")], 0);
  let g = T(40, 44, "Home ground: the Dhaka brick-kiln belt", { size: 24, w: 700 });
  g += T(40, 68, "Persistent heat sources (likely kilns) per month on the VIIRS scale. The firing season runs through the dry months.", { size: 14, fill: C.mute });
  g += grid(x0, top, cw, ch, years, cell, max);
  // median per calendar month, drawn as bars beside the grid
  const bx = x0 + gw + 40, bw = W - bx - 110, mmax = Math.max(...med, 1);
  g += T(bx, top - 8, "typical month (median)", { size: 11, fill: C.mute });
  med.forEach((v, i) => { g += `<rect x="${bx}" y="${top + i * ch}" width="${Math.max(1, (v / mmax) * bw)}" height="${ch - 3}" rx="2" fill="${C.harm}"/>` + T(bx + (v / mmax) * bw + 8, top + i * ch + ch - 5, Math.round(v), { size: 11, fill: C.mute }); });
  g += T(40, H - 46, `${pts.points.length} persistent heat-source cells`, { size: 18, w: 700, fill: C.harm });
  g += T(40, H - 22, `Their detections: ${viirsDet.toLocaleString("en")} in total, only ${modisDet.toLocaleString("en")} of them by MODIS. Small, hot and steady: VIIRS sees kilns, MODIS mostly cannot.`, { size: 13, fill: C.mute });
  numbers.kilns = { area: m.name, cells: pts.points.length, detections: viirsDet, modis_detections: modisDet, median_by_month: med.map((v) => Math.round(v)), years: [years[0], years.at(-1)], note: pts.note };
  save("kilns", svg(W, H, g));
}

hero("punjab");
stats();
calendars("punjab");
steps();
denial("punjab");
sensors();
kilns("dhaka-kilns");

// results table for the README (same fields as `python -m kw.report`)
const pct = (v) => (v > 0 ? "+" : "") + v.toFixed(1) + "%";
numbers.table = Object.values(metas).map((m) => {
  const st = m.steps.VIIRS_SNPP, d = m.denial.modis_ends_2016, t = m.trend["2003-2020"];
  return `| ${m.name} | ${st.raw_all_sensors_excess.toFixed(2)} | ${st.harmonized_excess.toFixed(2)} | ${pct(d.uncalibrated.bias_pct)} | ${pct(d.ours_seasonal_eb.bias_pct)} | ${d.ours_seasonal_eb.spearman.toFixed(2)} | ${Math.round(d.ours_seasonal_eb.interval_coverage * 100)}% | ${t.raw_all_sensors.sen_per_year.toFixed(1)} | ${t.harmonized.sen_per_year.toFixed(1)} | ${t.aqua_only.sen_per_year.toFixed(1)} |`;
});
writeFileSync(`${OUT}/numbers.json`, JSON.stringify(numbers, null, 1));
console.log(JSON.stringify(numbers, null, 1));
