import { useEffect, useState } from "react";
import { LEVEL_LABEL, Warning, ordinal } from "../api";

// Animated screens for the home page console. Everything shown comes from the API: the early-warning payload for one
// built area and the same-days values of its earlier years (meta.current.prior). They replay each time `play` turns on.

export type ConsoleData = { w: Warning; prior: [number, number][]; sentence: string | null };

/** Milliseconds since `play` turned on; 0 while off. */
function useClock(play: boolean) {
  const [t, setT] = useState(0);
  useEffect(() => {
    if (!play) { setT(0); return; }
    const t0 = performance.now();
    let id = 0;
    const tick = () => { const e = performance.now() - t0; setT(e); if (e < 9000) id = requestAnimationFrame(tick); };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [play]);
  return t;
}
const ramp = (t: number, from: number, dur: number) => { const x = Math.min(1, Math.max(0, (t - from) / dur)); return 1 - (1 - x) ** 3; };
const n0 = (v: number) => Math.round(v).toLocaleString("en");
const pctile = (xs: number[], p: number) => { const s = [...xs].sort((a, b) => a - b), i = (s.length - 1) * p, lo = Math.floor(i); return s[lo] + (s[Math.ceil(i)] - s[lo]) * (i - lo); };
const monthName = (period: string) => new Date(period + "-01T00:00:00Z").toLocaleDateString("en", { month: "long", timeZone: "UTC" });

export function WarnScreen({ d, play }: { d: ConsoleData | null; play: boolean }) {
  const t = useClock(play);
  if (!d?.w.month) return <div className="scr ew"><p className="wait">Loading the early-warning check…</p></div>;
  const { w, prior } = d, m = w.month!, year = +m.period.slice(0, 4);
  const vals = prior.map(([, v]) => v);
  const bars = [...prior.map(([y, v]) => ({ y, v, now: false })), { y: year, v: m.value, now: true }].sort((a, b) => a.v - b.v);
  const max = Math.max(...bars.map((b) => b.v)) * 1.08;
  const lines: [string, number][] = [["Median", m.median_same_days], ["Watch · 75th", pctile(vals, 0.75)], ["Elevated · 90th", pctile(vals, 0.9)]];
  const ratio = m.value / m.median_same_days;
  const pct = m.percentile ?? 0;
  return (
    <div className={`scr ew ${play ? "on" : ""}`}>
      <header><i className="live" />Early warning<em>{w.name}</em><time>data through {w.as_of}</time></header>
      <div className="ew-body">
        <aside>
          <p className="k">{monthName(m.period)} {year} so far · {m.days} days</p>
          <p className={`cs-lvl ${w.level}`} style={{ opacity: ramp(t, 2300, 400) }}>{LEVEL_LABEL[w.level]}</p>
          <p className="pct"><b>{ordinal(Math.round(pct * ramp(t, 1500, 1100)))}</b> percentile</p>
          <p className="sent" style={{ opacity: ramp(t, 2600, 500) }}>{w.headline}</p>
          <ul className="facts">
            <li><span>{year} so far</span><b>{n0(m.value * ramp(t, 1500, 1100))}</b></li>
            <li><span>Usual (median)</span><b>{n0(m.median_same_days)}</b></li>
            <li><span>Rank</span><b>{m.rank} of {m.of_years}</b></li>
          </ul>
        </aside>
        <figure className="cs-chart">
          <figcaption>Same {m.days} days of {monthName(m.period)}, every year since {prior[0]?.[0]} · hotspots on the Aqua scale</figcaption>
          <div className="plot">
            {lines.map(([l, v], i) => (
              <div key={l} className={`thr t${i}`} style={{ bottom: `${(v / max) * 100}%`, opacity: ramp(t, 1100 + i * 150, 400) }}><span>{l}</span></div>
            ))}
            <div className="bars">
              {bars.map((b, i) => (
                <div key={b.y} className={`b ${b.now ? "now" : ""}`} style={{ "--h": `${(b.v / max) * 100}%`, "--i": b.now ? 30 : i } as React.CSSProperties}>
                  {(b.now || b.v === Math.max(...vals)) && <span>{b.y}</span>}
                </div>
              ))}
            </div>
          </div>
        </figure>
      </div>
      <div className="toast" style={{ opacity: ramp(t, 3300, 400), transform: `translateY(${(1 - ramp(t, 3300, 500)) * 16}px)` }}>
        <b>n8n · your alert</b>
        <span>Month so far is {ratio.toFixed(2)}× the usual median: {ratio > 1 && m.value >= 5 ? "alert sent" : "no alert this time"}</span>
      </div>
    </div>
  );
}

/** A real past month of the area that would have been "elevated" (month percentile ≥ 90, the warning rule), from monthly.json. */
export type PastAlert = { name: string; period: string; ratio: number; rank: number; n: number };

/** A phone that buzzes with the n8n alert: a replay of a real past elevated month, then today's live check. */
export function Phone({ d, past, play }: { d: ConsoleData | null; past: PastAlert | null; play: boolean }) {
  const t = useClock(play), now = new Date();
  const m = d?.w.month, ratio = m ? m.value / m.median_same_days : null;
  const card = (at: number) => ({ opacity: ramp(t, at, 350), transform: `translateY(${(1 - ramp(t, at, 600)) * -120}%) scale(${0.92 + 0.08 * ramp(t, at, 600)})` });
  return (
    <div className={`phone ${t > 1900 && t < 2500 ? "buzz" : ""}`}>
      <div className="ph-scr">
        <p className="ph-time">{now.toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit", hour12: false })}</p>
        <p className="ph-date">{now.toLocaleDateString("en", { weekday: "long", day: "numeric", month: "long" })}</p>
        {past && (
          <div className="ph-n hot" style={card(1900)}>
            <p className="ph-app"><i />Kiln Watch · n8n<span>alert</span></p>
            <b>Elevated</b>
            <em>{past.name}</em>
            <p>{monthName(past.period)} {past.period.slice(0, 4)}: {past.ratio.toFixed(1)}× the usual {monthName(past.period)}. {past.rank === 1 ? "Highest" : `${ordinal(past.rank)} highest`} of {past.n} years.</p>
            <small>Replay of a real past month</small>
          </div>
        )}
        {d && m && ratio !== null && (
          <div className="ph-n" style={card(3300)}>
            <p className="ph-app"><i />Kiln Watch · today<span>now</span></p>
            <b>{LEVEL_LABEL[d.w.level]}</b>
            <em>{d.w.name}</em>
            <p>{monthName(m.period)} so far: {ratio.toFixed(2)}× the usual. {ratio > 1 && m.value >= 5 ? "Alert sent." : "No alert needed."}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export function AskScreen({ d, play }: { d: ConsoleData | null; play: boolean }) {
  const t = useClock(play);
  if (!d?.w.month) return <div className="scr cs-ask"><p className="wait">Loading…</p></div>;
  const { w } = d, m = w.month!;
  const q = `Is ${monthName(m.period)} unusual here compared with earlier years?`;
  const typed = q.slice(0, Math.floor(Math.max(0, t - 300) / 32));
  const tStart = 300 + q.length * 32 + 250, tDone = tStart + 1100;
  const answer = `${w.headline} The usual level for these days is ${n0(m.median_same_days)} hotspots on the Aqua scale; this year so far is ${n0(m.value)} (95% interval ${n0(m.ci95[0])} to ${n0(m.ci95[1])}). [early_warning]`;
  const words = answer.split(" "), shown = words.slice(0, Math.max(0, Math.floor((t - tDone - 200) / 45))).join(" ");
  const json: [string, string][] = [["period", `"${m.period}"`], ["days", `${m.days}`], ["value", `${m.value}`], ["ci95", `[${m.ci95.join(", ")}]`],
    ["median_same_days", `${m.median_same_days}`], ["percentile", `${m.percentile}`], ["rank", `${m.rank}`], ["of_years", `${m.of_years}`], ["level", `"${w.level}"`]];
  return (
    <div className={`scr cs-ask ${play ? "on" : ""}`}>
      <header><i className="live" />AI analyst<em>{w.name}</em><time>answers only from Kiln Watch tools</time></header>
      <div className="ask-body">
        <section className="chat">
          <p className="q">{typed}{t < tStart && <i className="caret" />}</p>
          {t > tStart && (
            <p className={`tool ${t > tDone ? "done" : ""}`}><i />early_warning<span>(region_id: "{w.region_id}")</span></p>
          )}
          {shown && <p className="a">{shown}</p>}
          <p className="input"><span>Ask about this area…</span><b>Ask</b></p>
        </section>
        <section className="result">
          <p className="k">Tool result</p>
          <pre>{"{\n"}{json.map(([k, v], i) => (
            <span key={k} style={{ opacity: ramp(t, tStart + 300 + i * 90, 250) }}>{`  "${k}": ${v}${i < json.length - 1 ? "," : ""}\n`}</span>
          ))}{"}"}</pre>
          <p className="note">The analyst may only quote numbers a tool returned. Re-enacted here with the live tool output.</p>
        </section>
      </div>
    </div>
  );
}
