'use strict';
// Ce jeu est créé de toutes pièces : aucune V1 ni question connue du catalogue.
const assert=require('node:assert/strict');
const Core=require('../../kaloneo/builder-core.js');
const question={
  id:'future_answer_001',prompt:'Résoudre une situation inventée',
  response:{type:'text'},acceptedAnswers:['réponse libre'],points:2
};
const grid={
  type:'table-grid',zone:'right',
  table:{title:'Grille inédite',rows:1,cols:2,
    headers:['Énoncé','Réponse'],
    cells:[[
      {kind:'fixed-text',value:'Situation nouvelle'},
      {kind:'candidate-answer',questionId:question.id,responseType:'text',points:1}
    ]]}
};
const block={type:'question',zone:'left',questionId:question.id};
const content=[
  {type:'text',zone:'left',text:'Texte [b]enrichi[/b]',style:{fontSize:22}},
  {type:'html',zone:'left',html:'<p>Cas HTML futur</p>'},
  {type:'html-js',zone:'left',html:'<p>Cas JS futur</p>',script:'document.body.dataset.ok="1";'},
  {type:'image',zone:'left',resource:{name:'future.svg',mime:'image/svg+xml',
    data:'data:image/svg+xml;base64,PHN2Zy8+',alt:'Schéma futur'},
    style:{imageScale:65,imageAlign:'right'}},
  {type:'audio',zone:'left',resource:{name:'future.ogg',mime:'audio/ogg',
    data:'data:audio/ogg;base64,ZW5k'}},
  {type:'video',zone:'left',resource:{name:'future.webm',mime:'video/webm',
    data:'data:video/webm;base64,ZW5k'}},
  grid,block,
  {type:'response-table',zone:'right',definition:{headers:['Numéro','Saisie']}},
  {type:'inline-flow',zone:'left',wordBank:['mot nouveau'],
    flow:[{type:'text',text:'Réponse '},{type:'question',questionId:question.id}]},
  {type:'table-definition',zone:'right',
    definition:{title:'Tableau sans ancien ID',headers:['Avant','Après'],questionIds:[question.id]}},
  {type:'text-editor',zone:'right',config:{fileSimulation:true,imageSimulation:true,scoringProfile:'none'}}
];
const definition={
  kaltestFormat:1,id:'future_all_blocks_generic',version:'1.0.0',
  title:'Test futur avec douze blocs',category:'organisation',
  scored:true,scenario:'Exercice inconnu',instruction:'Ne rien perdre',
  features:['runtime.basic','layout.split','questionnaire.basic','questionnaire.table',
    'questionnaire.grid','questionnaire.inline-gaps','host.text-editor',
    'media.image','media.audio','media.video','content.html','content.html-js'],
  questions:[question],
  presentation:{layout:'50-50',builderContent:content}
};
function check(saved,source){
  assert(Core.analyzeDefinition(saved).ok,JSON.stringify(Core.analyzeDefinition(saved).errors));
  assert.equal(saved.questions.length,1,'Identifiant de question dupliqué');
  assert.equal(saved.questions[0].id,question.id);
  assert.equal(saved.questions[0].prompt,question.prompt,'Énoncé de référence perdu');
  assert.deepEqual(saved.questions[0].acceptedAnswers,question.acceptedAnswers,
    'Barème écrasé par la grille');
  assert.equal(saved.questions[0].points,question.points,'Points écrasés par la grille');
  assert.deepEqual(saved.presentation.builderContent.map(item=>item.type),
    source.map(item=>item.type),'Un type de bloc a disparu');
  assert.equal(saved.presentation.builderContent[3].resource.data,
    content[3].resource.data,'Image absente après sauvegarde');
  assert.equal(saved.presentation.builderContent[3].style.imageScale,65);
  assert.equal(saved.presentation.builderContent[3].style.imageAlign,'right');
  assert.equal(saved.presentation.builderContent[2].script,content[2].script);
  assert.deepEqual(saved.presentation.builderContent[6].table.cells,
    grid.table.cells,'Cellules et réponses de grille modifiées');
  assert.deepEqual(saved.presentation.builderContent[9].flow,
    content[9].flow,'Texte à trous perdu');
  assert.deepEqual(saved.presentation.builderContent[10].definition,
    content[10].definition,'Tableau structuré perdu');
}
// Exemple modifié après import : la définition et la note existaient déjà.
assert(Core.analyzeDefinition(definition).ok);
const existing=Core.modelToDefinition(Core.definitionToModel(definition));
check(existing,content);
// Même cas lorsque la grille est placée avant le bloc Question.
const reordered={...definition,presentation:{...definition.presentation,
  builderContent:[block,grid,...content.filter(item=>item!==block&&item!==grid)]}};
const savedReordered=Core.modelToDefinition(Core.definitionToModel(reordered));
assert(Core.analyzeDefinition(savedReordered).ok);
assert.equal(savedReordered.questions.length,1);
assert.equal(savedReordered.questions[0].points,2);
// Nouveau test sans source importée : le format de sortie doit aussi rester valide.
const blank=Core.definitionToModel(definition);
blank.sourceDefinition=null;
const created=Core.modelToDefinition(blank);
check(created,content);
const savedAgain=Core.modelToDefinition(Core.definitionToModel(existing));
check(savedAgain,content);
// Une question unique affichée par plusieurs grilles ne doit pas être doublée.
const multiGrid=Core.definitionToModel(definition);
multiGrid.blocks=multiGrid.blocks.filter(item=>item.type!=='question');
multiGrid.blocks.push(Core.clone(multiGrid.blocks.find(item=>item.type==='table-grid')));
const twoGrids=Core.modelToDefinition(multiGrid);
assert(Core.analyzeDefinition(twoGrids).ok);
assert.equal(twoGrids.questions.length,1);
console.log('KALONEO_FUTURE_BLOCKS_ROUNDTRIP_UNIQUE_QUESTION=OK');
