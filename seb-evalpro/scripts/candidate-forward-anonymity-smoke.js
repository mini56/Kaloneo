'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const os=require('os');
const {createPrivateExportFolderName}=require('../src/candidate-anonymous-paths');
const {createCandidateTransfer}=require('../src/candidate-transfer-main');
const {configureLocalKey,clearLocalKey,writeJsonFile,readJsonFile,encryptLocalFileBuffer,
  decryptLocalFileBuffer,isEncryptedLocalFileBuffer,LOCAL_PREFIX}=require('../src/candidate-data-crypto');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'kaloneo-new-anonymous-'));
const name='PERSONNE_PRIVEE_X7Q92',first='PRENOM_PRIVEE_Y8R14',answer='REPONSE_PERSONNELLE_Z9D45';
const candidate={nom:name,prenom:first,lieu:'Lorient',groupe:'Formation',date:'2026-10-21',naissance:'2000-04-22'};
const id='CANDIDATE-TECHNICAL-PRIVATE-246810';
function audit(rootDir){
  const pending=[rootDir],visible=[];
  while(pending.length){
    const dir=pending.pop();
    for(const item of fs.readdirSync(dir,{withFileTypes:true})){
      const full=path.join(dir,item.name);
      visible.push(item.name);
      for(const secret of [name,first,answer]){
        assert(!item.name.toUpperCase().includes(secret),'Donnée personnelle dans nom de fichier/dossier: '+item.name);
      }
      if(item.isDirectory()){pending.push(full);continue}
      if(!item.isFile())continue;
      const bytes=fs.readFileSync(full);
      for(const secret of [name,first,answer]){
        assert(!bytes.includes(Buffer.from(secret,'utf8')),'Donnée candidate en clair sur disque: '+item.name);
      }
      if(item.name.toLowerCase().endsWith('.json')){
        assert(bytes.toString('utf8').startsWith(LOCAL_PREFIX),'JSON candidat non chiffre: '+full);
      }
      if(/\.(sebdoc|sebimg|sebword)$/i.test(item.name)){
        assert(isEncryptedLocalFileBuffer(bytes),'Fichier candidat binaire non chiffre: '+full);
      }
    }
  }
  return visible;
}
(async()=>{try{
  const a=path.join(root,'pc1'),b=path.join(root,'pc2');
  const usb1=path.join(root,'USB-1',createPrivateExportFolderName());
  const usb2=path.join(root,'USB-2',createPrivateExportFolderName());
  for(const usb of [usb1,usb2])fs.mkdirSync(usb,{recursive:true});
  assert.notStrictEqual(path.basename(usb1),path.basename(usb2));
  assert(/^KALONEO-EXPORT-[A-F0-9]{32}$/.test(path.basename(usb1)));
  const main=fs.readFileSync(path.join(__dirname,'../src/main.js'),'utf8');
  assert(main.includes('const folderName = createPrivateExportFolderName();'),
    'L application ne doit pas enregistrer un nom personnel de dossier export.');
  configureLocalKey(Buffer.alloc(32,67));
  const candDir=path.join(a,'storage','Candidats','CAND-10A00B20C30D');
  for(const rel of ['donnees','resultats','replay/slides','bilan/historique','bilan/exports'])fs.mkdirSync(path.join(candDir,rel),{recursive:true});
  const manifest={schemaVersion:1,candidateId:id,shortId:'TSTPRV1',status:'TERMINE',
    folderName:path.basename(candDir),candidat:candidate};
  writeJsonFile(path.join(candDir,'manifest.json'),manifest);
  writeJsonFile(path.join(candDir,'donnees','candidat.json'),candidate);
  writeJsonFile(path.join(candDir,'donnees','evaluation-state.json'),
    {sessionStorage:{candidat_data:JSON.stringify(candidate),test_reply:answer},localStorage:{}});
  writeJsonFile(path.join(candDir,'donnees','progression.json'),{lastPage:'FIN'});
  writeJsonFile(path.join(candDir,'resultats','reponses.json'),{email:answer});
  writeJsonFile(path.join(candDir,'resultats','scores.json'),{score:5});
  const image=Buffer.from('89504e470d0a1a0a11223344','hex');
  fs.writeFileSync(path.join(candDir,'replay','slides','1.sebimg'),encryptLocalFileBuffer(image));
  fs.writeFileSync(path.join(candDir,'bilan','exports','Evaluation_CAND-1020304050607080.sebdoc'),
    encryptLocalFileBuffer(Buffer.from(name+' '+answer)));
  audit(path.join(a,'storage','Candidats'));
  const transfer=createCandidateTransfer({dataRoot:path.join(a,'storage'),documentsPath:path.join(a,'Documents'),userDataPath:a});
  const ex1=transfer.exportSelected(usb1,'MOT-DE-PASSE-USB-UNIQUE',[id]);
  const ex2=transfer.exportSelected(usb2,'MOT-DE-PASSE-USB-UNIQUE',[id]);
  assert.strictEqual(ex1.added,1);assert.strictEqual(ex2.added,1);
  const file1=ex1.copied[0].filename,file2=ex2.copied[0].filename;
  assert(/^CAND-[A-F0-9]{32}\.seb$/.test(file1),'Nom de transfert non opaque');
  assert.notStrictEqual(file1,file2,'Le fichier ne doit pas permettre de relier deux exports sans mot de passe.');
  const outer=fs.readFileSync(path.join(usb1,file1),'utf8');
  assert(JSON.parse(outer).format==='SEB-EVALPRO-USB-1');
  for(const secret of [name,first,answer,id])assert(!outer.includes(secret),'Info personnelle en clair sur USB');
  const repeat=transfer.exportSelected(usb1,'MOT-DE-PASSE-USB-UNIQUE',[id]);
  assert.strictEqual(repeat.skipped,1,'Re-export sans modification doit retrouver le candidat en dechiffrant');
  assert.strictEqual(fs.readdirSync(usb1).filter(x=>x.endsWith('.seb')).length,1);
  clearLocalKey();configureLocalKey(Buffer.alloc(32,68));
  const dest=createCandidateTransfer({dataRoot:path.join(b,'storage'),documentsPath:path.join(b,'Documents'),userDataPath:b});
  const imported=dest.importAll(usb1,'MOT-DE-PASSE-USB-UNIQUE');
  assert.strictEqual(imported.added,1);
  const dir=imported.copied[0].candidateDir;
  assert.deepStrictEqual(readJsonFile(path.join(dir,'donnees','candidat.json')),candidate);
  assert.deepStrictEqual(readJsonFile(path.join(dir,'resultats','reponses.json')),{email:answer});
  audit(path.join(b,'storage','Candidats'));
  console.log('NEW_CANDIDATE_PC_NO_PLAINTEXT_IDENTITY_OR_ANSWERS=OK');
  console.log('USB_RANDOM_NAMES_AND_ENCRYPTED_CONTENT=OK');
  console.log('USB_REPEATED_EXPORT_AND_PASSWORD_IMPORT=OK');
  console.log('SECOND_PC_LOCAL_ENCRYPTION_AND_ADMIN_READBACK=OK');
}finally{clearLocalKey();fs.rmSync(root,{recursive:true,force:true})}})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
