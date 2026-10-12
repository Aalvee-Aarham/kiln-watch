import { useEffect, useId, useMemo, useRef } from 'react'
import { Link, useSearchParams } from 'react-router'
import BdMap from '../components/BdMap'
import { Icon, StatusMessage, useNewsIndex, useReducedMotion, useTitle } from '../components/ui'
import { useJson } from '../lib/data'
import { tr, useLang, useT } from '../lib/i18n'
import {
  byMonth, dateRange, dayMonth, digits, findGroup, fullDate, groupStories, kindKey, monthYear, NATIONAL, placeName, recentFire,
  seasonItems, storyCount, storyPins, verdictText, type NewsGroup,
} from '../lib/news'
import { palette, rampColor, useTheme } from '../lib/theme'
import type { FC, NewsPlaces, NewsSeason, NrtSeason } from '../lib/types'
import type { Lang } from '../lib/url'
import { Headline } from './NewsPage'

/** Days in the "new fire activity" window: the Area page's week. */
const RECENT_DAYS = 7
type Colour = 'recent' | 'unusual'

/** `#/news/story/<season>/<news_id>`, keeping the UI language. */
export const storyPath = (season: string, newsId: string, lang: Lang) => `/news/story/${season}/${newsId}${lang === 'bn' ? '?lang=bn' : ''}`

/**
 * News map: recent stories on the left, the live season's fire on the right (each district coloured by its last
 * RECENT_DAYS days, or by unusual days so far). Pins sit at district centres, so the map stays area-level: no kiln,
 * no fire point, no coordinate from any article. Picking a story zooms to its district and opens a card.
 */
