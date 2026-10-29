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
  ['horaires/04H00.png','680dc5470cbc5b476717f554d78da87f9fe6412e'],
  ['horaires/06H15.png','224070a2f5ecd3ee0e1a621b801abad93f39ef89'],
  ['02_fin_stage_01/05.png','c814aeab09b343b4b44fd03c1df583c8771a96dd4091e399776a2a4314605bc8']
];
// Vérifier chaque nouvelle horloge dans le catalogue sans se fier à son nom seul.
const catalogue=JSON.parse(fs.readFileSync(path.join(supplied,'catalogue-images.json'),'utf8'));
const indexed=catalogue.files.filter(file=>file.path.startsWith('horaires/'));
assert.equal(indexed.length,48,'La bibliothèque doit contenir exactement 48 horloges');
const expectedNames=[];
for(let hour=0;hour<12;hour++)for(const minute of ['00','15','30','45'])
  expectedNames.push('horaires/'+String(hour).padStart(2,'0')+'H'+minute+'.png');
assert.deepEqual(indexed.map(file=>file.path).sort(),expectedNames.sort());
for(const file of indexed){
  const bytes=fs.readFileSync(path.join(supplied,...file.path.split('/')));
  const blob=crypto.createHash('sha1')
    .update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex');
  assert.equal(file.sha1,blob,'Empreinte de la nouvelle horloge incorrecte : '+file.path);
  assert.equal(file.bytes,bytes.length,'Taille de la nouvelle horloge incorrecte : '+file.path);
}
// Aide administrateur : l'image fournie doit représenter la rubrique Candidats,
// sans altérer l'image A01 de la rubrique Accueil.
const helpHtml=fs.readFileSync(path.join(repo,'kaloneo','admin-help','index.html'),'utf8');
const candidateSection=helpHtml.split('<h2>Retrouver un candidat</h2>')[1]?.split('</article>')[0]||'';
assert(candidateSection.includes('src="captures/A09.png"'),
  'Aide Candidats : la capture A09 n’est pas utilisée');
assert(!candidateSection.includes('src="captures/A01.png"'),
  'Aide Candidats : capture d’accueil encore présente');
