'use strict';
// Nombres d'erreurs dans les grilles institutionnelles (individuel, archive, Word).
// En français : 0 erreur, 1 erreur, 2 erreurs. Ne touche pas aux textes sans
// quantité chiffrée, aux pourcentages, ni aux niveaux I / II / III.
function normalizeErrorCounts(value){
 return String(value==null?'':value).replace(/\b(\d+(?:[,.]\d+)?)\s+erreurs?\b/gi,(_whole,raw)=>{
  const n=Number(raw.replace(',','.'));
  return raw+' erreur'+(Number.isFinite(n)&&n>1?'s':'');
 });
}
module.exports={normalizeErrorCounts};
