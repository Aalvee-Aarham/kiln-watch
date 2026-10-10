# CLAUDE.md — agent operating rules

Source: implementation_plan.md §16.

### Invariants — never violate
1. **Never modify `PREREGISTRATION.md` after its first commit.** Conflicts become dated amendments in a new file.
2. **Never weaken, skip or delete a test to make a step pass.** See *When blocked*.
3. **Never write kiln ids, cluster ids, candidate flags or kiln coordinates into anything under `web/`.**
4. **Never tick a VERIFY-H row.** Append the row; a human signs it.
5. **No test under `tests/` or `web/src/**` may read `data/raw`, `data/interim` or `data/raw/gee`.** Real-data checks are VERIFY-S, inside the stage.
6. **Every function taking a coordinate pair names its arguments `lat` and `lon`.** No bare coordinate tuples.
7. **Every stochastic call is seeded** from `config.SEED` via `SEED_OFFSETS`. No unseeded randomness — shuffles, samplers, bootstraps, splits, `random_state`.
8. **Every test asserts against a value in §10.1, a closed-form property, or a published reference.** Never against current output.
9. **No unbounded loops.** Rejection sampling and retries take explicit maxima.
10. **No grid literals in TypeScript.** `box.ts` reads `meta.grid`.

### Conventions
Units in names: `_m` metres, `_km` kilometres, `_frac` 0–1, `_pct` 0–100. Time: `t_utc` vs `t_local`, local = UTC+6, `date_local` is the grouping key, **seasons are 1 Jul – 30 Jun and labelled `"2018-19"`**. Sensors `T`, `A`, `N`, `J1`, `J2`. Writes are atomic (`*.tmp` then rename). GEE returns **fractions**, never counts.

### Commands
§7.1. `gee` runs before `all`; `all` fails fast without its cache.

### When blocked
> If an automated verification fails three times with substantively different fixes attempted, **STOP**. Append to `BLOCKERS.md`: the step, the failing assertion, what was tried, and the smallest reproducing command. Do not modify the test, the thresholds, the pre-registration or the Definition of Done. Move to the next independent step if one exists; otherwise halt and report.

### What not to build
Anything in the Could tier, and anything outside the current step.

### Project notes
- Python: `.venv\Scripts\python -m kilnwatch <stage>`; web: `cd web; npm run dev`.
- Knowledge graph of the docs + code lives in `graphify-out/` — query it with `graphify query "<question>"` before reading large files.
- Keys live in `.env` (gitignored). Never print or commit them.
