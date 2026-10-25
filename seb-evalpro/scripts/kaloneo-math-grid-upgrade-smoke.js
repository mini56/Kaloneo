'use strict';
// Simule une R174 déjà installée : les deux anciennes V1 sont sur disque,
// et non directement chargées du JSON GitHub comme les tests précédents.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const assert=require('node:assert/strict');
const {createKaloneoLibrary}=require('../src/kaloneo-library-main.js');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kaloneo-math-grids-upgrade-'));
const root=path.resolve(__dirname,'..');
const bundled=path.join(root,'app','web','kaltest','tests');
const target=path.join(tmp,'KALONEO','Bibliotheque-tests');
const definitions=[
 {id:'grille_operations',dir:'grille-operations',image:'grille-operations-adultes.png'},
 {id:'carre_magique_15',dir:'carre-magique-15',image:'carre-magique-15-adultes.png'}
];
try{
 for(const entry of definitions){
  const p=path.join(target,entry.dir,'1.0.0','test.json');
  const source=JSON.parse(fs.readFileSync(path.join(bundled,entry.dir,'1.0.0','test.json'),'utf8'));
  // État R174 visible sur la capture : grille dans les 40% à gauche,
  // panneau de droite vide (ancienne V1 locale prioritaire).
  source.presentation.builderContent=[
    {...source.presentation.builderContent[1],zone:'left'}
  ];
  fs.mkdirSync(path.dirname(p),{recursive:true});
  fs.writeFileSync(p,JSON.stringify(source,null,2));
 }
 // Un test extérieur doit rester 100% inchangé lors du démarrage.
 const separate=path.join(target,'ne-pas-toucher','1.0.0','test.json');
 fs.mkdirSync(path.dirname(separate),{recursive:true});
 fs.writeFileSync(separate,JSON.stringify({id:'ne_pas_toucher',version:'1.0.0',notes:'ADMIN'}));
 const untouched=fs.readFileSync(separate,'utf8');
 const library=createKaloneoLibrary({dataRoot:tmp,seedTestsRoot:bundled});
 for(const entry of definitions){
  const file=path.join(target,entry.dir,'1.0.0','test.json');
  const updated=JSON.parse(fs.readFileSync(file,'utf8'));
  const parts=updated.presentation?.builderContent;
  assert.equal(updated.id,entry.id);
  assert.equal(updated.presentation.layout,'40-60');
  assert.equal(parts.length,2);
  assert.equal(parts[0].type,'image');
  assert.equal(parts[0].zone,'left');
  assert.equal(parts[0].resource.data,'bibliotheque-images/'+entry.image);
  assert.equal(parts[1].type,'table-grid');
  assert.equal(parts[1].zone,'right');
  const image=path.join(root,'app','web','bibliotheque-images',entry.image);
  assert(fs.statSync(image).size>100000,'Image absente du Setup : '+image);
  console.log('KALONEO_GRID_UPGRADE_'+entry.id+'=OK');
 }
 assert.equal(fs.readFileSync(separate,'utf8'),untouched,'Autre test remplacé');
 // Une édition Admin de la V1 ne doit pas être écrasée sans accord.
 const protectedDef=JSON.parse(fs.readFileSync(path.join(bundled,'grille-operations','1.0.0','test.json'),'utf8'));
 protectedDef.kaloneoLibrary={adminModified:true};
 protectedDef.presentation.builderContent[0].resource.name='image personnelle';
 const protectedPath=path.join(target,'grille-operations','1.0.0','test.json');
 fs.writeFileSync(protectedPath,JSON.stringify(protectedDef,null,2));
 // Deuxième processus / deuxième démarrage : re-synchronise les systèmes.
 createKaloneoLibrary({dataRoot:tmp,seedTestsRoot:bundled});
 assert.equal(JSON.parse(fs.readFileSync(protectedPath,'utf8')).presentation.builderContent[0].resource.name,'image personnelle');
 console.log('KALONEO_GRID_UPGRADE_PRESERVE_ADMIN_AND_OTHERS=SUCCESS');
}finally{fs.rmSync(tmp,{recursive:true,force:true})}
