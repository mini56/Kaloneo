'use strict';

const fs=require('fs');
const os=require('os');
const path=require('path');
const { createKaloneoLibrary }=require('../src/kaloneo-library-main');

function fail(message,detail){
  console.error('KALONEO_ERGONOMICS_LIBRARY: FAIL — '+message);
  if(detail)console.error(JSON.stringify(detail,null,2));
  process.exit(2);
}

const root=path.resolve(__dirname,'..');
const seedTestsRoot=path.join(root,'source','kaltest','tests');
const tempA=fs.mkdtempSync(path.join(os.tmpdir(),'kaloneo-ergo-a-'));
const tempB=fs.mkdtempSync(path.join(os.tmpdir(),'kaloneo-ergo-b-'));

try{
  const lib=createKaloneoLibrary({dataRoot:tempA,seedTestsRoot});
  const system=lib.listTests();
  const intro=system.find(item=>item.role==='introduction');
  const fin=system.find(item=>item.role==='fin');
  const seeded=system.find(item=>item.role==='test'&&item.protectedVersion===true);
  if(!intro||!fin||!seeded)fail('pages système requises absentes',{intro,fin,seeded});

  const custom={
    kaltestFormat:1,
    id:'test_ergonomie_suppression',
    version:'1.0.0',
    title:'Test ergonomie suppression',
    category:'mathematiques',
    pageRole:'test',
    scored:true,
    outputs:[{id:'score',type:'number'},{id:'score_max',type:'number'}],
    bilanContributions:[{lineId:'bilan.savoirs_fondamentaux.mathematiques.resoudre_problemes',
      bindings:{score:'score',score_max:'score_max'}}],
    scenario:'Scénario',
    instruction:'Consigne',
    questions:[{
      id:'q1',
      prompt:'1 + 1 =',
      response:{type:'number'},
      acceptedAnswers:['2'],
      points:1
    }],
    presentation:{
      layout:'single',
      builderContent:[{type:'question',zone:'left',questionId:'q1'}]
    }
  };

  let saved=lib.saveTest(custom,{overwrite:false});
  if(!saved.ok)fail('création test personnalisé impossible',saved);
  let deleted=lib.deleteTest(custom.id,custom.version);
  if(!deleted.ok)fail('suppression d’un test libre impossible',deleted);

  saved=lib.saveTest(custom,{overwrite:false});
  if(!saved.ok)fail('recréation test personnalisé impossible',saved);

  const parcoursSaved=lib.saveParcours({
    name:'Parcours ergonomie suppression',
    creator:'Smoke R31',
    introduction:{id:intro.id,version:intro.version},
    tests:[{id:custom.id,version:custom.version}],
    fin:{id:fin.id,version:fin.version},
    maskScreen:lib.defaultMaskRef()
  });
  if(!parcoursSaved.ok)fail('création parcours de référence impossible',parcoursSaved);

  const blocked=lib.deleteTest(custom.id,custom.version);
  if(blocked.ok||blocked.code!=='IN_USE'||!blocked.usages?.some(item=>item.name==='Parcours ergonomie suppression')){
    fail('test utilisé dans un parcours non protégé',blocked);
  }

  const protectedDelete=lib.deleteTest(seeded.id,seeded.version);
  if(protectedDelete.ok||protectedDelete.code!=='PROTECTED'){
    fail('test fourni KALONÉO non protégé',protectedDelete);
  }

  const packaged=lib.buildParcoursPackage(parcoursSaved.parcours.id);
  if(!packaged.ok||packaged.package?.format!=='kaloneo-parcours-package'||
     !packaged.package.definitions?.some(def=>def.id===custom.id)){
    fail('paquet autonome de parcours incorrect',packaged);
  }

  const lib2=createKaloneoLibrary({dataRoot:tempB,seedTestsRoot});
  const imported=lib2.importParcoursPackage(packaged.package);
  if(!imported.ok)fail('réimport du paquet parcours impossible',imported);

  const importedTest=lib2.getTest(custom.id,custom.version);
  const importedParcours=lib2.listParcours().find(item=>item.name==='Parcours ergonomie suppression');
  if(!importedTest.ok||!importedParcours){
    fail('contenu du paquet non restauré',{importedTest,importedParcours});
  }

  console.log('KALONEO_ERGONOMICS_LIBRARY=OK');
  console.log(JSON.stringify({
    deletionFree:true,
    inUseBlocked:true,
    seedProtected:true,
    packageDefinitions:packaged.package.definitions.length,
    importedParcours:importedParcours.name
  }));
}finally{
  try{fs.rmSync(tempA,{recursive:true,force:true});}catch(_){}
  try{fs.rmSync(tempB,{recursive:true,force:true});}catch(_){}
}
