'use strict';
// Contrôle générique des pages d'introduction/fin créées depuis le Builder.
// Aucune modification des 24 V1 d'origine ou des 5 exports officiels.
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const Core=require('../../kaloneo/builder-core');
const {createKaloneoLibrary}=require('../src/kaloneo-library-main');
const root=path.resolve(__dirname,'..');
const source=path.join(root,'source','kaltest','tests');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kaloneo-special-pages-'));
function model(id,category){
 return {meta:{id,title:'Page '+category,version:'1.0.0',category,
   scored:category==='test',layout:'single',scenario:'',instruction:'',
   outputs:[{id:'status',type:'string'}],bilanContributions:[]},
   blocks:[{uid:'text-1',type:'text',zone:'left',text:'Bienvenue dans '+category}],
   supplementaryWindows:[]};
}
try{
 const lib=createKaloneoLibrary({dataRoot:tmp,seedTestsRoot:source});
 const created={};
 for(const category of ['introduction','fin']){
  const id='page_'+category+'_builder_2026';
  const definition=Core.modelToDefinition(model(id,category));
  assert.equal(definition.pageRole,category,'PageRole incorrect');
  assert.equal(definition.scored,false,'Pages de parcours jamais notées');
  assert.deepEqual(definition.bilanContributions,[],'Ne doit pas apparaître au bilan');
  assert.equal(definition.questions.length,0,'Pas de question dans une page de parcours');
  assert.equal(Boolean(definition.behavior?.terminal),category==='fin');
  assert(Core.analyzeDefinition(definition).ok,category+' incompatible KALTEST');
  assert.equal(definition.presentation.builderContent[0].text,'Bienvenue dans '+category);
  const saved=lib.saveTest(definition);
  assert(saved.ok,category+': '+JSON.stringify(saved));
  const listed=lib.listTests().find(t=>t.id===id&&t.version==='1.0.0');
  assert(listed,category+' absent de la bibliothèque');
  assert.equal(listed.role,category);
  assert.equal(listed.scored,false);
  const opened=lib.getTest(id,'1.0.0');
  assert(opened.ok);
  assert.equal(opened.definition.pageRole,category);
  const roundTrip=Core.modelToDefinition(Core.definitionToModel(opened.definition));
  assert.equal(roundTrip.pageRole,category);
  assert.equal(roundTrip.scored,false);
  assert.equal(roundTrip.presentation.builderContent[0].text,'Bienvenue dans '+category);
  created[category]={id,version:'1.0.0'};
 }
 const tests=lib.listTests().filter(x=>x.role==='test');
 assert(tests.length>=1,'Catalogue historique disparu');
 const chosen=tests.find(x=>x.id==='calculs_commandes_atelier')||tests[0];
 const p=lib.saveParcours({
  name:'Parcours spécial Builder',creator:'KALONÉO',
  introduction:created.introduction,fin:created.fin,
  tests:[{id:chosen.id,version:chosen.version}]
 });
 assert(p.ok,'Enregistrement parcours avec les 2 pages impossible : '+JSON.stringify(p));
 const html=fs.readFileSync(path.resolve(root,'../kaloneo/test-builder.html'),'utf8');
 const ui=fs.readFileSync(path.resolve(root,'../kaloneo/test-builder.js'),'utf8');
 const runtime=fs.readFileSync(path.join(root,'source','js','kaltest-pilot2-runtime.js'),'utf8');
 for(const cat of ['introduction','fin'])assert(html.includes('value="'+cat+'"'));
 assert(html.includes('id="open-library-image"'),'Bouton image en haut absent');
 assert(ui.includes("openImageLibrary(null).catch"),'Bouton sans ouverture de la bibliothèque commune');
 assert(runtime.includes('renderSelectedIntroduction();'),'Introduction non raccordée au rendu candidat');
 assert(runtime.includes('customBuilderPage=test.pageRole'), 'Finale Builder non raccordée au rendu terminal');
 const baseline=lib.getTest('introduction_parcours_base','1.0.0');
 assert(baseline.ok,'Introduction V1 fournie absente');
 const finale=lib.getTest('fin_parcours','1.0.0');
 assert(finale.ok&&finale.definition.presentation?.endPage,'Fin V1 historique absente');
 console.log('KALONEO_SPECIAL_PAGES_BUILDER=OK — 2 catégories, galerie commune, parcours valide, 2 V1 conservées');
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
