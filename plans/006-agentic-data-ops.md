# Plan 006: Agentic data-ops — twice-weekly FIRMS cross-check cron, deploy-failure triage issues, one-command release

> **Executor instructions**: Follow this plan step by step; verify each step
> before moving on. Step 0 is a DECISION GATE. STOP conditions halt the
> plan. Update `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat 98fa82a..HEAD -- kilnwatch/verify_firms.py kilnwatch/__main__.py kilnwatch/export.py kilnwatch/fixtures.py .github/workflows/ docs/operations.md`
> Plan 004 adds an ask-cache step and an `ask` artifact to `deploy.yml` —
> expected drift. The excerpts below quote only parts 004 does not touch; a
> mismatch there is a STOP condition.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: LOW-MED (new scheduled jobs; read-only or issue-writing; none touch the data pipeline)
- **Depends on**: none (independent of Plan 004)
- **Category**: direction / dx
- **Planned at**: commit `98fa82a`, 2026-10-12 (first written 2026-10-11; reviewed and corrected against live code)

## Why this matters

The project's honesty checks run only when someone remembers. `verify-firms`
— an independent FIRMS re-fetch compared with the committed export and a
published Bangladesh reference — is "not part of `all`, not a test, not in
CI" (`kilnwatch/verify_firms.py` docstring), so nobody reruns it. When the
daily 03:00 UTC deploy fails, only someone reading the Actions tab notices.
And a full data release is a manual sequence (`docs/operations.md`
"Publishing the real data"). This plan adds a twice-weekly cross-check that files
an issue on real drift, one deduplicated issue per deploy outage, and
`python -m kilnwatch release` as one command.

## Current state

- `kilnwatch/verify_firms.py`:
  - `run(sources=None, start=None, end=None, cached_only=False) -> dict`
    (lines 141–157) downloads into `VERIFY_ROOT = C.RAW / "verify" / "firms"`
    (gitignored, `data/raw/`), analyses, writes
    `reports/firms_verification.json` and `.md`, and **returns normally even
    when the numbers disagree** — it has no pass/fail verdict. It raises
    `SystemExit` only for a missing `FIRMS_MAP_KEY`, or for `--cached-only`
    with an empty cache.
  - The JSON's comparison fields (values from the committed report, all
    sources, full history):
    `reference.spearman` = 0.908 (S-NPP annual fire-days vs the published
    reference, n = 14); `shape_vs_committed.N.spearman_vs_committed` = 0.839
    and `shape_vs_committed.A.spearman_vs_committed` = 0.818 (n = 15 seasons).
    Each is `None` when fewer than 3 pairs exist.
  - `actions/cache` (combined) saves only when the job succeeds; its
    `restore` and `save` sub-actions (same pinned SHA) let the save run
    `if: always()`. GitHub evicts caches not accessed for 7 days.
  - Downloads go through `ingest.backfill`, which caches per 5-day window:
    a rerun with the cache present fetches only new windows. Without a cache
    it pulls every window since each source's start (2000/2003 for MODIS,
    2012 for S-NPP) under a 5000-requests-per-10-minutes quota.
- CLI (`kilnwatch/__main__.py:54-58`): `verify-firms --sources ID ...
  --start --end --cached-only`. Source ids (`kilnwatch/ingest.py:25-29`):
  `MODIS_SP MODIS_NRT VIIRS_SNPP_SP VIIRS_SNPP_NRT VIIRS_NOAA20_SP VIIRS_NOAA20_NRT VIIRS_NOAA21_NRT`.
  The comparisons use sensors N (S-NPP) and A (Aqua, from MODIS) only.