export default function NewsMapPage() {
  const t = useT()
  const lang = useLang()
  useTitle(t('newsMapTitle'))
  const reduced = useReducedMotion()
  const [sp, setSp] = useSearchParams()
  const index = useNewsIndex()
  const places = useJson<NewsPlaces>(index.data ? 'news/places.json' : null)
  const dists = useJson<FC>('aoi/districts.geojson')
  const nrt = useJson<NrtSeason>('nrt/current_season.json')
  const seasons = index.data?.seasons ?? []
  const seasonParam = sp.get('season')
  const season = seasonParam && seasons.includes(seasonParam) ? seasonParam : seasons[0]
  const file = useJson<NewsSeason>(season ? `news/${season}.json` : null)
  const groups = useMemo(() => (file.data ? groupStories(seasonItems(file.data)) : []), [file.data])
  const pins = useMemo(() => storyPins(groups), [groups])
  const recent = useMemo(() => (nrt.data ? recentFire(nrt.data, RECENT_DAYS) : null), [nrt.data])
  const colour: Colour = sp.get('colour') === 'unusual' || (nrt.data && !recent) ? 'unusual' : 'recent'
  const values = useMemo(() => !nrt.data ? undefined : colour === 'unusual'
    ? Object.fromEntries(Object.entries(nrt.data.districts).map(([id, d]) => [id, d.above_p90_days])) : recent?.values, [nrt.data, colour, recent])

  const open = findGroup(groups, sp.get('story'))
  const districtParam = sp.get('district') ?? undefined
  const selected = open ? open.lead.unit_ids[0] : districtParam
  const listRef = useRef<HTMLOListElement>(null)

  const patch = (p: Record<string, string | undefined>) => setSp((prev) => {
    const n = new URLSearchParams(prev)
    for (const [k, v] of Object.entries(p)) if (v) n.set(k, v); else n.delete(k)
    return n
  }, { replace: true })
  const pickStory = (g: NewsGroup) => patch({ story: g.lead.news_id, district: undefined })
  // A district with stories opens its newest one; any other shows the district's own fire.
  const pickDistrict = (id: string) => { const g = groups.find((g) => g.lead.unit_ids[0] === id); if (g) pickStory(g); else patch({ story: undefined, district: id }) }

  // Keep the open story visible inside the list's own scroll box, without scrolling the page.
  const openId = open?.lead.news_id
  useEffect(() => {
    const box = listRef.current, el = openId ? box?.querySelector<HTMLElement>(`[data-news="${openId}"]`) : null
    if (!box || !el || box.scrollHeight <= box.clientHeight) return
    if (el.offsetTop < box.scrollTop || el.offsetTop + el.offsetHeight > box.scrollTop + box.clientHeight)
      box.scrollTo({ top: Math.max(0, el.offsetTop - 48), behavior: reduced ? 'auto' : 'smooth' })
  }, [openId, reduced])

  if (index.error)
    return (
      <div className="mx-auto max-w-[1200px] space-y-4 p-4">
        <h1 className="h-section">{t('newsMapTitle')}</h1>
        {index.error.endsWith('was not found') ? <StatusMessage kind="info">{t('newsMissing')}</StatusMessage>
          : <StatusMessage kind="error">{t('newsMissing')} ({index.error})</StatusMessage>}
      </div>)
  if (dists.error) return <div className="p-4"><StatusMessage kind="error">{dists.error}</StatusMessage></div>
  if (!index.data || !places.data || !dists.data) return <div className="p-4"><StatusMessage kind="loading">{t('newsLoading')}</StatusMessage></div>
  const pl = places.data
  const pinLabel = (id: string, n: number) => `${placeName(pl, id, lang)}: ${storyCount(n, lang)}`
  const sel = 'field mt-0.5 block w-full py-1.5 text-sm text-ink'

  // Full screen (AppShell appPage): a flush sidebar on the left, the map filling the rest. Phones: map above, list below.
  return (
    <div className="flex h-full flex-col lg:flex-row">
      <aside aria-labelledby="news-map-title" className="order-2 flex min-h-0 flex-1 flex-col border-t border-line bg-surface lg:order-1 lg:w-[400px] lg:flex-none lg:border-t-0 lg:border-r">
        <header className="space-y-3 border-b border-line px-5 pt-4 pb-3 max-lg:space-y-2 max-lg:px-4 max-lg:pt-3">
          <div className="max-lg:flex max-lg:items-baseline max-lg:justify-between max-lg:gap-2">
            <h1 id="news-map-title" className="h-display text-[1.65rem] leading-tight max-lg:text-lg">{t('newsMapTitle')}</h1>
            <p className="mt-1 text-sm text-muted max-lg:mt-0 max-lg:shrink-0 max-lg:text-xs">{file.data ? storyCount(groups.length, lang) : '…'} · {digits(season ?? '', lang)}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs text-muted">{t('seasonShort')}
              <select className={sel} value={season ?? ''} onChange={(e) => patch({ season: e.target.value, story: undefined, district: undefined })}>
                {seasons.map((s) => <option key={s} value={s}>{digits(s, lang)}</option>)}
              </select></label>
            <label className="block text-xs text-muted">{t('mapColour')}
              <select className={sel} value={colour} disabled={!recent} onChange={(e) => patch({ colour: e.target.value === 'recent' ? undefined : e.target.value })}>
                <option value="recent">{tr('fireRecent', lang, { n: digits(RECENT_DAYS, lang) })}</option>
                <option value="unusual">{t('fireUnusual')}</option>
              </select></label>
          </div>
        </header>
        {file.error ? <div className="p-4"><StatusMessage kind="error">{t('newsSeasonMissing')}</StatusMessage></div>
          : !file.data ? <div className="p-4"><StatusMessage kind="loading">{t('newsLoading')}</StatusMessage></div>
            : !groups.length ? <div className="p-4"><StatusMessage kind="info">{t('noMatches')}</StatusMessage></div>
              : <ol ref={listRef} className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain">
                {byMonth(groups).map(([m, gs]) => (
                  <li key={m}>
                    <h2 className="sticky top-0 z-10 border-b border-line bg-surface-2 px-5 py-1 text-xs font-semibold text-muted max-lg:px-4">{monthYear(m, lang)}</h2>
                    <ul className="divide-y divide-line">
                      {gs.map((g) => <StoryRow key={g.lead.news_id} group={g} places={pl} open={g === open} onPick={() => pickStory(g)} />)}
                    </ul>
                  </li>))}
              </ol>}
        <footer className="space-y-1 border-t border-line px-5 py-2 text-[11px] leading-snug text-muted max-lg:px-4">
          <p role="note">{t('newsLabel')}</p>
          {!nrt.loading && !nrt.data && <p>{t('noLiveFire')}</p>}
          <Link className="inline-flex items-center gap-1 font-semibold text-orbit underline" to={`/news${lang === 'bn' ? '?lang=bn' : ''}`}>
            {t('newsListTab')}<Icon name="chevron" className="h-3 w-3" /></Link>
        </footer>
      </aside>

      <section aria-label={t('newsMapTitle')} className="relative order-1 h-[52%] shrink-0 lg:order-2 lg:h-auto lg:min-w-0 lg:flex-1">
        <BdMap fc={dists.data} selected={selected !== NATIONAL ? selected : undefined} onSelect={pickDistrict} drawing={false} onBox={() => {}}
          values={values} labels pins={pins} onPin={pickDistrict} pinLabel={pinLabel} controls wheelZoom className="h-full" />
        {values && <MapKey values={values} colour={colour} range={colour === 'recent' && recent ? dateRange(recent.from, recent.to, lang) : nrt.data!.season} />}
        {(open || districtParam) && (
          <div className="pointer-events-none absolute top-[32%] right-2 bottom-2 left-2 z-[25] flex items-end lg:top-3 lg:right-auto lg:bottom-3 lg:left-15 lg:w-[24rem] lg:items-start">
            {open ? <StoryPopup key={open.lead.news_id} group={open} places={pl} season={season!} onClose={() => patch({ story: undefined })} />
              : <DistrictPopup id={districtParam!} places={pl} nrt={nrt.data} season={season!} onClose={() => patch({ district: undefined })} />}
          </div>)}
      </section>
    </div>
  )
}

