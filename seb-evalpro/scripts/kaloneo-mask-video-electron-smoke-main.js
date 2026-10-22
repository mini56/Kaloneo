'use strict';
const {app,BrowserWindow}=require('electron');
const fs=require('fs'),path=require('path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const page=path.join(root,'app','web','admin-mask-builder.html');
const seed=path.join(root,'app','web','mask-media-seed');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const t=setTimeout(()=>{console.error('MASK_VIDEO_ELECTRON=TIMEOUT');app.exit(2)},60000);
app.commandLine.appendSwitch('disable-gpu');
app.whenReady().then(async()=>{
 let win;
 try{
  const videoFile=fs.readdirSync(seed).find(name=>/\.mp4$/i.test(name));
  const imageFile=fs.readdirSync(seed).find(name=>/\.png$/i.test(name));
  assert(videoFile&&imageFile,'Vidéo et PNG fournis absents du Setup.');
  const videoSrc='data:video/mp4;base64,'+fs.readFileSync(path.join(seed,videoFile)).toString('base64');
  const imageSrc='data:image/png;base64,'+fs.readFileSync(path.join(seed,imageFile)).toString('base64');
  const data=JSON.stringify({name:'KALONÉO — vidéo puis image',content:{video:videoSrc,image:imageSrc,text:''}});
  for(const [width,height] of [[1366,768],[1200,800]]){
   win=new BrowserWindow({width,height,show:false,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true}});
   await win.loadFile(page);
   await sleep(200);
   const info=await win.webContents.executeJavaScript(`(()=>{
      const stage=document.getElementById('mask-preview-media-stage');
      const player=window.KaloneoMaskMedia?.createPlayer({
        stage,video:document.getElementById('mask-preview-video'),
        image:document.getElementById('mask-preview-image'),
        text:document.getElementById('mask-preview-text')
      });
      window.__maskVideoSmokePlayer=player;
      if(!player)return {ready:false};
      player.show(${data});
      const img=document.getElementById('mask-preview-image');
      const vid=document.getElementById('mask-preview-video');
      const r=stage.getBoundingClientRect();
      return {ready:true,video:!vid.hidden,image:!img.hidden,opacity:img.style.opacity,
        width:r.width,height:r.height,bottom:r.bottom,viewport:innerHeight,
        decode:vid.canPlayType('video/mp4')};
    })()`,true);
   assert(info.ready&&info.video&&info.image&&info.opacity==='0', 'Écran vidéo initial non visible '+JSON.stringify(info));
   assert(info.width>180&&info.height>140&&info.bottom<=height+5,'L’écran déborde '+JSON.stringify(info));
   if(width===1366){
    await win.webContents.executeJavaScript(`document.getElementById('mask-preview-video').dispatchEvent(new Event('ended'));true`,true);
    await sleep(2730);
    const hold=await win.webContents.executeJavaScript(`({
      videoHidden:document.getElementById('mask-preview-video').hidden,
      opacity:document.getElementById('mask-preview-image').style.opacity
    })`,true);
    assert(!hold.videoHidden&&hold.opacity==='0','Dernière image non conservée 3 s '+JSON.stringify(hold));
    await sleep(430);
    const fading=await win.webContents.executeJavaScript(`({
      videoHidden:document.getElementById('mask-preview-video').hidden,
      opacity:document.getElementById('mask-preview-image').style.opacity
    })`,true);
    assert(!fading.videoHidden&&fading.opacity==='1','Fondu ne démarre pas après 3 s '+JSON.stringify(fading));
    await sleep(1120);
    const done=await win.webContents.executeJavaScript(`({
      videoHidden:document.getElementById('mask-preview-video').hidden,
      opacity:document.getElementById('mask-preview-image').style.opacity,
      imageValid:document.getElementById('mask-preview-image').naturalWidth>0
    })`,true);
    assert(done.videoHidden&&done.opacity==='1'&&done.imageValid,'Image finale non affichée '+JSON.stringify(done));
   }
   win.destroy();win=null;
   console.log('MASK_VIDEO_ELECTRON_VIEWPORT=OK '+width+'x'+height);
  }
  clearTimeout(t);console.log('MASK_VIDEO_ELECTRON=OK — dernière frame 3000 ms, fondu 1000 ms, PNG réel');app.quit();
 }catch(e){console.error('MASK_VIDEO_ELECTRON=FAIL '+(e.stack||e));try{win?.destroy()}catch{}app.exit(2);}
}).catch(e=>{console.error('MASK_VIDEO_ELECTRON=FAIL '+e);app.exit(2)});
