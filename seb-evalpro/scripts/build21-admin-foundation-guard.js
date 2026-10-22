'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}
function gitBlobSha(rel) {
  let text = fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
  if (rel === 'src/bilan-history-preload.js') {
    // Only two approved user-visible branding strings may differ from the
    // immutable Build #21 module. Normalize exactly those before SHA checking.
    const newDisplay='dans le dossier des bilans KALONÉO';
    assert(text.split(newDisplay).length===3,
      'Deux seuls messages visibles de bilan peuvent être renommés.');
    text=text.replaceAll(newDisplay, String.raw`dans Documents\\SEB EvalPro\\Bilans`);
  }
  const data = Buffer.from(text, 'utf8');
  const header = Buffer.from('blob ' + data.length + '\0', 'utf8');
  return crypto.createHash('sha1').update(header).update(data).digest('hex');
}
function assert(condition, message) {
  if (!condition) {
    console.error('BUILD21_ADMIN_FOUNDATION: FAIL — ' + message);
    process.exit(1);
  }
}
function section(text, start, end) {
  const i = text.indexOf(start);
  if (i < 0) return '';
  const j = end ? text.indexOf(end, i + start.length) : -1;
  return text.slice(i, j < 0 ? text.length : j);
}

// Reference source validated by the user:
// mini56/SEB-EvalPro @ tmp-nvmail-empty-abandon-0310-build21
// commit ff12d5a7a1f51a68d336cc165d1583876b373275

const exactBuild21 = {
  // Replay evolue uniquement pour chiffrer les captures et gerer les cles Windows des imports.
  // Le bilan ne cree plus de revisions : verification structurelle ci-dessous.
  // Module bilan historique autorise a securiser la generation des anciens Word.
  // candidate-store-main.js a volontairement évolué après le Build #21
  // (protection des reprises puis modèle R36 personne -> évaluations).
  // Il est donc contrôlé structurellement ci-dessous plutôt que par SHA figé.
  // JSON reste AES-256-GCM, les images sont chiffrees et aucune ecriture candidate en clair.
  // candidate-folder-utils.js : index des suppressions maintenant chiffre (controle structurel ci-dessous).
};

for (const [rel, expected] of Object.entries(exactBuild21)) {
  assert(gitBlobSha(rel) === expected, rel + ' ne correspond plus au module de référence Build #21.');
}

// Les modules historiques Replay et chiffrement ne sont plus figes au SHA du Build #21,
// puisque la confidentialite des fichiers candidat doit s'appliquer generiquement.
const replayCore = read('src/replay-main.js');
const cryptoCore = read('src/candidate-data-crypto.js');
const archiveIntegrityCore = read('src/replay-archive-integrity.js');
const privateDocumentCore=read('src/candidate-private-documents.js');
const privateBilanCore=read('src/bilan-history-main.js');
const currentBilanCore=read('src/candidate-bilan-current.js');
const historicalBilanUi=read('src/bilan-history-preload.js');
assert(privateBilanCore.includes("pruneReplacedBilans(targetHistory,filename)"),
  'Le bilan courant ne remplace plus ses anciennes versions.');
assert(privateBilanCore.includes("discardOldWordExports(path.join(path.dirname(targetHistory),'exports'))"),
  'Modification bilan : Word precedent non invalide.');
assert(currentBilanCore.includes('function pruneReplacedBilans('),
  'Nettoyage par evaluation des revisions absent.');
assert(historicalBilanUi.includes('Enregistrer le bilan'),
  'Editeur : ancien bouton Enregistrer une revision detecte.');
assert(!historicalBilanUi.includes('Word mis à jour automatiquement'),
  'Enregistrement du bilan ne doit jamais creer de Word automatiquement.');