function StoryRow({ group, places, open, onPick }: { group: NewsGroup; places: NewsPlaces; open: boolean; onPick: () => void }) {
  const t = useT()
  const lang = useLang()
  const item = group.lead
  const [d, m] = dayMonth(item.published_date_local, lang).split(' ')
  return (
    <li>
      <button type="button" data-news={item.news_id} aria-pressed={open} onClick={onPick}
        className={`flex w-full gap-4 px-5 py-3 text-left max-lg:px-4 transition-colors hover:bg-surface-2 focus-visible:bg-surface-2 ${open ? 'bg-surface-2 shadow-[inset_3px_0_0_var(--color-heat)]' : ''}`}>
        <time dateTime={item.published_date_local} className="w-10 shrink-0 pt-0.5 text-center leading-none">
          <span className="num block text-lg font-semibold">{d}</span><span className="text-[11px] text-muted">{m}</span>
        </time>
        <span className="min-w-0 flex-1 space-y-0.5">
          <span className="flex items-baseline justify-between gap-2 text-xs">
            <span className="truncate font-semibold">{placeName(places, item.unit_ids[0], lang)}</span>
            <span className="shrink-0 text-muted">{t(kindKey(item.kind))}</span>
          </span>
          <span lang={item.lang} className="line-clamp-2 block text-sm leading-snug">{item.title}</span>
          <span className="block text-xs text-muted">{item.outlet}{group.others.length > 0 && ` +${digits(group.others.length, lang)}`}</span>
        </span>
      </button>
    </li>
  )
}

const cardCls = 'panel pointer-events-auto relative max-h-full w-full space-y-2 overflow-y-auto p-4 shadow-lg'
const CloseButton = ({ onClose }: { onClose: () => void }) => {
  const t = useT()
  return <button type="button" onClick={onClose} aria-label={t('closeCard')} className="btn btn-quiet btn-icon absolute top-2 right-2"><Icon name="cross" /></button>
}

