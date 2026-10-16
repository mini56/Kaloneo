'use strict';
// Contrôle réel Electron d'un test KALTEST fabriqué sans fichier du catalogue.
const {app,BrowserWindow,ipcMain}=require('electron');
const assert=require('node:assert/strict');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const Core=require('../../kaloneo/builder-core.js');
const image='data:image/svg+xml;base64,'+Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="90"><rect width="120" height="90" fill="#267695"/></svg>').toString('base64');
const definition={
 id:'synthetic_future_builder_test',version:'1.0.0',title:'Tableaux d’un test inédit',
 category:'organisation',kind:'questionnaire',scored:false,
 scenario:'Un nouveau test construit sans catalogue',instruction:'Saisir deux réponses',
 calculator:{compatible:false},
 questions:[
  {id:'q_new_a',prompt:'Question alpha',response:{type:'text'}},
  {id:'q_new_b',prompt:'Question beta',response:{type:'text'}}
 ],
 presentation:{layout:'50-50',builderContent:[
  {type:'table-grid',zone:'left',table:{title:'Grille nouvelle',rows:1,cols:2,
    headers:['Référence','Réponse'],cells:[[{kind:'fixed-text',value:'Pièce A'},{kind:'candidate-answer',questionId:'q_new_a'}]]}},
  {type:'image',zone:'left',resource:{name:'nouvelle.svg',data:image,mime:'image/svg+xml',alt:'Forme de couleur'}},
  {type:'response-table',zone:'right',definition:{headers:['Numéro','Saisie','Unités']}},
  {type:'table-definition',zone:'right',definition:{title:'Tableau tout neuf',headers:['Avant','Après'],questionIds:['q_new_b']}}
 ]}
};
let saves=0;
let activePreviewDefinition=definition;
ipcMain.on('app:edition-sync',event=>event.returnValue={edition:'unified',canBilan:true,canAi:true,canImport:true,canExport:true});
ipcMain.on('state:load-sync',event=>event.returnValue={version:1,sessionStorage:{},localStorage:{}});
ipcMain.on('state:save-sync',event=>{saves++;event.returnValue={ok:true};});
ipcMain.on('candidate-catalog:workspace-load-sync',event=>event.returnValue={ok:false});
ipcMain.on('candidate-catalog:workspace-save-sync',event=>event.returnValue={ok:true});
ipcMain.on('candidate-catalog:results-workspace-load-sync',event=>event.returnValue={ok:false});
ipcMain.handle('kaloneo-builder:get-preview',()=>({ok:true,definition:activePreviewDefinition}));
ipcMain.handle('kaloneo-builder:close-preview',()=>true);
ipcMain.handle('state:save',()=>{saves++;return {ok:true};});

const runtime={ok:true,runtime:{
  id:'synthetic-future-runtime',
  title:'Parcours fictif indépendant du catalogue',builderPreview:true,
  launchOptions:{showCorrectionsDuringParcours:false},
  introduction:null,tests:[definition],fin:null
}};
const ok={ok:true};
ipcMain.on('kaloneo-library:selected-runtime-sync',event=>event.returnValue=runtime);
ipcMain.handle('kaloneo-library:selected-runtime',()=>runtime);
ipcMain.handle('admin:status',()=>true);
ipcMain.handle('admin:verify',()=>true);
ipcMain.handle('admin:lock',()=>true);
ipcMain.handle('candidate:active',()=>null);
ipcMain.handle('replay:capture-page',()=>ok);
ipcMain.handle('replay:list',()=>[]);
ipcMain.handle('bilan-history:list',()=>[]);
ipcMain.handle('candidate-catalog:list',()=>[]);
ipcMain.handle('candidate-catalog:sync',()=>ok);
ipcMain.handle('candidate-catalog:detail',()=>({ok:false}));
ipcMain.handle('candidate-catalog:workspace-save',()=>ok);
ipcMain.handle('candidate-catalog:end-bilan',()=>ok);
ipcMain.handle('ai:status',()=>({available:false}));
ipcMain.handle('ai:cancel-current',()=>ok);
ipcMain.handle('kaloneo-library:get-mask-screen',()=>({ok:false}));
ipcMain.handle('kaloneo-library:list-tests',()=>({ok:true,tests:[]}));
ipcMain.handle('kaloneo-library:list-mask-screens',()=>({ok:true,maskScreens:[]}));

