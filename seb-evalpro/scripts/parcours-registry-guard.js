const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');

function fail(message) {
  console.error('SEB EvalPro garde parcours: ' + message);
  process.exit(2);
}

function read(rel) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) fail('fichier introuvable: ' + rel);
  return fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
}

const source = read('app/web/js/seb-parcours.js');
const sandbox = { window:{ location:{ href:'' } }, encodeURIComponent };
vm.runInNewContext(source, sandbox, { filename:'seb-parcours.js' });

const api = sandbox.window.sebParcours;
if (!api || !Array.isArray(api.steps) || !Array.isArray(api.legacySteps) || !Array.isArray(api.pilot11Steps)) {
  fail('API sebParcours absente ou invalide');
}
if (api.mode !== 'legacy') fail('mode par défaut du registre différent de legacy');

const expectedIds = [
  'qcm-1','qcm-2','qcm-2_1','qcm-3','qcm-texte-trous','qcm-4','qcm-5','qcm-5_1','qcm-6',
  'autoeval1','introbrique','brique','stock','planning','genrenombres','dictee','tri-de-cheville',
  'nwtexte','nvmail','autoeval2','paronymes','carre','qcm-11','qcm-finale'
];

const ids = Array.from(api.steps, (step) => String(step.id));
if (JSON.stringify(ids) !== JSON.stringify(expectedIds)) {
  fail('ordre du parcours historique validé modifié: ' + JSON.stringify(ids));
}
if (new Set(ids).size !== ids.length) fail('identifiant de parcours historique dupliqué');

const pilot11ExpectedIds = [
  'kaltest-initial','qcm-4','qcm-5','qcm-5_1','qcm-6',
  'autoeval1','transition-video-f1','brique','stock','planning','genrenombres','dictee',
  'tri-de-cheville','nwtexte','nvmail','autoeval2','paronymes','carre','qcm-11'
];
const pilot11Ids = Array.from(api.pilot11Steps, (step) => String(step.id));
if (JSON.stringify(pilot11Ids) !== JSON.stringify(pilot11ExpectedIds)) {
  fail('ordre PILOTE 11 incorrect: ' + JSON.stringify(pilot11Ids));
}
if (new Set(pilot11Ids).size !== pilot11Ids.length) fail('identifiant PILOTE 11 dupliqué');

const pilot11ById = new Map(Array.from(api.pilot11Steps, step => [String(step.id), step]));
const expectedPilotRoutes = {
  'kaltest-initial':'kaltest-pilot2.html?fullParcours=1',
  'qcm-4':'kaltest-pilot2.html?fullParcours=1&segment=fractions',
  'qcm-5':'kaltest-pilot2.html?fullParcours=1&segment=organisation',
  'qcm-5_1':'kaltest-pilot2.html?fullParcours=1&segment=postures',
  'qcm-6':'kaltest-pilot2.html?fullParcours=1&segment=conversions',
  'autoeval1':'kaltest-pilot2.html?fullParcours=1&segment=autoeval1',
  'transition-video-f1':'kaltest-pilot2.html?fullParcours=1&segment=transition-video-f1',
  'brique':'kaltest-pilot2.html?fullParcours=1&segment=brique',
  'stock':'kaltest-pilot2.html?fullParcours=1&segment=stock',
  'planning':'kaltest-pilot2.html?fullParcours=1&segment=planning',
  'genrenombres':'kaltest-pilot2.html?fullParcours=1&segment=genre-nombre',
  'dictee':'kaltest-pilot2.html?fullParcours=1&segment=dictee',
  'tri-de-cheville':'kaltest-pilot2.html?fullParcours=1&segment=tri',
  'nwtexte':'kaltest-pilot2.html?fullParcours=1&segment=nwtexte',
  'nvmail':'kaltest-pilot2.html?fullParcours=1&segment=mail',
  'autoeval2':'kaltest-pilot2.html?fullParcours=1&segment=autoeval2',
  'paronymes':'kaltest-pilot2.html?fullParcours=1&segment=paronymes',
  'carre':'kaltest-pilot2.html?fullParcours=1&segment=carre',
  'qcm-11':'kaltest-pilot2.html?fullParcours=1&segment=fin'
};
for (const [id, expectedUrl] of Object.entries(expectedPilotRoutes)) {
  const step = pilot11ById.get(id);
  if (!step) fail('étape PILOTE 11 absente: ' + id);
  const query = Object.entries(step.query || {})
    .map(([key,value]) => encodeURIComponent(key) + '=' + encodeURIComponent(String(value)))
    .join('&');
  const url = step.file + (query ? '?' + query : '');
  if (url !== expectedUrl) fail('route PILOTE 11 incorrecte pour ' + id + ': ' + url);
}

