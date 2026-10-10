# Kiln Watch documentation

Bangladesh burning + brick-kiln seasons from 23 years of NASA satellite data. Python pipeline, static React site, pre-registered tests.

## Living documentation

| Doc | What it covers |
|---|---|
| [architecture.md](architecture.md) | The system: what it is and why — design principles, stages, results, limits |
| [pipeline.md](pipeline.md) | The Python package: modules, every CLI stage and flag, inputs/outputs, constants, determinism |
| [data-contracts.md](data-contracts.md) | The static JSON the site serves: files, budgets, branch-dependent fields, safety checks, fixtures |
| [web-frontend.md](web-frontend.md) | The site: stack, routes, pages, libs, theming, i18n, tests |
| [operations.md](operations.md) | Setup, CI, the daily NRT deploy, publishing, dual-tier release, governance |
| [../README.md](../README.md) | Project overview, quick start, results |
| [AI_USE.md](AI_USE.md) | Every use of AI in the project, for the Space Apps AI disclosure |
| [amendment5_draft.md](amendment5_draft.md) | **Draft, not in force:** the proposed pre-registration of the South Asia calendar, for the team to agree |
| [roadmap.md](roadmap.md) | The plan to the event: steps F0–F9, what each must show to be done |
| [../CLAUDE.md](../CLAUDE.md) | Living rules for coding agents (invariants, conventions, when blocked) |

## Canonical records (never rewritten)

| Doc | Role |
|---|---|
| [PREREGISTRATION.md](PREREGISTRATION.md) | Pre-registered rules — the authority for every threshold; committed before analysis |
| [PREREGISTRATION_AMENDMENTS.md](PREREGISTRATION_AMENDMENTS.md) | Dated amendments 1–4, each written before the data it governs |
| [BLOCKERS.md](BLOCKERS.md) | Escalation log (two rows await human sign-off: the A2 cell-count bound and the LOSO coverage FAIL) |
| [VERIFICATION.md](VERIFICATION.md) | Human sign-off log — rows signed only by people |

## Historical records (describe the build as planned; content untouched)

[implementation_plan.md](implementation_plan.md) (the v2.1 build plan — build complete) · [file_structure.md](file_structure.md) (tree as of 6 Oct) · [project_proposal.md](project_proposal.md) (pre-code proposal) · [redesign_plan.md](redesign_plan.md) (the 7 Oct site redesigns) · [CLAUDE.md](CLAUDE.md) (agent operating rules for the build) · [DESIGN.md](DESIGN.md) · [PRODUCT.md](PRODUCT.md) · [bg_cursor_plan.md](bg_cursor_plan.md) · [resource/](resource/) (the Space Apps build guide).

Generated outputs live outside `docs/`: pipeline reports in [`reports/`](../reports/), pitch material in [`presentation/`](../presentation/).
