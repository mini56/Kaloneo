'use strict';
// Smoke Electron d'un vrai test de catalogue, avec PNG externe compact.
const {app,BrowserWindow,ipcMain}=require('electron');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const web=path.join(root,'app','web');
const test=JSON.parse(fs.readFileSync(path.join(root,'source','kaltest','tests','genre-nombre','1.0.0','test.json'),'utf8'));
const runtime={ok:true,runtime:{id:'genre_nombre-direct-banner',builderPreview:true,
  title:'Contrôle du bandeau',introduction:null,tests:[test],fin:null,
  launchOptions:{showCorrectionsDuringParcours:false}}};
const ok={ok:true};
ipcMain.on('app:edition-sync',e=>e.returnValue={edition:'unified',canBilan:true,canAi:false,canImport:true,canExport:true});
ipcMain.on('state:load-sync',e=>e.returnValue={version:1,sessionStorage:{},localStorage:{},lastPage:'kaltest-pilot2.html'});
ipcMain.on('state:save-sync',e=>e.returnValue=ok);
for(const channel of ['candidate-catalog:workspace-load-sync','candidate-catalog:results-workspace-load-sync'])
  ipcMain.on(channel,e=>e.returnValue={ok:false});
ipcMain.on('candidate-catalog:workspace-save-sync',e=>e.returnValue=ok);
ipcMain.on('kaloneo-library:selected-runtime-sync',e=>e.returnValue=runtime);
ipcMain.handle('kaloneo-library:selected-runtime',()=>runtime);
ipcMain.handle('kaloneo-builder:close-preview',()=>true);
for(const channel of ['admin:status','admin:verify','admin:lock'])
  ipcMain.handle(channel,()=>true);
for(const channel of ['candidate:active','candidate-catalog:list','candidate-catalog:detail','replay:list','bilan-history:list'])
  ipcMain.handle(channel,()=>null);
for(const channel of ['state:save','replay:capture-page','candidate-catalog:workspace-save','candidate-catalog:end-bilan'])
  ipcMain.handle(channel,()=>ok);
ipcMain.handle('ai:status',()=>({available:false}));
ipcMain.handle('ai:cancel-current',()=>ok);
ipcMain.handle('kaloneo-library:get-mask-screen',()=>({ok:false}));
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const timeout=setTimeout(()=>{console.error('GENRE_BANNER_ELECTRON:TIMEOUT');app.exit(2)},70000);
const fail=error=>{console.error('GENRE_BANNER_ELECTRON:FAIL',error?.stack||String(error));app.exit(2)};
async function candidate(win,w,h){
  win.setSize(w,h);
  await win.loadFile(path.join(web,'kaltest-pilot2.html'),{query:{kaloneoPreview:'1'}});
  await pause(900);
  const data=await win.webContents.executeJavaScript(`(()=>{
   const host=document.getElementById('kaltest-content');
   const cards=[...document.querySelectorAll('.kaltest-two-tables .kaltest-table-card')];
   const table=document.querySelector('.kaltest-two-tables');
   const extras=document.querySelector('#kaltest-content>.kaltest-legacy-extras');
   const banner=extras?.querySelector('img');
   const tablesRect=table?.getBoundingClientRect(),imageRect=banner?.getBoundingClientRect();
   return {
    testId:document.body.dataset.sebKaltestId,
    tables:cards.length,
    answers:document.querySelectorAll('.kaltest-grammar-table input').length,
    backgrounds:cards.map(card=>getComputedStyle(card).backgroundColor),
    imageExists:!!banner,imageReady:!!(banner?.complete&&banner.naturalWidth>0),
    imageSrc:banner?.getAttribute('src')||'',
    fullWidth:!!(tablesRect&&imageRect&&imageRect.width>=tablesRect.width*.80),
    below:!!(tablesRect&&imageRect&&imageRect.top>=tablesRect.bottom-2),
    imageHeight:imageRect?.height||0,
    scrollOverflow:host?.scrollWidth>host?.clientWidth+3,
    title:document.getElementById('kaltest-test-title-text')?.textContent||''
   };
  })()`,true);
  assert.equal(data.testId,'genre_nombre',JSON.stringify(data));
  assert.equal(data.tables,2,JSON.stringify(data));
  assert.equal(data.answers,20,'Les 20 saisies historiques doivent etre presentes');
  assert.deepEqual(data.backgrounds,['rgb(234, 245, 251)','rgb(234, 245, 251)']);
  assert(data.imageReady,'PNG du bandeau absent ou non charge '+JSON.stringify(data));
  assert(!data.imageSrc.startsWith('data:'),'Image base64 mal optimisee');
  assert(data.imageSrc.includes('genre_et_nombre_V1.png'));
  assert(data.fullWidth,'L image ne remplit pas la largeur du bandeau '+JSON.stringify(data));
  assert(data.below,'Le bandeau n est pas sous les tableaux '+JSON.stringify(data));
  assert(!data.scrollOverflow,'Debordement horizontal du tableau ou du bandeau '+JSON.stringify(data));
  console.log('GENRE_BANNER_ELECTRON_'+w+'x'+h+'=OK');
}
async function menu(win,w,h){
  win.setSize(w,h);
  await win.loadFile(path.join(web,'admin-tests-parcours.html'));
  await pause(180);
  const data=await win.webContents.executeJavaScript(`(()=>{
    return [...document.querySelectorAll('.action-card')].map(card=>{
      const p=card.querySelector('p'),style=getComputedStyle(p);
      return {text:p.textContent,whiteSpace:style.whiteSpace,
        overflow:p.scrollWidth>p.clientWidth+1,
        lines:p.getBoundingClientRect().height/parseFloat(style.lineHeight||'1')};
    });
  })()`,true);
  assert.equal(data.length,4);
  assert.equal(data[1].text,'Créer les écrans ouverts par « Afficher l’écran d’accueil ».');
  assert.equal(data[2].text,'Assembler les tests, choisir l’introduction et la page de fin.');
  assert.equal(data[3].text,'Transférer proprement des tests ou des parcours KALONÉO.');
  assert(data.slice(1).every(x=>x.whiteSpace==='nowrap'&&!x.overflow),
    'Les trois descriptions doivent tenir sur une ligne '+JSON.stringify(data));
  console.log('TESTS_PARCOURS_ONE_LINE_'+w+'x'+h+'=OK');
}
app.whenReady().then(async()=>{
 let win;
 try{
   win=new BrowserWindow({show:false,width:1366,height:768,webPreferences:{
      preload:path.join(root,'src','preload.js'),nodeIntegration:false,contextIsolation:true,sandbox:false}});
   for(const [w,h] of [[1366,768],[1200,800]]) {
     await candidate(win,w,h);
     await menu(win,w,h);
   }
   clearTimeout(timeout);win.destroy();app.quit();
 }catch(error){fail(error)}
}).catch(fail);
