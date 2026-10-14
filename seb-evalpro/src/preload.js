const { contextBridge, ipcRenderer } = require('electron');
const path = require('path');
const replayPrototype = require('./replay-preload');
const replayNavigationCapture = require('./replay-navigation-capture');
const bilanHistory = require('./bilan-history-preload');
const candidateCatalog = require('./candidate-catalog-preload');
const appPackage = require('../package.json');
const APP_BUILD_NUMBER = String(appPackage.sebBuildNumber || '').trim() || 'DEV';
const APP_BUILD_LABEL = `Build #${APP_BUILD_NUMBER}`;
// SEB_CANDIDATE_REPLAY_PROTO_PRELOAD
const editionCapabilities = ipcRenderer.sendSync('app:edition-sync') || {
  edition:'unified', canBilan:true, canAi:true, canImport:true, canExport:true
};

const BAR_HEIGHT = 44;
// SEB_PRIORITY_FIXES_PRELOAD
const HOTZONE_HEIGHT = 5;
const BAR_HIDE_DELAY = 1000;
const SAVE_DEBOUNCE_MS = 750;
const SAVE_CHECKPOINT_MS = 5000;
let restoredState = {};
let adminUnlocked = false;
let saveTimer = null;
let periodicSaveTimer = null;
let saveDirty = true;
let saveInFlight = null;
let saveAfterFlight = false;
let lastSavedFingerprint = '';
let barHideTimer = null;
let closingSession = false;
let lastSaveErrorShown = '';
let adminCandidateWorkspace = null;
let adminCandidateResultsWorkspace = null;
let adminNavigationLeaving = false;
let candidateJourneyCompleted = false;
let candidateCompletionInFlight = false;
let candidateExportAction = null;
let candidateImportAction = null;

function objectToStorage(storage, values) {
  if (!storage || !values || typeof values !== 'object') return;
  for (const [key, value] of Object.entries(values)) {
    try {
      storage.setItem(key, String(value));
    } catch (_) {}
  }
}

function storageToObject(storage) {
  const out = {};
  try {
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      out[key] = storage.getItem(key);
    }
  } catch (_) {}
  return out;
}

function pageName() {
  try {
    return path.basename(decodeURIComponent(window.location.pathname)) || 'qcmv1.0.html';
  } catch (_) {
    return 'qcmv1.0.html';
  }
}

const KALONEO_RESULTS_MANIFEST_KEY = 'seb_kaloneo_results_manifest';

function ensureKaloneoResultsManifest() {
  if (adminCandidateWorkspace || adminCandidateResultsWorkspace) return null;
  if (isAdminCandidatesPage() || isTestsParcoursWorkspacePage() || isAdminBilanPage()) return null;

  try {
    const existingRaw = window.sessionStorage.getItem(KALONEO_RESULTS_MANIFEST_KEY);
    if (existingRaw) {
      const existing = JSON.parse(existingRaw);
      if (existing && Array.isArray(existing.tests) && existing.tests.length) return existing;
    }
  } catch (_) {}

  try {
    const selected = ipcRenderer.sendSync('kaloneo-library:selected-runtime-sync');
    const runtime = selected && selected.ok === true ? selected.runtime : null;
    if (!runtime || !Array.isArray(runtime.tests)) return null;

    const manifest = {
      schemaVersion:1,
      parcoursId:String(runtime.id || ''),
      parcoursTitle:String(runtime.title || runtime.id || ''),
      tests:runtime.tests.map((test) => ({
        id:String(test && test.id || ''),
        version:String(test && test.version || ''),
        title:String(test && test.title || test && test.id || ''),
        category:String(test && test.category || 'Autres'),
        scored:test && test.scored !== false
      })).filter((test) => test.id && String(test.category || '').toLowerCase() !== 'transition'),
      capturedAt:new Date().toISOString()
    };
    window.sessionStorage.setItem(KALONEO_RESULTS_MANIFEST_KEY, JSON.stringify(manifest));
    return manifest;
  } catch (_) {
    return null;
  }
}

function isAdminBilanPage(page = pageName()) {
  return ['admin-bilan.html', 'bilan.html'].includes(String(page || '').toLowerCase());
}

function isAdminCandidatesPage(page = pageName()) {
  return String(page || '').toLowerCase() === 'admin-candidats.html';
}

function isAdminTestsParcoursPage(page = pageName()) {
  return String(page || '').toLowerCase() === 'admin-tests-parcours.html';
}

function isAdminParcoursBuilderPage(page = pageName()) {
  return String(page || '').toLowerCase() === 'admin-parcours-builder.html';
}

function isAdminKaloneoBuilderPage(page = pageName()) {
  return String(page || '').toLowerCase() === 'test-builder.html';
}

function isAdminMaskBuilderPage(page = pageName()) {
  return ['admin-mask-builder.html','admin-mask-preview.html'].includes(String(page || '').toLowerCase());
}

function isAdminKaloneoBuilderPreviewPage(page = pageName()) {
  return String(page || '').toLowerCase() === 'test-preview.html';
}

function isKaloneoRealCandidatePreviewPage(page = pageName()) {
  return String(page||'').toLowerCase()==='kaltest-pilot2.html' &&
    new URLSearchParams(window.location.search).get('kaloneoPreview')==='1';
}

function isTestsParcoursWorkspacePage(page = pageName()) {
  return isAdminTestsParcoursPage(page) || isAdminParcoursBuilderPage(page) ||
    isAdminKaloneoBuilderPage(page) || isAdminMaskBuilderPage(page) ||
    isAdminKaloneoBuilderPreviewPage(page) || isKaloneoRealCandidatePreviewPage(page);
}

function isAdminNavigationPage(page = pageName()) {
  return isAdminBilanPage(page) || isAdminCandidatesPage(page) ||
    isTestsParcoursWorkspacePage(page);
}

function pageRoute() {
  const page = pageName();
  try {
    return page + String(window.location.search || '') + String(window.location.hash || '');
  } catch (_) {
    return page;
  }
}

function buildSnapshot() {
  const page = pageName();
  const route = pageRoute();
  const previousRoute = restoredState.lastEvaluationRoute || restoredState.lastRoute ||
    restoredState.lastEvaluationPage || restoredState.lastPage || 'qcmv1.0.html';
  return {
    ...restoredState,
    sessionStorage: storageToObject(window.sessionStorage),
    localStorage: storageToObject(window.localStorage),
    lastPage: isAdminNavigationPage(page)
      ? (restoredState.lastPage || restoredState.lastEvaluationPage || 'qcmv1.0.html')
      : page,
    lastEvaluationPage: isAdminNavigationPage(page)
      ? (restoredState.lastEvaluationPage || 'qcmv1.0.html')
      : page,
    lastRoute: isAdminNavigationPage(page) ? previousRoute : route,
    lastEvaluationRoute: isAdminNavigationPage(page) ? previousRoute : route
  };
}

function snapshotFingerprint(snapshot) {
  try {
    return JSON.stringify({
      sessionStorage: snapshot && snapshot.sessionStorage || {},
      localStorage: snapshot && snapshot.localStorage || {},
      lastPage: snapshot && snapshot.lastPage || '',
      lastEvaluationPage: snapshot && snapshot.lastEvaluationPage || '',
      lastRoute: snapshot && snapshot.lastRoute || '',
      lastEvaluationRoute: snapshot && snapshot.lastEvaluationRoute || ''
    });
  } catch (_) {
    return '';
  }
}

function handleSaveResult(result) {
  if (!result || result.ok !== false) {
    lastSaveErrorShown = '';
    return;
  }
  if (!result.error) return;
  const message = String(result.error);
  if (message === lastSaveErrorShown) return;
  lastSaveErrorShown = message;
  if (document && document.body) {
    showTransferMessage(
      'Attention — sauvegarde',
      message + '\n\nLes données déjà enregistrées restent conservées. SEB EvalPro réessaiera automatiquement.',
      true
    ).catch(() => {});
  }
}

function saveNow(sync = false) {
  if (candidateJourneyCompleted) return sync ? { ok:true, completed:true } : Promise.resolve({ ok:true, completed:true });
  if (closingSession || adminNavigationLeaving) return null;
  if (isAdminCandidatesPage() || isTestsParcoursWorkspacePage()) {
    const adminResult = { ok:true, adminNavigation:true };
    return sync ? adminResult : Promise.resolve(adminResult);
  }
  if (adminCandidateResultsWorkspace) {
    const readOnlyResult = { ok:true, readOnly:true };
    return sync ? readOnlyResult : Promise.resolve(readOnlyResult);
  }

  const snapshot = buildSnapshot();
  const fingerprint = snapshotFingerprint(snapshot);
  restoredState = snapshot;
  const candidateWorkspace = !!adminCandidateWorkspace && isAdminBilanPage();

  if (sync) {
    clearTimeout(saveTimer);
    const result = candidateWorkspace
      ? ipcRenderer.sendSync('candidate-catalog:workspace-save-sync', snapshot)
      : ipcRenderer.sendSync('state:save-sync', snapshot);
    if (result && result.ok !== false) {
      lastSavedFingerprint = fingerprint;
      saveDirty = false;
      saveAfterFlight = false;
    } else {
      saveDirty = true;
    }
    handleSaveResult(result);
    return result;
  }

  if (!saveDirty && fingerprint && fingerprint === lastSavedFingerprint) {
    return Promise.resolve({ ok:true, unchanged:true });
  }

  if (saveInFlight) {
    saveDirty = true;
    saveAfterFlight = true;
    return saveInFlight;
  }

  saveDirty = false;
  saveAfterFlight = false;
  const request = candidateWorkspace
    ? ipcRenderer.invoke('candidate-catalog:workspace-save', snapshot)
    : ipcRenderer.invoke('state:save', snapshot);

  const current = request.then((result) => {
    if (result && result.ok !== false) lastSavedFingerprint = fingerprint;
    else saveDirty = true;
    handleSaveResult(result);
    return result;
  }).catch((error) => {
    const result = { ok:false, error:String(error && error.message ? error.message : error) };
    saveDirty = true;
    handleSaveResult(result);
    return result;
  });

  saveInFlight = current;
  current.then(() => {
    if (saveInFlight === current) saveInFlight = null;
    if (saveDirty || saveAfterFlight) {
      saveAfterFlight = false;
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => saveNow(false), SAVE_DEBOUNCE_MS);
    }
  });
  return current;
}

function scheduleSave() {
  if (closingSession || adminNavigationLeaving || isAdminCandidatesPage() || adminCandidateResultsWorkspace) return;
  saveDirty = true;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveNow(false), SAVE_DEBOUNCE_MS);
}

function createPasswordDialog() {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.id = 'seb-evalpro-admin-dialog';
    backdrop.innerHTML = `
      <div class="seb-admin-card" role="dialog" aria-modal="true" aria-label="Accès administrateur">
        <div class="seb-admin-title">Accès administrateur</div>
        <label class="seb-admin-label" for="seb-admin-password">Mot de passe</label>
        <input id="seb-admin-password" class="seb-admin-input" type="password" autocomplete="off" />
        <div id="seb-admin-error" class="seb-admin-error" aria-live="polite"></div>
        <div class="seb-admin-actions">
          <button type="button" id="seb-admin-cancel">Annuler</button>
          <button type="button" id="seb-admin-ok" class="primary">Valider</button>
        </div>
      </div>`;

    const style = document.createElement('style');
    style.textContent = `
      #seb-evalpro-admin-dialog{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.38);display:flex;align-items:center;justify-content:center;font-family:Arial,sans-serif}
      #seb-evalpro-admin-dialog .seb-admin-card{width:360px;background:#fff;border:1px solid #bbb;border-radius:8px;padding:20px;box-shadow:0 10px 35px rgba(0,0,0,.28);box-sizing:border-box}
      #seb-evalpro-admin-dialog .seb-admin-title{font-size:20px;font-weight:700;color:#0070c0;margin-bottom:16px}
      #seb-evalpro-admin-dialog .seb-admin-label{display:block;font-size:14px;margin-bottom:6px;color:#222}
      #seb-evalpro-admin-dialog .seb-admin-input{width:100%;font-size:18px;padding:8px 10px;border:1px solid #999;border-radius:4px;box-sizing:border-box}
      #seb-evalpro-admin-dialog .seb-admin-error{min-height:20px;color:#c00000;font-size:13px;margin-top:6px}
      #seb-evalpro-admin-dialog .seb-admin-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:10px}
      #seb-evalpro-admin-dialog button{font-family:Arial,sans-serif;font-size:14px;padding:8px 14px;border:1px solid #999;border-radius:4px;background:#f2f2f2;cursor:pointer}
      #seb-evalpro-admin-dialog button.primary{background:#0070c0;color:#fff;border-color:#0070c0}
    `;
    backdrop.appendChild(style);
    document.body.appendChild(backdrop);

    const input = backdrop.querySelector('#seb-admin-password');
    const error = backdrop.querySelector('#seb-admin-error');
    const finish = (value) => {
      backdrop.remove();
      resolve(value);
    };

    backdrop.querySelector('#seb-admin-cancel').addEventListener('click', () => finish(false));
    backdrop.querySelector('#seb-admin-ok').addEventListener('click', async () => {
      const ok = await ipcRenderer.invoke('admin:verify', input.value);
      input.value = '';
      if (ok) finish(true);
      else {
        error.textContent = 'Mot de passe incorrect.';
        input.focus();
      }
    });
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') backdrop.querySelector('#seb-admin-ok').click();
      if (event.key === 'Escape') finish(false);
    });
    input.focus();
  });
}

function createApplicationQuitDialog(activeCandidate) {
  return new Promise((resolve) => {
    const hasActiveCandidate = Boolean(activeCandidate);
    const message = hasActiveCandidate
      ? 'Le parcours candidat en cours sera sauvegardé et restera actif. Au prochain démarrage, SEB EvalPro reprendra exactement sur la page du candidat en cours.'
      : 'Aucun parcours candidat n’est en cours. SEB EvalPro va se fermer.';

    const backdrop = document.createElement('div');
    backdrop.id = 'seb-evalpro-quit-application-dialog';
    backdrop.innerHTML = `
      <div class="seb-session-close-card" role="dialog" aria-modal="true" aria-label="Quitter SEB EvalPro">
        <div class="seb-session-close-title">Quitter SEB EvalPro ?</div>
        <div class="seb-session-close-text">${message}</div>
        <div class="seb-session-close-actions">
          <button type="button" id="seb-quit-application-cancel">Annuler</button>
          <button type="button" id="seb-quit-application-ok">Quitter</button>
        </div>
      </div>`;

    const style = document.createElement('style');
    style.textContent = `
      #seb-evalpro-quit-application-dialog{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.42);display:flex;align-items:center;justify-content:center;font-family:Arial,sans-serif}
      #seb-evalpro-quit-application-dialog .seb-session-close-card{width:460px;max-width:calc(100vw - 40px);background:#fff;border:1px solid #aaa;border-radius:8px;padding:20px;box-shadow:0 10px 35px rgba(0,0,0,.3);box-sizing:border-box}
      #seb-evalpro-quit-application-dialog .seb-session-close-title{font-size:20px;font-weight:700;color:#0070c0;margin-bottom:12px}
      #seb-evalpro-quit-application-dialog .seb-session-close-text{font-size:14px;line-height:1.45;color:#222}
      #seb-evalpro-quit-application-dialog .seb-session-close-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:18px}
      #seb-evalpro-quit-application-dialog button{font-family:Arial,sans-serif;font-size:14px;padding:8px 14px;border:2px solid #0070c0;border-radius:6px;background:#fff;color:#0070c0;font-weight:700;cursor:pointer}
    `;
    backdrop.appendChild(style);
    document.body.appendChild(backdrop);

    const finish = (value) => {
      backdrop.remove();
      resolve(value);
    };

    backdrop.querySelector('#seb-quit-application-cancel').addEventListener('click', () => finish(false));
    backdrop.querySelector('#seb-quit-application-ok').addEventListener('click', () => finish(true));
    backdrop.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') finish(false);
      if (event.key === 'Enter') finish(true);
    });
    backdrop.querySelector('#seb-quit-application-cancel').focus();
  });
}

