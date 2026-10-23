const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const edition = read('src/edition.js');
const main = read('src/main.js');
const installer = read('build/installer.nsh');
const preload = read('src/preload.js');
const catalog = read('src/candidate-catalog-preload.js');

assert(edition.includes("edition: 'unified'"), 'Edition unifiée absente.');
for (const capability of ['canBilan: true','canAi: true','canImport: true','canExport: true','canCatalog: true','canReplay: true','canResults: true']) {
  assert(edition.includes(capability), 'Capacité unifiée absente: ' + capability);
}

assert(!main.includes("editionCapabilities.edition !== 'candidate'"), 'Le verrou candidat dépend encore de l’édition installée.');
assert(main.includes('if (TEMP_ALLOW_WINDOWS_RECOVERY)'), 'La porte de secours Windows temporaire doit rester explicite pendant les tests.');
assert(main.includes('le verrou dépend désormais du mode d\'exécution'), 'Marqueur du verrou par mode absent.');

for (const forbidden of ['Version Candidat','Version Administrateur','SebEditionCreate','SebEditionLeave']) {
  assert(!installer.includes(forbidden), 'Ancienne sélection d’édition encore présente: ' + forbidden);
}
// Nouveau Setup propre : unification interne, aucune migration des vieilles éditions.
assert(installer.includes('!macro customInstall'));
assert(!installer.includes('edition-admin.flag'));
assert(!installer.includes('edition-candidate.flag'));
assert(!installer.includes('DeleteRegValue HKCU "Software\\SEB EvalPro"'));
assert(installer.includes('StrCpy $INSTDIR "$LOCALAPPDATA\\Programs\\KALONEO"'));

assert(preload.includes("edition:'unified'"), 'Fallback preload non unifié.');
assert(catalog.includes("edition:'unified'"), 'Fallback catalogue non unifié.');

console.log('SEB_UNIFIED_SETUP_GUARD: OK');
