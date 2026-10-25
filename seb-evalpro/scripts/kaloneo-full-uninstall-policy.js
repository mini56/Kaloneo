'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const nsis=fs.readFileSync(path.join(root,'build','installer.nsh'),'utf8');
const pkg=require('../package.json');
const cfgFiles=fs.readdirSync(path.join(root,'build'))
 .filter(f=>/^kaloneo-r\\d+.*\\.yml$/.test(f))
 .filter(f=>fs.readFileSync(path.join(root,'build',f),'utf8')
  .includes('version: '+pkg.sebReleaseVersion));
assert.equal(cfgFiles.length,1,'Configuration du Setup unique introuvable');
const cfg=fs.readFileSync(path.join(root,'build',cfgFiles[0]),'utf8');
assert.equal(pkg.build.nsis.deleteAppDataOnUninstall,false,'Le template NSIS generique doit conserver AppData');
assert.match(cfg,/deleteAppDataOnUninstall: false/);
assert.match(nsis,/!macro customUnInit[\\s\\S]*?--delete-app-data[\\s\\S]*?Abort[\\s\\S]*?!macroend/);
assert.match(nsis,/!macro customUnWelcomePage[\\s\\S]*?UninstPage custom un.KaloneoDataPageCreate un.KaloneoDataPageLeave/);
assert.match(nsis,/\\$\\{NSD_Uncheck\\} \\$KaloneoDeleteDataCheckbox/);
assert.match(nsis,/MB_YESNO\\|MB_ICONSTOP\\|MB_DEFBUTTON2/);
assert.match(nsis,/\\$\\{If\\} \\$\\{isUpdated\\}/);
assert.match(nsis,/\\$\\{If\\} \\$KaloneoDeleteDataConfirmed == "1"/);
assert.match(nsis,/RMDir \\/r "\\$APPDATA\\\\KALONEO"/);
assert.match(nsis,/RMDir \\/r "\\$LOCALAPPDATA\\\\KALONEO"/);
const customUnInstall=nsis.match(/!macro customUnInstall\\r?\\n([\\s\\S]*?)\\r?\\n!macroend/);
assert(customUnInstall,'customUnInstall absent');
assert(customUnInstall[1].indexOf('\\$KaloneoDeleteDataConfirmed')<customUnInstall[1].indexOf('RMDir /r'),'Suppression non protegee');
assert.doesNotMatch(customUnInstall[1],/RMDir\\s*\\/r\\s*"?\\$APPDATA"?(?:\\s|$)/);
const power=fs.readFileSync(path.join(root,'scripts','r159-clean-install-windows-smoke.ps1'),'utf8');
assert(power.includes('PRESERVED_ON_UNINSTALL'),'Verifier réellement la conservation des données après desinstallation');
assert(fs.existsSync(path.join(root,'scripts','r172-real-upgrade-windows-smoke.ps1')),'Audit installation/mise a jour R172 absent');
console.log('KALONEO_R172_DATA_PRESERVATION_POLICY=OK: uninstall conserve; option confirmation double; --delete-app-data refuse; upgrades safe');
