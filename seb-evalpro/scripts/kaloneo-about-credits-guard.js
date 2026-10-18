'use strict';
// KALONÉO: credits are informational, must not affect candidate or Builder.
// Block release if the legal display name is missing: a product name is not a person.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const p=JSON.parse(read('package.json'));
const settings=read('src/kaloneo-admin-settings.js');
const preload=read('src/preload.js');
assert(fs.existsSync(path.join(root,'source/assets/kaloneo-logo-app.png')));
assert(fs.existsSync(path.join(root,'source/sauvegarde56-logo.svg')));
assert(settings.includes("new URL('assets/kaloneo-logo-app.png',webRoot())"));
assert(settings.includes("new URL('sauvegarde56-logo.svg',webRoot())"));
assert(settings.includes('data-kaloneo-header-logo'));
assert(settings.includes('data-kaloneo-about-logo'));
assert(settings.includes('data-associated-structures'));
assert(settings.includes('Structure associée :'));
assert(settings.includes("const associatedStructures=[{name:'Sauvegarde 56'"));
assert(settings.includes('Créateur et développeur'));
assert(settings.includes('Structure associée'));
assert(settings.includes('settings-about-brand'));
assert(settings.includes('settings-structure-list'));
assert(settings.includes('settings-structure-item'));
assert(settings.includes('settings-structure-name'));
assert(settings.includes('item.append(name,image)'));
assert(settings.includes('aboutSection.scrollTop=0'));
assert(settings.includes('width:100%;max-width:940px'));
assert(settings.includes('width:100%;height:auto;max-width:820px'));
assert(!settings.includes('settings-structure-credit'));
assert(!settings.includes("width:min(270px,100%)"));
assert(settings.includes("layer.querySelector('#kaloneo-setting-author').textContent=author||'Non renseigné'"));
assert(preload.includes('author:appPackage.kaloneoCreator'));
assert.equal(p.kaloneoCreator,'Claude LESPAGNOL','Creator must display the user-confirmed exact name');
assert.equal(p.author,'KALONÉO','Keep historical package publisher brand unchanged');
assert(!/Claude LESPAGNOL/.test(read('src/kaltest-pilot21-main.js')),
  'Personal creator name belongs only in About, not candidate screen');
console.log('KALONEO_ABOUT_CREDITS=OK — 2 logos, personal creator credit, source assets, no candidate data changed');
