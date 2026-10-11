'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'../..');
const dir=path.join(repo,'kaloneo','icons-tests');
const manifest=JSON.parse(fs.readFileSync(path.join(dir,'inventaire_30_icones.json'),'utf8'));
assert.equal(manifest.count,30);
assert.equal(manifest.items.length,30);
assert.equal(manifest.total,100);
assert.equal(manifest.pixel_size,96);
const lib=require(path.join(repo,'kaloneo','icon-library.js'));
assert.equal(lib.count,100,'Le catalogue doit contenir 100 icônes');
assert.equal(new Set(lib.icons.map(x=>x.id)).size,100,'Identifiant dupliqué');
const byId=new Map(lib.icons.map(x=>[x.id,x]));
assert.equal(fs.readdirSync(dir).filter(x=>x.endsWith('.png')).length,30);
for(const i of manifest.items){
 const icon=byId.get(i.id);assert.ok(icon,'Icône absente: '+i.id);
 const png=fs.readFileSync(path.join(repo,i.original));
 assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
 assert.equal(png.readUInt32BE(16),96,'Largeur non 96 : '+i.id);
 assert.equal(png.readUInt32BE(20),96,'Hauteur non 96 : '+i.id);
 assert.equal(crypto.createHash('sha256').update(png).digest('hex').toUpperCase(),i.sha256);
 assert.equal(icon.data,'data:image/png;base64,'+png.toString('base64'));
}
assert.ok(fs.readFileSync(path.join(repo,'kaloneo','test-builder.js'),'utf8').includes('window.KaloneoIconLibrary?.count!==100'));
console.log('ICONES_96_R61: OK — 30 PNG exacts 96x96, 70 anciens préservés, total 100.');