- `kilnwatch/export.py` `run(regulator=False, fixtures=False, check_public=None, publish_=False)`
  (line 266): `fixtures=True` calls `kilnwatch.fixtures.write_fixtures()`.
  `publish()` builds `public-data.tar.gz` **at the repo root**, uploads it to
  the `data-current` and `data-<sha>` GitHub Releases, then deletes it.
  `kilnwatch/fixtures.py:48` reads the verbatim real copy from
  **`data/releases/public-data.tar.gz`** — a different path — so running
  fixtures right after publish would NOT use the fresh release. Worse,
  `fixtures._real_release_dir()` (lines 52–70) extracts that tarball into
  `data/releases/public/` **only if `data/releases/public/meta.json` does not
  already exist** — a stale extraction is silently reused even after a new
  tarball is downloaded. (On the maintainer's machine that folder exists now.)
- `.github/workflows/deploy.yml`: jobs `nrt` (lines 8–29;
  `permissions: { contents: read }`, holds `FIRMS_MAP_KEY`) and `deploy`
  (lines 30–56; `needs: nrt`; Pages permissions). Conventions: every
  `uses:` pinned to a 40-char SHA with a `# vX.Y.Z` comment — checkout
  `08eba0b27e820071cde6df949e0beb9ba4906955  # v4.3.0`, setup-python
  `a26af69be951a213d495a4c3e4e4022e16d87065  # v5.6.0`, cache
  `0057852bfaa89a56745cba8c7296529d2fc39830  # v4.3.0` (also for `actions/cache/restore` and `actions/cache/save`), upload-artifact
  `ea165f8d65b6e75b540449e92b4886f43607fa02  # v4.6.2`; permissions are job-scoped.
- CLAUDE.md invariant 3: no kiln ids or coordinates in public artifacts —
  issue bodies are public, so they carry links only, no data.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Lint | `python -m ruff check .` | "All checks passed!" |
| Tests | `python -m pytest -q` | all pass |
| YAML | `uv run --no-project -q --with pyyaml python -c "import yaml; [yaml.safe_load(open(f)) for f in ['.github/workflows/ci.yml','.github/workflows/deploy.yml','.github/workflows/verify.yml']]; print('ok')"` | `ok` |
| Shell lint (if installed) | `shellcheck -s bash <(yq '.jobs[].steps[].run' .github/workflows/verify.yml)` | no errors (skip if tools absent) |
| CLI | `python -m kilnwatch release --help` | usage text (after Step 4) |

## Scope

**In scope**:
- `.github/workflows/verify.yml` (create)
- `.github/workflows/deploy.yml` (one new `notify` job only)
- `kilnwatch/__main__.py` (one subcommand)
- `tests/test_main.py` (one test)
- `docs/operations.md`

**Out of scope**:
- `kilnwatch/verify_firms.py`, `kilnwatch/export.py`, `kilnwatch/fixtures.py`
- The existing `nrt` and `deploy` jobs' steps and permissions; `ci.yml`
- Zenodo/DOI automation (a team decision)

## Git workflow

- Branch `plan-006-data-ops`; commits `ops: <...>` / `feat(cli): release`.
- No push/PR unless instructed.

## Steps

### Step 0: DECISION GATE — what counts as drift (team)

The scheduled job needs a pass/fail rule; `verify_firms` has none, and picking
one is a scientific decision, not a code one. Ask the operator to confirm or
change this proposal and record the answer in `docs/operations.md` (Step 5):

> **Drift** = any of `reference.spearman`,
> `shape_vs_committed.N.spearman_vs_committed`,
> `shape_vs_committed.A.spearman_vs_committed` is below **0.75**, or is
> `null` (too few pairs to judge). Current values: 0.908 / 0.839 / 0.818.

If unanswered, implement Steps 1, 3, 4 and 5 and leave Step 2's gate
threshold as the proposal with a `# PROPOSED, not yet approved` comment,
and say so in the PR.

### Step 1: `verify.yml` — twice-weekly cross-check with a persistent cache

Create `.github/workflows/verify.yml`:

```yaml
name: verify
on:
  schedule: [{ cron: '30 6 * * 0,3' }]   # Sundays and Wednesdays 06:30 UTC: GitHub evicts caches unused for 7 days
  workflow_dispatch:
permissions: { contents: read }
jobs:
  firms:
    runs-on: ubuntu-latest
    timeout-minutes: 300  # the first, uncached run pulls the full history; later runs fetch one week
    env:
      FIRMS_MAP_KEY: ${{ secrets.FIRMS_MAP_KEY }}
    steps:
      - uses: actions/checkout@08eba0b27e820071cde6df949e0beb9ba4906955  # v4.3.0
      - uses: actions/setup-python@a26af69be951a213d495a4c3e4e4022e16d87065  # v5.6.0
        with: { python-version: '3.11', cache: pip }
      - run: pip install -r requirements.txt -c constraints.txt
      # restore and save separately: the combined actions/cache only saves when the whole job succeeds,
      # so one drift or failed fetch would throw away hours of downloaded windows
      - uses: actions/cache/restore@0057852bfaa89a56745cba8c7296529d2fc39830  # v4.3.0
        with:
          path: data/raw/verify/firms
          key: firms-verify-${{ github.run_id }}
          restore-keys: firms-verify-
      - name: Independent FIRMS re-fetch and cross-check (sensors N and A only)
        run: python -m kilnwatch verify-firms --sources MODIS_SP MODIS_NRT VIIRS_SNPP_SP VIIRS_SNPP_NRT
      - uses: actions/cache/save@0057852bfaa89a56745cba8c7296529d2fc39830  # v4.3.0
        if: always()
        with:
          path: data/raw/verify/firms
          key: firms-verify-${{ github.run_id }}
      - name: Upload the verification report
        if: always()
        uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02  # v4.6.2
        with: { name: firms-verification, path: 'reports/firms_verification.*' }
```

**Verify**: the YAML command → `ok`.

### Step 2: The drift gate and a deduplicated issue

Append to the `firms` job (after the upload, so the report is kept either way):

```yaml
      - name: Drift gate (rule recorded in docs/operations.md)
        run: |
          python - <<'EOF'
          import json, sys
          r = json.load(open("reports/firms_verification.json"))
          vals = {"reference": r["reference"]["spearman"],
                  "S-NPP vs committed": r["shape_vs_committed"]["N"]["spearman_vs_committed"],
                  "Aqua vs committed": r["shape_vs_committed"]["A"]["spearman_vs_committed"]}
          bad = {k: v for k, v in vals.items() if v is None or not v >= 0.75}  # NaN fails too (nan < 0.75 is False)
          print(vals)
          sys.exit(f"drift: {bad}" if bad else 0)
          EOF
  drift-issue:
    needs: firms
    if: failure()
    runs-on: ubuntu-latest
    permissions: { issues: write }  # only this job can write issues; it never sees the FIRMS key
    env: { GH_TOKEN: '${{ github.token }}', GH_REPO: '${{ github.repository }}' }
    steps:
      - run: |
          run_url="${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}"
          num=$(gh issue list --state open --search 'in:title "FIRMS cross-check drift"' --json number --jq '.[0].number // empty')
          if [ -z "$num" ]; then
            gh issue create --title "FIRMS cross-check drift ($(date -u +%F))" \
              --body "The scheduled independent FIRMS cross-check failed (drift or a failed fetch). Report artifact and log: $run_url. Follow docs/BLOCKERS.md."
          else
            gh issue comment "$num" --body "Failed again: $run_url"
          fi
```

Notes: `drift-issue` fires when the `firms` job fails for any reason (a
fetch failure is worth an issue too). `$num` is the issue **number** from
`.[0].number // empty` — empty when none is open (without `// empty`, jq
would print the string `null` and the "create" branch would never run) —
and never a count. The body has a link
only — no data (invariant 3). No checkout is needed because `GH_REPO` is set.

**Verify**: the YAML command → `ok`;
`grep -c "FIRMS cross-check drift" .github/workflows/verify.yml` → `2`;
`grep -n "issues: write" .github/workflows/verify.yml` → 1 line, in `drift-issue`.

### Step 3: Deploy-failure triage in `deploy.yml` — a separate job

Do NOT change the `nrt` or `deploy` jobs' permissions. Add a third job:

```yaml
  notify:
    needs: [nrt, deploy]
    if: failure()
    runs-on: ubuntu-latest
    permissions: { issues: write }  # the only job with issue rights; it holds no data secrets
    env: { GH_TOKEN: '${{ github.token }}', GH_REPO: '${{ github.repository }}' }
    steps:
      - run: |
          run_url="${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}"
          num=$(gh issue list --state open --search 'in:title "Daily deploy failed"' --json number --jq '.[0].number // empty')
          if [ -z "$num" ]; then
            gh issue create --title "Daily deploy failed ($(date -u +%F))" \
              --body "The daily NRT update or Pages deploy failed; the last good deployment stays live. Run: $run_url. Follow docs/BLOCKERS.md; close this issue when a green deploy lands."
          else
            gh issue comment "$num" --body "Failed again: $run_url"
          fi
```

This catches a failure in either job (the old design only watched `nrt`).

**Verify**: the YAML command → `ok`;
`grep -n "issues: write" .github/workflows/deploy.yml` → 1 line, in `notify`;
`grep -n "pages: write" .github/workflows/deploy.yml` → still 1 line (unchanged).

### Step 4: `python -m kilnwatch release`

In `kilnwatch/__main__.py`, register next to the other parsers:

```python
sub.add_parser("release", help="publish the real export (safety checks, tarball, research zip, GitHub Releases), then rebuild fixtures from it")
```

and the handler (an `elif a.stage == "release":` branch):

```python
from . import export
export.run(publish_=True)   # safety checks first; raises on any failure
# publish() deletes its root-level tarball; fixtures read data/releases/, so fetch the release just made
subprocess.run(["gh", "release", "download", "data-current", "--pattern", "public-data.tar.gz",
                "--dir", str(C.ROOT / "data" / "releases"), "--clobber"], check=True)
# fixtures.py reuses data/releases/public/ whenever its meta.json exists: drop the stale extraction first
shutil.rmtree(C.ROOT / "data" / "releases" / "public", ignore_errors=True)
export.run(fixtures=True)
print("release done: data-current updated and fixtures rebuilt from it. A DOI stays a team decision.")
```

(`__main__.py` imports only `argparse`, `logging`, `sys`, `Path` today — add
`import shutil` and `import subprocess` at the top.) Add to `tests/test_main.py` a test in the
style of `test_export_dispatch_passes_every_flag` (line 26, which does
`monkeypatch.setattr(export, "run", ...)`): record calls from a patched
`kilnwatch.export.run` (as `("export", kwargs)`) and a patched
`subprocess.run` (as `("gh", argv[:3])`) and a patched `shutil.rmtree`
(as `("rmtree", path.name)`) into one list, call `main(["release"])`, and
assert the list equals
`[("export", {"publish_": True}), ("gh", ["gh", "release", "download"]), ("rmtree", "public"), ("export", {"fixtures": True})]`.

**Verify**: `python -m kilnwatch release --help` → usage; `python -m pytest tests/test_main.py -q` → pass; `python -m ruff check .` → clean.

### Step 5: Docs

`docs/operations.md`: add a "Self-tending checks" subsection after "Daily
deploy": the twice-weekly `verify.yml` (Sundays and Wednesdays 06:30 UTC, cached, sensors N and
A), **the drift rule from Step 0 (with who approved it, or "proposed")**,
the two deduplicated issue types, and `python -m kilnwatch release` as the
one-command form of "Publishing the real data" (refer to that section's
safety description; do not repeat it).

