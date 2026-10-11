import { useId, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Icon, StatusMessage, useNewsIndex, useTitle } from '../components/ui'
import { Caution, Gloss, PageHead } from '../components/plain'
import { useJson } from '../lib/data'
import { tr, useLang, useT } from '../lib/i18n'
import { useUrlState, type Lang } from '../lib/url'
import {
  byMonth, dayMonth, digits, districtCount, earlierStories, filterItems, fullDate, groupStories, kindKey, monthYear, NATIONAL, NEWS_KINDS,
  outletCounts, placeName, placeStoryList, recordHeading, satLines, seasonItems, seasonLine, shortMonthYear, sourceText, storyCount,
  summaryLines, verdictText, type NewsGroup,
} from '../lib/news'
import type { NewsIndex, NewsItem, NewsKind, NewsPlace, NewsPlaces, NewsPlaceStories, NewsSeason } from '../lib/types'

/** `#/news?…` keeping the UI language. */
const newsTo = (params: Record<string, string | undefined>, lang: Lang) => {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v)
  if (lang === 'bn') sp.set('lang', 'bn')
  return `/news?${sp}`
}
const langQ = (lang: Lang) => (lang === 'bn' ? '?lang=bn' : '')

/**
 * News (docs/news_plan.md §7): newspaper stories collected by AI, each beside our own satellite record: what
 * satellites saw around the date, how common fire is there, and earlier news. Area-level only; no map, no markers.
 */
export default function NewsPage() {
  const t = useT()
  const lang = useLang()
  useTitle(t('news'))
  const [u, set] = useUrlState()
  const [sp] = useSearchParams()
  const index = useNewsIndex()
  const places = useJson<NewsPlaces>(index.data ? 'news/places.json' : null)
  const seasons = index.data?.seasons ?? []
  const season = u.season === 'all' ? 'all' : u.season && seasons.includes(u.season) ? u.season : seasons[0]
  const kindParam = sp.get('kind')
  const kind = NEWS_KINDS.find((k) => k === kindParam)
  const districtParam = sp.get('district') ?? undefined
  const district = districtParam && places.data?.[districtParam] ? districtParam : undefined
  const seasonFile = useJson<NewsSeason>(season && season !== 'all' ? `news/${season}.json` : null)
  const placeFile = useJson<NewsPlaceStories>(district ? `news/place/${district}.json` : null)

  if (index.error)
    return (
      <div className="space-y-6">
        <PageHead title={t('newsTitle')} />
        {index.error.endsWith('was not found') ? <StatusMessage kind="info">{t('newsMissing')}</StatusMessage>
          : <StatusMessage kind="error">{t('newsMissing')} ({index.error})</StatusMessage>}
      </div>)
  if (!index.data || !places.data) return <StatusMessage kind="loading">{t('newsLoading')}</StatusMessage>
  const idx = index.data, pl = places.data
  const nDistricts = districtCount(pl)
  const allItems = seasonFile.data ? seasonItems(seasonFile.data) : []
  const items = filterItems(allItems, { district, kind })

  return (
    <div className="space-y-8">
      <PageHead title={t('newsTitle')}>{t('newsIntro')}</PageHead>
      <p role="note" className="flex items-start gap-2 rounded-[6px] border border-warn/40 bg-warn-soft px-3 py-2 text-sm font-medium">
        <span className="text-warn"><Icon name="info" className="mt-0.5 h-4 w-4" /></span><span>{t('newsLabel')}</span>
      </p>

      <Filters places={pl} seasons={seasons} district={district} kind={kind} season={season} set={set} />
      {districtParam && !district && <StatusMessage kind="info">{tr('unknownDistrict', lang, { id: districtParam })}</StatusMessage>}

      {district && <DistrictHeader place={pl[district]} />}

      {season === 'all' ? (
        district ? <AllSeasonsList place={pl[district]} file={placeFile} kind={kind} />
          : <div className="space-y-2">
            <p>{t('pickDistrictAll')}</p>
            <ul className="flex flex-wrap gap-2">{seasons.map((s) => <li key={s}><Link className="btn" to={newsTo({ season: s, kind }, lang)}>{tr('openSeason', lang, { season: digits(s, lang) })}</Link></li>)}</ul>
          </div>
      ) : seasonFile.error ? <StatusMessage kind="error">{t('newsSeasonMissing')}</StatusMessage>
        : !seasonFile.data ? <StatusMessage kind="loading">{t('newsLoading')}</StatusMessage>
          : <StoryList items={items} idx={idx} places={pl} nDistricts={nDistricts} />}

      <SourcesPanel idx={idx} items={season === 'all' ? undefined : allItems} />
    </div>
  )
}

