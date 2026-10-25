'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const nsis=fs.readFileSync(path.join(root,'build','installer.nsh'),'utf8');
const pkg=require('../package.json');
const matching=fs.readdirSync(path.join(root,'build'))
 .filter(f=>f.startsWith('kaloneo-r')&&f.endsWith('.yml'))
 .filter(f=>fs.readFileSync(path.join(root,'build',f),'utf8').includes('version: '+pkg.sebReleaseVersion));
assert.equal(matching.length,1,'Configuration unique du Setup actuel introuvable');
const cfg=fs.readFileSync(path.join(root,'build',matching[0]),'utf8');
assert.equal(pkg.build.nsis.deleteAppDataOnUninstall,false,'Le Setup generique doit conserver les donnees');
assert(cfg.includes('deleteAppDataOnUninstall: false'),'La configuration NSIS doit conserver AppData');
for(const expected of [
 '!macro customUnInit',
 '--delete-app-data',
 'Abort',
 '!macro customUnWelcomePage',
 'UninstPage custom un.KaloneoDataPageCreate un.KaloneoDataPageLeave',
 'NSD_CreateCheckbox',
 'NSD_Uncheck',
 'MB_YESNO|MB_ICONSTOP|MB_DEFBUTTON2',
 'KaloneoDeleteDataConfirmed',
 'RMDir /r "$APPDATA'+String.fromCharCode(92)+'KALONEO"',
 'RMDir /r "$LOCALAPPDATA'+String.fromCharCode(92)+'KALONEO"'
]){
 assert(nsis.includes(expected),'Protection NSIS manquante : '+expected);
}
const customUninstall=nsis.split('!macro customUnInstall')[1]?.split('!macroend')[0];
assert(customUninstall,'customUnInstall absent');
assert(customUninstall.indexOf('KaloneoDeleteDataConfirmed == "1"')>=0,'Effacement non conditionne');
assert(customUninstall.indexOf('KaloneoDeleteDataConfirmed == "1"')<customUninstall.indexOf('RMDir /r'),'Effacement avant validation');
assert(customUninstall.includes('${If} ${isUpdated}'),'Mise a jour non protegee');
const smoke=fs.readFileSync(path.join(root,'scripts','r159-clean-install-windows-smoke.ps1'),'utf8');
assert(smoke.includes('PRESERVED_ON_UNINSTALL'),'Tests de retention apres desinstallation manquants');
assert(fs.existsSync(path.join(root,'scripts','r172-real-upgrade-windows-smoke.ps1')),'Audit migration reel R172 absent');
console.log('KALONEO_R172_DATA_PRESERVATION_POLICY=OK: retention default, double confirmation, no --delete-app-data');
