'use strict';
// Mises à jour dans le dossier Téléchargements personnel de Windows. Aucun Setup complet n'est effacé automatiquement.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {spawn}=require('node:child_process');
const {compareVersions,validateDownload,downloadVerified}=require('./kaloneo-update-checker');

function updateDirectory(downloadsDirectory){
  if(!downloadsDirectory||!path.isAbsolute(downloadsDirectory))
    throw new Error('Dossier Téléchargements Windows introuvable.');
  return downloadsDirectory;
}
function officialFile(update,downloadsDirectory){
  validateDownload(update);
  const name='KALONEO-Setup-'+update.version+'.exe';
  if(update.filename!==name||!/^KALONEO-Setup-\d+\.\d+\.\d+\.exe$/.test(name))
    throw new Error('Nom de Setup non reconnu.');
  return path.join(updateDirectory(downloadsDirectory),name);
}
async function isVerifiedFile(update,file){
  try{
    const info=await fs.promises.stat(file);
    if(!info.isFile()||info.size!==update.size)return false;
    const hash=crypto.createHash('sha256');
    for await(const chunk of fs.createReadStream(file))hash.update(chunk);
    return hash.digest('hex').toLowerCase()===update.sha256.toLowerCase();
  }catch(error){
    if(error.code==='ENOENT')return false;
    throw error;
  }
}
async function stageVerifiedSetup(update,downloadsDirectory,options={}){
  const filename=officialFile(update,downloadsDirectory);
  await fs.promises.mkdir(path.dirname(filename),{recursive:true});
  // Supprimer uniquement un ancien fragment temporaire produit par KALONÉO.
  await fs.promises.rm(filename+'.kaloneo-download',{force:true});
  // Réutiliser le Setup déjà téléchargé uniquement si son SHA256 est exact.
  if(await isVerifiedFile(update,filename))
    return {ok:true,filePath:filename,sha256:update.sha256.toLowerCase(),bytes:update.size,reused:true};
  // Téléchargements appartient à l'utilisateur : jamais écraser ou supprimer
  // un EXE qui porte déjà le nom attendu (même s'il est invalide).
  const existing=await fs.promises.stat(filename).catch(error=>{
    if(error.code==='ENOENT')return null;
    throw error;
  });
  if(existing)
    throw new Error('Un fichier portant ce nom existe déjà dans Téléchargements mais ne correspond pas au Setup officiel. Renommez-le ou supprimez-le vous-même, puis réessayez.');
  return downloadVerified(update,filename,options);
}
function buildWaitAndStartCommand(setup,pid){
  if(!Number.isSafeInteger(pid)||pid<=0||!path.isAbsolute(setup))throw new Error('Lancement invalide.');
  // PowerShell reçoit une commande encodée UTF16LE: aucun chemin utilisateur
  // n'est interprété par cmd.exe, et le Setup ne démarre qu'après la fermeture.
  const quoted=setup.replace(/'/g,"''");
  const script=`$ErrorActionPreference='Stop'; $old=Get-Process -Id ${pid} -ErrorAction SilentlyContinue; if($old){$old.WaitForExit(90000)|Out-Null; if(-not $old.HasExited){exit 2}}; Start-Process -FilePath '${quoted}'`;
  return Buffer.from(script,'utf16le').toString('base64');
}
function startAfterApplicationExit(setup,pid,options={}){
  const encoded=buildWaitAndStartCommand(setup,pid);
  const powerShell=options.powerShell||path.join(process.env.SystemRoot||'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe');
  const proc=(options.spawn||spawn)(powerShell,['-NoProfile','-NonInteractive','-WindowStyle','Hidden','-EncodedCommand',encoded],
    {detached:true,windowsHide:true,stdio:'ignore'});
  proc.unref();
  return true;
}
async function canInstallVerifiedUpdate(update,installedVersion,downloadsDirectory){
  const file=officialFile(update,downloadsDirectory);
  if(compareVersions(update.version,installedVersion)<=0)
    throw new Error('Cette mise à jour n’est pas plus récente que KALONÉO.');
  if(!await isVerifiedFile(update,file))
    throw new Error('Setup absent ou non conforme (SHA256). Téléchargez-le à nouveau.');
  return file;
}
module.exports={updateDirectory,officialFile,isVerifiedFile,stageVerifiedSetup,
  buildWaitAndStartCommand,startAfterApplicationExit,canInstallVerifiedUpdate};
