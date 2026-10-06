import { useSearchParams } from 'react-router'
import type { Lang } from './url'

const S = {
  story: ['Story', 'গল্প'], explore: ['Explore', 'অন্বেষণ'], kilns: ['Kiln seasons', 'ভাটা মৌসুম'], season: ['This season', 'এই মৌসুম'],
  evidence: ['Evidence', 'প্রমাণ'], method: ['Method', 'পদ্ধতি'],
  pick: ['Find a district or upazila', 'জেলা বা উপজেলা খুঁজুন'], harm: ['Harmonized', 'সমন্বিত'], raw: ['Raw', 'অপরিশোধিত'],
  cal: ['Calendar year', 'পঞ্জিকা বছর'], seasonLayout: ['Season year (Jul–Jun)', 'মৌসুম বছর (জুলাই–জুন)'],
  all: ['All sources', 'সব উৎস'], download: ['Download', 'ডাউনলোড'], provisional: ['Provisional', 'অস্থায়ী'],
  unit: ['MYD-eq cell-days per 1,000 clear cells', 'প্রতি ১,০০০ মেঘমুক্ত ঘরে MYD-সমতুল্য ঘর-দিন'],
} as const
export type Key = keyof typeof S

export function useLang(): Lang {
  const [sp] = useSearchParams()
  return sp.get('lang') === 'bn' ? 'bn' : 'en'
}

export function useT() {
  const lang = useLang()
  return (k: Key) => S[k][lang === 'bn' ? 1 : 0]
}

export const fmtNumber = (v: number, lang: Lang, digits = 2) =>
  new Intl.NumberFormat(lang === 'bn' ? 'bn-BD' : 'en-US', { maximumFractionDigits: digits }).format(v)
