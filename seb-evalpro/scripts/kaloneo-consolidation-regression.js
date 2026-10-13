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
const candidatePage=source('source/kaltest-pilot2.html');
// Le calcul R48.10 n'est plus dupliqué : il est dans le module commun,
 // tandis que l'aperçu historique indépendant conserve sa fonction.
const common=source('../kaloneo/shared-presentation.js');
// Les blocs HTML et HTML/JS passent par le même iframe sandboxé
// sans modifier le contenu ni les classes de présentation propres aux deux vues.
const sharedPresentation=require('../../kaloneo/shared-presentation.js');
const fakeDocument={createElement:tag=>({tagName:tag,className:'',sandbox:'',srcdoc:''})};
for(const type of ['html','html-js']){
  const block={type,html:'<p>Exercice inédit</p>',js:'document.body.dataset.test="ok";'};
  const builderFrame=sharedPresentation.renderHtmlFrame({
    doc:fakeDocument,block,className:'preview-html-frame'
  });
  const candidateFrame=sharedPresentation.renderHtmlFrame({
    doc:fakeDocument,block,className:'kb-frame'
  });
  assert.strictEqual(builderFrame.tagName,'iframe');
  assert.strictEqual(builderFrame.sandbox,'allow-scripts');
  assert.strictEqual(candidateFrame.sandbox,'allow-scripts');
  assert.strictEqual(builderFrame.srcdoc,candidateFrame.srcdoc);
  assert(builderFrame.srcdoc.includes('Exercice inédit'));
  assert.strictEqual(builderFrame.srcdoc.includes('document.body.dataset.test'),type==='html-js');
}
assert(builder.includes('KaloneoSharedPresentation.renderHtmlFrame('));
assert(preview.includes('KaloneoSharedPresentation.renderHtmlFrame('));
assert(common.includes('function equalAutomaticColumns('),'R48.10 function missing in shared presentation engine');
assert(preview.includes('function equalAutomaticColumns('),'R48.10 function missing in standalone preview');
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
