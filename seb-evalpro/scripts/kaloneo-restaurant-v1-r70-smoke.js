'use strict';
// R70 — Restaurant v3 validated by the Admin is now the system Restaurant V1.
// Only the Restaurant seed is changed; test content and media bytes are preserved.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const crypto=require('node:crypto');
const {createKaloneoLibrary}=require('../src/kaloneo-library-main');
const root=path.resolve(__dirname,'..');
const seedFile=path.join(root,'source','kaltest','tests','planning-cantine','1.0.0','test.json');
const webSeedFile=path.join(root,'app','web','kaltest','tests','planning-cantine','1.0.0','test.json');
const test=JSON.parse(fs.readFileSync(seedFile,'utf8'));
assert.equal(test.id,'planning_cantine');
assert.equal(test.version,'1.0.0');
assert.equal(test.title,'Planification — Le restaurant');
assert.equal(test.questions?.length,15);
assert.equal(test.presentation?.layout,'50-50');
assert.equal(test.presentation?.builderContent?.length,4);
assert.equal(test.presentation?.builderContent?.[0]?.type,'table-grid');
assert.equal(test.presentation?.builderContent?.[0]?.table?.cells?.length,3);
assert.equal(test.presentation?.builderContent?.[0]?.table?.cells?.[0]?.length,6);
assert.equal(test.presentation?.builderContent?.[2]?.style?.backgroundImage,'imageqcm/r48-plateau-repas.png');
assert.equal(test.presentation?.builderContent?.[3]?.resource?.data,'imageqcm/r48-cantine-cuisinieres.png');
assert.equal(test.sourceMigration?.legacyParcoursId,'planning');
assert.notEqual(test.kaloneoLibrary?.adminModified,true,'Official V1 must be an immutable seed');
assert.equal(test.bilanContributions?.[0]?.lineId,'bilan.competences_techniques.planning.repartition_taches');
assert.equal(test.outputs?.length,3);
assert.deepEqual(JSON.parse(fs.readFileSync(webSeedFile,'utf8')),test,'Packaged V1 must equal source V1');
const media=[
  ['imageqcm/r48-plateau-repas.png','0ccf740a794eb275d127fd886d3f64d3a50b05dc9cedcec9b42df679f5a93583'],
  ['imageqcm/r48-cantine-cuisinieres.png','6f5c9dbb4da70000ea3c358705f416393193d693bd0149957d15da20351f5b24']
];
for(const [relative,expected] of media){
  const file=path.join(root,'app','web',relative);
  assert.ok(fs.existsSync(file),'Image must be packaged: '+relative);
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),expected,
    'Image must be the exact file that was contained in the exported V3: '+relative);
}
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kaloneo-restaurant-r70-'));
try{
  const oldSeed=path.join(tmp,'seeds','planning-cantine','1.0.0','test.json');
  fs.mkdirSync(path.dirname(oldSeed),{recursive:true});
  fs.copyFileSync(path.join(root,'..','tests','fixtures','kaltests','planning-cantine','1.0.0','test.json'),oldSeed);
  const lib=createKaloneoLibrary({dataRoot:path.join(tmp,'userdata'),seedTestsRoot:path.join(tmp,'seeds')});
  const old=lib.getTest('planning_cantine','1.0.0');
  assert.equal(old.ok,true,'Old V1 is initially installed');
  assert.ok(!Array.isArray(old.definition.presentation?.builderContent),'Old V1 must differ from new V1');
  const demo=JSON.parse(JSON.stringify(test));
  demo.id='planning_cantine_r48_demo';
  demo.version='3.0.0';
  assert.equal(lib.saveTest(demo).ok,true,'Existing separately saved V3 must remain possible');
  fs.copyFileSync(seedFile,oldSeed);
  const updated=lib.getTest('planning_cantine','1.0.0');
  assert.equal(updated.ok,true);
  assert.equal(updated.definition.presentation?.builderContent?.length,4,
    'Existing installation must upgrade old Restaurant V1 to the approved V1');
  assert.equal(updated.definition.questions.length,15);
  assert.equal(lib.getTest('planning_cantine_r48_demo','3.0.0').ok,true,
    'Unrelated local V3 remains preserved');
  assert.equal(lib.saveTest({...test,title:'Tentative de modification'}, {overwrite:true}).code,'PROTECTED_VERSION',
    'Official V1 remains protected from accidental edits');
} finally {
  fs.rmSync(tmp,{recursive:true,force:true});
}
console.log('R70 RESTAURANT V1: imported validated content, exact media bytes, upgraded old V1, kept existing V3 — OK.');
