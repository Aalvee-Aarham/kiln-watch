# Design

Source of truth: `web/src/index.css` (`@theme` + `:root[data-theme="night"]`). Charts read the same tokens at runtime via `web/src/lib/theme.ts` (`palette()`) and `ensureChartTheme()`.

## Theme

Two themes, both product-register: **Day** (paper graphite, default) and **Night** (VIIRS night-overpass blue-slate). Pre-paint selection via inline script in `web/index.html` (`localStorage.kwTheme` → `prefers-color-scheme`); toggle in header; charts and the Leaflet basemap (CARTO light_all / dark_matter) re-theme on flip.

## Color

All OKLCH. Strategy: restrained chrome, full-palette data.

| Token | Day | Night | Role |
|---|---|---|---|
| bg | 0.975 0.002 75 | 0.17 0.015 250 | page |
| surface | 1 0 0 | 0.21 0.017 250 | cards |
| surface-2 | 0.955 0.004 75 | 0.25 0.018 250 | toolbars, table heads, hover |
| ink | 0.22 0.01 60 | 0.93 0.01 85 | text |
| muted | 0.50 0.015 65 | 0.68 0.015 80 | secondary text |
| line | 0.90 0.005 75 | 0.32 0.015 250 | borders |
| ember | 0.55 0.19 35 | 0.65 0.19 35 | accent: CTA, selection, focus |
| ember-strong | 0.45 0.17 35 | 0.55 0.17 35 | hero band |

Data vocabulary: fire ramp `fire-1..5` straw→char (straw 0.93/0.09/90 → char 0.36/0.12/35), `kiln` 0.55/0.13/45, `veg` 0.55/0.11/150, `unknown` 0.60/0.012/250, `cloud` 0.80/0.03/240 (monsoon blue-slate = "not observed"), `ctrl` 0.55/0.14/250, `raw` desaturated gray, `band` light amber for CI areas. Semantic: ok=moss, warn=amber, err=red, info=slate (+ `-soft` backgrounds).

## Typography

- Display: **Anek Bangla Variable** (self-hosted `@fontsource-variable/anek-bangla`), weight 600–650, h1–h3 + wordmark (`.h-display`). Chosen: one superfamily natively harmonizing Latin + বাংলা.
- Body/UI: system stack + Noto Sans Bengali fallback.
- Figures: **IBM Plex Mono** 400/600 (`.num`), `tabular-nums` — all CIs, dates, SHAs, axis labels.
- Scale (rem, ratio ≈1.18): 12 · 13 · 14 · 16 · 18 · 20 · 24 · 30 · 38 (h1 ceiling).

## Components

`.card`, `.btn`, `.note`, `.num`, `.h-display`, `.skeleton` (shimmer, 1.2s) in `index.css`; React kit in `web/src/components/ui.tsx`: AppShell (pill nav, scrollable on mobile), CalStrip (identity mark), ChartCard, SegmentedToggle, StatusMessage (info/warn/err/ok), ProvisionalBadge, DownloadButtons (+ per-chart PNG via ECharts `getDataURL`), Breadcrumbs, Skeleton/SkeletonCard, Sparkline (inline SVG), CountUp, EChart (ARIA, resize, theme-aware re-init, reduced-motion), Loading with skeleton variants.

## Layout

Max-w-6xl shell; Explorer is `340px / 1fr` map+detail grid (collapses to single column); Evidence uses 2–3 col card grids; Method is a max-w-3xl document with hanging mono numerals. Z-scale: dropdown 30 / sticky header 40 / chart export button absolute / leaflet manages own panes.

## Motion

Product register: state/feedback/loading/reveal only, no page-load orchestration. Tokens: 120/180/240/400ms, `--ease-out: cubic-bezier(.22,1,.36,1)`, 40ms stagger. Route change: fade+8px rise 240ms (`.route-in`, keyed on pathname). Charts: 400ms cubicOut draw-in, heatmap row cascade. Hero stats count up once (600ms, ease-out-quart). Theme flip: 180ms color crossfade. Map selection: ember stroke pulse ×2 then steady. `prefers-reduced-motion: reduce` collapses everything to instant.
