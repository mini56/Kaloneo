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
// Couverture exhaustive des créations modernes, sans toucher à la V1.
const makeFuture=(id,blocks)=>({
  meta:{id,title:id,version:'1.0.0',category:'mathematiques',
    scored:true,layout:'single'},blocks
});
function modernGrid(rows,cols){return Core.createGridBlock(rows,cols)}
const unitGrid=modernGrid(1,2);
Object.assign(unitGrid.table.cells[0][0],{
  kind:'candidate-answer',questionId:'parcel_weight',
  responseType:'number',acceptedAnswers:'12',points:2
});
Object.assign(unitGrid.table.cells[0][1],{
  kind:'unit',questionId:'parcel_weight',acceptedUnits:'kg; KG; kilo; kilogramme',unitScored:true
});
const weighted=Core.modelToDefinition(makeFuture('Poid_colis_futur',[unitGrid]));
assert(Core.analyzeDefinition(weighted).ok,JSON.stringify(Core.analyzeDefinition(weighted).errors));
assert.equal(weighted.questions.length,1,'Double question valeur/unité');
assert.equal(weighted.questions[0].points,2);
assert.equal(weighted.questions[0].unitInput,true);
assert.equal(weighted.questions[0].unitScored,true);
assert.deepEqual(weighted.questions[0].acceptedUnits,['kg','KG','kilo','kilogramme']);
const twice=Core.modelToDefinition(Core.definitionToModel(weighted));
assert.equal(twice.questions.length,1);
assert.equal(twice.questions[0].unitScored,true);
assert.deepEqual(twice.questions[0].acceptedUnits,weighted.questions[0].acceptedUnits);
const swapped=Core.clone(unitGrid);
swapped.table.cells[0].reverse();
const swappedDef=Core.modelToDefinition(makeFuture('Unite_avant_valeur',[swapped]));
assert.equal(swappedDef.questions.length,1);
assert.equal(swappedDef.questions[0].points,2);
assert.equal(swappedDef.questions[0].unitScored,true);
const unscored=Core.clone(unitGrid);
unscored.table.cells[0][1].unitScored=false;
const unscoredDef=Core.modelToDefinition(makeFuture('Unite_non_notee',[unscored]));
assert.equal(unscoredDef.questions[0].unitScored,undefined,'Unité non notée changée');
assert.equal(unscoredDef.questions[0].unitInput,true,'Unité non notée masquée');
const invalidUnit=Core.clone(unitGrid);
invalidUnit.table.cells[0][1].acceptedUnits='';
assert(!Core.analyzeDefinition(Core.modelToDefinition(makeFuture('Unite_sans_reponse',[invalidUnit]))).ok,
  'L’unité notée sans valeurs acceptées ne doit pas être validée');
const newChoice=modernGrid(1,1);
Object.assign(newChoice.table.cells[0][0],{
  kind:'select',questionId:'choice_futur',acceptedAnswers:'12',
  responseType:'select',options:['8','10','12'],points:3
});
const choiceOK=Core.modelToDefinition(makeFuture('Choix_futur_valide',[newChoice]));
assert(Core.analyzeDefinition(choiceOK).ok);
const badChoice=Core.clone(newChoice);
badChoice.table.cells[0][0].options=['8','10'];
assert(!Core.analyzeDefinition(Core.modelToDefinition(makeFuture('Choix_futur_invalide',[badChoice]))).ok,
  'La réponse attendue absente des choix a été acceptée');
const emptyChoice=Core.clone(newChoice);
emptyChoice.table.cells[0][0].options=[];
assert(!Core.analyzeDefinition(Core.modelToDefinition(makeFuture('Choix_futur_vide',[emptyChoice]))).ok,
  'Une liste déroulante vide a été acceptée');
const orphanFlow={uid:'orphan_flow',type:'inline-flow',zone:'left',
  wordBank:['mot'],flow:[{type:'text',text:'Répondre '},{type:'question',questionId:'id_trou'}]};
assert(!Core.analyzeDefinition(Core.modelToDefinition(makeFuture('Trou_orphelin',[orphanFlow]))).ok,
  'Texte à trous orphelin accepté');
const linkedQuestion={uid:'trou_q',type:'question',zone:'left',
  question:{id:'id_trou',prompt:'Choisissez',responseType:'text',
    acceptedAnswers:'mot',points:1}};
const flowOK=Core.modelToDefinition(makeFuture('Trou_valide',[orphanFlow,linkedQuestion]));
assert(Core.analyzeDefinition(flowOK).ok);
const tableQuestion={uid:'response_q',type:'question',zone:'left',
  question:{id:'qa_1',prompt:'Mesurez',responseType:'number',
    acceptedAnswers:'15',points:2}};
