'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const Core=require('../../kaloneo/builder-core.js');
const root=path.resolve(__dirname,'..');
const relative='kaltest/tests/genre-nombre/1.0.0/';
const sourceFile=path.join(root,'source',relative,'test.json');
const fixtureFile=path.resolve(root,'..','tests/fixtures/kaltests/genre-nombre/1.0.0/test.json');
const source=JSON.parse(fs.readFileSync(sourceFile,'utf8'));
const original=JSON.stringify(source);
const fixture=JSON.parse(fs.readFileSync(fixtureFile,'utf8'));
assert.deepEqual(source,fixture,'La version des deux chemins officiels doit rester synchronisee');
assert.equal(source.id,'genre_nombre');
assert.equal(source.version,'1.0.0');
assert.equal(source.questions.length,20,'Genre et Nombre: les 20 questions V1 doivent rester intactes');
assert.equal(source.questions.reduce((n,q)=>n+q.points,0),20,'Bareme historique 20 points conserve');
assert.equal(source.presentation.layout.ratio,'50/50');
assert.equal(source.presentation.tables.length,2);
for(const table of source.presentation.tables){
  assert.equal(table.questionIds.length,10);
  assert.equal(table.builderStyle?.backgroundColor,'#EAF5FB',
    'Les deux blocs doivent etre bleu clair');
}
const banner=source.presentation.builderExtras;
assert.equal(banner?.length,1,'Un seul bandeau sous les tableaux');
assert.equal(banner[0].type,'image');
assert.equal(banner[0].zone,'full','Image en pleine largeur');
const image=banner[0].resource;
assert.equal(image.data,relative+'genre_et_nombre_V1.png');
assert.equal(image.mime,'image/png');
assert(!image.data.startsWith('data:'),'Ne pas dupliquer l image en base64 dans test.json');
const binary=fs.readFileSync(path.join(root,'source',image.data));
assert.equal(binary.subarray(0,8).toString('hex'),'89504e470d0a1a0a','PNG du bandeau invalide');
assert(binary.length<950000,'Bandeau trop lourd');
assert(fs.statSync(sourceFile).size<12000,'Le test V1 JSON doit rester compact');

// Tous les ajouts sont enregistrables et lisibles sans conversion destructive
// des deux tableaux historiques ni des reponses/barèmes.
const model=Core.definitionToModel(source);
assert.deepEqual(model.blocks.map(b=>b.type),
  ['multiple-tables','multiple-tables','image']);
assert.equal(model.blocks[2].zone,'full');
assert.equal(model.blocks[2].mediaData,image.data);
assert.equal(model.blocks[0].backgroundColor,'#EAF5FB');
assert.equal(model.blocks[1].backgroundColor,'#EAF5FB');
assert.deepEqual(Core.modelToDefinition(model),source,'Le simple re-enregistrement doit etre identique');
model.blocks[0].fontSize=24;
model.blocks[1].fontSize=18;
const changed=Core.modelToDefinition(model);
assert.equal(changed.presentation.tables[0].builderStyle.fontSize,24);
assert.equal(changed.presentation.tables[1].builderStyle.fontSize,18);
assert.equal(changed.presentation.tables[0].builderStyle.backgroundColor,'#EAF5FB');
assert.equal(changed.presentation.tables[1].builderStyle.backgroundColor,'#EAF5FB');
assert.equal(changed.presentation.builderContent,undefined,
  'Ne pas convertir une V1 historique en Builder generique');
assert.deepEqual(changed.questions,source.questions,'Aucune question/correction modifiee');
const reopened=Core.definitionToModel(changed);
assert.deepEqual(reopened.blocks.map(b=>b.fontSize),[24,18,'']);
assert.equal(reopened.blocks[2].mediaData,image.data);
assert.deepEqual(Core.modelToDefinition(reopened),changed,
  'Deux fonds et bandeau maintenus apres sauvegarde et reouverture');
reopened.blocks[0].fontSize='';
const reset=Core.modelToDefinition(reopened);
assert.equal(reset.presentation.tables[0].builderStyle.backgroundColor,'#EAF5FB');
assert(!Object.hasOwn(reset.presentation.tables[0].builderStyle,'fontSize'));
assert.equal(reset.presentation.tables[1].builderStyle.fontSize,18);
assert.deepEqual(reset.questions,source.questions);
assert.equal(JSON.stringify(source),original,'La V1 de depart ne doit pas etre modifiee en memoire');

// Le rendu utilise le PNG partage par reference, une seule fois dans le setup.
const candidate=fs.readFileSync(path.join(root,'source/js/kaltest-pilot2-runtime.js'),'utf8');
assert(candidate.includes('test.presentation?.builderExtras'),'Rendu bandeau historique absent');
const preview=fs.readFileSync(path.resolve(root,'..','kaloneo/test-preview.js'),'utf8');
const inlinePreview=fs.readFileSync(path.resolve(root,'..','kaloneo/test-builder.js'),'utf8');
for(const [filename,content] of [['preview',preview],['builder',inlinePreview]]){
  assert(content.includes('kaltest\\/tests\\/'),
    'L image externe doit etre resolue depuis la page Builder : '+filename);
}
console.log('KALONEO_GENRE_NOMBRE_DIRECT_V1=OK - 2 fonds bleus, bandeau PNG reference, 20/20 points');
console.log('KALONEO_GENRE_NOMBRE_ROUNDTRIP=OK - 3 blocs conserves a la reouverture');
