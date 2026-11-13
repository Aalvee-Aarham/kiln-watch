import { useEffect, useState } from "react";

/** Messages for the slow jobs, in the order the work actually happens. */
export const STEPS = {
  news: [
    "Looking up the place names and local languages",
    "Searching NASA EONET wildfire events",
    "Searching GDELT world news (one request every 5 seconds, their rule)",
    "Reading Google News in the local languages",
    "Checking GDACS disaster alerts for burned area",
    "Removing duplicate and syndicated stories",
    "Matching every month against the satellite record",
    "Checking which articles fall in unusual fire weeks",
  ],
  build: [
    "Reading every MODIS and VIIRS detection since 2000",
    "Separating kilns, flares and industry from vegetation fires",
    "Calibrating Terra, Aqua, Suomi-NPP, NOAA-20 and NOAA-21 onto one scale",
    "Testing the calibration on years it never saw",
    "Ranking every month against the same month in other years",
    "Building the weekly record and the fire season",
    "Writing the calendar files",
  ],
  analyst: [
    "Reading your question",
    "Choosing tools from the Kiln Watch pipeline",
    "Reading 26 years of harmonized detections",
    "Comparing with the same days in earlier years",
    "Checking reports and open wildfire events",
    "Drawing the chart",
    "Writing the answer",
  ],
  evidence: ["Opening the cached NASA FIRMS rows", "Counting detections per day and satellite", "Finding the strongest detections"],
};

const LATE = [
  "Taking a little longer than usual",
  "Still working: the news and data services are busy",
  "A few more seconds",
  "Almost there",
  "Nearly done; long windows have many months to match",
];

/** An engaging wait: what is happening now, how long it has taken, and an honest progress hint. */
export default function Loader({ steps, expected = 20, title, compact, done, total }: {
  steps: string[]; expected?: number; title?: string; compact?: boolean; done?: number; total?: number;
}) {
  const [t, setT] = useState(0);
  useEffect(() => {
    const t0 = performance.now();
    const i = setInterval(() => setT((performance.now() - t0) / 1000), 250);
    return () => clearInterval(i);
  }, []);
  const per = Math.max(2.6, expected / steps.length);
  const late = t > expected;
  const msg = late ? LATE[Math.floor((t - expected) / 5) % LATE.length] : steps[Math.min(steps.length - 1, Math.floor(t / per))];
  const real = total ? (done ?? 0) / total : null;
  const p = real ?? Math.min(0.95, 1 - Math.exp(-t / (expected * 0.55)));
  const k = late ? `l${Math.floor((t - expected) / 5)}` : `s${Math.floor(t / per)}`;
  return (
    <div className={`loader ${compact ? "compact" : ""}`} role="status" aria-live="polite">
      <svg className="orbit" viewBox="0 0 64 64" aria-hidden>
        <defs>
          <radialGradient id="lg" cx="40%" cy="35%"><stop offset="0" stopColor="#1B3A5C" /><stop offset="1" stopColor="#050A12" /></radialGradient>
        </defs>
        <circle cx="32" cy="32" r="15" fill="url(#lg)" stroke="#1E3B5A" />
        <circle className="ember1" cx="27" cy="29" r="1.6" fill="#EA7329" />
        <circle className="ember2" cx="36" cy="36" r="1.2" fill="#F6C64F" />
        <circle className="ember3" cx="34" cy="26" r="1" fill="#FF3B2F" />
        <g transform="rotate(-24 32 32)">
          <ellipse cx="32" cy="32" rx="27" ry="10" fill="none" stroke="#1C2A3C" />
          <g>
            <rect x="-4" y="-0.8" width="8" height="1.6" fill="#7FCBFF" /><circle r="2.4" fill="#00A1FF" />
            <animateMotion dur="3.2s" repeatCount="indefinite" path="M59,32 A27,10 0 1,1 5,32 A27,10 0 1,1 59,32" />
          </g>
        </g>
      </svg>
      <div className="lbody">
        {title && <b className="ltitle">{title}</b>}
        <span className="lmsg" key={k}>{msg}…</span>
        <div className="lbar"><div style={{ width: `${Math.round(p * 100)}%` }} /></div>
        <span className="lmeta">
          {Math.floor(t)} s{real !== null ? ` · ${done}/${total}` : expected ? ` · usually about ${expected < 60 ? `${expected} s` : `${Math.round(expected / 60)} min`}` : ""}
          {!compact && !late && <> · step {Math.min(steps.length, Math.floor(t / per) + 1)} of {steps.length}</>}
        </span>
      </div>
    </div>
  );
}
