'use strict';
// Arrondi d'affichage de TOUS les pourcentages du bilan général : écran,
// bilan réouvert, Word. Aucune modification des calculs, barèmes ou niveaux.
const assert=require('node:assert/strict');
const {OFFICIAL,aggregateInstitutionalRows,wordRows,percentLevel}=require('../src/institutional-bilan-grid');
const automatic=OFFICIAL.filter(line=>line.kind==='row'&&line.mode!=='manual');
const manual=OFFICIAL.filter(line=>line.kind==='row'&&line.mode==='manual');
assert.equal(automatic.length+manual.length,18);
function makeEvaluation(key,points,possible,level='I'){
 return {candidateId:'ROUND-'+key,date:'2026-10-27',session:{},
  archive:{document:{rows:[{kind:'item',key,level,points,possible,
   detail:'Ancienne valeur de 87,5 % à ne pas reprendre lorsque des points existent.'}]}}};
}
for(const line of automatic){
 for(const [points,possible,expected,precise,level] of [
  [2,33,'6 %',6.06,'III'],
  [7,8,'88 %',87.5,'I'],
  [1,2,'50 %',50,'II'],
  [3,4,'75 %',75,'I'],
  [0,8,'0 %',0,'III'],
  [8,8,'100 %',100,'I']
 ]){
  const general=aggregateInstitutionalRows([makeEvaluation(line.key,points,possible)]);
  const row=general.rows.find(x=>x.key===line.key);
  assert(row,'Ligne officielle absente du bilan général : '+line.key);
  assert.equal(row.points,points,line.key+' : les points obtenus doivent rester exacts.');
  assert.equal(row.possible,possible,line.key+' : le maximum doit rester exact.');
  assert.equal(row.percent,precise,line.key+' : le pourcentage numérique précis doit rester intact.');
  assert.equal(row.display,expected,line.key+' : affichage sans décimale.');
  assert.equal(row.detail,expected+' de réponses correctes.',line.key+' : détail écran.');
  assert.equal(row.level,level,line.key+' : niveau calculé à partir du taux précis.');
  const word=wordRows({institutionalRows:general.rows}).find(x=>x.key===line.key);
  assert.equal(word.detail,row.detail,line.key+' : le Word doit reprendre le même arrondi.');
  assert(!/\d+[,.]\d+\s*%/.test(word.detail),line.key+' : aucune décimale dans le Word.');
 }
 // Plusieurs bilans : addition des points avant l'arrondi, pas de moyenne d'entiers.
 const combined=aggregateInstitutionalRows([
  makeEvaluation(line.key,2,33),{...makeEvaluation(line.key,7,8),candidateId:'SECOND',date:'2026-10-28'}
 ]).rows.find(x=>x.key===line.key);
 assert.equal(combined.points,9);assert.equal(combined.possible,41);
 assert.equal(combined.display,'22 %');
 assert.equal(combined.percent,21.95);
}
for(const line of manual){
 const general=aggregateInstitutionalRows([{
  candidateId:'MANUAL',session:{},archive:{document:{rows:[{
   kind:'item',key:line.key,level:'II',points:2,possible:33,
   comment:'Appréciation conservée.',detail:'Observation libre conservée.'
  }]}}
 }]);
 const row=general.rows.find(x=>x.key===line.key);
 assert.equal(row.level,'II',line.key+' : le niveau manuel doit être inchangé.');
 assert.equal(row.percent,null,line.key+' : ne pas convertir un niveau manuel en pourcentage.');
 assert.equal(row.detail,'Observation libre conservée.',line.key+' : détail manuel préservé.');
}
assert.equal(percentLevel(69.6),'II','Le seuil doit continuer à utiliser la vraie valeur et non son affichage.');
assert.equal(percentLevel(70),'I');
console.log('BILAN_GENERAL_ROUNDING=OK — 13 lignes automatiques testées avec 6 taux, 5 manuelles intactes, addition et Word: 6,06 -> 6 % ; 87,5 -> 88 %');
