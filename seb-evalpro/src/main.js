const { app, BrowserWindow, ipcMain, screen, dialog, Menu, safeStorage, powerMonitor, shell, nativeImage } = require('electron');
// SEB_PRIORITY_FIXES_MAIN
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { getEditionCapabilities } = require('./edition');
const appPackage = require('../package.json');
const APP_BUILD_NUMBER = String(appPackage.sebBuildNumber || '').trim() || 'DEV';
const { createCandidateStore } = require('./candidate-store-main');
const { createCandidateTransfer } = require('./candidate-transfer-main');
const { createKaloneoLibrary } = require('./kaloneo-library-main');
const { embedTestImages, validatePortableTest } = require('./kaloneo-test-portability');
const { configureLocalKey, readJsonFile, encodeJson, migrateJsonFile, migrateJsonTree } = require('./candidate-data-crypto');
const { createCandidateLocalProtection } = require('./candidate-local-protection');
const { internalStorageRoot, documentsWordRoot, migrateLegacyDocumentsStorage } = require('./storage-layout');
const kaloneoFullParcoursRoute = require('./kaloneo-full-parcours-route');
const { buildBilanDocxBuffer } = require('./bilan-docx-main');
const { createPasswordStore } = require('./kaloneo-passwords');
const { inspectCandidateOverflow } = require('./kaloneo-layout-diagnostics');

// The taskbar must show exactly the same chameleon as the candidate's left bar.
// Electron-builder embeds this icon into KALONEO.exe; extraResources also
// supplies the identical icon to Electron for every BrowserWindow.
const KALONEO_WINDOWS_APP_ID = 'fr.sauvegarde56.sebevalpro.kaloneo.pilot22';
function kaloneoWindowsWindowIcon() {
  if (process.platform !== 'win32') return undefined;
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'kaloneo-taskbar.ico')
    : path.join(__dirname, '..', 'build', 'pilot-resources', 'kaloneo.ico');
  return fs.existsSync(iconPath) ? iconPath : undefined;
}

const ADMIN_PASSWORD_SHA256 = 'c800892ba3f11b33d36eedf7d3c4297f2b6c02e2c347dda8954b4c577f6666b5';
// Mot de passe développeur défini par le responsable KALONÉO.
// Le hash ne protège pas contre l'analyse d'un programme local ; le contrôle
// est une séparation des opérations, pas un coffre-fort cryptographique.
const DEVELOPER_PASSWORD_SHA256 = 'a4dd456bdab5214bd0de2f32b5cf036d4bc7466130ce54b75faf44e834801269';
const passwordStore=createPasswordStore({directory:app.getPath('userData'),adminHash:ADMIN_PASSWORD_SHA256,developerHash:DEVELOPER_PASSWORD_SHA256});
const STATE_VERSION = 1;
const MIN_SPLASH_MS = 1400;
const DESIGN_WIDTH = 1600;
const DESIGN_HEIGHT = 900;
const MIN_ZOOM_FACTOR = 0.60;
let mainWindow = null;
let splashWindow = null;
let splashStartedAt = 0;
let adminSessionUnlocked = false;
let developerSessionUnlocked = false;
let adminSessionDocumentPassword = '';
let downloadRoutingInstalled = false;
const editionCapabilities = getEditionCapabilities();
let candidateStore = null;
let candidateTransfer = null;
let candidateProtection = null;
let kaloneoLibrary = null;
let kaloneoBuilderPreviewDefinition = null;
let kaloneoBuilderPreviewEditorHistory = null;
let kaloneoBuilderPreviewFullscreenActive = false;
let kaloneoMiniPreviewWorker = null;
let kaloneoMiniPreviewDefinition = null;
let kaloneoMiniPreviewJob = Promise.resolve();
// Chaque nouvelle demande rend obsolètes les captures encore en attente.
let kaloneoMiniPreviewRequestSerial = 0;
let kaloneoMaskPreviewDefinition = null;
let adminExportCandidateDir = null;
let adminCandidateResultsMode = false;
let lastCandidateSaveError = '';
let allowApplicationExit = false;
let candidateKeyGuardProcess = null;
let candidateWindowsReturnGuardInstalled = false;
// SEB_TEMP_WINDOWS_RECOVERY : temporaire pendant la phase de stabilisation.
const TEMP_ALLOW_WINDOWS_RECOVERY = true;
let stateWriteCounter = 0;

// SEB_ADMIN_WINDOWS_SHELL_MODE
const ADMIN_TASKBAR_OVERLAY_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAEZklEQVR4nLWXW3bbNhCGP4AgRYmS49hpmofuI4vok12voQ/JBrqEbsB+yBra5KmLyE7aJr5LFC8g0AfMxLQin8huO+fMASWC+P8Z3P4xjMyAsYBNrc3BOsgKsAXkk/Sc5eAc2Ez6B2CA6CH04DsYWhg66DsIHoYeQkgeAxAhArgxuBHw7D6wK5PnJbgJuAJcfkfABIgDxB5CB74Fn4Nv0nvfCYRPbRBwEyG6DXCbgckTuCvBTSGfJS9miUReJgLZFgJDk4D7OnnmoF+DNeCNBBshxpQN4xQ8S+A2BzsR4AqKORQLmMyTF1MoypSFzKWBTZT0d0JgDd0yuSugdWCt4IiFQbi4TfAS3EyA96Dcg3Jf2jlMqkTC5VsI9DCswa8SeHsDebGRLSExGMBDcDrnGvlMIn4G5XOYqj+D6UIIvInxPQ/YmTHHK+huhagsWs2AJqFv5cHJgrOFpH0u4AcwO4TZgfg+lG9j/PAQsJqSOzXmaJJ2S5ZJpmT+0/JXAi5Fn5XgqpT2yXOYHsLsBVSHUB3A9OcYf9OPPo5nc8NexzT82xg/vDPmJJPoBTzKNvzCw+zDtEyRF/tQHkL1EuYvoXoB819i/GMX4IeIAPxqzI+fYfk3rD7B8gLqG2hr6Fwh0c8g35j72QFMnwKu/ZXEAUyHtEhDB75PuyAC0fwA+xL99DuoXsHiFSy+h7nO+TbwcYSbwNv6nRpz9Bcs/4TbT7C6gHoJrZ2MMiD7frKAyVPAt73T79/G+GEhY8+hqNLBVrhCjlc98Sp5+SDCDtG+jnErcT3YVlA04D0Eq8euZCIvwelWemz02n/zO/39Jsb3JeRTwSnBWdmGSiQrRhfUY6L/1v9qeplpa7O720/9ccv9kbaBZfUyuue7DLTLVGwz0Rt6AxsrV+M9fwrorv2CuGLZId3lwd/5bihPtA2sYOUaDX2SUEMH/v8k0CaF5LW1AuzbJCb6BvyZMcewe8q/ZTrOmTHHTVJIvSgn7wQ8W4uMWkG3gu4/Qd4wESqdYqyhtxK5V/AltLfQnhpzNGb/VBvfBbcytpKoobOdpKIW8GtorqG5guadMSfjQXa9EbWffvfOmJMrGfcGmltolYDrYLDgRRW1ekqJ7LbjSD4aszOJceYuYH0J9SWsrxOBRgj0poKiGOmBsRr6N4pII7+A9TmsPoufQ32VCLRr8EaizUSQ5qqCn6oJ1U6NObqC5gLqC6jPpb2SKVgnYeqNnMmZquLqa1U8E1Vc7kE5S6r494eAz4z5qYbuRub88uv0t7WA9zAYleUP1QXPRr6AshrJ7QyyUW04dKO64FYIXI8W31IWXgODTx5cTB8HjcCkk9AgRaRouaGFoYa+gokScJAZ0tnt7xNol0JCtl5Xp8h9e6cJQ4DotFBUEr38VgJR7goVlA14LVJVckttGNr7W7pbpe3Wr1LUfZuq5GFIY4eAiA8lIQNBKp0iykTIBCHSiIKSDGhpNrTJ/TqB97Wcdk0q07+o4XGJ/g/1kYxVdSt3vwAAAABJRU5ErkJggg==';
let adminTaskbarOverlayIcon = null;

function getAdminTaskbarOverlayIcon() {
  if (!adminTaskbarOverlayIcon || adminTaskbarOverlayIcon.isEmpty()) {
    adminTaskbarOverlayIcon = nativeImage.createFromDataURL(ADMIN_TASKBAR_OVERLAY_DATA_URL);
  }
  return adminTaskbarOverlayIcon;
}

function applyAdminWindowMode(unlocked) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const isUnlocked = !!unlocked;
  if(isUnlocked && kaloneoBuilderPreviewFullscreenActive) {
    // R48.6 — exactement la surface candidat, sans chrome ni barre Windows.
    // Reste dans le contexte Admin : aucun verrou candidat/session activé.
    try { mainWindow.setAlwaysOnTop(false); } catch (_) {}
    try { mainWindow.setSkipTaskbar(true); } catch (_) {}
    try { mainWindow.setFullScreen(true); } catch (_) {}
    try { mainWindow.setKiosk(true); } catch (_) {}
    try { mainWindow.setMenuBarVisibility(false); } catch (_) {}
    try { mainWindow.focus(); } catch (_) {}
    return;
  }

  if (isUnlocked) {
    try { stopCandidateKeyGuard(); } catch (_) {}
    try { mainWindow.setAlwaysOnTop(false); } catch (_) {}
    try { mainWindow.setSkipTaskbar(false); } catch (_) {}
    try { mainWindow.setKiosk(false); } catch (_) {}
    try { mainWindow.setFullScreen(false); } catch (_) {}
    if (process.platform === 'win32') {
      try { mainWindow.setOverlayIcon(getAdminTaskbarOverlayIcon(), 'Mode administrateur déverrouillé'); } catch (_) {}
    }
    setTimeout(() => {
      if (!mainWindow || mainWindow.isDestroyed() || !adminSessionUnlocked) return;
      try { mainWindow.maximize(); } catch (_) {}
      try { applyAdaptiveZoom(); } catch (_) {}
    }, 120);
  } else {
    const restoreCandidateShell = () => {
      if (!mainWindow || mainWindow.isDestroyed() || adminSessionUnlocked) return;
      try { startCandidateKeyGuard(); } catch (_) {}
      try { mainWindow.setSkipTaskbar(true); } catch (_) {}
      try { mainWindow.setAlwaysOnTop(true); } catch (_) {}
      try { mainWindow.setFullScreen(true); } catch (_) {}
      try { mainWindow.setKiosk(true); } catch (_) {}
      try { mainWindow.moveTop(); } catch (_) {}
      try { mainWindow.show(); } catch (_) {}
      try { mainWindow.focus(); } catch (_) {}
      try { mainWindow.webContents.focus(); } catch (_) {}
      try { enforceCandidateWindowLock(true); } catch (_) {}
      try { applyAdaptiveZoom(); } catch (_) {}
    };
    if (process.platform === 'win32') {
      try { mainWindow.setOverlayIcon(null, ''); } catch (_) {}
    }
    restoreCandidateShell();
    [40, 120, 300, 700].forEach((delay) => setTimeout(restoreCandidateShell, delay));
  }

  try { mainWindow.setMenuBarVisibility(false); } catch (_) {}
  try { mainWindow.focus(); } catch (_) {}
}


