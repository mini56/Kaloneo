'use strict';
const assert=require('assert');
const fs=require('fs');
const os=require('os');
const path=require('path');
const {configureLocalKey,clearLocalKey,isEncryptedLocalFileBuffer,decryptLocalFileBuffer}=require('../src/candidate-data-crypto');
const {storeProtectedWordDownload}=require('../src/candidate-protected-download');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'kaloneo-word-download-'));
(async()=>{try{
  configureLocalKey(Buffer.alloc(32,47));
  const plain=Buffer.from('<html><table><tr><td>SECRET_PERSONNE_4X</td></tr></table></html>','utf8');
  const doc=await storeProtectedWordDownload(plain,'.doc',root);
  assert(/^Evaluation_CAND-[A-F0-9]{32}\.sebdoc$/.test(doc.filename));
  assert(!doc.filename.includes('SECRET_PERSONNE_4X'));
  const sealed=fs.readFileSync(doc.path);
  assert(isEncryptedLocalFileBuffer(sealed));
  assert(decryptLocalFileBuffer(sealed).equals(plain));
  const docx=Buffer.from('504b03040000000000000000','hex');
  const office=await storeProtectedWordDownload(docx,'.docx',root);
  assert(office.filename.endsWith('.sebword'));
  assert(isEncryptedLocalFileBuffer(fs.readFileSync(office.path)));
  assert(decryptLocalFileBuffer(fs.readFileSync(office.path)).equals(docx));
  assert(!fs.readdirSync(root).some(name=>name.endsWith('.doc')),'DOC brut present sur disque.');
  console.log('LEGACY_WORD_DOWNLOAD_SEALED_BEFORE_DISK=OK');
  console.log('LEGACY_DOCX_DOWNLOAD_SEALED_BEFORE_DISK=OK');
}finally{clearLocalKey();fs.rmSync(root,{recursive:true,force:true})}})()
.catch(error=>{console.error(error.stack||error);process.exitCode=1});