const resp={uid:'resp_1',type:'response-table',zone:'right',
  responseTable:{headers:['N°','Réponse','Unités','Opérations effectuées','Remarques'],
    columns:[]}};
const withExtra=Core.modelToDefinition(makeFuture('Champs_complementaires',[tableQuestion,resp]));
assert(Core.analyzeDefinition(withExtra).ok);
assert.deepEqual(withExtra.questions[0].supplementalFields.map(v=>v.id),
  ['operations_effectuees','remarques']);
const withExtraAgain=Core.modelToDefinition(Core.definitionToModel(withExtra));
assert.deepEqual(withExtraAgain.questions[0].supplementalFields,
  withExtra.questions[0].supplementalFields);
const manualGrid=modernGrid(1,1);
Object.assign(manualGrid.table.cells[0][0],{kind:'candidate-answer',
  questionId:'manual_answer',responseType:'free-text',points:5});
const manualDef=Core.modelToDefinition(makeFuture('Libre_non_note',[manualGrid]));
assert.equal(manualDef.questions[0].points,0);
assert.equal(manualDef.questions[0].manualEvaluation,true);
const durationGrid=modernGrid(1,1);
Object.assign(durationGrid.table.cells[0][0],{kind:'candidate-answer',
  questionId:'time_1',responseType:'duration',acceptedAnswers:'75',points:1});
const durationDef=Core.modelToDefinition(makeFuture('Duree_configurable',[durationGrid]));
assert.equal(durationDef.questions[0].acceptedMinutes,75);
console.log('KALONEO_BUILDER_AUDIT_NEW_TESTS=OK — unité, 1 point, listes, trous, types, colonnes et points');

const nativeSelection={
  uid:'native_image_selection',type:'image-selection',zone:'left',
  label:'25 % de 8 objets',totalItems:8,acceptedCount:2,cloud:false,
  mediaName:'pomme.svg',mediaType:'image/svg+xml',
  mediaData:'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%2F%3E',
  mediaAlt:'Objet identique',
  question:{id:'future_image_selection_q',prompt:'Sélectionnez 25 % des objets',points:1}
};
const nativeModel={meta:{
  title:'Sélection native inédite',id:'future_native_image_selection',version:'1.0.0',
  category:'mathematiques',scored:true,layout:'single',scenario:'Nouvel exercice',instruction:'Cliquez sur deux objets'
},blocks:[nativeSelection]};
const nativeDefinition=Core.modelToDefinition(nativeModel);
assert.equal(nativeDefinition.presentation.builderContent[0].type,'image-selection');
assert.deepEqual(nativeDefinition.questions[0].response.options,['1','2','3','4','5','6','7','8']);
assert.equal(nativeDefinition.questions[0].acceptedCount,2);
assert.equal(nativeDefinition.questions[0].points,1);
assert.deepEqual(nativeDefinition.questions[0].acceptedAnswers,[['1','2']]);
assert(Core.analyzeDefinition(nativeDefinition).ok,JSON.stringify(Core.analyzeDefinition(nativeDefinition).errors));
const importedSelection=Core.definitionToModel(nativeDefinition);
assert.equal(importedSelection.blocks[0].type,'image-selection');
assert.equal(importedSelection.blocks[0].mediaData,nativeSelection.mediaData);
const savedSelection=Core.modelToDefinition(importedSelection);
assert.deepEqual(savedSelection.questions,nativeDefinition.questions,'La correction a changé après l’import dans le Builder');
assert.deepEqual(savedSelection.presentation.builderContent,nativeDefinition.presentation.builderContent,
  'La sélection ou le média a changé après enregistrement dans le Builder');
for(const change of [
  d=>{d.questions[0].acceptedCount=9;},
  d=>{d.presentation.builderContent[0].resource.data='';},
  d=>{d.presentation.builderContent[0].questionId='unknown';},
  d=>{d.presentation.builderContent[0].totalItems=0;}
]){
  const invalid=Core.clone(nativeDefinition);change(invalid);
  assert.equal(Core.analyzeDefinition(invalid).ok,false,'Définition image invalide acceptée');
}
// Vérifier qu’une modification du nombre attendu est bien persistée dans la réponse canonique.
importedSelection.blocks[0].acceptedCount=4;
const changedSelection=Core.modelToDefinition(importedSelection);
assert.equal(changedSelection.questions[0].acceptedCount,4);
assert.deepEqual(changedSelection.questions[0].acceptedAnswers,[['1','2','3','4']]);
assert.equal(Core.analyzeDefinition(changedSelection).ok,true);


