const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { createCandidateTransfer } = require('../src/candidate-transfer-main');
const { configureLocalKey, migrateJsonTree, LOCAL_PREFIX } = require('../src/candidate-data-crypto');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'seb-evalpro-secure-transfer-'));
const pc1Documents = path.join(root, 'PC1', 'Documents');
const adminDocuments = path.join(root, 'ADMIN', 'Documents');
const usbRoot = path.join(root, 'USB');
const fixedNow = new Date('2026-09-24T12:00:00.000Z');
const password = 'USB-Test-2026!';

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive:true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2), 'utf8');
}

function makeCandidate(parent, folderName, candidateId, candidat, status = 'SESSION_FERMEE') {
  const dir = path.join(parent, folderName);
  for (const rel of ['donnees','resultats','replay',path.join('bilan','historique'),path.join('bilan','exports')]) {
    fs.mkdirSync(path.join(dir, rel), { recursive:true });
  }
  writeJson(path.join(dir, 'manifest.json'), {
    schemaVersion:1,
    candidateId,
    shortId:candidateId.replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase(),
    folderName,
    status,
    updatedAt:fixedNow.toISOString(),
    candidat
  });
  writeJson(path.join(dir, 'donnees', 'candidat.json'), candidat);
  writeJson(path.join(dir, 'donnees', 'evaluation-state.json'), {
    version:1,
    sessionStorage:{
      candidat_data:JSON.stringify(candidat),
      reponses_data:JSON.stringify({ q1:'1020' }),
      scores_data:JSON.stringify({ page2:5 })
    },
    localStorage:{},
    lastPage:'pageFinale.html',
    lastEvaluationPage:'pageFinale.html'
  });
  writeJson(path.join(dir, 'donnees', 'progression.json'), { lastPage:'pageFinale.html', lastEvaluationPage:'pageFinale.html' });
  writeJson(path.join(dir, 'resultats', 'reponses.json'), { q1:'1020' });
  writeJson(path.join(dir, 'resultats', 'scores.json'), { page2:5 });
  fs.writeFileSync(path.join(dir, 'replay', 'probe.txt'), 'replay', 'utf8');
  return dir;
}

