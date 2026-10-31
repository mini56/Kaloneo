'use strict';
// Non-regression de la separation des pages KALTEST et des commandes Admin.
// Ce script s'execute avec Node.js, sans creer de fenetre Windows.
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const {pathToFileURL}=require('node:url');
const {isTrustedAdminSender,isApprovedRendererNavigation}=require('../src/kaloneo-ipc-sender-guard');
const root=path.resolve(__dirname,'../app/web');
const frameFor=(page,query='')=>({url:pathToFileURL(path.join(root,page)).href+query});
const mainFrame=frameFor('admin-candidats.html');
const contents={mainFrame};
const win={webContents:contents,isDestroyed:()=>false};
const check=(page,options={})=>{
  const frame=frameFor(page,options.query||'');
  contents.mainFrame=frame;
  return isTrustedAdminSender({sender:options.sender||contents,senderFrame:options.frame||frame},{
    mainWindow:win,webRoot:root,adminUnlocked:options.unlocked!==false,
    adminResultsMode:options.results===true
  });
};
for(const page of ['admin-candidats.html','admin-bilan.html','admin-tests-parcours.html',
  'admin-parcours-builder.html','admin-mask-builder.html','admin-mask-preview.html',
  'kaloneo-builder/test-builder.html','kaloneo-builder/test-preview.html']){
  assert.equal(check(page),true,'Page Admin normale refusee : '+page);
}
for(const page of ['kaltest-pilot2.html','qcmv1.0.html','test-preview-malicious.html',
  'kaloneo-builder/evil.html']){
  assert.equal(check(page),false,'Page candidate ou non reconnue autorisee : '+page);
}
assert.equal(check('qcmv1.0.html',{results:true}),true,'Resultats Admin refuses');
assert.equal(check('admin-candidats.html',{query:'?candidateWelcome=1'}),false,
  'Accueil candidat ne doit pas obtenir les commandes Admin');
assert.equal(check('admin-candidats.html',{unlocked:false}),false,'Admin verrouille autorise');
assert.equal(check('admin-candidats.html',{sender:{mainFrame:{}}}),false,
  'Autre fenetre autorisee');
assert.equal(check('admin-candidats.html',{frame:frameFor('admin-candidats.html')}),false,
  'Iframe autorisee dans une page Admin');
const remoteFrame={url:'https://example.org/admin-candidats.html'};
contents.mainFrame=remoteFrame;
assert.equal(isTrustedAdminSender({sender:contents,senderFrame:remoteFrame},{
  mainWindow:win,webRoot:root,adminUnlocked:true
}),false,'Contenu web externe autorise');
const outside=frameFor('..'+path.sep+'private'+path.sep+'admin-candidats.html');
contents.mainFrame=outside;
assert.equal(isTrustedAdminSender({sender:contents,senderFrame:outside},{
  mainWindow:win,webRoot:root,adminUnlocked:true
}),false,'Fichier externe au programme autorise');

const to=(page,query='')=>pathToFileURL(path.join(root,page)).href+query;
const navigation=(from,toPage,options={})=>isApprovedRendererNavigation({
  fromUrl:to(from,options.fromQuery||''),
  toUrl:to(toPage,options.toQuery||''),
  webRoot:root,adminUnlocked:options.unlocked!==false,
  adminResultsMode:options.results===true
});
assert.equal(navigation('kaltest-pilot2.html','admin-bilan.html'),false,
  'Un test en aperçu peut ouvrir une page Admin');
assert.equal(navigation('qcmv1.0.html','kaloneo-builder/test-builder.html'),false,
  'Un parcours candidat peut ouvrir le Builder');
assert.equal(navigation('admin-candidats.html','kaloneo-builder/test-builder.html'),true,
  'Navigation du menu Admin vers le Builder bloquee');
assert.equal(navigation('admin-candidats.html','qcmv1.0.html'),true,
  'Navigation locale vers les tests bloquee');
assert.equal(navigation('qcmv1.0.html','admin-candidats.html',{results:true}),true,
  'Retour des Resultats Admin bloque');
assert.equal(navigation('admin-candidats.html','admin-tests-parcours.html',{unlocked:false}),false,
  'Ecran candidat peut acceder aux pages Admin');
assert.equal(navigation('admin-candidats.html','admin-tests-parcours.html',{fromQuery:'?candidateWelcome=1'}),false,
  'Accueil candidat accede au Builder');
assert.equal(navigation('kaltest-pilot2.html','admin-candidats.html',{toQuery:'?candidateWelcome=1'}),true,
  'Retour a l accueil candidat bloque');
assert.equal(isApprovedRendererNavigation({
  fromUrl:to('kaltest-pilot2.html'),toUrl:'https://example.org/',webRoot:root,
  adminUnlocked:true
}),false,'Une page web externe peut etre chargee');

const main=fs.readFileSync(path.join(__dirname,'../src/main.js'),'utf8');
assert(main.includes('isApprovedRendererNavigation({'),
  'La navigation non autorisee vers les pages Admin n est pas bloquee');
const catalog=fs.readFileSync(path.join(__dirname,'../src/candidate-catalog-main.js'),'utf8');
for(const [source,channels] of [
  [main,['kaloneo-library:save-test','kaloneo-library:delete-test',
    'kaloneo-library:save-image','kaloneo-library:save-parcours',
    'kaloneo-transfer:import-test','kaloneo-transfer:import-parcours',
    'admin:export-candidates','admin:import-candidates','admin:export-bilan-docx']],
  [catalog,['candidate-catalog:trash-empty','candidate-catalog:delete-person',
    'candidate-catalog:save-general-bilan','candidate-catalog:workspace-save',
    'candidate-catalog:open-export']]
]){
  for(const channel of channels){
    const start=source.indexOf("ipcMain.handle('"+channel+"'");
    assert(start>=0,'Commande manquante : '+channel);
    const snippet=source.slice(start,start+800);
    assert(snippet.includes('isTrustedAdminIpcSender('),
      'Aucun controle de la page appelante sur '+channel);
  }
}
const replay=fs.readFileSync(path.join(__dirname,'../src/replay-main.js'),'utf8');
const history=fs.readFileSync(path.join(__dirname,'../src/bilan-history-main.js'),'utf8');
const session=fs.readFileSync(path.join(__dirname,'../src/session-close.js'),'utf8');
for(const [source,channels] of [
  [replay,['admin:load-candidate-parcours','admin:get-candidate-parcours-slide',
    'admin:list-parcours','admin:load-parcours']],
  [history,['bilan-history:save-current','bilan-history:load','bilan-history:save-revision']],
  [session,['admin:quit-application','admin:close-session']]
]){
  for(const channel of channels){
    const start=source.indexOf("ipcMain.handle('"+channel+"'");
    assert(start>=0,'Commande sensible absente : '+channel);
    assert(source.slice(start,start+450).includes('isTrustedAdminIpcSender('),
      'Commande Admin sans validation du demandeur : '+channel);
  }
}
for(const mod of ["./replay-main","./bilan-history-main","./candidate-catalog-main","./session-close"]){
  const i=main.indexOf("require('"+mod+"')");
  assert(i>=0&&main.slice(i,i+700).includes('isTrustedAdminIpcSender,'),
    'IPC du module non protege en production : '+mod);
}

console.log('KALONEO_ELECTRON_IPC_SECURITY=SUCCESS ; fenetres Admin, iframe et candidat separes');
