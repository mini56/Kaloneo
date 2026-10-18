'use strict';
// R137: actual Electron DOM and local image loading for À propos and passwords.
const {app,BrowserWindow}=require('electron');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const fixture=path.join(root,'app','web','kaloneo-r137-credits-smoke.html');
const source=fs.readFileSync(path.join(root,'src','kaloneo-admin-settings.js'),'utf8');
const timeout=setTimeout(()=>{console.error('KALONEO_R137_ABOUT_ELECTRON=TIMEOUT');app.exit(2);},40000);
async function run(){
 const html='<!doctype html><html lang="fr"><meta charset="UTF-8"><title>Test crédit KALONÉO</title><body><button id="open" type="button">Réglages</button></body></html>';
 fs.writeFileSync(fixture,html,'utf8');
 let win;
 try {
   win=new BrowserWindow({show:false,width:1366,height:768,webPreferences:{
     nodeIntegration:false,contextIsolation:true,sandbox:false}});
   await win.loadFile(fixture);
   const boot="(async()=>{const mod={exports:{}};new Function('module',"+JSON.stringify(source)+")(mod);const btn=document.querySelector('#open');mod.exports.installAdminSettings({ipcRenderer:{invoke:async(name)=>{if(name==='admin:status')return true;if(name==='kaloneo-library:list-tests')return {tests:[]};if(name==='kaloneo-library:list-images')return {images:[]};return null}},button:btn,bar:null,buildNumber:'142',releaseVersion:'0.0.166',author:'Claude LESPAGNOL'});btn.click();await new Promise(r=>setTimeout(r,300));const header=document.querySelector('[data-kaloneo-header-logo]');const about=document.querySelector('[data-tab=about]');if(about)about.click();await new Promise(r=>setTimeout(r,500));const primary=document.querySelector('[data-kaloneo-about-logo]'),secondary=document.querySelector('[data-sauvegarde56-about-logo]');return {author:document.querySelector('#kaloneo-setting-author')?.textContent||'',title:document.querySelector('[data-section=about] h3')?.textContent||'',structure:document.querySelector('.settings-structure-credit')?.textContent?.trim()||'',version:document.querySelector('#kaloneo-setting-version')?.textContent||'',build:document.querySelector('#kaloneo-setting-build')?.textContent||'',header:{src:header?.src,ready:!!(header?.complete&&header?.naturalWidth>0)},primary:{src:primary?.src,ready:!!(primary?.complete&&primary?.naturalWidth>0)},secondary:{src:secondary?.src,ready:!!(secondary?.complete&&secondary?.naturalWidth>0)},sectionVisible:document.querySelector('[data-section=about]')?.hidden===false,passwordPanelCanOpen:!!document.querySelector('[data-tab=passwords]'),imageOverflow:document.querySelector('.settings-about-brand img')?.scrollWidth>document.querySelector('.settings-about-brand')?.clientWidth};})()";
   const got=await win.webContents.executeJavaScript(boot,true);
   assert.equal(got.author,'Claude LESPAGNOL');
   assert.equal(got.title,'À propos de KALONÉO');
   assert.equal(got.structure,'Sauvegarde 56');
   assert.equal(got.version,'0.0.166');
   assert.equal(got.build,'Build #142');
   assert.equal(got.sectionVisible,true);
   assert.equal(got.passwordPanelCanOpen,true);
   assert.equal(got.imageOverflow,false);
   for(const key of ['header','primary','secondary'])assert.equal(got[key].ready,true,'Logo absent en Electron: '+key+' — '+JSON.stringify(got));
   assert.match(got.primary.src,/kaloneo-logo-app\.png/);
   assert.match(got.secondary.src,/sauvegarde56-logo\.svg/);
   const shot=await win.webContents.capturePage();
   assert(!shot.isEmpty(),'No Electron rendering of credits and logos.');
   console.log('KALONEO_R137_ABOUT_ELECTRON=OK — Claude LESPAGNOL, both official logos, version/build, offline images, real settings dialog.');
 }finally{
   try{if(win&&!win.isDestroyed())win.destroy()}catch(_){}
   try{fs.unlinkSync(fixture)}catch(_){}
   clearTimeout(timeout);
 }
}
app.whenReady().then(()=>run().then(()=>app.quit()).catch(e=>{console.error('KALONEO_R137_ABOUT_ELECTRON=FAIL',e.stack||e);app.exit(2)}));
