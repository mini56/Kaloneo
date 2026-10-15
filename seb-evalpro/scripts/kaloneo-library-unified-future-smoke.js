'use strict';
// Garde-fou transversal : bibliothèque unique, icônes réutilisables, placement,
// échelle, intégrité des ressources et filtrage sans changer les fichiers V1.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Core=require('../../kaloneo/builder-core.js');
const gallery=require('../../kaloneo/image-library-gallery.js');
const root=path.resolve(__dirname,'..');
const builder=fs.readFileSync(path.join(root,'..','kaloneo','test-builder.js'),'utf8');
const html=fs.readFileSync(path.join(root,'..','kaloneo','test-builder.html'),'utf8');
const css=fs.readFileSync(path.join(root,'..','kaloneo','test-builder.css'),'utf8');
const candidate=fs.readFileSync(path.join(root,'source/js/kaltest-pilot2-runtime.js'),'utf8');
const shared=fs.readFileSync(path.join(root,'..','kaloneo','shared-presentation.js'),'utf8');
const data='data:image/svg+xml;base64,'+
  Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="48"><circle cx="20" cy="24" r="18"/></svg>').toString('base64');
const icon={id:'kaloneo-icon:calculs',name:'Calculs',kind:'icon',category:'Icônes',
  systemProvided:true,data};
const image={id:'perso-1',name:'calculs.svg',category:'Mes images KALONÉO',
  systemProvided:false,sourceName:'calculs.svg'};
const shown=gallery.prepare([
  {id:'tech1',name:'flacon_bleu.png',category:'Images Stock',systemProvided:true},
  {id:'tech2',name:'kaloneo-fractions-proportions.webp',
    category:'Images exercices SEB EvalPro',systemProvided:true},
  icon,image]);
assert.deepEqual(shown.images.map(x=>x.id),[icon.id,image.id]);
assert.equal(shown.hiddenTechnical,2);
assert.equal(gallery.theme(icon),'Icônes');
assert.equal(gallery.theme(image),'Mes images');
const posture={id:'posture-v1',name:'qcm_posture.png',
  category:'Images exercices SEB EvalPro',systemProvided:true};
assert.equal(gallery.theme(posture),'Images V1');
assert.equal(gallery.matchesTheme(posture,'__current__'),false);
assert.equal(gallery.matchesTheme(posture,'Images V1'),true);
assert.equal(gallery.matchesTheme(posture,''),true);
assert.equal(gallery.matchesTheme(image,'Images V1'),false);
for(const marker of [
  "iconLibrary().filter(icon=>", "id:'kaloneo-icon:'+icon.id",
  "const icon=String(imageId||'').startsWith('kaloneo-icon:')",
  "kind:'icon'","img.src=item.data","imageLibraryLimit+=72",
  "renderImageLibrary();","getTheme(item)",
  "imageSelectionBusy=true","pcImportBusy=true",
  "appendImageScaleControls(more,block,'backgroundScale'",
  "queueImageThumb(item.id,img,thumbGeneration)"]){
  assert.ok(builder.includes(marker),'Contrat de l’éditeur non trouvé : '+marker);
}
assert.ok(html.includes('id="image-library-theme"'));
assert.ok(html.includes('value="__current__">Images courantes'));
assert.ok(builder.includes("const needsThemeOptionsUpdate="),
  'Le sélecteur natif doit rester stable lors d’un changement de filtre');
assert.ok(builder.includes("galleryApi.matchesTheme(item,themeFilter)"),
  'La même règle de filtrage doit s’appliquer aux thèmes du Builder');
assert.ok(css.includes('object-fit:contain!important'));
assert.ok(css.includes('.image-library-more'));
assert.ok(shared.includes("img.style.width=scale+'%'"));
assert.ok(candidate.includes("style.backgroundScale"));
const picture={type:'image',zone:'left',resource:{
  name:'icone.svg',mime:'image/svg+xml',data,alt:'Icône de calcul'},
  style:{imageScale:55,imageAlign:'right'}};
const bg={type:'text',zone:'right',text:'Test neuf : image de fond',
  style:{backgroundImage:data,backgroundScale:45,
    backgroundFit:'contain',backgroundPosition:'center center',backgroundOpacity:70}};
const q={id:'question_nouvelle',prompt:'2+2 ?',response:{type:'number'},
  acceptedAnswers:['4'],points:1};
const definition={
  kaltestFormat:1,id:'library_unified_future',version:'1.0.0',
  title:'Test futur de la bibliothèque commune',scored:true,
  category:'organisation',scenario:'Image et icône inédites',
  instruction:'Position libre en deux colonnes',
  icon:{id:'calculs',label:'Calculs',data},
  questions:[q],
  presentation:{layout:'50-50',builderContent:[picture,bg,{type:'question',zone:'right',questionId:q.id}]}
};
const original=JSON.stringify(definition);
let saved=Core.modelToDefinition(Core.definitionToModel(definition));
assert.equal(JSON.stringify(definition),original,'L’original a été modifié');
assert(Core.analyzeDefinition(saved).ok,'Test construit invalide');
assert.equal(saved.presentation.builderContent[0].zone,'left');
assert.equal(saved.presentation.builderContent[1].zone,'right');
assert.equal(saved.presentation.builderContent[0].style.imageScale,55);
assert.equal(saved.presentation.builderContent[0].style.imageAlign,'right');
assert.equal(saved.presentation.builderContent[0].resource.data,data);
assert.equal(saved.presentation.builderContent[1].style.backgroundScale,45);
assert.equal(saved.presentation.builderContent[1].style.backgroundImage,data);
assert.equal(saved.questions[0].points,1);
saved=Core.modelToDefinition(Core.definitionToModel(saved));
assert.equal(saved.presentation.builderContent[0].resource.data,data);
assert.equal(saved.presentation.builderContent[1].style.backgroundScale,45);
assert.equal(saved.presentation.builderContent[1].style.backgroundImage,data);
assert.equal(saved.icon?.data,data,'Icône originale perdue après réimport du test');
console.log('KALONEO_LIBRARY_UNIFIED_FUTURE=OK — images techniques cachées, icônes et tests futurs intacts');
