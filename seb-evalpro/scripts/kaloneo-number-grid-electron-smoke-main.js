'use strict';
const {app,BrowserWindow,ipcMain}=require('electron');
const path=require('node:path'),fs=require('node:fs'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),web=path.join(root,'app','web');
const read=dir=>JSON.parse(fs.readFileSync(path.join(root,'source','kaltest','tests',dir,'1.0.0','test.json'),'utf8'));
const tests=[read('grille-operations'),read('carre-magique-15')];
let current=tests[0];
const getRuntime=()=>({ok:true,runtime:{id:'grilles-builder-audit',
 title:'Audit des grilles V1',builderPreview:true,
 introduction:null,tests:[current],fin:null,launchOptions:{showCorrectionsDuringParcours:true}}});
const ok={ok:true};
ipcMain.on('app:edition-sync',e=>e.returnValue={edition:'unified',canBilan:true,canAi:true,canImport:true,canExport:true});
ipcMain.on('state:load-sync',e=>e.returnValue={version:1,sessionStorage:{},localStorage:{},lastPage:'kaltest-pilot2.html'});
ipcMain.on('state:save-sync',e=>e.returnValue=ok);
for(const p of ['candidate-catalog:workspace-load-sync','candidate-catalog:results-workspace-load-sync'])
 ipcMain.on(p,e=>e.returnValue={ok:false});
ipcMain.on('candidate-catalog:workspace-save-sync',e=>e.returnValue=ok);
ipcMain.on('kaloneo-library:selected-runtime-sync',e=>e.returnValue=getRuntime());
ipcMain.handle('kaloneo-library:selected-runtime',()=>getRuntime());
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
const timer=setTimeout(()=>{console.error('NUMBER_GRID_ELECTRON:TIMEOUT');app.exit(2)},70000);
const fail=e=>{console.error('NUMBER_GRID_ELECTRON:FAIL',e?.stack||String(e));app.exit(2)};
app.whenReady().then(async()=>{
 let win;
 try{
  win=new BrowserWindow({show:false,width:1366,height:768,webPreferences:{
   preload:path.join(root,'src','preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:false}});
  for(const def of tests)for(const [w,h] of [[1366,768],[1200,800]]){
   current=def;win.setSize(w,h);
   await win.loadFile(path.join(web,'kaltest-pilot2.html'),{query:{kaloneoPreview:'1'}});
   await pause(420);
   const observed=await win.webContents.executeJavaScript(`(()=>{
    const model=window.sebKaltestPilot2;
    const test=model?.currentTest();
    const inputs=[...document.querySelectorAll('#kaltest-content input[data-question-id]')];
    const table=document.querySelector('#kaltest-content .kaltest-builder-grid');
    const rows=table?[...table.tBodies[0].rows]:[];
    const ids=test.evaluation.validArrangements.questionIds;
    const first=test.evaluation.validArrangements.solutions[0];
    const alternative=test.evaluation.validArrangements.solutions[1];
    const toAnswers=sol=>Object.fromEntries(ids.map((id,i)=>[id,String(sol[i])]));
    const good=model.evaluateTest(test,{answers:toAnswers(first),units:{}});
    const second=model.evaluateTest(test,{answers:toAnswers(alternative),units:{}});
    const bad=model.evaluateTest(test,{answers:toAnswers(Array(9).fill(1)),units:{}});
    const el=document.getElementById('kaltest-content');
    const layout=document.querySelector('.kaltest-builder-runtime-layout');
    const zones=[...layout?.querySelectorAll(':scope>.kaltest-builder-runtime-zone')||[]];
    const firstCell=rows[0]?.cells[0]?.getBoundingClientRect();
    const gridWidth=zones[1]?.getBoundingClientRect().width||0;
    const media=zones[0]?.querySelector('.kaltest-builder-media');
    const mediaImage=media?.querySelector('img');
    const calc=document.getElementById('kaltest-calculator');
    return {
     id:test.id,inputs:inputs.length,
     uniqueInputIds:new Set(inputs.map(i=>i.dataset.questionId)).size,
     rows:rows.length,cols:rows[0]?.cells.length,
     good:{score:good.score,max:good.scoreMax,percentage:good.percentage},
     second:{score:second.score,max:second.scoreMax},
     bad:{score:bad.score,max:bad.scoreMax},
     tableVisible:!!table&&table.getBoundingClientRect().width>160,
     split:zones.length===2,
     columns:getComputedStyle(layout).gridTemplateColumns,
     leftWidth:zones[0]?.getBoundingClientRect().width||0,rightWidth:gridWidth,
     square:firstCell?{w:firstCell.width,h:firstCell.height}:null,
     mediaImageLoaded:!!(mediaImage?.complete&&mediaImage?.naturalWidth>0),
     mediaSrc:mediaImage?.getAttribute('src')||'',
     calculatorVisible:!!calc&&!calc.hidden,
     overflowX:!!el&&el.scrollWidth>el.clientWidth+3,
     engineLoaded:typeof window.KaloneoNumberGrid?.evaluate==='function'
    };
   })()`,true);
   assert.equal(observed.id,def.id,JSON.stringify(observed));
   assert.equal(observed.inputs,9,JSON.stringify(observed));
   assert.equal(observed.uniqueInputIds,9);
   assert.equal(observed.rows,def.presentation.builderContent[1].table.rows);
   assert.equal(observed.cols,def.presentation.builderContent[1].table.cols);
   assert.equal(observed.good.score,9,JSON.stringify(observed));
   assert.equal(observed.good.max,9);
   assert.equal(observed.good.percentage,100);
   assert.equal(observed.second.score,9,'Deuxième disposition valide rejetée');
   assert(observed.bad.score<9,'Grille incorrecte acceptée');
   assert(observed.tableVisible,'Grille absente');
   assert(observed.split,'Les deux zones 40/60 manquent');
   assert(Math.abs(observed.leftWidth/(observed.leftWidth+observed.rightWidth)-.4)<.04,
     'Ratio 40/60 non respecte '+JSON.stringify(observed));
   assert(observed.square&&Math.abs(observed.square.w-observed.square.h)<3,
     'Cases de la grille non carrees '+JSON.stringify(observed));
   assert(observed.mediaImageLoaded,'L illustration de la bibliothèque doit s afficher dans les 40%');
   assert(observed.mediaSrc.includes('bibliotheque-images/'),'La mauvaise illustration a été sélectionnée');
   assert(observed.calculatorVisible,'Calculatrice désactivée');
   assert(!observed.overflowX,'Débordement horizontal dans le parcours candidat '+JSON.stringify(observed));
   assert(observed.engineLoaded,'Moteur de correction externe non chargé');
   console.log('KALONEO_NUMBER_GRID_ELECTRON_'+def.id+'_'+w+'x'+h+'=OK');
  }
  clearTimeout(timer);win.destroy();app.quit();
 }catch(error){fail(error)}
}).catch(fail);
