'use strict';
// R159: clean Windows setup. No previous SEB folder, registry alias or user data.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const pkg=require('../package.json');
const matches=fs.readdirSync(path.join(root,'build'))
 .filter(name=>/^kaloneo-r\d+[-a-z0-9]*\.yml$/i.test(name))
 .filter(name=>{
    const v=read('build/'+name);
    return v.includes('version: '+pkg.sebReleaseVersion) &&
      v.includes('KALONEO-Setup-'+pkg.sebReleaseVersion);
 });
assert.equal(matches.length,1,'One Windows release configuration must match package.json');
const cfg=read('build/'+matches[0]);
const nsis=read('build/installer.nsh');
const pilot=read('src/kaltest-pilot21-main.js');
const main=read('src/main.js');
assert.match(pkg.sebReleaseVersion,/^\d+\.\d+\.\d+$/);
assert(Number.isInteger(pkg.sebBuildNumber)&&pkg.sebBuildNumber>=162);
assert(cfg.includes('appId: fr.sauvegarde56.kaloneo'));
assert(cfg.includes('productName: "KALONÉO"'));
assert(cfg.includes('executableName: KALONEO'));
assert(cfg.includes('shortcutName: "KALONÉO"'));
assert(cfg.includes('allowToChangeInstallationDirectory: true'));
assert(cfg.includes('deleteAppDataOnUninstall: false'));
assert(cfg.includes('KALONEO-Setup-'+pkg.sebReleaseVersion));
assert(nsis.includes('!define SEB_BUILD_NUMBER "'+pkg.sebBuildNumber+'"'));
assert(nsis.includes('StrCpy $INSTDIR "$LOCALAPPDATA\\Programs\\KALONEO"'));
assert(!nsis.includes('$installMode'),'Installer directory page must not access undeclared installMode');
assert(nsis.includes('Function KaloneoDirectoryPre'),'Native installer folder page must stay present');
assert(nsis.includes('StrCpy $perUserInstallationFolder "$LOCALAPPDATA\\Programs\\KALONEO"'));
assert(nsis.includes('StrCpy $perMachineInstallationFolder "$PROGRAMFILES64\\KALONEO"'));
assert(!/seb-evalpro|Recovery|candidate-local-key|CopyFiles|Rename "\\$INSTDIR"|ReadRegStr|SEB EvalPro\\.lnk/i.test(nsis),
 'Legacy path, registry or recovery unexpectedly reachable from installer');
assert(pilot.includes("path.join(appData, 'KALONEO')"));
assert(pilot.includes('mkdirSync(documentsRoot,{recursive:true})'),'New userData path must exist before Electron setPath');
assert(!pilot.includes('SEB EvalPro Kaloneo PILOTE 21'));
assert(main.includes("const KALONEO_WINDOWS_APP_ID = 'fr.sauvegarde56.kaloneo'"));
console.log('KALONEO_R159_CLEAN_SETUP=OK — path KALONEO only; new product ID/profile; NO old-file recovery/migration');
