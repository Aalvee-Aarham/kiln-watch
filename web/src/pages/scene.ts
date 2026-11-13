// Home page 3D: a dotted Earth, the NASA satellite models drawn as blue x-ray holograms, orbit rings and a blueprint
// grid. The story (story.ts) owns a playhead that glides from beat to beat; the scene is keyframe KF[i] on beat i and
// a blend of two keyframes in between, so the KF order below must match the beat order in Home.tsx.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import gsap from "gsap";

export type Pin = { lon: number; lat: number };
export type SceneHandle = { setPins: (pins: Pin[]) => void; setEvents: (pins: Pin[]) => void; dispose: () => void };

// c* camera · l* what it looks at · ox/oy screen shift of the subject (fraction of the viewport; + = right/down)
// rx/ry: how the satellites are turned · a* Aqua, t* Terra, s* Suomi NPP: T how far apart the parts are, O opacity
// sep: Terra and Aqua side by side · merge: the five orbits become one · tags: satellite name labels · ev: EONET event pins
// dr: the hero satellite drifts · beam: its scan beam down to the ground
// earth/dots/grid/rings/streaks: layer strengths
type K = {
  cx: number; cy: number; cz: number; lx: number; ly: number; lz: number; ox: number; oy: number; fov: number;
  rx: number; ry: number; aT: number; aO: number; tT: number; tO: number; sep: number; sT: number; sO: number;
  merge: number; rings: number; tags: number; ev: number; dr: number; beam: number; earth: number; dots: number; grid: number; streaks: number;
};

const P = new THREE.Vector3(0.55, 1.62, 0.75); // where the satellites float, above the limb
const ISO = new THREE.Vector3(0.64, 0.5, 0.58).normalize(); // blueprint view direction
const iso = (d: number, dx = 0, dy = 0) => ({ cx: P.x + ISO.x * d, cy: P.y + ISO.y * d, cz: P.z + ISO.z * d, lx: P.x + dx, ly: P.y + dy, lz: P.z });
const KF: K[] = [];
const kf = (d: Partial<K>) => KF.push({ ...(KF[KF.length - 1] ?? ({} as K)), ...d });
// 0 hero: satellite over a dark limb, whole (no break-apart in the opening)
kf({ cx: 0.2, cy: 1.5, cz: 3.25, lx: 0.2, ly: 1.42, lz: 0, ox: 0.22, oy: -0.04, fov: 40, rx: 0.5, ry: -0.85, aT: 0, aO: 1, tT: 1.6, tO: 0, sep: 0, sT: 1.6, sO: 0,
  merge: 0, rings: 0, tags: 0, ev: 1, dr: 1, beam: 1, earth: 1, dots: 0.15, grid: 0, streaks: 0 });
// 1 the problem: the whole globe on the right, five labelled orbits (white = older camera, blue = newer)
kf({ cx: 0, cy: 0.35, cz: 5.6, lx: 0, ly: 0, lz: 0, ox: 0.24, oy: 0, aO: 0, dr: 0, beam: 0, dots: 1, rings: 1, tags: 1, streaks: 0.25, ev: 0.6 });
// 2 the challenge: the camera swings round and in; the orbits still run apart
kf({ cx: 1.9, cy: 1.15, cz: 3.5, ox: 0.27, tags: 0, aT: 1.6 });
// 3 our solution: the five orbits fold into one
kf({ cx: 0, cy: 1.5, cz: 4.6, ox: 0.23, merge: 1, streaks: 0 });
// 4 the impact: a big globe from the right, live fires on it
kf({ cx: 0, cy: 0.25, cz: 2.7, lx: -1.5, ly: 0.1, ox: 0, rings: 0, ev: 1 });
// 5 the older camera: Terra and Aqua fly in as parts and assemble side by side on the blueprint grid
kf({ ...iso(9.8), ox: -0.03, oy: 0.04, fov: 15, rx: 0, ry: 0, aT: 0, aO: 1, tT: 0, tO: 1, sep: 0.66, ev: 0, earth: 0, grid: 1 });
// 6 the sharper camera: Terra and Aqua scatter, Suomi NPP assembles between them
kf({ ...iso(7.4), ox: 0.06, oy: -0.24, aT: 2.2, tT: 2.2, aO: 0, tO: 0, sT: 0, sO: 1 });
// 7 the jump: Suomi NPP bursts apart, back to a quiet globe behind the chart
kf({ cx: 0, cy: 0.4, cz: 3.6, lx: 0, ly: 1.25, lz: 0, ox: 0, oy: 0, fov: 40, rx: 0.5, ry: -0.85, sT: 2.2, sO: 0, sep: 0, grid: 0, earth: 0.6 });
// 8 the fix
kf({ cy: 0.45, cz: 3.5, ly: 1.2 });
// 9 the proof: globe sinks to the lower half
kf({ cy: 0.5, ly: 1.15 });
// 10 console: a huge globe fills the lower half
kf({ cy: 0.62, cz: 2.25, ly: 1.02, earth: 1 });
// 11-13 explore / warn / ask: the camera drifts under the floating screen
kf({ cx: -0.32, cy: 0.7, cz: 2.0, lx: 0.1, ly: 0.82 });
kf({ cx: 0.34, cy: 0.66, cz: 2.0, lx: -0.1, ly: 0.8 });
kf({ cx: 0.12, cy: 0.5, cz: 1.9, lx: 0, ly: 0.7 });
// 14 news: globe to the left, live EONET wildfire events on it
kf({ cx: 0, cy: 0.35, cz: 2.75, lx: 0.95, ly: 0.2, lz: 0, ev: 1 });
// 15 connect: globe low on the right
kf({ cx: 0, cy: 0.95, cz: 2.8, lx: -0.75, ly: 1.0, lz: 0, ev: 0 });
// 16 finale: Aqua reassembles above the globe
kf({ cx: 0.55, cy: 1.72, cz: 4.35, lx: 0.55, ly: 1.12, lz: 0.75, aO: 1, aT: 0, dr: 0.5, ev: 1 });
export const BEATS = KF.length;

