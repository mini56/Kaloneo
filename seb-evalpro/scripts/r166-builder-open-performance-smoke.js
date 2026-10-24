'use strict';
// R166 — Mesurer les E/S pendant l'ouverture de tests existants.
// Préserver les tests système, les enregistrements, la suppression et le redémarrage.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {performance}=require('node:perf_hooks');
const {createKaloneoLibrary}=require('../src/kaloneo-library-main');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'kaloneo-r166-open-'));
const seed=path.join(root,'seed');
const data=path.join(root,'data');
const COUNT=120,OPEN_COUNT=32;
for(let i=0;i<COUNT;i++){
 const id='audit_'+String(i).padStart(4,'0');
 const file=path.join(seed,id,'1.0.0','test.json');
 fs.mkdirSync(path.dirname(file),{recursive:true});
 fs.writeFileSync(file,JSON.stringify({
  kaltestFormat:1,id,version:'1.0.0',title:'Test audit '+i,
  category:'mathematiques',scored:true,questions:[],
  presentation:{builderContent:[]}
 }), 'utf8');
}
// Deux pages indispensables en production : sinon le parcours de base serait
// recalculé lors de chaque appel, faussant la mesure du chargement normal.
for(const role of ['introduction','fin']){
 const file=path.join(seed,'page_'+role,'1.0.0','test.json');
 fs.mkdirSync(path.dirname(file),{recursive:true});
 fs.writeFileSync(file,JSON.stringify({
  kaltestFormat:1,id:'page_'+role,version:'1.0.0',title:'Page '+role,
  category:role,pageRole:role,scored:false,questions:[],
  presentation:{builderContent:[]}
 }), 'utf8');
}

const original=fs.readFileSync;
let seedReads=0,testReads=0;
fs.readFileSync=function(p,...args){
 const value=String(p);
 if(value.endsWith('test.json')){
  if(value.startsWith(seed+path.sep))seedReads++;
  if(value.startsWith(path.join(data,'KALONEO','Bibliotheque-tests')+path.sep))testReads++;
 }
 return original.call(this,p,...args);
};
try{
 const t0=performance.now();
 const lib=createKaloneoLibrary({dataRoot:data,seedTestsRoot:seed});
 const createdMs=performance.now()-t0;
 const tests=lib.listTests().filter(x=>x.role==='test');
 assert.equal(tests.length,COUNT);
 const initialSeedReads=seedReads;
 assert(initialSeedReads>=COUNT,'Les tests système doivent être identifiés au démarrage');
 seedReads=0;testReads=0;
 const t1=performance.now();
 for(let i=0;i<OPEN_COUNT;i++){
  const item=tests[(i*7)%COUNT];
  const opened=lib.getTest(item.id,item.version);
  assert(opened.ok,opened.error||'Impossible d’ouvrir le test indexé');
  assert.equal(opened.definition.id,item.id);
  assert.equal(opened.definition.version,item.version);
 }
 const openMs=performance.now()-t1;
 assert.equal(seedReads,0,'La bibliothèque relit les V1 à chaque ouverture');
 assert(testReads<=OPEN_COUNT+1,'La bibliothèque parcourt les JSON à chaque ouverture : '+testReads+' lectures');
 seedReads=0;
 lib.ensureSeed();
 lib.ensureSeed();
 assert.equal(seedReads,0,'La synchronisation V1 a été répétée');
 const again=lib.listTests().filter(x=>x.role==='test');
 assert.equal(again.length,COUNT);
 assert.equal(seedReads,0,'La lecture des V1 recommence lors de la liste');
 const known=lib.getTest('audit_0001','1.0.0');
 assert(known.ok,'V1 originale introuvable');
 const forbidden=lib.saveTest({...known.definition,title:'Altération refusée'},{overwrite:true});
 assert.equal(forbidden.ok,false,'V1 système modifiable sans autorisation');
 assert.equal(forbidden.code,'PROTECTED_VERSION');
 const custom={...known.definition,id:'audit_perso',title:'Test personnel',version:'2.0.0'};
 const added=lib.saveTest(custom);
 assert.equal(added.ok,true,'Enregistrement personnel impossible');
 assert.equal(lib.getTest(custom.id,custom.version).definition.title,'Test personnel');
 assert(lib.listTests().some(x=>x.id===custom.id),'Nouveau test absent de la bibliothèque');
 const deleted=lib.deleteTest(custom.id,custom.version);
 assert.equal(deleted.ok,true,'Suppression personnelle impossible');
 assert.equal(lib.getTest(custom.id,custom.version).ok,false,'Ancien index non invalidé');
 const restart=createKaloneoLibrary({dataRoot:data,seedTestsRoot:seed});
 assert.equal(restart.listTests().filter(x=>x.role==='test').length,COUNT,'Reprise après démarrage incohérente');
 assert(restart.getTest('audit_0001','1.0.0').ok,'V1 perdue après redémarrage');
 const builder=original.call(fs,path.resolve(__dirname,'../../kaloneo/test-builder.js'),'utf8');
 const openBlock=builder.match(/function loadDefinition\([^]*?\n  async function importJsonFile/);
 assert(openBlock,'Fonction ouverture Builder introuvable');
 assert(!/renderBlocks\(\);\s*refreshPreview\(\)/.test(openBlock[0]),
  'Double aperçu candidat à l’ouverture');
 assert(builder.includes('const lineGroups=Workflow.lines(state.blocks);'),
  'Rendu des groupes non indexé');
 console.log('KALONEO_R166_FAST_OPEN=OK; seedInitial='+initialSeedReads+
  '; subsequentSeedReads=0; '+OPEN_COUNT+' ouvertures, '+testReads+
  ' lectures tests; initMs='+Math.round(createdMs)+'; reopenMs='+Math.round(openMs)+
  '; V1 protégées, sauvegarde/suppression et redémarrage validés');
}finally{
 fs.readFileSync=original;
 fs.rmSync(root,{recursive:true,force:true});
}
