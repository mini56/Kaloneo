'use strict';
const {app,BrowserWindow}=require('electron');
const path=require('path'),fs=require('fs'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const page=path.join(root,'app/web/kaltest-pilot2.html');
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const timeout=setTimeout(()=>{console.error('KALONEO_R170_INTRO_ELECTRON=TIMEOUT');app.exit(2);},35000);
app.commandLine.appendSwitch('disable-gpu');
app.whenReady().then(async()=>{
 const win=new BrowserWindow({show:false,width:1200,height:800,useContentSize:true,
   webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true,devTools:false}});
 try{
  assert(fs.existsSync(path.join(root,'app/web/assets/debut_de_parcours-lecture.mp4')));
  await win.loadFile(page);
  await wait(200);
  await win.webContents.executeJavaScript("(()=>{sessionStorage.removeItem('seb_kaltest_pilot2_intro_video_played_v1');sessionStorage.setItem('seb_kaltest_pilot2_state_v1',JSON.stringify({phase:'intro',testIndex:0,personId:'video-smoke',evaluationId:'video-smoke',identity:{},tests:{},replay:[]}));location.reload();return true;})()",true);
  await wait(1800);
  const playing=await win.webContents.executeJavaScript("(()=>{const v=document.getElementById('pilot2-intro-video-media'),scene=document.getElementById('pilot2-intro-video'),next=document.getElementById('intro-next'),root=document.getElementById('page-intro'),r=v.getBoundingClientRect();return {visible:root.classList.contains('visible'),video:!!v,time:v.currentTime,ready:v.readyState,error:v.error?.message||'',duration:v.duration,playing:scene.classList.contains('seb-video-playing'),played:window.sebPilot2IntroVideo?.played,inBounds:r.width>200&&r.height>40&&r.bottom<=window.innerHeight+8,next:next?.textContent?.trim(),src:v.currentSrc};})()",true);
  assert(playing.visible&&playing.video&&playing.inBounds,'Vidéo hors page : '+JSON.stringify(playing));
  assert(playing.played&&playing.playing,'Autoplay non lancé : '+JSON.stringify(playing));
  assert(playing.time>.12,'Vidéo non décodée : '+JSON.stringify(playing));
  assert(!playing.error&&playing.duration>7.5&&playing.duration<8.5,'MP4 incorrect : '+JSON.stringify(playing));
  await win.webContents.executeJavaScript('window.sebPilot2IntroVideo.finish();true',true);
  await wait(80);
  const after=await win.webContents.executeJavaScript("(()=>{const scene=document.getElementById('pilot2-intro-video'),v=document.getElementById('pilot2-intro-video-media');return {finished:scene.classList.contains('seb-video-finished'),paused:v.paused};})()",true);
  assert(after.finished&&after.paused,'La lecture doit s arrêter proprement');
  await win.webContents.executeJavaScript("(()=>{const p=document.getElementById('page-intro');p.classList.remove('visible');p.classList.add('visible');return true;})()",true);
  await wait(180);
  const replay=await win.webContents.executeJavaScript("(()=>({playing:document.getElementById('pilot2-intro-video').classList.contains('seb-video-playing'),played:window.sebPilot2IntroVideo.played}))()",true);
  assert(!replay.playing&&replay.played,'Pas de second départ');
  await win.webContents.executeJavaScript('document.getElementById("intro-next").click();true',true);
  await wait(170);
  const phase=await win.webContents.executeJavaScript('document.querySelector(".pilot2-page.visible")?.id',true);
  assert.equal(phase,'page-exercise','Enchaînement exercice rompu');
  console.log('KALONEO_R170_INTRO_ELECTRON=OK — MP4 8s 24fps, autoplay 1200x800, lecture unique, parcours');
  clearTimeout(timeout);win.destroy();app.quit();
 }catch(e){console.error('KALONEO_R170_INTRO_ELECTRON=FAIL',e.stack||e);app.exit(2);}
}).catch(e=>{console.error(e.stack||e);app.exit(2);});
