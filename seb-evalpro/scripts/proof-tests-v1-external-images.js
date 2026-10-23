'use strict';
// La comparaison s'effectue dans un dossier temporaire : aucun TESTS_V1
// source modifié et aucune image supprimée. Vérifie la portabilité des 5 V1.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const {extract,hydrate}=require('../src/kaloneo-v1-image-assets');
const repo=path.resolve(__dirname,'..','..');
const ids=['affiche_promotions_prix','calcul_arithmetique','organisation_demenagement','p','planning_cantine'];
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kaloneo-externalize-v1-'));
const assets=path.join(tmp,'bibliotheque-images');
const reports=[];
try{
  let duplicates=0;
  for(const id of ids){
    const original=JSON.parse(fs.readFileSync(path.join(repo,'TESTS_V1',id+'-1.0.0-test.json'),'utf8'));
    const moved=extract(original,assets);
    const recovered=hydrate(moved.definition,assets);
    const expected=JSON.parse(JSON.stringify(original));
    for(const entry of moved.usages){
      if(!entry.redundantName)continue;
      let node=expected;
      const keys=entry.property.split('.');
      for(const key of keys.slice(0,-1))node=node[key];
      node[keys.at(-1)]='image-'+entry.sha256.slice(0,12)+'.'+({ 'image/webp':'webp','image/png':'png','image/jpeg':'jpg','image/gif':'gif','image/svg+xml':'svg'})[entry.mime];
    }
    assert.deepEqual(recovered,expected,
      'Questions, barèmes, blocs ou images modifiés lors du stockage pour '+id);
    assert.deepEqual(moved.definition.questions,original.questions,'Barème/questions altérés '+id);
    const jsonBytes=Buffer.byteLength(JSON.stringify(moved.definition));
    const originalBytes=Buffer.byteLength(JSON.stringify(original));
    assert(jsonBytes<originalBytes/10,'Le JSON '+id+' devrait perdre au moins 90% de son poids');
    duplicates+=moved.usages.length-moved.addedCount;
    reports.push({id,jsonOriginalBytes:originalBytes,jsonLightBytes:jsonBytes,
      images:moved.usages.length,uniqueNew:moved.addedCount,
      filenamesFixed:moved.usages.filter(x=>x.redundantName).length});
  }
  const files=fs.readdirSync(assets);
  assert.equal(files.length,13,'Les cinq V1 contiennent 13 images uniques');
  assert.equal(duplicates,2,'Deux copies redondantes attendues');
  // Simulation transfert vers un autre PC : JSON sans images + fichiers de
  // la bibliothèque suffisent à reconstituer chaque image à l'identique.
  const remote=path.join(tmp,'second-pc-images');fs.cpSync(assets,remote,{recursive:true});
  for(const id of ids){
    const original=JSON.parse(fs.readFileSync(path.join(repo,'TESTS_V1',id+'-1.0.0-test.json'),'utf8'));
    const light=extract(original,assets).definition;
    assert.doesNotThrow(()=>hydrate(light,remote),'Transfert images échoué : '+id);
  }
  const original=reports.reduce((n,x)=>n+x.jsonOriginalBytes,0);
  const lighter=reports.reduce((n,x)=>n+x.jsonLightBytes,0);
  const assetsBytes=files.reduce((n,x)=>n+fs.statSync(path.join(assets,x)).size,0);
  console.log('KALONEO_V1_IMAGE_REFACTORED_PROOF='+JSON.stringify({originalBytes:original,lightJsonBytes:lighter,
    uniqueAssets:files.length,assetsBytes,duplicatesRemoved:duplicates,tests:reports}));
  console.log('KALONEO_V1_IMAGE_REFACTORED_PROOF=OK (sans toucher aux fichiers officiels)');
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
