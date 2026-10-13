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
    const questions=new Map((sourceDefinition?.questions||[]).map(q=>[String(q.id),q]));
    return root.KaloneoSharedPresentation.renderQuestionTable({
      doc:document,definition,wrapperClassName:'preview-grammar-card',
      tableClassName:'preview-grammar-table',titleFallback:'Tableau',
      questionById:id=>questions.get(String(id)),
      renderCells:({doc,question,headers})=>{
        if(!question)return [];
        const rawPrompt=String(question.prompt||'');
        const prompt=normalizedSearch(rawPrompt);
        const source=rawPrompt.match(/«\s*([^»]+?)\s*»/)?.[1]?.trim()||'';
        const targetLeft=headers.length>1&&prompt.includes(normalizedSearch(headers[0]));
        const left=doc.createElement('td');
        const right=doc.createElement('td');
        const answer=doc.createElement('input');
        answer.type='text';answer.readOnly=true;answer.tabIndex=-1;
        answer.setAttribute('aria-label','Réponse à compléter');
        const fixed=targetLeft?right:left;
        fixed.textContent=source;
        fixed.className='preview-grammar-source';
        (targetLeft?left:right).appendChild(answer);
        return [left,right];
      }
    });
  }


  root.KaloneoBuilderLegacyTablePreview=Object.freeze({render});
})(window);
