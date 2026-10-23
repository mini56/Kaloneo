'use strict';
const {app,BrowserWindow,ipcMain}=require('electron');
const path=require('path'),fs=require('fs'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const seed=path.join(root,'app','web','mask-media-seed');
const page=path.join(root,'app','web','kaltest-pilot2.html');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let win=null;
const timer=setTimeout(()=>{console.error('MASK_CANDIDATE_R162=TIMEOUT');app.exit(2)},45000);
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
  const images=fs.readdirSync(seed);
  assert.equal(images.some(x=>/\.mp4$/i.test(x)),false,'La vidéo est encore embarquée');
  const png=images.find(x=>/\.png$/i.test(x));
  assert(png,'Image fixe manquante dans le Setup');
  const image='data:image/png;base64,'+fs.readFileSync(path.join(seed,png)).toString('base64');
  const mask={format:'kaloneo-mask-screen',id:'kaloneo-video-image',version:'1.0.0',
    name:'KALONÉO image fixe',content:{video:'',image,text:''}};
  ipcMain.handle('kaloneo-library:get-mask-screen',()=>({ok:true,maskScreen:mask}));
  for(const [width,height] of [[1366,768],[1200,800]]){
    win=new BrowserWindow({width,height,show:true,webPreferences:{
      preload:path.join(root,'src','preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:false
    }});
    await win.loadFile(page);
    win.show();win.focus();
    await delay(1300);
    const view=await win.webContents.executeJavaScript(`(()=>{
      const button=document.getElementById('seb-evalpro-privacy-toggle');
      if(!button)return {error:'Bouton confidentialité absent'};
      button.click();
      const video=document.getElementById('seb-evalpro-privacy-video');
      const img=document.getElementById('seb-evalpro-privacy-image');
      const layer=document.getElementById('seb-evalpro-privacy-layer');
      const media=document.getElementById('seb-evalpro-privacy-media');
      return {maskVisible:getComputedStyle(layer).display!=='none',videoHidden:video?.hidden,
        videoSrc:video?.src||'',imgHidden:img?.hidden,src:img?.src||'',
        width:media?.getBoundingClientRect().width,
        height:media?.getBoundingClientRect().height};
    })()`,true);
    assert(view.maskVisible&&view.videoHidden&&!view.videoSrc&&!view.imgHidden,
      'Masquage doit afficher UNIQUEMENT l image: '+JSON.stringify(view));
    assert(view.src.startsWith('data:image/png;base64,'),
      'L image originale du masquage doit etre affichee: '+JSON.stringify(view));
    assert(view.width>500&&view.height>250,'Image de masquage hors cadre: '+JSON.stringify(view));
    await delay(300);
    const settled=await win.webContents.executeJavaScript(`(()=>{
      const img=document.getElementById('seb-evalpro-privacy-image');
      const v=document.getElementById('seb-evalpro-privacy-video');
      return {validImage:img?.naturalWidth>0,videoHidden:v?.hidden,
        videoSrc:v?.getAttribute('src')||''};
    })()`,true);
    assert(settled.validImage&&settled.videoHidden&&!settled.videoSrc,
      'Image fixe ne se charge pas ou video active: '+JSON.stringify(settled));
    await win.webContents.executeJavaScript(`document.getElementById('seb-evalpro-privacy-hide').click();true`,true);
    await delay(180);
    const hidden=await win.webContents.executeJavaScript(`getComputedStyle(document.getElementById('seb-evalpro-privacy-layer')).display==='none'`,true);
    assert(hidden,'Fermeture du masquage impossible');
    console.log('KALONEO_R162_CANDIDATE_MASK=OK '+width+'x'+height);
    win.destroy();win=null;
  }
  clearTimeout(timer);
  console.log('KALONEO_R162_CANDIDATE_FIXED_IMAGE=OK — image PNG uniquement, zéro vidéo');
  app.quit();
 }catch(e){
  console.error('KALONEO_R162_CANDIDATE_MASK=FAIL '+(e?.stack||e));
  try{win?.destroy()}catch{}app.exit(2);
 }
}).catch(e=>{console.error('KALONEO_R162_CANDIDATE_MASK=FAIL '+(e?.stack||e));app.exit(2)});
