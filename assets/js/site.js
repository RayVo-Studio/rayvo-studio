// Site public : navigation, apparitions au scroll, faisceaux, vidéos au survol.

const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Langue : le choix du visiteur est retenu (anglais par défaut). Quelqu'un qui a choisi le français retrouve /fr/ en revenant à l'accueil.
document.querySelectorAll('[data-lang-link]').forEach(link => {
  link.addEventListener('click', () => {
    try { localStorage.setItem('rayvo-lang', link.dataset.langLink); } catch (error) { /* stockage indisponible : sans importance */ }
  });
});
try {
  const french = document.querySelector('[data-lang-link="fr"]');
  if (localStorage.getItem('rayvo-lang') === 'fr' && french && document.documentElement.lang === 'en') {
    location.replace(french.href + location.hash);
  }
} catch (error) { /* stockage indisponible : on reste sur la page demandée */ }

// Anciennes adresses de sections (avant leur passage en anglais) : les liens déjà partagés continuent de fonctionner.
const legacyAnchors = { reglages: 'services', specialites: 'audiences', realisations: 'work', apropos: 'about', questions: 'faq', contenu: 'main' };
const legacyTarget = legacyAnchors[location.hash.slice(1)];
if (legacyTarget) {
  history.replaceState(null, '', '#' + legacyTarget);
  const section = document.getElementById(legacyTarget);
  if (section) requestAnimationFrame(() => section.scrollIntoView());
}

// Défilement doux vers les ancres.
document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener('click', event => {
    const target = document.getElementById(link.getAttribute('href').slice(1));
    if (target) {
      event.preventDefault();
      target.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' });
      history.replaceState(null, '', '#' + target.id);
    }
  });
});

// La barre de navigation se remplit dès que la page défile.
const nav = document.querySelector('.site-nav');
if (nav) {
  const syncNav = () => nav.classList.toggle('is-stuck', window.scrollY > 24);
  window.addEventListener('scroll', syncNav, { passive: true });
  syncNav();
}

// Menu déroulant (petit écran) : ouvre et ferme la liste des sections, au clavier comme au doigt.
const menuToggle = document.querySelector('.menu-toggle');
const menuPanel = document.getElementById('site-menu');
if (nav && menuToggle && menuPanel) {
  const setMenu = open => {
    menuPanel.hidden = !open;
    menuToggle.setAttribute('aria-expanded', String(open));
    nav.classList.toggle('menu-open', open);
  };
  menuToggle.addEventListener('click', () => setMenu(menuPanel.hidden));
  menuPanel.addEventListener('click', event => { if (event.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !menuPanel.hidden) { setMenu(false); menuToggle.focus(); }
  });
  document.addEventListener('click', event => { if (!menuPanel.hidden && !nav.contains(event.target)) setMenu(false); });
  window.matchMedia('(min-width:481px)').addEventListener('change', event => { if (event.matches) setMenu(false); });
}