function pilotNextUrl(id) {
  const index = pilot11Ids.indexOf(String(id || ''));
  if (index < 0 || index + 1 >= pilot11Ids.length) return null;
  const nextId = pilot11Ids[index + 1];
  return expectedPilotRoutes[nextId] || null;
}
for (const removed of ['qcm-1','qcm-2','qcm-2_1','qcm-3','qcm-texte-trous']) {
  if (pilot11Ids.includes(removed)) fail('ancienne page dupliquée dans PILOTE 11: ' + removed);
}

const archivedExercisePages = new Set(['nvmail.html', 'nwtexte.html']);
for (const step of [...api.legacySteps, ...api.pilot11Steps]) {
  if (!step.file || !/\.html(?:$|[?#])/i.test(String(step.file))) fail('fichier de parcours invalide pour ' + step.id);
  const name = String(step.file).split(/[?#]/)[0];
  const localFile = path.join(root, 'app', 'web', name);
  if (archivedExercisePages.has(name)) {
    if (fs.existsSync(localFile)) fail('ancienne page HTML livrée: ' + name);
    continue;
  }
  if (!fs.existsSync(localFile)) fail('page de parcours absente: ' + step.file);
}


// Transition F1 et Briques sont maintenant deux segments KALTEST.
if (pilotNextUrl('autoeval1') !== 'kaltest-pilot2.html?fullParcours=1&segment=transition-video-f1') fail('autoeval1 -> Transition vidéo F1 modifié');
if (pilotNextUrl('transition-video-f1') !== 'kaltest-pilot2.html?fullParcours=1&segment=brique') fail('Transition vidéo F1 -> Briques KALTEST modifié');
if (pilotNextUrl('brique') !== 'kaltest-pilot2.html?fullParcours=1&segment=stock') fail('Briques KALTEST -> Stock KALTEST modifié');

// Dictée obligatoire entre Genre/Nombre et Tri.
if (pilotNextUrl('genrenombres') !== 'kaltest-pilot2.html?fullParcours=1&segment=dictee') fail('genrenombres -> dictée KALTEST modifié');
if (pilotNextUrl('dictee') !== 'kaltest-pilot2.html?fullParcours=1&segment=tri') fail('dictée KALTEST -> tri KALTEST modifié');
const dicteeContract = api.resultContractFor('dictee');
if (!dicteeContract || dicteeContract.storage !== 'dictee_data') fail('contrat Résultats dictée modifié');

// Ordre actuellement validé autour du traitement de texte.
if (pilotNextUrl('tri-de-cheville') !== 'kaltest-pilot2.html?fullParcours=1&segment=nwtexte') fail('tri KALTEST -> Traitement de texte KALTEST modifié');
if (pilotNextUrl('nwtexte') !== 'kaltest-pilot2.html?fullParcours=1&segment=mail') fail('nwtexte -> mail KALTEST modifié');
if (pilotNextUrl('nvmail') !== 'kaltest-pilot2.html?fullParcours=1&segment=autoeval2') fail('mail KALTEST -> autoeval2 modifié');

// Le Gratte-ciel mène à la page terminale KALTEST. Cette page est la fin du parcours.
if (pilotNextUrl('carre') !== 'kaltest-pilot2.html?fullParcours=1&segment=fin') fail('carre KALTEST -> fin KALTEST modifié');
if (pilotNextUrl('qcm-11') !== null) fail('la page terminale qcm-11 ne doit avoir aucune étape suivante');

// Le contrat Résultats historique nwtexte doit rester lisible sans renommage.
const nw = api.resultContractFor('nwtexte');
if (!nw || nw.scoreStorage !== 'scores_data' || nw.scoreKey !== 'page7' ||
    nw.responseStorage !== 'reponses_data' || nw.responseKey !== 'page7_analyse') {
  fail('contrat Résultats nwtexte modifié');
}
const mail = api.resultContractFor('nvmail');
if (!mail || mail.storage !== 'page8_data' || mail.scoreKey !== 'score_total') {
  fail('contrat Résultats nvmail modifié');
}

// Vérification directe de la page Résultats générée.
const qcm = read('app/web/qcmv1.0.html') + '\n' + read('app/web/js/qcm-runtime.js') + '\n' + read('app/web/js/qcm-runtime-ui.js') + '\n' + read('app/web/js/qcm-runtime-tail.js');
for (const token of [
  "if (reponses['page7_analyse'])",
  "scores['page7']",
  'const scoreMax = 8;',
  'Enregistrement conforme',
  "sessionStorage.getItem('page8_data')"
]) {
  if (!qcm.includes(token)) fail('récupération Résultats absente: ' + token);
}

// Le pilote nwtexte doit continuer à naviguer par identifiant et jamais connaître nvmail.
const nwPage = read('app/web/js/nwtexte-page.js');
if (!nwPage.includes("sebParcours.goNext('nwtexte')")) fail('nwtexte ne passe plus par le registre');
if (/nvmail\.html/i.test(nwPage)) fail('couplage direct nwtexte -> nvmail réintroduit');

console.log('SEB EvalPro garde parcours: parcours historique + PILOTE 11 ordonné sans doublons, destinations et contrats Résultats — OK.');
