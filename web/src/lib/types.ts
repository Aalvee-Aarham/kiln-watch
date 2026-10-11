// THE CONTRACT (implementation_plan §7.3). Frozen at S3; changes need a same-commit Python change + contract tests.
export type Sensor = 'T' | 'A' | 'N' | 'J1' | 'J2'
export type Pass = 'D' | 'N'
export interface CI { p50: number; lo: number; hi: number }
export type GateBranch = 'full' | 'from2012' | 'partial' | 'nightfire' | 'nokiln'

export interface Meta {
  generated_at: string; git_sha: string; prereg_sha: string
  params: Record<string, number | string>
  data_versions: Record<string, string>
  credits: { name: string; url: string; licence: string }[]
  non_claims: { en: string; bn: string }[]
  gate_branch: GateBranch
  split_labels: { key: string; label_en: string; label_bn: string }[]
  activity_index: { key: 'HKFI' | 'HBI'; label_en: string; label_bn: string }
  grid: { origin_lat: number; origin_lon: number; step: number; rows: number; cols: number }
  demo?: { mode: 'real-offline-copy'; source_sha: string | null; nrt_updated_at: string | null; note_en: string; note_bn: string } // fixtures only
}

export interface UnitProps {
  unit_id: string; level: 'district' | 'upazila' | 'transfer'
  name_en: string; name_bn: string; division: string
  kiln_count: number | null; kiln_share: number | null
}

export interface Calendar {
  unit_id: string; day0: '2003-01-01'
  days: number[]                                       // sparse: day indices since day0 with any activity
  raw: Partial<Record<Sensor, number[]>>               // per-sensor rate per 1000 clear cells, aligned to days
  h: number[]                                          // harmonized MYD-eq, aligned to days
  split: { key: string; values: number[] }[]
  index?: number[]                                     // HKFI or HBI per meta.activity_index
  nodata: [number, number][]                           // inclusive runs of not-observed days
  clear_frac?: Partial<Record<Sensor, number[]>>       // districts only, dense, 0–100 ints
  week0: string; h_lo: number[]; h_hi: number[]        // weekly CI, dense from week0
  normal: { p10: number[]; p50: number[]; p90: number[] } // per day of season (0 = 1 July), 366 values
  unusual: number[]; critical: [number, number][]      // unusual: day indices; critical: day-of-season windows
  seasons: { season: string; midpoint: CI; duration: CI; peak: CI; first?: string; last?: string }[]
}

export interface Harmonization {
  selected_model: 'M0' | 'M1'
  yearly: { season: string; raw_sum: number; raw_by_sensor: Partial<Record<Sensor, number>>; h: CI; aqua_obs: number | null }[]
  betas: { step: 'A<-N' | 'N<-J1' | 'J1<-J2'; division: string; month: number; pass: Pass
           loc: 'kiln' | 'other'; beta: CI; rung_used: number; n_celldays: number; n_days: number }[]
  loso_by_season: { season: string; model: 'M0' | 'M1'; mae: number; bias: number; covered: number }[]
  loso_pooled: { model: 'M0' | 'M1'; n: number; covered: CI }
  seam: { d_raw: number; d_harm: number; ratio: number; chow_p_raw: number; chow_p_harm: number }
  sp_nrt_ratio?: CI
  /** Aqua MODIS vs S-NPP VIIRS on district-months both saw (validate.overlap_agreement): VIIRS/Aqua total ratio and Lin's CCC, raw vs harmonized */
  overlap?: { period: 'calibration' | 'held_out'; seasons: string; n_months: number; n_districts: number
              ratio_raw: CI; ratio_harm: CI; ccc_raw: CI; ccc_harm: CI }[]
}

/** outlook.json: the two-week unusual-fire outlook per district and its backtest (validate.outlook). Optional file. */
export interface Outlook {
  rule: string; start: string; step_days: number; window_days: number; weeks: number
  backtest: { seasons: string; n: number; n_districts: number; baseline: string; base_rate: number; brier_skill: CI }
  ships: boolean
  districts: Record<string, { clim: (number | null)[]; if_recent: (number | null)[]; if_quiet: (number | null)[] }>  // one value per week from `start`; null = no estimate
}

