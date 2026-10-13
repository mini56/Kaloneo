'use strict';
const fs=require('fs');
const path=require('path');
const assert=require('assert');
const root=path.resolve(__dirname,'..');
const source=relative=>fs.readFileSync(path.join(root,relative),'utf8');
const builder=source('../kaloneo/test-builder.js');
const preview=source('../kaloneo/test-preview.js');
const candidate=source('source/js/kaltest-pilot2-runtime.js');
const css=source('source/css/kaltest-pilot2.css');
const save=source('src/main.js');
const html=source('../kaloneo/test-builder.html');
const guide=source('../kaloneo/test-builder.css');
const previewHtml=source('../kaloneo/test-preview.html');
const candidatePage=source('source/kaltest-pilot2.html');
assert(previewHtml.includes('<script src="shared-presentation.js"></script>'),
  'Aperçu Electron autonome sans module commun');
assert(previewHtml.indexOf('shared-presentation.js')<previewHtml.indexOf('test-preview.js'),
  'Aperçu Electron : module commun chargé trop tard');
assert(preview.includes('KaloneoSharedPresentation.renderInlineFlow('),
  'Le texte à trous de l’aperçu Electron autonome doit utiliser le moteur partagé');
const sharedPresentation=require('../../kaloneo/shared-presentation.js');
const inlineDocument={
  createElement(tag){return {tagName:tag,children:[],textContent:'',className:'',
    appendChild(child){this.children.push(child);return child;},
    append(...children){this.children.push(...children);}};},
  createTextNode(value){return {tagName:'#text',textContent:value};}
};
const inlineResult=sharedPresentation.renderInlineFlow({
  doc:inlineDocument,wordBank:[],
  flow:[{type:'text',text:'Phrase inédite '},{type:'question',questionId:'q_new'}],
  omitEmptyBank:true,makeAnswer:id=>{const n=inlineDocument.createElement('input');n.placeholder=id;return n;}
});
assert.strictEqual(inlineResult.children.length,1,'Banque vide affichée dans l’aperçu historique');
assert.strictEqual(inlineResult.children[0].children[1]?.placeholder,'q_new');
assert(preview.includes('KaloneoSharedPresentation.renderZones('),
  'L’aperçu autonome doit partager le calcul des colonnes et la création des zones');
// Le calcul R48.10 n'est plus dupliqué : il est dans le module commun,
 // tandis que l'aperçu historique indépendant conserve sa fonction.
const common=source('../kaloneo/shared-presentation.js');
// Exercice fictif jamais ajouté au catalogue : les trois vues passent par le
// même constructeur HTML sans changer les configurations propres aux écrans.

assert.strictEqual(sharedPresentation.columns('single'),'minmax(0,1fr)');
assert.strictEqual(sharedPresentation.columns('50-50'),'minmax(0,1fr) minmax(0,1fr)');
assert.strictEqual(sharedPresentation.columns('40-60'),'minmax(0,40fr) minmax(0,60fr)');
assert.strictEqual(sharedPresentation.columns('60-40'),'minmax(0,60fr) minmax(0,40fr)');
assert.strictEqual(sharedPresentation.columns('chars-rest',
  {blocks:[{widthChars:24},{remainder:true}]}),'24ch minmax(0,1fr)');