function Filters({ places, seasons, district, kind, season, set }: {
  places: NewsPlaces; seasons: string[]; district?: string; kind?: NewsKind; season?: string; set: (p: Record<string, string | undefined>) => void
}) {
  const t = useT()
  const lang = useLang()
  const opts = useMemo(() => Object.values(places).filter((p) => p.unit_id !== NATIONAL)
    .sort((a, b) => (lang === 'bn' ? a.name_bn.localeCompare(b.name_bn, 'bn') : a.name_en.localeCompare(b.name_en))), [places, lang])
  const cls = 'field mt-1 block font-normal'
  return (
    <div role="group" aria-label={t('newsFilters')} className="grid gap-3 sm:grid-cols-3">
      <label className="block text-sm font-semibold">{t('district')}
        <select className={cls} value={district ?? ''} onChange={(e) => set({ district: e.target.value || undefined })}>
          <option value="">{t('allDistricts')}</option>
          {places[NATIONAL] && <option value={NATIONAL}>{t('nationalStories')}</option>}
          {opts.map((p) => <option key={p.unit_id} value={p.unit_id}>{lang === 'bn' ? p.name_bn : p.name_en}</option>)}
        </select></label>
      <label className="block text-sm font-semibold">{t('newsKind')}
        <select className={cls} value={kind ?? ''} onChange={(e) => set({ kind: e.target.value || undefined })}>
          <option value="">{t('allKinds')}</option>
          {NEWS_KINDS.map((k) => <option key={k} value={k}>{t(kindKey(k))}</option>)}
        </select></label>
      <label className="block text-sm font-semibold">{t('seasonShort')}
        <select className={cls} value={season ?? ''} onChange={(e) => set({ season: e.target.value })}>
          {seasons.map((s) => <option key={s} value={s}>{digits(s, lang)}</option>)}
          <option value="all">{t('allSeasons')}</option>
        </select></label>
    </div>
  )
}

/** "How common is fire here?" for a picked district (or Bangladesh), from places.json. */
function DistrictHeader({ place }: { place: NewsPlace }) {
  const t = useT()
  const lang = useLang()
  const name = lang === 'bn' ? place.name_bn : place.name_en
  return (
    <section className="panel space-y-2" aria-labelledby="news-district">
      <h2 id="news-district" className="h-section">{name}</h2>
      <p className="font-semibold">{t('howCommon')} <span className="text-sm font-normal text-muted">· {recordHeading(place, lang)}</span></p>
      <ul className="list-disc space-y-0.5 pl-5">{summaryLines(place, lang).map((l) => <li key={l}>{l}</li>)}</ul>
      {place.news_from && <p className="text-sm text-muted">{tr(place.news_total === 1 ? 'earlierCoverageOne' : 'earlierCoverage', lang, { n: digits(place.news_total, lang), name, from: shortMonthYear(place.news_from, lang) })}</p>}
      {place.unit_id !== NATIONAL && <Link className="inline-flex items-center gap-1 text-sm text-orbit underline" to={`/area/${place.unit_id}${langQ(lang)}`}>
        {tr('areaLink', lang, { name })}<Icon name="chevron" className="h-3.5 w-3.5" /></Link>}
    </section>
  )
}