function candidateKeyGuardExecutable() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'candidate-keyguard.exe')
    : path.join(__dirname, '..', 'build', 'candidate-keyguard.exe');
}

function stopCandidateKeyGuard() {
  const proc = candidateKeyGuardProcess;
  candidateKeyGuardProcess = null;
  if (!proc) return;
  try { proc.kill(); } catch (_) {}
}

function startCandidateKeyGuard() {
  // SEB_UNIFIED_SETUP : le verrou dépend désormais du mode d'exécution,
  // jamais d'une édition choisie à l'installation.
  // Pendant les tests réels, la touche Windows reste volontairement disponible
  // comme porte de secours. Mettre TEMP_ALLOW_WINDOWS_RECOVERY à false activera
  // le verrou natif sur toute installation tant que l'Admin reste verrouillé.
  if (TEMP_ALLOW_WINDOWS_RECOVERY) {
    stopCandidateKeyGuard();
    return;
  }
  if (process.platform !== 'win32' || adminSessionUnlocked || allowApplicationExit) return;
  if (candidateKeyGuardProcess && candidateKeyGuardProcess.exitCode == null && !candidateKeyGuardProcess.killed) return;
  const executable = candidateKeyGuardExecutable();
  if (!fs.existsSync(executable)) return;
  try {
    const proc = spawn(executable, [], { windowsHide:true, stdio:'ignore' });
    candidateKeyGuardProcess = proc;
    proc.once('exit', () => {
      if (candidateKeyGuardProcess === proc) candidateKeyGuardProcess = null;
      if (!adminSessionUnlocked && !allowApplicationExit) setTimeout(() => startCandidateKeyGuard(), 250);
    });
  } catch (_) {
    candidateKeyGuardProcess = null;
  }
}

function stateFilePath() {
  return path.join(app.getPath('userData'), 'evaluation-state.json');
}

function sebInternalRoot() {
  return internalStorageRoot(app.getPath('userData'));
}

function sebDocumentsRoot() {
  return documentsWordRoot(app.getPath('documents'));
}

function getCandidateProtection() {
  if (!candidateProtection) {
    candidateProtection = createCandidateLocalProtection({
      documentsPath: app.getPath('documents'),
      userDataPath: app.getPath('userData'),
      dataRoot: sebInternalRoot(),
      safeStorage
    });
  }
  return candidateProtection;
}

function initializeCandidateSecurity() {
  const protection = getCandidateProtection();
  const localKey = protection.initializeKey();
  if (!Buffer.isBuffer(localKey) || localKey.length !== 32) {
    throw new Error('Clé locale des données candidat invalide.');
  }

  configureLocalKey(localKey);
  localKey.fill(0);
  protection.restoreStateFromBackupIfNeeded();

  // Un dossier candidat individuel illisible ne doit jamais bloquer tout SEB EvalPro.
  // Les migrations parcourent les fichiers un par un et ignorent ceux qui ne peuvent
  // pas être décodés. Ils resteront intacts pour diagnostic/récupération ultérieure.
  const store = getCandidateStore();
  const folders = store.migrateCandidateFolderNames();
  const migrated = migrateJsonTree(store.paths.candidatesRoot);
  migrateJsonFile(stateFilePath());
  protection.backupState();
  console.log('SEB EvalPro confidentialité candidat: clé locale Windows protégée et sauvegardée, dossiers codés=' + folders.renamed + ', JSON chiffrés=' + migrated.files + '.');
}

function getCandidateStore() {
  if (!candidateStore) {
    candidateStore = createCandidateStore({
      documentsPath: app.getPath('documents'),
      userDataPath: app.getPath('userData'),
      dataRoot: sebInternalRoot()
    });
  }
  return candidateStore;
}

function getCandidateTransfer() {
  if (!candidateTransfer) {
    candidateTransfer = createCandidateTransfer({
      documentsPath: app.getPath('documents'),
      userDataPath: app.getPath('userData'),
      dataRoot: sebInternalRoot()
    });
  }
  return candidateTransfer;
}

function getKaloneoLibrary() {
  if (!kaloneoLibrary) {
    kaloneoLibrary = createKaloneoLibrary({
      dataRoot: sebInternalRoot(),
      seedTestsRoot: path.join(__dirname, '..', 'app', 'web', 'kaltest', 'tests'),
      seedImageRoots:[
        { root:path.join(__dirname, '..', 'app', 'web', 'imageqcm'), category:'Images exercices KALONÉO' },
        { root:path.join(__dirname, '..', 'app', 'web', 'flacon'), category:'Images Stock' },
        { root:path.join(__dirname, '..', 'app', 'web', 'assets'), category:'Images KALONÉO' }
      ]
    });
  }
  return kaloneoLibrary;
}

function internalBilanExportsDir() {
  return path.join(sebInternalRoot(), 'Bilans');
}

function ensureSebDocumentsFolders() {
  // R17 : plus aucun stockage actif SEB EvalPro dans Documents.
  // Les données et exports Word restent dans le stockage interne protégé.
  getCandidateStore().ensureRoots();
  fs.mkdirSync(internalBilanExportsDir(), { recursive:true });
}

function uniqueOutputPath(directory, filename) {
  const parsed = path.parse(filename);
  let target = path.join(directory, filename);
  let index = 2;
  while (fs.existsSync(target)) {
    target = path.join(directory, `${parsed.name}_${index}${parsed.ext}`);
    index += 1;
  }
  return target;
}

function cleanupNumberedCandidateWordCopies(directory, filename) {
  if (!directory || !/^Evaluation_.+\.docx?$/i.test(filename)) return;
  const parsed = path.parse(filename);
  if (!fs.existsSync(directory)) return;
  const escaped = parsed.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const duplicate = new RegExp('^' + escaped + '_(?:R\\d+|\\d+)' + parsed.ext.replace('.', '\\.') + '$', 'i');
  for (const entry of fs.readdirSync(directory, { withFileTypes:true })) {
    if (!entry.isFile() || !duplicate.test(entry.name)) continue;
    try { fs.rmSync(path.join(directory, entry.name), { force:true }); } catch (_) {}
  }
}

function installDownloadRouting() {
  if (!mainWindow || mainWindow.isDestroyed() || downloadRoutingInstalled) return;
  downloadRoutingInstalled = true;
  mainWindow.webContents.session.on('will-download', (_event, item) => {
    const filename = path.basename(item.getFilename() || 'Evaluation.doc');
    if (!/\.docx?$/i.test(filename)) return;
    try {
      ensureSebDocumentsFolders();
      const targetDirectory = adminExportCandidateDir || getCandidateStore().getActiveExportDir() || internalBilanExportsDir();
      fs.mkdirSync(targetDirectory, { recursive:true });
      const target = /^Evaluation_.+\.docx?$/i.test(filename)
        ? path.join(targetDirectory, filename)
        : uniqueOutputPath(targetDirectory, filename);
      item.setSavePath(target);
      item.once('done', (_downloadEvent, state) => {
        if (state !== 'completed') return;
        cleanupNumberedCandidateWordCopies(targetDirectory, path.basename(target));
      });
    } catch (_) {}
  });
}

function defaultState() {
  const initialPage = 'kaltest-pilot2.html';
  const initialRoute = kaloneoFullParcoursRoute.INITIAL_ROUTE;
  return {
    version: STATE_VERSION,
    sessionStorage: {},
    localStorage: {},
    lastPage: initialPage,
    lastEvaluationPage: initialPage,
    lastRoute: initialRoute,
    lastEvaluationRoute: initialRoute,
    updatedAt: null
  };
}

function readState() {
  try {
    const protection = getCandidateProtection();
    protection.restoreStateFromBackupIfNeeded();
    let parsed = readJsonFile(stateFilePath());
    if ((!parsed || typeof parsed !== 'object') && fs.existsSync(protection.paths.backupStatePath)) {
      parsed = readJsonFile(protection.paths.backupStatePath);
    }
    return parsed && typeof parsed === 'object' ? { ...defaultState(), ...parsed } : defaultState();
  } catch (_) {
    return defaultState();
  }
}

function waitForFileRetry(ms) {
  try { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); } catch (_) {}
}

function atomicReplaceState(target, content) {
  stateWriteCounter += 1;
  const temp = `${target}.${process.pid}.${stateWriteCounter}.tmp`;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(temp, content, 'utf8');
  let lastError = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      fs.renameSync(temp, target);
      return;
    } catch (error) {
      lastError = error;
      const code = String(error && error.code || '');
      if (!['EPERM','EACCES','EBUSY','EEXIST','ENOTEMPTY'].includes(code)) break;
      waitForFileRetry(25 + attempt * 35);
    }
  }
  try { fs.rmSync(temp, { force:true }); } catch (_) {}
  throw lastError || new Error('Remplacement atomique de la sauvegarde impossible.');
}

function writeState(nextState) {
  const target = stateFilePath();
  const safeState = {
    ...defaultState(),
    ...nextState,
    version: STATE_VERSION,
    updatedAt: new Date().toISOString()
  };
  atomicReplaceState(target, encodeJson(safeState));

  try {
    getCandidateStore().saveSnapshot(safeState);
    getCandidateProtection().backupState();
    lastCandidateSaveError = '';
  } catch (error) {
    lastCandidateSaveError = error && error.message ? error.message : String(error);
    console.error('Sauvegarde du dossier candidat impossible:', lastCandidateSaveError);
  }

  return safeState;
}

function safePageName(urlOrName) {
  try {
    if (urlOrName.startsWith('file:')) {
      return path.basename(new URL(urlOrName).pathname);
    }
  } catch (_) {}
  return path.basename(String(urlOrName || 'qcmv1.0.html'));
}

function isAdminBilanPage(pageName) {
  return ['admin-bilan.html', 'bilan.html'].includes(String(pageName || '').toLowerCase());
}

function isAdminCandidatePage(pageName) {
  return String(pageName || '').toLowerCase() === 'admin-candidats.html';
}

function isAdminTestsParcoursPage(pageName) {
  return String(pageName || '').toLowerCase() === 'admin-tests-parcours.html';
}

function isAdminParcoursBuilderPage(pageName) {
  return String(pageName || '').toLowerCase() === 'admin-parcours-builder.html';
}

function isAdminKaloneoBuilderPage(pageName) {
  return String(pageName || '').toLowerCase() === 'test-builder.html';
}

function isAdminMaskBuilderPage(pageName) {
  return ['admin-mask-builder.html','admin-mask-preview.html'].includes(String(pageName || '').toLowerCase());
}

