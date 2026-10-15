'use strict';
// Contrôle générique : trois modes de réponse, largeur, V1 non modifiées,
// aller-retour KALTEST et moteur commun Builder/candidat.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Core=require('../../kaloneo/builder-core.js');
const Shared=require('../../kaloneo/shared-presentation.js');
const here=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(here,file),'utf8');
const q=(id,prompt,mode,width)=>({
  id,prompt,response:{type:'number'},acceptedAnswers:['10'],
  points:1,...(mode?{answerLayout:mode}:{}),
  ...(width?{answerWidthChars:width}:{})
});
const questions=[
  q('futur_a','3 + 7 =','inline',9),
  q('futur_b','La question longue 25 - 15 =','column',16),
  q('futur_c','45 - 35 =','below',22)
];
const def={
  kaltestFormat:1,id:'nouveau_test_2028_layout',version:'1.0.0',
  title:'Test inédit de mise en page',category:'mathematiques',
  scored:true,scenario:'Calculs',instruction:'Répondez',
  questions,
  presentation:{layout:'single',builderContent:questions.map(x=>({
    type:'question',zone:'left',questionId:x.id
  }))}
};
const serialized=JSON.stringify(def);
let model=Core.definitionToModel(def);
assert.deepEqual(model.blocks.map(b=>b.question.answerLayout),['inline','column','below']);
assert.deepEqual(model.blocks.map(b=>b.question.answerWidthChars),[9,16,22]);
for(let i=0;i<3;i++){
  const result=Core.modelToDefinition(model);
  assert.equal(JSON.stringify(def),serialized,'La définition originale a été mutée');
  assert(Core.analyzeDefinition(result).ok,'Définition KALTEST rejetée');
  assert.deepEqual(result.questions.map(x=>x.answerLayout),['inline','column','below']);
  assert.deepEqual(result.questions.map(x=>x.answerWidthChars),[9,16,22]);
  assert.deepEqual(result.questions.map(x=>x.acceptedAnswers),[['10'],['10'],['10']]);
  assert.deepEqual(result.questions.map(x=>x.points),[1,1,1]);
  model=Core.definitionToModel(result);
}
const legacy=JSON.parse(serialized);
legacy.questions=legacy.questions.map(({answerLayout,answerWidthChars,...other})=>other);
const legacySerialized=JSON.stringify(legacy);
const legacySaved=Core.modelToDefinition(Core.definitionToModel(legacy));
assert.equal(JSON.stringify(legacy),legacySerialized,'V1 chargée modifiée');
for(const question of legacySaved.questions){
  assert.equal(Object.hasOwn(question,'answerLayout'),false,'Disposition ajoutée à une V1');
  assert.equal(Object.hasOwn(question,'answerWidthChars'),false,'Largeur ajoutée à une V1');
}
const makeDocument=()=>({
  createElement(tag){
    return {
      tag,className:'',dataset:{},style:{values:{},setProperty(k,v){this.values[k]=v;}},
      children:[],textContent:'',append(...nodes){this.children.push(...nodes);},
      appendChild(node){this.children.push(node);},ownerDocument:this
    };
  }
});
const fakeDoc=makeDocument();
const rows=def.questions.map(question=>Shared.renderQuestion({
  doc:fakeDoc,question,
  makeAnswer:()=>fakeDoc.createElement('input')
}));
assert.deepEqual(rows.map(row=>row.dataset.kaloneoAnswerLayout),
  ['inline','column','below']);
assert.deepEqual(rows.map(row=>row.style.values['--kaloneo-answer-width']),
  ['9ch','16ch','22ch']);
const without=Shared.renderQuestion({doc:fakeDoc,question:legacy.questions[0],
  makeAnswer:()=>fakeDoc.createElement('input')});
assert.equal(without.dataset.kaloneoAnswerLayout,undefined);
assert.equal(without.dataset.kaloneoAnswerWidth,undefined);
for(const badWidth of [0,4,31,Infinity,NaN,-3]){
  const row=Shared.renderQuestion({doc:fakeDoc,
    question:{...questions[0],answerWidthChars:badWidth},
    makeAnswer:()=>fakeDoc.createElement('input')});
  assert.equal(row.dataset.kaloneoAnswerWidth,undefined,'Largeur invalide acceptée');
}
const builder=read('../kaloneo/test-builder.js');
const preview=read('../kaloneo/test-preview.js');
const candidate=read('source/js/kaltest-pilot2-runtime.js');
const cssBuilder=read('../kaloneo/test-builder.css');
const cssCandidate=read('source/css/kaltest-pilot2.css');
const cssPreview=read('../kaloneo/test-preview.css');
for(const marker of [
  "'Position de la réponse'","'Largeur de la réponse (caractères)'",
  "['inline','Réponse juste après la question']",
  "['below','Réponse sous la question']"
])assert(builder.includes(marker),'Option Builder absente : '+marker);
assert(preview.includes('answerLayout:q.answerLayout'),'Grand aperçu non connecté');
assert(candidate.includes('window.KaloneoSharedPresentation.renderQuestion'),
  'Moteur candidat non partagé');
for(const [name,sheet] of [['Builder',cssBuilder],['Candidat',cssCandidate],['Aperçu',cssPreview]]){
  for(const mode of ['inline','column','below']){
    assert(sheet.includes('data-kaloneo-answer-layout="'+mode+'"'),
      name+' : mode '+mode+' absent');
  }
}
console.log('KALONEO_ANSWER_LAYOUT_ROUNDTRIP=OK — 3 modes, tailles, moteur commun et V1 conservées');
