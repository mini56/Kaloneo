'use strict';
// Transport commun des ressources de test : les images des définitions
// sont embarquées dans le JSON exporté, quelle que soit leur origine.
const fs = require('fs');
const path = require('path');
const IMAGE_MIME = Object.freeze({png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',gif:'image/gif',svg:'image/svg+xml'});
const IMAGE_PATH = /^(?:\.\/)?(?:imageqcm|assets)\/[\wÀ-ÿ ./()\-]+\.(png|jpe?g|webp|gif|svg)$/i;
function validatePortableTest(definition) {
  if (!definition || typeof definition !== 'object' || Array.isArray(definition)) throw new Error('Test JSON invalide.');
  if (Number(definition.kaltestFormat) !== 1 || !definition.id || !definition.version || !definition.title) {
    throw new Error('Définition KALTEST incomplète.');
  }
  if (definition.scored === true && (!Array.isArray(definition.outputs) || !Array.isArray(definition.bilanContributions))) {
    throw new Error('Configuration Résultats/Bilan absente : export autonome refusé.');
  }
  if (definition.scored && !Array.isArray(definition.questions) && !definition.evaluation && !definition.presentation?.builderContent) {
    throw new Error('Règles de correction absentes : export autonome refusé.');
  }
}
function embedTestImages(definition, sourceRoot) {
  validatePortableTest(definition);
  const copy = JSON.parse(JSON.stringify(definition));
  const missing = [];
  let embeddedCount = 0;
  function visit(node) {
    if (typeof node === 'string') {
      if (/^data:image\//i.test(node)) return node;
      const normalized = node.replace(/\\/g, '/');
      const match = normalized.match(IMAGE_PATH);
      if (!match) return node;
      const relative = normalized.replace(/^\.\//, '');
      const absolute = path.resolve(sourceRoot, relative);
      if (!absolute.startsWith(path.resolve(sourceRoot) + path.sep) || !fs.existsSync(absolute)) {
        missing.push(relative);
        return node;
      }
      const data = fs.readFileSync(absolute);
      const mime = IMAGE_MIME[match[1].toLowerCase()];
      embeddedCount += 1;
      return 'data:' + mime + ';base64,' + data.toString('base64');
    }
    if (Array.isArray(node)) return node.map(visit);
    if (node && typeof node === 'object') {
      for (const key of Object.keys(node)) node[key] = visit(node[key]);
    }
    return node;
  }
  visit(copy);
  if (missing.length) throw new Error('Images manquantes : ' + [...new Set(missing)].join(', '));
  return { definition:copy, embeddedCount };
}
module.exports = { embedTestImages, validatePortableTest };
