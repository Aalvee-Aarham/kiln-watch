# News page: plan

**Status:** draft plan, 11 Oct 2026, not built. Revision 2 adds "How common is fire here?" and earlier news on every story · **Decisions:** made by the team on 11 Oct 2026 (section 2) · **Touches:** a new pipeline stage, a new public data file set, a new route, the deploy workflow

## 1. What it is

A dedicated page, `#/news`. Every story on it gets three things from our own data: what the satellites saw around that date, how common fire is in that place, and earlier news about fires there.

```
Rangpur · 14 Jan 2026 · The Daily Star
"Crop-residue smoke blankets northern districts"                  ← headline, links to the article

What the paper says:    heavy crop burning in Rangpur this week
What satellites saw:    8–14 Jan: 5 unusual burning days

How common is fire here?                  Kiln Watch satellite record since 2003-04
  This season so far:   14 unusual days from 1 Jul to 14 Jan; 9 days not observed (cloud)
  Summary:              burning here usually runs Nov–Feb, busiest in December;
                        a burning season was recorded in 21 of 23 seasons
  Verdict:              Common. Burning at this time of year is normal for Rangpur.

Earlier news about fires here (12 since Jan 2013) ▸               ← opens past stories, with links
  3 Dec 2025 · Samakal — "…"      20 Jan 2025 · Dhaka Tribune — "…"
                                                                    → Rangpur's burning season
```
*(Illustrative example: not a real story or real figures.)*

- **Newspapers say why something happened. Our data says whether, where, how much, and how common.** If we cannot build the satellite parts for a story, the story is not published.
- **Satellites count; news gives examples.** "How many times has fire happened here?" is answered by the 20-year satellite record. Earlier news shows what was reported, and is labelled as incomplete, because newspapers cover some places far more than others.
- **AI reads; code finds, checks and counts.** Articles are found through the newspapers' own sitemaps, not a search engine. Gemini reads the articles we fetched ourselves and pulls out the kind of story, the districts, the date, a short claim and a quote. Code checks everything Gemini returns. Deterministic code computes every satellite number and the verdict; the model never does.
- **Who it serves:** the Impact page's journalists and students ("Check a claim in minutes, with a source") and policy makers ("a yearly, independent check on kiln policy"), plus families and schools during smoke season.

## 2. Decisions

| Decision | Choice | Notes |
|---|---|---|
| Where news appears | Dedicated `#/news` page, plus one line on the Area page linking to it | No news markers on charts, no news on the Timeline or Home. This keeps unreviewed AI-collected content out of the checked data views |
| Kind of fire | Open burning: fields, crop residue, waste, brick kilns. Also enforcement stories and smoke or air-quality stories linked to burning | **Building, factory and market fires are out.** Satellite pixels (375 m to 1 km, a few passes a day) can't count them reliably, so a "how common" block would mislead |
| Geography | Bangladesh only: the 64 districts, plus national stories | Upazila mentions roll up to their district. An upazila-level option is in section 10 |
| Satellite parts of each story | (1) What satellites saw around the event date; (2) "How common is fire here?": this season so far, a summary of the typical year and the record, and a verdict | Section 5.3 |
| Verdicts | **One verdict only: how common fire is in this place at this time of year**, by a fixed rule from our data | Never a verdict on whether a story is true, or on what caused something |
| Earlier news | Every published story about the same district, newest first, from our own news store | Section 5.1 explains how far back it reaches. A search API is optional and later |
| Time range | The main feed opens on 2025-26 and 2026-27. History goes back to the 2012-13 season at the outlets that keep archives, filled newest first as the free-tier limit allows | The burning season barely starts before the 14 Nov demo, so this season alone would be thin |
| Finding articles | Newspapers' news sitemaps (daily) and dated archive sitemaps (backfill) | Not Gemini's Google Search grounding: its terms allow showing results only "to the end user who submitted the prompt", forbid caching or syndicating them, and forbid "using Links to identify destination pages for crawling or scraping" |
| Reading articles | Gemini Flash-Lite (`gemini-3.1-flash-lite`), then, in order, whenever a model is out of quota or fails: four more Gemini models on the same key (`gemini-3.5-flash-lite`, `gemini-3.6-flash`, `gemini-3.8-flash`, `gemini-3-flash-preview`; each has its own free daily limit; all confirmed available on the team key on 12 Oct 2026), two older spares (`gemini-2.5-flash-lite`, `gemini-2.5-flash`), Groq (`openai/gpt-oss-120b`, `qwen/qwen3.8-27b`, `openai/gpt-oss-20b`: the models on the team key), and optional Cerebras, Mistral and GitHub Models. **One Gemini key only:** rotating several keys to beat the free limit breaks Google's API terms (§2(d), "will not attempt to circumvent such limitations") (`NEWS_PROVIDERS` in `config.py`; a provider without a key is skipped) | **Free tier: team decision of 11 Oct 2026.** Consequences in section 10 |
| Publishing | Daily and automatic; every item labelled as collected by AI and not reviewed; a blocklist file removes bad items | A person audits a random sample before the demo (section 9) |
| Outlets | Bangladeshi English and Bangla dailies | Table in section 4 |
| Claim language | English and Bangla for every item | Headlines and quotes stay in the article's language |
| Satellite numbers | Computed by deterministic Python at deploy time, from the exact data being deployed | So news numbers always match the rest of the site |

