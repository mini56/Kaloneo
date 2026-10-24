'use strict';
// R167 — HD d'origine conservée et utilisée par les deux exercices,
// un seul exemplaire par image dans la bibliothèque KALONÉO.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.resolve(root,p),'utf8');
const catalog=JSON.parse(read('source/bibliotheque-images/catalogue-images.json'));
const images=[
 {rel:'illustrations-tests/tri-chevilles-kaloneo.png',sha:'83f53321ff704a90a1b7a7be7af6fadec6ecd9c7'},
 {rel:'Bureau d’apprentissage au soleil.png',sha:'0dbf6c2e5eda368f3653c95d8db3ec253915f683'}
];
assert.equal(catalog.files.length,208,'208 images uniques attendues');
const paths=new Set(catalog.files.map(f=>f.path));
assert.equal(paths.size,208,'Catalogue contient des noms doubles');
assert.equal(new Set(catalog.files.map(f=>f.sha1)).size,208,'Catalogue contient des images identiques');
for(const {rel,sha} of images){
 const info=catalog.files.find(f=>f.path===rel);
 assert(info,'Image originale HD non cataloguée : '+rel);
 const source=path.resolve(root,'source/bibliotheque-images',rel);
 const shipped=path.resolve(root,'app/web/bibliotheque-images',rel);
 const bytes=fs.readFileSync(source);
 assert(bytes.length>1_000_000,'Image floue/compressée interdite : '+rel);
 assert.equal(bytes.length,info.bytes,'Image source altérée : '+rel);
 assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a','PNG original obligatoire : '+rel);
 assert(bytes.readUInt32BE(16)>=900 && bytes.readUInt32BE(20)>=500,'Définition HD insuffisante : '+rel);
 const digest=crypto.createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex');
 assert.equal(digest,sha,'Original GitHub modifié : '+rel);
 assert.equal(info.sha1,sha,'Manifest SHA incorrect : '+rel);
 assert(fs.existsSync(shipped),'Image HD manquante dans Electron : '+rel);
 assert(fs.readFileSync(shipped).equals(bytes),'Octets PNG altérés par packaging');
}
for(const obsolete of ['illustrations-tests/tri-chevilles-kaloneo.webp',
 'illustrations-tests/dictee-bureau-soleil.webp',
 'illustrations-tests/dictee-bureau-soleil.png']){
 assert(!paths.has(obsolete),'Doublon ancien présent dans la bibliothèque : '+obsolete);
 assert(!fs.existsSync(path.resolve(root,'source/bibliotheque-images',obsolete)),
 'Fichier image en double : '+obsolete);
}
const runtime=read('source/js/kaltest-pilot2-runtime.js');
const css=read('source/css/kaltest-pilot2.css');
assert(runtime.includes("triIllustration.src='kaltest-render-images/tri-chevilles-kaloneo.webp'"));
assert(runtime.includes("triIllustration.src='bibliotheque-images/illustrations-tests/tri-chevilles-kaloneo.png'"));
assert(runtime.includes("dictationIllustration.src='kaltest-render-images/dictee-bureau-soleil.webp'"));
assert(runtime.includes("dictationIllustration.src='bibliotheque-images/Bureau d’apprentissage au soleil.png'"));
assert(runtime.includes('guide.appendChild(triIllustration)'),'Image Tri non limitée au bloc gauche');
assert(runtime.includes('player.append(playerTitle, audio, controls, progressRow, count, audioStatus, dictationIllustration)'),
 'Commandes audio Dictée modifiées');
const after=css.split('/* R167 — Intégration des originaux HD')[1];
assert(after,'Règles R167 absentes');
assert(/\.kaltest-tri-illustration\s*\{[^}]*object-fit:cover!important;/.test(after),
 'Les marges blanches latérales du Tri ne sont pas éliminées');
assert(!/\.kaltest-tri-right\s*\{/.test(after),'Panneau droit du Tri modifié');
assert(runtime.includes("document.body.classList.add('kaloneo-real-candidate-preview-full')"));
assert(/body\.kaloneo-real-candidate-preview-full #page-exercise \.kaltest-progress\s*\{[^}]*position:fixed!important;/.test(after),
 'La mention Aperçu doit être hors du flux');
assert(after.includes('top:8px!important;')&&after.includes('left:12px!important;'),
 'La mention Aperçu doit être en haut à gauche');
assert(!css.includes('body.kaloneo-real-candidate-preview #page-exercise .kaltest-progress{'),
 'Ne pas déplacer le statut sur la miniature candidate');
console.log('KALONEO_R167_HD_PREVIEW=OK — 2 PNG HD originaux, 208 images uniques, Tri plein cadre et aperçu hors-flux');
