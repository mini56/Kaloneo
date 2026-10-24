'use strict';
// R165 : vérifier les nouveaux médias, le strict cloisonnement et les détails NSIS.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),read=(p)=>fs.readFileSync(path.resolve(root,p),'utf8');
const runtime=read('source/js/kaltest-pilot2-runtime.js');
const css=read('source/css/kaltest-pilot2.css');
const installer=read('build/installer.nsh');
const catalog=JSON.parse(read('source/bibliotheque-images/catalogue-images.json'));
assert.equal(catalog.files.length,209);
for(const name of ['tri-chevilles-kaloneo.png','dictee-bureau-soleil.png']){
 const rel='illustrations-tests/'+name;
 const file=path.resolve(root,'source/bibliotheque-images',rel);
 const record=catalog.files.find(x=>x.path===rel);
 assert(record,'Non cataloguée : '+rel);
 const b=fs.readFileSync(file);
 assert(b.length>1000000,'Image de qualité insuffisante : '+rel);
 assert.equal(b.length,record.bytes,'Taille altérée : '+rel);
 const digest=crypto.createHash('sha1').update(Buffer.from('blob '+b.length+'\0')).update(b).digest('hex');
 assert.equal(digest,record.sha1,'SHA1 incorrect : '+rel);
 assert(fs.existsSync(path.resolve(root,'app/web/bibliotheque-images',rel)),'Image non embarquée : '+rel);
 assert(runtime.includes('bibliotheque-images/'+rel),'Image absente du candidat : '+rel);
}
assert(runtime.includes('guide.appendChild(triIllustration)'),'Illustration hors guide du Tri');
assert(runtime.includes('player.append(playerTitle, audio, controls, progressRow, count, audioStatus, dictationIllustration)'),'Illustration Dictée non placée après audio');
const visual=css.split('/* R165 — esthétique strictement isolée')[1];
assert(visual&&!/\.kaltest-tri-right\s*\{/.test(visual),'Bloc droit Tri modifié');
assert(visual.includes('kaltest-tri-left')&&visual.includes('#edaa54'),'Couleurs absentes');
assert(visual.includes('width:52px!important'),'Icône candidat trop petite');
assert(read('../kaloneo/test-preview.css').includes('.kb-heading-icon{width:56px'),'Icône Builder trop petite');
assert(installer.includes('MUI_PAGE_CUSTOMFUNCTION_SHOW KaloneoShowInstallDetails'));
assert(installer.includes('Function KaloneoShowInstallDetails')&&installer.includes('SetDetailsView show'));
assert(installer.includes('MUI_INSTFILESPAGE_SHOWDETAILS'));
console.log('KALONEO_R165_VISUAL_SMOKE=OK (209 images, Tri isolé, dictée, icônes, détails NSIS)');
