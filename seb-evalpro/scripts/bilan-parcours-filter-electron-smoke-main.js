'use strict';
const {app,BrowserWindow,ipcMain}=require('electron');
const path=require('node:path'),fs=require('node:fs'),assert=require('node:assert/strict');
let metadata=[],smokeState={},captured=null,revision=null,wordHtml='';
const deadline=setTimeout(()=>{console.error('BILAN_FILTER_ELECTRON_TIMEOUT');app.exit(2)},60000);
ipcMain.on('app:edition-sync',event=>{event.returnValue={edition:'admin',canBilan:true,canAi:true,canImport:true,canExport:true}});
ipcMain.on('state:load-sync',event=>{event.returnValue=smokeState});
ipcMain.on('state:save-sync',(event,payload)=>{smokeState={...smokeState,...(payload||{})};event.returnValue={ok:true,state:smokeState}});
ipcMain.on('candidate-catalog:workspace-load-sync',event=>{event.returnValue={ok:false}});
ipcMain.on('candidate-catalog:results-workspace-load-sync',event=>{event.returnValue={ok:false}});
ipcMain.on('candidate-catalog:workspace-save-sync',event=>{event.returnValue={ok:true}});
ipcMain.on('kaloneo-library:test-metadata-sync',event=>{event.returnValue={ok:true,tests:metadata}});

ipcMain.handle('state:save',(_event,payload)=>{smokeState={...smokeState,...(payload||{})};return{ok:true,state:smokeState}});
ipcMain.handle('admin:status',()=>true);
ipcMain.handle('admin:verify',()=>true);
ipcMain.handle('admin:verify-password',()=>false);
ipcMain.handle('admin:lock',()=>true);
ipcMain.handle('admin:open-bilan',()=>false);
ipcMain.handle('admin:open-candidate-results',()=>false);
ipcMain.handle('admin:return-evaluation',()=>false);
ipcMain.handle('admin:close-session',()=>false);
ipcMain.handle('ai:status',()=>({available:false,offline:true}));
ipcMain.handle('ai:rewrite-synthesis',()=>({ok:false}));

ipcMain.handle('bilan-history:save-current',(_event,payload)=>{captured=payload.document;return{ok:true,filename:'test.json'}});
ipcMain.handle('bilan-history:save-revision',(_event,payload)=>{revision=payload.document;return{ok:true,filename:'test.json',revision:0}});
ipcMain.on('bilan-history:get-word-template-sync',event=>{event.returnValue={ok:true,html:fs.readFileSync(path.join(__dirname,'..','app','web','admin-bilan.html'),'utf8')}});
ipcMain.on('bilan-history:write-word-sync',(event,payload)=>{wordHtml=payload.html;event.returnValue={ok:true,filename:'test.sebdoc'}});
app.commandLine.appendSwitch('disable-gpu');
const pause=()=>new Promise(resolve=>setTimeout(resolve,700));
app.whenReady().then(async()=>{
 let win;
 try{
  const custom={id:'math-future-abandonnee',version:'1.0.0',title:'Maths abandonnées',category:'mathematiques',adminModified:true,
   bilanContributions:[{lineId:'bilan.savoirs_fondamentaux.mathematiques.resoudre_problemes',bindings:{score:'score',score_max:'score_max'}}]};
  for(const onlyAbandoned of [false,true]){
   metadata=onlyAbandoned?[custom]:[{id:'calculs_commandes_atelier',category:'mathematiques'},custom,{id:'conversions_atelier_expedition',category:'mathematiques'}];
   smokeState={version:1,sessionStorage:{
    candidat_data:JSON.stringify({nom:'TEST',prenom:'FILTRE',date:'2026-10-26'}),
    seb_kaloneo_results_manifest:JSON.stringify({tests:metadata}),
    seb_kaltest_pilot2_state_v1:JSON.stringify({tests:{
     calculs_commandes_atelier:{status:'COMPLETED',result:{score:2,scoreMax:3}},
     conversions_atelier_expedition:{status:'COMPLETED',result:{score:4,scoreMax:5}},
     'math-future-abandonnee':{status:'ABANDONED'},
     redaction_email:{status:'COMPLETED',result:{score:6,scoreMax:6}}
    }})},localStorage:{},lastPage:'admin-bilan.html'};
   win=new BrowserWindow({show:false,width:1366,height:768,webPreferences:{preload:path.join(__dirname,'bilan-parcours-filter-test-preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:false}});
   await win.loadFile(path.join(__dirname,'..','app','web','admin-bilan.html'));await pause();
   const visible=await win.webContents.executeJavaScript(`(()=>({rows:window.SEB_KALONEO_BILAN.visibleInstitutionalRows(),sections:[...document.querySelectorAll('#bilan tr.section,#bilan tr.section2')].filter(r=>!r.hidden).map(r=>r.textContent.trim())}))()`);
   const expected=onlyAbandoned?['math-problemes']:['math-enonce','math-problemes'];
   assert.deepEqual(visible.rows,expected);
   assert.deepEqual(visible.sections,['Savoirs fondamentaux']);
   await win.webContents.executeJavaScript("document.getElementById('auto').click();document.getElementById('save').click()");await pause();
   assert(captured,'Le bouton Enregistrer doit capturer le bilan réel.');
   assert.deepEqual(captured.rows.filter(r=>r.kind==='item').map(r=>r.key),expected);
   assert.equal(captured.rows.filter(r=>r.kind==='section').length,1);
   if(onlyAbandoned){
    assert.equal(captured.rows.find(r=>r.key==='math-problemes').level,'NE');
   }else{
    assert.deepEqual(captured.rows.filter(r=>r.kind==='item').map(r=>[r.points,r.possible]),[[2,3],[4,5]]);
   }
   assert.equal(captured.parcoursTests.length,metadata.length,'Les liaisons du parcours doivent être figées avec le bilan.');
   await win.webContents.executeJavaScript(`window.bilanFilterTest.open(${JSON.stringify({candidate:{nom:'TEST',prenom:'FILTRE'},originalBuild:181,document:captured})})`);
   await win.webContents.executeJavaScript("document.getElementById('seb-bh-save-revision').click()");await pause();
   assert.deepEqual(revision.rows.filter(r=>r.kind==='item').map(r=>[r.key,r.points,r.possible]),captured.rows.filter(r=>r.kind==='item').map(r=>[r.key,r.points,r.possible]),'La révision doit conserver les points.');
   assert.deepEqual(revision.parcoursTests,captured.parcoursTests);
   await win.webContents.executeJavaScript("document.getElementById('seb-bh-export').click()");await pause();
   assert(wordHtml,'Le Word du bilan courant doit être produit.');
   assert.deepEqual([...wordHtml.matchAll(/data-r="([^"]+)"/g)].map(m=>m[1]),expected,'Le Word ne doit pas réintroduire les lignes du modèle complet.');
   assert(!wordHtml.includes('Messagerie électronique')&&!wordHtml.includes('Expression écrite'));
   win.destroy();win=null;
  }
  console.log('BILAN_FILTER_ELECTRON=OK — maths seules, abandon seul, sections, capture réelle, éditeur, conservation des points et Word filtré');
  clearTimeout(deadline);app.exit(0);
 }catch(error){console.error(error.stack||error);clearTimeout(deadline);if(win)win.destroy();app.exit(2)}
});
