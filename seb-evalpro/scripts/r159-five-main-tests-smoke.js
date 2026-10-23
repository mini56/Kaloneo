'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {loadOfficialOverrides}=require('./kaloneo-testsv1');
const {hydrate}=require('../src/kaloneo-v1-image-assets');
const root=path.resolve(__dirname,'..'),repo=path.resolve(root,'..');
const source=path.join(root,'source','kaltest','tests');
const generated=path.join(root,'app','web','kaltest','tests');
const expected=['affiche_promotions_prix','calcul_arithmetique','organisation_demenagement','p','planning_cantine'];
const {overrides,baseline}=loadOfficialOverrides(repo,source);
assert.deepEqual([...overrides.keys()].sort(),expected,'Only the five V1 exports of main are authorized');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'app','web','kaltest','TESTS_V1-manifest.json'),'utf8'));
assert.equal(manifest.format,'kaloneo-official-v1-overrides');
assert.deepEqual(manifest.tests.map(x=>x.id).sort(),expected);
const results=[];
for(const id of expected){
 const o=overrides.get(id);
 assert(o && o.definition.version==='1.0.0' && o.definition.kaltestFormat===1);
 assert(o.relative.endsWith('/1.0.0/test.json')||o.relative.includes('\\1.0.0\\test.json'));
 const light=JSON.parse(fs.readFileSync(path.join(generated,o.relative),'utf8'));
 const assets=path.join(root,'app','web','kaltest','v1-assets');
 assert(Buffer.byteLength(JSON.stringify(light))<100000,'V1 JSON should be lightweight');
 const data=hydrate(light,assets);
 const canonical=JSON.parse(JSON.stringify(o.definition));
 function fixNames(x){
   if(Array.isArray(x))return x.forEach(fixNames);
   if(!x||typeof x!=='object')return;
   if(x.resource&&typeof x.resource.name==='string'&&
      (x.resource.name.startsWith('data:image/')||/^image-[a-f0-9]{12}\./.test(x.resource.name))){
     x.resource.name='même-image-normalisée'; // Deux copies de l'image intégrée corrigées
   }
   for(const v of Object.values(x))fixNames(v);
 }
 fixNames(data);fixNames(canonical);
 assert.equal(data.id,id);
 assert.equal(data.title,o.definition.title);
 assert.deepEqual(data.questions,canonical.questions,'Do not alter questions or answers');
 assert.deepEqual(data.presentation,canonical.presentation,'Do not alter visual template');
 const fields=new Set(data.outputs.map(x=>x.id));
 assert(fields.has('score')&&fields.has('score_max'),'Score must expose raw points');
 assert(Array.isArray(data.bilanContributions)&&data.bilanContributions.length===1);
 assert.equal(data.bilanContributions[0].bindings.score,'score');
 assert.equal(data.bilanContributions[0].bindings.score_max,'score_max');
 const images=(JSON.stringify(data).match(/data:image\//g)||[]).length;
 assert(images>=1,'Imported visual test must keep its embedded images');
 if(baseline.has(id)){
   const previous=JSON.parse(fs.readFileSync(baseline.get(id).file,'utf8'));
   assert.equal(previous.id,id);
   assert.notEqual(JSON.stringify(previous),JSON.stringify(data),'Edited reference must replace the baseline');
 }
 results.push({id,kind:baseline.has(id)?'replace V1':'new test',questions:data.questions.length,images});
}
assert.equal(results.filter(x=>x.kind==='replace V1').length,2);
assert.equal(results.filter(x=>x.kind==='new test').length,3);
console.log('KALONEO_R159_FIVE_TESTS=OK — '+JSON.stringify(results));
