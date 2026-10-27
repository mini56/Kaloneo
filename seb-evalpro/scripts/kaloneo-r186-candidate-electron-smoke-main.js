'use strict';
// Audit ciblé du VRAI moteur KALTEST : ne charge jamais nvmail.html ni nwtexte.html.
const {app,BrowserWindow,ipcMain}=require('electron');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),web=path.join(root,'app','web');
const source=slug=>JSON.parse(fs.readFileSync(path.join(root,'source','kaltest','tests',slug,'1.0.0','test.json'),'utf8'));
const tests=[source('redaction-email'),source('traitement-texte-bureautique')];
let selectedTest=tests[0];
const runtime=()=>({ok:true,runtime:{
  id:'kaltest-r186-visual-audit',title:'Audit',builderPreview:true,
  launchOptions:{showCorrectionsDuringParcours:false},
  introduction:null,tests:[selectedTest],fin:null
}});
const ok={ok:true};
ipcMain.on('app:edition-sync',e=>e.returnValue={edition:'unified',canBilan:true,canAi:true,canImport:true,canExport:true});
ipcMain.on('state:load-sync',e=>e.returnValue={version:1,sessionStorage:{},localStorage:{},lastPage:'kaltest-pilot2.html'});
ipcMain.on('state:save-sync',e=>e.returnValue=ok);
ipcMain.on('candidate-catalog:workspace-load-sync',e=>e.returnValue={ok:false});
ipcMain.on('candidate-catalog:workspace-save-sync',e=>e.returnValue=ok);
ipcMain.on('candidate-catalog:results-workspace-load-sync',e=>e.returnValue={ok:false});
ipcMain.on('kaloneo-library:selected-runtime-sync',e=>e.returnValue=runtime());
ipcMain.handle('kaloneo-library:selected-runtime',()=>runtime());
ipcMain.handle('kaloneo-builder:close-preview',()=>ok);
ipcMain.handle('admin:status',()=>true);
ipcMain.handle('admin:verify',()=>true);
ipcMain.handle('admin:lock',()=>true);
ipcMain.handle('candidate:active',()=>null);
ipcMain.handle('state:save',()=>ok);
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
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const deadline=setTimeout(()=>{console.error('KALTEST_R186_VISUAL: TIMEOUT');app.exit(2);},90000);
function fail(e){console.error('KALTEST_R186_VISUAL: FAIL',e?.stack||String(e));app.exit(2);}
async function check(test,width,height){
  selectedTest=test;
  const win=new BrowserWindow({show:true,width,height,webPreferences:{
    preload:path.join(root,'src','preload.js'),nodeIntegration:false,contextIsolation:true,sandbox:false
  }});
  win.webContents.on('preload-error',(_event,where,error)=>fail(new Error(where+': '+error)));
  await win.loadFile(path.join(web,'kaltest-pilot2.html'),{query:{kaloneoPreview:'1'}});
  await wait(1200);
  const state=await win.webContents.executeJavaScript(`(()=>{
    const testId=document.body.dataset.sebKaltestId;
    const text=document.getElementById('kaltest-content')?.textContent||'';
    const left=document.querySelector('.kaltest-mail-instructions');
    const form=document.querySelector('.kaltest-mail-composer');
    const send=document.querySelector('.kaltest-mail-send');
    const browse=document.querySelector('.kaltest-mail-browse');
    const image=document.querySelector('.kaltest-mail-workspace-image');
    const sendRect=send?.getBoundingClientRect(),browseRect=browse?.getBoundingClientRect();
    return {
      testId,text,visible:document.getElementById('page-exercise')?.classList.contains('visible'),
      send:!!send,insideRight:!!send&&form?.contains(send),underBrowse:!!sendRect&&!!browseRect&&sendRect.top>browseRect.top,
      footerHidden:document.getElementById('kaltest-next')?.hidden===true,
      green:left?getComputedStyle(left).backgroundColor:null,
      imageLoaded:!!image&&image.complete&&image.naturalWidth>0,
      editor:!!document.querySelector('#editor .ql-editor'),
      saveFolder:window.sebNwtexteContext?.expectedSaveFolder,
      filenameSuffix:window.sebNwtexteContext?.expectedFilenameSuffix
    };
  })()`);
  assert.equal(state.testId,test.id,'La V1 KALTEST active ne correspond pas au test prévu');
  assert.equal(state.visible,true,'Test non rendu');
  if(test.id==='redaction_email'){
    assert.equal(state.send,true,'Bouton Envoyer absent');
    assert.equal(state.insideRight,true,'Envoyer hors du bloc droit');
    assert.equal(state.underBrowse,true,'Envoyer pas sous Parcourir');
    assert.equal(state.footerHidden,true,'Ancien Envoyer encore dans la barre');
    assert.equal(state.green,'rgb(234, 247, 237)','Fond vert clair absent');
    assert.equal(state.imageLoaded,true,'Image de l’exercice non chargée');
    for(const expected of ['conseil.perso@kaloneo.org','stage-pro@kaloneo.org','Prénom* Mail-Kalonéo','01.02.34.56.78**'])
      assert.ok(state.text.includes(expected),'Consigne KALTEST manquante : '+expected);
    assert.ok(!state.text.includes('@sauvegarde56.org')&&!state.text.includes('Mail-SEB'));
  }else{
    assert.ok(state.text.includes('Nom*_Evaluation_Kalonéo'),'Consigne nom de fichier absente');
    assert.ok(state.text.includes('dossier Kalonéo'),'Dossier obsolète');
    assert.equal(state.editor,true,'Moteur Quill non connecté au rendu KALTEST');
    assert.equal(state.saveFolder,'Bureau\\Kalonéo','Dossier de notation non piloté par le JSON KALTEST');
    assert.equal(state.filenameSuffix,'_Evaluation_Kalonéo','Nom de notation non piloté par le JSON KALTEST');
  }
  console.log('KALTEST_R186_VISUAL_OK',JSON.stringify({test:test.id,width,height,send:state.send,editor:state.editor,image:state.imageLoaded}));
  win.destroy();
}
app.whenReady().then(async()=>{
 const keepAlive=new BrowserWindow({show:false,width:100,height:100});
 try{
  await check(tests[0],1366,768);
  await check(tests[0],1200,800);
  await check(tests[1],1366,768);
  await check(tests[1],1200,800);
  keepAlive.destroy();clearTimeout(deadline);app.quit();
 }catch(e){fail(e);}
}).catch(fail);
