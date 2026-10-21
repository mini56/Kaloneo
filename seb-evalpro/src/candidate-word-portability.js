'use strict';
// Preparer des copies transportables des Word protegees sans jamais ecrire leur
// contenu dechiffre sur disque ni transporter le mot de passe administrateur.
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const {listCandidateDirs}=require('./candidate-folder-utils');
const {encryptLocalFileBuffer,decryptLocalFileBuffer,isEncryptedLocalFileBuffer}=require('./candidate-data-crypto');
const {isEncryptedBilanDocxBuffer,decryptBilanDocxBuffer}=require('./bilan-docx-main');
function persistSealedSidecar(target,plaintext){
  const sealed=encryptLocalFileBuffer(Buffer.from(plaintext));
  const temp=target+'.'+process.pid+'.'+crypto.randomBytes(6).toString('hex')+'.tmp';
  const backup=target+'.'+process.pid+'.'+crypto.randomBytes(6).toString('hex')+'.backup';
  let hasBackup=false;
  try {
    fs.writeFileSync(temp,sealed,{flag:'wx'});
    if(fs.existsSync(target)){fs.renameSync(target,backup);hasBackup=true}
    try { fs.renameSync(temp,target); }
    catch(error) {
      if(hasBackup&&!fs.existsSync(target)){fs.renameSync(backup,target);hasBackup=false}
      throw error;
    }
    const verified=fs.readFileSync(target);
    if(!isEncryptedLocalFileBuffer(verified)||!decryptLocalFileBuffer(verified).equals(Buffer.from(plaintext)))
      throw new Error('Verification de la sauvegarde Word portable impossible.');
    if(hasBackup){fs.rmSync(backup,{force:true});hasBackup=false}
  } finally {
    try{fs.rmSync(temp,{force:true})}catch(_){}
    if(hasBackup&&!fs.existsSync(target)){try{fs.renameSync(backup,target)}catch(_){}}
  }
  const raw=fs.readFileSync(target);
  if(!isEncryptedLocalFileBuffer(raw)||!decryptLocalFileBuffer(raw).equals(Buffer.from(plaintext)))
    throw new Error('Controle de la sauvegarde Word portable echoue.');
  return target;
}
async function ensurePortableCandidateWords({candidatesRoot,selectedCandidateIds=null,adminPassword}){
  const selected=Array.isArray(selectedCandidateIds)?new Set(selectedCandidateIds.map(String)):null;
  const records=listCandidateDirs(candidatesRoot,false)
    .filter(item=>!selected||selected.has(String(item.candidateId||'')));
  const report={recovered:0,preserved:0};
  for(const record of records){
    const dir=path.join(record.candidateDir,'bilan','exports');
    if(!fs.existsSync(dir))continue;
    for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
      if(!entry.isFile()||!/^Evaluation_.+\.docx$/i.test(entry.name))continue;
      const full=path.join(dir,entry.name);
      const companion=full.replace(/\.docx$/i,'.sebword');
      if(fs.existsSync(companion)){
        const backup=fs.readFileSync(companion);
        if(!isEncryptedLocalFileBuffer(backup))throw new Error('Sauvegarde Word portable illisible : '+entry.name);
        decryptLocalFileBuffer(backup);
        report.preserved++;
        continue;
      }
      const bytes=fs.readFileSync(full);
      let plaintext;
      if(await isEncryptedBilanDocxBuffer(bytes)){
        const secret=String(adminPassword||'');
        if(!secret)throw new Error('Mot de passe administrateur indisponible pour rendre le Word transportable.');
        try{plaintext=await decryptBilanDocxBuffer(bytes,secret)}
        catch(_){throw new Error('Ce bilan Word a un autre mot de passe. Export interrompu sans perte de donnees : '+entry.name)}
      }else if(bytes.subarray(0,2).toString('ascii')==='PK'){
        plaintext=bytes;
      }else{
        throw new Error('Ancien Word non reconnu : export interrompu sans alteration du fichier : '+entry.name);
      }
      persistSealedSidecar(companion,plaintext);
      report.recovered++;
    }
  }
  return report;
}
module.exports={ensurePortableCandidateWords,persistSealedSidecar};
