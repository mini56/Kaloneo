'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const nsis=fs.readFileSync(path.join(root,'build','installer.nsh'),'utf8');
const pkg=require('../package.json');
const cfgFiles=fs.readdirSync(path.join(root,'build'))
  .filter(f=>/^kaloneo-r\d+.*\.yml$/.test(f))
  .filter(f=>fs.readFileSync(path.join(root,'build',f),'utf8')
    .includes('version: '+pkg.sebReleaseVersion));
assert.equal(cfgFiles.length,1,'Version-specific installer config missing');
const cfg=fs.readFileSync(path.join(root,'build',cfgFiles[0]),'utf8');
assert.equal(pkg.build.nsis.deleteAppDataOnUninstall,true);
assert.match(cfg,/deleteAppDataOnUninstall: true/);
const uninstall=nsis.match(/!macro customUnInstall\r?\n([\s\S]*?)\r?\n!macroend/);
assert(uninstall,'KALONEO NSIS uninstall hook is missing');
assert.match(uninstall[1],/\$\{IfNot\} \$\{isUpdated\}/,'An upgrade must NEVER delete user data');
assert.match(uninstall[1],/RMDir \/r "\$APPDATA\\KALONEO"/);
assert.match(uninstall[1],/RMDir \/r "\$LOCALAPPDATA\\KALONEO"/);
assert.doesNotMatch(uninstall[1],/RMDir\s*\/r\s*"?(?:\$APPDATA|\$LOCALAPPDATA|\$PROFILE|\$DOCUMENTS)"?(?:\s|$)/);
assert.match(uninstall[1],/SetShellVarContext current/);
assert.match(uninstall[1],/SetShellVarContext all/);
const power=fs.readFileSync(path.join(root,'scripts','r159-clean-install-windows-smoke.ps1'),'utf8');
for(const flag of ['Documents\\KALONEO\\bilan-test.docx','KALONEO-DO-NOT-DELETE','KALONEO profile/candidates/bilans remained'])assert(power.includes(flag));
console.log('KALONEO_COMPLETE_UNINSTALL_POLICY=OK — exact KALONEO profile/cache only, skip upgrade; Windows smoke asserts no leftovers');