const SUN = new THREE.Vector3(-0.55, 0.62, 0.56).normalize();
const BASE = import.meta.env.BASE_URL;
const BLUE = new THREE.Color("#00A1FF");
const DPR = 1.5; // sharper than this costs more frames than it buys

// ---------- shaders ----------
const HOLO_VS = `varying vec3 vN; varying vec3 vV; varying vec2 vUv;
void main(){ vUv=uv; vec4 mv=modelViewMatrix*vec4(position,1.); vN=normalize(normalMatrix*normal); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }`;
// hologram: a dark navy solid whose faces glow where they turn away from the camera; the model's own texture is kept as faint panel detail
const HOLO_FS = `uniform sampler2D map; uniform float hasMap; uniform float op; varying vec3 vN; varying vec3 vV; varying vec2 vUv;
void main(){
  float f=pow(1.-abs(dot(normalize(vN),normalize(vV))),2.4);
  float lum=hasMap>.5 ? dot(texture2D(map,vUv).rgb,vec3(.3,.59,.11)) : .3;
  vec3 c=vec3(.005,.03,.15)*(.35+1.5*lum)+vec3(.03,.22,.7)*f;
  gl_FragColor=vec4(c,op);
}`;

const EARTH_VS = `varying vec2 vUv; varying vec3 vN; varying vec3 vW;
void main(){ vUv=uv; vN=normalize(mat3(modelMatrix)*normal); vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`;
// dark imagery under a dot matrix (rows of equal-area cells; land dots bright, sea dots faint). The limb only gets a
// soft inner glow and a hairline: the visible halo is the atmosphere shell behind the globe.
const EARTH_FS = `uniform sampler2D day; uniform sampler2D water; uniform vec3 sun; uniform float fade; uniform float dots;
varying vec2 vUv; varying vec3 vN; varying vec3 vW;
const float ROWS=230.;
void main(){
  vec3 n=normalize(vN); vec3 v=normalize(cameraPosition-vW); float facing=max(dot(v,n),0.);
  float lit=smoothstep(-.3,.7,dot(n,sun));
  vec3 img=texture2D(day,vUv).rgb; float g=dot(img,vec3(.3,.59,.11));
  vec3 base=mix(vec3(g),img,.3)*(.006+.1*lit)*vec3(.8,.9,1.15);
  float lat=vUv.y*ROWS; float row=floor(lat);
  float cols=max(4.,floor(ROWS*2.*sin(3.14159265*(row+.5)/ROWS)));
  float cx=vUv.x*cols;
  float land=1.-texture2D(water,vec2((floor(cx)+.5)/cols,(row+.5)/ROWS)).r;
  float aa=min(fwidth(lat)*1.3,.24);
  float dotm=1.-smoothstep(.27-aa,.27+aa,length(vec2(fract(cx),fract(lat))-.5));
  vec3 dc=mix(vec3(.006,.03,.09),vec3(.07,.21,.54),land)*(.3+.7*lit);
  vec3 col=base*(1.-.75*dots)+dc*dotm*dots*smoothstep(0.,.3,facing);
  float rim=1.-facing;
  col+=vec3(.004,.03,.17)*(.3+.7*lit)*pow(rim,3.2)+vec3(.03,.13,.5)*(.2+.8*lit)*pow(rim,16.);
  gl_FragColor=vec4(col*fade,1.);
}`;
// atmosphere: a shell a quarter larger than the globe, seen from inside out. d is how far a pixel sits beyond the limb
// (0 on the limb, 1 on the edge of the shell), so the halo is brightest against the planet and thins out to nothing
const ATMO_R = 1.26;
const ATMO_VS = `varying vec3 vN; varying vec3 vP; varying vec3 vWN;
void main(){ vec4 mv=modelViewMatrix*vec4(position,1.); vP=mv.xyz; vN=normalize(normalMatrix*normal); vWN=normalize(mat3(modelMatrix)*normal); gl_Position=projectionMatrix*mv; }`;
const ATMO_FS = `uniform float fade; uniform vec3 sun; varying vec3 vN; varying vec3 vP; varying vec3 vWN;
void main(){
  float c=dot(normalize(vN),normalize(vP));
  float d=clamp((${ATMO_R}*sqrt(max(1.-c*c,0.))-1.)/${(ATMO_R - 1).toFixed(2)},0.,1.);
  float lit=.4+.6*smoothstep(-.6,.5,dot(normalize(vWN),sun));
  gl_FragColor=vec4((vec3(.008,.045,.24)*pow(1.-d,3.)+vec3(.02,.1,.4)*exp(-d*18.))*lit*fade,1.);
}`;
const GRID_VS = `varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`;
const GRID_FS = `uniform float op; varying vec3 vP;
void main(){
  vec2 q=vP.xy*7.; vec2 g=abs(fract(q-.5)-.5)/fwidth(q); float line=1.-min(min(g.x,g.y),1.);
  float fall=smoothstep(2.1,.1,length(vP.xy));
  gl_FragColor=vec4(vec3(.035,.045,.062)*line*fall*op,1.);
}`;

