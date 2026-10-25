'use strict';
const {app,BrowserWindow,ipcMain}=require('electron');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {embedTestImages}=require('../src/kaloneo-test-portability');
const Core=require('../../kaloneo/builder-core.js');
const root=path.resolve(__dirname,'..');
const source=path.join(root,'source','kaltest','tests','gratte-ciel','1.0.0');
const original=JSON.parse(fs.readFileSync(path.join(source,'test.json'),'utf8'));
const entry=original.presentation.supplementaryWindows?.[0];
assert.equal(original.id,'gratte_ciel');
assert.equal(original.questions.length,16,'Le Puzzle historique garde 16 questions');
assert.equal(original.questions.reduce((s,q)=>s+(Number(q.points)||0),0),16);
assert.equal(entry?.id,'puzzle_exemple_gratte_ciel');
assert.equal(entry?.type,'image');
assert.equal(entry?.imageData,'kaltest/tests/gratte-ciel/1.0.0/ex_carre_ magique.png');
const png=fs.readFileSync(path.join(source,'ex_carre_ magique.png'));
assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
const model=Core.definitionToModel(original);
const roundTrip=Core.modelToDefinition(model);
assert.deepEqual(roundTrip.presentation.supplementaryWindows,original.presentation.supplementaryWindows,
  'La fenêtre d exemple est perdue à l export Builder');
assert.deepEqual(roundTrip.questions,original.questions);
const portable=embedTestImages(original,path.join(root,'source'));
assert.equal(portable.embeddedCount,1,'Le transfert de test doit embarquer cette seule image');
assert(portable.definition.presentation.supplementaryWindows[0].imageData.startsWith('data:image/png;base64,'));
assert(!entry.imageData.startsWith('data:'),'Le Setup ne doit pas dupliquer l image dans son JSON');
const runtime={ok:true,runtime:{id:'test-example-puzzle',title:'Puzzle exemple R173',
 builderPreview:true,launchOptions:{showCorrectionsDuringParcours:false},tests:[original],introduction:null,fin:null}};
const ok={ok:true};let writes=0;
ipcMain.on('app:edition-sync',e=>e.returnValue={edition:'unified',canBilan:true,canAi:true,canImport:true,canExport:true});
ipcMain.on('state:load-sync',e=>e.returnValue={version:1,sessionStorage:{},localStorage:{},lastPage:'kaltest-pilot2.html'});
ipcMain.on('state:save-sync',e=>{writes++;e.returnValue=ok;});
ipcMain.on('candidate-catalog:workspace-load-sync',e=>e.returnValue={ok:false});
ipcMain.on('candidate-catalog:results-workspace-load-sync',e=>e.returnValue={ok:false});
ipcMain.on('candidate-catalog:workspace-save-sync',e=>e.returnValue=ok);
ipcMain.on('kaloneo-library:selected-runtime-sync',e=>e.returnValue=runtime);
ipcMain.handle('kaloneo-library:selected-runtime',()=>runtime);
ipcMain.handle('kaloneo-builder:close-preview',()=>true);
for(const name of ['admin:status','admin:verify','admin:lock'])ipcMain.handle(name,()=>true);
for(const name of ['candidate:active','candidate-catalog:list','candidate-catalog:detail','replay:list','bilan-history:list'])
 ipcMain.handle(name,()=>null);
for(const name of ['state:save','replay:capture-page','candidate-catalog:workspace-save','candidate-catalog:end-bilan'])
 ipcMain.handle(name,()=>ok);
