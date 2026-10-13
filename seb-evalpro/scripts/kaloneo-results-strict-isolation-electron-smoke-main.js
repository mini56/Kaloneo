'use strict';
const {app,BrowserWindow,ipcMain}=require('electron');
const assert=require('node:assert/strict');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const manifest={
 schemaVersion:1,parcoursId:'route_future_unknown',parcoursTitle:'Parcours fictif inédit',
 tests:[
  {id:'future_communication_847',title:'Communication',category:'communication',scored:true},
  {id:'future_inventory_847',title:'Inventaire',category:'organisation',scored:true},
  {id:'future_custom_847',title:'Inédit',category:'raisonnement',scored:true}
 ]
};
const kaltest={tests:{
 future_communication_847:{
  status:'COMPLETED',
  answers:{mail_body:'MAIL_PRIVATE_MARKER_ONLY',unscored_message:'<h3>FAKE_HEADING</h3>'},
  result:{score:2,scoreMax:3,percentage:66.67,details:{
   mail_subject:{value:'MAIL_SUBJECT_MARKER',correct:true,points:1}
  }}
 },
 future_inventory_847:{
  status:'COMPLETED',result:{score:7,scoreMax:8,percentage:87.5,details:{
   inventory_q:{value:'STOCK_PRIVATE_MARKER_ONLY',correct:true,points:1}
  }}
 },
 future_custom_847:{
  status:'COMPLETED',result:{score:1,scoreMax:1,percentage:100,details:{
   future_q:{value:'UNSEEN_TYPE_MARKER',correct:true,points:1}
  }}
 },
 never_in_parcours:{status:'COMPLETED',result:{score:100,scoreMax:100,details:{
   ghost_q:{value:'GHOST_MUST_BE_EXCLUDED',correct:true}
  }}}
}};
const storage={
 candidat_data:JSON.stringify({nom:'FICTIF',prenom:'ELECTRON',groupe:'42'}),
 seb_kaloneo_results_manifest:JSON.stringify(manifest),
 seb_kaltest_pilot2_state_v1:JSON.stringify(kaltest),
 scores_data:JSON.stringify({page8:6,page7:8}),
 page8_data:JSON.stringify({score_total:6,message:'LEGACY_MAIL_LEAK'})
};
const snapshot={version:1,sessionStorage:storage,localStorage:{},lastPage:'qcmv1.0.html'};
ipcMain.on('app:edition-sync',e=>e.returnValue={edition:'admin',canBilan:true,canAi:true,canImport:true,canExport:true});
ipcMain.on('state:load-sync',e=>e.returnValue=snapshot);
ipcMain.on('state:save-sync',e=>e.returnValue={ok:true});
ipcMain.on('kaloneo-library:test-metadata-sync',e=>e.returnValue={ok:true,tests:manifest.tests});
ipcMain.on('candidate-catalog:results-workspace-load-sync',e=>e.returnValue={ok:false});
ipcMain.on('candidate-catalog:workspace-load-sync',e=>e.returnValue={ok:false});
ipcMain.handle('state:save',()=>({ok:true}));
ipcMain.handle('admin:status',()=>true);
ipcMain.handle('admin:verify',()=>true);
ipcMain.handle('admin:lock',()=>true);
const fail=e=>{console.error('KALONEO_STRICT_RESULTS_ELECTRON: FAIL',e?.stack||e);app.exit(2);};
const timeout=setTimeout(()=>fail(new Error('TIMEOUT')),45000);
app.whenReady().then(async()=>{
 try{
  const win=new BrowserWindow({show:false,width:1280,height:800,
   webPreferences:{preload:path.join(root,'src','preload.js'),
    contextIsolation:true,nodeIntegration:false,sandbox:false}});
  await win.loadFile(path.join(root,'app','web','qcmv1.0.html'));
  const inspect=()=>{
   const host=document.getElementById('resultat');
   host.innerHTML='<h3>Page 8 - mail</h3><p>LEGACY_MAIL_LEAK</p>'+
    '<hr><h3>Page 3</h3><p>LEGACY_WRONG_SCORE</p>';
   const done=sebApplyDynamicResultsLayout();
   const cards=[...host.querySelectorAll('article[data-test-id]')];
   return {
    done,cards:cards.map(c=>({id:c.dataset.testId,text:c.textContent})),
    all:host.textContent,
    fakeHeading:cards.some(c=>[...c.querySelectorAll('h3')]
      .some(h=>h.textContent==='FAKE_HEADING')),
    groups:[...host.querySelectorAll('section.seb-results-category')]
      .map(s=>s.dataset.category)
   };
  };
  const observed=await win.webContents.executeJavaScript('('+inspect.toString()+')()',true);
  assert.equal(observed.done,true);
  assert.deepEqual(observed.cards.map(c=>c.id),
   ['future_communication_847','future_inventory_847','future_custom_847']);
  const [mail,stock,future]=observed.cards.map(c=>c.text);
  assert(mail.includes('MAIL_PRIVATE_MARKER_ONLY'));
  assert(mail.includes('MAIL_SUBJECT_MARKER'));
  assert(mail.includes('FAKE_HEADING'));
  assert(!stock.includes('MAIL_')&&!future.includes('MAIL_'));
  assert(stock.includes('STOCK_PRIVATE_MARKER_ONLY'));
  assert(!mail.includes('STOCK_PRIVATE_MARKER_ONLY'));
  assert(future.includes('UNSEEN_TYPE_MARKER'));
  assert(!stock.includes('UNSEEN_TYPE_MARKER'));
  for(const token of ['GHOST_MUST_BE_EXCLUDED','LEGACY_MAIL_LEAK','LEGACY_WRONG_SCORE'])
   assert(!observed.all.includes(token),'Une donnée non autorisée apparaît: '+token);
  assert.equal(observed.fakeHeading,false,'HTML de réponse interprété');
  assert.deepEqual(observed.groups,['Communication','Organisation','Raisonnement']);
  const noManifest=()=>{
   sessionStorage.removeItem('seb_kaloneo_results_manifest');
   afficherResultat();
   return document.getElementById('resultat').textContent;
  };
  const fallback=await win.webContents.executeJavaScript('('+noManifest.toString()+')()',true);
  assert.match(fallback,/manifeste du parcours absent/i);
  assert(!fallback.includes('LEGACY_MAIL_LEAK'));
  console.log('KALONEO_STRICT_RESULTS_ELECTRON: OK',JSON.stringify({
   ids:observed.cards.map(c=>c.id),groups:observed.groups,
   mailIsolated:true,legacyIgnored:true,unknownFutureTest:true,failClosed:true
  }));
  clearTimeout(timeout);win.destroy();app.quit();
 }catch(e){fail(e);}
}).catch(fail);