const timeout=setTimeout(()=>{console.error('FRESH_KALTEST_PREVIEW: TIMEOUT');app.exit(2);},45000);
function fail(error){console.error('FRESH_KALTEST_PREVIEW: FAIL',error?.stack||String(error));app.exit(2);}
app.whenReady().then(async()=>{
 try{
  const win=new BrowserWindow({show:false,width:1366,height:768,
    webPreferences:{preload:path.join(root,'src','preload.js'),
      contextIsolation:true,nodeIntegration:false,sandbox:false}});
  win.webContents.on('preload-error',(_event,p,e)=>fail(new Error('Preload '+p+': '+e)));
  await win.loadFile(path.join(root,'app','web','kaloneo-builder','test-preview.html'));
  await new Promise(resolve=>setTimeout(resolve,600));
  const browserChecks=()=>{
    const zones=[...document.querySelectorAll('.kb-zone')];
    const tables=[...document.querySelectorAll('.kb-table')];
    const rows=table=>[...table.querySelectorAll('tbody tr')];
    const image=document.querySelector('.kb-media-block img.kb-media');
    const lr=zones[0]?.getBoundingClientRect(),rr=zones[1]?.getBoundingClientRect();
    return {
      page:!!document.querySelector('.kb-preview-page'),
      error:document.querySelector('.kb-error')?.textContent||'',
      title:document.querySelector('.kb-heading h1')?.textContent||'',
      zoneCount:zones.length,
      horizontal:!!(lr&&rr&&rr.left>=lr.right-2&&lr.width>100&&rr.width>100),
      tableCount:tables.length,
      headers:tables.map(t=>[...t.querySelectorAll('thead th')].map(h=>h.textContent)),
      rowCounts:tables.map(t=>rows(t).length),
      gridText:tables[0]?.querySelector('tbody td')?.textContent||'',
      multipleText:tables[2]?.querySelector('tbody')?.textContent||'',
      inputCount:tables.reduce((sum,t)=>sum+t.querySelectorAll('input,select,textarea').length,0),
      imageReady:!!(image?.complete&&image?.naturalWidth>0),
      imageAlt:image?.alt,
      hasClose:!!document.querySelector('.close-preview')
    };
  };
  const observed=await win.webContents.executeJavaScript('('+browserChecks.toString()+')()');
  assert.equal(observed.page,true,JSON.stringify(observed));
  assert.equal(observed.error,'',JSON.stringify(observed));
  assert.equal(observed.title,definition.title);
  assert.equal(observed.zoneCount,2);
  assert.equal(observed.horizontal,true,'colonnes absentes');
  assert.equal(observed.tableCount,3,'un tableau manque');
  assert.deepEqual(observed.headers,[['Référence','Réponse'],['Numéro','Saisie','Unités'],['Avant','Après']]);
  assert.deepEqual(observed.rowCounts,[1,2,1],'une ligne est absente');
  assert.equal(observed.gridText,'Pièce A');
  assert.ok(observed.multipleText.includes('Question beta'));
  assert.ok(observed.inputCount>=4,'champs manquants');
  assert.equal(observed.imageReady,true,'image non chargée');
  assert.equal(observed.imageAlt,'Forme de couleur');
  assert.equal(observed.hasClose,true);
  const picture=await win.webContents.capturePage();
  assert.ok(!picture.isEmpty(),'capture Electron vide');
  // La même définition nouvellement créée doit être lisible par le moteur
  // candidat réel, sans fixture ni exception liée à son identifiant.
  win.show();
  await win.loadFile(path.join(root,'app','web','kaltest-pilot2.html'),{
    query:{kaloneoPreview:'1'}
  });
  await new Promise(resolve=>setTimeout(resolve,1100));
  const candidateCheck=()=>{
    const host=document.getElementById('kaltest-content');
    const zones=[...host?.querySelectorAll('.kaltest-builder-runtime-zone')||[]];
    const grid=host?.querySelector('.kaltest-builder-grid');
    const answerTable=[...host?.querySelectorAll('.kaltest-table')||[]]
      .find(table=>table!==grid);
    const image=host?.querySelector('.kaltest-builder-media img');
    const ar=zones[0]?.getBoundingClientRect();
    const br=zones[1]?.getBoundingClientRect();
    return {
      id:document.body.dataset.sebKaltestId,
      visible:document.getElementById('page-exercise')?.classList.contains('visible'),
      zoneCount:zones.length,
      horizontal:!!(ar&&br&&br.left>=ar.right-2&&ar.width>100&&br.width>100),
      header:[...grid?.querySelectorAll('thead th')||[]].map(x=>x.textContent),
      gridRows:grid?.querySelectorAll('tbody tr').length||0,
      gridText:grid?.querySelector('tbody td')?.textContent||'',
      answerHeaders:[...answerTable?.querySelectorAll('thead th')||[]].map(x=>x.textContent),
      answerRows:answerTable?.querySelectorAll('tbody tr').length||0,
      editableInputs:host?.querySelectorAll('input,select,textarea').length||0,
      historicalQuestion:host?.textContent.includes('Question beta')||false,
      imageLoaded:!!(image?.complete&&image.naturalWidth>0),
      imageAlt:image?.alt||''
    };
  };
  const candidate=await win.webContents.executeJavaScript('('+candidateCheck.toString()+')()');
  assert.equal(candidate.id,definition.id,'Le candidat ne charge pas le test fictif');
  assert.equal(candidate.visible,true,'Écran candidat non visible');
  assert.equal(candidate.zoneCount,observed.zoneCount,'Les zones du candidat diffèrent de l’aperçu');
  assert.equal(candidate.horizontal,observed.horizontal,'Colonnes alignées différemment');
  assert.deepEqual(candidate.header,observed.headers[0],'En-têtes de la grille divergents');
  assert.equal(candidate.gridRows,observed.rowCounts[0],'Grille de taille différente');
  assert.equal(candidate.gridText,observed.gridText,'Texte de grille incohérent');
  assert.deepEqual(candidate.answerHeaders,observed.headers[1],'En-têtes de réponse divergents');
  assert.equal(candidate.answerRows,observed.rowCounts[1],'Table de réponses incohérente');
  assert.ok(candidate.historicalQuestion,'Question de tableau absente côté candidat');
  assert.equal(candidate.imageLoaded,observed.imageReady,'Image manquante côté candidat');
  assert.equal(candidate.imageAlt,observed.imageAlt,'Texte alternatif de l’image différent');
  assert.ok(candidate.editableInputs>=3,'Le candidat ne présente pas les champs attendus');
  const candidateScreenshot=await win.webContents.capturePage();
  assert.ok(!candidateScreenshot.isEmpty(),'Capture candidat vide');
  assert.equal(saves,0,'L’aperçu candidat a modifié le stockage');
  assert.equal(saves,0,'aperçu enregistre des données candidat');

  // Contrôle strict d'un nouveau test créé par le Builder, sans catalogue
  // ni ID historique. Toute saisie passe par les vrais contrôles Electron.
  const grid=Core.createGridBlock(3,3);
  grid.table.title='Test autonome complet';
  grid.table.headers=['Indication','Saisie','Unité'];
  Object.assign(grid.table.cells[0][0],{kind:'fixed-text',value:'Poids de la livraison'});
  Object.assign(grid.table.cells[0][1],{
    kind:'candidate-answer',questionId:'poids_2027',responseType:'number',
    acceptedAnswers:'12',points:2
  });
  Object.assign(grid.table.cells[0][2],{
    kind:'unit',questionId:'poids_2027',acceptedUnits:'kg; KG; kilo; kilogramme',
    unitScored:true
  });
  Object.assign(grid.table.cells[1][0],{kind:'fixed-text',value:'Combien de colis ?'});
  Object.assign(grid.table.cells[1][1],{
    kind:'select',questionId:'colis_2027',responseType:'select',
    acceptedAnswers:'10',options:['8','10','12'],points:1,
    backgroundColor:'#203040',textColor:'#ffffff'
  });
  Object.assign(grid.table.cells[2][0],{
    kind:'image',value:image,mediaName:'illustration-libre.svg',alt:'Forme libre'
  });
  const extra={
    uid:'extra_future',type:'response-table',zone:'left',
    responseTable:{headers:['Numéro','Réponse','Unités','Opérations effectuées'],
      columns:[{id:'number'},{id:'answer'},{id:'unit'},{id:'extra'}]}
  };
  const tableDefinition={
    uid:'table_future',type:'multiple-tables',zone:'left',
    tableDefinition:{title:'Réponses du test futur',
      headers:['Question','Réponse'],questionIds:['poids_2027']}
  };
  const flow={
    uid:'gap_future',type:'inline-flow',zone:'left',wordBank:['10'],
    flow:[{type:'text',text:'Répondre à nouveau : '},
      {type:'question',questionId:'colis_2027'}]
  };
  const m={
    meta:{id:'audit_candidat_2027',version:'1.0.0',
      title:'Test totalement nouveau',category:'mathematiques',
      scored:true,layout:'single',scenario:'Exercice',instruction:'Répondre'},
    blocks:[grid,extra,tableDefinition,flow]
  };
  const newDefinition=Core.modelToDefinition(m);
  assert(Core.analyzeDefinition(newDefinition).ok,
    JSON.stringify(Core.analyzeDefinition(newDefinition).errors));
  assert.equal(newDefinition.questions.length,2);
  assert.equal(newDefinition.questions[0].points,2);
  assert.equal(newDefinition.questions[0].unitScored,true);
  assert.equal(newDefinition.questions[0].unitInput,true);
  assert.deepEqual(newDefinition.questions[0].acceptedUnits,
    ['kg','KG','kilo','kilogramme']);
  assert.equal(newDefinition.questions[1].response.type,'select');
  assert.deepEqual(newDefinition.questions[1].response.options,['8','10','12']);
  assert.deepEqual(newDefinition.questions[0].supplementalFields,
    [{id:'operations_effectuees',label:'Opérations effectuées'}]);
  // Export -> import -> enregistrement : structure et barème stables.
  const reimported=Core.modelToDefinition(Core.definitionToModel(newDefinition));
  assert(Core.analyzeDefinition(reimported).ok);
  assert.deepEqual(reimported.questions,newDefinition.questions);
  assert.deepEqual(reimported.presentation.builderContent,
    newDefinition.presentation.builderContent);
  activePreviewDefinition=reimported;
  runtime.runtime.tests=[reimported];
  await win.loadFile(path.join(root,'app','web','kaloneo-builder','test-preview.html'));
  await new Promise(resolve=>setTimeout(resolve,450));
  const secondPreview=await win.webContents.executeJavaScript(`(()=>{
    const tables=[...document.querySelectorAll('table.kb-table')];
    const grid=tables.find(t=>t.textContent.includes('Poids de la livraison'));
    const headers=tables.map(t=>[...t.querySelectorAll('thead th')]
      .map(x=>x.textContent));
    const rows=grid?.querySelectorAll('tbody tr');
    const firstInputs=rows?.[0]?.querySelectorAll('input').length||0;
    const select=rows?.[1]?.querySelector('select');
    const image=rows?.[2]?.querySelector('img');
    return {error:document.querySelector('.kb-error')?.textContent||'',
      tableCount:tables.length,headers,firstInputs,
      options:[...(select?.options||[])].map(o=>o.value),
      imageReady:!!(image?.complete&&image?.naturalWidth>0),
      imageAlt:image?.alt||'',unitPlaceholder:
        rows?.[0]?.children?.[2]?.querySelector('input')?.placeholder||''};
  })()`);
  assert.equal(secondPreview.error,'',JSON.stringify(secondPreview));
  assert.equal(secondPreview.tableCount,3);
  assert.equal(secondPreview.firstInputs,2,'La valeur et l unité ne sont pas deux champs');
  assert.deepEqual(secondPreview.options,['','8','10','12']);
  assert.equal(secondPreview.unitPlaceholder,'Unité');
  assert.equal(secondPreview.imageReady,true);
  assert.equal(secondPreview.imageAlt,'Forme libre');
  assert.ok(secondPreview.headers.some(h=>h.includes('Opérations effectuées')));
  await win.loadFile(path.join(root,'app','web','kaltest-pilot2.html'),{
    query:{kaloneoPreview:'1'}
  });
  await new Promise(resolve=>setTimeout(resolve,950));
  const interacted=await win.webContents.executeJavaScript(`(()=>{
    const api=window.sebKaltestPilot2;
    const test=api?.currentTest?.();
    const grid=document.querySelector('.kaltest-builder-grid');
    const rows=[...(grid?.querySelectorAll('tbody tr')||[])];
    const numeric=rows[0]?.children[1]?.querySelector('input');
    const unit=rows[0]?.children[2]?.querySelector('input');
    const select=rows[1]?.children[1]?.querySelector('select');
    const img=rows[2]?.children[0]?.querySelector('img');
    const extra=[...document.querySelectorAll('table.kaltest-table')]
      .find(t=>[...t.querySelectorAll('thead th')]
        .some(x=>x.textContent==='Opérations effectuées'));
    const supplemental=extra?.querySelector('tbody tr:first-child td:nth-child(4) input');
    const table=[...document.querySelectorAll('table.kaltest-table')]
      .find(t=>[...t.querySelectorAll('thead th')]
        .some(x=>x.textContent==='Question'));
    if(!numeric||!unit||!select||!supplemental||!table||!img||!api||!test)
      return {ok:false,numeric:!!numeric,unit:!!unit,select:!!select,
        supplemental:!!supplemental,table:!!table,image:!!img,api:!!api};
    const set=(el,v)=>{el.value=v;el.dispatchEvent(
      new Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}));};
    const evaluate=()=>{
      const state=api.state.tests[test.id];
      return api.evaluateTest(test,state);
    };
    set(numeric,'11');set(unit,'KILO');
    const wrongValue=evaluate();
    set(numeric,'12');set(unit,'m');set(select,'10');
    const wrongUnit=evaluate();
    set(unit,'kg');set(supplemental,'Vérification manuelle');
    const correct=evaluate();
    const saved=api.state.tests[test.id];
    const options=[...select.options].map(o=>o.value);
    return {ok:true,wrongValue:{score:wrongValue.score,max:wrongValue.scoreMax,
      unit:wrongValue.details.poids_2027.unitCorrect},
      wrongUnit:{score:wrongUnit.score,max:wrongUnit.scoreMax,
      unit:wrongUnit.details.poids_2027.unitCorrect},
      correct:{score:correct.score,max:correct.scoreMax,
      unit:correct.details.poids_2027.unitCorrect},
      savedAnswer:saved.answers.poids_2027,savedUnit:saved.units.poids_2027,
      savedSelect:saved.answers.colis_2027,
      savedExtra:saved.supplemental.poids_2027?.operations_effectuees,
      options,gridRows:rows.length,tableColumns:
        table.querySelectorAll('thead th').length,
      imageReady:!!(img.complete&&img.naturalWidth>0),
      testId:document.body.dataset.sebKaltestId};
  })()`,true);
  assert.equal(interacted.ok,true,JSON.stringify(interacted));
  assert.deepEqual(interacted.options,['','8','10','12']);
  assert.deepEqual(interacted.wrongValue,{score:1,max:4,unit:true},
    'L unité correcte doit rapporter 1 point, même si la valeur est fausse');
  assert.deepEqual(interacted.wrongUnit,{score:3,max:4,unit:false});
  assert.deepEqual(interacted.correct,{score:4,max:4,unit:true});
  assert.equal(interacted.savedAnswer,'12');
  assert.equal(interacted.savedUnit,'kg');
  assert.equal(interacted.savedSelect,'10');
  assert.equal(interacted.savedExtra,'Vérification manuelle');
  assert.equal(interacted.gridRows,3);
  assert.equal(interacted.tableColumns,2);
  assert.equal(interacted.imageReady,true);
  assert.equal(interacted.testId,reimported.id);
  console.log('KALONEO_AUDIT_FULL_CANDIDATE_ELECTRON=OK',
    JSON.stringify({preview:secondPreview,interactive:interacted,
      questions:reimported.questions.map(q=>({id:q.id,points:q.points,
        unitScored:q.unitScored||false,units:q.acceptedUnits||[]}))}));

  // Test créé dans le Builder : aperçu et parcours Electron utilisant le même rendu.
  const visualModel={
    meta:{id:'future_novel_image_selection_2026',title:'Fractions par sélection d’images',
      version:'1.0.0',category:'mathematiques',scored:true,layout:'50-50',
      scenario:'Constituez la fraction',instruction:'Choisissez deux images sur huit'},
    blocks:[
      {uid:'fraction_intro',type:'text',zone:'left',text:'Sélectionnez 25 % des 8 images.'},
      {uid:'fraction_images',type:'image-selection',zone:'right',label:'25 % de huit images',
        totalItems:8,acceptedCount:2,cloud:false,
        mediaName:'illustration.svg',mediaType:'image/svg+xml',mediaData:image,mediaAlt:'Objets',
        question:{id:'fraction_image_q',prompt:'Sélectionnez 25 % des 8 images',points:1}}
    ]
  };
  const visualDefinition=Core.modelToDefinition(visualModel);
  assert.equal(Core.analyzeDefinition(visualDefinition).ok,true,'KALTEST illustré non conforme');
  const roundtripped=Core.modelToDefinition(Core.definitionToModel(visualDefinition));
  assert.deepEqual(roundtripped.questions,visualDefinition.questions,'Notation perdue après import Builder');
  assert.deepEqual(roundtripped.presentation.builderContent,visualDefinition.presentation.builderContent,
    'Images cliquables perdues après import Builder');
  activePreviewDefinition=roundtripped;runtime.runtime.tests=[roundtripped];
  await win.loadFile(path.join(root,'app','web','kaloneo-builder','test-preview.html'));
  await new Promise(resolve=>setTimeout(resolve,500));
  const visualPreview=await win.webContents.executeJavaScript('('+function(){
    const buttons=[...document.querySelectorAll('.kaltest-image-selection-item')];
    const zones=[...document.querySelectorAll('.kb-zone')];
    const imageOk=buttons.length===8&&buttons.every(x=>x.style.backgroundImage.includes('data:image/svg+xml'));
    buttons[0]?.click();buttons[1]?.click();
    return {count:buttons.length,imageOk,selected:document.querySelectorAll('.kaltest-image-selection-item.selected').length,
      zones:zones.length,error:document.querySelector('.kb-error')?.textContent||''};
  }.toString()+')()');
  assert.deepEqual(visualPreview,{count:8,imageOk:true,selected:2,zones:2,error:''},
    'Aperçu Electron du bloc Sélection d’images incorrect');
  await win.loadFile(path.join(root,'app','web','kaltest-pilot2.html'),{query:{kaloneoPreview:'1'}});
  await new Promise(resolve=>setTimeout(resolve,900));
  const visualCandidate=await win.webContents.executeJavaScript('('+function(){
    const api=window.sebKaltestPilot2;
    const test=api?.currentTest?.();
    const buttons=[...document.querySelectorAll('.kaltest-image-selection-item')];
    if(!api||!test||buttons.length!==8)return {ok:false,buttons:buttons.length};
    const evaluate=()=>{
      const r=api.evaluateTest(test,api.state.tests[test.id]);
      return [r.score,r.scoreMax];
    };
    const before=evaluate();
    buttons[0].click();buttons[1].click();
    const correct=evaluate();
    buttons[2].click();
    const wrong=evaluate();
    buttons[2].click();
    const restored=evaluate();
    return {ok:true,before,correct,wrong,restored,
      selections:api.state.tests[test.id].answers.fraction_image_q,
      image:buttons.every(x=>x.style.backgroundImage.includes('data:image/svg+xml')),
      realCandidateId:document.body.dataset.sebKaltestId,
      visualColumns:document.querySelectorAll('.kaltest-builder-runtime-zone').length};
  }.toString()+')()');
  assert.equal(visualCandidate.ok,true,JSON.stringify(visualCandidate));
  assert.deepEqual(visualCandidate.before,[0,1]);
  assert.deepEqual(visualCandidate.correct,[1,1]);
  assert.deepEqual(visualCandidate.wrong,[0,1]);
  assert.deepEqual(visualCandidate.restored,[1,1]);
  assert.deepEqual(visualCandidate.selections,['1','2']);
  assert.equal(visualCandidate.image,true);
  assert.equal(visualCandidate.realCandidateId,roundtripped.id);
  assert.equal(visualCandidate.visualColumns,2);
  console.log('KALONEO_NATIVE_IMAGE_SELECTION_ELECTRON=OK',JSON.stringify({
    preview:visualPreview,candidate:visualCandidate,baremeMax:roundtripped.questions[0].points}));
  console.log('FRESH_KALTEST_PREVIEW: OK',JSON.stringify({
    columns:observed.zoneCount,tableCount:observed.tableCount,
    rowCounts:observed.rowCounts,imageReady:observed.imageReady,
    screenshot:picture.getSize(),candidateScreenshot:candidateScreenshot.getSize(),
    candidateInputs:candidate.editableInputs,saves
  }));
  clearTimeout(timeout);win.destroy();app.quit();
 }catch(error){fail(error);}
}).catch(fail);
