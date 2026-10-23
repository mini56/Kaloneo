'use strict';
const assert=require('node:assert/strict');
const {aggregateGeneralBilan,wordRows}=require('../src/general-bilan-aggregation');
const build=(id,parcours,tests,extra={})=>({
 candidateId:id,parcours,date:extra.date||'2026-10-22',
 session:{
  seb_kaloneo_results_manifest:JSON.stringify({tests:Object.entries(tests).map(([key,t])=>({id:key,title:t.title||key,category:t.category}))}),
  seb_kaltest_pilot2_state_v1:JSON.stringify({tests:Object.fromEntries(Object.entries(tests).map(([key,t])=>[key,{
    status:t.skipped?'PENDING':'COMPLETED',
    ...(t.skipped?{}:{result:t.result||{score:t.score,scoreMax:t.max}})
  }]))})
 },archive:{document:{summary:extra.summary||''}}
});
const a=build('e1','Logistique',{
 calculs:{title:'Calculs',category:'mathematiques',score:6,max:10},
 conversions:{title:'Conversions',category:'mathematiques',score:6,max:10},
 planning:{title:'Planning',category:'organisation',score:2,max:5}
},{summary:'Autonomie partielle'});
const c=build('e2','Restauration',{
 calculs:{title:'Calculs',category:'mathematiques',score:8,max:10},
 restaurant:{title:'Restaurant',category:'organisation',score:4,max:5},
 nonfait:{title:'Non fait',category:'mathematiques',skipped:true}
});
const d=build('e3','Entretien',{
 calculs:{title:'Calculs',category:'mathematiques',score:7,max:10},
 rangement:{title:'Rangement',category:'organisation',score:7,max:10}
});
const result=aggregateGeneralBilan([a,c,d]);
assert.equal(result.evaluationCount,3);
assert.equal(result.testCount,5);
const math=result.categories.find(c=>c.name==='Mathématiques');
const calculs=math.tests.find(t=>t.id==='calculs');
assert.equal(calculs.points,21);
assert.equal(calculs.possible,30);
assert.equal(calculs.percent,70);
assert.equal(calculs.scoredPassages,3);
assert.equal(calculs.level,'I');
assert.equal(math.testCount,2);
assert.equal(math.percent,65);
assert.equal(math.level,'II');
assert(!math.tests.some(t=>t.id==='nonfait'));
assert.equal(result.notes.length,1);
const org=result.categories.find(c=>c.name==='Organisation');
assert.equal(org.testCount,3);
assert.equal(org.tests.find(t=>t.id==='rangement').scoredPassages,1);
assert.equal(wordRows(result).filter(t=>t.type==='row').length,18,'Le Word ne peut plus ajouter de lignes TOTAL ou de catégorie.');
assert(!wordRows(result).some(t=>/TOTAL|passage|parcours/i.test(t.module||'')));
const weighted=aggregateGeneralBilan([
 build('one','A',{x:{score:1,max:2,category:'math'}}),
 build('two','B',{x:{score:18,max:20,category:'math'}})
]);
assert.equal(weighted.categories[0].tests[0].percent,86.36,
 'Points possibles pris en compte; pas moyenne arithmetique des pourcentages de passages');
const manual=aggregateGeneralBilan([build('man','D',{x:{category:'technique',result:{level:'II'}}})]);
assert.equal(manual.categories[0].tests[0].level,'II');
assert.equal(manual.categories[0].level,'NE','Niveaux manuels jamais convertis artificiellement en points');
const manualAgain=aggregateGeneralBilan([
 build('man1','A',{x:{category:'technique',result:{level:'I'}}}),
 build('man2','B',{x:{category:'technique',result:{level:'III'}}})
]);
assert.equal(manualAgain.categories[0].tests[0].level,'NE','Des niveaux disparates ne sont pas des scores numeriques');
const baseManual=build('manual1','A',{calculs:{score:8,max:10}});
baseManual.archive.document.rows=[
 {kind:'section',sectionText:'Compétences techniques'},
 {kind:'item',key:'fabrication-plan',moduleText:'Lecture de plan',level:'I',comment:'Autonome'}
];
const followManual=build('manual2','B',{calculs:{score:6,max:10}});
followManual.archive.document.rows=[
 {kind:'section',sectionText:'Compétences techniques'},
 {kind:'item',key:'fabrication-plan',moduleText:'Lecture de plan',level:'II',comment:'Consignes supplémentaires'}
];
const consolidated=aggregateGeneralBilan([baseManual,followManual]);
const manualCategory=consolidated.categories.find(c=>c.name==='Compétences techniques');
assert(manualCategory);
const criterion=manualCategory.tests.find(t=>t.id==='MANUAL:fabrication-plan');
assert(criterion&&criterion.level==='NE'&&criterion.passages===2,
 'Appréciations manuelles divergentes = réexamen et pas calcul artificiel.');
assert(criterion.sources[0].comment==='Autonome');
assert.equal(manualCategory.percent,null,'Critères manuels ne sont jamais des points possibles.');

const never=aggregateGeneralBilan([build('x','Sans note',{n:{skipped:true}})]);
assert.equal(never.testCount,0,'Tests non faits non penalises');
assert.throws(()=>aggregateGeneralBilan([a,a]),/double/);
console.log('KALONEO_GENERAL_BILAN_AGGREGATION=OK — 3 parcours, 5 tests, score pondere, categorie unique, NE, tests non passes');
