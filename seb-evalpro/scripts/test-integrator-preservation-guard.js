'use strict';
// Invariant pérenne : garder les deux voies d'intégration de tests KALONÉO.
// Le pipeline historique reste disponible; l'extraction d'images a son
// prototype contrôlé, sans activer une migration non encore validée.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const source=read('scripts/kaloneo-testsv1.js');
const prepare=read('scripts/prepare-web.js');
const runtime=read('src/kaloneo-library-main.js');
const assets=read('src/kaloneo-v1-image-assets.js');
const proof=read('scripts/proof-tests-v1-external-images.js');
const pkg=JSON.parse(read('package.json'));
assert.match(source,/function writeOfficialSeedOverrides\s*\(/);
assert.match(source,/function loadOfficialOverrides\s*\(/);
assert.match(prepare,/writeOfficialSeedOverrides\s*\(/);
assert.match(runtime,/function getTest\s*\(/);
assert.match(runtime,/function saveTest\s*\(/);
assert.match(runtime,/function resolveParcoursRuntime\s*\(/);
assert.match(runtime,/function buildParcoursPackage\s*\(/);
assert.match(assets,/module\.exports\s*=\s*\{\s*extract,\s*hydrate/);
assert.match(proof,/extract\(original,assets\)/);
assert.match(proof,/hydrate\(moved\.definition,assets\)/);
assert(pkg.build.files.includes('src/**/*'),
  'La publication Electron doit embarquer les sources de l intégrateur image');
const five=['affiche_promotions_prix','calcul_arithmetique','organisation_demenagement','p','planning_cantine'];
for(const id of five){
  assert(fs.existsSync(path.resolve(root,'..','TESTS_V1',id+'-1.0.0-test.json')),
    'Le fichier TESTS_V1 original manque: '+id);
}
console.log('KALONEO_TEST_INTEGRATOR_PRESERVED=OK — import V1, bibliothèque KALTEST, extract/hydrate, cinq sources GitHub');
