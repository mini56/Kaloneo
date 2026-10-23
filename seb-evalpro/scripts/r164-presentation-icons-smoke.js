'use strict';
// R164 : contrôles des pages sans notation, de l'affichage et des icônes, sans toucher aux V1.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const Core=require('../../kaloneo/builder-core');
const {createKaloneoLibrary}=require('../src/kaloneo-library-main');
const icons=require('../src/kaloneo-default-test-icons');
const root=path.resolve(__dirname,'..');
const files=(p)=>fs.readFileSync(path.resolve(root,p),'utf8');
for(const [role,category] of [['introduction','introduction'],['fin','fin']]){
  const meta={id:'r164_page_'+role,version:'1.0.0',title:'Page '+role,category,
    scored:false,scenario:'texte historique à ignorer',instruction:'consigne historique à ignorer',
    layout:'single',outputs:[{id:'status',type:'string'}],bilanContributions:[]};
  const def=Core.modelToDefinition({meta,blocks:[{uid:'texte-1',type:'text',zone:'left',text:'Bienvenue'}],supplementaryWindows:[]});
  assert.equal(def.pageRole,role);
  assert.equal(def.scored,false);
  assert.equal(def.scenario,'');assert.equal(def.instruction,'');
  assert.deepEqual(def.bilanContributions,[]);
  assert.equal(def.questions.length,0);
  assert.equal(def.behavior?.hideNavigation,undefined);
  assert.equal(def.behavior?.hideContext,true);
  assert.equal(def.behavior?.terminal===true,role==='fin');
  assert(Core.analyzeDefinition(def).ok);
  const round=Core.modelToDefinition(Core.definitionToModel(def));
  assert.equal(round.pageRole,role);
}
const builder=files('../kaloneo/test-builder.js');
const html=files('../kaloneo/test-builder.html');
const candidate=files('source/js/kaltest-pilot2-runtime.js');
const preview=files('../kaloneo/test-preview.js');
for(const marker of ['builder-exercise-context-fields','builder-preview-context','builder-preview-heading','builder-block-heading','builder-scoring-field','builder-layout-caption'])assert(html.includes(marker));
assert(builder.includes('syncPresentationMode(specialPage)'));
assert(candidate.includes('seb-kaltest-builder-presentation'));
assert(candidate.includes("testIcon.src='kaloneo-builder/icons-tests/'"),'Fallback icône candidat absent');
assert(candidate.includes('puis validez votre saisie avec la touche ENTRÉE'));
assert(candidate.includes("if(customBuilderPage)return true;"));
assert(preview.includes("if(!presentation){contexts.append"));
assert(files('build/installer.nsh').includes('ShowInstDetails show'));
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'kaloneo-r164-icons-'));
try{
  const lib=createKaloneoLibrary({dataRoot:temp,seedTestsRoot:path.join(root,'app','web','kaltest','tests')});
  const tests=lib.listTests();
  assert(tests.length>=24,'Catalogue KALTEST incomplet');
  for(const t of tests){
    assert(t.icon?.data?.startsWith('data:image/'),t.id+' : icône absente du catalogue');
    // La bibliothèque restitue des métadonnées d'icône sans altérer la V1.
    // Ne pas hydrater des images V1 compactées sans leur banque de médias,
    // ce qui testerait un faux environnement et non l'installateur réel.
    const sourceDefinition={id:t.id,category:t.category,icon:t.icon};
    const displayed=icons.iconForDefinition(sourceDefinition);
    assert(displayed?.data?.startsWith('data:image/'),t.id+' : aucune icône candidate disponible');
  }
  const seed=path.join(root,'source','kaltest','tests','tri-chevilles','1.0.0','test.json');
  const original=JSON.parse(fs.readFileSync(seed,'utf8'));
  assert(!original.instruction.includes('touche ENTRÉE'),'La V1 protégée ne doit pas être modifiée');
  for(const name of Object.values(icons.byId)){
    assert(fs.existsSync(path.resolve(root,'app','web','kaloneo-builder','icons-tests',name+'.png')),name+' doit appartenir à la bibliothèque');
  }
  console.log('KALONEO_R164_PRESENTATIONS_ICONES=OK; '+tests.length+' tests et pages vérifiés');
}finally{fs.rmSync(temp,{recursive:true,force:true});}
