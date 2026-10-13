'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
// Exécuter le vrai handler IPC de main.js avec des moteurs Electron simulés
// sur des définitions inédites (ni ID ni V1 du catalogue utilisés).
const main=fs.readFileSync(path.join(__dirname,'..','src','main.js'),'utf8');
const start=main.indexOf("ipcMain.handle('kaloneo-builder:render-mini-preview',");
const stop=main.indexOf("\nipcMain.handle('kaloneo-builder:get-preview',",start);
assert(start>=0&&stop>start,'Handler de miniature introuvable.');
const handlerSource=main.slice(start,stop);
const harness=[
  'let adminSessionUnlocked=true;',
  'let kaloneoMiniPreviewJob=Promise.resolve();',
  'let kaloneoMiniPreviewWorker=null;',
  'let kaloneoMiniPreviewDefinition=null;',
  'const registry=new Map();',
  'const ipcMain={handle:(name,handler)=>registry.set(name,handler)};',
  'const mainWindow={webContents:{},isDestroyed:()=>false};',
  'const getCandidateStore=()=>({getActiveCandidate:()=>null});',
  'const getKaloneoMiniPreviewWorker=()=>{const w=makeWorker();kaloneoMiniPreviewWorker=w;return w;};',
  'const __dirname=directory;',
  handlerSource,
  'return {',
  '  invoke:(definition,sender=mainWindow.webContents)=>registry.get("kaloneo-builder:render-mini-preview")({sender},definition),',
  '  getCurrentWorker:()=>kaloneoMiniPreviewWorker,',
  '  getCurrentDefinition:()=>kaloneoMiniPreviewDefinition',
  '};'
].join('\n');
const build=new Function('path','directory','makeWorker',harness);
let working=0,maximum=0;
const workers=[];
const makeWorker=()=>{
  const ordinal=workers.length;
  let destroyed=false,started=false;
  const worker={
    getContentBounds:()=>({width:1366,height:768}),
    setContentSize:()=>{},
    isDestroyed:()=>destroyed,
    destroy:()=>{
      assert.equal(destroyed,false,'Double destruction du moteur de capture');
      destroyed=true;
      if(started)working--;
    },
    async loadFile(){
      assert(!destroyed);
      started=true;working++;maximum=Math.max(maximum,working);
      await new Promise(resolve=>setTimeout(resolve,12));
    },
    webContents:{
      setZoomFactor(){},
      async executeJavaScript(){
        if(ordinal===1)return {ready:false,width:1366,height:768};
        if(ordinal===2)throw new Error('Panne fictive de capture');
        return {ready:true,width:1366,height:768,overflowZones:0,
          tableHorizontalOverflow:false,brokenImages:[]};
      },
      async capturePage(){
        return {isEmpty:()=>false,getSize:()=>({width:1366,height:768}),
          resize:()=>({toDataURL:()=>('data:image/png;base64,illustration-future-'+ordinal)})};
      }
    }
  };
  workers.push(worker);
  return worker;
};
const engine=build(path,path.join(__dirname,'..','src'),makeWorker);
(async()=>{
  const fixtures=[0,1,2,3].map(i=>({
    id:'future-test-'+i,title:'Test inédit '+i,presentation:{layout:'50-50'}
  }));
  const results=await Promise.all(fixtures.map(def=>engine.invoke(def)));
  assert.equal(results.length,4);
  assert.equal(results[0].ok,true,'Premier rendu incorrect');
  assert.equal(results[1].ok,false,'Le résultat non prêt doit être refusé');
  assert.equal(results[2].ok,false,'L’erreur de capture doit être propagée');
  assert.equal(results[3].ok,true,'Le dernier rendu après deux erreurs doit réussir');
  assert.equal(workers.length,4,'Chaque capture recrée un worker propre');
  assert(workers.every(worker=>worker.isDestroyed()),'Worker Electron caché non fermé');
  assert.equal(maximum,1,'Des processus de capture se sont chevauchés');
  assert.equal(working,0,'Processus caché encore actif');
  assert.equal(engine.getCurrentWorker(),null,'Référence cachée conservée');
  assert.equal(engine.getCurrentDefinition(),null,'Définition de test conservée après capture');
  const rejected=await engine.invoke(fixtures[0],{});
  assert.equal(rejected.ok,false,'Un expéditeur externe ne doit pas produire de capture');
  assert.equal(workers.length,4,'Une capture non autorisée a créé un worker');
  console.log('KALONEO_GENERIC_MINI_PREVIEW_WORKER_LIFECYCLE=OK');
})().catch(error=>{console.error(error);process.exitCode=1;});