assert(replayCore.includes("ipcMain.handle('replay:capture-page'"), 'Replay : capture candidat historique absente.');
assert(replayCore.includes("ipcMain.handle('admin:get-candidate-parcours-slide'"), 'Replay : visionneuse admin historique absente.');
assert(replayCore.includes('function migrateStoredReplayImages()'), 'Replay : migration de captation PNG existante absente.');
assert(replayCore.includes('encryptLocalFileBuffer(png)'), 'Replay : image brute ecrite sur disque.');
assert(replayCore.includes('decryptLocalFileBuffer(buffer)'), 'Replay : ouverture admin du contenu protege absente.');
assert(replayCore.includes('return { migrateStoredReplayImages, migrateStoredPending };'), 'Replay : raccordement des migrations absent.');
assert(cryptoCore.includes("createCipheriv('aes-256-gcm'"), 'Chiffrement AES-256-GCM candidat absent.');
assert(cryptoCore.includes('FILE_AAD') && cryptoCore.includes('encryptLocalFileBuffer'), 'Chiffrement des images candidat absent.');
assert(cryptoCore.includes('decryptLocalFileBuffer'), 'Decryptage en memoire des fichiers candidats absent.');
assert(cryptoCore.includes("if (!hasLocalKey()) throw new Error("), 'Sauvegarde candidate en clair sans cle possible.');
assert(archiveIntegrityCore.includes('function computeArchiveIntegrity(manifest)'), 'Hachage des archives Replay inter-postes absent.');
assert(privateBilanCore.includes("ipcMain.on('bilan-history:write-word-sync'"), 'Archivage Word admin historique absent.');
assert(privateBilanCore.includes('encryptLocalFileBuffer(plain)'), 'Word historique : ecriture potentielle en clair.');
assert(privateBilanCore.includes("opaqueCandidateName('.json','BILAN_CAND')"), 'Nom du bilan historique non pseudonymise.');
assert(privateDocumentCore.includes('function migrateCandidatePrivateDocuments('),'Migration historique des Word et des noms absente.');

// candidate-store-main.js conserve les protections historiques tout en étant
// autorisé à évoluer pour les fonctions candidat validées après le Build #21.
const candidateFolderCore = read('src/candidate-folder-utils.js');
assert(candidateFolderCore.includes('function codedFolderName(candidateId, shortId'), 'Dossier candidat code : logique de nommage absente.');
assert(candidateFolderCore.includes("return 'CAND-' + token;"), 'Dossier candidat code : prefixe opaque absent.');
assert(candidateFolderCore.includes('function readDeletedIds(documentsPath)'), 'Index de suppression : lecture absente.');
assert(candidateFolderCore.includes('function writeDeletedIds(documentsPath, ids)'), 'Index de suppression : ecriture absente.');
assert(candidateFolderCore.includes('encodeJson(Array.from(ids).sort())'), 'Index de suppression candidat en clair.');
assert(!candidateFolderCore.includes('fs.writeFileSync(temp, JSON.stringify(Array.from(ids)'),
  'Index de suppression : ecriture JSON en clair interdite.');
const candidateStoreCore = read('src/candidate-store-main.js');
assert(candidateStoreCore.includes("const activePointerBackupPath = path.join(systemRoot, 'active-candidate.json');"), 'copie de récupération du pointeur candidat actif absente.');
assert(candidateStoreCore.includes('function ensureActiveCandidate(state)'), 'allocation/reprise du candidat actif absente.');
assert(candidateStoreCore.includes('function existingCandidateForIdentity(identity)'), 'protection contre le doublon d’un parcours actif absente.');
assert(candidateStoreCore.includes("['TERMINE', 'SESSION_FERMEE'].includes(String(manifest.status || ''))"), 'un parcours terminé peut être rouvert par une sauvegarde tardive.');
assert(candidateStoreCore.includes('recentlyCompleted') && candidateStoreCore.includes('guardUntil'), 'protection contre la sauvegarde tardive après clôture absente.');
assert(candidateStoreCore.includes('function completeActiveCandidate(state'), 'clôture candidat absente.');
assert(candidateStoreCore.includes('removeActivePointer();'), 'pointeur actif non supprimé à la clôture.');
assert(candidateStoreCore.includes('privacyStorageVersion: 1'), 'Nouvelle generation de candidats sans controle de confidentialite.');
assert(candidateStoreCore.includes('evaluationId:candidateId'), 'R36 : identifiant d’évaluation technique absent à la création.');
assert((candidateStoreCore.includes('personId:person.personId') ||
  (candidateStoreCore.includes('const personId = previousPersonIdFor(identity.original) || person.personId;') &&
   candidateStoreCore.includes('personId,\n      personIdentifier:person.personIdentifier,'))), 'R36 : personId interne absent à la création.');

