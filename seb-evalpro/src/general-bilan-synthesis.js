'use strict';
// Génération locale : mêmes formulations contrôlées que les bilans de parcours,
// appliquées uniquement à la grille consolidée, sans concaténer les anciens textes.
const engine=require('./seb-ia-engine');
const VERSION='SEB-IA — Synthèse générale V1';
function generateGeneralSynthesis(person,general){
 const rows=(general?.institutionalRows||[]).filter(row=>row.kind==='row');
 if(!rows.length)throw new Error('Aucune ligne de bilan disponible pour générer la synthèse générale.');
 const known=rows.filter(row=>engine.META[row.key]);
 const evaluated=rows.filter(row=>['I','II','III'].includes(row.level));
 const snapshot={candidate:person||{},rows:known.map(row=>({key:row.key,level:row.level,comment:row.comment||'',detail:row.detail||''}))};
 const blocks=['Cette synthèse croise les résultats des différents parcours d’évaluation sur le plateau technique. Elle porte uniquement sur les compétences présentes dans le bilan général.'];
 if(known.length){
  const generated=engine.generate(snapshot);
  if(!generated.ok)throw new Error('La synthèse générale n’a pas passé le contrôle de rédaction : '+(generated.validation?.errors||[]).join(' ; '));
  // L'introduction de parcours unique est remplacée par l'introduction croisée.
  blocks.push(...generated.text.replace(/Au terme du parcours/g,'À partir des résultats consolidés').split(/\n\s*\n/).slice(1));
 }
 const transverse=rows.find(row=>row.key==='competences-transversales');
 if(transverse){
  const phrases={I:'Les compétences transversales sont mobilisées de manière autonome et adaptée aux situations évaluées.',
   II:'La mobilisation des compétences transversales reste partielle et demande encore des repères.',
   III:'La mobilisation des compétences transversales nécessite un accompagnement plus soutenu dans les situations évaluées.',
   NE:'Les compétences transversales n’ont pas pu être évaluées et restent hors interprétation.'};
  if(phrases[transverse.level])blocks.push(phrases[transverse.level]);
 }
 if(!evaluated.length)blocks.push('Les éléments renseignés ne permettent pas de conclure sur les acquis : les compétences non évaluées restent hors interprétation.');
 if(general.institutionalWarnings?.length)blocks.push('La consolidation reste partielle : certaines lignes ne disposent pas de points numériques exploitables.');
 const text=blocks.filter(Boolean).join('\n\n');
 return {text,version:VERSION,sourceDigest:general.sourceDigest};
}
module.exports={generateGeneralSynthesis,VERSION};
