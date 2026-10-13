'use strict';
// Contrôle réel Electron d'un test KALTEST fabriqué sans fichier du catalogue.
const {app,BrowserWindow,ipcMain}=require('electron');
const assert=require('node:assert/strict');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
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
ipcMain.on('app:edition-sync',event=>event.returnValue={edition:'unified',canBilan:true,canAi:true,canImport:true,canExport:true});
ipcMain.on('state:load-sync',event=>event.returnValue={version:1,sessionStorage:{},localStorage:{}});
ipcMain.on('state:save-sync',event=>{saves++;event.returnValue={ok:true};});
ipcMain.on('candidate-catalog:workspace-load-sync',event=>event.returnValue={ok:false});
ipcMain.on('candidate-catalog:workspace-save-sync',event=>event.returnValue={ok:true});
ipcMain.on('candidate-catalog:results-workspace-load-sync',event=>event.returnValue={ok:false});
ipcMain.handle('kaloneo-builder:get-preview',()=>({ok:true,definition}));
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
  console.log('FRESH_KALTEST_PREVIEW: OK',JSON.stringify({
    columns:observed.zoneCount,tableCount:observed.tableCount,
    rowCounts:observed.rowCounts,imageReady:observed.imageReady,
    screenshot:picture.getSize(),candidateScreenshot:candidateScreenshot.getSize(),
    candidateInputs:candidate.editableInputs,saves
  }));
  clearTimeout(timeout);win.destroy();app.quit();
 }catch(error){fail(error);}
}).catch(fail);
