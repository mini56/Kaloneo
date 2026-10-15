'use strict';

// ZIP autonome pour les images personnelles KALONÉO. Format ZIP classique
// (entrées stockées, sans dépendance externe) compatible avec l'import
// ZIP par thèmes et avec l'Explorateur Windows.
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');

const VALID_EXT=new Set(['.png','.jpg','.jpeg','.webp','.gif','.svg']);
const MAX_IMAGE_SIZE=30*1024*1024;
const MAX_ZIP_SIZE=500*1024*1024;
const MAX_ENTRIES=1000;

const CRC_TABLE=Array.from({length:256},(_,index)=>{
  let crc=index;
  for(let k=0;k<8;k++)crc=(crc&1)?(0xEDB88320^(crc>>>1)):(crc>>>1);
  return crc>>>0;
});
function crc32(buffer){
  let crc=0xFFFFFFFF;
  for(const byte of buffer)crc=(CRC_TABLE[(crc^byte)&255]^(crc>>>8))>>>0;
  return (crc^0xFFFFFFFF)>>>0;
}
function segment(value,fallback){
  const clean=String(value||'').normalize('NFC')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g,'-')
    .replace(/\s+/g,' ').replace(/^\.+|\.+$/g,'').trim()
    .slice(0,85).trim();
  return clean&&clean!=='.'&&clean!=='..'?clean:fallback;
}
function writeAll(fd,buf){
  let offset=0;
  while(offset<buf.length){
    const n=fs.writeSync(fd,buf,offset,buf.length-offset);
    if(n<=0)throw new Error('Écriture ZIP interrompue.');
    offset+=n;
  }
}
// Ne jamais lire les fichiers ZIP dans la mémoire globale en même temps.
// Chaque image est vérifiée puis lue individuellement.
function exportImageRecords(records,targetFile){
  if(!Array.isArray(records))throw new Error('Bibliothèque d’images invalide.');
  if(!records.length)return {ok:false,error:'Aucune image personnelle à exporter.'};
  if(records.length>MAX_ENTRIES) return {ok:false,error:'Trop d’images (1000 maximum par ZIP).'};
  const destination=path.resolve(String(targetFile||''));
  if(path.extname(destination).toLowerCase()!=='.zip')
    return {ok:false,error:'Choisissez un fichier .zip.'};
  let estimated=22;
  const entries=[];
  const used=new Set();
  for(const record of records){
    const file=String(record?.binary||'');
    if(!file||!fs.statSync(file).isFile())throw new Error('Image introuvable dans la bibliothèque.');
    const size=fs.statSync(file).size;
    if(!size||size>MAX_IMAGE_SIZE)throw new Error('Image trop volumineuse : '+record.value.name);
    const ext=path.extname(file).toLowerCase();
    if(!VALID_EXT.has(ext))throw new Error('Format non pris en charge : '+record.value.name);
    const name=segment(path.parse(String(record.value.name||'image')).name,'image')+ext;
    const category=segment(record.value.category||'Mes images KALONÉO','Mes images KALONÉO');
    const ori=/^(portrait|paysage)$/i.test(String(record.value.orientation||''))
      ?segment(record.value.orientation,''):'';
    const folder=category+'/'+(ori?ori+'/':'');
    let zipName=folder+name;
    if(used.has(zipName.toLocaleLowerCase('fr'))){
      zipName=folder+segment(path.parse(name).name,'image')+'-'+String(record.value.id).slice(0,12)+ext;
    }
    if(used.has(zipName.toLocaleLowerCase('fr')))throw new Error('Noms d’images en conflit.');
    used.add(zipName.toLocaleLowerCase('fr'));
    const filename=Buffer.from(zipName,'utf8');
    if(filename.length>0xFFFF)throw new Error('Nom d’image trop long.');
    estimated+=30+46+2*filename.length+size;
    if(estimated>MAX_ZIP_SIZE)return {ok:false,error:'Images trop volumineuses pour un ZIP de 500 Mo.'};
    entries.push({file,filename,size});
  }
  const temporary=path.join(path.dirname(destination),'.'+path.basename(destination)+
    '.'+crypto.randomBytes(6).toString('hex')+'.tmp');
  let fd;
  try{
    fd=fs.openSync(temporary,'wx',0o600);
    let position=0;
    const centralParts=[];
    const stampDate=0x0021; // 1er janvier 1980, horodatage neutre
    for(const entry of entries){
      const payload=fs.readFileSync(entry.file);
      if(payload.length!==entry.size)throw new Error('Une image a changé pendant l’export.');
      const hash=crc32(payload);
      const local=Buffer.alloc(30);
      local.writeUInt32LE(0x04034b50,0);
      local.writeUInt16LE(20,4);local.writeUInt16LE(0x0800,6);
      local.writeUInt16LE(0,8);local.writeUInt16LE(stampDate,12);
      local.writeUInt32LE(hash,14);
      local.writeUInt32LE(payload.length,18);local.writeUInt32LE(payload.length,22);
      local.writeUInt16LE(entry.filename.length,26);
      writeAll(fd,local);writeAll(fd,entry.filename);writeAll(fd,payload);
      const central=Buffer.alloc(46);
      central.writeUInt32LE(0x02014b50,0);
      central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);
      central.writeUInt16LE(0x0800,8);central.writeUInt16LE(stampDate,14);
      central.writeUInt32LE(hash,16);
      central.writeUInt32LE(payload.length,20);central.writeUInt32LE(payload.length,24);
      central.writeUInt16LE(entry.filename.length,28);
      central.writeUInt32LE(position,42);
      centralParts.push({header:central,name:entry.filename});
      position+=30+entry.filename.length+payload.length;
    }
    const centralOffset=position;
    for(const item of centralParts){
      writeAll(fd,item.header);writeAll(fd,item.name);
      position+=item.header.length+item.name.length;
    }
    const end=Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50,0);
    end.writeUInt16LE(entries.length,8);
    end.writeUInt16LE(entries.length,10);
    end.writeUInt32LE(position-centralOffset,12);
    end.writeUInt32LE(centralOffset,16);
    writeAll(fd,end);
    fs.closeSync(fd);fd=null;
    fs.renameSync(temporary,destination);
    return {ok:true,filePath:destination,count:entries.length,size:position+22};
  }catch(error){
    if(fd!==undefined&&fd!==null)try{fs.closeSync(fd);}catch(_){}
    try{fs.rmSync(temporary,{force:true});}catch(_){}
    return {ok:false,error:error?.message||String(error)};
  }
}

module.exports={exportImageRecords};