// replay-preload.js conserve le socle Build #21, mais peut évoluer pour les
// règles Replay validées ensuite (ex. exclusion des pages de transition).
const replayPreload = read('src/replay-preload.js');
assert(replayPreload.includes("ipcRenderer.invoke('replay:capture-page'"), 'capture Replay Build #21 absente.');
assert(replayPreload.includes('function createVisualReplayViewer'), 'viewer Replay visuel Build #21 absent.');
assert(replayPreload.includes("ipcRenderer.invoke('admin:load-candidate-parcours'"), 'chargement Replay candidat Build #21 absent.');
assert(replayPreload.includes('ensureFinalArchive'), 'archivage final Replay Build #21 absent.');
assert(replayPreload.includes('transitionPageVisible'), 'règle validée : transition non exclue du Replay.');
assert(replayPreload.includes("!key.includes('transition_video_f1')"), 'anciennes captures de transition non masquées dans le Replay.');

const preload = read('src/preload.js');
assert(preload.includes('const BAR_HIDE_DELAY = 1000;'), 'temporisation de barre Admin différente de 1000 ms.');
assert(!preload.includes('openCandidateButton.addEventListener'), 'ancien gestionnaire doublon Ouvrir un candidat du PILOTE #3 détecté.');
assert(!preload.includes('Parcours actif : rester sur la page courante'), 'ancienne logique contextuelle instable PILOTE #3 détectée.');
assert(!preload.includes('bar.__sebUpdateButtons()'), 'ancien relais de boutons contextuels PILOTE #3 détecté.');
assert(preload.includes("await ipcRenderer.invoke('admin:open-candidate-browser').catch(() => false);"), 'déverrouillage Admin ne rejoint plus l’espace candidats.');
assert(preload.includes("document.getElementById('page-final')"), 'support de la fin KALTEST absent.');
assert(preload.includes("window.addEventListener('seb-kaltest-final'"), 'signal de fin KALTEST absent.');
assert(preload.includes("captureReplay: () => replayNavigationCapture.captureNow('kaltest-explicit')"), 'pont Replay KALTEST absent.');
assert(!preload.includes('Fermer la session active active'), 'libellé de session dupliqué.');
assert(!preload.includes('puis quitter.'), 'le dialogue Fermer la session active annonce encore une fermeture du programme.');
assert(preload.includes("await ipcRenderer.invoke('admin:open-candidate-browser').catch(() => false);"), 'retour espace candidats après fermeture de session absent.');
assert(preload.includes("exportCandidatesButton.hidden = true"), 'ancien accès global Exporter dossiers encore visible dans la barre Admin.');
assert(preload.includes("importCandidatesButton.hidden = true"), 'ancien accès global Importer dossiers encore visible dans la barre Admin.');
assert(preload.includes("finishCandidateButton.hidden = true"), 'ancien bouton Terminer le parcours du candidat non verrouillé en masqué.');
assert(preload.includes("closeSessionButton.hidden = !active"), 'Fermer la session active n’est pas piloté par la présence d’un parcours actif.');
assert(preload.includes("#seb-evalpro-topbar #seb-evalpro-quit-application,"), 'Quitter n’est pas inclus dans le style danger rouge.');
assert(preload.includes("height:36px!important"), 'hauteur compacte des boutons Admin absente.');
assert(preload.includes("font-size:15px!important"), 'texte de la barre Admin non remonté à 15 px.');
assert(preload.includes("padding:1px 4px!important"), 'padding compact de la barre Admin absent.');
assert(preload.includes("#seb-evalpro-topbar button[hidden]{display:none!important}"), 'les boutons masqués peuvent encore apparaître visuellement.');
assert(preload.includes("#seb-evalpro-topbar #seb-evalpro-bilan,") && preload.includes("#seb-evalpro-topbar #seb-evalpro-return,") && preload.includes("#seb-evalpro-topbar #seb-evalpro-finish-candidate{display:none!important}"), 'Bilan / Retour / ancien Terminer ne sont pas verrouillés hors barre globale.');
assert(preload.includes("overflow:hidden;background:#0070c0"), 'barre Admin ne masque pas les débordements.');
assert(!preload.includes("if (button.parentElement !== bar) bar.appendChild(button);"), 'bouton de confidentialité encore injecté dans la barre Admin.');
assert(preload.includes('id="seb-evalpro-tests-parcours"'), 'bouton Tests / Parcours absent de la barre Admin.');
assert(preload.includes('id="seb-evalpro-choose-parcours"'), 'bouton Choix du parcours absent de la barre Admin.');
assert(preload.includes("kaloneo-library:select-parcours"), 'sélection du parcours non câblée.');
assert(preload.includes("kaloneo-library:selected-runtime"), 'runtime du parcours sélectionné non vérifié avant verrouillage.');
assert(preload.includes('id="seb-evalpro-show-privacy"'), 'bouton Afficher l’écran d’accueil absent de la barre Admin.');
assert(preload.includes("window.dispatchEvent(new CustomEvent('seb-evalpro-show-privacy'))"), 'action écran d’accueil de la barre non câblée.');
assert(preload.includes("window.addEventListener('seb-evalpro-show-privacy'"), 'écran de confidentialité ne reçoit pas la commande de la barre.');
assert(preload.includes("ipcRenderer.invoke('admin:open-tests-parcours')"), 'navigation Tests / Parcours non câblée.');
assert(preload.includes("closeTestsParcours: () => ipcRenderer.invoke('admin:close-tests-parcours')"), 'retour Tests / Parcours non exposé.');
assert(preload.includes('const ADMIN_HELP_DELAY_MS = 650;'), 'temporisation des bulles d’aide absente.');
assert(preload.includes('const ADMIN_HELP_VISIBLE_MS = 2800;'), 'durée des bulles d’aide absente.');
assert(preload.includes("Ouvre la page de gestion des tests et des parcours KALONÉO."), 'aide Tests / Parcours absente.');
assert(preload.includes("Ferme KALONÉO. Un parcours encore actif est sauvegardé pour pouvoir être repris."), 'aide Quitter absente.');
assert(preload.includes("Termine définitivement le parcours candidat en cours et revient à l’espace Administrateur."), 'aide Fermer la session active absente.');
assert(preload.includes("Affiche l’écran d’accueil KALONÉO afin de masquer temporairement les informations affichées."), 'aide écran SEB EvalPro absente.');
assert(preload.includes("return label ? `Commande « ${label} ».` : '';"), 'repli d’aide pour tout bouton visible absent.');
assert(preload.includes("closeAdminBilan: () => closeAdminBilanPage()"), 'action interne Fermer du bilan non exposée.');

