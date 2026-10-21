'use strict';
const assert=require('assert');
const fs=require('fs');
const os=require('os');
const path=require('path');
const {configureLocalKey,clearLocalKey,writeJsonFile,readJsonFile,encryptLocalFileBuffer,
  isEncryptedLocalFileBuffer,decryptLocalFileBuffer}=require('../src/candidate-data-crypto');
const {migrateCandidatePrivateDocuments}=require('../src/candidate-private-documents');
const registerHistory=require('../src/bilan-history-main');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'kaloneo-legacy-private-'));
const dataRoot=path.join(root,'userData','storage');
const candidateDir=path.join(dataRoot,'Candidats','CAND-TESTHISTORY');
const wordDir=path.join(candidateDir,'bilan','exports');
const histDir=path.join(candidateDir,'bilan','historique');
const docs=path.join(root,'Documents');
const name='IDENTITE_TEST_SECURITE';
const candidate={nom:name,prenom:'PRENOM_TEST_CONFIDENTIEL',lieu:'Lorient',groupe:'G1',date:'2026-10-21'};
try{
  configureLocalKey(Buffer.alloc(32,31));
  fs.mkdirSync(wordDir,{recursive:true});fs.mkdirSync(histDir,{recursive:true});
  writeJsonFile(path.join(candidateDir,'manifest.json'),
    {schemaVersion:1,candidateId:'candidate-hist-1',shortId:'HIST1',folderName:'CAND-TESTHISTORY',status:'TERMINE',candidat:candidate});
  const handlers=new Map();
  const ipc={on(name,fn){handlers.set(name,fn)},handle(name,fn){handlers.set(name,fn)}};
  registerHistory({app:{getPath(key){if(key==='userData')return path.join(root,'userData');if(key==='documents')return docs;throw Error(key)}},
    ipcMain:ipc,getAdminUnlocked:()=>true,buildNumber:147,dataRoot});
  const html='<html><body><table><tr><td>'+name+
    '</td></tr></table><table><tr><td>Autres reponses du candidat</td></tr></table></body></html>';
  const event={returnValue:null};
  handlers.get('bilan-history:write-word-sync')(event,{filename:'Evaluation_'+name+'_SECRET.doc',html,candidate});
  assert(event.returnValue?.ok,JSON.stringify(event.returnValue));
  const secureFilename=event.returnValue.filename;
  assert(/^Evaluation_CAND-[A-F0-9]{32}\.sebdoc$/.test(secureFilename));
  const safeWord=fs.readFileSync(path.join(wordDir,secureFilename));
  assert(isEncryptedLocalFileBuffer(safeWord));
  assert(decryptLocalFileBuffer(safeWord).toString('utf8').includes(name));
  assert(!fs.existsSync(path.join(docs,'SEB EvalPro')),'Aucun Word en clair ne doit etre copie dans Documents');
  const legacyDoc=path.join(wordDir,'Evaluation_'+name+'_OLD.doc');
  fs.writeFileSync(legacyDoc,html,'utf8');
  const legacyDocx=path.join(wordDir,'Evaluation_'+name+'_OLD.docx');
  const fakeZip=Buffer.from('504b030400000012341234', 'hex');
  fs.writeFileSync(legacyDocx,fakeZip);
  const protectedExisting=path.join(wordDir,'Evaluation_CAND-0123456789ABCDEF01234567.docx');
  const protectedOle=Buffer.from('d0cf11e0a1b11ae10001020304050607','hex');
  fs.writeFileSync(protectedExisting,protectedOle);
  const legacyJson=path.join(histDir,name+'_BILAN_R00.json');
  writeJsonFile(legacyJson,{type:'SEB_EVALPRO_BILAN_ARCHIVE',candidate});
  const legacyGlobal=path.join(docs,'SEB EvalPro','Evaluation_'+name+'_GLOBAL.doc');
  fs.mkdirSync(path.dirname(legacyGlobal),{recursive:true});
  fs.writeFileSync(legacyGlobal,html,'utf8');
  // Ancien dossier de corbeille avec nom/prenom dans le chemin ET JSON bruts.
  const legacyCandidateDir=path.join(dataRoot,'Corbeille','Candidats',name+'_PRENOM_TEST_CONFIDENTIEL_LORIENT');
  fs.mkdirSync(legacyCandidateDir,{recursive:true});
  fs.writeFileSync(path.join(legacyCandidateDir,'manifest.json'),JSON.stringify({
    schemaVersion:1,candidateId:'privacy-old-345',status:'TERMINE',
    folderName:path.basename(legacyCandidateDir),candidat:candidate
  }));
  fs.writeFileSync(path.join(legacyCandidateDir,'trash-meta.json'),
    JSON.stringify({originalFolderName:path.basename(legacyCandidateDir)}));
  const report=migrateCandidatePrivateDocuments({dataRoot,documentsPath:docs,userDataPath:path.join(root,'userData')});
  assert.strictEqual(report.errors.length,0,JSON.stringify(report.errors));
  assert.strictEqual(report.encryptedLegacyDocs,2);
  assert.strictEqual(report.encryptedLegacyDocx,1);
  assert.strictEqual(report.linkedHistoricalWords,1,'Le Word historique global doit rester accessible depuis la fiche administrateur.');
  assert.strictEqual(report.renamedBilanArchives,1);
  assert.strictEqual(report.renamedProtectedDocs,0,'Le Word officiel protege a 24 caracteres ne doit pas etre renomme au demarrage.');
  assert(fs.readFileSync(protectedExisting).equals(protectedOle));
  assert.strictEqual(report.renamedCandidateFolders,1);
  assert(report.encryptedLegacyCandidateJson>=2);
  assert(!fs.existsSync(legacyCandidateDir));
  const trashRoot=path.join(dataRoot,'Corbeille','Candidats');
  const migratedTrash=path.join(trashRoot,fs.readdirSync(trashRoot)[0]);
  assert(/^CAND-/.test(path.basename(migratedTrash)));
  assert(fs.readFileSync(path.join(migratedTrash,'manifest.json'),'utf8').startsWith('SEBLOCAL1:'));
  assert.strictEqual(readJsonFile(path.join(migratedTrash,'trash-meta.json')).originalFolderName,
    path.basename(migratedTrash));
  assert(!fs.existsSync(legacyDoc) && !fs.existsSync(legacyDocx) && !fs.existsSync(legacyJson));
  const entries=fs.readdirSync(wordDir);
  assert(entries.filter(x=>x.endsWith('.sebdoc')).length===3);
  assert(entries.some(x=>x.endsWith('.sebword')));
  assert(fs.readdirSync(histDir).every(x=>/^BILAN_CAND-[A-F0-9]{32}\.json$/.test(x)));
  for(const folder of [wordDir,histDir,path.join(docs,'SEB EvalPro')]) {
    for(const file of fs.readdirSync(folder)){
      assert(!file.includes(name),'Un nom de fichier candidat est lisible : '+file);
      assert(!fs.readFileSync(path.join(folder,file)).includes(Buffer.from(name)),
        'Identite en clair sur disque : '+file);
    }
  }
  const repeat=migrateCandidatePrivateDocuments({dataRoot,documentsPath:docs,userDataPath:path.join(root,'userData')});
  assert.strictEqual(repeat.encryptedLegacyDocs,0);
  assert.strictEqual(repeat.encryptedLegacyDocx,0);
  assert.strictEqual(repeat.renamedBilanArchives,0);
  assert.strictEqual(repeat.renamedCandidateFolders,0);
  assert.strictEqual(repeat.linkedHistoricalWords,0);
  console.log('LEGACY_WORD_ENCRYPTED_AND_VERIFIED=OK');
  console.log('NEW_WORD_NO_CLEAR_DISK_FILE=OK');
  console.log('LEGACY_DOCX_PROTECTED_FOR_MIGRATION=OK');
  console.log('HISTORICAL_BILAN_FILENAMES_ANONYMISED=OK');
  console.log('HISTORICAL_MIGRATION_IDEMPOTENT=OK');
  console.log('LEGACY_TRASH_FOLDER_AND_JSON_PRIVACY=OK');
}finally{clearLocalKey();fs.rmSync(root,{recursive:true,force:true})}
