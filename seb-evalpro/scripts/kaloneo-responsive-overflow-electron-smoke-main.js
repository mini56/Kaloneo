'use strict';
// R124 : audit Electron d'un KALTEST inédit, sur cinq tailles de viewport.
const {app,BrowserWindow,ipcMain}=require('electron');
const assert=require('node:assert/strict');
const path=require('node:path');
const {inspectCandidateOverflow}=require('../src/kaloneo-layout-diagnostics');
const root=path.resolve(__dirname,'..');
const questions=Array.from({length:24},(_,i)=>({
  id:'novel_question_'+i,
  prompt:'Question indépendante numéro '+(i+1)+' — saisir votre réponse',
  response:{type:'text'}
}));
const definition={
  id:'nouveau_test_responsive_r124',title:'Test créé pour les résolutions',
  version:'1.0.0',category:'organisation',kind:'questionnaire',scored:false,
  scenario:'Exercice fictif inédit',instruction:'Toutes les questions doivent rester accessibles.',
  calculator:{compatible:false},questions,
  presentation:{layout:'50-50',builderContent:[
    ...questions.slice(0,20).map(q=>({type:'question',zone:'left',questionId:q.id})),
    {type:'table-grid',zone:'right',table:{
      title:'Tableau du candidat',rows:1,cols:3,
      headers:['Colis','Code','Réponse'],cells:[[
        {kind:'fixed-text',value:'Lot A'},
        {kind:'fixed-text',value:'Ref B'},
        {kind:'candidate-answer',questionId:questions[20].id}
      ]]
    }},
    ...questions.slice(21).map(q=>({type:'question',zone:'right',questionId:q.id}))
  ]}
};
const runtime={ok:true,runtime:{id:'r124-futur',builderPreview:true,
  title:'Parcours inédit R124',launchOptions:{showCorrectionsDuringParcours:false},
  introduction:null,tests:[definition],fin:null}};
const ok={ok:true};
ipcMain.on('app:edition-sync',e=>{e.returnValue={edition:'unified',canBilan:true,canAi:true,canImport:true,canExport:true};});
ipcMain.on('state:load-sync',e=>{e.returnValue={version:1,sessionStorage:{},localStorage:{}};});
ipcMain.on('state:save-sync',e=>{e.returnValue=ok;});
ipcMain.on('candidate-catalog:workspace-load-sync',e=>{e.returnValue={ok:false};});
ipcMain.on('candidate-catalog:workspace-save-sync',e=>{e.returnValue=ok;});
ipcMain.on('candidate-catalog:results-workspace-load-sync',e=>{e.returnValue={ok:false};});
ipcMain.on('kaloneo-library:selected-runtime-sync',e=>{e.returnValue=runtime;});
ipcMain.handle('kaloneo-library:selected-runtime',()=>runtime);
ipcMain.handle('kaloneo-builder:get-preview',()=>({ok:true,definition}));
ipcMain.handle('kaloneo-builder:close-preview',()=>ok);
ipcMain.handle('state:save',()=>ok);
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

const fail=e=>{console.error('KALONEO_RESPONSIVE_R124: FAIL',e?.stack||e);app.exit(2);};
const timeout=setTimeout(()=>fail(new Error('Délai dépassé')),105000);
app.whenReady().then(async()=>{
  let win;
  try{
    win=new BrowserWindow({show:false,focusable:false,width:1200,height:800,
      useContentSize:true,paintWhenInitiallyHidden:true,webPreferences:{
        preload:path.join(root,'src','preload.js'),
        contextIsolation:true,nodeIntegration:false,sandbox:false,
        offscreen:true,backgroundThrottling:false
      }});
    await win.loadFile(path.join(root,'app','web','kaltest-pilot2.html'),
      {query:{kaloneoPreview:'1'}});
    await new Promise(resolve=>setTimeout(resolve,550));
    win.webContents.debugger.attach('1.3');
    for(const [width,height] of [[1200,800],[1280,720],[1366,768],[1600,900],[1920,1080]]){
      await win.webContents.debugger.sendCommand('Emulation.setDeviceMetricsOverride',
        {width,height,deviceScaleFactor:1,mobile:false});
      const state=await win.webContents.executeJavaScript(
        '(async()=>{await document.fonts.ready;'+
        'await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));'+
        'const content=document.getElementById("kaltest-content");'+
        'const left=content?.querySelector(".kaltest-builder-runtime-zone");'+
        'const last=left?.querySelector("[data-question-id=novel_question_19]");'+
        'if(left)left.scrollTop=left.scrollHeight;'+
        'await new Promise(r=>requestAnimationFrame(r));'+
        'const zone=left?.getBoundingClientRect(),end=last?.getBoundingClientRect();'+
        'return {width:innerWidth,height:innerHeight,'+
        'id:document.body.dataset.sebKaltestId,'+
        'visible:document.getElementById("page-exercise")?.classList.contains("visible"),'+
        'questions:content?.querySelectorAll("[data-question-id]").length,'+
        'scrollHeight:left?.scrollHeight,clientHeight:left?.clientHeight,'+
        'lastAccessible:!!(end&&zone&&end.bottom<=zone.bottom+3&&end.top>=zone.top-3),'+
        'audit:('+inspectCandidateOverflow.toString()+')(document)};})()');
      assert.equal(state.width,width,JSON.stringify(state));
      assert.equal(state.height,height,JSON.stringify(state));
      assert.equal(state.id,definition.id);
      assert.equal(state.visible,true);
      assert.ok(state.questions>=24,JSON.stringify(state));
      assert.ok(state.scrollHeight>state.clientHeight,
        'Le scénario doit exiger un vrai défilement : '+JSON.stringify(state));
      assert.ok(state.lastAccessible,'Dernière question inaccessible : '+JSON.stringify(state));
      assert.equal(state.audit.overflowZones,0,
        'Fausse erreur à '+width+'x'+height+': '+JSON.stringify(state.audit));
      assert.equal(state.audit.tableHorizontalOverflow,false,
        'Tableau pourtant accessible : '+JSON.stringify(state.audit));
      assert.ok(state.audit.scrollableZones>0,'Défilement non reconnu.');
      console.log('R124 RESOLUTION '+width+'x'+height+' : OK, défilement valide');
    }
    // Un bloc tronqué sans scroll doit rester signalé comme défaut.
    const cut=await win.webContents.executeJavaScript(
      '(()=>{const zone=document.querySelector(".kaltest-builder-runtime-zone");'+
      'const p=document.createElement("div");p.className="kaltest-builder-content-item";'+
      'p.style.cssText="height:25px;width:90px;flex:0 0 25px;overflow:hidden";'+
      'p.innerHTML="<span style=\\"display:block;width:300px;height:160px\\">Masqué</span>";'+
      'zone.appendChild(p);'+
      'return ('+inspectCandidateOverflow.toString()+')(document)})()');
    assert.ok(cut.overflowZones>0,'Un bloc réellement tronqué échappe à la détection.');
    assert.ok(cut.clippedAreas.some(a=>a.target==='bloc'),'Bloc coupé non identifié.');
    console.log('R124 VRAI CONTENU INACCESSIBLE : DETECTE');
    clearTimeout(timeout);
    await win.webContents.debugger.detach();
    win.destroy();
    console.log('KALONEO_RESPONSIVE_R124=OK');
    app.quit();
  }catch(error){
    fail(error);
  }
}).catch(fail);