function isAdminKaloneoBuilderPreviewPage(pageName) {
  return String(pageName || '').toLowerCase() === 'test-preview.html';
}

function isAdminNavigationPage(pageName) {
  return isAdminBilanPage(pageName) || isAdminCandidatePage(pageName) ||
    isAdminTestsParcoursPage(pageName) || isAdminParcoursBuilderPage(pageName) ||
    isAdminKaloneoBuilderPage(pageName) || isAdminMaskBuilderPage(pageName) ||
    isAdminKaloneoBuilderPreviewPage(pageName);
}

function existingWebPage(pageName) {
  const webRoot = path.join(__dirname, '..', 'app', 'web');
  const candidate = path.join(webRoot, safePageName(pageName));
  if (fs.existsSync(candidate)) return candidate;
  return path.join(webRoot, 'qcmv1.0.html');
}

function verifyAdminPassword(password) {
  return passwordStore.verify('admin',password);
}

// Formule R141 conservée, partagée entre le véritable candidat et sa simulation.
function adaptiveZoomForDimensions(width,height) {
  const widthFactor = Number(width || DESIGN_WIDTH) / DESIGN_WIDTH;
  const heightFactor = Number(height || DESIGN_HEIGHT) / DESIGN_HEIGHT;
  const factor = Math.min(1, widthFactor, heightFactor);
  return Math.max(MIN_ZOOM_FACTOR, Math.round(factor * 100) / 100);
}
function calculateAdaptiveZoom() {
  if (!mainWindow || mainWindow.isDestroyed()) return 1;
  const bounds = mainWindow.getBounds();
  const display = screen.getDisplayMatching(bounds);
  const size = display && display.size ? display.size : { width: bounds.width, height: bounds.height };
  return adaptiveZoomForDimensions(size.width || bounds.width || DESIGN_WIDTH,
    size.height || bounds.height || DESIGN_HEIGHT);
}

function applyAdaptiveZoom() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.setZoomFactor(calculateAdaptiveZoom());
}

// SEB_CANDIDATE_KIOSK_GUARD
function enforceCandidateWindowLock(focusWindow = false) {
  if (adminSessionUnlocked || !mainWindow || mainWindow.isDestroyed()) return;
  startCandidateKeyGuard();
  try {
    if (mainWindow.isMinimized()) mainWindow.restore();
    if (!mainWindow.isKiosk()) mainWindow.setKiosk(true);
    if (!mainWindow.isFullScreen()) mainWindow.setFullScreen(true);
    if (!mainWindow.isAlwaysOnTop()) mainWindow.setAlwaysOnTop(true);
    mainWindow.setSkipTaskbar(true);
    mainWindow.setMenuBarVisibility(false);
    if (focusWindow) mainWindow.focus();
  } catch (_) {}
}

function reinforceCandidateWindowLock() {
  for (const delay of [0, 120, 350, 800]) {
    setTimeout(() => enforceCandidateWindowLock(delay === 0 || delay === 350), delay);
  }
}

// SEB_WINDOWS_RETURN_KIOSK_GUARD
// Après une veille ou un verrouillage Windows, le Shell peut remettre la barre
// des tâches au premier plan alors qu'Electron pense encore être en mode kiosk.
// On force donc une vraie réaffirmation du mode candidat à chaque retour Windows.
function forceCandidateWindowLockAfterWindowsReturn(reason = 'windows-return') {
  if (adminSessionUnlocked || allowApplicationExit || !mainWindow || mainWindow.isDestroyed()) return;

  const win = mainWindow;
  startCandidateKeyGuard();

  try {
    if (win.isMinimized()) win.restore();
    if (!win.isVisible()) win.show();

    win.setSkipTaskbar(true);
    win.setMenuBarVisibility(false);
    win.setAlwaysOnTop(true);

    // Windows peut conserver un état plein écran logique tout en réaffichant
    // la barre des tâches. Le basculement kiosk force Windows à recalculer le
    // z-order et les contraintes plein écran, même si isKiosk() vaut déjà true.
    if (process.platform === 'win32') {
      win.setKiosk(false);
      win.setFullScreen(false);
      win.setKiosk(true);
      win.setFullScreen(true);
    } else {
      if (!win.isKiosk()) win.setKiosk(true);
      if (!win.isFullScreen()) win.setFullScreen(true);
    }

    win.setSkipTaskbar(true);
    win.setAlwaysOnTop(true);
    win.show();
    if (typeof win.moveTop === 'function') win.moveTop();
    win.focus();
  } catch (error) {
    console.warn('SEB EvalPro : réaffirmation kiosk après retour Windows impossible (' + reason + ').', error);
  }

  // Plusieurs passes couvrent le délai de réinitialisation de l'Explorer Windows
  // après écran verrouillé / veille, sans supprimer la touche Windows temporaire.
  for (const delay of [80, 250, 600, 1200, 2200]) {
    setTimeout(() => {
      if (adminSessionUnlocked || allowApplicationExit || !mainWindow || mainWindow.isDestroyed()) return;
      enforceCandidateWindowLock(true);
      try {
        mainWindow.setSkipTaskbar(true);
        mainWindow.setAlwaysOnTop(true);
        if (typeof mainWindow.moveTop === 'function') mainWindow.moveTop();
      } catch (_) {}
    }, delay);
  }
}

function installCandidateWindowsReturnGuard() {
  if (candidateWindowsReturnGuardInstalled) return;
  candidateWindowsReturnGuardInstalled = true;

  for (const eventName of ['resume', 'unlock-screen', 'user-did-become-active']) {
    powerMonitor.on(eventName, () => {
      if (!adminSessionUnlocked) forceCandidateWindowLockAfterWindowsReturn(eventName);
    });
  }
}

function setSplashProgress(percent, message) {
  if (!splashWindow || splashWindow.isDestroyed()) return;
  const value = Math.max(0, Math.min(100, Number(percent) || 0));
  const js = `window.setStartupProgress && window.setStartupProgress(${value}, ${JSON.stringify(String(message || ''))});`;
  splashWindow.webContents.executeJavaScript(js).catch(() => {});
}

function createSplashWindow() {
  splashStartedAt = Date.now();
  splashWindow = new BrowserWindow({
    width: 640,
    height: 390,
    icon: kaloneoWindowsWindowIcon(),
    show: false,
    frame: false,
    resizable: false,
    movable: true,
    center: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    backgroundColor: '#ffffff',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: false
    }
  });

  splashWindow.loadFile(path.join(__dirname, 'splash.html'), {
    query: { version: app.getVersion() }
  });

  splashWindow.once('ready-to-show', () => {
    if (!splashWindow || splashWindow.isDestroyed()) return;
    splashWindow.show();
    setSplashProgress(12, 'Initialisation de KALONÉO…');
  });

  splashWindow.on('closed', () => {
    splashWindow = null;
  });
}

function finishStartup() {
  const elapsed = Date.now() - splashStartedAt;
  const delay = Math.max(0, MIN_SPLASH_MS - elapsed);
  setSplashProgress(100, 'Prêt');

  setTimeout(() => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.show();
    applyAdminWindowMode(adminSessionUnlocked);
    if (!adminSessionUnlocked) enforceCandidateWindowLock(true);
    applyAdaptiveZoom();
    if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close();
    // La fermeture du splash peut brièvement rendre la barre des tâches Windows
    // au premier plan : réaffirmer le verrou candidat après cette transition.
    reinforceCandidateWindowLock();
  }, delay + 180);
}

function loadKaloneoCandidateRoute(route) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const resolved = kaloneoFullParcoursRoute.toLoadOptions(route);
  const target = existingWebPage(resolved.file);
  const options = { query:resolved.query };
  if (resolved.hash) options.hash = resolved.hash;
  mainWindow.loadFile(target, options);
}

function loadSavedCandidateEvaluation(state) {
  loadKaloneoCandidateRoute(kaloneoFullParcoursRoute.resolveStateRoute(state));
}

function createWindow() {
  Menu.setApplicationMenu(null);
  setSplashProgress(28, 'Lecture de la sauvegarde…');
  const state = readState();
  adminSessionUnlocked = false;

  mainWindow = new BrowserWindow({
    icon: kaloneoWindowsWindowIcon(),
    title: 'KALONÉO',
    show: false,
    fullscreen: true,
    kiosk: true,
    skipTaskbar: true,
    autoHideMenuBar: true,
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false,
      devTools: false,
      navigateOnDragDrop: false
    }
  });

  mainWindow.setMenuBarVisibility(false);
  installDownloadRouting();
  setSplashProgress(48, 'Chargement du parcours…');
  loadSavedCandidateEvaluation(state);

  mainWindow.webContents.on('did-finish-load', () => {
    applyAdminWindowMode(adminSessionUnlocked);
    applyAdaptiveZoom();
  });

  mainWindow.webContents.once('did-finish-load', () => {
    setSplashProgress(86, 'Restauration de la session…');
  });

  mainWindow.once('ready-to-show', finishStartup);

  mainWindow.webContents.on('did-navigate', (_event, url) => {
    const page = safePageName(url);
    if (kaloneoBuilderPreviewFullscreenActive &&
      /\/kaltest-pilot2\.html\?kaloneoPreview=1(?:&|$)/.test(String(url))) {
      applyAdaptiveZoom();
      return; // ne jamais faire du test aperçu la dernière route candidat
    }
    if (adminCandidateResultsMode || isAdminNavigationPage(page)) {
      applyAdaptiveZoom();
      return;
    }
    const current = readState();
    current.lastPage = page;
    current.lastEvaluationPage = page;
    const route = kaloneoFullParcoursRoute.routeFromNavigationUrl(url);
    current.lastRoute = route;
    current.lastEvaluationRoute = route;
    writeState(current);
    applyAdaptiveZoom();
  });

  mainWindow.on('enter-full-screen', () => {
    setTimeout(applyAdaptiveZoom, 50);
  });

  mainWindow.on('leave-full-screen', () => {
    if (!adminSessionUnlocked) setTimeout(() => enforceCandidateWindowLock(true), 30);
  });

  mainWindow.on('blur', () => {
    // Temporaire : pendant les tests de stabilité, la touche Windows doit pouvoir
    // afficher la barre Windows en cas de blocage.
    if (!adminSessionUnlocked && !TEMP_ALLOW_WINDOWS_RECOVERY) {
      setTimeout(() => enforceCandidateWindowLock(true), 80);
    }
  });

  mainWindow.on('minimize', () => {
    if (!adminSessionUnlocked) setTimeout(() => enforceCandidateWindowLock(true), 30);
  });

  mainWindow.on('show', () => {
    if (!adminSessionUnlocked) reinforceCandidateWindowLock();
  });

  mainWindow.on('resize', applyAdaptiveZoom);

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  // SEB_CANDIDATE_OS_SHORTCUT_GUARD :
  // pendant le parcours, empêcher les raccourcis qui permettent de sortir vers
  // Windows ou de lancer une application externe (dont la calculatrice système).
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (adminSessionUnlocked) return;
    const key = String(input && input.key || '').toLowerCase();
    const alt = !!(input && input.alt);
    const control = !!(input && input.control);
    const meta = !!(input && input.meta);
    const shift = !!(input && input.shift);

    const isWindowsKey = key === 'meta' || key === 'super' || key === 'os';
    const windowsCombo = meta && !isWindowsKey;
    const windowsOrLauncherKey =
      windowsCombo ||
      key === 'alt' ||
      key === 'calculator' ||
      key === 'launchapp1' ||
      key === 'launchapp2' ||
      key === 'launchapplication1' ||
      key === 'launchapplication2' ||
      key.includes('calculator');

    const escapeToWindows =
      (alt && ['tab', 'escape', 'esc', ' ', 'space', 'f4'].includes(key)) ||
      (control && ['escape', 'esc'].includes(key)) ||
      (control && shift && ['escape', 'esc'].includes(key)) ||
      key === 'f11' ||
      key === 'f12';

    if (windowsOrLauncherKey || escapeToWindows) {
      event.preventDefault();
      // Le raccourci reste bloqué, mais on ne vole pas le focus du champ actif
      // (notamment le textarea de Dictée) en refocalisant toute la fenêtre.
      setTimeout(() => enforceCandidateWindowLock(false), 0);
    }
  });

  // SEB_RUNTIME_OFFLINE : le plateau candidat ne doit jamais dépendre d'Internet.
  mainWindow.webContents.on('will-navigate', (event, url) => {
    try {
      if (new URL(url).protocol !== 'file:') event.preventDefault();
    } catch (_) {
      event.preventDefault();
    }
  });
  mainWindow.webContents.session.webRequest.onBeforeRequest(
    { urls: ['http://*/*', 'https://*/*'] },
    (_details, callback) => callback({ cancel: true })
  );

  // SEB_CANDIDATE_CLOSE_GUARD : Alt+F4 / fermeture fenêtre refusés.
  // Une fermeture réelle ne devient possible que par le flux Admin qui appelle app.quit().
  mainWindow.on('close', (event) => {
    if (allowApplicationExit) return;
    event.preventDefault();
    if (!mainWindow || mainWindow.isDestroyed()) return;
    enforceCandidateWindowLock(true);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    adminSessionUnlocked = false;
    developerSessionUnlocked = false;
    if(kaloneoMiniPreviewWorker && !kaloneoMiniPreviewWorker.isDestroyed()){
      kaloneoMiniPreviewWorker.destroy();
    }
    kaloneoMiniPreviewWorker=null;
    kaloneoMiniPreviewDefinition=null;
  });
}