## 3. How it works

```
 newspaper news sitemaps (daily) ─┐
 dated archive sitemaps (history) ┴─► site + date + keyword filter ─► fetch article (robots.txt, polite)
                                                                               │
                                         gazetteer: which districts does the text name?  (code)
                                                                               │
                      Gemini, structured output: kind, districts ⊆ those, event date, claims, quote
                                                                               │
                                         guards (code) ─► item store ─► release asset `news-current`
                                                                               │
 deploy job: `news-pair` (no AI, no network) = store + calendars + NRT + kiln activity + blocklist
   ├─ what satellites saw, per story        ├─ how common fire is, per district + verdict per story
   └─ earlier news, per district
                                                                               │
                                         web/public/data/news/ ─► #/news
```

## 4. Sources

Checked on 11 Oct 2026 by reading each outlet's `robots.txt` and sitemaps.

| Outlet | Lang | Daily feed | History from archives | Status |
|---|---|---|---|---|
| The Daily Star | en | `googlenews.xml` (headlines, dates) | **Yes:** yearly sitemaps with readable links, going back well before 2012 | Active |
| Prothom Alo English | en | `news_sitemap.xml` | No: links are random IDs and the archive has no headlines | Active from the first run |
| The Business Standard | en | `googlenews.xml` | No archive sitemap found (`sitemap.xml` returns 404) | Active from the first run |
| Dhaka Tribune | en | `news-sitemap.xml` (readable links, few headlines) | **Yes:** monthly sitemaps with readable links, from April 2013 | Active |
| bdnews24 | en | `news_sitemap.xml` | No: random IDs | Active from the first run |
| The Financial Express | en | None found (`/rss`, `/feed` return HTML) | — | **Excluded for now** |
| New Age | en | Its listed news sitemap returns 404 | Not checked | **Excluded for now** |
| Prothom Alo | bn | `news_sitemap.xml` (also lists pages on other sites, which the site check drops) | No: random IDs | Active from the first run |
| Samakal | bn | `news_sitemap.xml` | **Yes:** daily sitemaps with readable Bangla links, listed from January 2020 | Active |
| Jugantor | bn | `news_sitemap.xml` | None | Active from the first run |
| bdnews24 Bangla | bn | `news_sitemap.xml` | No: random IDs | Active from the first run |
| Kaler Kantho | bn | Sitemap returns 403 to our requests | — | **Excluded:** we don't work around blocks |

**History comes from 3 outlets:** The Daily Star (to 2012-13), Dhaka Tribune (from 2013) and Samakal (from 2020). The other 6 active outlets start on the day of the first run. The coverage panel and the "Earlier news" line both say so (section 7). Finding older stories at outlets whose links are random IDs would mean fetching every article they published, so we don't. A search API could reach them later (section 5.1).

**Source rules**

- `data/static/news_sources.csv` (hand-built, reviewed) holds: key, outlet, domain, language, feed URL, archive pattern, status, exclusion reason, date checked.
- **Site check in code.** A link's host must equal, or be a subdomain of, an active source's domain, over https. A real case: Prothom Alo's Bangla feed lists `haal.fashion` pages.
- **robots.txt is respected** for our user agent, `KilnWatch-News/1.0 (+<repo URL>)`. We also skip any outlet whose robots.txt disallows `Google-Extended`, the publisher opt-out from Google AI use; on the free tier, Google may use what we send. Today no outlet blocks it: New Age explicitly allows it, and bdnews24 blocks `GPTBot` and `anthropic-ai` but not `Google-Extended`.
- **No evasion.** On a 403 or 429 the outlet is skipped for that run and the gap is recorded. We never change the user agent, use proxies, or bypass a paywall.
- **Politeness.** At least 3 s between requests to one host, and a per-host cap on each run.

## 5. Pipeline

Two stages. They run in different jobs because only the first needs the Gemini key.

### 5.1 `python -m kilnwatch news`: find, read and check articles

Needs `GEMINI_API_KEY`. Not part of `all`, like `ask` and `verify-firms`.

1. **Discover.**
   - **Daily:** read each active outlet's news sitemap, which covers about the last 48 h. Also read the last 2 days of its dated archive where one exists, to catch a missed run.
   - **History:** `--backfill` reads the archive sitemaps of the 3 history outlets from `NEWS_HISTORY_FROM` (season 2012-13). It goes **newest first**: all of 2025-26, then 2024-25, and so on back. It is resumable, keeping its cursor in the store.
   - **Each daily run** spends any model-call budget left after new articles on continuing the history. History therefore keeps growing within the free-tier limit, and the coverage panel shows how far back each outlet has been read.
