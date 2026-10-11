'use strict';

// Verifies the actual KALTEST Tri station, not the legacy tri_de_cheville.html.
// Regression: after entering errors in tri #1, the chronometer failed to rearm.
const {app,BrowserWindow,ipcMain}=require('electron');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const web=path.join(root,'app','web');
const tri=JSON.parse(fs.readFileSync(path.join(web,'kaltest','tests','tri-chevilles','1.0.0','test.json'),'utf8'));
const selected={ok:true,runtime:{
  id:'tri-rearm-r60-smoke',title:'Tri de chevilles',
  builderPreview:true,launchOptions:{showCorrectionsDuringParcours:false},
  introduction:null,tests:[tri],fin:null
}};
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
for(const name of ['admin:status','admin:verify','admin:lock'])ipcMain.handle(name,()=>true);
for(const name of ['candidate:active','candidate-catalog:list','candidate-catalog:detail','replay:list','bilan-history:list'])ipcMain.handle(name,()=>null);
for(const name of ['state:save','replay:capture-page','candidate-catalog:workspace-save','candidate-catalog:end-bilan'])ipcMain.handle(name,()=>ok);
ipcMain.handle('ai:status',()=>({available:false}));
ipcMain.handle('ai:cancel-current',()=>ok);
ipcMain.handle('kaloneo-library:get-mask-screen',()=>({ok:false}));
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let win;
let ended=false;
const done=(code,label,error)=>{
  if(ended)return;
  ended=true;
  clearTimeout(timeout);
  console[code===0?'log':'error'](label);
  if(error)console.error(error?.stack||String(error));
  try{if(win&&!win.isDestroyed())win.destroy();}catch(_){}
  app.exit(code);
};
const timeout=setTimeout(()=>done(2,'TRI_REARM_R60: TIMEOUT'),60000);
app.commandLine.appendSwitch('disable-gpu');
app.whenReady().then(async()=>{
  try{
    win=new BrowserWindow({show:false,width:1366,height:768,webPreferences:{
      preload:path.join(root,'src','preload.js'),
      contextIsolation:true,nodeIntegration:false,sandbox:false
    }});
    win.webContents.on('preload-error',(_ev,file,error)=>done(2,'TRI_REARM_R60: PRELOAD ERROR '+file,error));
    await win.loadFile(path.join(web,'kaltest-pilot2.html'),{query:{kaloneoPreview:'1'}});
    let initial;
    for(let n=0;n<120;n++){
      initial=await win.webContents.executeJavaScript("(()=>{const s=document.querySelector('.kaltest-tri-chrono-buttons .seb-btn-timer-start');const t=document.querySelector('.kaltest-tri-chrono-buttons .seb-btn-timer-stop');return {id:document.body.dataset.sebKaltestId,ready:!!s&&!!t&&document.querySelectorAll('[data-tri-error]').length===5,startDisabled:s?.disabled,stopDisabled:t?.disabled};})()",true).catch(()=>null);
      if(initial?.ready)break;
      await wait(50);
    }
    assert.equal(initial?.ready,true,'Real candidate KALTEST Tri station must render');
    assert.equal(initial.id,'tri_chevilles');
    assert.equal(initial.startDisabled,false);
    assert.equal(initial.stopDisabled,true);

    for(let i=0;i<3;i++){
      let started=await win.webContents.executeJavaScript("(()=>{const start=document.querySelector('.kaltest-tri-chrono-buttons .seb-btn-timer-start');const stop=document.querySelector('.kaltest-tri-chrono-buttons .seb-btn-timer-stop');const before=start.disabled;start.click();return {before,startDisabled:start.disabled,stopDisabled:stop.disabled};})()",true);
      assert.equal(started.before,false,'Tri '+(i+1)+': Démarrer not ready');
      assert.equal(started.startDisabled,true);
      assert.equal(started.stopDisabled,false);
      await wait(100);
      const stopped=await win.webContents.executeJavaScript("(()=>{document.querySelector('.kaltest-tri-chrono-buttons .seb-btn-timer-stop').click();const state=window.sebKaltestPilot2.state.tests.tri_chevilles.tri;return {awaitingError:state.awaitingError,seconds:state.rows["+i+"].seconds,startDisabled:document.querySelector('.kaltest-tri-chrono-buttons .seb-btn-timer-start').disabled};})()",true);
      assert.equal(stopped.awaitingError,i+1,'Tri '+(i+1)+': should await errors');
      assert.equal(typeof stopped.seconds,'number','Tri '+(i+1)+': no recorded time');
      assert.equal(stopped.startDisabled,true);

      // First digit must NEVER advance, reset the clock or steal keyboard focus.
      // The test deliberately uses a nonzero display to catch a premature reset.
      const firstDigit=String([0,1,2][i]);
      const result=await win.webContents.executeJavaScript("(()=>{const el=document.querySelectorAll('[data-tri-error]')["+i+"];el.focus();el.value='"+firstDigit+"';const state=window.sebKaltestPilot2.state.tests.tri_chevilles.tri;state.liveSeconds=82;document.querySelector('.kaltest-tri-display').textContent='01:22';el.dispatchEvent(new Event('input',{bubbles:true}));return {entered:el.value,stored:state.rows["+i+"].errors,awaitingError:state.awaitingError,currentTri:state.currentTri,liveSeconds:state.liveSeconds,startDisabled:document.querySelector('.kaltest-tri-chrono-buttons .seb-btn-timer-start').disabled,display:document.querySelector('.kaltest-tri-display')?.textContent,focused:document.activeElement===el};})()",true);
      assert.equal(result.entered,firstDigit,'Tri '+(i+1)+': first digit lost');
      assert.equal(result.stored,null,'Tri '+(i+1)+': first digit committed too early');
      assert.equal(result.awaitingError,i+1,'Tri '+(i+1)+': awaiting error prematurely cleared');
      assert.equal(result.currentTri,i+1,'Tri '+(i+1)+': next tri started before validation');
      assert.equal(result.liveSeconds,82,'Tri '+(i+1)+': stopwatch reset on first digit');
      assert.equal(result.display,'01:22','Tri '+(i+1)+': display reset on first digit');
      assert.equal(result.startDisabled,true,'Tri '+(i+1)+': start rearmed before validation');
      assert.equal(result.focused,true,'Tri '+(i+1)+': error field lost focus immediately');
      await wait(80);
      const focusStays=await win.webContents.executeJavaScript("(()=>document.activeElement===document.querySelectorAll('[data-tri-error]')["+i+"])()",true);
      assert.equal(focusStays,true,'Tri '+(i+1)+': error field lost focus after delay');

      // Type 12 or 125, digit by digit, with no blur.
      const finalValue=String([0,12,125][i]);
      if(finalValue.length>=2){
        const doubleDigit=await win.webContents.executeJavaScript("(()=>{const el=document.querySelectorAll('[data-tri-error]')["+i+"];el.value='"+finalValue+"';el.dispatchEvent(new Event('input',{bubbles:true}));const state=window.sebKaltestPilot2.state.tests.tri_chevilles.tri;return {entered:el.value,stored:state.rows["+i+"].errors,focused:document.activeElement===el,display:document.querySelector('.kaltest-tri-display')?.textContent,awaitingError:state.awaitingError};})()",true);
        assert.deepEqual(doubleDigit,{entered:finalValue,stored:null,focused:true,display:'01:22',awaitingError:i+1},'Tri '+(i+1)+': multiple digits must not cause premature reset');
      }
      const confirmed=await win.webContents.executeJavaScript("(()=>{const el=document.querySelectorAll('[data-tri-error]')["+i+"];el.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));const state=window.sebKaltestPilot2.state.tests.tri_chevilles.tri;return {stored:state.rows["+i+"].errors,awaitingError:state.awaitingError,currentTri:state.currentTri,liveSeconds:state.liveSeconds,startDisabled:document.querySelector('.kaltest-tri-chrono-buttons .seb-btn-timer-start').disabled,display:document.querySelector('.kaltest-tri-display')?.textContent};})()",true);
      assert.equal(confirmed.stored,Number(finalValue),'Tri '+(i+1)+': final errors not committed');
      assert.equal(confirmed.awaitingError,null,'Tri '+(i+1)+': still awaiting confirmed errors');
      assert.equal(confirmed.currentTri,i+2,'Tri '+(i+1)+': next attempt not selected');
      assert.equal(confirmed.liveSeconds,0,'Tri '+(i+1)+': clock not reset after validation');
      assert.equal(confirmed.display,'00:00','Tri '+(i+1)+': display not reset after validation');
      assert.equal(confirmed.startDisabled,false,'Tri '+(i+1)+': start not rearmed after validation');
    }
    const after=await win.webContents.executeJavaScript("(()=>{const results=document.querySelector('.kaltest-tri-results-button');const state=window.sebKaltestPilot2.state.tests.tri_chevilles.tri;return {disabled:results?.disabled,errorValues:state.rows.slice(0,3).map(r=>r.errors),count:state.rows.filter(r=>r.seconds!==null&&r.errors!==null).length};})()",true);
    assert.equal(after.count,3);
    assert.deepEqual(after.errorValues,[0,12,125]);
    assert.equal(after.disabled,false,'Voir les résultats must unlock after 3 completed tris');
    const review=await win.webContents.executeJavaScript("(()=>{document.querySelector('.kaltest-tri-results-button').click();const layout=document.querySelector('.kaltest-tri-layout');const left=layout.querySelector('.kaltest-tri-left');const right=layout.querySelector('.kaltest-tri-right');const auto=layout.querySelector('.kaltest-tri-autoeval');const summary=auto.querySelector('.kaltest-tri-results');return {fullWidth:layout.classList.contains('kaltest-tri-review'),leftRatio:left.getBoundingClientRect().width/layout.getBoundingClientRect().width,rightHidden:getComputedStyle(right).display==='none',guideHidden:getComputedStyle(layout.querySelector('.kaltest-tri-guide')).display==='none',autoVisible:!auto.hidden,summaryVisible:!summary.hidden,summaryText:summary.textContent,autoInputs:auto.querySelectorAll('input[type=checkbox]').length};})()",true);
    assert.equal(review.fullWidth,true,'Tri review must switch to full-width');
    assert.ok(review.leftRatio>0.95,'Tri autoévaluation still confined to half width');
    assert.equal(review.rightHidden,true);
    assert.equal(review.guideHidden,true);
    assert.equal(review.autoVisible,true);
    assert.equal(review.summaryVisible,true);
    assert.ok(review.summaryText.includes('137'),'Tri 0 + 12 + 125 total is not displayed');
    assert.equal(review.autoInputs,5,'Tri autoevaluation missing checkboxes');
    done(0,'TRI_REARM_R60: OK — 0/12/125 errors, 3 tries, chrono/focus preserved; review full width');
  }catch(error){done(2,'TRI_REARM_R60: FAIL',error);}
}).catch(error=>done(2,'TRI_REARM_R60: INIT FAIL',error));
