'use strict';
// Banc d'essai : images originales en fichiers partagés, JSON légers.
// Aucune modification des TESTS_V1 sources ni activation dans le Setup.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const MIME_EXT={'image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/gif':'gif','image/svg+xml':'svg'};
const EXT_MIME=Object.fromEntries(Object.entries(MIME_EXT).map(([mime,ext])=>[ext,mime]));
const DATA=/^data:(image\/[a-z0-9+.-]+);base64,([a-z0-9+\/=\s]+)$/i;
const REFERENCE=/^kaloneo-asset:([a-f0-9]{64})\.(png|jpg|webp|gif|svg)$/;
function hash(buffer){return crypto.createHash('sha256').update(buffer).digest('hex');}
function mutate(source,fn,pathParts=[]){
  if(typeof source==='string')return fn(source,pathParts);
  if(Array.isArray(source))return source.map((v,i)=>mutate(v,fn,pathParts.concat(i)));
  if(source&&typeof source==='object'){
    const out={};
    for(const [key,v] of Object.entries(source))out[key]=mutate(v,fn,pathParts.concat(key));
    return out;
  }
  return source;
}
function extract(definition,assetsDir){
  if(!definition||typeof definition!=='object')throw new Error('Définition KALTEST attendue');
  if(!assetsDir)throw new Error('Bibliothèque images requise');
  fs.mkdirSync(assetsDir,{recursive:true});
  const added=new Set(),usage=[];
  const converted=mutate(definition,(value,p)=>{
    if(!/^data:image\//i.test(value)){
      // Toute image intégrée dans une longue chaîne exige un traitement
      // explicite : ne jamais la supprimer ou tronquer silencieusement.
      return value;
    }
    const match=value.match(DATA);
    if(!match)throw new Error('Image intégrée non reconnue : '+p.join('.'));
    const mime=match[1].toLowerCase(),ext=MIME_EXT[mime];
    if(!ext)throw new Error('MIME image non reconnu : '+mime);
    const bytes=Buffer.from(match[2].replace(/\s/g,''),'base64');
    if(!bytes.length||bytes.toString('base64')!==match[2].replace(/\s/g,''))
      throw new Error('Image Base64 illisible : '+p.join('.'));
    const digest=hash(bytes);
    const file=path.join(assetsDir,digest+'.'+ext);
    if(fs.existsSync(file)){
      if(hash(fs.readFileSync(file))!==digest)throw new Error('Image existante corrompue : '+digest);
    }else{
      const temporary=file+'.'+process.pid+'.tmp';
      fs.writeFileSync(temporary,bytes);
      fs.renameSync(temporary,file);
      added.add(digest);
    }
    const nameField=p.length>=2&&p[p.length-1]==='name'&&p[p.length-2]==='resource';
    usage.push({property:p.join('.'),sha256:digest,size:bytes.length,mime,redundantName:nameField});
    // Corrige l'anomalie observée dans deux V1 : 'resource.name'
    // doit être un nom et non une deuxième copie de l'image.
    return nameField?'image-'+digest.slice(0,12)+'.'+ext:
      'kaloneo-asset:'+digest+'.'+ext;
  });
  return {definition:converted,addedCount:added.size,usages:usage};
}
function hydrate(definition,assetsDir){
  return mutate(definition,(value,p)=>{
    if(!value.startsWith('kaloneo-asset:'))return value;
    const m=value.match(REFERENCE);
    if(!m)throw new Error('Référence image malformée : '+p.join('.'));
    const [_,expected,extension]=m;
    const file=path.join(assetsDir,expected+'.'+extension);
    if(!fs.existsSync(file))throw new Error('Image manquante dans la bibliothèque : '+expected);
    const bytes=fs.readFileSync(file);
    if(hash(bytes)!==expected)throw new Error('Image altérée dans la bibliothèque : '+expected);
    return 'data:'+EXT_MIME[extension]+';base64,'+bytes.toString('base64');
  });
}
module.exports={extract,hydrate,MIME_EXT};
