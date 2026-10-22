(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.KaloneoMaskMedia = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';
  const FREEZE_MS = 3000;
  const FADE_MS = 1000;

  // R147: la même séquence pilote l'éditeur, l'aperçu Electron et le masquage candidat.
  function createPlayer({stage, video, image, text, freezeMs = FREEZE_MS, fadeMs = FADE_MS}) {
    if (!stage || !video || !image || !text) throw new Error('Éléments de masquage incomplets.');
    let generation = 0;
    let timer = null;
    let signature = '';
    let active = false;

    function clear() {
      generation++;
      if (timer !== null) { clearTimeout(timer); timer = null; }
      try { video.pause(); } catch (_) {}
      video.onended = null;
      video.onerror = null;
      video.onloadeddata = null;
      image.onerror = null;
      video.removeAttribute('src');
      try { video.load(); } catch (_) {}
      image.removeAttribute('src');
      image.style.transition = 'none';
      image.style.opacity = '0';
      video.hidden = true;
      image.hidden = true;
      stage.hidden = true;
      signature = '';
      active = false;
    }

    function show(definition) {
      const content = definition?.content || {};
      const videoSrc = String(content.video || '');
      const imageSrc = String(content.image || '');
      const textValue = String(content.text || '');
      const nextSignature = [videoSrc, imageSrc, textValue].join('\u001f');
      // Le rafraîchissement périodique de la barre candidat ne relance jamais la vidéo.
      if (active && signature === nextSignature) return;
      clear();
      active = true;
      signature = nextSignature;
      const own = generation;
      text.textContent = textValue;
      text.hidden = !textValue.trim();
      stage.hidden = !imageSrc && !videoSrc;

      let imageReady = false;
      let finished = false;
      let hasEnded = false;
      const revealImage = () => {
        if (generation !== own || finished) return;
        finished = true;
        if (!imageSrc) return;
        image.hidden = false;
        image.style.transition = 'opacity ' + fadeMs + 'ms ease-in-out';
        // La vidéo reste figée sous l'image pendant le fondu.
        requestAnimationFrame(() => {
          if (generation === own) image.style.opacity = '1';
        });
        timer = setTimeout(() => {
          if (generation === own) video.hidden = true;
          timer = null;
        }, fadeMs + 80);
      };

      if (imageSrc) {
        image.alt = String(definition?.name || 'Écran de masquage');
        image.src = imageSrc;
        image.hidden = false;
        image.style.opacity = videoSrc ? '0' : '1';
        imageReady = image.complete && image.naturalWidth > 0;
        image.onload = () => { imageReady = true; };
      }
      if (!videoSrc) return;
      video.muted = true; // Autoplay fiable même après redémarrage de l'application.
      video.playsInline = true;
      video.loop = false;
      video.controls = false;
      video.preload = 'auto';
      video.hidden = false;
      video.src = videoSrc;
      const afterLastFrame = () => {
        if (generation !== own || hasEnded) return;
        hasEnded = true;
        try { video.pause(); } catch (_) {}
        // "ended" conserve la dernière frame visible de la vidéo.
        timer = setTimeout(() => {
          timer = null;
          if (generation === own) revealImage();
        }, freezeMs);
      };
      video.onended = afterLastFrame;
      video.onerror = () => {
        if (generation !== own || hasEnded) return;
        if (timer !== null) clearTimeout(timer);
        timer = null;
        revealImage(); // Échec de lecture : garder un masquage sûr.
      };
      image.onerror = () => {
        if (generation !== own) return;
        imageReady = false;
      };
      try {
        const p = video.play();
        if (p && typeof p.catch === 'function') p.catch(() => {
          // Un événement ended peut arriver pendant que play() se résout.
          // Ne jamais escamoter les trois secondes à cause de cet arrêt.
          if (generation === own && !hasEnded) revealImage();
        });
      } catch (_) { if (!hasEnded) revealImage(); }
    }
    return {show, stop:clear, get active() { return active; }, get freezeMs() { return freezeMs; }, get fadeMs() { return fadeMs; }};
  }

  return Object.freeze({createPlayer,FREEZE_MS,FADE_MS});
});
