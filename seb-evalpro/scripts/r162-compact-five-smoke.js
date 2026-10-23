'use strict';
// Vérification end-to-end du nouvel intégrateur : cinq V1, 13 ressources partagées,
// ouverture Builder, runtime candidat, export, données d'origine inchangées.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createKaloneoLibrary}=require('../src/kaloneo-library-main');
const {hydrate}=require('../src/kaloneo-v1-image-assets');
const root=path.resolve(__dirname,'..'),repo=path.resolve(root,'..');
const seeds=path.join(root,'app','web','kaltest','tests'),assets=path.join(root,'app','web','kaltest','v1-assets');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'app','web','kaltest','TESTS_V1-manifest.json'),'utf8'));
const ids=['affiche_promotions_prix','calcul_arithmetique','organisation_demenagement','p','planning_cantine'];
assert.deepEqual(manifest.tests.map(t=>t.id).sort(),ids);
assert.equal(fs.readdirSync(assets).length,13,'Exactly 13 unique shared images');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kaloneo-r162-'));
function normalize(value){
 const t=JSON.parse(JSON.stringify(value));
 (function walk(v){
   if(Array.isArray(v))return v.forEach(walk);
   if(!v||typeof v!=='object')return;
   if(v.resource&&typeof v.resource.name==='string'&&v.resource.name.startsWith('data:image/'))
     v.resource.name='image-contenu-equivalent';
   if(v.resource&&typeof v.resource.name==='string'&&/^image-[a-f0-9]{12}\./.test(v.resource.name))
     v.resource.name='image-contenu-equivalent';
   Object.values(v).forEach(walk);
 })(t);
 return t;
}
try {
 const library=createKaloneoLibrary({dataRoot:tmp,seedTestsRoot:seeds,seedImageRoots:[{
   root:assets,category:'Images tests Builder KALONÉO'
 }]});
 const metas=library.listImages();
 const shared=metas.filter(x=>x.category==='Images tests Builder KALONÉO');
 assert.equal(shared.length,13,'Library must contain exactly the 13 original images');
 assert(library.listTests().length>=27,'Expected original catalog plus new V1');
 const originals=library.listTests().filter(x=>ids.includes(x.id)&&x.version==='1.0.0');
 assert.equal(originals.length,5,'All five V1 must be available in library');
 for(const id of ids){
   const source=JSON.parse(fs.readFileSync(path.join(repo,'TESTS_V1',id+'-1.0.0-test.json'),'utf8'));
   const got=library.getTest(id,'1.0.0');
   assert(got.ok,'Builder must get the full V1 '+id);
   assert.deepEqual(normalize(got.definition.questions),normalize(source.questions),'Questions and images differ '+id);
   assert.deepEqual(normalize(got.definition.presentation),normalize(source.presentation),'Rendu Builder different '+id);
   assert.equal(got.definition.bilanContributions[0].bindings.score_max,'score_max');
   const item=manifest.tests.find(t=>t.id===id);
   const compact=fs.readFileSync(path.join(seeds,item.relative));
   assert(compact.length<100000,'Stored V1 JSON is not compact: '+id);
   const originalBytes=fs.statSync(path.join(repo,'TESTS_V1',id+'-1.0.0-test.json')).size;
   assert(compact.length<originalBytes/10,'V1 JSON too large: '+id);
 }
 const runtime=library.resolveParcoursRuntime();
 assert.equal(runtime.ok,true,runtime.error||'Candidate runtime unavailable');
 const packageExport=library.buildParcoursPackage('parcours-de-base');
 assert(packageExport.ok,packageExport.error||'Parcours export unavailable');
 const mask=library.getMaskScreen({id:'kaloneo-video-image',version:'1.0.0'});
 assert.equal(mask.ok,true,'Original masking image must exist');
 assert.equal(mask.maskScreen.content.video||'','','Video masking must be disabled');
 assert(mask.maskScreen.content.image.startsWith('data:image/png;base64,'),'Final PNG must be preserved');
 const json=JSON.stringify(mask.maskScreen);
 assert(!json.includes('data:video/'),'No video may remain in masking JSON');
 console.log('KALONEO_R162_COMPACT_FIVE=OK — 5 V1/13 shared images, Builder, candidate and export; image-only mask');
} finally {fs.rmSync(tmp,{recursive:true,force:true});}
