'use strict';

const fs=require('fs');
const path=require('path');

const sebRoot=path.resolve(__dirname,'..');
const repoRoot=path.resolve(sebRoot,'..');
const builderRoot=path.join(repoRoot,'kaloneo');
const capabilitiesPath=path.join(builderRoot,'kaloneo-capabilities.json');
const archetypeRegistryPath=path.join(builderRoot,'archetype-registry.json');
const corePath=path.join(builderRoot,'builder-core.js');

function fail(message,detail){
  console.error('KALONEO_BUILDER_PARITY: FAIL — '+message);
  if(detail) console.error(detail);
  process.exit(2);
}
function read(file){
  if(!fs.existsSync(file)) fail('fichier absent: '+path.relative(repoRoot,file));
  return fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');
}
function json(file){
  try{return JSON.parse(read(file));}catch(error){fail('JSON invalide: '+path.relative(repoRoot,file),error.message);}
}
function normalize(value){
  if(Array.isArray(value)) return value.map(normalize);
  if(value&&typeof value==='object'){
    const out={};
    Object.keys(value).sort().forEach(k=>{
      if(value[k]!==undefined) out[k]=normalize(value[k]);
    });
    return out;
  }
  return value;
}

const capabilities=json(capabilitiesPath);
const archetypeRegistry=json(archetypeRegistryPath);
const Core=require(corePath);

if(typeof Core.clearMediaBlock!=='function') fail('opération Retirer le média absente du Builder Core');
const mediaProof={
  uid:'media_block_keep',type:'image',zone:'left',
  mediaName:'ancienne.png',mediaType:'image/png',mediaData:'data:image/png;base64,AA==',
  mediaAlt:'ancienne image',mediaPlaceholder:'Image verticale',
  unrelated:'doit-rester'
};
Core.clearMediaBlock(mediaProof);
if(mediaProof.uid!=='media_block_keep'||mediaProof.type!=='image'||mediaProof.zone!=='left'||mediaProof.unrelated!=='doit-rester') {
  fail('retirer un média modifie la structure du bloc');
}
if(mediaProof.mediaName||mediaProof.mediaType||mediaProof.mediaData||mediaProof.mediaAlt||mediaProof.mediaPlaceholder) {
  fail('retirer un média ne vide pas uniquement les données média');
}

if(capabilities.compiledWithSebEvalPro!==true) fail('la compilation commune KALONÉO / SEB EvalPro n’est pas déclarée');
if(capabilities.tables?.gridMode!==true) fail('bloc Tableau / Grille absent');
if(!(capabilities.questionResponseTypes||[]).includes('free-text')||capabilities.questionRules?.freeTextManualEvaluation!==true) fail('réponse texte libre / évaluation Administrateur absente');
if(capabilities.maskScreens?.defaultId!=='kaloneo-default'||capabilities.maskScreens?.defaultWhenUnset!==true||capabilities.maskScreens?.closeLabel!=='Masquer l’écran d’accueil') fail('contrat Écrans de masquage incomplet');
if(capabilities.tables?.questionCellAcceptedAnswers!==true) fail('réponse attendue par cellule absente');
if(capabilities.tables?.columnWidthCharacters!==true) fail('largeur de colonne en caractères absente');
if(capabilities.tables?.lastColumnUsesRemainder!==true) fail('dernière colonne = reste disponible absent');
if(capabilities.chrono?.singleCommonEngine!=='js/kaloneo-chrono.js') fail('compteur commun KALONÉO non déclaré');
if(capabilities.chrono?.displayFontSizePx!==44) fail('taille commune du compteur différente de 44 px');
if(capabilities.textEditor?.supported!==true) fail('Éditeur de texte KALONÉO non déclaré');
if(capabilities.textEditor?.sharedEngine!=='js/nwtexte-quill-engine.js') fail('moteur partagé de l’Éditeur de texte incorrect');
if(capabilities.textEditor?.fileDialogsInternal!==true||capabilities.textEditor?.imageDialogsInternal!==true) fail('les dialogues Éditeur doivent rester internes à SEB EvalPro');
if(capabilities.navigation?.normalNextLabel!=='Suivant') fail('libellé Suivant non canonique');
if(capabilities.navigation?.stableBarGlobalRelabelingForbidden!==true) fail('protection de la barre stable absente');
if(capabilities.context?.textStartsOnSameLine!==true) fail('règle Scénario/Consigne sur la même ligne absente');
if(capabilities.allValidatedArchetypesMustCompile!==true) fail('la parité de tous les archétypes validés n’est pas bloquante');
if(capabilities.codeQuality?.noCssMaskingAsImplementation!==true) fail('interdiction du masquage CSS non enregistrée');
if(capabilities.codeQuality?.commonComponentsSharedWithSebEvalPro!==true) fail('composants communs non déclarés partagés avec SEB EvalPro');
if(archetypeRegistry.common?.noPatchMasking!==true) fail('registre archétypes: masquage/patch non interdit');
if(archetypeRegistry.common?.navigation?.heightPx!==52) fail('registre archétypes: barre commune différente de 52 px');
if(archetypeRegistry.common?.chrono?.displayFontSizePx!==44) fail('registre archétypes: compteur commun différent de 44 px');

