'use strict';
// R140: actual Electron DOM and local image loading for À propos and passwords.
const {app,BrowserWindow}=require('electron');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const fixture=path.join(root,'app','web','kaloneo-r140-credits-smoke.html');
const source=fs.readFileSync(path.join(root,'src','kaloneo-admin-settings.js'),'utf8');
const timeout=setTimeout(()=>{console.error('KALONEO_R140_ABOUT_ELECTRON=TIMEOUT');app.exit(2);},40000);
async function run(){
 const html='<!doctype html><html lang="fr"><meta charset="UTF-8"><title>Test crédit KALONÉO</title><body><button id="open" type="button">Réglages</button></body></html>';
 fs.writeFileSync(fixture,html,'utf8');
 let win;
 try {
   win=new BrowserWindow({show:false,width:1366,height:768,webPreferences:{
     nodeIntegration:false,contextIsolation:true,sandbox:false}});
   await win.loadFile(fixture);
   const boot="(async()=>{const mod={exports:{}};new Function('module',"+JSON.stringify(source)+")(mod);const btn=document.querySelector('#open');mod.exports.installAdminSettings({ipcRenderer:{invoke:async(name)=>{if(name==='admin:status')return true;if(name==='kaloneo-library:list-tests')return {tests:[]};if(name==='kaloneo-library:list-images')return {images:[]};return null}},button:btn,bar:null,buildNumber:'146',releaseVersion:'0.0.170',author:'Claude LESPAGNOL'});btn.click();await new Promise(r=>setTimeout(r,300));const header=document.querySelector('[data-kaloneo-header-logo]');const about=document.querySelector('[data-tab=about]');if(about)about.click();await new Promise(r=>setTimeout(r,500));const primary=document.querySelector('[data-kaloneo-about-logo]'),secondary=document.querySelector('.settings-structure-item img');return {author:document.querySelector('#kaloneo-setting-author')?.textContent||'',title:document.querySelector('[data-section=about] h3')?.textContent||'',structure:document.querySelector('.settings-structure-list')?.textContent?.trim()||'',version:document.querySelector('#kaloneo-setting-version')?.textContent||'',build:document.querySelector('#kaloneo-setting-build')?.textContent||'',header:{src:header?.src,ready:!!(header?.complete&&header?.naturalWidth>0)},primary:{src:primary?.src,ready:!!(primary?.complete&&primary?.naturalWidth>0)},secondary:{src:secondary?.src,ready:!!(secondary?.complete&&secondary?.naturalWidth>0)},sectionVisible:document.querySelector('[data-section=about]')?.hidden===false,passwordPanelCanOpen:!!document.querySelector('[data-tab=passwords]'),imageOverflow:document.querySelector('.settings-nav-brand img')?.scrollWidth>document.querySelector('.settings-nav-brand')?.clientWidth,structureCount:document.querySelectorAll('.settings-structure-item').length};})()";
   const got=await win.webContents.executeJavaScript(boot,true);
   assert.equal(got.author,'Claude LESPAGNOL');
   assert.equal(got.title,'À propos de KALONÉO');
   assert.equal(got.structure,'Sauvegarde 56');
   assert.equal(got.version,'0.0.170');
   assert.equal(got.build,'Build #146');
   assert.equal(got.sectionVisible,true);
   assert.equal(got.passwordPanelCanOpen,true);
   assert.equal(got.imageOverflow,false);
   assert.equal(got.header.ready,false,'No logo should remain in top-right corner of settings');
   for(const key of ['primary','secondary'])assert.equal(got[key].ready,true,'Logo absent en Electron: '+key+' — '+JSON.stringify(got));
   assert.match(got.primary.src,/kaloneo-logo-app\.png/);
   assert.match(got.secondary.src,/sauvegarde56-logo\.svg/);
   assert.equal(got.structureCount,1,'Exactly one associated structure in the shipped About page.');
   const layout=await win.webContents.executeJavaScript("(()=>{const nav=document.querySelector('.settings-nav'),about=document.querySelector('[data-tab=about]'),brand=document.querySelector('.settings-nav-brand'),photo=brand?.querySelector('[data-kaloneo-about-logo]'),main=document.querySelector('.settings-main'),section=document.querySelector('[data-section=about]'),entry=section.querySelector('.settings-structure-item'),name=entry.querySelector('strong'),logo=entry.querySelector('img');const n=nav.getBoundingClientRect(),a=about.getBoundingClientRect(),b=brand.getBoundingClientRect(),p=photo.getBoundingClientRect(),m=main.getBoundingClientRect(),v=name.getBoundingClientRect(),l=logo.getBoundingClientRect();return {logoInNav:brand.parentElement===nav,immediatelyAfterAbout:about.nextElementSibling===brand,logoUnderAbout:p.top>=a.bottom-1,logoFitsNav:p.left>=n.left-2&&p.right<=n.right+2,brandFitsNav:b.right<=n.right+2,leftOfMain:p.right<=m.left+2,noLogoInsideMain:!main.querySelector('[data-kaloneo-about-logo]'),noLogoInHeader:!document.querySelector('[data-kaloneo-header-logo]'),nameBeforeLogo:v.bottom<l.top,firstChildIsName:entry.firstElementChild===name,secondChildIsLogo:entry.children[1]===logo,structureLogoFitsCard:l.right<=entry.getBoundingClientRect().right+2,sidebarStillLeft:n.right<=m.left+2}})()");
   for(const key of ['logoInNav','immediatelyAfterAbout','logoUnderAbout','logoFitsNav','brandFitsNav','leftOfMain','noLogoInsideMain','noLogoInHeader','nameBeforeLogo','firstChildIsName','secondChildIsLogo','structureLogoFitsCard','sidebarStillLeft'])
     assert.equal(layout[key],true,'Incorrect logo/structure DOM '+key+': '+JSON.stringify(layout));
   await win.webContents.executeJavaScript("(()=>{const p=document.querySelector('[data-section=about]');p.scrollTop=500;document.querySelector('[data-tab=passwords]').click();document.querySelector('[data-tab=about]').click();return p.scrollTop;})()").then(x=>assert.equal(x,0,'À propos must open at the top so its logo stays visible'));
   for(const [width,height] of [[1366,768],[1200,800],[1024,768],[800,700],[640,600],[500,700]]){
     win.setSize(width,height);
     const narrow=await win.webContents.executeJavaScript("(()=>{const nav=document.querySelector('.settings-nav'),main=document.querySelector('.settings-main'),brand=nav.querySelector('.settings-nav-brand'),about=nav.querySelector('[data-tab=about]'),img=brand.querySelector('img'),dialog=document.querySelector('.kaloneo-settings-card'),section=main.querySelector('[data-section=about]');const n=nav.getBoundingClientRect(),m=main.getBoundingClientRect(),b=brand.getBoundingClientRect(),a=about.getBoundingClientRect(),i=img.getBoundingClientRect();return {navOnLeft:n.right<=m.left+2,underButton:i.top>=a.bottom-1,brandIsAfterButton:about.nextElementSibling===brand,imgWithinNav:i.left>=n.left-2&&i.right<=n.right+2,brandWithinNav:b.right<=n.right+2,noLogoInRight:!main.querySelector('[data-kaloneo-about-logo]'),settingsOverflow:dialog.scrollWidth>dialog.clientWidth+2,sectionOverflow:section.scrollWidth>section.clientWidth+2,imageLoaded:img.complete&&img.naturalWidth>0,structureCount:section.querySelectorAll('.settings-structure-item').length}})()");
     for(const key of ['navOnLeft','underButton','brandIsAfterButton','imgWithinNav','brandWithinNav','noLogoInRight','imageLoaded'])
       assert.equal(narrow[key],true,'R140 sidebar at '+width+'x'+height+' failed '+key+': '+JSON.stringify(narrow));
     assert.equal(narrow.settingsOverflow,false,'Dialog overflow '+width+'x'+height+': '+JSON.stringify(narrow));
     assert.equal(narrow.sectionOverflow,false,'Right panel overflow '+width+'x'+height+': '+JSON.stringify(narrow));
     assert.equal(narrow.structureCount,1);
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
   console.log('KALONEO_R140_ABOUT_ELECTRON=OK — logo in left sidebar under À propos at six window sizes; no logo in right pane; creator and structures preserved.');
 }finally{
   try{if(win&&!win.isDestroyed())win.destroy()}catch(_){}
   try{fs.unlinkSync(fixture)}catch(_){}
   clearTimeout(timeout);
 }
}
app.whenReady().then(()=>run().then(()=>app.quit()).catch(e=>{console.error('KALONEO_R140_ABOUT_ELECTRON=FAIL',e.stack||e);app.exit(2)}));