// live fires: soft embers that flicker, each on its own phase
const FIRE_VS = `attribute float ph; uniform float t; uniform float scale; uniform float size; varying float vF;
void main(){ vec4 mv=modelViewMatrix*vec4(position,1.); vF=.72+.2*sin(t*2.3+ph)+.08*sin(t*7.1+ph*3.); gl_PointSize=size*vF*scale/-mv.z; gl_Position=projectionMatrix*mv; }`;
const FIRE_FS = `uniform float op; varying float vF;
void main(){ float d=length(gl_PointCoord-.5)*2.; float a=pow(max(1.-d,0.),2.6); vec3 c=mix(vec3(1.,.28,.05),vec3(1.,.8,.45),pow(max(1.-d*2.2,0.),2.)); gl_FragColor=vec4(c*a*op*vF*.85,1.); }`;
// the hero satellite's scan beam: a faint cone with a bright band sweeping down to the ground
const BEAM_VS = `varying float vH; void main(){ vH=position.y+.5; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`;
const BEAM_FS = `uniform float op; uniform float t; varying float vH;
void main(){ float a=(.04+.22*pow(1.-vH,1.6))*smoothstep(1.,.8,vH); float scan=smoothstep(.07,0.,abs(fract(t*.32)-(1.-vH)));
  gl_FragColor=vec4(vec3(.1,.55,1.)*(a+scan*.5)*op,1.); }`;

const additive = { blending: THREE.AdditiveBlending, transparent: true, depthWrite: false } as const;

// ---------- satellites ----------
type Part = { m: THREE.Mesh; p: THREE.Vector3; q: THREE.Quaternion; d: THREE.Vector3; ax: THREE.Vector3; spin: number; dist: number; delay: number };
type Sat = { holder: THREE.Group; parts: Part[]; op: { value: number }; line: LineMaterial };

/** Cut one mesh into pieces: its connected parts, grouped by which cell of a G×G×G grid over the model they sit in.
 *  Parts larger than a cell (panels, booms) are cut along the grid too, so every model breaks into many pieces. */
