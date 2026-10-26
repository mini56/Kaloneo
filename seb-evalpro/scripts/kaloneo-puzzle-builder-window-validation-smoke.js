'use strict';
// Contrôle ciblé : la fenêtre du Puzzle V1 est correctement validée par
// le Builder tout en conservant les mêmes fichiers, réponses et barème.
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const Core=require('../../kaloneo/builder-core.js');
const root=path.resolve(__dirname,'..','..');
const definition=JSON.parse(fs.readFileSync(
  path.join(root,'seb-evalpro/source/kaltest/tests/gratte-ciel/1.0.0/test.json'),'utf8'));
const example=definition.presentation.supplementaryWindows.find(
  x=>x.id==='puzzle_exemple_gratte_ciel');
assert.equal(definition.id,'gratte_ciel');
assert.equal(definition.version,'1.0.0');
assert.equal(definition.questions.length,16);
assert.equal(definition.questions.reduce((s,q)=>s+Number(q.points||0),0),16);
assert.equal(example.type,'image');
assert.equal(example.imageData,'kaltest/tests/gratte-ciel/1.0.0/ex_carre_ magique.png');
assert.equal(Core.isSupplementaryWindowImageResource(example.imageData),true);
const png=fs.readFileSync(path.join(root,'seb-evalpro/source',example.imageData));
assert(png.length>10000 && png.subarray(0,8).toString('hex')==='89504e470d0a1a0a');
assert(Core.isSupplementaryWindowImageResource('data:image/png;base64,AAAA'));
assert(Core.isSupplementaryWindowImageResource('imageqcm/gratteciel.png'));
assert(Core.isSupplementaryWindowImageResource('assets/example.webp'));
for(const bad of ['',null,'https://example.org/example.png','example.docx','assets/example.exe']){
  assert.equal(Core.isSupplementaryWindowImageResource(bad),false);
}
const htmlSource=fs.readFileSync(path.join(root,'kaloneo/test-builder.js'),'utf8');
assert(htmlSource.includes('Core.isSupplementaryWindowImageResource(entry.imageData)'));
const roundtrip=Core.modelToDefinition(Core.definitionToModel(definition));
assert.deepEqual(roundtrip.presentation.supplementaryWindows,definition.presentation.supplementaryWindows);
assert.deepEqual(roundtrip.questions,definition.questions);
console.log('KALONEO_PUZZLE_BUILDER_VALIDATION=SUCCESS');
console.log('KALONEO_PUZZLE_V1_UNCHANGED=SUCCESS');
