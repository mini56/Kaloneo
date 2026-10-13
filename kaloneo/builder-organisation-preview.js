/*
 * Test Builder KALONÉO — aperçu direct des lignes Organisation.
 * Rendu uniquement visuel : aucune réponse, aucun barème et aucun fichier V1 modifiés.
 * Ce module reproduit les 8 lignes compactes du test candidat historique.
 */
(function(root){
  'use strict';
  function renderQuestion(block,sourceDefinition){
    const rows=sourceDefinition?.presentation?.organisationList?.rows;
    const questionId=String(block?.question?.id||'');
    if(block?.type!=='question'||!Array.isArray(rows)||!rows.some(row=>String(row.questionId)===questionId))
      return null;

    const wrap=document.createElement('div');
    wrap.className='preview-organisation-row';
    const text=document.createElement('span');
    text.className='preview-organisation-text';
    const original=rows.find(row=>String(row.questionId)===questionId);
    text.textContent=block.question?.prompt||original?.text||'';
    const answer=document.createElement('input');
    answer.className='preview-organisation-answer';
    answer.type='text';
    answer.inputMode='numeric';
    answer.maxLength=1;
    answer.readOnly=true;
    answer.tabIndex=-1;
    answer.setAttribute('aria-label','Numéro de l’étape');
    wrap.append(text,answer);
    return wrap;
  }
  root.KaloneoBuilderOrganisationPreview=Object.freeze({renderQuestion});
})(window);