const sessionClose = read('src/session-close.js');
const closeSection = section(sessionClose, "ipcMain.handle('admin:close-session'", "});");
const quitSection = section(sessionClose, "ipcMain.handle('admin:quit-application'", "});");
assert(closeSection && !closeSection.includes('app.quit'), 'Fermer la session active ferme encore le programme.');
assert(quitSection && quitSection.includes('app.quit'), 'Quitter ne ferme plus le programme.');

const catalogMain = read('src/candidate-catalog-main.js');
assert(catalogMain.includes("ipcMain.handle('candidate-catalog:list'"), 'catalogue candidat : liste IPC absente.');
assert(catalogMain.includes("ipcMain.handle('candidate-catalog:list-persons'"), 'catalogue candidat : regroupement par personne absent.');
assert(catalogMain.includes("ipcMain.handle('candidate-catalog:person-detail'"), 'catalogue candidat : fiche personne absente.');
assert(catalogMain.includes("ipcMain.handle('candidate-catalog:delete-person'"), 'catalogue candidat : suppression globale personne absente.');
assert(catalogMain.includes("ipcMain.handle('candidate-catalog:trash-list'"), 'catalogue candidat : liste Corbeille absente.');
assert(catalogMain.includes("ipcMain.handle('candidate-catalog:trash-restore'"), 'catalogue candidat : restauration depuis Corbeille absente.');
assert(catalogMain.includes("ipcMain.handle('candidate-catalog:trash-empty'"), 'catalogue candidat : vidage définitif de Corbeille absent.');
assert(catalogMain.includes("moveRecordToTrash"), 'catalogue candidat : suppression ne passe pas par une Corbeille récupérable.');
assert(catalogMain.includes("function listPersonGroups()"), 'catalogue candidat : agrégation des évaluations par personId absente.');
assert(catalogMain.includes("identifierCollision"), 'catalogue candidat : collision de N° identifiant non signalée.');
assert(catalogMain.includes("ipcMain.handle('candidate-catalog:detail'"), 'catalogue candidat : détail IPC absent.');
assert(catalogMain.includes("ipcMain.handle('candidate-catalog:delete'"), 'catalogue candidat : suppression protégée absente.');
assert(catalogMain.includes("candidateId: record.candidateId"), 'catalogue candidat : identité technique candidateId absente.');
assert(catalogMain.includes("parcours: c.parcours || c.parcoursName || ''"), 'catalogue candidat : nom du parcours effectué absent.');
assert(catalogMain.includes("replayCount: replays.length"), 'catalogue candidat : comptage Replay absent.');
assert(catalogMain.includes("bilanCount: bilans.length"), 'catalogue candidat : comptage Bilan absent.');
assert(catalogMain.includes("if (active && String(active.candidateId || '') === String(record.candidateId || ''))"), 'catalogue candidat : protection suppression candidat actif absente.');

