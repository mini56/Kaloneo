'use strict';
// Conservation d'un seul bilan courant et d'un seul Word dans chaque evaluation.
const fs=require('fs');
const path=require('path');
const {readJsonFile}=require('./candidate-data-crypto');
function isWord(name) {
  return /^Evaluation_.+\.(?:doc|docx|sebdoc|sebword)$/i.test(String(name||''));
}
function discardOldWordExports(directory,keepNames=[]) {
  if(!fs.existsSync(directory))return 0;
  const keep=new Set(keepNames.map(n=>path.basename(String(n)).toLowerCase()));
  let count=0;
  for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
    if(!entry.isFile()||!isWord(entry.name)||keep.has(entry.name.toLowerCase()))continue;
    fs.rmSync(path.join(directory,entry.name));
    count++;
  }
  return count;
}
function pruneReplacedBilans(directory,keepName) {
  const current=path.basename(String(keepName||''));
  if(!current.toLowerCase().endsWith('.json')||
     !fs.existsSync(path.join(directory,current)))throw new Error('Bilan courant introuvable.');
  let count=0;
  for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
    if(!entry.isFile()||!entry.name.toLowerCase().endsWith('.json')||entry.name===current)continue;
    fs.rmSync(path.join(directory,entry.name));
    count++;
  }
  return count;
}
function hasCurrentOnlyArchive(candidateDir) {
  const directory=path.join(candidateDir,'bilan','historique');
  if(!fs.existsSync(directory))return false;
  return fs.readdirSync(directory,{withFileTypes:true})
    .filter(e=>e.isFile()&&e.name.toLowerCase().endsWith('.json'))
    .some(e=>{
      try {
        const archive=readJsonFile(path.join(directory,e.name));
        return archive&&archive.type==='SEB_EVALPRO_BILAN_ARCHIVE'&&archive.immutableRevision===false;
      }catch(_){return false}
    });
}
module.exports={isWord,discardOldWordExports,pruneReplacedBilans,hasCurrentOnlyArchive};
