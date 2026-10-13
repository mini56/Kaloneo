'use strict';
// Contrôle Electron d'un test KALTEST inédit : HTML simple et HTML/JS.
// Ce scénario ne référence aucun identifiant du catalogue ni aucune V1 validée.
const {app,BrowserWindow,ipcMain}=require('electron');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const web=path.join(root,'app','web');

// Seul le contrat KALTEST de la fixture R48 sert de squelette ; toutes les
// questions et tous les blocs sont remplacés par une définition fictive.
const definition=JSON.parse(fs.readFileSync(
  path.join(root,'r48-demo','planning-restaurant-builder-r48.json'),'utf8'));
definition.id='synthetic_htmljs_shared_engine_2026';
definition.title='Exercice fictif : HTML et JavaScript';
definition.version='0.0.1';
definition.description='Smoke Electron de la présentation commune';
definition.scenario='Observer les deux colonnes';
definition.instruction='Contrôler le HTML simple et le script associé';
definition.scored=false;
definition.questions=[];
definition.outputs=[];
definition.bilanContributions=[];
definition.features=['runtime.basic','layout.split','content.html-js'];
definition.behavior={validateBeforeAdvance:false};
definition.presentation={layout:'50-50',builderContent:[
  {type:'html',zone:'left',
   html:'<p id="synthetic-static">Contenu HTML inédit</p><script>window.addEventListener("message",function(e){if(e.data==="kaloneo-synthetic-ping")window.parent.postMessage({marker:"kaloneo-synthetic-html",from:"plain"},"*");});</script>'},
  {type:'html-js',zone:'right',
   html:'<p id="synthetic-script">Bloc script inédit</p>',
   script:"document.getElementById(\"synthetic-script\").dataset.executed=\"oui\";window.addEventListener(\"message\",function(e){if(e.data===\"kaloneo-synthetic-ping\")window.parent.postMessage({marker:\"kaloneo-synthetic-html\",from:\"html-js\",executed:document.getElementById(\"synthetic-script\").dataset.executed},\"*\");});"}
]};
const runtime={ok:true,runtime:{
  id:'synthetic-html-engine-preview',title:'Contrôle générique',builderPreview:true,
  launchOptions:{showCorrectionsDuringParcours:false},
  introduction:null,tests:[definition],fin:null
}};
let saves=0,replays=0;
const ok={ok:true};
ipcMain.on('app:edition-sync',e=>e.returnValue={edition:'unified',canBilan:true,canAi:true,canImport:true,canExport:true});
ipcMain.on('state:load-sync',e=>e.returnValue={version:1,sessionStorage:{},localStorage:{},lastPage:'kaltest-pilot2.html'});
ipcMain.on('state:save-sync',e=>{saves++;e.returnValue=ok;});
ipcMain.on('candidate-catalog:workspace-load-sync',e=>e.returnValue={ok:false});
ipcMain.on('candidate-catalog:workspace-save-sync',e=>e.returnValue=ok);
ipcMain.on('candidate-catalog:results-workspace-load-sync',e=>e.returnValue={ok:false});
ipcMain.on('kaloneo-library:selected-runtime-sync',e=>e.returnValue=runtime);
ipcMain.handle('kaloneo-library:selected-runtime',()=>runtime);
ipcMain.handle('kaloneo-builder:close-preview',()=>ok);
ipcMain.handle('admin:status',()=>true);
ipcMain.handle('admin:verify',()=>true);
ipcMain.handle('admin:lock',()=>true);
ipcMain.handle('candidate:active',()=>null);
ipcMain.handle('state:save',()=>{saves++;return ok;});
ipcMain.handle('replay:capture-page',()=>{replays++;return ok;});
ipcMain.handle('replay:list',()=>[]);
ipcMain.handle('bilan-history:list',()=>[]);
ipcMain.handle('candidate-catalog:list',()=>[]);
ipcMain.handle('candidate-catalog:sync',()=>ok);
ipcMain.handle('candidate-catalog:detail',()=>({ok:false}));
ipcMain.handle('candidate-catalog:workspace-save',()=>ok);
ipcMain.handle('candidate-catalog:end-bilan',()=>ok);
ipcMain.handle('ai:status',()=>({available:false}));
ipcMain.handle('ai:cancel-current',()=>ok);
ipcMain.handle('kaloneo-library:get-mask-screen',()=>({ok:false}));
ipcMain.handle('kaloneo-library:list-tests',()=>({ok:true,tests:[]}));
ipcMain.handle('kaloneo-library:list-mask-screens',()=>({ok:true,maskScreens:[]}));