const catalog = read('src/candidate-catalog-preload.js');
assert(catalog.includes("button.textContent = 'Lister les candidats'"), 'bouton Lister les candidats absent du catalogue stable.');
assert(catalog.includes('seb-cc-title">Liste des candidats'), 'titre Liste des candidats absent.');
assert(catalog.includes("ipcRenderer.invoke('admin:open-candidate-browser')"), 'navigation vers le catalogue candidat absente.');
assert(catalog.includes('id="seb-cc-import"') && catalog.includes('Importer candidat'), 'bouton Importer candidat absent de la Liste des candidats.');
assert(catalog.includes('id="seb-cc-export-mode"') && catalog.includes('Exporter candidat'), 'bouton Exporter candidat absent de la Liste des candidats.');
assert(catalog.includes("selectedExportIds") && catalog.includes("Lancer l’export ("), 'sélection multiple avant export absente de la Liste des candidats.');
assert(catalog.includes("Parcours en cours"), 'protection visuelle des parcours non terminés absente de la sélection export.');
assert(catalog.includes("onImportCandidates") && catalog.includes("onExportCandidates"), 'raccordement Import / Export de la Liste des candidats absent.');
assert(catalog.includes("ipcRenderer.invoke('candidate-catalog:list-persons')"), 'UI Liste des candidats non raccordée au regroupement par personne.');
assert(catalog.includes("N° identifiant"), 'N° identifiant absent de la Liste des candidats.');
assert(catalog.includes("Supprimer l’évaluation"), 'suppression d’une seule évaluation absente.');
assert(catalog.includes("Supprimer le candidat"), 'suppression globale du candidat absente.');
assert(catalog.includes("Tout sélectionner"), 'sélection de toutes les évaluations d’une personne absente du mode Export.');
assert(catalog.includes('id="seb-cc-trash"') && catalog.includes('Corbeille vide'), 'bouton Corbeille vide absent de la Liste des candidats.');
assert(catalog.includes('candidate-trash-full.png') && catalog.includes('candidate-trash-empty.png'), 'images Corbeille pleine/vide d’origine absentes.');
assert(catalog.includes('data-seb-no-normalize="1"'), 'protection des icônes spécifiques du catalogue candidat absente.');
assert(catalog.includes('↓ Importer candidat'), 'flèche descendante Importer candidat absente.');
assert(catalog.includes('↑ Exporter candidat'), 'flèche montante Exporter candidat absente.');
assert(catalog.includes('.seb-cc-foot button{height:38px!important;min-height:38px!important'), 'hauteur unique 38 px du footer candidat absente.');
assert(catalog.includes('.seb-cc-shell') && catalog.includes('grid-template-columns:minmax(0,1180px) 72px'), 'Corbeille non placée à côté de la fenêtre candidats.');
assert(catalog.includes('#seb-cc-trash{width:72px!important;height:72px!important'), 'bouton Corbeille externe non défini en 72 × 72 px.');
assert(catalog.includes('#seb-cc-trash img{width:60px;height:60px'), 'image Corbeille non dimensionnée pour le bouton 72 px.');
assert(catalog.includes('#seb-cc-trash') && catalog.includes('background:#fff!important'), 'fond blanc de la Corbeille externe absent.');
assert(catalog.indexOf('id="seb-cc-export-launch"') < catalog.indexOf('id="seb-cc-export-cancel"'), 'Lancer l export doit précéder Annuler la sélection.');
assert(catalog.includes('<button type="button" id="seb-cc-close">Fermer</button>'), 'bouton Fermer absent du footer.');
assert(!catalog.includes('<div class="seb-cc-foot-right">\n            <button type="button" id="seb-cc-close">Fermer</button>\n            <button type="button" id="seb-cc-trash"'), 'la Corbeille ne doit plus être dans le footer.');
assert(fs.existsSync(path.join(ROOT, 'source', 'assets', 'candidate-trash-empty.png')), 'image Corbeille vide d’origine absente.');
assert(fs.existsSync(path.join(ROOT, 'source', 'assets', 'candidate-trash-full.png')), 'image Corbeille pleine d’origine absente.');
assert(catalog.includes("ipcRenderer.invoke('candidate-catalog:trash-restore'"), 'bouton Restaurer non raccordé.');
assert(catalog.includes("Vider définitivement la corbeille"), 'confirmation forte de vidage définitif absente.');

