# Plan 007: S-NPP → NOAA-20 switch rehearsal — refined as-built

> Refinement of `plans/007-noaa20-switch-rehearsal.md`, verified against HEAD
> `2f0b5eb` on 2026-10-21. The rehearsal shipped; the **real switch is now
> 12 days away** (S-NPP's last data day is 2 Nov 2026) — this file's main
> job is the live-event checklist.

## Status

- **DONE** — commit `1e4316d` ("fix(nrt): rehearse the 2 Nov S-NPP ->
  NOAA-20 switch, show which satellite is live").

## What shipped (verified 2026-10-21)

- `kilnwatch/nrt.py` — `SNPP_END = date(2026, 11, 2)` (line 17);
  `era_of(today)` returns `"N"` through 2 Nov, `"J1"` after (line 24);
  `sources_for` drops `VIIRS_SNPP_NRT` after the cutover (line 29);
  `era_beta_weights` chains `A<-N<-J1` (w = b1 × b2) in the J1 era
  (lines 32–34). `run` is clock-injectable, so the switch is rehearsed in
  tests on both sides of the date.
- The daily output carries the era/sensor fields and
  `beta_imputed_frac`, and the page states which satellite the live numbers
  come from.
- Rehearsal results on the committed models (recorded in `plans/README.md`
  when the plan was written): NOAA-20 rows counted, S-NPP rows ignored,
  0.0 imputed (every `A<-N` stratum has an `N<-J1` beta), series length 133
  on 10 Nov.

## Verify today

```bash
python -m pytest tests/test_nrt.py -q    # era/switch tests, in the 204
```

## Follow-ups — the live event (3 Nov onward)

- [ ] After 2 Nov, the first live `J1`-era deploy must be watched: if the
      daily job fails, Plan 006's `notify` job files a "Daily deploy failed"
      issue — treat it as the primary signal, not the Actions tab.
- [ ] Confirm the page's satellite label flips to NOAA-20 on the live site.
- [ ] Sanity-check `beta_imputed_frac` stays ~0 in the first J1-era outputs
      (the rehearsal says it should; a nonzero value means a stratum is
      missing its `N<-J1` beta).

## Maintenance notes

- The same pattern replays for NOAA-21 (`VIIRS_NOAA21_NRT` is already an
  ingest source) — inject the clock again rather than waiting for the date.
