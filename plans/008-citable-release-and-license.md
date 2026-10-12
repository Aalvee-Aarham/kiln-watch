# Plan 008: Make the project legally reusable and citable — LICENSE, CITATION.cff, .zenodo.json

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on.
> On any STOP condition, stop and report. Update `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat 98fa82a..HEAD -- README.md docs/operations.md pyproject.toml kilnwatch/research.py`
> and `ls LICENSE* CITATION.cff .zenodo.json 2>/dev/null` (expected: nothing
> listed). If any of these files now exist or the excerpts below changed,
> compare before proceeding; a mismatch is a STOP condition.

## Status

- **Priority**: P2 (do before judging on 13 Nov 2026)
- **Effort**: S
- **Risk**: LOW (metadata files only; no code)
- **Depends on**: none
- **Category**: docs / direction
- **Planned at**: commit `98fa82a`, 2026-10-12

## Why this matters

`README.md:324` says "Code: MIT", and the Impact page tells other
countries to "Reuse the open code to bridge MODIS to VIIRS for your own
country" (`web/src/pages/ImpactPage.tsx:101`) — but the repository has **no
LICENSE file**. Without one, GitHub shows "No license" and, legally, nobody
may reuse the code: the stated intent is not in force. Separately, the
roadmap leaves a Zenodo DOI as a team decision (`docs/roadmap.md:21`,
`docs/operations.md:39`), but there is no citation metadata, so flipping
that switch later still means writing metadata by hand under deadline. This
plan adds the three standard files so GitHub shows "Cite this repository"
and the DOI, when the team chooses it, is one toggle.

## Current state

- No `LICENSE`, `CITATION.cff` or `.zenodo.json` in the repo root.
- `README.md` "Credits and licences" (line 322 on): `Code: MIT. Data:` then
  a list of data sources and their licences. "Team" (line 335 on):
  ```markdown
  **Team Off The Binary**

  - Arna · Frontend
  - Sajid · Backend
  - Aalvee · AI Agent
  - Ahnaf · Data
  - Nazifa · Research
  - Maruf · Design
  ```
  Only first names are public — do **not** invent surnames, emails or ORCIDs.
- `pyproject.toml:3` — `version = "1.0.0"`.
- Repository: `https://github.com/Aalvee-Aarham/kiln-watch`; live site
  `https://aalvee-aarham.github.io/kiln-watch/` (`README.md:7`).
- The research data release already carries its own licence:
  `kilnwatch/research.py:23` — `LICENCE = "CC BY 4.0 (...). Cite as: Kiln Watch, NASA Space Apps 2026, https://github.com/Aalvee-Aarham/kiln-watch"`.
  Data releases are GitHub Releases `data-current` and immutable
  `data-<short_sha>` (`docs/operations.md:39`).
- Zenodo's GitHub integration archives the **source tarball** of each
  published GitHub release — not the files attached to it. A DOI from the
  integration therefore covers the code; the data zip would need its own
  Zenodo upload. Every `data-<sha>` release `export --publish` creates is a
  published release, so with the integration on each would mint a new
  version.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Validate CFF | `uvx cffconvert --validate -i CITATION.cff` | "Citation metadata are valid according to schema version 1.2.0." (without uv: `pip install cffconvert` in a scratch venv) |
| Validate JSON | `python -c "import json; json.load(open('.zenodo.json')); print('ok')"` | `ok` |
| Tests (unchanged) | `python -m pytest -q` | all pass |

## Scope

**In scope** (create unless noted):
- `LICENSE`
- `CITATION.cff`
- `.zenodo.json`
- `README.md` (modify: one "Cite" subsection; link the licence)
- `docs/operations.md` (modify: one paragraph on the DOI switch)

**Out of scope**:
- Turning on the Zenodo integration or uploading anything to Zenodo — a
  team decision and an account action.
- `kilnwatch/research.py` (the data licence text stays as is).
- Any change to data licences or to the third-party credits list.

## Git workflow

- Branch `plan-008-citable-release`; commit `docs: add MIT licence and citation metadata`.
- No push/PR unless instructed.

## Steps

### Step 1: `LICENSE`

Create `LICENSE` with the standard MIT licence text, verbatim from
https://opensource.org/license/mit, with the copyright line
`Copyright (c) 2026 Team Off The Binary`. Change nothing else in the text.

**Verify**: `head -1 LICENSE` → `MIT License`;
`grep -c "Copyright (c) 2026 Team Off The Binary" LICENSE` → `1`;
`grep -c "THE SOFTWARE IS PROVIDED \"AS IS\"" LICENSE` → `1`.

