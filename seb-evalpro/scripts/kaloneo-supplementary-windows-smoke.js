'use strict';
// Cas entièrement fictif : aucun fichier d'exercice V1 n'est lu ni modifié.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Core=require('../../kaloneo/builder-core.js');
const {embedTestImages}=require('../src/kaloneo-test-portability.js');
const ROOT=path.resolve(__dirname,'..','..');
const image='data:image/svg+xml;base64,'+Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12"><rect width="12" height="12"/></svg>'
).toString('base64');
const windows=[
 {id:'f_plan_1',title:'Plan inventé',type:'image',imageData:image,imageName:'plan-fictif.svg',imageAlt:'Plan fictif',text:''},
 {id:'f_liste_2',title:'Liste des missions',type:'list',text:'Décharger\nVérifier\nRanger',imageData:'',imageName:''},
 {id:'f_table_3',title:'Inventaire',type:'table',text:'Référence;Quantité\nF001;8\nF002;12',imageData:'',imageName:''},
 {id:'f_texte_4',title:'Procédure complète',type:'text',text:'Étape 1\nÉtape 2\nLongue consigne',imageData:'',imageName:''}
];
const blockButtons=[
 {label:'Voir le plan',windowId:'f_plan_1',position:'before'},
 {label:'Consulter la liste',windowId:'f_liste_2',position:'after'},
 {label:'Consulter l’inventaire',windowId:'f_table_3',position:'after'},
 {label:'Lire la procédure',windowId:'f_texte_4',position:'after'}
];
const model={
 meta:{id:'documentaire_futur_inedit',title:'Dossier documentaire fictif',
   version:'1.0.0',category:'organisation',layout:'single',scored:true,
   scenario:'Situation fictive',instruction:'Répondre à la question'},
 blocks:[
  {uid:'bloc_alpha',type:'text',zone:'left',text:'Consultez le document.',
   supplementaryButtons:blockButtons},
  {uid:'bloc_beta',type:'question',zone:'left',
   question:{id:'rep_inedite',prompt:'Quel colis ranger ?',responseType:'text',
     acceptedAnswers:'F001',points:2},
   supplementaryButtons:[{label:'Rouvrir le plan',windowId:'f_plan_1',position:'after'}]}
 ],
 supplementaryWindows:windows
};
const created=Core.modelToDefinition(model);
assert(Core.analyzeDefinition(created).ok,JSON.stringify(Core.analyzeDefinition(created).errors));
assert.deepEqual(created.presentation.supplementaryWindows,windows);
assert.deepEqual(created.presentation.builderContent[0].supplementaryButtons,blockButtons);
assert.equal(created.presentation.builderContent[1].supplementaryButtons[0].windowId,'f_plan_1');
assert.equal(created.questions[0].id,'rep_inedite');
assert.equal(created.questions[0].points,2);
assert.deepEqual(created.questions[0].acceptedAnswers,['F001']);
const imported=Core.definitionToModel(created);
assert.deepEqual(imported.supplementaryWindows,windows);
assert.deepEqual(imported.blocks[0].supplementaryButtons,blockButtons);
assert.deepEqual(imported.blocks[1].supplementaryButtons,model.blocks[1].supplementaryButtons);
const reexported=Core.modelToDefinition(imported);
assert.deepEqual(reexported.presentation.supplementaryWindows,created.presentation.supplementaryWindows);
assert.deepEqual(reexported.presentation.builderContent,created.presentation.builderContent);
assert.deepEqual(reexported.questions,created.questions);
const portable=embedTestImages(reexported,path.join(ROOT,'seb-evalpro','source'));
assert.deepEqual(portable.definition.presentation.supplementaryWindows,windows);
assert.equal(portable.definition.presentation.supplementaryWindows[0].imageData,image);
const standalone=JSON.parse(JSON.stringify(portable.definition));
assert(Core.analyzeDefinition(standalone).ok,'JSON autonome non valide');
const oldModel=Core.definitionToModel(created);
delete oldModel.supplementaryWindows;
oldModel.blocks.forEach(block=>delete block.supplementaryButtons);
const oldDef=Core.modelToDefinition(oldModel);
assert.equal(Object.prototype.hasOwnProperty.call(oldDef.presentation,'supplementaryWindows'),false,
  'Les V1 sans document doivent rester sans nouvelle propriété');
assert(oldDef.presentation.builderContent.every(b=>!b.supplementaryButtons),
  'Un test ancien a reçu des boutons documentaires');
const builder=fs.readFileSync(path.join(ROOT,'kaloneo','test-builder.js'),'utf8');
const module=fs.readFileSync(path.join(ROOT,'kaloneo','supplementary-builder.js'),'utf8');
const html=fs.readFileSync(path.join(ROOT,'kaloneo','test-builder.html'),'utf8');
const candidate=fs.readFileSync(path.join(ROOT,'seb-evalpro','source','js','kaltest-pilot2-runtime.js'),'utf8');
for(const id of ['supplementary-main','supplementary-add','supplementary-thumbnails','supplementary-editor',
 'supplementary-title','supplementary-type','supplementary-text','supplementary-select-image',
 'supplementary-clear-image','supplementary-delete','supplementary-return','toggle-exercise-section']){
 assert(html.includes('id="'+id+'"'),'Bouton/champ absent: '+id);
}
for(const token of ['supplementaryWindows:state.supplementaryWindows','supplementaryWindows:Core.clone(state.supplementaryWindows)',
  'supplementaryWindows=Array.isArray(model.supplementaryWindows)',
  'Supplementary?.isEditing()','freeze:()=>invalidateMiniPreview()',
  "if(Supplementary?.isEditing())return;","state.imageLibraryTargetUid||'').startsWith('__supplementary__:')"]){
 assert(builder.includes(token),'Intégration Builder absente: '+token);
}
for(const token of ['function select(id){','function setImage(id,image){','addBlockControls',
  'hooks.documentChanged()','hooks.blockChanged()','window.KaloneoSupplementaryBuilder']){
 assert(module.includes(token),'Gestionnaire documentaire absent: '+token);
}
for(const token of ['dialog.showModal()','dialog.close()','supplementaryReturnFocus','renderBuilderContentWithDocuments',
  "windowId","kaltest-supplementary-dialog"]){
 assert(candidate.includes(token),'Affichage Electron absent: '+token);
}
assert(!candidate.includes('new BrowserWindow('),'Les documents doivent rester des dialogues Electron internes');
console.log('KALONEO_SUPPLEMENTARY_SMOKE: OK — 4 fenêtres, 5 boutons dans 2 blocs, image embarquée, import/export stable, V1 sans effet, capture suspendue');
