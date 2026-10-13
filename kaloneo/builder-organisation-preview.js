/*
 * Test Builder KALONÉO — aperçu direct des lignes Organisation.
 * Rendu uniquement visuel : aucune réponse, aucun barème et aucun fichier V1 modifiés.
 * Ce module reproduit les 8 lignes compactes du test candidat historique.
 */
(function(root){
  'use strict';
  function resolveRow(block,sourceDefinition){
    const questionId=String(block?.question?.id||'');
    if(sourceDefinition?.id!=='organisation_demenagement'||block?.type!=='question'||
       block.zone!=='right'||!/^organisation_[1-8]$/.test(questionId))return null;
    // V1 historique avec organisationList, ou V2 enregistrée par le Builder
    // dans builderContent : les deux formats restent pris en charge.
    const presentation=sourceDefinition?.presentation||{};
    if(Array.isArray(presentation.organisationList?.rows))
      return presentation.organisationList.rows.find(row=>String(row.questionId)===questionId)||null;
    if(Array.isArray(presentation.builderContent))
      return presentation.builderContent.find(item=>
        item?.type==='question'&&item.zone==='right'&&String(item.questionId)===questionId)||null;
    return null;
  }
  function isQuestion(block,sourceDefinition){
    return Boolean(resolveRow(block,sourceDefinition));
  }
  function renderQuestion(block,sourceDefinition){
    const original=resolveRow(block,sourceDefinition);
    if(!original)return null;
    const wrap=document.createElement('div');
    wrap.className='preview-organisation-row';
    const text=document.createElement('span');
    text.className='preview-organisation-text';
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
  root.KaloneoBuilderOrganisationPreview=Object.freeze({renderQuestion,isQuestion});
})(window);