// Apparitions au scroll : l'état caché n'existe que si le script tourne.
if (!calm && 'IntersectionObserver' in window) {
  document.documentElement.classList.add('js');
  const targets = document.querySelectorAll('.sec-head, .setting, .audience, .plate, .about > *, .faq > *, .contact-inner > *');
  const observer = new IntersectionObserver(entries => {
    entries.filter(entry => entry.isIntersecting).forEach((entry, i) => {
      entry.target.style.setProperty('--dl', Math.min(i, 4) * 90 + 'ms');
      entry.target.classList.add('is-in');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  targets.forEach(el => {
    el.setAttribute('data-reveal', '');
    observer.observe(el);
  });
}

// Réalisations : chaque photo donne sa couleur dominante, qui éclaire le cadre et l'ambiance de la section au survol.
const realisations = document.getElementById('work');
document.querySelectorAll('.plate').forEach(plate => {
  const media = plate.querySelector('.frame-media');
  const video = plate.querySelector('video[poster]');
  const source = media || (video && Object.assign(new Image(), { src: video.getAttribute('poster') }));
  if (!source) return;

  const paint = () => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 12;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(source, 0, 0, 12, 12);
      const px = ctx.getImageData(0, 0, 12, 12).data;
      let r = 0, g = 0, b = 0, total = 0;
      for (let i = 0; i < px.length; i += 4) {
        const max = Math.max(px[i], px[i + 1], px[i + 2]);
        const min = Math.min(px[i], px[i + 1], px[i + 2]);
        const weight = ((max - min) / 255 + 0.1) * (max / 255 + 0.05);
        r += px[i] * weight; g += px[i + 1] * weight; b += px[i + 2] * weight; total += weight;
      }
      if (!total) return;
      const lift = 190 / Math.max(r / total, g / total, b / total, 1);
      const rgb = [r, g, b].map(v => Math.min(255, Math.round(v / total * Math.min(lift, 2.4))));
      plate.style.setProperty('--glow', `rgb(${rgb.join(',')})`);
    } catch (error) { /* image non lisible : on garde la lueur bleue par défaut */ }
  };
  if (source.complete && source.naturalWidth) paint(); else source.addEventListener('load', paint, { once: true });

  if (realisations && !calm) {
    const on = () => {
      realisations.style.setProperty('--ambient', getComputedStyle(plate).getPropertyValue('--glow') || '#7b91c4');
      realisations.classList.add('has-ambient');
    };
    const off = () => realisations.classList.remove('has-ambient');
    plate.addEventListener('mouseenter', on);
    plate.addEventListener('mouseleave', off);
    plate.addEventListener('focusin', on);
    plate.addEventListener('focusout', off);
  }
});

// Lecture des vidéos : au survol sur ordinateur, dès qu'elles sont bien visibles sur écran tactile.
const touchOnly = window.matchMedia('(hover: none)').matches;
document.querySelectorAll('.video-frame').forEach(frame => {
  const video = frame.querySelector('video');
  if (!video) return;

  if (touchOnly) {
    if (calm || !('IntersectionObserver' in window)) return;
    new IntersectionObserver(([entry]) => {
      frame.classList.toggle('is-playing', entry.isIntersecting);
      if (entry.isIntersecting) video.play().catch(() => {});
      else video.pause();
    }, { threshold: 0.6 }).observe(frame);
    return;
  }

  frame.addEventListener('mouseenter', () => {
    frame.classList.add('is-playing');
    video.currentTime = 0;
    video.play().catch(() => {});
  });

  frame.addEventListener('mouseleave', () => {
    frame.classList.remove('is-playing');
    video.pause();
  });
});

// Console 3D : chargée après le reste de la page (moteur 3D et modèle pèsent environ 3 Mo),
// pour ne pas retarder l'affichage ni le premier contenu que voit Google.
const scene = document.querySelector('.scene3d[data-module]');
if (scene) {
  const moduleUrl = new URL(scene.dataset.module, document.baseURI).href; // un import dynamique exige une adresse complète
  const loadScene = () => import(moduleUrl).catch(() => {});
  const whenIdle = () => ('requestIdleCallback' in window ? requestIdleCallback(loadScene, { timeout: 2500 }) : setTimeout(loadScene, 300));
  if (document.readyState === 'complete') whenIdle(); else window.addEventListener('load', whenIdle, { once: true });
}

// Process et cibles : les scènes 3D (étapes, festivals, clubs) se chargent quand leur section approche de l'écran.
const process = document.querySelector('.process[data-module]');
if (process && 'IntersectionObserver' in window) {
  const moduleUrl = new URL(process.dataset.module, document.baseURI).href;
  const near = new IntersectionObserver(entries => {
    if (!entries.some(entry => entry.isIntersecting)) return;
    near.disconnect();
    import(moduleUrl).catch(() => {});
  }, { rootMargin: '600px 0px' });
  near.observe(process);
  const audiences = document.querySelector('.audiences');
  if (audiences) near.observe(audiences);
}

// Illustrations animées (SMIL) : figées pour ceux qui ont réduit les animations.
if (calm) document.querySelectorAll('svg.fx').forEach(svg => svg.pauseAnimations?.());

// Timeline du process : une ligne de lumière suit le défilement et allume chaque étape.
const timeline = document.querySelector('.process');
if (timeline && !calm && 'IntersectionObserver' in window) {
  const steps = [...timeline.querySelectorAll('.step')];
  const head = document.createElement('span');
  head.className = 'playhead';
  head.setAttribute('aria-hidden', 'true');
  timeline.prepend(head);
  timeline.classList.add('has-timeline');
  const wide = window.matchMedia('(min-width:901px)');

  // Petits écrans : chaque étape s'allume en arrivant.
  const lighter = new IntersectionObserver(entries => entries.forEach(entry => {
    if (entry.isIntersecting && !wide.matches) { entry.target.classList.add('is-lit'); lighter.unobserve(entry.target); }
  }), { rootMargin: '0px 0px -22% 0px' });
  steps.forEach(step => lighter.observe(step));

  // Grands écrans : la position dans la fenêtre pilote la ligne (avec un peu d'inertie).
  let target = 0, shown = 0, raf = 0;
  const measure = () => {
    if (!wide.matches) return;
    const box = timeline.getBoundingClientRect();
    target = Math.min(1, Math.max(0, (window.innerHeight * 0.82 - box.top) / (window.innerHeight * 0.5)));
    if (!raf) raf = requestAnimationFrame(step);
  };
  const step = () => {
    raf = 0;
    shown += (target - shown) * 0.14;
    if (Math.abs(target - shown) < 0.002) shown = target;
    timeline.style.setProperty('--p', shown.toFixed(4));
    steps.forEach((el, i) => el.classList.toggle('is-lit', shown >= i / steps.length + 0.02));
    if (shown !== target) raf = requestAnimationFrame(step);
  };
  window.addEventListener('scroll', measure, { passive: true });
  window.addEventListener('resize', measure);
  measure();
}
