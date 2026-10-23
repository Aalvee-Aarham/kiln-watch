import Globe from 'globe.gl'
import * as THREE from 'three'
import { Line2 } from 'three/examples/jsm/lines/Line2.js'
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js'
import { BBOX, SOUTH_ASIA_BOX, type Box } from '../../lib/box'
import { EARTH_R_KM, sunPoint } from '../../lib/space/orbit'
import { wheelIntent, type WheelIntent } from '../../lib/space/input'
import { approach, maxTilt, settled, wheelPixels, zoomToward } from '../../lib/space/camera'
import { DEFAULT_VIEW, type Area, type AreaLayer, type CameraView, type Column, type Engine, type Line, type LineLayer, type SatMark } from './types'
// NASA Blue Marble (day) and Black Marble (night), bundled: the light globe works with the network off.
import worldDay from '../../assets/basemap/world_bluemarble-ng.jpg'
import worldNight from '../../assets/basemap/world_black-marble-2016.jpg'
import saDay from '../../assets/basemap/south-asia_bluemarble-ng.jpg'
import saNight from '../../assets/basemap/south-asia_black-marble-2016.jpg'
import bdDay from '../../assets/basemap/bluemarble-ng_bd.jpg'
import bdNight from '../../assets/basemap/black-marble-2016_bd.jpg'


// Day/night Earth: Blue Marble where the Sun is up, Black Marble city lights where it is down, a warm band at dusk.
const VERT = /* glsl */ `
  varying vec2 vUv; varying vec3 vN;
  void main() { vUv = uv; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`
const FRAG = /* glsl */ `
  uniform sampler2D dayTex; uniform sampler2D nightTex; uniform vec3 sunDir;
  varying vec2 vUv; varying vec3 vN;
  void main() {
    float d = dot(normalize(vN), sunDir);
    vec3 day = texture2D(dayTex, vUv).rgb, night = texture2D(nightTex, vUv).rgb;
    float k = smoothstep(-0.10, 0.16, d);
    vec3 lit = day * (0.30 + 0.85 * clamp(d * 1.3 + 0.2, 0.0, 1.0));
    vec3 dark = night * 1.35 + day * 0.025;
    vec3 col = mix(dark, lit, k) + vec3(1.0, 0.42, 0.12) * exp(-pow(d / 0.1, 2.0)) * 0.09;
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }`

function dayNight(day: THREE.Texture, night: THREE.Texture) {
  return new THREE.ShaderMaterial({ uniforms: { dayTex: { value: day }, nightTex: { value: night }, sunDir: { value: new THREE.Vector3(1, 0, 0) } }, vertexShader: VERT, fragmentShader: FRAG })
}

// Screen-sized glowing dots (satellites) and world-sized glows (fire squares).
const GLOW_VERT = /* glsl */ `
  attribute float size; attribute vec3 tint; varying vec3 vTint; uniform float scale;
  void main() { vTint = tint; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = size * scale / -mv.z; gl_Position = projectionMatrix * mv; }`
const GLOW_FRAG = /* glsl */ `
  varying vec3 vTint;
  void main() { float r = length(gl_PointCoord - 0.5) * 2.0; float a = pow(max(0.0, 1.0 - r), 2.2); gl_FragColor = vec4(vTint * a, a); }`

function dotTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64
  const x = c.getContext('2d')!
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32)
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.22, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)')
  x.fillStyle = g; x.fillRect(0, 0, 64, 64)
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace
  return t
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
const easeOut = (t: number) => 1 - (1 - t) ** 4
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