**Verify**: `grep -c "verify.yml\|kilnwatch release" docs/operations.md` → at least `2`;
`grep -c "0.75" docs/operations.md` → at least `1`.

## Test plan

- `tests/test_main.py`: release call order (closed-form recorded list).
- Workflows: YAML parses; every new `uses:` pinned; issue rights only in
  `drift-issue` and `notify`; the cache is saved with `if: always()`; shell
  checked with shellcheck if available.
- After merge (operator): dispatch `verify` once manually — the first run
  fills the cache (can take hours); a second dispatch should finish in
  minutes.

## Done criteria

- [ ] `python -m ruff check .` clean; `python -m pytest -q` passes, including the release-order test
- [ ] All three workflow files parse; no unpinned `uses:`; `issues: write` appears only in `drift-issue` and `notify`
- [ ] `grep -n "spearman" .github/workflows/verify.yml` shows the gate; the threshold matches `docs/operations.md`
- [ ] Issue bodies carry no data: `grep -h -- "--body" .github/workflows/*.yml | grep -cE "[0-9]{2,}"` → `0` (no numbers; only links and protocol pointers)
- [ ] `grep -c "actions/cache/save@" .github/workflows/verify.yml` → `1` and the line after it reads `if: always()`
- [ ] `docs/operations.md` documents all three additions and the drift rule
- [ ] `plans/README.md` row updated

## STOP conditions

- `reports/firms_verification.json` field names differ from Current state
  (the gate would read wrong keys) — report the actual structure.
- `export.run` cannot be called twice in one process — report; `release`
  may need to shell out per stage.
- Any step would need new permissions on the existing `nrt` or `deploy` jobs.

## Maintenance notes

- The 0.75 rule is a judgement on rank agreement; if a future amendment
  changes the comparison, update the gate and `docs/operations.md` together.
- If the scheduled fetch becomes too slow or quota-hungry, add `--start` (e.g.
  the last 2 seasons) — but fewer than 3 pairs makes a comparison `null`,
  which the gate treats as drift.
- Plan 005's worker could add a health-check job to `verify.yml` later.
