'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const Core=require('../../kaloneo/builder-core.js');
const Engine=require('../source/js/kaltest-number-grid-engine.js');
const root=path.resolve(__dirname,'../source/kaltest/tests');
const expected=[
 {id:'grille_operations',dir:'grille-operations',solutions:2,rows:5,cols:5},
 {id:'carre_magique_15',dir:'carre-magique-15',solutions:8,rows:7,cols:7}
];
for(const entry of expected){
 const original=JSON.parse(fs.readFileSync(path.join(root,entry.dir,'1.0.0/test.json'),'utf8'));
 const validation=Core.analyzeDefinition(original);
 assert(validation.ok,JSON.stringify(validation.errors));
 assert.equal(original.id,entry.id);
 assert.equal(original.version,'1.0.0');
 assert.equal(original.questions.length,9);
 assert.equal(original.questions.reduce((s,q)=>s+q.points,0),9);
 assert.equal(original.presentation.builderContent.length,2);
 assert.equal(original.presentation.layout,'40-60');
 assert.equal(original.presentation.builderContent[0].type,'image');
 assert.equal(original.presentation.builderContent[0].zone,'left');
 assert(original.presentation.builderContent[0].resource.data.startsWith('bibliotheque-images/'));
 assert.equal(original.presentation.builderContent[1].type,'table-grid');
 assert.equal(original.presentation.builderContent[1].zone,'right');
 assert(original.presentation.builderContent[0].resource.data.endsWith('.png'));
 assert(fs.existsSync(path.join(root,'../..',original.presentation.builderContent[0].resource.data)),'Illustration de la bibliothèque manquante');
 assert.equal(original.calculator.compatible,true);
 assert.equal(original.calculator.defaultEnabled,true);
 assert(original.features.includes('host.calculator'));
 assert(original.features.includes('layout.split'));
 const content=original.presentation.builderContent[1];
 assert.equal(content.type,'table-grid');assert.equal(content.zone,'right');
 assert.equal(content.table.rows,entry.rows);
 assert.equal(content.table.cols,entry.cols);
 assert.equal(content.table.cells.flat().filter(c=>c.kind==='candidate-answer').length,9);
 const config=original.evaluation.validArrangements;
 assert.equal(config.solutions.length,entry.solutions);
 assert.deepEqual(config.questionIds,original.questions.map(q=>q.id));
 assert.equal(original.bilanContributions[0].lineId,'bilan.savoirs_fondamentaux.mathematiques.resoudre_problemes');
 assert(!JSON.stringify(original).includes('data:image/'),'Pas de fichier image à embarquer');
 const model=Core.definitionToModel(original);
 assert.equal(model.blocks.length,2);
 assert.equal(model.blocks[0].type,'image');
 assert.equal(model.blocks[0].zone,'left');
 assert(model.blocks[0].mediaData.startsWith('bibliotheque-images/'));
 assert.equal(model.blocks[1].type,'table-grid');
 assert.equal(model.blocks[1].zone,'right');
 const rebuilt=Core.modelToDefinition(model);
 assert.deepEqual(rebuilt.questions,original.questions,'Notes et réponses changées à la sauvegarde Builder');
 assert.deepEqual(rebuilt.presentation.builderContent,original.presentation.builderContent,'Grille transformée par le Builder');
 assert.deepEqual(rebuilt.evaluation,original.evaluation,'Règles de correction supprimées à la sauvegarde Builder');
 assert.deepEqual(rebuilt.bilanContributions,original.bilanContributions,'Bilan officiel non conservé');
 const edited=Core.definitionToModel(rebuilt);
 edited.blocks[1].backgroundColor='#EAF5FB';
 const afterEdit=Core.modelToDefinition(edited);
 assert.deepEqual(afterEdit.evaluation,original.evaluation,'Correction perdue sur modification du fond');
 assert.deepEqual(afterEdit.questions,original.questions,'Barème changé sur modification du fond');
 for(const solution of config.solutions){
   const answers=Object.fromEntries(config.questionIds.map((id,i)=>[id,String(solution[i])]));
   const result=Engine.evaluate(config,answers);
   assert.equal(result.correct,9,'Solution mathématique valide injustement refusée');
   assert.equal(result.fullyCorrect,true);
   assert.deepEqual(Object.values(result.details),Array(9).fill(true));
   if(entry.id==='grille_operations'){
     assert.equal(solution[0]-solution[1],solution[2]);
     assert.equal(solution[3]/solution[4],solution[5]);
     assert.equal(solution[6]+solution[7],solution[8]);
     assert.equal(solution[2]*solution[5],solution[8]);
   }else{
     const row=[solution.slice(0,3),solution.slice(3,6),solution.slice(6,9)];
     for(let i=0;i<3;i++){
       assert.equal(row[i].reduce((a,b)=>a+b,0),15);
       assert.equal(row[0][i]+row[1][i]+row[2][i],15);
     }
     assert.equal(row[0][0]+row[1][1]+row[2][2],15);
     assert.equal(row[0][2]+row[1][1]+row[2][0],15);
   }
 }
 const wrong=Object.fromEntries(config.questionIds.map(id=>[id,'0']));
 assert.equal(Engine.evaluate(config,wrong).correct,0,'Zéro accepté');
 const empty=Object.fromEntries(config.questionIds.map(id=>[id,'']));
 assert.equal(Engine.evaluate(config,empty).correct,0,'Blanc accepté');
 const duplicate=Object.fromEntries(config.questionIds.map(id=>[id,'1']));
 assert(Engine.evaluate(config,duplicate).correct<9,'Répétition acceptée');
 console.log('KALONEO_NUMBER_GRID_V1='+entry.id+';BUILDER_ROUNDTRIP=OK;BILAN=OK;SOLUTIONS='+entry.solutions+';LIBRARY_IMAGE_REUSED=YES');
}
console.log('KALONEO_NUMBER_GRID_V1_ALL=SUCCESS');