function split(m: THREE.Mesh, half: THREE.Vector3, G: number) {
  const g = m.geometry, pos = g.attributes.position, n = pos.count;
  const idx = g.index ? g.index.array : Uint32Array.from({ length: n }, (_, i) => i);
  // connected parts: weld vertices that share a position (exporters split them at texture seams), then union-find
  const par = new Int32Array(n), weld = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    const k = `${pos.getX(i).toFixed(4)} ${pos.getY(i).toFixed(4)} ${pos.getZ(i).toFixed(4)}`;
    const w = weld.get(k);
    par[i] = w ?? i;
    if (w === undefined) weld.set(k, i);
  }
  const find = (x: number) => { while (par[x] !== x) x = par[x] = par[par[x]]; return x; };
  for (let t = 0; t < idx.length; t += 3) { const r = find(idx[t]); par[find(idx[t + 1])] = r; par[find(idx[t + 2])] = r; }
  const v = new THREE.Vector3(), boxes = new Map<number, THREE.Box3>();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    if (!boxes.has(r)) boxes.set(r, new THREE.Box3());
    boxes.get(r)!.expandByPoint(v.fromBufferAttribute(pos, i).applyMatrix4(m.matrix));
  }
  const cellOf = (p: THREE.Vector3) => [p.x / half.x, p.y / half.y, p.z / half.z].reduce((k, r) => k * G + Math.min(G - 1, Math.max(0, Math.floor(((r + 1) / 2) * G))), 0);
  const size = new THREE.Vector3(), c = new THREE.Vector3(), groups = new Map<number, number[]>();
  for (let t = 0; t < idx.length; t += 3) {
    const box = boxes.get(find(idx[t]))!;
    box.getSize(size);
    const big = Math.max(size.x / half.x, size.y / half.y, size.z / half.z) > 2.2 / G;
    if (big) c.set(0, 0, 0).add(v.fromBufferAttribute(pos, idx[t])).add(v.fromBufferAttribute(pos, idx[t + 1])).add(v.fromBufferAttribute(pos, idx[t + 2])).divideScalar(3).applyMatrix4(m.matrix);
    else box.getCenter(c);
    const k = cellOf(c);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(t);
  }
  // one compact geometry per group, re-centred so each piece can spin about its own middle
  return [...groups.values()].map((tris) => {
    const map = new Map<number, number>(), order: number[] = [], index: number[] = [];
    for (const t of tris) for (let j = 0; j < 3; j++) {
      const o = idx[t + j];
      if (!map.has(o)) { map.set(o, order.length); order.push(o); }
      index.push(map.get(o)!);
    }
    const geo = new THREE.BufferGeometry();
    for (const [name, at] of Object.entries(g.attributes) as [string, THREE.BufferAttribute][]) {
      const k = at.itemSize, arr = new Float32Array(order.length * k);
      order.forEach((o, i) => { for (let j = 0; j < k; j++) arr[i * k + j] = at.getComponent(o, j); });
      geo.setAttribute(name, new THREE.BufferAttribute(arr, k));
    }
    geo.setIndex(index);
    geo.computeBoundingBox();
    const mid = geo.boundingBox!.getCenter(new THREE.Vector3());
    geo.translate(-mid.x, -mid.y, -mid.z);
    return { geo, mid };
  });
}

/** Centre and normalise a model, redraw it as a hologram, and cut it into pieces that fly apart and back together. */
function prepare(model: THREE.Object3D, size: number, G: number): Sat {
  const holder = new THREE.Group();
  holder.add(model);
  holder.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const half = box.getSize(new THREE.Vector3()).multiplyScalar(0.5), diag = half.length() * 2;
  model.position.sub(box.getCenter(new THREE.Vector3()));
  holder.updateMatrixWorld(true);
  const meshes: THREE.Mesh[] = [];
  model.traverse((o) => { if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh); });
  const op = { value: 1 };
  const line = new LineMaterial({ color: "#b9dcff", linewidth: 1.3 * Math.min(devicePixelRatio, DPR), transparent: true }); // width in device pixels
  const parts: Part[] = [];
  for (const m of meshes) {
    holder.attach(m);
    m.updateMatrix();
    if (!m.geometry.attributes.normal) m.geometry.computeVertexNormals(); // Terra ships without normals: NaN shading would blot out the bloom pass
    const old = m.material as THREE.MeshStandardMaterial;
    const mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: old.map ?? null }, hasMap: { value: old.map ? 1 : 0 }, op },
      vertexShader: HOLO_VS, fragmentShader: HOLO_FS, side: THREE.DoubleSide, transparent: true,
      polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1, // keep the edge lines clear of the faces
    });
    old.dispose();
    for (const { geo, mid } of split(m, half, G)) {
      const pm = new THREE.Mesh(geo, mat);
      pm.position.copy(mid).applyMatrix4(m.matrix);
      pm.quaternion.copy(m.quaternion);
      pm.scale.copy(m.scale);
      const edges = new THREE.EdgesGeometry(geo, 30);
      if (edges.attributes.position.count) pm.add(new LineSegments2(new LineSegmentsGeometry().fromEdgesGeometry(edges), line));
      edges.dispose();
      holder.add(pm);
      // exploded-drawing rule, loosened: pieces slide mostly along the axis they sit furthest out on, partly straight
      // out from the middle, and turn a little; pieces at the core lift straight up
      const r = [pm.position.x / half.x, pm.position.y / half.y, pm.position.z / half.z].map((x) => (Number.isFinite(x) ? x : 0));
      const k = r.reduce((best, x, i) => (Math.abs(x) > Math.abs(r[best]) ? i : best), 0);
      const far = Math.min(Math.abs(r[k]), 1);
      const d = far < 0.12 ? new THREE.Vector3(0, 1, 0)
        : new THREE.Vector3().setComponent(k, Math.sign(r[k])).multiplyScalar(0.6).add(new THREE.Vector3(r[0], r[1], r[2]).normalize().multiplyScalar(0.4)).normalize();
      parts.push({ m: pm, p: pm.position.clone(), q: pm.quaternion.clone(), d, ax: new THREE.Vector3().randomDirection(),
        spin: (Math.random() - 0.5) * 1.6, dist: diag * (0.1 + 0.38 * far) * (0.75 + 0.5 * Math.random()), delay: (1 - far) * 0.35 * Math.random() });
    }
    m.removeFromParent();
    m.geometry.dispose();
  }
  model.removeFromParent();
  holder.userData.base = size / diag;
  holder.scale.setScalar(size / diag);
  return { holder, parts, op, line };
}

