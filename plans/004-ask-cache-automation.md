# Plan 004: Rebuild the ask.json answer cache automatically (publish + daily deploy)

> **Executor instructions**: Follow this plan step by step; verify each step
> before moving on. STOP conditions halt the plan. Update
> `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat c053cfa..HEAD -- kilnwatch/export.py kilnwatch/__main__.py .github/workflows/deploy.yml docs/operations.md`
> Mismatch with the excerpts below = STOP condition.

## Status

- **Priority**: P2
- **Effort**: S-M
- **Risk**: LOW (degrades gracefully; a missing key never blocks a deploy)
- **Depends on**: none (Plan 003's new demo questions make it more valuable,
  but it works independently)
- **Category**: bug / ops
- **Planned at**: commit `c053cfa`, 2026-10-11

## Why this matters

`ask.json` — the cached demo answers on `#/ask`, including "is this year
unusual *so far*?" — is rebuilt only when a human runs
`python -m kilnwatch ask --build-cache`. The daily 03:00 UTC deploy
refreshes only the `nrt/` slice, so the deployed answers freeze at whatever
the last `export --publish` captured. The page does label them "Saved
answers, not live", but a weeks-stale "so far" answer on demo day undercuts
the product's field-ready honesty. Fix: rebuild the cache inside the two
places data already flows — `export --publish` (releases) and the daily
deploy (freshness) — with the LLM key treated as optional everywhere.

## Current state

- `kilnwatch/export.py` — `publish()` at line 203: runs the safety checks,
  packages `web/public/data/` (excluding `nrt/`) into `public-data.tar.gz`,
  builds the research zip, uploads both to the `data-current` GitHub
  Release, then tags an immutable `data-<sha>` release (documented in
  `docs/operations.md:39`). It currently never touches `ask.json`.
- `kilnwatch/ask.py` — `build_cache(src, client=None, out=None)` (line 233)
  answers the `DEMO_QUESTIONS` and writes `<src>/ask.json` atomically via
  `dump_json`. Needs `ANTHROPIC_API_KEY` (via `anthropic.Anthropic()`
  default client). `ask.py` imports `export.dump_json` lazily inside the
  function (line 235) — so `export` must import `ask` lazily too (inside
  `publish()`), never at module top, or you create an import cycle.
- `.github/workflows/deploy.yml` — the `nrt` job (lines 8–29):
  downloads the `data-current` tarball into `web/public/data`, restores the
  `data/nrt` cache, `python -m kilnwatch nrt`, `pytest -q`, uploads the
  `web/public/data/nrt/` artifact. Its env block (lines 11–13) sets
  `GH_TOKEN` and `FIRMS_MAP_KEY` only.
- `.env.example:7-8` — `ANTHROPIC_API_KEY` is documented **Optional**,
  "only for `python -m kilnwatch ask` / `ask --build-cache`".
- Convention (CLAUDE.md): writes atomic (build_cache already is); ops docs
  stay in sync with workflows (`docs/operations.md` is the mirror of
  deploy.yml — CI reviewer checks this).

## Commands you will need

| Purpose | Command (repo root) | Expected |
|---|---|---|
| Install | `pip install -r requirements.txt -c constraints.txt` | exit 0 |
| Lint | `python -m ruff check .` | clean |
| Tests | `python -m pytest -q` | all pass |
| YAML sanity | `python -c "import yaml,sys; yaml.safe_load(open('.github/workflows/deploy.yml')); print('ok')"` | ok |

## Scope

**In scope**:
- `kilnwatch/export.py` (inside `publish()` only)
- `.github/workflows/deploy.yml` (nrt job)
- `tests/test_export.py` (one new test)
- `docs/operations.md` (two paragraphs)

**Out of scope**:
- `kilnwatch/ask.py` logic (only its call sites change)
- The `deploy` job, `ci.yml`, the Pages deployment steps
- Any web code (`ask.json` is consumed as-is).

## Git workflow

- Branch `plan-004-ask-cache-automation`; commits `ops(ask): <...>`.
- No push/PR unless instructed.

## Steps

### Step 1: Rebuild the cache inside `publish()` when a key exists

In `kilnwatch/export.py` `publish()`, immediately after the safety checks
pass and BEFORE the tarball is packaged (so releases carry fresh answers):

```python
import os
if os.environ.get("ANTHROPIC_API_KEY"):
    from . import ask
    ask.build_cache()          # writes web/public/data/ask.json atomically
else:
    print("WARNING no ANTHROPIC_API_KEY: ask.json not refreshed (page labels its build date)", file=sys.stderr)
```

Match the file's existing import/error style (check its header imports;
add `sys`/`os` only if missing). The lazy `from . import ask` inside the
function is mandatory (cycle prevention — see Current state).

**Verify**: `python -m ruff check .` → clean;
`python -m pytest tests/test_export.py -q` → green (new test in Step 3).

### Step 2: Daily refresh hook in `deploy.yml`

