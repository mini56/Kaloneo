'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const crypto=require('node:crypto');
const {createKaloneoLibrary}=require('../src/kaloneo-library-main');
const {loadOfficialOverrides,writeOfficialSeedOverrides}=require('./kaloneo-testsv1');
const sha=buffer=>crypto.createHash('sha256').update(buffer).digest('hex');
const repo=path.resolve(__dirname,'../..');
const src=path.join(repo,'TESTS_V1','l-1.0.0-test.json');
const supplied=path.join(repo,'seb-evalpro','source','bibliotheque-images');
const expected=[
  ['horaires/33_8h00.png','1c87d47d54e698ef084be6d15c87fd620b1b5429ccc46edb59f750cc3c619fba'],
  ['horaires/42_10h15.png','eb983d8efc68121f45a49f89721e6924e6a2d2f92a99838032de84570ef7535a'],
  ['02_fin_stage_01/05.png','c814aeab09b343b4b44fd03c1df583c8771a96dd4091e399776a2a4314605bc8']
];
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kaloneo-transport-v1-'));
try{
  const original=JSON.parse(fs.readFileSync(src,'utf8'));
  assert.equal(original.id,'l');
  assert.equal(original.title,'Bon de transport.');
  assert.equal(original.version,'1.0.0');
  assert.equal(original.pageRole,'test');
  assert.equal(original.scored,true);
  assert.equal(original.presentation.layout,'40-60');
  assert.equal(original.presentation.supplementaryWindows.length,2);
  assert.equal(original.presentation.builderContent.length,10);
  assert.deepEqual(original.questions.map(q=>q.points),[1,1,1,1,0]);
  assert.equal(original.questions[4].manualEvaluation,true);
  assert.equal(original.bilanContributions[0].lineId,'bilan.savoirs_fondamentaux.mathematiques.resoudre_problemes');
  assert.equal(original.presentation.builderContent[0].table.rows,6);
  assert.equal(original.presentation.builderContent[0].table.cols,6);
  assert.deepEqual(original.questions[0].acceptedAnswers,['200','200.00','200,00']);
  assert.deepEqual(original.questions[1].acceptedAnswers,['2h15','2H15']);
  assert.deepEqual(original.questions[2].acceptedAnswers,['43.25','43,25']);
  assert.deepEqual(original.questions[3].acceptedAnswers,['7.5','7,5','7.50','7,50']);
  assert.equal(original.calculator.defaultEnabled,false);
  for(const [relative,digest] of expected){
    const target=path.join(supplied,...relative.split('/'));
    assert.equal(sha(fs.readFileSync(target)),digest,'Illustration du programme differente : '+relative);
    assert(original.kaloneoLibrary.imageSources.some(x=>x.sourcePath===relative&&x.sha256===digest));
  }
  const allReferences=[
    original.presentation.supplementaryWindows[0].imageData,
    original.presentation.supplementaryWindows[1].imageData,
    original.presentation.builderContent[1].resource.data
  ];
  assert.deepEqual(allReferences,expected.map(x=>'kaloneo-asset:'+x[1]+'.png'));

  const baseline=path.join(repo,'seb-evalpro','source','kaltest','tests');
  const record=loadOfficialOverrides(repo,baseline).overrides.get('l');
  assert(record && record.isNew,'La V1 de transport doit etre declaree dans TESTS_V1');
  assert.equal(record.relative.replace(/\\/g,'/'),'l/1.0.0/test.json');
  const output=path.join(tmp,'seed','tests');
  writeOfficialSeedOverrides({repoRoot:repo,sourceTestsDir:baseline,outputTestsDir:output});
  const seeded=JSON.parse(fs.readFileSync(path.join(output,'l','1.0.0','test.json'),'utf8'));
  assert.equal(seeded.questions.length,5);
  assert.equal(seeded.presentation.builderContent[1].resource.data,allReferences[2]);

  const lib=createKaloneoLibrary({
    dataRoot:path.join(tmp,'user'),
    seedTestsRoot:output,
    suppliedImagesRoot:supplied
  });
  const item=lib.getTest('l','1.0.0');
  assert.equal(item.ok,true,'V1 Bon de transport absente de la bibliotheque candidate');
  const actual=item.definition;
  for(const [i,sourceUri] of allReferences.entries()){
    const got=i<2?actual.presentation.supplementaryWindows[i].imageData:
      actual.presentation.builderContent[1].resource.data;
    assert(got.startsWith('data:image/png;base64,'),'Image manquante dans le rendu : '+i);
    assert.equal(sha(Buffer.from(got.split(',')[1],'base64')),expected[i][1],'Image non identique dans le rendu : '+i);
  }
  assert.deepEqual(actual.questions,original.questions,'Réponses ou barèmes modifiés');
  assert.deepEqual(actual.presentation.builderContent.map(b=>b.type),
    original.presentation.builderContent.map(b=>b.type),'Blocs du Builder modifiés');
  console.log('KALONEO_BON_TRANSPORT_V1_SEED=OK');
  console.log('KALONEO_BON_TRANSPORT_V1_IMAGES_THREE_FROM_CATALOG_EXACT_SHA256=OK');
  console.log('KALONEO_BON_TRANSPORT_V1_LAYOUT_40_60_SCORING_4_AND_BILAN=OK');
  console.log('KALONEO_BON_TRANSPORT_V1_REAL_LIBRARY_HYDRATION=OK');
}finally{
 fs.rmSync(tmp,{recursive:true,force:true});
}
