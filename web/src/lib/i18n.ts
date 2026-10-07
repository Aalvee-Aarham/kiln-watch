import { useSearchParams } from 'react-router'
import type { Lang } from './url'

// UI chrome only. Long-form Story/Method prose is English, with a visible note under ?lang=bn.
const S = {
  story: ['Story', 'গল্প'], explore: ['Explore', 'অন্বেষণ'], kilns: ['Kiln seasons', 'ভাটা মৌসুম'], season: ['This season', 'এই মৌসুম'],
  evidence: ['Evidence', 'প্রমাণ'], method: ['Method', 'পদ্ধতি'],
  pick: ['Find a district or upazila', 'জেলা বা উপজেলা খুঁজুন'], harm: ['Harmonized', 'সমন্বিত'], raw: ['Raw', 'অপরিশোধিত'],
  cal: ['Calendar year', 'পঞ্জিকা বছর'], seasonLayout: ['Season year (Jul–Jun)', 'মৌসুম বছর (জুলাই–জুন)'],
  all: ['All sources', 'সব উৎস'], download: ['Download', 'ডাউনলোড'], provisional: ['Provisional', 'অস্থায়ী'],
  unit: ['MYD-eq cell-days per 1,000 clear cells', 'প্রতি ১,০০০ মেঘমুক্ত ঘরে MYD-সমতুল্য ঘর-দিন'],
  skip: ['Skip to content', 'মূল অংশে যান'], themeDay: ['Switch to day theme', 'দিনের থিমে যান'], themeNight: ['Switch to night theme', 'রাতের থিমে যান'],
  district: ['District', 'জেলা'], upazila: ['Upazila', 'উপজেলা'], level: ['Area level', 'এলাকার স্তর'],
  draw: ['Draw an area', 'এলাকা আঁকুন'], drawing: ['Drag to draw · min 100 km² · Esc cancels', 'টেনে আঁকুন · কমপক্ষে ১০০ বর্গকিমি · Esc বাতিল'],
  coords: ['Enter coordinates', 'স্থানাঙ্ক লিখুন'], apply: ['Open this area', 'এই এলাকা খুলুন'],
  startWith: ['Start with an area', 'একটি এলাকা দিয়ে শুরু করুন'], aboveNow: ['Running above normal this season', 'এই মৌসুমে স্বাভাবিকের চেয়ে বেশি'],
  recent: ['Recently viewed', 'সম্প্রতি দেখা'], noMatch: ['No area by that name. Try the Bangla name, or draw an area.', 'এই নামে কোনো এলাকা নেই। বাংলা নাম লিখুন বা এলাকা আঁকুন।'],
  calendar: ['Calendar', 'পঞ্জিকা'], vsNormal: ['Season vs normal', 'মৌসুম বনাম স্বাভাবিক'], sources: ['Sources', 'উৎস'], data: ['Data', 'তথ্য'],
  everyDay: ['Every day since 2003', '২০০৩ থেকে প্রতিদিন'], whereHeat: ['Where the heat comes from', 'তাপ কোথা থেকে আসে'],
  metrics: ['Season metrics (95% intervals)', 'মৌসুমের পরিমাপ (৯৫% ব্যবধান)'], viewTable: ['View as table', 'সারণি হিসেবে দেখুন'],
  patterns: ['Patterns', 'নকশা'], pass: ['Pass', 'উত্তীর্ণ'], fail: ['Fail', 'অনুত্তীর্ণ'], replay: ['Replay', 'আবার দেখুন'],
  openDistrict: ['Open your district', 'আপনার জেলা খুলুন'], seeSeason: ['See this season', 'এই মৌসুম দেখুন'],
  mapNote: ['Use search to pick an area by keyboard.', 'কিবোর্ডে এলাকা বাছতে খোঁজ ব্যবহার করুন।'],
  englishOnly: ['', 'এই অংশটি এখনো ইংরেজিতে।'], ctrlZoom: ['Hold Ctrl to zoom the map', 'মানচিত্র বড় করতে Ctrl চেপে রাখুন'],
  daysAbove: ['days above normal this season', 'এই মৌসুমে স্বাভাবিকের চেয়ে বেশি দিন'], showMap: ['Map', 'মানচিত্র'],
  seasonShort: ['Season', 'মৌসুম'], kilnsShort: ['Kilns', 'ভাটা'],
  area: ['My area', 'আমার এলাকা'], areaShort: ['Area', 'এলাকা'], planner: ['Kiln planner', 'ভাটা পরিকল্পনা'],
  sensors: ['Sensor switch', 'সেন্সর বদল'], sensorsShort: ['Sensors', 'সেন্সর'], timeline: ['Timeline', 'সময়রেখা'], timelineShort: ['Events', 'ঘটনা'],
  impact: ['Who benefits', 'কারা উপকৃত'], impactShort: ['Uses', 'ব্যবহার'], experts: ['For experts', 'বিশেষজ্ঞদের জন্য'], expertsShort: ['Experts', 'বিশেষজ্ঞ'],
  how: ['How it works', 'কীভাবে কাজ করে'], howShort: ['How', 'কীভাবে'], trust: ['Can you trust it?', 'বিশ্বাস করা যায়?'], trustShort: ['Trust', 'আস্থা'],
  ctrlScroll: ['Hold Ctrl and scroll to zoom.', 'জুম করতে Ctrl চেপে স্ক্রল করুন।'],
  bangladesh: ['Bangladesh', 'বাংলাদেশ'], division: ['division', 'বিভাগ'], yourArea: ['Your area', 'আপনার এলাকা'],
  mappedKilns: ['mapped kilns (APAD inventory)', 'তালিকাভুক্ত ভাটা (APAD)'],
  twoSeasons: ['Fires and kilns', 'আগুন ও ভাটা'], twoSeasonsTitle: ['Two burning seasons: fires and kilns', 'দুই পোড়ানোর মৌসুম: আগুন ও ভাটা'],
  normalRange: ['Normal range (middle 80%)', 'স্বাভাবিক পরিসর (মাঝের ৮০%)'], median: ['Median', 'মধ্যমা'], mean7: ['7-day mean', '৭ দিনের গড়'],
  unusualDay: ['Unusual day (above p90)', 'অস্বাভাবিক দিন (p90-এর উপরে)'], critical: ['critical', 'সংকটকাল'], today: ['today', 'আজ'],
  notObserved: ['Not observed (cloud)', 'দেখা যায়নি (মেঘ)'], cloud: ['Cloud', 'মেঘ'], low: ['Low', 'কম'], high: ['High', 'বেশি'],
  clickSeason: ['Click to open this season', 'ক্লিক করে এই মৌসুম খুলুন'], perClear: ['MYD-eq per 1,000 clear cells', 'প্রতি ১,০০০ মেঘমুক্ত ঘরে MYD-eq'],
  kilnTypical: ['Kilns: typical season', 'ভাটা: সাধারণ মৌসুম'], middleHalf: ['Middle half of seasons', 'মৌসুমগুলোর মাঝের অর্ধেক'],
  firesAvg: ['Fires: average season', 'আগুন: গড় মৌসুম'], lowerPanel: ['lower panel', 'নিচের প্যানেল'],
  kilnExcess: ['Kiln excess', 'ভাটার বাড়তি সংকেত'], fireActivity: ['Fire activity (MYD-eq)', 'আগুনের মাত্রা (MYD-eq)'], seasonSum: ['Season sum (MYD-eq)', 'মৌসুমের মোট (MYD-eq)'],
  harvest: ['harvest', 'ধান কাটা'], aman: ['Aman', 'আমন'], boro: ['Boro', 'বোরো'],
  colSeason: ['Season', 'মৌসুম'], colMid: ['Midpoint (day)', 'মধ্যবিন্দু (দিন)'], colDur: ['Duration (days)', 'স্থায়িত্ব (দিন)'], colPeak: ['Peak', 'শীর্ষ'],
  colFirst: ['First*', 'প্রথম*'], colLast: ['Last*', 'শেষ*'],
  dlCsv: ['spreadsheet', 'স্প্রেডশিট'], dlJson: ['full data', 'পূর্ণ তথ্য'], dlPng: ['chart image', 'চার্টের ছবি'],
  demoReal: ['Real satellite data: offline copy of the real pipeline build (the live site refreshes daily)', 'প্রকৃত স্যাটেলাইট তথ্য: প্রকৃত পাইপলাইন বিল্ডের অফলাইন অনুলিপি (লাইভ সাইট প্রতিদিন হালনাগাদ হয়)'],
  demoSynthetic: ['Demo mode: synthetic data, not real satellite observations. The live site serves real data.', 'ডেমো মোড: কৃত্রিম তথ্য, প্রকৃত স্যাটেলাইট পর্যবেক্ষণ নয়। লাইভ সাইটে প্রকৃত তথ্য রয়েছে।'],
} as const