const builderHtml=read(path.join(builderRoot,'test-builder.html'));
const builderJs=read(path.join(builderRoot,'test-builder.js'));
const previewHtml=read(path.join(builderRoot,'test-preview.html'));
const previewJs=read(path.join(builderRoot,'test-preview.js'));
const builderCss=read(path.join(builderRoot,'test-builder.css'));
const previewCss=read(path.join(builderRoot,'test-preview.css'));
const kaltestCss=read(path.join(sebRoot,'source','css','kaltest-pilot2.css'));
const sharedCalculator=read(path.join(sebRoot,'source','js','seb-floating-calculator.js'));
const kaltestRuntime=read(path.join(sebRoot,'source','js','kaltest-pilot2-runtime.js'));
const prepare=read(path.join(sebRoot,'scripts','prepare-web.js'));
const admin=read(path.join(sebRoot,'overrides','admin-tests-parcours.html'));
const adminJs=read(path.join(sebRoot,'source','js','admin-tests-parcours.js'));
const main=read(path.join(sebRoot,'src','main.js'));
const preload=read(path.join(sebRoot,'src','preload.js'));
const kaloneoLibrary=read(path.join(sebRoot,'src','kaloneo-library-main.js'));
const maskBuilderHtml=read(path.join(sebRoot,'overrides','admin-mask-builder.html'));
const maskBuilderJs=read(path.join(sebRoot,'source','js','admin-mask-builder.js'));
const transferHtml=read(path.join(sebRoot,'overrides','admin-kaloneo-transfer.html'));
const transferJs=read(path.join(sebRoot,'source','js','admin-kaloneo-transfer.js'));


// Contrat d'ergonomie validé : les images ne doivent jamais créer deux choix
// concurrents dans un bloc Image. Les contrôles avancés du fond restent facultatifs.
for(const token of ['id="image-library-import-pc"','id="image-library-pc-file"']){
  if(!builderHtml.includes(token))fail('Import image PC depuis la bibliothèque absent : '+token);
}
for(const token of ['function importImageFromPc()','async function importImages(files)',
  'function appendImageScaleControls(','row.replaceChildren(background)',
  'choose-library-image','choose-background-image']){
  if(!builderJs.includes(token))fail('Builder image simplifié absent : '+token);
}
if(builderJs.includes("if(block.type==='image')label.hidden=true") ||
   builderJs.includes("className='field-row image-scale-controls'")){
  fail('Ancien sélecteur Image masqué ou doubles dispositions CSS réintroduits.');
}
if(!Core.definitionToModel||!Core.modelToDefinition)fail('Aller-retour Builder indisponible');
for(const token of ["imageAlign=['left','right']","style.imageAlign=block.imageAlign"]){
  if(!read(path.join(builderRoot,'builder-core.js')).includes(token))
    fail('Alignement des images non sauvegardé par le Builder : '+token);
}

for(const token of [
  'builder-core.js','table-grid','Gratte-ciel 6 × 6','value="text-editor"',
  'value="chars-rest"','id="block1-width-chars"','id="last-block-remainder"',
  'id="calculator-brand"','Bibliothèque de tests','id="undo-change"','id="redo-change"',
  'Nouveau test','Enregistrer','>Fermer</button>','candidate-preview-viewport','>Aperçu</button>'
]) if(!builderHtml.includes(token)) fail('Builder UI incomplet: '+token);