export async function createGlobeEngine(el: HTMLElement): Promise<Engine> {
  const loader = new THREE.TextureLoader()
  const tex = (url: string) => loader.loadAsync(url).then((t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t })
  const [wd, wn, sd, sn, bd, bn] = await Promise.all([worldDay, worldNight, saDay, saNight, bdDay, bdNight].map(tex))

  const g = new Globe(el, { rendererConfig: { antialias: true, powerPreference: 'high-performance' }, animateIn: false, waitForGlobeReady: false })
  g.width(el.clientWidth).height(el.clientHeight).backgroundColor('#02040a')
    .showAtmosphere(true).atmosphereColor('#5f9dff').atmosphereAltitude(0.14).globeCurvatureResolution(1).enablePointerInteraction(false)
  const renderer = g.renderer(), scene = g.scene(), cam = g.camera() as THREE.PerspectiveCamera
  renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1))   // full-screen at 2× costs four times the pixels for little gain
  const globeMat = dayNight(wd, wn)
  g.globeMaterial(globeMat)
  // We steer the camera ourselves (target, range, tilt, heading); globe.gl's orbit controls would pin it to Earth's centre.
  const controls = g.controls()
  controls.enabled = false
  controls.update = () => false

  const R = g.getGlobeRadius(), U = R / EARTH_R_KM
  // three-globe's lat/lon → xyz (its polar2Cartesian), inlined: it runs tens of thousands of times a second during a replay.
  const D2R = Math.PI / 180
  const v3 = (lat: number, lon: number, alt_km = 0) => {
    const r = R + alt_km * U, phi = (90 - lat) * D2R, theta = (90 - lon) * D2R, sp = Math.sin(phi)
    return new THREE.Vector3(r * sp * Math.cos(theta), r * Math.cos(phi), r * sp * Math.sin(theta))
  }
  const root = new THREE.Group(); scene.add(root)
  const disposers: (() => void)[] = []

  // Sharper regional images on top of the world image, each on its own finely curved patch.
  const patchMats: THREE.ShaderMaterial[] = [globeMat]
  // Patches sit on the true sphere; the globe's flat facets lie at or below it, and polygon offset settles the vertices.
  const patch = ([w, s, e, n]: Box, day: THREE.Texture, night: THREE.Texture, alt_km: number, offset: number) => {
    const cols = Math.ceil((e - w) / 0.25), rows = Math.ceil((n - s) / 0.25)
    const pos: number[] = [], nor: number[] = [], uv: number[] = [], idx: number[] = []
    for (let r = 0; r <= rows; r++) for (let c = 0; c <= cols; c++) {
      const lat = lerp(s, n, r / rows), lon = lerp(w, e, c / cols), p = v3(lat, lon, alt_km), q = p.clone().normalize()
      pos.push(p.x, p.y, p.z); nor.push(q.x, q.y, q.z); uv.push(c / cols, r / rows)
    }
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const a = r * (cols + 1) + c, b = a + 1, d = a + cols + 1, f = d + 1
      idx.push(a, b, d, b, f, d)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx)
    const m = dayNight(day, night); m.polygonOffset = true; m.polygonOffsetFactor = offset; m.polygonOffsetUnits = offset
    patchMats.push(m)
    const mesh = new THREE.Mesh(geo, m); mesh.renderOrder = -1; root.add(mesh)
    disposers.push(() => { geo.dispose(); m.dispose() })
  }
  patch(SOUTH_ASIA_BOX, sd, sn, 0, -1)
  patch(BBOX, bd, bn, 0.01, -2)

  // A fixed, deterministic star field (Fibonacci sphere; brightness from a hash, no randomness).
  {
    const n = 2600, pos = new Float32Array(n * 3), col = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      const y = 1 - (2 * (i + 0.5)) / n, r = Math.sqrt(1 - y * y), th = i * 2.399963229728653
      pos.set([Math.cos(th) * r * 4000, y * 4000, Math.sin(th) * r * 4000], i * 3)
      const h = (((Math.sin(i * 12.9898) * 43758.5453) % 1) + 1) % 1, b = 0.25 + 0.75 * h ** 3
      col.set([b * 0.9, b * 0.93, b], i * 3)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
    const m = new THREE.PointsMaterial({ size: 1.4, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.8, depthWrite: false })
    root.add(new THREE.Points(geo, m)); disposers.push(() => { geo.dispose(); m.dispose() })
  }

  // ---- camera ----
  let view: CameraView = { ...DEFAULT_VIEW }
  let tween: { from: CameraView; to: CameraView; t0: number; ms: number; peak: number; ease: (t: number) => number } | undefined
  const frameCbs = new Set<() => void>(), moveCbs = new Set<() => void>(), pickCbs = new Set<(p: { lat: number; lon: number }) => void>()

  const frame = (lat: number, lon: number) => {
    const la = clamp(lat, -88, 88)
    const T = v3(la, lon), up = T.clone().normalize()
    const north = v3(la + 0.01, lon).sub(v3(la - 0.01, lon)).normalize()
    const east = v3(la, lon + 0.01).sub(v3(la, lon - 0.01)).normalize()
    return { T, up, north, east }
  }
  const applyView = (v: CameraView) => {
    const { T, up, north, east } = frame(v.lat, v.lon)
    const h = (v.heading_deg * Math.PI) / 180, t = (clamp(v.tilt_deg, 0, maxTilt(v.range_km)) * Math.PI) / 180
    const f = north.clone().multiplyScalar(Math.cos(h)).add(east.clone().multiplyScalar(Math.sin(h)))
    const d = up.clone().multiplyScalar(Math.cos(t)).sub(f.clone().multiplyScalar(Math.sin(t)))
    cam.position.copy(T).addScaledVector(d, v.range_km * U)
    cam.up.copy(f.multiplyScalar(Math.cos(t)).add(up.multiplyScalar(Math.sin(t)))).normalize()
    cam.lookAt(T)
    cam.near = clamp(v.range_km * U * 0.02, 0.0002, 4); cam.far = 6000
    cam.updateProjectionMatrix()
  }
  const glowScale = () => renderer.getSize(new THREE.Vector2()).y / (2 * Math.tan((cam.fov * Math.PI) / 360))

  let raf = 0, lastFrame = performance.now()
  // Zooms glide: the wheel, the buttons and a double-click set a goal, and every frame covers part of the way to it.
  let goal: CameraView | null = null
  const loop = () => {
    raf = requestAnimationFrame(loop)
    const now = performance.now(), dt = Math.min(100, now - lastFrame)
    lastFrame = now
    frameCbs.forEach((cb) => cb())          // labels first: they match the frame globe.gl just drew
    if (goal && !tween) {
      view = approach(view, goal, 1 - Math.pow(0.78, dt / 16.7))
      if (settled(view, goal)) { view = goal; goal = null }
    }
    if (tween) {
      const k = clamp((performance.now() - tween.t0) / tween.ms, 0, 1), e = tween.ease(k), { from: a, to: b } = tween
      const l0 = Math.log(a.range_km), l1 = Math.log(b.range_km), lp = Math.log(tween.peak)
      const bump = lp > Math.max(l0, l1) ? 4 * e * (1 - e) * (lp - (l0 + l1) / 2) : 0
      view = { lat: lerp(a.lat, b.lat, e), lon: lerp(a.lon, b.lon, e), range_km: Math.exp(lerp(l0, l1, e) + bump),
        tilt_deg: lerp(a.tilt_deg, b.tilt_deg, e), heading_deg: lerp(a.heading_deg, b.heading_deg, e) }
      if (k >= 1) tween = undefined
    }
    applyView(view)
    glowMat.uniforms.scale.value = glowScale()
  }

  // ---- reader input: drag pans, right-drag or Ctrl-drag tilts and turns, wheel or pinch zooms ----
  const canvas = renderer.domElement
  canvas.style.touchAction = 'none'
  const pointers = new Map<number, { x: number; y: number }>()
  let mode: 'pan' | 'tilt' | null = null
  const moved = () => { tween = undefined; moveCbs.forEach((cb) => cb()) }
  /** Zoom by `f` toward the point under the cursor (or the centre), gliding there. */
  const zoomAt = (f: number, clientX?: number, clientY?: number) => {
    const at = clientX === undefined || clientY === undefined ? undefined : pickAt(clientX, clientY) ?? undefined
    goal = zoomToward(goal ?? view, f, at)
    tween = undefined
  }
  const kmPerPx = () => Math.min((2 * view.range_km * Math.tan((cam.fov * Math.PI) / 360)) / Math.max(1, canvas.clientHeight), 60)
  const pan = (dx: number, dy: number) => {
    const h = (view.heading_deg * Math.PI) / 180, k = kmPerPx()
    const dn = (dx * Math.sin(h) + dy * Math.cos(h)) * k, de = (-dx * Math.cos(h) + dy * Math.sin(h)) * k
    view = { ...view, lat: clamp(view.lat + dn / 111.19, -85, 85), lon: ((view.lon + de / (111.19 * Math.cos((view.lat * Math.PI) / 180)) + 540) % 360) - 180 }
    goal = null
  }
  let press: { t: number; travel: number } | undefined
  const down = (e: PointerEvent) => {
    canvas.setPointerCapture(e.pointerId)
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    mode = e.button === 2 || e.ctrlKey || e.metaKey ? 'tilt' : 'pan'
    press = pointers.size === 1 && e.button === 0 ? { t: performance.now(), travel: 0 } : undefined
  }
  /** The point on Earth under a screen position, or null for space. */
  const pickAt = (clientX: number, clientY: number) => {
    const r = canvas.getBoundingClientRect()
    const ray = new THREE.Raycaster()
    ray.setFromCamera(new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1), cam)
    const hit = ray.ray.intersectSphere(new THREE.Sphere(new THREE.Vector3(), R), new THREE.Vector3())
    if (!hit) return null
    const lat = 90 - (Math.acos(clamp(hit.y / R, -1, 1)) * 180) / Math.PI
    const lon = ((((90 - (Math.atan2(hit.z, hit.x) * 180) / Math.PI) % 360) + 540) % 360) - 180
    return { lat, lon }
  }
  const move = (e: PointerEvent) => {
    const p = pointers.get(e.pointerId)
    if (!p) return
    const dx = e.clientX - p.x, dy = e.clientY - p.y
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()], [ida] = [...pointers.keys()]
      const other = ida === e.pointerId ? b : a
      const before = Math.hypot(p.x - other.x, p.y - other.y), after = Math.hypot(e.clientX - other.x, e.clientY - other.y)
      const mid = pickAt((e.clientX + other.x) / 2, (e.clientY + other.y) / 2) ?? undefined
      if (before > 0 && after > 0) { view = zoomToward(view, before / after, mid); goal = null }
    } else if (mode === 'tilt') {
      view = { ...view, heading_deg: (view.heading_deg - dx * 0.3) % 360, tilt_deg: clamp(view.tilt_deg - dy * 0.3, 0, maxTilt(view.range_km)) }
      goal = null
    } else pan(dx, dy)
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (press) press.travel += Math.abs(dx) + Math.abs(dy)
    if (dx || dy) moved()
  }
  const up = (e: PointerEvent) => {
    pointers.delete(e.pointerId)
    if (!pointers.size) mode = null
    if (press && press.travel < 6 && performance.now() - press.t < 500) {
      const p = pickAt(e.clientX, e.clientY)
      clearTimeout(pendingPick)
      if (p) pendingPick = setTimeout(() => pickCbs.forEach((cb) => cb(p)), 260)
    }
    press = undefined
  }
  let pendingPick: ReturnType<typeof setTimeout> | undefined
  let lastWheel: { intent: WheelIntent; t: number } | undefined
  const wheel = (e: WheelEvent) => {
    e.preventDefault()
    const now = performance.now(), intent = wheelIntent(e, lastWheel, now)
    lastWheel = { intent, t: now }
    if (intent === 'pinch') zoomAt(Math.exp(e.deltaY * 0.012), e.clientX, e.clientY)          // touchpad pinch
    else if (intent === 'pan') pan(-e.deltaX, -e.deltaY)                                       // two-finger swipe: move
    else zoomAt(Math.exp(clamp(wheelPixels(e), -240, 240) * 0.0024), e.clientX, e.clientY)    // mouse wheel
    moved()
  }
  const dbl = (e: MouseEvent) => { clearTimeout(pendingPick); zoomAt(0.45, e.clientX, e.clientY); moved() }
  const menu = (e: Event) => e.preventDefault()
  canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move)
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up)
  canvas.addEventListener('wheel', wheel, { passive: false }); canvas.addEventListener('dblclick', dbl); canvas.addEventListener('contextmenu', menu)

  const res = new THREE.Vector2(el.clientWidth, el.clientHeight)
  const ro = new ResizeObserver(() => {
    g.width(el.clientWidth).height(el.clientHeight)
    res.set(el.clientWidth, el.clientHeight)
    lineMats.forEach((m) => m.resolution.copy(res))
  })
  ro.observe(el)

  // ---- lines ----
  const lineMats = new Set<LineMaterial>()
  const lineLayers = new Map<LineLayer, { data: Line[]; objs: Map<string, Line2 | LineSegments2> }>()
  const lineMat = (l: Line) => {
    const m = new LineMaterial({ color: new THREE.Color(l.color), linewidth: l.width_px, transparent: true, opacity: l.opacity ?? 1, depthWrite: false,
      dashed: !!l.dashed, dashSize: 0.6, gapSize: 0.5, dashScale: 1, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 })
    m.resolution.copy(res); lineMats.add(m)
    return m
  }
  const lift = (l: Line) => (l.alt_km ?? 0) + 0.04
  const linePositions = (l: Line) => l.points.flatMap((p) => { const q = v3(p.lat, p.lon, lift(l)); return [q.x, q.y, q.z] })
  /** Write a line's points into its existing GPU buffers when the point count is unchanged; otherwise build new ones. */
  const fillLine = (o: Line2, l: Line) => {
    const pts = linePositions(l), n = pts.length / 3 - 1
    const start = o.geometry.getAttribute('instanceStart') as THREE.InterleavedBufferAttribute | undefined
    if (!start || start.data.count !== n) {
      o.geometry.dispose(); o.geometry = new LineGeometry(); o.geometry.setPositions(pts)
      if (l.dashed) o.computeLineDistances()
      return
    }
    const a = start.data.array as Float32Array
    for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) { a[i * 6 + k] = pts[i * 3 + k]; a[i * 6 + 3 + k] = pts[i * 3 + 3 + k] }
    start.data.needsUpdate = true
    const dist = o.geometry.getAttribute('instanceDistanceStart') as THREE.InterleavedBufferAttribute | undefined
    if (l.dashed && dist) {
      const d = dist.data.array as Float32Array
      let acc = 0
      for (let i = 0; i < n; i++) {
        d[i * 2] = acc
        acc += Math.hypot(pts[i * 3 + 3] - pts[i * 3], pts[i * 3 + 4] - pts[i * 3 + 1], pts[i * 3 + 5] - pts[i * 3 + 2])
        d[i * 2 + 1] = acc
      }
      dist.data.needsUpdate = true
    }
  }
  const dropLine = (o: Line2 | LineSegments2) => { root.remove(o); o.geometry.dispose(); (o.material as LineMaterial).dispose(); lineMats.delete(o.material as LineMaterial) }

  // ---- areas ----
  const areaObjs = new Map<AreaLayer, { data: Area[]; objs: Map<string, THREE.Mesh> }>()
  const areaGeometry = (a: Area, reuse?: THREE.BufferGeometry) => {
    if (reuse && a.grid && a.grid.length > 1) {
      const attr = reuse.getAttribute('position') as THREE.BufferAttribute | undefined
      const n = a.grid.length * a.grid[0].length
      if (attr && attr.count === n) {
        let i = 0
        for (const row of a.grid) for (const p of row) { const q = v3(p.lat, p.lon, 3); attr.setXYZ(i++, q.x, q.y, q.z) }
        attr.needsUpdate = true
        reuse.computeBoundingSphere()
        return reuse
      }
    }
    const geo = new THREE.BufferGeometry(), pos: number[] = [], idx: number[] = []
    if (a.grid && a.grid.length > 1) {
      const rows = a.grid.length, cols = a.grid[0].length
      // ~150 km cells sag about 0.5 km below the sphere between vertices; 3 km of lift keeps them above the ground.
      for (const row of a.grid) for (const p of row) { const q = v3(p.lat, p.lon, 3); pos.push(q.x, q.y, q.z) }
      for (let r = 0; r < rows - 1; r++) for (let c = 0; c < cols - 1; c++) {
        const i = r * cols + c
        idx.push(i, i + 1, i + cols, i + 1, i + cols + 1, i + cols)
      }
    } else if (a.ring && a.ring.length > 2) {
      for (const p of a.ring) { const q = v3(p.lat, p.lon, 0.03); pos.push(q.x, q.y, q.z) }
      for (const f of THREE.ShapeUtils.triangulateShape(a.ring.map((p) => new THREE.Vector2(p.lon, p.lat)), [])) idx.push(...f)
    }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx)
    return geo
  }

  // ---- fire columns: shaded instanced boxes plus a glow on top of the recent ones ----
  const box = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0).toNonIndexed()
  {
    const shade: number[] = [], nrm = box.getAttribute('normal')
    for (let i = 0; i < nrm.count; i++) { const s = nrm.getY(i) > 0.5 ? 1 : nrm.getY(i) < -0.5 ? 0.4 : nrm.getX(i) !== 0 ? 0.78 : 0.62; shade.push(s, s, s) }
    box.setAttribute('color', new THREE.Float32BufferAttribute(shade, 3))
  }
  const colMat = new THREE.MeshBasicMaterial({ vertexColors: true })
  let cols = new THREE.InstancedMesh(box, colMat, 1); cols.count = 0; root.add(cols)
  const glowMat = new THREE.ShaderMaterial({ uniforms: { scale: { value: 1 } }, vertexShader: GLOW_VERT, fragmentShader: GLOW_FRAG,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
  const glows = new THREE.Points(new THREE.BufferGeometry(), glowMat); glows.frustumCulled = false; root.add(glows)
  let glowCap = 0
  const growGlows = (n: number) => {
    glowCap = Math.ceil(n * 1.5) + 32
    const gg = new THREE.BufferGeometry()
    gg.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(glowCap * 3), 3))
    gg.setAttribute('size', new THREE.Float32BufferAttribute(new Float32Array(glowCap), 1))
    gg.setAttribute('tint', new THREE.Float32BufferAttribute(new Float32Array(glowCap * 3), 3))
    gg.setDrawRange(0, 0)
    glows.geometry.dispose(); glows.geometry = gg
  }
  growGlows(256)

  // ---- satellites ----
  const satTex = dotTexture()
  const satObjs = new Map<string, THREE.Sprite>()

  raf = requestAnimationFrame(loop)
  applyView(view)

  const engine: Engine = {
    kind: 'globe',
    setTime(t_utc) {
      const s = sunPoint(t_utc), dir = v3(s.lat, s.lon).normalize()
      patchMats.forEach((m) => m.uniforms.sunDir.value.copy(dir))
    },
    setSats(sats: SatMark[]) {
      const keep = new Set(sats.map((s) => s.id))
      for (const [id, o] of satObjs) if (!keep.has(id as SatMark['id'])) { root.remove(o); o.material.dispose(); satObjs.delete(id) }
      for (const s of sats) {
        let o = satObjs.get(s.id)
        if (!o) {
          o = new THREE.Sprite(new THREE.SpriteMaterial({ map: satTex, sizeAttenuation: false, depthWrite: false, transparent: true }))
          o.scale.setScalar(0.034); o.renderOrder = 3; root.add(o); satObjs.set(s.id, o)
        }
        o.material.color.set(s.color); o.material.opacity = s.dim ? 0.45 : 1
        o.position.copy(v3(s.lat, s.lon, s.alt_km))
      }
    },
    setLines(layer, lines) {
      let L = lineLayers.get(layer)
      if (L?.data === lines) return
      if (!L) { L = { data: lines, objs: new Map() }; lineLayers.set(layer, L) }
      L.data = lines
      if (layer === 'outline') {                    // one merged draw call for every boundary ring
        L.objs.forEach(dropLine); L.objs.clear()
        if (!lines.length) return
        const seg: number[] = []
        for (const l of lines) for (let i = 1; i < l.points.length; i++) {
          const a = v3(l.points[i - 1].lat, l.points[i - 1].lon, lift(l)), b = v3(l.points[i].lat, l.points[i].lon, lift(l))
          seg.push(a.x, a.y, a.z, b.x, b.y, b.z)
        }
        const geo = new LineSegmentsGeometry().setPositions(seg)
        const o = new LineSegments2(geo, lineMat(lines[0])); root.add(o); L.objs.set('all', o)
        return
      }
      const keep = new Set(lines.map((l) => l.id))
      for (const [id, o] of L.objs) if (!keep.has(id)) { dropLine(o); L.objs.delete(id) }
      for (const l of lines) {
        if (l.points.length < 2) continue
        let o = L.objs.get(l.id) as Line2 | undefined
        if (!o) { o = new Line2(new LineGeometry(), lineMat(l)); o.renderOrder = 2; o.frustumCulled = false; root.add(o); L.objs.set(l.id, o) }
        fillLine(o, l)
        const m = o.material as LineMaterial
        m.color.set(l.color); m.opacity = l.opacity ?? 1; m.linewidth = l.width_px
      }
    },
    setAreas(layer, areas) {
      let A = areaObjs.get(layer)
      if (A?.data === areas) return
      if (!A) { A = { data: areas, objs: new Map() }; areaObjs.set(layer, A) }
      A.data = areas
      const keep = new Set(areas.map((a) => a.id))
      for (const [id, o] of A.objs) if (!keep.has(id)) { root.remove(o); o.geometry.dispose(); (o.material as THREE.Material).dispose(); A.objs.delete(id) }
      for (const a of areas) {
        let o = A.objs.get(a.id)
        if (!o) {
          o = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide,
            polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }))
          o.renderOrder = 1; root.add(o); A.objs.set(a.id, o)
        }
        const g2 = areaGeometry(a, o.geometry)
        if (g2 !== o.geometry) { o.geometry.dispose(); o.geometry = g2 }
        const m = o.material as THREE.MeshBasicMaterial
        m.color.set(a.color); m.opacity = a.opacity
      }
    },
    setColumns(list: Column[], width_km) {
      if (list.length > cols.instanceMatrix.count) {
        root.remove(cols); cols.dispose()
        cols = new THREE.InstancedMesh(box, colMat, Math.ceil(list.length * 1.25)); root.add(cols)
      }
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0), c = new THREE.Color()
      const gpos: number[] = [], gsize: number[] = [], gtint: number[] = []
      list.forEach((col, i) => {
        const base = v3(col.lat, col.lon, 0.03), n = base.clone().normalize()
        q.setFromUnitVectors(Y, n)
        m.compose(base, q, new THREE.Vector3(width_km * U, Math.max(0.3, col.height_km) * U, width_km * U))
        cols.setMatrixAt(i, m); cols.setColorAt(i, c.set(col.color))
        if (col.glow > 0.02) {
          const top = v3(col.lat, col.lon, col.height_km + 1)
          gpos.push(top.x, top.y, top.z); gsize.push(width_km * U * (2 + 5 * col.glow)); c.set(col.color).multiplyScalar(0.35 + 0.65 * col.glow); gtint.push(c.r, c.g, c.b)
        }
      })
      cols.count = list.length
      cols.instanceMatrix.needsUpdate = true
      if (cols.instanceColor) cols.instanceColor.needsUpdate = true
      const n = gsize.length
      if (n > glowCap) growGlows(n)                   // grow the buffers rarely; otherwise refill them in place
      const ga = glows.geometry.attributes as Record<'position' | 'size' | 'tint', THREE.BufferAttribute>
      ;(ga.position.array as Float32Array).set(gpos); (ga.size.array as Float32Array).set(gsize); (ga.tint.array as Float32Array).set(gtint)
      ga.position.needsUpdate = true; ga.size.needsUpdate = true; ga.tint.needsUpdate = true
      glows.geometry.setDrawRange(0, n)
    },
    setCloseImagery() { /* the bundled Bangladesh image is always on */ },
    view: () => ({ ...view }),
    flyTo(to, ms, how = 'inOut') {
      const target = { ...to, lon: view.lon + ((((to.lon - view.lon) % 360) + 540) % 360) - 180 }
      goal = null
      if (ms <= 0) { tween = undefined; view = target; return }
      const dist = Math.hypot(target.lat - view.lat, (target.lon - view.lon) * Math.cos((view.lat * Math.PI) / 180)) * 111.19
      tween = { from: { ...view }, to: target, t0: performance.now(), ms, peak: Math.max(view.range_km, to.range_km, dist * 1.4), ease: how === 'out' ? easeOut : easeInOut }
    },
    fitRange(fraction) {
      const vfov = (cam.fov * Math.PI) / 180, hfov = 2 * Math.atan(Math.tan(vfov / 2) * cam.aspect)
      return EARTH_R_KM / Math.sin((fraction * Math.min(vfov, hfov)) / 2) - EARTH_R_KM
    },
    zoomBy(f) { zoomAt(f); moved() },
    project(lat, lon, alt_km) {
      const p = v3(lat, lon, alt_km), c = cam.position, d = p.clone().sub(c)
      // behind Earth? (ray from camera to the point meets the sphere first)
      const a = d.dot(d), b = 2 * c.dot(d), cc = c.dot(c) - (R * 0.999) ** 2, disc = b * b - 4 * a * cc
      if (disc > 0) { const s = (-b - Math.sqrt(disc)) / (2 * a); if (s > 0 && s < 0.999) return null }
      const ndc = p.project(cam)
      if (ndc.z > 1 || Math.abs(ndc.x) > 1.1 || Math.abs(ndc.y) > 1.1) return null
      return { x: ((ndc.x + 1) / 2) * el.clientWidth, y: ((1 - ndc.y) / 2) * el.clientHeight }
    },
    onFrame(cb) { frameCbs.add(cb); return () => frameCbs.delete(cb) },
    onUserMove(cb) { moveCbs.add(cb); return () => moveCbs.delete(cb) },
    onPick(cb) { pickCbs.add(cb); return () => pickCbs.delete(cb) },
    destroy() {
      cancelAnimationFrame(raf); ro.disconnect()
      canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move)
      canvas.removeEventListener('pointerup', up); canvas.removeEventListener('pointercancel', up)
      canvas.removeEventListener('wheel', wheel); canvas.removeEventListener('dblclick', dbl); canvas.removeEventListener('contextmenu', menu)
      clearTimeout(pendingPick)
      lineLayers.forEach((L) => L.objs.forEach(dropLine))
      areaObjs.forEach((A) => A.objs.forEach((o) => { o.geometry.dispose(); (o.material as THREE.Material).dispose() }))
      satObjs.forEach((o) => o.material.dispose()); satTex.dispose()
      cols.dispose(); box.dispose(); colMat.dispose(); glows.geometry.dispose(); glowMat.dispose()
      disposers.forEach((f) => f())
      ;[wd, wn, sd, sn, bd, bn].forEach((t) => t.dispose())
      g._destructor()
      el.innerHTML = ''
    },
  }
  return engine
}
