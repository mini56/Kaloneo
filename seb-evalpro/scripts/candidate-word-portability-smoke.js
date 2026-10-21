'use strict';
const assert=require('assert');
const fs=require('fs');
const os=require('os');
const path=require('path');
const {configureLocalKey,clearLocalKey,writeJsonFile,readJsonFile,
  isEncryptedLocalFileBuffer,decryptLocalFileBuffer}=require('../src/candidate-data-crypto');
const {createCandidateTransfer}=require('../src/candidate-transfer-main');
const {ensurePortableCandidateWords}=require('../src/candidate-word-portability');
const {buildBilanDocxBuffer,protectPlainBilanDocxBuffer,decryptBilanDocxBuffer,
  isEncryptedBilanDocxBuffer,verifyBilanDocxPassword}=require('../src/bilan-docx-main');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'kaloneo-word-cross-pc-'));
(async()=>{try{
  const a=path.join(root,'PC-A','storage'),b=path.join(root,'PC-B','storage'),usb=path.join(root,'USB');
  fs.mkdirSync(usb,{recursive:true});
  const id='word-candidate-transfer-001';
  const candidate={nom:'NOM_SECRET_592',prenom:'PRENOM_SECRET_592',lieu:'Lorient',groupe:'2',date:'2026-10-21'};
  const dir=path.join(a,'Candidats','CAND-WORDCHECK');
  const payload={filename:'Evaluation_NOM_SECRET.docx',candidate,
    rows:[{type:'section',text:'Bilan',strong:true},{type:'row',id:'k1',
      module:'Autonomie du candidat',level:'II',comment:'Donnée privée',detail:''}],
    summary:'SECRETE EVALUATION'};
  for(const sub of ['donnees','resultats','replay','bilan/historique','bilan/exports'])
    fs.mkdirSync(path.join(dir,sub),{recursive:true});
  configureLocalKey(Buffer.alloc(32,44));
  writeJsonFile(path.join(dir,'manifest.json'),{schemaVersion:1,candidateId:id,
    shortId:'WTRANS',folderName:'CAND-WORDCHECK',status:'TERMINE',candidat:candidate});
  writeJsonFile(path.join(dir,'donnees','candidat.json'),candidate);
  writeJsonFile(path.join(dir,'donnees','evaluation-state.json'),{sessionStorage:{candidat_data:JSON.stringify(candidate)},localStorage:{}});
  writeJsonFile(path.join(dir,'donnees','progression.json'),{lastPage:'FIN'});
  writeJsonFile(path.join(dir,'resultats','reponses.json'),{q1:'SECRET_RESULT_123'});
  writeJsonFile(path.join(dir,'resultats','scores.json'),{q1:1});
  const wordDir=path.join(dir,'bilan','exports');
  const docxPath=path.join(wordDir,'Evaluation_CAND-00112233445566778899AABB.docx');
  const wordPasswordA='ADMIN-PC-A-SECRET';
  const wordPasswordB='ADMIN-PC-B-DIFFERENT';
  const usbPassword='USB-INDEPENDENT-TRANSFER';
  const protectedA=await buildBilanDocxBuffer(payload,wordPasswordA);
  fs.writeFileSync(docxPath,protectedA);
  assert(await isEncryptedBilanDocxBuffer(protectedA));
  const port=await ensurePortableCandidateWords({candidatesRoot:path.join(a,'Candidats'),
    selectedCandidateIds:[id],adminPassword:wordPasswordA});
  assert.strictEqual(port.recovered,1);
  const sidecarPath=docxPath.replace(/\.docx$/i,'.sebword');
  const sidecarA=fs.readFileSync(sidecarPath);
  assert(isEncryptedLocalFileBuffer(sidecarA));
  const plainA=decryptLocalFileBuffer(sidecarA);
  assert(plainA.subarray(0,2).toString()==='PK');
  const exporter=createCandidateTransfer({dataRoot:a,documentsPath:path.join(root,'PC-A','Documents')});
  const exported=exporter.exportSelected(usb,usbPassword,[id]);
  assert.strictEqual(exported.added,1);
  clearLocalKey();configureLocalKey(Buffer.alloc(32,55));
  const importer=createCandidateTransfer({dataRoot:b,documentsPath:path.join(root,'PC-B','Documents')});
  const imported=importer.importAll(usb,usbPassword);
  assert.strictEqual(imported.added,1);
  const importedDir=imported.copied[0].candidateDir;
  const wordB=path.join(importedDir,'bilan','exports',path.basename(sidecarPath));
  assert(fs.existsSync(wordB));
  assert(!fs.existsSync(path.join(importedDir,'bilan','exports',path.basename(docxPath))),
    'Le transfert ne doit pas apporter un DOCX limite au mot de passe du PC A.');
  const sidecarB=fs.readFileSync(wordB);
  assert(isEncryptedLocalFileBuffer(sidecarB));
  assert(!sidecarA.equals(sidecarB));
  const plainB=decryptLocalFileBuffer(sidecarB);
  assert(plainB.equals(plainA));
  const protectedB=await protectPlainBilanDocxBuffer(plainB,wordPasswordB);
  assert(await verifyBilanDocxPassword(protectedB,wordPasswordB));
  assert(!(await verifyBilanDocxPassword(protectedB,wordPasswordA)));
  assert((await decryptBilanDocxBuffer(protectedB,wordPasswordB)).equals(plainA));
  console.log('WORD_ADMIN_PC_A_TO_PC_B_DIFFERENT_PASSWORDS=OK');
  console.log('WORD_TRANSFER_USB_PASSWORD_INDEPENDENT=OK');
  console.log('WORD_NEVER_PLAINTEXT_ON_DISK_DURING_TRANSFER=OK');
}finally{clearLocalKey();fs.rmSync(root,{recursive:true,force:true})}})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
