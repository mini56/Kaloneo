const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const registerCandidateCatalog = require('../src/candidate-catalog-main');
const registerBilanHistory = require('../src/bilan-history-main');
const { codedFolderName } = require('../src/candidate-folder-utils');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'seb-evalpro-candidate-catalog-'));
const documentsPath = path.join(root, 'Documents');
const userDataPath = path.join(root, 'UserData');
const sebRoot = path.join(documentsPath, 'SEB EvalPro');
const legacyDir = path.join(sebRoot, 'Admin', 'Ancien groupe', 'XX_YY_ancien');
const replayRoot = path.join(sebRoot, 'parcours');
const bilanRoot = path.join(sebRoot, 'Bilans', 'Historique');

const candidate = {
  nom:'XX',
  prenom:'YY',
  lieu:'Lorient',
  groupe:'7',
  date:'2026-09-18',
  naissance:'1980-01-01',
  ss7:'0123456',
  parcours:'Parcours long'
};

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive:true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2), 'utf8');
}

try {
  for (const rel of ['donnees','resultats','replay',path.join('bilan','historique'),path.join('bilan','exports')]) {
    fs.mkdirSync(path.join(legacyDir, rel), { recursive:true });
  }

  writeJson(path.join(legacyDir, 'manifest.json'), {
    schemaVersion:1,
    candidateId:'candidate-xx',
    folderName:path.basename(legacyDir),
    status:'SESSION_FERMEE',
    updatedAt:'2026-09-18T18:00:00.000Z',
    candidat:{ ...candidate, 'prénom':candidate.prenom }
  });
  writeJson(path.join(legacyDir, 'donnees', 'evaluation-state.json'), { version:1 });

  const replayName = 'XX_JEAN_2026-09-18_BUILD-24_TEST';
  const replayDir = path.join(replayRoot, replayName);
  writeJson(path.join(replayDir, 'manifest.json'), {
    schemaVersion:2,
    type:'SEB_EVALPRO_PARCOURS_ARCHIVE',
    candidate
  });
  fs.mkdirSync(path.join(replayDir, 'slides'), { recursive:true });
  fs.writeFileSync(path.join(replayDir, 'slides', '001.png'), 'fake', 'utf8');

  const legacyWordName = 'Evaluation_XX_YY_2026-09-18.doc';
  fs.mkdirSync(path.join(sebRoot, 'Bilans'), { recursive:true });
  fs.writeFileSync(path.join(sebRoot, 'Bilans', legacyWordName), '<html><table><tr><td>ancien Word</td></tr></table></html>', 'utf8');

  const bilanName = 'XX_JEAN_2026-09-18_BUILD-24_BILAN_R00_TEST.json';
  writeJson(path.join(bilanRoot, bilanName), {
    schemaVersion:1,
    type:'SEB_EVALPRO_BILAN_ARCHIVE',
    candidate,
    revision:0,
    originalBuild:'24',
    createdAt:'2026-09-18T18:30:00.000Z',
    integritySha256:'corrompu-volontairement',
    document:{ rows:[{ kind:'item', key:'x' }] }
  });

  const handlers = new Map();
  const listeners = new Map();
  const ipcMain = {
    handle(name, fn) { handlers.set(name, fn); },
    on(name, fn) { listeners.set(name, fn); }
  };
  const app = {
    getPath(name) {
      if (name === 'documents') return documentsPath;
      if (name === 'userData') return userDataPath;
      if (name === 'temp') return path.join(root, 'Temp');
      throw new Error('Chemin non simulé: ' + name);
    }
  };

  let activeCandidateForDelete = null;
  registerCandidateCatalog({
    app,
    ipcMain,
    getAdminUnlocked:() => true,
    getAdminDocumentPassword:() => 'SVG56',
    getActiveCandidate:() => activeCandidateForDelete,
    dataRoot:sebRoot
  });
  registerBilanHistory({
    app,
    ipcMain,
    getAdminUnlocked:() => true,
    buildNumber:'79',
    dataRoot:sebRoot
  });

  const list = handlers.get('candidate-catalog:list');
  const detail = handlers.get('candidate-catalog:detail');
  const listPersons = handlers.get('candidate-catalog:list-persons');
  const personDetail = handlers.get('candidate-catalog:person-detail');
  const loadBilan = handlers.get('candidate-catalog:load-bilan');
  const beginBilan = handlers.get('candidate-catalog:begin-bilan');
  const beginResults = handlers.get('candidate-catalog:begin-results');
  const endResults = handlers.get('candidate-catalog:end-results');
  const loadResultsWorkspaceSync = listeners.get('candidate-catalog:results-workspace-load-sync');
  const saveWorkspace = handlers.get('candidate-catalog:workspace-save');
  const endBilan = handlers.get('candidate-catalog:end-bilan');
  const loadWorkspaceSync = listeners.get('candidate-catalog:workspace-load-sync');
  const saveWorkspaceSync = listeners.get('candidate-catalog:workspace-save-sync');
  const sync = handlers.get('candidate-catalog:sync');
  const deleteCandidate = handlers.get('candidate-catalog:delete');
  const deletePerson = handlers.get('candidate-catalog:delete-person');
  const trashList = handlers.get('candidate-catalog:trash-list');
  const trashRestore = handlers.get('candidate-catalog:trash-restore');
  const trashEmpty = handlers.get('candidate-catalog:trash-empty');
  const saveCurrentBilan = handlers.get('bilan-history:save-current');
  const saveBilanRevision = handlers.get('bilan-history:save-revision');
  assert(list && listPersons && personDetail && detail && loadBilan && beginBilan && beginResults && endResults && loadResultsWorkspaceSync && saveWorkspace && endBilan && loadWorkspaceSync && saveWorkspaceSync && sync && deleteCandidate && deletePerson && trashList && trashRestore && trashEmpty && saveCurrentBilan && saveBilanRevision, 'Handlers catalogue/bilan/résultats/corbeille absents.');

  const first = list();
  assert.strictEqual(first.length, 1, 'Le candidat historique doit être migré une seule fois.');
  assert.strictEqual(first[0].candidateId, 'candidate-xx');
  assert.strictEqual(first[0].replayCount, 1, 'Le parcours historique doit être rattaché au dossier candidat.');
  assert.strictEqual(first[0].bilanCount, 1, 'Le bilan historique doit être rattaché au dossier candidat.');
  assert.strictEqual(first[0].parcours, 'Parcours long', 'Le nom du parcours effectué doit être exposé dans la fiche candidat.');
  assert.strictEqual(first[0].personIdentifier, '0123456', 'L’ancien champ ss7 doit être migré vers N° identifiant sans perdre sa valeur.');
  assert(/^PERS-[A-F0-9]{24}$/.test(first[0].personId), 'Un personId interne stable doit être attribué au candidat.');
  const firstPersons = listPersons();
  assert.strictEqual(firstPersons.length, 1, 'Une seule personne doit être visible pour la première évaluation.');
  assert.strictEqual(firstPersons[0].evaluationCount, 1);
  assert.strictEqual(firstPersons[0].personIdentifier, '0123456');

  const newDir = path.join(sebRoot, 'Candidats', codedFolderName('candidate-xx'));
  assert(fs.existsSync(newDir), 'La copie autonome du candidat doit exister.');
  assert(fs.existsSync(legacyDir), 'Le dossier historique Admin doit rester intact.');
  assert(fs.existsSync(path.join(newDir, 'replay', replayName)), 'Le replay doit être migré dans le dossier candidat.');
  assert(fs.existsSync(path.join(newDir, 'bilan', 'historique', bilanName)), 'Le bilan doit être migré dans le dossier candidat.');
  assert(fs.existsSync(path.join(newDir, 'bilan', 'exports', legacyWordName)), 'Un ancien Word associable sans ambiguïté doit être copié dans le dossier candidat.');
  assert(fs.existsSync(path.join(sebRoot, 'Bilans', legacyWordName)), 'L’ancien Word global doit rester intact pendant la migration de sécurité.');

  // Une nouvelle évaluation de la même personne doit rester un dossier distinct.
  const separateDir = path.join(sebRoot, 'Candidats', codedFolderName('candidate-xx-second'));
  for (const rel of ['donnees','resultats','replay',path.join('bilan','historique'),path.join('bilan','exports')]) {
    fs.mkdirSync(path.join(separateDir, rel), { recursive:true });
  }
  const secondCandidate = {
    ...candidate,
    ss7:undefined,
    personIdentifier:'0123456',
    date:'2026-09-20',
    parcours:'Parcours court'
  };
  writeJson(path.join(separateDir, 'manifest.json'), {
    schemaVersion:1,
    candidateId:'candidate-xx-second',
    folderName:path.basename(separateDir),
    status:'TERMINE',
    createdAt:'2026-09-20T08:00:00.000Z',
    updatedAt:'2026-09-20T10:00:00.000Z',
    candidat:{ ...secondCandidate, 'prénom':secondCandidate.prenom }
  });
  writeJson(path.join(separateDir, 'donnees', 'candidat.json'), { ...secondCandidate, 'prénom':secondCandidate.prenom });
  writeJson(path.join(separateDir, 'donnees', 'evaluation-state.json'), { version:1, sessionStorage:{ candidat_data:JSON.stringify(secondCandidate) }, localStorage:{}, lastPage:'pageFinale.html', lastEvaluationPage:'pageFinale.html' });
  writeJson(path.join(separateDir, 'donnees', 'progression.json'), { lastPage:'pageFinale.html', lastEvaluationPage:'pageFinale.html' });
  writeJson(path.join(separateDir, 'resultats', 'reponses.json'), { second_evaluation:true });
  writeJson(path.join(separateDir, 'resultats', 'scores.json'), { second_evaluation:1 });

  const separateSync = sync();
  assert(separateSync && separateSync.ok && separateSync.consolidatedDuplicates === 0, 'Deux candidateId différents ne doivent jamais être fusionnés.');
  assert(fs.existsSync(newDir), 'Le premier parcours doit rester intact.');
  assert(fs.existsSync(separateDir), 'La seconde évaluation doit rester intacte.');
  assert.strictEqual(list().length, 2, 'La même personne évaluée à nouveau doit rester dans deux dossiers techniques distincts.');
  const groupedAfterSecond = listPersons();
  assert.strictEqual(groupedAfterSecond.length, 1, 'Deux évaluations de la même personne doivent être regroupées sur une seule ligne candidat.');
  assert.strictEqual(groupedAfterSecond[0].evaluationCount, 2, 'La fiche candidat doit annoncer ses deux évaluations.');
  assert.deepStrictEqual(
    groupedAfterSecond[0].evaluations.map((item) => item.candidateId).sort(),
    ['candidate-xx','candidate-xx-second'].sort(),
    'Les deux candidateId doivent rester séparés à l’intérieur de la même personne.'
  );

  // Même N° identifiant de test, mais autre nom : surtout ne pas fusionner.
  const collisionDir = path.join(sebRoot, 'Candidats', codedFolderName('candidate-other-name'));
  for (const rel of ['donnees','resultats','replay',path.join('bilan','historique'),path.join('bilan','exports')]) {
    fs.mkdirSync(path.join(collisionDir, rel), { recursive:true });
  }
  const collisionCandidate = {
    nom:'AUTRE',
    prenom:'PERSONNE',
    naissance:'1980-01-01',
    personIdentifier:'0123456',
    lieu:'Lorient',
    groupe:'7',
    date:'2026-09-21',
    parcours:'Parcours collision'
  };
  writeJson(path.join(collisionDir, 'manifest.json'), {
    schemaVersion:1,
    candidateId:'candidate-other-name',
    folderName:path.basename(collisionDir),
    status:'TERMINE',
    createdAt:'2026-09-21T08:00:00.000Z',
    updatedAt:'2026-09-21T10:00:00.000Z',
    candidat:{ ...collisionCandidate, 'prénom':collisionCandidate.prenom }
  });
  writeJson(path.join(collisionDir, 'donnees', 'candidat.json'), { ...collisionCandidate, 'prénom':collisionCandidate.prenom });
  writeJson(path.join(collisionDir, 'donnees', 'evaluation-state.json'), { version:1, sessionStorage:{ candidat_data:JSON.stringify(collisionCandidate) }, localStorage:{} });
  writeJson(path.join(collisionDir, 'donnees', 'progression.json'), {});
  writeJson(path.join(collisionDir, 'resultats', 'reponses.json'), {});
  writeJson(path.join(collisionDir, 'resultats', 'scores.json'), {});

  const personsWithCollision = listPersons();
  assert.strictEqual(personsWithCollision.length, 2, 'Le même N° identifiant avec un autre nom doit produire deux candidats séparés.');
  assert(personsWithCollision.every((person) => person.personIdentifier === '0123456'), 'Les deux candidats de test doivent conserver le même N° identifiant.');
  assert(personsWithCollision.every((person) => person.identifierCollision === true), 'La collision d’identifiant doit être signalée sans fusion automatique.');
  const xxPerson = personsWithCollision.find((person) => person.nom === 'XX');
  assert(xxPerson && xxPerson.evaluationCount === 2, 'Les deux évaluations de XX doivent rester regroupées malgré la collision avec un autre nom.');
  const xxPersonDetail = personDetail(null, xxPerson.personId);
  assert(xxPersonDetail && xxPersonDetail.ok && xxPersonDetail.person.evaluations.length === 2, 'La fiche personne doit exposer ses évaluations séparées.');

  fs.rmSync(collisionDir, { recursive:true, force:true });
  fs.rmSync(separateDir, { recursive:true, force:true });

  const duplicateDir = path.join(sebRoot, 'Candidats', codedFolderName('candidate-xx') + '_2');
  for (const rel of ['donnees','resultats','replay',path.join('bilan','historique'),path.join('bilan','exports')]) {
    fs.mkdirSync(path.join(duplicateDir, rel), { recursive:true });
  }
  writeJson(path.join(duplicateDir, 'manifest.json'), {
    schemaVersion:1,
    candidateId:'candidate-xx',
    folderName:path.basename(duplicateDir),
    status:'EN_COURS',
    createdAt:'2026-09-19T08:00:00.000Z',
    updatedAt:'2026-09-19T08:00:00.000Z',
    candidat:{ ...candidate, 'prénom':candidate.prenom }
  });
  writeJson(path.join(duplicateDir, 'donnees', 'candidat.json'), { ...candidate, 'prénom':candidate.prenom });
  writeJson(path.join(duplicateDir, 'donnees', 'evaluation-state.json'), {
    version:1,
    sessionStorage:{
      candidat_data:JSON.stringify({ ...candidate, 'prénom':candidate.prenom }),
      reponses_data:JSON.stringify({ duplicate_only:'OK' }),
      scores_data:JSON.stringify({ duplicate_only:1 }),
      admin_bilan_state:JSON.stringify({ duplicate_only:true })
    },
    localStorage:{ duplicate_local:'OK' },
    lastPage:'pageFinale.html',
    lastEvaluationPage:'pageFinale.html',
    updatedAt:'2026-09-19T08:00:00.000Z'
  });
  writeJson(path.join(duplicateDir, 'donnees', 'progression.json'), { lastPage:'pageFinale.html', lastEvaluationPage:'pageFinale.html' });
  writeJson(path.join(duplicateDir, 'resultats', 'reponses.json'), { duplicate_only:'OK' });
  writeJson(path.join(duplicateDir, 'resultats', 'scores.json'), { duplicate_only:1 });
  writeJson(path.join(duplicateDir, 'replay', 'DUPLICATE_ONLY.json'), { candidate, source:'duplicate' });

  const consolidated = sync();
  assert(consolidated && consolidated.ok && consolidated.consolidatedDuplicates === 1, 'Le catalogue doit consolider automatiquement un doublon du même candidat.');
  assert.strictEqual(fs.existsSync(duplicateDir), false, 'Le doublon ne doit plus rester dans Candidats.');
  const duplicateArchiveRoot = path.join(sebRoot, 'Corbeille', 'Doublons');
  assert(fs.existsSync(duplicateArchiveRoot), 'Le doublon doit être archivé sans destruction.');
  assert(fs.readdirSync(duplicateArchiveRoot).some((name) => name.startsWith(codedFolderName('candidate-xx') + '__DUP-')), 'Le doublon technique du même candidateId doit être conservé dans Corbeille\\Doublons sous un nom codé.');
  const mergedDuplicateResponses = JSON.parse(fs.readFileSync(path.join(newDir, 'resultats', 'reponses.json'), 'utf8'));
  assert.strictEqual(mergedDuplicateResponses.duplicate_only, 'OK', 'Les réponses présentes uniquement dans le doublon doivent être récupérées.');
  const mergedState = JSON.parse(fs.readFileSync(path.join(newDir, 'donnees', 'evaluation-state.json'), 'utf8'));
  assert(mergedState.sessionStorage && mergedState.sessionStorage.admin_bilan_state, 'Les données de bilan présentes dans le doublon doivent être conservées.');
  assert(fs.existsSync(path.join(newDir, 'replay', 'DUPLICATE_ONLY.json')), 'Le replay du doublon doit être récupéré dans le dossier unique.');
  assert.strictEqual(list().length, 1, 'Après consolidation, un candidat ne doit apparaître qu’une seule fois.');

  writeJson(path.join(newDir, 'resultats', 'reponses.json'), { duplicate_only:'OK', page2_q1:'1020', page2_q2:'1250' });
  writeJson(path.join(newDir, 'resultats', 'scores.json'), { page2_q1:1, page2_q2:1 });
  const stateBeforeResults = fs.readFileSync(path.join(newDir, 'donnees', 'evaluation-state.json'), 'utf8');

  const preparedResults = beginResults(null, 'candidate-xx');
  assert(preparedResults && preparedResults.ok, 'Les résultats du candidat doivent pouvoir être ouverts indépendamment d’une session active.');
  const resultsEvent = { returnValue:null };
  loadResultsWorkspaceSync(resultsEvent);
  assert(resultsEvent.returnValue && resultsEvent.returnValue.ok && resultsEvent.returnValue.readOnly === true, 'Le workspace Résultats doit être disponible en lecture seule.');
  assert.strictEqual(resultsEvent.returnValue.candidateId, 'candidate-xx', 'Les résultats doivent appartenir au candidat sélectionné.');
  const resultsCandidate = JSON.parse(resultsEvent.returnValue.state.sessionStorage.candidat_data);
  const resultsResponses = JSON.parse(resultsEvent.returnValue.state.sessionStorage.reponses_data);
  const resultsScores = JSON.parse(resultsEvent.returnValue.state.sessionStorage.scores_data);
  assert.strictEqual(resultsCandidate.nom, 'XX');
  assert.strictEqual(resultsCandidate['prénom'], 'YY');
  assert.strictEqual(resultsResponses.page2_q1, '1020');
  assert.strictEqual(resultsScores.page2_q1, 1);
  assert.strictEqual(endResults(), true, 'La fermeture du workspace Résultats doit réussir.');
  const resultsAfterEnd = { returnValue:null };
  loadResultsWorkspaceSync(resultsAfterEnd);
  assert(resultsAfterEnd.returnValue && resultsAfterEnd.returnValue.ok === false, 'Le workspace Résultats fermé ne doit plus exposer de candidat.');
  assert.strictEqual(fs.readFileSync(path.join(newDir, 'donnees', 'evaluation-state.json'), 'utf8'), stateBeforeResults, 'Ouvrir les résultats ne doit jamais modifier l’état du candidat.');

  const d = detail(null, 'candidate-xx');
  assert(d && d.ok);
  assert.strictEqual(d.candidate.parcours, 'Parcours long');
  assert.strictEqual(d.bilans.length, 1);
  assert.strictEqual(d.bilans[0].integrityOk, false, 'Un bilan corrompu doit être signalé.');

  const prepared = beginBilan(null, 'candidate-xx');
  assert(prepared && prepared.ok, 'Le candidat doit pouvoir ouvrir un espace de bilan même sans dépendre d’une session active.');

  const loadEvent = { returnValue:null };
  loadWorkspaceSync(loadEvent);
  assert(loadEvent.returnValue && loadEvent.returnValue.ok, 'Les données du candidat sélectionné doivent être chargées pour le bilan.');
  assert.strictEqual(loadEvent.returnValue.candidateId, 'candidate-xx');
  const loadedCandidate = JSON.parse(loadEvent.returnValue.state.sessionStorage.candidat_data);
  assert.strictEqual(loadedCandidate.nom, 'XX');
  assert.strictEqual(loadedCandidate.prenom || loadedCandidate['prénom'], 'YY');
  assert.strictEqual(loadEvent.returnValue.state.sessionStorage.seb_evalpro_admin_candidate_id, 'candidate-xx');

  const originalDocument = {
    title:'Bilan institutionnel',
    headers:['Modules','NE','I','II','III','Commentaires'],
    rows:[{ kind:'item', key:'test', moduleText:'Test', level:'I', preset:'', comment:'Original', detail:'', options:[] }]
  };
  const firstBilan = saveCurrentBilan(null, {
    candidateId:'candidate-xx',
    candidate:{ nom:'XX', prenom:'YY', date:'2026-09-18' },
    originalBuild:'79',
    sessionToken:'candidate-xx-smoke',
    document:originalDocument
  });
  assert(firstBilan && firstBilan.ok && firstBilan.revision === 0, 'Le bilan original doit être archivé directement dans le dossier candidat sélectionné.');
  const firstArchive = JSON.parse(fs.readFileSync(path.join(newDir, 'bilan', 'historique', firstBilan.filename), 'utf8'));
  assert.strictEqual(firstArchive.candidateId, 'candidate-xx', 'L’archive doit mémoriser le dossier candidat exact.');

  // Un Word existant et son compagnon chiffre doivent disparaitre au
  // remplacement du bilan, sans toucher au Replay ni a un autre parcours.
  const wordBase='Evaluation_XX_JEAN_2026-09-18.doc';
  const previousWords=[wordBase,'Evaluation_XX_JEAN_2026-09-18_2.doc',
    'Evaluation_XX_JEAN_2026-09-18_R01.doc','Evaluation_TEST.sebword'];
  for(const name of previousWords)
    fs.writeFileSync(path.join(newDir,'bilan','exports',name),'ancien Word','utf8');
  const revisionDocument={
    ...originalDocument,
    rows:[{...originalDocument.rows[0],comment:'Version corrigee'}]
  };
  const revision=saveBilanRevision(null,{sourceFilename:firstBilan.filename,document:revisionDocument});
  assert(revision&&revision.ok&&revision.revision===0,'Le nouveau bilan remplace l ancien sans creer de revision.');
  assert(fs.existsSync(path.join(newDir,'bilan','historique',revision.filename)),'Dernier bilan non conserve.');
  assert(!fs.existsSync(path.join(newDir,'bilan','historique',firstBilan.filename)),'Ancien bilan non supprime.');
  for(const name of previousWords)
    assert(!fs.existsSync(path.join(newDir,'bilan','exports',name)),'Ancien Word conserve : '+name);
  const afterBilan=detail(null,'candidate-xx');
  assert(afterBilan&&afterBilan.ok);
  assert.strictEqual(afterBilan.bilans.filter(x=>x.integrityOk).length,1,'Un seul bilan courant doit etre visible.');
  assert.strictEqual(afterBilan.candidate.revisionCount,0,'Les revisions ne doivent plus etre exposees.');
  assert.strictEqual(afterBilan.candidate.bilanCount,1,'Une evaluation ne compte qu un seul bilan.');
  assert.deepStrictEqual(afterBilan.exports,[],'Le Word doit etre regenere apres enregistrement.');
  assert(fs.existsSync(path.join(newDir,'replay',replayName)),'Le Replay doit rester intact.');
  assert(fs.existsSync(path.join(separateDir,'manifest.json')),'L autre evaluation doit etre preservee.');
  const sameBilan=saveBilanRevision(null,{sourceFilename:revision.filename,document:revisionDocument});
  assert(sameBilan.ok&&sameBilan.unchanged,'Une sauvegarde identique ne doit pas creer un nouveau bilan.');
  assert.strictEqual(detail(null,'candidate-xx').bilans.length,1,'La sauvegarde identique ne cree aucun historique.');
  // Le dernier Word associe est visible lorsqu'il est le seul document disponible.
  const currentWord='Evaluation_CURRENT.sebdoc';
  fs.writeFileSync(path.join(newDir,'bilan','exports',currentWord),'chiffre fictif','utf8');
  assert.deepStrictEqual(detail(null,'candidate-xx').exports,[currentWord]);
  const updatedDocument={
    ...revisionDocument,
    rows:[{...revisionDocument.rows[0],comment:'Nouveau contenu pour le meme parcours'}]
  };
  const otherSession=saveCurrentBilan(null,{
    candidateId:'candidate-xx',candidate:{nom:'XX',prenom:'YY',date:'2026-09-18'},
    originalBuild:'80',sessionToken:'NEW-UNRELATED-REPLAY-TOKEN',document:updatedDocument
  });
  assert(otherSession&&otherSession.ok&&otherSession.revision===0,
    'Un changement de jeton de session ne doit pas creer de revision.');
  assert(!fs.existsSync(path.join(newDir,'bilan','exports',currentWord)),
    'Word perime non supprime au nouveau bilan courant.');
  assert(!fs.existsSync(path.join(newDir,'bilan','historique',revision.filename)),
    'Dernier ancien bilan non efface apres changement de jeton.');
  assert.strictEqual(detail(null,'candidate-xx').bilans.length,1);
  assert.strictEqual(detail(null,'candidate-xx').exports.length,0);
  assert.strictEqual(fs.readdirSync(path.join(newDir,'bilan','historique')).filter(n=>n.endsWith('.json')).length,1,'Migration ancienne ne doit jamais recreer des revisions.');
  assert.strictEqual(fs.readdirSync(path.join(newDir,'bilan','exports')).filter(n=>/^Evaluation_/i.test(n)).length,0,'Migration ancienne ne doit jamais recreer des Word caducs.');
  assert(fs.existsSync(path.join(newDir,'replay',replayName)),
    'La sauvegarde du bilan ne doit jamais supprimer le Replay.');
  assert(fs.existsSync(path.join(separateDir,'manifest.json')),
    'La sauvegarde ne doit jamais supprimer un autre parcours du meme candidat.');

  
  const modifiedState = {
    ...loadEvent.returnValue.state,
    sessionStorage:{
      ...loadEvent.returnValue.state.sessionStorage,
      admin_bilan_state:JSON.stringify({ rows:{ test:{ level:'I' } } })
    }
  };
  const savedAsync = saveWorkspace(null, modifiedState);
  assert(savedAsync && savedAsync.ok, 'La sauvegarde du bilan sélectionné doit être acceptée.');
  const persisted = JSON.parse(fs.readFileSync(path.join(newDir, 'donnees', 'evaluation-state.json'), 'utf8'));
  assert.strictEqual(persisted.sessionStorage.admin_bilan_state, modifiedState.sessionStorage.admin_bilan_state, 'Le bilan doit être sauvegardé dans le dossier du candidat sélectionné.');

  const saveEvent = { returnValue:null };
  saveWorkspaceSync(saveEvent, modifiedState);
  assert(saveEvent.returnValue && saveEvent.returnValue.ok, 'La sauvegarde synchrone du bilan sélectionné doit être acceptée.');

  assert.strictEqual(endBilan(), true, 'La fermeture de l’espace bilan doit réussir.');
  const afterEnd = { returnValue:null };
  loadWorkspaceSync(afterEnd);
  assert(afterEnd.returnValue && afterEnd.returnValue.ok === false, 'L’espace bilan fermé ne doit plus exposer de candidat sélectionné.');

  const corrupt = loadBilan(null, 'candidate-xx', bilanName);
  assert(corrupt && corrupt.ok === false && corrupt.corruption === true, 'Un bilan corrompu doit être refusé avec avertissement.');
  assert(/ATTENTION/i.test(corrupt.error) && /corruption/i.test(corrupt.error));

  // Le dossier candidat est la source opérationnelle : aucune copie inverse
  // vers les anciens dossiers globaux ne doit être recréée.
  const localOnlyReplay = path.join(newDir, 'replay', 'LOCAL_ONLY');
  fs.mkdirSync(localOnlyReplay, { recursive:true });
  writeJson(path.join(localOnlyReplay, 'manifest.json'), { candidate });
  sync();
  assert.strictEqual(fs.existsSync(path.join(replayRoot, 'LOCAL_ONLY')), false, 'Le replay candidat ne doit pas être recopié vers le stockage global.');

  const again = list();
  assert.strictEqual(again.length, 1, 'La migration automatique ne doit jamais dupliquer le candidat.');
  assert(fs.existsSync(newDir), 'Le dossier candidat doit exister avant suppression administrateur.');

  fs.mkdirSync(userDataPath, { recursive:true });
  writeJson(path.join(userDataPath, 'evaluation-state.json'), {
    version:1,
    sessionStorage:{ candidat_data:JSON.stringify(candidate) },
    localStorage:{}
  });

  // Distinguer suppression d’une évaluation et suppression globale du candidat.
  const finalSecondDir = path.join(sebRoot, 'Candidats', codedFolderName('candidate-xx-final-second'));
  for (const rel of ['donnees','resultats','replay',path.join('bilan','historique'),path.join('bilan','exports')]) {
    fs.mkdirSync(path.join(finalSecondDir, rel), { recursive:true });
  }
  const finalSecond = {
    ...candidate,
    ss7:undefined,
    personIdentifier:'0123456',
    groupe:'8',
    date:'2026-10-01',
    parcours:'Parcours supplémentaire'
  };
  writeJson(path.join(finalSecondDir, 'manifest.json'), {
    schemaVersion:1,
    candidateId:'candidate-xx-final-second',
    folderName:path.basename(finalSecondDir),
    status:'TERMINE',
    createdAt:'2026-10-01T08:00:00.000Z',
    updatedAt:'2026-10-01T10:00:00.000Z',
    candidat:{ ...finalSecond, 'prénom':finalSecond.prenom }
  });
  writeJson(path.join(finalSecondDir, 'donnees', 'candidat.json'), { ...finalSecond, 'prénom':finalSecond.prenom });
  writeJson(path.join(finalSecondDir, 'donnees', 'evaluation-state.json'), { version:1, sessionStorage:{ candidat_data:JSON.stringify(finalSecond) }, localStorage:{} });
  writeJson(path.join(finalSecondDir, 'donnees', 'progression.json'), {});
  writeJson(path.join(finalSecondDir, 'resultats', 'reponses.json'), {});
  writeJson(path.join(finalSecondDir, 'resultats', 'scores.json'), {});

  let groupedForDelete = listPersons();
  assert.strictEqual(groupedForDelete.length, 1);
  assert.strictEqual(groupedForDelete[0].evaluationCount, 2);

  const deletedEvaluation = deleteCandidate(null, 'candidate-xx-final-second');
  assert(deletedEvaluation && deletedEvaluation.ok === true && deletedEvaluation.movedToTrash === true, 'Supprimer une évaluation doit la placer dans la Corbeille.');
  assert.strictEqual(fs.existsSync(finalSecondDir), false, 'L’évaluation choisie ne doit plus rester dans la liste active.');
  assert.strictEqual(fs.existsSync(newDir), true, 'L’autre évaluation de la personne doit rester intacte.');
  let trash = trashList();
  assert(trash && trash.ok && trash.entries.length === 1, 'La Corbeille doit contenir l’évaluation supprimée.');
  assert.strictEqual(trash.entries[0].candidateId, 'candidate-xx-final-second');
  assert.strictEqual(trash.entries[0].parcours, 'Parcours supplémentaire');
  groupedForDelete = listPersons();
  assert.strictEqual(groupedForDelete.length, 1);
  assert.strictEqual(groupedForDelete[0].evaluationCount, 1);

  const restoredEvaluation = trashRestore(null, 'candidate-xx-final-second');
  assert(restoredEvaluation && restoredEvaluation.ok === true, 'Une évaluation supprimée doit pouvoir être restaurée.');
  assert.strictEqual(listPersons()[0].evaluationCount, 2, 'La restauration doit remettre l’évaluation dans la fiche candidat.');
  assert.strictEqual(trashList().entries.length, 0, 'La Corbeille doit redevenir vide après restauration.');

  // La supprimer à nouveau pour vérifier la suppression globale et le vidage définitif.
  const reDeletedEvaluation = deleteCandidate(null, 'candidate-xx-final-second');
  assert(reDeletedEvaluation && reDeletedEvaluation.ok === true);
  groupedForDelete = listPersons();
  assert.strictEqual(groupedForDelete[0].evaluationCount, 1);

  activeCandidateForDelete = { candidateId:'candidate-xx' };
  const refusedActiveDelete = deletePerson(null, groupedForDelete[0].personId);
  assert(refusedActiveDelete && refusedActiveDelete.ok === false, 'Le candidat ne doit pas pouvoir être placé en Corbeille si une évaluation est active.');
  assert(/active/i.test(String(refusedActiveDelete.error || '')), 'Le refus global doit indiquer qu’une évaluation est active.');
  assert.strictEqual(fs.existsSync(newDir), true, 'Le dossier actif doit rester intact après refus.');

  activeCandidateForDelete = null;
  const deleted = deletePerson(null, groupedForDelete[0].personId);
  assert(deleted && deleted.ok === true && deleted.movedEvaluations === 1, 'Supprimer le candidat doit placer toutes ses évaluations actives dans la Corbeille.');
  assert.strictEqual(fs.existsSync(newDir), false, 'Le dernier dossier actif du candidat doit quitter Candidats.');
  assert.strictEqual(list().length, 0, 'Le candidat mis en Corbeille ne doit plus apparaître dans le catalogue.');
  trash = trashList();
  assert(trash && trash.ok && trash.entries.length === 2, 'La Corbeille doit contenir les deux évaluations supprimées.');
  assert.strictEqual(fs.existsSync(legacyDir), true, 'Les anciennes copies ne doivent pas être détruites avant vidage définitif.');

  const emptied = trashEmpty();
  assert(emptied && emptied.ok === true && emptied.purged === 2, 'Vider la Corbeille doit supprimer définitivement les deux évaluations.');
  assert.strictEqual(trashList().entries.length, 0, 'La Corbeille doit être vide après vidage définitif.');
  assert.strictEqual(fs.existsSync(legacyDir), false, 'La copie historique Admin associée doit être supprimée uniquement au vidage définitif.');
  assert.strictEqual(fs.existsSync(path.join(replayRoot, replayName)), false, 'Le replay historique associé doit être supprimé au vidage définitif.');
  assert.strictEqual(fs.existsSync(path.join(bilanRoot, bilanName)), false, 'Le bilan historique global associé doit être supprimé au vidage définitif.');
  assert.strictEqual(fs.existsSync(path.join(sebRoot, 'Bilans', legacyWordName)), false, 'Le Word historique associé doit être supprimé au vidage définitif.');
  assert.strictEqual(fs.existsSync(path.join(userDataPath, 'evaluation-state.json')), false, 'L’état local associé doit être nettoyé au vidage définitif.');

  // Une synchronisation après vidage ne doit jamais ressusciter un ancien candidat.
  sync();
  assert.strictEqual(list().length, 0, 'Le candidat définitivement supprimé ne doit pas être recréé par la migration historique.');

  console.log('Candidate Catalog Person Grouping + Recoverable Trash + Permanent Purge Test: OK');
} finally {
  fs.rmSync(root, { recursive:true, force:true });
}