for(const obsolete of ['id="import-json"','id="download-json"','id="refresh-preview"','id="preview-calculator"','class="preview-footer"','id="open-image-library"']){
  if(builderHtml.includes(obsolete)) fail('Builder R31 encore encombré par une commande obsolète: '+obsolete);
}

for(const token of [
  "Core.createGridBlock(6,6)","acceptedAnswers=answers","response-table","inline-flow","multiple-tables","text-editor",
  "Core.modelToDefinition","Core.analyzeDefinition","Core.clearMediaBlock","remove-media",
  "Retirer uniquement","Supprimer le bloc complet"
]) if(!builderJs.includes(token)) fail('Builder V2 incomplet: '+token);

for(const token of ['../js/seb-floating-calculator.js','id="calc-container"']){
  if(!previewHtml.includes(token)) fail('Aperçu Electron sans calculatrice commune: '+token);
}
if(!(previewJs.includes("data-seb-action") || previewJs.includes("dataset.sebAction")) ||
   !previewJs.includes("setCalculatorBrand")) {
  fail('Aperçu Electron non raccordé à la calculatrice commune KALONÉO');
}
if(!sharedCalculator.includes("brand.textContent = 'KALONÉO'") ||
   !sharedCalculator.includes('window.setCalculatorBrand') ||
   sharedCalculator.includes("brand.textContent = 'Sauvegarde 56'")) {
  fail('Calculatrice commune: marque KALONÉO par défaut non verrouillée');
}
if(!kaltestRuntime.includes("test.calculator?.brandLabel ?? 'KALONÉO'")) {
  fail('Runtime KALTEST: libellé de calculatrice configurable absent');
}

for(const token of ["params.get('resume') === 'preview'","focusTitleField","startNewTest"]) {
  if(!builderJs.includes(token)) fail('Test Builder R3 incomplet: '+token);
}
for(const token of ["Texte libre — évaluation Administrateur","saveToLibrary","kaloneoSaveTest"]) {
  if(!builderJs.includes(token)) fail('Test Builder R4 incomplet: '+token);
}
for(const token of ["undoChange","redoChange","confirmDiscardChanges","event.key","SAVED_FINGERPRINT_KEY"]) {
  if(!builderJs.includes(token)) fail('Historique ergonomique R32 incomplet: '+token);
}
for(const token of ["saveTest","listMaskScreens","saveMaskScreen","Ecrans-masquage","kaloneo-default"]) {
  if(!kaloneoLibrary.includes(token)) fail('Bibliothèque R4 incomplète: '+token);
}
for(const token of ["kaloneo-library:save-test","kaloneo-library:list-mask-screens","kaloneo-library:save-mask-screen"]) {
  if(!main.includes(token)) fail('IPC R4 absent: '+token);
}
for(const token of ["kaloneoSaveTest","kaloneoListMaskScreens","kaloneoSaveMaskScreen","MASK_REF_KEY"]) {
  if(!preload.includes(token)) fail('Preload R4 absent: '+token);
}
if(!maskBuilderHtml.includes('Écrans de masquage')||!maskBuilderJs.includes('kaloneoSaveMaskScreen')) fail('éditeur Écrans de masquage absent');
if(!transferHtml.includes('KALONÉO — Import / Export')||
   !transferHtml.includes('Exporter le test')||
   !transferHtml.includes('Importer un test')||
   !transferHtml.includes('Exporter le parcours')||
   !transferHtml.includes('Importer un parcours')||
   !transferHtml.includes('Importer des images')||
   !transferHtml.includes('Importer un ZIP par thèmes')||
   !transferHtml.includes('>Fermer</button>')||
   transferHtml.includes('Exporter l’image')||
   transferHtml.includes('class="note"')||
   !transferJs.includes('kaloneoExportTest')||
   !transferJs.includes('kaloneoImportParcours')||
   transferJs.includes('kaloneoExportImage')||
   !transferJs.includes('kaloneoSaveImage')||
   !transferJs.includes('kaloneoImportImageZip')){
  fail('page Import / Export KALONÉO R33 incomplète');
}
if(!admin.includes('open-kaloneo-transfer')||!adminJs.includes("admin-kaloneo-transfer.html")){
  fail('Tests / Parcours n’ouvre pas la page Import / Export');
}
for(const token of ['kaloneo-transfer:export-test','kaloneo-transfer:import-test','kaloneo-transfer:export-parcours','kaloneo-transfer:import-parcours']){
  if(!main.includes(token)) fail('IPC Import / Export R33 absent: '+token);
}
if(main.includes('kaloneo-transfer:export-image')) fail('IPC export image R33 doit être supprimé');
for(const token of ['kaloneoExportTest','kaloneoImportTest','kaloneoExportParcours','kaloneoImportParcours']){
  if(!preload.includes(token)) fail('Preload Import / Export R33 absent: '+token);
}
if(preload.includes('kaloneoExportImage')) fail('Bridge export image R33 doit être supprimé');
if(!main.includes("query:{ resume:'preview' }")) {
  fail('Retour aperçu R3 sans reprise explicite du brouillon');
}
for(const token of ['overflow-y:auto','scrollbar-gutter:stable','preview-media-block']) {
  if(!builderCss.includes(token)) fail('Scroll / média Builder R3 absent: '+token);
}
for(const token of ['PILOTE 22 R3','width:auto','height:auto','max-height:100%']) {
  if(!previewCss.includes(token)) fail('Aperçu Electron R3 sans média borné: '+token);
  if(!kaltestCss.includes(token)) fail('Runtime KALTEST R3 sans média borné: '+token);
}

