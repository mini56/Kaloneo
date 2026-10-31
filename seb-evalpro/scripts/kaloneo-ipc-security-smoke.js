'use strict';
// Non-regression de la separation des pages KALTEST et des commandes Admin.
// Ce script s'execute avec Node.js, sans creer de fenetre Windows.
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const {pathToFileURL}=require('node:url');
const {isTrustedAdminSender}=require('../src/kaloneo-ipc-sender-guard');
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

const main=fs.readFileSync(path.join(__dirname,'../src/main.js'),'utf8');
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
console.log('KALONEO_ELECTRON_IPC_SECURITY=SUCCESS ; fenetres Admin, iframe et candidat separes');