const spinQ = new THREE.Quaternion();
function pose(s: Sat | null, t: number, opacity: number) {
  if (!s) return;
  opacity *= 1 - THREE.MathUtils.smoothstep(t, 1.05, 1.7); // pieces flown far fade out, so debris never lingers into the next chapter
  s.holder.visible = opacity > 0.003;
  if (!s.holder.visible) return;
  s.op.value = opacity;
  s.line.opacity = opacity * 0.85;
  for (const p of s.parts) {
    const e = Math.max(0, (t - p.delay) / 0.65), f = e < 1 ? e * e * (3 - 2 * e) : e;
    p.m.position.copy(p.p).addScaledVector(p.d, p.dist * f);
    p.m.quaternion.copy(p.q).multiply(spinQ.setFromAxisAngle(p.ax, p.spin * f));
  }
}

function glowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, "rgba(255,255,255,1)");
  r.addColorStop(0.25, "rgba(255,255,255,.55)");
  r.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

const lonLat = (lon: number, lat: number, r: number) => {
  const phi = ((90 - lat) * Math.PI) / 180, a = ((lon + 180) * Math.PI) / 180; // matches SphereGeometry's UV layout
  return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(a), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(a));
};

export function mountScene(canvas: HTMLCanvasElement, scroller: HTMLElement, ph: { v: number; off: boolean }, onReady: () => void): SceneHandle {
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  } catch {
    canvas.style.display = "none"; // no WebGL: the page still reads as a plain story
    onReady();
    return { setPins: () => undefined, setEvents: () => undefined, dispose: () => undefined };
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, DPR));
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#000000");
  const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 200);
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 })); // multisampled: the line work stays crisp
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.42, 0.8, 0.42);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  let disposed = false;
  const intro = { v: 0 };
  const manager = new THREE.LoadingManager(() => { if (!disposed) { gsap.to(intro, { v: 1, duration: 3, ease: "power3.out" }); onReady(); } });
  manager.onError = () => onReady(); // a missing asset must never leave the page behind the loader

  // stars (decoration, not data)
  const sp = new Float32Array(2600 * 3);
  for (let i = 0; i < 2600; i++) new THREE.Vector3().randomDirection().multiplyScalar(40 + Math.random() * 40).toArray(sp, i * 3);
  const sg = new THREE.BufferGeometry();
  sg.setAttribute("position", new THREE.BufferAttribute(sp, 3));
  const stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: "#8fa6c9", size: 0.085, sizeAttenuation: true, transparent: true, opacity: 0.55, depthWrite: false }));
  scene.add(stars);

  // Earth: NASA Blue Marble, darkened, under a dot matrix
  const tex = new THREE.TextureLoader(manager);
  const day = tex.load(`${BASE}models/earth.jpg`), water = tex.load(`${BASE}models/earth-water.jpg`);
  day.colorSpace = THREE.SRGBColorSpace;
  day.anisotropy = 8;
  const eu = { day: { value: day }, water: { value: water }, sun: { value: SUN }, fade: { value: 1 }, dots: { value: 0 } };
  const tilt = new THREE.Group();
  tilt.rotation.z = (23.4 * Math.PI) / 180;
  const earth = new THREE.Mesh(new THREE.SphereGeometry(1, 160, 110), new THREE.ShaderMaterial({ uniforms: eu, vertexShader: EARTH_VS, fragmentShader: EARTH_FS }));
  earth.rotation.y = 1.25; // the hero beam lands on the western US, where most of NASA EONET's open wildfires are
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(ATMO_R, 96, 64),
    new THREE.ShaderMaterial({ uniforms: { fade: eu.fade, sun: eu.sun }, vertexShader: ATMO_VS, fragmentShader: ATMO_FS, side: THREE.BackSide, ...additive }));
  tilt.add(earth);
  scene.add(tilt, atmo);

  // built areas as embers on the globe (real bbox centres, set later)
  const glow = glowTexture();
  const pinMat = new THREE.PointsMaterial({ map: glow, color: "#ff7a2f", size: 0.075, ...additive });
  const pins = new THREE.Points(new THREE.BufferGeometry(), pinMat);
  earth.add(pins);
  // open wildfire events from NASA EONET (set later), shown in the news chapter
  const fu = { t: { value: 0 }, scale: { value: 1 }, size: { value: 0.04 }, op: { value: 0 } };
  const evMat = new THREE.ShaderMaterial({ uniforms: fu, vertexShader: FIRE_VS, fragmentShader: FIRE_FS, ...additive });
  const evPins = new THREE.Points(new THREE.BufferGeometry(), evMat);
  earth.add(evPins);
  pins.frustumCulled = evPins.frustumCulled = false; // filled after the first frame: a bounding sphere computed while empty would cull them for good

  // one orbit per satellite (Terra, Aqua: MODIS, white · Suomi NPP, NOAA-20, NOAA-21: VIIRS, blue); they merge into one.
  // Planes and radii are drawn apart for legibility, not to scale (all five are sun-synchronous at 700-830 km).
  const ORBITS = [[1.15, 0, 0.3, 1.4], [1.3, 0.95, 0.12, 1.47], [1.8, 0, -0.4, 1.56], [1.62, -0.85, -0.18, 1.63], [1.95, 0.5, -0.5, 1.7]];
  const white = new THREE.Color("#ffffff");
  const rings = ORBITS.map(([x, y, z, r], i) => {
    const g = new THREE.Group();
    g.rotation.order = "YXZ";
    const color = i < 2 ? white.clone() : BLUE.clone();
    const mat = new THREE.MeshBasicMaterial({ color, ...additive });
    const torus = new THREE.Mesh(new THREE.TorusGeometry(1, 0.0022, 6, 360), mat);
    const dot = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color, ...additive }));
    dot.scale.setScalar(0.085);
    g.add(torus, dot);
    scene.add(g);
    return { g, torus, dot, mat, x, y, z, r, modis: i < 2, phase: i * 1.3 };
  });
  const tags = [...scroller.querySelectorAll<HTMLElement>("[data-sat]")];
  const ray = new THREE.Vector3(), wp = new THREE.Vector3();

  // satellite passes: short streaks on great circles
  const streakMat = new THREE.LineBasicMaterial({ vertexColors: true, ...additive });
  const streaks = Array.from({ length: 16 }, () => {
    const n = 20, pos: number[] = [], col: number[] = [], r = 1.03 + Math.random() * 0.3;
    for (let i = 0; i < n; i++) {
      const a = (i / (n - 1)) * 0.3, f = (i / (n - 1)) ** 2;
      pos.push(Math.cos(a) * r, Math.sin(a) * r, 0);
      col.push(0.25 * f, 0.6 * f, f);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    const pivot = new THREE.Group(), l = new THREE.Line(g, streakMat);
    pivot.quaternion.random();
    l.rotation.z = Math.random() * 6.28;
    l.userData.speed = 0.25 + Math.random() * 0.45;
    pivot.add(l);
    scene.add(pivot);
    return l;
  });

  // satellites (NASA 3D Resources, public domain) on a blueprint grid
  const stage = new THREE.Group();
  stage.position.copy(P);
  const turn = new THREE.Group();
  const gu = { op: { value: 0 } };
  const grid = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), new THREE.ShaderMaterial({ uniforms: gu, vertexShader: GRID_VS, fragmentShader: GRID_FS, side: THREE.DoubleSide, ...additive }));
  grid.rotation.x = -Math.PI / 2;
  grid.position.y = -0.34;
  stage.add(turn, grid);
  scene.add(stage);
  const beam = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1, 48, 1, true),
    new THREE.ShaderMaterial({ uniforms: { op: { value: 0 }, t: fu.t }, vertexShader: BEAM_VS, fragmentShader: BEAM_FS, side: THREE.DoubleSide, ...additive }));
  scene.add(beam);
  const UP = new THREE.Vector3(0, 1, 0), ground = new THREE.Vector3();
  let aqua: Sat | null = null, terra: Sat | null = null, snpp: Sat | null = null;
  const draco = new DRACOLoader(manager).setDecoderPath(`${BASE}draco/`); // the NASA models are Draco-compressed
  const loader = new GLTFLoader(manager).setDRACOLoader(draco);
  loader.load(`${BASE}models/aqua.glb`, (g) => { if (disposed) return; aqua = prepare(g.scene, 1.15, 3); aqua.holder.rotation.set(0.1, 0.5, 0); turn.add(aqua.holder); });
  loader.load(`${BASE}models/terra.glb`, (g) => { if (disposed) return; terra = prepare(g.scene, 1.1, 3); terra.holder.rotation.set(0.1, 0.5, 0); turn.add(terra.holder); });
  loader.load(`${BASE}models/snpp.glb`, (g) => { if (disposed) return; snpp = prepare(g.scene, 1.0, 4); snpp.holder.rotation.set(0, -0.6, 0); turn.add(snpp.holder); });

  const S: K = { ...KF[0] };
  const keys = Object.keys(KF[0]) as (keyof K)[];

  // render loop
  const mouse = new THREE.Vector2(), sm = new THREE.Vector2();
  const onMove = (e: PointerEvent) => mouse.set(e.clientX / innerWidth - 0.5, 0.5 - e.clientY / innerHeight);
  if (!still) addEventListener("pointermove", onMove);
  const resize = () => {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    camera.aspect = w / h;
  };
  resize();
  addEventListener("resize", resize);

  const clock = new THREE.Clock();
  const vc = new THREE.Vector3(), vl = new THREE.Vector3();
  const lerp = THREE.MathUtils.lerp;
  const last = KF.length - 1;
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime, live = still ? 0 : 1;

    if (ph.off) return; // the story has scrolled away under the opaque sections
    const v = Math.min(Math.max(ph.v, 0), last), k = Math.min(Math.floor(v), last - 1);
    const f = v - k, e = f * f * (3 - 2 * f); // eased: the camera settles into each scene and leaves it gently
    for (const key of keys) S[key] = lerp(KF[k][key], KF[k + 1][key], e);

    earth.rotation.y += dt * 0.022 * live;
    stars.rotation.y += dt * 0.003 * live;
    eu.fade.value = S.earth;
    eu.dots.value = S.dots;
    pins.visible = tilt.visible = atmo.visible = S.earth > 0.003;
    pinMat.opacity = S.earth;
    pinMat.size = 0.075 * (1 + 0.25 * Math.sin(t * 3));

    // hero: the satellite drifts along its orbit, yaws and rolls a little; later chapters keep only a slow sway
    const dr = S.dr * live;
    stage.position.set(P.x + Math.sin(t * 0.33) * 0.09 * dr, P.y + Math.sin(t * 0.52) * 0.04 * dr, P.z + Math.cos(t * 0.33) * 0.06 * dr);
    turn.rotation.set(S.rx + Math.sin(t * 0.41) * 0.07 * dr, S.ry + Math.sin(t * 0.22) * (0.2 + 0.25 * dr) * live, Math.sin(t * 0.37) * 0.09 * dr);
    turn.position.y = Math.sin(t * 0.7) * 0.012 * live;
    beam.visible = S.beam * intro.v > 0.003;
    if (beam.visible) {
      ground.copy(stage.position).normalize();
      const h = stage.position.distanceTo(ground) - 0.1; // starts just under the satellite
      beam.position.copy(ground).lerp(stage.position, h / 2 / (h + 0.1));
      beam.quaternion.setFromUnitVectors(UP, stage.position.clone().sub(ground).normalize());
      beam.scale.set(1, h, 1);
      (beam.material as THREE.ShaderMaterial).uniforms.op.value = S.beam * intro.v;
    }
    if (aqua) aqua.holder.position.x = S.sep;
    if (terra) terra.holder.position.x = -S.sep;
    const breathe = S.grid * 0.12 * (0.5 - 0.5 * Math.cos(t * 0.8)) * live; // on the blueprint the models ease apart and back
    pose(aqua, S.aT + breathe, S.aO * intro.v);
    pose(terra, S.tT + breathe, S.tO);
    pose(snpp, S.sT + breathe, S.sO);
    grid.visible = S.grid > 0.003;
    gu.op.value = S.grid;
    evPins.visible = S.ev > 0.003;
    fu.t.value = t;
    fu.op.value = S.ev * S.earth;
    fu.scale.value = (renderer.getPixelRatio() * innerHeight) / (2 * Math.tan((camera.fov * Math.PI) / 360));

    const m = S.merge;
    rings.forEach((R, i) => {
      R.g.rotation.set(lerp(R.x, 1.4, m), lerp(R.y, 0, m), lerp(R.z, 0.08, m));
      R.torus.scale.setScalar(lerp(R.r, 1.5, m));
      if (R.modis) R.mat.color.lerpColors(white, BLUE, m);
      R.mat.opacity = (R.modis ? lerp(0.55, 1, m) : 1) * S.rings * (1 - 0.8 * m * (i > 0 ? 1 : 0)); // merged: one ring, five dots
      const a = t * lerp(0.26 + i * 0.03, 0.3, m) + lerp(R.phase, (i * Math.PI * 2) / 5, m);
      R.dot.position.set(Math.cos(a), Math.sin(a), 0).multiplyScalar(R.torus.scale.x);
      R.dot.material.opacity = S.rings;
      R.g.visible = S.rings > 0.003;
    });

    streakMat.opacity = S.streaks * S.earth;
    for (const l of streaks) { l.visible = streakMat.opacity > 0.003; l.rotation.z += dt * l.userData.speed * live; }

    vc.set(S.cx, S.cy, S.cz); vl.set(S.lx, S.ly, S.lz);
    const w = innerWidth, h = innerHeight, narrow = camera.aspect < 0.85;
    if (narrow) vc.sub(vl).multiplyScalar(1.55).add(vl); // phones: pull back and lift the subject above the text
    vc.addScaledVector(vl.clone().sub(vc).normalize(), -0.5 * (1 - intro.v)); // opening dolly-in
    sm.lerp(mouse, 0.05);
    vc.x += sm.x * 0.1; vc.y += sm.y * 0.07;
    camera.position.copy(vc);
    camera.lookAt(vl);
    camera.fov = S.fov;
    camera.setViewOffset(w, h, narrow ? 0 : -S.ox * w, narrow ? 0.24 * h * Math.min(1, Math.abs(S.ox) * 6) : -S.oy * h, w, h);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    // name labels follow the satellite dots; hidden while a dot is behind the Earth
    tags.forEach((el, i) => {
      const R = rings[i], o = S.tags * S.rings;
      if (!R || o < 0.01) { el.style.opacity = "0"; return; }
      R.dot.getWorldPosition(wp);
      ray.copy(wp).sub(camera.position);
      const len = ray.length(); ray.divideScalar(len);
      const b = camera.position.dot(ray), c = camera.position.lengthSq() - 1.03, disc = b * b - c;
      const hidden = disc > 0 && -b - Math.sqrt(disc) < len; // the ray hits the globe before the dot
      wp.project(camera);
      el.style.transform = `translate(${((wp.x + 1) / 2) * w}px, ${((1 - wp.y) / 2) * h}px)`;
      el.style.opacity = String(hidden ? 0 : o);
    });
    composer.render();
  });

  return {
    setPins(list) {
      pins.geometry.setAttribute("position", new THREE.Float32BufferAttribute(list.flatMap((p) => lonLat(p.lon, p.lat, 1.006).toArray()), 3));
    },
    setEvents(list) {
      evPins.geometry.setAttribute("position", new THREE.Float32BufferAttribute(list.flatMap((p) => lonLat(p.lon, p.lat, 1.008).toArray()), 3));
      evPins.geometry.setAttribute("ph", new THREE.Float32BufferAttribute(list.map(() => Math.random() * 6.28), 1));
    },
    dispose() {
      disposed = true;
      gsap.killTweensOf(intro);
      removeEventListener("resize", resize);
      removeEventListener("pointermove", onMove);
      renderer.setAnimationLoop(null);
      scene.traverse((o) => {
        const x = o as THREE.Mesh;
        x.geometry?.dispose();
        (Array.isArray(x.material) ? x.material : x.material ? [x.material] : []).forEach((mt) => {
          const map = (mt as THREE.ShaderMaterial).uniforms?.map?.value as THREE.Texture | null;
          map?.dispose();
          mt.dispose();
        });
      });
      day.dispose(); water.dispose(); glow.dispose(); draco.dispose(); bloom.dispose(); composer.dispose();
      renderer.dispose();
    },
  };
}
