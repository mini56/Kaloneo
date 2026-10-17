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
const release=fs.readFileSync(path.join(root,'build','kaloneo-v1-fixes-r121-supplementary-windows.yml'),'utf8');
if(!release.includes('version: '+version))fail('La version installateur diffère de la barre Admin.');
console.log('KALONÉO barre Admin = version '+version+' ; Build #'+build+' (compilation) — OK.');
