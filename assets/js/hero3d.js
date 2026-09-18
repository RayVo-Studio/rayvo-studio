// Accroche : la vraie console grandMA3 en 3D (three.js). Zoom et pivot au survol.
// Si le navigateur ne sait pas faire de 3D, la console dessinée en CSS reste affichée.
import * as THREE from 'three';
import { GLTFLoader } from './vendor/three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from './vendor/three/examples/jsm/environments/RoomEnvironment.js';

const desk = document.querySelector('.desk[data-model]');
const hero = document.querySelector('.hero');
const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const touchOnly = window.matchMedia('(hover: none)').matches;

if (desk && hero) {
  init().catch(() => {});
}

async function init() {
  const host = document.createElement('div');
  host.className = 'scene3d';
  host.setAttribute('aria-hidden', 'true');
  desk.after(host);

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (error) {
    host.remove();
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.28;

  const camera = new THREE.PerspectiveCamera(26, 1, 0.05, 30);

  // Lumières : une principale un peu froide, un contre-jour bleu de marque, l'éclat des écrans.
  const key = new THREE.DirectionalLight(0xdfe6ff, 2.0);
  key.position.set(1.4, 2.6, 1.9);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -1.6, right: 1.6, top: 1.6, bottom: -1.6, near: 0.5, far: 8 });
  key.shadow.bias = -0.0004;
  key.shadow.radius = 5;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x7b91c4, 1.3);
  rim.position.set(-2.2, 1.6, -1.8);
  scene.add(rim);
  const glow = new THREE.PointLight(0x7b91c4, 1.4, 2.4, 1.6);
  scene.add(glow);

  // Bureau : plateau sombre qui s'efface sur les bords.
  const deskGeo = new THREE.CircleGeometry(0.95, 64);
  deskGeo.rotateX(-Math.PI / 2);
  const fade = document.createElement('canvas');
  fade.width = fade.height = 256;
  const fx = fade.getContext('2d');
  const grad = fx.createRadialGradient(128, 128, 20, 128, 128, 128);
  grad.addColorStop(0, '#fff');
  grad.addColorStop(0.45, '#999');
  grad.addColorStop(0.8, '#000');
  fx.fillStyle = grad;
  fx.fillRect(0, 0, 256, 256);
  const deskMesh = new THREE.Mesh(deskGeo, new THREE.MeshStandardMaterial({
    color: 0x1d1611, roughness: 0.85, metalness: 0, transparent: true, alphaMap: new THREE.CanvasTexture(fade),
  }));
  deskMesh.receiveShadow = true;
  deskMesh.position.y = -0.002;
  scene.add(deskMesh);

  // Écrans dessinés en 2D, projetés sur les trois dalles de la console.
  const screens = createScreens(desk.dataset);

  const gltf = await new GLTFLoader().loadAsync(desk.dataset.model);
  const model = gltf.scene;
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  model.position.set(-center.x, -box.min.y, -center.z);
  const size = box.getSize(new THREE.Vector3());

  const seen = new Set();
  model.traverse(node => {
    if (!node.isMesh) return;
    node.castShadow = true;
    node.receiveShadow = true;
    const screen = screens[node.name];
    if (screen) {
      node.castShadow = false;
      node.material = new THREE.MeshBasicMaterial({ map: screen.texture, toneMapped: false });
      return;
    }
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    materials.forEach(material => {
      if (seen.has(material)) return;
      seen.add(material);
      tint(material);
    });
  });
  scene.add(model);
  glow.position.set(0, size.y * 0.75, -size.z * 0.1);

  // Caméra : deux états (repos, survol) entre lesquels on glisse.
  const target = new THREE.Vector3(0, size.y * 0.42, 0);
  const rest = { az: 30, el: 33, dist: 1, tx: 0, ty: 0 };
  const near = { az: 12, el: 25, dist: 1, tx: -0.15, ty: -0.03 };
  const now = { ...rest };
  const pointer = { x: 0, y: 0 };
  let zoomed = false;

  function fit() {
    const w = host.clientWidth || 1;
    const h = host.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const hfov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * camera.aspect);
    const wide = (size.x * 0.5 + size.z * 0.45) * 0.92;
    rest.dist = Math.max(wide / Math.tan(hfov / 2), 1.6);
    near.dist = rest.dist * 0.76;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(() => { fit(); frame(performance.now(), true); }).observe(host);
  fit();

  function place() {
    const az = THREE.MathUtils.degToRad(now.az + pointer.x * (zoomed ? 5 : 3) + (calm ? 0 : Math.sin(clock.elapsedTime * 0.35) * 1.6));
    const el = THREE.MathUtils.degToRad(now.el - pointer.y * (zoomed ? 3.5 : 2));
    camera.position.set(
      target.x + now.tx + now.dist * Math.cos(el) * Math.sin(az),
      target.y + now.ty + now.dist * Math.sin(el),
      target.z + now.dist * Math.cos(el) * Math.cos(az),
    );
    camera.lookAt(target.x + now.tx, target.y + now.ty, target.z);
  }

  const clock = new THREE.Clock();
  let last = 0;
  let visible = true;
  let raf = 0;

  function frame(time, once = false) {
    const dt = clock.getDelta();
    const goal = zoomed ? near : rest;
    const k = calm ? 1 : 1 - Math.exp(-dt * 3.4);
    for (const key of ['az', 'el', 'dist', 'tx', 'ty']) now[key] += (goal[key] - now[key]) * k;
    if (time - last > 32 || once) {
      last = time;
      screens.draw(clock.elapsedTime);
    }
    place();
    renderer.render(scene, camera);
    if (!once && visible && !calm) raf = requestAnimationFrame(frame);
    else raf = 0;
  }

  function start() { if (!raf && visible && !document.hidden && !calm) raf = requestAnimationFrame(frame); }
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) start(); }).observe(host);
  document.addEventListener('visibilitychange', start);

  // Interaction.
  if (!calm) {
    if (touchOnly) {
      host.addEventListener('click', () => { zoomed = !zoomed; host.classList.toggle('is-zoomed', zoomed); });
    } else {
      host.addEventListener('mouseenter', () => { zoomed = true; host.classList.add('is-zoomed'); });
      host.addEventListener('mouseleave', () => { zoomed = false; host.classList.remove('is-zoomed'); pointer.x = pointer.y = 0; });
      host.addEventListener('mousemove', event => {
        const b = host.getBoundingClientRect();
        pointer.x = (event.clientX - b.left) / b.width * 2 - 1;
        pointer.y = (event.clientY - b.top) / b.height * 2 - 1;
      });
    }
  }

  frame(performance.now(), true);
  hero.classList.add('has-3d');
  start();
}