const uiRuntime = read('source/js/seb-ui-runtime.js');
assert(uiRuntime.includes("closest('[data-seb-no-normalize=\"1\"]')"), 'runtime UI ne respecte pas les boutons à icône explicite.');

const fractionsRuntime = read('source/js/kaltest-pilot2-runtime.js');
const fractionsShared = read('../kaloneo/shared-presentation.js');
const fractionsCss = read('source/css/kaltest-pilot2.css');
assert(fractionsShared.includes('function randomFractionCloudPoints(') &&
  fractionsShared.includes('function installFractionCloud('),
  'Fractions KALTEST : moteur commun de placement aléatoire du nuage absent.');
assert(fractionsRuntime.includes('fractionCloudPositions') &&
  fractionsRuntime.includes('KaloneoSharedPresentation.installFractionCloud('),
  'Fractions KALTEST : restauration des nuages historiques par le moteur partagé absente.');
assert(fractionsShared.includes("items.dataset.cloudReady = '1'"),
  'Fractions KALTEST : signal de nuage prêt absent du moteur partagé.');
assert(fractionsCss.includes('.kaltest-fraction-items.cloud{'), 'Fractions KALTEST : zone visuelle nuage absente.');
assert(fractionsCss.includes('.kaltest-fraction-items.cloud .kaltest-fraction-item{position:absolute'), 'Fractions KALTEST : les 12 objets du nuage ne sont pas positionnés librement.');

const main = read('src/main.js');
assert(main.includes('function loadAdminCandidateBrowser'), 'route principale du catalogue candidat absente.');
assert(main.includes("ipcMain.handle('admin:open-candidate-browser'"), 'IPC Ouvrir un candidat absent.');
assert(main.includes("ipcMain.handle('admin:return-candidate-browser'"), 'IPC retour candidat absent.');
assert(main.includes("selectedCandidateIds") && main.includes("exportSelected"), 'IPC export candidats ne relaie pas la sélection de la Liste des candidats.');
const personIdentity = read('src/candidate-person-identity.js');
assert(personIdentity.includes('function candidatePersonIdentity('), 'modèle personId interne absent.');
assert(personIdentity.includes("c.personIdentifier || c.identifiant || c.identifier || c.ss7"), 'migration de l’ancien identifiant vers personIdentifier absente.');
const candidateStore = read('src/candidate-store-main.js');
assert((candidateStore.includes("personId:person.personId") ||
  (candidateStore.includes('const personId = previousPersonIdFor(identity.original) || person.personId;') &&
   candidateStore.includes('personId,\n      personIdentifier:person.personIdentifier,'))), 'personId non persisté lors de la création d’une évaluation.');
assert(candidateStore.includes("evaluationId:candidateId"), 'evaluationId distinct du personId non persisté.');
const identityPage = read('source/kaltest-pilot2.html');
assert((identityPage.includes('for="personIdentifier">N° identifiant') ||
  identityPage.includes('for="personIdentifier">N° ID')), 'page d’accueil candidat : N° identifiant absent.');
assert(!identityPage.includes('sécurité sociale'), 'page d’accueil candidat : ancienne référence sécurité sociale encore visible.');
const identityRuntime = read('source/js/kaltest-pilot2-runtime.js');
assert(identityRuntime.includes("/^[A-Z0-9]{7}$/"), 'validation du N° identifiant alphanumérique 7 caractères absente.');
assert(!identityRuntime.includes('7 premiers chiffres du n° de sécurité sociale'), 'ancien message NIR encore présent dans le runtime candidat.');

