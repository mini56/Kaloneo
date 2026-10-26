'use strict';
(function(){
  const input=document.getElementById('help-search');
  const cards=Array.from(document.querySelectorAll('article'));
  const status=document.getElementById('results-status');
  const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  function search(){
    const query=normalize(input.value).trim();
    let visible=0;
    for(const card of cards){
      card.hidden=Boolean(query) && !normalize(card.textContent+' '+card.dataset.keywords).includes(query);
      if(!card.hidden)visible++;
    }
    status.textContent=visible+' rubrique'+(visible>1?'s':'')+' disponible'+(visible>1?'s':'')+'.';
  }
  input.addEventListener('input',search);
  document.getElementById('help-print').addEventListener('click',()=>window.print());
  const zoom=document.getElementById('help-image-dialog');
  const large=document.getElementById('help-image-large');
  document.getElementById('close-image-dialog').addEventListener('click',()=>zoom.close());
  document.querySelectorAll('figure.admin-photo img').forEach(img=>{
    img.tabIndex=0;img.setAttribute('role','button');
    img.setAttribute('aria-label',img.alt+' — agrandir');
    const open=()=>{
      if(window.parent!==window && new URLSearchParams(location.search).has('settings')){
        window.parent.postMessage({type:'kaloneo-help-photo-open',
          src:img.getAttribute('src'),alt:img.alt},'*');
        return;
      }
      large.src=img.currentSrc||img.src;
      large.alt=img.alt;
      zoom.showModal();
    };
    img.addEventListener('click',open);
    img.addEventListener('keydown',ev=>{if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();open();}});
  });
  search();
}());
