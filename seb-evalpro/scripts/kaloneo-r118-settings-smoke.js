'use strict';
const fs=require('fs');
const path=require('path');
const os=require('os');
const crypto=require('crypto');
const assert=require('assert');
const {createPasswordStore}=require('../src/kaloneo-passwords');
const repo=path.resolve(__dirname,'../..');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(p,'utf8');
const expectedDigest=password=>crypto.createHash('sha256').update(password.trim().toUpperCase()).digest('hex');
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'kaloneo-r118-settings-'));
try {
  const options={directory,adminHash:expectedDigest('AncienAdmin'),developerHash:expectedDigest('AncienDev')};
  const store=createPasswordStore(options);
  assert(store.verify('admin','ancienadmin'));
  assert(store.verify('developer','ANCiENdev'));
  assert(!store.verify('admin','bad'));
  assert(!store.change('admin','bad','NouveauAdminSecure').ok);
  assert(!store.change('admin','AncienAdmin','abc').ok);
  assert(store.change('admin','AncienAdmin','NouveauAdminSecure').ok);
  const fresh=createPasswordStore(options);
  assert(fresh.verify('admin','nouveauadminsecure'));
  assert(!fresh.verify('admin','AncienAdmin'));
  assert(fresh.verify('developer','AncienDev'),'le mot de passe développeur est indépendant');
  assert(fresh.change('developer','AncienDev','NouveauDeveloppeur').ok);
  const stored=read(path.join(directory,'kaloneo-access-settings.json'));
  assert(!stored.includes('NouveauAdminSecure')&&!stored.includes('NouveauDeveloppeur'),'ne jamais stocker en clair');
  assert(JSON.parse(stored).roles.admin.algorithm==='scrypt');
  const builder=read(path.join(repo,'kaloneo','test-builder.js'));
  assert(builder.includes("questionColumn.className='question-editor-column'"));
  assert(builder.includes('questionColumn.appendChild(createTextFormatToolbar('));
  const css=read(path.join(repo,'kaloneo','test-builder.css'));
  assert(css.includes('.question-editor-column>.inline-text-format-toolbar'));
  const preload=read(path.join(root,'src','preload.js'));
  assert(preload.includes('installAdminSettings('));
  assert(preload.includes('id="seb-evalpro-settings" type="button" hidden'));
  assert(preload.includes('settingsButton.hidden = !adminUnlocked'));
  assert(preload.includes('const APP_RELEASE_VERSION = ') && preload.includes('APP_BUILD_NUMBER'), 'Version Admin issue du numéro unique');
  const settings=read(path.join(root,'src','kaloneo-admin-settings.js'));
  const menu=['data-tab="about"','data-tab="admin"','data-tab="builder"','data-tab="passwords"'];
  const positions=menu.map(tab=>settings.indexOf(tab));
  assert(positions.every(position=>position>=0),'Les quatre boutons de Réglages doivent être présents');
  assert(positions.every((position,index)=>index===0||position>positions[index-1]),
    'Ordre des réglages : À propos, Aide programme, Aide Builder, Mots de passe');
  assert(settings.includes('data-tab="about" aria-selected="true"'),
    'À propos est le bouton actif au premier affichage');
  assert(settings.includes('data-section="passwords" hidden'),
    'Ne pas afficher la modification de mot de passe par défaut');
  assert(settings.includes('data-section="about"><div class="settings-intro"'),
    'À propos doit être visible dès l’ouverture');
  assert(settings.includes("selectTab('about');"),
    'L’ouverture des Réglages doit sélectionner À propos');
  const main=read(path.join(root,'src','main.js'));
  assert(main.includes("kaloneo-settings:change-password"));
  assert(main.includes("getCandidateStore().getActiveCandidate()"));
  const manual=read(path.join(repo,'kaloneo','admin-help','index.html'));
  assert((manual.match(/<article /g)||[]).length>=10,'première version du manuel Admin');
  assert(fs.existsSync(path.join(repo,'kaloneo','admin-help','help.js')));
  const p=require('../package.json');
  assert(Number.isInteger(p.sebBuildNumber)&&p.sebBuildNumber>=125,
    'Numéro de Build progressif obligatoire');
  assert(/^\d+\.\d+\.\d+$/.test(String(p.sebReleaseVersion)),
    'Version de distribution manquante');
  console.log('KALONEO_R118_SETTINGS=OK password persistence, legacy access, UI, help, version');
}finally{fs.rmSync(directory,{recursive:true,force:true});}
