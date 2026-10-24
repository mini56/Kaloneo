'use strict';
// R168 — Aucune définition, V1 ou image originale n'est réécrite.
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createRenderImageOptimizer}=require('../src/kaloneo-render-image-cache');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kaloneo-r168-image-'));
try{
 const imageBytes=Buffer.alloc(410000,128);
 const original='data:image/jpeg;base64,'+imageBytes.toString('base64');
 const renderBytes=Buffer.alloc(90000,42);
 let calls=0;
 const nativeImage={createFromBuffer(buffer){
  calls++;
  assert(buffer.equals(imageBytes),'Seul le contenu demandé peut être décodé');
  const small={toJPEG(q){assert.equal(q,88);return renderBytes;},toPNG(){throw Error('JPEG only');}};
  return {isEmpty(){return false;},getSize(){return {width:2400,height:1500};},
   resize(args){assert.equal(args.width,1200);return small;},toJPEG:small.toJPEG,toPNG:small.toPNG};
 }};
 const obj=createRenderImageOptimizer({nativeImage,cacheRoot:tmp});
 const item={id:'test',questions:[{prompt:'Intouchable',resource:{data:original}}],
  instructions:'1 point par bonne réponse',nested:[{src:original}]};
 const snapshot=JSON.stringify(item);
 const cloned=JSON.parse(snapshot);
 obj.optimizeDefinition(cloned);
 assert.equal(JSON.stringify(item),snapshot,'Original en mémoire altéré');
 assert.notEqual(cloned.questions[0].resource.data,original,'Copie candidat non allégée');
 assert.equal(cloned.questions[0].resource.data,cloned.nested[0].src,'Réutilisation cache');
 assert.equal(cloned.instructions,item.instructions,'Notation/texte modifiés');
 assert.equal(obj.stats.optimized,1,'Une seule optimisation pour une même image');
 assert.equal(calls,1,'Image traitée plusieurs fois');
 const another=createRenderImageOptimizer({nativeImage,cacheRoot:tmp});
 assert.equal(another.optimizeDataUri(original),cloned.questions[0].resource.data);
 assert.equal(another.stats.optimized,0,'La copie doit être réutilisée entre ouvertures');
 const noImage=createRenderImageOptimizer({nativeImage,cacheRoot:tmp});
 assert.equal(noImage.optimizeDataUri('data:image/svg+xml;base64,'+imageBytes.toString('base64')),
   'data:image/svg+xml;base64,'+imageBytes.toString('base64'),'SVG inchangé');
 const manifestPath=path.join(__dirname,'..','app','web','kaltest-render-images','manifest.json');
 if(process.env.KALONEO_STRICT_RENDER_IMAGES==='1'){
  assert(fs.existsSync(manifestPath),'Images WebP de rendu absentes du Setup Windows');
  const j=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
  assert.equal(j.images.length,2,'Les deux photos doivent être allégées');
  for(const x of j.images){
   assert(x.renderBytes<x.originalBytes*.85,'Optimisation WebP insuffisante');
   assert(fs.existsSync(path.join(__dirname,'..','app','web',x.original)),
     'Bibliothèque originale manquante : '+x.original);
   assert(fs.existsSync(path.join(__dirname,'..','app','web',x.render)),
     'Copie WebP manquante : '+x.render);
  }
 }
 const script=fs.readFileSync(path.resolve(__dirname,'../source/js/kaltest-pilot2-runtime.js'),'utf8');
 for(const filename of ['tri-chevilles-kaloneo.webp','dictee-bureau-soleil.webp'])
  assert(script.includes('kaltest-render-images/'+filename),'Candidat ne charge pas le dérivé');
 const main=fs.readFileSync(path.resolve(__dirname,'../src/main.js'),'utf8');
 assert(main.includes('kaloneoRenderImages.optimizeDefinition(selection.runtime)'),
  'Les autres images des tests ne sont pas allégées');
 assert(main.includes('kaloneoRenderImages.optimizeDefinition(JSON.parse(JSON.stringify(kaloneoBuilderPreviewDefinition)))'),
  'Aperçu Builder non optimisé');
 console.log('KALONEO_R168_RENDER_IMAGES=OK — originals intacts, réutilisation disque/mémoire, PNG/JPEG, WebP photos, 1200px');
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
