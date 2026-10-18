'use strict';
// R139: actual Electron DOM and local image loading for À propos and passwords.
const {app,BrowserWindow}=require('electron');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const fixture=path.join(root,'app','web','kaloneo-r139-credits-smoke.html');
const source=fs.readFileSync(path.join(root,'src','kaloneo-admin-settings.js'),'utf8');
const timeout=setTimeout(()=>{console.error('KALONEO_R139_ABOUT_ELECTRON=TIMEOUT');app.exit(2);},40000);
async function run(){
 const html='<!doctype html><html lang="fr"><meta charset="UTF-8"><title>Test crédit KALONÉO</title><body><button id="open" type="button">Réglages</button></body></html>';
 fs.writeFileSync(fixture,html,'utf8');
 let win;
 try {
   win=new BrowserWindow({show:false,width:1366,height:768,webPreferences:{
     nodeIntegration:false,contextIsolation:true,sandbox:false}});
   await win.loadFile(fixture);
   const boot="(async()=>{const mod={exports:{}};new Function('module',"+JSON.stringify(source)+")(mod);const btn=document.querySelector('#open');mod.exports.installAdminSettings({ipcRenderer:{invoke:async(name)=>{if(name==='admin:status')return true;if(name==='kaloneo-library:list-tests')return {tests:[]};if(name==='kaloneo-library:list-images')return {images:[]};return null}},button:btn,bar:null,buildNumber:'144',releaseVersion:'0.0.168',author:'Claude LESPAGNOL'});btn.click();await new Promise(r=>setTimeout(r,300));const header=document.querySelector('[data-kaloneo-header-logo]');const about=document.querySelector('[data-tab=about]');if(about)about.click();await new Promise(r=>setTimeout(r,500));const primary=document.querySelector('[data-kaloneo-about-logo]'),secondary=document.querySelector('.settings-structure-item img');return {author:document.querySelector('#kaloneo-setting-author')?.textContent||'',title:document.querySelector('[data-section=about] h3')?.textContent||'',structure:document.querySelector('.settings-structure-list')?.textContent?.trim()||'',version:document.querySelector('#kaloneo-setting-version')?.textContent||'',build:document.querySelector('#kaloneo-setting-build')?.textContent||'',header:{src:header?.src,ready:!!(header?.complete&&header?.naturalWidth>0)},primary:{src:primary?.src,ready:!!(primary?.complete&&primary?.naturalWidth>0)},secondary:{src:secondary?.src,ready:!!(secondary?.complete&&secondary?.naturalWidth>0)},sectionVisible:document.querySelector('[data-section=about]')?.hidden===false,passwordPanelCanOpen:!!document.querySelector('[data-tab=passwords]'),imageOverflow:document.querySelector('.settings-about-brand img')?.scrollWidth>document.querySelector('.settings-about-brand')?.clientWidth,structureCount:document.querySelectorAll('.settings-structure-item').length};})()";
   const got=await win.webContents.executeJavaScript(boot,true);
   assert.equal(got.author,'Claude LESPAGNOL');
   assert.equal(got.title,'À propos de KALONÉO');
   assert.equal(got.structure,'Sauvegarde 56');
   assert.equal(got.version,'0.0.168');
   assert.equal(got.build,'Build #144');
   assert.equal(got.sectionVisible,true);
   assert.equal(got.passwordPanelCanOpen,true);
   assert.equal(got.imageOverflow,false);
   assert.equal(got.header.ready,false,'No logo should remain in top-right corner of settings');
   for(const key of ['primary','secondary'])assert.equal(got[key].ready,true,'Logo absent en Electron: '+key+' — '+JSON.stringify(got));
   assert.match(got.primary.src,/kaloneo-logo-app\.png/);
   assert.match(got.secondary.src,/sauvegarde56-logo\.svg/);
   assert.equal(got.structureCount,1,'Exactly one associated structure in the shipped About page.');
   const layout=await win.webContents.executeJavaScript("(()=>{const section=document.querySelector('[data-section=about]'),banner=section.querySelector('.settings-about-brand'),photo=banner.querySelector('img'),list=section.querySelector('.settings-structure-list'),entry=list.querySelector('li'),name=entry.querySelector('strong'),logo=entry.querySelector('img');const b=banner.getBoundingClientRect(),p=photo.getBoundingClientRect(),n=name.getBoundingClientRect(),l=logo.getBoundingClientRect();return {bannerWidth:b.width,imageWidth:p.width,bannerWithinContent:b.width<=section.clientWidth,logoAlignedLeft:Math.abs(p.left-b.left-16)<4,logoBelowTitle:p.top>section.querySelector('.settings-intro h3').getBoundingClientRect().bottom,headerLogoAbsent:!document.querySelector('[data-kaloneo-header-logo]'),nameBeforeLogo:n.bottom<l.top,firstChildIsName:entry.firstElementChild===name,secondChildIsLogo:entry.children[1]===logo,logoWithinCard:l.right<=entry.getBoundingClientRect().right+1}})()");
   assert.equal(layout.logoAlignedLeft,true,'KALONÉO logo must begin at LEFT inside À propos: '+JSON.stringify(layout));
   assert.equal(layout.logoBelowTitle,true,'KALONÉO logo must appear UNDER À propos');
   assert.equal(layout.headerLogoAbsent,true,'Redundant logo remains in upper-right header');
   assert.equal(layout.bannerWithinContent,true,'About logo container overflows panel');
   assert.ok(layout.bannerWidth>=600,'Full-width About banner is too narrow: '+JSON.stringify(layout));
   assert.ok(layout.imageWidth>=layout.bannerWidth*.76,'KALONÉO logo is not using the banner width: '+JSON.stringify(layout));
   assert.equal(layout.nameBeforeLogo,true,'Associated structure must show the name above its logo');
   assert.equal(layout.firstChildIsName,true);
   assert.equal(layout.secondChildIsLogo,true);
   assert.equal(layout.logoWithinCard,true);
   await win.webContents.executeJavaScript("(()=>{const p=document.querySelector('[data-section=about]');p.scrollTop=500;document.querySelector('[data-tab=passwords]').click();document.querySelector('[data-tab=about]').click();return p.scrollTop;})()").then(x=>assert.equal(x,0,'À propos must open at the top so its logo stays visible'));
   for(const [width,height] of [[1200,800],[1024,768]]){
     win.setSize(width,height);
     const narrow=await win.webContents.executeJavaScript("(()=>{const p=document.querySelector('[data-section=about]'),banner=p.querySelector('.settings-about-brand'),list=p.querySelector('.settings-structure-list');return {hasHorizontalOverflow:p.scrollWidth>p.clientWidth+2,logoOverflow:banner.scrollWidth>banner.clientWidth+2,entriesVisible:!!list.querySelector('.settings-structure-item')}})()");
     assert.equal(narrow.hasHorizontalOverflow,false,'Horizontal overflow of About at '+width+'x'+height+': '+JSON.stringify(narrow));
     assert.equal(narrow.logoOverflow,false,'KALONÉO banner overflow at '+width+'x'+height);
     assert.equal(narrow.entriesVisible,true);
   }
   // Simulate a second partner with exactly the same data schema, to verify
   // that each new structure remains a separate name-above-logo entry.
   const originalStructures="const associatedStructures=[{name:'Sauvegarde 56',logo:sauvegarde56LogoUrl,alt:'Logo de Sauvegarde 56'}];";
   assert(source.includes(originalStructures),'Future-proof structures data array missing');
   const expanded=source.replace(originalStructures,"const associatedStructures=[{name:'Sauvegarde 56',logo:sauvegarde56LogoUrl,alt:'Logo de Sauvegarde 56'},{name:'Structure de démonstration',logo:sauvegarde56LogoUrl,alt:'Logo de démonstration'}];");
   await win.loadFile(fixture);
   const expandedBoot=boot.replace(JSON.stringify(source),JSON.stringify(expanded));
   assert.notEqual(expandedBoot,boot,'Expanded data was not injected');
   const extended=await win.webContents.executeJavaScript(expandedBoot,true);
   assert.equal(extended.structureCount,2,'Additional structures must render independently');
   const ordered=await win.webContents.executeJavaScript("(()=>[...document.querySelectorAll('.settings-structure-item')].map(li=>({name:li.querySelector('strong')?.textContent,logoBelow:li.querySelector('strong').getBoundingClientRect().bottom<li.querySelector('img').getBoundingClientRect().top})) )()");
   assert.deepEqual(ordered.map(x=>x.name),['Sauvegarde 56','Structure de démonstration']);
   assert(ordered.every(x=>x.logoBelow),'Future entries must also have the logo under the name.');
   const shot=await win.webContents.capturePage();
   assert(!shot.isEmpty(),'No Electron rendering of credits and logos.');
   console.log('KALONEO_R139_ABOUT_ELECTRON=OK — Claude LESPAGNOL, both official logos, version/build, offline images, real settings dialog.');
 }finally{
   try{if(win&&!win.isDestroyed())win.destroy()}catch(_){}
   try{fs.unlinkSync(fixture)}catch(_){}
   clearTimeout(timeout);
 }
}
app.whenReady().then(()=>run().then(()=>app.quit()).catch(e=>{console.error('KALONEO_R139_ABOUT_ELECTRON=FAIL',e.stack||e);app.exit(2)}));
