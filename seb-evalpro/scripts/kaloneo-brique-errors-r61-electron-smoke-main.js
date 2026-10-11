'use strict';
const {app,BrowserWindow,ipcMain}=require('electron');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),web=path.join(root,'app','web');
const brick=JSON.parse(fs.readFileSync(path.join(web,'kaltest','tests','construction-briques','1.0.0','test.json'),'utf8'));
const selected={ok:true,runtime:{id:'brique-errors-r61',title:'Briques',builderPreview:true,launchOptions:{showCorrectionsDuringParcours:false},introduction:null,tests:[brick],fin:null}};
const ok={ok:true};
ipcMain.on('app:edition-sync',e=>e.returnValue={edition:'unified',canBilan:true,canAi:true,canImport:true,canExport:true});
ipcMain.on('state:load-sync',e=>e.returnValue={version:1,sessionStorage:{},localStorage:{},lastPage:'kaltest-pilot2.html'});
ipcMain.on('state:save-sync',e=>e.returnValue=ok);
ipcMain.on('candidate-catalog:workspace-load-sync',e=>e.returnValue={ok:false});
ipcMain.on('candidate-catalog:workspace-save-sync',e=>e.returnValue=ok);
ipcMain.on('candidate-catalog:results-workspace-load-sync',e=>e.returnValue={ok:false});
ipcMain.on('kaloneo-library:selected-runtime-sync',e=>e.returnValue=selected);
ipcMain.handle('kaloneo-library:selected-runtime',()=>selected);
ipcMain.handle('kaloneo-builder:close-preview',()=>true);
for(const n of ['admin:status','admin:verify','admin:lock'])ipcMain.handle(n,()=>true);
for(const n of ['candidate:active','candidate-catalog:list','candidate-catalog:detail','replay:list','bilan-history:list'])ipcMain.handle(n,()=>null);
for(const n of ['state:save','replay:capture-page','candidate-catalog:workspace-save','candidate-catalog:end-bilan'])ipcMain.handle(n,()=>ok);
ipcMain.handle('ai:status',()=>({available:false}));
ipcMain.handle('ai:cancel-current',()=>ok);
ipcMain.handle('kaloneo-library:get-mask-screen',()=>({ok:false}));
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let win,ended=false;
const timeout=setTimeout(()=>done(2,'BRIQUE_ERRORS_R61: TIMEOUT'),60000);
function done(code,label,error){if(ended)return;ended=true;clearTimeout(timeout);console[code===0?'log':'error'](label);if(error)console.error(error?.stack||String(error));try{if(win&&!win.isDestroyed())win.destroy();}catch(_){}app.exit(code);}
app.commandLine.appendSwitch('disable-gpu');
app.whenReady().then(async()=>{
try{
assert.equal(brick.presentation.bricksStation.errorMax,undefined,'Aucune limite artificielle sur les erreurs Briques');
win=new BrowserWindow({show:false,width:1366,height:768,webPreferences:{preload:path.join(root,'src','preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:false}});
await win.loadFile(path.join(web,'kaltest-pilot2.html'),{query:{kaloneoPreview:'1'}});
let ready=false;
for(let i=0;i<120;i++){ready=await win.webContents.executeJavaScript("Boolean(document.querySelector('.kaltest-brique-layout #nivDiff')&&document.querySelector('.kaltest-brique-layout #validBtn'))",true).catch(()=>false);if(ready)break;await wait(50);}
assert.equal(ready,true,'KALTEST Briques must render');
const js="(()=>{const el=document.querySelector('.kaltest-brique-layout #nivDiff');el.focus();el.value='1';el.dispatchEvent(new Event('input',{bubbles:true}));const first={value:el.value,stored:window.sebKaltestPilot2.state.tests.construction_briques.brique.errors,focused:document.activeElement===el};el.value='12';el.dispatchEvent(new Event('input',{bubbles:true}));const second={value:el.value,stored:window.sebKaltestPilot2.state.tests.construction_briques.brique.errors,focused:document.activeElement===el};el.value='125';el.dispatchEvent(new Event('input',{bubbles:true}));const triple=window.sebKaltestPilot2.state.tests.construction_briques.brique.errors;el.value='-1';el.dispatchEvent(new Event('input',{bubbles:true}));const invalid=window.sebKaltestPilot2.state.tests.construction_briques.brique.errors;el.value='125';el.dispatchEvent(new Event('input',{bubbles:true}));document.getElementById('secretCode').value='svg56';document.getElementById('validBtn').click();const state=window.sebKaltestPilot2.state.tests.construction_briques.brique;return {first,second,triple,invalid,errors:state.errors,adminValidated:state.adminValidated,legacy:JSON.parse(sessionStorage.getItem('eval_brique')||'null'),max:el.max};})()";
const actual=await win.webContents.executeJavaScript(js,true);
assert.deepEqual(actual.first,{value:'1',stored:1,focused:true});
assert.deepEqual(actual.second,{value:'12',stored:12,focused:true});
assert.equal(actual.triple,125,'125 doit être accepté');
assert.equal(actual.invalid,null,'Une valeur négative doit être refusée');
assert.equal(actual.errors,125);
assert.equal(actual.adminValidated,true);
assert.equal(actual.max,'','Pas de plafond HTML sur Briques');
assert.equal(actual.legacy?.niveau,'125');
done(0,'BRIQUE_ERRORS_R61: OK — 1/12/125 autorisés, négatifs refusés, admin conserve 125');
}catch(e){done(2,'BRIQUE_ERRORS_R61: FAIL',e);}
}).catch(e=>done(2,'BRIQUE_ERRORS_R61: INIT FAIL',e));