const fakeDocument={createElement:tag=>({tagName:tag,className:'',sandbox:'',srcdoc:''})};
for(const type of ['html','html-js']){
  const script='document.body.dataset.example="nouveau";';
  const block={type,html:'<p>Exercice inédit</p>',js:script};
  const canonicalBlock={type,html:block.html,script};
  const builderFrame=sharedPresentation.renderHtmlFrame({
    doc:fakeDocument,block,className:'preview-html-frame'
  });
  const previewFrame=sharedPresentation.renderHtmlFrame({
    doc:fakeDocument,block,className:'kb-frame'
  });
  const candidateFrame=sharedPresentation.renderHtmlFrame({
    doc:fakeDocument,block:canonicalBlock,className:'kaltest-builder-html',
    sandbox:type==='html-js'?'allow-scripts':'',bodyStyle:'',emptyText:''
  });
  assert.strictEqual(builderFrame.sandbox,'allow-scripts');
  assert.strictEqual(previewFrame.sandbox,'allow-scripts');
  assert.strictEqual(candidateFrame.sandbox,type==='html-js'?'allow-scripts':'');
  assert.strictEqual(builderFrame.srcdoc,previewFrame.srcdoc);
  assert(builderFrame.srcdoc.includes('Exercice inédit'));
  assert(candidateFrame.srcdoc.includes('Exercice inédit'));
  assert(!candidateFrame.srcdoc.includes('font-family:Calibri'));
  assert.strictEqual(builderFrame.srcdoc.includes(script),type==='html-js');
  assert.strictEqual(candidateFrame.srcdoc.includes(script),type==='html-js');
}
const emptyHtml=sharedPresentation.renderHtmlFrame({
  doc:fakeDocument,block:{type:'html',html:''},bodyStyle:'',emptyText:'',sandbox:''
});
assert(emptyHtml.srcdoc.includes('<body></body>'));
const scriptEscaping=sharedPresentation.renderHtmlFrame({
  doc:fakeDocument,block:{type:'html-js',html:'',script:'var t="</script>";'}
});
assert(scriptEscaping.srcdoc.includes('<\\/script>'));
for(const [name,content] of [['Builder',builder],['aperçu',preview],['candidat',candidate]])
  assert(content.includes('KaloneoSharedPresentation.renderHtmlFrame('),'HTML commun absent : '+name);
// Le texte enrichi d'un nouveau KALTEST doit être identique dans les trois vues.
const mockDoc={
  createElement(tag){return {tagName:tag,children:[],style:{},
    appendChild(child){this.children.push(child);return child;},
    replaceChildren(...children){this.children=[...children];}};},
  createTextNode(value){return {tagName:'#text',textContent:value};}
};
const richHost=mockDoc.createElement('section');
richHost.ownerDocument=mockDoc;
sharedPresentation.renderRichContext(richHost,'[b]Gras [i]italique[/i][/b]\\n[c=#123456]couleur[/c] [u]souligné[/u]');
const serial=node=>node.tagName==='#text'?node.textContent:
  '<'+node.tagName+(node.style?.color?' color="'+node.style.color+'"':'')+'>'+
  (node.children||[]).map(serial).join('')+'</'+node.tagName+'>';
const serialized=serial(richHost);
for(const fragment of ['<strong>Gras <em>italique</em></strong>','<br></br>',
  '<span color="#123456">couleur</span>','<u>souligné</u>'])
  assert(serialized.includes(fragment),'Balisage commun absent : '+fragment);
sharedPresentation.renderRichContext(richHost,'[b]remplacé[/b]');
assert(!serial(richHost).includes('Gras'),'Le rendu commun doit remplacer et non accumuler');
for(const [screen,sourceText] of [['Builder',builder],['Aperçu',preview],['Candidat',candidate]]){
  assert(sourceText.includes('window.KaloneoSharedPresentation.renderRichContext'),
    'Moteur de texte partagé absent : '+screen);
  assert(!sourceText.includes('function renderRichContext('),
    'Ancien parser de texte encore dupliqué : '+screen);
}
// Même squelette d'en-têtes et de lignes, y compris pour un tableau totalement inédit.
const tableDoc={
  createElement(tag){return {tagName:tag,children:[],className:'',textContent:'',
    appendChild(node){this.children.push(node);return node;}};}
};
const tableDefinition={title:'Nouvelle matrice',headers:['Avant','Après'],
  questionIds:['unique_a','unique_b']};
