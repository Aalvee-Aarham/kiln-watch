# Plan 006: Agentic data-ops — weekly FIRMS cross-check cron, NRT failure triage issues, one-command release

> **Executor instructions**: Follow this plan step by step; verify each step
> before moving on. STOP conditions halt the plan. Update
> `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat c053cfa..HEAD -- kilnwatch/verify_firms.py kilnwatch/__main__.py .github/workflows/`
> Mismatch with the excerpts below = STOP condition. Plan 004 touches
> `deploy.yml` (ask-cache step) — that change is expected drift; the
> excerpts here quote only the parts 004 does not touch.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: LOW-MED (new scheduled jobs; all read-only or issue-writing,
  none touch the data pipeline itself)
- **Depends on**: Plan 004 (the release command sequences through the same
  publish hook; can land before 004 only if Step 4 is adjusted)
- **Category**: direction / dx
- **Planned at**: commit `c053cfa`, 2026-10-11

## Why this matters

The project's honesty infrastructure runs manually when it could run
itself. `verify-firms` — the independent FIRMS re-fetch cross-check — is a
finished stage that "not part of `all`, not a test, not in CI"
(`verify_firms.py` docstring), so nobody reruns it. When the daily NRT
deploy fails at 03:00 UTC, the failure is visible only to whoever reads the
Actions tab; the repo's own protocol (`docs/BLOCKERS.md`) exists but
nothing opens a blocker. And a full data release is a four-command ritual
documented in `docs/operations.md:39`. This plan makes the repo tend to
itself: a weekly verification cron that files an issue on drift, NRT
failures that auto-file a deduplicated triage issue, and `python -m
kilnwatch release` as one command.

## Current state

- `kilnwatch/verify_firms.py` — stage `verify-firms` (CLI at
  `kilnwatch/__main__.py:54-58, 118-120`): flags `--sources`, `--start`,
  `--end`, `--cached-only`. Re-fetches FIRMS for the analysis box,
  recomputes annual counts and `fire_days`, compares against the committed
  real export and a published Bangladesh reference
  (`tests/fixtures/firms_bd_reference.csv`), writes
  `reports/firms_verification.md` + `.json`. Area-level totals only.
- `.github/workflows/deploy.yml` `nrt` job (lines 8–29): env has
  `GH_TOKEN: ${{ github.token }}` and `FIRMS_MAP_KEY`; permissions
  `contents: read` (line 10). Runs daily at 03:00 UTC.
- Workflow conventions: every `uses:` is pinned by full 40-char SHA
  (checkout `08eba0b…`, setup-python `a26af69…`, cache `0057852…`,
  upload-artifact `ea165f8…`, download-artifact `d3f86a1…`); permissions
  are job-scoped; comments explain why.
- Release flow today (`docs/operations.md:39`):
  `python -m kilnwatch export --publish` runs safety checks, packages the
  tarball, builds the research zip, uploads to `data-current` + immutable
  `data-<sha>` releases; fixtures come from
  `python -m kilnwatch export --fixtures`; Plan 004 adds the ask-cache
  rebuild inside `publish()`.
- `gh` CLI is available in Actions runners and already used in deploy.yml
  (`gh release download`).
- CLAUDE.md invariant 3: no kiln ids/coords in any public artifact — issue
  bodies are public; they must carry area-level summary only.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Lint | `python -m ruff check .` | clean |
| Tests | `python -m pytest -q` | all pass |
| YAML | `python -c "import yaml; [yaml.safe_load(open(f)) for f in ['.github/workflows/ci.yml','.github/workflows/deploy.yml','.github/workflows/verify.yml']]; print('ok')"` | ok |
| CLI help | `python -m kilnwatch release --help` | usage text (after Step 4) |

## Scope

**In scope**:
- `.github/workflows/verify.yml` (create)
- `.github/workflows/deploy.yml` (nrt job: permissions + one failure step)
- `kilnwatch/__main__.py` (one subcommand)
- `docs/operations.md` (mirror the new automation)

**Out of scope**:
- `kilnwatch/verify_firms.py` logic, `kilnwatch/export.py` (Plan 004 owns
  the publish hook)
- `ci.yml`, the deploy job, any web file
- Zenodo/DOI automation (explicitly a human decision, operations.md:39).

## Git workflow

- Branch `plan-006-data-ops`; commits `ops: <...>` / `feat(cli): release`.
- No push/PR unless instructed.

## Steps

### Step 1: `verify.yml` — weekly FIRMS cross-check

Create `.github/workflows/verify.yml`:

```yaml
name: verify
on:
  schedule: [{ cron: '30 6 * * 0' }]   # Sundays 06:30 UTC, after the week's last NRT deploy
  workflow_dispatch:
jobs:
  firms:
    runs-on: ubuntu-latest
    permissions: { contents: read, issues: write }
    env:
      FIRMS_MAP_KEY: ${{ secrets.FIRMS_MAP_KEY }}
      GH_TOKEN: ${{ github.token }}
    steps:
      - uses: actions/checkout@08eba0b27e820071cde6df949e0beb9ba4906955  # v4.3.0
      - uses: actions/setup-python@a26af69be951a213d495a4c3e4e4022e16d87065  # v5.6.0
        with: { python-version: '3.11', cache: pip }
      - run: pip install -r requirements.txt -c constraints.txt
      - name: Independent FIRMS re-fetch and cross-check
        run: python -m kilnwatch verify-firms
      - name: Upload the verification report
        if: always()
        uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02  # v4.6.2
        with: { name: firms-verification, path: reports/firms_verification.* }
```

Note: `verify-firms` exits non-zero when a check fails? Read
`verify_firms.py`'s `run()` end — if it always exits 0 while writing a
verdict into the report, add a final step that greps the JSON verdict and
fails the job on it; if it raises on failure, the step above suffices.
State which case applies in the PR description.