const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const timeout=setTimeout(()=>{console.error('SYNTHETIC_HTML_JS_ELECTRON: TIMEOUT');app.exit(2);},90000);
function fail(error){console.error('SYNTHETIC_HTML_JS_ELECTRON: FAIL',error?.stack||String(error));app.exit(2);}
app.whenReady().then(async()=>{
 try{
  const win=new BrowserWindow({show:true,width:1366,height:768,
    webPreferences:{preload:path.join(root,'src','preload.js'),
      nodeIntegration:false,contextIsolation:true,sandbox:false}});
  win.webContents.on('preload-error',(_e,p,error)=>fail(new Error('Preload '+p+': '+error)));
  await win.loadFile(path.join(web,'kaltest-pilot2.html'),{query:{kaloneoPreview:'1'}});
  await wait(1000);
  const page=await win.webContents.executeJavaScript(`(()=>{
    const frames=[...document.querySelectorAll("iframe.kaltest-builder-html")];
    return {
      testId:document.body.dataset.sebKaltestId,
      visible:document.getElementById("page-exercise")?.classList.contains("visible"),
      frames:frames.map(frame=>{
        const r=frame.getBoundingClientRect();
        return {sandbox:frame.getAttribute("sandbox"),srcdoc:frame.getAttribute("srcdoc"),
          width:r.width,height:r.height,left:r.left};
      })
    };
  })()`);
  assert.equal(page.testId,definition.id,'nouveau KALTEST non chargé');
  assert.equal(page.visible,true,'exercice non visible');
  assert.equal(page.frames.length,2,'deux iframes attendues');
  assert.equal(page.frames[0].sandbox,'','HTML simple : scripts non autorisés');
  assert.equal(page.frames[1].sandbox,'allow-scripts','HTML/JS : scripts autorisés');
  assert.ok(page.frames.every(frame=>frame.width>100&&frame.height>20),'blocs visuellement absents');
  assert.ok(page.frames[1].left>page.frames[0].left+20,'colonnes inversées ou empilées');
  assert.ok(page.frames[0].srcdoc.includes('Contenu HTML inédit'));
  assert.ok(page.frames[1].srcdoc.includes('dataset.executed'));
  await wait(350);
  // Les iframes sandboxées n'autorisent pas l'injection de JS du test.
  // postMessage vérifie réellement le script exécuté, sans désactiver le sandbox.
  const messages=await win.webContents.executeJavaScript(
    'new Promise(resolve=>{'+
      'const messages=[];'+
      'window.addEventListener("message",event=>{if(event.data?.marker==="kaloneo-synthetic-html")messages.push(event.data);});'+
      'document.querySelectorAll("iframe.kaltest-builder-html").forEach(frame=>frame.contentWindow.postMessage("kaloneo-synthetic-ping","*"));'+
      'setTimeout(()=>resolve(messages),1200);'+
    '})');
  assert.ok(messages.some(value=>value.from==='html-js'&&value.executed==='oui'),
    'JavaScript HTML/JS non exécuté');
  assert.ok(!messages.some(value=>value.from==='plain'),
    'HTML simple a exécuté un script alors que son sandbox l’interdit');
  const picture=await win.webContents.capturePage();
  assert.ok(!picture.isEmpty(),'capture Electron vide');
  assert.equal(saves,0,'aperçu écrit dans les données candidat');
  assert.equal(replays,0,'aperçu ajoute un replay');
  console.log('SYNTHETIC_HTML_JS_ELECTRON: OK',JSON.stringify({
    id:definition.id,iframes:page.frames.map(({sandbox,width,left})=>({sandbox,width,left})),
    messages,screenshot:picture.getSize(),saves,replays
  }));
  clearTimeout(timeout);win.destroy();app.quit();
 }catch(error){fail(error);}
}).catch(fail);
