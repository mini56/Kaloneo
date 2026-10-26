'use strict';
const {app,BrowserWindow,ipcMain}=require('electron');
const path=require('node:path'),assert=require('node:assert/strict');
const {aggregateGeneralBilan}=require('../src/general-bilan-aggregation');
const {generateGeneralSynthesis}=require('../src/general-bilan-synthesis');
let metadata=[],smokeState={version:1,sessionStorage:{candidat_data:JSON.stringify({nom:'TEST',prenom:'GENERAL'})},localStorage:{}};
let savedSummary='',exportedSummary='',failNext=false;
const person={personId:'PERS-TEST',nom:'TEST',prenom:'GENERAL'};
const evaluation=(id,points)=>({candidateId:id,session:{},archive:{document:{rows:[{kind:'item',key:'math-enonce',level:'II',points,possible:10},{kind:'item',key:'math-problemes',level:'NE',points:null,possible:null}]}}});
let general=aggregateGeneralBilan([evaluation('a',6),evaluation('b',8)]);
const deadline=setTimeout(()=>{console.error('GENERAL_SYNTHESIS_ELECTRON_TIMEOUT');app.exit(2)},60000);
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

ipcMain.handle('candidate-catalog:general-bilan',()=>({ok:true,person,general,summary:savedSummary}));
ipcMain.handle('candidate-catalog:generate-general-synthesis',async(_event,id,digest)=>{
 assert.equal(id,person.personId);assert.equal(digest,general.sourceDigest);
 await new Promise(resolve=>setTimeout(resolve,100));
 if(failNext){failNext=false;return{ok:false,error:'Sources modifiées : rouvrir le bilan général.'}}
 return{ok:true,...generateGeneralSynthesis(person,general)};
});
ipcMain.handle('candidate-catalog:save-general-bilan',(_event,id,summary)=>{savedSummary=summary;return{ok:true}});
ipcMain.handle('candidate-catalog:export-general-bilan',(_event,id,summary)=>{savedSummary=summary;exportedSummary=summary;return{ok:true}});
ipcMain.handle('candidate-catalog:open-general-word',()=>({ok:true}));
app.on('window-all-closed',()=>{}); // Plusieurs fenêtres testées successivement.
ipcMain.handle('candidate:active',()=>null);
app.commandLine.appendSwitch('disable-gpu');
const pause=()=>new Promise(resolve=>setTimeout(resolve,350));
app.whenReady().then(async()=>{
 let win;
 try{
  for(const [width,height] of [[1366,768],[1200,800]]){
   savedSummary='';exportedSummary='';
   win=new BrowserWindow({show:false,width,height,webPreferences:{preload:path.join(__dirname,'bilan-parcours-filter-test-preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:false}});
   await win.loadFile(path.join(__dirname,'..','app','web','admin-bilan.html'));await pause();
   await win.webContents.executeJavaScript(`window.bilanFilterTest.openGeneral('${person.personId}')`);
   const before=await win.webContents.executeJavaScript(`(()=>{const b=document.getElementById('seb-gb-generate'),r=b.getBoundingClientRect();return{label:b.textContent,visible:r.top>=0&&r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth,summary:document.getElementById('seb-gb-summary').value,rows:[...document.getElementById('seb-gb-original-table').shadowRoot.querySelectorAll('tr[data-r]')].map(r=>r.dataset.r)}})()`);
   assert.equal(before.label,'Générer la synthèse');assert(before.visible,`Bouton non visible en ${width}x${height}`);
   assert.equal(before.summary,'');assert.deepEqual(before.rows,['math-enonce','math-problemes']);
   await win.webContents.executeJavaScript("document.getElementById('seb-gb-generate').click()");
   const busy=await win.webContents.executeJavaScript("document.getElementById('seb-gb-generate').disabled&&document.getElementById('seb-gb-save').disabled");
   assert(busy,'Pas de double génération ou sauvegarde pendant le calcul.');
   await pause();
   const generated=await win.webContents.executeJavaScript("document.getElementById('seb-gb-summary').value");
   assert(generated.includes('différents parcours'));assert(generated.includes('mathématiques'));assert(!generated.includes('messagerie'));
   assert.equal(savedSummary,'','La génération ne doit pas enregistrer automatiquement.');
   assert(await win.webContents.executeJavaScript("document.getElementById('seb-gb-open').disabled"),'Ne pas ouvrir un ancien Word après génération.');
   const edited=generated+'\n\nAjout manuel vérifié.';
   await win.webContents.executeJavaScript(`(()=>{const f=document.getElementById('seb-gb-summary');f.value=${JSON.stringify(edited)};f.dispatchEvent(new Event('input',{bubbles:true}));document.getElementById('seb-gb-save').click()})()`);await pause();
   assert.equal(savedSummary,edited);
   await win.webContents.executeJavaScript("document.getElementById('seb-gb-word').click()");await pause();assert.equal(exportedSummary,edited);
   assert(!await win.webContents.executeJavaScript("document.getElementById('seb-gb-open').disabled"));
   await win.webContents.executeJavaScript("document.getElementById('seb-gb-close').click()");
   await win.webContents.executeJavaScript(`window.bilanFilterTest.openGeneral('${person.personId}')`);
   assert.equal(await win.webContents.executeJavaScript("document.getElementById('seb-gb-summary').value"),edited);
   assert.equal(await win.webContents.executeJavaScript("document.getElementById('seb-gb-generate').textContent"),'Régénérer la synthèse');
   failNext=true;
   await win.webContents.executeJavaScript("document.getElementById('seb-gb-generate').click()");await pause();
   assert.equal(await win.webContents.executeJavaScript("document.getElementById('seb-gb-summary').value"),edited,'Une erreur ne doit pas effacer le texte modifié.');
   assert((await win.webContents.executeJavaScript("document.getElementById('seb-gb-status').textContent")).includes('Sources modifiées'));
   win.destroy();win=null;
  }
  const triTimes=[5,8,11,7,9].map((s,i)=>'N°'+(i+1)+' : 00 min '+String(s).padStart(2,'0')+' s').join('\n');
  general=aggregateGeneralBilan([evaluation('a',6),{candidateId:'tri',archive:{document:{rows:[{kind:'item',key:'tri-temps',level:'I',assessmentMode:'level',triTimes,triAverage:'00:08'},{kind:'item',key:'tri-erreurs',level:'I',assessmentMode:'level',triErrors:'2 erreurs'}]}}}]);
  win=new BrowserWindow({show:false,width:1366,height:768,webPreferences:{preload:path.join(__dirname,'bilan-parcours-filter-test-preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:false}});
  await win.loadFile(path.join(__dirname,'..','app','web','admin-bilan.html'));await pause();
  await win.webContents.executeJavaScript(`window.bilanFilterTest.openGeneral('${person.personId}')`);
  const measurements=await win.webContents.executeJavaScript(`(()=>{const t=document.getElementById('seb-gb-original-table').shadowRoot;return{times:t.querySelector('#triTimes').innerText,average:t.querySelector('#triAvg').textContent,errors:t.querySelector('#triErr').textContent}})()`);
  assert.deepEqual(measurements,{times:triTimes,average:'00:08',errors:'2 erreurs'});
  win.destroy();win=null;
  console.log('GENERAL_SYNTHESIS_ELECTRON=OK — bouton visible 1366/1200, vraie grille consolidée, génération, modification, sauvegarde, Word, réouverture et erreur sans perte');
  clearTimeout(deadline);app.exit(0);
 }catch(error){console.error(error.stack||error);clearTimeout(deadline);if(win)win.destroy();app.exit(2)}
});
