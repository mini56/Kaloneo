'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {createKaloneoLibrary}=require('../src/kaloneo-library-main');

const root=path.resolve(__dirname,'..');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'kaloneo-v1-developer-'));
try{
  const seeds=path.join(temp,'seeds');
  fs.cpSync(path.join(root,'source','kaltest','tests'),seeds,{recursive:true});
  const library=createKaloneoLibrary({dataRoot:path.join(temp,'userdata'),seedTestsRoot:seeds});
  const testId='planning_cantine',version='1.0.0';
  const original=library.getTest(testId,version);
  assert.equal(original.ok,true);
  const corrected={...original.definition,title:'Restaurant V1 — Correction développeur'};
  const forbidden=library.saveTest(corrected,{overwrite:true});
  assert.equal(forbidden.code,'PROTECTED_VERSION','Admin mode must NOT alter official V1');
  const saved=library.saveTest(corrected,{overwrite:true,allowSeedOverwrite:true});
  assert.equal(saved.ok,true,'Developer mode must save V1 locally');
  assert.equal(saved.test.version,'1.0.0','Developer edit must not silently create V2');
  assert.equal(library.getTest(testId,version).definition.title,corrected.title,
    'Local developer correction must survive seed refresh');
  const meta=JSON.parse(fs.readFileSync(path.join(temp,'userdata','KALONEO','developer-v1-drafts.json'),'utf8'));
  assert.ok(meta[testId+'@'+version]?.seedHash,'Developer draft must be tied to old seed hash');
  const backupDir=path.join(temp,'userdata','KALONEO','Backups-V1',testId);
  assert.ok(fs.readdirSync(backupDir).some(file=>file.endsWith('.json')),
    'Developer edit must preserve original V1 backup');
  const originalBackup=JSON.parse(fs.readFileSync(path.join(backupDir,fs.readdirSync(backupDir)[0]),'utf8'));
  assert.equal(originalBackup.title,original.definition.title);

  const canonical={...original.definition,title:'Restaurant V1 — Officielle TESTS_V1',
    kaloneoLibrary:{adminModified:true}};
  const seedFile=path.join(seeds,'planning-cantine','1.0.0','test.json');
  fs.writeFileSync(seedFile,JSON.stringify(canonical,null,2));
  fs.writeFileSync(path.join(temp,'TESTS_V1-manifest.json'),
    JSON.stringify({format:'kaloneo-official-v1-overrides',version:1,
      tests:[{id:testId,version:'1.0.0'}]}));
  const updated=library.getTest(testId,version);
  assert.equal(updated.definition.title,corrected.title,
    'An Admin-modified V1 must not be overwritten by a new Setup');
  const drafts=JSON.parse(fs.readFileSync(path.join(temp,'userdata','KALONEO','developer-v1-drafts.json')));
  assert.ok(drafts[testId+'@'+version]?.seedHash,
    'The V1 backup tracking must remain available across updates');
  const stock=library.getTest('ranger_stock','1.0.0');
  assert.equal(stock.ok,true,'Unrelated V1 must remain accessible');
  console.log('TESTS_V1_DEVELOPER_SMOKE: OK Admin lock unchanged, V1 local+backup retained across seed update, other V1 intact');
} finally {fs.rmSync(temp,{recursive:true,force:true});}