// La maquette est en gris clair : on la fonce pour retrouver une console noire, sans toucher aux touches colorées.
function tint(material) {
  if (!material.color) return;
  const { r, g, b } = material.color;
  const spread = Math.max(r, g, b) - Math.min(r, g, b);
  if (spread < 0.06) material.color.multiplyScalar(0.27);
  else material.emissive?.copy(material.color).multiplyScalar(0.18);
  if ('specularIntensity' in material) material.specularIntensity = 0.5;
  material.roughness = 0.6;
  material.metalness = 0.05;
  if ('envMapIntensity' in material) material.envMapIntensity = 0.8;
}

// Contenu des trois écrans : grille de projecteurs, logo + slogan, timeline.
function createScreens(data) {
  const make = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 768;
    canvas.height = 530;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.flipY = false;
    texture.anisotropy = 4;
    return { canvas, ctx: canvas.getContext('2d'), texture };
  };
  const left = make();
  const center = make();
  const right = make();
  const logo = new Image();
  logo.src = data.logo;
  const palette = ['#7b91c4', '#e8b45c', '#5ccb93', '#c47bb6', '#fcf2e7'];

  const drawGrid = t => {
    const { ctx, canvas, texture } = left;
    ctx.fillStyle = '#05060a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const cols = 8, rows = 5, gap = 12, pad = 22;
    const w = (canvas.width - pad * 2 - gap * (cols - 1)) / cols;
    const h = (canvas.height - pad * 2 - gap * (rows - 1)) / rows;
    for (let i = 0; i < cols * rows; i++) {
      const x = pad + (i % cols) * (w + gap);
      const y = pad + Math.floor(i / cols) * (h + gap);
      const level = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * (0.9 + (i % 7) * 0.13) + i * 1.7));
      ctx.globalAlpha = level;
      ctx.fillStyle = palette[i % palette.length];
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 6);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    texture.needsUpdate = true;
  };

  const drawBrand = t => {
    const { ctx, canvas, texture } = center;
    const W = canvas.width, H = canvas.height;
    const bg = ctx.createRadialGradient(W / 2, H * 0.4, 20, W / 2, H * 0.4, W * 0.7);
    bg.addColorStop(0, '#151a2b');
    bg.addColorStop(1, '#05060a');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    const cycle = (t % 6) / 6;
    const rise = Math.min(1, cycle / 0.2);
    if (logo.complete && logo.naturalWidth) {
      const lw = W * 0.5, lh = lw * logo.naturalHeight / logo.naturalWidth;
      ctx.globalAlpha = 0.25 + 0.75 * rise;
      ctx.drawImage(logo, (W - lw) / 2, H * 0.14, lw, lh);
      ctx.globalAlpha = 1;
    }
    const lines = [data.line1, data.line2].filter(Boolean).map(s => s.toUpperCase());
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '600 64px Fredoka, system-ui, sans-serif';
    lines.forEach((line, i) => {
      const on = Math.min(1, Math.max(0, (cycle - 0.08 - i * 0.08) / 0.16));
      const glowAmount = cycle < 0.4 ? 26 * on : 8;
      ctx.shadowColor = 'rgba(123,145,196,0.95)';
      ctx.shadowBlur = glowAmount;
      ctx.globalAlpha = 0.12 + 0.88 * on;
      ctx.fillStyle = '#fcf2e7';
      ctx.fillText(line, W / 2, H * 0.6 + i * 74);
    });
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    const sweepX = -W * 0.3 + (W * 1.6) * Math.min(1, Math.max(0, (cycle - 0.1) / 0.5));
    const sweep = ctx.createLinearGradient(sweepX - 90, 0, sweepX + 90, 0);
    sweep.addColorStop(0, 'rgba(123,145,196,0)');
    sweep.addColorStop(0.5, 'rgba(123,145,196,0.28)');
    sweep.addColorStop(1, 'rgba(123,145,196,0)');
    ctx.fillStyle = sweep;
    ctx.fillRect(0, 0, W, H);
    texture.needsUpdate = true;
  };

  const drawTimeline = t => {
    const { ctx, canvas, texture } = right;
    const W = canvas.width, H = canvas.height;
    ctx.fillStyle = '#05060a';
    ctx.fillRect(0, 0, W, H);
    const rows = 6, pad = 24, gap = 12;
    const rh = (H - pad * 2 - gap * (rows - 1)) / rows;
    for (let r = 0; r < rows; r++) {
      const y = pad + r * (rh + gap);
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(pad, y, W - pad * 2, rh);
      let x = pad + 6;
      for (let c = 0; c < 3; c++) {
        const cw = (W - pad * 2 - 30) * [0.3, 0.42, 0.2][(c + r) % 3];
        ctx.fillStyle = palette[(r + c * 2) % 4];
        ctx.fillRect(x, y + 5, cw, rh - 10);
        x += cw + 8;
      }
    }
    const px = pad + ((t / 7) % 1) * (W - pad * 2);
    ctx.fillStyle = '#fcf2e7';
    ctx.shadowColor = '#fcf2e7';
    ctx.shadowBlur = 14;
    ctx.fillRect(px - 2, pad - 8, 4, H - pad * 2 + 16);
    ctx.shadowBlur = 0;
    texture.needsUpdate = true;
  };

  const api = {
    Screen_L: left,
    Screen_C: center,
    Screen_R: right,
    draw(t) { drawGrid(t); drawBrand(t); drawTimeline(t); },
  };
  // Redessine dès que la police et le logo sont prêts.
  document.fonts?.ready.then(() => api.draw(0));
  logo.onload = () => api.draw(0);
  return api;
}