**Verify**: YAML parses (command above); manual
`workflow_dispatch` cannot be tested here — that is the operator's smoke
test after merge.

### Step 2: Auto-file a deduplicated issue on verification failure

Append to the `firms` job:

```yaml
      - name: Open or update a drift issue
        if: failure()
        run: |
          n=$(gh issue list --search 'in:title "FIRMS cross-check drift" --state open --json number --jq length)
          if [ "$n" = "0" ]; then
            gh issue create --title "FIRMS cross-check drift ($(date -u +%F))" \
              --body "The weekly independent FIRMS re-fetch disagreed with the committed export. Report artifact: ${{ github.event.repository.html_url }}/actions/runs/${{ github.run_id }}. Area-level summary only; see the run log for numbers. Protocol: docs/BLOCKERS.md."
          fi
```

The body deliberately carries no numbers (invariant 3 + issue bodies are
public) — only the pointer to the run.

**Verify**: `grep -c "FIRMS cross-check drift" .github/workflows/verify.yml` → 1.

### Step 3: NRT failure triage in `deploy.yml`

In the `nrt` job: extend permissions to `{ contents: read, issues: write }`
(update the comment on line 10 to say why), and add:

```yaml
      - name: File deploy-failure issue
        if: failure()
        run: |
          n=$(gh issue list --search 'in:title "NRT deploy failed" --state open --json number --jq length)
          if [ "$n" = "0" ]; then
            gh issue create --title "NRT deploy failed ($(date -u +%F))" \
              --body "Daily NRT/deploy job failed; the last good Pages deployment stays live. Run: ${{ github.event.repository.html_url }}/actions/runs/${{ github.run_id }}. Follow docs/BLOCKERS.md; close this issue when a green deploy lands."
          else
            gh issue comment "$n" --body "Failed again: ${{ github.event.repository.html_url }}/actions/runs/${{ github.run_id }}"
          fi
```

The dedupe means one rolling issue per outage, commented on repeat
failures, closed by a human after a green deploy.

**Verify**: YAML parses; `grep -n "issues: write" .github/workflows/deploy.yml` → 1 (nrt job only; deploy job unchanged).

### Step 4: `python -m kilnwatch release` — one command

In `kilnwatch/__main__.py`, add a subcommand (mirror the existing style at
lines 42-51):

```python
sub.add_parser("release", help="full public release: export --publish (safety checks, tarball, research zip, ask cache) then refresh fixtures")
```

Handler:

```python
elif a.stage == "release":
    from . import export
    export.run(publish_=True)                 # safety checks first; raises on any failure
    export.run(fixtures=True)                 # rebuild the verbatim offline fixtures from the fresh tarball
    print("release done: data-current updated, fixtures refreshed. Human steps remaining: none automated beyond this point (DOI is a team decision).")
```

Check `export.run`'s signature (`kilnwatch/export.py:266`) and call it
exactly as the flags are parsed elsewhere (`--publish` maps to
`publish_=True` — confirm at `__main__.py:103`). If `run(fixtures=True)`
does not consume the just-written tarball (read `export.py`'s fixtures
path logic; it falls back to synthetic when the tarball is absent), state
the behaviour you found in the PR description rather than changing it.

**Verify**: `python -m kilnwatch release --help` → usage; `python -m ruff check .` → clean.

### Step 5: Docs mirror

`docs/operations.md`: add a "Self-tending checks" subsection under the
daily-deploy section: the weekly verify cron (Sundays 06:30 UTC), the
auto-filed issues (drift + NRT failure, deduplicated), and `kilnwatch
release` as the one-command form of the publish ritual (replacing none of
the existing safety description — reference it).

**Verify**: `grep -c "verify.yml\|kilnwatch release" docs/operations.md` ≥ 2.

## Test plan

- Workflows: YAML parse checks (above) + eyeball against the pinned-SHA /
  job-scoped-permission conventions (no new unpinned `uses:`).
- CLI: `python -m kilnwatch release --help` (no pytest for argparse wiring
  beyond existing patterns; the heavy path is `export.run`, already
  covered by export tests). If `tests/test_main.py` has a smoke-test
  pattern for subcommands (it does — `_gee_cache_ready` extraction came
  from it), add one `release` smoke: `main(["release"])` with
  `export.run` monkeypatched to record calls — asserts ordering
  (publish before fixtures). Closed-form: assert the recorded call list.

## Done criteria

- [ ] `python -m pytest -q` green; `python -m ruff check .` clean
- [ ] `python -m kilnwatch release --help` prints usage; smoke test asserts call order
- [ ] All three workflow YAMLs parse; no unpinned actions; permissions job-scoped
- [ ] Issue bodies contain no data numbers (grep the workflow for `--body` — only URLs and protocol pointers)
- [ ] `docs/operations.md` documents all three additions
- [ ] `plans/README.md` row updated

## STOP conditions

- `verify_firms.run()` has no machine-readable verdict (neither exit code
  nor JSON field) to gate Step 2's `if: failure()` — report what exists;
  do not rewrite verify_firms to suit the workflow.
- `export.run` cannot be called twice in one process (state issues) —
  report; the release command may need two CLI invocations instead.
- Any step would require widening the `deploy` job's permissions.

## Maintenance notes

- After merge, the operator should manually dispatch `verify` once to
  smoke-test the issue path (then close the test issue).
- If the weekly FIRMS fetch proves too slow/quota-hungry, add
  `--cached-only` to the cron step — a data decision, not a code one.
- Plan 005's worker is deliberately absent from CI here; if it lands, a
  health-check ping could join verify.yml.
