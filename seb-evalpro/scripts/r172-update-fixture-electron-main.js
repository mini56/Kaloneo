'use strict';
// R172: creation ET verification de vraies donnees candidates chiffrees avec
// Electron safeStorage/DPAPI sur le meme profil Windows que l'installateur.
const {app,safeStorage}=require('electron');
const path=require('path'),fs=require('fs'),crypto=require('crypto');
const {configureLocalKey,writeJsonFile,readJsonFile,encryptLocalFileBuffer}=require('../src/candidate-data-crypto');
const {createCandidateLocalProtection}=require('../src/candidate-local-protection');
const {createCandidateStore}=require('../src/candidate-store-main');
const mode=process.argv.includes('--seed')?'seed':process.argv.includes('--verify')?'verify':'';
if(!mode)throw Error('Utiliser --seed ou --verify');
const markerFile=process.env.KALONEO_R172_MANIFEST||path.join(process.env.RUNNER_TEMP||process.env.TEMP,'r172-profile-manifest.json');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const put=(p,v)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,v);};
function scan(root){
 const out={};
 function walk(dir){
  for(const e of fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
   const full=path.join(dir,e.name),relative=path.relative(root,full).split(path.sep).join('/');
   if(e.isDirectory())walk(full);
   if(e.isFile())out[relative]={size:fs.statSync(full).size,sha256:sha(fs.readFileSync(full))};
  }
 }
 walk(root);return out;
}
function state(name){
 const candidate={nom:'KALONEO-AUDIT-'+name,prenom:'Essai',ville:'Lorient',lieu:'Lorient',groupe:'AUDIT-R172',date:'2026-10-25'};
 return {version:1,sessionStorage:{
   candidat_data:JSON.stringify(candidate),
   reponses_data:JSON.stringify({question1:'42',question2:'OK'}),
   scores_data:JSON.stringify({points:7,total:10})
 },localStorage:{},lastPage:'planning.html',lastEvaluationPage:'planning.html'};
}
app.whenReady().then(()=>{
 const root=path.join(app.getPath('appData'),'KALONEO'),storage=path.join(root,'storage');
 const documents=path.join(root,'Documents'),protection=createCandidateLocalProtection({
   documentsPath:documents,userDataPath:root,dataRoot:storage,safeStorage
 });
 if(!safeStorage.isEncryptionAvailable())throw Error('DPAPI Windows indisponible');
 if(mode==='seed'){
  if(fs.existsSync(path.join(root,'storage','Candidats')))throw Error('Profil test non vierge: ne pas ecraser les donnees');
 }
 const key=protection.initializeKey();configureLocalKey(key);key.fill(0);
 const store=createCandidateStore({documentsPath:documents,userDataPath:root,dataRoot:storage});
 if(mode==='seed'){
  const first=state('TERMINE');
  const record=store.saveSnapshot(first);
  if(!record||!store.completeActiveCandidate(first,'audit-upgrade'))throw Error('Creation candidat termine impossible');
  writeJsonFile(path.join(record.candidateDir,'bilan','historique','bilan-courant.json'),{
   type:'SEB_EVALPRO_BILAN_ARCHIVE',candidateId:record.candidateId,document:{titre:'Bilan individuel',notes:'R172'},immutableRevision:false
  });
  put(path.join(record.candidateDir,'bilan','exports','Evaluation_CAND_AUDIT.sebword'),
    encryptLocalFileBuffer(Buffer.from('WORD-CONFIDENTIEL-DE-TEST')));
  put(path.join(record.candidateDir,'replay','capture-test.sebimg'),
    encryptLocalFileBuffer(Buffer.from('REPLAY-IMAGE-TEST')));
  const second=state('ENCOURS');
  if(!store.saveSnapshot(second)||!store.getActiveCandidate())throw Error('Candidat actif non sauve');
  writeJsonFile(path.join(root,'evaluation-state.json'),second);
  protection.backupState();
  writeJsonFile(path.join(storage,'BilansGeneraux','PERS-1234567890ABCDEF12345678','bilan-general.json'),
    {schemaVersion:1,personId:'PERS-1234567890ABCDEF12345678',summary:'Bilan général fictif',sourceDigest:'controle-R172'});
  const custom=path.join(storage,'KALONEO');
  put(path.join(custom,'Parcours','parcours-personnalise.json'),JSON.stringify({
   format:'kaloneo-parcours',schemaVersion:2,id:'parcours-personnalise',name:'Parcours personnalisé R172',tests:[{id:'audit',version:'1.0.0'}]
  }));
  put(path.join(custom,'Bibliotheque-tests','audit','1.0.0','test.json'),JSON.stringify({id:'audit',version:'1.0.0',name:'Test inédit R172',format:'kaloneo-test'}));
  put(path.join(custom,'Bibliotheque-images','image-audit','image.png'),Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3+joQAAAAASUVORK5CYII=','base64'));
  put(path.join(custom,'Ecrans-masquage','audit','1.0.0','mask.json'),JSON.stringify({
   format:'kaloneo-mask-screen',id:'audit',version:'1.0.0',name:'Masque personnel',content:{text:'Test R172'}
  }));
  put(path.join(documents,'KALONEO','export-bilan-temoin.docx'),Buffer.from('WORD-EXTERNE-DE-TEST'));
  const files=scan(root);
  if(Object.keys(files).length<20)throw Error('Jeu de données trop petit: '+Object.keys(files).length);
  put(markerFile,JSON.stringify({root,files,candidateCount:2,generatedAt:new Date().toISOString()},null,2));
  console.log('KALONEO_R172_SEED=OK; vrais modules candidature, chiffrement DPAPI, bilans, replay, parcours, bibliotheques; '+Object.keys(files).length+' fichiers');
 }else{
  const manifest=JSON.parse(fs.readFileSync(markerFile,'utf8'));
  if(manifest.root!==root)throw Error('Le profil Windows a change');
  for(const [file,expected] of Object.entries(manifest.files)){
   const full=path.join(root,...file.split('/'));
   if(!fs.existsSync(full))throw Error('Fichier disparu pendant la mise a jour: '+file);
   const actual=fs.readFileSync(full);
   if(actual.length!==expected.size||sha(actual)!==expected.sha256)throw Error('Fichier modifie pendant la mise a jour: '+file);
  }
  const candidateFiles=fs.readdirSync(path.join(storage,'Candidats'),{withFileTypes:true}).filter(x=>x.isDirectory());
  if(candidateFiles.length!==manifest.candidateCount)throw Error('Nombre de candidats modifie');
  const saved=readJsonFile(path.join(root,'evaluation-state.json'));
  if(!saved||!saved.sessionStorage||!saved.sessionStorage.candidat_data)throw Error('Evaluation en cours illisible');
  if(!store.getActiveCandidate())throw Error('Pointeur de reprise de parcours perdu');
  if(!readJsonFile(path.join(storage,'BilansGeneraux','PERS-1234567890ABCDEF12345678','bilan-general.json')))throw Error('Bilan general illisible');
  console.log('KALONEO_R172_DATA_PRESERVED=OK; '+Object.keys(manifest.files).length+' fichiers SHA256 identiques, 2 candidats, parcours actif et bilan général DPAPI déchiffrables');
 }
 app.exit(0);
}).catch(error=>{console.error(error.stack||error);app.exit(1)});
