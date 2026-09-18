// Site public : navigation, apparitions au scroll, faisceaux, vidéos au survol.

const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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

// Apparitions au scroll : l'état caché n'existe que si le script tourne.
if (!calm && 'IntersectionObserver' in window) {
  document.documentElement.classList.add('js');
  const targets = document.querySelectorAll('.sec-head, .setting, .step, .plate, .about > *, .contact-inner > *');
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
const realisations = document.getElementById('realisations');
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
