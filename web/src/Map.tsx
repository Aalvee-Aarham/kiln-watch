import maplibregl, { GeoJSONSource, RasterTileSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FeatureCollection } from "geojson";
import { Outlook, Region, RegionItem, fmt, heat, ordinal } from "./api";

export const FIRE_LAYERS = [
  { id: "VIIRS_NOAA20_Thermal_Anomalies_375m_All", label: "VIIRS NOAA-20", color: "#8BD17C", from: "2020-01-01" },
  { id: "VIIRS_NOAA21_Thermal_Anomalies_375m_All", label: "VIIRS NOAA-21", color: "#D98BE8", from: "2024-01-17" },
  { id: "VIIRS_SNPP_Thermal_Anomalies_375m_All", label: "VIIRS Suomi-NPP", color: "#5CC8E6", from: "2012-01-20" },
  { id: "MODIS_Combined_Thermal_Anomalies_All", label: "MODIS Terra+Aqua", color: "#F2A541", from: "2002-07-04" },
] as const;

export type Basemap = "dark" | "night" | "satellite" | "relief";
export type Projection = "globe" | "mercator";
export type Layers = { fires: Record<string, boolean>; grid: boolean; statics: boolean; outlook: boolean };
export type Focus = { bbox?: number[]; center?: [number, number]; zoom?: number; n: number };

const STYLE = "https://tiles.openfreemap.org/styles/dark";
const GIBS = "https://gibs.earthdata.nasa.gov";
const wms = (layer: string, date: string) =>
  `${GIBS}/wms/epsg3857/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=${layer}&STYLES=&FORMAT=image/png&TRANSPARENT=true&CRS=EPSG:3857&WIDTH=256&HEIGHT=256&TIME=${date}&BBOX={bbox-epsg-3857}`;
const trueColor = (date: string) => {
  const layer = date >= "2018-06-01" ? "VIIRS_NOAA20_CorrectedReflectance_TrueColor" : "MODIS_Terra_CorrectedReflectance_TrueColor";
  return `${GIBS}/wmts/epsg3857/best/${layer}/default/${date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`;
};
const RELIEF = `${GIBS}/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg`;
/** NASA Black Marble: VIIRS day/night band night lights, cloud-free composite. */
export const NIGHT = `${GIBS}/wmts/epsg3857/best/VIIRS_Black_Marble/default/2016-01-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png`;

/** Space look for the globe: black sky, thin blue atmosphere that fades out as you zoom in. */
export const SKY = {
  "sky-color": "#02060D", "horizon-color": "#0B2A4A", "fog-color": "#02060D", "sky-horizon-blend": 0.6, "horizon-fog-blend": 0.8,
  "fog-ground-blend": 0.9, "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 1, 4, 0.8, 7, 0] as unknown as number,
};

// ---------- 30-day outlook (shared with the Early warning page) ----------

export const OUTLOOK_COLOR = { watch: "#FF3B2F", above: "#FF9A3C", season: "#F6C64F" } as const;
export const OUTLOOK_LABEL = {
  watch: "Watch: fire season ahead and running above normal",
  above: "Above normal for the time of year",
  season: "Fire season: the next 30 days are usually active",
} as const;
const OUTLOOK_LAYERS = ["outlook-heat", "outlook-pulse", "outlook-pulse2", "outlook-dots"];

export function addOutlookLayers(m: maplibregl.Map, before?: string) {
  m.addSource("outlook", { type: "geojson", data: EMPTY });
  m.addLayer({
    id: "outlook-heat", type: "heatmap", source: "outlook", maxzoom: 9,
    paint: {
      "heatmap-weight": ["min", 1, ["/", ["ln", ["+", 1, ["get", "u"]]], 6]],
      "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 0, 0.5, 6, 1.3],
      "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 0, 5, 3, 14, 7, 34],
      "heatmap-opacity": ["interpolate", ["linear"], ["zoom"], 5, 0.6, 9, 0],
      "heatmap-color": ["interpolate", ["linear"], ["heatmap-density"], 0, "rgba(0,0,0,0)", 0.15, "rgba(120,28,109,0.3)",
        0.4, "rgba(207,68,70,0.55)", 0.7, "rgba(237,105,37,0.78)", 1, "rgba(252,255,164,0.95)"],
    },
  }, before);
  for (const id of ["outlook-pulse", "outlook-pulse2"]) {
    m.addLayer({
      id, type: "circle", source: "outlook", filter: ["==", ["get", "c"], "watch"],
      paint: { "circle-radius": 4, "circle-color": "rgba(0,0,0,0)", "circle-stroke-color": OUTLOOK_COLOR.watch, "circle-stroke-width": 1.4, "circle-stroke-opacity": 0 },
    }, before);
  }
  m.addLayer({
    id: "outlook-dots", type: "circle", source: "outlook",
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, ["match", ["get", "c"], "watch", 2.4, "above", 1.9, 1.1], 6, ["match", ["get", "c"], "watch", 7, "above", 5.5, 3.6]],
      "circle-color": ["match", ["get", "c"], "watch", OUTLOOK_COLOR.watch, "above", OUTLOOK_COLOR.above, OUTLOOK_COLOR.season],
      "circle-opacity": ["match", ["get", "c"], "season", 0.5, 0.95],
      "circle-blur": ["match", ["get", "c"], "season", 0.5, 0.15],
      "circle-stroke-color": "#FFF3E0", "circle-stroke-width": ["match", ["get", "c"], "above", 0.7, 0],
    },
  }, before);
}

