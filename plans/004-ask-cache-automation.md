# Plan 004: Rebuild the ask.json answer cache automatically (publish + daily deploy)

> **Executor instructions**: Follow this plan step by step; verify each step
> before moving on. STOP conditions halt the plan. Update
> `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat 98fa82a..HEAD -- kilnwatch/export.py .github/workflows/deploy.yml docs/operations.md tests/test_export.py`
> If any file changed, compare the excerpts below against the live code; a
> mismatch is a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S-M
- **Risk**: LOW (degrades gracefully; a missing key or an Anthropic outage never blocks a deploy)
- **Depends on**: none (Plan 003's extra demo questions make it more valuable, but it works independently)
- **Category**: bug / ops
- **Planned at**: commit `98fa82a`, 2026-10-12 (first written 2026-10-11; reviewed and corrected against live code)

## Why this matters

`ask.json` — the cached demo answers on `#/ask`, including "is this year
unusual *so far*?" — is rebuilt only when a person runs
`python -m kilnwatch ask --build-cache`. The daily 03:00 UTC deploy
refreshes only the `nrt/` slice, so the deployed answers freeze at whatever
the last `export --publish` captured. The page labels them with their build
date, but a weeks-stale "so far" answer on demo day undercuts the product's
honesty. Fix: rebuild the cache where data already flows — `export
--publish` (releases) and the daily deploy (freshness) — with the
Anthropic key optional everywhere.

## Current state

- `kilnwatch/export.py` — module logger `log = logging.getLogger("kilnwatch.export")`
  (line 17); imports at lines 2–15 include `json`, `logging`, `shutil`,
  `subprocess`, `tarfile`, `Path` (no `os`). `publish()` (lines 203–222):

  ```python
  def publish() -> None:
      check_public_dir(C.WEB_DATA)
      for f in C.WEB_DATA.rglob("*.json"):
          assert_public_safe(json.loads(f.read_text(encoding="utf-8")))
      tar = C.ROOT / "public-data.tar.gz"
      with tarfile.open(tar, "w:gz") as t:
          for p in C.WEB_DATA.rglob("*"):
              if p.is_file() and "nrt" not in p.relative_to(C.WEB_DATA).parts:
                  t.add(p, arcname=str(p.relative_to(C.WEB_DATA)))
      ...  # research zip, then `gh release` upload to data-current and an immutable data-<sha>
  ```
- `kilnwatch/ask.py` — `build_cache(src=C.WEB_DATA, client=None, out=None)`
  answers `DEMO_QUESTIONS` and writes `<src>/ask.json` atomically. With
  `client=None` it constructs `anthropic.Anthropic()`, which reads
  `ANTHROPIC_API_KEY`. `ask.py` imports `export.dump_json` lazily inside
  `build_cache`, so `export` must import `ask` lazily too (inside a
  function), never at module top — otherwise an import cycle.
- CLI: `python -m kilnwatch ask --build-cache --src DIR` exists
  (`kilnwatch/__main__.py:50-51`).
- `.github/workflows/deploy.yml` — `nrt` job (lines 8–29). Note line 20:
  **it extracts the entire `data-current` tarball into `web/public/data`**,
  so anything uploaded from `web/public/data/` as a whole would ship the full
  dataset as an artifact. Today it uploads only `web/public/data/nrt/`:

  ```yaml
    nrt:
      runs-on: ubuntu-latest
      permissions: { contents: read }  # this job fetches FIRMS with the map key; it never needs Pages rights
      env:
        GH_TOKEN: ${{ github.token }}
        FIRMS_MAP_KEY: ${{ secrets.FIRMS_MAP_KEY }}
      steps:
        ...
        - name: Download data-current (district normals)
          run: mkdir -p web/public/data && gh release download data-current -p public-data.tar.gz -O - | tar -xz -C web/public/data
        ...
        - run: python -m kilnwatch nrt                                  # line 26
        - run: pytest -q  # the full suite gates every deploy, ...      # line 27
        - uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02  # v4.6.2
          with: { name: nrt, path: web/public/data/nrt/ }               # lines 28-29
  ```
  `deploy` job (lines 30–56) re-extracts the tarball (line 42) and
  downloads the `nrt` artifact (lines 43–44):
  ```yaml
        - uses: actions/download-artifact@d3f86a106a0bac45b974a628896c90dbdf5c8093  # v4.3.0
          with: { name: nrt, path: web/public/data/nrt }
  ```
- Workflow conventions: every `uses:` pinned to a 40-char SHA with a
  `# vX.Y.Z` comment; permissions job-scoped; comments say why.
- `docs/operations.md` "Daily deploy" section (lines 28–35) — its last
  paragraph says "The only secret is `FIRMS_MAP_KEY`" (must be corrected).
  "Publishing the real data" section starts at line 37.
- `.env.example` documents `ANTHROPIC_API_KEY` as optional, "only for
  `python -m kilnwatch ask` / `ask --build-cache`".

## Commands you will need

| Purpose | Command (repo root) | Expected |
|---|---|---|
| Install | `pip install -r requirements.txt -c constraints.txt` (Python 3.11) | exit 0 |
| Lint | `python -m ruff check .` | "All checks passed!" |
| Tests | `python -m pytest -q` | all pass |
| YAML sanity | `uv run --no-project -q --with pyyaml python -c "import yaml; yaml.safe_load(open('.github/workflows/deploy.yml')); print('ok')"` | `ok` |

## Scope

**In scope**:
- `kilnwatch/export.py` — one helper + one call inside `publish()`
- `tests/test_export.py` — one new test
- `.github/workflows/deploy.yml` — `nrt` job (one step + one upload) and `deploy` job (one download)
- `docs/operations.md` — the two sections named above

**Out of scope**:
- `kilnwatch/ask.py` (only its call sites change)
- `ci.yml`, the Pages steps of the `deploy` job, any web code
- Adding the `ANTHROPIC_API_KEY` repository secret (a human step)

## Git workflow

- Branch `plan-004-ask-cache-automation`; commits `ops(ask): <...>`.
- No push/PR unless instructed.

## Steps

### Step 1: A testable hook, called from `publish()`

Add to `kilnwatch/export.py` (above `publish`):

```python
def refresh_ask_cache(env=None, build=None) -> bool:
    """Rebuild ask.json when an Anthropic key is set; otherwise warn and keep the old answers (the key is optional)."""
    import os

    env = os.environ if env is None else env
    if not env.get("ANTHROPIC_API_KEY"):
        log.warning("no ANTHROPIC_API_KEY: ask.json not refreshed (the page shows its build date)")
        return False
    if build is None:
        from .ask import build_cache as build  # lazy: ask imports export lazily too

    build(C.WEB_DATA)
    return True
```

In `publish()`, call `refresh_ask_cache()` immediately after the two safety
checks and BEFORE `tar = ...`, so releases carry the fresh answers. Then add
one more safety check right after it, because `ask.json` is new content:
`assert_public_safe(json.loads((C.WEB_DATA / "ask.json").read_text(encoding="utf-8")))`
guarded by `if (C.WEB_DATA / "ask.json").exists():`.

**Verify**: `python -m ruff check .` → clean.

### Step 2: Test the hook

In `tests/test_export.py` add `test_ask_cache_refreshes_only_with_a_key`:

```python
def test_ask_cache_refreshes_only_with_a_key():
    from kilnwatch.export import refresh_ask_cache

    calls = []
    assert refresh_ask_cache(env={}, build=calls.append) is False and calls == []
    assert refresh_ask_cache(env={"ANTHROPIC_API_KEY": ""}, build=calls.append) is False and calls == []
    assert refresh_ask_cache(env={"ANTHROPIC_API_KEY": "x"}, build=calls.append) is True and len(calls) == 1
```

No network, no key, no `gh`; `publish()` itself is not executed in tests.

**Verify**: `python -m pytest tests/test_export.py -q` → all pass (one more than before).

### Step 3: Daily refresh in `deploy.yml`

In the `nrt` job, insert this step between `python -m kilnwatch nrt` and
`pytest -q`. The key goes in the **step's** `env`, not the job's, so
`pip install` and the test suite never see it:

```yaml
      - name: Refresh ask.json (optional; never blocks the data deploy)
        env: { ANTHROPIC_API_KEY: '${{ secrets.ANTHROPIC_API_KEY }}' }
        run: |
          if [ -n "$ANTHROPIC_API_KEY" ]; then
            python -m kilnwatch ask --build-cache --src web/public/data || echo "::warning::ask cache refresh failed; the release copy stays"
          else
            echo "::warning::ANTHROPIC_API_KEY not set; ask.json not refreshed"
          fi
```

After the existing `nrt` upload, add a **second, single-file** artifact
(never widen the existing path — the tarball is extracted in that folder):

```yaml
      - uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02  # v4.6.2
        with: { name: ask, path: web/public/data/ask.json, if-no-files-found: ignore }
```

In the `deploy` job, after the `nrt` download (line 44), add:

```yaml
      - uses: actions/download-artifact@d3f86a106a0bac45b974a628896c90dbdf5c8093  # v4.3.0
        continue-on-error: true  # no ask artifact (no key, or none built) keeps the release copy
        with: { name: ask, path: web/public/data }
```

The `deploy` job's existing safety checks then cover the overlaid
`ask.json` before anything is published.

**Verify**: the YAML-sanity command → `ok`;
`grep -c "ANTHROPIC_API_KEY" .github/workflows/deploy.yml` → `3`
(step env + two in the guard script);
`grep -n "name: ask" .github/workflows/deploy.yml` → 2 lines;
`grep -n "path: web/public/data/nrt/" .github/workflows/deploy.yml` → still 1 line (unchanged).

### Step 4: Docs

`docs/operations.md`:
- "Daily deploy", step 1: add "When the `ANTHROPIC_API_KEY` secret is set,
  it also rebuilds `ask.json` (a warning, never a failure, when the key is
  absent or the call fails) and uploads it as a separate `ask` artifact."
- Same section, last paragraph: replace "The only secret is
  `FIRMS_MAP_KEY`" with "The secrets are `FIRMS_MAP_KEY` and the optional
  `ANTHROPIC_API_KEY` (scoped to the one step that rebuilds `ask.json`)".
- "Publishing the real data": add "`export --publish` rebuilds `ask.json`
  first when `ANTHROPIC_API_KEY` is set, and safety-checks it with the rest."

**Verify**: `grep -c "ask.json" docs/operations.md` → at least `3`;
`grep -c "The only secret is" docs/operations.md` → `0`.

## Test plan

Step 2 (closed-form call/no-call via an injected `build`; no network, no key).
Pattern: the existing small, hermetic tests in `tests/test_export.py`.

## Done criteria

- [ ] `python -m ruff check .` exits 0; `python -m pytest -q` exits 0
- [ ] `grep -c "refresh_ask_cache()" kilnwatch/export.py` → `1` (the call in `publish()`)
- [ ] deploy.yml parses; the `nrt` artifact path is unchanged; an `ask` artifact is uploaded and downloaded; the key appears only in a step-level `env`
- [ ] `docs/operations.md` updated as in Step 4
- [ ] Scope check (works whether or not you have committed): `git diff --name-only 98fa82a -- . ':!plans'` lists only: `kilnwatch/export.py`, `tests/test_export.py`, `.github/workflows/deploy.yml`, `docs/operations.md`
- [ ] `plans/README.md` row updated

## STOP conditions

- `publish()` structure differs from the excerpt (e.g. it already rebuilds
  the cache) — report and skip Step 1.
- Importing `kilnwatch.export` then calling `refresh_ask_cache` raises an
  import cycle even with the lazy import.
- The pinned `upload-artifact` version rejects `if-no-files-found: ignore`,
  or the pinned `download-artifact` cannot tolerate a missing artifact with
  `continue-on-error` — report; do not swap action versions.

## Maintenance notes

- A person must add `ANTHROPIC_API_KEY` as a GitHub repository secret for
  the daily refresh to run; until then the step only warns.
- Cost: each daily run makes up to `len(DEMO_QUESTIONS) × MAX_STEPS` model
  calls (4 × 6 today, 6 × 6 after Plan 003) on `claude-opus-5-5` at low
  effort. If that is too much, switch the cron refresh to weekly — a team
  decision, not a code one.
- Plan 005 (hosted worker) may supersede the cache for live answers; the
  publish-time rebuild stays useful for the offline site either way.
