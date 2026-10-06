# Product

## Register

product

## Users

- **Department of Environment (Bangladesh) analysts** — cross-checking a district's burning calendar before an inspection round; bright office or field phone, low patience for decorative UI, high scrutiny of numbers and their uncertainty.
- **Journalists and researchers** — verifying a claim about kiln seasons or crop burning; arrive via a shared deep link (district page or drawn box), read one story, leave.
- **NASA Space Apps judges** — evaluating method honesty and craft in a short demo; the pre-registered gates and their failures must be unmissable.

## Product Purpose

Kiln Watch harmonizes 20+ years of MODIS and VIIRS active-fire detections over Bangladesh into one honest Aqua-MODIS-equivalent scale, separates kiln-like from vegetation-like heat, and exposes per-area burning calendars with uncertainty. Success: a user trusts one number enough to act on it, and every number can be traced to a pre-registered rule.

## Brand Personality

Observatory, not dashboard. **Candid** (failures shown, not hidden), **measured** (restraint until the data speaks), **field-ready** (works offline, degraded states are honest). Emotional goal: the calm authority of a well-calibrated instrument.

## Anti-references

- Generic SaaS admin templates (sidebar + KPI cards + gradient hero metric).
- Climate-dashboards that drench chrome in brand color until the data series are unreadable.
- Anti-slop tells: eyebrow kickers on every section, glassmorphism, gradient text, side-stripe accents.

## Design Principles

1. **The data is the most saturated thing on screen.** Chrome stays graphite; color belongs to fire, kiln, vegetation, cloud.
2. **Honesty is a UI state.** Cloud ≠ zero, provisional ≠ final, FAIL ≠ hidden — encode epistemic status visually everywhere.
3. **Every number wears its uncertainty.** CIs in mono tabular figures, never stripped for tidiness.
4. **Degrade like the basemap does.** Offline, the app stays usable; so do its empty, error, and slow states.
5. **One identity element.** The burning-calendar strip (favicon → wordmark → heatmap) carries the brand; nothing else decorates.

## Accessibility & Inclusion

- WCAG 2.1 AA: body ≥4.5:1, large text ≥3:1, verified in both day and night themes.
- Full keyboard path (combobox, map keyboard mode, focus-visible rings in ember).
- `prefers-reduced-motion`: all animation collapses to instant/crossfade; charts draw without motion.
- Color-blind safety: series distinguished by dash/symbol/shape as well as hue; heatmap ramp is lightness-graded, not hue-only.
- Bilingual EN/বাংলা, Bangla-first font fallbacks (Noto Sans Bengali, Anek Bangla).
