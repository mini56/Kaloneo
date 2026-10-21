'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { configureLocalKey, clearLocalKey, writeJsonFile, readJsonFile,
  decryptLocalFileBuffer, encryptLocalFileBuffer, isEncryptedLocalFileBuffer, LOCAL_PREFIX } = require('../src/candidate-data-crypto');
const { createCandidateTransfer } = require('../src/candidate-transfer-main');
const { computeArchiveIntegrity } = require('../src/replay-archive-integrity');
const registerReplay = require('../src/replay-main');
const root = fs.mkdtempSync(path.join(os.tmpdir(),'kaloneo-private-transfer-'));
const A = path.join(root,'pc-A');
const B = path.join(root,'pc-B');
const usb = path.join(root,'usb');
fs.mkdirSync(usb,{recursive:true});
const candidate = {nom:'PERSONNE_TEST_SECRET_123',prenom:'PRENOM_TEST_SECRET_456',
  lieu:'Lorient',groupe:'G1',date:'2026-10-21',naissance:'2001-01-01'};
const id = 'candidate-security-001';
const png = Buffer.from('89504e470d0a1a0a001122334455667788', 'hex');
let handlers=new Map();
(async () => { try {
  const aRoot=path.join(A,'storage');
  const candidateDir=path.join(aRoot,'Candidats','CAND-SECRETTEST');
  for(const dir of ['donnees','resultats','replay','bilan/historique','bilan/exports'])
    fs.mkdirSync(path.join(candidateDir,dir),{recursive:true});
  configureLocalKey(Buffer.alloc(32,11));
  const manifest={schemaVersion:1,candidateId:id,shortId:'SECTST',folderName:'CAND-SECRETTEST',
    status:'TERMINE',candidat:candidate};
  writeJsonFile(path.join(candidateDir,'manifest.json'),manifest);
  writeJsonFile(path.join(candidateDir,'donnees','candidat.json'),candidate);
  writeJsonFile(path.join(candidateDir,'donnees','evaluation-state.json'),
    {sessionStorage:{candidat_data:JSON.stringify(candidate)},localStorage:{},lastPage:'qcmv1.0.html'});
  writeJsonFile(path.join(candidateDir,'donnees','progression.json'),{lastPage:'qcmv1.0.html'});
  writeJsonFile(path.join(candidateDir,'resultats','reponses.json'),{q1:'PRIVATE_ANSWER_789'});
  writeJsonFile(path.join(candidateDir,'resultats','scores.json'),{q1:3});
  const replayDir=path.join(candidateDir,'replay','REPLAY-TEST');
  fs.mkdirSync(path.join(replayDir,'slides'),{recursive:true});
  const binary=encryptLocalFileBuffer(png);
  fs.writeFileSync(path.join(replayDir,'slides','001_TEST.sebimg'),binary);
  const replayManifest={schemaVersion:2,type:'SEB_EVALPRO_PARCOURS_ARCHIVE',readOnly:true,
    archiveMode:'VISUAL_FROZEN_SLIDES',futureVersionIndependent:true,build:'147',
    archivedAt:'2026-10-21T12:00:00.000Z',candidate,
    snapshot:{sessionStorage:{candidat_data:JSON.stringify(candidate)},localStorage:{}},
    slides:[{order:1,pageKey:'test',title:'Page test',file:'001_TEST.sebimg',
      capturedAt:'2026-10-21T12:00:00.000Z',width:1200,height:800,
      sha256:crypto.createHash('sha256').update(binary).digest('hex')}]};
  replayManifest.integritySha256=computeArchiveIntegrity(replayManifest);
  writeJsonFile(path.join(replayDir,'manifest.json'),replayManifest);
  for(const rel of ['manifest.json','donnees/candidat.json','resultats/reponses.json']) {
    const raw=fs.readFileSync(path.join(candidateDir,rel),'utf8');
    assert(raw.startsWith(LOCAL_PREFIX),'Candidate JSON in plaintext: '+rel);
    assert(!raw.includes(candidate.nom),'Identity leaked: '+rel);
  }
  assert(isEncryptedLocalFileBuffer(fs.readFileSync(path.join(replayDir,'slides','001_TEST.sebimg'))));
  const exporter=createCandidateTransfer({dataRoot:aRoot,userDataPath:A,documentsPath:path.join(A,'Documents')});
  const result=exporter.exportSelected(usb,'Password-transfer-Strong-2026',[id]);
  assert.strictEqual(result.added,1);
  const archive=fs.readFileSync(path.join(usb,result.copied[0].filename),'utf8');
  assert(!archive.includes(candidate.nom),'USB contains plaintext identity');
  assert(!archive.includes('PRIVATE_ANSWER_789'),'USB contains plaintext answers');
  clearLocalKey();configureLocalKey(Buffer.alloc(32,22));
  const bRoot=path.join(B,'storage');
  const importer=createCandidateTransfer({dataRoot:bRoot,userDataPath:B,documentsPath:path.join(B,'Documents')});
  const restored=importer.importAll(usb,'Password-transfer-Strong-2026');
  assert.strictEqual(restored.added,1,'Imported candidate missing');
  const restoredDir=restored.copied[0].candidateDir;
  assert.deepStrictEqual(readJsonFile(path.join(restoredDir,'donnees','candidat.json')),candidate);
  const restoredReplay=path.join(restoredDir,'replay','REPLAY-TEST');
  const importedSlide=fs.readFileSync(path.join(restoredReplay,'slides','001_TEST.sebimg'));
  assert(isEncryptedLocalFileBuffer(importedSlide));
  assert(!importedSlide.equals(binary),'PC B must re-encrypt with a different local key');
  assert(decryptLocalFileBuffer(importedSlide).equals(png));
  const importedManifest=readJsonFile(path.join(restoredReplay,'manifest.json'));
  assert.strictEqual(importedManifest.integritySha256,computeArchiveIntegrity(importedManifest));
  assert.strictEqual(importedManifest.slides[0].sha256,
    crypto.createHash('sha256').update(importedSlide).digest('hex'));
  const ipc={handle(n,fn){handlers.set(n,fn)}};
  registerReplay({app:{getPath(name){if(name==='userData')return B;throw Error('Unknown '+name)}},
    ipcMain:ipc,getAdminUnlocked:()=>true,buildNumber:147,dataRoot:bRoot});
  const shown=await handlers.get('admin:get-candidate-parcours-slide')(null,id,'REPLAY-TEST','001_TEST.sebimg');
  assert(shown.ok,'Imported Replay must open for admin: '+JSON.stringify(shown));
  assert.strictEqual(shown.dataUrl,'data:image/png;base64,'+png.toString('base64'));
  console.log('PRIVATE_CANDIDATE_JSON=OK');
  console.log('PRIVATE_REPLAY_IMAGE=OK');
  console.log('USB_PASSWORD_TWO_WINDOWS_KEYS=OK');
  console.log('REPLAY_CHECKSUM_RESEALED_AFTER_IMPORT=OK');
  console.log('ADMIN_REPLAY_AFTER_IMPORT=OK');
} finally {
  clearLocalKey();
  fs.rmSync(root,{recursive:true,force:true});
}})().catch(e=>{ console.error(e.stack||e);process.exitCode=1 });
