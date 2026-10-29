const { app } = require('electron');
const path = require('path');

process.env.SEB_KALTEST_PILOT2 = '1';
process.env.SEB_KALTEST_FULL_PARCOURS = '1';
process.env.SEB_EVALPRO_EDITION = 'admin';

const APP_NAME = 'KALONÉO';

let storageReady = false;
try {
  app.setName(APP_NAME);
  const appData = app.getPath('appData');
  const isolatedRoot = path.join(appData, 'KALONEO');
  const documentsRoot = path.join(isolatedRoot, 'Documents');
  // Electron requires setPath() destinations to exist. Without creation,
  // the catch below would silently fall back to the internal package name,
  // recreating an unwanted seb-evalpro profile on a genuinely clean PC.
  require('node:fs').mkdirSync(documentsRoot,{recursive:true});
  app.setPath('userData', isolatedRoot);
  app.setPath('documents', documentsRoot);
  storageReady = true;
} catch (error) {
  // Never start with Electron's default package-name profile: that could
  // silently recreate the old seb-evalpro directory outside KALONEO.
  const { dialog } = require('electron');
  dialog.showErrorBox('KALONÉO — démarrage impossible',
    'Impossible d’accéder au dossier de données KALONEO. Aucun autre emplacement ne sera utilisé. Vérifiez les droits d’accès du compte Windows.');
  app.exit(1);
}

if (storageReady) require('./main');
