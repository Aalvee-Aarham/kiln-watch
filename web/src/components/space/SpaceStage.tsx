import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type RefObject } from 'react'
import { chooseEngine, hasWebGL2, loadCesium, readPref, savePref, type EnginePref } from '../../lib/space/engine'
import { Icon } from '../ui'
import type { CameraView, Engine, Label } from './types'
import stillImage from '../../assets/basemap/world_bluemarble-ng.jpg'

const useOnline = () => useSyncExternalStore(
  (l) => { window.addEventListener('online', l); window.addEventListener('offline', l); return () => { window.removeEventListener('online', l); window.removeEventListener('offline', l) } },
  () => navigator.onLine, () => true)

const HINT_KEY = 'kwSpaceHint'

/**
 * The globe on the "Seen from space" page, filling its box: picks and mounts an engine, keeps the reader's view across
 * a switch, draws HTML labels over it, and holds the globe's own controls. The page steers it through `onEngine`.
 */
export function SpaceStage({ onEngine, labels, labelKey, moved, onRecenter }: {
  onEngine: (e: Engine | null) => void
  labels: RefObject<Label[]>; labelKey: string
  moved: boolean; onRecenter: () => void
}) {
  const online = useOnline()
  const webgl2 = useMemo(hasWebGL2, [])
  const [pref, setPref] = useState<EnginePref>(readPref)
  const [failed, setFailed] = useState<string>()
  const [engine, setEngine] = useState<Engine | null>(null)
  const [hint, setHint] = useState(() => { try { return sessionStorage.getItem(HINT_KEY) !== '1' } catch { return true } })
  const chosen = chooseEngine({ pref, online, webgl2 })
  const kind = chosen === 'cesium' && failed ? 'globe' : chosen
  const host = useRef<HTMLDivElement>(null), credits = useRef<HTMLDivElement>(null)
  const lastView = useRef<CameraView | null>(null)
  const onEngineRef = useRef(onEngine)
  onEngineRef.current = onEngine

  useEffect(() => {
    const el = host.current
    if (!el || kind === 'none') return
    let live = true, made: Engine | null = null
    const box = document.createElement('div')
    box.className = 'absolute inset-0'
    el.appendChild(box)
    const make = kind === 'cesium'
      ? Promise.all([loadCesium(), import('./cesiumEngine')]).then(([C, m]) => m.createCesiumEngine(box, C, credits.current!))
      : import('./globeEngine').then((m) => m.createGlobeEngine(box))
    make.then((e) => {
      if (!live) { e.destroy(); return }
      made = e
      if (lastView.current) e.flyTo(lastView.current, 0)
      setEngine(e); onEngineRef.current(e)
    }, (err: Error) => { if (live && kind === 'cesium') setFailed(err.message) })
    return () => {
      live = false
      if (made) { lastView.current = made.view(); made.destroy() }
      onEngineRef.current(null); setEngine(null)
      box.remove()
    }
  }, [kind])

  // The gesture hint goes once the reader has moved the globe, or after a while.
  const dismissHint = useCallback(() => { setHint(false); try { sessionStorage.setItem(HINT_KEY, '1') } catch { /* this visit only */ } }, [])
  useEffect(() => { if (moved && hint) dismissHint() }, [moved, hint, dismissHint])
  useEffect(() => { if (!hint || !engine) return; const id = setTimeout(dismissHint, 9000); return () => clearTimeout(id) }, [hint, engine, dismissHint])

  // Labels: positioned every frame, straight on the DOM (no React render per frame).
  const labelEls = useRef(new Map<string, HTMLDivElement>())
  useEffect(() => {
    if (!engine) return
    const last = new Map<string, string>()
    return engine.onFrame(() => {
      const list = labels.current ?? []
      const range = list.some((l) => l.max_range_km) ? engine.view().range_km : 0
      for (const l of list) {
        const el = labelEls.current.get(l.id)
        if (!el) continue
        const p = l.max_range_km && range > l.max_range_km ? null : engine.project(l.lat, l.lon, l.alt_km)
        const tr = p ? `translate3d(${Math.round(p.x)}px, ${Math.round(p.y)}px, 0)` : ''
        if (last.get(l.id) === tr) continue
        last.set(l.id, tr)
        if (!p) { el.style.visibility = 'hidden'; continue }
        el.style.visibility = 'visible'
        el.style.transform = tr
        if (el.dataset.text !== l.text) { el.dataset.text = l.text; el.lastElementChild!.textContent = l.text }
      }
    })
  }, [engine, labels, labelKey])

  const pick = (p: EnginePref) => { setPref(p); savePref(p); setFailed(undefined) }
  const status = kind === 'none' ? '' : kind === 'cesium' ? 'Online · detailed globe' : !online ? 'Offline · light globe' : failed ? `Light globe · ${failed}` : 'Light globe · works offline'

  return (
    <div className="space-night absolute inset-0 overflow-hidden bg-[#02040a] text-ink" role="region"
      aria-label="3D globe. Drag or swipe with two fingers to move it; pinch, mouse wheel or double-click to zoom toward a point; right-drag or Ctrl and drag to tilt.">
      <div ref={host} className="absolute inset-0" />
      {kind === 'none' && (
        <div className="absolute inset-0 grid place-items-center p-6 text-center">
          <img src={stillImage} alt="The Earth from space, NASA Blue Marble" className="absolute inset-0 h-full w-full object-cover opacity-40" />
          <p className="relative max-w-sm text-sm">This device can’t draw 3D graphics (WebGL 2 is off or missing), so the globe can’t run here. The story card still works.</p>
        </div>
      )}
      {kind !== 'none' && !engine && (
        <div className="absolute inset-0 grid place-items-center">
          <p className="flex items-center gap-2 text-sm text-muted"><span className="h-2 w-2 animate-pulse rounded-full bg-orbit" />{kind === 'cesium' ? 'Loading the detailed globe…' : 'Loading the globe…'}</p>
        </div>
      )}

      <div className="pointer-events-none absolute inset-0" aria-hidden>
        {(labels.current ?? []).map((l) => (
          <div key={l.id} ref={(el) => { if (el) labelEls.current.set(l.id, el); else labelEls.current.delete(l.id) }} data-text={l.text}
            className={`space-label space-label-${l.kind}`} style={{ visibility: 'hidden', ['--c' as string]: l.color }}>
            <span className="space-label-dot" /><span>{l.text}</span>
          </div>
        ))}
      </div>

      {hint && engine && (
        <p className="space-hint" role="note">
          <span><b>Drag</b> or <b>two-finger swipe</b> to move</span><span><b>Pinch</b> or <b>wheel</b> to zoom</span><span><b>Right-drag</b> to tilt</span>
          <button className="space-icon-btn -mr-1" onClick={dismissHint} aria-label="Dismiss"><Icon name="cross" className="h-3.5 w-3.5" /></button>
        </p>
      )}

      <div className="absolute top-3 right-3 flex flex-col items-end gap-2">
        <div className="space-seg" role="radiogroup" aria-label="Globe">
          <button role="radio" aria-checked={kind === 'cesium'} disabled={!online || !webgl2} onClick={() => pick('detailed')}
            title={online ? 'NASA imagery from the internet, with Sentinel-2 close up' : 'Needs an internet connection'}>Detailed</button>
          <button role="radio" aria-checked={kind === 'globe'} disabled={!webgl2} onClick={() => pick('light')} title="Built-in NASA images; works offline">Light</button>
        </div>
        {engine && (
          <div className="flex flex-col gap-1">
            <button className="space-btn" aria-label="Zoom in" title="Zoom in" onClick={() => engine.zoomBy(0.6)}><Icon name="plus" /></button>
            <button className="space-btn" aria-label="Zoom out" title="Zoom out" onClick={() => engine.zoomBy(1 / 0.6)}><Icon name="minus" /></button>
          </div>
        )}
        {engine && moved && <button className="space-btn px-2.5 text-xs" onClick={onRecenter}><Icon name="replay" className="h-3.5 w-3.5" />Reset view</button>}
      </div>

      <div className="space-footline">
        <div ref={credits} className={`space-credits ${kind === 'cesium' ? '' : 'hidden'}`} />
        {kind === 'globe' && <span>NASA Blue Marble · Black Marble</span>}
        <span className="text-muted/80">{status}</span>
      </div>
    </div>
  )
}
