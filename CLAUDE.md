# CLAUDE.md — agent operating rules

Living rules for coding agents. The build-time version is kept as a record in [docs/CLAUDE.md](docs/CLAUDE.md); documentation index: [docs/README.md](docs/README.md).

### Invariants — never violate
1. **Never modify `docs/PREREGISTRATION.md`.** Changes become dated amendments in `docs/PREREGISTRATION_AMENDMENTS.md`, written before the data they govern.
2. **Never weaken, skip or delete a test or a stage check to make something pass.** See *When blocked*.
3. **Never write kiln ids, cluster ids, candidate flags or kiln coordinates into anything under `web/`.** Public output is area- or country-level only.
4. **Never sign a row in `docs/VERIFICATION.md`.** Append the row; a person signs it.
5. **No test under `tests/` or `web/src/**` may read `data/raw` or `data/interim`.** Real-data checks are stage checks inside the pipeline.
6. **Every function taking a coordinate pair names its arguments `lat` and `lon`.**
7. **Every stochastic call is seeded** through `config.rng(stage)` (`SEED` + `SEED_OFFSETS`).
8. **Every test asserts a closed-form property, a pre-registered value or a published reference** — never current output.
9. **No unbounded loops.** Retries and sampling take explicit maxima.
10. **No grid literals in TypeScript.** `box.ts` reads `meta.grid`.

### Conventions
Units in names: `_m`, `_km`, `_frac` (0–1), `_pct` (0–100). Time: `t_utc` vs `t_local` (UTC+6); `date_local` groups days; seasons run 1 Jul – 30 Jun, labelled `"2018-19"`. Sensors `T`, `A`, `N`, `J1`, `J2`. Writes are atomic (`*.tmp`, then rename). Earth Engine returns fractions, never counts. Keys live in `.env`; never print or commit them.

### Commands
Pipeline stages and flags: [docs/pipeline.md](docs/pipeline.md). Tests: `pytest -q`; web: `cd web && npm run lint && npm run typecheck && npm test -- --run`.

### When blocked
If an automated check fails after three substantively different fixes, stop and append to `docs/BLOCKERS.md`: the step, the failing assertion, what was tried, and the smallest reproducing command. Do not change the test, the threshold or the pre-registration.
