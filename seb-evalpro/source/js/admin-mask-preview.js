(() => {
  'use strict';

  const $=id=>document.getElementById(id);

  async function ready() {
    const result=await window.sebEvalPro?.kaloneoGetMaskPreview?.();
    if(!result||result.ok!==true) {
      document.body.textContent=result?.error||'Aperçu indisponible.';
      return;
    }

    const value=result.definition||{};
    const player=window.KaloneoMaskMedia.createPlayer({
      stage:$('mask-preview-media-stage'),video:$('mask-preview-video'),
      image:$('mask-preview-image'),text:$('mask-preview-text')
    });
    player.show(value);

    $('mask-preview-close').addEventListener('click',async()=>{
      player.stop();
      await window.sebEvalPro?.kaloneoCloseMaskPreview?.();
    });
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});
  else ready();
})();
