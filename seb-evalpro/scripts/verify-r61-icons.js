'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'../..');
const dir=path.join(repo,'kaloneo','icons-tests');
const manifest=JSON.parse(fs.readFileSync(path.join(dir,'inventaire_30_icones.json'),'utf8'));
assert.equal(manifest.count,30);
assert.equal(manifest.items.length,30);
const lib=require(path.join(repo,'kaloneo','icon-library.js'));
assert.equal(lib.count,100,'100 icônes attendues');
assert.equal(new Set(lib.icons.map(x=>x.id)).size,100,'Identifiants icônes dupliqués');
const ids=new Set(lib.icons.map(x=>x.id));
for(const i of manifest.items){
assert.ok(ids.has(i.id),'Icône absente : '+i.id);
const bytes=fs.readFileSync(path.join(repo,i.original));
assert.equal(crypto.createHash('sha256').update(bytes).digest('hex').toUpperCase(),i.sha256_original,'Original HD différent : '+i.id);
}
assert.ok(fs.readFileSync(path.join(repo,'kaloneo','test-builder.js'),'utf8').includes('window.KaloneoIconLibrary?.count!==100'));
console.log('ICONES_R61: OK — 70 préservées, 30 originales HD intactes, 100 icônes disponibles');
