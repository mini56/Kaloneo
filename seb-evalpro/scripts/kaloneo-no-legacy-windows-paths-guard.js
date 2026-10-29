'use strict';
// Audit ciblé des chemins Windows réellement utilisés par le Setup officiel.
// Les constantes historiques de déchiffrement et les sources GitHub ne sont pas renommées.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const mustContain = (file, value) =>
  assert(read(file).includes(value), file + ' : protection KALONÉO manquante : ' + value);
const mustNotContain = (file, value) =>
  assert(!read(file).includes(value), file + ' : ancien chemin actif : ' + value);

const bootstrap = 'src/kaltest-pilot21-main.js';
mustContain(bootstrap, "const isolatedRoot = path.join(appData, 'KALONEO');");
mustContain(bootstrap, "require('node:fs').mkdirSync(documentsRoot,{recursive:true});");
mustContain(bootstrap, "app.setPath('userData', isolatedRoot);");
mustContain(bootstrap, "app.setPath('documents', documentsRoot);");
mustContain(bootstrap, "if (storageReady) require('./main');");
mustContain(bootstrap, 'app.exit(1);');
assert(!/catch\s*\([^)]*\)\s*\{\s*\}/.test(read(bootstrap)), 'Démarrage silencieux vers un ancien profil interdit.');

const setup = 'build/kaloneo-auto-release.yml';
mustContain(setup, 'appId: fr.sauvegarde56.kaloneo');
mustContain(setup, 'productName: "KALONÉO"');
mustContain(setup, '  name: kaloneo');
mustContain('build/kaloneo-v1-00-190-final-setup.yml', '  name: kaloneo');
mustContain(setup, 'main: src/kaltest-pilot21-main.js');
mustContain(setup, 'executableName: KALONEO');
mustContain(setup, 'artifactName: "KALONEO-Setup-');
mustContain('build/installer.nsh', '$LOCALAPPDATA\\Programs\\KALONEO');
mustContain('build/installer.nsh', '$PROGRAMFILES64\\KALONEO');

const main = 'src/main.js';
mustContain(main, "dataRoot: sebInternalRoot()");
mustContain('src/storage-layout.js', "return path.join(userDataPath, 'storage');");
mustContain('src/candidate-catalog-main.js',
  "const wordTempRoot = path.join(app.getPath('temp'), 'KALONEO', 'Word');");
mustNotContain('src/candidate-catalog-main.js',
  "path.join(app.getPath('temp'), 'SEB EvalPro'");
mustContain('src/bilan-history-main.js', "return path.join(root, 'Bilans', 'Word');");
mustNotContain('src/bilan-history-main.js',
  "path.join(app.getPath('documents'), 'SEB EvalPro')");
mustContain('src/local-ai.js', "return path.join(programData, 'KALONEO', 'IA');");
mustNotContain('src/local-ai.js', "return path.join(programData, 'SEB EvalPro'");
mustContain('src/edition.js', "label: 'KALONÉO',");

// Ne jamais changer les identifiants historiques sans migration : ils servent
// à déchiffrer les candidats et les transferts déjà enregistrés.
mustContain('src/candidate-data-crypto.js', "Buffer.from('SEB-EvalPro/local-json/v1'");
mustContain('src/candidate-transfer-main.js', "'SEB-EVALPRO-USB-1'");

console.log('KALONEO_WINDOWS_NO_LEGACY_ACTIVE_FOLDERS=SUCCESS');