function createSessionCloseDialog() {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.id = 'seb-evalpro-session-close-dialog';
    backdrop.innerHTML = `
      <div class="seb-session-close-card" role="dialog" aria-modal="true" aria-label="Fermer la session active">
        <div class="seb-session-close-title">Fermer la session active ?</div>
        <div class="seb-session-close-text">
          SEB EvalPro va sauvegarder les données, finaliser le Replay et terminer définitivement le parcours candidat en cours. Le programme restera ouvert dans l’espace Administrateur.
        </div>
        <div class="seb-session-close-warning">Le parcours en cours ne pourra plus être repris. Son dossier et ses données restent conservés pour le bilan et l’export.</div>
        <div class="seb-session-close-actions">
          <button type="button" id="seb-session-close-cancel">Annuler</button>
          <button type="button" id="seb-session-close-ok" class="danger">Fermer la session active</button>
        </div>
      </div>`;

    const style = document.createElement('style');
    style.textContent = `
      #seb-evalpro-session-close-dialog{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.42);display:flex;align-items:center;justify-content:center;font-family:Arial,sans-serif}
      #seb-evalpro-session-close-dialog .seb-session-close-card{width:430px;max-width:calc(100vw - 40px);background:#fff;border:1px solid #aaa;border-radius:8px;padding:20px;box-shadow:0 10px 35px rgba(0,0,0,.3);box-sizing:border-box}
      #seb-evalpro-session-close-dialog .seb-session-close-title{font-size:20px;font-weight:700;color:#c00000;margin-bottom:12px}
      #seb-evalpro-session-close-dialog .seb-session-close-text{font-size:14px;line-height:1.45;color:#222}
      #seb-evalpro-session-close-dialog .seb-session-close-warning{font-size:13px;font-weight:700;color:#c00000;margin-top:10px}
      #seb-evalpro-session-close-dialog .seb-session-close-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:18px}
      #seb-evalpro-session-close-dialog button{font-family:Arial,sans-serif;font-size:14px;padding:8px 14px;border:1px solid #999;border-radius:4px;background:#f2f2f2;cursor:pointer}
      #seb-evalpro-session-close-dialog button.danger{background:#c00000;color:#fff;border-color:#c00000}
    `;
    backdrop.appendChild(style);
    document.body.appendChild(backdrop);

    const finish = (value) => {
      backdrop.remove();
      resolve(value);
    };

    backdrop.querySelector('#seb-session-close-cancel').addEventListener('click', () => finish(false));
    backdrop.querySelector('#seb-session-close-ok').addEventListener('click', () => finish(true));
    backdrop.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') finish(false);
      if (event.key === 'Enter') finish(true);
    });
    backdrop.querySelector('#seb-session-close-cancel').focus();
  });
}


function createCandidateFinishDialog() {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.id = 'seb-evalpro-finish-candidate-dialog';
    backdrop.innerHTML = `
      <div class="seb-session-close-card" role="dialog" aria-modal="true" aria-label="Terminer le parcours du candidat">
        <div class="seb-session-close-title">Terminer définitivement le parcours en cours ?</div>
        <div class="seb-session-close-text">
          Le candidat ne pourra plus reprendre son évaluation sur ce PC.
          Les réponses déjà enregistrées seront conservées et le dossier deviendra exportable.
        </div>
        <div class="seb-session-close-actions">
          <button type="button" id="seb-finish-candidate-cancel">Annuler</button>
          <button type="button" id="seb-finish-candidate-ok" class="danger">Terminer le parcours</button>
        </div>
      </div>`;

    const style = document.createElement('style');
    style.textContent = `
      #seb-evalpro-finish-candidate-dialog{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.42);display:flex;align-items:center;justify-content:center;font-family:Arial,sans-serif}
      #seb-evalpro-finish-candidate-dialog .seb-session-close-card{width:460px;max-width:calc(100vw - 40px);background:#fff;border:1px solid #aaa;border-radius:8px;padding:20px;box-shadow:0 10px 35px rgba(0,0,0,.3);box-sizing:border-box}
      #seb-evalpro-finish-candidate-dialog .seb-session-close-title{font-size:20px;font-weight:700;color:#c00000;margin-bottom:12px}
      #seb-evalpro-finish-candidate-dialog .seb-session-close-text{font-size:14px;line-height:1.45;color:#222}
      #seb-evalpro-finish-candidate-dialog .seb-session-close-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:18px}
      #seb-evalpro-finish-candidate-dialog button{font-family:Arial,sans-serif;font-size:14px;padding:8px 14px;border:1px solid #999;border-radius:4px;background:#f2f2f2;cursor:pointer}
      #seb-evalpro-finish-candidate-dialog button.danger{background:#c00000;color:#fff;border-color:#c00000}
    `;
    backdrop.appendChild(style);
    document.body.appendChild(backdrop);

    const finish = (value) => {
      backdrop.remove();
      resolve(value);
    };
    backdrop.querySelector('#seb-finish-candidate-cancel').addEventListener('click', () => finish(false));
    backdrop.querySelector('#seb-finish-candidate-ok').addEventListener('click', () => finish(true));
    backdrop.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') finish(false);
      if (event.key === 'Enter') finish(true);
    });
    backdrop.querySelector('#seb-finish-candidate-cancel').focus();
  });
}


function createExportCandidateFinishDialog(activeCandidate) {
  return new Promise((resolve) => {
    const rawName = String(activeCandidate && activeCandidate.displayName || 'ce candidat').trim() || 'ce candidat';
    const safeName = rawName.replace(/[&<>"']/g, (char) => ({
      '&':'&amp;',
      '<':'&lt;',
      '>':'&gt;',
      '"':'&quot;',
      "'":'&#39;'
    })[char]);

    const backdrop = document.createElement('div');
    backdrop.id = 'seb-evalpro-export-finish-candidate-dialog';
    backdrop.innerHTML = `
      <div class="seb-session-close-card" role="dialog" aria-modal="true" aria-label="Terminer le parcours avant export">
        <div class="seb-session-close-title">Parcours candidat encore en cours</div>
        <div class="seb-session-close-text">
          Le parcours de <strong>${safeName}</strong> est encore en cours.<br><br>
          Voulez-vous mettre fin au parcours de <strong>${safeName}</strong> avant l’export ?
        </div>
        <div class="seb-session-close-warning">
          Cette action est définitive : le parcours ne pourra plus être repris.
        </div>
        <div class="seb-session-close-actions">
          <button type="button" id="seb-export-finish-cancel">Annuler l’export</button>
          <button type="button" id="seb-export-finish-ok" class="danger">Terminer le parcours et exporter</button>
        </div>
      </div>`;

    const style = document.createElement('style');
    style.textContent = `
      #seb-evalpro-export-finish-candidate-dialog{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.42);display:flex;align-items:center;justify-content:center;font-family:Arial,sans-serif}
      #seb-evalpro-export-finish-candidate-dialog .seb-session-close-card{width:500px;max-width:calc(100vw - 40px);background:#fff;border:1px solid #aaa;border-radius:8px;padding:20px;box-shadow:0 10px 35px rgba(0,0,0,.3);box-sizing:border-box}
      #seb-evalpro-export-finish-candidate-dialog .seb-session-close-title{font-size:20px;font-weight:700;color:#c00000;margin-bottom:12px}
      #seb-evalpro-export-finish-candidate-dialog .seb-session-close-text{font-size:14px;line-height:1.45;color:#222}
      #seb-evalpro-export-finish-candidate-dialog .seb-session-close-warning{font-size:13px;font-weight:700;color:#c00000;margin-top:10px}
      #seb-evalpro-export-finish-candidate-dialog .seb-session-close-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:18px}
      #seb-evalpro-export-finish-candidate-dialog button{font-family:Arial,sans-serif;font-size:14px;padding:8px 14px;border:1px solid #999;border-radius:4px;background:#f2f2f2;cursor:pointer}
      #seb-evalpro-export-finish-candidate-dialog button.danger{background:#c00000;color:#fff;border-color:#c00000}
    `;
    backdrop.appendChild(style);
    document.body.appendChild(backdrop);

    const finish = (value) => {
      backdrop.remove();
      resolve(value);
    };
    backdrop.querySelector('#seb-export-finish-cancel').addEventListener('click', () => finish(false));
    backdrop.querySelector('#seb-export-finish-ok').addEventListener('click', () => finish(true));
    backdrop.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') finish(false);
      if (event.key === 'Enter') finish(true);
    });
    backdrop.querySelector('#seb-export-finish-cancel').focus();
  });
}


function createExportDestinationModeDialog() {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.id = 'seb-evalpro-export-destination-dialog';
    backdrop.innerHTML = `
      <div class="seb-transfer-card" role="dialog" aria-modal="true" aria-label="Destination de l’export">
        <div class="seb-transfer-title">Où exporter les candidats ?</div>
        <div class="seb-transfer-text">
          Vous pouvez ajouter les fichiers à un dossier déjà présent sur la clé USB,
          ou créer un nouveau dossier pour cette série d’exports.
        </div>
        <div class="seb-transfer-actions export-choice">
          <button type="button" id="seb-export-existing">Choisir un dossier existant</button>
          <button type="button" id="seb-export-create">Créer un nouveau dossier</button>
          <button type="button" id="seb-export-cancel">Annuler</button>
        </div>
      </div>`;

    const style = document.createElement('style');
    style.textContent = `
      #seb-evalpro-export-destination-dialog{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.42);display:flex;align-items:center;justify-content:center;font-family:Arial,sans-serif}
      #seb-evalpro-export-destination-dialog .seb-transfer-card{width:520px;max-width:calc(100vw - 40px);background:#fff;border:1px solid #aaa;border-radius:8px;padding:20px;box-shadow:0 10px 35px rgba(0,0,0,.3);box-sizing:border-box}
      #seb-evalpro-export-destination-dialog .seb-transfer-title{font-size:20px;font-weight:700;color:#0070c0;margin-bottom:10px}
      #seb-evalpro-export-destination-dialog .seb-transfer-text{font-size:14px;line-height:1.45;color:#222;margin-bottom:16px}
      #seb-evalpro-export-destination-dialog .seb-transfer-actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px}
      #seb-evalpro-export-destination-dialog button{font-family:Arial,sans-serif;font-size:14px;padding:9px 14px;border:2px solid #0070c0;border-radius:6px;background:#fff;color:#0070c0;font-weight:700;cursor:pointer}
      #seb-evalpro-export-destination-dialog #seb-export-create{background:#0070c0;color:#fff}
    `;
    backdrop.appendChild(style);
    document.body.appendChild(backdrop);

    const finish = (value) => {
      backdrop.remove();
      resolve(value);
    };
    backdrop.querySelector('#seb-export-existing').addEventListener('click', () => finish('existing'));
    backdrop.querySelector('#seb-export-create').addEventListener('click', () => finish('create'));
    backdrop.querySelector('#seb-export-cancel').addEventListener('click', () => finish(null));
    backdrop.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') finish(null);
    });
    backdrop.querySelector('#seb-export-existing').focus();
  });
}


function createTransferNameDialog() {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.id = 'seb-evalpro-transfer-dialog';
    backdrop.innerHTML = `
      <div class="seb-transfer-card" role="dialog" aria-modal="true" aria-label="Nom du regroupement">
        <div class="seb-transfer-title">Créer un dossier d’export</div>
        <div class="seb-transfer-text">Saisissez le nom du nouveau dossier à créer sur la clé USB.</div>
        <label class="seb-transfer-label" for="seb-transfer-name">Nom du dossier</label>
        <input id="seb-transfer-name" class="seb-transfer-input" type="text" autocomplete="off" placeholder="Ex. Lorient, Groupe A, Session septembre" />
        <div id="seb-transfer-error" class="seb-transfer-error" aria-live="polite"></div>
        <div class="seb-transfer-actions">
          <button type="button" id="seb-transfer-cancel">Annuler</button>
          <button type="button" id="seb-transfer-ok">Continuer</button>
        </div>
      </div>`;

    const style = document.createElement('style');
    style.textContent = `
      #seb-evalpro-transfer-dialog{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.42);display:flex;align-items:center;justify-content:center;font-family:Arial,sans-serif}
      #seb-evalpro-transfer-dialog .seb-transfer-card{width:470px;max-width:calc(100vw - 40px);background:#fff;border:1px solid #aaa;border-radius:8px;padding:20px;box-shadow:0 10px 35px rgba(0,0,0,.3);box-sizing:border-box}
      #seb-evalpro-transfer-dialog .seb-transfer-title{font-size:20px;font-weight:700;color:#0070c0;margin-bottom:10px}
      #seb-evalpro-transfer-dialog .seb-transfer-text{font-size:14px;line-height:1.45;color:#222;margin-bottom:14px}
      #seb-evalpro-transfer-dialog .seb-transfer-label{display:block;font-size:14px;font-weight:700;color:#222;margin-bottom:6px}
      #seb-evalpro-transfer-dialog .seb-transfer-input{width:100%;font-size:17px;padding:9px 10px;border:1px solid #999;border-radius:4px;box-sizing:border-box}
      #seb-evalpro-transfer-dialog .seb-transfer-error{min-height:20px;color:#c00000;font-size:13px;margin-top:6px}
      #seb-evalpro-transfer-dialog .seb-transfer-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:10px}
      #seb-evalpro-transfer-dialog button{font-family:Arial,sans-serif;font-size:14px;padding:8px 14px;border:2px solid #0070c0;border-radius:6px;background:#fff;color:#0070c0;font-weight:700;cursor:pointer}
    `;
    backdrop.appendChild(style);
    document.body.appendChild(backdrop);

    const input = backdrop.querySelector('#seb-transfer-name');
    const error = backdrop.querySelector('#seb-transfer-error');
    const finish = (value) => {
      backdrop.remove();
      resolve(value);
    };
    const accept = () => {
      const value = String(input.value || '').trim();
      if (!value) {
        error.textContent = 'Saisissez un nom de dossier.';
        input.focus();
        return;
      }
      finish(value);
    };

    backdrop.querySelector('#seb-transfer-cancel').addEventListener('click', () => finish(null));
    backdrop.querySelector('#seb-transfer-ok').addEventListener('click', accept);
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') accept();
      if (event.key === 'Escape') finish(null);
    });
    input.focus();
  });
}

