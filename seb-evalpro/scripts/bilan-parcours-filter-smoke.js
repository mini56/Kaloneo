'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {OFFICIAL}=require('../src/institutional-bilan-grid');
const {projectDocument,validPair}=require('../src/bilan-parcours');
const {aggregateGeneralBilan,wordRows}=require('../src/general-bilan-aggregation');
const route=require('../source/js/kaloneo-bilan-routing');
const full=()=>({title:'Bilan',summary:'Synthèse conservée',rows:OFFICIAL.map(l=>l.kind==='section'
 ?{kind:'section',sectionText:l.label}:{kind:'item',key:l.key,level:'',moduleText:l.label,points:null,possible:null})});
const custom=(id,line='resoudre_problemes')=>({id,version:'1.0.0',category:'mathematiques',adminModified:true,
 bilanContributions:[{lineId:'bilan.savoirs_fondamentaux.mathematiques.'+line,bindings:{score:'score',score_max:'score_max'}}]});
const tests=[{id:'calculs_commandes_atelier',category:'mathematiques'},custom('conversions-futures'),custom('abandon-futur')];
const session={seb_kaloneo_results_manifest:JSON.stringify({tests}),seb_kaltest_pilot2_state_v1:JSON.stringify({tests:{
 calculs_commandes_atelier:{status:'COMPLETED',result:{score:2,scoreMax:3}},
 'conversions-futures':{status:'COMPLETED',result:{score:4,scoreMax:5}},
 'abandon-futur':{status:'ABANDONED',result:{score:999,scoreMax:999}},
 redaction_email:{status:'COMPLETED',result:{score:6,scoreMax:6}}
}})};
const keys=d=>d.rows.filter(r=>r.kind==='item').map(r=>r.key);
const projected=projectDocument(full(),session);
assert.deepEqual(keys(projected),['math-enonce','math-problemes']);
assert.equal(projected.rows.filter(r=>r.kind==='section').length,1);
assert.equal(projected.rows[0].sectionText,'Savoirs fondamentaux');
assert.equal(projected.summary,'Synthèse conservée');
assert.deepEqual(projected.rows.filter(r=>r.kind==='item').map(r=>[r.points,r.possible]),[[2,3],[4,5]],'Récupérer les points réels, jamais le pourcentage arrondi.');
assert.deepEqual([...route.selectedRows([custom('abandon-futur')])],['math-problemes']);
const abandonedOnly=projectDocument(full(),{...session,seb_kaloneo_results_manifest:JSON.stringify({tests:[custom('abandon-futur')]})});
assert.deepEqual(keys(abandonedOnly),['math-problemes'],'Un abandon conserve sa ligne officielle.');
assert(!validPair(abandonedOnly.rows.find(r=>r.kind==='item')),'Un abandon ne vaut pas zéro et ne reprend pas un score résiduel.');
// Nouveau Builder qui reprend un identifiant V1 : seule la liaison choisie compte.
assert.deepEqual([...route.selectedRows([{...custom('calculs_commandes_atelier')}])],['math-problemes']);
// Ancien manifeste sans liaisons : récupération sur la version exacte du catalogue.
const oldSession={...session,seb_kaloneo_results_manifest:JSON.stringify({tests:[{id:'conversions-futures',version:'1.0.0',category:'mathematiques'}]})};
assert.deepEqual(keys(projectDocument(full(),oldSession,[custom('conversions-futures')])),['math-problemes']);
const changedCatalog=[{...custom('conversions-futures'),bilanContributions:[]}];
assert.deepEqual(keys(projectDocument(projected,session,changedCatalog)),['math-enonce','math-problemes'],'Les liaisons figées dans le bilan font foi.');
const french={id:'genre_nombre',category:'francais'};
const secondSession={seb_kaloneo_results_manifest:JSON.stringify({tests:[french]}),seb_kaltest_pilot2_state_v1:JSON.stringify({tests:{genre_nombre:{status:'COMPLETED',result:{score:3,scoreMax:4}}}})};
const second=projectDocument(full(),secondSession);
const general=aggregateGeneralBilan([
 {candidateId:'math',session,archive:{document:full()}},
 {candidateId:'francais',session:secondSession,archive:{document:full()}}
]);
assert.deepEqual(general.institutionalRows.filter(r=>r.kind==='row').map(r=>r.key),['expression','math-enonce','math-problemes']);
assert.equal(general.institutionalRows.filter(r=>r.kind==='section').length,1);
assert.equal(general.institutionalWarnings.length,0);
assert.equal(general.institutionalRows.find(r=>r.key==='math-enonce').percent,66.67);
assert.equal(general.institutionalRows.find(r=>r.key==='math-problemes').percent,80);
assert.deepEqual(wordRows(general).filter(r=>r.type==='row').map(r=>r.key),['expression','math-enonce','math-problemes']);
const onlyAbandoned=aggregateGeneralBilan([{candidateId:'ab',session:{...session,seb_kaloneo_results_manifest:JSON.stringify({tests:[custom('abandon-futur')]})},archive:{document:full()}}]);
assert.equal(onlyAbandoned.institutionalRows.find(r=>r.key==='math-problemes').level,'NE');
assert.equal(onlyAbandoned.institutionalWarnings.length,0);
assert.equal(onlyAbandoned.testCount,0,'Un résultat résiduel abandonné ne doit pas être compté.');
const evaluatedAbandonSession={...session,seb_kaloneo_results_manifest:JSON.stringify({tests:[custom('abandon-futur')]}),
 seb_kaltest_pilot2_state_v1:JSON.stringify({tests:{'abandon-futur':{status:'ABANDONED_EVALUATED',result:{score:1,scoreMax:2}}}})};
