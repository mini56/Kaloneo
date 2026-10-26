'use strict';
// Audit de toutes les V1 et vérification bout en bout du contrat institutionnel.
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const route=require('../source/js/kaloneo-bilan-routing');
const {projectDocument}=require('../src/bilan-parcours');
const {OFFICIAL}=require('../src/institutional-bilan-grid');
const {aggregateGeneralBilan,wordRows}=require('../src/general-bilan-aggregation');
const {createKaloneoLibrary}=require('../src/kaloneo-library-main');
const repoRoot=path.resolve(__dirname,'..','..');
const seedRoot=path.join(repoRoot,'seb-evalpro/source/kaltest/tests');
const rowKeys=new Set(OFFICIAL.filter(row=>row.kind==='row').map(row=>row.key));
assert.equal(rowKeys.size,18,'La grille institutionnelle doit contenir 18 lignes.');
const definitions=[];
for(const folder of fs.readdirSync(seedRoot,{withFileTypes:true}).filter(d=>d.isDirectory())){
 const file=path.join(seedRoot,folder.name,'1.0.0','test.json');
 if(fs.existsSync(file))definitions.push(JSON.parse(fs.readFileSync(file,'utf8')));
}
const {loadOfficialOverrides}=require('./kaloneo-testsv1');
const overrides=loadOfficialOverrides(repoRoot,seedRoot).overrides;
for(const [id,override] of overrides){
 const index=definitions.findIndex(test=>test.id===id);
 if(index>=0)definitions[index]=override.definition;
 else definitions.push(override.definition);
}
const seen=new Set();
const skipped=[];
for(const test of definitions){
 assert(!seen.has(test.id),'ID V1 dupliqué : '+test.id);
 seen.add(test.id);
 const mapped=route.selectedRows([{id:test.id,version:test.version,category:test.category,adminModified:false,bilanContributions:test.bilanContributions}]);
 const isNonEvaluation=['introduction','fin'].includes(test.pageRole) ||
  ['introduction','fin','transition','systeme','autoevaluation'].includes(test.category);
 if(isNonEvaluation){
  assert.equal(mapped.size,0,'Une page hors notation ne doit pas inventer une ligne : '+test.id);
  skipped.push(test.id);
  continue;
 }
 assert(mapped.size>0,'TEST SANS LIGNE DU BILAN : '+test.id);
 for(const key of mapped)assert(rowKeys.has(key),'RUBRIQUE HORS GRILLE : '+test.id+' / '+key);
 const links=(test.bilanContributions||[]).filter(link=>route.rowFor(link.lineId));
 for(const link of links)
  assert(route.compatible(test.category,link.lineId),'LIAISON INCOMPATIBLE : '+test.id+' / '+link.lineId);
}
// Le bug réel : la catégorie issue du bilan est normalisée avec des espaces.
const transversal='bilan.savoirs_fondamentaux.competences_transversales.mobiliser_competences';
const gestures=definitions.find(test=>test.id==='gestes_postures');
assert(gestures&&gestures.bilanContributions?.some(link=>link.lineId===transversal));
const gestureMeta={...gestures,category:'competences transversales',adminModified:false};
const gridA=definitions.find(test=>test.id==='grille_operations');
const gridB=definitions.find(test=>test.id==='carre_magique_15');
assert(gridA&&gridB,'Deux grilles officielles requises.');
const tests=[gestureMeta,{...gridA,adminModified:false},{...gridB,adminModified:false}];
const states={
 gestes_postures:{status:'COMPLETED',result:{score:2,scoreMax:3,percentage:200/3}},
 grille_operations:{status:'COMPLETED',result:{score:5,scoreMax:9,percentage:500/9}},
 carre_magique_15:{status:'COMPLETED',result:{score:9,scoreMax:9,percentage:100}}
};
const routed=route.collect(tests,id=>states[id]);
assert.deepEqual(routed.entries.get('competences-transversales')?.map(x=>x.pair),[{score:2,max:3}],
 'Gestes et postures complété ne doit plus être NE.');