function StoryList({ items, idx, places, nDistricts }: { items: NewsItem[]; idx: NewsIndex; places: NewsPlaces; nDistricts: number }) {
  const t = useT()
  const lang = useLang()
  const months = byMonth(groupStories(items))
  if (!items.length) return <StatusMessage kind="info">{t('noMatches')}</StatusMessage>
  return (
    <div className="space-y-8">
      <p className="text-sm text-muted">{storyCount(items.length, lang)}</p>
      {months.map(([m, groups]) => (
        <section key={m} aria-labelledby={`news-m-${m}`} className="space-y-3">
          <h2 id={`news-m-${m}`} className="h-section">{monthYear(m, lang)}</h2>
          <ol className="space-y-4">
            {groups.map((g) => <StoryCard key={g.lead.news_id} group={g} idx={idx} places={places} nDistricts={nDistricts} />)}
          </ol>
        </section>))}
    </div>
  )
}

/** A headline link to the newspaper: article language, new tab, a visible and spoken external-link cue. */
function Headline({ item, className = '' }: { item: NewsItem | { url: string; lang: 'en' | 'bn'; title: string }; className?: string }) {
  const t = useT()
  return (
    <a href={item.url} lang={item.lang} target="_blank" rel="noopener noreferrer" className={`underline-offset-2 hover:underline ${className}`}>
      {item.title}<Icon name="external" className="ml-1 inline h-3.5 w-3.5 align-[-2px] text-muted" /><span className="sr-only"> ({t('newTab')})</span>
    </a>
  )
}

function StoryCard({ group, idx, places, nDistricts }: { group: NewsGroup; idx: NewsIndex; places: NewsPlaces; nDistricts: number }) {
  const t = useT()
  const lang = useLang()
  const item = group.lead
  const hid = useId()
  const main = item.unit_ids[0]
  const place = places[main]
  const name = placeName(places, main, lang)
  const others = item.unit_ids.slice(1).map((id) => placeName(places, id, lang))
  const verdict = verdictText(item.how_common, place, lang)
  const row = 'grid gap-x-4 gap-y-1 sm:grid-cols-[11rem_minmax(0,1fr)]'
  return (
    <li>
      <article className="panel space-y-4" aria-labelledby={hid}>
        <header className="space-y-1">
          <p className="text-sm text-muted">
            {item.outlet}{' · '}<time dateTime={item.published_date_local}>{fullDate(item.published_date_local, lang)}</time>{' · '}
            <span className="font-semibold text-ink">{name}</span>{others.length > 0 && <> ({tr('alsoMentions', lang, { names: others.join(', ') })})</>}
            {' · '}<span className="tag mb-0">{t(kindKey(item.kind))}</span>
          </p>
          <h3 id={hid} className="text-lg leading-snug font-semibold"><Headline item={item} /></h3>
          {item.event_date_stated && item.event_date_local !== item.published_date_local &&
            <p className="text-xs text-muted">{tr('eventOn', lang, { date: fullDate(item.event_date_local, lang) })}</p>}
        </header>

        <dl className="space-y-3">
          <div className={row}>
            <dt className="font-semibold">{t('paperSays')}</dt>
            <dd className="space-y-1.5">
              <p lang={lang}>{lang === 'bn' ? item.claim_bn : item.claim_en}</p>
              <blockquote cite={item.url} lang={item.lang} className="border-l-2 border-line pl-3 text-sm text-muted italic">“{item.quote}”</blockquote>
            </dd>
          </div>
          <div className={row}>
            <dt className="font-semibold">{t('satSaw')}</dt>
            <dd className="space-y-1">
              {satLines(item.sat, idx.rules, nDistricts, lang).map((l) => <p key={l}>{l}</p>)}
              {item.sat.type === 'window' && <p className="text-xs text-muted"><Gloss k="unusual">{t('unusualWord')}</Gloss></p>}
              {item.sat.type === 'kiln_months' && <Caution>{t('kilnLimit')}</Caution>}
            </dd>
          </div>
          <div className={row}>
            <dt className="font-semibold">{t('howCommon')}</dt>
            <dd className="space-y-1.5">
              {place && <p className="text-xs text-muted">{recordHeading(place, lang)}</p>}
              <dl className="space-y-1 text-sm">
                <div><dt className="inline font-semibold">{t('seasonSoFar')}: </dt><dd className="inline">{seasonLine(item.season_so_far, nDistricts, lang)}</dd></div>
                {place && <div><dt className="inline font-semibold">{t('summary')}: </dt><dd className="inline">{summaryLines(place, lang).join(' ')}</dd></div>}
                {verdict && <div><dt className="inline font-semibold">{t('verdict')}: </dt><dd className="inline"><b>{verdict}</b> <span className="text-xs text-muted">{t('verdictNote')}</span></dd></div>}
              </dl>
            </dd>
          </div>
        </dl>

        {group.others.length > 0 && <div>
          <p className="tag">{t('alsoReported')}</p>
          <ul className="space-y-1 text-sm">
            {group.others.map((o) => <li key={o.news_id}>{o.outlet} · <time dateTime={o.published_date_local}>{fullDate(o.published_date_local, lang)}</time> · <Headline item={o} /></li>)}
          </ul>
        </div>}

        <EarlierNews item={item} place={place} name={name} shown={idx.rules.earlier_shown} />

        {main !== NATIONAL && <Link className="inline-flex items-center gap-1 text-sm text-orbit underline" to={`/area/${main}${langQ(lang)}`}>
          {tr('areaLink', lang, { name })}<Icon name="chevron" className="h-3.5 w-3.5" /></Link>}
      </article>
    </li>
  )
}

