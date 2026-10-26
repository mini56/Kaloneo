'use strict';
// Interdit qu'un setup soit publié avec une dépendance vers source/, absent de l'ASAR.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const library=path.join(root,'src','kaloneo-library-main.js');
const copy=path.join(root,'app','web','js','kaloneo-bilan-routing.js');
const source=fs.readFileSync(library,'utf8');
assert(fs.existsSync(copy),'Moteur institutionnel absent de app/web/js : ne pas fabriquer le Setup.');
assert(source.includes("const packagedBilanRouting=path.join(__dirname,'..','app','web','js','kaloneo-bilan-routing.js')"),
 'Le moteur de la bibliothèque doit charger sa copie comprise dans le setup Windows.');
assert(source.includes('fs.existsSync(packagedBilanRouting)'),'La bascule installateur/developpement est absente.');
assert(!source.includes("const bilanRouting = require('../source/js/kaloneo-bilan-routing');"),
 'Regression : require de source/ directement au chargement du processus principal.');
const actual=require(copy);
assert(typeof actual.validateTestLink==='function','Routage Builder introuvable dans le dossier réellement embarqué.');
const libraryApi=require('../src/kaloneo-library-main');
assert.equal(typeof libraryApi.createKaloneoLibrary,'function');
const config=fs.readFileSync(path.join(root,'build','kaloneo-r183-final-setup.yml'),'utf8');
assert(/files:\s*\n\s*- src\/\*\*\/\*\s*\n\s*- app\/\*\*\/\*/.test(config),
 'La config du Setup doit inclure la copie des scripts du bilan dans app/.');
assert(!/\n\s*- source\/\*\*\/\*/.test(config),
 'Ne pas ajouter la totalité des sources de développement dans le setup pour masquer la régression.');
console.log('KALONEO_SETUP_ROUTING=OK — dépendance disponible dans app.asar, initialisation Node validée');