function showStartupSecurityError(error) {
  const message = String(error && error.message ? error.message : error || 'Erreur de sécurité inconnue.');
  console.error('SEB EvalPro démarrage sécurisé impossible:', message);

  if (splashWindow && !splashWindow.isDestroyed()) {
    try { splashWindow.close(); } catch (_) {}
  }

  mainWindow = new BrowserWindow({
    width: 860,
    height: 520,
    show: true,
    center: true,
    resizable: true,
    backgroundColor: '#ffffff',
    icon: kaloneoWindowsWindowIcon(),
    title: 'KALONÉO - Démarrage impossible',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: false
    }
  });
  mainWindow.setMenuBarVisibility(false);

  const safeMessage = message
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>KALONÉO</title>
  <style>
    body{font-family:Arial,sans-serif;margin:0;background:#f5f7fa;color:#222}
    .card{max-width:760px;margin:60px auto;background:#fff;border:1px solid #ccd6e0;border-radius:10px;padding:28px 32px;box-shadow:0 8px 28px rgba(0,0,0,.12)}
    h1{margin:0 0 18px;color:#c00000;font-size:25px}
    p{line-height:1.55}
    .msg{margin:18px 0;padding:14px;background:#fff5f5;border-left:4px solid #c00000;white-space:pre-wrap}
    .note{color:#555;font-size:14px}
  </style></head><body><div class="card">
    <h1>KALONÉO ne peut pas accéder aux données sécurisées</h1>
    <p>Le programme a bien démarré, mais la protection générale des données candidat n'a pas pu être initialisée.</p>
    <div class="msg">${safeMessage}</div>
    <p><strong>Aucun dossier candidat n'a été supprimé ni remplacé.</strong></p>
    <p class="note">Fermez cette fenêtre puis faites vérifier la clé locale ou sa copie de récupération. Un dossier candidat individuel endommagé ne doit pas provoquer cet écran : seuls les problèmes concernant la clé générale du poste peuvent bloquer l'accès sécurisé aux données.</p>
  </div></body></html>`;

  mainWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function startApplication() {
  // Toujours créer une interface visible avant les contrôles de sécurité.
  // Une erreur de clé ne doit jamais laisser un simple processus invisible.
  createSplashWindow();
  setSplashProgress(10, 'Migration du stockage local…');

  try {
    const migration = migrateLegacyDocumentsStorage({
      documentsPath: app.getPath('documents'),
      userDataPath: app.getPath('userData')
    });
    if (!migration.completed) {
      console.warn('SEB EvalPro 0.3.8 : migration Documents incomplète, anciennes données conservées.', migration);
    } else {
      console.log(
        'SEB EvalPro : stockage interne migré ; dossiers Documents retirés=' +
        migration.removedDirectories + ', exports Word migrés=' + migration.wordExports + '.'
      );
    }

    setSplashProgress(16, 'Vérification de la protection des données…');
    initializeCandidateSecurity();
    ensureSebDocumentsFolders();
  } catch (error) {
    showStartupSecurityError(error);
    return;
  }

  setTimeout(() => {
    setSplashProgress(20, 'Préparation du programme…');
    createWindow();
  }, 120);
}

ipcMain.on('state:load-sync', (event) => {
  event.returnValue = readState();
});

ipcMain.on('state:save-sync', (event, payload) => {
  try {
    const state = writeState(payload || {});
    event.returnValue = lastCandidateSaveError
      ? { ok: false, state, error: 'Sauvegarde du dossier candidat impossible : ' + lastCandidateSaveError }
      : { ok: true, state };
  } catch (error) {
    event.returnValue = { ok: false, error: error.message };
  }
});

ipcMain.handle('state:save', (_event, payload) => {
  try {
    const state = writeState(payload || {});
    return lastCandidateSaveError
      ? { ok: false, state, error: 'Sauvegarde du dossier candidat impossible : ' + lastCandidateSaveError }
      : { ok: true, state };
  } catch (error) {
    return { ok: false, error: error && error.message ? error.message : String(error) };
  }
});

ipcMain.handle('admin:verify', (_event, password) => {
  const ok = verifyAdminPassword(password);
  if (ok) {
    adminSessionUnlocked = true;
    adminSessionDocumentPassword = String(password || '');
    applyAdminWindowMode(true);
  }
  return ok;
});

ipcMain.handle('admin:verify-password', (_event, password) => {
  const ok = verifyAdminPassword(password);
  if (ok && adminSessionUnlocked) adminSessionDocumentPassword = String(password || '');
  return ok;
});

ipcMain.handle('admin:status', () => adminSessionUnlocked);
// Seule une session Admin sans candidat actif peut modifier ses accès.
ipcMain.handle('kaloneo-settings:change-password', (event,request) => {
  if(!adminSessionUnlocked || !mainWindow || event.sender!==mainWindow.webContents)
    return {ok:false,error:'Accès administrateur requis.'};
  if(getCandidateStore().getActiveCandidate())
    return {ok:false,error:'Impossible pendant un parcours candidat actif.'};
  const role=request?.role;
  if(role!=='admin' && role!=='developer')return {ok:false,error:'Accès inconnu.'};
  if(String(request?.nextPassword||'')!==String(request?.confirmation||''))
    return {ok:false,error:'Les deux nouveaux mots de passe ne correspondent pas.'};
  try{
    const result=passwordStore.change(role,request?.currentPassword,request?.nextPassword);
    if(result.ok){
      developerSessionUnlocked=false;
      if(role==='admin')adminSessionDocumentPassword=String(request.nextPassword||'');
    }
    return result;
  }catch(error){return {ok:false,error:'Impossible d’enregistrer les accès : '+String(error.message||error)};}
});
ipcMain.handle('kaloneo-developer:status', () => ({
  ok:adminSessionUnlocked,
  unlocked:adminSessionUnlocked && developerSessionUnlocked
}));
ipcMain.handle('kaloneo-developer:unlock', (_event,password) => {
  if(!adminSessionUnlocked)return {ok:false,error:'Ouvrez d’abord la session Administrateur.'};
  if(getCandidateStore().getActiveCandidate())
    return {ok:false,error:'Impossible pendant une évaluation active.'};
  if(!passwordStore.verify('developer',password))
    return {ok:false,error:'Mot de passe Développeur incorrect.'};
  developerSessionUnlocked=true;
  return {ok:true,unlocked:true};
});
ipcMain.handle('kaloneo-developer:export-v1', async (_event,definition)=>{
  if(!adminSessionUnlocked || !developerSessionUnlocked)
    return {ok:false,error:'Mode Développeur requis.'};
  if(getCandidateStore().getActiveCandidate())
    return {ok:false,error:'Export V1 interdit pendant une évaluation active.'};
  if(!definition || typeof definition!=='object' || Array.isArray(definition) ||
      Number(definition.kaltestFormat)!==1 ||
      String(definition.version)!=='1.0.0')
    return {ok:false,error:'L’export officiel exige un test KALTEST V1 (1.0.0).'};
  const id=String(definition.id||'');
  if(!/^[a-z0-9][a-z0-9_-]{0,99}$/i.test(id))
    return {ok:false,error:'Identifiant KALTEST invalide.'};
  const official=getKaloneoLibrary().listTests().some(test=>
    test.id===id && test.version==='1.0.0' && test.protectedVersion===true);
  if(!official)return {ok:false,error:'Aucune V1 officielle correspondante.'};
  const selected=await dialog.showSaveDialog(mainWindow,{
    title:'Exporter la V1 corrigée pour GitHub / TESTS_V1',
    defaultPath:id+'.json',
    filters:[{name:'KALONÉO — TESTS_V1',extensions:['json']}]
  });
  if(selected.canceled||!selected.filePath)return {ok:false,canceled:true};
  const exported=JSON.parse(JSON.stringify(definition));
  // Le dépôt GitHub vérifiera que le nom du fichier = l’ID.
  fs.writeFileSync(selected.filePath,JSON.stringify(exported,null,2)+'\\n','utf8');
  return {ok:true,filePath:selected.filePath,id,version:'1.0.0'};
});
ipcMain.on('app:edition-sync', (event) => { event.returnValue = { ...editionCapabilities }; });
ipcMain.handle('app:edition', () => ({ ...editionCapabilities }));

ipcMain.handle('admin:lock', () => {
  // SEB_ADMIN_LOCK_RETURNS_TO_PRIVACY
  adminSessionUnlocked = false;
  developerSessionUnlocked = false;
  adminSessionDocumentPassword = '';
  adminExportCandidateDir = null;
  adminCandidateResultsMode = false;
  applyAdminWindowMode(false);
  if (mainWindow && !mainWindow.isDestroyed()) {
    const state = readState();
    setTimeout(() => {
      if (!mainWindow || mainWindow.isDestroyed() || adminSessionUnlocked) return;
      loadSavedCandidateEvaluation(state);
    }, 90);
  }
  return true;
});

ipcMain.handle('candidate:set-admin-export-context', (_event, candidateId) => {
  if (!adminSessionUnlocked) return false;
  const root = path.join(sebInternalRoot(), 'Candidats');
  const record = getCandidateTransfer().listCandidateRecords(root, false)
    .find((item) => String(item.candidateId) === String(candidateId || ''));
  if (!record) {
    adminExportCandidateDir = null;
    return false;
  }
  adminExportCandidateDir = path.join(record.candidateDir, 'bilan', 'exports');
  fs.mkdirSync(adminExportCandidateDir, { recursive:true });
  return true;
});

ipcMain.handle('candidate:active', () => {
  if (!adminSessionUnlocked) return null;
  return getCandidateStore().getActiveCandidate();
});

ipcMain.handle('candidate:complete-active', (_event, mode) => {
  const completionMode = String(mode || '');
  if (!['admin-manual', 'admin-export', 'admin-session-close', 'candidate-final-page'].includes(completionMode)) {
    return { ok:false, error:'Mode de fin de parcours invalide.' };
  }
  if (['admin-manual', 'admin-export', 'admin-session-close'].includes(completionMode) && !adminSessionUnlocked) {
    return { ok:false, error:'Accès administrateur requis.' };
  }
  try {
    const currentState = readState();
    const completed = getCandidateStore().completeActiveCandidate(currentState, completionMode);
    if (!completed) return { ok:false, error:'Aucun parcours candidat actif sur ce PC.' };
    writeState(defaultState());
    return { ok:true, ...completed };
  } catch (error) {
    return { ok:false, error:error && error.message ? error.message : String(error) };
  }
});

ipcMain.handle('admin:export-candidates', async (event, password, destinationOptions = {}) => {
  if (!mainWindow || !adminSessionUnlocked) return { ok: false, error: 'Accès administrateur requis.' };
  try {
    const mode = String(destinationOptions && destinationOptions.mode || 'existing');
    const selectedCandidateIds = Array.isArray(destinationOptions && destinationOptions.candidateIds)
      ? [...new Set(destinationOptions.candidateIds.map((id) => String(id || '').trim()).filter(Boolean))]
      : null;
    if (selectedCandidateIds && !selectedCandidateIds.length) {
      return { ok:false, error:'Sélectionnez au moins un candidat à exporter.' };
    }
    const runExport = (destination) => selectedCandidateIds
      ? getCandidateTransfer().exportSelected(destination, password, selectedCandidateIds)
      : getCandidateTransfer().exportAll(destination, password);

    if (mode === 'create') {
      const rawFolderName = String(destinationOptions && destinationOptions.folderName || '').trim();
      const folderName = rawFolderName.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_').replace(/[. ]+$/g, '').trim();
      if (!folderName || folderName === '.' || folderName === '..') {
        return { ok:false, error:'Le nom du dossier d’export est invalide.' };
      }

      const selection = await dialog.showOpenDialog(mainWindow, {
        title: 'Choisir la clé USB où créer le nouveau dossier',
        buttonLabel: 'Créer le dossier ici',
        properties: ['openDirectory']
      });
      if (selection.canceled || !selection.filePaths || !selection.filePaths[0]) {
        return { ok:false, cancelled:true };
      }

      const parent = selection.filePaths[0];
      const destination = path.join(parent, folderName);
      if (fs.existsSync(destination)) {
        return {
          ok:false,
          error:'Ce dossier existe déjà sur la clé. Choisissez « Choisir un dossier existant » pour y ajouter les nouveaux candidats.'
        };
      }
      fs.mkdirSync(destination, { recursive:false });
      try { event.sender.send('admin:export-progress', { state:'started' }); } catch (_) {}
      const result = runExport(destination);
      return { ok:true, ...result, createdExportFolder:true };
    }

    if (mode !== 'existing') {
      return { ok:false, error:'Choix de destination d’export invalide.' };
    }

    const selection = await dialog.showOpenDialog(mainWindow, {
      title: 'Choisir un dossier existant sur la clé USB',
      buttonLabel: 'Exporter dans ce dossier',
      properties: ['openDirectory']
    });
    if (selection.canceled || !selection.filePaths || !selection.filePaths[0]) {
      return { ok:false, cancelled:true };
    }

    try { event.sender.send('admin:export-progress', { state:'started' }); } catch (_) {}
    const result = runExport(selection.filePaths[0]);
    return { ok:true, ...result, createdExportFolder:false };
  } catch (error) {
    return { ok:false, error:error && error.message ? error.message : String(error) };
  }
});

ipcMain.handle('admin:import-candidates', async (_event, password) => {
  if (!editionCapabilities.canImport) return { ok:false, error:'Import réservé à la version Administrateur.' };
  if (!mainWindow || !adminSessionUnlocked) return { ok: false, error: 'Accès administrateur requis.' };
  try {
    const selection = await dialog.showOpenDialog(mainWindow, {
      title: 'Choisir la clé USB contenant les fichiers candidats .seb',
      buttonLabel: 'Importer depuis cette clé',
      properties: ['openDirectory']
    });
    if (selection.canceled || !selection.filePaths || !selection.filePaths[0]) {
      return { ok: false, cancelled: true };
    }
    try { _event.sender.send('admin:import-progress', { state:'started' }); } catch (_) {}
    const result = getCandidateTransfer().importAll(selection.filePaths[0], password);
    return { ok: true, ...result };
  } catch (error) {
    return { ok: false, error: error && error.message ? error.message : String(error) };
  }
});

function loadAdminCandidateBrowser(candidateId = '') {
  if (!mainWindow || !adminSessionUnlocked) return false;
  adminCandidateResultsMode = false;
  const target = path.join(__dirname, '..', 'app', 'web', 'admin-candidats.html');
  if (!fs.existsSync(target)) return false;
  const selected = String(candidateId || '').trim();
  mainWindow.loadFile(target, selected ? { query:{ candidateId:selected } } : undefined);
  return true;
}

ipcMain.handle('admin:open-candidate-browser', (_event, candidateId) => {
  return loadAdminCandidateBrowser(candidateId);
});

ipcMain.handle('admin:return-candidate-browser', (_event, candidateId) => {
  return loadAdminCandidateBrowser(candidateId);
});

function loadAdminTestsParcours() {
  if (!mainWindow || !adminSessionUnlocked) return false;
  if (getCandidateStore().getActiveCandidate()) return false;
  adminCandidateResultsMode = false;
  const target = path.join(__dirname, '..', 'app', 'web', 'admin-tests-parcours.html');
  if (!fs.existsSync(target)) return false;
  mainWindow.loadFile(target);
  return true;
}

ipcMain.handle('admin:open-tests-parcours', () => {
  return loadAdminTestsParcours();
});

ipcMain.handle('admin:close-tests-parcours', () => {
  return loadAdminCandidateBrowser();
});

ipcMain.handle('kaloneo-library:list-tests', () => {
  if (!adminSessionUnlocked) return { ok:false, error:'Accès administrateur requis.' };
  if (getCandidateStore().getActiveCandidate()) return { ok:false, error:'Impossible de modifier les parcours pendant une évaluation active.' };
  try {
    return { ok:true, tests:getKaloneoLibrary().listTests() };
  } catch (error) {
    return { ok:false, error:error && error.message ? error.message : String(error) };
  }
});

ipcMain.on('kaloneo-library:test-metadata-sync', (event) => {
  if (!adminSessionUnlocked) {
    event.returnValue = { ok:false, error:'Accès administrateur requis.' };
    return;
  }
  try {
    event.returnValue = { ok:true, tests:getKaloneoLibrary().listTests() };
  } catch (error) {
    event.returnValue = { ok:false, error:error && error.message ? error.message : String(error) };
  }
});

ipcMain.handle('kaloneo-library:get-test', (_event, payload) => {
  if (!adminSessionUnlocked) return { ok:false, error:'Accès administrateur requis.' };
  if (getCandidateStore().getActiveCandidate()) return { ok:false, error:'Impossible de modifier les tests pendant une évaluation active.' };
  try {
    return getKaloneoLibrary().getTest(payload && payload.id, payload && payload.version);
  } catch (error) {
    return { ok:false, error:error && error.message ? error.message : String(error) };
  }
});

ipcMain.handle('kaloneo-library:save-test', (_event, payload) => {
  if (!adminSessionUnlocked) return { ok:false, error:'Accès administrateur requis.' };
  if (getCandidateStore().getActiveCandidate()) return { ok:false, error:'Impossible de modifier les tests pendant une évaluation active.' };
  try {
    return getKaloneoLibrary().saveTest(payload && payload.definition, {
      overwrite:payload && payload.overwrite === true,
      allowSeedOverwrite:payload?.overwrite===true && adminSessionUnlocked
    });
  } catch (error) {
    return { ok:false, error:error && error.message ? error.message : String(error) };
  }
});

ipcMain.handle('kaloneo-library:delete-test', (_event, payload) => {
  if (!adminSessionUnlocked) return { ok:false, error:'Accès administrateur requis.' };
  if (getCandidateStore().getActiveCandidate()) return { ok:false, error:'Impossible de supprimer un test pendant une évaluation active.' };
  try {
    return getKaloneoLibrary().deleteTest(payload && payload.id, payload && payload.version);
  } catch (error) {
    return { ok:false, error:error && error.message ? error.message : String(error) };
  }
});

ipcMain.handle('kaloneo-transfer:export-test', async (_event, payload) => {
  if (!adminSessionUnlocked) return { ok:false, error:'Accès administrateur requis.' };
  if (getCandidateStore().getActiveCandidate()) return { ok:false, error:'Impossible d’exporter pendant une évaluation active.' };
  try {
    const result = getKaloneoLibrary().getTest(payload && payload.id, payload && payload.version);
    if (!result.ok) return result;
    const { definition } = embedTestImages(result.definition, path.resolve(__dirname, '../app/web'));
    const chosen = await dialog.showSaveDialog(mainWindow, {
      title:'Exporter un test KALONÉO',
      defaultPath:String(definition.id || 'test') + '-' + String(definition.version || '1.0.0') + '-test.json',
      filters:[{ name:'Test KALONÉO JSON', extensions:['json'] }]
    });
    if (chosen.canceled || !chosen.filePath) return { ok:false, canceled:true };
    fs.writeFileSync(chosen.filePath, JSON.stringify(definition, null, 2) + '\n', 'utf8');
    return { ok:true, filePath:chosen.filePath };
  } catch (error) {
    return { ok:false, error:error && error.message ? error.message : String(error) };
  }
});

ipcMain.handle('kaloneo-transfer:import-test', async () => {
  if (!adminSessionUnlocked) return { ok:false, error:'Accès administrateur requis.' };
  if (getCandidateStore().getActiveCandidate()) return { ok:false, error:'Impossible d’importer pendant une évaluation active.' };
  try {
    const chosen = await dialog.showOpenDialog(mainWindow, {
      title:'Importer un test KALONÉO',
      properties:['openFile'],
      filters:[{ name:'Test KALONÉO JSON', extensions:['json'] }]
    });
    if (chosen.canceled || !chosen.filePaths?.[0]) return { ok:false, canceled:true };
    const definition = JSON.parse(fs.readFileSync(chosen.filePaths[0], 'utf8'));
    validatePortableTest(definition);
    const result = getKaloneoLibrary().saveTest(definition, { overwrite:false });
    if (result && result.code === 'EXISTS') {
      return { ...result, definition };
    }
    return result;
  } catch (error) {
    return { ok:false, error:error && error.message ? error.message : String(error) };
  }
});

ipcMain.handle('kaloneo-transfer:export-parcours', async (_event, id) => {
  if (!adminSessionUnlocked) return { ok:false, error:'Accès administrateur requis.' };
  if (getCandidateStore().getActiveCandidate()) return { ok:false, error:'Impossible d’exporter pendant une évaluation active.' };
  try {
    const result = getKaloneoLibrary().buildParcoursPackage(id);
    if (!result.ok) return result;
    const name = String(result.package?.parcours?.name || 'parcours')
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/^-+|-+$/g,'') || 'parcours';
    const chosen = await dialog.showSaveDialog(mainWindow, {
      title:'Exporter un parcours KALONÉO',
      defaultPath:name + '-kaloneo-parcours.json',
      filters:[{ name:'Parcours KALONÉO JSON', extensions:['json'] }]
    });
    if (chosen.canceled || !chosen.filePath) return { ok:false, canceled:true };
    fs.writeFileSync(chosen.filePath, JSON.stringify(result.package, null, 2) + '\n', 'utf8');
    return { ok:true, filePath:chosen.filePath };
  } catch (error) {
    return { ok:false, error:error && error.message ? error.message : String(error) };
  }
});

ipcMain.handle('kaloneo-transfer:import-parcours', async () => {
  if (!adminSessionUnlocked) return { ok:false, error:'Accès administrateur requis.' };
  if (getCandidateStore().getActiveCandidate()) return { ok:false, error:'Impossible d’importer pendant une évaluation active.' };
  try {
    const chosen = await dialog.showOpenDialog(mainWindow, {
      title:'Importer un parcours KALONÉO',
      properties:['openFile'],
      filters:[{ name:'Parcours KALONÉO JSON', extensions:['json'] }]
    });
    if (chosen.canceled || !chosen.filePaths?.[0]) return { ok:false, canceled:true };
    const payload = JSON.parse(fs.readFileSync(chosen.filePaths[0], 'utf8'));
    return getKaloneoLibrary().importParcoursPackage(payload);
  } catch (error) {
    return { ok:false, error:error && error.message ? error.message : String(error) };
  }
});

ipcMain.handle('kaloneo-library:list-images', () => {
  if (!adminSessionUnlocked) return { ok:false, error:'Accès administrateur requis.' };
  if (getCandidateStore().getActiveCandidate()) return { ok:false, error:'Impossible de modifier la bibliothèque d’images pendant une évaluation active.' };
  try {
    return { ok:true, images:getKaloneoLibrary().listImages() };
  } catch (error) {
    return { ok:false, error:error && error.message ? error.message : String(error) };
  }
});

ipcMain.handle('kaloneo-library:get-image', (_event, id) => {
  if (!adminSessionUnlocked) return { ok:false, error:'Accès administrateur requis.' };
  if (getCandidateStore().getActiveCandidate()) return { ok:false, error:'Impossible de consulter la bibliothèque d’images pendant une évaluation active.' };
  try {
    return getKaloneoLibrary().getImage(id);
  } catch (error) {
    return { ok:false, error:error && error.message ? error.message : String(error) };
  }
});

ipcMain.handle('kaloneo-library:save-image', (_event, payload) => {
  if (!adminSessionUnlocked) return { ok:false, error:'Accès administrateur requis.' };
  if (getCandidateStore().getActiveCandidate()) return { ok:false, error:'Impossible de modifier la bibliothèque d’images pendant une évaluation active.' };
  try {
    return getKaloneoLibrary().saveImage(payload || {});
  } catch (error) {
    return { ok:false, error:error && error.message ? error.message : String(error) };
  }
});

ipcMain.handle('kaloneo-library:export-image-zip', async () => {
  if (!adminSessionUnlocked) return { ok:false, error:'Accès administrateur requis.' };
  if (getCandidateStore().getActiveCandidate()) return { ok:false, error:'Impossible d’exporter les images pendant une évaluation active.' };
  try {
    // Vérifier avant de proposer un fichier, pour éviter de créer un ZIP vide.
    const count=getKaloneoLibrary().listImages().filter(image=>!image.systemProvided).length;
    if (!count) return { ok:false, error:'Aucune image personnelle à exporter.' };
    const chosen=await dialog.showSaveDialog(mainWindow, {
      title:'Exporter les images personnelles KALONÉO',
      defaultPath:'KALONEO-images-personnelles.zip',
      filters:[{name:'Archive ZIP des images',extensions:['zip']}]
    });
    if (chosen.canceled || !chosen.filePath) return {ok:false,canceled:true};
    return getKaloneoLibrary().exportImageZip(chosen.filePath);
  } catch (error) {
    return {ok:false,error:error?.message||String(error)};
  }
});

ipcMain.handle('kaloneo-library:import-image-zip', async () => {
  if (!adminSessionUnlocked) return { ok:false, error:'Accès administrateur requis.' };
  if (getCandidateStore().getActiveCandidate()) return { ok:false, error:'Impossible de modifier la bibliothèque d’images pendant une évaluation active.' };
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      title:'Importer un ZIP d’images KALONÉO',
      properties:['openFile'],
      filters:[{ name:'Archives ZIP', extensions:['zip'] }]
    });
    if (result.canceled || !result.filePaths?.[0]) return { ok:false, canceled:true };
    return getKaloneoLibrary().importImageZip(result.filePaths[0]);
  } catch (error) {
    return { ok:false, error:error && error.message ? error.message : String(error) };
  }
});

ipcMain.handle('kaloneo-library:list-mask-screens', () => {
  if (!adminSessionUnlocked) return { ok:false, error:'Accès administrateur requis.' };
  if (getCandidateStore().getActiveCandidate()) return { ok:false, error:'Impossible de modifier les écrans de masquage pendant une évaluation active.' };
  try {
    return { ok:true, maskScreens:getKaloneoLibrary().listMaskScreens() };
  } catch (error) {
    return { ok:false, error:error && error.message ? error.message : String(error) };
  }
});

ipcMain.handle('kaloneo-library:get-mask-screen', (_event, ref) => {
  try {
    return getKaloneoLibrary().getMaskScreen(ref || null);
  } catch (error) {
    return { ok:false, error:error && error.message ? error.message : String(error) };
  }
});

ipcMain.handle('kaloneo-library:save-mask-screen', (_event, payload) => {
  if (!adminSessionUnlocked) return { ok:false, error:'Accès administrateur requis.' };
  if (getCandidateStore().getActiveCandidate()) return { ok:false, error:'Impossible de modifier les écrans de masquage pendant une évaluation active.' };
  try {
    return getKaloneoLibrary().saveMaskScreen(payload && payload.maskScreen, { overwrite:payload && payload.overwrite === true });
  } catch (error) {
    return { ok:false, error:error && error.message ? error.message : String(error) };
  }
});

ipcMain.handle('kaloneo-library:list-parcours', () => {
  if (!adminSessionUnlocked) return { ok:false, error:'Accès administrateur requis.' };
  if (getCandidateStore().getActiveCandidate()) return { ok:false, error:'Impossible de modifier les parcours pendant une évaluation active.' };
  try {
    return { ok:true, parcours:getKaloneoLibrary().listParcours() };
  } catch (error) {
    return { ok:false, error:error && error.message ? error.message : String(error) };
  }
});

ipcMain.handle('kaloneo-library:get-parcours', (_event, id) => {
  if (!adminSessionUnlocked) return { ok:false, error:'Accès administrateur requis.' };
  if (getCandidateStore().getActiveCandidate()) return { ok:false, error:'Impossible d’ouvrir un parcours pendant une évaluation active.' };
  try {
    return getKaloneoLibrary().getParcours(id);
  } catch (error) {
    return { ok:false, error:error && error.message ? error.message : String(error) };
  }
});

ipcMain.handle('kaloneo-library:get-parcours-details', (_event, id) => {
  if (!adminSessionUnlocked) return { ok:false, error:'Accès administrateur requis.' };
  if (getCandidateStore().getActiveCandidate()) return { ok:false, error:'Impossible de consulter les parcours pendant une évaluation active.' };
  try {
    return getKaloneoLibrary().getParcoursDetails(id);
  } catch (error) {
    return { ok:false, error:error && error.message ? error.message : String(error) };
  }
});

ipcMain.handle('kaloneo-library:get-selected-parcours', () => {
  try {
    return getKaloneoLibrary().getSelectedParcours();
  } catch (error) {
    return { ok:false, error:error && error.message ? error.message : String(error) };
  }
});

ipcMain.handle('kaloneo-library:select-parcours', (_event, payload) => {
  if (!adminSessionUnlocked) return { ok:false, error:'Accès administrateur requis.' };
  if (getCandidateStore().getActiveCandidate()) return { ok:false, error:'Impossible de changer de parcours pendant une évaluation active.' };
  try {
    const id = typeof payload === 'string' ? payload : payload?.id;
    const options = typeof payload === 'object' && payload ? payload.launchOptions || {} : {};
    return getKaloneoLibrary().selectParcours(id, options);
  } catch (error) {
    return { ok:false, error:error && error.message ? error.message : String(error) };
  }
});

ipcMain.handle('kaloneo-library:selected-runtime', () => {
  try {
    return getKaloneoLibrary().resolveParcoursRuntime();
  } catch (error) {
    return { ok:false, error:error && error.message ? error.message : String(error) };
  }
});

ipcMain.on('kaloneo-library:selected-runtime-sync', (event) => {
  try {
    // R48.4 — le vrai moteur candidat sert lui-même à l'aperçu Builder.
    // Autorisé uniquement dans la navigation d'aperçu déclenchée par l'Admin.
    const url=String(event.sender?.getURL?.()||'');
    const isMini=adminSessionUnlocked && Boolean(kaloneoMiniPreviewDefinition) &&
      kaloneoMiniPreviewWorker && !kaloneoMiniPreviewWorker.isDestroyed() &&
      event.sender === kaloneoMiniPreviewWorker.webContents &&
      /\/kaltest-pilot2\.html\?kaloneoPreview=1(?:&|$)/.test(url);
    if(isMini){
      const def=JSON.parse(JSON.stringify(kaloneoMiniPreviewDefinition));
      event.returnValue={ok:true,runtime:{
        id:'kaloneo-builder-mini-preview-only',
        title:'Miniature fidèle — '+String(def.title||'Nouveau test'),
        builderPreview:true,builderMiniPreview:true,
        launchOptions:{showCorrectionsDuringParcours:false},
        introduction:null,tests:[def],fin:null
      }};
      return;
    }
    const isPreview=adminSessionUnlocked && Boolean(kaloneoBuilderPreviewDefinition) &&
      /\/kaltest-pilot2\.html\?kaloneoPreview=1(?:&|$)/.test(url) &&
      mainWindow && !mainWindow.isDestroyed() && event.sender===mainWindow.webContents;
    if(isPreview){
      const def=JSON.parse(JSON.stringify(kaloneoBuilderPreviewDefinition));
      event.returnValue={ok:true,runtime:{
        id:'kaloneo-builder-preview-only',
        title:'Aperçu candidat — '+String(def.title||'Nouveau test'),
        builderPreview:true,
        launchOptions:{showCorrectionsDuringParcours:false},
        introduction:null,tests:[def],fin:null
      }};
      return;
    }
    event.returnValue = getKaloneoLibrary().resolveParcoursRuntime();
  } catch (error) {
    event.returnValue = { ok:false, error:error && error.message ? error.message : String(error) };
  }
});

ipcMain.handle('kaloneo-library:save-parcours', (_event, payload) => {
  if (!adminSessionUnlocked) return { ok:false, error:'Accès administrateur requis.' };
  if (getCandidateStore().getActiveCandidate()) return { ok:false, error:'Impossible de modifier les parcours pendant une évaluation active.' };
  try {
    return getKaloneoLibrary().saveParcours(payload || {});
  } catch (error) {
    return { ok:false, error:error && error.message ? error.message : String(error) };
  }
});

ipcMain.handle('kaloneo-mask:open-preview', (_event, definition) => {
  if (!mainWindow || mainWindow.isDestroyed() || !adminSessionUnlocked) {
    return { ok:false, error:'Accès administrateur requis.' };
  }
  if (getCandidateStore().getActiveCandidate()) {
    return { ok:false, error:'Impossible d’ouvrir un aperçu pendant une évaluation active.' };
  }
  if (!definition || typeof definition !== 'object') {
    return { ok:false, error:'Définition de l’écran de masquage absente.' };
  }
  const text = String(definition.content?.text || '');
  const image = String(definition.content?.image || '');
  if (!text.trim() && !image.trim()) {
    return { ok:false, error:'Ajoutez un texte, une image, ou les deux avant l’aperçu.' };
  }
  const target = path.join(__dirname, '..', 'app', 'web', 'admin-mask-preview.html');
  if (!fs.existsSync(target)) return { ok:false, error:'Page d’aperçu de masquage absente.' };
  try {
    kaloneoMaskPreviewDefinition = JSON.parse(JSON.stringify(definition));
    adminCandidateResultsMode = false;
    mainWindow.loadFile(target);
    return { ok:true };
  } catch (error) {
    kaloneoMaskPreviewDefinition = null;
    return { ok:false, error:error && error.message ? error.message : String(error) };
  }
});

ipcMain.handle('kaloneo-mask:get-preview', () => {
  if (!adminSessionUnlocked) return { ok:false, error:'Accès administrateur requis.' };
  if (!kaloneoMaskPreviewDefinition) return { ok:false, error:'Aucun aperçu de masquage en cours.' };
  return { ok:true, definition:JSON.parse(JSON.stringify(kaloneoMaskPreviewDefinition)) };
});

ipcMain.handle('kaloneo-mask:consume-preview', () => {
  if (!adminSessionUnlocked) return { ok:false, error:'Accès administrateur requis.' };
  if (!kaloneoMaskPreviewDefinition) return { ok:false, error:'Aucun aperçu de masquage à restaurer.' };
  const definition = JSON.parse(JSON.stringify(kaloneoMaskPreviewDefinition));
  kaloneoMaskPreviewDefinition = null;
  return { ok:true, definition };
});

ipcMain.handle('kaloneo-mask:close-preview', () => {
  if (!mainWindow || mainWindow.isDestroyed() || !adminSessionUnlocked) return false;
  const target = path.join(__dirname, '..', 'app', 'web', 'admin-mask-builder.html');
  if (!fs.existsSync(target)) return false;
  mainWindow.loadFile(target, { query:{ resume:'preview' } });
  return true;
});

ipcMain.handle('kaloneo-builder:open-preview', (_event, definition, editorHistory) => {
  if (!mainWindow || mainWindow.isDestroyed() || !adminSessionUnlocked) {
    return { ok:false, error:'Accès administrateur requis.' };
  }
  if (getCandidateStore().getActiveCandidate()) {
    return { ok:false, error:'Impossible d’ouvrir un aperçu Builder pendant une évaluation active.' };
  }
  if (!definition || typeof definition !== 'object') {
    return { ok:false, error:'Définition KALTEST absente.' };
  }
  // Ouvrir directement la page candidat réelle (CSS + JS de production).
  const target = path.join(__dirname, '..', 'app', 'web', 'kaltest-pilot2.html');
  if (!fs.existsSync(target)) {
    return { ok:false, error:'Moteur candidat KALTEST absent.' };
  }
  try {
    kaloneoBuilderPreviewDefinition = JSON.parse(JSON.stringify(definition));
    // Sauvegarde transitoire en mémoire pendant l'aperçu : aucun quota
    // sessionStorage/localStorage, même avec des images HD.
    kaloneoBuilderPreviewEditorHistory =
      editorHistory?.schema===1 && Array.isArray(editorHistory.entries)
        ?editorHistory:null;
    adminCandidateResultsMode = false;
    kaloneoBuilderPreviewFullscreenActive=true;
    applyAdminWindowMode(true);
    mainWindow.loadFile(target, {query:{kaloneoPreview:'1'}});
    return { ok:true };
  } catch (error) {
    kaloneoBuilderPreviewDefinition = null;
    kaloneoBuilderPreviewEditorHistory = null;
    kaloneoBuilderPreviewFullscreenActive=false;
    applyAdminWindowMode(true);
    return { ok:false, error:error && error.message ? error.message : String(error) };
  }
});


/* R48.6 — Miniature réellement photographiée depuis KALTEST à 1366×768.
   Aucune réécriture HTML/CSS du test, aucune écriture candidat. */
function getKaloneoMiniPreviewWorker() {
  if (kaloneoMiniPreviewWorker && !kaloneoMiniPreviewWorker.isDestroyed()) {
    return kaloneoMiniPreviewWorker;
  }
  kaloneoMiniPreviewWorker=new BrowserWindow({
    show:false, focusable:false, width:1366,height:768,useContentSize:true,
    frame:false,skipTaskbar:true,paintWhenInitiallyHidden:true,
    backgroundColor:'#ffffff',
    webPreferences:{
      preload:path.join(__dirname,'preload.js'),
      contextIsolation:true,nodeIntegration:false,sandbox:false,
      backgroundThrottling:false,devTools:false,
      offscreen:true
    }
  });
  const worker=kaloneoMiniPreviewWorker;
  worker.on('closed',()=>{
    if(kaloneoMiniPreviewWorker===worker)kaloneoMiniPreviewWorker=null;
  });
  return kaloneoMiniPreviewWorker;
}

ipcMain.handle('kaloneo-builder:render-mini-preview', (event, definition, viewportMode='reference') => {
  if(!adminSessionUnlocked || !mainWindow || mainWindow.isDestroyed() ||
      event.sender!==mainWindow.webContents ||
      getCandidateStore().getActiveCandidate()) {
    return {ok:false,error:'Miniature réservée au Builder en mode Admin, sans candidat actif.'};
  }
  if(!definition || typeof definition!=='object') {
    return {ok:false,error:'Définition du test absente.'};
  }
  const submitted=JSON.parse(JSON.stringify(definition));
  // Tailles contrôlées : aucun dimensionnement arbitraire du processus caché.
  // La référence garde rigoureusement le rendu de la R141.
  const screenPresets=Object.freeze({
    '1200x800':[1200,800],'1280x720':[1280,720],
    '1366x768':[1366,768],'1600x900':[1600,900],'1920x1080':[1920,1080]
  });
  const requested=screenPresets[String(viewportMode||'reference')]||null;
  const previewWidth=requested?requested[0]:1366;
  const previewHeight=requested?requested[1]:768;
  const candidateZoom=requested?adaptiveZoomForDimensions(previewWidth,previewHeight):1;
  const requestSerial=++kaloneoMiniPreviewRequestSerial;
  // Sérialiser les captures pour éviter qu'un nouveau modèle ne remplace celui
  // d'une image encore en cours de génération.
  const job=kaloneoMiniPreviewJob.catch(()=>{}).then(async()=>{
    // Ne plus créer un Electron caché pour une édition déjà remplacée.
    if(requestSerial!==kaloneoMiniPreviewRequestSerial)
      return {ok:false,error:'Capture remplacée par une modification plus récente.'};
    if(!adminSessionUnlocked||!mainWindow||mainWindow.isDestroyed()||
       event.sender!==mainWindow.webContents||getCandidateStore().getActiveCandidate())
      return {ok:false,error:'La session Builder a changé pendant l’attente.'};
    const worker=getKaloneoMiniPreviewWorker();
    try {
    const source=path.join(__dirname,'..','app','web','kaltest-pilot2.html');
    kaloneoMiniPreviewDefinition=submitted;
    // Les machines Windows et les runners CI peuvent limiter la taille
    // physique d'une fenêtre cachée. Le zoom crée malgré cela exactement
    // le même viewport CSS qu'un candidat sur 1366×768.
    const bounds=worker.getContentBounds();
    const factor=Math.min(1,bounds.width/previewWidth,bounds.height/previewHeight);
    if(!(factor>0.25))return {ok:false,error:'Surface de capture indisponible.'};
    // Réduire pixels physiques ET zoom en proportions égales conserve le CSS
    // qu'utiliserait Electron sur l'écran W×H, sans toucher au vrai parcours.
    const workerZoom=factor*candidateZoom;
    worker.webContents.setZoomFactor(workerZoom);
    worker.setContentSize(Math.round(previewWidth*factor),Math.round(previewHeight*factor));
    await worker.loadFile(source,{query:{kaloneoPreview:'1'}});
    if(requestSerial!==kaloneoMiniPreviewRequestSerial)
      return {ok:false,error:'Capture remplacée par une modification plus récente.'};
    // Chromium peut réinitialiser le zoom d'un nouvel URL file://.
    worker.webContents.setZoomFactor(workerZoom);
    const report=await worker.webContents.executeJavaScript(`(async()=>{
      await document.fonts.ready;
      await Promise.all([...document.images].map(img=>img.complete?
        Promise.resolve():new Promise(resolve=>{
          img.addEventListener('load',resolve,{once:true});
          img.addEventListener('error',resolve,{once:true});
        })));
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      const content=document.getElementById('kaltest-content');
      // Contrôle strict : le défilement autorisé n'est jamais un débordement.
      // Même logique pour tout KALTEST, quelle que soit sa définition.
      const overflowAudit=(${inspectCandidateOverflow.toString()})(document);
      // Lire les rectangles sur la page DÉJÀ peinte. Aucun second rendu,
      // screenshot ou IPC n'est lancé pour les bulles de la miniature.
      const miniBlocks=[...content?.querySelectorAll('[data-kaloneo-mini-block-index]')||[]]
        .map(node=>{
          const index=Number(node.dataset.kaloneoMiniBlockIndex);
          const box=node.getBoundingClientRect();
          const clipped=node.closest('.kaltest-builder-runtime-zone')?.getBoundingClientRect();
          const left=Math.max(0,box.left,clipped?.left??0);
          const top=Math.max(0,box.top,clipped?.top??0);
          const right=Math.min(innerWidth,box.right,clipped?.right??innerWidth);
          const bottom=Math.min(innerHeight,box.bottom,clipped?.bottom??innerHeight);
          if(!Number.isInteger(index)||index<0||right-left<4||bottom-top<4)return null;
          // Coordonnées de l'image finale redimensionnée à l'écran simulé.
          const screenScale=${candidateZoom};
          return {index,x:Math.round(left*screenScale),y:Math.round(top*screenScale),
            width:Math.round((right-left)*screenScale),
            height:Math.round((bottom-top)*screenScale)};
        }).filter(Boolean);
      return {
        miniBlocks,
        ready:document.body.classList.contains('kaloneo-real-candidate-preview') &&
          Boolean(document.querySelector('#page-exercise.visible')),
        width:innerWidth,height:innerHeight,
        imageWidth:${previewWidth},imageHeight:${previewHeight},screenZoom:${candidateZoom},
        questionCount:content?.querySelectorAll('[data-question-id]').length||0,
        ...overflowAudit,
        brokenImages:[...document.images].filter(img=>!img.complete||!img.naturalWidth)
          .map(img=>img.getAttribute('src')).filter(Boolean)
      };
    })()`,true);
    if(!report.ready) return {ok:false,error:'Le moteur candidat n\u0027a pas terminé son affichage.'};
    const cssWidth=previewWidth/candidateZoom;
    const cssHeight=previewHeight/candidateZoom;
    if(Math.abs(report.width-cssWidth)>4||Math.abs(report.height-cssHeight)>4) {
      return {ok:false,error:'Viewport différent du candidat : '+report.width+' × '+report.height};
    }
    if(requestSerial!==kaloneoMiniPreviewRequestSerial)
      return {ok:false,error:'Capture remplacée par une modification plus récente.'};
    const screenshot=await worker.webContents.capturePage();
    if(screenshot.isEmpty())return {ok:false,error:'Capture candidat vide.'};
    const size=screenshot.getSize();
    const ratio=size.width/Math.max(1,size.height);
    if(Math.abs(ratio-previewWidth/previewHeight)>0.025) {
      return {ok:false,error:'Capture tronquée : '+size.width+' × '+size.height};
    }
    return {ok:true,image:screenshot.resize({width:previewWidth,height:previewHeight}).toDataURL(),report};
    } finally {
      // L'image a été copiée : ne laisser aucun moteur candidat caché tourner
      // après la capture, même si la page n'a pas chargé ou une erreur survient.
      try{
        if(!worker.isDestroyed())worker.destroy();
      }catch(error){
        console.warn('KALONÉO : fermeture miniature Electron impossible',error);
      }
      if(kaloneoMiniPreviewWorker===worker)kaloneoMiniPreviewWorker=null;
      kaloneoMiniPreviewDefinition=null;
    }
  });
  kaloneoMiniPreviewJob=job;
  return job.catch(error=>({ok:false,error:String(error?.message||error)}));
});

ipcMain.handle('kaloneo-builder:get-preview', () => {
  if (!adminSessionUnlocked) return { ok:false, error:'Accès administrateur requis.' };
  if (!kaloneoBuilderPreviewDefinition) return { ok:false, error:'Aucun aperçu KALONÉO en cours.' };
  try {
    return { ok:true, definition:JSON.parse(JSON.stringify(kaloneoBuilderPreviewDefinition)) };
  } catch (error) {
    return { ok:false, error:error && error.message ? error.message : String(error) };
  }
});

ipcMain.handle('kaloneo-builder:consume-preview', () => {
  if (!adminSessionUnlocked) return { ok:false, error:'Accès administrateur requis.' };
  if (!kaloneoBuilderPreviewDefinition) return { ok:false, error:'Aucun aperçu KALONÉO à restaurer.' };
  try {
    const definition = JSON.parse(JSON.stringify(kaloneoBuilderPreviewDefinition));
    const editorHistory=kaloneoBuilderPreviewEditorHistory;
    kaloneoBuilderPreviewDefinition = null;
    kaloneoBuilderPreviewEditorHistory = null;
    return { ok:true, definition, editorHistory };
  } catch (error) {
    return { ok:false, error:error && error.message ? error.message : String(error) };
  }
});

ipcMain.handle('kaloneo-builder:close-preview', () => {
  if (!mainWindow || mainWindow.isDestroyed() || !adminSessionUnlocked ||
      !kaloneoBuilderPreviewFullscreenActive) return false;
  const target = path.join(__dirname, '..', 'app', 'web', 'kaloneo-builder', 'test-builder.html');
  if (!fs.existsSync(target)) return false;
  kaloneoBuilderPreviewFullscreenActive=false;
  mainWindow.loadFile(target, { query:{ resume:'preview' } });
  return true;
});

ipcMain.handle('admin:export-bilan-docx', async (_event, payload) => {
  if (!editionCapabilities.canBilan || !adminSessionUnlocked) {
    return { ok:false, error:'Accès administrateur requis.' };
  }
  try {
    ensureSebDocumentsFolders();
    const requested = path.basename(String(payload?.filename || 'Evaluation.docx'));
    const filename = /\.docx$/i.test(requested) ? requested : requested.replace(/\.[^.]+$/,'') + '.docx';
    const targetDirectory = adminExportCandidateDir || getCandidateStore().getActiveExportDir() || internalBilanExportsDir();
    fs.mkdirSync(targetDirectory, { recursive:true });
    const target = path.join(targetDirectory, filename);
    if (!adminSessionDocumentPassword) {
      return { ok:false, error:'Mot de passe administrateur indisponible pour protéger le document Word.' };
    }
    const buffer = await buildBilanDocxBuffer(payload || {}, adminSessionDocumentPassword);
    fs.writeFileSync(target, buffer);
    cleanupNumberedCandidateWordCopies(targetDirectory, filename);
    return { ok:true, filename };
  } catch (error) {
    return { ok:false, error:error && error.message ? error.message : String(error) };
  }
});

ipcMain.handle('admin:open-bilan', () => {
  if (!editionCapabilities.canBilan) return false;
  if (!mainWindow || !adminSessionUnlocked) return false;
  adminCandidateResultsMode = false;
  const bilanPath = existingWebPage('admin-bilan.html');
  if (!fs.existsSync(bilanPath)) return false;
  mainWindow.loadFile(bilanPath);
  return true;
});

ipcMain.handle('admin:open-candidate-results', () => {
  if (!mainWindow || !adminSessionUnlocked) return false;
  adminCandidateResultsMode = true;
  mainWindow.loadFile(existingWebPage('qcmv1.0.html'));
  return true;
});

ipcMain.handle('admin:return-evaluation', () => {
  if (!mainWindow || !adminSessionUnlocked) return false;
  adminCandidateResultsMode = false;
  const state = readState();
  loadSavedCandidateEvaluation(state);
  return true;
});

ipcMain.handle('ai:status', () => {
  if (!editionCapabilities.canAi) {
    return { available:false, offline:true, integrated:false, edition:editionCapabilities.edition, error:'SEB-IA est réservée à la version Administrateur.' };
  }
  if (!adminSessionUnlocked) return { available:false, offline:true, integrated:true, error:'Accès administrateur requis.' };
  return { available:true, offline:true, integrated:true, model:'SEB-IA V1', runtime:'moteur rédactionnel intégré' };
});

ipcMain.handle('ai:rewrite-synthesis', async () => {
  if (!editionCapabilities.canAi) return { ok:false, error:'SEB-IA est réservée à la version Administrateur.' };
  if (!adminSessionUnlocked) return { ok:false, error:'Accès administrateur requis.' };
  return { ok:false, integrated:true, error:'SEB-IA génère directement la synthèse à partir du tableau ; aucune reformulation externe n’est nécessaire.' };
});

ipcMain.handle('ai:cancel-current', () => ({ ok:true, cancelled:false, offline:true, integrated:true }));

// SEB_CANDIDATE_REPLAY_PROTO_MAIN
require('./replay-main')({
  app,
  ipcMain,
  getAdminUnlocked: () => adminSessionUnlocked,
  getActiveCandidate: () => getCandidateStore().getActiveCandidate(),
  buildNumber: APP_BUILD_NUMBER
});
require('./bilan-history-main')({
  app,
  ipcMain,
  getAdminUnlocked: () => adminSessionUnlocked,
  buildNumber: APP_BUILD_NUMBER
});

require('./candidate-catalog-main')({
  app,
  ipcMain,
  getAdminUnlocked: () => adminSessionUnlocked,
  getAdminDocumentPassword: () => adminSessionDocumentPassword,
  getActiveCandidate: () => getCandidateStore().getActiveCandidate(),
  dataRoot: sebInternalRoot()
});

require('./session-close')({
  app,
  ipcMain,
  getMainWindow: () => mainWindow,
  getAdminUnlocked: () => adminSessionUnlocked,
  setAdminUnlocked: (value) => {
    adminSessionUnlocked = !!value;
    if (!adminSessionUnlocked) adminSessionDocumentPassword = '';
    applyAdminWindowMode(adminSessionUnlocked);
  }
});

app.whenReady().then(() => {
  if (process.platform === 'win32') app.setAppUserModelId(KALONEO_WINDOWS_APP_ID);
  installCandidateWindowsReturnGuard();
  startApplication();
});

app.on('before-quit', () => {
  allowApplicationExit = true;
  adminSessionDocumentPassword = '';
  stopCandidateKeyGuard();
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) startApplication();
});
