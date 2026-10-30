'use strict';
// Controle les V1 embarquees a partir du manifeste reel, sans deviner les dossiers.
// Ne modifie ni les tests ni les donnees candidates.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { loadOfficialOverrides } = require('./kaloneo-testsv1');
const { extract } = require('../src/kaloneo-v1-image-assets');

function sha256(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex'); }
function fail(message) { throw new Error('KALONEO_V1_MANIFEST: ' + message); }
function check() {
  const appRoot = path.resolve(__dirname, '..');
  const repoRoot = path.resolve(appRoot, '..');
  const sourceTestsDir = path.join(appRoot, 'source', 'kaltest', 'tests');
  const preparedRoot = path.join(appRoot, 'app', 'web', 'kaltest');
  const testsRoot = path.join(preparedRoot, 'tests');
  const assetsRoot = path.join(preparedRoot, 'v1-assets');
  const manifestPath = path.join(preparedRoot, 'TESTS_V1-manifest.json');
  if (!fs.existsSync(manifestPath)) fail('manifeste absent (lancer prepare:web).');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest.format !== 'kaloneo-official-v1-overrides' || manifest.version !== 1 || !Array.isArray(manifest.tests)) {
    fail('format du manifeste invalide.');
  }
  const { overrides } = loadOfficialOverrides(repoRoot, sourceTestsDir);
  if (!overrides.size || manifest.tests.length !== overrides.size) fail('catalogue de V1 incomplet ou surnumeraire.');
  const listed = new Map();
  for (const entry of manifest.tests) {
    if (!entry || typeof entry.id !== 'string' || listed.has(entry.id)) fail('identifiant V1 absent ou duplique.');
    listed.set(entry.id, entry);
  }
  for (const id of ['l', 'offre', 'planning_trimestriel']) {
    if (!overrides.has(id)) fail('test valide obligatoire absent : ' + id);
  }
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kaloneo-v1-audit-'));
  let imageCount = 0;
  try {
    for (const [id, record] of overrides) {
      const entry = listed.get(id);
      if (!entry) fail('V1 absente du manifeste : ' + id);
      const relative = record.relative.split(path.sep).join('/');
      if (entry.relative !== relative || entry.sha256 !== record.sha256 ||
          entry.version !== '1.0.0' || entry.isNew !== record.isNew) {
        fail('manifeste different de la source officielle pour ' + id);
      }
      const file = path.resolve(testsRoot, relative);
      if (!file.startsWith(testsRoot + path.sep) || !fs.existsSync(file)) {
        fail('V1 non integree au chemin officiel pour ' + id + ' : ' + relative);
      }
      const actual = JSON.parse(fs.readFileSync(file, 'utf8'));
      const expected = extract(record.definition, path.join(tempRoot, 'assets'));
      assert.deepStrictEqual(actual, expected.definition, 'Contenu de V1 modifie apres preparation : ' + id);
      if (entry.images !== expected.usages.length) fail('nombre d images incorrect pour ' + id);
      if (actual.id !== id || actual.version !== '1.0.0') fail('ID ou version modifies : ' + id);
      if (id === 'l' && (!Array.isArray(actual.questions) || actual.questions.length !== 5)) {
        fail('Bon de transport valide different.');
      }
      const refs = new Set();
      function collect(value) {
        if (typeof value === 'string') {
          if (!value.startsWith('kaloneo-asset:')) return;
          const found = /^kaloneo-asset:([a-f0-9]{64})\.(png|jpg|webp|gif|svg)$/.exec(value);
          if (!found) fail('reference image malformee pour ' + id);
          refs.add(found[1] + '.' + found[2]);
        } else if (Array.isArray(value)) value.forEach(collect);
        else if (value && typeof value === 'object') Object.values(value).forEach(collect);
      }
      collect(actual);
      for (const name of refs) {
        const asset = path.join(assetsRoot, name);
        if (!fs.existsSync(asset)) fail('media absent pour ' + id + ' : ' + name);
        if (sha256(fs.readFileSync(asset)) !== name.slice(0, 64)) fail('media altere pour ' + id + ' : ' + name);
      }
      imageCount += refs.size;
      console.log('KALONEO_V1_VALIDEE=' + id + ' ; fichier=' + relative + ' ; images=' + refs.size);
    }
    console.log('KALONEO_V1_MANIFEST=SUCCESS ; tests=' + overrides.size + ' ; medias=' + imageCount);
  } finally {
    fs.rmSync(tempRoot, { recursive:true, force:true });
  }
}
if (require.main === module) { try { check(); } catch (error) { console.error(error); process.exitCode = 1; } }
module.exports = { check };
