'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..');
const lib=path.join(root,'seb-evalpro','source','bibliotheque-images');
const dir=path.join(lib,'horaires');
const catalogFile=path.join(lib,'catalogue-images.json');
const v1File=path.join(root,'TESTS_V1','l-1.0.0-test.json');
const smokeFile=path.join(root,'seb-evalpro','scripts','kaloneo-bon-transport-v1-smoke.js');
const digest=(buf,alg)=>crypto.createHash(alg).update(buf).digest('hex');
const json=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const save=(file,obj)=>fs.writeFileSync(file,JSON.stringify(obj,null,2)+'\n','utf8');
const names=fs.readdirSync(dir).filter(n=>n.toLowerCase().endsWith('.png')).sort();
const expected=[];
for(let h=0;h<12;h++)for(const mm of ['00','15','30','45'])expected.push(String(h).padStart(2,'0')+'H'+mm+'.png');
assert.deepEqual(names,expected,'Les 48 PNG doivent couvrir les quarts d’heure de 00 à 11 heures');
const signature=Buffer.from([137,80,78,71,13,10,26,10]);
const images=new Map(),unique=new Set();
for(const name of names){
  const bytes=fs.readFileSync(path.join(dir,name));
  assert(bytes.length>1000&&bytes.subarray(0,8).equals(signature),'Image PNG invalide : '+name);
  assert(bytes.subarray(12,16).toString('ascii')==='IHDR','En-tête PNG invalide : '+name);
  const w=bytes.readUInt32BE(16),h=bytes.readUInt32BE(20);
  assert(w>=100&&h>=100&&w<=4096&&h<=4096,'Dimensions invalides : '+name);
  const sha256=digest(bytes,'sha256');
  assert(!unique.has(sha256),'Horloges identiques malgré des noms différents : '+name);
  unique.add(sha256);
  images.set(name,{path:'horaires/'+name,bytes:bytes.length,sha1:digest(bytes,'sha1'),sha256});
}
const catalogue=json(catalogFile);
assert(catalogue.format==='kaloneo-supplied-images'&&catalogue.schemaVersion===1&&Array.isArray(catalogue.files));
const old=catalogue.files.filter(item=>String(item.path||'').startsWith('horaires/'));
assert(old.length===48,'Catalogue d’horloges inattendu');
const insert=catalogue.files.findIndex(item=>String(item.path||'').startsWith('horaires/'));
catalogue.files=catalogue.files.filter(item=>!String(item.path||'').startsWith('horaires/'));
catalogue.files.splice(insert,0,...names.map(name=>{
  const img=images.get(name);
  return {path:img.path,bytes:img.bytes,sha1:img.sha1};
}));
const test=json(v1File);
assert(test.id==='l'&&test.title==='Bon de transport.'&&test.version==='1.0.0');
assert(test.presentation.layout==='40-60'&&test.presentation.supplementaryWindows.length===2);
assert(test.questions.length===5);
assert.deepEqual(test.questions.map(q=>q.points),[1,1,1,1,0]);
assert(Array.isArray(test.kaloneoLibrary?.imageSources)&&test.kaloneoLibrary.imageSources.length===3);
assert(test.kaloneoLibrary.imageSources[2].sourcePath==='02_fin_stage_01/05.png');
const questions=JSON.stringify(test.questions),blocks=JSON.stringify(test.presentation.builderContent),bilan=JSON.stringify(test.bilanContributions);
const files=['04H00.png','06H15.png'],labels=['Illustration du départ','Illustration de l’arrivée'];
for(let i=0;i<2;i++){
  const win=test.presentation.supplementaryWindows[i],img=images.get(files[i]);
  assert(win.type==='image');
  assert(i===0?/^Au départ[.]?$/.test(win.title):/^A l.arrivée[.]?$/.test(win.title));
  win.imageData='kaloneo-asset:'+img.sha256+'.png';
  win.imageName=labels[i]; // Nom interne neutre, sans heure affichée au candidat.
  win.imageAlt=i===0?'Horloge du départ':'Horloge de l’arrivée';
  test.kaloneoLibrary.imageSources[i]={name:labels[i],sha256:img.sha256,sourcePath:img.path,mime:'image/png'};
}
assert(JSON.stringify(test.questions)===questions&&JSON.stringify(test.presentation.builderContent)===blocks&&JSON.stringify(test.bilanContributions)===bilan,'Le contenu pédagogique ou le bilan ont changé');
assert(!/04H00|06H15|4h00|6h15/i.test(test.presentation.supplementaryWindows.map(w=>[w.title,w.imageName,w.imageAlt].join(' ')).join(' ')),'Réponse dévoilée');
let smoke=fs.readFileSync(smokeFile,'utf8');
const i=smoke.indexOf('const expected=['),j=smoke.indexOf('\n];',i);
assert(i>=0&&j>i,'Références des images de contrôle introuvables');
const third=test.kaloneoLibrary.imageSources[2];
const rows=[...files.map(n=>{const img=images.get(n);return "  ['"+img.path+"','"+img.sha256+"']";}),"  ['"+third.sourcePath+"','"+third.sha256+"']"];
smoke=smoke.slice(0,i)+'const expected=[\n'+rows.join(',\n')+smoke.slice(j);
const anchor='  assert.equal(original.presentation.supplementaryWindows.length,2);\n';
assert(smoke.includes(anchor));
if(!smoke.includes('Aucune heure dévoilée')){
  smoke=smoke.replace(anchor,anchor+
    '  // Aucune heure dévoilée dans le titre ou les métadonnées affichables.\n'+
    "  assert(!/04H00|06H15|4h00|6h15/i.test(original.presentation.supplementaryWindows.map(w=>[w.title,w.imageName,w.imageAlt].join(' ')).join(' ')));\n");
}
save(catalogFile,catalogue);
save(v1File,test);
fs.writeFileSync(smokeFile,smoke,'utf8');
console.log('48 PNG DISTINCTS ; BON_DE_TRANSPORT=04H00 + 06H15');
console.log('QUESTIONS=5 BAREME=4 BILAN=INCHANGÉS');
