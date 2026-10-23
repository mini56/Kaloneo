'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),repo=path.resolve(root,'..');
const originals=path.join(root,'source','kaltest','tests');
const bundled=path.join(root,'app','web','kaltest','tests');
function filesIn(dir){
 const out=[];
 for(const e of fs.readdirSync(dir,{withFileTypes:true})){
   const p=path.join(dir,e.name);
   if(e.isDirectory())out.push(...filesIn(p));
   else if(e.isFile()&&e.name==='test.json')out.push(p);
 }
 return out;
}
const seeds=filesIn(originals),actual=filesIn(bundled);
assert.equal(seeds.length,24,'24 original V1 JSON expected (includes intro and final)');
assert.equal(actual.length,seeds.length,'No newly added V1 allowed in R160 comparison');
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
for(const original of seeds){
 const compiled=path.join(bundled,path.relative(originals,original));
 assert(fs.existsSync(compiled),'Missing original V1 '+original);
 assert.equal(sha(compiled),sha(original),'Original V1 was changed '+original);
}
const manifest=JSON.parse(fs.readFileSync(path.join(root,'app','web','kaltest','TESTS_V1-manifest.json'),'utf8'));
assert.equal(manifest.format,'kaloneo-official-v1-overrides');
assert.deepEqual(manifest.tests,[],'Five TESTS_V1 must not ship');
const ids=new Set(seeds.map(file=>JSON.parse(fs.readFileSync(file,'utf8')).id));
for(const id of ['affiche_promotions_prix','calcul_arithmetique','p']) assert(!ids.has(id),'New V1 unexpectedly included '+id);
for(const id of ['organisation_demenagement','planning_cantine']) assert(ids.has(id),'Old V1 missing '+id);
for(const id of ['affiche_promotions_prix','calcul_arithmetique','organisation_demenagement','p','planning_cantine']){
 assert(fs.existsSync(path.join(repo,'TESTS_V1',id+'-1.0.0-test.json')),'GitHub export missing '+id);
}
console.log('KALONEO_R160_ORIGINAL_ONLY=OK — 24 original V1, five exports kept in GitHub only');
