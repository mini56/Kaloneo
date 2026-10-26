'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createKaloneoLibrary } = require('../src/kaloneo-library-main');

const root = path.resolve(__dirname, '..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'seb-kaloneo-parcours-'));

const builderHtml = fs.readFileSync(path.join(root, 'overrides', 'admin-parcours-builder.html'), 'utf8');
const builderJs = fs.readFileSync(path.join(root, 'source', 'js', 'admin-parcours-builder.js'), 'utf8');
assert.ok(builderHtml.includes('id="back-tests-parcours"') && builderHtml.includes('>Fermer</button>'), 'le Builder de parcours doit afficher Fermer');
assert.ok(!builderHtml.includes('>← Tests / Parcours</button>'), 'ancien libellé ← Tests / Parcours encore présent');
assert.ok(builderJs.includes('function closeBuilder()'), 'fonction Fermer du Builder de parcours absente');
assert.ok(builderJs.includes('modifications non enregistrées'), 'protection des modifications non enregistrées absente');

try {
  const library = createKaloneoLibrary({
    dataRoot: temp,
    seedTestsRoot: path.join(root, 'source', 'kaltest', 'tests'),
    now: () => new Date('2026-10-05T12:00:00.000Z')
  });

  const tests = library.listTests();
  const intro = tests.filter(item => item.role === 'introduction');
  const normal = tests.filter(item => item.role === 'test');
  const fins = tests.filter(item => item.role === 'fin');

  assert.strictEqual(tests.length, 26, '26 éléments attendus dans la bibliothèque : 24 pages de test, une introduction et une fin, sans altérer le parcours de base.');
  assert.strictEqual(intro.length, 1, 'une introduction de base attendue');
  assert.strictEqual(normal.length, 24, '24 tests actuellement disponibles, dont Structure 3D en papier et les deux nouvelles grilles V1');
  assert.strictEqual(fins.length, 1, 'une page de fin attendue');
  const practical = normal.find(item => item.id === 'structure_3d_papier');
  assert.ok(practical, 'Structure 3D en papier absente de la bibliothèque');
  assert.strictEqual(practical.category, 'activite_pratique');
  assert.strictEqual(practical.activityType, 'practical');
  assert.strictEqual(practical.scored, false);

  assert.ok(fs.existsSync(path.join(temp, 'KALONEO', 'Bibliotheque-tests')), 'bibliothèque interne absente');
  assert.ok(fs.existsSync(path.join(temp, 'KALONEO', 'Parcours')), 'dossier interne Parcours absent');
  assert.ok(fs.existsSync(path.join(temp, 'KALONEO', 'Ecrans-masquage')), 'dossier interne Écrans de masquage absent');

  const masks = library.listMaskScreens();
  assert.ok(masks.some(item => item.id === 'kaloneo-default' && item.systemProvided), 'écran KALONÉO par défaut absent');

  const customMask = library.saveMaskScreen({
    id:'masque-smoke',
    version:'1.0.0',
    name:'Masque smoke',
    content:{text:'Écran de test',image:''}
  });
  assert.strictEqual(customMask.ok, true, customMask.error || 'écran de masquage refusé');

  const sourceDefinition = library.getTest(normal[0].id, normal[0].version);
  assert.strictEqual(sourceDefinition.ok, true, 'lecture d’un test source impossible');
  const generated = JSON.parse(JSON.stringify(sourceDefinition.definition));
  generated.id = 'test_genere_smoke';
  generated.version = '1.0.0';
  generated.title = 'Test généré smoke';
  generated.category='mathematiques';
  generated.pageRole='test';
  generated.scored=true;
  generated.outputs=[{id:'score',type:'number'},{id:'score_max',type:'number'}];
  generated.bilanContributions=[{lineId:'bilan.savoirs_fondamentaux.mathematiques.resoudre_problemes',
    bindings:{score:'score',score_max:'score_max'}}];
  const savedTest = library.saveTest(generated);
  assert.strictEqual(savedTest.ok, true, savedTest.error || 'nouveau test non enregistré');
  assert.ok(library.listTests().some(item => item.id === generated.id), 'nouveau test absent de la bibliothèque');
  const duplicateTestVersion = library.saveTest(generated);
  assert.strictEqual(duplicateTestVersion.ok, false, 'une version existante ne doit pas être remplacée silencieusement');
  assert.strictEqual(duplicateTestVersion.code, 'EXISTS');
  const overwrittenTest = library.saveTest(generated, {overwrite:true});
  assert.strictEqual(overwrittenTest.ok, true, overwrittenTest.error || 'remplacement explicite impossible');

  const base = library.listParcours().find(item => item.id === 'parcours-de-base');
  assert.ok(base, 'Parcours de base absent');
  assert.strictEqual(base.testCount, 21, 'le parcours de base doit contenir 21 tests intermédiaires');
  assert.strictEqual(base.creator, 'KALONÉO');
// Regression: a profile created with an older setup must migrate without
// changing order, IDs, grades, dates or administrator-created parcours.
const originalBaseFile=path.join(temp,'KALONEO','Parcours','parcours-de-base.json');
const originalBase=JSON.parse(fs.readFileSync(originalBaseFile,'utf8'));
const oldSystemBase={...originalBase,creator:'SEB EvalPro / KALONÉO'};
fs.writeFileSync(originalBaseFile,JSON.stringify(oldSystemBase));
const migrated=library.getParcours('parcours-de-base');
assert.strictEqual(migrated.ok,true);
assert.strictEqual(migrated.parcours.creator,'KALONÉO');
const newSystemBase=JSON.parse(fs.readFileSync(originalBaseFile,'utf8'));
assert.strictEqual(newSystemBase.creator,'KALONÉO');
assert.deepStrictEqual(newSystemBase.tests,oldSystemBase.tests,'test order must not change');
assert.deepStrictEqual(newSystemBase.maskScreen,oldSystemBase.maskScreen,'mask ref must not change');
assert.strictEqual(newSystemBase.updatedAt,oldSystemBase.updatedAt,'creation date must not change');
assert.deepStrictEqual(newSystemBase.introduction,oldSystemBase.introduction);
assert.deepStrictEqual(newSystemBase.fin,oldSystemBase.fin);

  const selected = normal.slice(0, 3);
  const payload = {
    name:'Parcours long',
    creator:'Test automatisé',
    maskScreen:{ id:'masque-smoke', version:'1.0.0' },
    introduction:{ id:intro[0].id, version:intro[0].version },
    tests:selected.map(item => ({ id:item.id, version:item.version })),
    fin:{ id:fins[0].id, version:fins[0].version }
  };

  const saved = library.saveParcours(payload);
  assert.strictEqual(saved.ok, true, saved.error || 'enregistrement refusé');
  assert.strictEqual(saved.parcours.name, 'Parcours long');
  assert.strictEqual(saved.parcours.creator, 'Test automatisé');
  assert.strictEqual(saved.parcours.tests.length, 3);
  assert.deepStrictEqual(saved.parcours.maskScreen, {id:'masque-smoke',version:'1.0.0'});

  const opened = library.getParcours(saved.parcours.id);
  assert.strictEqual(opened.ok, true, opened.error || 'réouverture du parcours impossible');
  assert.strictEqual(opened.parcours.tests.length, 3);

  const details = library.getParcoursDetails(saved.parcours.id);
  assert.strictEqual(details.ok, true, details.error || 'détail du parcours impossible');
  assert.strictEqual(details.details.maskScreenMeta.name, 'Masque smoke');
  assert.strictEqual(details.details.tests.length, 3);
  assert.strictEqual(details.details.tests[0].meta.title, selected[0].title);

  const selectedResult = library.selectParcours(saved.parcours.id);
  assert.strictEqual(selectedResult.ok, true, selectedResult.error || 'sélection du parcours impossible');
  assert.strictEqual(library.getSelectedParcours().selected.id, saved.parcours.id);
  assert.strictEqual(
    library.getSelectedParcours().selected.launchOptions.showCorrectionsDuringParcours,
    false,
    'les corrections doivent être masquées par défaut'
  );

  let runtime = library.resolveParcoursRuntime();
  assert.strictEqual(runtime.ok, true, runtime.error || 'résolution runtime impossible');
  assert.strictEqual(runtime.runtime.title, 'Parcours long');
  assert.strictEqual(runtime.runtime.tests.length, 3);
  assert.strictEqual(runtime.runtime.fin.id, fins[0].id);
  assert.strictEqual(runtime.runtime.maskScreenDefinition.name, 'Masque smoke');
  assert.strictEqual(runtime.runtime.launchOptions.showCorrectionsDuringParcours, false);

  const selectedWithCorrections = library.selectParcours(saved.parcours.id, {showCorrectionsDuringParcours:true});
  assert.strictEqual(selectedWithCorrections.ok, true, selectedWithCorrections.error || 'sélection avec corrections impossible');
  assert.strictEqual(selectedWithCorrections.selected.launchOptions.showCorrectionsDuringParcours, true);
  runtime = library.resolveParcoursRuntime();
  assert.strictEqual(runtime.runtime.launchOptions.showCorrectionsDuringParcours, true, 'le choix Admin Oui doit arriver au runtime');

  library.selectParcours(saved.parcours.id, {showCorrectionsDuringParcours:false});
  runtime = library.resolveParcoursRuntime();
  assert.strictEqual(runtime.runtime.launchOptions.showCorrectionsDuringParcours, false, 'le choix Admin Non doit être restauré');

  const updated = library.saveParcours({
    ...payload,
    id:saved.parcours.id,
    name:'Parcours long modifié',
    tests:selected.slice(0,2).map(item=>({id:item.id,version:item.version}))
  });
  assert.strictEqual(updated.ok, true, updated.error || 'mise à jour du parcours refusée');
  assert.strictEqual(updated.updated, true);
  assert.strictEqual(updated.parcours.tests.length, 2);
  assert.strictEqual(library.getParcours(saved.parcours.id).parcours.name, 'Parcours long modifié');

  const protectedBaseUpdate = library.saveParcours({
    ...payload,
    id:'parcours-de-base',
    name:'Parcours de base',
    creator:'KALONÉO'
  });
  assert.strictEqual(protectedBaseUpdate.ok, false, 'le parcours de base doit rester protégé');

  const duplicateName = library.saveParcours({ ...payload, name:'  PARCOURS   LONG   MODIFIÉ  ' });
  assert.strictEqual(duplicateName.ok, false, 'le nom de parcours doit être unique');
  assert.match(duplicateName.error, /existe déjà/i);

  const duplicateTest = library.saveParcours({
    ...payload,
    name:'Parcours doublon',
    tests:[payload.tests[0], payload.tests[0]]
  });
  assert.strictEqual(duplicateTest.ok, false, 'un test dupliqué doit être refusé');
  assert.match(duplicateTest.error, /une seule fois/i);

  const wrongIntro = library.saveParcours({
    ...payload,
    name:'Parcours intro invalide',
    introduction:payload.tests[0]
  });
  assert.strictEqual(wrongIntro.ok, false, 'un test normal ne peut pas remplacer l’introduction');

  const missingCreator = library.saveParcours({ ...payload, name:'Sans créateur', creator:'' });
  assert.strictEqual(missingCreator.ok, false, 'le créateur est obligatoire');

  console.log('KALONEO_PARCOURS_BUILDER_SMOKE=OK');
} finally {
  fs.rmSync(temp, { recursive:true, force:true });
}
