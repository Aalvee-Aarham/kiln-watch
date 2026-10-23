import type * as CesiumNS from 'cesium'
import { wheelIntent, type WheelIntent } from '../../lib/space/input'
import { MAX_RANGE_KM, MIN_RANGE_KM, wheelPixels } from '../../lib/space/camera'
import { DEFAULT_VIEW, type Area, type AreaLayer, type CameraView, type Column, type Engine, type LatLon, type Line, type LineLayer, type SatMark } from './types'

type C = typeof CesiumNS
const GIBS = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/'
const EOX_S2 = 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g/{z}/{y}/{x}.jpg'
const EARTH_POLAR_M = 6_356_752
const SWATH_HEIGHT_M = 3000
const EARTH_R_KM = 6371.0088

/** The detailed globe: CesiumJS with NASA GIBS imagery (Blue Marble by day, Black Marble at night) and Sentinel-2 cloudless close up. No keys. */
export async function createCesiumEngine(el: HTMLElement, Cs: C, creditEl: HTMLElement): Promise<Engine> {
  await Promise.all([Cs.GroundPrimitive.initializeTerrainHeights(), Cs.GroundPolylinePrimitive.initializeTerrainHeights()])
  const tiles = (url: string, credit: string, maximumLevel: number) => new Cs.UrlTemplateImageryProvider({ url, credit: new Cs.Credit(credit, true), maximumLevel })
  const day = new Cs.ImageryLayer(tiles(GIBS + 'BlueMarble_NextGeneration/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg', 'NASA Blue Marble', 8))
  day.nightAlpha = 0
  // Draw only when something changed (camera, tiles, or one of our setters): an idle globe costs nothing.
  const viewer = new Cs.Viewer(el, {
    baseLayer: day, baseLayerPicker: false, geocoder: false, homeButton: false, sceneModePicker: false, navigationHelpButton: false,
    animation: false, timeline: false, fullscreenButton: false, infoBox: false, selectionIndicator: false, vrButton: false,
    creditContainer: creditEl, shouldAnimate: false, msaaSamples: 2, requestRenderMode: true, maximumRenderTimeChange: Infinity,
  })
  const { scene, camera } = viewer
  const redraw = () => scene.requestRender()
  const layers = viewer.imageryLayers
  const night = layers.addImageryProvider(tiles(GIBS + 'VIIRS_Black_Marble/default/2016-01-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png', 'NASA Black Marble · GIBS', 8))
  night.dayAlpha = 0; night.nightAlpha = 1; night.brightness = 1.5
  // Sentinel-2 only once zoomed in (terrain level ≥ 7), so the whole Earth stays NASA Blue Marble.
  const close = new Cs.ImageryLayer(tiles(EOX_S2, 'Sentinel-2 cloudless 2024 by EOX (modified Copernicus Sentinel data), CC BY-NC-SA 4.0', 15),
    { minimumTerrainLevel: 7, nightAlpha: 0, show: false })
  layers.add(close)
  scene.globe.enableLighting = true
  scene.globe.dynamicAtmosphereLighting = true
  scene.globe.dynamicAtmosphereLightingFromSun = true
  scene.globe.showGroundAtmosphere = true
  scene.backgroundColor = Cs.Color.fromCssColorString('#02040a')
  viewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(Cs.ScreenSpaceEventType.LEFT_DOUBLE_CLICK)

  // Same gestures as the light globe: drag pans, right-drag or Ctrl-drag tilts, wheel or pinch zooms. The wheel is ours
  // (below), so both globes zoom the same way; Cesium keeps touch pinch.
  const ssc = scene.screenSpaceCameraController
  ssc.zoomEventTypes = [Cs.CameraEventType.PINCH]
  ssc.tiltEventTypes = [Cs.CameraEventType.MIDDLE_DRAG, Cs.CameraEventType.RIGHT_DRAG, Cs.CameraEventType.PINCH, { eventType: Cs.CameraEventType.LEFT_DRAG, modifier: Cs.KeyboardEventModifier.CTRL }]
  ssc.minimumZoomDistance = MIN_RANGE_KM * 1000; ssc.maximumZoomDistance = MAX_RANGE_KM * 1000
  const canvas = viewer.canvas
  const moveCbs = new Set<() => void>(), frameCbs = new Set<() => void>(), pickCbs = new Set<(p: LatLon) => void>()
  const moved = () => moveCbs.forEach((cb) => cb())
  // Zoom toward the point under the cursor: the camera slides along the line from itself through that point, keeping its
  // direction, so the point stays exactly where it is on screen. Wheel steps glide over a few frames.
  let zoomGoal: CesiumNS.Cartesian3 | undefined
  const groundAt = (x: number, y: number) => camera.pickEllipsoid(new Cs.Cartesian2(x, y), scene.globe.ellipsoid)
  const zoomAt = (f: number, x = canvas.clientWidth / 2, y = canvas.clientHeight / 2) => {
    const from = zoomGoal ?? Cs.Cartesian3.clone(camera.positionWC)
    const p = groundAt(x, y) ?? groundAt(canvas.clientWidth / 2, canvas.clientHeight / 2)
    if (!p) { const h = camera.positionCartographic.height; if (f < 1) camera.zoomIn(h * (1 - f)); else camera.zoomOut(h * (f - 1)); redraw(); return }
    const off = Cs.Cartesian3.subtract(from, p, new Cs.Cartesian3())
    const d = Cs.Cartesian3.magnitude(off), next = Math.max(MIN_RANGE_KM * 1000, Math.min(MAX_RANGE_KM * 1000, d * f))
    zoomGoal = Cs.Cartesian3.add(p, Cs.Cartesian3.multiplyByScalar(off, next / d, off), new Cs.Cartesian3())
    redraw()
  }
  let lastStep = performance.now()
  const stepZoom = () => {
    const now = performance.now(), dt = Math.min(100, now - lastStep)
    lastStep = now
    if (!zoomGoal) return
    const k = 1 - Math.pow(0.72, dt / 16.7), cur = camera.position
    Cs.Cartesian3.lerp(cur, zoomGoal, k, cur)
    if (Cs.Cartesian3.distance(cur, zoomGoal) < Math.max(0.5, Cs.Cartesian3.magnitude(cur) * 1e-9)) { Cs.Cartesian3.clone(zoomGoal, cur); zoomGoal = undefined }
    redraw()
  }
  scene.preRender.addEventListener(stepZoom)
  // Touchpad: a two-finger swipe moves the globe, a pinch zooms. Mouse: the wheel zooms.
  let lastWheel: { intent: WheelIntent; t: number } | undefined
  const wheel = (e: WheelEvent) => {
    moved()
    e.preventDefault(); e.stopPropagation()
    const r = canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top
    const now = performance.now(), intent = wheelIntent(e, lastWheel, now)
    lastWheel = { intent, t: now }
    if (intent === 'pinch') { zoomAt(Math.exp(e.deltaY * 0.012), x, y); return }
    if (intent === 'zoom') { zoomAt(Math.exp(Math.max(-240, Math.min(240, wheelPixels(e))) * 0.0024), x, y); return }
    zoomGoal = undefined
    const fovy = (camera.frustum as CesiumNS.PerspectiveFrustum).fovy ?? 1
    const kmPx = Math.max(0.002, (2 * (camera.positionCartographic.height / 1000) * Math.tan(fovy / 2)) / Math.max(1, canvas.clientHeight))
    const angle = (px: number) => Math.min(0.6, (Math.abs(px) * kmPx) / EARTH_R_KM) * Math.sign(px)
    if (e.deltaX) camera.rotateRight(angle(e.deltaX))
    if (e.deltaY) camera.rotateUp(angle(e.deltaY))          // like scrolling a page: two fingers up brings the north into view
    redraw()
  }
  // A click picks a place once it is clear it was not half of a double-click; a double-click zooms toward the point.
  const clicks = new Cs.ScreenSpaceEventHandler(canvas)
  let pendingPick: ReturnType<typeof setTimeout> | undefined
  clicks.setInputAction((ev: { position: CesiumNS.Cartesian2 }) => {
    const hit = camera.pickEllipsoid(ev.position, scene.globe.ellipsoid)
    clearTimeout(pendingPick)
    if (!hit) return
    const g = Cs.Cartographic.fromCartesian(hit)
    const p = { lat: Cs.Math.toDegrees(g.latitude), lon: Cs.Math.toDegrees(g.longitude) }
    pendingPick = setTimeout(() => pickCbs.forEach((cb) => cb(p)), 260)
  }, Cs.ScreenSpaceEventType.LEFT_CLICK)
  clicks.setInputAction((ev: { position: CesiumNS.Cartesian2 }) => {
    clearTimeout(pendingPick)
    const hit = camera.pickEllipsoid(ev.position, scene.globe.ellipsoid)
    if (!hit) return
    const from = camera.positionWC, dist = Cs.Cartesian3.distance(from, hit)
    const dir = Cs.Cartesian3.normalize(Cs.Cartesian3.subtract(hit, from, new Cs.Cartesian3()), new Cs.Cartesian3())
    const to = Cs.Cartesian3.add(from, Cs.Cartesian3.multiplyByScalar(dir, Math.min(dist * 0.55, dist - MIN_RANGE_KM * 1000), new Cs.Cartesian3()), new Cs.Cartesian3())
    camera.flyTo({ destination: to, orientation: { heading: camera.heading, pitch: camera.pitch, roll: camera.roll }, duration: 0.45 })
    moved()
  }, Cs.ScreenSpaceEventType.LEFT_DOUBLE_CLICK)
  const drag = (e: PointerEvent) => { if (e.buttons) { zoomGoal = undefined; moved() } }
  el.addEventListener('wheel', wheel, { capture: true, passive: false })
  canvas.addEventListener('pointermove', drag)
  canvas.style.touchAction = 'none'

  const pos = (lat: number, lon: number, alt_m: number) => Cs.Cartesian3.fromDegrees(lon, lat, alt_m)
  const color = (css: string, alpha = 1) => Cs.Color.fromCssColorString(css).withAlpha(alpha)

  // ---- satellites ----
  const points = scene.primitives.add(new Cs.PointPrimitiveCollection()) as CesiumNS.PointPrimitiveCollection
  const satPts = new Map<string, { dot: CesiumNS.PointPrimitive; halo: CesiumNS.PointPrimitive }>()

  // ---- lines: moving ones in a PolylineCollection (cheap to update); outlines and footprints hug the ground ----
  const lineCols = new Map<LineLayer, { data: Line[]; coll: CesiumNS.PolylineCollection; objs: Map<string, CesiumNS.Polyline> }>()
  const lineMaterial = (l: Line) => l.dashed
    ? Cs.Material.fromType('PolylineDash', { color: color(l.color, l.opacity ?? 1), dashLength: 14 })
    : Cs.Material.fromType('Color', { color: color(l.color, l.opacity ?? 1) })
  const linePositions = (l: Line) => l.points.map((p) => pos(p.lat, p.lon, (l.alt_km ?? 0) * 1000 + 40))
  const groundLines = new Map<LineLayer, { data: Line[]; prims: CesiumNS.GroundPolylinePrimitive[] }>()
  const setGroundLines = (layer: LineLayer, lines: Line[]) => {
    let G = groundLines.get(layer)
    if (G?.data === lines) return
    if (!G) { G = { data: lines, prims: [] }; groundLines.set(layer, G) }
    G.data = lines
    G.prims.forEach((p) => scene.groundPrimitives.remove(p)); G.prims = []
    const geo = (l: Line) => new Cs.GroundPolylineGeometry({ positions: l.points.map((p) => pos(p.lat, p.lon, 0)), width: l.width_px })
    const solid = lines.filter((l) => !l.dashed && l.points.length > 1)
    if (solid.length) G.prims.push(scene.groundPrimitives.add(new Cs.GroundPolylinePrimitive({ asynchronous: false, appearance: new Cs.PolylineColorAppearance(),
      geometryInstances: solid.map((l) => new Cs.GeometryInstance({ geometry: geo(l), attributes: { color: Cs.ColorGeometryInstanceAttribute.fromColor(color(l.color, l.opacity ?? 1)) } })) })))
    for (const l of lines.filter((x) => x.dashed && x.points.length > 1))
      G.prims.push(scene.groundPrimitives.add(new Cs.GroundPolylinePrimitive({ asynchronous: false, geometryInstances: new Cs.GeometryInstance({ geometry: geo(l) }),
        appearance: new Cs.PolylineMaterialAppearance({ material: Cs.Material.fromType('PolylineDash', { color: color(l.color, l.opacity ?? 1), dashLength: 12 }) }) })))
  }

  // ---- areas: footprints draped on the ground; swaths (huge, and redrawn ten times a second) as ready-made triangles a little
  // above it. The swath already arrives as a grid that follows Earth's curve, so Cesium's polygon tessellation (~140 ms) is skipped.
  const areaPrims = new Map<AreaLayer, { data: Area[]; prim?: CesiumNS.GroundPrimitive | CesiumNS.Primitive }>()
  const ringOf = (a: Area) => a.ring ?? (a.grid ? [...a.grid.map((r) => r[0]), ...a.grid.map((r) => r[r.length - 1]).reverse()] : [])
  const gridGeometry = (grid: { lat: number; lon: number }[][], height_m: number) => {
    const rows = grid.length, cols = grid[0].length, values = new Float64Array(rows * cols * 3)
    let k = 0
    for (const row of grid) for (const p of row) { const c = Cs.Cartesian3.fromDegrees(p.lon, p.lat, height_m); values[k++] = c.x; values[k++] = c.y; values[k++] = c.z }
    const indices = new Uint16Array((rows - 1) * (cols - 1) * 6)
    let n = 0
    for (let r = 0; r < rows - 1; r++) for (let c = 0; c < cols - 1; c++) {
      const i = r * cols + c
      indices.set([i, i + 1, i + cols, i + 1, i + cols + 1, i + cols], n); n += 6
    }
    const attributes = new Cs.GeometryAttributes()
    attributes.position = new Cs.GeometryAttribute({ componentDatatype: Cs.ComponentDatatype.DOUBLE, componentsPerAttribute: 3, values })
    return new Cs.Geometry({ attributes, indices, primitiveType: Cs.PrimitiveType.TRIANGLES, boundingSphere: Cs.BoundingSphere.fromVertices(Array.from(values)) })
  }

  // ---- fire columns: sun-shaded boxes built off the main thread; the old set stays up until the new one is ready ----
  let colPrim: CesiumNS.Primitive | undefined, pending: CesiumNS.Primitive | undefined
  let queued: { list: Column[]; width_km: number } | undefined
  const glowPts = scene.primitives.add(new Cs.PointPrimitiveCollection()) as CesiumNS.PointPrimitiveCollection
  let colData: { list: Column[]; width_km: number } = { list: [], width_km: 10 }
  const unitBox = Cs.BoxGeometry.fromDimensions({ dimensions: new Cs.Cartesian3(1, 1, 1), vertexFormat: Cs.PerInstanceColorAppearance.VERTEX_FORMAT })
  const kmPerPx = () => {
    const h = camera.positionCartographic.height / 1000
    return Math.max(0.01, (2 * h * Math.tan(((camera.frustum as CesiumNS.PerspectiveFrustum).fov ?? 1) / 2)) / Math.max(1, canvas.clientHeight))
  }
  const sizeGlows = () => {
    const px = Math.max(2, Math.min(22, colData.width_km / kmPerPx()))
    for (let i = 0; i < glowPts.length; i++) { const g = glowPts.get(i); g.pixelSize = px * (1.3 + 1.6 * (g.id as number)) }
  }
  camera.changed.addEventListener(sizeGlows)
  camera.percentageChanged = 0.05
  const buildColumns = (list: Column[], width_km: number) => {
    const w = width_km * 1000
    return scene.primitives.add(new Cs.Primitive({ asynchronous: true, appearance: new Cs.PerInstanceColorAppearance({ translucent: false }),
      geometryInstances: list.map((c) => {
        const h = Math.max(300, c.height_km * 1000)
        const m = Cs.Matrix4.multiplyByScale(Cs.Transforms.eastNorthUpToFixedFrame(pos(c.lat, c.lon, h / 2)), new Cs.Cartesian3(w, w, h), new Cs.Matrix4())
        return new Cs.GeometryInstance({ geometry: unitBox, modelMatrix: m, attributes: { color: Cs.ColorGeometryInstanceAttribute.fromColor(color(c.color)) } })
      }) })) as CesiumNS.Primitive
  }
  const showGlows = (list: Column[]) => {
    glowPts.removeAll()
    for (const c of list) if (c.glow > 0.02)
      glowPts.add({ position: pos(c.lat, c.lon, Math.max(300, c.height_km * 1000)), color: color(c.color, 0.2 + 0.35 * c.glow), pixelSize: 8, id: c.glow })
    sizeGlows()
  }

  const post = () => {
    if (pending?.ready) {                      // swap in the finished column set, then start the newest queued one
      if (colPrim) scene.primitives.remove(colPrim)
      colPrim = pending; pending = undefined
      if (queued) { const q = queued; queued = undefined; engine.setColumns(q.list, q.width_km) }
    }
    if (pending) redraw()                       // keep frames coming until the workers finish
    frameCbs.forEach((cb) => cb())
  }
  scene.postRender.addEventListener(post)

  const view = (): CameraView => {
    const centre = new Cs.Cartesian2(canvas.clientWidth / 2, canvas.clientHeight / 2)
    const hit = camera.pickEllipsoid(centre, scene.globe.ellipsoid)
    const c = camera.positionCartographic
    if (!hit) return { lat: Cs.Math.toDegrees(c.latitude), lon: Cs.Math.toDegrees(c.longitude), range_km: c.height / 1000, tilt_deg: 0, heading_deg: Cs.Math.toDegrees(camera.heading) }
    const g = Cs.Cartographic.fromCartesian(hit)
    return { lat: Cs.Math.toDegrees(g.latitude), lon: Cs.Math.toDegrees(g.longitude), range_km: Cs.Cartesian3.distance(camera.positionWC, hit) / 1000,
      tilt_deg: 90 + Cs.Math.toDegrees(camera.pitch), heading_deg: Cs.Math.toDegrees(camera.heading) }
  }
  const offset = (v: CameraView) => new Cs.HeadingPitchRange(Cs.Math.toRadians(v.heading_deg), Cs.Math.toRadians(v.tilt_deg - 90), v.range_km * 1000)
  const goTo = (v: CameraView) => { camera.lookAt(pos(v.lat, v.lon, 0), offset(v)); camera.lookAtTransform(Cs.Matrix4.IDENTITY) }
  goTo({ ...DEFAULT_VIEW, range_km: 150_000 })       // far out: where the page's arrival from deep space begins
  // Show the globe only once its first images are in, so the arrival from deep space never shows an empty sphere.
  scene.globe.baseColor = Cs.Color.fromCssColorString('#0b1a33')
  await new Promise<void>((done) => {
    const until = performance.now() + 4000
    const check = () => { if (scene.globe.tilesLoaded || performance.now() > until) { scene.postRender.removeEventListener(check); done() } else redraw() }
    scene.postRender.addEventListener(check)
    redraw()
  })

  const engine: Engine = {
    kind: 'cesium',
    setTime(t_utc) { viewer.clock.currentTime = Cs.JulianDate.fromDate(new Date(t_utc)); redraw() },
    setSats(sats: SatMark[]) {
      const keep = new Set<string>(sats.map((s) => s.id))
      for (const [id, p] of satPts) if (!keep.has(id)) { points.remove(p.dot); points.remove(p.halo); satPts.delete(id) }
      for (const s of sats) {
        let p = satPts.get(s.id)
        if (!p) {
          p = { halo: points.add({ pixelSize: 24 }), dot: points.add({ pixelSize: 9, outlineWidth: 2, outlineColor: Cs.Color.WHITE.withAlpha(0.85) }) }
          satPts.set(s.id, p)
        }
        const at = pos(s.lat, s.lon, s.alt_km * 1000)
        p.dot.position = at; p.halo.position = at
        p.dot.color = color(s.color, s.dim ? 0.5 : 1); p.halo.color = color(s.color, s.dim ? 0.12 : 0.28)
      }
      redraw()
    },
    setLines(layer, lines) {
      if (layer === 'outline' || layer === 'footprint') { setGroundLines(layer, lines); redraw(); return }
      let L = lineCols.get(layer)
      if (L?.data === lines) return
      if (!L) { L = { data: lines, coll: scene.primitives.add(new Cs.PolylineCollection()), objs: new Map() }; lineCols.set(layer, L) }
      L.data = lines
      const keep = new Set(lines.map((l) => l.id))
      for (const [id, o] of L.objs) if (!keep.has(id)) { L.coll.remove(o); L.objs.delete(id) }
      for (const l of lines) {
        if (l.points.length < 2) continue
        const o = L.objs.get(l.id)
        if (!o) L.objs.set(l.id, L.coll.add({ positions: linePositions(l), width: l.width_px, material: lineMaterial(l) }))
        else { o.positions = linePositions(l); o.width = l.width_px; o.material.uniforms.color = color(l.color, l.opacity ?? 1) }
      }
      redraw()
    },
    setAreas(layer, areas) {
      let A = areaPrims.get(layer)
      if (A?.data === areas) return
      if (!A) { A = { data: areas }; areaPrims.set(layer, A) }
      A.data = areas
      const ground = layer === 'footprint'
      if (A.prim) (ground ? scene.groundPrimitives : scene.primitives).remove(A.prim)
      A.prim = undefined
      redraw()
      const instances = areas.map((a) => {
        const attributes = { color: Cs.ColorGeometryInstanceAttribute.fromColor(color(a.color, a.opacity)) }
        if (!ground && a.grid && a.grid.length > 1 && a.grid[0].length > 1) return new Cs.GeometryInstance({ geometry: gridGeometry(a.grid, SWATH_HEIGHT_M), attributes })
        const ring = ringOf(a)
        return ring.length < 3 ? null : new Cs.GeometryInstance({ geometry: new Cs.PolygonGeometry({ polygonHierarchy: new Cs.PolygonHierarchy(ring.map((p) => pos(p.lat, p.lon, 0))) }), attributes })
      }).filter((x): x is CesiumNS.GeometryInstance => !!x)
      if (!instances.length) return
      const appearance = new Cs.PerInstanceColorAppearance({ flat: true, translucent: true })
      A.prim = ground
        ? scene.groundPrimitives.add(new Cs.GroundPrimitive({ geometryInstances: instances, asynchronous: false, appearance }))
        : scene.primitives.add(new Cs.Primitive({ geometryInstances: instances, asynchronous: false, compressVertices: false, appearance }))
    },
    setColumns(list, width_km) {
      colData = { list, width_km }
      if (pending) { queued = { list, width_km }; return }      // one build at a time; only the newest waiting set matters
      showGlows(list)
      if (!list.length) { if (colPrim) scene.primitives.remove(colPrim); colPrim = undefined; redraw(); return }
      pending = buildColumns(list, width_km)
      redraw()
    },
    setCloseImagery(on) { if (close.show !== on) { close.show = on; redraw() } },
    view,
    flyTo(v, ms, how = 'inOut') {
      zoomGoal = undefined
      if (ms <= 0) { camera.cancelFlight(); goTo(v); redraw(); return }
      camera.flyToBoundingSphere(new Cs.BoundingSphere(pos(v.lat, v.lon, 0), 0), { offset: offset(v), duration: ms / 1000,
        easingFunction: how === 'out' ? Cs.EasingFunction.QUARTIC_OUT : undefined })
    },
    fitRange(fraction) {
      const f = camera.frustum as CesiumNS.PerspectiveFrustum
      const vfov = f.fovy ?? 1, hfov = 2 * Math.atan(Math.tan(vfov / 2) * (f.aspectRatio ?? 1))
      return EARTH_R_KM / Math.sin((fraction * Math.min(vfov, hfov)) / 2) - EARTH_R_KM
    },
    zoomBy(f) { zoomAt(f); moved() },                  // the buttons and keys: a glide toward the centre
    project(lat, lon, alt_km) {
      const p = pos(lat, lon, alt_km * 1000), c = camera.positionWC
      const d = Cs.Cartesian3.subtract(p, c, new Cs.Cartesian3())
      const a = Cs.Cartesian3.dot(d, d), b = 2 * Cs.Cartesian3.dot(c, d), cc = Cs.Cartesian3.dot(c, c) - EARTH_POLAR_M ** 2, disc = b * b - 4 * a * cc
      if (disc > 0) { const s = (-b - Math.sqrt(disc)) / (2 * a); if (s > 0 && s < 0.999) return null }
      const w = Cs.SceneTransforms.worldToWindowCoordinates(scene, p)
      if (!w || w.x < -40 || w.y < -40 || w.x > canvas.clientWidth + 40 || w.y > canvas.clientHeight + 40) return null
      return { x: w.x, y: w.y }
    },
    onFrame(cb) { frameCbs.add(cb); redraw(); return () => frameCbs.delete(cb) },
    onUserMove(cb) { moveCbs.add(cb); return () => moveCbs.delete(cb) },
    onPick(cb) { pickCbs.add(cb); return () => pickCbs.delete(cb) },
    destroy() {
      clearTimeout(pendingPick)
      clicks.destroy()
      el.removeEventListener('wheel', wheel, { capture: true })
      canvas.removeEventListener('pointermove', drag)
      camera.changed.removeEventListener(sizeGlows)
      scene.postRender.removeEventListener(post)
      scene.preRender.removeEventListener(stepZoom)
      viewer.destroy()
      el.innerHTML = ''
    },
  }
  return engine
}