const mixedRowsModel={
  meta:{id:'synthetic_100_split_100',title:'Disposition mixte nouvelle',
    version:'1.0.0',category:'mathematiques',scored:false,layout:'40-60',
    scenario:'Exercice de géométrie',instruction:'Observez les 6 blocs'},
  blocks:[
    {uid:'mf0',type:'text',zone:'full',text:'Introduction sur toute la largeur'},
    {uid:'ml1',type:'text',zone:'left',text:'Colonne gauche — première paire'},
    {uid:'mr1',type:'text',zone:'right',text:'Colonne droite — première paire'},
    {uid:'mf1',type:'text',zone:'full',text:'Bilan sur toute la largeur'},
    {uid:'ml2',type:'text',zone:'left',text:'Colonne gauche — deuxième paire'},
    {uid:'mr2',type:'text',zone:'right',text:'Colonne droite — deuxième paire'}
  ]
};
const mixedRowsDefinition=Core.modelToDefinition(mixedRowsModel);
const expectedMixedZones=['full','left','right','full','left','right'];
assert.deepEqual(mixedRowsDefinition.presentation.builderContent.map(x=>x.zone),expectedMixedZones);
assert.equal(Core.analyzeDefinition(mixedRowsDefinition).ok,true,
  JSON.stringify(Core.analyzeDefinition(mixedRowsDefinition).errors));
const mixedRowsRestored=Core.modelToDefinition(Core.definitionToModel(mixedRowsDefinition));
assert.deepEqual(mixedRowsRestored.presentation.builderContent,mixedRowsDefinition.presentation.builderContent,
  'Le Builder a modifié ordre, type ou zone des blocs 100 % + deux colonnes');
assert.equal(Core.analyzeDefinition(mixedRowsRestored).ok,true);
for(const zone of ['full','left','right']){
 const clone=Core.definitionToModel(mixedRowsDefinition);
 clone.blocks[2].zone=zone;
 const changed=Core.modelToDefinition(clone);
 assert.equal(changed.presentation.builderContent[2].zone,zone);
 assert(Core.analyzeDefinition(changed).ok);
}
console.log('KALONEO_MIXED_FULL_WIDTH_ROUNDTRIP=OK',JSON.stringify({zones:expectedMixedZones}));

const Workflow=require('../../kaloneo/builder-workflow.js');
// Test de duplication et d'ensembles sans V1 : conserver données multimédias,
// refaire tous les ID de réponse et leurs liens internes.
const mediaBytes='data:image/svg+xml;base64,PHN2ZyB4bWxucz0iYSIvPg==';
const sourceGroup=[
  {uid:'source_1',type:'question',zone:'left',
    question:{id:'test_question_1',prompt:'Combien ?',responseType:'number',
      acceptedAnswers:'12',points:2}},
  {uid:'source_2',type:'table-grid',zone:'right',
    table:{rows:1,cols:2,headers:['Image','Réponse'],cells:[[
      {kind:'image',value:mediaBytes},
      {kind:'candidate-answer',questionId:'test_question_1',
        responseType:'number',acceptedAnswers:'12',points:2}
    ]]}},
  {uid:'source_3',type:'inline-flow',zone:'full',
    wordBank:['12'],flow:[{type:'text',text:'Répondre '},
      {type:'question',questionId:'test_question_1'}]}
];
const originalJSON=JSON.stringify(sourceGroup);
let uidCounter=0;
const copied=Workflow.copyBlocks(sourceGroup,sourceGroup,()=>('new_clone_'+(++uidCounter)));
assert.equal(JSON.stringify(sourceGroup),originalJSON,'La duplication a modifié la source');
assert.equal(copied.length,3);
assert.equal(copied[0].question.id,copied[1].table.cells[0][1].questionId);
assert.equal(copied[0].question.id,copied[2].flow[1].questionId);
assert.notEqual(copied[0].question.id,sourceGroup[0].question.id);
assert.equal(copied[1].table.cells[0][0].value,mediaBytes,'Image perdue après duplication');
assert.equal(new Set([...sourceGroup,...copied].map(b=>b.uid)).size,6);
const anotherCopy=Workflow.copyBlocks(sourceGroup,[...sourceGroup,...copied],()=>('again_'+(++uidCounter)));
assert.notEqual(anotherCopy[0].question.id,copied[0].question.id,'ID dupliqué après une seconde copie');
assert.notEqual(anotherCopy[0].question.id,sourceGroup[0].question.id);
const inserted=Workflow.insertBlocks(sourceGroup,1,copied);
assert.deepEqual(inserted.map(b=>b.uid),['source_1',...copied.map(b=>b.uid),'source_2','source_3']);
const templateBytes=JSON.parse(JSON.stringify(sourceGroup));
const instantiated=Workflow.copyBlocks(templateBytes,[],()=>('fresh_'+(++uidCounter)));
assert.equal(instantiated[1].table.cells[0][0].value,mediaBytes);
assert.equal(instantiated[0].question.id,instantiated[1].table.cells[0][1].questionId);
const groups=[
  {uid:'fullA',zone:'full'},{uid:'leftA',zone:'left'},
  {uid:'rightA',zone:'right'},{uid:'fullB',zone:'full'},
  {uid:'leftB',zone:'left'},{uid:'rightB',zone:'right'}];