if(!prepare.includes("copyTree(kaloneoBuilderDir,path.join(outputDir,'kaloneo-builder'))")) {
  fail('prepare:web ne compile pas le générateur KALONÉO');
}
for(const compiled of ['test-builder.html','test-builder.js','builder-core.js','kaloneo-capabilities.json','archetype-registry.json']){
  if(!fs.existsSync(path.join(sebRoot,'app','web','kaloneo-builder',compiled))) {
    fail('fichier KALONÉO absent du produit compilé: '+compiled);
  }
}
if(!admin.includes('open-kaloneo-builder')||!adminJs.includes("kaloneo-builder/test-builder.html")) {
  fail('Tests / Parcours n’ouvre pas KALONÉO');
}
if(!main.includes("isAdminKaloneoBuilderPage")||!main.includes("'test-builder.html'")) {
  fail('le Builder KALONÉO n’est pas protégé comme page Administrateur');
}


const builderBlockOptions=new Set(Array.from(builderHtml.matchAll(/<option\s+value="([^"]+)"/g)).map(match=>match[1]));
const declaredBlocks=new Set(capabilities.contentBlocks||[]);
const blockAliases=new Map([['multiple-tables','multiple-tables'],['table-definition','multiple-tables']]);

function capabilityAvailable(name){
  if(name==='calculator') return capabilities.calculator?.singleHostCalculator===true;
  if(name==='chrono') return capabilities.chrono?.singleCommonEngine==='js/kaloneo-chrono.js';
  if(name==='autoevaluation') return capabilities.autoevaluation?.supported===true;
  if(name==='admin-intervention') return capabilities.adminIntervention?.supported===true;
  if(name==='external-material') return capabilities.externalMaterial?.supported===true;
  if(name==='duration') return (capabilities.questionResponseTypes||[]).includes('duration');
  return true;
}

function proofBlock(type,index){
  const zone=index%2===0?'left':'right';
  if(type==='text') return {uid:'proof_text_'+index,type,zone,text:'Contenu de contrôle KALONÉO'};
  if(type==='html') return {uid:'proof_html_'+index,type,zone,html:'<p>Contenu KALONÉO</p>'};
  if(type==='html-js') return {uid:'proof_htmljs_'+index,type,zone,html:'<button id="proof">Exercice</button>',js:'document.getElementById("proof").dataset.ready="1";'};
  if(type==='image') return {uid:'proof_img_'+index,type,zone,mediaName:'preuve.svg',mediaType:'image/svg+xml',mediaData:'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxIiBoZWlnaHQ9IjEiLz4=',mediaAlt:'Illustration',mediaPlaceholder:''};
  if(type==='audio') return {uid:'proof_audio_'+index,type,zone,mediaName:'preuve.wav',mediaType:'audio/wav',mediaData:'data:audio/wav;base64,UklGRg==',mediaAlt:'Audio'};
  if(type==='video') return {uid:'proof_video_'+index,type,zone,mediaName:'preuve.webm',mediaType:'video/webm',mediaData:'data:video/webm;base64,GkXf',mediaAlt:'Vidéo'};
  if(type==='question') return {uid:'proof_q_'+index,type,zone,question:{id:'id'+(index+1)+'_preuve',prompt:'Question de contrôle '+(index+1),responseType:'text',normalizer:'',acceptedAnswers:'ok',acceptedMinutes:'',units:'',points:1,example:false,options:'',unitInput:false,unitScored:false,supplementalFields:[]}};
  if(type==='response-table') return {uid:'proof_response_'+index,type,zone,responseTable:{headers:['N°','Réponse','Unités'],columns:[{id:'number',widthChars:5,align:'center'},{id:'answer',widthChars:14,align:'center'},{id:'unit',align:'left'}]}};
  if(type==='inline-flow') return {uid:'proof_inline_'+index,type,zone,wordBank:['mot'],flow:[{type:'text',text:'Phrase de contrôle.',breakAfterSentence:true}]};
  if(type==='multiple-tables') return {uid:'proof_multitable_'+index,type,zone,tableDefinition:{id:'table_'+index,title:'Tableau',headers:['A','B'],questionIds:[]}};
  if(type==='text-editor') return {uid:'proof_editor_'+index,type,zone,config:{fileSimulation:true,imageSimulation:true,scoringProfile:'none'}};
  if(type==='table-grid'){
    const block=Core.createGridBlock(2,2);
    block.uid='proof_grid_'+index;
    block.zone=zone;
    block.table.cells[0][0].kind='fixed-text';
    block.table.cells[0][0].value='Repère';
    block.table.cells[0][1].kind='candidate-answer';
    block.table.cells[0][1].questionId='id'+(index+1)+'_grille';
    block.table.cells[0][1].acceptedAnswers='1';
    block.table.cells[0][1].responseType='number';
    block.table.cells[0][1].points=1;
    return block;
  }
  fail('type de bloc sans preuve de génération: '+type);
}

function proofModel(entry){
  const capabilitiesList=new Set(entry.capabilities||[]);
  const blocks=(entry.blocks||[]).map(proofBlock);
  return {
    idLocked:true,
    sourceDefinition:null,
    meta:{
      title:'Preuve '+entry.id,id:entry.id,version:'1.0.0',category:'technique',scored:true,icon:null,
      layout:entry.layout||'single',template:'generic',
      scenario:'Scénario de contrôle '+entry.id,
      instruction:'Consigne de contrôle '+entry.id,
      calculatorCompatible:capabilitiesList.has('calculator'),calculatorDefaultEnabled:false,
      chronoEnabled:capabilitiesList.has('chrono'),chronoMode:entry.id==='tri_chevilles'?'repeated':'simple',
      chronoMinMeasures:entry.id==='tri_chevilles'?3:1,chronoMaxMeasures:entry.id==='tri_chevilles'?5:1,
      chronoAutoReset:entry.id==='tri_chevilles',chronoFocusAfterStop:entry.id==='tri_chevilles',chronoShowTime:true,
      adminIntervention:capabilitiesList.has('admin-intervention'),adminInstructions:capabilitiesList.has('admin-intervention')?'Intervention Administrateur explicite':'',
      autoevaluation:capabilitiesList.has('autoevaluation'),
      externalMaterial:capabilitiesList.has('external-material'),externalMaterialText:capabilitiesList.has('external-material')?'Matériel extérieur':'',
      block1WidthChars:'15',block2WidthChars:'',lastBlockRemainder:true,outputs:[],bilanContributions:[]
    },
    blocks
  };
}

const registryIds=new Set();
const archetypeProofReport=[];
for(const entry of archetypeRegistry.archetypes||[]){
  if(!entry?.id) fail('registre archétypes: entrée sans ID');
  if(registryIds.has(entry.id)) fail('registre archétypes: ID dupliqué '+entry.id);
  registryIds.add(entry.id);

  for(const rel of entry.source||[]){
    const full=path.join(repoRoot,rel);
    if(!fs.existsSync(full)) fail('archétype '+entry.id+': source de référence absente '+rel);
  }
  for(const rawType of entry.blocks||[]){
    const type=blockAliases.get(rawType)||rawType;
    if(!declaredBlocks.has(type)) fail('archétype '+entry.id+': bloc non déclaré dans KALONÉO '+type);
    if(!builderBlockOptions.has(type)) fail('archétype '+entry.id+': bloc absent de l’interface Builder '+type);
  }
  for(const cap of entry.capabilities||[]){
    if(!capabilityAvailable(cap)) fail('archétype '+entry.id+': capacité indisponible '+cap);
  }

  if(entry.proof==='builder-archetype'){
    const model=proofModel(entry);
    const def=Core.modelToDefinition(model);
    const analysis=Core.analyzeDefinition(def);
    if(!analysis.ok) fail('archétype '+entry.id+' non générable par KALONÉO',analysis.errors.join('\n'));
    const imported=Core.definitionToModel(def);
    const rebuilt=Core.modelToDefinition(imported);
    if(JSON.stringify(normalize(def))!==JSON.stringify(normalize(rebuilt))) {
      fail('archétype '+entry.id+' perd des données après import/regénération');
    }
    archetypeProofReport.push(entry.id);
  }
}

if(registryIds.size!==Number(capabilities.validatedArchetypeCount)) {
  fail('nombre d’archétypes du registre incohérent: '+registryIds.size+' / '+capabilities.validatedArchetypeCount);
}

const freeTextProof=Core.modelToDefinition({
  idLocked:true,sourceDefinition:null,
  meta:{
    title:'Preuve texte libre',id:'preuve_texte_libre',version:'1.0.0',category:'francais',scored:true,icon:null,
    layout:'single',template:'generic',scenario:'Scénario',instruction:'Répondez librement.',
    calculatorCompatible:false,calculatorDefaultEnabled:false,calculatorBrand:'KALONÉO',
    chronoEnabled:false,chronoMode:'simple',chronoMinMeasures:1,chronoMaxMeasures:1,
    chronoAutoReset:false,chronoFocusAfterStop:false,chronoShowTime:true,
    adminIntervention:false,adminInstructions:'',autoevaluation:false,externalMaterial:false,externalMaterialText:'',
    block1WidthChars:'',block2WidthChars:'',lastBlockRemainder:true,outputs:[],bilanContributions:[]
  },
  blocks:[{uid:'free_1',type:'question',zone:'left',question:{
    id:'ID1_preuve_texte_libre',prompt:'Expliquez votre réponse',responseType:'free-text',manualEvaluation:true,
    normalizer:'',acceptedAnswers:'',units:'',points:0,example:false,options:'',unitInput:false,unitScored:false,supplementalFields:[]
  }}]
});
const freeTextAnalysis=Core.analyzeDefinition(freeTextProof);
if(!freeTextAnalysis.ok) fail('texte libre manuel non générable',freeTextAnalysis.errors.join('\n'));
if(freeTextProof.questions?.[0]?.response?.type!=='free-text'||freeTextProof.questions?.[0]?.manualEvaluation!==true||freeTextProof.questions?.[0]?.points!==0) {
  fail('contrat texte libre manuel incorrect');
}

const fixtureRoot=path.join(repoRoot,'tests','fixtures','kaltests');
const fixtureFiles=[];
function walk(dir){
  if(!fs.existsSync(dir))return;
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const full=path.join(dir,entry.name);
    if(entry.isDirectory())walk(full);
    else if(entry.name==='test.json')fixtureFiles.push(full);
  }
}
walk(fixtureRoot);
if(!fixtureFiles.length) fail('aucun fixture KALTEST trouvé');

