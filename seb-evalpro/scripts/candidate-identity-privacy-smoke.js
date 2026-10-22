'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { candidatePersonIdentity, candidatePersonMatchKey } = require('../src/candidate-person-identity');
const { configureLocalKey, clearLocalKey, readJsonFile } = require('../src/candidate-data-crypto');
const registerCatalog = require('../src/candidate-catalog-main');
const { buildRichProfile } = require('../src/qwen-rich-synthesis');

const html = fs.readFileSync(path.join(__dirname, '../source/kaltest-pilot2.html'), 'utf8');
const runtime = fs.readFileSync(path.join(__dirname, '../source/js/kaltest-pilot2-runtime.js'), 'utf8');
assert(!/id="naissance"|name="naissance"/.test(html), 'Aucune saisie de naissance.');
assert.equal((html.match(/class="pilot2-identity-column"/g) || []).length, 2, 'Deux colonnes.');
assert.equal((html.match(/class="pilot2-field/g) || []).length, 8, 'Quatre champs par colonne.');
for (const value of ['M.', 'Mme', 'Autre']) assert(html.includes('name="civilite" value="' + value + '"'));
assert(runtime.includes("document.querySelector('input[name=\"civilite\"]:checked')"), 'Civilité enregistrée.');
assert(!runtime.includes("document.getElementById('naissance')"), 'Aucune validation de naissance.');
assert.equal(buildRichProfile({ candidate:{ civilite:'Autre',nom:'DUPONT',prenom:'Élodie' } }).civilite,'la personne');
assert.equal(buildRichProfile({ candidate:{ civilite:'Mme',nom:'DUPONT',prenom:'Élodie' } }).civilite,'Madame');
assert.equal(buildRichProfile({ candidate:{ civilite:'M.',nom:'DUPONT',prenom:'Élodie' } }).civilite,'Monsieur');

const legacy = {nom:'DUPONT',prenom:'Élodie',personIdentifier:'ABC1234',naissance:'1991-04-05',lieu:'Lorient',groupe:'A'};
const recent = {nom:'Dupont',prenom:'Elodie',personIdentifier:'ABC1234',lieu:'Vannes',groupe:'B',civilite:'Autre'};
const distinct = {nom:'MARTIN',prenom:'Elodie',personIdentifier:'ABC1234',lieu:'Vannes',groupe:'B'};
assert.equal(candidatePersonMatchKey(legacy),candidatePersonMatchKey(recent));
assert.notEqual(candidatePersonMatchKey(legacy),candidatePersonMatchKey(distinct));
assert.notEqual(candidatePersonIdentity(legacy).personId,candidatePersonIdentity(recent).personId,'Fixture avec deux identités historiques distinctes.');

const root=fs.mkdtempSync(path.join(os.tmpdir(),'kaloneo-id-r146-'));
configureLocalKey(crypto.randomBytes(32));
function write(filename,value){fs.mkdirSync(path.dirname(filename),{recursive:true});fs.writeFileSync(filename,JSON.stringify(value),'utf8');}
function fixture(id,candidate,date){
 const dir=path.join(root,'Candidats',id),person=candidatePersonIdentity(candidate,id);
 const fields={...candidate,date};
 write(path.join(dir,'manifest.json'),{candidateId:id,personId:person.personId,personIdentifier:person.personIdentifier,createdAt:date+'T12:00:00Z',status:'TERMINE',candidat:fields});
 write(path.join(dir,'donnees','candidat.json'),fields);
 write(path.join(dir,'donnees','evaluation-state.json'),{sessionStorage:{candidat_data:JSON.stringify(fields)}});
 return dir;
}
try {
 const legacyDir=fixture('legacy',legacy,'2026-01-01');
 const recentDir=fixture('recent',recent,'2026-10-22');
 const distinctDir=fixture('distinct',distinct,'2026-10-22');
 const oldId=candidatePersonIdentity(legacy).personId;
 const general=path.join(root,'BilansGeneraux',oldId);
 write(path.join(general,'bilan-general.json'),{summary:'Historique conservé'});
 const handlers=new Map();
 const app={getPath:key=>path.join(root,key)};
 registerCatalog({app,ipcMain:{handle:(name,fn)=>handlers.set(name,fn),on:()=>{}},
   getAdminUnlocked:()=>true,getAdminDocumentPassword:()=> 'Essai2026!',
   getActiveCandidate:()=>null,dataRoot:root});
 const call=(name,...args)=>handlers.get(name)(null,...args);
 const sync=call('candidate-catalog:sync');
 assert(sync.ok,JSON.stringify(sync));
 const persons=call('candidate-catalog:list-persons');
 assert.equal(persons.length,2,'Ancien + nouveau regroupés, autre personne distincte.');
 const group=persons.find(p=>p.personId===oldId);
 assert(group,'Groupe historique introuvable.');
 assert.equal(group.evaluationCount,2);
 assert(fs.existsSync(path.join(general,'bilan-general.json')),'Bilan général existant préservé.');
 assert.equal(readJsonFile(path.join(recentDir,'manifest.json')).personId,oldId);
 assert.equal(readJsonFile(path.join(recentDir,'donnees','candidat.json')).civilite,'Autre');
 assert(!('naissance' in readJsonFile(path.join(recentDir,'donnees','candidat.json'))));
 assert.equal(readJsonFile(path.join(legacyDir,'manifest.json')).personId,oldId);
 assert.notEqual(readJsonFile(path.join(distinctDir,'manifest.json')).personId,oldId);
 assert(persons.every(p=>!p.identifierCollision),
   'Même N° ID et noms distincts : chaque personne doit conserver son propre bilan général.');
 assert.equal(persons.find(p=>p.personId!==oldId).evaluationCount,1);
 // Collision RÉELLE : un même personId contient deux noms différents.
 // Elle doit rester bloquante malgré la réutilisation autorisée d'un N° ID.
 const foreignManifestPath=path.join(distinctDir,'manifest.json');
 const foreignManifest=readJsonFile(foreignManifestPath);
 foreignManifest.personId=oldId;
 write(foreignManifestPath,foreignManifest);
 const resync=call('candidate-catalog:sync');
 assert(resync.ok,JSON.stringify(resync));
 const mixed=call('candidate-catalog:list-persons').find(p=>p.personId===oldId);
 assert(mixed&&mixed.identifierCollision,
   'Deux identités différentes dans un même personId doivent être bloquées.');
 const refused=call('candidate-catalog:general-bilan',oldId);
 assert(!refused.ok && /identifian|identit/i.test(refused.error),
   'Ne jamais fusionner des bilans de personnes différentes.');
 console.log('KALONEO_R150_IDENTITE=OK — mêmes ID / autres noms autorisés, identité réellement mélangée bloquée.');
} finally {
 fs.rmSync(root,{recursive:true,force:true});
 clearLocalKey();
}
