'use strict';
// Essai graphique dans le Builder Electron sur un test créé à neuf.
const {app,BrowserWindow,ipcMain}=require('electron');
const assert=require('node:assert/strict');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
let calls=0;
const icon='data:image/svg+xml;base64,'+Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50"><rect width="100" height="50" fill="#5280a1"/></svg>').toString('base64');
const ok={ok:true};
ipcMain.on('app:edition-sync',event=>event.returnValue={edition:'unified',canBilan:true,canAi:true,canImport:true,canExport:true});
ipcMain.on('state:load-sync',event=>event.returnValue={version:1,sessionStorage:{},localStorage:{}});
ipcMain.on('state:save-sync',event=>event.returnValue=ok);
ipcMain.on('candidate-catalog:workspace-load-sync',event=>event.returnValue={ok:false});
ipcMain.on('candidate-catalog:workspace-save-sync',event=>event.returnValue=ok);
ipcMain.on('candidate-catalog:results-workspace-load-sync',event=>event.returnValue={ok:false});
ipcMain.handle('kaloneo-builder:render-mini-preview',()=>{calls++;return {ok:true,image:icon,report:{overflowZones:0,brokenImages:[],tableHorizontalOverflow:false}};});
ipcMain.handle('kaloneo-library:list-images',()=>({ok:true,images:[]}));
ipcMain.handle('kaloneo-library:get-image',()=>({ok:false}));
ipcMain.handle('admin:status',()=>true);
ipcMain.handle('kaloneo-library:list-tests',()=>({ok:true,tests:[]}));
ipcMain.handle('kaloneo-library:list-mask-screens',()=>({ok:true,maskScreens:[]}));
ipcMain.handle('state:save',()=>ok);
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const timeout=setTimeout(()=>{console.error('BUILDER_DOCUMENT_UI: TIMEOUT');app.exit(2);},65000);
function fail(error){console.error('BUILDER_DOCUMENT_UI: FAIL',error?.stack||String(error));app.exit(2);}
async function uiAction(){
  const get=id=>document.getElementById(id);
  const add=get('supplementary-add');
  if(!add||!get('blocks-editor').querySelector('.exercise-block'))return {error:'Builder non initialisé'};
  const fold=get('toggle-exercise-section');
  const foldedBefore=fold.getAttribute('aria-expanded');
  fold.click();
  const foldClosed=get('exercise-section-content').hidden;
  fold.click();
  const foldOpen=!get('exercise-section-content').hidden;
  add.click();
  const previewHidden=get('candidate-preview-viewport').closest('.builder-preview').dataset.supplementaryMode==='true';
  get('supplementary-title').value='Plan de stockage inédit';
  get('supplementary-title').dispatchEvent(new Event('input',{bubbles:true}));
  const data=get('supplementary-text');
  data.value='Article A\nArticle B\nArticle C';
  data.dispatchEvent(new Event('input',{bubbles:true}));
  const thumbCount=get('supplementary-thumbnails').querySelectorAll('.supplementary-thumbnail').length;
  const exp=get('blocks-editor').querySelector('.exercise-block');
  exp.querySelector('.toggle-block').click();
  const details=exp.querySelector('.builder-supplementary-button-panel');
  details.open=true;
  details.querySelector('button').click();
  const created=!!get('blocks-editor').querySelector('.builder-supplementary-button-row');
  const thumbTitle=get('supplementary-thumbnails').querySelector('.supplementary-thumbnail span:last-child')?.textContent;
  return {foldedBefore,foldClosed,foldOpen,previewHidden,thumbCount,created,thumbTitle,
    screenshotHidden:get('candidate-preview-snapshot').hidden};
}
async function uiCheck(){
  const get=id=>document.getElementById(id);
  return {editorText:get('supplementary-text').value,
    snapshotHidden:get('candidate-preview-snapshot').hidden,
    mode:get('candidate-preview-viewport').closest('.builder-preview').dataset.supplementaryMode,
    draftStatus:get('draft-status').textContent,
    buttons:get('blocks-editor').querySelectorAll('.builder-supplementary-button-row').length};
}
app.whenReady().then(async()=>{
 try{
  const win=new BrowserWindow({show:true,width:1440,height:900,
    webPreferences:{preload:path.join(root,'src','preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:false}});
  win.webContents.on('preload-error',(_event,file,e)=>fail(new Error(file+': '+e)));
  await win.loadFile(path.join(root,'app','web','kaloneo-builder','test-builder.html'));
  await wait(600);
  const result=await win.webContents.executeJavaScript('('+uiAction.toString()+')()');
  assert(!result.error,JSON.stringify(result));
  assert.equal(result.foldClosed,true,'Bloc Exercice ne se replie pas');
  assert.equal(result.foldOpen,true,'Bloc Exercice ne se déplie pas');
  assert.equal(result.previewHidden,true,'Miniature non masquée en mode document');
  assert.equal(result.thumbCount,1,'Miniature de document absente');
  assert.equal(result.created,true,'Bouton de bloc absent');
  assert.equal(result.thumbTitle,'Plan de stockage inédit');
  const initialCalls=calls;
  await wait(1650);
  const stationary=await win.webContents.executeJavaScript('('+uiCheck.toString()+')()');
  assert.equal(stationary.editorText,'Article A\nArticle B\nArticle C');
  assert.equal(stationary.buttons,1);
  assert.equal(calls,initialCalls,'L’édition documentaire a provoqué une capture Electron');
  await win.webContents.executeJavaScript("document.getElementById('supplementary-main').click()");
  await wait(1550);
  const after=await win.webContents.executeJavaScript('('+uiCheck.toString()+')()');
  assert.notEqual(after.mode,'true','Mode documentaire non quitté');
  assert.equal(calls,initialCalls+1,'Retour au test : exactement une capture attendue');
  assert(after.draftStatus,'État du brouillon absent');
  console.log('BUILDER_DOCUMENT_UI: OK',JSON.stringify({result,stationary,after,capturesDuringEditing:0,capturesAfterReturn:calls-initialCalls}));
  clearTimeout(timeout);win.destroy();app.quit();
 }catch(e){fail(e);}
}).catch(fail);
