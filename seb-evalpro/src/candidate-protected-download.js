'use strict';
// Ecrit les exportations Word traditionnelles en stockage chiffre des le
// premier octet sur disque. Les fichiers candidates ne transitent pas en clair.
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const {encryptLocalFileBuffer,decryptLocalFileBuffer,isEncryptedLocalFileBuffer}=require('./candidate-data-crypto');
const {opaqueCandidateName}=require('./candidate-private-documents');
const {isEncryptedBilanDocxBuffer}=require('./bilan-docx-main');

async function storeProtectedWordDownload(bytes,originalExtension,directory) {
  const buffer=Buffer.from(bytes||[]);
  if(!buffer.length||buffer.length>25*1024*1024)throw new Error('Document Word vide ou trop volumineux.');
  const ext=String(originalExtension||'').toLowerCase();
  if(!['.doc','.docx'].includes(ext))throw new Error('Type Word non autorise.');
  let content,outputExt;
  if(ext==='.doc'){
    outputExt='.sebdoc';content=encryptLocalFileBuffer(buffer);
  }else{
    let officeEncrypted=false;
    try{officeEncrypted=await isEncryptedBilanDocxBuffer(buffer)}catch(_){}
    if(officeEncrypted){
      outputExt='.docx';content=buffer;
    }else{
      outputExt='.sebword';content=encryptLocalFileBuffer(buffer);
    }
  }
  fs.mkdirSync(directory,{recursive:true});
  let dest;
  do{dest=path.join(directory,opaqueCandidateName(outputExt))}
  while(fs.existsSync(dest));
  const temp=dest+'.'+process.pid+'.'+crypto.randomBytes(6).toString('hex')+'.tmp';
  try{
    fs.writeFileSync(temp,content,{flag:'wx'});
    fs.renameSync(temp,dest);
    const disk=fs.readFileSync(dest);
    if(!disk.equals(content))throw new Error('Controle du fichier Word sur disque echoue.');
    if(outputExt!=='.docx' &&
       (!isEncryptedLocalFileBuffer(disk)||!decryptLocalFileBuffer(disk).equals(buffer)))
      throw new Error('Controle de chiffrement du Word echoue.');
    return {filename:path.basename(dest),path:dest,protected:true,contentType:outputExt};
  }finally{try{fs.rmSync(temp,{force:true})}catch(_){}}
}
module.exports={storeProtectedWordDownload};
