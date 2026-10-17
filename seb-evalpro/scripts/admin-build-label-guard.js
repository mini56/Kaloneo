'use strict';
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const pkg=require(path.join(root,'package.json'));
const preload=fs.readFileSync(path.join(root,'src','preload.js'),'utf8');
const installer=fs.readFileSync(path.join(root,'build','installer.nsh'),'utf8');
function fail(message){console.error('KALONÉO garde version Admin : '+message);process.exit(2);}
const build=String(pkg.sebBuildNumber||'');
const version=String(pkg.sebReleaseVersion||'');
if(!/^\d+$/.test(build)||!/^\d+\.\d+\.\d+$/.test(version))fail('Build/version manquants.');
if(!preload.includes("const APP_BUILD_NUMBER = String(appPackage.sebBuildNumber || '').trim() || 'DEV';"))
  fail('Numéro de build central introuvable.');
if(!preload.includes("const APP_RELEASE_VERSION = String(appPackage.sebReleaseVersion || '').trim() || 'Version inconnue';"))
  fail('Version de distribution non lue depuis package.json.');
if(!preload.includes('APP_BUILD_LABEL')||!preload.includes('${APP_BUILD_LABEL}'))
  fail('Version absente de la barre Admin.');
if(!installer.includes('!define SEB_BUILD_NUMBER "'+build+'"'))
  fail('Numéro NSIS et package.json incohérents.');
// Ne jamais vérifier une ancienne configuration R121 quand le Builder évolue.
const buildDir=path.join(root,'build');
const compatible=fs.readdirSync(buildDir)
  .filter(file=>/^kaloneo-v1-fixes-r\d+.*\.yml$/i.test(file))
  .filter(file=>{
    const release=fs.readFileSync(path.join(buildDir,file),'utf8');
    return release.includes('version: '+version) &&
      release.includes('artifactName: ') &&
      release.includes('-'+version+'-Windows-Setup');
  });
if(compatible.length!==1)fail('Configuration unique du Setup '+version+' introuvable ou ambiguë.');
console.log('KALONÉO barre Admin = version '+version+' ; Build #'+build+' (compilation) — OK.');
