'use strict';
/* R156: authorize exactly ONE official V1 correction. No historical answers,
   image, test ID/version, or other V1 must change. */
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const {createKaloneoLibrary}=require('../src/kaloneo-library-main');
const {evaluateTest}=require('../../kaltest-contract/src/evaluate-questionnaire');
const routing=require('../source/js/kaloneo-bilan-routing');
const {aggregateInstitutionalRows}=require('../src/institutional-bilan-grid');
const root=path.resolve(__dirname,'..');
const repository=path.resolve(root,'..');
const relative='seb-evalpro/source/kaltest/tests/gestes-postures/1.0.0/test.json';
const src=path.join(repository,relative);
const fixture=path.join(repository,'tests/fixtures/kaltests/gestes-postures/1.0.0/test.json');
const definition=JSON.parse(fs.readFileSync(src,'utf8'));
const duplicate=JSON.parse(fs.readFileSync(fixture,'utf8'));
const official='bilan.savoirs_fondamentaux.competences_transversales.mobiliser_competences';
assert.deepEqual(definition,duplicate,'Source et fixture V1 Gestes doivent rester identiques');
assert.equal(definition.id,'gestes_postures');
assert.equal(definition.version,'1.0.0');
assert.equal(definition.category,'competences_transversales');
assert.equal(definition.scored,true);
assert.deepEqual(definition.bilanContributions,[{lineId:official,bindings:{score:'score',score_max:'score_max'}}]);
assert(routing.compatible(definition.category,official),'La catégorie doit être compatible avec la ligne institutionnelle');
assert.equal(routing.rowFor(official),'competences-transversales');
assert.deepEqual(definition.evaluation.uniqueGroups[0].allowedValues,['2','3','5']);
assert.deepEqual(definition.questions.map(q=>q.points),[1,1,1]);
const result=evaluateTest(definition,{posture_1:'2',posture_2:'3',posture_3:'5'});
assert.equal(result.score,3);assert.equal(result.scoreMax,3);assert.equal(result.percentage,100);
const collected=routing.collect([definition],id=>id==='gestes_postures'?{result:{score:result.score,scoreMax:result.scoreMax,percentage:result.percentage}}:null);
assert.equal(collected.entries.get('competences-transversales').length,1);
assert.deepEqual(collected.entries.get('competences-transversales')[0].pair,{score:3,max:3});
const rows=aggregateInstitutionalRows([{date:'2026-10-23',archive:{document:{rows:[{
 kind:'item',key:'competences-transversales',points:3,possible:3,level:'I'
}]}}}]).rows;
assert.equal(rows.find(row=>row.key==='competences-transversales').percent,100);
// Exact comparison with the previous released R155 definition: ONLY two fields change.
const previous=JSON.parse(cp.execFileSync('git',['show','seb-kaloneo-r155-single-builder-link-test:'+relative],{cwd:repository,encoding:'utf8'}));
const restored={...definition,category:previous.category,bilanContributions:previous.bilanContributions};
assert.deepEqual(restored,previous,'La V1 a subi une autre modification interdite');
assert.equal(previous.category,'prevention');
assert.deepEqual(previous.bilanContributions,[]);
const work=fs.mkdtempSync(path.join(os.tmpdir(),'kaloneo-r156-v1-'));
try{
 const oldSeed=path.join(work,'old-seeds');
 const v1File=path.join(oldSeed,'gestes-postures','1.0.0','test.json');
 fs.mkdirSync(path.dirname(v1File),{recursive:true});
 fs.writeFileSync(v1File,JSON.stringify(previous));
 let library=createKaloneoLibrary({dataRoot:path.join(work,'user-data'),seedTestsRoot:oldSeed});
 assert.equal(library.getTest('gestes_postures','1.0.0').definition.category,'prevention');
 // Simulate installation of the new Setup over a PC that already contains V1.
 library=createKaloneoLibrary({dataRoot:path.join(work,'user-data'),seedTestsRoot:path.join(root,'source','kaltest','tests')});
 const updated=library.getTest('gestes_postures','1.0.0');
 assert(updated.ok);
 assert.equal(updated.definition.category,'competences_transversales','V1 existante doit être mise à jour');
 assert.deepEqual(updated.definition.bilanContributions,definition.bilanContributions);
 assert.equal(updated.definition.version,'1.0.0','Ne pas créer de version 2.0.0');
}finally{fs.rmSync(work,{recursive:true,force:true});}
console.log('KALONEO_R156_GESTES_POSTURES_V1=OK — changement V1 unique, 2/3/5, score 3/3, 18e ligne, mise à jour lors du Setup');
