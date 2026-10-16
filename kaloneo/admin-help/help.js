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
  search();
}());