const DIVISION_BN: Record<string, string> = { Dhaka: 'ঢাকা', Chattogram: 'চট্টগ্রাম', Chittagong: 'চট্টগ্রাম', Rajshahi: 'রাজশাহী', Khulna: 'খুলনা',
  Barishal: 'বরিশাল', Barisal: 'বরিশাল', Sylhet: 'সিলেট', Rangpur: 'রংপুর', Mymensingh: 'ময়মনসিংহ' }
/** "Dhaka division" / "ঢাকা বিভাগ". */
export const divisionName = (d: string, lang: Lang) => (lang === 'bn' ? `${DIVISION_BN[d] ?? d} বিভাগ` : `${d} division`)

/** Short month names, January first ("Sep", never en-GB "Sept"). */
export const monthNames = (lang: Lang) => Array.from({ length: 12 }, (_, m) =>
  new Intl.DateTimeFormat(lang === 'bn' ? 'bn-BD' : 'en-US', { month: 'short', timeZone: 'UTC' }).format(Date.UTC(2001, m, 1)))
export type Key = keyof typeof S

export function useLang(): Lang {
  const [sp] = useSearchParams()
  return sp.get('lang') === 'bn' ? 'bn' : 'en'
}

export function useT() {
  const lang = useLang()
  return (k: Key) => S[k][lang === 'bn' ? 1 : 0] || S[k][0]
}

export const fmtNumber = (v: number, lang: Lang, digits = 2) =>
  new Intl.NumberFormat(lang === 'bn' ? 'bn-BD' : 'en-US', { maximumFractionDigits: digits }).format(v)
