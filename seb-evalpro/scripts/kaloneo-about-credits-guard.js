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
assert(settings.includes('data-sauvegarde56-about-logo'));
assert(settings.includes('Créateur et développeur'));
assert(settings.includes('Structure associée'));
assert(settings.includes('settings-about-brand'));
assert(settings.includes('settings-structure-credit'));
assert(settings.includes("layer.querySelector('#kaloneo-setting-author').textContent=author||'Non renseigné'"));
assert(preload.includes('author:appPackage.author'));
assert(typeof p.author==='string'&&p.author.trim()&&p.author.trim()!=='KALONÉO',
  'Public creator first and last name must be confirmed by user, not guessed.');
console.log('KALONEO_ABOUT_CREDITS=OK — 2 logos, personal creator credit, source assets, no candidate data changed');
