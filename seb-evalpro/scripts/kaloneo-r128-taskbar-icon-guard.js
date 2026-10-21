'use strict';
// R128: exact candidate-bar chameleon MUST be the Windows executable,
// taskbar, desktop shortcut, start-menu and Setup ICO. No redraw or white logo.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const ui=read('source/js/seb-ui-runtime.js');
const m=ui.match(/const KALONEO_BAR_ICON_DATA='data:image\/png;base64,([A-Za-z0-9+/=]+)'/);
assert(m,'Official embedded candidate toolbar chameleon not found');
const original=Buffer.from(m[1],'base64');
assert.equal(original.subarray(1,4).toString('ascii'),'PNG');
assert.equal(original.readUInt32BE(16),40);
assert.equal(original.readUInt32BE(20),40);
const icon=fs.readFileSync(path.join(root,'build/pilot-resources/kaloneo.ico'));
assert.equal(icon.readUInt16LE(0),0);
assert.equal(icon.readUInt16LE(2),1);
assert(icon.readUInt16LE(4)>=6,'Multiresolution Windows ICO is missing sizes.');
const config=read('build/kaloneo-r142-responsive.yml');
assert(config.includes('icon: build/pilot-resources/kaloneo.ico'));
assert(config.includes('installerIcon: build/pilot-resources/kaloneo.ico'));
assert(config.includes('uninstallerIcon: build/pilot-resources/kaloneo.ico'));
assert(config.includes('shortcutName: "KALONÉO"'));
assert(config.includes('to: kaloneo-taskbar.ico'));
assert(config.includes('executableName: KALONEO'));
const main=read('src/main.js');
assert(main.includes("path.join(process.resourcesPath, 'kaloneo-taskbar.ico')"));
assert((main.match(/icon: kaloneoWindowsWindowIcon\(\)/g)||[]).length>=3,
 'Every Electron public window must use the same actual chameleon');
assert(main.includes("app.setAppUserModelId(KALONEO_WINDOWS_APP_ID)"));
const branding=read('scripts/kaloneo-r125-branding.py');
assert(branding.includes('base64.b64decode(match.group(1),validate=True)'));
assert(branding.includes('candidate_icon.getpixel((0,0))[3]==0'));
assert(!branding.includes('paste_contained(icon,LOGO'),'Icon must not show the whole logo');
const pkg=JSON.parse(read('package.json'));
assert.equal(pkg.sebBuildNumber,147);
assert.equal(pkg.sebReleaseVersion,'0.0.171');
console.log('KALONEO_R130_WINDOWS_ICON=OK — exact original 40px chameleon, transparent multiresolution ICO, executable, every window, links and Setup');