export interface Validation {
  gates: { gate: 'G0' | 'G1' | 'G2' | 'G3' | 'GN'; criterion: string; value: number; threshold: string; p?: number; pass?: boolean }[]
  profiles: { week: string[]; kiln_day: number[]; kiln_night: number[]; ctrl_day: number[]; ctrl_night: number[] }
  radius_sweep: { radius_m: number; kiln: number; ctrl: number }[]
  classifier: { pr_curve: [number, number][]; pr_auc: CI; baseline_pr_auc: number; prevalence: number
                importance: { feature: string; value: number }[]
                holdouts: { kind: 'spatial' | 'temporal' | 'cross_sensor_N_J1' | 'cross_sensor_J1_J2'; pr_auc: CI }[]
                labelset: { kind: 'footprint_only' | 'with_type2'; pr_auc: CI }[]
                ablation_no_persistence?: CI }
  controls: { dropped_frac: number; by_division: Record<string, number>; rung_counts: Record<string, number> }
  candidates: { n: number; precision_skdb?: CI; precision_s2?: CI; kappa?: number; by_district: Record<string, number> }
  tropomi?: { treatment: 'HKFI' | 'HBI'; did_no2: CI; did_so2?: CI; monthly: { month: string; belt_minus_ring: number; index: number }[] }
  pm25?: { lag: number; r_kiln: CI; r_veg: CI }[]
  transfer?: { district: string; dr_computed: boolean; pr_auc: CI; gate_pass: boolean }
  closure_cases?: { title: string; before_dr: number; after_dr: number; note: string }[]
  skipped?: { stage: string; reason: string }[]
}

export interface Events {
  policy: { date: string; label_en: string; label_bn: string; url: string }[]
  satellite?: { date: string; label_en: string; label_bn: string; url: string }[]  // launches and planned ends (older builds: absent)
  harvest: { crop: string; start_doy: number; end_doy: number; url: string }[]
}

export interface NrtSeason {
  updated_at: string; provisional: true; season: string; day0: string
  national: { h: number[]; split: { key: string; values: number[] }[] }
  districts: Record<string, { h: number[]; above_p90_days: number }>
}

export interface GridTile { tile: string; day0: string; rows: [cell: number, day: number, sensorPass: number][] }

// kiln_activity.json (Amendment 1): kiln activity from night lights / radar. Optional file; area-level only.
export type Series = (number | null)[]
export interface KilnSeasonRow { season: string; onset: CI | null; end: CI | null; duration: CI | null; peak: CI | null; peak_value: CI | null }
export interface KilnArea { n_clusters: number; e?: Series; lo?: Series; hi?: Series; seasons: KilnSeasonRow[] }  // upazilas: seasons only
export interface KilnActivity {
  layer: 'ntl' | 's1' | null
  pilots: { channel: string; measure: string; kiln: string; control: string; reading: string }[]
  tests: { test: 'GL' | 'GS'; criterion: string; value: number | null; threshold: string; p?: number | null; pass: boolean }[]
  pass: Partial<Record<'GL' | 'GS', boolean>>
  non_claims?: { en: string; bn: string }[]
  contamination?: { detections: number; kiln_share: number; control_share: number; period: string }  // fire detections on kiln vs control footprints
  cadence?: 'half-month' | 'month'
  periods?: string[]                       // period start dates, aligned with every e/lo/hi
  national?: KilnArea
  areas?: Record<string, KilnArea>
  national_check?: { channel: 's1'; periods: string[]; e: Series; lo: Series; hi: Series }
  transfer?: { countries: TransferCountry[] }  // Amendment 2: the method in other countries; country-level only
}

export type TransferTest = 'TL' | 'LL' | 'TS' | 'LS'  // night lights / radar × Bangladesh's months (T) / locally learned months (L)
export interface TransferChannel {
  learned: { core: number[]; off: number[] }        // calendar months (1-12), July-to-June order
  profile: { months: number[]; p50: Series; lo: Series; hi: Series; n_clusters: number }  // median kiln excess per month
  n_calibration?: number; n_confirmation?: number
  tests: { test: TransferTest; criterion: string; value: number | null; threshold: string; p?: number | null; pass: boolean }[]
  pass: Partial<Record<TransferTest, boolean>>
}
export interface TransferCountry {
  code: string; name: string; source?: string; n_kilns?: number; n_clusters: number; n_sampled?: number; n_dropped?: number; evaluable?: boolean
  channels: Partial<Record<'ntl' | 's1', TransferChannel>>
  design?: string            // 'A2' first test (Amendments 2-3), 'A4' retest
  retest?: TransferCountry   // Amendment 4: fresh clusters, controls >= 6 km from every kiln
}

export interface FC { type: 'FeatureCollection'; features: { type: 'Feature'; properties: UnitProps; geometry: GeoJSON.Geometry }[] }