In the `nrt` job: add `ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}`
to the env block, and insert one step between `python -m kilnwatch nrt`
(line 26) and `pytest -q` (line 27):

```yaml
      - name: Refresh ask.json (optional; never blocks the data deploy)
        run: |
          if [ -n "$ANTHROPIC_API_KEY" ]; then
            python -m kilnwatch ask --build-cache --src web/public/data || echo "::warning::ask cache refresh failed; yesterday's answers stay"
          else
            echo "::warning::ANTHROPIC_API_KEY not set; ask.json not refreshed"
          fi
```

The `|| echo "::warning::"` makes an Anthropic outage a warning, not a
failed data deploy — deliberate, matches the "Optional" key contract.
Note `ask.json` is NOT under `web/public/data/nrt/`, so it is not caught by
the existing artifact upload; the `deploy` job rebuilds from the tarball +
artifact — so the fresh `ask.json` must ALSO be uploaded: extend the
existing `upload-artifact` step's `path:` to `web/public/data/nrt/` →
`web/public/data/` (nrt + ask.json), and the deploy job's matching
`download-artifact` step (line 43-44) `path:` likewise — the download
already lands in `web/public/data/nrt`; change it to `web/public/data` so
`ask.json` overlays the tarball copy. Check the artifact does not now
include other stale files: it will contain exactly `nrt/` + `ask.json`
because that is all the nrt job writes under `web/public/data`.

**Verify**: `python -c "import yaml; yaml.safe_load(open('.github/workflows/deploy.yml')); print('ok')"` → ok;
`grep -n "ANTHROPIC_API_KEY" .github/workflows/deploy.yml` → 2 hits (env + guard).

### Step 3: Test the graceful path

In `tests/test_export.py` add `test_publish_refreshes_ask_cache_only_with_key`:
monkeypatch `kilnwatch.export.publish`'s heavy collaborators is overkill —
instead monkeypatch `ask.build_cache` (patch
`kilnwatch.ask.build_cache`), call `export.publish()` with
`monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)` → build_cache NOT
called, no exception; with `monkeypatch.setenv("ANTHROPIC_API_KEY", "x")` →
called exactly once. To keep the test hermetic, also monkeypatch whatever
`publish()` calls after the cache step (read the function; it uploads via
`gh`/requests — patch at the boundary the existing export tests use;
pattern: see `tests/test_export.py`'s existing publish/check_budgets
tests for the established mock style). If existing tests don't mock
`publish()` at all, wrap the assertion as: `pytest.raises` NOT needed —
instead factor nothing; simply assert the call/no-call via the patched
function and let an env without `gh` fail AFTER the cache step only if the
key branch is wrong — if that proves impossible to test hermetically, test
the branch decision by extracting it into a tiny
`_ask_cache_hook(env: dict) -> bool` inside export.py and unit-test THAT
(closed-form), leaving `publish()` a one-line caller.

**Verify**: `python -m pytest tests/test_export.py -q` → green.

### Step 4: Docs

`docs/operations.md`: in "Daily deploy" (§ around line 32), add one
sentence after step 1's pytest mention: "When the `ANTHROPIC_API_KEY`
secret is set, the nrt job also refreshes `ask.json` (warning-only on
failure or absence)." In "Publishing the real data" (§ around line 39),
add: "`export --publish` rebuilds `ask.json` first when
`ANTHROPIC_API_KEY` is set, so releases ship fresh cached answers."

**Verify**: `grep -c "ask.json" docs/operations.md` ≥ 2.

## Test plan

Step 3; closed-form call/no-call assertions, no network, no key. Pattern:
existing `tests/test_export.py` mock style.

## Done criteria

- [ ] `python -m ruff check .` exits 0; `python -m pytest -q` all pass
- [ ] `grep -n "build_cache" kilnwatch/export.py` → 1 call site inside `publish()`
- [ ] deploy.yml parses; nrt job has the guarded step; artifact paths cover `ask.json`
- [ ] With no key set: `python -m kilnwatch export --publish` path prints the warning and does not raise (test asserts)
- [ ] `docs/operations.md` updated; `plans/README.md` row updated

## STOP conditions

- `publish()` structure differs materially from "Current state" (e.g. it
  already rebuilds the cache — then report and skip Step 1).
- The artifact path change in Step 2 would sweep in files beyond
  `nrt/` + `ask.json` (inspect what the nrt job writes under
  `web/public/data`; if more, keep the artifact as `nrt/` and add a second
  artifact for `ask.json` instead).
- `export` → `ask` import raises a cycle even with the lazy import.

## Maintenance notes

- The team must add `ANTHROPIC_API_KEY` as a GitHub repo secret for the
  daily refresh to actually run — that is a human step, not in this plan
  (roadmap.md line 20 lists key decisions as human decisions).
- Plan 005 (hosted worker) may eventually supersede the cache for "live"
  answers; the publish-time rebuild stays valuable for the offline site
  either way.
