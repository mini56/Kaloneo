'use strict';
const {app, BrowserWindow} = require('electron');
const path = require('path');
const assert = require('node:assert/strict');

const html = path.resolve(__dirname, '..', 'app', 'web', 'kaltest-pilot2.html');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const deadline = setTimeout(() => { console.error('VIDEO_F1_R147=TIMEOUT'); app.exit(2); }, 45000);
app.commandLine.appendSwitch('disable-gpu');
app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show:false, width:1366, height:768,
    webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true}
  });
  try {
    await win.loadFile(html);
    await delay(400);
    const initialized = await win.webContents.executeJavaScript(`(()=>{
      const api=window.sebKaltestPilot2;
      if (!api) return {ok:false};
      const index=api.data.tests.findIndex(t=>t.id==='transition_video_f1');
      const follows=api.data.tests[index+1]?.id;
      if(index<0) return {ok:false,index,follows};
      sessionStorage.setItem('seb_kaltest_pilot2_state_v1',JSON.stringify({phase:'exercise',testIndex:index}));
      return {ok:true,index,follows};
    })()`,true);
    assert(initialized.ok, 'Moteur KALTEST non initialisé.');
    assert.equal(initialized.follows,'construction_briques','L’image F1 doit suivre la vidéo.');
    await win.loadFile(html);
    await delay(350);

    const started=await win.webContents.executeJavaScript(`(()=>{
      const video=document.querySelector('.kaltest-transition-video');
      if (!video) return {video:false};
      video.dispatchEvent(new Event('ended'));
      return {video:true, id:document.body.dataset.sebKaltestId,
        holding:document.querySelector('.kaltest-transition-holding')!==null,
        black:document.querySelector('.kaltest-transition-fade.visible')!==null};
    })()`,true);
    assert.equal(started.id,'transition_video_f1');
    assert(started.holding&&!started.black,'L’ultime image doit rester visible sans fondu noir immédiat.');

    await delay(2730);
    const held=await win.webContents.executeJavaScript(`({
      test:document.body.dataset.sebKaltestId,
      holding:Boolean(document.querySelector('.kaltest-transition-holding')),
      overlay:Boolean(document.querySelector('.kaltest-transition-last-frame-overlay'))
    })`,true);
    assert(held.test==='transition_video_f1' && held.holding && !held.overlay,
      'L’ultime image doit encore être affichée avant trois secondes : '+JSON.stringify(held));

    await delay(500);
    const crossfade=await win.webContents.executeJavaScript(`({
      test:document.body.dataset.sebKaltestId,
      overlay:Boolean(document.querySelector('.kaltest-transition-last-frame-overlay')),
      fading:Boolean(document.querySelector('.kaltest-transition-crossfade-out')),
      briqueImage:Boolean(document.querySelector('.kaltest-brique-image-card img'))
    })`,true);
    assert(crossfade.test==='construction_briques'&&crossfade.overlay&&crossfade.fading&&crossfade.briqueImage,
      'Le modèle F1 doit apparaître progressivement sous la dernière image : '+JSON.stringify(crossfade));

    await delay(1700);
    const done=await win.webContents.executeJavaScript(`({
      test:document.body.dataset.sebKaltestId,
      overlay:Boolean(document.querySelector('.kaltest-transition-last-frame-overlay')),
      image:Boolean(document.querySelector('.kaltest-brique-image-card img'))
    })`,true);
    assert(done.test==='construction_briques'&&!done.overlay&&done.image,
      'Le fondu ne doit laisser aucune superposition sur l’exercice : '+JSON.stringify(done));
    console.log('VIDEO_F1_R147=OK — 3000 ms ultime image, 1500 ms fondu vers image F1, nettoyage');
    clearTimeout(deadline);
    win.destroy();
    app.quit();
  } catch (error) {
    console.error('VIDEO_F1_R147=FAIL',error.stack||error);
    try { win.destroy(); } catch (_) {}
    app.exit(2);
  }
}).catch(error=>{console.error('VIDEO_F1_R147=FAIL',error.stack||error);app.exit(2)});