function sha(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

try {
  const pc1 = createCandidateTransfer({ documentsPath:pc1Documents, now:() => new Date(fixedNow) });
  fs.mkdirSync(pc1.paths.candidatesRoot, { recursive:true });

  const candidate1Dir = makeCandidate(pc1.paths.candidatesRoot, 'ANCIEN_DOSSIER_1', 'candidate-1', {
    nom:'XX', 'prénom':'YY', lieu:'Lorient', groupe:'7', date:'2026-09-18'
  });
  makeCandidate(pc1.paths.candidatesRoot, 'ANCIEN_DOSSIER_2', 'candidate-2', {
    nom:'ZZ', 'prénom':'WW', lieu:'Vannes', groupe:'4', date:'2026-09-18'
  });
  makeCandidate(pc1.paths.candidatesRoot, 'EN_COURS_LOCAL', 'candidate-active', {
    nom:'VV', 'prénom':'UU', lieu:'Auray', groupe:'2', date:'2026-09-18'
  }, 'EN_COURS');

  configureLocalKey(Buffer.alloc(32, 11));
  migrateJsonTree(pc1.paths.candidatesRoot);

  // Un dossier local illisible ne doit pas bloquer l'export des candidats valides.
  const corruptDir = path.join(pc1.paths.candidatesRoot, 'CAND-CORROMPU-TEST');
  fs.mkdirSync(corruptDir, { recursive:true });
  fs.writeFileSync(path.join(corruptDir, 'manifest.json'), 'ILLISIBLE', 'utf8');

  const selectedUsbRoot = path.join(root, 'USB-SELECTED');
  fs.mkdirSync(selectedUsbRoot, { recursive:true });
  const selectedExport = pc1.exportSelected(selectedUsbRoot, password, ['candidate-2']);
  assert.strictEqual(selectedExport.total, 1, 'L’export sélectionné doit contenir uniquement le candidat choisi.');
  assert.strictEqual(selectedExport.added, 1);
  const selectedFiles = fs.readdirSync(selectedUsbRoot).filter((name) => name.toLowerCase().endsWith('.seb'));
  assert.strictEqual(selectedFiles.length, 1, 'Un seul fichier .seb doit être produit pour une sélection d’un candidat.');
  assert.throws(
    () => pc1.exportSelected(selectedUsbRoot, password, ['candidate-active']),
    /parcours non terminé/i,
    'Un parcours en cours ne doit jamais être exportable depuis la sélection.'
  );
  assert.throws(
    () => pc1.exportSelected(selectedUsbRoot, password, ['candidate-inconnu']),
    /introuvable|illisible/i,
    'Une sélection incohérente doit être refusée sans export partiel.'
  );

  fs.mkdirSync(usbRoot, { recursive:true });
  const firstExport = pc1.exportAll(usbRoot, password);
  assert.strictEqual(firstExport.total, 2, 'Seules les sessions fermées doivent être exportées.');
  assert.strictEqual(firstExport.added, 2);
  assert.strictEqual(firstExport.skipped, 0);
  assert.strictEqual(firstExport.passwordProtected, true);
  assert.strictEqual(firstExport.invalidSkipped, 1, 'Un dossier illisible doit être ignoré sans bloquer les autres exports.');
  assert.strictEqual(firstExport.invalidFolders.length, 1);

  const usbEntries = fs.readdirSync(usbRoot, { withFileTypes:true });
  assert.strictEqual(usbEntries.filter((entry) => entry.isFile() && entry.name.endsWith('.seb')).length, 2);
  assert.strictEqual(usbEntries.filter((entry) => entry.isDirectory()).length, 0, 'Aucun dossier candidat en clair ne doit être créé sur la clé.');
  for (const entry of usbEntries.filter((item) => item.isFile())) {
    const raw = fs.readFileSync(path.join(usbRoot, entry.name), 'utf8');
    assert(raw.includes('SEB-EVALPRO-USB-1'), 'Le conteneur sécurisé doit être identifiable.');
    assert(!raw.includes('Lorient') && !raw.includes('Vannes'), 'Aucune identité/localisation ne doit apparaître en clair dans le fichier USB.');
  }

  // Un bilan et son Word sont créés après le premier export.
  // Le deuxième export doit mettre à jour le même .seb au lieu de l'ignorer.
  writeJson(path.join(candidate1Dir, 'bilan', 'historique', 'BILAN_TEST_R00.json'), {
    type:'SEB_EVALPRO_BILAN_ARCHIVE',
    candidateId:'candidate-1',
    candidate:{ nom:'XX', prenom:'YY', lieu:'Lorient', groupe:'7', date:'2026-09-18' },
    probe:'bilan-apres-premier-export'
  });
  fs.writeFileSync(path.join(candidate1Dir, 'bilan', 'exports', 'Evaluation_XX_YY_2026-09-18.doc'), 'WORD-BILAN-UPDATED', 'utf8');

  const secondExport = pc1.exportAll(usbRoot, password);
  assert.strictEqual(secondExport.added, 0);
  assert.strictEqual(secondExport.updated, 1, 'Le candidat enrichi d’un bilan doit mettre à jour son .seb existant.');
  assert.strictEqual(secondExport.skipped, 1, 'Le candidat inchangé doit rester ignoré.');

  const afterUpdateEntries = fs.readdirSync(usbRoot, { withFileTypes:true }).filter((e) => e.isFile());
  assert.strictEqual(afterUpdateEntries.length, 2, 'La mise à jour ne doit pas créer de doublon .seb.');
  const beforeHashes = new Map(afterUpdateEntries.map((e) => [e.name, sha(path.join(usbRoot, e.name))]));

  // Le PC Admin utilise volontairement une autre clé locale.
  configureLocalKey(Buffer.alloc(32, 22));
  const admin = createCandidateTransfer({ documentsPath:adminDocuments, now:() => new Date(fixedNow) });
  assert.throws(
    () => admin.importAll(usbRoot, 'Mauvais-2026!'),
    /Mot de passe incorrect|endommagé/,
    'Un mauvais mot de passe doit refuser tout import.'
  );
  assert.strictEqual(admin.listCandidateRecords(admin.paths.candidatesRoot, false).length, 0, 'Aucun candidat ne doit être copié après un mauvais mot de passe.');
  for (const [name, digest] of beforeHashes) {
    assert.strictEqual(sha(path.join(usbRoot, name)), digest, 'Un import refusé ne doit jamais modifier la clé USB.');
  }

  const imported = admin.importAll(usbRoot, password);
  assert.strictEqual(imported.total, 2);
  assert.strictEqual(imported.added, 2);
  assert.strictEqual(imported.skipped, 0);
  assert.strictEqual(imported.passwordProtected, true);
  const records = admin.listCandidateRecords(imported.destinationRoot, false);
  assert.strictEqual(records.length, 2);
  const importedManifestRaw = fs.readFileSync(path.join(records[0].candidateDir, 'manifest.json'), 'utf8');
  assert(importedManifestRaw.startsWith(LOCAL_PREFIX), 'Les données importées doivent être rechiffrées avec la clé locale du PC Admin.');
  assert(records.every((record) => /^CAND-/i.test(record.folderName)), 'Les dossiers importés doivent rester codés.');

  const importedCandidate1 = records.find((record) => String(record.candidateId) === 'candidate-1');
  assert(importedCandidate1, 'Le candidat 1 importé est introuvable.');
  const histories=fs.readdirSync(path.join(importedCandidate1.candidateDir,'bilan','historique'));
  assert(histories.length===1 && /^BILAN_CAND-[A-F0-9]{32}\.json$/.test(histories[0]),
    'Les noms des anciens bilans doivent etre rendus opaques au moment de l import.');
  const importedHistory=readJson(path.join(importedCandidate1.candidateDir,'bilan','historique',histories[0]));
  assert(importedHistory && importedHistory.probe==='bilan-apres-premier-export');
  const words=fs.readdirSync(path.join(importedCandidate1.candidateDir,'bilan','exports'));
  assert(words.length===1 && /^Evaluation_CAND-[A-F0-9]{32}\.sebdoc$/.test(words[0]),
    'Le Word historique doit etre chiffre ET porter un nom opaque des son import.');
  const {isEncryptedLocalFileBuffer,decryptLocalFileBuffer}=require('../src/candidate-data-crypto');
  const protectedWord=fs.readFileSync(path.join(importedCandidate1.candidateDir,'bilan','exports',words[0]));
  assert(isEncryptedLocalFileBuffer(protectedWord));
  assert.strictEqual(decryptLocalFileBuffer(protectedWord).toString('utf8'),'WORD-BILAN-UPDATED');

  const importedAgain = admin.importAll(usbRoot, password);
  assert.strictEqual(importedAgain.added, 0);
  assert.strictEqual(importedAgain.skipped, 2, 'Un candidat déjà présent ne doit jamais être écrasé.');

  // Une évaluation placée dans la Corbeille ne doit pas être recréée silencieusement
  // par un nouvel import du même fichier .seb.
  fs.mkdirSync(admin.paths.candidateTrashRoot, { recursive:true });
  const trashedTarget = path.join(admin.paths.candidateTrashRoot, importedCandidate1.folderName);
  fs.renameSync(importedCandidate1.candidateDir, trashedTarget);
  const importWhileTrashed = admin.importAll(usbRoot, password);
  assert.strictEqual(importWhileTrashed.added, 0, 'Une évaluation en Corbeille ne doit pas être réimportée comme nouvelle.');
  assert.strictEqual(importWhileTrashed.skipped, 1, 'Le candidat encore actif doit rester ignoré comme déjà présent.');
  assert.strictEqual(importWhileTrashed.trashSkipped, 1, 'L’évaluation déjà en Corbeille doit être signalée séparément.');
  assert.strictEqual(
    admin.listCandidateRecords(admin.paths.candidatesRoot, false).some((record) => String(record.candidateId) === 'candidate-1'),
    false,
    'L’import ne doit pas ressusciter candidate-1 hors de la Corbeille.'
  );

  console.log('USB_IMPORT_TRASH_PROTECTION: OK');
  console.log('USB_EXPORT_EXISTING_CANDIDATE_UPDATE: OK');
  console.log('USB_IMPORT_BILAN_HISTORY_PRESERVED: OK');
  console.log('USB_IMPORT_WORD_EXPORT_PRESERVED: OK');
  console.log('Candidate Secure USB Transfer Test: OK');
} finally {
  fs.rmSync(root, { recursive:true, force:true });
}