const createTable=()=>sharedPresentation.renderQuestionTable({
  doc:tableDoc,definition:tableDefinition,
  wrapperClassName:'test-wrap',tableClassName:'test-table',
  questionById:id=>({id,prompt:'Ligne '+id}),
  renderCells:({doc,question})=>{
    const left=doc.createElement('td');left.textContent=question.prompt;
    const right=doc.createElement('td');right.textContent='Réponse';
    return [left,right];
  }
});
const novelTable=createTable();
const novelTableTag=novelTable.children.find(el=>el.tagName==='table');
assert.strictEqual(novelTableTag.children[0].tagName,'thead');
assert.deepStrictEqual(novelTableTag.children[0].children[0].children.map(c=>c.textContent),['Avant','Après']);
assert.strictEqual(novelTableTag.children[1].children.length,2);
assert.strictEqual(novelTableTag.children[1].children[1].children[0].textContent,'Ligne unique_b');
const emptyTable=sharedPresentation.renderQuestionTable({
  doc:tableDoc,definition:{headers:['Vide']},
  renderCells:()=>[],
  renderEmptyRow:({doc})=>{const td=doc.createElement('td');td.textContent='Sans réponse';return [td];}
});
assert.strictEqual(emptyTable.children[0].children[1].children.length,1);
assert(preview.includes('KaloneoSharedPresentation.renderQuestionTable('));
assert(source('../kaloneo/builder-legacy-table-preview.js').includes('KaloneoSharedPresentation.renderQuestionTable('));
// Grille inédite : structure partagée, titre contextuel et cellules masquées
// dans l'aperçu, sans changer la politique des cellules côté candidat.
const gridDoc={
  createElement(tag){
    return {tagName:tag,children:[],style:{},ownerDocument:gridDoc,className:'',
      textContent:'',classList:{items:[],add(...values){this.items.push(...values);}},
      appendChild(node){this.children.push(node);return node;}};
  }
};
const novelGrid=sharedPresentation.renderGridTable({
  doc:gridDoc,
  definition:{title:'Grille inconnue',headers:['A','B'],cols:2,
    cells:[[{kind:'fixed-text',value:'Visible'},{kind:'fixed-text',hidden:true,value:'Caché'}]]},
  className:'kb-table',wrapperClassName:'kb-block',titleTag:'div',
  titleClassName:'kb-question-label',skipHiddenCells:true,
  renderCell:({cell,cellDefinition})=>{cell.textContent=cellDefinition.value||'';}
});
assert.strictEqual(novelGrid.children[0].tagName,'div');
assert.strictEqual(novelGrid.children[0].textContent,'Grille inconnue');
const novelGridTable=novelGrid.children.find(n=>n.tagName==='table');
const novelGridBody=novelGridTable.children.find(n=>n.tagName==='tbody');
assert.strictEqual(novelGridBody.children.length,1);
assert.strictEqual(novelGridBody.children[0].children.length,1,'Cellule masquée dans aperçu');
assert.strictEqual(novelGridBody.children[0].children[0].textContent,'Visible');
// Tableau de réponses fictif : même squelette et aucun champ historique imposé.
const answerTable=sharedPresentation.renderResponseTable({
  doc:gridDoc,headers:['Question','Réponse'],rows:[{id:'q_future'}],columns:[],
  renderCell:({cell,row,colIndex})=>{cell.textContent=colIndex===0?row.id:'Réponse future';}
});
const answerStructure=answerTable.children.find(node=>node.tagName==='table');
const answerRows=answerStructure.children.find(node=>node.tagName==='tbody');
assert.strictEqual(answerRows.children.length,1);
assert.strictEqual(answerRows.children[0].children[1].textContent,'Réponse future');
const answerEmpty=sharedPresentation.renderResponseTable({
  doc:gridDoc,headers:['A'],rows:[],renderCell:()=>{},
  renderEmptyRow:({doc})=>{const td=doc.createElement('td');td.textContent='Aucune question';return [td];}
});
assert.strictEqual(answerEmpty.children[0].children[1].children.length,1);
assert(preview.includes('KaloneoSharedPresentation.renderResponseTable('),
  'Aperçu Electron : tableau de réponses non partagé');
// Une ressource nouvelle utilise le même constructeur sur les trois écrans.
assert(preview.includes('KaloneoSharedPresentation.renderMedia('),
  'Aperçu Electron : anciens médias dupliqués');
