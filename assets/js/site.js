// Site public : défilement doux vers les ancres, lecture des vidéos au survol.

document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener('click', event => {
    const target = document.getElementById(link.getAttribute('href').slice(1));
    if (target) {
      event.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

document.querySelectorAll('.video-frame').forEach(frame => {
  const video = frame.querySelector('video');
  if (!video) return;

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
