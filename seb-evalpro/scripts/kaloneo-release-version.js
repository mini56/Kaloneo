'use strict';
// Une source de version : package.json.sebBuildNumber.
// --release NUMBER synchronise les métadonnées avant chaque compilation Windows.
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const packagePath=path.join(root,'package.json');
const installerPath=path.join(root,'build','installer.nsh');
const originalConfigPath=path.join(root,'build','kaloneo-v1-00-190-final-setup.yml');
const generatedConfigPath=path.join(root,'build','kaloneo-auto-release.yml');
const read=p=>fs.readFileSync(p,'utf8');
const valid=n=>Number.isSafeInteger(n)&&n>=1&&n<=999999;
const versionFor=n=>'1.00.'+n;
const electronVersionFor=n=>'1.0.'+n;
const installerFilename=n=>'KALONEO-Setup-'+versionFor(n)+'.'+'$'+'{ext}';
function renderConfig(template,n){
  const countVersion=(template.match(/^\s+version:\s*\d+\.\d+\.\d+\s*$/gm)||[]).length;
  const countArtifact=(template.match(/^\s+artifactName:\s*"KALONEO-Setup-[^"]+"/gm)||[]).length;
  if(countVersion!==1||countArtifact!==1)throw Error('Template electron-builder changé : examen nécessaire');
  return template.replace(/^(\s+version:\s*)\d+\.\d+\.\d+\s*$/m,'$1'+electronVersionFor(n))
    .replace(/^(\s+artifactName:\s*)"KALONEO-Setup-[^"]+"/m,'$1"'+installerFilename(n)+'"');
}
function state(){
  const pkg=JSON.parse(read(packagePath));
  const number=Number(pkg.sebBuildNumber);
  if(!valid(number))throw Error('sebBuildNumber invalide');
  return {pkg,number};
}
function sync(n){
  if(!valid(n))throw Error('Numéro de build invalide : '+n);
  const {pkg}=state();
  pkg.sebBuildNumber=n;
  pkg.sebReleaseVersion=versionFor(n);
  pkg.version=electronVersionFor(n);
  const originalInstaller=read(installerPath);
  if((originalInstaller.match(/^!define SEB_BUILD_NUMBER "\d+"$/gm)||[]).length!==1)
    throw Error('Numéro NSIS inattendu');
  const installer=originalInstaller.replace(/^!define SEB_BUILD_NUMBER "\d+"$/m,'!define SEB_BUILD_NUMBER "'+n+'"');
  const yaml=renderConfig(read(originalConfigPath),n);
  if(!installer.includes('!define SEB_BUILD_NUMBER "'+n+'"')||
     !yaml.includes('artifactName: "'+installerFilename(n)+'"'))
    throw Error('Métadonnées de Release non générées');
  fs.writeFileSync(packagePath,JSON.stringify(pkg,null,2)+'\n');
  fs.writeFileSync(installerPath,installer);
  fs.writeFileSync(generatedConfigPath,yaml);
  verify();
  console.log('KALONEO_VERSION_SYNC=SUCCESS build='+n+' affichage='+versionFor(n)+' exe='+electronVersionFor(n));
}
function verify(){
  const {pkg,number:n}=state();
  if(pkg.sebReleaseVersion!==versionFor(n))throw Error('Version Admin/À propos incorrecte : '+pkg.sebReleaseVersion);
  if(pkg.version!==electronVersionFor(n))throw Error('Version package Electron incorrecte : '+pkg.version);
  const installer=read(installerPath);
  if(!installer.includes('!define SEB_BUILD_NUMBER "'+n+'"'))
    throw Error('Numéro de Setup NSIS différent du Build '+n);
  const actual=read(generatedConfigPath);
  const expected=renderConfig(read(originalConfigPath),n);
  if(actual!==expected)throw Error('Version ou nom du Setup non synchronisé dans kaloneo-auto-release.yml');
  const preload=read(path.join(root,'src','preload.js'));
  const tick=String.fromCharCode(96);
  if(!preload.includes('const APP_RELEASE_VERSION = '+tick+'1.00.'+'$'+'{APP_BUILD_NUMBER}'+tick+';'))
    throw Error('La barre Admin ne dérive pas la version du build unique');
  console.log('KALONEO_VERSION_GUARD=SUCCESS '+versionFor(n)+' (Admin / À propos / NSIS / Electron / Setup)');
}
function verifyPacked(){
  verify();
  const {number:n}=state();
  const asarPath=path.join(root,'dist','win-unpacked','resources','app.asar');
  if(!fs.existsSync(asarPath))throw Error('app.asar Windows non disponible');
  const asar=require('@electron/asar');
  const pkg=JSON.parse(asar.extractFile(asarPath,'package.json').toString('utf8'));
  if(pkg.sebBuildNumber!==n||pkg.sebReleaseVersion!==versionFor(n)||pkg.version!==electronVersionFor(n))
    throw Error('Version affichée dans le vrai KALONEO.exe différente du Setup : '+JSON.stringify({
      build:pkg.sebBuildNumber,release:pkg.sebReleaseVersion,electron:pkg.version
    }));
  console.log('KALONEO_PACKAGED_VERSION=SUCCESS '+versionFor(n));
}
if(require.main===module){
  try{
    const [mode,value]=process.argv.slice(2);
    if(mode==='--release'){if(!/^\d+$/.test(value||''))throw Error('Numéro de Release manquant');sync(Number(value));}
    else if(mode==='--verify')verify();
    else if(mode==='--verify-packed')verifyPacked();
    else throw Error('Usage: --release NUMBER | --verify | --verify-packed');
  }catch(error){console.error('KALONEO_VERSION_ERROR: '+error.message);process.exitCode=1;}
}
module.exports={versionFor,electronVersionFor,renderConfig,sync,verify,verifyPacked};