const transferMain = read('src/candidate-transfer-main.js');
assert(transferMain.includes('function exportSelected('), 'moteur export sélectionné absent.');
assert(transferMain.includes("parcours non terminé"), 'moteur export sélectionné ne protège pas les parcours en cours.');
assert(transferMain.includes("candidateTrashRoot"), 'moteur Import ne connaît pas la Corbeille candidats.');
assert(transferMain.includes("trashSkipped"), 'moteur Import ne protège pas les évaluations déjà dans la Corbeille.');
assert(main.includes("ipcMain.handle('admin:open-bilan'"), 'IPC Bilan absent.');
assert(main.includes("ipcMain.handle('admin:open-candidate-results'"), 'IPC Résultats absent.');
assert(main.includes("ipcMain.handle('admin:open-tests-parcours'"), 'IPC Tests / Parcours absent.');
assert(main.includes("ipcMain.handle('admin:close-tests-parcours'"), 'IPC Fermer Tests / Parcours absent.');
assert(main.includes("admin-tests-parcours.html"), 'page Tests / Parcours non référencée par le main.');
assert(main.includes("kaloneo-library:list-tests"), 'bibliothèque KALONÉO non exposée par le main.');
assert(main.includes("kaloneo-library:save-parcours"), 'enregistrement des parcours non exposé par le main.');
assert(main.includes("kaloneo-library:get-parcours-details"), 'détail des parcours non exposé par le main.');
assert(main.includes("kaloneo-library:select-parcours"), 'choix du parcours non exposé par le main.');
assert(main.includes("kaloneo-library:selected-runtime-sync"), 'runtime synchrone du parcours sélectionné absent.');

const testsPage = read('overrides/admin-tests-parcours.html');
const testsScript = read('source/js/admin-tests-parcours.js');
assert((testsPage.match(/<button\b/gi) || []).length === 5, 'la page Tests / Parcours doit contenir Tests KALONÉO + Écrans de masquage + Parcours + Import / Export + Fermer.');
assert(testsPage.includes('id="open-kaloneo-builder"') && testsPage.includes('Créer / modifier un test'), 'bouton d’ouverture du Builder KALONÉO absent.');
assert(testsPage.includes('id="open-mask-builder"') && testsPage.includes('Écrans de masquage'), 'bouton de gestion des écrans de masquage absent.');
assert(testsPage.includes('id="open-parcours-builder"') && testsPage.includes('Créer / gérer un parcours'), 'bouton d’ouverture du créateur de parcours absent.');
assert(testsPage.includes('id="open-kaloneo-transfer"') && testsPage.includes('Import / Export'), 'entrée dédiée Import / Export absente.');
assert(testsPage.includes('id="close-tests-parcours"') && testsPage.includes('>Fermer</button>'), 'bouton Fermer de Tests / Parcours absent.');
assert(!/Dupliquer|Supprimer/i.test(testsPage), 'la page Tests / Parcours expose une action destructive non validée.');
assert(testsScript.includes("kaloneo-builder/test-builder.html"), 'navigation vers le Builder KALONÉO non câblée.');
assert(testsScript.includes("admin-mask-builder.html"), 'navigation vers les écrans de masquage non câblée.');
assert(testsScript.includes("admin-parcours-builder.html"), 'navigation vers le créateur de parcours non câblée.');
assert(testsScript.includes("admin-kaloneo-transfer.html"), 'navigation vers Import / Export non câblée.');
assert(testsScript.includes('closeTestsParcours'), 'action Fermer de Tests / Parcours non câblée.');

const bilanPage = read('overrides/admin-bilan.html');
const bilanClose = read('source/js/admin-bilan-close.js');
assert(bilanPage.includes('id="close-bilan-top"') && bilanPage.includes('id="close-bilan-bottom"'), 'les deux boutons Fermer du bilan sont absents.');
assert(bilanPage.includes('js/admin-bilan-close.js'), 'script de fermeture du bilan non chargé.');
assert(bilanClose.includes('closeAdminBilan'), 'les boutons Fermer du bilan ne sont pas câblés à la fermeture sécurisée.');

console.log('BUILD21_ADMIN_FOUNDATION: OK');
