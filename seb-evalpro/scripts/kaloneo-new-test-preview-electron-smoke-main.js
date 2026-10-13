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
ipcMain.handle('kaloneo-builder:get-preview',()=>({ok:true,definition}));
ipcMain.handle('kaloneo-builder:close-preview',()=>true);
ipcMain.handle('state:save',()=>{saves++;return {ok:true};});
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
  assert.equal(saves,0,'aperçu enregistre des données candidat');
  console.log('FRESH_KALTEST_PREVIEW: OK',JSON.stringify({
    columns:observed.zoneCount,tableCount:observed.tableCount,
    rowCounts:observed.rowCounts,imageReady:observed.imageReady,
    screenshot:picture.getSize(),saves
  }));
  clearTimeout(timeout);win.destroy();app.quit();
 }catch(error){fail(error);}
}).catch(fail);