export function setOutlook(m: maplibregl.Map, o: Outlook | null, visible: boolean) {
  (m.getSource("outlook") as GeoJSONSource | undefined)?.setData({
    type: "FeatureCollection",
    features: (o?.cells ?? []).map(([lat, lon, c, u, p90, now, pct, rising, ul]) => ({
      type: "Feature", properties: { c, u, p90, now, pct, rising, ul }, geometry: { type: "Point", coordinates: [lon, lat] },
    })),
  });
  for (const id of OUTLOOK_LAYERS) if (m.getLayer(id)) m.setLayoutProperty(id, "visibility", visible && o ? "visible" : "none");
}

/** Slow idle spin of a globe until the first touch; `allowed` can pause it (e.g. while an area is open). */
export function spinGlobe(m: maplibregl.Map, allowed: () => boolean = () => true) {
  let spin = !matchMedia("(prefers-reduced-motion: reduce)").matches;
  const stop = () => { spin = false; };
  for (const ev of ["mousedown", "touchstart", "wheel", "dragstart"] as const) m.on(ev, stop);
  const step = () => {
    if (!spin || !allowed() || m.getZoom() > 3.2 || m.getProjection()?.type !== "globe") return;
    const c = m.getCenter();
    m.easeTo({ center: [c.lng - 3, c.lat], duration: 1000, easing: (n) => n });
  };
  m.on("moveend", step);
  setTimeout(step, 1200);
}

/** Two out-of-phase rings ripple out of every watch cell. Returns a stop function. */
export function pulseOutlook(m: maplibregl.Map) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return () => undefined;
  let raf = 0, last = 0;
  const t0 = performance.now();
  const tick = (now: number) => {
    raf = requestAnimationFrame(tick);
    if (now - last < 40 || !m.getLayer("outlook-pulse") || m.getLayoutProperty("outlook-pulse", "visibility") === "none") return;
    last = now;
    const base = Math.min(8, 2.4 + m.getZoom() * 0.95);
    [["outlook-pulse", 0], ["outlook-pulse2", 0.5]].forEach(([id, off]) => {
      const t = ((now - t0) / 2200 + (off as number)) % 1;
      m.setPaintProperty(id as string, "circle-radius", base * (1 + 2.6 * t));
      m.setPaintProperty(id as string, "circle-stroke-opacity", 0.9 * (1 - t) ** 1.5);
    });
  };
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}

export function outlookPopup(q: Record<string, number | string | boolean | null>, lat: number, lon: number, o: Outlook | null, action?: string) {
  const c = q.c as keyof typeof OUTLOOK_LABEL;
  const yrs = o ? `${o.baseline_years[0]}–${o.baseline_years[1]}` : "earlier years";
  const pct = q.pct === null || q.pct === undefined ? "" : `, <b>${ordinal(Math.round(+q.pct))} percentile</b> of the same days ${yrs}`;
  return `<b style="color:${OUTLOOK_COLOR[c]}">${OUTLOOK_LABEL[c]}</b><br>`
    + `Next 30 days usually: <b>${fmt(+q.u!)}</b> hotspots <span>(1 year in 10 above ${fmt(+q.p90!)})</span><br>`
    + `Last 30 days: <b>${fmt(+q.now!)}</b>${pct} <span>(usual ${fmt(+q.ul!)})</span><br>`
    + (q.rising ? `<i>Season ramping up: the next 30 days usually bring twice the last 30 or more.</i><br>` : "")
    + `<span>0.5° cell at ${lat.toFixed(2)}°, ${lon.toFixed(2)}° · Aqua MODIS · not a forecast</span>`
    + (action ? `<br><button class="pop-btn">${action}</button>` : "");
}

