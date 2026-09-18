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

// Les faisceaux s'arrêtent quand l'accroche n'est plus visible.
const hero = document.querySelector('.hero');
if (hero && 'IntersectionObserver' in window) {
  new IntersectionObserver(([entry]) => {
    hero.classList.toggle('is-offscreen', !entry.isIntersecting);
  }).observe(hero);
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
