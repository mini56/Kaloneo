'use strict';
// Reproducible, version-pinned patch of electron-builder's DIRECTORY PAGE only.
// Keep its supported default installer.nsi (including built-in uninstaller
// generation, Windows security checks and correct app upgrade logic).
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const builder=JSON.parse(fs.readFileSync(path.join(root,'node_modules','app-builder-lib','package.json'),'utf8'));
assert.equal(builder.version,'26.15.3','NSIS template changed: audit it before shipping.');
const target=path.join(root,'node_modules','app-builder-lib','templates','nsis','assistedInstaller.nsh');
let source=fs.readFileSync(target,'utf8');
const before='    !insertmacro skipPageIfUpdated\n    !insertmacro MUI_PAGE_DIRECTORY';
const after='    !insertmacro skipPageIfUpdated\n    !undef MUI_PAGE_CUSTOMFUNCTION_PRE\n    !define MUI_PAGE_CUSTOMFUNCTION_PRE KaloneoDirectoryPre\n    !define MUI_PAGE_CUSTOMFUNCTION_SHOW KaloneoDirectoryShow\n    !insertmacro MUI_PAGE_DIRECTORY';
if(source.includes(after)) {
 console.log('KALONEO_NSIS_DIRECTORY_PATCH=ALREADY_APPLIED');
} else {
 assert.equal(source.split(before).length,2,
   'Official assisted NSIS directory template no longer matches exactly; abort to protect updates.');
 assert(!source.includes('KaloneoDirectoryPre'),'Unexpected previously modified NSIS template.');
 source=source.replace(before,after);
 fs.writeFileSync(target,source,'utf8');
}
assert(source.includes(after),'KALONEO directory hook not installed.');
console.log('KALONEO_NSIS_DIRECTORY_PATCH=OK — only directory page, built-in uninstaller preserved.');
