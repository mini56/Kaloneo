'use strict';
const assert=require('node:assert/strict');
const {prepare,isTechnical,theme,matchesTheme}=require('../../kaloneo/image-library-gallery.js');
const image=(id,name,category='Images exercices SEB EvalPro',options={})=>({
  id,name,category,systemProvided:true,size:1000,sourceName:name,...options
});
const input=[
  image('trash-current','candidate-trash-full.png','Images KALONÉO'),
  image('trash-old','candidate-trash-empty-simple.svg','Images KALONÉO'),
  image('logo','kaloneo-logo-app.png','Images KALONÉO'),
  image('avatar','avatar_transparant.png'),
  image('scenario','scenario.PNG'),
  image('privacy','seb-evalpro-privacy-screen.jpg'),
  image('fraction-jpg','kaloneo-fractions-proportions.png',undefined,{size:200000}),
  image('fraction-webp','kaloneo-fractions-proportions.webp',undefined,{size:30000}),
  image('cantine-old','cantine.PNG',undefined,{size:800}),
  image('cantine-new','cantine.png',undefined,{size:1500}),
  image('briques','brique.jpg'),
  image('restaurant','kaloneo-planning-restaurant.webp'),
  image('flacon','flacon_bleu.png','Images Stock'),
  image('fractions-embed','image-test.png','Images embarquées dans les tests',
    {sourceName:'test.json'}),
  image('typewriter','typewriter-reference.png','Images KALONÉO'),
  image('user1','image.png','Mes images KALONÉO',{systemProvided:false}),
  image('user2','image.png','Mes images KALONÉO',{systemProvided:false}),
  image('personal-scenario','scenario.png','Mes images KALONÉO',{systemProvided:false}),
  image('personal-flacon','flacon_bleu.png','Mes images KALONÉO',{systemProvided:false}),
  {id:'kaloneo-icon:calculs',name:'Calculs',kind:'icon',category:'Icônes',
    theme:'Icônes',systemProvided:true,data:'data:image/png;base64,eA=='},
  image('posture','qcm_posture.png')
];
const snapshot=JSON.stringify(input);
const gallery=prepare(input);
const ids=gallery.images.map(item=>item.id);
assert.equal(gallery.hiddenTechnical,10,'Images techniques masquées, sans toucher aux originaux');
assert.equal(gallery.duplicates,1,'Variantes du même fichier système regroupées');
assert.ok(ids.includes('cantine-new')&&!ids.includes('cantine-old'));
for(const id of ['briques','restaurant','posture','typewriter','user1','user2','personal-scenario',
                 'personal-flacon','kaloneo-icon:calculs'])
  assert.ok(ids.includes(id),'Illustration ou icône disponible : '+id);
for(const id of ['flacon','fraction-jpg','fraction-webp','fractions-embed'])
  assert.ok(!ids.includes(id),'Image technique invisible : '+id);
assert.equal(JSON.stringify(input),snapshot,'Catalogue source intégralement conservé');
assert.equal(isTechnical(input[17]),false,'Image personnelle avec nom réservé préservée');
assert.equal(theme(input[16]),'Mes images');
assert.equal(theme(input[18]),'Mes images');
assert.equal(theme(input[19]),'Icônes');
assert.equal(theme(input[14]),'Illustrations');
assert.equal(theme(input[20]),'Images V1','Postures doit être rangé dans Images V1');
const defaultIds=gallery.images.filter(item=>matchesTheme(item,'__current__'))
  .map(item=>item.id);
for(const id of ['posture','briques','restaurant','cantine-new'])
  assert.ok(!defaultIds.includes(id),'Image V1 absente des images courantes : '+id);
for(const id of ['typewriter','user1','kaloneo-icon:calculs'])
  assert.ok(defaultIds.includes(id),'Image courante absente : '+id);
const v1Ids=gallery.images.filter(item=>matchesTheme(item,'Images V1'))
  .map(item=>item.id);
for(const id of ['posture','briques','restaurant','cantine-new'])
  assert.ok(v1Ids.includes(id),'Image V1 disponible dans son thème : '+id);
for(const id of ['flacon','fraction-webp','fractions-embed'])
  assert.ok(!v1Ids.includes(id),'Ressource technique invisible même dans Images V1 : '+id);
assert.equal(gallery.images.filter(item=>matchesTheme(item,'')).length,
  gallery.images.length,'Tous les thèmes doit réellement tout afficher');
assert.equal(matchesTheme(input[17],'Images V1'),false,
  'Une image personnelle ne doit pas être classée V1');
console.log('KALONEO_IMAGE_GALLERY_VISIBILITY=OK',JSON.stringify({
  visible:gallery.images.length,hidden:gallery.hiddenTechnical,duplicates:gallery.duplicates
}));