const evaluatedAbandon=aggregateGeneralBilan([{candidateId:'ab-evaluated',session:evaluatedAbandonSession,archive:{document:full()}}]);
assert.equal(evaluatedAbandon.institutionalRows.find(r=>r.key==='math-problemes').percent,50,'Un abandon explicitement évalué conserve sa vraie note.');
assert.equal(evaluatedAbandon.testCount,1);
// Enregistrement/réouverture/réenregistrement via les vrais handlers chiffrés.
const {configureLocalKey,clearLocalKey,writeJsonFile,readJsonFile,isEncryptedJsonFile}=require('../src/candidate-data-crypto');
const {codedFolderName}=require('../src/candidate-folder-utils');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'kaloneo-bilan-parcours-'));
try{
 configureLocalKey(crypto.randomBytes(32));
 const id='eval-parcours-math',candidate={nom:'TEST',prenom:'PARCOURS',date:'2026-10-26'};
 const directory=path.join(root,'Candidats',codedFolderName(id));
 const write=(file,value)=>{fs.mkdirSync(path.dirname(file),{recursive:true});writeJsonFile(file,value)};
 write(path.join(directory,'manifest.json'),{candidateId:id,status:'TERMINE',candidat:candidate});
 write(path.join(directory,'donnees','candidat.json'),candidate);
 write(path.join(directory,'donnees','evaluation-state.json'),{sessionStorage:session});
 const handlers=new Map(),listeners=new Map();
 const app={getPath:()=>root};
 require('../src/bilan-history-main')({app,ipcMain:{handle:(k,f)=>handlers.set(k,f),on:(k,f)=>listeners.set(k,f)},getAdminUnlocked:()=>true,buildNumber:182,dataRoot:root});
 const call=(name,...args)=>handlers.get(name)(null,...args);
 const saved=call('bilan-history:save-current',{candidateId:id,candidate,document:full()});
 assert(saved.ok,saved.error);
 const loaded=call('bilan-history:load',saved.filename);
 assert(loaded.ok,loaded.error);
 assert.deepEqual(keys(loaded.archive.document),['math-enonce','math-problemes']);
 const beforeFile=path.join(directory,'bilan','historique',saved.filename);
 assert(isEncryptedJsonFile(beforeFile));
 const beforeBytes=fs.readFileSync(beforeFile);
 call('bilan-history:load',saved.filename);
 assert(fs.readFileSync(beforeFile).equals(beforeBytes),'Une lecture ne doit pas réécrire une archive.');
 const edited=JSON.parse(JSON.stringify(loaded.archive.document));edited.summary='Synthèse modifiée';
 const revision=call('bilan-history:save-revision',{sourceFilename:saved.filename,document:edited});
 assert(revision.ok,revision.error);
 const reopened=call('bilan-history:load',revision.filename);
 assert.deepEqual(reopened.archive.document.rows.filter(r=>r.kind==='item').map(r=>[r.points,r.possible]),[[2,3],[4,5]]);
 assert.equal(reopened.archive.document.summary,'Synthèse modifiée');
 assert.equal(fs.readdirSync(path.join(directory,'bilan','historique')).filter(x=>x.endsWith('.json')).length,1);
 // Simuler les anciens bilans contenant toute la grille et ayant perdu les points.
 const old=full();old.rows.find(r=>r.key==='math-enonce').level='II';old.rows.find(r=>r.key==='math-problemes').level='I';
 const restored=projectDocument(old,session);
 assert.deepEqual(restored.rows.filter(r=>r.kind==='item').map(r=>[r.points,r.possible]),[[2,3],[4,5]]);
}finally{clearLocalKey();fs.rmSync(root,{recursive:true,force:true})}
console.log('BILAN_PARCOURS_FILTER=OK — maths seules, abandons, Builder, anciennes archives, points exacts, réenregistrement chiffré et union du Word général');
