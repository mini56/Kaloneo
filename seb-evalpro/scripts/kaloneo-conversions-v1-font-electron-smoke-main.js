'use strict';
const {app,BrowserWindow,ipcMain}=require('electron');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const original=JSON.parse(fs.readFileSync(path.join(root,'source/kaltest/tests/conversions-atelier-expedition/1.0.0/test.json'),'utf8'));
assert.equal(original.id,'conversions_atelier_expedition');
assert.equal(original.version,'1.0.0');
assert.equal(original.questions.length,10);
assert.equal(original.questions.reduce((s,q)=>s+Number(q.points||0),0),10);
const runtime=()=>({ok:true,runtime:{id:'conversions-v1-css-audit',title:'Audit lisibilité',
 builderPreview:true,launchOptions:{showCorrectionsDuringParcours:false},tests:[original],introduction:null,fin:null}});
const ok={ok:true};
ipcMain.on('app:edition-sync',e=>e.returnValue={edition:'unified',canBilan:true,canAi:true,canImport:true,canExport:true});
ipcMain.on('state:load-sync',e=>e.returnValue={version:1,sessionStorage:{},localStorage:{},lastPage:'kaltest-pilot2.html'});
ipcMain.on('state:save-sync',e=>e.returnValue=ok);
for(const n of ['candidate-catalog:workspace-load-sync','candidate-catalog:results-workspace-load-sync'])
 ipcMain.on(n,e=>e.returnValue={ok:false});
ipcMain.on('candidate-catalog:workspace-save-sync',e=>e.returnValue=ok);
ipcMain.on('kaloneo-library:selected-runtime-sync',e=>e.returnValue=runtime());
ipcMain.handle('kaloneo-library:selected-runtime',()=>runtime());
ipcMain.handle('kaloneo-builder:close-preview',()=>true);
for(const n of ['admin:status','admin:verify','admin:lock'])ipcMain.handle(n,()=>true);
for(const n of ['candidate:active','candidate-catalog:list','candidate-catalog:detail','replay:list','bilan-history:list'])
 ipcMain.handle(n,()=>null);
for(const n of ['state:save','replay:capture-page','candidate-catalog:workspace-save','candidate-catalog:end-bilan'])
 ipcMain.handle(n,()=>ok);
ipcMain.handle('ai:status',()=>({available:false}));
ipcMain.handle('ai:cancel-current',()=>ok);
ipcMain.handle('kaloneo-library:get-mask-screen',()=>({ok:false}));
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const timer=setTimeout(()=>{console.error('CONVERSIONS_V1_FONT_ELECTRON:TIMEOUT');app.exit(2)},90000);
app.whenReady().then(async()=>{
 let win;
 try{
  win=new BrowserWindow({show:false,useContentSize:true,width:1649,height:928,
   webPreferences:{preload:path.join(root,'src/preload.js'),nodeIntegration:false,contextIsolation:true,sandbox:false}});
  const inspect=[
    '(()=>{',
    'const content=document.getElementById("kaltest-content");',
    'const left=document.querySelector(".kaltest-conversions-work");',
    'const list=left?.querySelector(".kaltest-question-list");',
    'const table=left?.querySelector(".kaltest-conversions-table");',
    'const img=document.querySelector(".kaltest-conversions-visual-layout img");',
    'const items=[...list?.querySelectorAll("li")||[]];',
    'const rect=e=>{const r=e?.getBoundingClientRect();return r?{top:r.top,bottom:r.bottom,width:r.width,height:r.height}:null;};',
    'return {id:document.body.dataset.sebKaltestId,font:list?parseFloat(getComputedStyle(list).fontSize):0,',
    ' lineHeight:list?parseFloat(getComputedStyle(list).lineHeight):0,items:items.length,',
    ' tableRows:table?.tBodies?.[0]?.rows?.length||0, imageLoaded:!!(img?.complete&&img?.naturalWidth>0),',
    ' list:rect(list),table:rect(table),left:rect(left),',
    ' overflowX:content.scrollWidth>content.clientWidth+4,',
    'selectorMatched:list?.matches(\'body[data-seb-kaltest-id="conversions_atelier_expedition"] .kaltest-conversions-work .kaltest-question-list\'),',
    'inlineStyle:list?.getAttribute("style"),',
    'stylesheets:[...document.styleSheets].map(ss=>({href:ss.href,',
    '  matches:[...ss.cssRules].filter(r=>r.cssText?.includes("amélioration ciblée V1")||r.selectorText?.includes("conversions_atelier_expedition")).slice(-5).map(r=>r.cssText?.slice(0,240))})).filter(ss=>ss.matches.length),',
    'linkState:[...document.querySelectorAll("link[rel=stylesheet]")].map(l=>({href:l.getAttribute("href"),sheet:!!l.sheet}))};',
    '})()'
  ].join('\n');
  for(const [width,height] of [[1649,928],[1366,768],[1200,800]]){
   win.setContentSize(width,height);
   await win.loadFile(path.join(root,'app/web/kaltest-pilot2.html'),{query:{kaloneoPreview:'1'}});
   await pause(500);
   const info=await win.webContents.executeJavaScript(inspect,true);
   console.log('CONVERSIONS_V1_DIAGNOSTIC_'+width+'x'+height,JSON.stringify(info));
   assert.equal(info.id,original.id,JSON.stringify(info));
   assert.equal(info.items,10,'Liste des 10 questions manquante');
   assert(info.tableRows>=10,'Tableau des 10 réponses manquant');
   assert(info.imageLoaded,'Image droite non chargée');
   assert(info.font>=16,'Police toujours trop petite '+JSON.stringify(info));
   if(height>=900)assert(info.font>=17.5,'Agrandissement insuffisant sur grand écran');
   assert(info.lineHeight>=info.font*1.15,'Interligne insuffisant');
   assert(info.list.bottom<=info.table.top+3,'Chevauchement liste/tableau '+JSON.stringify(info));
   assert(info.table.bottom<=info.left.bottom+6,'Tableau hors zone visible '+JSON.stringify(info));
   assert(!info.overflowX,'Débordement horizontal');
   console.log('KALONEO_CONVERSIONS_FONT_'+width+'x'+height+'=SUCCESS',JSON.stringify(info));
  }
  clearTimeout(timer);win.destroy();app.quit();
 }catch(err){console.error('CONVERSIONS_V1_FONT_ELECTRON:FAIL',err.stack||err);app.exit(2);}
}).catch(err=>{console.error(err);app.exit(2)});