const ids=new Set();
const report=[];
for(const file of fixtureFiles){
  const def=json(file);
  ids.add(def.id);
  const analysis=Core.analyzeDefinition(def);
  if(!analysis.ok) fail('test non réalisable par KALONÉO: '+def.id,analysis.errors.join('\n'));

  const round=Core.canRoundTrip(def);
  if(!round.ok){
    const legacyOrganisation=def.id==='organisation_demenagement' &&
      def.presentation?.organisationList &&
      Array.isArray(def.presentation.organisationList.rows) &&
      Array.isArray(round.rebuilt?.presentation?.builderContent);

    if(legacyOrganisation){
      const originalQuestions=new Map((def.questions||[]).map(q=>[String(q.id),q]));
      const rebuiltQuestions=new Map((round.rebuilt.questions||[]).map(q=>[String(q.id),q]));
      const image=round.rebuilt.presentation.builderContent.find(item=>item.type==='image');
      const questionItems=round.rebuilt.presentation.builderContent.filter(item=>item.type==='question');
      const sameAnswers=(def.questions||[]).every(q=>
        JSON.stringify(q.acceptedAnswers||[])===JSON.stringify(rebuiltQuestions.get(String(q.id))?.acceptedAnswers||[])
      );
      const sourceImage=String(def.presentation.organisationList.visual?.src||'');
      const migratedImage=String(image?.resource?.data||image?.resource?.name||'');
      if(originalQuestions.size!==8||rebuiltQuestions.size!==8||questionItems.length!==8||
         !sameAnswers||!sourceImage||migratedImage!==sourceImage||
         round.rebuilt.presentation.layout!=='50-50'||
         round.rebuilt.presentation.organisationList){
        fail('migration Organisation historique vers builderContent non fidèle',JSON.stringify(round.rebuilt,null,2));
      }
    }else{
      const before=JSON.stringify(normalize(def));
      const after=JSON.stringify(normalize(round.rebuilt));
      if(before!==after) fail('test importé puis regénéré avec perte: '+def.id,round.errors.join('\n'));
    }
  }
  report.push(def.id);
}