/** Closed by default; the place file loads only once it is opened. */
function EarlierNews({ item, place, name, shown }: { item: NewsItem; place?: NewsPlace; name: string; shown: number }) {
  const t = useT()
  const lang = useLang()
  const [opened, setOpened] = useState(false)
  const main = item.unit_ids[0]
  const file = useJson<NewsPlaceStories>(opened ? `news/place/${main}.json` : null)
  const list = file.data ? earlierStories(file.data, item, shown) : []
  return (
    <div className="space-y-1.5">
      <details className="rounded-[6px] border border-line bg-surface open:shadow-sm" onToggle={(e) => { if (e.currentTarget.open) setOpened(true) }}>
        <summary className="cursor-pointer px-2.5 py-1.5 text-sm font-semibold">{tr('earlierNews', lang, { n: digits(item.earlier_news, lang) })}</summary>
        <div className="space-y-2 border-t border-line px-2.5 py-2 text-sm">
          {file.error ? <StatusMessage kind="error">{t('newsSeasonMissing')}</StatusMessage>
            : !file.data ? <StatusMessage kind="loading">{t('newsLoading')}</StatusMessage>
              : list.length ? <ul className="space-y-1">
                {list.map((s) => <li key={s.news_id}><time dateTime={s.date_local}>{fullDate(s.date_local, lang)}</time> · {s.outlet} — <Headline item={s} /></li>)}
              </ul> : <p>{t('earlierNone')}</p>}
          {place?.news_from && <p className="text-xs text-muted">{tr(place.news_total === 1 ? 'earlierCoverageOne' : 'earlierCoverage', lang, { n: digits(place.news_total, lang), name, from: shortMonthYear(place.news_from, lang) })}</p>}
          <Link className="inline-flex items-center gap-1 text-orbit underline" to={newsTo({ district: main, season: 'all' }, lang)} onClick={() => window.scrollTo({ top: 0 })}>
            {t('seeAll')}<Icon name="chevron" className="h-3.5 w-3.5" /></Link>
        </div>
      </details>
      <Caution>{t('earlierNote')}</Caution>
    </div>
  )
}

