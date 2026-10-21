# Plan 008: Citable release + license — refined as-built

> Refinement of `plans/008-citable-release-and-license.md`, verified against
> HEAD `2f0b5eb` on 2026-10-21. Complete; one team decision (the Zenodo DOI
  toggle) remains intentionally open.

## Status

- **DONE** — commit `6e34bb2` ("docs: add the MIT licence the README states,
  plus citation metadata").

## What shipped (verified 2026-10-21)

- `LICENSE` (MIT), `CITATION.cff`, `.zenodo.json` — all three exist in the
  repo root (`ls` verified). The README's "Code: MIT" claim is now in force,
  and GitHub shows "Cite this repository".
- Only public first names in the metadata — no invented surnames, emails or
  ORCIDs, per the plan's hard rule.

## Verify today

```bash
uvx cffconvert --validate -i CITATION.cff   # valid against schema 1.2.0
python -c "import json; json.load(open('.zenodo.json')); print('ok')"
```

## Follow-ups

- The Zenodo DOI remains a **team decision, now one toggle**: with the
  integration on, every `data-<sha>` release `export --publish` creates
  would mint a new Zenodo version (it archives source tarballs, not the
  attached data zip — the data zip would need its own upload). Decide
  before 13 Nov if a DOI belongs in the submission.

## Maintenance notes

- On version bumps (`pyproject.toml` version), update `CITATION.cff` and
  `.zenodo.json` in the same commit.
