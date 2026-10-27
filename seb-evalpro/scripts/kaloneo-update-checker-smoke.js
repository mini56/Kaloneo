'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const crypto=require('node:crypto');
const {Readable}=require('node:stream');
const {compareVersions,findLatestRelease,checkUpdates,downloadVerified,validateDownload}=require('../src/kaloneo-update-checker');

async function run(){
  assert.equal(compareVersions('1.00.191','1.0.190'),1);
  assert.equal(compareVersions('1.0.189','1.00.190'),-1);
  assert.equal(compareVersions('1.00.190','1.0.190'),0);
  assert.throws(()=>compareVersions('inconnue','1.0.190'));
  const length=40*1024*1024;
  const block=Buffer.alloc(1024*1024,0x5a);
  const hash=crypto.createHash('sha256');
  for(let n=0;n<40;n++)hash.update(block);
  const sha=hash.digest('hex');
  const asset=(version,digest='sha256:'+sha)=>({
    tag_name:'kaloneo-'+version,draft:false,assets:[{
      name:'KALONEO-Setup-'+version+'.exe',size:length,digest
    }]
  });
  const latest=findLatestRelease([asset('1.00.190'),asset('1.00.191'),asset('1.00.192','missing')]);
  assert.equal(latest.version,'1.00.191','ne doit retenir que les Releases vérifiables');
  assert.equal(latest.releaseUrl,'https://github.com/mini56/Kaloneo-MAJ/releases/tag/kaloneo-1.00.191');
  assert.equal((await checkUpdates('1.00.190',{fetchReleases:async()=>[asset('1.00.191')]})).status,'available');
  assert.equal((await checkUpdates('1.00.191',{fetchReleases:async()=>[asset('1.00.191')]})).status,'current');
  assert.equal((await checkUpdates('1.00.190',{fetchReleases:async()=>[]})).status,'no_release');
  assert.throws(()=>validateDownload({...latest,url:'https://example.com/malware.exe'}),'Interdire les domaines non autorisés');

  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'kaloneo-maj-test-'));
  try{
    const target=path.join(dir,latest.filename);
    const stream=()=>Readable.from((async function*(){for(let i=0;i<40;i++)yield block;})());
    const progress=[];const phases=[];
    const r=await downloadVerified(latest,target,{responseFor:async()=>stream(),
      onProgress:value=>progress.push(value),onPhase:phase=>phases.push(phase)});
    assert.equal(r.ok,true);
    assert.equal(r.sha256,sha);
    assert(progress.length>5,'Actual progress events must be emitted during the transfer');
    assert(progress.every((p,i)=>p.percent>=0&&p.percent<=100&&p.receivedBytes<=length&&p.totalBytes===length&&(!i||p.percent>progress[i-1].percent)),'Percentages must be monotonic and based on actual bytes');
    assert.equal(progress.at(-1).percent,100);
    assert.equal(progress.at(-1).receivedBytes,length);
    assert.deepEqual(phases,['verifying'],'SHA256 stage must be distinct from received bytes');
    assert.equal(fs.statSync(target).size,length);
    fs.rmSync(target);
    const modified={...latest,sha256:'0'.repeat(64)};
    await assert.rejects(()=>downloadVerified(modified,target,{responseFor:async()=>stream()}),/SHA256/);
    assert.equal(fs.existsSync(target),false,'ne pas laisser de Setup corrompu');
    assert.equal(fs.existsSync(target+'.kaloneo-download'),false,'effacer les téléchargements invalides');
  }finally{fs.rmSync(dir,{recursive:true,force:true});}

  const root=path.resolve(__dirname,'..');
  const main=fs.readFileSync(path.join(root,'src','main.js'),'utf8');
  const settings=fs.readFileSync(path.join(root,'src','kaloneo-admin-settings.js'),'utf8');
  assert.ok(main.includes("ipcMain.handle('kaloneo-updates:check'"));
  assert.ok(main.includes("ipcMain.handle('kaloneo-updates:download'"));
  assert.ok(main.includes("!adminSessionUnlocked||!mainWindow||event.sender!==mainWindow.webContents"));
  assert.ok(main.includes("getCandidateStore().getActiveCandidate()"));
  assert.ok(settings.includes('data-check-update'));
  assert.ok(settings.includes('data-download-update'));
  assert.ok(settings.includes('Vérifier les mises à jour'));
  assert.ok(settings.indexOf('data-kaloneo-about-logo')<settings.indexOf('data-check-update'),'bouton sous logo');
  assert.ok(settings.includes('La mise à jour va être téléchargée dans le dossier sécurisé KALONEO-Updates'),'Indiquer le dossier sécurisé de téléchargement');
  assert.ok(main.includes("event.sender.send('kaloneo-updates:download-started')"),'Émettre le signal de démarrage réel après le choix du fichier');
  assert.ok(main.includes("event.sender.send('kaloneo-updates:download-progress',progress)"),'Propagate genuine streaming progress');
  assert.ok(main.includes("event.sender.send('kaloneo-updates:download-phase',phase)"),'Separate SHA256 verification phase');
  assert.ok(settings.includes('data-update-progress-area')&&settings.includes('data-update-progress-label'),'Green progress indicator must exist');
  assert.ok(settings.includes('data-update-progress max="100" value="0"'),'Progress must start at zero');
  assert.ok(settings.includes('background:#20a457'),'Green bar must have an explicit color');
  assert.ok(settings.includes("ipcRenderer.on('kaloneo-updates:download-progress',onDownloadProgress)"),'Listen for genuine progress');
  assert.ok(settings.includes("ipcRenderer.removeListener('kaloneo-updates:download-progress',onDownloadProgress)"),'Remove progress listener after completion');
  assert.ok(settings.includes('1048576'),'Transferred megabytes shown alongside percent');
  assert.ok(settings.includes('100 % — vérification en cours'),'100 percent bytes is not a claim of verified download');
  assert.ok(settings.includes("ipcRenderer.on('kaloneo-updates:download-started',onDownloadStarted)"),'Afficher la progression au démarrage effectif du transfert');
  assert.ok(settings.includes("ipcRenderer.removeListener('kaloneo-updates:download-started',onDownloadStarted)"),'Nettoyer le signal après téléchargement ou annulation');
  assert.ok(settings.includes('Mise à jour en cours de téléchargement. Veuillez patienter'),'Indiquer clairement d’attendre la fin du téléchargement');
  assert.ok(settings.includes('Ne fermez pas KALONÉO pendant le transfert'),'Empêcher une fermeture prématurée');
  assert.ok(settings.includes('Téléchargement terminé et vérifié (SHA256 conforme)'),'Confirmer réellement la fin du téléchargement');
  assert.ok(settings.includes('Démarrer KALONÉO maintenant'),'Expliquer que le nouveau programme s’ouvre à la fin si coché');
  assert.ok(settings.includes('data-install-update') && settings.includes('Installer maintenant'),'Proposer une installation après validation SHA256');
  assert.ok(settings.includes("ipcRenderer.invoke('kaloneo-updates:install')"),'Demander l’accord Administrateur pour installer');
  assert.ok(settings.includes('data-open-downloaded-setup-folder'),'Le bouton dossier doit être présent dans les Réglages');
  assert.ok(settings.includes('openDownloadedSetupFolder.hidden=false'),'Le bouton dossier doit être visible uniquement après validation du téléchargement');
  assert.ok(settings.includes('Fichier enregistré : '),'Le chemin réellement choisi doit être indiqué à l’administrateur');
  assert.ok(settings.includes("ipcRenderer.invoke('kaloneo-updates:open-download-folder')"));
  assert.ok(main.includes("ipcMain.handle('kaloneo-updates:open-download-folder'"));
  assert.ok(main.includes("shell.showItemInFolder(filePath)"),'Afficher le fichier dans l’Explorateur');
  assert.ok(main.includes('lastVerifiedKaloneoSetupPath=result.filePath'),'N’autoriser que le fichier effectivement vérifié');
  assert.ok(main.includes('stageVerifiedSetup(update,process.env.LOCALAPPDATA)'),'Utiliser un dossier local dédié pour le Setup');
  assert.ok(main.includes('canInstallVerifiedUpdate(update,app.getVersion(),process.env.LOCALAPPDATA)'),'Revérifier SHA256 au moment de l’installation');
  assert.ok(main.includes('if(!filePath||!fs.existsSync(filePath))'),'Ne pas proposer un fichier inexistant');
  assert.ok(!main.includes("ipcMain.handle('kaloneo-updates:open-download-folder',async(event,filePath)"),'Ne jamais autoriser un chemin arbitraire venant de l’interface');
  console.log('KALONEO_MAJ_UPDATER_SMOKE=SUCCESS : versions, sources authentifiées, 40 Mo SHA256, emplacement affiché, bouton dossier sécurisé, abandon protégé.');
}
run().catch(e=>{console.error(e);process.exitCode=1;});
