// Accroche : la vraie console grandMA3 en 3D (three.js). Zoom et pivot au survol.
// Sans 3D possible, l'image d'attente de la console reste affichée.
import * as THREE from 'three';
import { GLTFLoader } from './vendor/three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from './vendor/three/examples/jsm/environments/RoomEnvironment.js';

const host = document.querySelector('.scene3d[data-model]');
const hero = document.querySelector('.hero');
// Taupe du logo RayVo (mesuré sur assets/img/logo.png) : le slogan a exactement la même couleur.
const LOGO_COLOR = '#a79c91';
// Image fixe (logo allumé) pour ceux qui ont réduit les animations.
const CALM_FRAME = 4.4;
const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const touchOnly = window.matchMedia('(hover: none)').matches;

if (host && hero) {
  init().catch(() => {});
}

async function init() {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (error) {
    return; // pas de 3D : l'image d'attente reste affichée
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
  scene.environmentIntensity = 0.12;

  const camera = new THREE.PerspectiveCamera(26, 1, 0.05, 30);

  // Lumières : une principale un peu froide, un contre-jour bleu de marque, l'éclat des écrans.
  const key = new THREE.DirectionalLight(0xdfe6ff, 1.5);
  key.position.set(1.4, 2.6, 1.9);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -1.6, right: 1.6, top: 1.6, bottom: -1.6, near: 0.5, far: 8 });
  key.shadow.bias = -0.0004;
  key.shadow.radius = 5;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xb9c4e6, 0.55);
  rim.position.set(-2.2, 1.6, -1.8);
  scene.add(rim);
  const glow = new THREE.PointLight(0x7b91c4, 0.7, 2.2, 1.8);
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
  const screens = createScreens(host.dataset);

  const gltf = await new GLTFLoader().loadAsync(host.dataset.model);
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
  const rest = { az: -30, el: 33, dist: 1, tx: -0.11, ty: 0 };
  const near = { az: -14, el: 28, dist: 1, tx: -0.14, ty: -0.01 };
  const now = { ...rest };
  const pointer = { x: 0, y: 0 };
  let zoomed = false;

  function fit() {
    const w = host.clientWidth || 1;
    const h = host.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const hfov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * camera.aspect);
    const wide = (size.x * 0.5 + size.z * 0.45) * 1.14;
    rest.dist = Math.max(wide / Math.tan(hfov / 2), 1.6);
    near.dist = rest.dist * 0.88;
    camera.updateProjectionMatrix();
  }
  fit();
  Object.assign(now, rest);
  new ResizeObserver(() => { fit(); frame(performance.now(), true); }).observe(host);

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
      screens.draw(calm ? CALM_FRAME : clock.elapsedTime);
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
  if (spread < 0.06) {
    if (material.name === 'Chassis') material.color.setRGB(0.07, 0.072, 0.08);
    else material.color.multiplyScalar(0.32);
  }
  else material.emissive?.copy(material.color).multiplyScalar(0.14);
  if ('specularIntensity' in material) material.specularIntensity = 0.12;
  material.roughness = 0.92;
  material.metalness = 0.05;
  if ('envMapIntensity' in material) material.envMapIntensity = 0.2;
}

// Contenu des trois écrans : logo + slogan au centre, deux écrans latéraux éteints.
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

  // Un seul reflet traverse les trois écrans, de gauche à droite, puis le logo et le slogan s'allument.
  const ramp = (x, from, to) => Math.min(1, Math.max(0, (x - from) / (to - from)));
  const CYCLE = 6;

  const background = screen => {
    const { ctx, canvas } = screen;
    const W = canvas.width, H = canvas.height;
    const bg = ctx.createRadialGradient(W / 2, H * 0.4, 20, W / 2, H * 0.4, W * 0.7);
    bg.addColorStop(0, '#151a2b');
    bg.addColorStop(1, '#05060a');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
  };

  // position : abscisse du reflet en largeurs d'écran (0 = bord gauche de l'écran de gauche, 3 = bord droit de celui de droite).
  const sweep = (screen, index, position) => {
    const { ctx, canvas } = screen;
    const W = canvas.width, H = canvas.height;
    const x = (position - index) * W;
    const band = ctx.createLinearGradient(x - 130, 0, x + 130, 0);
    band.addColorStop(0, 'rgba(123,145,196,0)');
    band.addColorStop(0.5, 'rgba(123,145,196,0.34)');
    band.addColorStop(1, 'rgba(123,145,196,0)');
    ctx.fillStyle = band;
    ctx.fillRect(0, 0, W, H);
  };

  const drawBrand = (t, cycle) => {
    const { ctx, canvas } = center;
    const W = canvas.width, H = canvas.height;
    const fadeOut = 1 - ramp(cycle, 0.88, 1);
    const lit = ramp(cycle, 0.28, 0.4) * fadeOut;
    if (logo.complete && logo.naturalWidth) {
      const lw = W * 0.5, lh = lw * logo.naturalHeight / logo.naturalWidth;
      ctx.globalAlpha = 0.25 + 0.75 * lit;
      ctx.drawImage(logo, (W - lw) / 2, H * 0.14, lw, lh);
      ctx.globalAlpha = 1;
    }
    const lines = [data.line1, data.line2].filter(Boolean).map(text => text.toUpperCase());
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '600 64px Fredoka, system-ui, sans-serif';
    lines.forEach((line, i) => {
      const on = ramp(cycle, 0.3 + i * 0.06, 0.42 + i * 0.06) * fadeOut;
      ctx.shadowColor = 'rgba(252,242,231,0.5)';
      ctx.shadowBlur = cycle < 0.7 ? 22 * on : 7 * on;
      ctx.globalAlpha = 0.12 + 0.88 * on;
      ctx.fillStyle = LOGO_COLOR;
      ctx.fillText(line, W / 2, H * 0.6 + i * 74);
    });
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  };

  const api = {
    Screen_L: left,
    Screen_C: center,
    Screen_R: right,
    draw(t) {
      const cycle = (t % CYCLE) / CYCLE;
      const position = -0.3 + ramp(cycle, 0, 0.75) * 3.6;
      [left, center, right].forEach((screen, index) => {
        background(screen);
        if (index === 1) drawBrand(t, cycle);
        sweep(screen, index, position);
        screen.texture.needsUpdate = true;
      });
    },
  };
  // Redessine dès que la police et le logo sont prêts.
  document.fonts?.ready.then(() => api.draw(0));
  logo.onload = () => api.draw(0);
  return api;
}