const mediaDoc={
  createElement(tag){return {tagName:tag,children:[],style:{},className:'',
    appendChild(child){this.children.push(child);return child;}};}
};
const futureImage=sharedPresentation.renderMedia({
  doc:mediaDoc,type:'image',resource:{data:'imageqcm/new-example.png',alt:'Image fictive'},
  style:{imageScale:65,imageAlign:'right'},
  resolveSource:path=>path.startsWith('imageqcm/')?'../'+path:path,
  className:'kb-block kb-media-block',imageClass:'kb-media'
});
assert.strictEqual(futureImage.children[0].src,'../imageqcm/new-example.png');
assert.strictEqual(futureImage.children[0].style.width,'65%');
assert.strictEqual(futureImage.style.justifyContent,'flex-end');
// Un énoncé inédit conserve le contenu du candidat et une étiquette de titre.
const questionDoc={
  createElement(tag){return {tagName:tag,className:'',children:[],textContent:'',
    append(...items){this.children.push(...items);},
    appendChild(node){this.children.push(node);return node;}};}
};
const freshQuestion=sharedPresentation.renderQuestion({
  doc:questionDoc,question:{id:'fresh_q_42',prompt:'Question totalement nouvelle'},
  rowTag:'div',captionClassName:'kb-question-label',
  makeAnswer:()=>questionDoc.createElement('input')
});
assert.strictEqual(freshQuestion.tagName,'div');
assert.strictEqual(freshQuestion.children[0].className,'kb-question-label');
assert.strictEqual(freshQuestion.children[0].textContent,'Question totalement nouvelle');
assert.strictEqual(freshQuestion.children[1].tagName,'input');
assert(preview.includes('KaloneoSharedPresentation.renderQuestion('),
  'Aperçu Electron : question générique encore dupliquée');
assert(common.includes('function equalAutomaticColumns('),'R48.10 function missing in shared presentation engine');
assert(preview.includes('KaloneoSharedPresentation.renderGridTable('),
  'Aperçu Electron autonome sans grille partagée');
assert(!preview.includes('function equalAutomaticColumns('),
  'Aperçu Electron conserve une copie de calcul des colonnes');
// Les deux écrans délèguent toute la grille au moteur partagé.
// C'est dans renderGridTable que sont appelés equalAutomaticColumns,
// addEqualColGroup et applyColumn : ne plus exiger d'appels dupliqués.
assert(common.includes('const equal=equalAutomaticColumns(definition);'),
  'R48.10 equal widths not applied by common grid renderer');
assert(common.includes('addEqualColGroup(table,equal);'),
  'R48.10 equal colgroup not applied in common grid');
assert(common.includes('applyColumn(th,definition.columns?.[index]);'),
  'R48.10 header dimensions not shared');
for(const [name,content] of [['Builder',builder],['candidate',candidate]]){
 assert(content.includes('window.KaloneoSharedPresentation.renderGridTable('),
   'R48.10 common grid rendering missing in '+name);
}
for(const item of ['preview-grid-equal-auto','builder-grid-width-explanation']){
 assert(builder.includes(item),'R48.10 Builder feature missing: '+item);
 assert(guide.includes(item),'R48.10 CSS missing: '+item);
}
assert(preview.includes('kb-grid-equal-auto'));
assert(candidate.includes('kaltest-builder-grid-equal-auto'));
assert(css.includes('.kaltest-builder-grid-equal-auto{'));
assert(!css.includes('body[data-seb-kaltest-id="planning_cantine_r48_demo"] .kaltest-builder-grid th:first-child'),'old Restaurant-only widths still active');
assert(builder.includes('function renderIconPicker'));
assert(builder.includes('function saveToLibrary'));
assert(html.includes('icon-picker'));
assert(candidatePage.includes('id="kaltest-test-icon"'));
assert(candidate.includes('testIcon.src = iconData'));
assert(candidate.includes("guard.className = 'kaltest-builder-background-text-guard'"),'R48.5 decorative image exclusion missing');
assert(css.includes('.kaltest-builder-background-text-guard {'),'R48.5 decorative exclusion CSS missing');
for(const item of ['kaltest-word-end-fill','typewriter-reference.png','#toolbar.kaltest-word-topbar','.toolbar-row2.kaltest-word-formatbar']){
 assert(css.includes(item)||candidate.includes(item),'NWTEXT R55 missing: '+item);
}
assert(candidate.includes('<div class="kaltest-word-end-fill" aria-hidden="true"></div>'));
for(const item of ['kaloneo-transfer:export-test','kaloneo-transfer:import-test','embedTestImages','validatePortableTest']){
 assert(save.includes(item),'Test portability missing: '+item);
}
for(const item of ['candidate-catalog','kaloneo-bilan','kaloneo-selected-parcours']){
 assert(fs.existsSync(path.join(root,'scripts',item+'-smoke.js'))||
   fs.readdirSync(path.join(root,'scripts')).some(x=>x.includes(item)),'Missing smoke family: '+item);
}
console.log('KALONEO_CONSOLIDATED_GUARD: OK R33/R48.10/NWTEXT-R55/icon/transfer');
