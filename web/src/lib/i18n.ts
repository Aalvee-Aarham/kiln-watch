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
} as const
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
