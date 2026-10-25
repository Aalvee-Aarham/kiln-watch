# Plan 011: Project page, AI disclosure, and submission hygiene

> **Executor**: the team, with one drafting session that can be agent-assisted.
> Written 2026-10-21 against the 2026 Build Guide. Priority **P1** — three
> binary points (category named, repository access, page complete) are "the
> points teams most often throw away", and the AI-disclosure conditions are
> pass/fail for legitimacy.

## Why this matters

The guide is explicit: "Secure the three single points first. Category
named, public repository, page submitted. They cost fifteen minutes." The
project page is what global judges read after (or instead of) the 30-second
video. AI-generated content "is allowed with conditions: a valid reason,
the prompts explained, and where your own creative work went. Unexplained
generated content is not acceptable and every generating tool must be
named." The detailed Submission & Judging guides publish **13 November** —
the disclosure wording must be aligned with them that morning.

## Current state (verified 2026-10-21)

- `docs/AI_USE.md` exists with the right structure and 1s/known-limits
  rows, but still has **three `_to fill_` sections** (`grep -c "_to fill_"`
  → 3) — flagged as outstanding since the plans were written.
- No project-page draft exists (`docs/` has proposal/plan docs, no
  `project-page` draft). `docs/data_sources.md` already lists sources —
  raw material for the "NASA data sources used" field.
- Repo is public (`github.com/Aalvee-aarham/kiln-watch`), MIT LICENSE,
  CITATION.cff, .zenodo.json all exist (Plan 008).

## Step 1 — Draft the page (now; don't wait for the weekend)

Draft `docs/project-page.md` covering every field the guide names:

1. **High-Level summary** — name, what, who it helps, how it works; links
   to the 240s/30s videos and GitHub.
2. **Project demo** — the 30-second video link.
3. **Final project** — repository, docs.
4. **Project details** — why / what / how with **every dataset listed**;
   community involvement (DoE analysts as first users, the alert feed);
   tools and technologies, credit given generously.
5. **GitHub access** — public, no permission request.
6. **Use of AI** — pull from `docs/AI_USE.md`: the agent (Gemini, tool-use,
   value-guarded, six-call cap), what AI did and did not do (all statistics
   are the team's tested code; the model retrieves and explains only),
   prompts referenced. This maps exactly onto the guide's disclosure rules
   and is kiln-watch's strongest paragraph — the architecture *is* the
   compliant design.
7. **NASA data sources used** — per dataset: what it was used for and how.
   FIRMS MODIS + VIIRS (NOAA-20/21) → the harmonised record; NASA Black
   Marble night lights → kiln working seasons; plus the partner layer
   (published Bangladesh reference, DoE operational context) — the guide's
   formula for a top NASA-data-usage score is "NASA open data plus another
   agency or third-party source, clearly shown".
8. **References** — every source, dataset, library and asset
   (`docs/data_sources.md` is the seed).

**Verify**: the draft answers every field above in one sitting; a reader
who has never seen the repo can write the judge's summary from it alone.

## Step 2 — Finish `docs/AI_USE.md` (the three `_to fill_` sections)

The team's own words, not an agent's. Name every AI tool used across the
project — the coding agents included, not just the in-product agent — with
the reason and the prompts' location. State plainly what remained human:
the method, the statistics, the interface design, the decision log.

**Verify**: `grep -c "_to fill_" docs/AI_USE.md` → **0**.

## Step 3 — 13 Nov morning: align with the official wording

The Submission Guide and Judging & Awards Guide publish 13 Nov. Re-read
them and adjust the page + disclosure wording to match their terms
verbatim where they differ from the build guide's summary.

## Step 4 — Submission hygiene checklist (14 Nov, before noon freeze)

- [ ] Challenge category named on the page: "Harmonization of MODIS and VIIRS Hot Spots" (2026)
- [ ] Repo link opens for a stranger in a **private browser window**, no login, no permission request
- [ ] Every project-page field filled; page actually submitted (not just saved)
- [ ] Both video links present and correct
- [ ] Women-participation field reflects the team's composition (the +5% applies for one or more women members)
- [ ] No under-18 names/voices/likenesses anywhere in the submission

## Done criteria

- [ ] `docs/project-page.md` exists covering all fields
- [ ] `grep -c "_to fill_" docs/AI_USE.md` → 0
- [ ] Disclosure wording aligned with the 13 Nov official guides
- [ ] Page submitted with every field; private-window repo check passed

## STOP conditions

- The official 13 Nov guides contradict the build guide's field list or
  disclosure rules → the official guides win; update the draft, then
  submit.
