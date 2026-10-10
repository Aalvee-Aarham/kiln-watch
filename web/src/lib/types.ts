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
  districts: Record<string, { clim: number[]; if_recent: number[]; if_quiet: number[] }>  // one value per week from `start`
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

/** ask.json: cached Ask Kiln Watch answers (kilnwatch/ask.py build_cache). Optional file. */
export interface AskCache {
  model: string; generated_at: string; data_build: string | null
  answers: { question: string; lang: 'en' | 'bn'; answer: string | null; blocked: boolean; reason?: string; unsupported?: number[]
             tools: { name: string; input: Record<string, string>; result: Record<string, unknown> }[] }[]
}
