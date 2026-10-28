'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
// Fournir au handler extrait la même dépendance que main.js en production.
const {inspectCandidateOverflow}=require('../src/kaloneo-layout-diagnostics');
// Exécuter le vrai handler IPC de main.js avec des moteurs Electron simulés
// sur des définitions inédites (ni ID ni V1 du catalogue utilisés).
const main=fs.readFileSync(path.join(__dirname,'..','src','main.js'),'utf8');
const cancelStart=main.indexOf("ipcMain.handle('kaloneo-builder:cancel-mini-preview',");
const start=main.indexOf("ipcMain.handle('kaloneo-builder:render-mini-preview',");
assert(cancelStart>=0&&cancelStart<start,'Annulation de miniature R197 absente.');
const cancelSource=main.slice(cancelStart,start);
const stop=main.indexOf("\nipcMain.handle('kaloneo-builder:get-preview',",start);
assert(start>=0&&stop>start,'Handler de miniature introuvable.');
const handlerSource=main.slice(start,stop);
const workerDefinition=main.slice(main.indexOf('function getKaloneoMiniPreviewWorker()'),start);
assert(workerDefinition.includes('show:false, focusable:false'),
  'La fenêtre Electron invisible doit être non focusable sur Windows.');
const harness=[
  'let adminSessionUnlocked=true;',
  'let kaloneoMiniPreviewJob=Promise.resolve();',
  'let kaloneoMiniPreviewRequestSerial=0;',
  'let kaloneoMiniPreviewWorker=null;',
  'let kaloneoMiniPreviewDefinition=null;',
  'const registry=new Map();',
  'const ipcMain={handle:(name,handler)=>registry.set(name,handler)};',
  'const mainWindow={webContents:{},isDestroyed:()=>false};',
  'const getCandidateStore=()=>({getActiveCandidate:()=>null});',
  'const getKaloneoMiniPreviewWorker=()=>{const w=makeWorker();kaloneoMiniPreviewWorker=w;return w;};',
  'const __dirname=directory;',
  cancelSource,
  handlerSource,
  'return {',
  '  invoke:(definition,sender=mainWindow.webContents)=>registry.get("kaloneo-builder:render-mini-preview")({sender},definition),',
  '  cancel:(sender=mainWindow.webContents)=>registry.get("kaloneo-builder:cancel-mini-preview")({sender}),',
  '  getCurrentWorker:()=>kaloneoMiniPreviewWorker,',
  '  getCurrentDefinition:()=>kaloneoMiniPreviewDefinition',
  '};'
].join('\n');
const build=new Function('path','directory','makeWorker','inspectCandidateOverflow',harness);
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
const engine=build(path,path.join(__dirname,'..','src'),makeWorker,inspectCandidateOverflow);
(async()=>{
  const fixtures=[0,1,2,3].map(i=>({
    id:'future-test-'+i,title:'Test inédit '+i,presentation:{layout:'50-50'}
  }));
  // Vérifier d'abord chaque issue de manière déterministe, sans coalescence.
  const results=[];
  for(const definition of fixtures)results.push(await engine.invoke(definition));
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

  // Rafale de demandes : un seul ancien rendu peut être actif et seule la
  // dernière demande en attente est autorisée à créer un nouveau moteur.
  const burst=[4,5,6,7].map(i=>({
    id:'future-burst-'+i,title:'Modification inédite '+i,
    presentation:{layout:'60-40'}
  }));
  const alreadyRunning=engine.invoke(burst[0]);
  await new Promise(resolve=>setTimeout(resolve,2));
  const staleOne=engine.invoke(burst[1]);
  const staleTwo=engine.invoke(burst[2]);
  const latest=engine.invoke(burst[3]);
  const concurrent=await Promise.all([alreadyRunning,staleOne,staleTwo,latest]);
  assert.equal(concurrent[1].ok,false,'Ancienne capture en attente pas abandonnée');
  assert.equal(concurrent[2].ok,false,'Nouvelle capture obsolète pas abandonnée');
  assert.match(concurrent[1].error,/remplacée/);
  assert.match(concurrent[2].error,/remplacée/);
  assert.equal(concurrent[3].ok,true,'Dernier test créé non photographié');
  assert.equal(workers.length,6,'Deux captures obsolètes ont créé un Electron caché');
  assert(workers.every(worker=>worker.isDestroyed()));
  assert.equal(working,0);
  assert.equal(maximum,1);
  assert.equal(engine.getCurrentDefinition(),null);

  const rejected=await engine.invoke(fixtures[0],{});
  assert.equal(rejected.ok,false,'Un expéditeur externe ne doit pas produire de capture');
  assert.equal(workers.length,6,'Une capture non autorisée a créé un worker');

  // R197 : insertion d'un bloc pendant une vraie capture déjà en cours.
  const inFlight=engine.invoke({id:'new-block',title:'Insertion au bloc 9',
    presentation:{layout:'50-50'}});
  await new Promise(resolve=>setTimeout(resolve,2));
  assert.equal(workers.length,7,'Le worker concurrent doit avoir démarré');
  const deniedCancel=await engine.cancel({});
  assert.equal(deniedCancel.ok,false,'Un autre renderer ne peut annuler la capture');
  const canceled=await engine.cancel();
  assert.equal(canceled.ok,true,'Le Builder Admin doit pouvoir interrompre la capture');
  const canceledResult=await inFlight;
  assert.equal(canceledResult.ok,false,'La capture annulée ne doit pas être publiée');
  assert(workers[6].isDestroyed(),'Le worker déjà en cours doit être fermé avant le nouveau focus');
  assert.equal(working,0,'Aucune BrowserWindow cachée active après annulation');
  const resumed=await engine.invoke({id:'after-insertion',title:'Miniature après édition',
    presentation:{layout:'50-50'}});
  assert.equal(resumed.ok,true,'La miniature doit reprendre après édition');
  assert.equal(workers.length,8,'La nouvelle miniature doit utiliser un worker propre');
  assert.equal(engine.getCurrentDefinition(),null);
  console.log('KALONEO_R197_INSERT_CANCEL_RUNNING_MINI_PREVIEW=OK');
  console.log('KALONEO_GENERIC_MINI_PREVIEW_WORKER_LIFECYCLE=OK');
})().catch(error=>{console.error(error);process.exitCode=1;});
