# Kiln Watch redesign plan: "for everyone, with proof underneath"

Status: built 2026-10-07 (branch `redesign`). Builds on Ahnaf's design system (`DESIGN.md`, `ui_ux_plan.md`): same colours, fonts, map and chart kit. This plan changes **structure, words and interactivity**, not the visual identity.

## 1. The two problems this fixes

1. **Too raw.** The site speaks to scientists: p-values, "MYD-eq", gate names. A farmer, a student or a busy officer cannot tell what it means for them.
2. **No applications.** The findings are shown as text and charts. Nothing lets a visitor *use* them, and the site never shows how Bangladesh or the world benefits.

## 2. Principles

- **Three layers on every topic:** *What it means* (one plain sentence) → *Try it* (an interactive tool) → *See the proof* (link into the For-experts section). Nobody has to read the proof; it is one click away for whoever does.
- **Real data only.** Every number and chart comes from the real export (`web/public/data`). Illustrations (e.g. a drawing of satellite pixels) are labelled "illustration".
- **Plain words.** No p-values, CIs or sensor codes on main pages. Round numbers ("about 150 days"). Technical words get a tap-to-explain glossary pop-up (native HTML `popover`).
- **Honest limits stay visible, in plain words.** "Our data shows *when* kilns run, not how much smoke they make." "Things happening at the same time doesn't mean one caused the other."
- **Outside facts are always labelled.** Facts from other studies sit in a visually distinct "From other studies" box with a source link, never mixed with our results.
- **Area level only.** No kiln locations, ever (invariant 3). All tools work on districts and upazilas.
- **English first.** Bangla is added later; the language toggle shows the existing "English only for now" note on new pages.

## 3. New site map

| Page | Route | For | Replaces |
|---|---|---|---|
| Home | `#/` | everyone | Story page |
| My area | `#/area/:unitId?` | citizens, officers | Explorer + This season |
| Kiln planner | `#/kilns/:unitId?` | DoE officers, journalists | Kiln seasons page |
| Sensor switch | `#/sensors` | students, judges | "Spliced naïvely" + "One honest scale" sections |
| Timeline | `#/timeline` | everyone, policy | (new) |
| Who benefits | `#/impact` | everyone, judges | (new) |
| For experts | `#/experts`, plus the original pages at their original addresses: `#/story`, `#/explore`, `#/evidence`, `#/method`, `#/season`, `#/experts/kilns` | researchers, judges | Story, Evidence, Method, full Explorer, old kiln page (unchanged content) |

Old links keep working: the expert pages kept their addresses, so nothing needs a redirect. `#/kilns` is now the planner; the old kiln charts moved to `#/experts/kilns`.

Navigation: `My area · Kiln planner · Sensor switch · Timeline · Who benefits · For experts` (the logo is Home). Short labels below 1100 px keep the row unscrolled at 390 px.

## 4. Pages and applications

### 4.1 Home (`#/`)
- **Headline:** "NASA satellites have watched Bangladesh burn for 23 years. We made their records agree, and found what they missed."
- **Three takeaway cards**, each with a tiny live visual and a "Try it" button:
  1. *"The 2012 'fire explosion' never happened."* A mini raw-vs-corrected line → Sensor switch.
  2. *"Fire satellites can't see brick kilns. Night lights can."* The national kiln-season curve → Kiln planner.
  3. *"Kiln season has grown from about 3 months to about 5."* A bar of 2012-13 vs 2024-25 duration → Timeline.
- **"Right now" strip:** today's NASA fire data. "This season so far: X districts above their normal." Tap → My area.
- **Who benefits teaser:** 4 icons (inspector, farmer, family, the world) → Impact page.
- Ahnaf's Ledger chart stays as the hero visual, with a one-line plain caption.