### Step 2: `CITATION.cff`

```yaml
cff-version: 1.2.0
message: "If you use Kiln Watch's code or data, please cite it as below."
title: "Kiln Watch: a harmonized MODIS–VIIRS burning calendar for Bangladesh"
type: software
authors:
  - name: "Team Off The Binary"
version: "1.0.0"
license: MIT
repository-code: "https://github.com/Aalvee-Aarham/kiln-watch"
url: "https://aalvee-aarham.github.io/kiln-watch/"
abstract: >-
  Harmonizes 20+ years of NASA MODIS and VIIRS active-fire detections over
  Bangladesh into one Aqua-MODIS-equivalent scale and publishes per-area
  burning calendars with uncertainty, built for NASA Space Apps 2026. The
  public data release is licensed CC BY 4.0 and contains area-level data only.
keywords:
  - NASA FIRMS
  - MODIS
  - VIIRS
  - active fire
  - harmonization
  - Bangladesh
  - brick kilns
```

Keep `version` equal to `pyproject.toml`'s. The single entity author is
deliberate (only first names are public); individual authors are a team
decision (Maintenance notes).

**Verify**: the CFF validation command → valid.

### Step 3: `.zenodo.json`

```json
{
  "title": "Kiln Watch: a harmonized MODIS–VIIRS burning calendar for Bangladesh",
  "upload_type": "software",
  "description": "Harmonizes 20+ years of NASA MODIS and VIIRS active-fire detections over Bangladesh into one Aqua-MODIS-equivalent scale and publishes per-area burning calendars with uncertainty. Built for NASA Space Apps 2026. The public data release (GitHub releases data-current and data-<sha>) is CC BY 4.0, area-level only.",
  "creators": [{ "name": "Team Off The Binary" }],
  "license": "MIT",
  "keywords": ["NASA FIRMS", "MODIS", "VIIRS", "active fire", "harmonization", "Bangladesh", "brick kilns"],
  "related_identifiers": [
    { "identifier": "https://aalvee-aarham.github.io/kiln-watch/", "relation": "isDocumentedBy", "resource_type": "other" }
  ]
}
```

**Verify**: the JSON validation command → `ok`.

### Step 4: README and operations doc

- `README.md`, "Credits and licences": change `Code: MIT. Data:` to
  `Code: MIT ([LICENSE](LICENSE)). Data:`; after that section add:
  ```markdown
  ### Cite

  Use GitHub's "Cite this repository" button (from [`CITATION.cff`](CITATION.cff)). The research data release carries its own CC BY 4.0 licence and citation line.
  ```
- `docs/operations.md` "Publishing the real data" (line 39): after "A DOI
  (for example through the Zenodo GitHub integration) is a team decision,
  not automated." add: "`CITATION.cff` and `.zenodo.json` already hold the
  metadata. Note that the integration archives each release's source
  tarball, not its attached files, and every `data-<sha>` release would mint
  a version: a DOI for the data zip needs its own Zenodo upload."

**Verify**: `grep -c "CITATION.cff" README.md docs/operations.md` → each at least `1`;
`grep -c "](LICENSE)" README.md` → `1`.

## Test plan

No code changes. Validation commands (CFF schema, JSON parse) are the
tests; `python -m pytest -q` stays green.

## Done criteria

- [ ] `LICENSE`, `CITATION.cff`, `.zenodo.json` exist and pass their checks above
- [ ] `grep -c "version: \"1.0.0\"" CITATION.cff` → `1` and `pyproject.toml` still says `1.0.0`
- [ ] No personal emails or invented surnames: `grep -cE "@|orcid" CITATION.cff .zenodo.json` → `0` for each
- [ ] Scope check: `git diff --name-only 98fa82a -- . ':!plans'` lists only `LICENSE`, `CITATION.cff`, `.zenodo.json`, `README.md`, `docs/operations.md`
- [ ] `plans/README.md` row updated

## STOP conditions

- A `LICENSE` file already exists with a different licence, or the README no
  longer says MIT — the licence is the copyright holders' call; report.
- `cffconvert` rejects the file for a reason other than a typo you made.

## Maintenance notes

- Team decisions this leaves open: listing individual authors (full names,
  optional ORCIDs) in both files, and turning on the Zenodo integration.
  When they decide, edit `authors` / `creators` together.
- Bump `version` in `CITATION.cff` together with `pyproject.toml`.
- If the team wants a DOI for the data rather than the code, upload
  `kilnwatch-research-data.zip` to Zenodo as a separate dataset record and
  add its DOI to `.zenodo.json` `related_identifiers`.
