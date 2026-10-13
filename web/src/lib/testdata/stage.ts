// Inline synthetic inputs for the Ask stage tests: every expected value follows from these by arithmetic.
import { dateToDay } from '../days'
import type { Calendar, Events, Harmonization, Meta, NrtSeason } from '../types'

const nov = (y: number) => dateToDay(`${y}-11-15`)
/** Burning only on 15 November: 2 in each season 2003-04 … 2005-06, 4 in 2006-07; record to 1 March 2007. */
export const CAL = {
  unit_id: 'BD0000', day0: '2003-01-01', raw: {}, h_lo: [], h_hi: [], week0: '2003-01-01', clear_frac: {},
  days: [0, nov(2003), nov(2004), nov(2005), nov(2006), dateToDay('2007-03-01')], h: [0, 2, 2, 2, 4, 0],
  split: [{ key: 'a', values: [0, 1, 1, 1, 2, 0] }, { key: 'b', values: [0, 1, 1, 1, 2, 0] }],
  nodata: [], normal: { p10: Array(366).fill(0), p50: Array(366).fill(1), p90: Array(366).fill(3) },
  unusual: [nov(2005)], critical: [], seasons: [],
} as unknown as Calendar

/** Live season 2006-07 from 1 July 2006 to 15 November 2006, all burning on the last day. */
const n = dateToDay('2006-11-15') - dateToDay('2006-07-01') + 1
export const NRT = {
  updated_at: '2006-11-16T00:00:00+00:00', provisional: true, season: '2006-07', day0: '2006-07-01',
  national: { h: [], split: [] },
  districts: { BD0000: { h: Array.from({ length: n }, (_, i) => (i === n - 1 ? 4 : 0)), above_p90_days: 3 } },
} as unknown as NrtSeason

export const EVENTS: Events = {
  policy: [{ date: '2013-11-10', label_en: 'A law passed', label_bn: '', url: 'https://example.org/law' }],
  satellite: [{ date: '2002-05-04', label_en: 'Aqua launched (MODIS)', label_bn: '', url: 'https://aqua.nasa.gov/' }],
  harvest: [],
}
export const META = { git_sha: 'abc1234' } as unknown as Meta
export const HARM = { selected_model: 'M0', seam: { ratio: 0.03 } } as unknown as Harmonization

/** Stage data for one district, using the synthetic calendar under that district's id. */
export const stageData = (unitId: string, unitName: string, alsoNames: string[] = []) => ({
  unitId, unitName, division: 'Test', alsoNames,
  cal: { ...CAL, unit_id: unitId },
  nrt: { ...NRT, districts: { [unitId]: NRT.districts.BD0000 } },
  ka: null, events: EVENTS, meta: META, harm: HARM,
})
