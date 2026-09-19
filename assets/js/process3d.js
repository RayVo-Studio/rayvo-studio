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
  const cards = [...root.querySelectorAll('.step-3d')];
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
  const builders = [buildPark, buildPlan, buildConsole, buildFestival];
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
      build: builders[i % builders.length], api: null,
      hover: 0, want: 0, pointer: { x: 0, y: 0 }, visible: false, ready: false, w: 0, h: 0,
    };
  });

  const clock = new THREE.Clock();
  let raf = 0;
  let last = 0;
  let time = 0;

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

  function draw(item, t, dt) {
    if (!item.api) return;
    size(item);
    item.hover += (item.want - item.hover) * (calm ? 1 : 1 - Math.exp(-dt * 4));
    item.api.update(t, dt, item.hover, item.pointer, item.camera);
    renderer.setSize(item.w, item.h, false);
    renderer.render(item.scene, item.camera);
    item.ctx.clearRect(0, 0, item.w, item.h);
    item.ctx.drawImage(renderer.domElement, 0, 0);
    if (!item.ready) { item.ready = true; item.el.classList.add('is-ready'); }
  }

  function frame(now) {
    raf = 0;
    const dt = Math.min(clock.getDelta(), 0.1);
    time += dt;
    const anyHover = items.some(item => item.want > 0 || item.hover > 0.01);
    if (anyHover || now - last > 30) {
      last = now;
      items.forEach(item => { if (item.visible) draw(item, time, dt); });
    }
    if (items.some(item => item.visible) && !document.hidden) raf = requestAnimationFrame(frame);
  }
  // Chaque objet se construit sans attendre les autres : la console (modèle de 2 Mo) arrive quand elle est prête.
  items.forEach(async item => {
    try { item.api = await item.build(item.scene, kit, root.dataset); } catch (error) { console.warn('process3d', error); return; }
    item.api.frameCamera(item.camera);
    if (item.visible) { draw(item, time || CALM_TIME, 0.016); start(); }
  });

  function start() { if (!raf && !calm && !document.hidden) { clock.getDelta(); raf = requestAnimationFrame(frame); } }

  const watcher = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const item = items.find(it => it.el === entry.target);
      if (!item) return;
      item.visible = entry.isIntersecting;
      if (item.visible && calm) draw(item, CALM_TIME, 0.016);
    });
    start();
  }, { rootMargin: '80px' });
  items.forEach(item => watcher.observe(item.el));
  document.addEventListener('visibilitychange', start);
  new ResizeObserver(() => items.forEach(item => { if (item.visible) draw(item, time || CALM_TIME, 0.016); })).observe(root);

  if (calm) return;

  // Interaction : le survol (ou le toucher) anime l'objet et le rapproche.
  items.forEach(item => {
    const step = item.el.closest('.step') || item.el;
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
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: kit.glow, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  sprite.scale.setScalar(size);
  return sprite;
}

// Couleur d'un faisceau (uniform du shader) : on convertit en sRGB comme à la création.
function tintBeam(mesh, color) {
  const c = color.clone().convertLinearToSRGB();
  mesh.material.uniforms.uColor.value.set(c.r, c.g, c.b);
}

// Lyre BEAM : lyre en U, tête étroite, faisceau fin très long. Suspendue sous une poutre.
function beamFixture(kit) {
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
  const core = beam(1.1, -1, CREAM, 1, 0.02);
  core.position.y = -0.075;
  const halo = beam(1.1, -1, ACCENT, 0.3, 0.06);
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
function framer(w, h, cy, depth = 0.4) {
  return camera => {
    const vfov = THREE.MathUtils.degToRad(camera.fov) / 2;
    const hfov = Math.atan(Math.tan(vfov) * camera.aspect);
    camera.userData.dist = Math.max(h / Math.tan(vfov), w / Math.tan(hfov)) * 0.95 + depth;
    camera.userData.cy = cy;
    camera.updateProjectionMatrix();
  };
}

// Place la caméra selon l'azimut/élévation, la distance et le survol.
function orbit(camera, az, el, dist, hover, pointer) {
  const a = THREE.MathUtils.degToRad(az + pointer.x * 16 * hover);
  const e = THREE.MathUtils.degToRad(el - pointer.y * 7 * hover);
  const d = dist * (1 - 0.1 * hover);
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
      const s = t * (1 + hover * 1.4);
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
      const sway = Math.sin(t * (0.8 + hover * 1.5) + i * 0.9) * (34 + hover * 30);
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
      const pulse = 0.5 + 0.5 * Math.sin(t * (1.4 + hover) + i);
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
    frameCamera: framer(0.85, 0.66, 0.62, 0.15),
    update(t, dt, hover, pointer, camera) {
      paint(t, hover);
      orbit(camera, 8 + Math.sin(t * 0.4) * 14, 9, camera.userData.dist, hover, pointer);
    },
  };
}

// 03 Programmation : la vraie console grandMA3, écrans éteints comme dans l'accroche.
async function buildConsole(scene, kit, data) {
  const world = new THREE.Group();
  scene.add(world);
  world.add(floor(kit, 'desk', 1.0));
  const gltf = await new GLTFLoader().loadAsync(data.model);
  const model = gltf.scene;
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  model.position.set(-center.x, -box.min.y, -center.z);
  const pad = new THREE.Group();
  pad.add(model);
  pad.scale.setScalar(1.3 / (box.max.x - box.min.x));
  world.add(pad);

  const dark = document.createElement('canvas');
  dark.width = 256; dark.height = 176;
  const dx = dark.getContext('2d');
  const g = dx.createRadialGradient(128, 88, 8, 128, 88, 150);
  g.addColorStop(0, '#151a2b'); g.addColorStop(1, '#05060a');
  dx.fillStyle = g;
  dx.fillRect(0, 0, 256, 176);
  const screenTex = new THREE.CanvasTexture(dark);
  screenTex.colorSpace = THREE.SRGBColorSpace;
  screenTex.flipY = false;

  const seen = new Set();
  model.traverse(node => {
    if (!node.isMesh) return;
    if (['Screen_L', 'Screen_C', 'Screen_R'].includes(node.name)) {
      node.material = new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false });
      return;
    }
    (Array.isArray(node.material) ? node.material : [node.material]).forEach(m => {
      if (seen.has(m) || !m.color) return;
      seen.add(m);
      const { r, g: gr, b } = m.color;
      if (Math.max(r, gr, b) - Math.min(r, gr, b) < 0.06) {
        if (m.name === 'Chassis') m.color.setRGB(0.07, 0.072, 0.08); else m.color.multiplyScalar(0.32);
      } else m.emissive?.copy(m.color).multiplyScalar(0.14);
      if ('specularIntensity' in m) m.specularIntensity = 0.12;
      m.roughness = 0.92;
      m.metalness = 0.05;
    });
  });
  const glow = new THREE.PointLight(ACCENT, 0.6, 2.2, 1.8);
  glow.position.set(0, 0.5, -0.1);
  scene.add(glow);

  return {
    frameCamera: framer(0.72, 0.42, 0.2, 0.2),
    update(t, dt, hover, pointer, camera) {
      orbit(camera, -26 + Math.sin(t * 0.32) * 7, 31, camera.userData.dist, hover, pointer);
    },
  };
}

