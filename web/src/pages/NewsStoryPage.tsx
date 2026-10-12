import { useMemo } from 'react'
import { Link, useParams } from 'react-router'
import BdMap from '../components/BdMap'
import { Icon, StatusMessage, useNewsIndex, useTitle } from '../components/ui'
import { useJson } from '../lib/data'
import { useLang, useT } from '../lib/i18n'
import { districtCount, findGroup, groupStories, NATIONAL, seasonItems } from '../lib/news'
import type { FC, NewsPlaces, NewsSeason } from '../lib/types'
import { StoryCard } from './NewsPage'

/** One story in full (`#/news/story/<season>/<news_id>`): the list page's card, with where it happened. */
export default function NewsStoryPage() {
  const t = useT()
  const lang = useLang()
  const { season, newsId } = useParams()
  const index = useNewsIndex()
  const places = useJson<NewsPlaces>(index.data ? 'news/places.json' : null)
  const known = !!season && !!index.data?.seasons.includes(season)
  const file = useJson<NewsSeason>(known ? `news/${season}.json` : null)
  const dists = useJson<FC>('aoi/districts.geojson')
  const group = useMemo(() => (file.data ? findGroup(groupStories(seasonItems(file.data)), newsId) : undefined), [file.data, newsId])
  useTitle(group?.lead.title ?? t('news'))

  const q = new URLSearchParams()
  if (season && known) q.set('season', season)
  if (group) q.set('story', group.lead.news_id)
  if (lang === 'bn') q.set('lang', 'bn')
  const back = (
    <Link className="inline-flex items-center gap-1 text-sm text-orbit underline" to={`/news/map${q.size ? `?${q}` : ''}`}>
      <Icon name="chevron" className="h-3.5 w-3.5 rotate-180" />{t('backToMap')}</Link>)

  if (index.error) return <div className="space-y-4">{back}<StatusMessage kind="info">{t('newsMissing')}</StatusMessage></div>
  if (!index.data || !places.data || (known && !file.data && !file.error)) return <StatusMessage kind="loading">{t('newsLoading')}</StatusMessage>
  if (file.error) return <div className="space-y-4">{back}<StatusMessage kind="error">{t('newsSeasonMissing')}</StatusMessage></div>
  if (!group) return <div className="space-y-4">{back}<StatusMessage kind="info">{t('storyMissing')}</StatusMessage></div>
  const main = group.lead.unit_ids[0]

  return (
    <div className="space-y-5">
      {back}
      <h1 className="sr-only">{group.lead.title}</h1>
      <p role="note" className="flex items-start gap-2 rounded-[6px] border border-warn/40 bg-warn-soft px-3 py-2 text-sm font-medium">
        <span className="text-warn"><Icon name="info" className="mt-0.5 h-4 w-4" /></span><span>{t('newsLabel')}</span>
      </p>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <ol className="min-w-0"><StoryCard group={group} idx={index.data} places={places.data} nDistricts={districtCount(places.data)} /></ol>
        {dists.data && main !== NATIONAL && (
          <aside className="space-y-1.5 lg:sticky lg:top-20">
            <BdMap fc={dists.data} selected={main} onSelect={() => {}} drawing={false} onBox={() => {}}
              labels={false} pins={{ [main]: 1 }} className="h-[300px] rounded-[10px] border border-line" />
          </aside>)}
      </div>
    </div>
  )
}