assert.deepEqual(routed.entries.get('math-problemes')?.map(x=>x.pair),[{score:5,max:9},{score:9,max:9}],
 'Les deux nouvelles grilles V1 doivent compter.');
assert.equal(routed.warnings.length,0,'Aucune liaison ni note ne doit être perdue.');
const oldMath=definitions.find(test=>test.id==='fractions_preparation_lots');
assert.equal(route.collect([{...oldMath,adminModified:false}],()=>({status:'COMPLETED',result:{score:3,scoreMax:3}})).entries.size,0,
 'Un test V1 historique ne doit jamais être compté deux fois.');
const full={title:'Bilan',rows:OFFICIAL.map(r=>r.kind==='section'
 ?{kind:'section',sectionText:r.label}
 :{kind:'item',key:r.key,moduleText:r.label,level:'NE',points:null,possible:null})};
const session={seb_kaloneo_results_manifest:JSON.stringify({tests}),seb_kaltest_pilot2_state_v1:JSON.stringify({tests:states})};
const projected=projectDocument(full,session);
const get=id=>projected.rows.find(row=>row.key===id);
assert.equal(get('competences-transversales').points,2);
assert.equal(get('competences-transversales').possible,3);
assert.equal(get('competences-transversales').level,'II');
assert.equal(get('math-problemes').points,14);
assert.equal(get('math-problemes').possible,18);
assert.equal(get('math-problemes').level,'I');
const general=aggregateGeneralBilan([{candidateId:'audit',session,archive:{document:full}}]);
assert.equal(general.institutionalRows.find(r=>r.key==='competences-transversales').level,'II');
assert.equal(general.institutionalRows.find(r=>r.key==='math-problemes').percent,77.78);
assert(wordRows(general).some(r=>r.key==='competences-transversales'&&r.level==='II'),
 'La note du test doit parvenir jusqu\'au Word.');
// Refus d'enregistrer un nouveau test sans ligne, avec mauvaise catégorie
// ou liaison technique non interprétable. Les V1 ne sont jamais modifiées.
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'kaloneo-bilan-link-integrity-'));
try{
 const library=createKaloneoLibrary({dataRoot:dir,seedTestsRoot:seedRoot});
 const original=JSON.parse(fs.readFileSync(path.join(seedRoot,'fractions-preparation-lots/1.0.0/test.json'),'utf8'));
 original.id='audit-bilan-custom';
 original.title='Audit liaison future';
 original.category='mathematiques';
 original.bilanContributions=[];
 let result=library.saveTest(original);
 assert.equal(result.ok,false);
 assert.equal(result.code,'BILAN_LINK_REQUIRED');
 original.bilanContributions=[{lineId:transversal,bindings:{score:'score',score_max:'score_max'}}];
 result=library.saveTest(original);
 assert.equal(result.code,'BILAN_LINK_REQUIRED','Liaison de mauvaise catégorie refusée');
 original.bilanContributions=[{lineId:'bilan.savoirs_fondamentaux.mathematiques.resoudre_problemes',bindings:{score:'score',score_max:'mauvais'}}];
 result=library.saveTest(original);
 assert.equal(result.code,'BILAN_LINK_REQUIRED','Sortie impossible à noter refusée');
 original.bilanContributions[0].bindings.score_max='score_max';
 result=library.saveTest(original);
 assert(result.ok,result.error);
 const meta=library.listTests().find(t=>t.id===original.id);
 assert.deepEqual(meta.bilanRows.map(row=>row.key),['math-problemes']);
 const saved=library.saveParcours({
  name:'Audit liaison institutionnelle',creator:'Audit automatisé',
  introduction:{id:'introduction_parcours_base',version:'1.0.0'},
  tests:[{id:original.id,version:'1.0.0'}],
  fin:{id:'fin_parcours',version:'1.0.0'}
 });
 assert(saved.ok,saved.error);
}finally{fs.rmSync(dir,{recursive:true,force:true})}
console.log('BILAN_LINK_INTEGRITY=OK — '+definitions.length+' V1, '+skipped.length+' pages hors notation, Gestes 2/3, 2 grilles 14/18, bilan/Word, nouveau test sans liaison bloqué');
