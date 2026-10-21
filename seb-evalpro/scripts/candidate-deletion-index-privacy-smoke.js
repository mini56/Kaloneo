'use strict';
const fs=require('fs');
const os=require('os');
const path=require('path');
const assert=require('assert');
const { configureLocalKey,clearLocalKey,LOCAL_PREFIX }=require('../src/candidate-data-crypto');
const { readDeletedIds,markDeleted,unmarkDeleted }=require('../src/candidate-folder-utils');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'kaloneo-deleted-ids-private-'));
const file=path.join(root,'SEB EvalPro','Corbeille','deleted-candidate-ids.json');
try {
  configureLocalKey(Buffer.alloc(32,61));
  const id='CANDIDAT_TECHNIQUE_UUID_NON_LISIBLE';
  markDeleted(root,id);
  const bytes=fs.readFileSync(file,'utf8');
  assert(bytes.startsWith(LOCAL_PREFIX),'Index de suppression non chiffre.');
  assert(!bytes.includes(id),'Index de suppression contient un identifiant en clair.');
  assert(readDeletedIds(root).has(id));
  unmarkDeleted(root,id);
  const after=fs.readFileSync(file,'utf8');
  assert(after.startsWith(LOCAL_PREFIX));
  assert(!readDeletedIds(root).has(id));
  clearLocalKey();
  assert.throws(()=>markDeleted(root,'test'),/protection|indisponible|initialis|non initialis/i,
    'Un index ne doit jamais etre ecrit en clair sans cle locale.');
  console.log('CANDIDATE_DELETION_INDEX_ENCRYPTED=OK');
  console.log('NO_PLAINTEXT_FALLBACK_WITHOUT_WINDOWS_KEY=OK');
} finally {
  clearLocalKey();
  fs.rmSync(root,{recursive:true,force:true});
}
