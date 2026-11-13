import { ReactNode, RefObject, useEffect, useState } from "react";
import Lenis from "lenis";
import { Level, LEVEL_LABEL, Region, RegionItem, api } from "../api";

export type Page = "home" | "explore" | "warning" | "news" | "download" | "create" | "method" | "mcp" | "n8n";
export const PAGES: readonly (readonly [Page, string])[] = [
  ["home", "Home"], ["explore", "Explorer"], ["warning", "Early warning"], ["news", "News"], ["download", "Download"],
  ["create", "Create"], ["method", "Method"], ["mcp", "Claude MCP"], ["n8n", "n8n"],
];

export type PageProps = {
  regions: RegionItem[]; online: boolean; go: (p: Page) => void; openRegion: (id: string) => void; refresh: () => void;
};

/** Alerts have no accounts yet: the secret token is the key, remembered in this browser only. */
const KEY = "kw.alerts";
export type Saved = { token: string; name: string };
export function savedAlerts(): Saved[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "[]"); } catch { return []; }
}
export function saveAlerts(list: Saved[]) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* private mode: alert still works through n8n */ }
}

export function PageHead({ kicker, title, lead, children }: { kicker: string; title: string; lead: string; children?: ReactNode }) {
  return (
    <header className="page-head">
      <div><p className="kicker">{kicker}</p><h1>{title}</h1></div>
      <div><p className="lead">{lead}</p>{children}</div>
    </header>
  );
}

/** Eased wheel scrolling for a scrollable page; nested scroll areas keep their own wheel. */
export function useSmoothScroll(ref: RefObject<HTMLElement | null>, key: unknown) {
  useEffect(() => {
    const el = ref.current;
    if (!el || !el.firstElementChild || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const lenis = new Lenis({ wrapper: el, content: el.firstElementChild as HTMLElement, autoRaf: true, lerp: 0.1,
      prevent: (n) => n.classList.contains("scroll") || n.tagName === "PRE" || n.tagName === "SELECT" });
    return () => lenis.destroy();
  }, [ref, key]);
}

export const LevelChip = ({ level }: { level: Level }) => <span className={`lvl ${level}`}>{LEVEL_LABEL[level]}</span>;

/** Loads a region's JSON bundle; keeps the previous choice stable while another loads. */
export function useRegion(id: string | null) {
  const [region, setRegion] = useState<Region | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    setRegion(null); setErr(null);
    if (!id) return;
    let live = true;
    api.region(id).then((r) => live && setRegion(r)).catch((e) => live && setErr(e.message));
    return () => { live = false; };
  }, [id]);
  return { region, err };
}

export function AreaSelect({ regions, value, onChange }: { regions: RegionItem[]; value: string; onChange: (id: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} aria-label="Area">
      {regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
    </select>
  );
}

/** Copy-able code block. */
export function Code({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1500); }).catch(() => undefined);
  };
  return (
    <div className="codeblock">
      <pre><code>{text}</code></pre>
      <button className="btn ghost" onClick={copy}>{done ? "Copied" : "Copy"}</button>
    </div>
  );
}

export const Offline = ({ what }: { what: string }) => (
  <p className="warn small">{what} needs the Kiln Watch API. Start it with <code>uvicorn kw.api:app --port 8000</code> in <code>server/</code>.</p>
);

/** Any place on Earth: search a name, type coordinates, or draw on the map. Boxes are 0.5 to 4 degrees, 16 square degrees at most. */
export function AreaPicker({ online, cta, busy, onPick, onDraw }: {
  online: boolean; cta: string; busy?: boolean; onPick: (box: number[], name?: string) => void; onDraw?: () => void;
}) {
  const [q, setQ] = useState("");
  const [box, setBox] = useState(["", "", "", ""]);
  const [name, setName] = useState("");
  const [msg, setMsg] = useState("");
  const n = box.map(Number);
  const valid = box.every((v) => v.trim() !== "" && Number.isFinite(+v)) && n[1] < n[3] && n.every((v, i) => Math.abs(v) <= (i % 2 ? 90 : 180));
  const width = n[0] <= n[2] ? n[2] - n[0] : n[2] + 360 - n[0];
  const area = valid ? width * (n[3] - n[1]) : 0;

  const find = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg("");
    if (!q.trim()) return;
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(q.trim())}`);
      const [p] = await r.json();
      if (!p) { setMsg(`No place called “${q.trim()}”.`); return; }
      const [s, nn, w, ea] = p.boundingbox.map(Number);
      const cl = (v: number) => Math.min(4, Math.max(0.5, v));
      const [hw, hh, lat, lon] = [cl(ea - w) / 2, cl(nn - s) / 2, (s + nn) / 2, (w + ea) / 2];
      setBox([Math.max(-180, lon - hw), Math.max(-90, lat - hh), Math.min(180, lon + hw), Math.min(90, lat + hh)].map((v) => v.toFixed(2)));
      setName(String(p.display_name).split(",").slice(0, 2).join(",").trim());
    } catch { setMsg("Place search is unavailable right now. Enter the coordinates instead."); }
  };

  return (
    <div className="picker">
      <form className="row" onSubmit={find} role="search">
        <input className="grow" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search any place on Earth, e.g. Cerrado, Brazil" aria-label="Search a place" />
        <button className="btn ghost">Find</button>
        {onDraw && <button type="button" className="btn ghost" onClick={onDraw} disabled={!online}>Draw on the map</button>}
      </form>
      {msg && <p className="error small">{msg}</p>}
      <form onSubmit={(e) => { e.preventDefault(); if (valid && area <= 16) onPick(n, name.trim() || undefined); }}>
        <div className="coord-grid">
          {(["West", "South", "East", "North"] as const).map((l, i) => (
            <label key={l}>{l}<input inputMode="decimal" value={box[i]} placeholder={["88.0", "23.0", "89.5", "24.5"][i]} onChange={(e) => setBox(box.map((v, j) => (j === i ? e.target.value : v)))} /></label>
          ))}
        </div>
        <label className="field">Name (optional)<input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Brick kilns north of Dhaka" /></label>
        {valid && <p className={area > 16 ? "error small" : "muted small"}>{area > 16 ? `This box is ${area.toFixed(1)} square degrees; use one up to 16.` : `About ${Math.round(area * 12100).toLocaleString()} km².`}</p>}
        <button className="btn" disabled={!online || !valid || area > 16 || busy}>{busy ? "Working…" : cta}</button>
      </form>
    </div>
  );
}
