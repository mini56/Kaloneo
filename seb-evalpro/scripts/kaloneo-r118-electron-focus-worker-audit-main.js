'use strict';
const {app,BrowserWindow}=require('electron');
const assert=require('node:assert/strict');
const timeout=setTimeout(()=>{console.error('KALONEO_R118_FOCUS_AUDIT=TIMEOUT');process.exit(2)},90000);
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function run(){
  const win=new BrowserWindow({width:1050,height:720,show:false,backgroundColor:'#fff',
    webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true}});
  await win.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent(
    '<html><body><h1>Champ utilisateur</h1><textarea id="user-input" rows="8" cols="80">Texte de départ sélectionné</textarea></body></html>'));
  win.show();win.focus();
  await wait(200);
  const initial=await win.webContents.executeJavaScript("(function(){const input=document.getElementById('user-input');input.focus();input.setSelectionRange(7,7);return {active:document.activeElement===input,position:input.selectionStart}})()");
  assert(initial.active,'Échec de prise de focus choisie par le scénario.');
  const observations=[];
  for(let n=0;n<10;n++){
    const worker=new BrowserWindow({
      show:false,focusable:false,width:1366,height:768,useContentSize:true,frame:false,
      skipTaskbar:true,paintWhenInitiallyHidden:true,backgroundColor:'#fff',
      webPreferences:{offscreen:true,nodeIntegration:false,contextIsolation:true,
        backgroundThrottling:false,sandbox:true}
    });
    try {
      await worker.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent(
        '<html><body style="background:#fff"><p>Capture candidat isolée</p></body></html>'));
      await worker.webContents.executeJavaScript('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
      const shot=await worker.webContents.capturePage();
      assert(!shot.isEmpty(),'Image de contrôle vide.');
    }finally{if(!worker.isDestroyed())worker.destroy();}
    await wait(70);
    const check=await win.webContents.executeJavaScript("(function(){const input=document.getElementById('user-input');return {active:document.activeElement===input,selection:input.selectionStart,connected:input.isConnected}})()");
    observations.push({cycle:n,windowFocused:win.isFocused(),...check});
  }
  const lost=observations.filter(o=>!o.active||o.selection!==7||!o.connected||!o.windowFocused);
  console.log('KALONEO_R118_FOCUS_WORKER_OBSERVATIONS='+JSON.stringify(observations));
  assert.equal(lost.length,0,'La capture Electron cachée a interrompu le focus du champ déjà choisi.');
  console.log('KALONEO_R118_ELECTRON_WORKER_FOCUS=OK');
  win.destroy();
}
app.whenReady().then(run).then(()=>{clearTimeout(timeout);app.quit();}).catch(error=>{
  console.error('KALONEO_R118_FOCUS_AUDIT=FAIL',error);clearTimeout(timeout);process.exitCode=2;app.quit();
});