const helpImage=fs.readFileSync(path.join(repo,'kaloneo','admin-help','captures','A09.png'));
assert(helpImage.length>1000 && helpImage.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')),
  'Image A09 absente ou invalide');

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
  // Même barème /4, mais deux cases numériques pour la durée 2 h 15.
  const durationQuestion=original.questions[1];
  assert.equal(durationQuestion.id,'ID2_l');
  assert.equal(durationQuestion.response.type,'duration');
  assert.equal(durationQuestion.response.normalizer,'duration-fr');
  assert.equal(durationQuestion.response.splitHoursMinutes,true);
  assert.equal(durationQuestion.acceptedMinutes,135);
  assert.equal(durationQuestion.points,1);
  assert.equal(durationQuestion.acceptedAnswers,undefined);

  // La transformation Builder aller-retour conserve les deux champs.
  const Core=require('../../kaloneo/builder-core.js');
  const model=Core.definitionToModel(original);
  const durationBlock=model.blocks.find(block=>block.type==='question'&&block.question?.id==='ID2_l');
  assert(durationBlock&&durationBlock.question.splitHoursMinutes===true,
    'Le Builder a perdu la présentation Heures/Minutes');
  const rebuilt=Core.modelToDefinition(model);
  const roundtrip=rebuilt.questions.find(question=>question.id==='ID2_l');
  assert.equal(roundtrip?.response?.type,'duration');
  assert.equal(roundtrip?.response?.splitHoursMinutes,true);
  assert.equal(roundtrip?.acceptedMinutes,135);

  // Tester le véritable normaliseur extrait du runtime candidat, et non
  // une copie divergente de ses règles de correction.
  const runtime=fs.readFileSync(path.join(repo,'seb-evalpro','source','js','kaltest-pilot2-runtime.js'),'utf8');
  const start=runtime.indexOf('  function normalizeText(value) {');
  const end=runtime.indexOf('  function showCorrectionDuringParcours()',start);
  assert(start>=0&&end>start,'Normaliseur candidat introuvable');
  const grader=new Function(runtime.slice(start,end)+'; return {parseDurationFr,evaluateQuestion};')();
  for(const answer of ['2h15','2H15','2 h 15','2 H 15','2 heures 15 minutes','2:15']){
    assert.equal(grader.parseDurationFr(answer),135,'Durée incorrecte : '+answer);
    assert.equal(grader.evaluateQuestion(durationQuestion,answer),true,'Réponse refusée : '+answer);
  }
  for(const wrong of ['2h14','2h60','3h15','','h15','2h']){
    assert.equal(grader.evaluateQuestion(durationQuestion,wrong),false,'Réponse incorrecte acceptée : '+wrong);
  }
  assert(runtime.includes("group.className = 'kaloneo-duration-parts';"));
  assert(runtime.includes("hoursInput = addPart('Heures', hoursValue, false);"));
  assert(runtime.includes("minutesInput = addPart('Minutes', minutesValue, true);"));
  assert.deepEqual(original.questions[2].acceptedAnswers,['43.25','43,25']);
  assert.deepEqual(original.questions[3].acceptedAnswers,['7.5','7,5','7.50','7,50']);
  assert.equal(original.calculator.defaultEnabled,false);
  for(const [i,[relative,digest]] of expected.entries()){
    const bytes=fs.readFileSync(path.join(supplied,...relative.split('/')));
    const actual=i<2?crypto.createHash('sha1')
      .update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex'):sha(bytes);
    assert.equal(actual,digest,'Image fournie différente : '+relative);
    assert(original.kaloneoLibrary.imageSources.some(x=>x.sourcePath===relative&&
      (i<2?x.gitBlobSha1===digest:x.sha256===digest)));
  }
  const allReferences=[
    original.presentation.supplementaryWindows[0].imageData,
    original.presentation.supplementaryWindows[1].imageData,
    original.presentation.builderContent[1].resource.data
  ];
  assert.deepEqual(allReferences,[
    'kaloneo-supplied:horaires/04H00.png',
    'kaloneo-supplied:horaires/06H15.png',
    'kaloneo-asset:'+expected[2][1]+'.png'
  ]);
  assert(original.presentation.supplementaryWindows.every(w=>w.type==='image' &&
    !/04H00|06H15|4h00|6h15/i.test([w.title,w.imageName,w.imageAlt].join(' '))),
    'L’heure ou le nom du fichier est montré au candidat');

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
    suppliedImagesRoot:supplied,
    seedImageRoots:[{root:path.join(tmp,'seed','v1-assets'),category:'Images tests Builder KALONÉO'}]
  });
  const item=lib.getTest('l','1.0.0');
  assert.equal(item.ok,true,'V1 Bon de transport absente de la bibliotheque candidate');
  const actual=item.definition;
  for(const [i,sourceUri] of allReferences.entries()){
    const got=i<2?actual.presentation.supplementaryWindows[i].imageData:
      actual.presentation.builderContent[1].resource.data;
    assert(got.startsWith('data:image/png;base64,'),'Image manquante dans le rendu : '+i);
    const bytes=Buffer.from(got.split(',')[1],'base64');
    const actualDigest=i<2?crypto.createHash('sha1')
      .update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex'):sha(bytes);
    assert.equal(actualDigest,expected[i][1],'Image non identique dans le rendu : '+i);
  }
  assert.deepEqual(actual.questions,original.questions,'Réponses ou barèmes modifiés');
  assert.deepEqual(actual.presentation.builderContent.map(b=>b.type),
    original.presentation.builderContent.map(b=>b.type),'Blocs du Builder modifiés');
  console.log('KALONEO_BON_TRANSPORT_V1_SEED=OK');
  console.log('KALONEO_BON_TRANSPORT_V1_IMAGES_THREE_FROM_CATALOG_VERIFIED=OK');
  console.log('KALONEO_BON_TRANSPORT_V1_LAYOUT_40_60_SCORING_4_AND_BILAN=OK');
  console.log('KALONEO_BON_TRANSPORT_V1_REAL_LIBRARY_HYDRATION=OK');
}finally{
 fs.rmSync(tmp,{recursive:true,force:true});
}
