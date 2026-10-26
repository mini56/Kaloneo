'use strict';
// Real Electron: ensure both help guides send their image to the parent window viewer.
const {app,BrowserWindow}=require('electron');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const html=path.join(root,'app','web','kaloneo-help-zoom-fixture.html');
const modulePath=path.join(root,'src','kaloneo-admin-settings.js');
const timer=setTimeout(()=>{console.error('HELP_FULLSCREEN=TIMEOUT');app.exit(2)},120000);
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function eventually(fn,label){
 for(let n=0;n<140;n++){
  try{const x=await fn();if(x)return x;}catch(_){}
  await delay(100);
 }
 throw Error('Timeout '+label);
}
async function test(){
 fs.writeFileSync(html,'<!doctype html><html lang="fr"><head><meta charset="utf-8"></head><body><button id="settings">Réglages</button></body></html>');
 const win=new BrowserWindow({show:false,width:1366,height:768,webPreferences:{
  nodeIntegration:true,contextIsolation:false,sandbox:false,backgroundThrottling:false
 }});
 try{
  await win.loadFile(html);
  const inject='(()=>{'+
    'const install=require('+JSON.stringify(modulePath)+').installAdminSettings;'+
    'const button=document.getElementById("settings");'+
    'window.helpSettings=install({button,bar:document.body,buildNumber:180,releaseVersion:"0.0.204",author:"Smoke",'+
    'ipcRenderer:{invoke:async(name)=>name==="admin:status"?true:[]}});'+
    'button.click();})()';
  await win.webContents.executeJavaScript(inject,true);
  for(const [width,height] of [[1366,768],[1649,928],[1200,800]]){
   win.setSize(width,height);
   for(const [kind,file] of [['admin','A01'],['builder','B01']]){
    await eventually(()=>win.webContents.executeJavaScript(
      '!!document.querySelector(\'#seb-evalpro-settings-dialog [data-tab="'+kind+'"]\')'
    ),'Settings visible');
    await win.webContents.executeJavaScript(
      'document.querySelector(\'#seb-evalpro-settings-dialog [data-tab="'+kind+'"]\').click()'
    );
    const guide=await eventually(()=>{
      const frames=win.webContents.mainFrame.frames||[];
      return frames.find(f=>f.url.includes('/'+(kind==='admin'?'admin-help':'help')+'/index.html'));
    },kind+' help frame');
    const selector='figure img[src="captures/'+file+'.png"]';
    await eventually(()=>guide.executeJavaScript(
      '!!document.querySelector('+JSON.stringify(selector)+')'
    ),kind+' image loaded');
    await guide.executeJavaScript('document.querySelector('+JSON.stringify(selector)+').click()');
    await eventually(()=>win.webContents.executeJavaScript(
      '!!document.querySelector(".settings-fullscreen-help-image img")?.naturalWidth'
    ),'Parent viewer');
    const code=[
     '(()=>{',
     'const overlay=document.querySelector(".settings-fullscreen-help-image");',
     'const main=document.querySelector(".kaloneo-settings-card");',
     'const image=overlay.querySelector("img");',
     'const originalWidth=image.naturalWidth,originalHeight=image.naturalHeight;',
     'const overlayWidth=overlay.getBoundingClientRect().width;',
     'const viewportWidth=innerWidth,viewportHeight=innerHeight;',
     'const overlayHeight=overlay.getBoundingClientRect().height;',
     'const settingsWidth=main.getBoundingClientRect().width;',
     'const initial=image.getBoundingClientRect().width;',
     'overlay.querySelector("[data-photo-plus]").click();',
     'const plus=image.getBoundingClientRect().width;',
     'overlay.querySelector("[data-photo-actual]").click();',
     'const actual=image.getBoundingClientRect().width;',
     'overlay.querySelector("[data-photo-fit]").click();',
     'const fitAgain=image.getBoundingClientRect().width;',
     'overlay.querySelector("[data-photo-close]").click();',
     'return {overlayWidth,overlayHeight,viewportWidth,viewportHeight,settingsWidth,initial,plus,actual,fitAgain,originalWidth,originalHeight,',
     '  closed:!document.querySelector(".settings-fullscreen-help-image"),',
     '  settingsOpen:!!document.querySelector("#seb-evalpro-settings-dialog")};',
     '})()'
    ].join('\n');
    const info=await win.webContents.executeJavaScript(code,true);
    assert(Math.abs(info.overlayWidth-info.viewportWidth)<3,'Overlay width restricted '+JSON.stringify(info));
    assert(Math.abs(info.overlayHeight-info.viewportHeight)<3,'Overlay height restricted '+JSON.stringify(info));
    if(width>1366)assert(info.overlayWidth>info.settingsWidth+200,'Still trapped in settings card');
    assert(info.originalWidth>500&&info.originalHeight>250,'Image unavailable');
    assert(info.initial>info.settingsWidth*.6,'Image not expanded '+JSON.stringify(info));
    assert(info.plus>info.initial*1.14,'Zoom + ineffective '+JSON.stringify(info));
    assert(Math.abs(info.actual-info.originalWidth)<2,'100% is not actual pixel scale '+JSON.stringify(info));
    assert(Math.abs(info.fitAgain-info.initial)<2,'Fit did not restore the initial size');
    assert(info.closed&&info.settingsOpen,'Close removed the settings too');
    console.log('KALONEO_HELP_'+kind+'_'+width+'x'+height+'=SUCCESS',JSON.stringify(info));
   }
  }
  await win.webContents.executeJavaScript('window.helpSettings.close()');
  assert(await win.webContents.executeJavaScript('!document.querySelector("#seb-evalpro-settings-dialog")'));
  console.log('KALONEO_HELP_FULLSCREEN_TWO_GUIDES=SUCCESS');
 }finally{
  if(!win.isDestroyed())win.destroy();
  fs.rmSync(html,{force:true});
 }
}
app.whenReady().then(async()=>{
 try{await test();clearTimeout(timer);app.quit();}
 catch(err){console.error('HELP_FULLSCREEN=FAIL',err.stack||err);app.exit(2);}
}).catch(err=>{console.error(err);app.exit(2)});
