'use strict';
const {app,BrowserWindow,ipcMain}=require('electron');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const web=path.join(root,'app','web');
const base=JSON.parse(fs.readFileSync(path.join(root,'r48-demo','planning-restaurant-builder-r48.json'),'utf8'));
const data='data:image/svg+xml;base64,'+Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="#00678b"/></svg>').toString('base64');
const iconDefinition={...base,icon:{id:'mesures',label:'Mesures',data}};
let active=iconDefinition;
const asRuntime=()=>({ok:true,runtime:{id:'icon-preview-check',builderPreview:true,title:'Contrôle icône',launchOptions:{showCorrectionsDuringParcours:false},introduction:null,tests:[active],fin:null}});
const ok={ok:true};
ipcMain.on('app:edition-sync',e=>e.returnValue={edition:'unified',canBilan:true,canAi:true,canImport:true,canExport:true});
ipcMain.on('state:load-sync',e=>e.returnValue={version:1,sessionStorage:{},localStorage:{},lastPage:'kaltest-pilot2.html'});
ipcMain.on('state:save-sync',e=>e.returnValue=ok);
ipcMain.on('candidate-catalog:workspace-load-sync',e=>e.returnValue={ok:false});
ipcMain.on('candidate-catalog:workspace-save-sync',e=>e.returnValue=ok);
ipcMain.on('candidate-catalog:results-workspace-load-sync',e=>e.returnValue={ok:false});
ipcMain.on('kaloneo-library:selected-runtime-sync',e=>e.returnValue=asRuntime());
ipcMain.handle('kaloneo-library:selected-runtime',()=>asRuntime());
ipcMain.handle('kaloneo-builder:close-preview',()=>true);
for(const name of ['admin:status','admin:verify','admin:lock'])ipcMain.handle(name,()=>true);
for(const name of ['candidate:active','candidate-catalog:list','candidate-catalog:detail','replay:list','bilan-history:list'])ipcMain.handle(name,()=>null);
for(const name of ['state:save','replay:capture-page','candidate-catalog:workspace-save','candidate-catalog:end-bilan'])ipcMain.handle(name,()=>ok);
ipcMain.handle('ai:status',()=>({available:false}));
ipcMain.handle('ai:cancel-current',()=>ok);
ipcMain.handle('kaloneo-library:get-mask-screen',()=>({ok:false}));
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const timeout=setTimeout(()=>{console.error('KALONEO_CANDIDATE_ICON: TIMEOUT');app.exit(2);},60000);
const fail=e=>{console.error('KALONEO_CANDIDATE_ICON: FAIL',e?.stack||String(e));app.exit(2);};
app.whenReady().then(async()=>{
 let win;
 try {
  win=new BrowserWindow({show:true,width:1366,height:768,webPreferences:{preload:path.join(root,'src','preload.js'),nodeIntegration:false,contextIsolation:true,sandbox:false}});
  win.webContents.on('preload-error',(_e,p,err)=>fail(new Error('Preload '+p+': '+err)));
  const open=async()=>{
    await win.loadFile(path.join(web,'kaltest-pilot2.html'),{query:{kaloneoPreview:'1'}});
    await wait(950);
    return win.webContents.executeJavaScript(`(()=>{
      const icon=document.getElementById('kaltest-test-icon');
      const title=document.getElementById('kaltest-test-title-text');
      return {
       testId:document.body.dataset.sebKaltestId,
       iconExists:!!icon,
       iconHidden:icon?.hidden,
       iconSrc:icon?.getAttribute('src')||'',
       loaded:!!icon?.complete&&icon.naturalWidth>0,
       width:icon?.getBoundingClientRect().width||0,
       title:title?.textContent||''
      };
    })()`);
  };
  let seen=await open();
  assert.equal(seen.testId,base.id);
  assert.equal(seen.title,base.title);
  assert(seen.iconExists,'Balise icône absente');
  assert(!seen.iconHidden,'Icône choisie masquée');
  assert.equal(seen.iconSrc,data,'L’icône enregistrée n’est pas réutilisée');
  assert(seen.loaded,'Icône non chargée dans Electron');
  assert(seen.width>=25,'Icône trop petite dans l’en-tête');
  active={...base};
  let without=await open();
  // R164 : tous les tests possèdent une icône. La précédente icône
  // personnalisée ne doit pas fuiter lors du changement de test.
  assert.equal(without.iconHidden,false,'Icône de bibliothèque absente sur un test sans icône explicite');
  assert.match(without.iconSrc,/^kaloneo-builder\/icons-tests\/test_[a-z_]+\.png$/,'Icône de remplacement non issue de la bibliothèque commune');
  assert.notEqual(without.iconSrc,data,'L’icône personnalisée précédente persiste sur le test suivant');
  assert(without.loaded,'Icône de remplacement non chargée dans Electron');
  assert(without.width>=25,'Icône de remplacement trop petite dans l’en-tête');
  clearTimeout(timeout);
  console.log('KALONEO_CANDIDATE_ICON: OK (icône choisie + icône par défaut commune, aucune fuite entre tests)');
  win.destroy();app.quit();
 }catch(error){fail(error);}
}).catch(fail);