const box = (b: number[]) => {
  const [w, s, e0, n] = b;
  const e = e0 < w ? e0 + 360 : e0; // antimeridian: draw past 180 so the ring stays closed
  return [[[w, s], [e, s], [e, n], [w, n], [w, s]]];
};
const EMPTY = { type: "FeatureCollection", features: [] } as FeatureCollection;

type Props = {
  regions: RegionItem[];
  region: Region | null;
  month: string | null;
  date: string;
  layers: Layers;
  basemap: Basemap;
  projection: Projection;
  outlook: Outlook | null;
  onOutlookPick: (lon: number, lat: number) => void;
  drawing: boolean;
  focus: Focus | null;
  onDrawn: (bbox: number[]) => void;
  onPickRegion: (id: string) => void;
};

export default function MapView(p: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [ready, setReady] = useState(false);
  const pickRef = useRef(p.onPickRegion);
  pickRef.current = p.onPickRegion;
  const outlookPickRef = useRef(p.onOutlookPick);
  outlookPickRef.current = p.onOutlookPick;
  const outlookRef = useRef(p.outlook);
  outlookRef.current = p.outlook;
  const regionRef = useRef(p.region);
  regionRef.current = p.region;

  useEffect(() => {
    const m = new maplibregl.Map({
      container: el.current!, style: STYLE, center: [25, 12], zoom: window.innerWidth > 900 ? 1.9 : 1.2, minZoom: 1, maxZoom: 13,
      attributionControl: { compact: true, customAttribution: "Fire data: NASA FIRMS / GIBS" },
    });
    map.current = m;
    if (import.meta.env.DEV) (window as unknown as { __kwmap: maplibregl.Map }).__kwmap = m; // headless tests
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
    m.addControl(new maplibregl.ScaleControl({ maxWidth: 110 }), "bottom-left");
    let stopPulse = () => undefined as void;
    m.on("load", () => {
      m.setProjection({ type: p.projection });
      m.setSky(SKY);
      const firstSymbol = m.getStyle().layers.find((l) => l.type === "symbol")?.id;
      m.addSource("night", { type: "raster", tiles: [NIGHT], tileSize: 256, maxzoom: 8, attribution: "NASA Black Marble (VIIRS)" });
      m.addLayer({ id: "night", type: "raster", source: "night", layout: { visibility: "none" }, paint: { "raster-saturation": -0.15, "raster-contrast": 0.15 } }, firstSymbol);
      m.addSource("sat", { type: "raster", tiles: [trueColor(p.date)], tileSize: 256, maxzoom: 9, attribution: "NASA GIBS" });
      m.addLayer({ id: "sat", type: "raster", source: "sat", layout: { visibility: "none" } }, firstSymbol);
      m.addSource("relief", { type: "raster", tiles: [RELIEF], tileSize: 256, maxzoom: 8, attribution: "NASA Blue Marble" });
      m.addLayer({ id: "relief", type: "raster", source: "relief", layout: { visibility: "none" } }, firstSymbol);

      m.addSource("grid", { type: "geojson", data: EMPTY });
      m.addLayer({ id: "grid", type: "fill", source: "grid", paint: { "fill-color": ["get", "c"], "fill-opacity": 0.72, "fill-outline-color": "rgba(0,0,0,0)" } });

      for (const f of [...FIRE_LAYERS].reverse()) {
        m.addSource(f.id, { type: "raster", tiles: [wms(f.id, p.date)], tileSize: 256, attribution: "NASA FIRMS via GIBS" });
        m.addLayer({ id: f.id, type: "raster", source: f.id, layout: { visibility: "none" } });
      }

      m.addSource("statics", { type: "geojson", data: EMPTY });
      m.addLayer({
        id: "statics", type: "circle", source: "statics",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 4, ["*", 0.6, ["get", "r"]], 10, ["*", 2.2, ["get", "r"]]],
          "circle-color": "#C9A2F2", "circle-opacity": 0.85, "circle-stroke-color": "#1B1430", "circle-stroke-width": 0.6,
        },
      });

      addOutlookLayers(m);
      stopPulse = pulseOutlook(m);
      m.addSource("regions", { type: "geojson", data: EMPTY });
      m.addLayer({ id: "regions-fill", type: "fill", source: "regions", paint: { "fill-color": "#5CC8E6", "fill-opacity": ["case", ["get", "sel"], 0, 0.06] } });
      m.addLayer({ id: "regions-line", type: "line", source: "regions", paint: { "line-color": ["case", ["get", "sel"], "#5CC8E6", "#8FB3CC"], "line-width": ["case", ["get", "sel"], 2, 1], "line-dasharray": [3, 2] } });
      m.addLayer({
        id: "regions-label", type: "symbol", source: "regions",
        layout: { "text-field": ["get", "name"], "text-font": ["Noto Sans Regular"], "text-size": 12, "text-anchor": "bottom-left", "text-offset": [0.2, -0.2], "symbol-placement": "point" },
        paint: { "text-color": "#CFE6F2", "text-halo-color": "#0F1B2D", "text-halo-width": 1.4 },
      });
      m.addSource("draft", { type: "geojson", data: EMPTY });
      m.addLayer({ id: "draft", type: "line", source: "draft", paint: { "line-color": "#5CC8E6", "line-width": 2 } });

      m.on("click", "regions-fill", (e) => {
        const id = e.features?.[0]?.properties?.id;
        if (id && !e.features?.[0]?.properties?.sel) pickRef.current(id);
      });
      m.on("mouseenter", "regions-fill", () => (m.getCanvas().style.cursor = "pointer"));
      m.on("mouseleave", "regions-fill", () => (m.getCanvas().style.cursor = ""));

      const pop = new maplibregl.Popup({ closeButton: false, closeOnClick: false, className: "kw-pop", offset: 8 });
      m.on("mousemove", "grid", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        pop.setLngLat(e.lngLat).setHTML(`<b>${fmt(f.properties.v, 1)}</b> hotspots<br><span>0.1° cell, Aqua MODIS scale</span>`).addTo(m);
      });
      m.on("mouseleave", "grid", () => pop.remove());
      m.on("click", "statics", (e) => {
        const q = e.features?.[0]?.properties;
        if (!q) return;
        new maplibregl.Popup({ className: "kw-pop", offset: 8 }).setLngLat(e.lngLat)
          .setHTML(`<b>Persistent heat source</b><br>${fmt(q.n)} detections, ${q.y0}–${q.y1} (${q.ny} years)<br><span>Mean FRP ${fmt(q.frp, 1)} MW. Likely kiln, flare or industry (not verified)</span>`)
          .addTo(m);
      });
      m.on("click", "outlook-dots", (e) => {
        const f = e.features?.[0];
        if (!f || f.geometry.type !== "Point") return;
        const [lon, lat] = f.geometry.coordinates;
        const pp = new maplibregl.Popup({ className: "kw-pop", offset: 8, maxWidth: "300px" }).setLngLat([lon, lat])
          .setHTML(outlookPopup(f.properties, lat, lon, outlookRef.current, "Analyse 2° × 2° around here")).addTo(m);
        pp.getElement().querySelector("button")?.addEventListener("click", () => { pp.remove(); outlookPickRef.current(lon, lat); });
      });
      m.on("mouseenter", "outlook-dots", () => (m.getCanvas().style.cursor = "pointer"));
      m.on("mouseleave", "outlook-dots", () => (m.getCanvas().style.cursor = ""));

      spinGlobe(m, () => !regionRef.current);
      setReady(true);
    });
    return () => { stopPulse(); m.remove(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // area outlines
  useEffect(() => {
    if (!ready) return;
    (map.current!.getSource("regions") as GeoJSONSource).setData({
      type: "FeatureCollection",
      features: p.regions.map((r) => ({
        type: "Feature", properties: { id: r.id, name: r.name, sel: r.id === p.region?.meta.id },
        geometry: { type: "Polygon", coordinates: box(r.bbox) },
      })),
    });
  }, [ready, p.regions, p.region]);

  // fly to the area when it opens
  useEffect(() => {
    if (!ready || !p.region) return;
    const [w, s, e, n] = p.region.meta.bbox;
    map.current!.fitBounds([[w, s], [e < w ? e + 360 : e, n]], { padding: { top: 60, bottom: 140, left: 60, right: window.innerWidth > 900 ? 480 : 40 }, duration: 900 });
  }, [ready, p.region]);

  useEffect(() => {
    if (!ready || !p.focus) return;
    const m = map.current!;
    if (p.focus.bbox) {
      const [w, s, e, n] = p.focus.bbox;
      m.fitBounds([[w, s], [e, n]], { padding: 60, duration: 900, maxZoom: 11 });
    } else if (p.focus.center) m.flyTo({ center: p.focus.center, zoom: p.focus.zoom ?? 9, duration: 900 });
  }, [ready, p.focus]);

  // date-driven NASA layers
  useEffect(() => {
    if (!ready) return;
    const m = map.current!;
    for (const f of FIRE_LAYERS) {
      (m.getSource(f.id) as RasterTileSource).setTiles([wms(f.id, p.date)]);
      m.setLayoutProperty(f.id, "visibility", p.layers.fires[f.id] && p.date >= f.from ? "visible" : "none");
    }
    (m.getSource("sat") as RasterTileSource).setTiles([trueColor(p.date)]);
  }, [ready, p.date, p.layers.fires]);

  useEffect(() => {
    if (!ready) return;
    const m = map.current!;
    m.setLayoutProperty("sat", "visibility", p.basemap === "satellite" ? "visible" : "none");
    m.setLayoutProperty("relief", "visibility", p.basemap === "relief" ? "visible" : "none");
    m.setLayoutProperty("night", "visibility", p.basemap === "night" ? "visible" : "none");
  }, [ready, p.basemap]);

  useEffect(() => { if (ready) map.current!.setProjection({ type: p.projection }); }, [ready, p.projection]);
  useEffect(() => { if (ready) setOutlook(map.current!, p.outlook, p.layers.outlook); }, [ready, p.outlook, p.layers.outlook]);

  // harmonized grid for the selected month
  const vmax = useMemo(() => {
    if (!p.region) return 1;
    const all = Object.values(p.region.grid.months).flatMap((rows) => rows.map((r) => r[1])).sort((a, b) => a - b);
    return all.length ? all[Math.floor(all.length * 0.98)] || 1 : 1;
  }, [p.region]);

  useEffect(() => {
    if (!ready) return;
    const m = map.current!;
    const g = p.region?.grid;
    const rows = (g && p.month && g.months[p.month]) || [];
    (m.getSource("grid") as GeoJSONSource).setData({
      type: "FeatureCollection",
      features: rows.map(([ci, v]) => {
        const [lat, lon] = g!.cells[ci];
        const d = g!.deg;
        return {
          type: "Feature", properties: { v, c: heat(0.3 + 0.7 * (Math.log1p(v) / Math.log1p(vmax))) },
          geometry: { type: "Polygon", coordinates: [[[lon, lat], [lon + d, lat], [lon + d, lat + d], [lon, lat + d], [lon, lat]]] },
        };
      }),
    });
    m.setLayoutProperty("grid", "visibility", p.layers.grid ? "visible" : "none");
  }, [ready, p.region, p.month, p.layers.grid, vmax]);

  useEffect(() => {
    if (!ready) return;
    const m = map.current!;
    const pts = p.region?.statics.points ?? [];
    (m.getSource("statics") as GeoJSONSource).setData({
      type: "FeatureCollection",
      features: pts.map(([lon, lat, n, y0, y1, ny, frp]) => ({
        type: "Feature", properties: { n, y0, y1, ny, frp, r: 1.5 + Math.log10(n + 1) * 1.6 },
        geometry: { type: "Point", coordinates: [lon, lat] },
      })),
    });
    m.setLayoutProperty("statics", "visibility", p.layers.statics ? "visible" : "none");
  }, [ready, p.region, p.layers.statics]);

  // rectangle drawing
  const drawnRef = useRef(p.onDrawn);
  drawnRef.current = p.onDrawn;
  useEffect(() => {
    if (!ready) return;
    const m = map.current!;
    const src = m.getSource("draft") as GeoJSONSource;
    if (!p.drawing) {
      src.setData(EMPTY);
      m.getCanvas().style.cursor = "";
      return;
    }
    m.getCanvas().style.cursor = "crosshair";
    m.dragPan.disable();
    let start: maplibregl.LngLat | null = null;
    const rect = (a: maplibregl.LngLat, b: maplibregl.LngLat) =>
      [Math.min(a.lng, b.lng), Math.min(a.lat, b.lat), Math.max(a.lng, b.lng), Math.max(a.lat, b.lat)];
    const down = (e: maplibregl.MapMouseEvent) => { start = e.lngLat; };
    const move = (e: maplibregl.MapMouseEvent) => {
      if (!start) return;
      src.setData({ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: box(rect(start, e.lngLat)) } });
    };
    const up = (e: maplibregl.MapMouseEvent) => {
      if (!start) return;
      const b = rect(start, e.lngLat).map((v) => Math.round(v * 100) / 100);
      start = null;
      if (b[2] - b[0] > 0.05 && b[3] - b[1] > 0.05) drawnRef.current(b);
    };
    m.on("mousedown", down);
    m.on("mousemove", move);
    m.on("mouseup", up);
    return () => {
      m.off("mousedown", down);
      m.off("mousemove", move);
      m.off("mouseup", up);
      m.dragPan.enable();
      m.getCanvas().style.cursor = "";
    };
  }, [ready, p.drawing]);

  return <div ref={el} className="map" aria-label="Map" />;
}