assert.deepEqual(Workflow.lines(groups).map(g=>g.zone),['full','pair','full','pair']);
const down=Workflow.moveLine(groups,1,1);
assert.deepEqual(down.map(b=>b.uid),['fullA','fullB','leftA','rightA','leftB','rightB']);
const up=Workflow.moveLine(down,2,-1);
assert.deepEqual(up.map(b=>b.uid),groups.map(b=>b.uid));
assert.deepEqual(Workflow.moveLine(groups,0,-1),groups);
assert.deepEqual(Workflow.moveLine(groups,4,1),groups);
const scoringModel={meta:{
  id:'audit_auto_generation_2026',title:'Vérification indépendante',
  version:'1.0.0',category:'mathematiques',scored:true,layout:'single',
  scenario:'Exercice',instruction:'Répondre'
},blocks:[
  {uid:'audit_num',type:'question',zone:'left',
    question:{id:'audit_nombre',prompt:'Combien ?',responseType:'number',
      acceptedAnswers:'12',unitInput:true,unitScored:true,units:'kg; kilo',points:2}},
  {uid:'audit_bool',type:'question',zone:'left',
    question:{id:'audit_bool',prompt:'Vrai ou faux',responseType:'boolean',
      acceptedAnswers:'Vrai',points:1}}
]};
const scoringDefinition=Core.modelToDefinition(scoringModel);
assert(Core.analyzeDefinition(scoringDefinition).ok,
  JSON.stringify(Core.analyzeDefinition(scoringDefinition).errors));
const audit=Workflow.scoringAudit(scoringDefinition,Core.analyzeDefinition);
assert.equal(audit.standardOk,true,JSON.stringify(audit.errors));
assert.equal(audit.maximum,4,'2 points valeur + 1 unité + 1 vrai/faux');
assert.equal(audit.earned,4);
assert(audit.rows.filter(r=>r.status==='ok').length===2);
const wrongAudit=Core.clone(scoringDefinition);
wrongAudit.questions[0].acceptedAnswers=['pas un nombre'];
assert.equal(Workflow.scoringAudit(wrongAudit,Core.analyzeDefinition).standardOk,false);
const expert=Core.clone(scoringDefinition);
expert.evaluation={nwtexteRules:true};
const special=Workflow.scoringAudit(expert,Core.analyzeDefinition);
assert.equal(special.special,true,'Simulation du moteur NWTEXT présentée comme une validation exhaustive');
console.log('KALONEO_BUILDER_FIVE_WORKFLOWS_CORE=OK',JSON.stringify({
  copyIds:[sourceGroup[0].question.id,copied[0].question.id,anotherCopy[0].question.id],
  mediaKept:true,lines:Workflow.lines(groups).map(g=>g.zone),
  scoring:{maximum:audit.maximum,earned:audit.earned},specialRequiresElectron:true
}));


const styledQuestionModel={
  meta:{id:'rich_question_new',title:'Question formatée',
    category:'francais',scored:true,version:'1.0.0',layout:'single'},
  blocks:[{uid:'format_bloc',zone:'left',type:'question',
    question:{id:'question_justification',prompt:'[b]Explique[/b] et [u]justifie[/u] [c=#005A8D]ta réponse[/c]',
      responseType:'free-text',manualEvaluation:true,points:0}}]
};
const styledDefinition=Core.modelToDefinition(styledQuestionModel);
assert.equal(styledDefinition.questions[0].prompt,styledQuestionModel.blocks[0].question.prompt);
assert.equal(styledDefinition.questions[0].manualEvaluation,true);
assert.equal(styledDefinition.questions[0].points,0);
const styledRecovered=Core.definitionToModel(styledDefinition);
assert.equal(styledRecovered.blocks[0].question.prompt,styledQuestionModel.blocks[0].question.prompt);
assert.equal(Core.analyzeDefinition(styledDefinition).ok,true);
console.log('KALONEO_RICH_QUESTION_JSON_ROUNDTRIP=OK');

console.log('KALONEO_FUTURE_BLOCKS_ROUNDTRIP_UNIQUE_QUESTION=OK');
