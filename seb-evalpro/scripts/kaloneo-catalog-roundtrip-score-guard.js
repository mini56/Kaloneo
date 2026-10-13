'use strict';
// Construit les contrôles à partir du catalogue actuel ; aucune liste d'IDs
// ni exception par test. Chaque nouvelle V1 sera automatiquement auditée.
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const Core=require('../../kaloneo/builder-core.js');
const root=path.join(__dirname,'..','source','kaltest','tests');
const SCORE_KEYS=[
  'response','acceptedAnswers','acceptedMinutes','acceptedUnits','units',
  'points','manualEvaluation','manualLevels','supplementalFields',
  'unitInput','unitScored'
];
const files=[];
function walk(directory){
  for(const item of fs.readdirSync(directory,{withFileTypes:true})){
    const target=path.join(directory,item.name);
    if(item.isDirectory())walk(target);
    else if(item.isFile()&&item.name==='test.json')files.push(target);
  }
}
walk(root);
assert(files.length>=24,'Catalogue incomplet : moins de 24 définitions KALTEST');
const examples=[];
let checkedQuestions=0;
for(const file of files){
  const original=JSON.parse(fs.readFileSync(file,'utf8'));
  const restored=Core.modelToDefinition(Core.definitionToModel(original));
  const before=Array.isArray(original.questions)?original.questions:[];
  const after=Array.isArray(restored.questions)?restored.questions:[];
  const sourceIds=before.map(q=>q.id);
  const outputIds=after.map(q=>q.id);
  assert.deepEqual(outputIds,sourceIds,
    'Perte, duplication ou inversion de questions : '+path.relative(root,file));
  assert.equal(new Set(outputIds).size,outputIds.length,
    'ID de question dupliqué : '+path.relative(root,file));
  for(let i=0;i<before.length;i++){
    for(const key of SCORE_KEYS){
      assert.deepEqual(restored.questions[i][key],before[i][key],
        'Changement de barème '+key+' / '+path.relative(root,file)+
        ' / question '+String(before[i].id));
    }
  }
  // Les contrats de sorties et les liaisons Bilan restent portables.
  assert.deepEqual(restored.outputs,original.outputs,
    'Contrat de sortie modifié : '+path.relative(root,file));
  assert.deepEqual(restored.bilanContributions,original.bilanContributions,
    'Contrat Bilan modifié : '+path.relative(root,file));
  // Une ressource image, audio ou vidéo intégrée dans un KALTEST doit
  // toujours être présente après ouverture/sauvegarde sans édition.
  const attachments=new Set();
  const inspect=value=>{
    if(typeof value==='string'){
      if(/^data:(?:image|audio|video)\//i.test(value))attachments.add(value);
      return;
    }
    if(Array.isArray(value)){for(const item of value)inspect(item);return;}
    if(value&&typeof value==='object')for(const key of Object.keys(value))inspect(value[key]);
  };
  inspect(original.presentation);
  const rebuiltText=JSON.stringify(restored);
  for(const resource of attachments)
    assert(rebuiltText.includes(JSON.stringify(resource)),
      'Ressource visuelle ou sonore perdue : '+path.relative(root,file));
  checkedQuestions+=before.length;
  examples.push({id:original.id,questions:before.length,resources:attachments.size});
}
console.log('KALONEO_ALL_CATALOG_KALTEST_SCORE_ROUNDTRIP=OK',JSON.stringify({
  definitions:files.length,questions:checkedQuestions,resources:examples.reduce((n,x)=>n+x.resources,0)
}));
