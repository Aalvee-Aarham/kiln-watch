# Roadmap to the event (10 Oct → 13 Nov 2026)

**Branch:** `fire-calendar` · **Judging:** Impact, Creativity, Validity, Relevance, Presentation (1–20 each); Teamwork, UX, NASA data (1–5); category named, public repo, page submitted (0/1). Source: [resource/space-apps-2026-build-guide.html](resource/space-apps-2026-build-guide.html).

Each step is built and verified on its own (ruff, pytest, web lint/typecheck/Vitest, five fixture builds, Playwright). A step is done when its checks pass.

| Step | Goal | Done when |
|---|---|---|
| **F0** | Audit fixes: `all` past A6d, NRT fails on a bad FIRMS reply, deploy from `main` only, dead CLI flags, docs match code | Done (`1d51927`, `main`) |
| **F1** | **The fire calendar leads; kilns become an extension.** Home findings, the six steps and the nav lead with harmonization and the burning calendar; kilns keep one extension page that links to the abroad results. Sensor continuity: Suomi NPP ends 2 Nov 2026 ([NASA Earthdata](https://www.earthdata.nasa.gov/data/alerts-outages/content/data-alert-history/21880)); NOAA-20 carries the record; calendars keep a denominator when no NOAA-20 clear fraction exists; the NOAA-21 step is reported as not yet calibrated | Pages render with no console errors; a unit test covers the climatological denominator; README states the chain as it is |
| **F2** | **Research data release.** Harmonized area calendars, β table with intervals, data dictionary, CC BY 4.0, CSV + Parquet, versioned; no kiln-level data | `export` writes the bundle; both safety checks pass on it; a contract test covers its schema |
| **F3** | **Validation in the open.** Raw-vs-raw and harmonized-vs-harmonized MODIS/VIIRS agreement on the overlap years; a provenance line (dataset, file, build) behind each headline number | Numbers computed in the pipeline (tested), shown on Trust and Home |
| **F4** | **Unusual-fire warnings and a tested seasonal outlook.** Warnings from the existing p90 normals; any outlook is backtested against "a normal year" before it ships | Backtest skill reported; the outlook ships only if it beats climatology, else it is reported as a negative result |
| **F5** | **Impact page.** Who acts, on which output, when; cited Bangladesh figures; each section ends on a decision | Every number carries a source link |
| **F6** | **Map navigation.** Smooth zoom to an area, a NASA imagery layer cached for offline use, a time slider | Works with the network off |
| **F7** | **"Ask Kiln Watch".** The model explains results returned by the project's own functions; it never computes a number; answers to the demo questions cached for offline; `docs/AI_USE.md` | Every number in an answer traces to a tool result; offline demo works |
| — | Kiln and crop season *prediction* | Cut: highest validity risk; Black Marble VNP46A2 is a Suomi NPP product and needs the NOAA-20 equivalent first |

Decisions that need a person: the AI hosting and key (F7), a Zenodo DOI for the data release (F2), and signing the rows in [VERIFICATION.md](VERIFICATION.md).
