'use strict';
// Stockage prive des anciens documents Word et des noms d'archives de bilan.
// Seules les racines propres a KALONEO sont traitees ; les tests et images V1 restent intacts.
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const {readJsonFile,writeJsonFile,migrateJsonTree,encryptLocalFileBuffer,decryptLocalFileBuffer}=require('./candidate-data-crypto');
const {codedFolderName,listCandidateDirs,selectCandidateFromFilename}=require('./candidate-folder-utils');
const {hasCurrentOnlyArchive}=require('./candidate-bilan-current');

function opaqueCandidateName(extension,prefix='Evaluation_CAND') {
  return prefix+'-'+crypto.randomBytes(16).toString('hex').toUpperCase()+extension;
}
function atomicPrivateBuffer(target,value){
  const tmp=target+'.'+process.pid+'.'+crypto.randomBytes(5).toString('hex')+'.tmp';
  try{fs.writeFileSync(tmp,value,{flag:'wx'});fs.renameSync(tmp,target)}
  finally{try{fs.rmSync(tmp,{force:true})}catch(_){}}
}
function renameOpaque(source,prefix='Evaluation_CAND'){
  let target;
  do{target=path.join(path.dirname(source),opaqueCandidateName(path.extname(source),prefix))}
  while(fs.existsSync(target));
  fs.copyFileSync(source,target,fs.constants.COPYFILE_EXCL);
  if(!fs.readFileSync(target).equals(fs.readFileSync(source)))
    throw new Error('Copie historique non conforme : '+path.basename(source));
  fs.rmSync(source,{force:true});
  return target;
}
function sealWord(source,extension){
  const plain=fs.readFileSync(source);
  const sealed=encryptLocalFileBuffer(plain);
  let target;
  do{target=path.join(path.dirname(source),opaqueCandidateName(extension))}
  while(fs.existsSync(target));
  atomicPrivateBuffer(target,sealed);
  if(!decryptLocalFileBuffer(fs.readFileSync(target)).equals(plain))
    throw new Error('Verification de chiffrement Word impossible');
  fs.rmSync(source,{force:true});
  return target;
}
function migrateCandidatePrivateDocuments({dataRoot,documentsPath,userDataPath}){
  if(!dataRoot)throw new Error('Racine du stockage interne absente.');
  const report={encryptedLegacyDocs:0,encryptedLegacyDocx:0,renamedProtectedDocs:0,renamedBilanArchives:0,renamedCandidateFolders:0,encryptedLegacyCandidateJson:0,linkedHistoricalWords:0,errors:[]};
  const roots=[
    path.join(dataRoot,'Candidats'),path.join(dataRoot,'Corbeille'),
    path.join(dataRoot,'Admin'),path.join(dataRoot,'Bilans'),
    path.join(dataRoot,'LegacyDocuments'),path.join(dataRoot,'MigrationConflicts'),
    documentsPath&&path.join(documentsPath,'SEB EvalPro'),
    userDataPath&&path.join(userDataPath,'Documents','SEB EvalPro')
  ].filter(Boolean);
  const stack=roots.filter(p=>fs.existsSync(p)),seen=new Set();
  const historicalRoots=[
    path.join(dataRoot,'Bilans'),
    documentsPath&&path.join(documentsPath,'SEB EvalPro'),
    userDataPath&&path.join(userDataPath,'Documents','SEB EvalPro')
  ].filter(Boolean);
  const candidateRecords=listCandidateDirs(path.join(dataRoot,'Candidats'),false);
  function historicLooseDocument(file) {
    return historicalRoots.some(root=>{
      const rel=path.relative(root,file);
      return !!rel && rel!=='..' && !rel.startsWith('..'+path.sep) && !path.isAbsolute(rel);
    });
  }
  function linkToCandidate(oldFilename,securedPath) {
    if(!historicLooseDocument(securedPath))return;
    const record=selectCandidateFromFilename(candidateRecords,oldFilename);
    if(!record)return; // Plusieurs homonymes : ne pas risquer une attribution fausse.
    if(hasCurrentOnlyArchive(record.candidateDir))return; // Ne pas ressusciter l'ancien Word.
    const targetDir=path.join(record.candidateDir,'bilan','exports');
    fs.mkdirSync(targetDir,{recursive:true});
    const destination=path.join(targetDir,path.basename(securedPath));
    fs.copyFileSync(securedPath,destination,fs.constants.COPYFILE_EXCL);
    if(!fs.readFileSync(destination).equals(fs.readFileSync(securedPath)))
      throw new Error('Controle du Word historique rattache au candidat echoue.');
    report.linkedHistoricalWords++;
  }
  while(stack.length){
    let folder=stack.pop();
    // Seuls les dossiers reconnus par un manifest candidat sont modifies.
    // Le Builder, les tests et les images systeme n'ont pas de manifest candidat.
    const candidateManifest=path.join(folder,'manifest.json');
    if(fs.existsSync(candidateManifest)){
      try {
        const manifest=readJsonFile(candidateManifest);
        if(manifest && typeof manifest.candidateId==='string' && manifest.candidateId.trim()){
          report.encryptedLegacyCandidateJson+=migrateJsonTree(folder).files;
          const oldName=path.basename(folder);
          if(!/^CAND-/i.test(oldName)){
            const coded=codedFolderName(manifest.candidateId,manifest.shortId);
            let dest=path.join(path.dirname(folder),coded),number=2;
            while(fs.existsSync(dest)){
              dest=path.join(path.dirname(folder),coded+'_'+number++);
            }
            fs.renameSync(folder,dest);
            folder=dest;
            writeJsonFile(path.join(folder,'manifest.json'),{...manifest,folderName:path.basename(folder)});
            const trashMeta=path.join(folder,'trash-meta.json');
            if(fs.existsSync(trashMeta)){
              const metadata=readJsonFile(trashMeta);
              if(metadata)writeJsonFile(trashMeta,{...metadata,originalFolderName:path.basename(folder)});
            }
            report.renamedCandidateFolders++;
          }
        }
      } catch(error){
        report.errors.push({file:candidateManifest,error:String(error.message||error)});
      }
    }
    let canonical;
    try{canonical=fs.realpathSync(folder)}catch(_){continue}
    if(seen.has(canonical))continue;
    seen.add(canonical);
    let entries;
    try{entries=fs.readdirSync(folder,{withFileTypes:true})}
    catch(e){report.errors.push({file:folder,error:String(e.message||e)});continue}
    for(const item of entries){
      const full=path.join(folder,item.name);
      if(item.isDirectory()&&!item.isSymbolicLink()){stack.push(full);continue}
      if(!item.isFile())continue;
      try{
        const name=item.name.toLowerCase();
        if(name.endsWith('.doc')){
          const sealed=sealWord(full,'.sebdoc');
          report.encryptedLegacyDocs++;
          linkToCandidate(item.name,sealed);
        }else if(name.endsWith('.docx')){
          const buffer=fs.readFileSync(full);
          if(buffer.length>=2&&buffer.subarray(0,2).toString('ascii')==='PK'){
            // DOCX non protege : conteneur ZIP, scelle avec la cle locale.
            const sealed=sealWord(full,'.sebword');
            report.encryptedLegacyDocx++;
            linkToCandidate(item.name,sealed);
          }else if(!/^Evaluation_CAND-[A-F0-9]{24,32}\.docx$/i.test(item.name)){
            // Un DOCX deja chiffre par Word (OLE) conserve son chiffrement.
            const renamed=renameOpaque(full);
            report.renamedProtectedDocs++;
            linkToCandidate(item.name,renamed);
          }
        }else if(name.endsWith('.json')&&path.basename(folder).toLowerCase()==='historique'&&
          !/^BILAN_CAND-[A-F0-9]{32}\.json$/i.test(item.name)){
          if(!readJsonFile(full))throw new Error('Archive historique illisible : fichier conserve.');
          renameOpaque(full,'BILAN_CAND');report.renamedBilanArchives++;
        }
      }catch(e){report.errors.push({file:full,error:String(e.message||e)})}
    }
  }
  return report;
}
module.exports={opaqueCandidateName,migrateCandidatePrivateDocuments};
