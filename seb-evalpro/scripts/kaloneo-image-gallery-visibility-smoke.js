'use strict';
const assert=require('node:assert/strict');
const {prepare,isTechnical}=require('../../kaloneo/image-library-gallery.js');
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
  image('text-image','image.png','Mes images KALONÉO',{systemProvided:false}),
  image('text-image-2','image.png','Mes images KALONÉO',{systemProvided:false}),
  image('personal-scenario','scenario.png','Mes images KALONÉO',{systemProvided:false})
];
const snapshot=JSON.stringify(input);
const gallery=prepare(input);
const ids=gallery.images.map(item=>item.id);
assert.equal(gallery.hiddenTechnical,6,'Images d’interface masquées, sans supprimer les images des tests');
assert.equal(gallery.duplicates,2,'Copies de noms identiques regroupées');
assert.ok(ids.includes('fraction-webp')&&!ids.includes('fraction-jpg'),'Conserver la variante WebP de même nom');
assert.ok(ids.includes('cantine-new')&&!ids.includes('cantine-old'),'Conserver une miniature dans le groupe cantine');
for(const id of ['briques','restaurant','flacon','text-image','text-image-2','personal-scenario'])
  assert.ok(ids.includes(id),'Illustration utile conservée : '+id);
assert.equal(JSON.stringify(input),snapshot,'Catalogue d’origine non modifié');
assert.equal(isTechnical(input.at(-1)),false,'Une image utilisateur du même nom qu’une icône reste disponible');
console.log('KALONEO_IMAGE_GALLERY_VISIBILITY=OK',JSON.stringify({visible:gallery.images.length,hidden:gallery.hiddenTechnical,duplicates:gallery.duplicates}));
