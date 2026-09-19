// Process : un petit objet 3D par étape (repérage, conception, programmation, exploitation).
// Un seul moteur 3D dessine les quatre vignettes ; chaque objet bouge doucement et s'anime au survol.
import * as THREE from 'three';
import { GLTFLoader } from './vendor/three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from './vendor/three/examples/jsm/environments/RoomEnvironment.js';

const root = document.querySelector('.process[data-model]');
const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const touchOnly = window.matchMedia('(hover: none)').matches;
const ACCENT = 0x7b91c4;
const CREAM = 0xfcf2e7;
const CALM_TIME = 2.2;

if (root) init().catch(error => console.warn('process3d', error));

async function init() {
  const cards = [...document.querySelectorAll('.step-3d, .audience-art')];
  if (!cards.length) return;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (error) {
    return; // pas de 3D : les vignettes restent de simples fonds lumineux
  }
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  const environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;

  const kit = makeKit();
  const builders = {
    park: buildPark,
    plan: buildPlan,
    console: buildConsole,
    stage: (scene, kitPack, data) => buildClub(scene, kitPack, data, { operator: true }),
    festival: buildFestivalNight,
    club: buildClub,
  };
  const order = ['park', 'plan', 'console', 'stage'];
  const items = cards.map((el, i) => {
    const scene = new THREE.Scene();
    scene.environment = environment;
    scene.environmentIntensity = 0.16;
    const key = new THREE.DirectionalLight(0xdfe6ff, 1.6);
    key.position.set(1.6, 2.6, 2);
    const rim = new THREE.DirectionalLight(ACCENT, 1.1);
    rim.position.set(-2.2, 1.4, -1.8);
    scene.add(key, rim, new THREE.HemisphereLight(0x8fa0d0, 0x0b0c10, 0.5));
    const canvas = document.createElement('canvas');
    el.appendChild(canvas);
    return {
      el, canvas, ctx: canvas.getContext('2d'), scene,
      camera: new THREE.PerspectiveCamera(28, 1, 0.05, 30),
      build: builders[el.dataset.scene] || builders[order[i % order.length]], api: null,
      hover: 0, want: 0, time: 0, stamp: performance.now(), pointer: { x: 0, y: 0 }, visible: false, ready: false, w: 0, h: 0,
    };
  });

  let raf = 0;
  let last = 0;

  function size(item) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(2, Math.round(item.el.clientWidth * dpr));
    const h = Math.max(2, Math.round(item.el.clientHeight * dpr));
    if (item.w !== w || item.h !== h) {
      item.w = item.canvas.width = w;
      item.h = item.canvas.height = h;
      item.camera.aspect = w / h;
      item.api?.frameCamera(item.camera);
    }
  }

  // Chaque vignette a sa propre horloge : le survol accélère le temps de façon continue (pas de saut de phase).
  function draw(item, fixed) {
    if (!item.api) return;
    size(item);
    const now = performance.now();
    const dt = Math.min((now - item.stamp) / 1000, 0.1);
    item.stamp = now;
    item.hover += (item.want - item.hover) * (calm ? 1 : 1 - Math.exp(-dt * 4));
    item.time = fixed ?? item.time + dt * (1 + item.hover * 1.6);
    item.api.update(item.time, dt, item.hover, item.pointer, item.camera);
    renderer.setSize(item.w, item.h, false);
    renderer.render(item.scene, item.camera);
    item.ctx.clearRect(0, 0, item.w, item.h);
    item.ctx.drawImage(renderer.domElement, 0, 0);
    if (!item.ready) { item.ready = true; item.el.classList.add('is-ready'); }
  }

  function frame(now) {
    raf = 0;
    const anyHover = items.some(item => item.want > 0 || item.hover > 0.01);
    if (anyHover || now - last > 30) {
      last = now;
      items.forEach(item => { if (item.visible) draw(item); });
    }
    if (items.some(item => item.visible) && !document.hidden) raf = requestAnimationFrame(frame);
  }
  // Chaque scène ne se construit qu'au moment où elle approche de l'écran (la console charge son modèle de 2 Mo à ce moment-là).
  async function ensure(item) {
    if (item.api || item.building) return;
    item.building = true;
    try { item.api = await item.build(item.scene, kit, root.dataset); } catch (error) { console.warn('process3d', error); item.building = false; return; }
    item.building = false;
    item.api.frameCamera(item.camera);
    if (item.visible) { draw(item, calm ? CALM_TIME : undefined); start(); }
  }

  function start() { if (!raf && !calm && !document.hidden) { items.forEach(item => { item.stamp = performance.now(); }); raf = requestAnimationFrame(frame); } }

  const watcher = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const item = items.find(it => it.el === entry.target);
      if (!item) return;
      item.visible = entry.isIntersecting;
      if (item.visible) { item.stamp = performance.now(); ensure(item); if (calm) draw(item, CALM_TIME); }
    });
    start();
  }, { rootMargin: '200px' });
  items.forEach(item => watcher.observe(item.el));
  document.addEventListener('visibilitychange', start);
  const resizer = new ResizeObserver(() => items.forEach(item => { if (item.visible) draw(item, calm ? CALM_TIME : undefined); }));
  items.forEach(item => resizer.observe(item.el));

  if (calm) return;

  // Interaction : le survol (ou le toucher) anime l'objet et le rapproche.
  items.forEach(item => {
    const step = item.el.closest('.step, .audience') || item.el;
    if (touchOnly) {
      item.el.addEventListener('click', () => { item.want = item.want ? 0 : 1; start(); });
      return;
    }
    step.addEventListener('mouseenter', () => { item.want = 1; start(); });
    step.addEventListener('mouseleave', () => { item.want = 0; item.pointer.x = item.pointer.y = 0; start(); });
    step.addEventListener('mousemove', event => {
      const b = item.el.getBoundingClientRect();
      item.pointer.x = THREE.MathUtils.clamp((event.clientX - b.left) / b.width * 2 - 1, -1.2, 1.2);
      item.pointer.y = THREE.MathUtils.clamp((event.clientY - b.top) / b.height * 2 - 1, -1.2, 1.2);
    });
  });
}

/* ---------- matériaux et pièces communes ---------- */

function makeKit() {
  const dark = new THREE.MeshStandardMaterial({ color: 0x1a1c22, roughness: 0.55, metalness: 0.45 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x4a4e5a, roughness: 0.4, metalness: 0.75 });
  const matte = new THREE.MeshStandardMaterial({ color: 0x121318, roughness: 0.9, metalness: 0.05 });
  const accent = new THREE.MeshBasicMaterial({ color: ACCENT, toneMapped: false });
  const lens = new THREE.MeshBasicMaterial({ color: CREAM, toneMapped: false });
  return { dark, steel, matte, accent, lens, floor: floorTexture(), glow: glowTexture() };
}

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