// news/ (docs/news_plan.md §6): newspaper stories beside our own satellite data, written by kilnwatch/news_pair.py.
// Optional files: absent = no news page. Area-level only: district unit_ids or 'BGD' (national); no coordinates.
// Every number here comes from our data, never from the model; the model writes only claim_en/claim_bn and picks quote.
export type NewsKind = 'burning' | 'enforcement' | 'kilns_operating' | 'air_health'

/** news/index.json: coverage, rules and counts. Loaded by the news page and the Area page. */
export interface NewsIndex {
  generated_at: string; store_updated_at: string | null; data_build: string; model: string
  seasons: string[]                                    // every season with stories, newest first
  rules: { burn_window_days: number; enforce_window_days: number; cloudy_min_days: number; rare_season_frac: number; earlier_shown: number }
  sources: { key: string; outlet: string; lang: 'en' | 'bn'; status: 'active' | 'excluded'
             reason?: string; read_back_to?: string | null; last_scanned?: string | null }[]
  counts: Record<string, Record<string, number>>       // season -> unit_id ('BGD' = national) -> stories naming it
  dropped: { reason: string; n: number }[]             // guard failures, shown for transparency
}

/** news/places.json entry: "How common is fire here?" for one district (or 'BGD'), from its calendar. */
export interface NewsPlace {
  unit_id: string; name_en: string; name_bn: string    // 'BGD': Bangladesh / বাংলাদেশ
  record_from: string | null                          // first season in the satellite record, e.g. "2003-04"
  seasons_in_record: number
  seasons_with_burning: number                         // seasons whose measured burning season lasted > 0 days (duration p50)
  typical_duration_days: number | null                 // median measured duration
  typical: { first_month: number; busiest_month: number; last_month: number } | null  // busyMonths rule; calendar months 1-12
  news_total: number; news_from: string | null         // earlier-news coverage, for the count line
}
export type NewsPlaces = Record<string, NewsPlace>     // unit_id ('BGD' = national) -> place

export interface NewsWindow {
  from: string; to: string
  unusual_days: number | null                          // district level; null = can't tell (cloud) or a national story
  not_observed_days: number | null                     // null = not checked (current season, provisional)
  districts_unusual?: number                           // national stories: districts with >= 1 unusual day
}
export type NewsSat =
  | { type: 'window'; level: 'district' | 'national'; provisional: boolean; before: NewsWindow; after?: NewsWindow | null }  // after: enforcement only; null until complete
  | { type: 'kiln_months'; usual_months: number[] | null; inside: boolean | null }
  | { type: 'burning_season'; usual_months: number[] | null; inside: boolean | null; outlook_frac?: number | null }

export interface NewsItem {
  news_id: string                                      // first 12 hex of sha256(canonical URL)
  url: string; outlet: string; lang: 'en' | 'bn'
  title: string                                        // from the article page, verbatim
  published_date_local: string
  event_date_local: string; event_date_stated: boolean // event date = publication date when the article gives none
  kind: NewsKind
  unit_ids: string[]                                   // ordered by first mention; the satellite parts use unit_ids[0]; ['BGD'] = national
  claim_en: string; claim_bn: string
  quote: string                                        // verbatim, in the article's language
  sat: NewsSat                                         // what satellites saw around the event date
  season_so_far: { unusual_days: number | null; not_observed_days: number | null; districts_unusual?: number; provisional: boolean; to: string }
  how_common: 'common_now' | 'outside_season' | 'rare' | null  // null for national stories (no national normal)
  earlier_news: number                                 // stories about unit_ids[0] published before this one
}
/** news/<season>.json: one season's stories, sharded by month ("2025-12"). */
export interface NewsSeason { season: string; months: Record<string, NewsItem[]> }

/** news/place/<unit_id>.json: every published story naming one district (or 'BGD'), sharded by month, newest first. */
export interface NewsPlaceStory { news_id: string; date_local: string; season: string; kind: NewsKind; outlet: string; lang: 'en' | 'bn'; title: string; url: string }
export interface NewsPlaceStories { unit_id: string; months: Record<string, NewsPlaceStory[]> }

/** ask.json: cached Ask Kiln Watch answers (kilnwatch/ask.py build_cache). Optional file. */
export interface AskCache {
  model: string; generated_at: string; data_build: string | null
  answers: { question: string; lang: 'en' | 'bn'; answer: string | null; blocked: boolean; reason?: string; unsupported?: number[]
             tools: { name: string; input: Record<string, string>; result: Record<string, unknown> }[] }[]
}
