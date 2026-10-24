'use strict';
// Vérification stricte des images supplémentaires livrées avec le logiciel.
// Tous les octets d'origine GitHub sont conservés ; aucun profil candidat touché.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),os=require('node:os');
const root=path.resolve(__dirname,'..'),repo=path.resolve(root,'..');
const source=path.join(root,'source','bibliotheque-images');
const shipped=path.join(root,'app','web','bibliotheque-images');
const {CATEGORY,classify,loadSuppliedImages}=require('../src/kaloneo-supplied-images');
const gallery=require('../../kaloneo/image-library-gallery');
const {createKaloneoLibrary}=require('../src/kaloneo-library-main');
const manifest=JSON.parse(fs.readFileSync(path.join(source,'catalogue-images.json'),'utf8'));
assert(manifest.schemaVersion===1&&manifest.files.length>=209,'Lot GitHub incomplet : 209 images attendues');
const validExt=/\.(png|jpe?g|webp|gif|svg)$/i;
const found=[];
function walk(d,prefix=''){
  for(const entry of fs.readdirSync(d,{withFileTypes:true})){
    const relative=prefix?prefix+'/'+entry.name:entry.name,abs=path.join(d,entry.name);
    if(entry.isDirectory())walk(abs,relative);
    else if(entry.isFile()&&validExt.test(relative))found.push(relative);
  }
}
walk(source);
assert.equal(found.length,manifest.files.length,'Une image du lot manque au catalogue');
const indexed=new Set(manifest.files.map(x=>x.path));
assert.deepEqual([...indexed].sort(),found.sort(),'Images oubliées ou path mal classé');
const hashes=new Set(), counts=new Map();let bytes=0;
for(const file of manifest.files){
  const abs=path.join(source,...file.path.split('/'));
  const buffer=fs.readFileSync(abs);
  assert.equal(buffer.length,file.bytes,'Taille de fichier changée : '+file.path);
  const digest=crypto.createHash('sha1')
    .update(Buffer.from('blob '+buffer.length+'\0')).update(buffer).digest('hex');
  assert.equal(digest,file.sha1,'Image altérée : '+file.path);
  assert(!hashes.has(digest),'Duplicata exact non regroupé : '+file.path);
  hashes.add(digest);bytes+=buffer.length;
  const classified=classify(file.path);
  assert(classified&&classified.theme&&classified.name,'Thème non défini : '+file.path);
  counts.set(classified.theme,(counts.get(classified.theme)||0)+1);
}
assert(bytes>100000000,'Lot source incomplet');
assert(counts.has('Fin de parcours')&&counts.has('Activités professionnelles')&&
  counts.has('Horaires et temps')&&counts.has('Objets et décors')&&
  counts.has('Bandeaux et paysages'),'Famille d images manquante');
assert.equal(fs.readdirSync(shipped).length>=2,true,'Copies embarquées introuvables');
const installed=loadSuppliedImages(shipped);
assert.equal(installed.length,found.length,'Catalogue embarqué incomplet');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'kaloneo-images-pack-'));
try{
 const library=createKaloneoLibrary({dataRoot:temp,suppliedImagesRoot:shipped});
 const meta=library.listImages().filter(x=>x.category===CATEGORY);
 assert.equal(meta.length,found.length,'Images absentes de la bibliothèque KALONÉO');
 assert.equal(new Set(meta.map(x=>x.id)).size,meta.length,'ID image fourni en double');
 assert(meta.every(x=>x.systemProvided===true),'Les images doivent être marquées fournies');
 const galleryList=gallery.prepare(meta).images;
 assert.equal(galleryList.length,meta.length,'Image cachée par erreur dans la galerie');
 assert(new Set(galleryList.map(gallery.theme)).size>=7,'Pas assez de thèmes distincts');
 const samples=['Fin de parcours','Activités professionnelles','Horaires et temps',
    'Objets et décors','Bandeaux et paysages','Comptabilité et magasinage',
    'Illustrations générales','Vie quotidienne','Bureaux et apprentissage'];
 for(const theme of samples){
   const selected=galleryList.find(x=>gallery.theme(x)===theme);
   assert(selected,'Illustrations non classées : '+theme);
   assert(gallery.matchesTheme(selected,theme),'Recherche par thème impossible : '+theme);
   const image=library.getImage(selected.id);
   assert(image?.ok,image?.error||'Lecture image impossible');
   assert(image.image.data.startsWith('data:image/'),'Image non réutilisable dans le Builder');
   assert.equal(Buffer.from(image.image.data.split(',')[1],'base64').length,image.image.size,
     'Données image endommagées : '+selected.sourceName);
   assert(!fs.existsSync(path.join(temp,'KALONEO','Bibliotheque-images',selected.id)),
     'Copie injustifiée des images dans le profil au démarrage : '+selected.id);
 }
 const first=meta[0];
 const again=createKaloneoLibrary({dataRoot:temp,suppliedImagesRoot:shipped});
 assert(again.listImages().some(x=>x.id===first.id),'Images perdues au redémarrage');
 const zip=again.exportImageZip(path.join(temp,'export.zip'));
 assert(!zip.ok,'Les images système ne doivent pas figurer dans un export personnel');
 console.log('KALONEO_SUPPLIED_IMAGES=OK — '+meta.length+' images, '+counts.size+
    ' thèmes, '+bytes+' octets conservés, lecture ciblée, zéro duplication AppData');
}catch(error){console.error('KALONEO_SUPPLIED_IMAGES=FAIL',error.stack||String(error));process.exitCode=2;}
finally{fs.rmSync(temp,{recursive:true,force:true});}

// R165 : les deux illustrations sont également disponibles dans la bibliothèque commune.
for(const name of ['tri-chevilles-kaloneo.png','dictee-bureau-soleil.png']){
 const rel='illustrations-tests/'+name;
 assert(indexed.has(rel),'Illustration non référencée : '+rel);
 assert(fs.existsSync(path.join(shipped,'illustrations-tests',name)), 'Illustration absente du rendu : '+rel);
}