// Sol : disque plan de feu (quadrillage) ou bureau sombre, qui s'efface sur les bords.
function floorTexture() {
  const make = grid => {
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    const x = c.getContext('2d');
    if (grid) {
      x.strokeStyle = 'rgba(123,145,196,0.42)';
      x.lineWidth = 1.5;
      for (let i = 0; i <= 512; i += 32) {
        x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 512); x.stroke();
        x.beginPath(); x.moveTo(0, i); x.lineTo(512, i); x.stroke();
      }
    } else {
      x.fillStyle = '#1b1712';
      x.fillRect(0, 0, 512, 512);
    }
    x.globalCompositeOperation = 'destination-in';
    const g = x.createRadialGradient(256, 256, 30, 256, 256, 256);
    g.addColorStop(0, '#fff'); g.addColorStop(0.55, 'rgba(255,255,255,0.7)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 512, 512);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  };
  const park = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    const x = c.getContext('2d');
    x.fillStyle = '#16211f';
    x.fillRect(0, 0, 512, 512);
    // allée sinueuse, en clair
    x.strokeStyle = 'rgba(252,242,231,0.35)';
    x.lineWidth = 22;
    x.lineCap = 'round';
    x.beginPath();
    for (let px = 0; px <= 512; px += 8) {
      const wx = (px / 512) * 2.3 - 1.15;
      const wz = Math.sin(wx * 3.2) * 0.16 + 0.12;
      const py = 256 + wz / 1.15 * 256 / 0.85 * 0.85;
      if (px) x.lineTo(px, py); else x.moveTo(px, py);
    }
    x.stroke();
    x.globalCompositeOperation = 'destination-in';
    const g = x.createRadialGradient(256, 256, 30, 256, 256, 256);
    g.addColorStop(0, '#fff'); g.addColorStop(0.6, 'rgba(255,255,255,0.8)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 512, 512);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  })();
  return { grid: make(true), desk: make(false), park };
}

function floor(kit, kind, radius = 1.1) {
  const geo = new THREE.CircleGeometry(radius, 64);
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: kit.floor[kind], transparent: true, depthWrite: false }));
  mesh.position.y = -0.002;
  return mesh;
}

// Tronçon de structure (truss) le long de X : quatre membrures, deux faces en zigzag.
function truss(kit, length, half = 0.045) {
  const g = new THREE.Group();
  const chord = (x, y, z) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, length, 8), kit.steel);
    m.rotation.z = Math.PI / 2;
    m.position.set(0, y, z);
    g.add(m);
  };
  [-half, half].forEach(y => [-half, half].forEach(z => chord(0, y, z)));
  const n = Math.max(2, Math.round(length / (half * 2.1)));
  const step = length / n;
  const diag = Math.hypot(step, half * 2);
  for (let i = 0; i < n; i += 1) {
    [-half, half].forEach(z => {
      const d = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, diag, 6), kit.steel);
      d.rotation.z = Math.atan2(step, half * 2) * (i % 2 ? -1 : 1) + (i % 2 ? 0 : 0);
      d.position.set(-length / 2 + step * (i + 0.5), 0, z);
      g.add(d);
    });
  }
  return g;
}

