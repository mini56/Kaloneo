'use strict';
// R123 : test inédit générique. Aucun fichier V1 n'est modifié.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const Core=require('../../kaloneo/builder-core.js');
const Shared=require('../../kaloneo/shared-presentation.js');
const base=path.resolve(__dirname,'..','..');
const read=name=>fs.readFileSync(path.join(base,name),'utf8');
const model={
  meta:{id:'nouveau_test_reponse_libre_r123',title:'Réponse libre de longueur variable',
    version:'1.0.0',category:'expression_ecrite',scored:false,
    scenario:'Situation entièrement fictive',instruction:'Écrire un texte'},
  blocks:[
    {uid:'b_nouveau_2',type:'question',zone:'left',question:{
      id:'reponse_deux_lignes',prompt:'Justifiez :',responseType:'free-text',
      answerHeightLines:2,answerWidthChars:20,answerSuffix:'',points:0}},
    {uid:'b_nouveau_5',type:'question',zone:'left',question:{
      id:'reponse_cinq_lignes',prompt:'Rédigez :',responseType:'free-text',
      answerHeightLines:5,answerWidthChars:'',answerSuffix:'',points:0}},
    {uid:'b_nouveau_auto',type:'question',zone:'left',question:{
      id:'reponse_auto',prompt:'Expliquez :',responseType:'free-text',
      answerHeightLines:'',answerWidthChars:'',answerSuffix:'',points:0}}
  ]
};
let saved=Core.modelToDefinition(model);
assert(Core.analyzeDefinition(saved).ok);
assert.equal(saved.questions[0].answerHeightLines,2);
assert.equal(saved.questions[1].answerHeightLines,5);
assert.equal(Object.hasOwn(saved.questions[2],'answerHeightLines'),false);
assert.deepEqual(saved.questions.map(q=>q.points),[0,0,0]);
for(let i=0;i<3;i++){
  let restored=Core.definitionToModel(saved);
  assert.deepEqual(restored.blocks.map(b=>b.question.answerHeightLines),[2,5,'']);
  saved=Core.modelToDefinition(restored);
  assert.deepEqual(saved.questions.map(q=>q.answerHeightLines),[2,5,undefined]);
  assert.deepEqual(saved.questions.map(q=>q.points),[0,0,0]);
}
let cleared=Core.definitionToModel(saved);
cleared.blocks[0].question.answerHeightLines='';
let after=Core.modelToDefinition(cleared);
assert.equal(Object.hasOwn(after.questions[0],'answerHeightLines'),false,
  'La suppression de la hauteur doit supprimer aussi la propriété importée');
for(const invalid of [-3,0,21,1.5,'abc',null,'']){
  const altered=Core.definitionToModel(saved);
  altered.blocks[0].question.answerHeightLines=invalid;
  assert.equal(Object.hasOwn(Core.modelToDefinition(altered).questions[0],'answerHeightLines'),false,
    'Hauteur invalide acceptée : '+String(invalid));
}
const legacy=JSON.parse(JSON.stringify(saved));
legacy.questions.forEach(q=>delete q.answerHeightLines);
const snapshot=JSON.stringify(legacy);
const legacySaved=Core.modelToDefinition(Core.definitionToModel(legacy));
assert.equal(JSON.stringify(legacy),snapshot);
assert(legacySaved.questions.every(q=>!Object.hasOwn(q,'answerHeightLines')),
  'Une ancienne V1 a reçu une hauteur par défaut nouvelle');
const fakeDocument={
 createElement(tag){
   const obj={tagName:tag.toUpperCase(),dataset:{},style:{vars:{},
     setProperty(k,v){this.vars[k]=String(v)}},children:[],
     appendChild(v){this.children.push(v)},append(...xs){this.children.push(...xs)},
     setAttribute(){},ownerDocument:this,textContent:''};
   return obj;
 }
};
for(const [index,rows] of [[0,2],[1,5]]){
 const root=Shared.renderQuestion({doc:fakeDocument,question:saved.questions[index],
   makeAnswer:()=>fakeDocument.createElement('textarea')});
 const textarea=root.children.find(child=>child.tagName==='TEXTAREA');
 assert(textarea,'Réponse libre manquante');
 assert.equal(textarea.rows,rows);
 assert.equal(textarea.dataset.kaloneoAnswerHeight,'custom');
 assert.equal(textarea.style.vars['--kaloneo-answer-lines'],String(rows));
}
const legacyRow=Shared.renderQuestion({doc:fakeDocument,question:legacy.questions[0],
 makeAnswer:()=>fakeDocument.createElement('textarea')});
assert.equal(legacyRow.children.find(c=>c.tagName==='TEXTAREA').dataset.kaloneoAnswerHeight,undefined);
const preview=Shared.renderQuestion({doc:fakeDocument,
 question:Core.definitionToModel(saved).blocks[0].question,
 makeAnswer:()=>fakeDocument.createElement('textarea')});
assert.equal(preview.children.find(c=>c.tagName==='TEXTAREA').rows,2,
 'Le Builder doit utiliser la même hauteur que le candidat');
const builder=read('kaloneo/test-builder.js');
const runtime=read('seb-evalpro/source/js/kaltest-pilot2-runtime.js');
const styles=[read('kaloneo/test-builder.css'),read('seb-evalpro/source/css/kaltest-pilot2.css')];
assert(builder.includes("'Hauteur de la réponse (lignes)'"));
assert(builder.includes("q.responseType==='free-text'"));
assert(builder.includes('builder-answer-suffix-field'));
assert(runtime.includes("input.className = 'step kaltest-free-text-answer'"));
assert(styles.every(s=>s.includes('textarea[data-kaloneo-answer-height="custom"]')&&
 s.includes('overflow-y:auto!important')&&s.includes('min-height:0!important')));
assert(styles[1].includes('font-size:12px!important;line-height:1.1!important'),
 'Bouton documentaire encore trop haut');
assert(styles[0].includes('.preview-document-inline'));
console.log('KALONEO_R123_FREE_TEXT=OK — 2/5/Auto lignes, scroll CSS, suffixe réduit, bouton compact, import/export & V1');
