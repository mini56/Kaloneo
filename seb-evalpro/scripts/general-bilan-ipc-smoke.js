'use strict';
const fs=require('fs'),os=require('os'),path=require('path'),crypto=require('crypto');
const assert=require('node:assert/strict');
const register=require('../src/candidate-catalog-main');
const {codedFolderName}=require('../src/candidate-folder-utils');
const {readJsonFile,writeJsonFile,isEncryptedJsonFile,configureLocalKey,clearLocalKey}=require('../src/candidate-data-crypto');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'kaloneo-general-bilan-'));
configureLocalKey(crypto.randomBytes(32));
function stable(value){
 if(Array.isArray(value))return '['+value.map(stable).join(',')+']';
 if(value&&typeof value==='object')
  return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stable(value[k])).join(',')+'}';
 return JSON.stringify(value);
}
const write=(p,v)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(v),'utf8')};
function fixture(id,date,title,tests,overrides={}) {
 const c={nom:'TEST',prenom:'SOPHIE',naissance:'1990-01-01',personIdentifier:'7654321',date,parcours:title,lieu:'Lorient',groupe:'1',...overrides};
 const directory=path.join(root,'Candidats',codedFolderName(id));
 const metadata=Object.entries(tests).map(([k,v])=>({id:k,title:v.title||k,category:v.category||'mathematiques',adminModified:true,bilanContributions:[{lineId:'bilan.savoirs_fondamentaux.mathematiques.comprendre_enonce_consigne',bindings:{score:'score',score_max:'score_max'}}]}));
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
  // Une autre personne utilise délibérément le MÊME identifiant de test.
  // Ses résultats et ses deux bilans ne doivent jamais polluer ceux de Sophie.
  fixture('eval-charlie','2026-09-03','Transport',{calculs:{title:'Calculs',score:1,max:10}},
    {nom:'MARTIN',prenom:'JULES',naissance:'1992-07-12'});
  fixture('eval-delta','2026-09-04','Commerce',{calculs:{title:'Calculs',score:2,max:10}},
    {nom:'MARTIN',prenom:'JULES',naissance:'1992-07-12'});
  let adminUnlocked=true;
  const handlers=new Map();
  const ipcMain={handle:(name,fn)=>handlers.set(name,fn),on:()=>{}};
  const app={getPath(name){return name==='temp'?path.join(root,'temp'):name==='userData'?path.join(root,'userData'):path.join(root,'Documents')}};
  register({app,ipcMain,getAdminUnlocked:()=>adminUnlocked,getAdminDocumentPassword:()=> 'AdminTest2026!',
    getActiveCandidate:()=>null,dataRoot:root});
  const handler=(name,...args)=>handlers.get(name)(null,...args);
  const persons=handler('candidate-catalog:list-persons');
  assert.equal(persons.length,2,'Même N° ID réutilisé : 2 personnes distinctes attendues.');
  const sophie=persons.find(p=>p.nom==='TEST'&&p.prenom==='SOPHIE');
  const jules=persons.find(p=>p.nom==='MARTIN'&&p.prenom==='JULES');
  assert(sophie&&jules,'Personnes distinctes introuvables.');
  assert.equal(sophie.evaluationCount,2);
  assert.equal(jules.evaluationCount,2);
  assert(persons.every(p=>!p.identifierCollision),
    'Un identifiant à 7 caractères réutilisé entre noms différents ne doit pas bloquer les bilans.');
  const personId=sophie.personId;
  const other=handler('candidate-catalog:general-bilan',jules.personId);
  assert(other.ok,other.error);
  assert.equal(other.general.evaluationCount,2);
  const otherCalculs=other.general.categories.flatMap(c=>c.tests||[]).find(t=>t.id==='calculs');
  assert(otherCalculs && otherCalculs.points===3 && otherCalculs.possible===20,
    'Bilans de Jules isolés : 1+2/20, sans les 14 points de Sophie.');
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
  const sourcesBefore=fs.readFileSync(path.join(f1.directory,'bilan','historique','BILAN_eval-alpha.json'));
  const generated=handler('candidate-catalog:generate-general-synthesis',personId,loaded.general.sourceDigest);
  assert(generated.ok,generated.error);
  assert(/différents parcours/.test(generated.text));
  assert(/mathématiques/.test(generated.text));
  assert(!/messagerie|briques|fabrication/i.test(generated.text),'Synthèse limitée aux compétences évaluées.');
  assert(!fs.existsSync(path.join(root,'BilansGeneraux',personId,'bilan-general.json')),'Générer ne doit pas enregistrer sans action de l’administrateur.');
  assert(fs.readFileSync(path.join(f1.directory,'bilan','historique','BILAN_eval-alpha.json')).equals(sourcesBefore),'Le bilan de parcours source ne doit pas être modifié.');
  adminUnlocked=false;
  assert.equal(handler('candidate-catalog:generate-general-synthesis',personId,loaded.general.sourceDigest).ok,false);
  adminUnlocked=true;
  const summary=generated.text+'\n\nComplément rédigé par l’administrateur.';
  const saved=handler('candidate-catalog:save-general-bilan',personId,summary,loaded.general.sourceDigest);
  assert(saved.ok,saved.error);
  const generalDir=path.join(root,'BilansGeneraux',personId);
  const savedFile=fs.readFileSync(path.join(generalDir,'bilan-general.json'));
  assert(isEncryptedJsonFile(path.join(generalDir,'bilan-general.json')),'Synthese generale non chiffree.');
  assert.equal(readJsonFile(path.join(generalDir,'bilan-general.json')).summary,summary);
  const exported=await handler('candidate-catalog:export-general-bilan',personId,summary,loaded.general.sourceDigest);
  assert(exported.ok,exported.error);
  assert(fs.statSync(path.join(generalDir,'bilan-general.docx')).size>1000);
  assert(fs.statSync(path.join(generalDir,'bilan-general.sebword')).size>1000);
  const {decryptBilanDocxBuffer}=require('../src/bilan-docx-main');
  const {unzipSync}=require('fflate');
  const plainWord=await decryptBilanDocxBuffer(fs.readFileSync(path.join(generalDir,'bilan-general.docx')),'AdminTest2026!');
  const xml=Buffer.from(unzipSync(plainWord)['word/document.xml']).toString('utf8');
  assert(xml.includes('Cette synthèse croise les résultats'));
  assert(xml.includes('Complément rédigé par l’administrateur.'),'La synthèse éditée doit se retrouver dans le Word sécurisé.');
  const reopenedSummary=handler('candidate-catalog:general-bilan',personId);
  assert.equal(reopenedSummary.summary,summary,'Réouverture fidèle à la synthèse modifiée.');
  // La derniere sauvegarde de l'un des parcours rend le general obsolete.
  const statePath=path.join(f1.directory,'donnees','evaluation-state.json');
  const updated=readJsonFile(statePath);
  const state=JSON.parse(updated.sessionStorage.seb_kaltest_pilot2_state_v1);
  state.tests.calculs.result.score=9;
  updated.sessionStorage.seb_kaltest_pilot2_state_v1=JSON.stringify(state);
  writeJsonFile(statePath,updated);
  const stale=handler('candidate-catalog:general-bilan',personId);
  assert(stale.ok&&stale.outdated,'Un changement de source doit invalider le general.');
  const refusedGeneration=handler('candidate-catalog:generate-general-synthesis',personId,loaded.general.sourceDigest);
  assert(!refusedGeneration.ok,'Une génération avec des sources périmées doit être refusée.');
  const refused=await handler('candidate-catalog:export-general-bilan',personId,summary,loaded.general.sourceDigest);
  assert(refused&&!refused.ok,'Ne pas exporter un Word sur des sources modifiees.');
  // Apres mise en corbeille et purge du dernier parcours, suppression de l'archive generale.
  assert(handler('candidate-catalog:delete-person',personId).ok);
  assert(handler('candidate-catalog:trash-empty').ok);
  assert(!fs.existsSync(generalDir),'Supprimer definitivement une personne efface son bilan general et le Word.');
  const remaining=handler('candidate-catalog:list-persons');
  assert.equal(remaining.length,1,'La suppression de Sophie ne supprime pas Jules même avec le même N° ID.');
  assert.equal(remaining[0].personId,jules.personId);
  const stillAvailable=handler('candidate-catalog:general-bilan',jules.personId);
  assert(stillAvailable.ok,'Le bilan général de Jules doit rester disponible.');
  console.log('KALONEO_GENERAL_BILAN_IPC=OK — N° ID partagé autorisé, 2x2 parcours isolés, chiffres, Word, stale, purge');
 }finally{fs.rmSync(root,{recursive:true,force:true});clearLocalKey()}
})().catch(e=>{console.error(e);process.exitCode=1});