ipcMain.handle('ai:status',()=>({available:false}));
ipcMain.handle('ai:cancel-current',()=>ok);
ipcMain.handle('kaloneo-library:get-mask-screen',()=>({ok:false}));
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const timer=setTimeout(()=>{console.error('PUZZLE_R173_ELECTRON:TIMEOUT');app.exit(2)},85000);
const fail=e=>{console.error('PUZZLE_R173_ELECTRON:FAIL',e?.stack||String(e));app.exit(2)};
app.whenReady().then(async()=>{
 let win;
 try{
  win=new BrowserWindow({show:true,width:1366,height:768,webPreferences:{
   preload:path.join(root,'src','preload.js'),nodeIntegration:false,contextIsolation:true,sandbox:false}});
  win.webContents.on('preload-error',(_e,file,err)=>fail(new Error(file+': '+err)));
  for(const [w,h] of [[1366,768],[1200,800]]){
   win.setSize(w,h);
   await win.loadFile(path.join(root,'app','web','kaltest-pilot2.html'),{query:{kaloneoPreview:'1'}});
   await pause(1000);
   let info=await win.webContents.executeJavaScript(`(()=>{
     const iframe=document.querySelector('#kaltest-content iframe.kaltest-legacy-page-iframe');
     const doc=iframe?.contentDocument;
     const button=doc?.getElementById('puzzle-view-example');
     const cells=[...doc?.querySelectorAll('.cell')||[]];
     if(!iframe||!button||cells.length!==16)return {error:'Puzzle/bouton/16 cases manquant'};
     const exampleBox=button.closest('.example');
     const left=exampleBox?.closest('.explanations');
     cells[0].value='4';
     cells[0].dispatchEvent(new Event('input',{bubbles:true}));
     button.focus();button.click();
     return {button:button.textContent,inFirstBlueBlock:!!left&&exampleBox===left.querySelector('.example'),
       buttonVisible:getComputedStyle(button).display!=='none',
       inputCount:cells.length,answerBefore:cells[0].value};
   })()`,true);
   assert(!info.error,JSON.stringify(info));
   assert.equal(info.button,'Voir l’exemple');
   assert.equal(info.inFirstBlueBlock,true,'Bouton mal situé');
   assert.equal(info.buttonVisible,true);
   assert.equal(info.inputCount,16);
   await pause(400);
   const state=await win.webContents.executeJavaScript(`(()=>{
     const iframe=document.querySelector('#kaltest-content iframe.kaltest-legacy-page-iframe');
     const dialog=document.getElementById('kaltest-supplementary-dialog');
     const img=dialog?.querySelector('#kaltest-supplementary-content img');
     const rect=dialog?.getBoundingClientRect();
     const result={open:dialog?.open,title:document.getElementById('kaltest-supplementary-title')?.textContent,
       imageLoaded:img?.complete&&img?.naturalWidth>0,src:img?.getAttribute('src'),
       bounded:rect.width<=innerWidth*.8+3&&rect.height<=innerHeight*.8+3,
       answerStill:iframe.contentDocument.querySelector('.cell')?.value||'',
       hasAnswers:document.querySelectorAll('#kaltest-content iframe').length===1};
     document.getElementById('kaltest-supplementary-close')?.click();
     return result;
   })()`,true);
   assert.equal(state.open,true,'Fenêtre secondaire non ouverte par le bouton');
   assert.equal(state.title,entry.title);
   assert.equal(state.imageLoaded,true,'Image GitHub non chargée dans le dialogue');
   assert(state.src.includes('ex_carre_')&&state.src.includes('magique.png'));
   assert.equal(state.bounded,true,'Fenêtre > 80% de l écran');
   assert.equal(state.answerStill,'4','Réponse perdue lors de l ouverture du document');
   await pause(100);
   const finish=await win.webContents.executeJavaScript(`(()=>{
     const doc=document.querySelector('#kaltest-content iframe').contentDocument;
     return {closed:!document.getElementById('kaltest-supplementary-dialog').open,
       answer:doc.querySelector('.cell')?.value,focused:doc.activeElement?.id==='puzzle-view-example'};
   })()`,true);
   assert.equal(finish.closed,true);
   assert.equal(finish.answer,'4','Réponse perdue à la fermeture');
   assert.equal(finish.focused,true,'Retour focus au bouton Voir l exemple non effectif');
   console.log('KALONEO_R173_PUZZLE_EXAMPLE_'+w+'x'+h+'=OK');
  }
  assert.equal(writes,0,'L aperçu candidat ne doit pas écrire le profil Windows');
  clearTimeout(timer);win.destroy();app.quit();
 }catch(e){fail(e)}
}).catch(fail);
