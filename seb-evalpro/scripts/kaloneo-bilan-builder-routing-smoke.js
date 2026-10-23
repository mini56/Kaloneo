'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const route=require('../source/js/kaloneo-bilan-routing');
const {createKaloneoLibrary}=require('../src/kaloneo-library-main');
const math='bilan.savoirs_fondamentaux.mathematiques.resoudre_problemes';
const expression='bilan.savoirs_fondamentaux.expression_ecrite.maitrise';
const transversal='bilan.savoirs_fondamentaux.competences_transversales.mobiliser_competences';
const mathTest={
 id:'p',version:'1.0.0',title:"Peinture d'une fresque.",category:'mathematiques',
 adminModified:true,bilanContributions:[{
  lineId:math,bindings:{score:'pourcentage',score_max:'pourcentage'}
 }]
};
const frenchTest={
 id:'f',title:'Français inédit',category:'francais',adminModified:true,
 bilanContributions:[{lineId:expression,bindings:{score:'score',score_max:'score_max'}}]
};
const wrongTest={
 id:'bad',title:'Calcul dans expression',category:'mathematiques',adminModified:true,
 bilanContributions:[{lineId:expression,bindings:{score:'score',score_max:'score_max'}}]
};
const v1={
 id:'genre_nombre',category:'francais',adminModified:false,
 bilanContributions:[{lineId:expression,bindings:{score:'score',score_max:'score_max'}}]
};
const states={
 p:{status:'COMPLETED',result:{score:1,scoreMax:2,percentage:50,
   manualEvaluation:{required:true,items:[{questionId:'detail-1',response:'15 m²'},
   {questionId:'detail-2',response:'9 €'}]}}},
 f:{status:'COMPLETED',result:{score:19,scoreMax:20,percentage:95}},
 bad:{status:'COMPLETED',result:{score:20,scoreMax:20,percentage:100}},
 genre_nombre:{status:'COMPLETED',result:{score:10,scoreMax:10,percentage:100}}
};
assert.equal(route.rowFor(math),'math-problemes');
assert.equal(route.rowFor(expression),'expression');
assert.equal(route.compatible('mathematiques',expression),false);
assert.equal(route.compatible('mathematiques',math),true);
assert.deepEqual(route.scoreOf(states.p.result,mathTest.bilanContributions[0].bindings),{score:50,max:100},
 'Deux fois pourcentage ne doit JAMAIS donner un faux 100 %.');
const transversalTest={id:'transv',title:'Évaluation transversale inédite',category:'competences_transversales',adminModified:true,
 bilanContributions:[{lineId:transversal,bindings:{score:'score',score_max:'score_max'}}]};
states.transv={status:'COMPLETED',result:{score:4,scoreMax:5,percentage:80}};
assert.equal(route.rowFor(transversal),'competences-transversales');
assert(route.compatible('competences_transversales',transversal));
assert(!route.compatible('mathematiques',transversal),'Catégorie incompatible bloquée.');
const result=route.collect([mathTest,frenchTest,wrongTest,transversalTest,v1],id=>states[id]);
assert.equal(result.entries.get('competences-transversales').length,1);
assert.deepEqual(result.entries.get('competences-transversales')[0].pair,{score:4,max:5});
assert.equal(result.entries.get('math-problemes').length,1);
assert.equal(result.entries.get('expression').length,1,
  'Un résultat mathématiques ne doit pas entrer dans Expression écrite.');
assert.equal(result.entries.get('expression')[0].testId,'f');
assert.equal(result.entries.get('expression')[0].pair.score,19);
assert(result.warnings.some(w=>w.testId==='bad'&&w.rowId==='expression'),
  'Un raccordement de catégorie erronée doit être refusé.');
assert(!result.entries.get('math-problemes')[0].pair.manual,
  'Les réponses libres ne deviennent pas des évaluations séparées.');
const html=fs.readFileSync(path.join(__dirname,'..','overrides','admin-bilan.html'),'utf8');
assert(!html.includes('<script src="js/kaltest-manual-bilan.js"></script>'),
  'Le bilan institutionnel ne doit plus créer la rubrique manuelle.');
assert(html.includes('<script src="js/kaloneo-bilan-routing.js"></script>'));
const runtime=fs.readFileSync(path.join(__dirname,'..','source/js','admin-bilan-kaloneo.js'),'utf8');
assert(runtime.includes('KaloneoBilanRouting?.collect(context.tests,stateFor)'),
  'Le bilan n’utilise pas les liaisons explicites du Builder.');
assert(runtime.includes('context.byId.get(id)?.category'),
  'Les catégories françaises et mathématiques doivent être vérifiées.');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'kaloneo-builder-routing-'));
try{
 const library=createKaloneoLibrary({dataRoot:dir,seedTestsRoot:path.join(__dirname,'..','source','kaltest','tests')});
 const before=library.listTests();
 const v1meta=before.find(x=>x.id==='genre_nombre');
 assert(v1meta?.bilanContributions?.some(x=>x.lineId===expression),
   'Les métadonnées des liaisons du Builder doivent être transmises au Bilan.');
 assert(v1meta.adminModified===false,'Ne jamais modifier les V1 officielles.');
 const definition=JSON.parse(fs.readFileSync(path.join(__dirname,'..','source','kaltest','tests',
   'fractions-preparation-lots','1.0.0','test.json'),'utf8'));
 definition.id='nouveau-test-fresque';
 definition.title="Peinture d'une fresque";
 definition.version='1.0.0';
 definition.category='mathematiques';
 definition.bilanContributions=mathTest.bilanContributions;
 const saved=library.saveTest(definition);
 assert(saved.ok,saved.error);
 const newer=library.listTests().find(x=>x.id==='nouveau-test-fresque');
 assert(newer?.adminModified===true);
 assert.deepEqual(newer?.bilanContributions,mathTest.bilanContributions);
 console.log('KALONEO_BILAN_BUILDER_ROUTING=OK — catégories, V1, sortie pourcentage, aucun doublon manuel');
}finally{fs.rmSync(dir,{force:true,recursive:true})}
