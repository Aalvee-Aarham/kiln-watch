// Which globe draws the page. Cesium (online: NASA and Sentinel-2 imagery) or globe.gl (bundled NASA images, works offline).
// Both need WebGL 2; without it the page shows a still image.

export type EngineKind = 'cesium' | 'globe' | 'none'
export type EnginePref = 'auto' | 'detailed' | 'light'

export function chooseEngine({ pref, online, webgl2 }: { pref: EnginePref; online: boolean; webgl2: boolean }): EngineKind {
  if (!webgl2) return 'none'
  if (pref === 'light' || !online) return 'globe'
  return 'cesium'
}

export function hasWebGL2(): boolean {
  try { return !!document.createElement('canvas').getContext('webgl2') } catch { return false }
}

const PREF_KEY = 'kwSpaceEngine'
export function readPref(): EnginePref {
  try { const v = localStorage.getItem(PREF_KEY); return v === 'detailed' || v === 'light' ? v : 'auto' } catch { return 'auto' }
}
export function savePref(p: EnginePref) {
  try { localStorage.setItem(PREF_KEY, p) } catch { /* this page only */ }
}

// CesiumJS loads from the CDN only when the detailed globe is used, so its ~40 MB never enters the offline (PWA) cache.
// The version matches the `cesium` devDependency that supplies the types; integrity hashes were checked against that package.
export const CESIUM_VERSION = '1.145.0'
const CESIUM_BASE = `https://cdn.jsdelivr.net/npm/cesium@${CESIUM_VERSION}/Build/Cesium/`
const CESIUM_JS_SRI = 'sha384-D1oR8FyBDsJWkPeydGJTh8nJg5/++9sqchzJuu+oGQPmgbwu3aJmoVj3BTowr6t6'
const CESIUM_CSS_SRI = 'sha384-ghEeMdcWWzRv/BPeUcX835vcKDGrxvROXisl/Btpv3GeekBUXTSPVcFJpI1Tcrgp'

type CesiumNS = typeof import('cesium')
declare global { interface Window { Cesium?: CesiumNS; CESIUM_BASE_URL?: string } }

let loading: Promise<CesiumNS> | undefined
export function loadCesium(timeout_ms = 20_000): Promise<CesiumNS> {
  if (window.Cesium) return Promise.resolve(window.Cesium)
  loading ??= new Promise<CesiumNS>((resolve, reject) => {
    window.CESIUM_BASE_URL = CESIUM_BASE
    const css = document.createElement('link')
    Object.assign(css, { rel: 'stylesheet', href: CESIUM_BASE + 'Widgets/widgets.css', integrity: CESIUM_CSS_SRI, crossOrigin: 'anonymous' })
    document.head.appendChild(css)
    const s = document.createElement('script')
    Object.assign(s, { src: CESIUM_BASE + 'Cesium.js', integrity: CESIUM_JS_SRI, crossOrigin: 'anonymous', async: true })
    const timer = setTimeout(() => fail(new Error('The detailed globe took too long to load.')), timeout_ms)
    const fail = (e: Error) => { clearTimeout(timer); s.remove(); css.remove(); loading = undefined; reject(e) }
    s.onload = () => { clearTimeout(timer); if (window.Cesium) resolve(window.Cesium); else fail(new Error('The detailed globe did not start.')) }
    s.onerror = () => fail(new Error('The detailed globe could not be downloaded.'))
    document.head.appendChild(s)
  })
  return loading
}
