'use strict';
// Contrôle Electron sur un KALTEST fictif, sans parcours ni V1 officielle.
const {app,BrowserWindow,ipcMain}=require('electron');
const assert=require('node:assert/strict');
const path=require('node:path');
const Core=require('../../kaloneo/builder-core.js');
const root=path.resolve(__dirname,'..');
const image='data:image/svg+xml;base64,'+Buffer.from(
 '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="60"><rect width="80" height="60" fill="#427797"/></svg>'
).toString('base64');
const windows=[
 {id:'doc-plan',title:'Plan entrepôt inédit',type:'image',imageData:image,imageName:'plan.svg',imageAlt:'Plan de contrôle'},
 {id:'doc-liste',title:'Liste des articles',type:'list',text:'Colis A\nColis B\nColis C'},
 {id:'doc-table',title:'Tableau des colis',type:'table',text:'Article;Stock\nA;2\nB;5'},
 {id:'doc-text',title:'Long document',type:'text',text:'Procédure longue\nDeuxième instruction'}
];
const definition=Core.modelToDefinition({
 meta:{id:'candidate_supplementary_future_2026',title:'Test documentaire inédit',
   version:'1.0.0',category:'organisation',scored:false,layout:'single',
   scenario:'Situation inventée',instruction:'Consulter puis répondre'},
 blocks:[
  {uid:'new_intro',type:'text',zone:'left',text:'Début de mission',
   supplementaryButtons:[{label:'Voir le plan',windowId:'doc-plan',position:'after'}]},
  {uid:'new_question',type:'question',zone:'left',
   question:{id:'question_document_1',prompt:'Numéro du colis ?',responseType:'text',
    points:1,acceptedAnswers:'12'}}
 ],supplementaryWindows:windows
});
assert(Core.analyzeDefinition(definition).ok);
const runtime={ok:true,runtime:{
 id:'supplementary-run',title:'Parcours synthétique',builderPreview:true,
 launchOptions:{showCorrectionsDuringParcours:false},
 introduction:null,tests:[definition],fin:null
}};
let saves=0,replays=0;
const ok={ok:true};
ipcMain.on('app:edition-sync',e=>e.returnValue={edition:'unified',canBilan:true,canAi:true,canImport:true,canExport:true});
ipcMain.on('state:load-sync',e=>e.returnValue={version:1,sessionStorage:{},localStorage:{},lastPage:'kaltest-pilot2.html'});
ipcMain.on('state:save-sync',e=>{saves++;e.returnValue=ok;});
ipcMain.on('candidate-catalog:workspace-load-sync',e=>e.returnValue={ok:false});
ipcMain.on('candidate-catalog:workspace-save-sync',e=>e.returnValue=ok);
ipcMain.on('candidate-catalog:results-workspace-load-sync',e=>e.returnValue={ok:false});
ipcMain.on('kaloneo-library:selected-runtime-sync',e=>e.returnValue=runtime);
ipcMain.handle('kaloneo-library:selected-runtime',()=>runtime);
ipcMain.handle('kaloneo-builder:close-preview',()=>ok);
for(const key of ['admin:status','admin:verify','admin:lock'])ipcMain.handle(key,()=>true);
ipcMain.handle('candidate:active',()=>null);
ipcMain.handle('state:save',()=>{saves++;return ok;});
ipcMain.handle('replay:capture-page',()=>{replays++;return ok;});
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
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const timer=setTimeout(()=>{console.error('SUPPLEMENTARY_ELECTRON: TIMEOUT');app.exit(2);},60000);
function fail(e){console.error('SUPPLEMENTARY_ELECTRON: FAIL',e?.stack||String(e));app.exit(2);}
async function candidateCheck(){
  const host=document.getElementById('kaltest-content');
  const dialog=document.getElementById('kaltest-supplementary-dialog');
  const trigger=host?.querySelector('.kaltest-supplementary-trigger');
  const input=host?.querySelector('input');
  if(!dialog||!trigger||!input)return {error:'contrôle ou réponse absent'};
  input.value='Réponse conservée 2026';
  trigger.focus(); // Simule la vraie activation clavier/souris avant showModal().
  trigger.click();
  const open=dialog.open,first=document.getElementById('kaltest-supplementary-title').textContent;
  const bounds=dialog.getBoundingClientRect();
  const within=bounds.width<=innerWidth*.8+3&&bounds.height<=innerHeight*.8+3;
  await new Promise(resolve=>setTimeout(resolve,160));
  const image=document.querySelector('#kaltest-supplementary-content img');
  const imageReady=!!(image?.complete&&image.naturalWidth>0);
  const back=document.getElementById('kaltest-supplementary-previous');
  const next=document.getElementById('kaltest-supplementary-next');
  const firstBackDisabled=back.disabled;
  next.click();
  const second=document.getElementById('kaltest-supplementary-title').textContent;
  const listText=document.getElementById('kaltest-supplementary-content').textContent;
  next.click();
  const table=document.querySelector('#kaltest-supplementary-content table');
  const tableCells=[...table?.querySelectorAll('td')||[]].map(x=>x.textContent);
  next.click();
  const fourth=document.getElementById('kaltest-supplementary-title').textContent;
  const lastNextDisabled=next.disabled;
  document.getElementById('kaltest-supplementary-close').click();
  await new Promise(resolve=>setTimeout(resolve,10));
  const close=!dialog.open;
  const answerPreserved=input.value==='Réponse conservée 2026';
  const focusRestored=document.activeElement===trigger;
  return {open,first,within,imageReady,firstBackDisabled,second,
    listText,tableCells,fourth,lastNextDisabled,close,answerPreserved,
    focusRestored,triggerCount:host.querySelectorAll('.kaltest-supplementary-trigger').length};
}
app.whenReady().then(async()=>{
 try{
  const win=new BrowserWindow({show:true,width:1366,height:768,
    webPreferences:{preload:path.join(root,'src','preload.js'),
      contextIsolation:true,nodeIntegration:false,sandbox:false}});
  win.webContents.on('preload-error',(_event,file,e)=>fail(new Error(file+':'+e)));
  await win.loadFile(path.join(root,'app','web','kaltest-pilot2.html'),{query:{kaloneoPreview:'1'}});
  await wait(900);
  const got=await win.webContents.executeJavaScript('('+candidateCheck.toString()+')()');
  assert(!got.error,JSON.stringify(got));
  assert.equal(got.open,true,'Dialogue interne non ouvert');
  assert.equal(got.first,windows[0].title);
  assert.equal(got.within,true,'Fenêtre dépasse 80 % écran');
  assert.equal(got.imageReady,true,'Image embarquée non chargée');
  assert.equal(got.firstBackDisabled,true);
  assert.equal(got.second,windows[1].title);
  assert.ok(got.listText.includes('Colis B'));
  assert.deepEqual(got.tableCells,['Article','Stock','A','2','B','5']);
  assert.equal(got.fourth,windows[3].title);
  assert.equal(got.lastNextDisabled,true);
  assert.equal(got.close,true);
  assert.equal(got.answerPreserved,true,'Saisie candidat perdue après fermeture');
  assert.equal(got.focusRestored,true,'Focus non restitué au bouton initial');
  assert.equal(got.triggerCount,1);
  assert.equal(saves,0,'L’aperçu écrit des données candidat');
  assert.equal(replays,0,'Replay non sollicité');
  const capture=await win.webContents.capturePage();
  assert(!capture.isEmpty(),'Capture Electron vide');
  console.log('SUPPLEMENTARY_ELECTRON: OK',JSON.stringify({id:definition.id,results:got,screenshot:capture.getSize()}));
  clearTimeout(timer);win.destroy();app.quit();
 }catch(e){fail(e);}
}).catch(fail);
