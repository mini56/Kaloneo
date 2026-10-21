'use strict';
const fs=require('fs');
const assert=require('assert');
const os=require('os');
const path=require('path');
const {configureLocalKey,clearLocalKey,isEncryptedLocalFileBuffer,
  decryptLocalFileBuffer,readJsonFile,LOCAL_PREFIX}=require('../src/candidate-data-crypto');
const registerReplay=require('../src/replay-main');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'kaloneo-replay-pending-private-'));
const token='11111111-1111-1111-1111-111111111111';
const pending=path.join(root,'replay-pending',token);
const png=Buffer.from('89504e470d0a1a0a0011223344556677','hex');
try {
  configureLocalKey(Buffer.alloc(32,19));
  fs.mkdirSync(pending,{recursive:true});
  fs.writeFileSync(path.join(pending,'001_ANCIEN.png'),png);
  fs.writeFileSync(path.join(pending,'index.json'),JSON.stringify({
    schemaVersion:1,token,pages:{intro:{order:1,pageKey:'test',title:'Test',
      file:'001_ANCIEN.png'}}
  },null,2));
  const map=new Map();
  const api=registerReplay({
    app:{getPath(k){if(k==='userData')return root;throw Error(k)}},
    ipcMain:{handle(n,fn){map.set(n,fn)}},getAdminUnlocked:()=>true,buildNumber:147
  });
  const result=api.migrateStoredPending();
  assert.deepStrictEqual(result.errors,[]);
  assert.strictEqual(result.protectedImages,1);
  assert.strictEqual(result.protectedJson,1);
  assert(fs.readFileSync(path.join(pending,'index.json'),'utf8').startsWith(LOCAL_PREFIX));
  assert(readJsonFile(path.join(pending,'index.json')).pages.intro);
  const image=fs.readFileSync(path.join(pending,'001_ANCIEN.png'));
  assert(isEncryptedLocalFileBuffer(image));
  assert(decryptLocalFileBuffer(image).equals(png));
  const second=api.migrateStoredPending();
  assert.strictEqual(second.protectedImages,0);
  assert.strictEqual(second.protectedJson,0);
  console.log('NO_CLEAR_LEGACY_REPLAY_PENDING_PNG=OK');
  console.log('NO_CLEAR_LEGACY_REPLAY_PENDING_JSON=OK');
  console.log('LEGACY_REPLAY_PENDING_READABLE_ONLY_WITH_KEY=OK');
}finally{clearLocalKey();fs.rmSync(root,{recursive:true,force:true})}
