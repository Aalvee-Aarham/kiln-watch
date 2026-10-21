# Plan 006: Agentic data-ops — refined as-built

> Refinement of `plans/006-agentic-data-ops.md`, verified against HEAD
> `2f0b5eb` on 2026-10-21. All three features are live; one team decision
> (the drift threshold) is still marked PROPOSED inside the workflow itself.

## Status

- **DONE** — commit `95147d6` ("ops: scheduled FIRMS cross-check,
  deduplicated failure issues, `kilnwatch release`"), with review fixes in
  `fa5deee` (the drift gate now treats `NaN` as drift).

## What shipped (verified 2026-10-21)

- `.github/workflows/verify.yml` — twice-weekly cron (Sundays and
  Wednesdays 06:30 UTC, ahead of GitHub's 7-day cache eviction), FIRMS
  window cache via `actions/cache/restore` + `cache/save` with
  `if: always()`, report artifact, and the drift gate (lines 40–43):
  drift = any of the three Spearman values `None` or `< 0.75`
  (`# PROPOSED threshold, not yet approved; NaN fails too`), followed by the
  deduplicated `drift-issue` job (`issues: write` scoped to it alone).
- `.github/workflows/deploy.yml` — the `notify` job (line 71,
  `permissions: { issues: write }` at line 75) files one rolling
  "Daily deploy failed" issue covering failures in **either** `nrt` or
  `deploy`, deduplicated the same way; no other job gained permissions.
- `python -m kilnwatch release` — publish → `gh release download
  data-current` into `data/releases/` (publish deletes its root tarball;
  fixtures read `data/releases/`) → drop the stale `public/` extraction →
  rebuild fixtures. Order pinned by
  `tests/test_main.py::test_release_publishes_then_rebuilds_fixtures_from_the_fresh_release`
  (line 47), asserting the exact call sequence
  `[("export", {"publish_": True}), ("gh", …download…), ("rmtree", "public"), ("export", {"fixtures": True})]`.
- `docs/operations.md` — the "Self-tending checks" section documents all
  three additions and the 0.75 rule (`grep -c "0.75"` → 1).

## Deltas from the written plan

- The plan proposed a weekly cron; as built it is **twice-weekly**
  (Sun + Wed), matching the 7-day cache-eviction math recorded in the plan's
  own review pass. `plans/README.md`'s title row already reflects this.
- `fa5deee` hardened the gate against `NaN` correlations (the plan's
  `not v >= 0.75` alone passes `NaN`); the shipped comment says so.

## Verify today

```bash
python -m pytest tests/test_main.py -q
python -m kilnwatch release --help
uv run --no-project -q --with pyyaml python -c "import yaml; [yaml.safe_load(open(f)) for f in ['.github/workflows/verify.yml','.github/workflows/deploy.yml']]; print('ok')"
```

## Follow-ups

- **Approve or change the 0.75 rule** (team decision, before 13 Nov). It is
  live in `verify.yml:43` and `docs/operations.md`, both marked
  PROPOSED. Context for the decision: current committed values are
  0.908 / 0.839 / 0.818 — the Aqua side sits ~0.07 above the gate, so
  modest data revisions can trip it. That may be the gate working as
  intended, but the team should say so on the record.

## Maintenance notes

- If a future amendment changes the comparison, update the gate and
  `docs/operations.md` together.
- Issue bodies carry links only, no data (invariant 3) — kept by grep in the
  plan's done criteria.