// 04 Exploitation : une scène de festival, structure de toit, mur LED, enceintes, lyres BEAM, par LED, blinders et public.
function buildFestival(scene, kit) {
  const world = new THREE.Group();
  scene.add(world);
  world.add(floor(kit, 'desk', 1.2));

  const deck = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.1, 0.62), kit.dark);
  deck.position.set(0, 0.05, -0.12);
  world.add(deck);

  // Mur LED animé au fond de scène.
  const led = document.createElement('canvas');
  led.width = 256; led.height = 112;
  const lx = led.getContext('2d');
  const ledTex = new THREE.CanvasTexture(led);
  ledTex.colorSpace = THREE.SRGBColorSpace;
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.44), new THREE.MeshBasicMaterial({ map: ledTex, toneMapped: false }));
  wall.position.set(0, 0.42, -0.37);
  world.add(wall);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(1.04, 0.48, 0.02), kit.dark);
  frame.position.set(0, 0.42, -0.385);
  world.add(frame);

  // Structure de toit : poteaux, trois poutres et deux latérales.
  const roofY = 0.98;
  [[-0.66, -0.4], [0.66, -0.4], [-0.66, 0.16], [0.66, 0.16]].forEach(([x, z]) => {
    const post = truss(kit, roofY, 0.035);
    post.rotation.z = Math.PI / 2;
    post.position.set(x, roofY / 2, z);
    world.add(post);
  });
  [-0.4, -0.12, 0.16].forEach(z => { const b = truss(kit, 1.36, 0.035); b.position.set(0, roofY, z); world.add(b); });
  [-0.66, 0.66].forEach(x => { const b = truss(kit, 0.56, 0.035); b.rotation.y = Math.PI / 2; b.position.set(x, roofY, -0.12); world.add(b); });

  // Piles d'enceintes de chaque côté.
  [-0.8, 0.8].forEach(x => {
    for (let k = 0; k < 6; k += 1) {
      const cab = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.085, 0.13), kit.matte);
      cab.position.set(x, 0.85 - k * 0.09, 0.02);
      cab.rotation.x = 0.035 * k;
      world.add(cab);
    }
  });

  // Poutre avant : six lyres BEAM qui balaient en éventail.
  const beams = [-0.6, -0.36, -0.12, 0.12, 0.36, 0.6].map((x, i) => {
    const f = beamFixture(kit);
    f.root.position.set(x, roofY - 0.035, 0.16);
    world.add(f.root);
    return { ...f, i };
  });
  // Poutre du milieu : quatre par LED en lavage.
  const pars = [-0.5, -0.17, 0.17, 0.5].map((x, i) => {
    const f = ledPar(kit);
    f.root.position.set(x, roofY - 0.06, -0.12);
    f.holder.rotation.x = 0.3;
    world.add(f.root);
    return { ...f, i };
  });
  // Poutre arrière : quatre blinders.
  const blinders = [-0.45, -0.15, 0.15, 0.45].map(x => {
    const b = blinder(kit);
    b.root.position.set(x, roofY - 0.035, -0.4);
    world.add(b.root);
    return b;
  });
  // Au sol : cinq par LED en contre-jour, faisceaux vers le ciel.
  const floorPars = [-0.56, -0.28, 0, 0.28, 0.56].map((x, i) => {
    const f = ledPar(kit, true);
    f.root.position.set(x, 0.14, -0.3);
    world.add(f.root);
    return { ...f, i };
  });

  // Public : silhouettes devant la scène.
  const crowdMat = new THREE.MeshStandardMaterial({ color: 0x0d0e13, roughness: 0.9 });
  const count = 46;
  const crowd = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.028, 0.05, 3, 8), crowdMat, count);
  const rand = seeded(11);
  const people = Array.from({ length: count }, () => ({ x: (rand() - 0.5) * 1.5, z: 0.42 + rand() * 0.55, ph: rand() * 6 }));
  world.add(crowd);
  const m4 = new THREE.Matrix4();

  // Couleurs du show : bleu de marque, crème, ambre, magenta ; chaque projecteur décale sa teinte.
  const palette = [ACCENT, CREAM, 0xe9a56b, 0xc45a9c].map(c => new THREE.Color(c));
  const tmp = new THREE.Color();
  const cycle = (u, out) => {
    const k = ((u % palette.length) + palette.length) % palette.length;
    const a = Math.floor(k);
    return out.copy(palette[a]).lerp(palette[(a + 1) % palette.length], k - a);
  };

  return {
    frameCamera: framer(0.98, 0.62, 0.5, 0.3),
    update(t, dt, hover, pointer, camera) {
      const s = t * (1 + hover * 1.8);
      const beat = Math.pow(Math.max(0, Math.sin(s * 2.4)), 6);
      beams.forEach(b => {
        const spread = (b.i - 2.5) * (0.16 + 0.1 * Math.sin(s * 0.5));
        b.tilt.rotation.z = spread + Math.sin(s * 0.9 + b.i * 0.8) * (0.25 + hover * 0.25);
        b.tilt.rotation.x = 0.42 + Math.sin(s * 0.75 + b.i * 1.3) * (0.4 + hover * 0.25);
        b.root.rotation.y = Math.sin(s * 0.4 + b.i) * 0.25;
      });
      pars.forEach(p => {
        cycle(s * 0.45 + p.i * 0.7, tmp);
        p.mat.color.copy(tmp);
        tintBeam(p.wash, tmp);
        p.glare.material.color.copy(tmp);
        p.holder.rotation.x = 0.3 + Math.sin(s * 0.6 + p.i) * 0.22;
        p.holder.rotation.z = Math.cos(s * 0.5 + p.i * 1.4) * 0.25;
      });
      floorPars.forEach(p => {
        cycle(s * 0.45 + p.i * 0.7 + 2, tmp);
        p.mat.color.copy(tmp);
        tintBeam(p.wash, tmp);
        p.glare.material.color.copy(tmp);
      });
      blinders.forEach(b => {
        const c = 0.25 + beat * 0.75;
        b.cells.forEach(cell => cell.material.color.setScalar(c));
        b.glare.material.opacity = 0.2 + beat * 0.8;
      });
      // mur LED : pistes qui défilent, qui claquent sur le rythme
      lx.fillStyle = '#080a12';
      lx.fillRect(0, 0, 256, 112);
      for (let i = 0; i < 9; i += 1) {
        const wv = 0.5 + 0.5 * Math.sin(s * 1.5 + i * 0.7);
        cycle(s * 0.3 + i * 0.35, tmp);
        lx.fillStyle = `rgba(${tmp.r * 255 | 0},${tmp.g * 255 | 0},${tmp.b * 255 | 0},${0.45 + wv * 0.5})`;
        lx.fillRect(0, 12 + i * 11, 256 * (0.2 + wv * 0.8), 7);
      }
      ledTex.needsUpdate = true;
      people.forEach((pp, i) => {
        const bob = Math.max(0, Math.sin(s * 3 + pp.ph)) * (0.012 + hover * 0.03);
        m4.makeTranslation(pp.x, 0.06 + bob, pp.z);
        crowd.setMatrixAt(i, m4);
      });
      crowd.instanceMatrix.needsUpdate = true;
      orbit(camera, Math.sin(t * 0.3) * 20, 12, camera.userData.dist, hover, pointer);
    },
  };
}