function createTransferPasswordDialog(mode) {
  const isExport = mode === 'export';
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.id = 'seb-evalpro-transfer-password-dialog';
    backdrop.innerHTML = `
      <div class="seb-transfer-password-card" role="dialog" aria-modal="true" aria-label="${isExport ? 'Mot de passe export USB' : 'Mot de passe import USB'}">
        <div class="seb-transfer-password-title">${isExport ? 'Export USB sécurisé' : 'Import USB sécurisé'}</div>
        <div class="seb-transfer-password-text">${isExport
          ? 'Choisissez le mot de passe qui protégera les fichiers transférés. Il sera demandé sur l’autre PC.'
          : 'Saisissez le mot de passe utilisé lors de l’export de cette clé USB.'}</div>
        <label for="seb-transfer-password">Mot de passe de transfert</label>
        <input id="seb-transfer-password" type="password" autocomplete="off" autofocus tabindex="0" />
        ${isExport ? `
          <label for="seb-transfer-password-confirm">Confirmer le mot de passe</label>
          <input id="seb-transfer-password-confirm" type="password" autocomplete="off" />
        ` : ''}
        <button type="button" id="seb-transfer-password-show" class="show-password">Afficher le mot de passe</button>
        <div id="seb-transfer-password-error" class="seb-transfer-password-error" aria-live="polite"></div>
        <div class="seb-transfer-password-actions">
          <button type="button" id="seb-transfer-password-cancel">Annuler</button>
          <button type="button" id="seb-transfer-password-ok" class="primary">${isExport ? 'Continuer l’export' : 'Continuer l’import'}</button>
        </div>
      </div>`;

    const style = document.createElement('style');
    style.textContent = `
      #seb-evalpro-transfer-password-dialog{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.42);display:flex;align-items:center;justify-content:center;font-family:Arial,sans-serif}
      #seb-evalpro-transfer-password-dialog .seb-transfer-password-card{width:470px;max-width:calc(100vw - 40px);background:#fff;border:1px solid #aaa;border-radius:8px;padding:20px;box-shadow:0 10px 35px rgba(0,0,0,.3);box-sizing:border-box}
      #seb-evalpro-transfer-password-dialog .seb-transfer-password-title{font-size:20px;font-weight:700;color:#0070c0;margin-bottom:8px}
      #seb-evalpro-transfer-password-dialog .seb-transfer-password-text{font-size:14px;line-height:1.45;color:#333;margin-bottom:14px}
      #seb-evalpro-transfer-password-dialog label{display:block;font-size:14px;font-weight:700;color:#222;margin:10px 0 5px}
      #seb-evalpro-transfer-password-dialog input{width:100%;font-size:18px;padding:8px 10px;border:1px solid #999;border-radius:4px;box-sizing:border-box;background:#fff;color:#111;caret-color:#111;pointer-events:auto}
      #seb-evalpro-transfer-password-dialog button{font-family:Arial,sans-serif;font-size:14px;padding:8px 14px;border:2px solid #0070c0;border-radius:6px;background:#fff;color:#0070c0;font-weight:700;cursor:pointer}
      #seb-evalpro-transfer-password-dialog button.show-password{margin-top:10px;padding:5px 10px;font-size:13px}
      #seb-evalpro-transfer-password-dialog button.primary{background:#0070c0;color:#fff}
      #seb-evalpro-transfer-password-dialog .seb-transfer-password-error{min-height:20px;color:#c00000;font-size:13px;margin-top:7px}
      #seb-evalpro-transfer-password-dialog .seb-transfer-password-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:8px}
    `;
    backdrop.appendChild(style);
    document.body.appendChild(backdrop);

    const password = backdrop.querySelector('#seb-transfer-password');
    const confirmation = backdrop.querySelector('#seb-transfer-password-confirm');
    const error = backdrop.querySelector('#seb-transfer-password-error');
    const show = backdrop.querySelector('#seb-transfer-password-show');
    let visible = false;

    const finish = (value) => {
      password.value = '';
      if (confirmation) confirmation.value = '';
      backdrop.remove();
      resolve(value);
    };

    show.addEventListener('click', () => {
      visible = !visible;
      password.type = visible ? 'text' : 'password';
      if (confirmation) confirmation.type = visible ? 'text' : 'password';
      show.textContent = visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe';
      password.focus();
    });

    const accept = () => {
      const value = String(password.value || '');
      if (value.length < 8) {
        error.textContent = 'Le mot de passe doit contenir au moins 8 caractères.';
        password.focus();
        return;
      }
      if (confirmation && value !== String(confirmation.value || '')) {
        error.textContent = 'Les deux mots de passe ne sont pas identiques.';
        confirmation.focus();
        return;
      }
      finish(value);
    };

    backdrop.querySelector('#seb-transfer-password-cancel').addEventListener('click', () => finish(null));
    backdrop.querySelector('#seb-transfer-password-ok').addEventListener('click', accept);
    for (const input of [password, confirmation].filter(Boolean)) {
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') accept();
        if (event.key === 'Escape') finish(null);
      });
    }

    // Windows/Electron peut rendre le focus au bouton Import à la fin du clic.
    // Le champ mot de passe reprend alors le focus une fois le dialogue réellement affiché.
    const ensureInitialPasswordFocus = () => {
      if (!document.body.contains(password)) return;
      const active = document.activeElement;
      if (active && backdrop.contains(active)) return;
      try { password.focus({ preventScroll:true }); }
      catch (_) { password.focus(); }
    };
    ensureInitialPasswordFocus();
    if (typeof queueMicrotask === 'function') queueMicrotask(ensureInitialPasswordFocus);
    requestAnimationFrame(ensureInitialPasswordFocus);
    setTimeout(ensureInitialPasswordFocus, 60);
  });
}

function showTransferMessage(title, message, isError = false) {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.id = 'seb-evalpro-transfer-dialog';
    backdrop.innerHTML = `
      <div class="seb-transfer-card" role="dialog" aria-modal="true">
        <div class="seb-transfer-title"></div>
        <div class="seb-transfer-message"></div>
        <div class="seb-transfer-actions">
          <button type="button" id="seb-transfer-ok">OK</button>
        </div>
      </div>`;

    const style = document.createElement('style');
    style.textContent = `
      #seb-evalpro-transfer-dialog{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.42);display:flex;align-items:center;justify-content:center;font-family:Arial,sans-serif}
      #seb-evalpro-transfer-dialog .seb-transfer-card{width:520px;max-width:calc(100vw - 40px);background:#fff;border:1px solid #aaa;border-radius:8px;padding:20px;box-shadow:0 10px 35px rgba(0,0,0,.3);box-sizing:border-box}
      #seb-evalpro-transfer-dialog .seb-transfer-title{font-size:20px;font-weight:700;color:#0070c0;margin-bottom:12px}
      #seb-evalpro-transfer-dialog .seb-transfer-message{font-size:14px;line-height:1.5;color:#222;white-space:pre-wrap;overflow-wrap:anywhere}
      #seb-evalpro-transfer-dialog .seb-transfer-actions{display:flex;justify-content:flex-end;margin-top:18px}
      #seb-evalpro-transfer-dialog button{font-family:Arial,sans-serif;font-size:14px;padding:8px 18px;border:2px solid #0070c0;border-radius:6px;background:#fff;color:#0070c0;font-weight:700;cursor:pointer}
    `;
    backdrop.appendChild(style);
    const titleNode = backdrop.querySelector('.seb-transfer-title');
    titleNode.textContent = String(title || '');
    if (isError) titleNode.style.color = '#c00000';
    backdrop.querySelector('.seb-transfer-message').textContent = String(message || '');
    document.body.appendChild(backdrop);

    const finish = () => {
      backdrop.remove();
      resolve();
    };
    backdrop.querySelector('#seb-transfer-ok').addEventListener('click', finish);
    backdrop.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === 'Escape') finish();
    });
    backdrop.querySelector('#seb-transfer-ok').focus();
  });
}


function showTransferProgress(mode = 'export') {
  const existing = document.getElementById('seb-evalpro-transfer-progress');
  if (existing) existing.remove();

  const backdrop = document.createElement('div');
  backdrop.id = 'seb-evalpro-transfer-progress';
  backdrop.innerHTML = `
    <div class="seb-transfer-progress-card" role="dialog" aria-modal="true" aria-label="${mode === 'import' ? 'Import en cours' : 'Export en cours'}">
      <img class="seb-transfer-progress-brand" src="branding/seb-eval-pro-installer.png" alt="SEB EvalPro - Sauvegarde 56" />
      <div class="seb-transfer-progress-title">${mode === 'import' ? 'Import en cours depuis la clé USB…' : 'Export en cours vers la clé USB…'}</div>
      <div class="seb-transfer-progress-text">Merci de patienter.</div>
      <div class="seb-transfer-progress-track" aria-hidden="true">
        <div class="seb-transfer-progress-bar"></div>
      </div>
      <div class="seb-transfer-progress-warning">Ne retirez pas la clé USB.</div>
    </div>`;

  const style = document.createElement('style');
  style.textContent = `
    #seb-evalpro-transfer-progress{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.42);display:flex;align-items:center;justify-content:center;font-family:Arial,sans-serif}
    #seb-evalpro-transfer-progress .seb-transfer-progress-card{width:520px;max-width:calc(100vw - 40px);background:#fff;border:1px solid #aaa;border-radius:8px;padding:22px;box-shadow:0 10px 35px rgba(0,0,0,.3);box-sizing:border-box;text-align:center}
    #seb-evalpro-transfer-progress .seb-transfer-progress-brand{display:block;max-width:270px;max-height:120px;width:auto;height:auto;object-fit:contain;margin:0 auto 16px}
    #seb-evalpro-transfer-progress .seb-transfer-progress-title{font-size:20px;font-weight:700;color:#0070c0;margin-bottom:8px}
    #seb-evalpro-transfer-progress .seb-transfer-progress-text{font-size:14px;line-height:1.5;color:#222;margin-bottom:14px}
    #seb-evalpro-transfer-progress .seb-transfer-progress-track{height:16px;border-radius:9px;background:#e5e5e5;overflow:hidden;position:relative;border:1px solid #c5c5c5}
    #seb-evalpro-transfer-progress .seb-transfer-progress-bar{position:absolute;top:0;bottom:0;width:38%;border-radius:8px;background:#0070c0;animation:sebUsbExportProgress 1.15s ease-in-out infinite}
    #seb-evalpro-transfer-progress .seb-transfer-progress-warning{font-size:14px;font-weight:700;color:#c00000;margin-top:14px}
    @keyframes sebUsbExportProgress{0%{left:-38%}50%{left:62%}100%{left:100%}}
    @media (prefers-reduced-motion:reduce){#seb-evalpro-transfer-progress .seb-transfer-progress-bar{animation-duration:2.4s}}
  `;
  backdrop.appendChild(style);
  document.body.appendChild(backdrop);

  return Object.freeze({
    close() {
      if (backdrop.isConnected) backdrop.remove();
    }
  });
}


// SEB_ADMIN_STATE_SYNC_AFTER_EARLY_BAR
function sebSyncAdminBarState() {
  const bar = document.getElementById('seb-evalpro-topbar');
  if (!bar) return;
  const adminButton = document.getElementById('seb-evalpro-admin');
  const bilanButton = document.getElementById('seb-evalpro-bilan');
  const returnButton = document.getElementById('seb-evalpro-return');
  const exportCandidatesButton = document.getElementById('seb-evalpro-export-candidates');
  const importCandidatesButton = document.getElementById('seb-evalpro-import-candidates');
  const testsParcoursButton = document.getElementById('seb-evalpro-tests-parcours');
  const chooseParcoursButton = document.getElementById('seb-evalpro-choose-parcours');
  const showPrivacyButton = document.getElementById('seb-evalpro-show-privacy');
  const closeSessionButton = document.getElementById('seb-evalpro-close-session');
  const quitApplicationButton = document.getElementById('seb-evalpro-quit-application');
  const onBilan = isAdminBilanPage();
  const onCandidateResults = !!adminCandidateResultsWorkspace;
  const onAdminDetail = onBilan || onCandidateResults;
  if (adminButton) {
    adminButton.hidden = false;
    adminButton.textContent = adminUnlocked ? 'Verrouiller' : 'Administrateur';
  }
  if (bilanButton) bilanButton.hidden = true;
  if (returnButton) returnButton.hidden = true;
  if (exportCandidatesButton) {
    exportCandidatesButton.textContent = '↑ Exporter dossiers';
    exportCandidatesButton.hidden = true;
  }
  if (importCandidatesButton) {
    importCandidatesButton.textContent = '↓ Importer dossiers';
    importCandidatesButton.hidden = true;
  }
  if (testsParcoursButton) {
    testsParcoursButton.hidden = true;
    if (adminUnlocked && !onAdminDetail && !isAdminTestsParcoursPage()) {
      ipcRenderer.invoke('candidate:active').then((active) => {
        testsParcoursButton.hidden = !!active;
      }).catch(() => { testsParcoursButton.hidden = true; });
    }
  }
  if (chooseParcoursButton) {
    chooseParcoursButton.hidden = true;
    if (adminUnlocked && !onAdminDetail) {
      ipcRenderer.invoke('candidate:active').then((active) => {
        chooseParcoursButton.hidden = !!active;
      }).catch(() => { chooseParcoursButton.hidden = true; });
    }
  }
  if (showPrivacyButton) showPrivacyButton.hidden = !adminUnlocked || isTestsParcoursWorkspacePage();
  const finishCandidateButton = document.getElementById('seb-evalpro-finish-candidate');
  if (finishCandidateButton) finishCandidateButton.hidden = true;
  if (closeSessionButton) {
    closeSessionButton.hidden = true;
    if (adminUnlocked) {
      ipcRenderer.invoke('candidate:active').then((active) => {
        closeSessionButton.hidden = !active;
      }).catch(() => { closeSessionButton.hidden = true; });
    }
  }
  if (quitApplicationButton) quitApplicationButton.hidden = !adminUnlocked;
}

