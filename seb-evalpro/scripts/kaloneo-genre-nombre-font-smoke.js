'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Core=require('../../kaloneo/builder-core.js');
const source=JSON.parse(fs.readFileSync(path.join(__dirname,'../source/kaltest/tests/genre-nombre/1.0.0/test.json'),'utf8'));
const original=JSON.stringify(source);
const model=Core.definitionToModel(source);
assert.equal(model.blocks.length,2,'Les deux tableaux historiques doivent être préservés');
assert.deepEqual(model.blocks.map(x=>x.type),['multiple-tables','multiple-tables']);
assert.equal(JSON.stringify(Core.modelToDefinition(model)),original,'Aucun changement si rien n’est modifié');
model.blocks[0].fontSize=24;
model.blocks[1].fontSize=18;
const generated=Core.modelToDefinition(model);
assert.equal(generated.presentation.tables[0].builderStyle.fontSize,24);
assert.equal(generated.presentation.tables[1].builderStyle.fontSize,18);
assert.equal(generated.presentation.builderContent,undefined,'Ne pas convertir les tableaux historiques en contenu générique');
assert.deepEqual(generated.questions,source.questions,'Aucune question ni correction altérée');
assert.deepEqual(generated.presentation.layout,source.presentation.layout,'Disposition originale préservée');
assert.equal(JSON.stringify(source),original,'La V1 chargée reste intacte');
const reread=Core.definitionToModel(generated);
assert.deepEqual(reread.blocks.map(x=>x.fontSize),[24,18]);
assert.deepEqual(Core.modelToDefinition(reread),generated,'Le style reste stable après réouverture puis enregistrement');
reread.blocks[0].fontSize='';
const reset=Core.modelToDefinition(reread);
assert.ok(!Object.prototype.hasOwnProperty.call(reset.presentation.tables[0],'builderStyle'),'La taille standard retire uniquement le style ajouté');
assert.equal(reset.presentation.tables[1].builderStyle.fontSize,18);

// Reproduction de l'édition souhaitée : fond bleu des deux tableaux et
// image en bandeau pleine largeur sous ceux-ci, sans toucher à la V1 officielle.
const banner=Core.definitionToModel(source);
banner.blocks[0].backgroundColor='#EAF5FB';
banner.blocks[1].backgroundColor='#EAF5FB';
banner.blocks.push({
  uid:'bandeau-test',type:'image',zone:'full',
  mediaName:'bandeau.png',mediaType:'image/png',
  mediaData:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3+joQAAAAASUVORK5CYII=',
  mediaAlt:'Bandeau horizontal',imageScale:100
});
const withBanner=Core.modelToDefinition(banner);
assert.equal(withBanner.presentation.tables.length,2);
assert.equal(withBanner.presentation.tables[0].builderStyle.backgroundColor,'#EAF5FB');
assert.equal(withBanner.presentation.tables[1].builderStyle.backgroundColor,'#EAF5FB');
assert.equal(withBanner.presentation.builderExtras.length,1,'Bandeau exporté une seule fois');
assert.equal(withBanner.presentation.builderExtras[0].zone,'full');
assert.equal(withBanner.presentation.builderExtras[0].type,'image');
assert.deepEqual(withBanner.questions,source.questions,'Barème V1 intact après insertion');
assert.deepEqual(withBanner.presentation.layout,source.presentation.layout);
const reopened=Core.definitionToModel(withBanner);
assert.deepEqual(reopened.blocks.map(b=>b.type),['multiple-tables','multiple-tables','image']);
assert.equal(reopened.blocks[2].zone,'full');
assert.equal(reopened.blocks[2].mediaData,banner.blocks[2].mediaData);
assert.deepEqual(Core.modelToDefinition(reopened),withBanner,'Bandeau conservé après réouverture');
reopened.blocks.pop();
const removed=Core.modelToDefinition(reopened);
assert(!removed.presentation.builderExtras,'Retirer le bandeau n’efface pas les tableaux historiques');
assert.deepEqual(removed.questions,source.questions);
assert.equal(JSON.stringify(source),original,'Fichier officiel V1 strictement inchangé');
console.log('KALONEO_GENRE_NOMBRE_STYLE_AND_FULL_WIDTH_BANNER=OK');
console.log('KALONEO_GENRE_NOMBRE_FONT_ROUNDTRIP=OK');
