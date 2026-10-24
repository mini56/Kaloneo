'use strict';
// KALONÉO R168 — optimiser UNIQUEMENT les copies d'affichage.
// Les images originales, les définitions V1, l'édition, la notation et les exports
// ne passent jamais par ce cache. Aucun module natif tiers nécessaire.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const IMAGE=/^data:(image\/(?:png|jpeg|webp));base64,([a-z0-9+/=]+)$/i;
const VERSION='r168-v1',MAX_WIDTH=1200,MIN_BYTES=160*1024;
function createRenderImageOptimizer({nativeImage,cacheRoot,maxWidth=MAX_WIDTH}={}){
 const memory=new Map();
 const supported=Boolean(nativeImage&&typeof nativeImage.createFromBuffer==='function');
 const safeWidth=Math.min(1600,Math.max(320,Math.floor(Number(maxWidth)||MAX_WIDTH)));
 const root=cacheRoot?path.resolve(cacheRoot):'';
 const stats={optimized:0,cached:0,unchanged:0,errors:0,originalBytes:0,renderBytes:0};
 function optimizeDataUri(value){
  if(!supported||!root||typeof value!=='string')return value;
  const m=IMAGE.exec(value);
  if(!m)return value;
  const mime=m[1].toLowerCase();
  if(m[2].length<MIN_BYTES*4/3)return value;
  let original;
  try{ original=Buffer.from(m[2],'base64'); }
  catch(_){stats.errors++;return value;}
  if(original.length<MIN_BYTES||original.length>24*1024*1024)return value;
  const key=crypto.createHash('sha256').update(original).digest('hex')+'-'+VERSION+'-'+safeWidth;
  if(memory.has(key)){stats.cached++;return memory.get(key);}
  let result=value;
  try{
   const image=nativeImage.createFromBuffer(original);
   if(!image||image.isEmpty())throw Error('Image illisible');
   const {width,height}=image.getSize();
   if(!width||!height||width*height>100*1000*1000)throw Error('Dimensions invalides');
   // PNG et WebP : le format PNG protège textes et transparence.
   // JPEG : recompression de bonne qualité ; aucune modification de source.
   const ext=mime==='image/jpeg'?'jpg':'png';
   const cacheFile=path.join(root,key+'.'+ext);
   const skipped=path.join(root,key+'.skip');
   let render;
   if(fs.existsSync(cacheFile))render=fs.readFileSync(cacheFile);
   else if(!fs.existsSync(skipped)){
    const targetWidth=Math.min(safeWidth,width);
    // Les images déjà petites/compactes restent intactes.
    const candidate=targetWidth<width?image.resize({width:targetWidth,quality:'best'}):image;
    render=ext==='jpg'?candidate.toJPEG(88):candidate.toPNG();
    if(!Buffer.isBuffer(render)||render.length>=original.length*.88){
     render=null;
     fs.mkdirSync(root,{recursive:true});
     fs.writeFileSync(skipped,'unchanged');
    }else{
     fs.mkdirSync(root,{recursive:true});
     const tmp=cacheFile+'.'+process.pid+'.tmp';
     fs.writeFileSync(tmp,render);
     try{fs.renameSync(tmp,cacheFile);}catch(error){fs.rmSync(tmp,{force:true});if(!fs.existsSync(cacheFile))throw error;}
     stats.optimized++;
    }
   }
   if(render){
    result='data:image/'+(ext==='jpg'?'jpeg':'png')+';base64,'+render.toString('base64');
    stats.originalBytes+=original.length;stats.renderBytes+=render.length;
   }else stats.unchanged++;
  }catch(error){stats.errors++;result=value;}
  memory.set(key,result);
  return result;
 }
 function optimizeDefinition(definition){
  if(!definition||typeof definition!=='object')return definition;
  const seen=new WeakSet();
  function walk(node){
   if(typeof node==='string')return optimizeDataUri(node);
   if(!node||typeof node!=='object'||seen.has(node))return node;
   seen.add(node);
   if(Array.isArray(node)){for(let i=0;i<node.length;i++)node[i]=walk(node[i]);}
   else for(const key of Object.keys(node))node[key]=walk(node[key]);
   return node;
  }
  return walk(definition);
 }
 return Object.freeze({optimizeDataUri,optimizeDefinition,stats,supported});
}
module.exports={createRenderImageOptimizer,MAX_WIDTH};
