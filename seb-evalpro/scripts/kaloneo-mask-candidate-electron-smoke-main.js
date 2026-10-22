'use strict';
const {app,BrowserWindow,ipcMain}=require('electron');
const path=require('path'),fs=require('fs'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const seed=path.join(root,'app','web','mask-media-seed');
const page=path.join(root,'app','web','kaltest-pilot2.html');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let win=null;
const timer=setTimeout(()=>{console.error('MASK_CANDIDATE_R149=TIMEOUT');app.exit(2)},65000);
app.commandLine.appendSwitch('disable-gpu');
const state={version:1,sessionStorage:{},localStorage:{},lastPage:'kaltest-pilot2.html',lastEvaluationPage:'kaltest-pilot2.html'};
ipcMain.on('app:edition-sync',e=>{e.returnValue={edition:'unified',canBilan:true,canAi:true,canImport:true,canExport:true}});
ipcMain.on('state:load-sync',e=>{e.returnValue=state});
ipcMain.on('state:save-sync',(e,p)=>{Object.assign(state,p||{});e.returnValue={ok:true,state}});
ipcMain.on('candidate-catalog:workspace-load-sync',e=>{e.returnValue={ok:false}});
ipcMain.on('candidate-catalog:workspace-save-sync',e=>{e.returnValue={ok:true}});
ipcMain.on('candidate-catalog:results-workspace-load-sync',e=>{e.returnValue={ok:false}});
ipcMain.on('kaloneo-library:selected-runtime-sync',e=>{e.returnValue={ok:true,runtime:{maskScreen:{id:'kaloneo-video-image',version:'1.0.0'}}}});
ipcMain.handle('kaloneo-library:selected-runtime',()=>({ok:true,runtime:{maskScreen:{id:'kaloneo-video-image',version:'1.0.0'}}}));
ipcMain.handle('state:save',(_e,p)=>({ok:true,state:Object.assign(state,p||{})}));
for(const name of ['admin:status','admin:verify','admin:verify-password','admin:lock','candidate:set-admin-export-context','candidate-catalog:end-bilan','admin:open-candidate-browser','admin:return-candidate-browser','admin:open-tests-parcours','admin:close-tests-parcours','admin:open-bilan','admin:open-candidate-results','admin:return-evaluation','admin:close-session','admin:quit-application']) {
 ipcMain.handle(name,()=>name==='admin:status'?{unlocked:false}:true);
}
for(const name of ['candidate:active','candidate-catalog:detail'])ipcMain.handle(name,()=>null);
for(const name of ['candidate-catalog:list','bilan-history:list','replay:list'])ipcMain.handle(name,()=>[]);
for(const name of ['candidate:complete-active','candidate-catalog:sync','candidate-catalog:workspace-save','replay:capture-page'])ipcMain.handle(name,()=>({ok:true}));
ipcMain.handle('ai:status',()=>({available:false,offline:true}));
ipcMain.handle('ai:rewrite-synthesis',()=>({ok:false}));

app.whenReady().then(async()=>{
 try{
  assert(fs.existsSync(page),'Page candidat non générée');
  const mp4=fs.readdirSync(seed).find(x=>/\.mp4$/i.test(x));
  const png=fs.readdirSync(seed).find(x=>/\.png$/i.test(x));
  assert(mp4&&png,'Médias de la branche video_ecran_mq introuvables dans le Setup.');
  const video='data:video/mp4;base64,'+fs.readFileSync(path.join(seed,mp4)).toString('base64');
  const image='data:image/png;base64,'+fs.readFileSync(path.join(seed,png)).toString('base64');
  const mask={format:'kaloneo-mask-screen',id:'kaloneo-video-image',version:'1.0.0',
    name:'KALONÉO vidéo',content:{video,image,text:''}};
  ipcMain.handle('kaloneo-library:get-mask-screen',(_event,ref)=>({
    ok:true,maskScreen:ref?.id==='kaloneo-video-image'?mask:{
      name:'KALONÉO',content:{text:'KALONÉO',image:''}
    }
  }));
  for(const [width,height] of [[1366,768],[1200,800]]){
   win=new BrowserWindow({width,height,show:true,webPreferences:{
    preload:path.join(root,'src','preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:false
   }});
   await win.loadFile(page);
   win.show();win.focus();
   await delay(1200);
   const before=await win.webContents.executeJavaScript(`(()=>{
     const btn=document.getElementById('seb-evalpro-privacy-toggle');
     if(!btn)return {error:'Bouton écran accueil absent'};
     btn.click();
     const v=document.getElementById('seb-evalpro-privacy-video');
     const img=document.getElementById('seb-evalpro-privacy-image');
     const layer=document.getElementById('seb-evalpro-privacy-layer');
     const stage=document.getElementById('seb-evalpro-privacy-media');
     const box=stage?.getBoundingClientRect();
     return {hasVideo:!!v,videoHidden:v?.hidden,imageHidden:img?.hidden,
      opacity:img?.style.opacity,maskVisible:getComputedStyle(layer).display!=='none',
      width:box?.width,height:box?.height,videoDuration:v?.duration};
   })()`,true);
   assert(before.hasVideo&&before.maskVisible&&!before.videoHidden&&before.opacity==='0',
     'L\'écran candidat doit démarrer par la vidéo, pas le PNG: '+JSON.stringify(before));
   assert(before.width>500&&before.height>250,'Écran masqué hors fenêtre: '+JSON.stringify(before));

   await delay(750);
   const playing=await win.webContents.executeJavaScript(`(()=>{
     const v=document.getElementById('seb-evalpro-privacy-video');
     return {time:v.currentTime,paused:v.paused,readyState:v.readyState,
      error:v.error?.message||'',hidden:v.hidden};
   })()`,true);
   assert(playing.time>0.05&&!playing.paused,'La vidéo du candidat ne se lit pas: '+JSON.stringify(playing));

   // Mutation de la page candidat : les notifications ne doivent jamais réarmer la vidéo.
   await win.webContents.executeJavaScript(`(()=>{
     const element=document.createElement('span');document.body.appendChild(element);
     element.classList.add('kaloneo-simulated-page-progress');
     return true;
   })()`,true);
   await delay(250);
   const advanced=await win.webContents.executeJavaScript(`document.getElementById('seb-evalpro-privacy-video').currentTime`,true);
   assert(advanced>playing.time,'Mutation du parcours redémarre ou arrête la vidéo.');

   // L'élément vidéo reçoit l'événement de fin ; le temps de conservation
   // est mesuré dans le vrai écran candidat, sans utiliser l'aperçu Builder.
   await win.webContents.executeJavaScript(`document.getElementById('seb-evalpro-privacy-video').dispatchEvent(new Event('ended')); true`,true);
   await delay(2750);
   const held=await win.webContents.executeJavaScript(`({
     v:document.getElementById('seb-evalpro-privacy-video').hidden,
     opacity:document.getElementById('seb-evalpro-privacy-image').style.opacity
   })`,true);
   assert(!held.v&&held.opacity==='0','Dernière image non conservée 3 secondes: '+JSON.stringify(held));
   await delay(400);
   const fade=await win.webContents.executeJavaScript(`({
     v:document.getElementById('seb-evalpro-privacy-video').hidden,
     opacity:document.getElementById('seb-evalpro-privacy-image').style.opacity
   })`,true);
   assert(!fade.v&&fade.opacity==='1','Le fondu vers image finale est absent: '+JSON.stringify(fade));
   await delay(1100);
   const done=await win.webContents.executeJavaScript(`({
     v:document.getElementById('seb-evalpro-privacy-video').hidden,
     opacity:document.getElementById('seb-evalpro-privacy-image').style.opacity,
     imageValid:document.getElementById('seb-evalpro-privacy-image').naturalWidth>0
   })`,true);
   assert(done.v&&done.opacity==='1'&&done.imageValid,'Image finale absente: '+JSON.stringify(done));

   await win.webContents.executeJavaScript(`document.getElementById('seb-evalpro-privacy-hide').click();true`,true);
   await delay(200);
   const closed=await win.webContents.executeJavaScript(`({
     hidden:getComputedStyle(document.getElementById('seb-evalpro-privacy-layer')).display==='none',
     videoHidden:document.getElementById('seb-evalpro-privacy-video').hidden
   })`,true);
   assert(closed.hidden&&closed.videoHidden,'La fermeture doit arrêter le lecteur: '+JSON.stringify(closed));
   win.destroy();win=null;
   console.log('MASK_CANDIDATE_R149_VIEWPORT=OK '+width+'x'+height);
  }
  clearTimeout(timer);console.log('MASK_CANDIDATE_R149=OK — vraie page candidat, vidéo, 3 s, fondu, fermeture');app.quit();
 }catch(e){console.error('MASK_CANDIDATE_R149=FAIL '+(e?.stack||e));try{win?.destroy()}catch{}app.exit(2)}
}).catch(e=>{console.error('MASK_CANDIDATE_R149=FAIL '+(e?.stack||e));app.exit(2)});
