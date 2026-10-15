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
assert.equal(twoGrids.questions[0].points,2,'Note originale écrasée par les cellules');
assert.deepEqual(twoGrids.questions[0].acceptedAnswers,question.acceptedAnswers,
  'Réponse canonique originale effacée par une grille non modifiée');
// Les changements explicites au barème dans une grille restent enregistrables,
// sans toucher aux autres champs de la question.
const changedPoints=Core.definitionToModel(definition);
changedPoints.blocks=changedPoints.blocks.filter(item=>item.type!=='question');
const scoreCell=changedPoints.blocks.find(item=>item.type==='table-grid').table.cells[0][1];
scoreCell.points=4;
const rescored=Core.modelToDefinition(changedPoints);
assert(Core.analyzeDefinition(rescored).ok);
assert.equal(rescored.questions.length,1);
assert.equal(rescored.questions[0].points,4,'Correction de grille non enregistrée');
assert.deepEqual(rescored.questions[0].acceptedAnswers,question.acceptedAnswers,
  'Éditer les points ne doit pas effacer la réponse attendue');
// Effacer volontairement une réponse attendue reste possible lorsque la valeur
// d'une cellule a réellement changé depuis sa définition source.
scoreCell.acceptedAnswers='nouvelle réponse';
const rewritten=Core.modelToDefinition(changedPoints);
assert.deepEqual(rewritten.questions[0].acceptedAnswers,['nouvelle réponse']);
assert.equal(rewritten.questions[0].points,4);
// Une grille créée dans un futur KALTEST conserve tous les niveaux de couleur
// sans modifier la réponse, la notation ou les anciens tests.
const colored=Core.definitionToModel(definition);
const gridColored=colored.blocks.find(b=>b.type==='table-grid');
gridColored.table.columns=[
  {id:'c1',align:'left',backgroundColor:'#ddf2ff',textColor:'#003399'},
  {id:'c2',align:'center',backgroundColor:'#fff8cf',textColor:'#007722'}
];
gridColored.table.rowColors=['#f4ffde','#e9e9e9'];
gridColored.table.rowTextColors=['#773300','#333399'];
gridColored.table.cells[0][0].backgroundColor='#fbe1ec';
gridColored.table.cells[0][0].textColor='#aa0022';
const colorsBefore=JSON.stringify(gridColored.table);
const coloredSave=Core.modelToDefinition(colored);
assert(Core.analyzeDefinition(coloredSave).ok,'Couleurs : KALTEST invalide');
assert.equal(coloredSave.questions[0].points,2,'Couleur du tableau modifie les points');
assert.deepEqual(coloredSave.questions[0].acceptedAnswers,question.acceptedAnswers,
  'Couleur du tableau modifie la réponse attendue');
const coloredTable=coloredSave.presentation.builderContent.find(item=>item.type==='table-grid').table;
assert.equal(coloredTable.columns[0].backgroundColor,'#ddf2ff');
assert.equal(coloredTable.columns[1].backgroundColor,'#fff8cf');
assert.deepEqual(coloredTable.rowColors,['#f4ffde','#e9e9e9']);
assert.equal(coloredTable.cells[0][0].backgroundColor,'#fbe1ec');
assert.equal(coloredTable.columns[0].textColor,'#003399');
assert.equal(coloredTable.columns[1].textColor,'#007722');
assert.deepEqual(coloredTable.rowTextColors,['#773300','#333399']);
assert.equal(coloredTable.cells[0][0].textColor,'#aa0022');
assert.equal(JSON.stringify(gridColored.table),colorsBefore,'Source modifiée à la sauvegarde');
const roundTrip=Core.modelToDefinition(Core.definitionToModel(coloredSave));
const roundTripTable=roundTrip.presentation.builderContent.find(item=>item.type==='table-grid').table;
assert.deepEqual(roundTripTable,coloredTable,'Couleurs perdues après export / import');
assert.equal(roundTrip.questions[0].points,2);
const legacyColors=Core.modelToDefinition(Core.definitionToModel(definition));
const legacyTable=legacyColors.presentation.builderContent.find(item=>item.type==='table-grid').table;
assert.equal(legacyTable.rowColors,undefined,'Lignes ajoutées sans demande à une V1');
assert.equal(legacyTable.rowTextColors,undefined,'Couleur de texte ajoutée à une V1');
assert.equal(legacyTable.columns?.[0]?.textColor,undefined,'Colonne V1 modifiée');
assert.equal(legacyTable.cells[0][0].backgroundColor,undefined,'Cellule V1 modifiée');
assert.equal(legacyTable.cells[0][0].textColor,undefined,'Police V1 modifiée');
// Nouvelle grille issue du Builder : l'ancien type de cellule 'text'
 // ne doit plus masquer une liste déroulante en parcours candidat.
const selectModel={meta:{title:'Sélection inventée',id:'select_invented',version:'1.0.0',
  category:'mathematiques',scored:true,layout:'single'},blocks:[Core.createGridBlock(1,1)]};
const selectCell=selectModel.blocks[0].table.cells[0][0];
Object.assign(selectCell,{kind:'select',questionId:'select_001',responseType:'text',
  acceptedAnswers:'12',options:['8','10','12'],points:2,
  backgroundColor:'#203040',textColor:'#ffffff'});
const selectTest=Core.modelToDefinition(selectModel);
assert(Core.analyzeDefinition(selectTest).ok,JSON.stringify(Core.analyzeDefinition(selectTest).errors));
assert.equal(selectTest.questions[0].response.type,'select');
assert.deepEqual(selectTest.questions[0].response.options,['8','10','12']);
assert.deepEqual(selectTest.questions[0].acceptedAnswers,['12']);
assert.equal(selectTest.questions[0].points,2);
const selectSavedAgain=Core.modelToDefinition(Core.definitionToModel(selectTest));
assert.equal(selectSavedAgain.questions[0].response.type,'select');
assert.deepEqual(selectSavedAgain.questions[0].response.options,['8','10','12']);
assert.equal(selectSavedAgain.questions[0].points,2);
const savedSelectCell=selectSavedAgain.presentation.builderContent[0].table.cells[0][0];
assert.equal(savedSelectCell.textColor,'#ffffff');
assert.equal(savedSelectCell.backgroundColor,'#203040');
console.log('KALONEO_GRID_SELECT_ROUNDTRIP=OK — vrai menu, trois choix, police, fond, note');
console.log('KALONEO_GRID_COLORS_ROUNDTRIP=OK — fond + texte, cellule, ligne, colonne, export et barèmes intacts');
console.log('KALONEO_FUTURE_BLOCKS_ROUNDTRIP_UNIQUE_QUESTION=OK');
