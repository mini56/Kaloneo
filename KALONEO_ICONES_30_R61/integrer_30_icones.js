#!/usr/bin/env node
'use strict';
// Installer un lot de 30 icônes KALONÉO sans toucher aux tests.
// Depuis la racine du dépôt : node KALONEO_ICONES_30_R61/integrer_30_icones.js
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const assert=require('node:assert/strict');
const repo=process.cwd();
const bundle=__dirname;
const libFile=path.join(repo,'kaloneo','icon-library.js');
const builderFile=path.join(repo,'kaloneo','test-builder.js');
const data=JSON.parse(fs.readFileSync(path.join(bundle,'inventaire_30_icones.json'),'utf8'));
assert.equal(data.count,30);
assert.equal(data.items.length,30);
assert.equal(new Set(data.items.map(i=>i.id)).size,30);
const expected='  const api=Object.freeze({version:\'kaloneo-icons-v5-70\',count:icons.length,icons:Object.freeze(icons)});';
const revised='  const api=Object.freeze({version:\'kaloneo-icons-v6-100\',count:icons.length,icons:Object.freeze(icons)});';
let lib=fs.readFileSync(libFile,'utf8');
let builder=fs.readFileSync(builderFile,'utf8');
if(lib.includes(revised)) throw new Error('Bibliothèque déjà en version 100 : ne pas installer deux fois.');
assert.ok(lib.includes(expected),'La bibliothèque initiale n’est pas la version attendue (70). Arrêt sans changement.');
assert.equal((lib.match(/\"id\":\"[^\"]+\",\"label\":/g)||[]).length,70,'La bibliothèque ne contient pas les 70 icônes de référence');
assert.ok(builder.includes('window.KaloneoIconLibrary?.count!==70'),'Contrôle de taille du Builder introuvable');
const inserts=[];
for(const item of data.items){
  const source=path.join(bundle,item.original);
  const original=fs.readFileSync(source);
  const digest=crypto.createHash('sha256').update(original).digest('hex').toUpperCase();
  assert.equal(digest,item.sha256_original,'Original modifié : '+item.id);
  assert.ok(!lib.includes('"id":"'+item.id+'"'),'ID déjà présent : '+item.id);
  const miniature=fs.readFileSync(path.join(bundle,item.apercu));
  inserts.push({id:item.id,label:item.label,data:'data:image/png;base64,'+miniature.toString('base64')});
  const destination=path.join(repo,item.original);
  if(fs.existsSync(destination))throw new Error('Fichier original déjà présent. Arrêt : '+destination);
}
const addition='  // 30 icônes validées : aperçus 192 px. Originaux PNG HD séparés et inchangés.\n  icons.push(...'+JSON.stringify(inserts)+');\n';
lib=lib.replace(expected,addition+revised);
builder=builder.replace('window.KaloneoIconLibrary?.count!==70','window.KaloneoIconLibrary?.count!==100').replace('70 icônes attendues.','100 icônes attendues.');
// Tout vérifier avant le premier écrit, y compris la syntaxe JS.
new (require('node:vm').Script)(lib,{filename:'icon-library.js'});
new (require('node:vm').Script)(builder,{filename:'test-builder.js'});
const outFile=path.join(repo,'kaloneo','icons-tests');
fs.mkdirSync(outFile,{recursive:true});
for(const item of data.items)fs.copyFileSync(path.join(bundle,item.original),path.join(repo,item.original));
fs.writeFileSync(libFile,lib,'utf8');
fs.writeFileSync(builderFile,builder,'utf8');
fs.copyFileSync(path.join(bundle,'inventaire_30_icones.json'),path.join(outFile,'inventaire_30_icones.json'));
const api=require(libFile);
assert.equal(api.count,100);
assert.equal(new Set(api.icons.map(x=>x.id)).size,100);
console.log('KALONEO_ICONES_100: OK — 70 existantes préservées + 30 nouvelles intégrées.');
console.log('Originaux HD 1254 px, fichiers copiés sans réencodage.');
console.log('Seuls kaloneo/icon-library.js, kaloneo/test-builder.js et kaloneo/icons-tests/ sont modifiés.');
