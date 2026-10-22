'use strict';
const fs=require('fs'),os=require('os'),path=require('path'),crypto=require('crypto');
const assert=require('node:assert/strict');
const register=require('../src/candidate-catalog-main');
const {codedFolderName}=require('../src/candidate-folder-utils');
const {readJsonFile,isEncryptedLocalFileBuffer}=require('../src/candidate-data-crypto');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'kaloneo-general-bilan-'));
function stable(value){
 if(Array.isArray(value))return '['+value.map(stable).join(',')+']';
 if(value&&typeof value==='object')
  return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stable(value[k])).join(',')+'}';
 return JSON.stringify(value);
}
const write=(p,v)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(v),'utf8')};
function fixture(id,date,title,tests) {
 const c={nom:'TEST',prenom:'SOPHIE',naissance:'1990-01-01',personIdentifier:'7654321',date,parcours:title,lieu:'Lorient',groupe:'1'};
 const directory=path.join(root,'Candidats',codedFolderName(id));
 const metadata=Object.entries(tests).map(([k,v])=>({id:k,title:v.title||k,category:v.category||'mathematiques'}));
 const statuses=Object.fromEntries(Object.entries(tests).map(([k,v])=>[k,{status:'COMPLETED',result:{score:v.score,scoreMax:v.max}}]));
 const session={
  seb_kaloneo_results_manifest:JSON.stringify({tests:metadata}),
  seb_kaltest_pilot2_state_v1:JSON.stringify({tests:statuses})
 };
 write(path.join(directory,'manifest.json'),{schemaVersion:1,candidateId:id,status:'TERMINE',candidat:c});
 write(path.join(directory,'donnees','candidat.json'),c);
 write(path.join(directory,'donnees','evaluation-state.json'),{version:1,sessionStorage:session,localStorage:{}});
 write(path.join(directory,'resultats','scores.json'),{});
 const a={type:'SEB_EVALPRO_BILAN_ARCHIVE',schemaVersion:1,createdAt:date+'T12:00:00.000Z',
  candidateId:id,rootId:id,revision:0,immutableRevision:false,candidate:c,
  document:{title:'Bilan',summary:'Parcours '+title,rows:[{key:'math-enonce',kind:'item',level:'II',moduleText:'Mathématiques'}]}};
 a.integritySha256=crypto.createHash('sha256').update(stable(a)).digest('hex');
 write(path.join(directory,'bilan','historique','BILAN_'+id+'.json'),a);
 return {directory,candidate:c};
}
(async()=>{
 try{
  const f1=fixture('eval-alpha','2026-09-01','Logistique',{calculs:{title:'Calculs',score:6,max:10}});
  const f2=fixture('eval-beta','2026-09-02','Restauration',{
   calculs:{title:'Calculs',score:8,max:10},
   conversions:{title:'Conversions',score:6,max:10}
  });
  const handlers=new Map();
  const ipcMain={handle:(name,fn)=>handlers.set(name,fn),on:()=>{}};
  const app={getPath(name){return name==='temp'?path.join(root,'temp'):name==='userData'?path.join(root,'userData'):path.join(root,'Documents')}};
  register({app,ipcMain,getAdminUnlocked:()=>true,getAdminDocumentPassword:()=> 'AdminTest2026!',
    getActiveCandidate:()=>null,dataRoot:root});
  const handler=(name,...args)=>handlers.get(name)(null,...args);
  const persons=handler('candidate-catalog:list-persons');
  assert.equal(persons.length,1,'Deux parcours doivent etre regroupes en une personne.');
  assert.equal(persons[0].evaluationCount,2);
  const personId=persons[0].personId;
  const loaded=handler('candidate-catalog:general-bilan',personId);
  assert(loaded.ok,loaded.error);
  assert.equal(loaded.general.evaluationCount,2);
  const math=loaded.general.categories.find(c=>c.name==='Mathématiques');
  assert.equal(math.testCount,2);
  assert.equal(math.level,'II');
  assert.equal(math.percent,65);
  assert.equal(math.tests.find(t=>t.id==='calculs').points,14);
  assert.equal(math.tests.find(t=>t.id==='calculs').possible,20);
  assert.equal(math.tests.find(t=>t.id==='conversions').scoredPassages,1);
  assert.equal(loaded.general.notes.length,2,'Commentaires anciens consultables.');
  const summary='Synthese de trois paragraphes\nUne evaluation pluridisciplinaire.';
  const saved=handler('candidate-catalog:save-general-bilan',personId,summary,loaded.general.sourceDigest);
  assert(saved.ok,saved.error);
  const generalDir=path.join(root,'BilansGeneraux',personId);
  const savedFile=fs.readFileSync(path.join(generalDir,'bilan-general.json'));
  assert(isEncryptedLocalFileBuffer(savedFile),'Synthese generale non chiffree.');
  assert.equal(readJsonFile(path.join(generalDir,'bilan-general.json')).summary,summary);
  const exported=await handler('candidate-catalog:export-general-bilan',personId,summary,loaded.general.sourceDigest);
  assert(exported.ok,exported.error);
  assert(fs.statSync(path.join(generalDir,'bilan-general.docx')).size>1000);
  assert(fs.statSync(path.join(generalDir,'bilan-general.sebword')).size>1000);
  // La derniere sauvegarde de l'un des parcours rend le general obsolete.
  const statePath=path.join(f1.directory,'donnees','evaluation-state.json');
  const updated=JSON.parse(fs.readFileSync(statePath,'utf8'));
  const state=JSON.parse(updated.sessionStorage.seb_kaltest_pilot2_state_v1);
  state.tests.calculs.result.score=9;
  updated.sessionStorage.seb_kaltest_pilot2_state_v1=JSON.stringify(state);
  write(statePath,updated);
  const stale=handler('candidate-catalog:general-bilan',personId);
  assert(stale.ok&&stale.outdated,'Un changement de source doit invalider le general.');
  const refused=await handler('candidate-catalog:export-general-bilan',personId,summary,loaded.general.sourceDigest);
  assert(refused&&!refused.ok,'Ne pas exporter un Word sur des sources modifiees.');
  // Apres mise en corbeille et purge du dernier parcours, suppression de l'archive generale.
  assert(handler('candidate-catalog:delete-person',personId).ok);
  assert(handler('candidate-catalog:trash-empty').ok);
  assert(!fs.existsSync(generalDir),'Supprimer definitivement une personne efface son bilan general et le Word.');
  console.log('KALONEO_GENERAL_BILAN_IPC=OK — personne unique, sources chiffre, calcul, Word, stale, purge');
 }finally{fs.rmSync(root,{recursive:true,force:true})}
})().catch(e=>{console.error(e);process.exitCode=1});
