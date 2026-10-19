'use strict';
// Contrôle réel Electron : chargement local de chaque image, recherche et zoom.
const {app,BrowserWindow}=require('electron');
const assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'..','app','web','kaloneo-builder');
const specs=[
 {subdir:'help',expected:12,search:'tableau'},
 {subdir:'admin-help',expected:6,search:'parcours'}
];
const timer=setTimeout(()=>{console.error('KALONEO_R141_GUIDES_ELECTRON_TIMEOUT');app.exit(2)},90000);
async function check(spec){
 const win=new BrowserWindow({show:false,width:1366,height:768,webPreferences:{
  nodeIntegration:false,contextIsolation:true,sandbox:false,backgroundThrottling:false
 }});
 try{
  await win.loadFile(path.join(root,spec.subdir,'index.html'),{query:{settings:'1'}});
  const check=await win.webContents.executeJavaScript(`(async()=>{
   const all=[...document.querySelectorAll('figure img[src^="captures/"]')];
   for(const img of all){img.loading='eager';if(!img.complete)await new Promise(r=>{img.onload=r;img.onerror=r;});}
   const unloaded=all.filter(x=>!x.naturalWidth).map(x=>x.getAttribute('src'));
   const actual=[...new Set(all.map(img=>img.getAttribute('src')))];
   const input=document.getElementById('help-search'),before=document.querySelectorAll('article').length;
   input.value=${JSON.stringify(spec.search)};input.dispatchEvent(new Event('input',{bubbles:true}));
   const after=document.querySelectorAll('article:not([hidden])').length;
   input.value='';input.dispatchEvent(new Event('input',{bubbles:true}));
   const first=all[0];first.click();const dialog=document.getElementById('help-image-dialog');
   const opened=dialog.open&&document.getElementById('help-image-large').src.endsWith(first.getAttribute('src'));
   document.getElementById('close-image-dialog').click();
   return {actual,unloaded,before,after,opened,closed:!dialog.open,searchWorks:after>0&&after<before};
  })()`,true);
  assert.equal(check.actual.length,spec.expected,'Missing distinct screenshots '+spec.subdir+JSON.stringify(check));
  assert.deepEqual(check.unloaded,[],'Broken PNGs in Electron '+spec.subdir);
  assert(check.searchWorks,'Search must filter help chapters '+spec.subdir);
  assert(check.opened&&check.closed,'Screenshot zoom and close must work '+spec.subdir);
  for(const [w,h] of [[1366,768],[1024,768],[800,700],[640,700]]){
    win.setSize(w,h);
    const width=await win.webContents.executeJavaScript(
      "({viewport:innerWidth,body:document.body.scrollWidth,root:document.documentElement.scrollWidth})"
    );
    assert(width.root<=width.viewport+3,'Horizontal overflow '+spec.subdir+' '+w+': '+JSON.stringify(width));
  }
  console.log('KALONEO_R141_'+spec.subdir.toUpperCase()+'=OK images='+check.actual.length+' search + zoom + 4 viewports');
 }finally{if(!win.isDestroyed())win.destroy()}
}
app.whenReady().then(async()=>{try{for(const s of specs)await check(s);clearTimeout(timer);app.quit()}catch(e){console.error('KALONEO_R141_GUIDES_ELECTRON_FAIL',e.stack||e);app.exit(2)}});