/** "All seasons" for one district: every story in its place file, newest first, by month; each links to its season view. */
function AllSeasonsList({ place, file, kind }: { place: NewsPlace; file: { data?: NewsPlaceStories; error?: string }; kind?: NewsKind }) {
  const t = useT()
  const lang = useLang()
  if (file.error) return <StatusMessage kind="error">{t('newsSeasonMissing')}</StatusMessage>
  if (!file.data) return <StatusMessage kind="loading">{t('newsLoading')}</StatusMessage>
  const list = placeStoryList(file.data, kind)
  if (!list.length) return <StatusMessage kind="info">{t('noMatches')}</StatusMessage>
  const months = new Map<string, typeof list>()
  for (const s of list) months.set(s.date_local.slice(0, 7), [...(months.get(s.date_local.slice(0, 7)) ?? []), s])
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted">{tr('allSeasonsList', lang, { name: lang === 'bn' ? place.name_bn : place.name_en })} {storyCount(list.length, lang)}.</p>
      {[...months].map(([m, ss]) => (
        <section key={m} aria-labelledby={`news-all-${m}`} className="space-y-2">
          <h2 id={`news-all-${m}`} className="h-section">{monthYear(m, lang)}</h2>
          <ul className="divide-y divide-line border-y border-line">
            {ss.map((s) => (
              <li key={s.news_id} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 py-2 text-sm">
                <time className="num text-muted" dateTime={s.date_local}>{dayMonth(s.date_local, lang)}</time>
                <span className="text-muted">· {s.outlet} · {t(kindKey(s.kind))}</span>
                <span className="basis-full sm:basis-auto"><Headline item={s} /></span>
                <Link className="ml-auto text-orbit underline" to={newsTo({ district: place.unit_id, season: s.season, kind }, lang)} onClick={() => window.scrollTo({ top: 0 })}>
                  {tr('openSeason', lang, { season: digits(s.season, lang) })}</Link>
              </li>))}
          </ul>
        </section>))}
    </div>
  )
}

/** Per outlet: how far back it was read and when it was last scanned; excluded outlets with their reason; guard drops. */
function SourcesPanel({ idx, items }: { idx: NewsIndex; items?: NewsItem[] }) {
  const t = useT()
  const lang = useLang()
  const counts = items ? outletCounts(items) : undefined
  const active = idx.sources.filter((s) => s.status === 'active'), excluded = idx.sources.filter((s) => s.status === 'excluded')
  const li = (s: NewsIndex['sources'][number]) => (
    <li key={s.key} className="py-1.5"><b lang={s.lang}>{s.outlet}</b> <span className="text-xs text-muted">({s.lang === 'bn' ? 'বাংলা' : 'English'})</span>
      <span className="block text-muted">{sourceText(s, counts ? counts.get(s.outlet) ?? 0 : undefined, lang)}</span></li>)
  return (
    <section aria-labelledby="news-sources" className="space-y-3">
      <div className="section-head"><h2 id="news-sources" className="h-section">{t('sourcesTitle')}</h2></div>
      <div className="panel space-y-3 text-sm">
        <p>{t('sourcesIntro')}</p>
        <ul className="divide-y divide-line">{active.map(li)}</ul>
        {excluded.length > 0 && <ul className="divide-y divide-line border-t border-line">{excluded.map(li)}</ul>}
        <div>
          <p className="font-semibold">{t('droppedTitle')}</p>
          {idx.dropped.length ? <ul className="list-disc pl-5">{idx.dropped.map((d) => <li key={d.reason}><span className="code">{d.reason}</span>: <span className="num">{digits(d.n, lang)}</span></li>)}</ul>
            : <p className="text-muted">{t('droppedNone')}</p>}
        </div>
        <p className="text-xs text-muted">{tr('newsBuild', lang, {
          model: idx.model, updated: idx.store_updated_at ? fullDate(idx.store_updated_at, lang) : '–', build: idx.data_build,
        })}</p>
      </div>
    </section>
  )
}
