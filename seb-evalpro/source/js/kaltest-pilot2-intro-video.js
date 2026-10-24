(function () {
  'use strict';

  // R170 — lecture du VRAI MP4 fourni, plutôt que l'animation CSS de l'usine.
  // Aucune image Base64 ; lecture locale à la demande, une seule fois par session.
  const KEY = 'seb_kaltest_pilot2_intro_video_played_v1';
  const MAX_PLAYBACK_MS = 20000;
  let timer = null;

  function hasPlayed() {
    try { return sessionStorage.getItem(KEY) === '1'; } catch (_) { return false; }
  }

  function markPlayed() {
    try { sessionStorage.setItem(KEY, '1'); } catch (_) {}
    try { window.sebEvalPro?.save?.(); } catch (_) {}
  }

  function finish(scene) {
    if (!scene || scene.dataset.playState === 'finished') return;
    if (timer) clearTimeout(timer);
    timer = null;
    scene.classList.remove('seb-video-playing');
    scene.classList.add('seb-video-finished');
    scene.dataset.playState = 'finished';
    const video = scene.querySelector('video');
    if (video) video.pause();
  }

  function failPlayback(scene, message) {
    if (!scene) return;
    const status = document.getElementById('pilot2-intro-video-status');
    if (status) {
      status.hidden = false;
      status.textContent = message || 'Vidéo indisponible. Vous pouvez commencer le parcours.';
    }
    markPlayed();
    finish(scene);
  }

  function playOnce() {
    const page = document.getElementById('page-intro');
    const scene = document.getElementById('pilot2-intro-video');
    if (!page || !scene || !page.classList.contains('visible') ||
        scene.closest('.pilot2-intro-video-card')?.style.display === 'none') return false;
    if (scene.dataset.playState === 'playing' || scene.dataset.playState === 'finished') return false;
    if (hasPlayed()) {
      finish(scene);
      return false;
    }

    const video = document.getElementById('pilot2-intro-video-media');
    if (!video) {
      failPlayback(scene);
      return false;
    }
    const source = video.dataset.src;
    if (!source || !/^assets\/debut_de_parcours-lecture\.mp4$/.test(source)) {
      failPlayback(scene);
      return false;
    }

    scene.classList.remove('seb-video-finished');
    scene.classList.add('seb-video-playing');
    scene.dataset.playState = 'playing';
    video.muted = true; // La vidéo fournie est muette : autoplay fiable dans Electron.
    video.playsInline = true;
    video.src = source;
    video.load();
    timer = setTimeout(() => failPlayback(scene, 'Lecture interrompue. Vous pouvez commencer le parcours.'), MAX_PLAYBACK_MS);
    const started = video.play();
    if (started && typeof started.then === 'function') {
      started.then(() => markPlayed()).catch(() => {
        // Codec ou autoplay bloqué : aucun écran blanc et aucune navigation bloquée.
        failPlayback(scene);
      });
    } else {
      markPlayed();
    }
    return true;
  }

  function install() {
    const page = document.getElementById('page-intro');
    const scene = document.getElementById('pilot2-intro-video');
    const video = document.getElementById('pilot2-intro-video-media');
    if (!page || !scene || !video) return;
    video.addEventListener('ended', () => { markPlayed(); finish(scene); });
    video.addEventListener('error', () => {
      if (scene.dataset.playState === 'playing') failPlayback(scene);
    });
    const observer = new MutationObserver(() => {
      if (page.classList.contains('visible')) {
        setTimeout(playOnce, 0);
      } else if (scene.dataset.playState === 'playing') {
        markPlayed();
        finish(scene);
      }
    });
    observer.observe(page, { attributes:true, attributeFilter:['class'] });
    if (page.classList.contains('visible')) setTimeout(playOnce, 0);
  }

  window.sebPilot2IntroVideo = Object.freeze({
    playOnce,
    finish() { markPlayed(); finish(document.getElementById('pilot2-intro-video')); },
    get played() { return hasPlayed(); }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once:true });
  } else {
    install();
  }
})();