for(const id of capabilities.fixtureIdsRequiredInCi||[]){
  if(!ids.has(id)) fail('fixture obligatoire absent de la CI: '+id);
}

const decisions=read(path.join(repoRoot,'docs','KALONEO-DECISIONS-VALIDEES.md'));
for(const section of [
  '## 23. Présentations disponibles dans Test Builder',
  '## 31. Contenus et types de questions du bloc Exercice',
  '## 33. Tableau insérable dans un exercice',
  '## 40. Calculatrice — compatibilité du test et activation par le parcours',
  '## 50. Socle contractuel des exercices',
  '## 60. PILOTE 13 — harmonisation Scénario / Consigne et layouts validés',
  '## 63. Retour réel PILOTE 16 — corrections PILOTE 17 et règles de construction',
  '## 66. Retour réel PILOTE 19 — corrections locales Gratte-ciel / Tri'
]) if(!decisions.includes(section)) fail('décision historique introuvable: '+section);

const requiredArchetypes=[
  'calculs_commandes_atelier','calculs_poids_volumes','horaires_reception_controle',
  'texte_a_trous_stage_logistique','conversions_atelier_expedition','genre_nombre',
  'paronymes_rapport','fractions_proportions','organisation_activite','gestes_postures',
  'autoevaluation','briques_lego','stock','planning','dictee','tri_chevilles',
  'traitement_texte','redaction_email','gratte_ciel'
];
for(const id of requiredArchetypes){
  if(!capabilities.validatedArchetypes?.[id]) fail('archétype validé absent de KALONÉO: '+id);
  if(!registryIds.has(id)) fail('archétype validé absent du registre exécutable: '+id);
}

console.log('KALONEO_BUILDER_PARITY: OK');
console.log('KALONEO_COMPILED_WITH_SEB_EVALPRO=YES');
console.log('KALONEO_FIXTURES_REALISABLES='+report.length+'/'+fixtureFiles.length);
console.log('KALONEO_FIXTURE_IDS='+report.join(','));
console.log('KALONEO_VALIDATED_ARCHETYPES='+requiredArchetypes.length);
console.log('KALONEO_ARCHETYPES_PROVED_BY_BUILDER='+archetypeProofReport.length);
console.log('KALONEO_ARCHETYPE_REGISTRY='+registryIds.size+'/'+requiredArchetypes.length);
console.log('KALONEO_NO_CSS_MASKING_AS_IMPLEMENTATION=YES');
console.log('KALONEO_TABLE_GRID=FIXED_EMPTY_ANSWER_MEDIA_MERGE');
console.log('KALONEO_BUILD_BLOCKS_ON_UNSUPPORTED_TEST=YES');