2. **Filter, with no network and no AI.** Keep a link only if it passes the site check, its date falls in range, it is not already in the store, it is not on the blocklist, and its headline or URL slug (URL-decoded, Bangla included) matches `data/static/news_keywords.csv`. The keyword list errs toward recall, because Gemini decides relevance. It leaves out a bare "fire"/"আগুন", which mostly means building fires. Examples:
   - English: brick kiln, brickfield, crop residue, straw burning, stubble, field fire, waste burning, smog, haze, air pollution, air quality, AQI, Department of Environment, mobile court.
   - Bangla: ইটভাটা, ইটের ভাটা, খড় পোড়ানো, নাড়া পোড়ানো, ফসলের অবশিষ্টাংশ, বর্জ্য পোড়ানো, বায়ুদূষণ, বায়ুর মান, ধোঁয়াশা, পরিবেশ অধিদপ্তর, ভ্রাম্যমাণ আদালত.
3. **Fetch the article.** Take the headline and publication date from the page's own metadata (JSON-LD `NewsArticle`, `article:published_time`), never from the model; fall back to the sitemap date. Convert to `date_local` (UTC+6). **Article text stays in memory: it is never written to disk or published.** Only its sha256 is kept.
4. **Gazetteer (deterministic).** Find the districts the headline and text name. Sources:
   - district names in English and Bangla from `aoi/districts.geojson`;
   - upazila names, mapped to their district, from `aoi/upazilas.geojson`;
   - `data/static/district_aliases.csv` (Chittagong/Chattogram, Comilla/Cumilla, Jessore/Jashore, Bogra/Bogura, Barisal/Barishal, …).

   Generic names (Sadar, Kotwali) are ignored. The result is a list of **candidate districts**. When there are none, the only candidate is national (`BGD`), and only if the story is about Bangladesh as a whole.
5. **Excerpt.** Gemini gets only the headline, the first 3 paragraphs, and any paragraph that mentions a keyword or a candidate place, capped at `NEWS_EXCERPT_MAX_WORDS` (about 600). This limits how much third-party text reaches the free tier, and keeps token use low.
6. **Extract, using Gemini structured output.** The SDK is `google-genai`, with a JSON schema in `response_format` per the current docs; enums are built for each call.
   - `kind`: `burning` | `enforcement` | `kilns_operating` | `air_health` | `policy` | `not_relevant` (building, factory and market fires are `not_relevant`)
   - `unit_ids`: a subset of the candidates, or `["BGD"]` for national
   - `event_date_local`: when the article states when the event happened, otherwise null
   - `claim_en`, `claim_bn`: what the paper says, at most 30 words, naming no individual kiln, owner or private person
   - `quote`: one sentence copied verbatim from the excerpt, at most 25 words
7. **Guards, in code.** Each failure drops the item and is counted by reason, like `ask.json`'s blocked answers.
   - The output is schema-valid. `not_relevant` is dropped. `policy` goes to a Timeline review list and is not published (see `--policy-review`).
   - `unit_ids` ⊆ candidates.
   - `quote` is a verbatim substring of the excerpt, after whitespace normalisation.
   - Every number in `claim_en` and `claim_bn` appears in the quote. Bangla digits ০–৯ are normalised and thousands separators stripped. This is the same idea as `ask.py`'s `guard()`.
   - The event date falls between 30 days before publication and the publication date. Otherwise it is set to the publication date, with `event_date_stated: false`.
   - Length caps hold.
8. **Store.** Merge by canonical URL, write atomically (`*.tmp`, then rename), and re-run every guard over the whole store as a stage check. An article is extracted once and never re-extracted, so re-runs don't change published items.
   - The store is `data/news/store.json`; `kilnwatch/news_store.py` is its only reader and writer, and the single interface between the two stages.
   - It keeps the checked items, each outlet's coverage and history cursor, the drop counts by reason, and a `seen` map holding every processed link's id. Definitive drops are marked seen, so they are never fetched again. Transient failures (timeouts, 5xx, rate limits) are not, so they are retried.

| Flag | Does |
|---|---|
| `--backfill` | Continue the history newest first, from the stored cursor back to `NEWS_HISTORY_FROM`; paced to the free-tier daily limit |
| `--check-sources` | Report robots.txt and feed reachability per outlet; no article fetches, no AI |
| `--dry-run` | Discover and filter; list what would be fetched |
| `--publish` | Upload the store as release asset `news-current` |
| `--policy-review` | Print the `policy` items for a person to add, with sources, to `data/static/policy_events.csv` (later phase) |

**Optional, later: a search API for older stories at the 6 outlets without archives.** It needs a provider whose terms allow storing and publishing results. Gemini's Google Search grounding is ruled out (section 2). Claude's web search allows it, provided results carry citations, but needs an Anthropic key. Any other service must have its terms checked first. It would plug in as one more discovery source, and everything after discovery stays the same.

### 5.2 `python -m kilnwatch news-pair`: add the satellite parts

No AI, no network, no key. It runs in the deploy job against the exact data being deployed. It:

1. reads the store, the calendars, NRT and kiln activity;
2. applies `data/static/news_blocklist.csv`;
3. computes, for each story, **what satellites saw** (below) and **how common fire is** (5.3), plus each district's earlier-news list;
4. writes the files in section 6;
5. runs `assert_public_safe` and the size budgets.

As a stage check, every published item must have both satellite parts, and the counts must match the items.

**What satellites saw around the event date**

| Kind | What `news-pair` computes | From |
|---|---|---|
| `burning` | Unusual days in the 7 days ending on the event date, and how many of those days were not observed | Past seasons: calendar `unusual` and `nodata`. Current season: NRT `h` against the calendar's `normal.p90`, the same comparison as `nrt.py` (move it into one shared helper; don't write it twice) |
| `enforcement` | The same, for the 14 days before and the 14 days after the event date; "after" is null until 14 days have passed | Same |
| `kilns_operating` | Whether the date falls in the months kilns in that district usually work | `kiln_activity.json` areas (≥ 5 clusters); null when there is no estimate |
| `air_health` | Whether the date falls in the district's usual burning season; the two-week outlook if it ships and the story is from this week | Calendar `normal` (reuse `ask.py`'s `_busy_months`), `outlook.json` |
| Any national story | How many of the 64 districts had at least one unusual day in the window | District calendars and NRT. There are no national or division calendar files, so this is a district count |

- **"Can't tell" is a result.** If at least `NEWS_CLOUDY_MIN_DAYS` (4) of the 7 days were not observed, the page says the satellites couldn't see the ground, not a count. NRT carries no not-observed days, so current-season items say "provisional; cloud cover not checked".
- **A known limit, stated on the page:** under the `nokiln` outcome, daily fire data can't separate kiln heat from crop burning. Kiln stories therefore use the night-light kiln months, not daily kiln counts.

### 5.3 How common is fire here?

This is computed per district by `news-pair`, with a verdict per story. It reuses rules the site already shows, so the news page and the Area page can't disagree.

| Line | Rule | Existing logic it reuses |
|---|---|---|
| **This season so far** | Unusual days from 1 July to the story date (or to the last data day, if earlier), and the days not observed. For current-season stories it is provisional, with cloud not checked | Calendar `unusual`/`nodata`, as in `calendar.ts` `seasonVerdict`; NRT against `normal.p90`, as in `nrt.py` |
| **Summary: typical year** | The months fire usually runs here and the busiest month | `busyMonths` (`plain.ts`) = `_busy_months` (`ask.py`): the peak month of the mean season profile, widened while neighbouring months reach 25% of it |
| **Summary: record** | Seasons with a measured burning season (duration p50 > 0) out of all seasons in the record, and the median measured duration | Calendar `seasons[]`; record length as in `ask.py` `area_fire_calendar`. Count duration p50 > 0, not merely the presence of a duration object: one fixture season has duration 0 |
| **Verdict** | `rare` if there is no typical year, or if seasons with burning ÷ seasons in record < `NEWS_RARE_SEASON_FRAC` (0.5). Otherwise `common_now` if the story's month is inside the typical months (in July–June order), and `outside_season` if not | The two rows above. **The 0.5 threshold is new (FIXED) and needs team confirmation** |

How the verdict reads, with Bangla text in `i18n.ts`:

| Verdict | Text |
|---|---|
| `common_now` | "Common. Burning at this time of year is normal for \<district\>." |
| `outside_season` | "Less common. Burning here usually runs \<first\>–\<last\>; this story falls outside that." |
| `rare` | "Rare. Satellites recorded a burning season here in only \<n\> of \<N\> seasons." |
| National stories | No verdict: there is no national normal. The season line gives how many of the 64 districts had unusual days by the story date |

This is a verdict about our data, never about the story. Nothing says "confirmed", "false" or "the crackdown worked". Weather, harvest timing and clouds all move these numbers.

### 5.4 Earlier news about fires here

- **What it is:** every published story about the same district, newest first. Its count line names its coverage, for example "12 since Jan 2013 · from The Daily Star, Dhaka Tribune, Samakal; other outlets since \<first run\>".
- **On each card:** up to `NEWS_EARLIER_SHOWN` (3) stories published before this one, plus "See all", which opens `#/news?district=<id>&season=all`.
- **Every past story is a full item,** with its own satellite parts. The calendar covers those dates.
- **The fixed note under it:** "Newspapers don't report every fire. The satellite record above is the full count."

### 5.5 New FIXED constants (`config.py`)

