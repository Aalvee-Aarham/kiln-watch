# Verification log (VERIFY-H)

Rows are appended by agents and **signed only by people**. Columns: step · check · result · signed by · date.

| Step | Check | Result | Signed | Date |
|---|---|---|---|---|
| S1 | The Pages URL serves the shell; `#/evidence` opens directly on a phone | | | |
| G0 | One-line reading of what G0 implies for the expected branch | | | |
| A1 | 3 random detections match the FIRMS web map | | | |
| A2 | The cell-day map of one season looks like the FIRMS map | | | |
| A3 | 3 random (unit, day) clear fractions match the GEE Code Editor | | | |
| A4 | Cluster-size histogram and rung distribution show nothing pathological | | | |
| A5 | Plateau-vs-spike and radius-sweep figures read correctly; branch decision matches the rules | | | |
| A8 | 3 districts spot-checked against their raw calendars | | | |
| B3 | CSV opens in Excel; keyboard-only path through UnitSearch works | | | |
| B7 | Accessibility checklist complete | | | |
| I2 | Deep links work on a phone | | | |
| I4 | Every page works with the network off | | | |
| P1 | Four rehearsals logged; a naive viewer restates the headline correctly | | | |
| P2 | Second team member confirms every submission field and link | | | |
| A1-K | Kiln activity (Amendment 1): the national kiln-season curve peaks Dec–Feb and is flat Jul–Sep; 3 districts spot-checked against local knowledge of their kiln season | | | |
| A1-K | Kiln activity: the Bangla non-claims in `kilnwatch/activity.py` read correctly to a native speaker | | | |
| P0 | Local Lead confirms in writing how pre-event work (5–6 Oct 2026) is treated; README/submission disclosure updated with the ruling | | | |
| NEWS | 30 random published news stories (drawn with `config.rng("news_audit")`) checked against the articles: the claim matches, the districts are right, the quote is verbatim, no kiln, owner or private person is named | | | |
| NEWS | The "How common is fire here?" verdict for 5 districts matches their Area page and local knowledge of their burning season; the "rare" threshold (`NEWS_RARE_SEASON_FRAC`) confirmed by the team | | | |
| NEWS | The Bangla claims, verdicts and news page text read correctly to a native speaker | | | |
| NEWS | `#/news` works on a phone in day and night themes; the Area page link opens the filtered list; "Earlier news" opens | | | |
| NEWS | The Gemini terms question (`docs/news_plan.md` §10 item 1) is settled before the `GEMINI_API_KEY` secret is added | | | |
