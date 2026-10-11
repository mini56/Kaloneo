'use strict';
const assert=require('assert');
const path=require('path');
const Core=require(path.resolve(__dirname,'../../kaloneo/builder-core.js'));
const meta={title:'Test modifié',id:'test_modifie',version:'1.0.0',category:'mathematiques',
  scored:false,layout:'50-50',scenario:'Scénario',instruction:'Consigne',
  icon:{id:'icone-validee',label:'Icône retenue',data:'data:image/png;base64,AA=='}
};
const model={meta,blocks:[
  {uid:'texte',type:'text',zone:'left',text:'Texte du test'},
  {uid:'image-vide',type:'image',zone:'right',mediaData:'',mediaName:'',mediaPlaceholder:''}
]};
const definition=Core.modelToDefinition(model);
assert(Core.analyzeDefinition(definition).ok,'Contrat KALTEST invalide après suppression de la ressource vide');
assert.strictEqual(definition.presentation.builderContent.length,1,'Bloc média vide non retiré de la définition');
assert.strictEqual(definition.presentation.builderContent[0].type,'text');
assert.deepStrictEqual(definition.icon,meta.icon,'Icône perdue pendant la sauvegarde');
assert.strictEqual(model.blocks.length,2,'Brouillon destructivement modifié');
const withImage=Core.modelToDefinition({...model,blocks:[model.blocks[0],{
  type:'image',zone:'right',mediaName:'photo.png',mediaData:'data:image/png;base64,AA==',
  mediaPlaceholder:'',mediaAlt:'Image enregistrée'}]});
assert(Core.analyzeDefinition(withImage).ok,'Image embarquée invalide');
assert.strictEqual(withImage.presentation.builderContent.length,2);
assert.strictEqual(withImage.presentation.builderContent[1].resource.data,'data:image/png;base64,AA==');
const placeholder=Core.modelToDefinition({...model,blocks:[model.blocks[0],{
  type:'image',zone:'right',mediaPlaceholder:'Image à compléter'}]});
assert(Core.analyzeDefinition(placeholder).ok,'Emplacement déclaré rejeté');
assert.strictEqual(placeholder.presentation.builderContent[1].resource.placeholder,'Image à compléter');
console.log('KALONEO_BUILDER_MEDIA_ICON_SAVE: OK');