async function createParcoursChoiceDialog() {
  const existing = document.getElementById('seb-evalpro-parcours-choice-dialog');
  if (existing) existing.remove();

  const listResult = await ipcRenderer.invoke('kaloneo-library:list-parcours').catch(() => null);
  if (!listResult || listResult.ok !== true) {
    await showTransferMessage('Choix du parcours', listResult?.error || 'La bibliothèque des parcours est inaccessible.', true);
    return null;
  }

  let selectedId = '';
  let selectedShowCorrections = false;
  const current = await ipcRenderer.invoke('kaloneo-library:get-selected-parcours').catch(() => null);
  if (current && current.ok === true) {
    selectedId = String(current.selected?.id || '');
    selectedShowCorrections = current.selected?.launchOptions?.showCorrectionsDuringParcours === true;
  }
  let showCorrectionsDuringParcours = selectedShowCorrections;

  const layer = document.createElement('div');
  layer.id = 'seb-evalpro-parcours-choice-dialog';
  layer.innerHTML = `
    <style>
      #seb-evalpro-parcours-choice-dialog{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.42);display:flex;align-items:center;justify-content:center;font-family:Calibri,"Segoe UI",Arial,sans-serif}
      #seb-evalpro-parcours-choice-dialog .pc-card{width:min(1100px,94vw);height:min(700px,88vh);background:#fff;border:1px solid #8ea5b9;border-radius:10px;box-shadow:0 16px 44px rgba(0,0,0,.28);display:grid;grid-template-rows:auto minmax(0,1fr) auto;overflow:hidden}
      #seb-evalpro-parcours-choice-dialog .pc-head{display:flex;justify-content:space-between;align-items:center;gap:14px;padding:15px 18px;border-bottom:1px solid #d6dce6}
      #seb-evalpro-parcours-choice-dialog h2{margin:0;color:#0070c0;font-size:24px}
      #seb-evalpro-parcours-choice-dialog .pc-sub{margin:3px 0 0;color:#5d6d79;font-size:13px}
      #seb-evalpro-parcours-choice-dialog .pc-main{display:grid;grid-template-columns:minmax(260px,.82fr) minmax(0,1.5fr);min-height:0}
      #seb-evalpro-parcours-choice-dialog .pc-list{border-right:1px solid #d6dce6;padding:12px;overflow:auto;background:#f7f9fc}
      #seb-evalpro-parcours-choice-dialog .pc-item{display:block;width:100%;text-align:left;border:1px solid #cbd6e2;border-radius:8px;background:#fff;padding:10px 12px;margin-bottom:8px;cursor:pointer;color:#263746}
      #seb-evalpro-parcours-choice-dialog .pc-item.active{border-color:#0070c0;background:#eef7fd;box-shadow:inset 0 0 0 1px #0070c0}
      #seb-evalpro-parcours-choice-dialog .pc-item strong,#seb-evalpro-parcours-choice-dialog .pc-item span{display:block}
      #seb-evalpro-parcours-choice-dialog .pc-item span{font-size:12px;color:#607080;margin-top:3px}
      #seb-evalpro-parcours-choice-dialog .pc-detail{padding:18px;overflow:auto}
      #seb-evalpro-parcours-choice-dialog .pc-detail h3{margin:0 0 5px;color:#004e70;font-size:23px}
      #seb-evalpro-parcours-choice-dialog .pc-meta{color:#607080;margin-bottom:14px}
      #seb-evalpro-parcours-choice-dialog .pc-grid{display:grid;grid-template-columns:170px 1fr;gap:7px 12px;margin-bottom:16px}
      #seb-evalpro-parcours-choice-dialog .pc-label{font-weight:700;color:#24425b}
      #seb-evalpro-parcours-choice-dialog ol{margin:7px 0 0;padding-left:25px}
      #seb-evalpro-parcours-choice-dialog li{padding:3px 0}
      #seb-evalpro-parcours-choice-dialog .pc-foot{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:12px 18px;border-top:1px solid #d6dce6;background:#fbfcfe}
      #seb-evalpro-parcours-choice-dialog .pc-foot-left{display:flex;align-items:center;gap:18px;min-width:0;flex-wrap:wrap}
      #seb-evalpro-parcours-choice-dialog .pc-selected{font-weight:700;color:#167a4a}
      #seb-evalpro-parcours-choice-dialog .pc-corrections{display:flex;align-items:center;gap:6px;font-size:14px;color:#24425b}
      #seb-evalpro-parcours-choice-dialog .pc-corrections strong{white-space:nowrap}
      #seb-evalpro-parcours-choice-dialog button.pc-toggle{min-height:32px;padding:5px 12px;border:1px solid #7f9db9;border-radius:6px;background:#fff;color:#24425b;font-weight:700;cursor:pointer}
      #seb-evalpro-parcours-choice-dialog button.pc-toggle.active{background:#0070c0;color:#fff;border-color:#0070c0}
      #seb-evalpro-parcours-choice-dialog .pc-actions{display:flex;gap:8px}
      #seb-evalpro-parcours-choice-dialog button.pc-action{min-height:38px;padding:7px 14px;border:1.5px solid #0070c0;border-radius:7px;background:#fff;color:#0070c0;font-weight:700;cursor:pointer}
      #seb-evalpro-parcours-choice-dialog button.pc-primary{background:#0070c0;color:#fff}
      #seb-evalpro-parcours-choice-dialog button.pc-action:disabled{opacity:.5;cursor:default}
    </style>
    <div class="pc-card" role="dialog" aria-modal="true" aria-labelledby="pc-title">
      <div class="pc-head">
        <div><h2 id="pc-title">Choix du parcours</h2><div class="pc-sub">Sélectionnez un parcours après avoir vérifié son contenu.</div></div>
        <button class="pc-action" id="pc-close" type="button">Fermer</button>
      </div>
      <div class="pc-main">
        <div class="pc-list" id="pc-list"></div>
        <div class="pc-detail" id="pc-detail"><p>Sélectionnez un parcours dans la liste.</p></div>
      </div>
      <div class="pc-foot">
        <div class="pc-foot-left">
          <div class="pc-selected" id="pc-selected"></div>
          <div class="pc-corrections" aria-label="Afficher les corrections pendant le parcours">
            <strong>Afficher les corrections pendant le parcours :</strong>
            <button class="pc-toggle" id="pc-corrections-no" type="button">Non</button>
            <button class="pc-toggle" id="pc-corrections-yes" type="button">Oui</button>
          </div>
        </div>
        <div class="pc-actions">
          <button class="pc-action" id="pc-open" type="button" disabled>Ouvrir / modifier</button>
          <button class="pc-action pc-primary" id="pc-choose" type="button" disabled>Choisir ce parcours</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(layer);

  const list = layer.querySelector('#pc-list');
  const detail = layer.querySelector('#pc-detail');
  const chosenLabel = layer.querySelector('#pc-selected');
  const openButton = layer.querySelector('#pc-open');
  const chooseButton = layer.querySelector('#pc-choose');
  const correctionsNoButton = layer.querySelector('#pc-corrections-no');
  const correctionsYesButton = layer.querySelector('#pc-corrections-yes');
  let focused = null;
  let focusedDetails = null;

  const refreshCorrectionChoice = () => {
    correctionsNoButton.classList.toggle('active', !showCorrectionsDuringParcours);
    correctionsYesButton.classList.toggle('active', showCorrectionsDuringParcours);
    correctionsNoButton.setAttribute('aria-pressed', showCorrectionsDuringParcours ? 'false' : 'true');
    correctionsYesButton.setAttribute('aria-pressed', showCorrectionsDuringParcours ? 'true' : 'false');
  };

  const refreshChooseState = () => {
    chooseButton.disabled = !focused ||
      (String(focused.id) === selectedId && showCorrectionsDuringParcours === selectedShowCorrections);
  };

  const refreshSelectedLabel = () => {
    const meta = (listResult.parcours || []).find(item => String(item.id) === selectedId);
    chosenLabel.textContent = meta
      ? 'Parcours sélectionné : ' + meta.name + ' • corrections : ' + (selectedShowCorrections ? 'Oui' : 'Non')
      : 'Aucun parcours sélectionné';
  };

  const renderDetails = async (meta) => {
    focused = meta;
    focusedDetails = null;
    openButton.disabled = !meta;
    refreshChooseState();
    [...list.querySelectorAll('.pc-item')].forEach(node => node.classList.toggle('active', node.dataset.id === String(meta?.id || '')));
    if (!meta) {
      detail.innerHTML = '<p>Sélectionnez un parcours dans la liste.</p>';
      return;
    }
    detail.innerHTML = '<p>Chargement du contenu…</p>';
    const result = await ipcRenderer.invoke('kaloneo-library:get-parcours-details', meta.id).catch(() => null);
    if (!result || result.ok !== true) {
      detail.innerHTML = '<p>Contenu du parcours inaccessible.</p>';
      return;
    }
    focusedDetails = result.details;
    const d = result.details;
    const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
    const tests = (d.tests || []).map((entry,index) => '<li><b>'+(index+1)+'.</b> '+esc(entry.meta?.title || entry.ref?.id || 'Test introuvable')+' <small>v'+esc(entry.meta?.version || entry.ref?.version || '')+'</small></li>').join('');
    detail.innerHTML = `
      <h3>${esc(d.name)}</h3>
      <div class="pc-meta">Créateur : ${esc(d.creator || '—')} • ${d.testCount} test${d.testCount>1?'s':''}${d.systemProvided?' • modèle fourni':''}</div>
      <div class="pc-grid">
        <div class="pc-label">Écran de masquage</div><div>${esc(d.maskScreenMeta?.name || 'KALONÉO')}</div>
        <div class="pc-label">Introduction</div><div>${esc(d.introductionMeta?.title || d.introduction?.id || '—')}</div>
        <div class="pc-label">Page de fin</div><div>${esc(d.finMeta?.title || d.fin?.id || '—')}</div>
      </div>
      <div class="pc-label">Tests dans l’ordre</div>
      <ol>${tests || '<li>Aucun test intermédiaire</li>'}</ol>`;
  };

  for (const meta of listResult.parcours || []) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pc-item';
    button.dataset.id = String(meta.id);
    const maskName = meta.maskScreenMeta?.name || 'KALONÉO';
    button.innerHTML = '<strong></strong><span></span>';
    button.querySelector('strong').textContent = meta.name;
    button.querySelector('span').textContent =
      meta.testCount + ' test' + (meta.testCount > 1 ? 's' : '') + ' • masque : ' + maskName +
      (meta.systemProvided ? ' • modèle fourni' : '');
    button.addEventListener('click', () => renderDetails(meta));
    list.appendChild(button);
  }

  refreshSelectedLabel();
  refreshCorrectionChoice();
  const first = (listResult.parcours || []).find(item => String(item.id) === selectedId) || (listResult.parcours || [])[0] || null;
  if (first) await renderDetails(first);

  correctionsNoButton.addEventListener('click', () => {
    showCorrectionsDuringParcours = false;
    refreshCorrectionChoice();
    refreshChooseState();
  });
  correctionsYesButton.addEventListener('click', () => {
    showCorrectionsDuringParcours = true;
    refreshCorrectionChoice();
    refreshChooseState();
  });

  layer.querySelector('#pc-close').addEventListener('click', () => layer.remove());
  layer.addEventListener('click', event => { if (event.target === layer) layer.remove(); });

  chooseButton.addEventListener('click', async () => {
    if (!focused) return;
    chooseButton.disabled = true;
    const result = await ipcRenderer.invoke('kaloneo-library:select-parcours', {
      id:focused.id,
      launchOptions:{ showCorrectionsDuringParcours }
    }).catch(() => null);
    if (!result || result.ok !== true) {
      chooseButton.disabled = false;
      await showTransferMessage('Choix du parcours', result?.error || 'Le parcours n’a pas pu être sélectionné.', true);
      return;
    }
    selectedId = String(result.selected?.id || focused.id);
    selectedShowCorrections = result.selected?.launchOptions?.showCorrectionsDuringParcours === true;
    showCorrectionsDuringParcours = selectedShowCorrections;
    refreshCorrectionChoice();
    refreshSelectedLabel();
    chooseButton.textContent = 'Parcours choisi ✓';
    setTimeout(() => {
      chooseButton.textContent = 'Choisir ce parcours';
      refreshChooseState();
    }, 1000);
  });

  openButton.addEventListener('click', () => {
    if (!focused) return;
    adminNavigationLeaving = true;
    layer.remove();
    window.location.href = 'admin-parcours-builder.html?edit=' + encodeURIComponent(focused.id);
  });

  return layer;
}

function injectAdminBar() {
  if (!document.body || document.getElementById('seb-evalpro-topbar')) return;

  const bar = document.createElement('div');
  bar.id = 'seb-evalpro-topbar';
  bar.innerHTML = `
    <div class="seb-evalpro-name">SEB EvalPro</div>
    <div id="seb-evalpro-build" class="seb-evalpro-build">${APP_BUILD_LABEL}</div>
    <div id="seb-evalpro-candidate-badge" class="seb-evalpro-candidate-badge" hidden></div>
    <div class="seb-evalpro-spacer"></div>
    <button id="seb-evalpro-return" type="button" hidden>Retour à l'évaluation</button>
    <button id="seb-evalpro-bilan" type="button" hidden>Bilan</button>
    <button id="seb-evalpro-export-candidates" type="button" hidden>↑ Exporter dossiers</button>
    <button id="seb-evalpro-import-candidates" type="button" hidden>↓ Importer dossiers</button>
    <button id="seb-evalpro-tests-parcours" type="button" hidden>Tests / Parcours</button>
    <button id="seb-evalpro-choose-parcours" type="button" hidden>Choix du parcours</button>
    <button id="seb-evalpro-show-privacy" type="button" hidden>Afficher l’écran d’accueil</button>
    <button id="seb-evalpro-finish-candidate" type="button" hidden>Terminer le parcours du candidat</button>
    <button id="seb-evalpro-quit-application" type="button" hidden>Quitter</button>
    <button id="seb-evalpro-close-session" type="button" hidden>Fermer la session active</button>
    <button id="seb-evalpro-admin" type="button">Administrateur</button>`;

  const hotzone = document.createElement('div');
  hotzone.id = 'seb-evalpro-top-hotzone';
  hotzone.setAttribute('aria-hidden', 'true');

  const style = document.createElement('style');
  style.id = 'seb-evalpro-shell-style';
  style.textContent = `
    html{box-sizing:border-box}
    body{padding-top:0 !important;box-sizing:border-box}
    #seb-evalpro-top-hotzone{position:fixed;top:0;left:0;right:0;height:${HOTZONE_HEIGHT}px;z-index:2147483645;background:transparent}
    #seb-evalpro-topbar{position:fixed;top:0;left:0;right:0;height:${BAR_HEIGHT}px;z-index:2147483646;display:flex;align-items:center;gap:4px;padding:0 6px;box-sizing:border-box;overflow:hidden;background:#0070c0;color:#fff;font-family:Arial,sans-serif;box-shadow:0 1px 4px rgba(0,0,0,.25);transform:translateY(-100%);transition:transform .16s ease;will-change:transform}
    #seb-evalpro-topbar.seb-evalpro-visible{transform:translateY(0)}
    #seb-evalpro-topbar .seb-evalpro-name{font-size:18px;font-weight:700;white-space:nowrap}
    #seb-evalpro-topbar .seb-evalpro-build{font-size:12px;font-weight:700;white-space:nowrap;opacity:.9;padding:3px 7px;border:1px solid rgba(255,255,255,.55);border-radius:10px}
    #seb-evalpro-topbar .seb-evalpro-candidate-badge{font-size:13px;font-weight:700;white-space:nowrap;padding:5px 9px;border:1px solid rgba(255,255,255,.55);border-radius:4px;background:rgba(255,255,255,.14)}
    #seb-evalpro-topbar .seb-evalpro-spacer{flex:1}
    #seb-evalpro-topbar button{font-family:Arial,sans-serif;font-size:15px;font-weight:400;line-height:1;height:36px;min-height:36px;max-height:36px;padding:1px 4px;margin:0;box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;flex:0 1 auto;white-space:normal;text-align:center;overflow:hidden;border:1px solid rgba(255,255,255,.75);border-radius:4px;background:#fff;color:#0070c0;cursor:pointer}
    #seb-evalpro-topbar button:hover{background:#f2f2f2}
    #seb-evalpro-topbar #seb-evalpro-finish-candidate{background:#fff4e5;color:#8a4b00;border-color:#fff}
    #seb-evalpro-topbar #seb-evalpro-quit-application{background:#fff;color:#0070c0;border-color:#fff}
    #seb-evalpro-topbar #seb-evalpro-close-session{background:#c00000;color:#fff;border-color:#fff}
    #seb-evalpro-topbar #seb-evalpro-close-session:hover{background:#a00000}
    /* SEB_ADMIN_BUTTON_POLISH */
    #seb-evalpro-topbar button,
    #seb-evalpro-admin-dialog button,
    #seb-evalpro-session-close-dialog button,
    #seb-evalpro-transfer-dialog button,
    #seb-evalpro-results-dialog button,
    #seb-replay-chooser button,
    #seb-replay-viewer button,
    #seb-bilan-history-chooser button,
    #seb-bilan-history-editor button{
      background:#fff!important;color:#0070c0!important;border:2px solid #0070c0!important;border-radius:6px!important;
      box-shadow:0 2px 5px rgba(0,0,0,.18),inset 0 1px 0 rgba(255,255,255,.95)!important;
      font-weight:700!important;cursor:pointer;transition:background .12s ease,box-shadow .12s ease,transform .12s ease
    }
    /* La barre Admin reste volontairement plus légère que les boutons de dialogue. */
    #seb-evalpro-topbar button{
      font-weight:400!important;font-size:15px!important;line-height:1!important;
      height:36px!important;min-height:36px!important;max-height:36px!important;
      padding:1px 4px!important;margin:0!important;box-sizing:border-box!important;
      display:inline-flex!important;align-items:center!important;justify-content:center!important;
      transform:none!important;white-space:normal!important;text-align:center!important;overflow:hidden!important
    }
    /* IMPORTANT : hidden doit gagner sur le display:inline-flex!important ci-dessus. */
    #seb-evalpro-topbar button[hidden]{display:none!important}
    /* Ces trois commandes ne sont plus des commandes globales de la barre Admin. */
    #seb-evalpro-topbar #seb-evalpro-bilan,
    #seb-evalpro-topbar #seb-evalpro-return,
    #seb-evalpro-topbar #seb-evalpro-finish-candidate{display:none!important}
    /* Les groupes hérités restent compacts sans modifier leurs modules de référence. */
    #seb-evalpro-topbar .seb-admin-left-actions,
    #seb-evalpro-topbar .seb-admin-right-actions{gap:4px!important;margin-left:4px!important;padding-left:6px!important}
    #seb-evalpro-topbar button:hover{background:#f5f9fd!important;box-shadow:0 2px 5px rgba(0,0,0,.18),inset 0 1px 0 #fff!important;transform:none!important}
    #seb-evalpro-topbar button:active{transform:none!important;box-shadow:inset 0 1px 3px rgba(0,0,0,.20)!important}
    /* Fenêtres Export / Import : même style léger que la barre Admin. */
    #seb-evalpro-export-destination-dialog button,
    #seb-evalpro-transfer-password-dialog button,
    #seb-evalpro-transfer-dialog button{
      font-family:Arial,sans-serif!important;font-size:14px!important;font-weight:400!important;
      padding:6px 12px!important;border:1px solid #0070c0!important;border-radius:4px!important;
      background:#fff!important;color:#0070c0!important;box-shadow:none!important;transform:none!important;
    }
    #seb-evalpro-export-destination-dialog button:hover,
    #seb-evalpro-transfer-password-dialog button:hover,
    #seb-evalpro-transfer-dialog button:hover{
      background:#f2f2f2!important;box-shadow:none!important;transform:none!important;
    }
    #seb-evalpro-admin-dialog button:hover,
    #seb-evalpro-session-close-dialog button:hover,
    #seb-evalpro-transfer-dialog button:hover,
    #seb-evalpro-results-dialog button:hover,
    #seb-replay-chooser button:hover,
    #seb-replay-viewer button:hover,
    #seb-bilan-history-chooser button:hover,
    #seb-bilan-history-editor button:hover{
      background:#f5f9fd!important;box-shadow:0 3px 7px rgba(0,0,0,.22),inset 0 1px 0 #fff!important;transform:translateY(-1px)
    }
    #seb-evalpro-admin-dialog button:active,
    #seb-evalpro-session-close-dialog button:active,
    #seb-evalpro-transfer-dialog button:active,
    #seb-evalpro-results-dialog button:active,
    #seb-replay-chooser button:active,
    #seb-replay-viewer button:active,
    #seb-bilan-history-chooser button:active,
    #seb-bilan-history-editor button:active{transform:translateY(0);box-shadow:inset 0 1px 3px rgba(0,0,0,.20)!important}
    #seb-evalpro-topbar #seb-evalpro-close-session,
    #seb-evalpro-topbar #seb-evalpro-quit-application,
    #seb-evalpro-session-close-dialog button.danger,
    #seb-bilan-history-chooser button.danger,
    #seb-bilan-history-editor button.danger{
      background:#fff!important;color:#c00000!important;border-color:#c00000!important
    }
    #seb-evalpro-topbar #seb-evalpro-close-session:hover,
    #seb-evalpro-topbar #seb-evalpro-quit-application:hover,
    #seb-evalpro-session-close-dialog button.danger:hover,
    #seb-bilan-history-chooser button.danger:hover,
    #seb-bilan-history-editor button.danger:hover{background:#fff4f4!important}
    #seb-evalpro-admin-help{
      position:fixed;z-index:2147483647;max-width:330px;padding:9px 12px;box-sizing:border-box;
      border:1px solid #7f9db9;border-radius:5px;background:#fff;color:#1f1f1f;
      font:400 13px/1.35 Arial,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.22);
      pointer-events:none;text-align:left
    }
    #seb-evalpro-admin-help[hidden]{display:none!important}
    #seb-evalpro-topbar button:disabled,
    #seb-evalpro-admin-dialog button:disabled,
    #seb-evalpro-session-close-dialog button:disabled,
    #seb-evalpro-transfer-dialog button:disabled,
    #seb-evalpro-results-dialog button:disabled,
    #seb-replay-chooser button:disabled,
    #seb-replay-viewer button:disabled,
    #seb-bilan-history-chooser button:disabled,
    #seb-bilan-history-editor button:disabled{opacity:.48!important;transform:none!important;cursor:default!important}

  `;
  document.head.appendChild(style);
  document.body.prepend(bar);
  document.body.prepend(hotzone);

  const adminButton = bar.querySelector('#seb-evalpro-admin');
  const candidateBadge = bar.querySelector('#seb-evalpro-candidate-badge');
  const bilanButton = bar.querySelector('#seb-evalpro-bilan');
  const returnButton = bar.querySelector('#seb-evalpro-return');
  const exportCandidatesButton = bar.querySelector('#seb-evalpro-export-candidates');
  const importCandidatesButton = bar.querySelector('#seb-evalpro-import-candidates');
  const testsParcoursButton = bar.querySelector('#seb-evalpro-tests-parcours');
  const chooseParcoursButton = bar.querySelector('#seb-evalpro-choose-parcours');
  const showPrivacyButton = bar.querySelector('#seb-evalpro-show-privacy');
  const finishCandidateButton = bar.querySelector('#seb-evalpro-finish-candidate');
  const quitApplicationButton = bar.querySelector('#seb-evalpro-quit-application');
  const closeSessionButton = bar.querySelector('#seb-evalpro-close-session');

  const showBar = () => {
    clearTimeout(barHideTimer);
    bar.classList.add('seb-evalpro-visible');
  };

  const hideBar = () => {
    const help = document.getElementById('seb-evalpro-admin-help');
    if (help && !help.hidden) return;
    if (document.getElementById('seb-evalpro-admin-dialog')) return;
    if (document.getElementById('seb-evalpro-session-close-dialog')) return;
    if (document.getElementById('seb-evalpro-quit-application-dialog')) return;
    if (document.getElementById('seb-evalpro-transfer-dialog')) return;
    if (document.getElementById('seb-evalpro-transfer-password-dialog')) return;
    bar.classList.remove('seb-evalpro-visible');
  };

  const scheduleHideBar = () => {
    clearTimeout(barHideTimer);
    barHideTimer = setTimeout(() => {
      if (!bar.matches(':hover') && !hotzone.matches(':hover')) hideBar();
    }, BAR_HIDE_DELAY);
  };

  hotzone.addEventListener('mouseenter', showBar);
  hotzone.addEventListener('mouseleave', scheduleHideBar);
  bar.addEventListener('mouseenter', showBar);
  bar.addEventListener('mouseleave', scheduleHideBar);
  document.addEventListener('mousemove', (event) => {
    if (event.clientY <= 2) showBar();
  }, true);

  // Aide contextuelle commune de la barre Administrateur (type infobulle Word).
  const ADMIN_HELP_DELAY_MS = 650;
  const ADMIN_HELP_VISIBLE_MS = 2800;
  let adminHelpShowTimer = null;
  let adminHelpHideTimer = null;
  let adminHelpButton = null;

  const adminHelpText = (button) => {
    if (!button) return '';
    const id = String(button.id || '');
    const help = {
      'seb-evalpro-open-candidate': 'Ouvre la liste des candidats enregistrés pour consulter leurs résultats, Replay ou bilan.',
      'seb-evalpro-bilan': 'Ouvre le bilan du candidat sélectionné.',
      'seb-evalpro-return': 'Ferme cette consultation et revient au dossier candidat.',
      'seb-evalpro-export-candidates': 'Copie les dossiers candidats vers une clé USB ou un dossier.',
      'seb-evalpro-import-candidates': 'Importe dans SEB EvalPro des dossiers candidats provenant d’un autre poste.',
      'seb-evalpro-tests-parcours': 'Ouvre la page de gestion des tests et des parcours KALONÉO.',
      'seb-evalpro-choose-parcours': 'Ouvre la bibliothèque des parcours, affiche leur contenu et choisit celui du prochain candidat.',
      'seb-evalpro-show-privacy': 'Affiche l’écran d’accueil SEB EvalPro afin de masquer temporairement les informations affichées.',
      'seb-evalpro-close-session': 'Termine définitivement le parcours candidat en cours et revient à l’espace Administrateur.',
      'seb-evalpro-quit-application': 'Ferme SEB EvalPro. Un parcours encore actif est sauvegardé pour pouvoir être repris.',
      'seb-evalpro-replay': 'Ouvre le Replay du candidat sélectionné.',
      'seb-evalpro-results': 'Ouvre les résultats du candidat sélectionné.'
    };
    if (id === 'seb-evalpro-admin') {
      return String(button.textContent || '').trim() === 'Verrouiller'
        ? 'Verrouille l’accès Administrateur et revient au mode candidat sécurisé.'
        : 'Ouvre l’accès Administrateur protégé par mot de passe.';
    }
    if (help[id]) return help[id];
    const label = String(button.textContent || '').replace(/\s+/g, ' ').trim();
    return label ? `Commande « ${label} ».` : '';
  };

  const ensureAdminHelp = () => {
    let tooltip = document.getElementById('seb-evalpro-admin-help');
    if (tooltip) return tooltip;
    tooltip = document.createElement('div');
    tooltip.id = 'seb-evalpro-admin-help';
    tooltip.setAttribute('role', 'tooltip');
    tooltip.hidden = true;
    document.body.appendChild(tooltip);
    return tooltip;
  };

  const hideAdminHelp = (reschedule = false) => {
    clearTimeout(adminHelpShowTimer);
    clearTimeout(adminHelpHideTimer);
    adminHelpShowTimer = null;
    adminHelpHideTimer = null;
    adminHelpButton = null;
    const tooltip = document.getElementById('seb-evalpro-admin-help');
    if (tooltip) {
      tooltip.hidden = true;
      tooltip.textContent = '';
    }
    if (reschedule) scheduleHideBar();
  };

  const positionAdminHelp = (tooltip, button) => {
    const rect = button.getBoundingClientRect();
    tooltip.style.left = '8px';
    tooltip.style.top = (Math.max(BAR_HEIGHT + 6, rect.bottom + 6)) + 'px';
    tooltip.style.maxWidth = '330px';
    const width = Math.min(330, Math.max(180, tooltip.getBoundingClientRect().width || 260));
    const left = Math.max(8, Math.min(window.innerWidth - width - 8, rect.left + (rect.width / 2) - (width / 2)));
    tooltip.style.left = Math.round(left) + 'px';
  };

  const scheduleAdminHelp = (button) => {
    const message = adminHelpText(button);
    if (!message || button.hidden || button.disabled) {
      hideAdminHelp(false);
      return;
    }
    if (adminHelpButton === button && document.getElementById('seb-evalpro-admin-help')?.hidden === false) return;
    hideAdminHelp(false);
    adminHelpButton = button;
    adminHelpShowTimer = setTimeout(() => {
      if (!adminHelpButton || adminHelpButton !== button || button.hidden || button.disabled) return;
      const tooltip = ensureAdminHelp();
      tooltip.textContent = message;
      tooltip.hidden = false;
      positionAdminHelp(tooltip, button);
      adminHelpHideTimer = setTimeout(() => hideAdminHelp(true), ADMIN_HELP_VISIBLE_MS);
    }, ADMIN_HELP_DELAY_MS);
  };

  const maybeScheduleAdminHelp = (event) => {
    const button = event.target && event.target.closest ? event.target.closest('button') : null;
    if (!button || !bar.contains(button)) return;
    const css = window.getComputedStyle(button);
    if (button.hidden || button.disabled || css.display === 'none' || css.visibility === 'hidden') return;
    const tooltip = document.getElementById('seb-evalpro-admin-help');
    if (adminHelpButton === button && (adminHelpShowTimer || (tooltip && tooltip.hidden === false))) return;
    scheduleAdminHelp(button);
  };
  bar.addEventListener('mouseover', maybeScheduleAdminHelp);
  bar.addEventListener('mousemove', maybeScheduleAdminHelp);
  bar.addEventListener('mouseout', (event) => {
    const button = event.target && event.target.closest ? event.target.closest('button') : null;
    if (!button || !bar.contains(button)) return;
    if (button.contains(event.relatedTarget)) return;
    if (adminHelpButton === button && document.getElementById('seb-evalpro-admin-help')?.hidden !== false) {
      clearTimeout(adminHelpShowTimer);
      adminHelpShowTimer = null;
      adminHelpButton = null;
    }
  });
  bar.addEventListener('click', () => hideAdminHelp(false), true);

  const refreshCandidateBadge = async () => {
    if (!candidateBadge) return;
    if (!adminUnlocked) {
      candidateBadge.hidden = true;
      candidateBadge.textContent = '';
      return;
    }
    try {
      if (adminCandidateWorkspace && adminCandidateWorkspace.candidate) {
        const selected = adminCandidateWorkspace.candidate;
        const selectedName = [selected.prenom || selected['prénom'], selected.nom].filter(Boolean).join(' ').trim();
        candidateBadge.textContent = 'Bilan candidat : ' + (selectedName || 'candidat sélectionné');
        candidateBadge.hidden = false;
        return;
      }
      if (adminCandidateResultsWorkspace && adminCandidateResultsWorkspace.candidate) {
        const selected = adminCandidateResultsWorkspace.candidate;
        const selectedName = [selected.prenom || selected['prénom'], selected.nom].filter(Boolean).join(' ').trim();
        candidateBadge.textContent = 'Résultats candidat : ' + (selectedName || 'candidat sélectionné');
        candidateBadge.hidden = false;
        return;
      }
      if (isAdminCandidatesPage()) {
        candidateBadge.textContent = 'Administration des dossiers candidats';
        candidateBadge.hidden = false;
        return;
      }
      if (isAdminTestsParcoursPage()) {
        candidateBadge.textContent = 'Gestion Tests / Parcours';
        candidateBadge.hidden = false;
        return;
      }
      const active = await ipcRenderer.invoke('candidate:active');
      if (active && active.displayName) {
        candidateBadge.textContent = `Dossier candidat : ${active.displayName}`;
        candidateBadge.hidden = false;
      } else {
        candidateBadge.textContent = 'Dossier candidat : aucun';
        candidateBadge.hidden = false;
      }
    } catch (_) {
      candidateBadge.hidden = true;
    }
  };

  const updateAdminButtons = () => {
    const onBilan = isAdminBilanPage();
    const onCandidateResults = !!adminCandidateResultsWorkspace;
    const onAdminDetail = (!!adminCandidateWorkspace && onBilan) || onCandidateResults;
    // Bilan et Retour au candidat ne sont plus des commandes globales.
    bilanButton.hidden = true;
    returnButton.hidden = true;
    exportCandidatesButton.textContent = '↑ Exporter dossiers';
    importCandidatesButton.textContent = '↓ Importer dossiers';
    // R35 : Import / Export candidats se gèrent depuis la fenêtre Liste des candidats.
    exportCandidatesButton.hidden = true;
    importCandidatesButton.hidden = true;
    testsParcoursButton.hidden = true;
    chooseParcoursButton.hidden = true;
    showPrivacyButton.hidden = !adminUnlocked;
    // Une seule commande de fin de parcours : "Fermer la session active".
    // L'ancien bouton "Terminer le parcours du candidat" reste volontairement masqué.
    finishCandidateButton.hidden = true;
    closeSessionButton.hidden = true;
    quitApplicationButton.hidden = !adminUnlocked;
    adminButton.textContent = adminUnlocked ? 'Verrouiller' : 'Administrateur';
    refreshCandidateBadge();
    if (adminUnlocked) {
      ipcRenderer.invoke('candidate:active').then((active) => {
        closeSessionButton.hidden = !active;
        testsParcoursButton.hidden = !!active || onAdminDetail || isAdminTestsParcoursPage();
        chooseParcoursButton.hidden = !!active || onAdminDetail;
        finishCandidateButton.hidden = true;
      }).catch(() => {
        closeSessionButton.hidden = true;
        testsParcoursButton.hidden = true;
        chooseParcoursButton.hidden = true;
        finishCandidateButton.hidden = true;
      });
    }
  };

  adminButton.addEventListener('click', async () => {
    showBar();

    if (adminUnlocked) {
      if (adminCandidateWorkspace || adminCandidateResultsWorkspace) {
        await ipcRenderer.invoke('ai:cancel-current').catch(() => false);
      }
      // SEB_ADMIN_NAVIGATION_SAFE_LOCK
      if (adminCandidateWorkspace && isAdminBilanPage()) {
        const saved = saveNow(true);
        if (saved && saved.ok === false) {
          await showTransferMessage('Verrouillage impossible', saved.error || 'Le bilan candidat n’a pas pu être sauvegardé.', true);
          return;
        }
      }
      adminNavigationLeaving = true;
      if (adminCandidateResultsWorkspace) {
        await ipcRenderer.invoke('candidate-catalog:end-results').catch(() => false);
        adminCandidateResultsWorkspace = null;
      }
      if (adminCandidateWorkspace) {
        await ipcRenderer.invoke('candidate-catalog:end-bilan').catch(() => false);
        adminCandidateWorkspace = null;
      }
      await ipcRenderer.invoke('candidate:set-admin-export-context', '').catch(() => false);
      const activeBeforeLock = await ipcRenderer.invoke('candidate:active').catch(() => null);
      if (!activeBeforeLock) {
        const selectedRuntime = await ipcRenderer.invoke('kaloneo-library:selected-runtime').catch(() => null);
        if (!selectedRuntime || selectedRuntime.ok !== true) {
          adminNavigationLeaving = false;
          await showTransferMessage('Verrouillage impossible', selectedRuntime?.error || 'Aucun parcours valide n’est sélectionné.', true);
          return;
        }
      }
      try { window.localStorage.setItem('seb_evalpro_privacy_screen', 'temporary'); } catch (_) {}
      await ipcRenderer.invoke('admin:lock');
      adminUnlocked = false;
      updateAdminButtons();
      scheduleHideBar();
      return;
    }

    const ok = await createPasswordDialog();
    if (ok) {
      const saved = saveNow(true);
      if (saved && saved.ok === false) {
        await showTransferMessage('Accès administrateur impossible', saved.error || 'La sauvegarde du parcours n’a pas pu être confirmée.', true);
        await ipcRenderer.invoke('admin:lock').catch(() => false);
        adminUnlocked = false;
        updateAdminButtons();
        scheduleHideBar();
        return;
      }
      adminUnlocked = true;
      updateAdminButtons();
      // Après déverrouillage, quitter immédiatement l'écran du parcours :
      // l'Administrateur arrive toujours sur l'écran neutre Espace administrateur.
      adminNavigationLeaving = true;
      await ipcRenderer.invoke('admin:open-candidate-browser').catch(() => false);
      return;
    }
    scheduleHideBar();
  });

  bilanButton.addEventListener('click', () => {
    // Aucun bilan pendant un parcours : le bilan se lance uniquement depuis la fiche candidat.
  });

  returnButton.addEventListener('click', async () => {
    if (adminCandidateResultsWorkspace || adminCandidateWorkspace) {
      await ipcRenderer.invoke('ai:cancel-current').catch(() => false);
    }
    if (adminCandidateResultsWorkspace) {
      const candidateId = String(adminCandidateResultsWorkspace.candidateId || '');
      adminNavigationLeaving = true;
      await ipcRenderer.invoke('candidate-catalog:end-results').catch(() => false);
      adminCandidateResultsWorkspace = null;
      await ipcRenderer.invoke('admin:return-candidate-browser', candidateId);
      return;
    }
    if (adminCandidateWorkspace) {
      const candidateId = String(adminCandidateWorkspace.candidateId || '');
      const saved = saveNow(true);
      if (saved && saved.ok === false) {
        await showTransferMessage('Retour impossible', saved.error || 'Le bilan candidat n’a pas pu être sauvegardé.', true);
        return;
      }
      adminNavigationLeaving = true;
      await ipcRenderer.invoke('candidate-catalog:end-bilan').catch(() => false);
      await ipcRenderer.invoke('candidate:set-admin-export-context', '').catch(() => false);
      adminCandidateWorkspace = null;
      await ipcRenderer.invoke('admin:return-candidate-browser', candidateId);
    }
  });

  showPrivacyButton.addEventListener('click', () => {
    showBar();
    window.dispatchEvent(new CustomEvent('seb-evalpro-show-privacy'));
  });

  chooseParcoursButton.addEventListener('click', async () => {
    showBar();
    const active = await ipcRenderer.invoke('candidate:active').catch(() => null);
    if (active) {
      chooseParcoursButton.hidden = true;
      await showTransferMessage('Choix du parcours', 'Le parcours ne peut plus être changé pendant une évaluation active.');
      scheduleHideBar();
      return;
    }
    await createParcoursChoiceDialog();
  });

  testsParcoursButton.addEventListener('click', async () => {
    showBar();
    const active = await ipcRenderer.invoke('candidate:active').catch(() => null);
    if (active) {
      testsParcoursButton.hidden = true;
      await showTransferMessage(
        'Tests / Parcours',
        'Cette page est disponible lorsqu’aucun parcours candidat n’est actif.'
      );
      scheduleHideBar();
      return;
    }
    adminNavigationLeaving = true;
    const opened = await ipcRenderer.invoke('admin:open-tests-parcours').catch(() => false);
    if (!opened) {
      adminNavigationLeaving = false;
      await showTransferMessage('Tests / Parcours', 'La page Tests / Parcours n’a pas pu être ouverte.', true);
      scheduleHideBar();
    }
  });

  candidateExportAction = async (candidateIds = null) => {
    showBar();
    const selectedCandidateIds = Array.isArray(candidateIds)
      ? [...new Set(candidateIds.map((id) => String(id || '').trim()).filter(Boolean))]
      : null;
    if (selectedCandidateIds && !selectedCandidateIds.length) {
      await showTransferMessage('Export candidats', 'Sélectionnez au moins un candidat à exporter.');
      return false;
    }

    // SEB_ADMIN_EXPORT_REQUIRES_CLOSED_CANDIDATE
    const candidateFolderOpen = !!document.getElementById('seb-candidate-detail')
      || !!adminCandidateWorkspace
      || !!adminCandidateResultsWorkspace
      || !!document.getElementById('seb-bilan-history-editor')
      || !!document.getElementById('seb-replay-viewer');
    if (candidateFolderOpen) {
      await showTransferMessage('Export impossible', 'Fermez le dossier candidat avant de lancer l’export.', true);
      scheduleHideBar();
      return false;
    }

    saveNow(true);
    exportCandidatesButton.disabled = true;
    importCandidatesButton.disabled = true;
    try {
      // Compatibilité de l'ancien accès global : sans sélection explicite, l'export
      // peut encore proposer de clôturer le parcours actif. Depuis la Liste des
      // candidats, seuls les parcours déjà terminés peuvent être sélectionnés.
      if (!selectedCandidateIds) {
        const activeCandidate = await ipcRenderer.invoke('candidate:active').catch(() => null);
        if (activeCandidate && String(activeCandidate.status || '') === 'EN_COURS') {
          const confirmed = await createExportCandidateFinishDialog(activeCandidate);
          if (!confirmed) return false;

          const completed = await ipcRenderer.invoke('candidate:complete-active', 'admin-export').catch((error) => ({
            ok:false,
            error:String(error && error.message ? error.message : error)
          }));
          if (!completed || !completed.ok) {
            await showTransferMessage(
              'Fin de parcours impossible',
              completed && completed.error ? completed.error : 'Le parcours n’a pas pu être terminé avant l’export.',
              true
            );
            return false;
          }

          finishCandidateButton.hidden = true;
          await refreshCandidateBadge();
        }
      }

      const password = await createTransferPasswordDialog('export');
      if (!password) return false;

      const destinationMode = await createExportDestinationModeDialog();
      if (!destinationMode) return false;

      let newFolderName = '';
      if (destinationMode === 'create') {
        newFolderName = await createTransferNameDialog();
        if (!newFolderName) return false;
      }

      let progress = null;
      const onExportProgress = (_event, payload = {}) => {
        if (payload && payload.state === 'started' && !progress) progress = showTransferProgress();
      };
      ipcRenderer.on('admin:export-progress', onExportProgress);
      let result;
      try {
        result = await ipcRenderer.invoke('admin:export-candidates', password, {
          mode:destinationMode,
          folderName:newFolderName,
          candidateIds:selectedCandidateIds
        });
      } finally {
        ipcRenderer.removeListener('admin:export-progress', onExportProgress);
        if (progress) progress.close();
      }
      if (!result || result.cancelled) return false;
      if (!result.ok) {
        await showTransferMessage('Export impossible', result.error || 'Une erreur est survenue pendant l’export.', true);
        return false;
      }
      if (!result.total) {
        await showTransferMessage('Export candidats', 'Aucun dossier candidat n’a été trouvé sur ce PC.');
        return false;
      }
      await showTransferMessage(
        'Export terminé',
        `Copie des fichiers terminée.\nVous pouvez retirer la clé USB en toute sécurité.\n\n${result.added} fichier(s) candidat chiffré(s) créé(s), ${result.updated || 0} mis à jour, ${result.skipped || 0} déjà présent(s) et ignoré(s).\n${result.verifiedFiles || 0} fichier(s) vérifié(s).${result.invalidSkipped ? `\n${result.invalidSkipped} dossier(s) candidat local(aux) illisible(s) ignoré(s) sans bloquer l’export.` : ''}\n\nClé : ${result.destinationRoot}`
      );
      return true;
    } catch (error) {
      await showTransferMessage('Export impossible', String(error && error.message ? error.message : error), true);
      return false;
    } finally {
      exportCandidatesButton.disabled = false;
      importCandidatesButton.disabled = false;
      scheduleHideBar();
    }
  };

  candidateImportAction = async () => {
    showBar();
    exportCandidatesButton.disabled = true;
    importCandidatesButton.disabled = true;
    try {
      const password = await createTransferPasswordDialog('import');
      if (!password) return false;
      let progress = null;
      const onImportProgress = (_event, payload = {}) => {
        if (payload && payload.state === 'started' && !progress) progress = showTransferProgress('import');
      };
      ipcRenderer.on('admin:import-progress', onImportProgress);
      let result;
      try {
        result = await ipcRenderer.invoke('admin:import-candidates', password);
      } finally {
        ipcRenderer.removeListener('admin:import-progress', onImportProgress);
        if (progress) progress.close();
      }
      if (!result || result.cancelled) return false;
      if (!result.ok) {
        await showTransferMessage('Import impossible', result.error || 'Une erreur est survenue pendant l’import.', true);
        return false;
      }
      if (!result.total) {
        await showTransferMessage('Import candidats', 'Aucun fichier candidat chiffré (.seb) n’a été trouvé sur la clé sélectionnée.');
        return false;
      }
      await showTransferMessage(
        'Import terminé',
        `${result.total} dossier(s) candidat(s) détecté(s).\n${result.added} ajouté(s), ${result.updated || 0} mis à jour, ${result.skipped || 0} déjà présent(s) et ignoré(s).${result.trashSkipped ? `\n${result.trashSkipped} évaluation(s) déjà présente(s) dans la Corbeille : non réimportée(s). Restaurez-les depuis la Corbeille si nécessaire.` : ''}\n${result.verifiedFiles || 0} fichier(s) vérifié(s).\n\nDossier SEB EvalPro : ${result.destinationRoot}`
      );
      return true;
    } catch (error) {
      await showTransferMessage('Import impossible', String(error && error.message ? error.message : error), true);
      return false;
    } finally {
      exportCandidatesButton.disabled = false;
      importCandidatesButton.disabled = false;
      scheduleHideBar();
    }
  };

  exportCandidatesButton.addEventListener('click', () => { candidateExportAction(null); });
  importCandidatesButton.addEventListener('click', () => { candidateImportAction(); });

  finishCandidateButton.addEventListener('click', async () => {
    showBar();
    const active = await ipcRenderer.invoke('candidate:active').catch(() => null);
    if (!active) {
      finishCandidateButton.hidden = true;
      await showTransferMessage('Parcours candidat', 'Aucun parcours candidat n’est actuellement en cours sur ce PC.');
      scheduleHideBar();
      return;
    }

    const confirmed = await createCandidateFinishDialog();
    if (!confirmed) {
      scheduleHideBar();
      return;
    }

    const result = await ipcRenderer.invoke('candidate:complete-active', 'admin-manual').catch((error) => ({
      ok:false,
      error:String(error && error.message ? error.message : error)
    }));
    if (!result || !result.ok) {
      await showTransferMessage('Fin de parcours impossible', result && result.error ? result.error : 'Le parcours n’a pas pu être terminé.', true);
      scheduleHideBar();
      return;
    }

    finishCandidateButton.hidden = true;
    await showTransferMessage(
      'Parcours terminé',
      'Le parcours candidat est maintenant terminé. Il ne pourra plus être repris et son dossier est désormais exportable.'
    );
    refreshCandidateBadge();
    scheduleHideBar();
  });

  quitApplicationButton.addEventListener('click', async () => {
    showBar();
    const active = await ipcRenderer.invoke('candidate:active').catch(() => null);
    const confirmed = await createApplicationQuitDialog(active);
    if (!confirmed) {
      scheduleHideBar();
      return;
    }

    await ipcRenderer.invoke('ai:cancel-current').catch(() => false);

    // Sauvegarde synchrone uniquement s'il existe un vrai parcours candidat actif.
    // Une page d'identification vide ne doit jamais créer artificiellement une session.
    // Aucun appel à candidate:complete-active ici : un parcours actif reste EN_COURS.
    if (active) {
      const saved = saveNow(true);
      if (saved && saved.ok === false) {
        await showTransferMessage(
          'Fermeture impossible',
          'La sauvegarde du parcours en cours n’a pas pu être confirmée. SEB EvalPro reste ouvert afin de ne perdre aucune donnée.',
          true
        );
        scheduleHideBar();
        return;
      }
    }

    closingSession = true;
    clearTimeout(saveTimer);
    saveTimer = null;
    if (periodicSaveTimer) {
      clearInterval(periodicSaveTimer);
      periodicSaveTimer = null;
    }

    const quit = await ipcRenderer.invoke('admin:quit-application').catch(() => false);
    if (!quit) {
      closingSession = false;
      if (!isAdminBilanPage() && !isAdminCandidatesPage() && !isTestsParcoursWorkspacePage() && !adminCandidateResultsWorkspace) {
        periodicSaveTimer = setInterval(() => saveNow(false), SAVE_CHECKPOINT_MS);
      }
      scheduleSave();
      await showTransferMessage(
        'Fermeture impossible',
        'SEB EvalPro n’a pas pu quitter. Le parcours reste ouvert et conservé.',
        true
      );
      scheduleHideBar();
    }
  });

  closeSessionButton.addEventListener('click', async () => {
    showBar();
    const confirmed = await createSessionCloseDialog();
    if (!confirmed) {
      scheduleHideBar();
      return;
    }

    await ipcRenderer.invoke('ai:cancel-current').catch(() => false);

    const active = await ipcRenderer.invoke('candidate:active').catch(() => null);

    const saved = saveNow(true);
    if (saved && saved.ok === false) {
      await showTransferMessage(
        'Fermeture impossible',
        'La dernière sauvegarde du parcours n’a pas pu être confirmée. La session reste ouverte afin de ne perdre aucune donnée.',
        true
      );
      scheduleHideBar();
      return;
    }

    // Le Replay est sauvegardé indépendamment, directement dans le dossier candidat.
    // Il ne conditionne jamais la fermeture de la session active.

    // À partir d'ici, aucun autosave tardif ne doit pouvoir remettre la dernière
    // page du candidat comme page de reprise après la clôture.
    closingSession = true;
    candidateJourneyCompleted = true;
    clearTimeout(saveTimer);
    saveTimer = null;
    if (periodicSaveTimer) {
      clearInterval(periodicSaveTimer);
      periodicSaveTimer = null;
    }

    if (active) {
      const completed = await ipcRenderer.invoke('candidate:complete-active', 'admin-session-close').catch((error) => ({
        ok:false,
        error:String(error && error.message ? error.message : error)
      }));
      if (!completed || !completed.ok) {
        closingSession = false;
        candidateJourneyCompleted = false;
        if (!isAdminBilanPage() && !isAdminCandidatesPage() && !isTestsParcoursWorkspacePage() && !adminCandidateResultsWorkspace) {
          periodicSaveTimer = setInterval(() => saveNow(false), SAVE_CHECKPOINT_MS);
        }
        scheduleSave();
        await showTransferMessage(
          'Fermeture impossible',
          completed && completed.error ? completed.error : 'Le parcours candidat n’a pas pu être terminé.',
          true
        );
        scheduleHideBar();
        return;
      }
    }

    const closed = await ipcRenderer.invoke('admin:close-session').catch(() => false);
    if (!closed) {
      closingSession = false;
      candidateJourneyCompleted = false;
      await showTransferMessage(
        'Fermeture impossible',
        active
          ? 'Le parcours candidat est terminé, mais la session n’a pas pu revenir à l’espace Administrateur.'
          : 'La session n’a pas pu revenir à l’espace Administrateur.',
        true
      );
      scheduleHideBar();
      return;
    }

    // Fermer la session active termine le parcours candidat mais ne ferme jamais SEB EvalPro.
    adminNavigationLeaving = true;
    await ipcRenderer.invoke('admin:open-candidate-browser').catch(() => false);
  });

  updateAdminButtons();
  hideBar();
}

try {
  if (isAdminCandidatesPage() || isAdminTestsParcoursPage()) {
    restoredState = { sessionStorage:{}, localStorage:{} };
    try { window.sessionStorage.clear(); } catch (_) {}
    try { window.localStorage.clear(); } catch (_) {}
  } else if (isAdminBilanPage()) {
    const workspace = ipcRenderer.sendSync('candidate-catalog:workspace-load-sync');
    if (workspace && workspace.ok) {
      adminCandidateWorkspace = workspace;
      restoredState = workspace.state || {};
      try { window.sessionStorage.clear(); } catch (_) {}
      try { window.localStorage.clear(); } catch (_) {}
    }
  } else {
    const resultsWorkspace = ipcRenderer.sendSync('candidate-catalog:results-workspace-load-sync');
    if (resultsWorkspace && resultsWorkspace.ok) {
      adminCandidateResultsWorkspace = resultsWorkspace;
      restoredState = resultsWorkspace.state || {};
      // Au chargement, ne jamais montrer un instant la page 0 historique.
      if(document.documentElement){
        document.documentElement.dataset.sebResultsLoading='1';
        document.documentElement.style.visibility='hidden';
      }
      try { window.sessionStorage.clear(); } catch (_) {}
      try { window.localStorage.clear(); } catch (_) {}
    }
  }
  if (!adminCandidateWorkspace && !adminCandidateResultsWorkspace) {
    restoredState = ipcRenderer.sendSync('state:load-sync') || {};
  }
  objectToStorage(window.sessionStorage, restoredState.sessionStorage);
  objectToStorage(window.localStorage, restoredState.localStorage);
  // Figer le parcours réellement exécuté avec le dossier candidat. La page
  // Résultats ne doit jamais dépendre d'un parcours sélectionné plus tard.
  ensureKaloneoResultsManifest();
} catch (_) {}

function showReadOnlyCandidateResults() {
  if (!adminCandidateResultsWorkspace) return;
  const page = document.getElementById('pageFinale');
  if (!page) return;
  let notice = document.getElementById('seb-admin-results-readonly');
  if (!notice) {
    notice = document.createElement('div');
    notice.id = 'seb-admin-results-readonly';
    notice.textContent = 'Résultats enregistrés — lecture seule';
    notice.style.cssText = 'margin:8px 0 14px;padding:8px 12px;border:1px solid #9cc2e5;border-radius:6px;background:#f7fbff;color:#1f4e79;font:700 14px Arial,sans-serif;';
    const heading = page.querySelector('h2');
    if (heading) heading.insertAdjacentElement('afterend', notice);
    else page.prepend(notice);
  }
  const runner = document.createElement('script');
  runner.textContent = "(function(){document.querySelectorAll('.page').forEach(function(p){p.classList.remove('visible');});var page=document.getElementById('pageFinale');if(page)page.classList.add('visible');if(typeof afficherResultat==='function')afficherResultat();window.scrollTo(0,0);})();";
  (document.documentElement || document.body).appendChild(runner);
  runner.remove();
  page.querySelectorAll('input,select,textarea,button').forEach((control) => { control.disabled = true; });

  let closeResults = document.getElementById('seb-admin-results-close');
  if (!closeResults) {
    closeResults = document.createElement('button');
    closeResults.id = 'seb-admin-results-close';
    closeResults.type = 'button';
    closeResults.textContent = 'Fermer les résultats';
    closeResults.style.cssText = 'display:block;margin:0 0 14px auto;padding:8px 14px;border:2px solid #0070c0;border-radius:6px;background:#fff;color:#0070c0;font:700 14px Arial,sans-serif;cursor:pointer;';
    closeResults.addEventListener('click', async () => {
      closeResults.disabled = true;
      await ipcRenderer.invoke('ai:cancel-current').catch(() => false);
      const candidateId = String(adminCandidateResultsWorkspace && adminCandidateResultsWorkspace.candidateId || '');
      adminNavigationLeaving = true;
      await ipcRenderer.invoke('candidate-catalog:end-results').catch(() => false);
      adminCandidateResultsWorkspace = null;
      await ipcRenderer.invoke('admin:return-candidate-browser', candidateId).catch(() => false);
    });
    notice.insertAdjacentElement('afterend', closeResults);
  }
}

async function completeCandidateFromFinalPage() {
  if (candidateJourneyCompleted || candidateCompletionInFlight || adminUnlocked || adminCandidateWorkspace || adminCandidateResultsWorkspace) return;
  if (isAdminCandidatesPage() || isAdminBilanPage()) return;
  const finalPages = [
    document.getElementById('pageFinale'),
    document.getElementById('page-final'),
    document.querySelector('.kaltest-terminal-page')
  ].filter(Boolean);
  if (!finalPages.length) return;
  const finalPage = finalPages.find((page) => {
    const style = window.getComputedStyle(page);
    const rect = page.getBoundingClientRect();
    return page.classList.contains('visible') ||
      (style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || '1') !== 0 &&
       rect.width > 0 && rect.height > 0);
  });
  if (!finalPage) return;

  candidateCompletionInFlight = true;
  try {
    const saved = saveNow(true);
    if (saved && saved.ok === false) return;

    // Le Replay est déjà enregistré au fil du parcours dans le dossier candidat.
    // Une éventuelle mise à jour de son manifeste ne doit jamais bloquer la fin du parcours.

    // Geler immédiatement les sauvegardes de ce parcours pendant la clôture.
    // Si la clôture échoue, on déverrouille pour permettre une nouvelle tentative.
    candidateJourneyCompleted = true;
    clearTimeout(saveTimer);
    if (periodicSaveTimer) clearInterval(periodicSaveTimer);

    const result = await ipcRenderer.invoke('candidate:complete-active', 'candidate-final-page');
    if (!result || !result.ok) {
      candidateJourneyCompleted = false;
      scheduleSave();
    }
  } catch (_) {
  } finally {
    candidateCompletionInFlight = false;
  }
}

window.addEventListener('DOMContentLoaded', async () => {
  document.documentElement.setAttribute('spellcheck', 'false');
  document.querySelectorAll('input, textarea, [contenteditable]').forEach((el) => {
    el.setAttribute('spellcheck', 'false');
    el.setAttribute('autocorrect', 'off');
    el.setAttribute('autocapitalize', 'off');
  });
  adminUnlocked = await ipcRenderer.invoke('admin:status');
  injectAdminBar();
  sebSyncAdminBarState();
  setTimeout(sebSyncAdminBarState, 80);
  setTimeout(sebSyncAdminBarState, 300);
  if (!isKaloneoRealCandidatePreviewPage()) {
    replayPrototype.install();
    replayNavigationCapture.install();
  }
  bilanHistory.install();
  candidateCatalog.install({
    beforeNavigate: () => saveNow(true),
    onImportCandidates: () => candidateImportAction ? candidateImportAction() : Promise.resolve(false),
    onExportCandidates: (candidateIds) => candidateExportAction ? candidateExportAction(candidateIds) : Promise.resolve(false)
  });
  if (adminCandidateResultsWorkspace) {
    showReadOnlyCandidateResults();
    // Le premier rendu des anciens gestionnaires DOMContentLoaded doit finir
    // avant de rendre la fenêtre visible.
    requestAnimationFrame(()=>{
      const root=document.documentElement;
      if(root?.dataset.sebResultsLoading==='1'){
        delete root.dataset.sebResultsLoading;
        root.style.visibility='';
      }
    });
  } else {
    if (!isAdminBilanPage() && !isTestsParcoursWorkspacePage()) {
      document.addEventListener('input', scheduleSave, true);
      document.addEventListener('change', scheduleSave, true);
      document.addEventListener('click', scheduleSave, true);
      periodicSaveTimer = setInterval(() => saveNow(false), SAVE_CHECKPOINT_MS);
    }

    const finalPage = document.getElementById('pageFinale') || document.getElementById('page-final');
    if (finalPage && !isAdminCandidatesPage() && !isAdminBilanPage() && !isAdminTestsParcoursPage()) {
      const observer = new MutationObserver(() => { completeCandidateFromFinalPage(); });
      observer.observe(finalPage, { attributes:true, attributeFilter:['class','style'] });
      setTimeout(() => { completeCandidateFromFinalPage(); }, 0);
    }
    window.addEventListener('seb-kaltest-final', () => { completeCandidateFromFinalPage(); });
  }
});


window.addEventListener('pageshow', async () => {
  try { adminUnlocked = await ipcRenderer.invoke('admin:status'); } catch (_) {}
  sebSyncAdminBarState();
});

window.addEventListener('beforeunload', () => {
  if (!closingSession && !adminNavigationLeaving && !isAdminCandidatesPage() && !isAdminTestsParcoursPage()) saveNow(true);
});

async function closeAdminBilanPage() {
  if (!adminCandidateWorkspace || !isAdminBilanPage()) {
    return { ok:false, error:'Aucun bilan candidat actif.' };
  }

  const candidateId = String(adminCandidateWorkspace.candidateId || '');
  const saved = saveNow(true);
  if (saved && saved.ok === false) {
    return { ok:false, error:saved.error || 'Le bilan candidat n’a pas pu être sauvegardé.' };
  }

  await ipcRenderer.invoke('ai:cancel-current').catch(() => false);
  adminNavigationLeaving = true;

  const ended = await ipcRenderer.invoke('candidate-catalog:end-bilan').catch(() => false);
  if (!ended) {
    adminNavigationLeaving = false;
    return { ok:false, error:'Le bilan n’a pas pu être fermé.' };
  }

  await ipcRenderer.invoke('candidate:set-admin-export-context', '').catch(() => false);
  adminCandidateWorkspace = null;
  const returned = await ipcRenderer.invoke('admin:return-candidate-browser', candidateId).catch(() => false);
  if (!returned) {
    adminNavigationLeaving = false;
    return { ok:false, error:'Le retour au dossier candidat a échoué.' };
  }
  return { ok:true };
}

contextBridge.exposeInMainWorld('sebEvalPro', {
  save: () => saveNow(false),
  captureReplay: () => replayNavigationCapture.captureNow('kaltest-explicit'),
  closeTestsParcours: () => ipcRenderer.invoke('admin:close-tests-parcours'),
  kaloneoListTests: () => ipcRenderer.invoke('kaloneo-library:list-tests'),
  kaloneoTestMetadataSync: () => ipcRenderer.sendSync('kaloneo-library:test-metadata-sync'),
  kaloneoGetTest: (id, version) => ipcRenderer.invoke('kaloneo-library:get-test', { id, version }),
  kaloneoSaveTest: (definition, overwrite, developerOverride=false) =>
    ipcRenderer.invoke('kaloneo-library:save-test', {
      definition,overwrite:overwrite === true,developerOverride:developerOverride===true
    }),
  kaloneoDeveloperStatus: () => ipcRenderer.invoke('kaloneo-developer:status'),
  kaloneoDeveloperUnlock: (password) => ipcRenderer.invoke('kaloneo-developer:unlock',password),
  kaloneoDeveloperExportV1: (definition) => ipcRenderer.invoke('kaloneo-developer:export-v1',definition),
  kaloneoDeleteTest: (id, version) => ipcRenderer.invoke('kaloneo-library:delete-test', { id, version }),
  kaloneoExportTest: (id, version) => ipcRenderer.invoke('kaloneo-transfer:export-test', { id, version }),
  kaloneoImportTest: () => ipcRenderer.invoke('kaloneo-transfer:import-test'),
  kaloneoExportParcours: (id) => ipcRenderer.invoke('kaloneo-transfer:export-parcours', id),
  kaloneoImportParcours: () => ipcRenderer.invoke('kaloneo-transfer:import-parcours'),
  kaloneoListImages: () => ipcRenderer.invoke('kaloneo-library:list-images'),
  kaloneoGetImage: (id) => ipcRenderer.invoke('kaloneo-library:get-image', id),
  kaloneoSaveImage: (payload) => ipcRenderer.invoke('kaloneo-library:save-image', payload || {}),
  kaloneoImportImageZip: () => ipcRenderer.invoke('kaloneo-library:import-image-zip'),
  kaloneoListMaskScreens: () => ipcRenderer.invoke('kaloneo-library:list-mask-screens'),
  kaloneoGetMaskScreen: (ref) => ipcRenderer.invoke('kaloneo-library:get-mask-screen', ref || null),
  kaloneoSaveMaskScreen: (maskScreen, overwrite) => ipcRenderer.invoke('kaloneo-library:save-mask-screen', { maskScreen, overwrite:overwrite === true }),
  kaloneoOpenMaskPreview: (definition) => ipcRenderer.invoke('kaloneo-mask:open-preview', definition),
  kaloneoGetMaskPreview: () => ipcRenderer.invoke('kaloneo-mask:get-preview'),
  kaloneoConsumeMaskPreview: () => ipcRenderer.invoke('kaloneo-mask:consume-preview'),
  kaloneoCloseMaskPreview: () => ipcRenderer.invoke('kaloneo-mask:close-preview'),
  kaloneoListParcours: () => ipcRenderer.invoke('kaloneo-library:list-parcours'),
  kaloneoGetParcours: (id) => ipcRenderer.invoke('kaloneo-library:get-parcours', id),
  kaloneoGetParcoursDetails: (id) => ipcRenderer.invoke('kaloneo-library:get-parcours-details', id),
  kaloneoGetSelectedParcours: () => ipcRenderer.invoke('kaloneo-library:get-selected-parcours'),
  kaloneoSelectParcours: (id, launchOptions = {}) => ipcRenderer.invoke('kaloneo-library:select-parcours', { id, launchOptions }),
  kaloneoSelectedParcoursRuntime: () => ipcRenderer.invoke('kaloneo-library:selected-runtime'),
  kaloneoSelectedParcoursRuntimeSync: () => ipcRenderer.sendSync('kaloneo-library:selected-runtime-sync'),
  kaloneoSaveParcours: (payload) => ipcRenderer.invoke('kaloneo-library:save-parcours', payload),
  kaloneoOpenPreview: (definition,editorHistory) => ipcRenderer.invoke('kaloneo-builder:open-preview', definition,editorHistory),
  kaloneoRenderMiniPreview: (definition) => ipcRenderer.invoke('kaloneo-builder:render-mini-preview', definition),
  kaloneoGetPreviewDefinition: () => ipcRenderer.invoke('kaloneo-builder:get-preview'),
  kaloneoConsumePreviewDefinition: () => ipcRenderer.invoke('kaloneo-builder:consume-preview'),
  kaloneoClosePreview: () => ipcRenderer.invoke('kaloneo-builder:close-preview'),
  closeAdminBilan: () => closeAdminBilanPage(),
  exportBilanDocx: (payload) => ipcRenderer.invoke('admin:export-bilan-docx', payload),
  verifyAdminPassword: (password) => ipcRenderer.invoke('admin:verify-password', password),
  sebIaStatus: () => ipcRenderer.invoke('ai:status')
});

// SEB_PRIVACY_SCREEN_103
(function(){
  'use strict';

  const PRIVACY_KEY = 'seb_evalpro_privacy_screen';
  const MODE_TEMP = 'temporary';
  const MODE_FINAL = 'final';
  const MASK_REF_KEY = 'seb_kaloneo_mask_screen_ref';
  let privacyMode = '';
  let privacyMaskScreen = {
    id:'kaloneo-default',
    version:'1.0.0',
    name:'KALONÉO',
    content:{text:'KALONÉO\nAu cœur d’un nouvel élan',image:''}
  };
  let privacyMaskLoaded = false;

  function readPrivacyMode(){
    try {
      const value = String(window.localStorage.getItem(PRIVACY_KEY) || '');
      return value === MODE_TEMP || value === MODE_FINAL ? value : '';
    } catch (_) {
      return '';
    }
  }

  privacyMode = readPrivacyMode();

  // En cas de redémarrage pendant que l'écran de confidentialité était actif,
  // empêcher un flash des données avant création du voile.
  if (privacyMode) {
    try { document.documentElement.style.setProperty('visibility', 'hidden', 'important'); } catch (_) {}
  }

  function savePrivacyMode(mode){
    privacyMode = mode === MODE_TEMP || mode === MODE_FINAL ? mode : '';
    try {
      if (privacyMode) window.localStorage.setItem(PRIVACY_KEY, privacyMode);
      else window.localStorage.removeItem(PRIVACY_KEY);
    } catch (_) {}
    try { saveNow(true); } catch (_) {}
    refreshPrivacy();
  }

  function onFinalResults(){
    const current = String(pageName() || '').toLowerCase();
    if (current === 'qcmv1.0.html') {
      const page = document.getElementById('pageFinale');
      return !!(page && page.classList.contains('visible'));
    }
    if (current === 'kaltest-pilot2.html') {
      const page = document.querySelector('.kaltest-terminal-page') || document.getElementById('page-final');
      return !!(page && (page.classList.contains('visible') || page.classList.contains('kaltest-terminal-page')));
    }
    return false;
  }

  function ensurePrivacyStyle(){
    if (document.getElementById('seb-evalpro-privacy-style')) return;
    const style = document.createElement('style');
    style.id = 'seb-evalpro-privacy-style';
    style.textContent =
      '#seb-evalpro-privacy-toggle{position:fixed!important;right:18px!important;bottom:18px!important;z-index:2147483643!important;margin:0!important;padding:10px 17px!important;border:1.5px solid #004E70!important;border-radius:10px!important;background:linear-gradient(180deg,#fff 0%,#f5f8fc 100%)!important;color:#004E70!important;font:700 15px Calibri,\"Segoe UI\",Arial,sans-serif!important;box-shadow:0 4px 10px rgba(0,0,0,.14),inset 0 1px 0 #fff!important;cursor:pointer!important}' +
      '#seb-evalpro-privacy-toggle:hover{background:linear-gradient(180deg,#fff 0%,#eef4f8 100%)!important;transform:translateY(-1px)!important;box-shadow:0 7px 15px rgba(0,0,0,.17),inset 0 1px 0 #fff!important}' +
      '#seb-evalpro-privacy-layer{position:fixed;inset:0;background:#fff;display:none;align-items:center;justify-content:center;overflow:hidden;font-family:Arial,sans-serif}' +
      '#seb-evalpro-privacy-content{position:absolute;inset:0 0 68px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;padding:28px;box-sizing:border-box;overflow:hidden}' +
      '#seb-evalpro-privacy-layer img{display:block;max-width:94%;max-height:72%;width:auto;height:auto;object-fit:contain;object-position:center;user-select:none;-webkit-user-drag:none}' +
      '#seb-evalpro-privacy-text{max-width:92%;white-space:pre-wrap;text-align:center;color:#004E70;font:700 clamp(24px,4vw,54px) Calibri,"Segoe UI",Arial,sans-serif;line-height:1.2}' +
      '#seb-evalpro-privacy-layer.seb-final-privacy #seb-evalpro-privacy-content{inset:0;padding:0}' +
      '#seb-evalpro-privacy-layer.seb-final-privacy img{position:absolute;inset:0;max-width:none;max-height:none;width:100%;height:100%;object-fit:cover}' +
      '#seb-evalpro-privacy-hide{position:absolute!important;left:50%!important;bottom:24px!important;transform:translateX(-50%)!important;margin:0!important;padding:11px 20px!important;border:0!important;border-radius:8px!important;background:#0070c0!important;color:#fff!important;font:700 15px Arial,sans-serif!important;box-shadow:0 3px 12px rgba(0,0,0,.25)!important;cursor:pointer!important}' +
      '#seb-evalpro-final-privacy-wrap{display:flex!important;justify-content:center!important;margin:22px 0 12px!important}' +
      '#seb-evalpro-final-privacy{margin:0!important;padding:11px 20px!important;border:0!important;border-radius:8px!important;background:#0070c0!important;color:#fff!important;font:700 15px Arial,sans-serif!important;cursor:pointer!important}';
    (document.head || document.documentElement).appendChild(style);
  }

  // Le bouton de confidentialité appartient aux pages candidat, jamais à la barre Admin.
  function placePrivacyToggleForAdminHome(button){
    if (!button) return button;
    const slot = document.getElementById('kaloneo-home-slot');
    if (slot && button.parentElement !== slot) slot.appendChild(button);
    return button;
  }

  function ensurePrivacyToggle(){
    let button = document.getElementById('seb-evalpro-privacy-toggle');
    if (button) return placePrivacyToggleForAdminHome(button);
    button = document.createElement('button');
    button.id = 'seb-evalpro-privacy-toggle';
    button.type = 'button';
    button.textContent = '⌂ Afficher l’écran d’accueil';
    button.addEventListener('click', function(){
      savePrivacyMode(MODE_TEMP);
    });
    document.body.appendChild(button);
    return placePrivacyToggleForAdminHome(button);
  }

  function ensurePrivacyLayer(){
    let layer = document.getElementById('seb-evalpro-privacy-layer');
    if (layer) return layer;

    layer = document.createElement('div');
    layer.id = 'seb-evalpro-privacy-layer';
    layer.setAttribute('role', 'dialog');
    layer.setAttribute('aria-modal', 'true');

    const content = document.createElement('div');
    content.id = 'seb-evalpro-privacy-content';

    const image = document.createElement('img');
    image.id = 'seb-evalpro-privacy-image';
    image.alt = '';
    image.draggable = false;
    image.hidden = true;

    const text = document.createElement('div');
    text.id = 'seb-evalpro-privacy-text';

    content.appendChild(image);
    content.appendChild(text);

    const hide = document.createElement('button');
    hide.id = 'seb-evalpro-privacy-hide';
    hide.type = 'button';
    hide.textContent = 'Masquer l’écran d’accueil';
    hide.addEventListener('click', function(){
      if (privacyMode === MODE_TEMP) savePrivacyMode('');
    });

    layer.appendChild(content);
    layer.appendChild(hide);
    document.body.appendChild(layer);
    return layer;
  }

  function privacyMaskRef(){
    try {
      const raw = sessionStorage.getItem(MASK_REF_KEY) || localStorage.getItem(MASK_REF_KEY) || '';
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed && parsed.id && parsed.version) return {id:String(parsed.id),version:String(parsed.version)};
    } catch (_) {}
    return null;
  }

  function renderPrivacyContent(layer, mode){
    if (!layer) return;
    const image = layer.querySelector('#seb-evalpro-privacy-image');
    const text = layer.querySelector('#seb-evalpro-privacy-text');
    if (mode === MODE_FINAL) {
      layer.classList.add('seb-final-privacy');
      if (image) {
        image.src = 'imageqcm/seb-evalpro-privacy-screen.jpg';
        image.alt = 'SEB-éval-PRO';
        image.hidden = false;
      }
      if (text) { text.textContent=''; text.hidden=true; }
      return;
    }

    layer.classList.remove('seb-final-privacy');
    const value = privacyMaskScreen || {};
    const content = value.content || {};
    const imageValue = String(content.image || '');
    const textValue = String(content.text || '');
    if (image) {
      if (imageValue) image.src=imageValue; else image.removeAttribute('src');
      image.alt = value.name ? String(value.name) : '';
      image.hidden = !imageValue;
    }
    if (text) {
      text.textContent = textValue;
      text.hidden = !textValue.trim();
    }
  }

  async function loadPrivacyMask(){
    if (privacyMaskLoaded) return;
    privacyMaskLoaded = true;
    let ref = privacyMaskRef();
    try {
      const runtime = await ipcRenderer.invoke('kaloneo-library:selected-runtime');
      if (runtime && runtime.ok === true && runtime.runtime?.maskScreen) {
        ref = runtime.runtime.maskScreen;
        try {
          const raw = JSON.stringify(ref);
          sessionStorage.setItem(MASK_REF_KEY, raw);
          localStorage.setItem(MASK_REF_KEY, raw);
        } catch (_) {}
      }
    } catch (_) {}
    try {
      const result = await ipcRenderer.invoke('kaloneo-library:get-mask-screen', ref);
      if (result && result.ok === true && result.maskScreen) privacyMaskScreen = result.maskScreen;
    } catch (_) {}
    try { renderPrivacyContent(document.getElementById('seb-evalpro-privacy-layer'), privacyMode); } catch (_) {}
  }

  function ensureFinalPrivacyButton(){
    if (String(pageName() || '').toLowerCase() !== 'qcmv1.0.html') return null;
    const page = document.getElementById('pageFinale');
    if (!page) return null;

    let wrap = document.getElementById('seb-evalpro-final-privacy-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'seb-evalpro-final-privacy-wrap';

      const button = document.createElement('button');
      button.id = 'seb-evalpro-final-privacy';
      button.type = 'button';
      button.textContent = 'Revenir à l’écran SEB-éval-PRO';
      button.addEventListener('click', function(){
        savePrivacyMode(MODE_FINAL);
      });

      wrap.appendChild(button);
      page.appendChild(wrap);
    }
    return wrap;
  }

  function refreshPrivacy(){
    if (!document.body) return;

    const adminPage = isAdminBilanPage() ||
      (typeof isAdminCandidatesPage === 'function' && isAdminCandidatesPage()) ||
      (typeof isTestsParcoursWorkspacePage === 'function' && isTestsParcoursWorkspacePage()) ||
      !!adminCandidateResultsWorkspace;
    const toggle = ensurePrivacyToggle();
    const layer = ensurePrivacyLayer();
    const hide = layer.querySelector('#seb-evalpro-privacy-hide');
    const finalWrap = ensureFinalPrivacyButton();
    const finalResults = onFinalResults();

    if (adminPage && privacyMode !== MODE_TEMP) {
      toggle.style.setProperty('display', 'none', 'important');
      layer.style.setProperty('display', 'none', 'important');
      if (finalWrap) finalWrap.style.setProperty('display', 'none', 'important');
      document.documentElement.style.removeProperty('visibility');
      return;
    }

    if (finalWrap) {
      finalWrap.style.setProperty('display', finalResults && privacyMode !== MODE_FINAL ? 'flex' : 'none', 'important');
    }

    if (privacyMode === MODE_TEMP) {
      renderPrivacyContent(layer, MODE_TEMP);
      toggle.style.setProperty('display', 'none', 'important');
      layer.style.zIndex = '2147483647';
      layer.style.setProperty('display', 'flex', 'important');
      hide.style.setProperty('display', 'block', 'important');
      hide.setAttribute('aria-hidden', 'false');
    } else if (privacyMode === MODE_FINAL && !adminUnlocked) {
      renderPrivacyContent(layer, MODE_FINAL);
      toggle.style.setProperty('display', 'none', 'important');
      layer.style.zIndex = '2147483644';
      layer.style.setProperty('display', 'flex', 'important');
      hide.style.setProperty('display', 'none', 'important');
      hide.setAttribute('aria-hidden', 'true');
    } else {
      layer.style.setProperty('display', 'none', 'important');
      hide.style.setProperty('display', 'none', 'important');
      toggle.style.setProperty('display', (String(pageName() || '').toLowerCase() === 'introbrique.html' || finalResults) ? 'none' : 'block', 'important');
    }

    document.documentElement.style.removeProperty('visibility');
  }

  function startPrivacy(){
    if (!document.body) return;
    ensurePrivacyStyle();
    loadPrivacyMask();
    refreshPrivacy();

    const observer = new MutationObserver(function(){
      setTimeout(refreshPrivacy, 0);
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'hidden']
    });

    document.addEventListener('click', function(event){
      const admin = event.target && event.target.closest ? event.target.closest('#seb-evalpro-admin') : null;
      if (!admin) return;
      setTimeout(refreshPrivacy, 0);
      setTimeout(refreshPrivacy, 250);
    }, true);

    window.addEventListener('seb-evalpro-show-privacy', function(){
      savePrivacyMode(MODE_TEMP);
    });
  }

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', function(){
      // injectAdminBar() est asynchrone au démarrage; un court délai permet de
      // récupérer aussi le statut Administrateur avant le premier rafraîchissement.
      setTimeout(startPrivacy, 0);
    }, { once: true });
  } else {
    setTimeout(startPrivacy, 0);
  }
})();


// SEB_LOCAL_AI_ADMIN_BAR_FAILSAFE
function sebLocalAiEnsureAdminBar() {
  try {
    if (document.body) injectAdminBar();
  } catch (error) {
    console.error('SEB EvalPro: impossible d’injecter la barre Administrateur', error);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', sebLocalAiEnsureAdminBar, { once: true });
} else {
  sebLocalAiEnsureAdminBar();
}
setTimeout(sebLocalAiEnsureAdminBar, 250);