### 4.2 App 1: My area checker (`#/area`)
**Question it answers:** "When is burning season where I live, and is this year normal?"
- **Pick a place three ways:** search box (existing), tap the map (existing BdMap), or **"Use my location"**. Browser geolocation plus a ~15-line point-in-polygon on the district shapes. The location is computed on the device and never sent anywhere; the page says so.
- **Answer cards (plain language):**
  - "Burning season here: usually **Nov–Apr**, busiest in **Feb**" (from the area calendar's normal).
  - "This season so far: **normal / busier than usual / quieter than usual**", with a traffic-light chip (from NRT days above the 90th-percentile normal; districts only, said so for upazilas).
  - "Brick kilns here work from about **mid-Nov to mid-Apr**" (if the area has a kiln calendar; otherwise "no kiln calendar for this area: fewer than 5 mapped kiln clusters").
  - "Rice harvest windows: Aman and Boro" bands on the year strip.
- **One big year strip** (CalStrip/heatmap): this year over the normal range, months labelled in words.
- **"Show details"** expands the existing full calendar charts, unchanged.
- **Compare:** "Compare with another area" puts two year strips side by side.
- **Share:** a copyable link (deep link) and the existing CSV/JSON downloads.

### 4.3 App 2: Kiln inspection planner (`#/kilns`)
**Question it answers:** "When are kilns working in each area, and where is the season longest?"
- **Map:** choropleth of kiln-season length per area (275 areas), with a **season slider 2012-13 → 2025-26**. Drag it and watch the country's kiln season lengthen year by year.
- **Pick an area → planner card:**
  - Typical **start / busiest / end** (median of the last 3 seasons), each with a plain range ("between early and late Dec").
  - **"Kilns likely working" calendar bar**, with the busiest month highlighted: "A visit in this window is most likely to find kilns operating."
  - Trend: "Season here was about N days in 2012-15 and about M days in 2022-25."
- **Rankings:** "Longest kiln seasons" and "Fastest-growing seasons" (top 10 areas), each clickable.
- **Guardrail text:** "A long season is not proof that any kiln is illegal. This is a planning aid for when to look, not a list of offenders."
- Data: `kiln_activity.json` (areas, seasons, onset/end/duration/peak). No new pipeline work.

### 4.4 App 3: Sensor-switch playground (`#/sensors`)
**Question it answers:** "Why did fires seem to explode in 2012, and how did we fix it?"
- **Step 1, the puzzle:** the raw national line 2003→2025 with the big 2012 jump. A quiz: "Did fires really jump in 2012?" Yes / No.
- **Step 2, the reveal:** "Same camera" toggle shows Aqua-MODIS alone (the same instrument for the whole period): no jump. Plain line: "The fires didn't change. The camera did."
- **Step 3, why:** an *illustration* (labelled) of one rice field seen through a 1 km pixel vs a 375 m pixel. Small fires only show up in the sharp one.
- **Step 4, the fix:** sensor chips (Terra, Aqua, S-NPP, NOAA-20, NOAA-21) switch each satellite's raw counts on and off. A **"Corrected" toggle** animates the chart from raw to harmonized; ECharts animates between the two real series, and no in-between values are invented. The 2012 gap shrinks from 55 to under 2.
- **Step 5, the check:** "Our corrected 2012-13 value: 23.4. What the old camera actually saw: 23.7."
- Data: `harmonization.json` (`yearly`, `raw_by_sensor`, `h`, `aqua_obs`, `seam`).

### 4.5 App 4: Policy and events timeline (`#/timeline`)
**Question it answers:** "What happened around each law, lockdown and satellite launch?"
- **A vertical scrolling timeline, 2003 → 2027.** Each season row shows:
  - corrected fire activity (bar);
  - kiln-season length (bar, from 2012);
  - pinned events.
- **Events:**
  - existing: Brick Kiln Act passed in 2013 and in force from 2014, COVID holiday 2020;
  - **new, each with a source:**
    - 2019 concrete-block policy, target 100% in government works by 2024-25, later extended to 2028-29;
    - satellite milestones: Aqua 2002, S-NPP 2011, NOAA-20 2017, NOAA-21 2022;
    - planned MODIS end: Terra Jan 2027, Aqua ~Sep 2027.
- **Tap an event** to see a card with what it was, the source link, and what the fire and kiln bars did the season before and after.
- **Fixed caution line:** "Things happening at the same time doesn't mean one caused the other."
- **Data:** `events.json` gains a `satellite` list. `data/static/policy_events.csv` gains the 2019 block policy, and a new `data/static/satellite_events.csv` holds the satellite milestones. `events_payload()` in `export.py` reads both.

### 4.6 Who benefits (`#/impact`)
Six benefit cards. Each card has: who, what they can do with Kiln Watch, *our finding* (blue), *from other studies* (grey, with link), and a button into the matching app.

| Who | What they can do | Our finding | From other studies |
|---|---|---|---|
| **Environment inspectors (DoE)** | Plan visits for when kilns are actually running, area by area | Kiln season mapped for 275 areas; ~mid-Nov→mid-Apr, peak Feb | DoE (2019): kilns ≈ 58% of the particles in Dhaka's winter smog [1] |
| **Families and health workers** | Know which months to expect kiln and crop-burning season locally | Burning calendars for every district and upazila | Air pollution caused ~78,000–88,000 deaths in Bangladesh in 2019, costing ~4% of GDP [2] |
| **Agriculture officers** | Time crop-residue outreach to each area's real burning weeks | Per-area fire calendars with Aman/Boro harvest windows | — |
| **Policy makers** | Check whether kiln policy is changing what happens on the ground | Kiln season grew from ~90 days (2012-13) to ~150 (2022-25) | 2019 block-brick target (100% in govt works by 2025) was missed and extended to 2028-29 [3][4]; ~7,000 kilns, 1–1.5 million seasonal workers [5] |
| **Scientists worldwide** | Keep 20-year fire records going after MODIS shuts down | Open method; 2012 sensor jump cut by 97% | Terra MODIS ends Jan 2027, Aqua ~Sep 2027 [6] |
| **Other brick-belt countries** | Repeat the night-light kiln calendar with free NASA data | Night-light test passed in 13 of 13 seasons (Bangladesh only) | 55,000–66,000 kilns across Pakistan, India, Nepal and Bangladesh [7] |

**Honesty box on this page:**
- "We tested whether burning predicts Dhaka's daily PM2.5 readings. It didn't (correlation ≈ 0), so Kiln Watch is not an air-quality forecast."
- "The night-light method is tested in Bangladesh only."

Sources (to cite on the page):
1. Prothom Alo, *Brick kilns blamed for 58pc air pollution in capital* (DoE notice): https://en.prothomalo.com/environment/Brick-kilns-blamed-for-58pc-air-pollution-in
2. World Bank, *Breathing Heavy* (2022): https://www.worldbank.org/en/news/press-release/2022/12/03/high-air-pollution-level-is-creating-physical-and-mental-health-hazards-in-bangladesh-world-bank
3. Dhaka Tribune, *What Bangladesh is doing to shift to green bricks*: https://www.dhakatribune.com/bangladesh/328956
4. Mongabay (Jan 2026), *Brickmaking keeps eating farmland as Bangladesh misses clean build goal*: https://news.mongabay.com/2026/01/brickmaking-keeps-eating-farmland-as-bangladesh-misses-clean-build-goal/
5. Prothom Alo op-ed, *Brick kilns and air pollution*: https://en.prothomalo.com/opinion/op-ed/dgv7rqo0mh
6. NASA Earthdata, *Transition from MODIS to VIIRS*: https://www.earthdata.nasa.gov/data/alerts-outages/transition-from-modis-viirs
7. University of Nottingham Rights Lab (brick belt kiln count): https://www.nottingham.ac.uk/news/pressreleases/2018/march/using-satellite-images-to-tackle-modern-slavery-across-south-asia's-'brick-belt'.aspx and https://eprints.nottingham.ac.uk/81703

### 4.7 For experts (`#/experts`)
- A landing page: "Everything behind the plain-language pages", with cards for Evidence (all pre-registered tests, passes and fails), Method, full Explorer (drawn boxes, all charts), downloads and pre-registration links.
- **Content moved as-is.** Nothing is deleted or reworded beyond page titles.

## 5. Writing rules for main pages
- One idea per sentence; aim for a 12-year-old reading level.
- Every chart gets a **"What this shows"** sentence above it, not a caption below.
- Dates in words ("mid-November"), not day-of-season numbers.
- Units in words ("fire activity", "extra night light"). The full unit names live in experts.
- Glossary pop-ups for: satellite, MODIS, VIIRS, night lights, radar, normal range, upazila, harmonize.

## 6. Technical approach
- **Reuse:** BdMap, EChart and charts, CalStrip, Ledger, ui.tsx kit, data hooks, i18n keys (English text, Bangla fallback note).
- **New files:**
  - `pages/HomePage.tsx`, `AreaPage.tsx`, `KilnPlannerPage.tsx`, `SensorsPage.tsx`, `TimelinePage.tsx`, `ImpactPage.tsx`, `ExpertsPage.tsx`;
  - `lib/geo.ts` (point-in-polygon), `lib/plain.ts` (number/date → words).
- **No new dependencies.** Geolocation, popover and `<details>` are native; ECharts already does the animation.
- **Pipeline:** only `events_payload()` changes. Two CSV rows/files are added in `data/static`, and the public export is re-run on real data.
- **Tests:**
  - **Vitest:** point-in-polygon against closed-form squares and triangles; the plain-language formatters against fixed date→word pairs; the "typical season" median against hand-computed values.
  - **Playwright:** every new route renders with no console errors on the real build; the location button shows a fallback when permission is denied; the season slider changes the map; the sensor toggle switches series; old routes redirect.
  - **Python:** the contract test for the new `events.satellite` list.
  - **Final checks:** full pytest, ruff, typecheck, lint, then build with `DATA_SRC=real`.
- **Delivery:** build on a branch `redesign`, push it and open a PR into `main`. Ahnaf can review and nothing collides with his work in progress. Merge after you look at the PR preview.

## 7. Build order
1. Routes, navigation, redirects, For-experts shell. Existing content moves; nothing breaks.
2. My area checker.
3. Kiln planner.
4. Sensor-switch playground.
5. Events data and Timeline.
6. Who benefits page.
7. New Home page.
8. Plain-language pass on all main pages, glossary, full test run, push, PR.

## 8. Risks
- **Overclaiming.** Main pages must never say kilns *cause* a given day's pollution, that a policy *caused* a change, or that an area's kilns are illegal. The guardrail lines above are part of the spec.
- **Merge conflicts with Ahnaf.** Ask him to pause changes to `pages/` while the `redesign` branch is open, or to build on top of it.
- **Upazila "this season" status.** Near-real-time data exists for districts only; upazila pages say so and show the district's status.

## 9. v2 (branch `redesign-v2`, 2026-10-07): structured around the judging rubric

Judges score **Impact, Creativity, Validity, Relevance**. Each now has a home, and benefits are shown as real applications rather than descriptions.

| Criterion | Where | What changed |
|---|---|---|
| Creativity + whole approach | `#/how` (new) | Six-step stepper on real data: satellites → hot pixels (to-scale illustration) → one scale (raw vs harmonized) → the six instruments tested for kilns → calendars → people act |
| Relevance | `#/how`, last section | Table: each challenge requirement → what Kiln Watch does → link to it working |
| Impact | `#/impact/:who?/:unitId?` (rewritten) | Person × district playbook: their question → what the data shows for that district (live) → dated actions → benefit, a labelled outside fact, and the limit. Printable, shareable URL |
| Validity | `#/trust` (new) | Every pre-registered test in plain words with Passed / Failed / No link found, how we stayed honest, and `meta.non_claims`. **Does it work outside Bangladesh?** (Amendments 2–4): a country switch over each tested country's real monthly kiln-glow profile, its learned busy months, the four checks, and first test vs retest |

Home adds the six-step chain, "What people do with it" (question → live answer → action cards linking to playbooks), and "Four questions judges ask". Nav: `How it works · My area · Kiln planner · Who benefits · Can you trust it? · For experts`; Sensor switch and Timeline are linked from the pages.