`NEWS_MODEL = "gemini-3.1-flash-lite"`, `NEWS_PROVIDERS` (the ordered fallback list), `NEWS_FEED_FROM = "2025-07-01"` (the main feed's default view), `NEWS_HISTORY_FROM = "2012-07-01"` (history start, matching the VIIRS era), `NEWS_BURN_WINDOW_DAYS = 7`, `NEWS_ENFORCE_WINDOW_DAYS = 14`, `NEWS_CLOUDY_MIN_DAYS = 4`, `NEWS_RARE_SEASON_FRAC = 0.5`, `NEWS_EARLIER_SHOWN = 3`, `NEWS_EVENT_MAX_LAG_DAYS = 30`, `NEWS_CLAIM_MAX_WORDS = 30`, `NEWS_QUOTE_MAX_WORDS = 25`, `NEWS_EXCERPT_MAX_WORDS = 600`, `NEWS_FETCH_DELAY_S = 3`, `NEWS_MAX_FETCH_PER_HOST_PER_RUN`, `NEWS_MAX_LLM_CALLS_PER_RUN`, `NEWS_MAX_RETRIES = 3`, `NEWS_MAX_ITEMS_PER_MONTH`. Also add `SEED_OFFSETS["news"]` and `SEED_OFFSETS["news_audit"]`.

The browser receives the window and threshold values through `news/index.json` (`rules`), never as TypeScript literals.

## 6. Data contract

`web/src/lib/types.ts` stays the authority. Python writes the files, and `tests/test_contracts.py` covers them in the same commit. All news files are optional: if they are absent, the news page and its nav item are hidden.

| File | Content | Loaded |
|---|---|---|
| `news/index.json` | Coverage, rules, counts per season and district, guard drops | On the news page and the Area page |
| `news/places.json` | "How common is fire here?" for each district, and `BGD` | On the news page |
| `news/<season>.json` | That season's stories, sharded by month | One season at a time |
| `news/place/<unit_id>.json` | References to every story about one district, sharded by month | When a card's "Earlier news" is opened, or a district is picked |

```ts
export type NewsKind = 'burning' | 'enforcement' | 'kilns_operating' | 'air_health'

// news/index.json
export interface NewsIndex {
  generated_at: string; store_updated_at: string; data_build: string; model: string
  seasons: string[]                                   // every season with stories, newest first
  rules: { burn_window_days: number; enforce_window_days: number; cloudy_min_days: number; rare_season_frac: number; earlier_shown: number }
  sources: { key: string; outlet: string; lang: 'en' | 'bn'; status: 'active' | 'excluded'
             reason?: string; read_back_to?: string; last_scanned?: string }[]
  counts: Record<string, Record<string, number>>      // season → unit_id ('BGD' = national) → stories
  dropped: { reason: string; n: number }[]            // guard failures, shown for transparency
}

// news/places.json: "How common is fire here?", per district
export interface NewsPlace {
  unit_id: string; name_en: string; name_bn: string   // 'BGD': Bangladesh / বাংলাদেশ
  record_from: string | null                          // first season in the satellite record, e.g. "2003-04"
  seasons_in_record: number
  seasons_with_burning: number                        // measured duration p50 > 0
  typical_duration_days: number | null                // median measured duration
  typical: { first_month: number; busiest_month: number; last_month: number } | null   // busyMonths rule
  news_total: number; news_from: string | null        // earlier-news coverage for the count line
}
export type NewsPlaces = Record<string, NewsPlace>    // unit_id ('BGD' = national) → place

// news/<season>.json
export interface NewsSeason { season: string; months: Record<string, NewsItem[]> }  // "2025-12" → stories

export interface NewsItem {
  news_id: string                                     // first 12 hex of sha256(canonical URL)
  url: string; outlet: string; lang: 'en' | 'bn'
  title: string                                       // from the article page, verbatim
  published_date_local: string
  event_date_local: string; event_date_stated: boolean
  kind: NewsKind
  unit_ids: string[]                                  // district unit_ids, or ['BGD']
  claim_en: string; claim_bn: string
  quote: string                                       // verbatim, in the article's language
  sat: NewsSat                                        // what satellites saw; written by news-pair
  season_so_far: { unusual_days: number | null; not_observed_days: number | null
                   districts_unusual?: number; provisional: boolean; to: string }
  how_common: 'common_now' | 'outside_season' | 'rare' | null   // null for national stories
  earlier_news: number                                // stories about this place published before this one
}

export interface NewsWindow {
  from: string; to: string
  unusual_days: number | null                         // district level; null = can't tell
  not_observed_days: number | null                    // null = not checked (current season)
  districts_unusual?: number                          // national level: districts with ≥ 1 unusual day
}
export type NewsSat =
  | { type: 'window'; level: 'district' | 'national'; provisional: boolean; before: NewsWindow; after?: NewsWindow | null }
  | { type: 'kiln_months'; usual_months: number[] | null; inside: boolean | null }
  | { type: 'burning_season'; usual_months: number[] | null; inside: boolean | null; outlook_frac?: number | null }

// news/place/<unit_id>.json
export interface NewsPlaceStories {
  unit_id: string
  months: Record<string, { news_id: string; date_local: string; season: string; kind: NewsKind
                           outlet: string; lang: 'en' | 'bn'; title: string; url: string }[]>
}
```

- **Why stories are sharded by month:** `check_public_dir` refuses any array whose length equals the cluster or kiln count. Keeping every array at or below `NEWS_MAX_ITEMS_PER_MONTH`, well below both counts, prevents a false failure without weakening the check. A district's full story list over 14 seasons could otherwise reach that size.
- **Stories naming several districts:** `unit_ids` are ordered by first mention in the article, and the satellite parts and `earlier_news` use `unit_ids[0]`. The card names the others ("also mentions …"). Place files and counts list the story under every district it names.
- No field uses a name in `FORBIDDEN_PUBLIC_KEYS`, and no coordinates appear anywhere.
- Budgets go in `check_budgets`: `news/index.json` 50 KB and `news/places.json` 50 KB; season and place files are sized after the first backfill, starting at 1.5 MB per season file and 200 KB per place file.

## 7. Website

- **Route:** `#/news`, lazy-loaded. Filters live in the URL through `useUrlState`: district, kind, season (including "All seasons").
- **Nav:** a "News" item after Area, shown only when `news/index.json` exists (`useNewsVisible`, the same pattern as `useKilnsVisible`).
- **Page header:** one short paragraph explaining the page, and a fixed label: *"Collected by AI from newspapers. Not reviewed by a person. Satellite figures and verdicts come from Kiln Watch's own data, not from the article."*
- **Story card**, in this order (mock-up in section 1):
  1. outlet · date · district;
  2. the headline, linking to the article (`lang` attribute set, opens the news site);
  3. "What the paper says", the claim in the UI language, with the quote in a `<blockquote cite=url>`;
  4. "What satellites saw", in plain words built from `sat`, using the existing `unusual` Gloss;
  5. **"How common is fire here?"**: this season so far, the summary, and the verdict, built from `season_so_far`, `places.json` and `how_common`;
  6. **"Earlier news about fires here (N)"**, closed by default; opening it lazy-loads that district's place file and shows up to 3 earlier stories and "See all";
  7. a link to the district's Area page.
- **Story grouping (display only, in `lib/news.ts`):** items with the same kind and districts and event dates within 1 day show as one card. The first-published item leads, and the others appear under "Also reported by".
- **Default view:** the current season, newest first, grouped by month. Picking a district adds a header showing that district's "How common is fire here?".
- **Sources and coverage panel:** for each outlet, how far back it has been read and when it was last scanned, plus the excluded outlets with their reasons. "No stories" and "not scanned" are different facts, just as "no detection" and "not seen" are in the calendars.
- **Area page:** one line, "N news stories about \<district\> this season →", shown only when N > 0. It opens `#/news` filtered to that district.
- **States:** a missing file shows a `StatusMessage` and hides the nav item; no items after filtering shows a plain message.
- **Not included:** markers on charts, Timeline entries, a Home strip.
- **Files:**
  - new: `pages/NewsPage.tsx`, `lib/news.ts` and `lib/news.test.ts`;
  - edited: `lib/types.ts`, `lib/i18n.ts` (UI text and verdict text in English and Bangla), `main.tsx`, `components/ui.tsx`, `pages/AreaPage.tsx`.
  - No new web dependencies.

## 8. GitHub Actions

**New `news` job in `deploy.yml`**
- Runs alongside `nrt`, with secret `GEMINI_API_KEY`.
- Downloads `news-current` if it exists, runs `python -m kilnwatch news` (new articles first, then history with any budget left), and uploads the store back to `news-current` (job-level `permissions: { contents: write }`, for this job only).
- `continue-on-error: true`, so a news failure never blocks the deploy.

**`deploy` job**
- `needs: [nrt, news]`, and runs whenever `nrt` succeeded or was skipped, whatever `news` did.
- Downloads `news-current` and tolerates its absence.
- Sets up Python and runs `python -m kilnwatch news-pair` before the build.
- The existing safety checks already scan `web/dist/data`, so they cover `news/`.

**Other changes**
- `export --publish` excludes `news/` from `public-data.tar.gz`, as it does `nrt/`.
- **First history run:** a team member runs `python -m kilnwatch news --backfill` locally (2025-26 first), then `--publish`. The daily job continues it from there.
- **The key:** `GEMINI_API_KEY` goes in `.env` (and, empty, in `.env.example`) and in GitHub secrets. It must never be a `VITE_` variable, because Vite copies those into the public JavaScript.

## 9. Project rules

| Rule | How this plan keeps it |
|---|---|
| Pre-registration | News is display only. It never feeds the gates, metrics, classifier or validation, so no amendment is needed. The "how common" verdict is a display rule built from quantities the site already publishes. Using news as evidence later (for example, reported closures as ground truth, or an "agreement" score on the Trust page) would need a dated amendment written first |
| `PRODUCT.md`: every number traceable to a rule | The card's numbers come from existing rules: unusual = above the p90 normal, the busy-months rule, measured season durations. The one new rule is the FIXED "rare" threshold, documented in `config.py` and `pipeline.md` |
| Inv. 3: no kiln ids, cluster ids, candidate flags or coordinates under `web/` | Items carry only district or national ids. Stories are never placed on the map. Claims name no kiln, owner or private person. The name and value checks run on `news/` |
| Inv. 4: people sign verification rows | When built, append these rows; a person signs them: **NEWS**: 30 random published items, drawn with `config.rng("news_audit")`, checked against the articles (claim matches, districts right, quote verbatim, nobody named) · **NEWS**: the "how common" verdict for 5 districts matches their Area page and local knowledge of their burning season · **NEWS**: the Bangla claims, verdicts and page text read correctly to a native speaker · **NEWS**: `#/news` works on a phone in both themes, and the Area link opens the filtered list |
| Inv. 5: tests never read `data/raw` or `data/interim` | Tests use synthetic sitemaps, synthetic HTML written for the tests (no copied articles), synthetic calendars and a mocked Gemini client. The store lives in `data/news/` (add it to `.gitignore`) |
| Inv. 7: seeded randomness | The audit sample uses `config.rng("news_audit")`. If the Gemini API accepts a seed, derive it from `config.rng("news")`. Model output is frozen per article |
| Inv. 8: tests assert closed-form properties | Section 11 |
| Inv. 9: no unbounded loops | Caps on sitemaps, fetches per host, model calls per run and retries. The history backfill stops at `NEWS_HISTORY_FROM` |
| Inv. 10: no grid literals in TypeScript | Not affected. Thresholds reach the browser through `rules` |
| Atomic writes, keys in `.env` | Store and public files are written as `*.tmp`, then renamed. The key is never printed or committed |
| `docs/AI_USE.md` | Add a section 3 for this use: model, what it does and never does, what it sees (excerpts of public news articles), where the output appears, limits, and the free-tier choice |

## 10. Risks and open questions

1. **Gemini's terms. Resolve before going live (step 6).**
   - Age: *"You must be 18 years of age or older to use the APIs."* The terms also bar using the Services in any website or app *"directed towards or is likely to be accessed by individuals under the age of 18."* The Impact page addresses schools and students. This also applies to the existing Gemini chat on the Ask page.
   - EEA/UK: *"You may use only Paid Services when making API Clients available to users in the European Economic Area, Switzerland, or the United Kingdom."* "API Clients" means a *"website, application, or other service"*, and our site is public worldwide. This conflicts with the free-tier choice.
   - Free tier: Google *"uses the content you submit … to provide, improve, and develop"* its products, and *"human reviewers may read, annotate, and process your API input and output."* The terms add: *"Do not submit sensitive, confidential, or personal information to the Unpaid Services."* Excerpting (step 5) reduces this but doesn't remove it.
   - **Ways out:** get a ruling from the team or the Space Apps mentors, move to a paid key, or swap the reading step to another provider. Reading sits behind one function (`extract()`), and sitemap discovery doesn't depend on the model vendor, so a swap stays small.
2. **Measured on 12 Oct 2026: the free tier allows only 20 model requests a day for `gemini-3.8-flash`.** The first real runs made 11 calls and kept 0 stories (10 were judged not relevant). At 20 a day the daily feed fits, but the history backfill will take months, not weeks; a paid key or a later start date for history would change that. **How far back the history reaches by the demo depends on the free-tier daily limit,** which appears only in Google AI Studio and resets at midnight Pacific time. History fills newest first and the coverage panel shows the real reach. As a rough guide, 3 outlets over 14 seasons could mean several thousand keyword-matched articles: days to weeks of free-tier quota.
3. **Each fallback provider's free tier has its own terms and data use.** Read them before adding its key; a provider whose key is not set is never called. Fallback answers pass the same code checks, but only Gemini enforces the reply schema, so weaker models may be dropped more often as `schema_invalid`.
4. **Decide whether plain air-quality stories count.** The pipeline treats an AQI story as `air_health` only when it links the smoke to burning or kilns (section 2). Plain "Dhaka's air is among the worst" stories are dropped as not relevant; counting them would fill the page in winter but pair them with burning data they don't mention.
3. **Newspaper coverage is uneven.** Dhaka gets far more stories than remote districts, so fewer stories doesn't mean fewer fires. The card says so, and the satellite record gives the count.
4. **Confirm the "rare" threshold** (`NEWS_RARE_SEASON_FRAC = 0.5`), and check the verdicts on 5 districts before the demo (section 9).
5. **Upazila level, an option.** Upazila calendars exist (496), so "how common" could use the upazila when a story names one. Phase 1 stays at district level because the live season (NRT) is district-only, and upazila names are often ambiguous: Kaliganj is the name of upazilas in four districts.
6. **A search API for older stories** at the 6 outlets without archives (section 5.1). Pick a provider whose terms allow storing and publishing results.
7. **GitHub Actions addresses may be blocked** by some outlets, as Kaler Kantho already blocks us. The outlet is skipped and the gap shows in the coverage panel. History can also be continued from a team member's machine.
8. **Feed formats change.** A broken source fails alone; the others continue, and the coverage panel shows the gap. `--check-sources` finds it.
9. **Article text is untrusted input** and could carry prompt injection. Schema enums, candidate-only districts, the quote and number guards, length caps, the blocklist and the audit limit the damage.
10. **Winter brings many air-quality stories** from every outlet. Story grouping and the per-run caps keep the page readable.
11. **Excluded outlets.** Revisit The Financial Express, New Age and Kaler Kantho if they publish a feed we can use without working around blocks.

## 11. Tests

**Python, `tests/test_news.py`** (synthetic data only; Gemini mocked; no network)
- Site check accepts `www.thedailystar.net`, and rejects `thedailystar.net.evil.com`, `evil-thedailystar.net`, `haal.fashion` and `http://` links.
- Canonical URLs; merging the same batch twice equals merging it once; the history cursor moves strictly backwards and stops at `NEWS_HISTORY_FROM`.
- Keyword filter on headlines and on URL-encoded Bangla slugs; a building-fire headline doesn't match.
- Gazetteer: names, aliases, upazila to district, and "Sadar" ignored.
- Number guard, including Bangla digits ("৪০টি" matches 40) and separators ("1,200"); quote-substring guard; event-date window; length caps.
- Satellite window checks on synthetic calendars with known unusual and not-observed days, checked against hand-computed counts:
  - burning window;
  - enforcement "after" stays null until complete;
  - kiln months inside or outside;
  - the national district count.
- **How common:**
  - "season so far" counts only days from 1 July to the story date;
  - the typical months match `busyMonths` on a profile peaking in December;
  - a season with duration p50 = 0 isn't counted;
  - with a Nov–Feb profile, a January story is `common_now` and a July story is `outside_season`;
  - an all-zero calendar, or 3 burning seasons out of 10, is `rare`;
  - national stories get `null`.
- **Earlier news:** newest first; this story excluded; only earlier dates counted in `earlier_news`.
- **Output:** `assert_public_safe` passes; no `lat`/`lon` keys; every array at or below `NEWS_MAX_ITEMS_PER_MONTH`; the blocklist removes an item everywhere, including place files and counts; the fetcher stops at its caps.

**TypeScript, `web/src/lib/news.test.ts`:** the grouping key, filters, and the plain-language sentences for each `NewsSat` variant, each verdict and the season line.

**Contract:** `tests/test_contracts.py` accepts both the absent and the present news files under all five fixture sets.

**Fixtures and end-to-end**
- `full` gets a deterministic synthetic news set, so CI tests the populated page. `write_fixtures` builds it with fictional outlets ("Example Daily") and clearly synthetic text, and with no random draws, so other fixture files stay byte-identical.
- The other synthetic branches ship no news files, which tests the hidden state.
- `nokiln` (the verbatim offline copy) gets the real `news/` once a real run exists. `news-pair` builds it from a committed store snapshot, `data/releases/news-store.json`, the same way `nrt-current.json` supplies its NRT season.
- `e2e/smoke.spec.ts` adds `#/news` in day, night and phone layouts with zero console errors (including an opened "Earlier news"), and checks that the nav item is hidden on the other branches.

## 12. Order of work

Suggested dates, so the daily job has a week of live runs before the demo.

| Step | Work | Done when | Suggested by |
|---|---|---|---|
| 1 | Source, keyword and alias CSVs; discovery; `--check-sources`, `--dry-run` | The dry run lists sensible candidates from all 9 active outlets | 16 Oct |
| 2 | Fetch, gazetteer, excerpt, Gemini extraction, guards, store; Python tests | A local daily run stores checked items; every test passes | 21 Oct |
| 3 | History backfill, newest first (2025-26 complete first); `--publish` | `news-current` exists; a quick read-through finds no obvious errors; history keeps growing | 24 Oct |
| 4 | `news-pair`: satellite windows, "how common" with verdicts, earlier news; contract, budgets, safety | Public files pass both safety checks and the contract test | 28 Oct |
| 5 | Website: card with all parts, page, nav, Area link, i18n, TypeScript tests, end-to-end tests, `nokiln` snapshot | `#/news` renders real data; lint, typecheck and every test pass | 2 Nov |
| 6 | Actions: `news` job, deploy changes; docs; `AI_USE.md`; verification rows. **Prerequisite: section 10, item 1 resolved** | A scheduled run deploys news automatically | 5 Nov |
| 7 | A week of live daily runs; fixes; verdict check and audit rows signed | The rows are signed in `VERIFICATION.md` | 11 Nov (freeze) |

Later, outside the demo scope: a search API for older stories, upazila-level "how common", the `--policy-review` flow into the Timeline, and more outlets.

## 13. Docs to update when building

[data-contracts.md](data-contracts.md) (news files, budgets) · [pipeline.md](pipeline.md) (both stages, flags, constants, the verdict rule) · [operations.md](operations.md) (`GEMINI_API_KEY` secret, `news-current` asset, backfill) · [web-frontend.md](web-frontend.md) (route, `lib/news.ts`) · [architecture.md](architecture.md) (sources table, runtime split) · [AI_USE.md](AI_USE.md) (section 3) · [README.md](README.md) (link this plan) · `.env.example` (`GEMINI_API_KEY=`)
