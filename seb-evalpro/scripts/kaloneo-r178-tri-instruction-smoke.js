'use strict';
// R178 : le seul changement de la V1 Tri de chevilles est son libellé
// (et la liste explicative alignée). Aucun seuil, chrono, barème ni question ne bouge.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {createKaloneoLibrary}=require('../src/kaloneo-library-main.js');
const root=path.resolve(__dirname,'..');
const official=JSON.parse(fs.readFileSync(path.join(root,'source/kaltest/tests/tri-chevilles/1.0.0/test.json'),'utf8'));
const fixture=JSON.parse(fs.readFileSync(path.join(root,'../tests/fixtures/kaltests/tri-chevilles/1.0.0/test.json'),'utf8'));
const installed=JSON.parse(fs.readFileSync(path.join(root,'app/web/kaltest/tests/tri-chevilles/1.0.0/test.json'),'utf8'));
const expected='Effectuez 5 tris, puis affichez les résultats et complétez l’autoévaluation.';
const old='Effectuez entre 3 et 5 tris, puis affichez les résultats et complétez l’autoévaluation.';
for(const [name,def] of [['source',official],['fixture',fixture],['installer',installed]]){
 assert(def.instruction.includes(expected),name+' ne contient pas le nouveau texte');
 assert(!def.instruction.includes(old),name+' conserve une ancienne consigne');
 assert.equal(def.id,'tri_chevilles');assert.equal(def.version,'1.0.0');
 assert.deepEqual({chrono:def.chrono,presentation:def.presentation,evaluation:def.evaluation,
   runtime:def.runtime,questions:def.questions,outputs:def.outputs,bilanContributions:def.bilanContributions},
   {chrono:official.chrono,presentation:official.presentation,evaluation:official.evaluation,
   runtime:official.runtime,questions:official.questions,outputs:official.outputs,bilanContributions:official.bilanContributions},
   name+' a changé le fonctionnement de la V1');
 assert.equal(def.chrono.minMeasures,3);assert.equal(def.chrono.maxMeasures,5);
 assert.equal(def.presentation.triStation.minTris,3);assert.equal(def.presentation.triStation.maxTris,5);
}
const runtime=fs.readFileSync(path.join(root,'app/web/js/kaltest-pilot2-runtime.js'),'utf8');
assert(runtime.includes('Effectuez <strong>5 tris</strong>.'),'Ancienne consigne visible dans la liste');
assert(runtime.includes('À partir de 3 tris complets'),'Le fonctionnement historique ne doit pas changer');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kaloneo-r178-tri-label-'));
try{
 const seed=path.join(tmp,'seeds'),dst=path.join(tmp,'userdata','KALONEO','Bibliotheque-tests');
 const relative=path.join('tri-chevilles','1.0.0','test.json');
 fs.mkdirSync(path.join(seed,path.dirname(relative)),{recursive:true});
 fs.mkdirSync(path.join(dst,path.dirname(relative)),{recursive:true});
 fs.writeFileSync(path.join(seed,relative),JSON.stringify(official));
 const previous={...official,instruction:official.instruction.replace(expected,old)};
 fs.writeFileSync(path.join(dst,relative),JSON.stringify(previous));
 const untouched=JSON.stringify({...official,id:'other_admin_test',version:'2.0.0'});
 const other=path.join(dst,'other','2.0.0','test.json');
 fs.mkdirSync(path.dirname(other),{recursive:true});fs.writeFileSync(other,untouched);
 const library=createKaloneoLibrary({dataRoot:path.join(tmp,'userdata'),seedTestsRoot:seed});
 const current=library.getTest('tri_chevilles','1.0.0');
 assert(current.ok);assert(current.definition.instruction.includes(expected));
 const after=JSON.parse(fs.readFileSync(path.join(dst,relative),'utf8'));
 const beforeOther=fs.readFileSync(other,'utf8');
 assert.equal(beforeOther,untouched,'Un autre test a été modifié');
 assert.deepEqual({...after,instruction:old},previous,'La migration a changé autre chose que la consigne');
 console.log('KALONEO_R178_UPGRADE_OLD_TRI_LABEL_ONLY=SUCCESS');
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
console.log('KALONEO_R178_TRI_V1_INSTRUCTION_ONLY=SUCCESS');
console.log('KALONEO_R178_TRI_V1_TIMER_SCORING_UNCHANGED=SUCCESS');
