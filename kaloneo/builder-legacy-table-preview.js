/*
 * Aperçu direct KALONÉO — tableaux historiques (ex. Genre et nombre).
 *
 * Module autonome : seulement le DOM et les données reçues en paramètres.
 * Aucune opération de stockage, de navigation ou de modification du KALTEST.
 * Le renderer candidat reste dans le moteur KALTEST, sans modification.
 */
(function(root){
  'use strict';

  function normalizedSearch(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  }

  function render(block,sourceDefinition) {
    const definition=block.tableDefinition||{};
    const wrap=document.createElement('div');
    wrap.className='preview-grammar-card';
    const title=document.createElement('h3');
    title.textContent=definition.title||'Tableau';
    wrap.appendChild(title);
    const table=document.createElement('table');
    table.className='preview-grammar-table';
    const headers=Array.isArray(definition.headers)?definition.headers:[];
    if(headers.length){
      const thead=document.createElement('thead');
      const tr=document.createElement('tr');
      headers.forEach(label=>{
        const th=document.createElement('th');
        th.textContent=String(label||'');
        tr.appendChild(th);
      });
      thead.appendChild(tr);
      table.appendChild(thead);
    }
    const questions=new Map((sourceDefinition?.questions||[]).map(q=>[String(q.id),q]));
    const tbody=document.createElement('tbody');
    for(const id of definition.questionIds||[]) {
      const q=questions.get(String(id));
      if(!q)continue;
      const rawPrompt=String(q.prompt||'');
      const prompt=normalizedSearch(rawPrompt);
      const source=rawPrompt.match(/«\s*([^»]+?)\s*»/)?.[1]?.trim()||'';
      const targetLeft=headers.length>1&&prompt.includes(normalizedSearch(headers[0]));
      const tr=document.createElement('tr');
      const left=document.createElement('td');
      const right=document.createElement('td');
      const answer=document.createElement('input');
      answer.type='text';
      answer.readOnly=true;answer.tabIndex=-1;
      answer.setAttribute('aria-label','Réponse à compléter');
      const fixed=targetLeft?right:left;
      fixed.textContent=source;
      fixed.className='preview-grammar-source';
      (targetLeft?left:right).appendChild(answer);
      tr.append(left,right);
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    wrap.appendChild(table);
    return wrap;
  }


  root.KaloneoBuilderLegacyTablePreview=Object.freeze({render});
})(window);