/** The card a picked story opens: enough to judge it, and "View more" for the full satellite comparison. */
function StoryPopup({ group, places, season, onClose }: { group: NewsGroup; places: NewsPlaces; season: string; onClose: () => void }) {
  const t = useT()
  const lang = useLang()
  const hid = useId()
  const item = group.lead
  const main = item.unit_ids[0]
  const others = item.unit_ids.slice(1).map((id) => placeName(places, id, lang))
  const verdict = verdictText(item.how_common, places[main], lang)
  const ref = useRef<HTMLElement>(null)
  useEffect(() => { ref.current?.focus({ preventScroll: true }) }, [])
  return (
    <article ref={ref} tabIndex={-1} aria-labelledby={hid} className={`${cardCls} outline-none`} onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}>
      <CloseButton onClose={onClose} />
      <p className="pr-9 text-xs text-muted">
        <span className="tag mb-0">{t(kindKey(item.kind))}</span>{' · '}<time dateTime={item.published_date_local}>{fullDate(item.published_date_local, lang)}</time>
      </p>
      <h2 id={hid} className="text-base leading-snug font-semibold"><Headline item={item} /></h2>
      <p className="text-xs text-muted max-sm:hidden">{item.outlet}{group.others.length > 0 && <> · {t('alsoReported')}: {group.others.map((o) => o.outlet).join(', ')}</>}</p>
      <p className="text-sm">
        <span className="font-semibold">{placeName(places, main, lang)}</span>
        {others.length > 0 && <span className="text-muted"> ({tr('alsoMentions', lang, { names: others.join(', ') })})</span>}
        {main === NATIONAL && <span className="block text-xs text-muted">{t('nationalOnMap')}</span>}
      </p>
      <p lang={lang} className="line-clamp-4 text-sm max-sm:line-clamp-3">{lang === 'bn' ? item.claim_bn : item.claim_en}</p>
      {verdict && <p className="text-sm max-sm:hidden"><span className="font-semibold">{t('verdict')}:</span> {verdict}</p>}
      <div className="pt-1">
        <Link className="btn btn-primary" to={storyPath(season, item.news_id, lang)}>{t('viewMore')}<Icon name="chevron" className="h-3.5 w-3.5" /></Link>
      </div>
    </article>
  )
}

/** A picked district without stories this season: its own fire so far, and a way to its burning season. */
function DistrictPopup({ id, places, nrt, season, onClose }: { id: string; places: NewsPlaces; nrt?: NrtSeason; season: string; onClose: () => void }) {
  const lang = useLang()
  const name = placeName(places, id, lang)
  const d = nrt?.districts[id]
  return (
    <article className={cardCls} aria-label={name} onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}>
      <CloseButton onClose={onClose} />
      <h2 className="pr-9 text-base font-semibold">{name}</h2>
      <p className="text-sm text-muted">{tr('noStoriesHere', lang, { name, season: digits(season, lang) })}</p>
      {d && <p className="text-sm">{tr('unusualSoFar', lang, { n: digits(d.above_p90_days, lang), days: tr(d.above_p90_days === 1 ? 'day' : 'days', lang) })}
        {' '}<span className="text-xs text-muted">({digits(nrt!.season, lang)}, {tr('provisional', lang).toLowerCase()})</span></p>}
      <Link className="inline-flex items-center gap-1 text-sm text-orbit underline" to={`/area/${id}${lang === 'bn' ? '?lang=bn' : ''}`}>
        {tr('areaLink', lang, { name })}<Icon name="chevron" className="h-3.5 w-3.5" /></Link>
    </article>
  )
}

/** Colour key for the choropleth (BdMap's ramp: none, then 5 equal steps of the max) and the pins. */
function MapKey({ values, colour, range }: { values: Record<string, number>; colour: Colour; range: string }) {
  const t = useT()
  const lang = useLang()
  useTheme() // re-read the palette on theme toggle
  const p = palette()
  const max = Math.max(0, ...Object.values(values))
  const steps = [0, ...[1, 2, 3, 4, 5].map((k) => (k / 5) * max)]
  return (
    <div className="pointer-events-none absolute right-3 bottom-3 z-20 w-48 space-y-1.5 rounded-[6px] border border-line bg-surface/92 px-2.5 py-2 text-[11px] shadow-sm max-sm:w-36">
      <p className="font-semibold">{colour === 'recent' ? tr('fireRecent', lang, { n: digits(RECENT_DAYS, lang) }) : t('fireUnusual')}</p>
      <div className="flex h-2.5 overflow-hidden rounded-[3px] border border-line" aria-hidden>
        {steps.map((v, i) => <span key={i} className="flex-1" style={{ background: rampColor(v, max, p) }} />)}
      </div>
      <p className="flex justify-between text-muted"><span>{colour === 'unusual' ? digits(0, lang) : t('fireLess')}</span>
        <span>{colour === 'unusual' ? digits(max, lang) : t('fireMore')}</span></p>
      <p className="text-muted max-sm:hidden">{tr('fireRange', lang, { range: digits(range, lang) })}</p>
      <p className="flex items-center gap-1.5 border-t border-line pt-1.5 max-sm:hidden"><span className="inline-block h-3 w-3 shrink-0 rounded-full bg-orbit" aria-hidden />{t('newsPinKey')}</p>
    </div>
  )
}
