'use strict';
// Limiter les IPC administrateur à la fenêtre principale et à une page Admin
// intégrée à KALONÉO. Les aperçus KALTEST et les iframes sont exclus, même si
// la session Administrateur est déverrouillée dans une autre page.
// Aucun changement au fonctionnement du Builder ou au stockage candidat.
const path=require('node:path');
const {fileURLToPath}=require('node:url');

const ADMIN_PAGES=new Set([
  'admin-candidats.html',
  'admin-tests-parcours.html',
  'admin-parcours-builder.html',
  'admin-bilan.html',
  'bilan.html',
  'admin-mask-builder.html',
  'admin-mask-preview.html',
  'admin-kaloneo-transfer.html',
  'kaloneo-builder/test-builder.html',
  'kaloneo-builder/test-preview.html',
  'test-preview.html'
]);

function isTrustedAdminSender(event,options={}){
  const {mainWindow,adminUnlocked=false,adminResultsMode=false,webRoot}=options;
  if(!adminUnlocked||!webRoot||!mainWindow||mainWindow.isDestroyed?.())return false;
  const contents=mainWindow.webContents;
  if(!contents||!event||event.sender!==contents)return false;
  // Les iframes sont interdites, y compris dans une page Admin autorisée.
  if(!event.senderFrame||event.senderFrame!==contents.mainFrame)return false;
  let url,localFile;
  try{
    url=new URL(event.senderFrame.url);
    if(url.protocol!=='file:')return false;
    localFile=fileURLToPath(url);
  }catch(_){return false;}
  const relative=path.relative(path.resolve(webRoot),path.resolve(localFile))
    .split(path.sep).join('/');
  // Ne jamais autoriser la page de test candidat, même en aperçu Admin.
  if(relative==='kaltest-pilot2.html'||relative==='qcmv1.0.html')
    return relative==='qcmv1.0.html'&&adminResultsMode===true;
  if(!ADMIN_PAGES.has(relative))return false;
  // L'accueil candidat partage son HTML avec l'espace Administrateur.
  if(relative==='admin-candidats.html'&&url.searchParams.get('candidateWelcome')==='1')
    return false;
  return true;
}
module.exports={isTrustedAdminSender,ADMIN_PAGES};