// Faisceau : un cône ouvert qui s'éteint en s'éloignant de la source et sur ses bords
// (dir = +1 vers le haut, -1 vers le bas). La lumière s'ajoute au fond sans jamais le noircir.
function beam(length, dir, color, opacity = 0.5, spread = 0.13) {
  const geo = new THREE.ConeGeometry(length * spread, length, 40, 1, true);
  geo.rotateX(Math.PI);
  geo.translate(0, length / 2, 0);
  const rgb = new THREE.Color(color).convertLinearToSRGB();
  const mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Vector3(rgb.r, rgb.g, rgb.b) }, uOp: { value: opacity }, uLen: { value: length } },
    vertexShader: `varying float vT; varying vec3 vN; varying vec3 vP; uniform float uLen;
      void main(){ vT = position.y / uLen; vN = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0); vP = mv.xyz; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying float vT; varying vec3 vN; varying vec3 vP; uniform vec3 uColor; uniform float uOp;
      void main(){ float edge = pow(abs(dot(normalize(vN), normalize(-vP))), 0.8);
        float f = pow(clamp(1.0 - vT, 0.0, 1.0), 1.6) * uOp * edge;
        gl_FragColor = vec4(uColor * f, f); }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneFactor,
  }));
  if (dir < 0) mesh.rotation.x = Math.PI;
  return mesh;
}

// Halo de lentille : petit éclat additif posé sur chaque projecteur allumé.
function glowSprite(kit, color, size) {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: kit.glow, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false }));
  sprite.scale.setScalar(size);
  return sprite;
}

// Couleur d'un faisceau (uniform du shader) : on convertit en sRGB comme à la création.
function tintBeam(mesh, color) {
  const c = color.clone().convertLinearToSRGB();
  mesh.material.uniforms.uColor.value.set(c.r, c.g, c.b);
}

// Lyre BEAM : lyre en U, tête étroite, faisceau fin très long. Suspendue sous une poutre.
function beamFixture(kit, length = 1.1) {
  const root = new THREE.Group();
  const clamp = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, 0.05), kit.steel);
  root.add(clamp);
  const yoke = new THREE.Group();
  root.add(yoke);
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.014, 0.03), kit.dark);
  bar.position.y = -0.02;
  yoke.add(bar);
  [-0.056, 0.056].forEach(x => {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.115, 0.03), kit.dark);
    arm.position.set(x, -0.075, 0);
    yoke.add(arm);
  });
  const tilt = new THREE.Group();
  tilt.position.y = -0.1;
  root.add(tilt);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.045, 0.13, 20), kit.dark);
  tilt.add(body);
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.047, 0.047, 0.012, 20), kit.steel);
  ring.position.y = -0.066;
  tilt.add(ring);
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.03, 20), kit.lens);
  lens.rotation.x = Math.PI / 2;
  lens.position.y = -0.073;
  tilt.add(lens);
  const core = beam(length, -1, CREAM, 1, 0.02);
  core.position.y = -0.075;
  const halo = beam(length, -1, ACCENT, 0.3, 0.06);
  halo.position.y = -0.075;
  const glare = glowSprite(kit, CREAM, 0.16);
  glare.position.y = -0.08;
  tilt.add(core, halo, glare);
  return { root, tilt, core, halo, glare };
}

// Par LED : boîtier cylindrique court, lentille colorée, large faisceau de lavage.
function ledPar(kit, up = false) {
  const root = new THREE.Group();
  const holder = new THREE.Group();
  root.add(holder);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.056, 0.09, 24), kit.dark);
  holder.add(body);
  const fins = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.02, 24), kit.steel);
  fins.position.y = 0.05;
  holder.add(fins);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.048, 0.006, 8, 24), kit.steel);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = -0.046;
  holder.add(rim);
  const mat = new THREE.MeshBasicMaterial({ color: ACCENT, toneMapped: false });
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.043, 24), mat);
  lens.rotation.x = Math.PI / 2;
  lens.position.y = -0.047;
  holder.add(lens);
  const wash = beam(up ? 0.6 : 0.75, -1, ACCENT, 0.7, 0.2);
  wash.position.y = -0.05;
  const glare = glowSprite(kit, ACCENT, 0.2);
  glare.position.y = -0.06;
  holder.add(wash, glare);
  if (up) holder.rotation.x = Math.PI; // posé au sol, la lentille regarde vers le haut
  return { root, holder, mat, wash, glare };
}

// Blinder / barre LED : boîtier plat avec quatre cellules qui claquent sur le rythme.
function blinder(kit) {
  const root = new THREE.Group();
  root.add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.05), kit.dark));
  const cells = [];
  for (let i = 0; i < 4; i += 1) {
    const cell = new THREE.Mesh(new THREE.PlaneGeometry(0.038, 0.034), new THREE.MeshBasicMaterial({ color: CREAM, toneMapped: false }));
    cell.rotation.x = Math.PI / 2;
    cell.position.set(-0.075 + i * 0.05, -0.0255, 0);
    root.add(cell);
    cells.push(cell);
  }
  const glare = glowSprite(kit, CREAM, 0.3);
  glare.position.y = -0.06;
  root.add(glare);
  return { root, cells, glare };
}

// Cadre la caméra sur un objet de demi-largeur w et demi-hauteur h, centré à la hauteur cy.
function framer(w, h, cy, depth = 0.4, pad = 0.95) {
  return camera => {
    const vfov = THREE.MathUtils.degToRad(camera.fov) / 2;
    const hfov = Math.atan(Math.tan(vfov) * camera.aspect);
    camera.userData.dist = Math.max(h / Math.tan(vfov), w / Math.tan(hfov)) * pad + depth;
    camera.userData.cy = cy;
    camera.updateProjectionMatrix();
  };
}

// Place la caméra selon l'azimut/élévation, la distance et le survol.
function orbit(camera, az, el, dist, hover, pointer, zoom = 0.1) {
  const a = THREE.MathUtils.degToRad(az + pointer.x * 16 * hover);
  const e = THREE.MathUtils.degToRad(el - pointer.y * 7 * hover);
  const d = dist * (1 - zoom * hover);
  const cy = camera.userData.cy || 0;
  camera.position.set(d * Math.cos(e) * Math.sin(a), cy + d * Math.sin(e), d * Math.cos(e) * Math.cos(a));
  camera.lookAt(0, cy, 0);
}

/* ---------- les quatre objets ---------- */

// Petit hasard reproductible : la disposition des arbres ne change pas d'un chargement à l'autre.
function seeded(seed) {
  let a = seed;
  return () => { a = (a * 1664525 + 1013904223) % 4294967296; return a / 4294967296; };
}

// 01 Repérage : un parc vu de haut, arbres, allée, bassin, et la flèche qui marque le lieu à repérer.
function buildPark(scene, kit) {
  const world = new THREE.Group();
  scene.add(world);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(1.15, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: kit.floor.park, transparent: true, depthWrite: false }));
  ground.position.y = -0.002;
  world.add(ground);

  const trunk = new THREE.MeshStandardMaterial({ color: 0x2b2420, roughness: 0.9, flatShading: true });
  const leaf = [0x24453a, 0x2c5442, 0x356249].map(color => new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true }));
  const trees = [];
  const rand = seeded(7);
  for (let n = 0; n < 26 && trees.length < 16; n += 1) {
    const a = rand() * Math.PI * 2;
    const r = 0.34 + rand() * 0.62;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r * 0.85;
    if (Math.hypot(x - 0.02, z - 0.05) < 0.3) continue;              // pas d'arbre sur le lieu repéré
    if (Math.abs(z - (Math.sin(x * 3.2) * 0.16 + 0.12)) < 0.09) continue; // ni sur l'allée
    const s = 0.75 + rand() * 0.6;
    const t = new THREE.Group();
    t.position.set(x, 0, z);
    t.scale.setScalar(s);
    const bole = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.02, 0.1, 6), trunk);
    bole.position.y = 0.05;
    t.add(bole);
    const m = leaf[n % 3];
    if (n % 2) {
      [[0.11, 0.16, 0.13], [0.085, 0.14, 0.24], [0.058, 0.12, 0.34]].forEach(([rad, hgt, y]) => {
        const c = new THREE.Mesh(new THREE.ConeGeometry(rad, hgt, 7), m);
        c.position.y = y;
        t.add(c);
      });
    } else {
      const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(0.115, 0), m);
      crown.position.y = 0.19;
      t.add(crown);
    }
    world.add(t);
    trees.push({ t, phase: rand() * 6 });
  }

  const pond = new THREE.Mesh(new THREE.CircleGeometry(0.17, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x33496f, transparent: true, opacity: 0.55 }));
  pond.scale.set(1.5, 1, 1);
  pond.position.set(-0.55, 0.003, -0.18);
  world.add(pond);

  // Le lieu à repérer : une petite scène couverte, surmontée de la flèche.
  const stage = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.05, 0.22), kit.dark);
  stage.position.set(0.02, 0.025, 0.05);
  world.add(stage);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.018, 0.1), kit.steel);
  roof.position.set(0.02, 0.19, -0.03);
  world.add(roof);
  [-0.15, 0.19].forEach(x => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.16, 8), kit.steel);
    post.position.set(x, 0.11, -0.03);
    world.add(post);
  });

  const pin = new THREE.Group();
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.22, 24), kit.accent);
  tip.rotation.x = Math.PI;
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.075, 24, 16), kit.accent);
  ball.position.y = 0.17;
  pin.add(tip, ball);
  world.add(pin);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.12, 48), new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(0.02, 0.06, 0.05);
  world.add(ring);

  return {
    frameCamera: framer(0.95, 0.5, 0.2, 0.3),
    update(t, dt, hover, pointer, camera) {
      const s = t;
      pin.position.set(0.02, 0.3 + Math.sin(s * 1.6) * 0.03 + hover * 0.07, 0.05);
      pin.rotation.y = s * 0.9;
      const pulse = (s * 0.8) % 1;
      ring.scale.setScalar(1 + pulse * 2.2);
      ring.material.opacity = (1 - pulse) * 0.7;
      trees.forEach(tr => { tr.t.rotation.z = Math.sin(s * 0.9 + tr.phase) * (0.03 + hover * 0.05); });
      orbit(camera, -22 + Math.sin(t * 0.33) * 9, 34, camera.userData.dist, hover, pointer);
    },
  };
}

// 02 Conception : le plan de feu en 2D, dessiné comme sur le papier, posé sur des calques qui se décalent quand on tourne.
function buildPlan(scene) {
  const world = new THREE.Group();
  scene.add(world);
  const cv = document.createElement('canvas');
  cv.width = 768; cv.height = 614;
  const cx = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const W = 1.5, H = 1.2;
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false }));
  sheet.position.set(0, 0.62, 0);
  world.add(sheet);
  // calques derrière la feuille : des simples cadres, pour donner du relief quand elle pivote
  [-0.09, -0.18].forEach((z, i) => {
    const edge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(W, H)), new THREE.LineBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.32 - i * 0.14 }));
    edge.position.set(0, 0.62, z);
    world.add(edge);
  });

  const drawn = { at: -1 };
  function paint(t, hover) {
    if (t - drawn.at < 0.03) return;
    drawn.at = t;
    const w = cv.width, h = cv.height;
    cx.clearRect(0, 0, w, h);
    cx.fillStyle = 'rgba(13,17,32,0.94)';
    cx.fillRect(0, 0, w, h);
    cx.lineWidth = 1;
    for (let i = 0; i <= w; i += 32) {
      cx.strokeStyle = i % 128 ? 'rgba(123,145,196,0.13)' : 'rgba(123,145,196,0.3)';
      cx.beginPath(); cx.moveTo(i, 0); cx.lineTo(i, h); cx.stroke();
    }
    for (let j = 0; j <= h; j += 32) {
      cx.strokeStyle = j % 128 ? 'rgba(123,145,196,0.13)' : 'rgba(123,145,196,0.3)';
      cx.beginPath(); cx.moveTo(0, j); cx.lineTo(w, j); cx.stroke();
    }
    cx.strokeStyle = 'rgba(252,242,231,0.9)';
    cx.lineWidth = 3;
    cx.strokeRect(14, 14, w - 28, h - 28);

    // scène et gradins
    cx.lineWidth = 2;
    cx.fillStyle = 'rgba(252,242,231,0.05)';
    cx.fillRect(120, 330, 528, 190);
    cx.strokeRect(120, 330, 528, 190);
    cx.strokeStyle = 'rgba(252,242,231,0.4)';
    cx.setLineDash([6, 6]);
    cx.strokeRect(210, 372, 348, 110);
    cx.setLineDash([]);

    // structure : deux barres avec le zigzag
    cx.strokeStyle = '#7b91c4';
    cx.lineWidth = 2;
    [150, 214].forEach(y => { cx.beginPath(); cx.moveTo(110, y); cx.lineTo(658, y); cx.stroke(); });
    cx.beginPath(); cx.moveTo(110, 150);
    for (let x = 110, k = 0; x < 658; x += 22, k += 1) cx.lineTo(x + 22, k % 2 ? 150 : 214);
    cx.stroke();

    // projecteurs : symbole + faisceau qui balaie la scène
    const n = 8;
    for (let i = 0; i < n; i += 1) {
      const x = 152 + i * 66;
      const y = 214;
      const sway = Math.sin(t * 0.8 + i * 0.9) * (34 + hover * 30);
      const tx = x + sway;
      const ty = 470;
      const on = i % 2 ? '#7b91c4' : '#fcf2e7';
      const a = 0.1 + hover * 0.14;
      cx.fillStyle = i % 2 ? `rgba(123,145,196,${a})` : `rgba(252,242,231,${a})`;
      cx.beginPath(); cx.moveTo(x, y); cx.lineTo(tx - 22, ty); cx.lineTo(tx + 22, ty); cx.closePath(); cx.fill();
      cx.strokeStyle = on;
      cx.lineWidth = 1;
      cx.setLineDash([4, 5]);
      cx.beginPath(); cx.moveTo(x, y); cx.lineTo(tx, ty); cx.stroke();
      cx.setLineDash([]);
      cx.beginPath(); cx.arc(tx, ty, 5, 0, Math.PI * 2); cx.stroke();
      cx.fillStyle = '#0d1120';
      cx.strokeStyle = on;
      cx.lineWidth = 2;
      cx.beginPath(); cx.arc(x, y + 18, 11, 0, Math.PI * 2); cx.fill(); cx.stroke();
      cx.beginPath(); cx.moveTo(x - 6, y + 25); cx.lineTo(x + 6, y + 25); cx.lineTo(x, y + 34); cx.closePath(); cx.fillStyle = on; cx.fill();
      cx.fillStyle = 'rgba(252,242,231,0.85)';
      cx.font = '600 13px Montserrat, system-ui, sans-serif';
      cx.textAlign = 'center';
      cx.fillText(String(i + 1), x, y - 24 + 2 * 0);
    }

    // rampes au sol
    for (let i = 0; i < 5; i += 1) {
      const x = 190 + i * 96;
      const pulse = 0.5 + 0.5 * Math.sin(t * 1.4 + i);
      cx.fillStyle = `rgba(123,145,196,${0.4 + pulse * 0.5})`;
      cx.fillRect(x - 15, 536, 30, 12);
      cx.strokeStyle = '#fcf2e7'; cx.lineWidth = 1; cx.strokeRect(x - 15, 536, 30, 12);
    }

    // cote
    cx.strokeStyle = 'rgba(252,242,231,0.7)';
    cx.fillStyle = 'rgba(252,242,231,0.85)';
    cx.lineWidth = 1.5;
    cx.beginPath(); cx.moveTo(120, 580); cx.lineTo(648, 580);
    cx.moveTo(120, 572); cx.lineTo(120, 588); cx.moveTo(648, 572); cx.lineTo(648, 588);
    cx.stroke();
    cx.font = '600 13px Montserrat, system-ui, sans-serif';
    cx.textAlign = 'center';
    cx.fillText('12 m', 384, 573);
    cx.textAlign = 'left';
    cx.fillText('PLAN DE FEU', 34, 60);
    cx.textAlign = 'right';
    cx.fillStyle = 'rgba(123,145,196,0.95)';
    cx.fillText('RAYVO STUDIO', w - 34, 60);
    tex.needsUpdate = true;
  }

  return {
    frameCamera: framer(0.85, 0.66, 0.62, 0.15, 1.22),
    update(t, dt, hover, pointer, camera) {
      paint(t, hover);
      orbit(camera, 8 + Math.sin(t * 0.4) * 14, 9, camera.userData.dist, hover, pointer, 0);
    },
  };
}

// 03 Programmation : la vraie console grandMA3, écrans éteints comme dans l'accroche.
// La vraie console grandMA3 (modèle fourni) : téléchargée une seule fois, écrans éteints, teintée comme dans l'accroche.
let consoleModel;
async function makeConsole(url, width, brand) {
  consoleModel ||= new GLTFLoader().loadAsync(url);
  const model = (await consoleModel).scene.clone(true);
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  model.position.set(-center.x, -box.min.y, -center.z);
  const pad = new THREE.Group();
  pad.add(model);
  pad.scale.setScalar(width / (box.max.x - box.min.x));

  // Écrans : deux écrans latéraux éteints, l'écran du centre affiche le logo RayVo et le slogan, comme sur la console de l'accroche.
  const makeScreen = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 768; canvas.height = 530;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.flipY = false;
    texture.anisotropy = 4;
    return { canvas, ctx: canvas.getContext('2d'), texture };
  };
  const side = makeScreen();
  const centre = makeScreen();
  const backdropScreen = ({ ctx, canvas, texture }) => {
    const W = canvas.width, H = canvas.height;
    const bg = ctx.createRadialGradient(W / 2, H * 0.4, 20, W / 2, H * 0.4, W * 0.7);
    bg.addColorStop(0, '#151a2b');
    bg.addColorStop(1, '#05060a');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    texture.needsUpdate = true;
  };
  backdropScreen(side);
  const logo = new Image();
  const paintCentre = () => {
    backdropScreen(centre);
    const { ctx, canvas, texture } = centre;
    const W = canvas.width, H = canvas.height;
    if (logo.complete && logo.naturalWidth) {
      const lw = W * 0.5, lh = lw * logo.naturalHeight / logo.naturalWidth;
      ctx.drawImage(logo, (W - lw) / 2, H * 0.14, lw, lh);
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 58px Montserrat, system-ui, sans-serif';
    [brand?.line1, brand?.line2].filter(Boolean).forEach((line, i) => {
      ctx.shadowColor = 'rgba(252,242,231,0.5)';
      ctx.shadowBlur = 8;
      ctx.fillStyle = '#a79c91'; // taupe du logo
      ctx.fillText(line.toUpperCase(), W / 2, H * 0.6 + i * 70);
    });
    ctx.shadowBlur = 0;
    texture.needsUpdate = true;
  };
  paintCentre();
  if (brand?.logo) { logo.onload = paintCentre; logo.src = brand.logo; }
  document.fonts?.ready.then(paintCentre);

  model.traverse(node => {
    if (!node.isMesh) return;
    if (['Screen_L', 'Screen_C', 'Screen_R'].includes(node.name)) {
      node.material = new THREE.MeshBasicMaterial({ map: (node.name === 'Screen_C' ? centre : side).texture, toneMapped: false });
      return;
    }
    (Array.isArray(node.material) ? node.material : [node.material]).forEach(m => {
      if (m.userData.tinted || !m.color) return; // matériaux partagés entre les copies : on ne les fonce qu'une fois
      m.userData.tinted = true;
      const { r, g: gr, b } = m.color;
      if (Math.max(r, gr, b) - Math.min(r, gr, b) < 0.06) {
        if (m.name === 'Chassis') m.color.setRGB(0.07, 0.072, 0.08); else m.color.multiplyScalar(0.32);
      } else m.emissive?.copy(m.color).multiplyScalar(0.14);
      if ('specularIntensity' in m) m.specularIntensity = 0.12;
      m.roughness = 0.92;
      m.metalness = 0.05;
    });
  });
  return pad;
}

async function buildConsole(scene, kit, data) {
  const world = new THREE.Group();
  scene.add(world);
  world.add(floor(kit, 'desk', 1.0));
  world.add(await makeConsole(data.model, 1.3, data));
  const glow = new THREE.PointLight(ACCENT, 0.6, 2.2, 1.8);
  glow.position.set(0, 0.5, -0.1);
  scene.add(glow);

  return {
    frameCamera: framer(0.72, 0.42, 0.2, 0.2, 1.2),
    update(t, dt, hover, pointer, camera) {
      orbit(camera, -26 + Math.sin(t * 0.32) * 7, 31, camera.userData.dist, hover, pointer, 0);
    },
  };
}

// Public : silhouettes (corps, tête), bras levés au rythme du show, et des téléphones allumés dans les mains.
function makeCrowd({ count, x0, x1, z0, z1, seed, phones = 0, color = 0x0d0e13 }) {
  const rand = seeded(seed);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.95 });
  const bodies = new THREE.InstancedMesh(new THREE.SphereGeometry(0.036, 14, 10).scale(1.0, 1.7, 0.75), mat, count);
  const heads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.024, 12, 8), mat, count);
  const arms = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.008, 0.055, 2, 6), mat, count);
  const lit = new THREE.MeshBasicMaterial({ color: 0xfff1d8, toneMapped: false, side: THREE.DoubleSide, fog: false });
  const screens = phones ? new THREE.InstancedMesh(new THREE.PlaneGeometry(0.014, 0.024), lit, phones) : null;
  const people = Array.from({ length: count }, () => ({ x: x0 + rand() * (x1 - x0), z: z0 + rand() * (z1 - z0), ph: rand() * 6, side: rand() < 0.5 ? -1 : 1, k: 0.86 + rand() * 0.3 }));
  const group = new THREE.Group();
  group.add(bodies, heads, arms);
  if (screens) group.add(screens);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), pos = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), none = new THREE.Vector3(0.0001, 0.0001, 0.0001), size = new THREE.Vector3();
  return {
    group,
    update(s, hover) {
      people.forEach((p, i) => {
        const bob = Math.max(0, Math.sin(s * 3 + p.ph)) * (0.012 + hover * 0.03);
        pos.set(p.x, 0.058 * p.k + bob, p.z);
        m.compose(pos, q.identity(), size.setScalar(p.k));
        bodies.setMatrixAt(i, m);
        pos.set(p.x, 0.142 * p.k + bob, p.z);
        m.compose(pos, q.identity(), size.setScalar(p.k));
        heads.setMatrixAt(i, m);
        const up = Math.sin(s * 1.1 + p.ph * 2) > 0.55 - hover * 0.9;
        pos.set(p.x + p.side * 0.04 * p.k, 0.15 * p.k + bob, p.z);
        q.setFromEuler(e.set(0, 0, -p.side * (0.3 + Math.sin(s * 5 + p.ph) * 0.18)));
        m.compose(pos, q, up ? one : none);
        arms.setMatrixAt(i, m);
        if (screens && i < phones) {
          pos.set(p.x + p.side * 0.06 * p.k, 0.22 * p.k + bob, p.z + 0.012);
          m.compose(pos, q.identity(), up ? one : none);
          screens.setMatrixAt(i, m);
        }
      });
      bodies.instanceMatrix.needsUpdate = true;
      heads.instanceMatrix.needsUpdate = true;
      arms.instanceMatrix.needsUpdate = true;
      if (screens) screens.instanceMatrix.needsUpdate = true;
    },
  };
}

// Mouvements symétriques : d = écart au centre de la rangée, k = distance au centre, sgn = côté (les deux moitiés se répondent en miroir).
function mirror(i, n) {
  const d = i - (n - 1) / 2;
  return { d, k: Math.abs(d), sgn: Math.sign(d) };
}

// Couleurs du show : bleu de marque, crème, ambre, magenta ; chaque projecteur décale sa teinte.
const SHOW_COLORS = [ACCENT, CREAM, 0xe9a56b, 0xc45a9c].map(c => new THREE.Color(c));
function showColor(u, out) {
  const n = SHOW_COLORS.length;
  const k = ((u % n) + n) % n;
  const a = Math.floor(k);
  return out.copy(SHOW_COLORS[a]).lerp(SHOW_COLORS[(a + 1) % n], k - a);
}

// Mur LED : bandes de couleur qui défilent (texture 2D animée).
function ledWall(w, h) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = Math.round(256 * h / w);
  const x = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  const tmp = new THREE.Color();
  return {
    mesh,
    paint(s) {
      x.fillStyle = '#080a12';
      x.fillRect(0, 0, c.width, c.height);
      const rows = 9;
      for (let i = 0; i < rows; i += 1) {
        const wv = 0.5 + 0.5 * Math.sin(s * 1.5 + i * 0.7);
        showColor(s * 0.3 + i * 0.35, tmp);
        x.fillStyle = `rgba(${tmp.r * 255 | 0},${tmp.g * 255 | 0},${tmp.b * 255 | 0},${0.45 + wv * 0.5})`;
        x.fillRect(0, (i + 0.2) * c.height / rows, c.width * (0.2 + wv * 0.8), c.height / rows * 0.62);
      }
      tex.needsUpdate = true;
    },
  };
}

// Ciel / fond de salle : dégradé vertical peint en 2D, posé en arrière-plan de la scène.
function backdrop(stops) {
  const c = document.createElement('canvas');
  c.width = 4; c.height = 256;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 256);
  stops.forEach((color, i) => g.addColorStop(i / (stops.length - 1), color));
  x.fillStyle = g;
  x.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Vue depuis le public : la caméra est à hauteur de tête, elle dérive doucement et avance au survol.
function insideView(camera, base, look, t, hover, pointer) {
  camera.position.set(
    base.x + Math.sin(t * 0.21) * 0.1 + pointer.x * 0.07,
    base.y + Math.sin(t * 0.9) * 0.004 + hover * 0.018,
    base.z - hover * 0.16,
  );
  camera.lookAt(look.x + pointer.x * 0.14 + Math.sin(t * 0.17) * 0.05, look.y - pointer.y * 0.06, look.z);
}

// Barre de LED lumineuse (mur, plafond, contour d'estrade) : couleur changée à chaque image.
function ledStrip(len, thick, axis) {
  const dims = axis === 'x' ? [len, thick, thick] : axis === 'y' ? [thick, len, thick] : [thick, thick, len];
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...dims), new THREE.MeshBasicMaterial({ color: ACCENT, toneMapped: false }));
  return mesh;
}

// Festival vu du public, de nuit : brume, contre-jour, lyres BEAM, par LED, lasers, jets de CO2, foule et téléphones allumés.
function buildFestivalNight(scene, kit) {
  scene.background = backdrop(['#02030a', '#080d24', '#1a2148']);
  scene.fog = new THREE.FogExp2(0x0d1330, 0.24);
  const world = new THREE.Group();
  scene.add(world);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(8, 48).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x06070b, roughness: 1 }));
  world.add(ground);

  const deck = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.16, 0.9), kit.dark);
  deck.position.set(0, 0.08, -0.95);
  world.add(deck);
  const led = ledWall(2.1, 0.74);
  led.mesh.position.set(0, 0.6, -1.38);
  world.add(led.mesh);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(2.16, 0.8, 0.03), kit.dark);
  frame.position.set(0, 0.6, -1.4);
  world.add(frame);

  // Structure de toit : quatre poteaux, trois poutres, deux latérales.
  const roofY = 1.12;
  [[-1.32, -1.36], [1.32, -1.36], [-1.32, -0.56], [1.32, -0.56]].forEach(([x, z]) => {
    const post = truss(kit, roofY, 0.04);
    post.rotation.z = Math.PI / 2;
    post.position.set(x, roofY / 2, z);
    world.add(post);
  });
  [-1.36, -0.96, -0.56].forEach(z => { const b = truss(kit, 2.7, 0.04); b.position.set(0, roofY, z); world.add(b); });
  [-1.32, 1.32].forEach(x => { const b = truss(kit, 0.84, 0.04); b.rotation.y = Math.PI / 2; b.position.set(x, roofY, -0.96); world.add(b); });

  // Sonorisation : lignes d'enceintes suspendues de chaque côté, caissons de grave au sol.
  [-1.62, 1.62].forEach(x => {
    for (let k = 0; k < 8; k += 1) {
      const cab = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.1, 0.15), kit.matte);
      cab.position.set(x, 1.0 - k * 0.108, -0.55);
      cab.rotation.x = 0.035 * k;
      world.add(cab);
    }
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.16, 6), kit.steel);
    chain.position.set(x, 1.09, -0.55);
    world.add(chain);
    [-0.1, 0.1].forEach(dx => {
      const sub = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.22), kit.matte);
      sub.position.set(x + dx * 2.2, 0.1, -0.5);
      world.add(sub);
    });
  });

  // Poutre avant : huit lyres BEAM en éventail ; milieu : six par LED ; arrière : cinq blinders ; sol : sept par LED en contre-jour.
  const beams = Array.from({ length: 8 }, (_, i) => {
    const f = beamFixture(kit, 2.8);
    f.root.position.set(-1.1 + i * 0.314, roofY - 0.035, -0.56);
    world.add(f.root);
    return { ...f, i };
  });
  const pars = Array.from({ length: 6 }, (_, i) => {
    const f = ledPar(kit);
    f.root.position.set(-1.0 + i * 0.4, roofY - 0.06, -0.96);
    f.holder.rotation.x = 0.35;
    world.add(f.root);
    return { ...f, i };
  });
  const blinders = Array.from({ length: 5 }, (_, i) => {
    const b = blinder(kit);
    b.root.position.set(-1.0 + i * 0.5, roofY - 0.035, -1.36);
    world.add(b.root);
    return b;
  });
  const floorPars = Array.from({ length: 7 }, (_, i) => {
    const f = ledPar(kit, true);
    f.root.position.set(-1.05 + i * 0.35, 0.21, -0.6);
    world.add(f.root);
    return { ...f, i };
  });

  // Lasers vers le ciel, jets de CO2 sur le devant de la scène.
  const lasers = new THREE.Group();
  lasers.position.set(0, roofY + 0.02, -0.96);
  const rays = Array.from({ length: 9 }, (_, i) => {
    const l = beam(3.2, 1, i % 2 ? 0x74ffc6 : CREAM, 0.9, 0.005);
    lasers.add(l);
    return l;
  });
  world.add(lasers);
  const jets = [-1.0, -0.5, 0, 0.5, 1.0].map(x => {
    const j = glowSprite(kit, 0xdfe8ff, 0.4);
    j.position.set(x, 0.3, -0.53);
    j.material.opacity = 0;
    world.add(j);
    return j;
  });

  // Public : dense, en contre-jour, avec des téléphones allumés.
  const crowd = makeCrowd({ count: 300, x0: -1.7, x1: 1.7, z0: -0.2, z1: 1.05, seed: 11, phones: 34, color: 0x05060a });
  world.add(crowd.group);

  // Brume : nappes lumineuses à plusieurs profondeurs.
  const hazes = [[0, 0.5, -0.8, 3.2], [0, 0.45, -0.1, 3.0], [0, 0.4, 0.6, 2.6]].map(([x, y, z, size]) => {
    const h = glowSprite(kit, ACCENT, size);
    h.position.set(x, y, z);
    world.add(h);
    return h;
  });
  scene.add(new THREE.AmbientLight(0x1b2340, 0.9));
  const tmp = new THREE.Color();
  const base = new THREE.Vector3(0, 0.21, 1.62);
  const look = new THREE.Vector3(0, 0.56, -0.9);

  return {
    frameCamera(camera) { camera.fov = 50; camera.updateProjectionMatrix(); },
    update(t, dt, hover, pointer, camera) {
      const s = t;
      const beat = Math.pow(Math.max(0, Math.sin(s * 2.4)), 6);
      beams.forEach(b => {
        const m = mirror(b.i, beams.length);
        b.tilt.rotation.z = m.d * (0.1 + 0.07 * Math.sin(s * 0.5)) + m.sgn * Math.sin(s * 0.9 + m.k * 0.8) * (0.2 + hover * 0.15);
        b.tilt.rotation.x = -1.34 + Math.sin(s * 0.75 + m.k * 1.3) * (0.16 + hover * 0.08);
        b.root.rotation.y = m.sgn * Math.sin(s * 0.4 + m.k) * 0.3;
        showColor(s * 0.35 + m.k * 0.5, tmp);
        tintBeam(b.halo, tmp);
      });
      pars.forEach(p => {
        const m = mirror(p.i, pars.length);
        showColor(s * 0.45 + m.k * 0.7, tmp);
        p.mat.color.copy(tmp);
        tintBeam(p.wash, tmp);
        p.glare.material.color.copy(tmp);
        p.holder.rotation.x = 0.35 + Math.sin(s * 0.6 + m.k) * 0.22;
        p.holder.rotation.z = m.sgn * Math.cos(s * 0.5 + m.k * 1.4) * 0.25;
      });
      floorPars.forEach(p => {
        showColor(s * 0.45 + mirror(p.i, floorPars.length).k * 0.7 + 2, tmp);
        p.mat.color.copy(tmp);
        tintBeam(p.wash, tmp);
        p.glare.material.color.copy(tmp);
      });
      blinders.forEach(b => {
        const c = 0.2 + beat * 0.8;
        b.cells.forEach(cell => cell.material.color.setScalar(c));
        b.glare.material.opacity = 0.2 + beat * 0.8;
      });
      rays.forEach((r, i) => {
        r.rotation.z = (i - 4) * (0.2 + 0.06 * Math.sin(s * 0.8));
        r.rotation.x = -0.25 + Math.sin(s * 0.6 + i * 0.5) * 0.3;
      });
      lasers.rotation.y = Math.sin(s * 0.35) * 0.5;
      jets.forEach((j, i) => {
        const k = ((s * 0.42 + i * 0.09) % 1);
        const on = Math.max(0, 1 - k * 3.2);
        j.material.opacity = on * 0.9;
        j.scale.set(0.3 + (1 - on) * 0.5, 0.35 + (1 - on) * 0.9, 1);
        j.position.y = 0.3 + (1 - on) * 0.35;
      });
      hazes.forEach((h, i) => {
        showColor(s * 0.3 + i, tmp);
        h.material.color.copy(tmp);
        h.material.opacity = 0.17 + beat * 0.1;
      });
      led.paint(s);
      crowd.update(s, hover);
      insideView(camera, base, look, t, hover, pointer);
    },
  };
}

// Club vu depuis la piste : salle noire, murs de LED, cabine DJ sous un grand écran, lyres, boule à facettes, stroboscope, foule.
async function buildClub(scene, kit, data, opts = {}) {
  const op = Boolean(opts.operator);
  scene.background = backdrop(['#040407', '#0a0714', '#150c22']);
  scene.fog = new THREE.FogExp2(0x0c0818, 0.3);
  const world = new THREE.Group();
  scene.add(world);
  const dark = new THREE.MeshStandardMaterial({ color: 0x0a0b10, roughness: 0.6, metalness: 0.3 });
  const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 4.2).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x0c0d13, roughness: 0.35, metalness: 0.5 }));
  floorMesh.position.set(0, 0, 0.2);
  world.add(floorMesh);
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.2, 0.05), dark);
  backWall.position.set(0, 0.6, -1.7);
  world.add(backWall);
  [-1.8, 1.8].forEach(x => {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.2, 4.2), dark);
    wall.position.set(x, 0.6, 0.2);
    world.add(wall);
  });
  const ceiling = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.05, 4.2), dark);
  ceiling.position.set(0, 1.2, 0.2);
  world.add(ceiling);

  // Bandeaux de LED : deux lignes par mur latéral, une grille au plafond, un cadre autour de l'estrade.
  const strips = [];
  [-1.77, 1.77].forEach(x => [0.28, 0.7, 1.1].forEach(y => {
    const st = ledStrip(4.0, 0.018, 'z');
    st.position.set(x, y, 0.2);
    world.add(st);
    strips.push(st);
  }));
  [-1.2, -0.5, 0.2, 0.9, 1.6].forEach(z => {
    const st = ledStrip(3.5, 0.016, 'x');
    st.position.set(0, 1.17, z);
    world.add(st);
    strips.push(st);
  });

  // Cabine DJ sur estrade, devant un grand écran LED.
  const led = ledWall(2.0, 0.78);
  led.mesh.position.set(0, 0.68, -1.66);
  world.add(led.mesh);
  const riser = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.18, 0.6), kit.dark);
  riser.position.set(0, 0.09, -1.32);
  world.add(riser);
  const riserGlow = ledStrip(1.7, 0.02, 'x');
  riserGlow.position.set(0, 0.19, -1.02);
  world.add(riserGlow);
  strips.push(riserGlow);
  const table = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.18, 0.26), kit.steel);
  table.position.set(0, 0.27, -1.2);
  world.add(table);
  const facade = new THREE.Mesh(new THREE.PlaneGeometry(0.98, 0.13), new THREE.MeshBasicMaterial({ color: ACCENT, toneMapped: false }));
  facade.position.set(0, 0.27, -1.069);
  world.add(facade);
  const decks = [-0.24, 0.24].map(x => {
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.012, 32), kit.matte);
    plate.position.set(x, 0.366, -1.2);
    world.add(plate);
    return plate;
  });
  const dj = new THREE.Group();
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.12, 4, 10), kit.matte);
  torso.position.y = 0.2;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.04, 14, 10), kit.matte);
  head.position.y = 0.34;
  dj.add(torso, head);
  dj.position.set(0, 0.34, -1.36);
  world.add(dj);

  // Plafond : une poutre de lyres BEAM au-dessus de la piste, deux rangées de par LED sur les côtés.
  const bar = truss(kit, 2.4, 0.04);
  bar.position.set(0, 1.08, -0.5);
  world.add(bar);
  const heads = Array.from({ length: 6 }, (_, i) => {
    const f = beamFixture(kit, 2.8);
    f.root.position.set(-1.0 + i * 0.4, 1.045, -0.5);
    world.add(f.root);
    return { ...f, i };
  });
  const side = [-1.5, 1.5].flatMap(x => [0.2, 0.9].map((z, k) => {
    const f = beamFixture(kit, 2.4);
    f.root.position.set(x, 1.1, z);
    f.root.rotation.z = x < 0 ? -0.1 : 0.1;
    world.add(f.root);
    return { ...f, x, k };
  }));

  // Boule à facettes, avec des taches de lumière sur le sol et les murs.
  const ballRoot = new THREE.Group();
  ballRoot.position.set(0, 0.95, 0.35);
  const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.4, 6), kit.steel);
  wire.position.y = 0.25;
  const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.11, 2), new THREE.MeshStandardMaterial({ color: 0xdfe4f5, metalness: 1, roughness: 0.15, flatShading: true, emissive: 0x2c3556 }));
  ballRoot.add(wire, ball);
  const ballGlow = glowSprite(kit, 0xdfe6ff, 0.6);
  ballRoot.add(ballGlow);
  world.add(ballRoot);
  const spots = Array.from({ length: 34 }, (_, i) => {
    const wall = i % 3;
    const m = new THREE.Mesh(new THREE.CircleGeometry(0.03 + (i % 3) * 0.012, 14), new THREE.MeshBasicMaterial({ color: i % 2 ? 0xdfe6ff : ACCENT, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
    if (wall === 0) m.rotation.x = -Math.PI / 2; else m.rotation.y = wall === 1 ? Math.PI / 2 : -Math.PI / 2;
    world.add(m);
    return { m, wall, a: (i / 34) * Math.PI * 2, r: 0.4 + (i % 5) * 0.22, speed: 0.35 + (i % 4) * 0.08 };
  });

  // Stroboscope : un éclair blanc très bref sur certains temps.
  const strobe = glowSprite(kit, 0xffffff, 3.6);
  strobe.position.set(0, 0.85, 0.2);
  strobe.material.opacity = 0;
  world.add(strobe);

  const crowd = makeCrowd({ count: 260, x0: -1.5, x1: 1.5, z0: -0.7, z1: 1.05, seed: 23, phones: 18, color: 0x05050a });
  world.add(crowd.group);
  const hazes = [[0, 0.45, -0.9, 3.2], [0, 0.4, -0.1, 3.0], [0, 0.35, 0.7, 2.6]].map(([x, y, z, size]) => {
    const h = glowSprite(kit, ACCENT, size);
    h.position.set(x, y, z);
    world.add(h);
    return h;
  });
  scene.add(new THREE.AmbientLight(0x1a1530, 0.9));
  const floorLight = new THREE.PointLight(0x7b91c4, 1.0, 3.5, 1.6);
  floorLight.position.set(0, 0.7, 0.3);
  scene.add(floorLight);
  const tmp = new THREE.Color();
  // Vue de l'exploitant : on est derrière la console grandMA3 au fond de la salle, les écrans face à nous.
  let pult = null;
  if (op) {
    pult = await makeConsole(data.model, 0.26, data);
    pult.position.set(0, 0, 1.72);
    world.add(pult);
    const lamp = new THREE.PointLight(0xa9bcff, 1.1, 1.6, 1.5);
    lamp.position.set(0, 0.2, 1.85);
    scene.add(lamp);
  }
  const base = op ? new THREE.Vector3(0, 0.21, 2.0) : new THREE.Vector3(0, 0.2, 1.85);
  const look = op ? new THREE.Vector3(0, 0.14, -0.8) : new THREE.Vector3(0, 0.48, -1.0);

  return {
    frameCamera(camera) { camera.fov = 52; camera.updateProjectionMatrix(); },
    update(t, dt, hover, pointer, camera) {
      const s = t;
      const beat = Math.pow(Math.max(0, Math.sin(s * 2.6)), 5);
      const flash = Math.pow(Math.max(0, Math.sin(s * 1.9 + 1)), 30);
      ball.rotation.y = s * 0.6;
      spots.forEach(sp => {
        const a = sp.a + s * sp.speed;
        if (sp.wall === 0) sp.m.position.set(Math.cos(a) * sp.r * 1.6, 0.004, 0.2 + Math.sin(a) * sp.r * 1.6);
        else sp.m.position.set(sp.wall === 1 ? -1.77 : 1.77, 0.12 + (0.5 + 0.5 * Math.sin(a * 1.3)) * 0.95, 0.2 + Math.cos(a) * 1.5);
        sp.m.scale.setScalar(0.8 + 0.4 * Math.sin(s * 2 + sp.a));
      });
      strips.forEach((st, i) => { showColor(s * 0.3 + i * 0.25, tmp); st.material.color.copy(tmp).multiplyScalar(0.6 + beat * 0.5); });
      heads.forEach(h => {
        const m = mirror(h.i, heads.length);
        h.tilt.rotation.z = m.d * 0.18 + m.sgn * Math.sin(s * 0.85 + m.k) * (0.28 + hover * 0.2);
        h.tilt.rotation.x = -1.34 + Math.sin(s * 0.7 + m.k * 1.6) * (0.16 + hover * 0.08);
        h.root.rotation.y = m.sgn * Math.sin(s * 0.5 + m.k) * 0.3;
        showColor(s * 0.4 + m.k * 0.8, tmp);
        tintBeam(h.halo, tmp);
      });
      side.forEach(h => {
        const sgn = h.x < 0 ? -1 : 1;
        h.tilt.rotation.z = -sgn * 0.55 + sgn * Math.sin(s * 0.8 + h.k * 2) * 0.25;
        h.tilt.rotation.x = -1.3 + Math.sin(s * 0.65 + h.k) * 0.18;
        showColor(s * 0.5 + h.k, tmp);
        tintBeam(h.halo, tmp);
      });
      decks.forEach((d, i) => { d.rotation.y = s * (i ? 1.6 : -1.3); });
      showColor(s * 0.5, tmp);
      facade.material.color.copy(tmp).multiplyScalar(0.35 + beat * 0.55);
      dj.rotation.z = Math.sin(s * 2.6) * 0.05;
      strobe.material.opacity = flash * 0.8;
      floorLight.intensity = 0.9 + beat * 0.7 + flash * 2.4;
      hazes.forEach((h, i) => {
        showColor(s * 0.28 + i * 1.2, tmp);
        h.material.color.copy(tmp);
        h.material.opacity = 0.16 + beat * 0.1 + flash * 0.2;
      });
      led.paint(s);
      crowd.update(s, hover);
      insideView(camera, base, look, t, hover, pointer);
    },
  };
}
