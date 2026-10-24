(() => {
  'use strict';

  const Core = window.KaloneoBuilderCore;
  const Workflow = window.KaloneoBuilderWorkflow;
  const Supplementary = window.KaloneoSupplementaryBuilder;
  if (!Core || !Workflow) throw new Error('KALONÉO Builder Core / Workflow absent.');

  const DRAFT_KEY = 'kaloneo_test_builder_v2';
  const state = {
    idLocked: false,
    sourceDefinition: null,
    blocks: [],
    supplementaryWindows: [],
    imageLibraryTargetUid: null,
    imageLibraryItems: [],
    sourceProtectedVersion: false,
    outputs: [],
    bilanContributions: []
  };
  let developerUnlocked=false;
  let textColorTarget = null;
  let textColorChanged = null;
  let textColorSelection = null;
  let paletteReturnTarget = null;

  const HISTORY_LIMIT = 30;
  const SAVED_FINGERPRINT_KEY = 'kaloneo_test_builder_saved_fingerprint';
  let historyEntries = [];
  let historyIndex = -1;
  // Chaque image/vidéo n'occupe qu'une seule copie en mémoire, même après
  // trente Annuler/Rétablir. Les brouillons restent des JSON KALTEST complets.
  const historyMediaDataToId=new Map();
  const historyMediaIdToData=new Map();
  function historyMediaToken(value){
    let id=historyMediaDataToId.get(value);
    if(!id){
      let hash=2166136261;
      for(let i=0;i<value.length;i++){
        hash^=value.charCodeAt(i);
        hash=Math.imul(hash,16777619);
      }
      id=value.length.toString(36)+'_'+(hash>>>0).toString(36);
      while(historyMediaIdToData.has(id)&&historyMediaIdToData.get(id)!==value)id+='_';
      historyMediaDataToId.set(value,id);
      historyMediaIdToData.set(id,value);
    }
    return {__kaloneoHistoryMedia:id};
  }
  function historyRehydrate(key,value){
    if(value&&typeof value==='object'&&
       Object.keys(value).length===1&&typeof value.__kaloneoHistoryMedia==='string'){
      if(!historyMediaIdToData.has(value.__kaloneoHistoryMedia))
        throw new Error('Ressource d’historique absente : restauration impossible.');
      return historyMediaIdToData.get(value.__kaloneoHistoryMedia);
    }
    return value;
  }

  let historyTimer = null;
  let applyingHistory = false;
  let draftPersistenceFailed=false;

  const activeGridEditorColumn=new Map(); // UI only: never saved into KALTEST
  const collapsedBlockUids=new Set(); // état d'affichage uniquement, jamais écrit dans les tests
  const selectedBlockUids=new Set(); // sélection temporaire, hors JSON
  const PREVIEW_FOLD_KEY='kaloneo_builder_preview_fold_state_v1';
  let imageLibraryOpening=false;
  let imageSelectionBusy=false;
  let pcPickerBusy=false;
  let pcImportBusy=false;
  let imageThumbObserver=null;
  let imageSearchTimer=null;
  let imageThumbGeneration=0;
  let activeImageThumbs=0;
  const imageThumbQueue=[];
  let imageLibraryLimit=72;
  let imageLibraryFilterKey='';

  function savePreviewFoldState() {
    const snapshot={
      id:$('test-id')?.value||'',version:$('test-version')?.value||'',
      blocks:state.blocks.map((b,i)=>({index:i,type:b.type,collapsed:collapsedBlockUids.has(b.uid)})),
      sections:{
        bilan: $('toggle-contract-section')?.getAttribute('aria-expanded')==='true',
        icones: $('toggle-icon-library')?.getAttribute('aria-expanded')==='true',
        style: $('toggle-page-style')?.getAttribute('aria-expanded')==='true',
        controle: $('toggle-validation-section')?.getAttribute('aria-expanded')==='true',
        exercice: $('toggle-exercise-section')?.getAttribute('aria-expanded')==='true'
      }
    };
    try{sessionStorage.setItem(PREVIEW_FOLD_KEY,JSON.stringify(snapshot));}catch(_){}
  }
  function restorePreviewFoldState() {
    let snapshot=null;
    try{
      snapshot=JSON.parse(sessionStorage.getItem(PREVIEW_FOLD_KEY)||'null');
      sessionStorage.removeItem(PREVIEW_FOLD_KEY);
    }catch(_){}
    if(!snapshot||snapshot.id!==$('test-id')?.value||snapshot.version!==$('test-version')?.value)return false;
    if(!Array.isArray(snapshot.blocks)||snapshot.blocks.length!==state.blocks.length)return false;
    if(snapshot.blocks.some((b,i)=>b.index!==i||b.type!==state.blocks[i]?.type))return false;
    collapsedBlockUids.clear();
    snapshot.blocks.forEach((b,i)=>{if(b.collapsed)collapsedBlockUids.add(state.blocks[i].uid);});
    // L'état visuel de Sorties et Bilan et des icônes appartient à
    // la session Builder, pas au JSON KALTEST. Le restaurer avant tout rendu.
    if(typeof snapshot.sections?.bilan==='boolean')
      setSectionExpanded('toggle-contract-section',snapshot.sections.bilan);
    if(typeof snapshot.sections?.icones==='boolean')
      setSectionExpanded('toggle-icon-library',snapshot.sections.icones);
    if(typeof snapshot.sections?.style==='boolean')
      setSectionExpanded('toggle-page-style',snapshot.sections.style);
    if(typeof snapshot.sections?.controle==='boolean')
      setSectionExpanded('toggle-validation-section',snapshot.sections.controle);
    if(typeof snapshot.sections?.exercice==='boolean')
      setSectionExpanded('toggle-exercise-section',snapshot.sections.exercice);
    return true;
  }

  let builderDirty = false;
  let changingInputField = false; // un champ saisi ne lance pas l'aperçu Electron à chaque caractère
  let savedFingerprint = String(localStorage.getItem(SAVED_FINGERPRINT_KEY) || '');
  let statusToken = 0;

  const $ = id => document.getElementById(id);

  // Repli purement visuel : ne modifie ni le test, ni l'historique, ni les fichiers.
  function setSectionExpanded(buttonId,expanded){
    const button=$(buttonId);
    const content=$(button?.getAttribute('aria-controls'));
    if(!button||!content)return;
    const section=button.closest('.icon-library-panel,.builder-contract-section,.page-style-panel,.validation-box,.builder-exercise-section');
    content.hidden=!expanded;
    section?.classList.toggle('is-collapsed',!expanded);
    button.textContent=expanded?'−':'+';
    button.setAttribute('aria-expanded',String(expanded));
    const sectionNames={
      'toggle-icon-library':'la bibliothèque d’icônes',
      'toggle-contract-section':'Sorties et Bilan',
      'toggle-page-style':'Style de la page',
      'toggle-validation-section':'Contrôle avant génération',
      'toggle-exercise-section':'Bloc Exercice'
    };
    const name=sectionNames[buttonId]||'la section';
    button.title=(expanded?'Réduire ':'Déployer ')+name;
    button.setAttribute('aria-label',button.title);
  }

  function initSectionFold(buttonId){
    $(buttonId)?.addEventListener('click',()=>{
      const expanded=$(buttonId).getAttribute('aria-expanded')==='true';
      setSectionExpanded(buttonId,!expanded);
    });
  }

  function uid(prefix='b') {
    return prefix + '_' + Math.random().toString(36).slice(2, 10);
  }

  function baseQuestion() {
    return {
      id: '',
      prompt: '',
      responseType: 'text',
      answerLayout: 'column',
      answerWidthChars: '',
      answerHeightLines: '',
      answerSuffix: '',
      manualEvaluation: false,
      normalizer: '',
      acceptedAnswers: '',
      units: '',
      points: 1,
      example: false,
      options: '',
      unitInput: false,
      unitScored: false,
      supplementalFields: []
    };
  }

  function baseBlock(type='text') {
    const styled=block=>Object.assign({fontSize:'',backgroundColor:'',backgroundImage:'',backgroundFit:'decorative',backgroundPosition:'right bottom',backgroundOpacity:100},block);
    if(type==='image-selection')return styled({
      uid:uid('selection'),type,zone:'left',label:'Sélectionnez les images',
      totalItems:4,acceptedCount:3,cloud:false,
      mediaName:'',mediaType:'',mediaData:'',mediaAlt:'',
      question:{...baseQuestion(),id:nextQuestionId(),prompt:'Sélectionnez 3 images sur 4',points:1}
    });
    if (type === 'table-grid') return styled(Core.createGridBlock(3, 3));
    if (type === 'response-table') {
      return styled({
        uid:uid('responses'),
        type,
        zone:'left',
        responseTable:{
          headers:['Question N°','Réponse','Unités'],
          columns:[
            {id:'number',widthChars:10,align:'center'},
            {id:'answer',widthChars:14,align:'center'},
            {id:'unit',align:'left'}
          ]
        }
      });
    }
    if (type === 'inline-flow') {
      return styled({uid:uid('inline'),type,zone:'left',wordBank:[],flow:[],flowText:''});
    }
    if (type === 'multiple-tables') {
      return styled({
        uid:uid('table'),
        type,
        zone:'left',
        tableDefinition:{id:uid('tabledef'),title:'',headers:['Colonne 1','Colonne 2'],questionIds:[]}
      });
    }
    if (type === 'text-editor') {
      return styled({
        uid:uid('editor'),
        type,
        zone:'right',
        config:{
          fileSimulation:true,
          imageSimulation:true,
          scoringProfile:'none'
        }
      });
    }
    return styled({
      uid:uid(),
      type,
      zone:'left',
      text:'',
      html:'',
      js:'',
      mediaName:'',
      mediaType:'',
      mediaData:'',
      mediaAlt:'',
      mediaPlaceholder:'',
      question:baseQuestion()
    });
  }

  function defaultMeta() {
    return {
      title:'',
      id:'',
      version:'1.0.0',
      category:'mathematiques',
      scored:true,
      icon:null,
      layout:'single',
      template:'generic',
      scenario:'',
      instruction:'',
      calculatorCompatible:false,
      calculatorDefaultEnabled:false,
      calculatorBrand:'KALONÉO',
      chronoEnabled:false,
      chronoMode:'simple',
      chronoMinMeasures:1,
      chronoMaxMeasures:1,
      chronoAutoReset:false,
      chronoFocusAfterStop:false,
      chronoShowTime:true,
      adminIntervention:false,
      adminInstructions:'',
      autoevaluation:false,
      externalMaterial:false,
      externalMaterialText:'',
      block1WidthChars:'',
      block2WidthChars:'',
      lastBlockRemainder:true,
      pageBackgroundType:'none',
      pageBackgroundColor:'#EEF6FD',
      pageBackgroundImage:'',
      pageBackgroundName:'',
      outputs:[{id:'score',type:'number'},{id:'score_max',type:'number'},{id:'pourcentage',type:'number'},{id:'status',type:'string'}],
      bilanContributions:[]
    };
  }

  function collectMeta() {
    const category=$('test-category').value;
    const specialPage=category==='introduction'||category==='fin';
    return {
      title:$('test-title').value.trim(),
      id:$('test-id').value.trim(),
      version:$('test-version').value.trim() || '1.0.0',
      category,
      scored:specialPage?false:(state.sourceProtectedVersion
        ? (category!=='activite_pratique'&&$('test-scored').value==='true')
        : category!=='activite_pratique'),
      icon:selectedIcon(),
      layout:$('test-layout').value,
      template:$('test-template').value,
      scenario:specialPage?'':$('test-scenario').value.trim(),
      instruction:specialPage?'':$('test-instruction').value.trim(),
      calculatorCompatible:!specialPage&&$('calculator-compatible').checked,
      calculatorDefaultEnabled:false,
      calculatorBrand:$('calculator-brand').value.trim(),
      chronoEnabled:!specialPage&&$('chrono-enabled').checked,
      chronoMode:$('chrono-mode').value,
      chronoMinMeasures:Math.max(1,Number($('chrono-min-measures').value)||1),
      chronoMaxMeasures:Math.max(1,Number($('chrono-max-measures').value)||1),
      chronoAutoReset:$('chrono-auto-reset').checked,
      chronoFocusAfterStop:$('chrono-focus-after-stop').checked,
      chronoShowTime:$('chrono-show-time').checked,
      adminIntervention:!specialPage&&$('admin-intervention').checked,
      adminInstructions:$('admin-instructions').value.trim(),
      autoevaluation:!specialPage&&$('autoevaluation-enabled').checked,
      externalMaterial:!specialPage&&$('external-material').checked,
      externalMaterialText:$('external-material-text').value.trim(),
      block1WidthChars:$('block1-width-chars').value,
      block2WidthChars:$('block2-width-chars').value,
      lastBlockRemainder:$('last-block-remainder').checked,
      pageBackgroundType:$('page-background-type').value,
      pageBackgroundColor:$('page-background-color').value,
      pageBackgroundImage:String($('page-background-image-name')?.dataset?.imageData||''),
      pageBackgroundName:String($('page-background-image-name')?.dataset?.imageName||''),
      outputs:Core.clone(state.outputs),
      bilanContributions:Core.clone(state.bilanContributions)
    };
  }

  function applyMeta(meta={}) {
    const m=Object.assign(defaultMeta(),meta);
    state.outputs=Core.clone(Array.isArray(m.outputs)?m.outputs:defaultMeta().outputs);
    state.bilanContributions=Core.clone(Array.isArray(m.bilanContributions)?m.bilanContributions:[]);
    renderContractEditors();
    $('test-title').value=m.title;
    $('test-id').value=m.id;
    $('test-version').value=m.version;
    $('test-category').value=m.category;
    $('test-scored').value=String(m.scored !== false);
    $('selected-icon-id').value=m.icon?.id||'';
    $('test-layout').value=Core.LAYOUTS.includes(m.layout)?m.layout:'single';
    $('test-template').value=Array.from($('test-template').options).some(o=>o.value===m.template)?m.template:'generic';
    $('test-scenario').value=m.scenario;
    $('test-instruction').value=m.instruction;
    $('calculator-compatible').checked=Boolean(m.calculatorCompatible);
    $('calculator-brand').value=String(m.calculatorBrand ?? 'KALONÉO');
    $('chrono-enabled').checked=Boolean(m.chronoEnabled);
    $('chrono-mode').value=m.chronoMode||'simple';
    $('chrono-min-measures').value=Math.max(1,Number(m.chronoMinMeasures)||1);
    $('chrono-max-measures').value=Math.max(1,Number(m.chronoMaxMeasures)||1);
    $('chrono-auto-reset').checked=Boolean(m.chronoAutoReset);
    $('chrono-focus-after-stop').checked=Boolean(m.chronoFocusAfterStop);
    $('chrono-show-time').checked=m.chronoShowTime!==false;
    $('admin-intervention').checked=Boolean(m.adminIntervention);
    $('admin-instructions').value=m.adminInstructions||'';
    $('autoevaluation-enabled').checked=Boolean(m.autoevaluation);
    $('external-material').checked=Boolean(m.externalMaterial);
    $('external-material-text').value=m.externalMaterialText||'';
    $('block1-width-chars').value=m.block1WidthChars || '';
    $('block2-width-chars').value=m.block2WidthChars || '';
    $('last-block-remainder').checked=m.lastBlockRemainder !== false;
    $('custom-sizing-row').hidden=m.layout !== 'chars-rest';
    $('page-background-type').value=['none','color','image'].includes(m.pageBackgroundType)?m.pageBackgroundType:'none';
    $('page-background-color').value=m.pageBackgroundColor||'#EEF6FD';
    const bgName=$('page-background-image-name');
    if(bgName){
      bgName.dataset.imageData=m.pageBackgroundImage||'';
      bgName.dataset.imageName=m.pageBackgroundName||'';
      bgName.textContent=m.pageBackgroundName||'Aucune image';
    }
    syncPageBackgroundOptions();
    syncPracticalCategory();
    syncCapabilityOptions();
  }

  // Les pages non notées sont de simples présentations : aucun contexte
  // d'exercice ni titre imposé au candidat, mais un nom reste utile à l'admin.
  function syncPresentationMode(specialPage) {
    for(const id of ['builder-exercise-context-fields','builder-exercise-options',
      'builder-preview-heading','builder-preview-context']) {
      const node=$(id);
      if(node)node.hidden=specialPage;
    }
    const layout=$('builder-layout-caption');
    if(layout)layout.textContent=specialPage?'Présentation de la page':'Présentation de l’exercice';
    const score=$('builder-scoring-field');
    if(score)score.hidden=specialPage;
    const label=$('builder-title-caption');
    if(label)label.textContent=specialPage?'Nom de la page':'Titre du test';
    const heading=$('builder-block-heading');
    if(heading)heading.textContent=specialPage?'Blocs de présentation':'Bloc Exercice';
    const fold=$('toggle-exercise-section');
    if(fold)fold.setAttribute('aria-label',specialPage?'Replier les blocs de présentation':'Replier Bloc Exercice');
  }

  function syncPracticalCategory(categoryChanged=false) {
    const category=$('test-category').value;
    const practical=category==='activite_pratique';
    const specialPage=category==='introduction'||category==='fin';
    // Sur une V1 chargée, ne pas modifier la notation historique.
    // Sur changement explicite de catégorie, appliquer les règles communes :
    // pratique = évaluation administrateur, autres = pourcentage automatique.
    if(!state.sourceProtectedVersion||categoryChanged)$('test-scored').value=(practical||specialPage)?'false':'true';
    else if(practical||specialPage)$('test-scored').value='false';
    if(specialPage && categoryChanged) state.bilanContributions=[];
    syncPresentationMode(specialPage);
    $('test-scored').disabled=true;
    // À l'ouverture d'une V1, préserver strictement ses liaisons historiques.
    // MAIS si l'administrateur change explicitement la catégorie, effacer
    // uniquement les liaisons devenues incompatibles : le nouvel emplacement
    // institutionnel doit pouvoir être choisi et enregistré avec copie V1.
    if((!state.sourceProtectedVersion||categoryChanged) && state.bilanContributions.length){
      const link=state.bilanContributions[0];
      const line=contractLine(link?.lineId);
      if(!line||!window.KaloneoSimpleBilanLink?.allowed($('test-category').value,line))
        state.bilanContributions=[];
    }
    renderSimpleBilanLink();
  }

  const renderRichContext=window.KaloneoSharedPresentation.renderRichContext;

  function applyMarkupToTextarea(input,format,onChanged,color='',selection=null) {
    if(!input||!input.isConnected)return;
    // Le clic sur la palette déplace le focus vers un dialogue. La sélection
    // de texte mémorisée à l'ouverture reste la seule source fiable.
    const start=Number.isInteger(selection?.start)?selection.start:
      (Number.isFinite(input.selectionStart)?input.selectionStart:input.value.length);
    const end=Number.isInteger(selection?.end)?selection.end:
      (Number.isFinite(input.selectionEnd)?input.selectionEnd:start);
    const open=format==='c'?'[c='+color+']':'['+format+']';
    const close='[/'+format+']';
    const selected=input.value.slice(start,end);
    input.value=input.value.slice(0,start)+open+selected+close+input.value.slice(end);
    const nextStart=start+open.length;
    const nextEnd=nextStart+selected.length;
    try{input.focus({preventScroll:true});}catch(_){input.focus();}
    input.setSelectionRange(nextStart,nextEnd);
    if(typeof onChanged==='function') onChanged(input.value);
    changed();
  }

  function openTextColorPalette(input,onChanged) {
    if(!input?.isConnected)return;
    textColorTarget=input;
    textColorChanged=typeof onChanged==='function'?onChanged:null;
    textColorSelection={
      start:Number.isInteger(input.selectionStart)?input.selectionStart:input.value.length,
      end:Number.isInteger(input.selectionEnd)?input.selectionEnd:input.value.length
    };
    $('text-color-dialog')?.showModal();
  }

  function closeTextColorPalette(color=''){
    const target=textColorTarget;
    paletteReturnTarget=target?.isConnected?target:null;
    const callback=textColorChanged;
    const selection=textColorSelection;
    // Important : fermer le dialogue AVANT de redonner le focus au champ,
    // sinon Chromium interdit le focus sur le contenu hors de la modale.
    const dialog=$('text-color-dialog');
    if(dialog?.open)dialog.close();
    textColorTarget=null;textColorChanged=null;textColorSelection=null;
    if(!target?.isConnected)return;
    if(color&&/^#[0-9a-f]{6}$/i.test(color)){
      applyMarkupToTextarea(target,'c',callback,color,selection);
    }else{
      try{target.focus({preventScroll:true});}catch(_){target.focus();}
      if(selection&&typeof target.setSelectionRange==='function')
        try{target.setSelectionRange(selection.start,selection.end);}catch(_){}
    }
  }

  function createTextFormatToolbar(input,onChanged) {
    const toolbar=document.createElement('span');
    toolbar.className='context-format-toolbar inline-text-format-toolbar';
    const buttons=[
      ['b','G','Gras'],
      ['i','I','Italique'],
      ['u','U','Souligné'],
      ['color','A🎨','Couleur du texte']
    ];
    buttons.forEach(([format,label,title])=>{
      const button=document.createElement('button');
      button.type='button';
      button.className='context-format-btn'+(format==='color'?' context-color-btn':'');
      button.title=title;
      if(format==='b') button.innerHTML='<strong>G</strong>';
      else if(format==='i') button.innerHTML='<em>I</em>';
      else if(format==='u') button.innerHTML='<u>U</u>';
      else button.textContent=label;
      button.addEventListener('click',()=>{
        if(format==='color') openTextColorPalette(input,onChanged);
        else applyMarkupToTextarea(input,format,onChanged);
      });
      toolbar.appendChild(button);
    });
    return toolbar;
  }

  function applyContextFormat(targetId,format) {
    const input=$(targetId);
    if(!input)return;
    if(format==='color') {
      openTextColorPalette(input,null);
      return;
    }
    applyMarkupToTextarea(input,format,null);
  }

  function syncPageBackgroundOptions() {
    const type=$('page-background-type')?.value||'none';
    const colorField=$('page-background-color-field');
    const imageField=$('page-background-image-field');
    if(colorField) colorField.hidden=type!=='color';
    if(imageField) imageField.hidden=type!=='image';
  }

  function syncCapabilityOptions() {
    $('calculator-options').hidden=!$('calculator-compatible').checked;
    $('chrono-options').hidden=!$('chrono-enabled').checked;
    $('admin-options').hidden=!$('admin-intervention').checked;
    $('material-options').hidden=!$('external-material').checked;
  }


  function iconLibrary() {
    return Array.isArray(window.KaloneoIconLibrary?.icons) ? window.KaloneoIconLibrary.icons : [];
  }

  function selectedIcon() {
    const id=$('selected-icon-id')?.value||'';
    const icon=iconLibrary().find(item=>item.id===id);
    if(icon) return {id:icon.id,label:icon.label,data:icon.data};
    // Conserver une icône déjà embarquée avec un test importé, même si son
    // identifiant ne figure pas parmi les icônes de la bibliothèque système.
    const imported=state.sourceDefinition?.icon;
    return id && imported?.id===id && imported?.data ? Core.clone(imported) : null;
  }

  function renderIconPicker() {
    const host=$('icon-picker');
    if(!host) return;
    host.innerHTML='';
    const filter=String($('icon-search')?.value||'')
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
    const selected=$('selected-icon-id')?.value||'';
    const summary=$('icon-selection-summary');
    if(summary){
      const chosen=iconLibrary().find(item=>item.id===selected);
      summary.textContent=selected ? (chosen?.label||state.sourceDefinition?.icon?.label||'Icône sélectionnée') : 'Aucune icône sélectionnée';
    }

    iconLibrary().forEach(icon=>{
      const searchable=(icon.id+' '+icon.label).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
      if(filter&&!searchable.includes(filter)) return;
      const button=document.createElement('button');
      button.type='button';
      button.className='icon-choice';
      button.classList.toggle('selected',icon.id===selected);
      button.title=icon.label;
      button.dataset.iconId=icon.id;
      const img=document.createElement('img');
      img.src=icon.data;
      img.alt='';
      const span=document.createElement('span');
      span.textContent=icon.label;
      button.append(img,span);
      button.addEventListener('click',()=>{
        $('selected-icon-id').value=icon.id;
        renderIconPicker();
        changed();
      });
      host.appendChild(button);
    });
  }

  function currentModel() {
    return {
      idLocked:state.idLocked,
      sourceDefinition:state.sourceDefinition ? Core.clone(state.sourceDefinition) : null,
      sourceProtectedVersion:state.sourceProtectedVersion===true,
      meta:collectMeta(),
      blocks:Core.clone(state.blocks),
      supplementaryWindows:Core.clone(state.supplementaryWindows)
    };
  }

  function historyFingerprint(json) {
    let hash=2166136261;
    for(let i=0;i<json.length;i+=1){
      hash^=json.charCodeAt(i);
      hash=Math.imul(hash,16777619);
    }
    return (hash>>>0).toString(16).padStart(8,'0')+':'+json.length;
  }

  function captureHistoryEntry() {
    // Sérialiser le modèle une seule fois : currentModel() faisait deux
    // clones profonds supplémentaires de la V1 et de toutes ses images HD.
    const json=JSON.stringify({
      idLocked:state.idLocked,
      sourceDefinition:state.sourceDefinition,
      sourceProtectedVersion:state.sourceProtectedVersion===true,
      meta:collectMeta(),
      blocks:state.blocks,
      supplementaryWindows:state.supplementaryWindows
    },(key,value)=>
      typeof value==='string'&&/^data:(?:image|audio|video)\//i.test(value)
        ?historyMediaToken(value):value);
    return {json,fingerprint:historyFingerprint(json)};
  }

  function syncHistoryButtons() {
    const undo=$('undo-change');
    const redo=$('redo-change');
    if(undo)undo.disabled=historyIndex<=0;
    if(redo)redo.disabled=historyIndex<0||historyIndex>=historyEntries.length-1;
  }

  function updateDirtyIndicator() {
    const status=$('draft-status');
    if(!status)return;
    status.classList.toggle('dirty',builderDirty||draftPersistenceFailed);
    status.textContent=draftPersistenceFailed
      ?'⚠ Brouillon non sauvegardé — espace local insuffisant. Enregistrez le test.'
      :(builderDirty?'Modifications non enregistrées':'Enregistré');
  }

  function transientStatus(text,delay=1600) {
    const status=$('draft-status');
    if(!status)return;
    const token=++statusToken;
    status.textContent=text;
    setTimeout(()=>{
      if(token===statusToken)updateDirtyIndicator();
    },delay);
  }

  function setDirtyFromFingerprint(fingerprint) {
    builderDirty=Boolean(savedFingerprint)&&fingerprint!==savedFingerprint;
    if(!savedFingerprint)builderDirty=true;
    updateDirtyIndicator();
  }

  function commitHistorySnapshot() {
    if(applyingHistory)return;
    if(historyTimer){
      clearTimeout(historyTimer);
      historyTimer=null;
    }
    const entry=captureHistoryEntry();
    const current=historyEntries[historyIndex];
    if(current?.fingerprint===entry.fingerprint&&current?.json===entry.json){
      setDirtyFromFingerprint(entry.fingerprint);
      syncHistoryButtons();
      return;
    }
    if(historyIndex<historyEntries.length-1)historyEntries=historyEntries.slice(0,historyIndex+1);
    historyEntries.push(entry);
    if(historyEntries.length>HISTORY_LIMIT)historyEntries.shift();
    historyIndex=historyEntries.length-1;
    setDirtyFromFingerprint(entry.fingerprint);
    syncHistoryButtons();
  }

  function scheduleHistorySnapshot() {
    if(applyingHistory)return;
    if(historyTimer)clearTimeout(historyTimer);
    historyTimer=setTimeout(commitHistorySnapshot,350);
  }

  function resetHistory(options={}) {
    if(historyTimer){
      clearTimeout(historyTimer);
      historyTimer=null;
    }
    historyMediaDataToId.clear();
    historyMediaIdToData.clear();
    const entry=captureHistoryEntry();
    historyEntries=[entry];
    historyIndex=0;
    if(options.markSaved===true){
      savedFingerprint=entry.fingerprint;
      try{localStorage.setItem(SAVED_FINGERPRINT_KEY,savedFingerprint);}catch(_){}
      builderDirty=false;
    }else{
      setDirtyFromFingerprint(entry.fingerprint);
    }
    syncHistoryButtons();
    updateDirtyIndicator();
  }


  // L'aperçu Electron recharge la page Builder : conserver la pile des
  // modifications dans le processus principal, pas dans localStorage.
  // Les données des images sont partagées grâce aux tokens de l'historique.
  function capturePreviewHistory() {
    commitHistorySnapshot();
    return {
      schema:1,
      id:$('test-id')?.value||'',
      version:$('test-version')?.value||'',
      entries:historyEntries.map(entry=>({json:entry.json,fingerprint:entry.fingerprint})),
      index:historyIndex,
      savedFingerprint,
      media:Array.from(historyMediaIdToData.entries())
    };
  }

  function restorePreviewHistory(snapshot) {
    if(!snapshot||snapshot.schema!==1||snapshot.id!==$('test-id')?.value||
       snapshot.version!==$('test-version')?.value||
       !Array.isArray(snapshot.entries)||!snapshot.entries.length||
       snapshot.entries.length>HISTORY_LIMIT||!Array.isArray(snapshot.media)||
       !Number.isInteger(snapshot.index)||snapshot.index<0||
       snapshot.index>=snapshot.entries.length)return false;
    try{
      const nextMedia=new Map();
      for(const item of snapshot.media){
        if(!Array.isArray(item)||item.length!==2||
           typeof item[0]!=='string'||typeof item[1]!=='string'||
           !/^data:(?:image|audio|video)\//i.test(item[1]))return false;
        nextMedia.set(item[0],item[1]);
      }
      const entries=snapshot.entries.map(entry=>{
        if(!entry||typeof entry.json!=='string'||
           typeof entry.fingerprint!=='string'||
           historyFingerprint(entry.json)!==entry.fingerprint)
          throw new Error('Historique d’aperçu incomplet.');
        return {json:entry.json,fingerprint:entry.fingerprint};
      });
      const revive=(key,value)=>{
        if(value&&typeof value==='object'&&
           Object.keys(value).length===1&&typeof value.__kaloneoHistoryMedia==='string'){
          if(!nextMedia.has(value.__kaloneoHistoryMedia))
            throw new Error('Image absente de l’historique.');
          return nextMedia.get(value.__kaloneoHistoryMedia);
        }
        return value;
      };
      const model=JSON.parse(entries[snapshot.index].json,revive);
      if(model?.meta?.id!==snapshot.id||model?.meta?.version!==snapshot.version)
        return false;
      historyMediaDataToId.clear();
      historyMediaIdToData.clear();
      for(const [id,data] of nextMedia.entries()){
        historyMediaIdToData.set(id,data);
        historyMediaDataToId.set(data,id);
      }
      historyEntries=entries;
      historyIndex=snapshot.index;
      savedFingerprint=typeof snapshot.savedFingerprint==='string'
        ?snapshot.savedFingerprint:'';
      applyHistoryEntry(entries[historyIndex]);
      syncHistoryButtons();
      return true;
    }catch(error){
      console.warn('KALONÉO : historique du retour aperçu non restaurable',error);
      resetHistory({markSaved:false});
      return false;
    }
  }

  function markCurrentSaved() {
    commitHistorySnapshot();
    const entry=historyEntries[historyIndex]||captureHistoryEntry();
    savedFingerprint=entry.fingerprint;
    try{localStorage.setItem(SAVED_FINGERPRINT_KEY,savedFingerprint);}catch(_){}
    // Un enregistrement réussi dans la bibliothèque reste valable
    // même si le stockage du brouillon local est saturé.
    draftPersistenceFailed=false;
    builderDirty=false;
    updateDirtyIndicator();
  }

  function applyHistoryEntry(entry) {
    if(!entry)return;
    applyingHistory=true;
    try{
      const model=JSON.parse(entry.json,historyRehydrate);
      state.idLocked=Boolean(model.idLocked);
      state.sourceDefinition=model.sourceDefinition||null;
      state.sourceProtectedVersion=model.sourceProtectedVersion===true;
      state.blocks=Array.isArray(model.blocks)?model.blocks:[];
      state.supplementaryWindows=Array.isArray(model.supplementaryWindows)?model.supplementaryWindows:[];
      if(Supplementary)Supplementary.reset();
      applyMeta(model.meta||defaultMeta());
      syncProtectedVersionUi();
      renderIconPicker();
      renderBlocks();
      refreshPreview();
      saveDraft(false);
      setDirtyFromFingerprint(entry.fingerprint);
    }finally{
      applyingHistory=false;
      syncHistoryButtons();
    }
  }

  function undoChange() {
    commitHistorySnapshot();
    if(historyIndex<=0)return;
    historyIndex-=1;
    applyHistoryEntry(historyEntries[historyIndex]);
  }

  function redoChange() {
    commitHistorySnapshot();
    if(historyIndex>=historyEntries.length-1)return;
    historyIndex+=1;
    applyHistoryEntry(historyEntries[historyIndex]);
  }

  function confirmDiscardChanges(action) {
    if(!builderDirty)return true;
    return confirm('Le test contient des modifications non enregistrées.\n\n'+action+' entraînera la perte de ces modifications. Continuer ?');
  }

  function saveDraft(showStatus=true) {
    try{
      localStorage.setItem(DRAFT_KEY,JSON.stringify({
        idLocked:state.idLocked,
        sourceDefinition:state.sourceDefinition,
        sourceProtectedVersion:state.sourceProtectedVersion===true,
        meta:collectMeta(),
        blocks:state.blocks,
        supplementaryWindows:state.supplementaryWindows
      }));
      draftPersistenceFailed=false;
      if(showStatus)transientStatus('Brouillon local sauvegardé',1200);
      else updateDirtyIndicator();
      return true;
    }catch(error){
      // QuotaReachedError ou écriture bloquée : ne jamais masquer l'échec,
      // ne jamais afficher « Enregistré » pour un brouillon perdu.
      draftPersistenceFailed=true;
      updateDirtyIndicator();
      console.error('KALONÉO : brouillon non sauvegardé',error);
      return false;
    }
  }

  function restoreDraft() {
    try {
      const data=JSON.parse(localStorage.getItem(DRAFT_KEY)||'null');
      if (!data || !data.meta) return false;
      state.idLocked=Boolean(data.idLocked);
      state.sourceDefinition=data.sourceDefinition||null;
      state.sourceProtectedVersion=data.sourceProtectedVersion===true;
      state.blocks=Array.isArray(data.blocks)?data.blocks:[];
      state.supplementaryWindows=Array.isArray(data.supplementaryWindows)?data.supplementaryWindows:[];
      collapsedBlockUids.clear();
      state.blocks.forEach(block=>{if(block?.uid)collapsedBlockUids.add(block.uid);});
      applyMeta(data.meta);
      syncProtectedVersionUi();
      return true;
    } catch (_) {
      return false;
    }
  }

  function normalizeIdFromTitle() {
    return Core.cleanId($('test-id').value || $('test-title').value || 'test');
  }

  function usedQuestionIds() {
    const ids=new Set();
    for(const block of state.blocks) {
      if(['question','image-selection'].includes(block.type)&&block.question?.id) ids.add(block.question.id);
      if(block.type==='table-grid') {
        for(const cell of (block.table?.cells||[]).flat()) if(cell?.questionId) ids.add(cell.questionId);
      }
    }
    return ids;
  }

  function nextQuestionId() {
    const suffix=normalizeIdFromTitle();
    const used=usedQuestionIds();
    let n=1;
    while(used.has('ID'+n+'_'+suffix)) n++;
    return 'ID'+n+'_'+suffix;
  }

  function ensureQuestionId(question) {
    if(!question.id) question.id=nextQuestionId();
    return question.id;
  }

  function inputField(label,value,onInput,options={}) {
    const wrap=document.createElement('label');
    wrap.textContent=label;
    const el=options.multiline?document.createElement('textarea'):document.createElement('input');
    if (!options.multiline) el.type=options.type||'text';
    el.value=value == null ? '' : value;
    if (options.placeholder) el.placeholder=options.placeholder;
    if (options.title) { el.title=options.title; wrap.title=options.title; }
    if (options.min != null) el.min=String(options.min);
    if (options.max != null) el.max=String(options.max);
    if (options.readOnly) el.readOnly=true;
    const grow=()=>{
      if(el.tagName==='TEXTAREA'){
        el.style.height='auto';
        el.style.height=Math.max(42,el.scrollHeight)+'px';
      }
    };
    el.addEventListener('input',()=>{
      grow();
      changingInputField=true;
      try{onInput(el.value);}
      finally{changingInputField=false;}
    });
    // Quand un changement de dimensions exige une reconstruction de
    // l'éditeur, attendre la validation du champ (pas chaque touche).
    if(typeof options.onCommit==='function')el.addEventListener('change',()=>options.onCommit(el.value));
    if(el.tagName==='TEXTAREA') requestAnimationFrame(grow);
    wrap.appendChild(el);
    return wrap;
  }

  function checkboxField(label,checked,onChange) {
    const wrap=document.createElement('label');
    wrap.className='inline-checkbox';
    const el=document.createElement('input');
    el.type='checkbox';
    el.checked=Boolean(checked);
    el.addEventListener('change',()=>onChange(el.checked));
    wrap.append(el,document.createTextNode(' '+label));
    return wrap;
  }

  // R157 — ouverture fiable des vrais menus déroulants sous Electron / Windows.
  // La sélection reste un <select> natif, avec son change et sa gestion clavier.
  // Sur certains postes, l'ouverture implicite au clic natif n'affiche pas
  // la liste dans une zone défilante. showPicker() la sollicite explicitement
  // dans le geste utilisateur ; si la fonction n'est pas supportée, la
  // commande native reprend normalement (aucune option / donnée modifiée).
  // R157.1 — Une miniature Electron utilise une AUTRE fenêtre native Windows
  // (cachée) et peut être créée/détruite pendant l'ouverture d'un <select>.
  // Ne jamais déclencher cette opération tant que le menu natif est manipulé.
  // L'état est libéré par change / focusout / clic extérieur / retour fenêtre.
  let builderSelectInteracting=false;
  let miniPreviewWaitingForSelect=false;
  function releaseBuilderSelect() {
    if(!builderSelectInteracting)return;
    builderSelectInteracting=false;
    if(miniPreviewWaitingForSelect){
      miniPreviewWaitingForSelect=false;
      scheduleMiniPreviewCapture();
    }
  }
  function installNativeSelectPickers() {
    document.addEventListener('pointerdown',event=>{
      if(event.button!==0||event.pointerType==='touch')return;
      const control=event.target?.closest?.('select');
      if(!control || !control.closest('.builder-editor,.builder-preview,.modal,.test-library-dialog,.image-library-dialog') ||
         control.disabled || control.options.length<2){
        releaseBuilderSelect();
        return;
      }
      builderSelectInteracting=true;
      // Le menu n'est pas un changement de test : ne pas effacer la miniature.
      if(miniPreviewTimer){clearTimeout(miniPreviewTimer);miniPreviewTimer=null;miniPreviewWaitingForSelect=true;}
      if(typeof control.showPicker!=='function')return;
      try{
        control.showPicker();
        event.preventDefault(); // Un seul popup, sans double clic Electron.
      }catch(_){
        // Fallback natif sans bloquer le clic et le clavier.
      }
    },{capture:true});
    document.addEventListener('change',event=>{
      if(event.target?.matches?.('select'))setTimeout(releaseBuilderSelect,0);
    },{capture:true});
    document.addEventListener('focusout',event=>{
      if(event.target?.matches?.('select'))setTimeout(releaseBuilderSelect,0);
    },{capture:true});
    document.addEventListener('keydown',event=>{
      if(builderSelectInteracting&&['Escape','Tab','Enter'].includes(event.key))
        setTimeout(releaseBuilderSelect,0);
    },{capture:true});
    window.addEventListener('blur',()=>{
      // Un changement Firefox <-> KALONÉO ne doit pas bloquer l'aperçu.
      builderSelectInteracting=false;
      if(miniPreviewTimer){clearTimeout(miniPreviewTimer);miniPreviewTimer=null;miniPreviewWaitingForSelect=true;}
    });
    window.addEventListener('focus',()=>{
      if(miniPreviewWaitingForSelect){
        miniPreviewWaitingForSelect=false;
        scheduleMiniPreviewCapture();
      }
    });
  }

  function selectField(label,value,values,onChange) {
    const wrap=document.createElement('label');
    wrap.textContent=label;
    const sel=document.createElement('select');
    values.forEach(([v,text])=>{
      const opt=document.createElement('option');
      opt.value=v;
      opt.textContent=text;
      sel.appendChild(opt);
    });
    sel.value=value;
    sel.addEventListener('change',()=>onChange(sel.value));
    wrap.appendChild(sel);
    return wrap;
  }

  function splitValues(value) {
    return Core.splitValues(value);
  }

  function parseInlineFlowText(text) {
    const source=String(text||'');
    const parts=source.split(/(\[\[[A-Za-z0-9_-]+\]\])/g).filter(Boolean);
    return parts.map(part=>{
      const match=part.match(/^\[\[([A-Za-z0-9_-]+)\]\]$/);
      if (match) return {type:'question',questionId:match[1]};
      const lines=part.split(/\n\n/);
      const out=[];
      lines.forEach((segment,index)=>{
        if (segment) out.push({type:'text',text:segment,breakAfterSentence:index<lines.length-1});
      });
      return out;
    }).flat();
  }

  function flowToText(flow) {
    return (flow||[]).map(item=>{
      if (item.type==='question') return '[['+item.questionId+']]';
      if (item.type==='text') return String(item.text||'')+(item.breakAfterSentence?'\n\n':'');
      return '';
    }).join('');
  }

  async function readFileAsDataUrl(file) {
    return new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onload=()=>resolve(String(reader.result||''));
      reader.onerror=reject;
      reader.readAsDataURL(file);
    });
  }

  function renderQuestionEditor(block,body) {
    const q=block.question||(block.question=baseQuestion());
    ensureQuestionId(q);
    const row1=document.createElement('div');
    row1.className='field-row';
    const questionField=inputField('Question',q.prompt,value=>{
      q.prompt=value;changed({typing:true});
    },{multiline:true,title:'Entrez le texte de la question présenté au candidat. Sélectionnez un passage puis utilisez G / I / U / A🎨.'});
    // Placer la barre sous l'énoncé (colonne droite), et non sous l'ID.
    // La garder hors du <label> pour ne pas déplacer le focus lors du clic.
    const questionColumn=document.createElement('div');
    questionColumn.className='question-editor-column';
    questionColumn.appendChild(questionField);
    questionColumn.appendChild(createTextFormatToolbar(questionField.querySelector('textarea'),value=>{
      q.prompt=value;
    }));
    row1.append(
      inputField('ID automatique / stable',q.id,()=>{},{readOnly:true,title:'Identifiant généré automatiquement. Il reste stable même si la question est déplacée ou reformulée.'}),
      questionColumn
    );
    body.appendChild(row1);

    const row2=document.createElement('div');
    row2.className='field-row cols-3';
    row2.append(
      selectField('Type de réponse',q.responseType,[
        ['text','Texte'],['free-text','Texte libre — évaluation Administrateur'],['number','Nombre'],['number-unit','Nombre + unité'],['duration','Durée / horaire'],
        ['single-choice','Choix unique'],['multiple-choice','Choix multiple'],['boolean','Vrai / Faux'],['select','Liste déroulante']
      ],value=>{
        q.responseType=value;
        q.manualEvaluation=value==='free-text';
        if(q.manualEvaluation) { q.points=0; q.acceptedAnswers=''; }
        changed();renderBlocks();
      }),
      q.responseType==='duration'
        ? inputField('Durée attendue — minutes',q.acceptedMinutes,value=>{q.acceptedMinutes=Math.max(0,Number(value)||0);changed();},{type:'number',min:0,title:'Valeur de référence en minutes. Le candidat peut saisir 9h15, 9 heures 15 min, etc.'})
        : q.responseType==='free-text'
          ? inputField('Correction','Évaluation manuelle I / II / III / NE par l’Administrateur',()=>{},{readOnly:true,title:'La réponse du candidat est conservée telle quelle. Aucun score automatique n’est calculé.'})
          : inputField('Réponse(s) attendue(s)',q.acceptedAnswers,value=>{q.acceptedAnswers=value;changed();},{placeholder:'Séparer par ;',title:'Entrez la ou les réponses correctes. Séparez plusieurs réponses acceptées par un point-virgule ;'}),
      inputField('Points',(q.example||q.responseType==='free-text')?0:q.points,value=>{if(!q.example&&q.responseType!=='free-text')q.points=Math.max(0,Number(value)||0);changed();},{type:'number',min:0,readOnly:Boolean(q.example||q.responseType==='free-text'),title:q.responseType==='free-text'?'La réponse libre est évaluée manuellement dans le Bilan.':'Nombre de points attribués. Une question d’exemple reste automatiquement à 0.'})
    );
    body.appendChild(row2);

    // Présentation identique dans le Builder et dans le vrai moteur candidat.
    // La colonne de droite partage un bord vertical avec les autres questions
    // de la même zone. La largeur est optionnelle, sans changer les V1.
    const answerDisplay=document.createElement('div');
    answerDisplay.className='field-row cols-2';
    answerDisplay.append(
      selectField('Position de la réponse',q.answerLayout||'column',[
        ['column','Aligner à droite de la zone (actuel)'],
        ['compact-column','Colonne compacte (après la question la plus longue)'],
        ['inline','Réponse juste après la question'],
        ['below','Réponse sous la question']
      ],value=>{q.answerLayout=value;changed();}),
    );
    body.appendChild(answerDisplay);
    // Réduire l'emprise du champ suffixe, puis aligner largeur et hauteur.
    // La hauteur concerne exclusivement les réponses libres multilignes.
    const suffixField=inputField('Texte fixe après la réponse (ex. m²)',q.answerSuffix||'',value=>{
      q.answerSuffix=value;changed({typing:true});
    },{placeholder:'m², €, %, cm… (facultatif)',
      title:'Ce texte apparaît juste après la zone de réponse. Le candidat ne le saisit pas et il ne compte jamais dans le barème.'});
    suffixField.classList.add('builder-answer-suffix-field');
    body.appendChild(suffixField);
    const answerDimensions=document.createElement('div');
    answerDimensions.className='field-row cols-2 builder-answer-dimensions';
    answerDimensions.appendChild(inputField('Largeur de la réponse (caractères)',q.answerWidthChars||'',value=>{
      if(value===''){q.answerWidthChars='';changed();return;}
      const n=Number(value);
      if(!Number.isInteger(n)||n<6||n>30)return;
      q.answerWidthChars=n;changed();
    },{type:'number',min:6,max:30,placeholder:'Auto (largeur par défaut)',
      title:'Entre 6 et 30 caractères. Laisser vide pour la largeur automatique.'}));
    if(q.responseType==='free-text'){
      answerDimensions.appendChild(inputField('Hauteur de la réponse (lignes)',q.answerHeightLines??'',value=>{
        if(value===''){q.answerHeightLines='';changed();return;}
        const n=Number(value);
        if(!Number.isInteger(n)||n<1||n>20)return;
        q.answerHeightLines=n;changed();
      },{type:'number',min:1,max:20,placeholder:'Auto (hauteur actuelle)',
        title:'Entre 1 et 20 lignes visibles. Au-delà, le candidat fait défiler le contenu sans perdre sa réponse.'}));
    }
    body.appendChild(answerDimensions);

    const row3=document.createElement('div');
    row3.className='field-row cols-3';
    row3.append(
      inputField('Unité(s)',q.units,value=>{q.units=value;changed();},{placeholder:'Séparer par ;',title:'Indiquez les écritures d’unité acceptées, séparées par ;. Laissez vide si aucune unité n’est demandée.'}),
      checkboxField('Champ unité affiché',q.unitInput,value=>{q.unitInput=value;changed();}),
      checkboxField('Unité notée',q.unitScored,value=>{q.unitScored=value;changed();})
    );
    body.appendChild(row3);
    const extra=inputField('Champs supplémentaires du tableau — IDs séparés par ;',
      (q.supplementalFields||[]).map(field=>field.id).join('; '),
      value=>{
        q.supplementalFields=splitValues(value).map(id=>({id:Core.cleanId(id)})).filter(x=>x.id);
        changed();
      },{placeholder:'operation; commentaire',
        title:'Un identifiant par colonne supplémentaire du tableau. Les valeurs saisies seront conservées dans le résultat.'});
    body.appendChild(extra);

    if (['single-choice','multiple-choice','select'].includes(q.responseType)) {
      body.appendChild(inputField('Choix proposés',q.options,value=>{q.options=value;changed();},{placeholder:'Choix 1; Choix 2; Choix 3'}));
    }
    if (q.responseType==='duration') {
      body.appendChild(inputField('Normalisation',q.normalizer||'duration-fr',value=>{q.normalizer=value;changed();},{placeholder:'duration-fr'}));
    }

    body.appendChild(checkboxField('Question d’exemple — 0 point, hors score et hors Bilan',q.example,value=>{
      q.example=value;
      if(value) q.points=0;
      changed();
      renderBlocks();
    }));
  }

  function ensureResponseColumns(block) {
    const t=block.responseTable||(block.responseTable={headers:['Question N°','Réponse','Unités'],columns:[]});
    t.headers=Array.isArray(t.headers)?t.headers:['Question N°','Réponse','Unités'];
    t.columns=Array.isArray(t.columns)?t.columns:[];
    while(t.columns.length<t.headers.length) {
      const i=t.columns.length;
      t.columns.push({id:'col'+(i+1),widthChars:'',align:i===t.headers.length-1?'left':'center'});
    }
    if(t.columns.length>t.headers.length) t.columns.length=t.headers.length;
    return t;
  }

  function renderResponseTableEditor(block,body) {
    const t=ensureResponseColumns(block);
    body.appendChild(inputField('En-têtes du tableau',t.headers.join('; '),value=>{
      t.headers=splitValues(value);
      ensureResponseColumns(block);
      changed();
    },{placeholder:'N°; Réponses; Unités; Opérations effectuées',
      onCommit:()=>renderBlocks()}));

    const grid=document.createElement('div');
    grid.className='column-editor';
    t.headers.forEach((header,index)=>{
      const col=t.columns[index]||{};
      const row=document.createElement('div');
      row.className='column-editor-row';
      const name=document.createElement('strong');
      name.textContent=header||('Colonne '+(index+1));

      const width=document.createElement('input');
      width.type='number';
      width.min='3';
      width.placeholder=index===t.headers.length-1?'Reste':'caractères';
      width.value=col.widthChars==null?'':col.widthChars;
      width.addEventListener('input',()=>{
        col.widthChars=width.value?Math.max(3,Number(width.value)||3):'';
        changed();
      });

      const align=document.createElement('select');
      [['center','Centré'],['left','Gauche']].forEach(([v,l])=>{
        const o=document.createElement('option');o.value=v;o.textContent=l;align.appendChild(o);
      });
      align.value=col.align||'center';
      align.addEventListener('change',()=>{col.align=align.value;changed();});

      const rest=document.createElement('span');
      rest.className='muted';
      rest.textContent=index===t.headers.length-1&&!col.widthChars?'Reste de la place':'';
      row.append(name,width,align,rest);
      grid.appendChild(row);
    });
    body.appendChild(grid);
  }

  function resizeGrid(table,newRows,newCols) {
    newRows=Math.max(1,Math.min(30,Number(newRows)||1));
    newCols=Math.max(1,Math.min(20,Number(newCols)||1));
    const old=Array.isArray(table.cells)?table.cells:[];
    const cells=Array.from({length:newRows},(_,r)=>Array.from({length:newCols},(_,c)=>{
      const cell=old[r]&&old[r][c];
      return cell?cell:{kind:'empty',value:'',questionId:'',acceptedAnswers:'',responseType:'text',points:1,rowSpan:1,colSpan:1};
    }));
    table.rows=newRows;
    table.cols=newCols;
    table.cells=cells;
    if(Array.isArray(table.rowColors))table.rowColors.length=newRows;
    if(Array.isArray(table.rowTextColors))table.rowTextColors.length=newRows;
    table.columns=Array.isArray(table.columns)?table.columns:[];
    while(table.columns.length<newCols) {
      const i=table.columns.length;
      table.columns.push({id:'c'+(i+1),widthChars:'',align:'center',remainder:i===newCols-1});
    }
    table.columns.length=newCols;
    table.columns.forEach((col,i)=>col.remainder=i===newCols-1 && !col.widthChars);
  }

  // R48.10 validé : colonnes égales si toutes automatiques,
  // sauf tableau de mise en page, cellules fusionnées ou largeur manuelle.

  function gridColorControl(label,getColor,setColor){
    const item=document.createElement('label');
    item.className='grid-color-control';
    const name=document.createElement('span');
    name.textContent=label;
    const color=document.createElement('input');
    color.type='color';
    color.className='grid-color-input';
    color.title='Choisir la couleur '+label.toLowerCase();
    color.setAttribute('aria-label','Choisir la couleur '+label.toLowerCase());
    const reset=document.createElement('button');
    reset.type='button';reset.className='grid-color-reset';
    reset.textContent='×';
    reset.title='Supprimer la couleur : revenir à la couleur héritée';
    reset.setAttribute('aria-label','Effacer '+label.toLowerCase());
    function refresh(){
      const value=window.KaloneoSharedPresentation.normalizeGridColor(getColor());
      color.value=value||'#ffffff';
      color.classList.toggle('is-inherited',!value);
      item.title=value?'Couleur personnalisée '+value:'Automatique — couleur héritée';
      reset.disabled=!value;
    }
    color.addEventListener('input',()=>{
      setColor(color.value);
      refresh();
      changed();
    });
    reset.addEventListener('click',()=>{
      setColor('');
      refresh();
      changed();
    });
    item.append(name,color,reset);
    refresh();
    return {element:item,refresh};
  }

  function renderGridEditor(block,body) {
    const table=block.table||(block.table=Core.createGridBlock(3,3).table);
    resizeGrid(table,table.rows||3,table.cols||3);

    const dims=document.createElement('div');
    dims.className='field-row cols-3';
    dims.append(
      inputField('Titre du tableau',table.title||'',value=>{table.title=value;changed();}),
      inputField('Lignes',table.rows,value=>{resizeGrid(table,value,table.cols);changed();},{type:'number',min:1,max:30,onCommit:()=>renderBlocks()}),
      inputField('Colonnes',table.cols,value=>{resizeGrid(table,table.rows,value);changed();},{type:'number',min:1,max:20,onCommit:()=>renderBlocks()})
    );
    body.appendChild(dims);
    const layoutLabel=document.createElement('label');layoutLabel.className='inline-checkbox';
    const check=document.createElement('input');check.type='checkbox';check.checked=table.layoutOnly===true;
    check.addEventListener('change',()=>{table.layoutOnly=check.checked;changed();});
    layoutLabel.append(check,document.createTextNode(' Tableau de mise en page : bordures invisibles (ne change pas les réponses)'));
    body.appendChild(layoutLabel);
    const compactLabel=document.createElement('label');compactLabel.className='inline-checkbox';
    const compactCheck=document.createElement('input');compactCheck.type='checkbox';compactCheck.checked=table.compact===true;
    compactCheck.addEventListener('change',()=>{table.compact=compactCheck.checked;changed();});
    compactLabel.append(compactCheck,document.createTextNode(' Tableau compact : réduire les espacements sans modifier les choix'));
    body.appendChild(compactLabel);

    const columns=document.createElement('div');
    columns.className='grid-columns-editor';
    table.columns.forEach((col,index)=>{
      const row=document.createElement('div');
      row.className='column-editor-row';
      const label=document.createElement('strong');
      label.textContent='Colonne '+(index+1);
      const width=document.createElement('input');
      width.type='number';width.min='3';width.placeholder=index===table.columns.length-1?'Reste':'caractères';
      width.value=col.widthChars||'';
      width.addEventListener('input',()=>{
        col.widthChars=width.value?Math.max(3,Number(width.value)||3):'';
        col.remainder=index===table.columns.length-1&&!col.widthChars;
        changed();
      });
      const align=document.createElement('select');
      [['center','Centré'],['left','Gauche']].forEach(([v,l])=>{const o=document.createElement('option');o.value=v;o.textContent=l;align.appendChild(o);});
      align.value=col.align||'center';
      align.addEventListener('change',()=>{col.align=align.value;changed();});
      const rest=document.createElement('span');
      rest.className='muted';
      rest.textContent=index===table.columns.length-1&&!col.widthChars?'Reste disponible':'';
      const coloring=gridColorControl('Fond',()=>col.backgroundColor||'',value=>{
        if(value)col.backgroundColor=value;
        else delete col.backgroundColor;
      });
      const textColor=gridColorControl('Texte',()=>col.textColor||'',value=>{
        if(value)col.textColor=value;
        else delete col.textColor;
      });
      row.classList.add('grid-color-column-row');
      row.append(label,width,align,coloring.element,textColor.element,rest);
      columns.appendChild(row);
    });
    body.appendChild(columns);
    const widthExplanation=document.createElement('p');
    widthExplanation.className='muted builder-grid-width-explanation';
    const updateWidthExplanation=()=>{
      const equal=window.KaloneoSharedPresentation.equalAutomaticColumns(table);
      widthExplanation.textContent=equal?
        'Largeurs automatiques : les '+equal+' colonnes ont exactement la même largeur.':
        'Les largeurs saisies sont prioritaires ; une colonne sans largeur peut prendre le reste.';
    };
    updateWidthExplanation();
    columns.querySelectorAll('input[type="number"]').forEach(input=>
      input.addEventListener('input',updateWidthExplanation));
    body.appendChild(widthExplanation);

    // Une seule barre compacte permet de colorer n'importe quelle ligne.
    // Le réglage est partagé par ses cellules, quelle que soit la colonne active.
    const rowTools=document.createElement('div');
    rowTools.className='grid-row-color-toolbar';
    const rowSelector=document.createElement('select');
    rowSelector.className='grid-row-color-picker';
    rowSelector.setAttribute('aria-label','Ligne à colorer');
    for(let i=0;i<table.rows;i++){
      const option=document.createElement('option');
      option.value=String(i);option.textContent='Ligne '+(i+1);
      rowSelector.appendChild(option);
    }
    const rowColors=gridColorControl('Couleur de la ligne',
      ()=>table.rowColors?.[Number(rowSelector.value)]||'',
      value=>{
        const row=Number(rowSelector.value);
        if(value){
          if(!Array.isArray(table.rowColors))table.rowColors=[];
          table.rowColors[row]=value;
        }else if(Array.isArray(table.rowColors)){
          delete table.rowColors[row];
          if(!table.rowColors.some(Boolean))delete table.rowColors;
        }
      });
    const rowTextColors=gridColorControl('Texte de la ligne',
      ()=>table.rowTextColors?.[Number(rowSelector.value)]||'',
      value=>{
        const row=Number(rowSelector.value);
        if(value){
          if(!Array.isArray(table.rowTextColors))table.rowTextColors=[];
          table.rowTextColors[row]=value;
        }else if(Array.isArray(table.rowTextColors)){
          delete table.rowTextColors[row];
          if(!table.rowTextColors.some(Boolean))delete table.rowTextColors;
        }
      });
    rowSelector.addEventListener('change',()=>{
      rowColors.refresh();
      rowTextColors.refresh();
    });
    rowTools.append(rowSelector,rowColors.element,rowTextColors.element);
    body.appendChild(rowTools);

    const columnNavigation=document.createElement('div');
    columnNavigation.className='grid-column-navigation';
    const back=document.createElement('button');back.type='button';back.className='mini-btn';back.textContent='←';back.title='Colonne précédente';
    const forward=document.createElement('button');forward.type='button';forward.className='mini-btn';forward.textContent='→';forward.title='Colonne suivante';
    const columnPicker=document.createElement('select');columnPicker.className='grid-column-picker';columnPicker.setAttribute('aria-label','Colonne du tableau à modifier');
    for(let i=0;i<table.cols;i++){
      const option=document.createElement('option');
      option.value=String(i);option.textContent='Colonne '+(i+1)+(table.headers?.[i]?' — '+table.headers[i]:'');
      columnPicker.append(option);
    }
    const initial=Math.max(0,Math.min(table.cols-1,activeGridEditorColumn.get(block.uid)||0));
    let activeColumn=initial;
    columnPicker.value=String(activeColumn);
    columnNavigation.append(back,columnPicker,forward);
    body.appendChild(columnNavigation);
    const columnsByIndex=Array.from({length:table.cols},()=>[]);
    const scroll=document.createElement('div');
    scroll.className='grid-editor-scroll';
    const editor=document.createElement('table');
    editor.className='cell-grid-editor';

    table.cells.forEach((rowCells,rowIndex)=>{
      const tr=document.createElement('tr');
      rowCells.forEach((cell,colIndex)=>{
        const td=document.createElement('td');
        const rowLabel=document.createElement('div');
        rowLabel.className='grid-editor-row-label';
        rowLabel.textContent='Ligne '+(rowIndex+1)+(table.columns?.[colIndex]?.id?' · '+String(table.columns[colIndex].id):'');
        td.appendChild(rowLabel);
        columnsByIndex[colIndex].push(td);
        td.hidden=(colIndex!==activeColumn);
        const kind=document.createElement('select');
        [
          ['empty','Vide'],['fixed-text','Texte fixe'],['candidate-answer','Réponse candidat'],
          ['select','Liste déroulante'],['choice-option','Choix unique — option'],['unit','Unité'],
          ['image','Image'],['audio','Audio'],['video','Vidéo']
        ].forEach(([v,l])=>{const o=document.createElement('option');o.value=v;o.textContent=l;kind.appendChild(o);});
        kind.value=cell.kind||'empty';
        kind.addEventListener('change',()=>{
          const oldKind=cell.kind;
          cell.kind=kind.value;
          if(cell.kind==='select')cell.responseType='select';
          else if(oldKind==='select'&&cell.responseType==='select')cell.responseType='text';
          if(cell.kind==='unit'&&!cell.questionId){
            // Une unité située après sa valeur dans la même ligne réutilise
            // automatiquement l'ID de cette question pour éviter un doublon.
            const linked=rowCells.slice(0,colIndex).reverse().find(entry=>
              entry&&['candidate-answer','select'].includes(entry.kind)&&entry.questionId);
            if(linked)cell.questionId=linked.questionId;
          }
          if(['candidate-answer','select','choice-option','unit'].includes(cell.kind)&&!cell.questionId){
            cell.questionId=nextQuestionId();
          }
          changed();renderBlocks();
        });
        const cellToolbar=document.createElement('div');
        cellToolbar.className='grid-cell-color-toolbar';
        const cellColors=gridColorControl('Fond',()=>cell.backgroundColor||'',value=>{
          if(value)cell.backgroundColor=value;
          else delete cell.backgroundColor;
        });
        const cellTextColor=gridColorControl('Texte',()=>cell.textColor||'',value=>{
          if(value)cell.textColor=value;
          else delete cell.textColor;
        });
        cellToolbar.append(kind,cellColors.element,cellTextColor.element);
        td.appendChild(cellToolbar);

        if(cell.kind==='fixed-text'||cell.kind==='choice-option') {
          const value=document.createElement('input');
          value.type='text';
          value.placeholder=cell.kind==='fixed-text'?'Texte affiché':'Option affichée';
          value.value=cell.value||'';
          value.addEventListener('input',()=>{cell.value=value.value;changed({typing:true});});
          td.appendChild(value);
        }

        if(['image','audio','video'].includes(cell.kind)) {
          const media=document.createElement('input');
          media.type='file';
          media.accept=cell.kind==='image'?'image/*':cell.kind==='audio'?'audio/*':'video/*';
          media.title='La ressource est embarquée dans le test pour fonctionner hors ligne.';
          media.addEventListener('change',async()=>{
            const file=media.files&&media.files[0];
            if(!file)return;
            cell.mediaName=file.name;
            cell.mediaType=file.type||'';
            cell.value=await readFileAsDataUrl(file);
            changed();
            renderBlocks();
          });
          td.appendChild(media);
          const status=document.createElement('div');
          status.className='file-preview-name';
          status.textContent=cell.mediaName?'Embarqué : '+cell.mediaName:(cell.value?'Ressource embarquée':'Aucune ressource');
          td.appendChild(status);
          if(cell.kind==='image') {
            const alt=document.createElement('input');
            alt.type='text';
            alt.placeholder='Texte alternatif';
            alt.value=cell.alt||'';
            alt.addEventListener('input',()=>{cell.alt=alt.value;changed({typing:true});});
            td.appendChild(alt);
          }
        }

        if(['candidate-answer','select','choice-option','unit'].includes(cell.kind)) {
          const qid=document.createElement('input');
          qid.type='text';qid.placeholder='ID réponse';qid.value=cell.questionId||'';
          qid.title='ID stable de la réponse. Pour un choix unique en ligne, les cellules options peuvent partager le même ID.';
          qid.addEventListener('input',()=>{cell.questionId=Core.cleanId(qid.value);changed({typing:true});});
          td.appendChild(qid);

          const expected=document.createElement('input');
          expected.type='text';
          expected.placeholder=cell.kind==='unit'?'Unités acceptées : kg; kilo; kilogramme':'Réponse attendue';
          expected.title=cell.kind==='unit'?'Écritures acceptées, séparées par un point-virgule':'Réponse(s) attendue(s)';
          expected.value=cell.kind==='unit'?(cell.acceptedUnits||cell.acceptedAnswers||''):(cell.acceptedAnswers||'');
          expected.addEventListener('input',()=>{
            if(cell.kind==='unit')cell.acceptedUnits=expected.value;
            else cell.acceptedAnswers=expected.value;
            changed({typing:true});
          });
          td.appendChild(expected);
          if(cell.kind==='unit'){
            td.appendChild(checkboxField('Unité notée : 1 point',cell.unitScored===true,value=>{
              cell.unitScored=value;changed();
            }));
            const help=document.createElement('small');
            help.className='question-help';
            help.textContent='Même ID que la réponse numérique : l’unité sera évaluée séparément.';
            td.appendChild(help);
          }else{
            if(cell.kind==='candidate-answer'){
              td.appendChild(selectField('Type de réponse',cell.responseType||'text',[
                ['text','Texte'],['number','Nombre'],['number-unit','Nombre + unité'],
                ['duration','Durée / horaire'],['boolean','Vrai / Faux'],
                ['free-text','Réponse libre']
              ],value=>{cell.responseType=value;changed();}));
            }
            const points=document.createElement('input');
            points.type='number';points.min='0';points.step='1';
            points.className='grid-points-input';points.title='Points attribués à la réponse';
            points.setAttribute('aria-label','Points de la réponse');
            points.value=String(cell.points==null?1:cell.points);
            points.addEventListener('input',()=>{
              if(points.value==='')return;
              cell.points=Math.max(0,Number(points.value)||0);
              changed({typing:true});
            });
            const pointsLabel=document.createElement('label');
            pointsLabel.className='grid-points-field';
            pointsLabel.append('Points',points);
            td.appendChild(pointsLabel);
          }

          if(cell.kind==='select'||cell.kind==='choice-option') {
            const options=document.createElement('input');
            options.type='text';
            options.placeholder='Choix proposés : 8; 10; 12';
            options.title='Saisir chaque choix séparé par un point-virgule (;)';
            options.setAttribute('aria-label','Choix proposés dans la liste déroulante');
            options.value=(cell.options||[]).join('; ');
            options.addEventListener('input',()=>{cell.options=splitValues(options.value);changed({typing:true});});
            td.appendChild(options);
          }
        }

        const span=document.createElement('div');
        span.className='cell-span-editor';
        const rs=document.createElement('input');rs.type='number';rs.min='1';rs.value=cell.rowSpan||1;rs.title='Fusion verticale';
        const cs=document.createElement('input');cs.type='number';cs.min='1';cs.value=cell.colSpan||1;cs.title='Fusion horizontale';
        rs.addEventListener('input',()=>{cell.rowSpan=Math.max(1,Number(rs.value)||1);changed({typing:true});});
        cs.addEventListener('input',()=>{cell.colSpan=Math.max(1,Number(cs.value)||1);changed({typing:true});});
        span.append('Fusion ',rs,' × ',cs);
        td.appendChild(span);
        tr.appendChild(td);
      });
      editor.appendChild(tr);
    });
    scroll.appendChild(editor);
    body.appendChild(scroll);
    const showColumn=index=>{
      activeColumn=Math.max(0,Math.min(table.cols-1,index));
      activeGridEditorColumn.set(block.uid,activeColumn);
      columnPicker.value=String(activeColumn);
      back.disabled=activeColumn===0;
      forward.disabled=activeColumn===table.cols-1;
      columnsByIndex.forEach((tds,i)=>tds.forEach(td=>{td.hidden=(i!==activeColumn);}));
      scroll.scrollTop=0;
    };
    back.addEventListener('click',()=>showColumn(activeColumn-1));
    forward.addEventListener('click',()=>showColumn(activeColumn+1));
    columnPicker.addEventListener('change',()=>showColumn(Number(columnPicker.value)));
    showColumn(initial);
  }

  function renderInlineEditor(block,body) {
    if(!block.flowText) block.flowText=flowToText(block.flow||[]);
    body.appendChild(inputField('Banque de mots', (block.wordBank||[]).join('; '), value=>{
      block.wordBank=splitValues(value);changed();
    },{placeholder:'mot 1; mot 2; mot 3'}));
    body.appendChild(inputField('Texte à trous — insérer [[ID_question]] à la place d’un champ',block.flowText,value=>{
      block.flowText=value;
      block.flow=parseInlineFlowText(value);
      changed();
    },{multiline:true,placeholder:'Je prépare des [[colis]].\\n\\nPuis je...'}));
    const info=document.createElement('div');
    info.className='question-help';
    info.textContent='Deux retours à la ligne créent la ligne vide validée entre les phrases.';
    body.appendChild(info);
    const complete=document.createElement('button');
    complete.type='button';complete.className='mini-btn';
    complete.textContent='Créer les questions manquantes';
    complete.title='Ajouter un bloc Question pour chaque [[identifiant]] absent du test';
    complete.addEventListener('click',()=>{
      const existing=new Set(state.blocks.filter(b=>b.type==='question')
        .map(b=>String(b.question?.id||'')));
      for(const b of state.blocks.filter(b=>b.type==='table-grid')){
        for(const row of b.table?.cells||[])for(const cell of row||[]){
          if(cell?.questionId)existing.add(String(cell.questionId));
        }
      }
      const created=[];
      for(const part of block.flow||[]){
        const id=String(part?.questionId||'');
        if(part.type!=='question'||!id||existing.has(id))continue;
        const questionBlock=baseBlock('question');
        questionBlock.question.id=id;
        questionBlock.question.prompt=id.replace(/_/g,' ');
        questionBlock.zone=block.zone||'left';
        created.push(questionBlock);
        existing.add(id);
      }
      if(!created.length){
        const notice=document.createElement('small');
        notice.textContent='Toutes les questions de ce texte sont déjà reliées.';
        body.appendChild(notice);return;
      }
      const at=state.blocks.indexOf(block);
      state.blocks.splice(at+1,0,...created);
      changed();renderBlocks();
    });
    body.appendChild(complete);
  }

  function renderMultipleTableEditor(block,body) {
    const t=block.tableDefinition||(block.tableDefinition={id:uid('tabledef'),title:'',headers:['Colonne 1','Colonne 2'],questionIds:[]});
    const row=document.createElement('div');
    row.className='field-row cols-3';
    const legacy=Boolean(state.sourceDefinition?.presentation?.tables);
    const locked={readOnly:true,title:'Tableau historique : structure protégée pour conserver les identifiants de questions et le barème.'};
    row.append(
      inputField('ID du tableau',t.id||'',value=>{t.id=Core.cleanId(value);changed();},legacy?locked:{}),
      inputField('Titre',t.title||'',value=>{t.title=value;changed();}),
      inputField('En-têtes', (t.headers||[]).join('; '),value=>{t.headers=splitValues(value);changed();},legacy?locked:{})
    );
    body.appendChild(row);
    body.appendChild(inputField('Questions utilisées — IDs séparés par ;',(t.questionIds||[]).join('; '),value=>{
      t.questionIds=splitValues(value);changed();
    },legacy?{...locked,placeholder:'Identifiants conservés'}:{placeholder:'question_1; question_2'}));
    if(legacy){
      const notice=document.createElement('small');
      notice.className='question-help';
      notice.textContent='Structure d’origine protégée : vous pouvez modifier le titre et le style. Les IDs et les en-têtes restent fixes pour garantir les questions et leur correction.';
      body.appendChild(notice);
    }
  }

  function normalizedSearch(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  }

  function blockByUid(uidValue) {
    return state.blocks.find(block => String(block.uid) === String(uidValue || '')) || null;
  }

  async function useLibraryImage(imageId) {
    if(imageSelectionBusy)return false;
    imageSelectionBusy=true;
    try {
    // Icônes et illustrations utilisent la même fenêtre et les mêmes
    // destinations. Les icônes déjà livrées sont réutilisées en mémoire :
    // aucun doublon dans la bibliothèque stockée ni nouvel accès disque.
    const icon=String(imageId||'').startsWith('kaloneo-icon:')
      ?iconLibrary().find(x=>x.id===String(imageId).slice('kaloneo-icon:'.length))
      :null;
    const result=icon?{ok:true,image:{
      name:icon.label,mime:icon.data?.match(/^data:([^;,]+)/)?.[1]||'image/png',
      data:icon.data
    }}:await window.sebEvalPro?.kaloneoGetImage?.(imageId);
    if(!result || result.ok!==true || !result.image?.data) throw new Error(result?.error||'Image introuvable');

    if(state.imageLibraryTargetUid==='__page_background__'){
      const name=$('page-background-image-name');
      name.dataset.imageData=result.image.data;
      name.dataset.imageName=result.image.name||'image';
      name.textContent=result.image.name||'Image';
      $('page-background-type').value='image';
      syncPageBackgroundOptions();
      changed();
      $('image-library-dialog')?.close();
      return true;
    }

    if(String(state.imageLibraryTargetUid||'').startsWith('__supplementary__:')){
      const id=String(state.imageLibraryTargetUid).slice('__supplementary__:'.length);
      if(!Supplementary?.setImage(id,result.image))return false;
      $('image-library-dialog')?.close();
      return true;
    }
    if(String(state.imageLibraryTargetUid||'').startsWith('__block_background__:')){
      const uidValue=String(state.imageLibraryTargetUid).slice('__block_background__:'.length);
      const block=blockByUid(uidValue);
      if(!block)return false;
      block.backgroundImage=result.image.data;
      changed();renderBlocks();$('image-library-dialog')?.close();return true;
    }
    const target=blockByUid(state.imageLibraryTargetUid);
    if(!target || !['image','image-selection'].includes(target.type)) return false;
    target.mediaName=result.image.name||'image';
    target.mediaType=result.image.mime||'image/*';
    target.mediaData=result.image.data;
    target.mediaAlt=target.mediaAlt||result.image.name||'Image';
    target.mediaPlaceholder='';
    changed();
    renderBlocks();
    $('image-library-dialog')?.close();
    return true;
    } finally { imageSelectionBusy=false; }
  }

  function pumpImageThumbs() {
    while(activeImageThumbs<4&&imageThumbQueue.length){
      const task=imageThumbQueue.shift();
      if(task.generation!==imageThumbGeneration||!task.img.isConnected)continue;
      activeImageThumbs++;
      Promise.resolve(window.sebEvalPro?.kaloneoGetImage?.(task.id))
        .then(result=>{
          if(task.generation===imageThumbGeneration&&task.img.isConnected&&result?.ok&&result.image?.data)
            task.img.src=result.image.data;
        }).catch(()=>{}).finally(()=>{activeImageThumbs--;pumpImageThumbs();});
    }
  }
  function queueImageThumb(id,img,generation) {
    if(img.dataset.queued==='true')return;
    img.dataset.queued='true';
    imageThumbQueue.push({id,img,generation});
    pumpImageThumbs();
  }

  function renderImageLibrary() {
    const root=$('image-library-list');
    if(!root)return;
    const search=normalizedSearch($('image-library-search')?.value||'');
    // Galerie de conception : exclure les ressources techniques et regrouper les copies.
    // Ne jamais modifier state.imageLibraryItems, les fichiers stockés ni les IDs utilisés par les tests.
    const galleryApi=window.KaloneoImageGallery;
    const systemIcons=iconLibrary().filter(icon=>/^data:image\//i.test(icon.data||''))
      .map(icon=>({
        id:'kaloneo-icon:'+icon.id,name:icon.label,
        data:icon.data,kind:'icon',category:'Icônes',theme:'Icônes',
        systemProvided:true,orientation:'',sourceName:icon.id
      }));
    const gallery=galleryApi.prepare([...(state.imageLibraryItems||[]),...systemIcons]);
    const visibleImages=gallery.images;
    const getTheme=galleryApi.theme;
    const themeSelect=$('image-library-theme');
    const themes=[...new Set(visibleImages.map(getTheme).filter(Boolean))]
      .sort((a,b)=>{
        const order=['Illustrations','Icônes','Mes images','Images V1'];
        const ai=order.indexOf(a),bi=order.indexOf(b);
        return ai>=0&&bi>=0?ai-bi:ai>=0?-1:bi>=0?1:a.localeCompare(b,'fr');
      });
    if(themeSelect){
      const definitions=[
        ['__current__','Images courantes'],
        ['','Tous les thèmes'],
        ...themes.map(theme=>[theme,theme])
      ];
      // Ne pas reconstruire le <select> lors du changement de thème :
      // Electron peut fermer son menu natif et annuler la sélection en cours.
      const current=[...themeSelect.options].map(option=>[option.value,option.text]);
      const needsThemeOptionsUpdate=definitions.length!==current.length||
        definitions.some(([value,label],i)=>current[i]?.[0]!==value||current[i]?.[1]!==label);
      if(needsThemeOptionsUpdate){
        const previous=themeSelect.value;
        themeSelect.replaceChildren(...definitions.map(([value,label])=>new Option(label,value)));
        themeSelect.value=definitions.some(([value])=>value===previous)?previous:'__current__';
      }
    }
    const themeFilter=String(themeSelect?.value??'__current__');
    const orientationFilter=String($('image-library-orientation')?.value||'');
    const items=visibleImages.filter(item=>{
      if(!galleryApi.matchesTheme(item,themeFilter))return false;
      if(orientationFilter&&String(item.orientation||'')!==orientationFilter)return false;
      const haystack=normalizedSearch([item.name,item.category,item.theme,getTheme(item),
        item.orientation,item.sourceName].filter(Boolean).join(' '));
      return !search||haystack.includes(search);
    });
    const filterKey=JSON.stringify([search,themeFilter,orientationFilter]);
    if(filterKey!==imageLibraryFilterKey){
      imageLibraryFilterKey=filterKey;
      imageLibraryLimit=72;
    }
    if(imageThumbObserver)imageThumbObserver.disconnect();
    imageThumbGeneration++;
    imageThumbQueue.length=0;
    root.replaceChildren();
    const status=$('image-library-status');
    if(status){
      const shown=Math.min(items.length,imageLibraryLimit);
      status.textContent=shown+' image'+(shown>1?'s':'')+' affichée'+(shown>1?'s':'')+
        (items.length>shown?' sur '+items.length+' disponibles':'')+
        (gallery.hiddenTechnical?', '+gallery.hiddenTechnical+' image'+(gallery.hiddenTechnical>1?'s':'')+' du programme masquée'+(gallery.hiddenTechnical>1?'s':''):'')+
        (gallery.duplicates?', '+gallery.duplicates+' doublon'+(gallery.duplicates>1?'s':'')+' regroupé'+(gallery.duplicates>1?'s':''):'')+
        (state.imageLibraryTargetUid?' — choisissez une image pour le bloc courant.':' — bibliothèque générale.');
    }

    const thumbGeneration=imageThumbGeneration;
    imageThumbObserver=typeof IntersectionObserver==='function'?
      new IntersectionObserver(entries=>{
        for(const entry of entries){
          if(!entry.isIntersecting)continue;
          imageThumbObserver?.unobserve(entry.target);
          const img=entry.target.querySelector('img');
          if(img)queueImageThumb(entry.target.dataset.imageId,img,thumbGeneration);
        }
      },{root,rootMargin:'140px'}):null;
    items.slice(0,imageLibraryLimit).forEach((item,index)=>{
      const card=document.createElement('article');
      card.className='image-library-card';
      const preview=document.createElement('div');
      preview.className='image-library-preview';
      preview.dataset.imageId=item.id;
      const img=document.createElement('img');
      img.alt=item.name||'Image';
      img.loading='lazy';
      preview.appendChild(img);
      const info=document.createElement('div');
      info.className='image-library-info';
      const title=document.createElement('strong');title.textContent=item.name||item.id;
      const meta=document.createElement('span');
      meta.textContent=[getTheme(item),item.orientation,
        item.kind==='icon'?'icône':item.systemProvided?'fournie':'personnelle'].filter(Boolean).join(' • ');
      info.append(title,meta);
      card.append(preview,info);

      if(state.imageLibraryTargetUid){
        const use=document.createElement('button');
        use.type='button';
        use.className='mini-btn image-library-use';
        use.textContent='Utiliser';
        use.addEventListener('click',()=>{
          if(imageSelectionBusy)return;
          use.disabled=true;
          use.textContent='Sélection en cours…';
          useLibraryImage(item.id)
            .catch(error=>alert('Image impossible à utiliser : '+String(error?.message||error)))
            .finally(()=>{if(use.isConnected){use.disabled=false;use.textContent='Utiliser';}});
        });
        card.appendChild(use);
      }

      root.appendChild(card);
      if(item.kind==='icon'){
        // L'icône est déjà en mémoire grâce à icon-library.js.
        img.src=item.data;
      }else if(index<8||!imageThumbObserver){
        queueImageThumb(item.id,img,thumbGeneration);
      }else imageThumbObserver.observe(preview);
    });
    if(items.length>imageLibraryLimit){
      const more=document.createElement('button');
      more.type='button';more.className='mini-btn image-library-more';
      more.textContent='Afficher davantage ('+(items.length-imageLibraryLimit)+' restantes)';
      more.addEventListener('click',()=>{
        imageLibraryLimit+=72;
        renderImageLibrary();
      });
      root.appendChild(more);
    }
    if(!items.length){
      const empty=document.createElement('p');empty.className='muted';empty.textContent='Aucune image trouvée.';root.appendChild(empty);
    }
  }

  async function reloadImageLibrary() {
    const result=await window.sebEvalPro?.kaloneoListImages?.();
    if(!result||result.ok!==true) throw new Error(result?.error||'Bibliothèque d’images inaccessible');
    state.imageLibraryItems=Array.isArray(result.images)?result.images:[];
    renderImageLibrary();
  }

  async function openImageLibrary(targetUid=null) {
    const dialog=$('image-library-dialog');
    if(imageLibraryOpening||dialog?.open)return;
    imageLibraryOpening=true;
    state.imageLibraryTargetUid=targetUid||null;
    imageLibraryFilterKey='';
    imageLibraryLimit=72;
    // Chaque ouverture, y compris après « Retirer l’image », commence
    // avec les images courantes. Les anciennes recherches et orientations
    // ne doivent pas faire croire que le menu Thème ne répond plus.
    const themeSelect=$('image-library-theme');
    if(themeSelect)themeSelect.value='__current__';
    const orientationSelect=$('image-library-orientation');
    if(orientationSelect)orientationSelect.value='';
    const searchInput=$('image-library-search');
    if(searchInput)searchInput.value='';
    if(imageSearchTimer){clearTimeout(imageSearchTimer);imageSearchTimer=null;}
    try{
      // Montrer d'abord la fenêtre ; les métadonnées/images arrivent ensuite.
      dialog.showModal();
      $('image-library-status').textContent='Chargement de la bibliothèque…';
      await reloadImageLibrary();
    }catch(error){
      if(dialog?.open)dialog.close();
      throw error;
    }finally{imageLibraryOpening=false;}
  }

  async function importImages(files) {
    const list=[...(files||[])];
    if(!list.length)return;
    let added=0,duplicates=0,failed=0,firstImageId=null;
    for(const file of list){
      if(!String(file.type||'').startsWith('image/')){failed++;continue;}
      try{
        const data=await readFileAsDataUrl(file);
        const result=await window.sebEvalPro?.kaloneoSaveImage?.({
          name:file.name,
          mime:file.type,
          data,
          category:'Mes images KALONÉO'
        });
        if(result?.ok){
          if(!firstImageId&&result.image?.id)firstImageId=result.image.id;
          if(result.duplicate)duplicates++;else added++;
        }else failed++;
      }catch(_){failed++;}
    }
    await reloadImageLibrary();
    const status=$('image-library-status');
    if(status)status.textContent=added+' ajoutée'+(added>1?'s':'')+', '+duplicates+' déjà présente'+(duplicates>1?'s':'')+(failed?', '+failed+' refusée'+(failed>1?'s':''):'')+'.';
    return {added,duplicates,failed,firstImageId};
  }

  async function importImageFromPc() {
    const input=$('image-library-pc-file');
    const file=input?.files?.[0];
    if(input)input.value='';
    if(pcImportBusy)return;
    pcImportBusy=true;
    const button=$('image-library-import-pc');
    if(button){button.disabled=true;button.textContent='Import en cours…';}
    try{
      if(!file)return;
      const status=$('image-library-status');
      if(status)status.textContent='Import de « '+file.name+' » en cours…';
      const result=await importImages([file]);
      if(result?.firstImageId){
        if(state.imageLibraryTargetUid)await useLibraryImage(result.firstImageId);
        return;
      }
      if(result?.failed)alert('Cette image n’a pas pu être importée. Choisissez un fichier image valide.');
    }finally{
      pcImportBusy=false;
      pcPickerBusy=false;
      if(button){button.disabled=false;button.textContent='Importer une image du PC';}
    }
  }

  async function importImageZip() {
    const result=await window.sebEvalPro?.kaloneoImportImageZip?.();
    if(!result || result.canceled) return;
    if(result.ok!==true) throw new Error(result.error||'Import ZIP impossible');
    await reloadImageLibrary();
    const status=$('image-library-status');
    if(status){
      const themes=(result.themes||[]).length;
      status.textContent=result.added+' image'+(result.added>1?'s':'')+' ajoutée'+(result.added>1?'s':'')+
        ', '+result.duplicates+' doublon'+(result.duplicates>1?'s':'')+
        (result.failed?', '+result.failed+' refusée'+(result.failed>1?'s':''):'')+
        ' — '+themes+' thème'+(themes>1?'s':'')+' détecté'+(themes>1?'s':'')+'.';
    }
  }

  function appendImageScaleControls(parent,block,property,title) {
    const panel=document.createElement('div');panel.className='image-scale-controls';
    const label=document.createElement('label');label.textContent=title;
    const slider=document.createElement('input');
    slider.type='range';slider.min='10';slider.max='100';slider.step='1';
    const output=document.createElement('output');
    const initial=Number(block[property]);
    slider.value=String(initial>=10&&initial<=100?initial:100);
    output.textContent=slider.value+' %';
    const updateSize=next=>{
      block[property]=Math.max(10,Math.min(100,Math.round(Number(next)||100)));
      slider.value=String(block[property]);
      output.textContent=slider.value+' %';
      changed();
    };
    slider.addEventListener('input',()=>updateSize(slider.value));
    const button=(caption,tip,action)=>{
      const node=document.createElement('button');
      node.type='button';node.className='mini-btn';node.textContent=caption;node.title=tip;
      node.addEventListener('click',action);return node;
    };
    label.appendChild(slider);
    panel.append(label,
      button('−','Réduire de 5 %',()=>updateSize(Number(slider.value)-5)),
      output,
      button('+','Agrandir de 5 %',()=>updateSize(Number(slider.value)+5)),
      button('100 %','Taille initiale',()=>updateSize(100))
    );
    parent.appendChild(panel);
  }

  function renderMediaEditor(block,body) {
    const kindLabel=block.type==='image'?'image':block.type==='audio'?'audio':'vidéo';
    const articleLabel=block.type==='image'?'l’image':block.type==='audio'?'l’audio':'la vidéo';

    // Les images se choisissent uniquement dans la bibliothèque KALONÉO.
    // L'import d'images se fait dans Import / Export ; aucun sélecteur fichier
    // caché n'est créé dans les blocs Image. Audio et vidéo conservent leur entrée.
    if(block.type!=='image'){
      const label=document.createElement('label');
      label.textContent='Fichier '+kindLabel;
      const input=document.createElement('input');
      input.type='file';
      input.accept=block.type==='audio'?'audio/*':'video/*';
      input.title='Choisir un fichier remplace uniquement le média de ce bloc.';
      input.addEventListener('change',async()=>{
        const file=input.files&&input.files[0];
        if(!file)return;
        block.mediaName=file.name;
        block.mediaType=file.type||'';
        block.mediaData=await readFileAsDataUrl(file);
        block.mediaPlaceholder='';
        changed();
        renderBlocks();
      });
      label.appendChild(input);
      body.appendChild(label);
    }

    // Présentation uniquement : les actions et leurs gestionnaires restent inchangés.
    // La même ligne contient Choisir/Changer, le nom et Retirer l'image.
    let imageActionRow=null;
    if(block.type==='image'){
      imageActionRow=document.createElement('div');
      imageActionRow.className='builder-image-action-row';
      const choose=document.createElement('button');
      choose.type='button';choose.className='mini-btn choose-library-image';
      choose.textContent=block.mediaData?'Changer l’image':'Choisir une image';
      choose.addEventListener('click',()=>openImageLibrary(block.uid).catch(error=>alert('Bibliothèque d’images inaccessible : '+String(error?.message||error))));
      imageActionRow.appendChild(choose);
      body.appendChild(imageActionRow);
      appendImageScaleControls(body,block,'imageScale','Taille de l’image dans le bloc');
      body.appendChild(selectField('Alignement de l’image',String(block.imageAlign||'center'),[
        ['center','Centré'],['left','Gauche'],['right','Droite']
      ],value=>{block.imageAlign=value;changed();}));
    }
    body.appendChild(inputField('Texte alternatif',block.mediaAlt||'',value=>{block.mediaAlt=value;changed();}));

    const name=document.createElement('div');
    name.className='file-preview-name';
    const feminine=block.type!=='audio';
    name.textContent=block.mediaData
      ?(block.type==='image'
        ?(block.mediaName||'Image intégrée')
        :kindLabel.charAt(0).toUpperCase()+kindLabel.slice(1)+' sélectionné'+(feminine?'e':'')+' : '+(block.mediaName||kindLabel+' intégré'+(feminine?'e':''))
      )
      :(block.mediaPlaceholder||'Aucun fichier sélectionné');
    if(imageActionRow){
      name.title=name.textContent;
      imageActionRow.appendChild(name);
    } else {
      body.appendChild(name);
    }

    const remove=document.createElement('button');
    remove.type='button';
    remove.className='mini-btn danger remove-media';
    remove.textContent='Retirer '+articleLabel;
    remove.disabled=!Boolean(block.mediaData||block.mediaName||block.mediaPlaceholder);
    remove.title='Retire uniquement le média. Le bloc, sa zone et les autres contenus de la page sont conservés.';
    remove.addEventListener('click',()=>{
      if(!confirm('Retirer uniquement '+articleLabel+' ? Le bloc et les autres contenus seront conservés.')) return;
      Core.clearMediaBlock(block);
      changed();
      renderBlocks();
    });
    if(imageActionRow)imageActionRow.appendChild(remove);
    else body.appendChild(remove);
  }

  function insertQuestionAtCursor(block,index,textarea) {
    const position=typeof textarea.selectionStart==='number'?textarea.selectionStart:String(block.text||'').length;
    const source=String(block.text||'');
    const before=source.slice(0,position);
    const after=source.slice(position);
    block.text=before;

    const questionBlock=baseBlock('question');
    questionBlock.zone=block.zone||'left';
    questionBlock.question.id=nextQuestionId();

    const additions=[questionBlock];
    if(after) {
      const tail=baseBlock('text');
      tail.zone=block.zone||'left';
      tail.text=after;
      additions.push(tail);
    }
    state.sourceDefinition=null;
    state.blocks.splice(index+1,0,...additions);
    changed();
    renderBlocks();

  }

  const BLOCK_BACKGROUND_CHOICES=[
    ['','Standard / transparent'],
    ['#FFFFFF','Blanc'],
    ['#EEF6FD','Bleu très clair'],
    ['#EEF9F2','Vert très clair'],
    ['#FFF8DD','Jaune très clair'],
    ['#FFF0E2','Orange très clair'],
    ['#FDEFF4','Rose très clair'],
    ['#F3F5F7','Gris très clair']
  ];

  function renderBlockStyleEditor(block,body) {
    const panel=document.createElement('div');
    panel.className='block-style-editor';
    const title=document.createElement('strong');
    title.textContent='Style du bloc';
    const row=document.createElement('div');
    row.className='field-row';

    const font=selectField('Taille de police',String(block.fontSize||''),[
      ['','Taille standard'],['14','14 px'],['16','16 px'],['18','18 px'],['20','20 px'],['22','22 px'],['24','24 px']
    ],value=>{block.fontSize=value?Number(value):'';changed();});
    const background=selectField('Couleur du bloc',String(block.backgroundColor||''),BLOCK_BACKGROUND_CHOICES,value=>{
      // Changement visuel : ne pas détruire le select actif ni les autres champs.
      block.backgroundColor=value;
      changed();
    });

    row.append(font,background);
    if(block.type==='text'){
      const textOptions=document.createElement('div');textOptions.className='field-row';
      const alignment=selectField('Alignement',String(block.textAlign||''),[
        ['','Standard'],['left','Gauche'],['center','Centré'],['right','Droite']
      ],value=>{block.textAlign=value;changed();});
      const spacing=selectField('Interligne',String(block.lineHeight||''),[
        ['','Standard'],['1','Compact (1,0)'],['1.2','Normal (1,2)'],['1.5','Aéré (1,5)'],['1.8','Large (1,8)']
      ],value=>{block.lineHeight=value;changed();});
      textOptions.append(alignment,spacing);panel.append(title,row,textOptions);
    }
    // Le bloc Image utilise exclusivement son image principale (pas un second sélecteur de fond).
    // Conserver les données de fond héritées en mémoire/à l'export sans les supprimer.
    if(block.type==='image'){
      row.replaceChildren(background);
      panel.append(title,row);
      body.appendChild(panel);
      return;
    }

    const bgLabel=document.createElement('strong');
    bgLabel.textContent='Image de fond du bloc (derrière le texte)';
    const choose=document.createElement('button');choose.type='button';choose.className='mini-btn choose-background-image';
    choose.textContent=block.backgroundImage?'Changer l’image de fond':'Choisir une image de fond';
    choose.addEventListener('click',()=>openImageLibrary('__block_background__:'+block.uid).catch(error=>alert(String(error?.message||error))));
    const controls=document.createElement('div');controls.className='field-row';
    controls.appendChild(choose);
    if(block.backgroundImage){
      const remove=document.createElement('button');remove.type='button';remove.className='mini-btn danger remove-background-image';
      remove.textContent='Retirer le fond';
      remove.addEventListener('click',()=>{block.backgroundImage='';changed();renderBlocks();});
      controls.appendChild(remove);
    }
    if(block.type!=='text')panel.append(title,row);
    panel.append(bgLabel,controls);
    // Ne pas afficher les réglages inutiles avant qu'une image ne soit choisie.
    if(block.backgroundImage){
      const more=document.createElement('details');
      more.className='block-image-options';
      const heading=document.createElement('summary');
      heading.textContent='Réglages de l’image de fond';
      more.appendChild(heading);
      const position=selectField('Position',String(block.backgroundPosition||'right bottom'),[
        ['right bottom','Bas droite'],['center center','Centre'],['left bottom','Bas gauche'],['right center','Droite']
      ],v=>{block.backgroundPosition=v;changed();});
      const fit=selectField('Taille du fond',String(block.backgroundFit||'decorative'),[
        ['decorative','Illustration partielle'],['contain','Image entière'],['cover','Remplir']
      ],v=>{block.backgroundFit=v;changed();});
      const opacity=inputField('Visibilité image (%)',block.backgroundOpacity??100,v=>{
        block.backgroundOpacity=Math.max(0,Math.min(100,Number(v)||0));changed();
      },{type:'number',min:0,max:100});
      const options=document.createElement('div');options.className='field-row cols-3';
      options.append(position,fit,opacity);more.appendChild(options);
      appendImageScaleControls(more,block,'backgroundScale','Taille de l’image de fond');
      panel.appendChild(more);
    }
    body.appendChild(panel);
  }

  function applyPreviewBlockStyle(node,block) {
    if(!node)return node;
    node.classList.add('preview-stylable-block');
    const size=Number(block?.fontSize);
    if(Number.isFinite(size)&&size>=10&&size<=40){
      node.style.fontSize=size+'px';
      node.dataset.kaloneoFontSize=String(size);
    }
    const background=String(block?.backgroundColor||'').trim();
    if(background){
      node.style.backgroundColor=background;
      node.style.padding=node.style.padding||'9px 10px';
      node.style.borderRadius=node.style.borderRadius||'8px';
    }
    if(block?.type==='text'){
      if(['left','center','right'].includes(block.textAlign))node.style.textAlign=block.textAlign;
      if(['1','1.2','1.5','1.8'].includes(String(block.lineHeight||'')))node.style.lineHeight=String(block.lineHeight);
    }
    if(block?.backgroundImage){
      const opacity=Math.max(0,Math.min(100,Number(block.backgroundOpacity??100)||0))/100;
      node.style.backgroundImage='linear-gradient(rgba(255,255,255,'+(1-opacity)+'),rgba(255,255,255,'+(1-opacity)+')),url('+JSON.stringify(String(block.backgroundImage).startsWith('imageqcm/')?'../'+block.backgroundImage:block.backgroundImage)+')';
      node.style.backgroundRepeat='no-repeat';
      node.style.backgroundPosition=String(block.backgroundPosition||'right bottom');
      const bgScale=Number(block.backgroundScale);node.style.backgroundSize=bgScale>=10&&bgScale<100?bgScale+'% auto':block.backgroundFit==='cover'?'cover':block.backgroundFit==='contain'?'contain':'auto 78%';
    }
    return node;
  }

  function renderImageSelectionEditor(block,body){
    const q=block.question||(block.question=baseQuestion());
    ensureQuestionId(q);
    const layout=document.createElement('div');layout.className='field-row cols-3';
    layout.append(
      inputField('ID de la question',q.id,()=>{},{readOnly:true,title:'Identifiant unique conservé dans le JSON'}),
      inputField('Consigne',q.prompt||'',value=>{q.prompt=value;changed({typing:true});},{placeholder:'Sélectionnez 25 % des images'}),
      inputField('Titre affiché',block.label||'',value=>{block.label=value;changed({typing:true});},{placeholder:'25 % de 8 objets'})
    );
    body.appendChild(layout);
    const numbers=document.createElement('div');numbers.className='field-row cols-3';
    numbers.append(
      inputField('Nombre d’images (1 à 60)',block.totalItems||4,value=>{
        if(value==='')return;const n=Number(value);if(!Number.isInteger(n)||n<1||n>60)return;
        block.totalItems=n;block.acceptedCount=Math.min(Number(block.acceptedCount)||0,n);
        changed({typing:true});
      },{type:'number',min:1,max:60}),
      inputField('Nombre à sélectionner',block.acceptedCount??3,value=>{
        if(value==='')return;const n=Number(value);
        if(!Number.isInteger(n)||n<0||n>Number(block.totalItems||4))return;
        block.acceptedCount=n;changed({typing:true});
      },{type:'number',min:0,max:60}),
      inputField('Points',q.points==null?1:q.points,value=>{
        if(value==='')return;const n=Number(value);if(!Number.isFinite(n)||n<0)return;
        q.points=n;changed({typing:true});
      },{type:'number',min:0})
    );
    body.appendChild(numbers);
    const controls=document.createElement('div');controls.className='field-row';
    const choose=document.createElement('button');choose.type='button';choose.className='mini-btn choose-library-image';
    choose.textContent=block.mediaData?'Changer l’image des objets':'Choisir l’image des objets';
    choose.addEventListener('click',()=>openImageLibrary(block.uid).catch(error=>alert(String(error?.message||error))));
    controls.appendChild(choose);
    const picture=document.createElement('span');picture.className='file-preview-name';
    picture.textContent=block.mediaData?'Image embarquée : '+(block.mediaName||'Image'):'Image requise avant enregistrement';
    controls.appendChild(picture);
    if(block.mediaData){
      const clear=document.createElement('button');clear.type='button';clear.className='mini-btn danger';clear.textContent='Retirer';
      clear.addEventListener('click',()=>{block.mediaData='';block.mediaName='';block.mediaType='';changed();renderBlocks();});
      controls.appendChild(clear);
    }
    body.appendChild(controls);
    body.appendChild(checkboxField('Présentation en nuage',block.cloud===true,value=>{block.cloud=value;changed();}));
    const note=document.createElement('small');note.className='question-help';
    note.textContent='Toutes les images sont interchangeables : le nombre sélectionné est noté, pas leur position.';
    body.appendChild(note);
  }

  function renderBlockBody(block,body,index) {
    body.innerHTML='';
    renderBlockStyleEditor(block,body);
    Supplementary?.addBlockControls(block,body);
    if(block.type==='text') {
      const field=inputField('Texte',block.text,value=>{block.text=value;changed({typing:true});},{
        multiline:true,
        placeholder:'Texte affiché au candidat',
        title:'Écrivez le contenu librement. Placez le curseur puis utilisez « Insérer une Question au curseur ».'
      });
      body.appendChild(field);
      const textarea=field.querySelector('textarea');
      // Mémoriser si un véritable curseur a été placé par l'utilisateur.
      // Sinon, « Dans le texte » insère le bouton à la fin du contenu.
      textarea.addEventListener('focus',()=>{textarea.dataset.documentCaretReady='1';});
      body.appendChild(createTextFormatToolbar(textarea,value=>{block.text=value;}));
      const insert=document.createElement('button');
      insert.type='button';
      insert.className='mini-btn insert-question-at-cursor';
      insert.textContent='+ Insérer une Question au curseur';
      insert.title='Coupe le texte à la position du curseur et insère ici un bloc Question avec un ID automatique stable.';
      insert.addEventListener('click',()=>insertQuestionAtCursor(block,index,textarea));
      body.appendChild(insert);
      return;
    }
    if(block.type==='html'||block.type==='html-js') {
      body.appendChild(inputField('HTML',block.html,value=>{block.html=value;changed();},{multiline:true,placeholder:'<div>...</div>'}));
      if(block.type==='html-js') body.appendChild(inputField('JavaScript associé',block.js,value=>{block.js=value;changed();},{multiline:true,placeholder:'Code local au bloc'}));
      return;
    }
    if(['image','audio','video'].includes(block.type)) {renderMediaEditor(block,body);return;}
    if(block.type==='text-editor') {
      block.config=Object.assign({fileSimulation:true,imageSimulation:true,scoringProfile:'none'},block.config||{});
      const panel=document.createElement('div');
      panel.className='text-editor-builder-options';

      const title=document.createElement('strong');
      title.textContent='Outil Éditeur de texte KALONÉO';
      panel.appendChild(title);

      const profileLabel=document.createElement('label');
      profileLabel.textContent='Profil de correction';
      const profile=document.createElement('select');
      profile.innerHTML='<option value="none">Aucune correction automatique</option><option value="seb-bureautique-v1">Traitement de texte SEB — barème /8</option>';
      profile.value=block.config.scoringProfile||'none';
      profile.addEventListener('change',()=>{block.config.scoringProfile=profile.value;changed();});
      profileLabel.appendChild(profile);
      panel.appendChild(profileLabel);

      const flags=document.createElement('div');
      flags.className='option-row compact';
      const fileLabel=document.createElement('label');
      const fileCb=document.createElement('input');
      fileCb.type='checkbox';fileCb.checked=block.config.fileSimulation!==false;
      fileCb.addEventListener('change',()=>{block.config.fileSimulation=fileCb.checked;changed();});
      fileLabel.append(fileCb,document.createTextNode(' Menu Fichier simulé'));
      const imageLabel=document.createElement('label');
      const imageCb=document.createElement('input');
      imageCb.type='checkbox';imageCb.checked=block.config.imageSimulation!==false;
      imageCb.addEventListener('change',()=>{block.config.imageSimulation=imageCb.checked;changed();});
      imageLabel.append(imageCb,document.createTextNode(' Insertion d’image simulée'));
      flags.append(fileLabel,imageLabel);
      panel.appendChild(flags);

      const help=document.createElement('p');
      help.className='muted';
      help.textContent='Le même moteur d’édition est réutilisé dans tous les tests KALONÉO. Les fenêtres Ouvrir, Image et Enregistrer restent internes à SEB EvalPro.';
      panel.appendChild(help);
      body.appendChild(panel);
      return;
    }
    if(block.type==='image-selection') {renderImageSelectionEditor(block,body);return;}
    if(block.type==='question') {renderQuestionEditor(block,body);return;}
    if(block.type==='response-table') {renderResponseTableEditor(block,body);return;}
    if(block.type==='table-grid') {renderGridEditor(block,body);return;}
    if(block.type==='inline-flow') {renderInlineEditor(block,body);return;}
    if(block.type==='multiple-tables') {renderMultipleTableEditor(block,body);}
  }


  // Paramètres du contrat KALTEST : entrées/sorties et lignes du Bilan SEB.
  const CONTRACT_TYPES=[
    ['number','Nombre décimal'],['integer','Nombre entier'],['string','Texte'],
    ['boolean','Oui / Non'],['duration','Durée'],['number-list','Liste de nombres'],
    ['duration-list','Liste de durées'],['json','Données structurées']
  ];
  const CONTRACT_ID_RE=/^[a-z0-9][a-z0-9._-]*$/;
  const contractLines=()=>Array.isArray(window.KaloneoBilanCatalog)?window.KaloneoBilanCatalog:[];
  const contractLine=id=>contractLines().find(line=>line.id===id);
  // Interface principale : une seule ligne institutionnelle et aucun
  // paramétrage technique score / score_max demandé à l'utilisateur.
  function renderSimpleBilanLink(){
    const control=$('bilan-simple-line'),help=$('bilan-simple-help');
    if(!control||!window.KaloneoSimpleBilanLink)return;
    const category=$('test-category')?.value||'';
    const specialPage=category==='introduction'||category==='fin';
    const options=specialPage?[]:window.KaloneoSimpleBilanLink.options(category,contractLines());
    const selected=String(state.bilanContributions?.[0]?.lineId||'');
    control.replaceChildren();
    const placeholder=document.createElement('option');
    placeholder.value='';
    placeholder.textContent=options.length
      ?'Choisir la ligne institutionnelle obligatoire…'
      :'Aucune ligne officielle compatible avec cette catégorie';
    control.appendChild(placeholder);
    for(const line of options){
      const opt=document.createElement('option');
      opt.value=line.id;
      opt.textContent=line.subsection+' — '+line.label;
      control.appendChild(opt);
    }
    if(selected&&options.some(line=>line.id===selected))control.value=selected;
    else control.value='';
    // « V1 protégée » impose sauvegarde + copie de sécurité, pas un menu grisé.
    // Les mêmes 18 lignes officielles sont disponibles pour V1 et tests inédits.
    control.disabled=options.length===0;
    if(help){
      if(specialPage) help.textContent='Introduction et fin de parcours : aucune notation, aucune ligne du bilan institutionnel.';
      else if(control.value){
        const line=contractLine(control.value);
        help.textContent=line?.mode==='manual'
          ?'Activité pratique : cette ligne sera évaluée exclusivement par l’administrateur dans le pré-bilan.'
          :'La note sera calculée automatiquement : bonnes réponses ÷ réponses possibles × 100. La même ligne servira aux bilans individuel et général.';
      }else help.textContent=state.sourceProtectedVersion
        ?'V1 : sélectionnez une ligne officielle compatible. La V1 ne sera modifiée que lors de « Enregistrer V1 », avec copie de sécurité.'
        :'Sélection obligatoire : sans cette liaison, ce nouveau test ne peut pas être enregistré.';
    }
  }
  function installSimpleBilanLink(){
    const control=$('bilan-simple-line');
    if(!control)return;
    control.addEventListener('change',()=>{
      const line=contractLine(control.value);
      state.bilanContributions=line ? [window.KaloneoSimpleBilanLink.contribution(line,$('test-category').value)] : [];
      renderSimpleBilanLink();
      changed();
    });
    renderSimpleBilanLink();
  }

  function contractField(title,value,options,onChange){
    const label=document.createElement('label');label.textContent=title;
    const control=options?document.createElement('select'):document.createElement('input');
    if(options){
      for(const [id,name] of options){
        const option=document.createElement('option');option.value=id;option.textContent=name;
        control.appendChild(option);
      }
    }else control.type='text';
    control.value=String(value??'');
    control.addEventListener(options?'change':'input',()=>onChange(control.value));
    label.appendChild(control);return label;
  }
  function contractRemove(title,callback){
    const btn=document.createElement('button');btn.type='button';
    btn.className='mini-btn danger';btn.textContent='Retirer';btn.title=title;
    btn.addEventListener('click',callback);return btn;
  }
  // Une modification de type de sortie ou de ligne du Bilan recrée
  // l'éditeur de contrat. Conserver le SELECT/INPUT et sa position, sans
  // intervenir si le focus appartient déjà à un autre élément.
  function rememberContractFocus(hosts){
    const active=document.activeElement;
    if(!active||!active.matches('input,textarea,select'))return null;
    const host=hosts.find(element=>element.contains(active));
    if(!host)return null;
    const path=[];
    for(let node=active;node!==host;node=node.parentElement){
      if(!node?.parentElement)return null;
      path.unshift(Array.prototype.indexOf.call(node.parentElement.children,node));
    }
    let start=null,end=null;
    try{start=active.selectionStart;end=active.selectionEnd;}catch(_){}
    return {hostId:host.id,path,original:active,tag:active.tagName,type:active.type,start,end};
  }
  function restoreContractFocus(snapshot){
    if(!snapshot||snapshot.original.isConnected||
       (document.activeElement&&document.activeElement!==document.body))return;
    let control=$(snapshot.hostId);
    for(const index of snapshot.path)control=control?.children?.[index];
    if(!control||control.tagName!==snapshot.tag||control.disabled||
       (snapshot.tag==='INPUT'&&control.type!==snapshot.type))return;
    try{control.focus({preventScroll:true});}catch(_){control.focus();}
    if(Number.isInteger(snapshot.start)&&Number.isInteger(snapshot.end)&&
       typeof control.setSelectionRange==='function')
      try{control.setSelectionRange(snapshot.start,snapshot.end);}catch(_){}
  }

  function renderContractEditors(){
    const outHost=$('outputs-editor'),bilanHost=$('bilan-editor');
    if(!outHost||!bilanHost)return;
    const focus=rememberContractFocus([outHost,bilanHost]);
    outHost.replaceChildren();bilanHost.replaceChildren();
    state.outputs.forEach((output,index)=>{
      const item=document.createElement('div');item.className='contract-item';
      const row=document.createElement('div');row.className='contract-row';
      const idField=contractField('Identifiant de sortie',output.id,null,value=>{
        const old=output.id;output.id=value;
        for(const contribution of state.bilanContributions){
          for(const key of Object.keys(contribution.bindings||{})){
            if(contribution.bindings[key]===old)contribution.bindings[key]=value;
          }
        }
        changed({typing:true});
      });
      // Ne pas recréer tous les champs au blur : cela volait le focus
      // au contrôle sur lequel l'utilisateur venait de cliquer.
      const typeField=contractField('Type de donnée',output.type,CONTRACT_TYPES,value=>{
        output.type=value;renderContractEditors();changed();
      });
      row.append(idField,typeField,contractRemove('Supprimer cette sortie',()=>{
        if(state.bilanContributions.some(c=>Object.values(c.bindings||{}).includes(output.id))&&
          !confirm('Cette sortie est utilisée par le Bilan. Supprimer aussi ses liaisons ?'))return;
        state.outputs.splice(index,1);
        for(const contribution of state.bilanContributions){
          for(const key of Object.keys(contribution.bindings||{})){
            if(contribution.bindings[key]===output.id)delete contribution.bindings[key];
          }
        }
        renderContractEditors();changed();
      }));
      item.appendChild(row);outHost.appendChild(item);
    });
    if(!state.outputs.length){
      const empty=document.createElement('p');empty.className='contract-empty';
      empty.textContent='Aucune sortie déclarée.';outHost.appendChild(empty);
    }
    state.bilanContributions.forEach((contribution,index)=>{
      const item=document.createElement('div');item.className='contract-item';
      const row=document.createElement('div');row.className='contract-row contract-link-row';
      const catalog=contractLines();
      const lineOptions=[['','Choisir une ligne du Bilan…']];
      for(const entry of catalog){
        lineOptions.push([entry.id,entry.section+' / '+entry.subsection+' — '+entry.label]);
      }
      if(contribution.lineId&&!catalog.some(l=>l.id===contribution.lineId)){
        lineOptions.push([contribution.lineId,'Liaison antérieure — '+contribution.lineId]);
      }
      row.append(contractField('Ligne du Bilan',contribution.lineId||'',lineOptions,value=>{
        contribution.lineId=value;contribution.bindings={};
        renderContractEditors();changed();
      }),contractRemove('Supprimer cette liaison',()=>{
        state.bilanContributions.splice(index,1);
        renderContractEditors();changed();
      }));
      item.appendChild(row);
      const line=contractLine(contribution.lineId);
      if(line){
        const help=document.createElement('p');help.className='contract-help';
        help.textContent=line.mode==='manual'
          ?'Évaluation manuelle : aucune sortie requise.'
          :'Évaluation automatique : associez chaque entrée aux sorties compatibles du test.';
        item.appendChild(help);
        if(line.inputs.length){
          const bindings=document.createElement('div');bindings.className='contract-bindings';
          for(const input of line.inputs){
            const opts=[['',input.required?'Choisir une sortie obligatoire…':'Aucune sortie (facultatif)']];
            for(const output of state.outputs.filter(o=>o.type===input.type)){
              opts.push([output.id,output.id+' ('+output.type+')']);
            }
            const current=contribution.bindings?.[input.id]||'';
            if(current&&!opts.some(([id])=>id===current)){
              opts.push([current,'Sortie existante incompatible — '+current]);
            }
            bindings.appendChild(contractField(input.id+' — '+input.type+(input.required?' *':''),current,opts,value=>{
              if(!contribution.bindings||typeof contribution.bindings!=='object')contribution.bindings={};
              if(value)contribution.bindings[input.id]=value;
              else delete contribution.bindings[input.id];
              changed();
            }));
          }
          item.appendChild(bindings);
        }
      }else if(contribution.lineId){
        const help=document.createElement('p');help.className='contract-help';
        help.textContent='Liaison existante conservée (ligne absente du catalogue actuel).';
        item.appendChild(help);
      }
      bilanHost.appendChild(item);
    });
    if(!state.bilanContributions.length){
      const empty=document.createElement('p');empty.className='contract-empty';
      empty.textContent='Aucune liaison directe vers le Bilan.';bilanHost.appendChild(empty);
    }
    restoreContractFocus(focus);
    renderSimpleBilanLink();
  }
  function validateContract(add){
    const category=$('test-category')?.value;
    if(category==='introduction'||category==='fin'){
      add(state.bilanContributions.length===0,'Page de parcours hors notation et hors bilan');
      return;
    }
    if(!state.sourceProtectedVersion && window.KaloneoSimpleBilanLink){
      const result=window.KaloneoSimpleBilanLink.validate(
        $('test-category').value,state.bilanContributions,contractLines());
      add(result.ok,result.ok
        ?'Test relié à la ligne officielle : '+result.line.label
        :result.error);
      return;
    }
    const ids=new Set();
    for(const output of state.outputs){
      const id=String(output.id||'');
      add(CONTRACT_ID_RE.test(id),'Identifiant de sortie valide : '+(id||'vide'));
      add(!ids.has(id),'Sortie sans doublon : '+(id||'vide'));
      add(CONTRACT_TYPES.some(([type])=>type===output.type),'Type de sortie reconnu : '+(id||'vide'));
      ids.add(id);
    }
    const targets=new Set();
    for(const link of state.bilanContributions){
      const line=contractLine(link.lineId);
      add(Boolean(link.lineId),'Ligne du Bilan sélectionnée');
      if(!link.lineId)continue;
      add(!targets.has(link.lineId),'Liaison du Bilan sans doublon : '+link.lineId);
      targets.add(link.lineId);
      // Les anciennes liaisons personnalisées sont conservées sans modifier les tests existants.
      if(!line)continue;
      for(const input of line.inputs){
        const outputId=link.bindings?.[input.id];
        const output=state.outputs.find(o=>o.id===outputId);
        add(!input.required||Boolean(outputId),'Entrée obligatoire du Bilan : '+input.id);
        if(outputId)add(Boolean(output)&&output.type===input.type,'Type compatible pour '+input.id);
      }
    }
  }

  // Conserver le champ et la position du curseur quand une modification
  // structurelle impose de recréer les contrôles de l'éditeur.
  // Aucun changement des modèles KALTEST ou des fichiers V1.
  function rememberBlockFocus(host) {
    const focused=document.activeElement;
    if(!focused || !host.contains(focused))return null;
    const block=focused.closest?.('.exercise-block');
    if(!block?.dataset?.uid)return null;
    const path=[];
    for(let node=focused;node!==block;node=node.parentElement){
      if(!node?.parentElement)return null;
      path.unshift(Array.prototype.indexOf.call(node.parentElement.children,node));
    }
    const editing=focused.tagName==='INPUT'||focused.tagName==='TEXTAREA';
    let start=null,end=null,direction='none';
    if(editing){
      try{
        start=focused.selectionStart;end=focused.selectionEnd;
        direction=focused.selectionDirection||'none';
      }catch(_){}
    }
    return {uid:block.dataset.uid,path,tagName:focused.tagName,
      type:focused.type||'',original:focused,start,end,direction};
  }

  function restoreBlockFocus(host,snapshot) {
    if(!snapshot || snapshot.original.isConnected)return;
    // Ne pas reprendre le focus si une autre commande en a déjà pris possession.
    if(document.activeElement && document.activeElement!==document.body)return;
    const block=Array.from(host.children).find(node=>node.dataset.uid===snapshot.uid);
    if(!block)return;
    let control=block;
    for(const index of snapshot.path)control=control?.children?.[index];
    if(!control||control.tagName!==snapshot.tagName ||
       (snapshot.tagName==='INPUT'&&control.type!==snapshot.type))return;
    if(!control.matches('input,textarea,select,button')||control.disabled)return;
    try{control.focus({preventScroll:true});}
    catch(_){control.focus();}
    if(Number.isInteger(snapshot.start)&&Number.isInteger(snapshot.end)&&
       typeof control.setSelectionRange==='function'){
      try{control.setSelectionRange(snapshot.start,snapshot.end,snapshot.direction);}catch(_){}
    }
  }


  function cloneTo(index,blocks){
    const copies=Workflow.copyBlocks(blocks,state.blocks,()=>uid('copie'));
    state.blocks=Workflow.insertBlocks(state.blocks,index,copies);
    copies.forEach(block=>collapsedBlockUids.add(block.uid));
    changed();renderBlocks();
  }
  async function refreshEnsembles(selected){
    const sel=$('block-ensemble-select');
    const entries=(await Workflow.templates.list()).sort((a,b)=>a.name.localeCompare(b.name,'fr'));
    const current=selected||sel.value;
    sel.replaceChildren();
    const blank=document.createElement('option');blank.value='';blank.textContent='Choisir un ensemble';
    sel.appendChild(blank);
    entries.forEach(entry=>{
      const opt=document.createElement('option');opt.value=entry.id;
      opt.textContent=entry.name+' ('+entry.blocks.length+' bloc'+(entry.blocks.length>1?'s':'')+')';
      sel.appendChild(opt);
    });
    if(entries.some(e=>e.id===current))sel.value=current;
  }
  async function saveSelectedEnsemble(){
    const blocks=state.blocks.filter(b=>selectedBlockUids.has(b.uid));
    if(!blocks.length){alert('Cochez les blocs à enregistrer.');return;}
    const name=prompt('Nom de l’ensemble réutilisable :','Mon ensemble');
    if(name===null)return;
    if(!String(name).trim()){alert('Indiquez un nom.');return;}
    const id=await Workflow.templates.put({name:String(name).trim(),blocks});
    await refreshEnsembles(id);
    transientStatus('Ensemble enregistré sur ce PC',2500);
  }
  async function addSavedEnsemble(index){
    const id=$('block-ensemble-select').value;
    if(!id){alert('Choisissez un ensemble enregistré.');return;}
    const entry=await Workflow.templates.get(id);
    if(!entry||!Array.isArray(entry.blocks)||!entry.blocks.length)throw Error('Ensemble introuvable.');
    cloneTo(index,entry.blocks);
  }
  function addAt(index,type){
    if(type==='__ensemble__'){
      void addSavedEnsemble(index).catch(e=>alert('Insertion impossible : '+String(e.message||e)));return;
    }
    const block=baseBlock(type);
    state.blocks=Workflow.insertBlocks(state.blocks,index,[block]);
    collapsedBlockUids.add(block.uid);
    changed();renderBlocks();
  }
  function makeInsertionControl(index){
    const row=document.createElement('div');row.className='block-insert-divider';
    const select=document.createElement('select');select.className='block-insert-type';
    select.setAttribute('aria-label','Type à insérer en position '+(index+1));
    for(const entry of $('block-template').content.querySelector('.block-type').options){
      const opt=document.createElement('option');opt.value=entry.value;opt.textContent=entry.textContent;
      select.appendChild(opt);
    }
    const reuse=document.createElement('option');reuse.value='__ensemble__';reuse.textContent='Ensemble enregistré';
    select.appendChild(reuse);select.value='text';
    const button=document.createElement('button');button.type='button';button.className='mini-btn block-insert-here';
    button.textContent='+ Insérer ici';
    button.addEventListener('click',()=>addAt(index,select.value));
    row.append(select,button);
    return row;
  }
  function displayScoringAudit(){
    const definition=Core.modelToDefinition(currentModel());
    const audit=Workflow.scoringAudit(definition,Core.analyzeDefinition);
    $('scoring-audit-summary').textContent=audit.errors.length
      ?'Anomalies : '+audit.errors.length+' — maximum '+audit.maximum+' point(s).'
      :'Simulation des réponses correctes : '+audit.earned+' / '+audit.maximum+' point(s).';
    if(audit.special)$('scoring-audit-summary').textContent+=' Les règles spécialisées nécessitent un parcours Electron.';
    const host=$('scoring-audit-rows');host.replaceChildren();
    const list=document.createElement('ul');list.className='scoring-audit-list';
    audit.rows.forEach(row=>{
      const li=document.createElement('li');li.className='score-audit-'+row.status;
      const title=document.createElement('strong');title.textContent=String(row.id||'');
      li.append(title,document.createTextNode(' — '+(row.status==='ok'?'Bonne et mauvaise réponses vérifiées':row.reason||'À corriger')+
        ' — '+(row.points||0)+' point(s)'));
      list.appendChild(li);
    });
    audit.errors.forEach(error=>{
      const li=document.createElement('li');li.className='score-audit-error';li.textContent=error;list.appendChild(li);
    });
    host.appendChild(list);$('scoring-audit-dialog').showModal();
  }

  function renderBlocks() {
    const host=$('blocks-editor');
    const focusSnapshot=rememberBlockFocus(host);
    host.innerHTML='';
    const split=$('test-layout').value!=='single';
    // Calculer les groupes une seule fois et non deux fois par bloc.
    const lineGroups=Workflow.lines(state.blocks);

    host.appendChild(makeInsertionControl(0));
    state.blocks.forEach((block,index)=>{
      const frag=$('block-template').content.cloneNode(true);
      const article=frag.querySelector('.exercise-block');
      article.dataset.uid=block.uid;
      frag.querySelector('.block-index').textContent=String(index+1);

      const type=frag.querySelector('.block-type');
      type.value=block.type;
      type.addEventListener('change',()=>{
        const replacement=baseBlock(type.value);
        replacement.uid=block.uid;
        replacement.zone=block.zone||'left';
        state.blocks[index]=replacement;
        changed();renderBlocks();
      });

      const zone=frag.querySelector('.block-zone');
      // Toujours conserver la case de zone dans l'en-tête afin que les
      // commandes restent alignées, même en présentation sur une colonne.
      if(split){
        zone.value=block.zone||'left';
        zone.disabled=false;
        zone.title='Gauche, droite ou pleine largeur. Les blocs suivent leur ordre vertical.';
      }else{
        const singleOption=document.createElement('option');
        singleOption.value='single';
        singleOption.textContent='Zone unique';
        zone.prepend(singleOption);
        zone.value='single';
        zone.disabled=true;
        zone.title='Une seule colonne : zone unique';
      }
      zone.addEventListener('change',()=>{
        if(!split)return;
        block.zone=zone.value;
        changed();
      });

      frag.querySelector('.move-up').disabled=index===0;
      frag.querySelector('.move-up').addEventListener('click',()=>{
        if(index<1)return;
        [state.blocks[index-1],state.blocks[index]]=[state.blocks[index],state.blocks[index-1]];
        changed();renderBlocks();
      });
      frag.querySelector('.move-down').disabled=index===state.blocks.length-1;
      frag.querySelector('.move-down').addEventListener('click',()=>{
        if(index>=state.blocks.length-1)return;
        [state.blocks[index+1],state.blocks[index]]=[state.blocks[index],state.blocks[index+1]];
        changed();renderBlocks();
      });
      const select=frag.querySelector('.select-block-for-ensemble');
      select.checked=selectedBlockUids.has(block.uid);
      select.addEventListener('change',()=>{
        if(select.checked)selectedBlockUids.add(block.uid);
        else selectedBlockUids.delete(block.uid);
      });
      frag.querySelector('.duplicate-block').addEventListener('click',()=>cloneTo(index+1,[block]));
      const groups=lineGroups;
      const g=groups.findIndex(e=>e.start<=index&&index<e.end);
      const group=g>=0?groups[g]:null;
      for(const [selector,direction] of [['.move-line-up',-1],['.move-line-down',1]]){
        const button=frag.querySelector(selector);
        button.disabled=g+direction<0||g+direction>=groups.length;
        button.title=(direction<0?'Monter':'Descendre')+
          (group?.zone==='pair'?' la ligne gauche/droite':' la ligne');
        button.addEventListener('click',()=>{
          const next=Workflow.moveLine(state.blocks,index,direction);
          if(next.map(b=>b.uid).join('|')===state.blocks.map(b=>b.uid).join('|'))return;
          state.blocks=next;changed();renderBlocks();
        });
      }
      frag.querySelector('.remove-block').addEventListener('click',()=>{
        if(!confirm('Supprimer le bloc complet '+(index+1)+' ? Tout le contenu de ce bloc sera perdu.')) return;
        collapsedBlockUids.delete(block.uid);
        selectedBlockUids.delete(block.uid);
        state.blocks.splice(index,1);changed();renderBlocks();
      });

      const blockBody=article.querySelector('.block-body');
      const foldButton=article.querySelector('.toggle-block');
      blockBody.id='builder-block-body-'+block.uid;
      foldButton.setAttribute('aria-controls',blockBody.id);
      const updateFold=()=>{
        const collapsed=collapsedBlockUids.has(block.uid);
        article.classList.toggle('is-collapsed',collapsed);
        blockBody.hidden=collapsed;
        foldButton.textContent=collapsed?'+':'−';
        foldButton.setAttribute('aria-expanded',String(!collapsed));
        foldButton.title=collapsed?'Déployer ce bloc':'Réduire ce bloc';
        foldButton.setAttribute('aria-label',foldButton.title);
      };
      foldButton.addEventListener('click',()=>{
        if(collapsedBlockUids.has(block.uid))collapsedBlockUids.delete(block.uid);
        else collapsedBlockUids.add(block.uid);
        updateFold(); // purement visuel : pas de modification du test ni d'historique
      });
      renderBlockBody(block,blockBody,index);
      updateFold();
      host.appendChild(frag);
      host.appendChild(makeInsertionControl(index+1));
    });

    refreshPreview();
    restoreBlockFocus(host,focusSnapshot);
  }

  function createQuestionPreview(block) {
    const q=block.question||{};
    // Toutes les nouvelles questions utilisent exactement la structure du
    // moteur candidat, quel que soit le nom ou l'ID du test.
    return window.KaloneoSharedPresentation.renderQuestion({
      doc:document,question:q,example:Boolean(q.example),
      className:'preview-question',
      makeAnswer:()=>{
        if(['single-choice','select','boolean'].includes(q.responseType)){
          const select=document.createElement('select');
          const empty=document.createElement('option');empty.textContent='Choisir…';select.appendChild(empty);
          const values=q.responseType==='boolean'?['Vrai','Faux']:splitValues(q.options);
          values.forEach(v=>{const o=document.createElement('option');o.textContent=v;select.appendChild(o);});
          return select;
        }
        if(q.responseType==='multiple-choice'){
          const choices=document.createElement('div');
          splitValues(q.options).forEach(v=>{const l=document.createElement('label');l.className='inline-checkbox';const cb=document.createElement('input');cb.type='checkbox';l.append(cb,document.createTextNode(' '+v));choices.appendChild(l);});
          return choices;
        }
        if(q.responseType==='free-text'){
          const input=document.createElement('textarea');input.rows=5;
          input.className='preview-free-text';input.placeholder='Votre réponse';
          return input;
        }
        const input=document.createElement('input');
        input.type='text';
        input.placeholder=q.responseType==='duration'?'Ex. 9h15':'Votre réponse';
        return input;
      }
    });
  }

  function gridPreview(block) {
    const t=block.table||{};
    return window.KaloneoSharedPresentation.renderGridTable({
      doc:document,definition:t,
      className:'preview-grid-table',wrapperClassName:'preview-grid-wrap',
      equalClassName:'preview-grid-equal-auto',
      renderCell:({cell:td,cellDefinition:cell})=>{
        if(cell.kind==='fixed-text'||cell.kind==='choice-option') td.textContent=cell.value||'';
        else if(['candidate-answer','select','unit'].includes(cell.kind)) {
          const input=document.createElement(cell.kind==='select'?'select':'input');
          if(cell.kind!=='select') input.type='text';
          if(cell.kind==='select') {
            const o=document.createElement('option');o.textContent='Choisir…';input.appendChild(o);
            (cell.options||[]).forEach(v=>{const op=document.createElement('option');op.textContent=v;input.appendChild(op);});
          }
          td.appendChild(input);
        } else if(['image','audio','video'].includes(cell.kind)) td.textContent=cell.value||cell.kind;
      }
    });
  }

    function responseTablePreview(block) {
    const t=ensureResponseColumns(block);
    return window.KaloneoSharedPresentation.renderResponseTable({
      doc:document,headers:t.headers||[],columns:t.columns||[],
      rows:state.blocks.filter(b=>b.type==='question'),
      className:'preview-grid-table',wrapperClassName:'preview-grid-wrap',
      renderCell:({cell,rowIndex,colIndex})=>{
        if(colIndex===0){cell.textContent=String(rowIndex+1);return;}
        const input=document.createElement('input');input.type='text';
        cell.appendChild(input);
      }
    });
  }

  function inlinePreview(block) {
    return window.KaloneoSharedPresentation.renderInlineFlow({
      doc:document,wordBank:block.wordBank||[],flow:block.flow||[],
      className:'preview-inline-flow',bankClass:'preview-word-bank',
      makeAnswer:(questionId)=>{
        const input=document.createElement('input');
        input.type='text';input.placeholder=questionId||'';
        return input;
      }
    });
  }

  // Le rendu des tableaux historiques est isolé dans
  // builder-legacy-table-preview.js (mêmes classes CSS et mêmes données).
  function blockPreview(block) {
    const wrap=document.createElement('div');
    wrap.className='preview-content-block';
    let node=wrap;

    if(block.type==='text') {
      renderRichContext(wrap,block.text||'Bloc texte vide');
      const docIds=new Set(state.supplementaryWindows.map(entry=>entry.id));
      const buttons=(block.supplementaryButtons||[]).filter(button=>docIds.has(button.windowId));
      const draw=button=>{
        const node=document.createElement('button');
        node.type='button';node.className='mini-btn preview-document-inline';
        node.textContent=String(button.label||'Consulter le document');
        node.title='Bouton documentaire : à essayer avec Aperçu Electron';
        return node;
      };
      window.KaloneoSharedPresentation.placeDocumentButtons(wrap,buttons,draw);
      for(const button of buttons.filter(b=>b.position==='before').reverse()){
        wrap.prepend(draw(button),document.createTextNode(' '));
      }
      for(const button of buttons.filter(b=>b.position==='after'||!b.position)){
        wrap.append(document.createTextNode(' '),draw(button));
      }
    } else if(block.type==='html'||block.type==='html-js') {
      wrap.appendChild(window.KaloneoSharedPresentation.renderHtmlFrame({
        doc:document,block,className:'preview-html-frame'
      }));
    } else if(['image','audio','video'].includes(block.type)) {
      // Le Builder et le candidat partagent aussi le même rendu de média.
      node=window.KaloneoSharedPresentation.renderMedia({
        doc:document,type:block.type,
        // Une ressource seulement nommée reste à importer dans le Builder.
        resource:{data:block.mediaData||'',alt:block.mediaAlt||block.mediaName||'Image'},
        style:{imageScale:block.imageScale,imageAlign:block.imageAlign},
        className:'preview-media-block',imageClass:'preview-media',
        videoClass:'preview-media',
        emptyText:block.mediaPlaceholder||'Aucun média sélectionné',
        resolveSource:src=>src.startsWith('imageqcm/')?'../'+src:src
      });
      if(block.type==='audio'){
        const audio=node.querySelector('audio');
        if(audio)audio.style.width='100%';
      }
    } else if(block.type==='text-editor') {
      wrap.classList.add('preview-text-editor');
      const toolbar=document.createElement('div');
      toolbar.className='preview-text-editor-toolbar';
      toolbar.innerHTML='<button type="button" disabled>📂 Fichier</button><button type="button" disabled><b>G</b></button><button type="button" disabled><i>I</i></button><button type="button" disabled><u>U</u></button><select disabled><option>Arial</option></select><select disabled><option>12</option></select><button type="button" disabled>🖼️</button>';
      const page=document.createElement('div');
      page.className='preview-text-editor-page';
      page.textContent='Zone de rédaction du candidat…';
      const badge=document.createElement('small');
      badge.textContent=(block.config?.scoringProfile==='seb-bureautique-v1')?'Correction SEB /8':'Éditeur libre';
      wrap.append(toolbar,page,badge);
    } else if(block.type==='image-selection'){
      node=window.KaloneoSharedPresentation.renderImageSelection({
        doc:document,block:{
          label:block.label||block.question?.prompt||'Sélectionnez les images',
          questionId:block.question?.id||'',totalItems:block.totalItems,cloud:block.cloud===true,
          resource:{data:block.mediaData||''}
        }
      });
    } else if(block.type==='question') {
      node=createQuestionPreview(block);
    } else if(block.type==='table-grid') {
      node=gridPreview(block);
    } else if(block.type==='response-table') {
      node=responseTablePreview(block);
    } else if(block.type==='inline-flow') {
      node=inlinePreview(block);
    } else if(block.type==='multiple-tables') {
      node=window.KaloneoBuilderLegacyTablePreview.render(block,state.sourceDefinition);
    }
    node.classList.add('preview-content-block');
    return applyPreviewBlockStyle(node,block);
  }

  const MINI_PREVIEW_WIDTH=1366;
  const MINI_PREVIEW_HEIGHT=768;
  // Le rendu HTML du Builder répond immédiatement. Une seule capture Electron
  // est demandée après une pause : pas de rechargement du candidat par touche.
  const MINI_PREVIEW_IDLE_MS=1100;
  let miniPreviewTimer=null;
  let miniPreviewRevision=0;
  let miniPreviewRunning=false;
  let miniPreviewDeferredRevision=null;

  const miniBlockTypeNames=Object.freeze({
    text:'Texte',question:'Question',image:'Image',audio:'Audio',video:'Vidéo',
    'table-grid':'Tableau structuré','response-table':'Tableau de réponses',
    'multiple-tables':'Tableaux','image-selection':'Sélection d’images',
    'text-editor':'Éditeur de texte','inline-flow':'Texte à trous',
    html:'HTML','html-js':'HTML/JS'
  });

  function miniBlockDefinition(){
    const definition=Core.modelToDefinition(currentModel());
    const items=definition.presentation?.builderContent;
    if(!Array.isArray(items))return definition;
    const indexes=state.blocks.map((block,index)=>({block,index}))
      .filter(({block})=>!['image','audio','video'].includes(block.type)||
        Boolean(block.mediaData||block.mediaName||block.mediaPlaceholder));
    // Un décalage entre blocs locaux et éléments du moteur ne doit jamais
    // donner une numérotation erronée. Dans le doute, aucun repère.
    if(indexes.length===items.length && indexes.every(({block},i)=>
      block.type===items[i].type ||
      (block.type==='multiple-tables'&&items[i].type==='table-definition'))){
      items.forEach((item,i)=>{item.__kaloneoMiniSourceIndex=indexes[i].index;});
    }
    return definition;
  }

  function renderMiniBlockHoverLayer(report){
    const layer=$('mini-block-hover-layer');
    if(!layer)return;
    layer.replaceChildren();
    const seen=new Set();
    const imageWidth=Math.max(1,Number(report?.imageWidth)||1366);
    const imageHeight=Math.max(1,Number(report?.imageHeight)||768);
    const imageFit=Math.min(1366/imageWidth,768/imageHeight);
    const imageOffsetX=(1366-imageWidth*imageFit)/2;
    const imageOffsetY=(768-imageHeight*imageFit)/2;
    for(const box of Array.isArray(report?.miniBlocks)?report.miniBlocks:[]){
      const index=Number(box?.index);
      if(!Number.isInteger(index)||index<0||index>=state.blocks.length||seen.has(index))continue;
      const x=Number(box.x),y=Number(box.y),w=Number(box.width),h=Number(box.height);
      if(![x,y,w,h].every(Number.isFinite)||w<4||h<4||x>=imageWidth||y>=imageHeight)continue;
      seen.add(index);
      const hit=document.createElement('div');
      hit.className='mini-block-hover-target';
      hit.style.left=((imageOffsetX+Math.max(0,x)*imageFit)/1366*100)+'%';
      hit.style.top=((imageOffsetY+Math.max(0,y)*imageFit)/768*100)+'%';
      hit.style.width=(Math.max(0,Math.min(imageWidth-x,w))*imageFit/1366*100)+'%';
      hit.style.height=(Math.max(0,Math.min(imageHeight-y,h))*imageFit/768*100)+'%';
      const block=state.blocks[index];
      const label='Bloc n°'+(index+1)+' — '+(miniBlockTypeNames[block.type]||block.type);
      hit.dataset.label=label;
      hit.setAttribute('aria-label',label);
      hit.dataset.tooltipSide=y>580?'top':'bottom';
      layer.appendChild(hit);
    }
    layer.hidden=!layer.childElementCount;
  }

  function invalidateMiniPreview() {
    ++miniPreviewRevision;
    if(miniPreviewTimer)clearTimeout(miniPreviewTimer);
    miniPreviewTimer=null;
    miniPreviewDeferredRevision=null;
    const image=$('candidate-preview-snapshot');
    if(image)image.hidden=true; // Ne jamais recouvrir le texte courant par une ancienne capture.
    const hover=$('mini-block-hover-layer');
    if(hover){hover.hidden=true;hover.replaceChildren();}
    const status=$('candidate-preview-status');
    if(status)status.hidden=true; // Aucun écran intermédiaire sur le rendu direct.
    const warning=$('candidate-preview-warning');
    if(warning)warning.textContent='Aperçu simplifié — contrôle candidat après une pause.';
  }

  function scheduleMiniPreviewCapture(delay=MINI_PREVIEW_IDLE_MS) {
    if(Supplementary?.isEditing())return;
    if(builderSelectInteracting){
      miniPreviewWaitingForSelect=true;
      return;
    }
    if(miniPreviewTimer)clearTimeout(miniPreviewTimer);
    miniPreviewTimer=setTimeout(async()=>{
      miniPreviewTimer=null;
      const revision=miniPreviewRevision;
      if(Supplementary?.isEditing())return;
      if(builderSelectInteracting){
        miniPreviewWaitingForSelect=true;
        return;
      }
      if(miniPreviewRunning) {
        // Une capture est déjà en cours : garder seulement la dernière demande.
        miniPreviewDeferredRevision=revision;
        return;
      }
      const bridge=window.sebEvalPro;
      const status=$('candidate-preview-status');
      const image=$('candidate-preview-snapshot');
      const warning=$('candidate-preview-warning');
      if(!bridge?.kaloneoRenderMiniPreview||!image){
        $('candidate-preview-viewport')?.removeAttribute('data-preview-loading');
        return;
      }
      miniPreviewRunning=true;
      try {
        const mode=$('candidate-preview-resolution')?.value||'reference';
        const result=await bridge.kaloneoRenderMiniPreview(miniBlockDefinition(),mode);
        if(revision!==miniPreviewRevision||Supplementary?.isEditing())return; // Capture obsolète : aucun affichage.
        if(!result?.ok||!result.image) {
          if(status)status.textContent='Capture Electron indisponible : '+String(result?.error||'rendu absent');
          if(warning)warning.textContent='Aperçu direct affiché ; contrôle Electron indisponible.';
          return;
        }
        image.src=result.image;
        if(typeof image.decode==='function') {
          try{await image.decode();}catch(_){}
        }
        if(revision!==miniPreviewRevision)return;
        image.hidden=false;
        // La géométrie est retournée avec la capture : aucune IPC ni capture
        // supplémentaire n'est lancée pour les infobulles.
        renderMiniBlockHoverLayer(result.report);
        // La première vue d'un test ouvert est désormais toujours celle du
        // moteur candidat : pas d'aperçu simplifié montrant ses réponses puis
        // modifiant silencieusement sa disposition.
        $('candidate-preview-viewport')?.removeAttribute('data-preview-loading');
        const warnings=[];
        if(result.report?.overflowZones){
          const locations=(result.report.clippedAreas||[]).slice(0,3).map(area=>{
            const index=Number.isInteger(area?.blockIndex)?area.blockIndex:null;
            const name=index===null?String(area?.target||'zone'):('bloc n°'+(index+1));
            const axis=area?.axis==='horizontal'?'largeur':'hauteur';
            return name+' ('+axis+' : '+Number(area?.excess||0)+' px inaccessibles)';
          });
          warnings.push('contenu coupé ou inaccessible'+
            (locations.length?' — '+locations.join(' ; '):''));
        }
        if(result.report?.tableHorizontalOverflow)warnings.push('défilement horizontal du tableau inaccessible');
        if(result.report?.brokenImages?.length)warnings.push('image introuvable');
        if(warning)warning.textContent=warnings.length?
          'À corriger dans le rendu candidat : '+warnings.join(', ')+'.':
          (mode==='reference'
            ? 'Rendu réel candidat Electron (1366 × 768) — à comparer visuellement.'
            : 'Simulation du PC candidat '+result.report?.imageWidth+' × '+result.report?.imageHeight+
              ' — zoom automatique identique au parcours.');
      }catch(error) {
        if(revision===miniPreviewRevision) {
          if(status)status.textContent='Impossible de calculer le rendu : '+String(error?.message||error);
          if(warning)warning.textContent='Aperçu direct affiché ; contrôle Electron indisponible.';
        }
      }finally{
        miniPreviewRunning=false;
        // Si le moteur candidat n'est pas disponible, on rétablit le rendu
        // direct au lieu de laisser un panneau de chargement bloqué.
        if(revision===miniPreviewRevision)
          $('candidate-preview-viewport')?.removeAttribute('data-preview-loading');
        // Les captures obsolètes ne sont pas mises en file d’attente.
        if(miniPreviewDeferredRevision===miniPreviewRevision) {
          miniPreviewDeferredRevision=null;
          scheduleMiniPreviewCapture(0);
        }
      }
    },delay);
  }

  function refreshRealMiniPreview() {
    if(Supplementary?.isEditing())return;
    // La saisie reste immédiatement visible dans le DOM du Builder.
    // Après une pause, présenter la véritable page du moteur candidat :
    // toutes les mises en page, y compris les renderers historiques.
    // Aucune tâche périodique : une capture par modification terminée.
    invalidateMiniPreview();
    const warning=$('candidate-preview-warning');
    if(warning)warning.textContent='Aperçu simplifié pendant la saisie — rendu réel candidat après une pause.';
    scheduleMiniPreviewCapture();
  }

  function fitMiniPreview() {
    const viewport=$('candidate-preview-viewport');
    const page=$('candidate-preview');
    if(!viewport||!page)return;
    const width=Math.max(1,viewport.clientWidth);
    const height=Math.max(1,viewport.clientHeight);
    const scale=Math.min(width/MINI_PREVIEW_WIDTH,height/MINI_PREVIEW_HEIGHT);
    page.style.width=MINI_PREVIEW_WIDTH+'px';
    page.style.height=MINI_PREVIEW_HEIGHT+'px';
    page.style.transform='scale('+scale+')';
    page.style.transformOrigin='top left';
  }

  function previewBlockNode(block) {
    const node=blockPreview(block);
    if(block.uid)node.dataset.previewUid=String(block.uid);
    return node;
  }

  function refreshTypingPreview() {
    if(Supplementary?.isEditing())return;
    const field=document.activeElement;
    const uid=field?.closest?.('.exercise-block')?.dataset?.uid;
    if(uid) {
      const block=state.blocks.find(item=>item.uid===uid);
      const existing=Array.from($('preview-exercise')?.querySelectorAll('[data-preview-uid]')||[])
        .find(node=>node.dataset.previewUid===uid);
      if(block&&existing) {
        existing.replaceWith(previewBlockNode(block));
        return;
      }
    }
    if(field?.id==='test-title') {
      $('preview-title').textContent=field.value||'Nouveau test';
      return;
    }
    if(field?.id==='test-scenario') {
      renderRichContext($('preview-scenario'),field.value||'Le scénario apparaîtra ici.');
      return;
    }
    if(field?.id==='test-instruction') {
      renderRichContext($('preview-instruction'),field.value||'Les consignes apparaîtront ici.');
      return;
    }
    refreshPreview({liveOnly:true});
  }

  function refreshPreview(options={}) {
    if(Supplementary?.isEditing())return;
    const m=collectMeta();
    $('preview-title').textContent=m.title||'Nouveau test';
    $('preview-version').textContent='v'+m.version;
    const previewIcon=$('preview-test-icon');
    if(m.icon?.data) {
      previewIcon.src=m.icon.data;
      previewIcon.alt=m.icon.label||'';
      previewIcon.hidden=false;
    } else {
      previewIcon.removeAttribute('src');
      previewIcon.alt='';
      previewIcon.hidden=true;
    }
    renderRichContext($('preview-scenario'),m.scenario||'Le scénario apparaîtra ici.');
    renderRichContext($('preview-instruction'),m.instruction||'Les consignes apparaîtront ici.');

    const page=$('candidate-preview');
    if(page){
      page.classList.toggle('preview-custom-page-background',m.pageBackgroundType==='color'||m.pageBackgroundType==='image');
      page.style.removeProperty('background');
      page.style.removeProperty('background-color');
      page.style.removeProperty('background-image');
      page.style.removeProperty('background-size');
      page.style.removeProperty('background-position');
      page.style.removeProperty('background-repeat');
      if(m.pageBackgroundType==='color'&&m.pageBackgroundColor){
        page.style.backgroundColor=m.pageBackgroundColor;
      }else if(m.pageBackgroundType==='image'&&m.pageBackgroundImage){
        page.style.backgroundImage='url("'+String(m.pageBackgroundImage).replace(/"/g,'%22')+'")';
        page.style.backgroundSize='cover';
        page.style.backgroundPosition='center';
        page.style.backgroundRepeat='no-repeat';
      }
    }

    const host=$('preview-exercise');
    host.className='preview-exercise layout-'+m.layout;
    host.innerHTML='';

    // Disposition unique partagée avec le vrai candidat, sans aiguillage
    // par ID du test et sans duplication des calculs de largeur.
    const sizing=m.layout==='chars-rest'?{blocks:[
      {widthChars:m.block1WidthChars},
      {widthChars:m.block2WidthChars,remainder:m.lastBlockRemainder}
    ]}:null;
    window.KaloneoSharedPresentation.renderZones({
      host,items:state.blocks,layout:m.layout,blockSizing:sizing,
      renderItem:previewBlockNode,zoneClass:'preview-zone'
    });
    if(!options.liveOnly)validate();
    requestAnimationFrame(fitMiniPreview);
    if(!options.liveOnly)refreshRealMiniPreview();
  }

  function validate() {
    const m=collectMeta();
    const items=[];
    const add=(ok,text)=>items.push({ok:Boolean(ok),text});
    add(Boolean(m.title),'Titre renseigné');
    add(Boolean(m.id),'Identifiant du test créé');
    const specialPage=m.category==='introduction'||m.category==='fin';
    if(!specialPage){
      add(Boolean(m.scenario),'Scénario renseigné');
      add(Boolean(m.instruction),'Consigne renseignée');
    }
    add(state.blocks.some(b=>!['image','audio','video'].includes(b.type) ||
      Boolean(b.mediaData||b.mediaName||b.mediaPlaceholder)),specialPage?'Au moins un bloc de présentation':'Au moins un bloc Exercice');
    if(specialPage){
      add(state.blocks.some(b=>
        (b.type==='text'&&Boolean(String(b.text||'').trim()))||
        (b.type==='html'&&Boolean(String(b.html||'').trim()))||
        (b.type==='image'&&Boolean(b.mediaData))||
        (b.type==='video'&&Boolean(b.mediaData))),
      'Page de parcours : contenu visible obligatoire');
      add(!state.blocks.some(b=>['question','image-selection','response-table','table-grid',
        'multiple-tables','inline-flow'].includes(b.type)),
      'Introduction et fin de parcours : aucune question ou réponse notée');
    }

    if(m.layout==='chars-rest') {
      add(Number(m.block1WidthChars)>=3,'Bloc 1 : largeur en caractères ≥ 3');
      add(m.lastBlockRemainder||Number(m.block2WidthChars)>=3,'Dernier bloc : reste disponible ou largeur ≥ 3');
    }

    if(m.chronoEnabled) {
      add(m.chronoMinMeasures>=1,'Compteur : nombre minimum de mesures ≥ 1');
      add(m.chronoMaxMeasures>=m.chronoMinMeasures,'Compteur : maximum ≥ minimum');
    }
    if(m.adminIntervention) add(Boolean(m.adminInstructions),'Intervention Administrateur : besoin décrit');
    if(m.externalMaterial) add(Boolean(m.externalMaterialText),'Matériel extérieur : matériel décrit');

    const docIds=new Set(state.supplementaryWindows.map(w=>w.id));
    for(const entry of state.supplementaryWindows){
      add(Boolean(String(entry.title||'').trim()),'Fenêtre complémentaire : titre');
      add(['text','list','table','image'].includes(entry.type||'text'),'Fenêtre complémentaire : type');
      add(entry.type==='image'?/^data:image\//i.test(String(entry.imageData||'')):
        Boolean(String(entry.text||'').trim()),'Fenêtre « '+(entry.title||entry.id)+' » : contenu intégré');
    }
    for(const block of state.blocks){
      const links=Array.isArray(block.supplementaryButtons)?block.supplementaryButtons:[];
      for(const button of links){
        add(docIds.has(button.windowId),'Bouton documentaire : fenêtre existante');
        add(Boolean(String(button.label||'').trim()),'Bouton documentaire : libellé');
        if(button.position==='inline'){
          add(block.type==='text'&&Boolean(button.id)&&
            String(block.text||'').includes('[doc:'+button.id+']'),
            'Bouton documentaire au curseur : repère présent dans le bloc Texte');
        }
      }
      if(block.type==='text'){
        const ids=new Set(links.filter(link=>link.position==='inline').map(link=>link.id));
        for(const match of String(block.text||'').matchAll(/\[doc:([a-z0-9_-]{6,64})\]/gi)){
          add(ids.has(match[1]),'Texte : bouton documentaire lié au repère '+match[1]);
        }
      }
    }

    const editorBlocks=state.blocks.filter(b=>b.type==='text-editor');
    if(editorBlocks.length) {
      add(editorBlocks.length===1,'Éditeur de texte : un seul bloc par test');
      editorBlocks.forEach((block,index)=>{
        const profile=block.config?.scoringProfile||'none';
        add(['none','seb-bureautique-v1'].includes(profile),'Éditeur '+(index+1)+' : profil de correction reconnu');
      });
    }

    let qi=0;
    state.blocks.filter(b=>b.type==='question').forEach(block=>{
      qi++;
      const q=block.question||{};
      add(Boolean(String(q.prompt||'').trim()),'Question '+qi+' : texte renseigné');
      if(q.responseType==='free-text') {
        add(true,'Question '+qi+' : texte libre évalué manuellement par l’Administrateur');
      } else if(m.scored&&!q.example) {
        add((Number(q.points)||0)>0,'Question '+qi+' : points > 0');
        if(q.responseType==='duration') {
          add(Number.isFinite(Number(q.acceptedMinutes))&&Number(q.acceptedMinutes)>=0,'Question '+qi+' : durée attendue renseignée');
        } else {
          add(splitValues(q.acceptedAnswers).length>0,'Question '+qi+' : réponse attendue renseignée');
        }
      }
    });

    state.blocks.filter(b=>b.type==='image-selection').forEach((b,bi)=>{
      const count=Number(b.acceptedCount),total=Number(b.totalItems);
      add(Boolean(b.question?.id),'Sélection images '+(bi+1)+' : identifiant');
      add(Boolean(String(b.question?.prompt||'').trim()),'Sélection images '+(bi+1)+' : consigne');
      add(Number.isInteger(total)&&total>=1&&total<=60,'Sélection images '+(bi+1)+' : nombre de 1 à 60');
      add(Number.isInteger(count)&&count>=0&&count<=total,'Sélection images '+(bi+1)+' : nombre à sélectionner');
      add(!m.scored||(Number(b.question?.points)>0),'Sélection images '+(bi+1)+' : points');
      add(/^data:image\//i.test(String(b.mediaData||'')),'Sélection images '+(bi+1)+' : image intégrée au JSON');
    });
    state.blocks.filter(b=>b.type==='table-grid').forEach((block,bi)=>{
      const t=block.table||{};
      add(Number(t.rows)>0&&Number(t.cols)>0,'Grille '+(bi+1)+' : dimensions valides');
      (t.cells||[]).flat().filter(cell=>['candidate-answer','select','unit','choice-option'].includes(cell.kind)).forEach((cell,index)=>{
        add(Boolean(cell.questionId),'Grille '+(bi+1)+' réponse '+(index+1)+' : ID renseigné');
        if(m.scored) add(splitValues(cell.acceptedAnswers).length>0,'Grille '+(bi+1)+' réponse '+(index+1)+' : réponse attendue renseignée');
      });
    });

    state.blocks.filter(b=>['image','audio','video'].includes(b.type)).forEach((b,i)=>{
      if(b.mediaData||b.mediaName||b.mediaPlaceholder) {
        add(true,'Média '+(i+1)+' disponible pour le test');
      } else {
        // Le bloc image/audio/vidéo vide est conservé dans le brouillon,
        // mais n'est pas inclus dans le test enregistré.
        add(true,'Média '+(i+1)+' vide : ignoré dans le test enregistré');
      }
    });
    state.blocks.filter(b=>b.type==='table-grid').forEach((b,bi)=>{
      (b.table?.cells||[]).flat().filter(cell=>['image','audio','video'].includes(cell.kind)).forEach((cell,mi)=>{
        add(Boolean(cell.value&&String(cell.value).startsWith('data:')),'Grille '+(bi+1)+' média '+(mi+1)+' réellement embarqué');
      });
    });

    const model=currentModel();
    const definition=Core.modelToDefinition(model);
    const analysis=Core.analyzeDefinition(definition);
    validateContract(add);
    add(analysis.ok,'Contrat KALTEST compatible avec SEB EvalPro');
    analysis.errors.forEach(error=>add(false,error));

    const passed=items.every(item=>item.ok);
    const box=$('validation-list')?.closest('.validation-box');
    if(box){
      box.dataset.validationStatus=passed?'ok':'error';
      const heading=$('validation-heading');
      if(heading)heading.setAttribute('aria-label',
        'Contrôle avant génération — '+(passed?'tout est conforme':'des erreurs sont à corriger'));
    }
    const ul=$('validation-list');
    ul.innerHTML='';
    items.forEach(item=>{
      const li=document.createElement('li');
      li.className=item.ok?'ok':'error';
      li.textContent=(item.ok?'OK — ':'À corriger — ')+item.text;
      ul.appendChild(li);
    });
    return passed;
  }

  function applyTemplate(name) {
    if(name==='generic') return;
    if(state.blocks.length&& !confirm('Appliquer ce modèle remplace les blocs actuels. Continuer ?')) {
      $('test-template').value='generic';
      return;
    }

    state.sourceDefinition=null;
    state.blocks=[];

    if(name==='questions-table-visual-60-40') {
      $('test-layout').value='60-40';
      const q=baseBlock('question');q.zone='left';
      const t=baseBlock('response-table');t.zone='left';
      const img=baseBlock('image');img.zone='right';img.mediaPlaceholder='Image verticale';
      state.blocks.push(q,t,img);
    } else if(name==='visual-inline-gaps-40-60') {
      $('test-layout').value='40-60';
      const img=baseBlock('image');img.zone='left';img.mediaPlaceholder='Image verticale';
      const flow=baseBlock('inline-flow');flow.zone='right';
      state.blocks.push(img,flow);
    } else if(name==='work-visual-60-40') {
      $('test-layout').value='60-40';
      const q=baseBlock('question');q.zone='left';
      const t=baseBlock('response-table');t.zone='left';
      t.responseTable.headers=['N°','Réponses','Unités','Opérations effectuées'];
      t.responseTable.columns=[
        {id:'number',widthChars:5,align:'center'},
        {id:'answer',widthChars:14,align:'center'},
        {id:'unit',widthChars:12,align:'center'},
        {id:'operation',align:'left'}
      ];
      const img=baseBlock('image');img.zone='right';img.mediaPlaceholder='Image verticale';
      state.blocks.push(q,t,img);
      $('calculator-compatible').checked=true;
    } else if(name==='two-tables-50-50') {
      $('test-layout').value='50-50';
      const a=baseBlock('multiple-tables');a.zone='left';a.tableDefinition.title='Tableau 1';
      const b=baseBlock('multiple-tables');b.zone='right';b.tableDefinition.title='Tableau 2';
      state.blocks.push(a,b);
    } else if(name==='visual-schedule-40-60') {
      $('test-layout').value='40-60';
      const img=baseBlock('image');img.zone='left';img.mediaPlaceholder='Image verticale';
      const grid=Core.createGridBlock(6,6);grid.zone='right';
      state.blocks.push(img,grid);
      $('calculator-compatible').checked=true;
    } else if(name==='full-width-choice-table') {
      $('test-layout').value='single';
      const grid=Core.createGridBlock(4,6);grid.zone='left';grid.table.mode='single-choice-table';
      state.blocks.push(grid);
    } else if(name==='practical-context-50-50') {
      $('test-layout').value='50-50';
      const img=baseBlock('image');img.zone='left';img.mediaPlaceholder='Image exercice';
      const text=baseBlock('text');text.zone='right';text.text='Commandes de l’exercice pratique';
      state.blocks.push(img,text);
      $('chrono-enabled').checked=true;
    } else if(name==='grid-full-width') {
      $('test-layout').value='single';
      state.blocks.push(Core.createGridBlock(6,6));
    } else if(name==='gratte-ciel-6x6') {
      $('test-layout').value='single';
      const grid=Core.createGridBlock(6,6);
      grid.table.title='Puzzle Gratte-ciel';
      const top=['', '1','2','3','2',''];
      const left=['1','2','2','3'];
      const right=['3','3','1','2'];
      const bottom=['','3','2','1','2',''];
      const answers=[
        ['4','3','1','2'],
        ['2','4','3','1'],
        ['3','1','2','4'],
        ['1','2','4','3']
      ];
      for(let c=0;c<6;c++) {
        grid.table.cells[0][c].kind=top[c]?'fixed-text':'empty';
        grid.table.cells[0][c].value=top[c];
        grid.table.cells[5][c].kind=bottom[c]?'fixed-text':'empty';
        grid.table.cells[5][c].value=bottom[c];
      }
      for(let r=1;r<=4;r++) {
        grid.table.cells[r][0].kind='fixed-text';grid.table.cells[r][0].value=left[r-1];
        grid.table.cells[r][5].kind='fixed-text';grid.table.cells[r][5].value=right[r-1];
        for(let c=1;c<=4;c++) {
          const cell=grid.table.cells[r][c];
          cell.kind='candidate-answer';
          cell.questionId=nextQuestionId();
          cell.acceptedAnswers=answers[r-1][c-1];
          cell.responseType='number';
          cell.points=1;
        }
      }
      state.blocks.push(grid);
    }

    $('custom-sizing-row').hidden=$('test-layout').value!=='chars-rest';
    syncCapabilityOptions();
    changed();renderBlocks();
  }

  function syncProtectedVersionUi() {
    const version=$('test-version');
    const save=$('save-draft');
    const protectedSource=state.sourceProtectedVersion===true;
    const developerEditing=protectedSource;
    const exportV1=$('developer-export-v1');
    if(exportV1)exportV1.hidden=!(developerEditing&&developerUnlocked);
    if(version){
      // Le numéro de V1 reste 1.0.0 même en mode Développeur.
      version.readOnly=protectedSource;
      version.setAttribute('aria-readonly',protectedSource?'true':'false');
      version.title=protectedSource
        ? (developerEditing
          ? 'V1 modifiable, numéro conservé : 1.0.0.'
          : 'Version KALONÉO protégée. Les modifications seront enregistrées sous une nouvelle version.')
        : '';
    }
    if(save){
      save.textContent=developerEditing?'Enregistrer V1':protectedSource?'Créer une nouvelle version':'Enregistrer';
      save.title=developerEditing
        ? 'Enregistrer la V1 en conservant sa version et une copie de sécurité.'
        : protectedSource
          ? 'V1 protégée : enregistrer les modifications sous la prochaine version disponible.'
          : 'Enregistrer le test dans la bibliothèque.';
    }
  }

  async function nextAdminVersion(id) {
    const bridge=window.sebEvalPro;
    let versions=[];
    if(bridge && typeof bridge.kaloneoListTests==='function'){
      try{
        const result=await bridge.kaloneoListTests();
        versions=(Array.isArray(result?.tests)?result.tests:[])
          .filter(item=>String(item?.id||'')===String(id||''))
          .map(item=>String(item?.version||''));
      }catch(_){}
    }
    let maxMajor=1;
    versions.forEach(version=>{
      const major=Number(String(version||'').split('.')[0]);
      if(Number.isFinite(major)&&major>maxMajor)maxMajor=major;
    });
    return String(Math.max(2,maxMajor+1))+'.0.0';
  }

  function loadDefinition(definition, statusLabel='Test KALTEST ouvert depuis la bibliothèque', options={}) {
    const analysis=Core.analyzeDefinition(definition);
    if(!analysis.ok) throw new Error(analysis.errors.join('\\n'));

    const model=Core.definitionToModel(definition);
    state.idLocked=true;
    state.sourceDefinition=model.sourceDefinition;
    state.sourceProtectedVersion=options.protectedVersion===true;
    state.blocks=model.blocks;
    state.supplementaryWindows=Array.isArray(model.supplementaryWindows)?model.supplementaryWindows:[];
    Supplementary?.reset();
    // L'ouverture d'un test attend sa première image candidate fidèle.
    // Le rendu de frappe reste instantané une fois ce premier affichage fait.
    $('candidate-preview-viewport')?.setAttribute('data-preview-loading','true');
    collapsedBlockUids.clear();
    state.blocks.forEach(block=>{if(block?.uid)collapsedBlockUids.add(block.uid);});
    // Les sections de conception sont fermées par défaut à chaque ouverture.
    ['toggle-icon-library','toggle-contract-section','toggle-page-style',
      'toggle-validation-section'].forEach(id=>setSectionExpanded(id,false));
    applyMeta(model.meta);
    syncProtectedVersionUi();
    renderIconPicker();
    $('test-template').value=model.meta.template && Array.from($('test-template').options).some(o=>o.value===model.meta.template)
      ? model.meta.template : 'generic';
    saveDraft(false);
    // renderBlocks appelle déjà refreshPreview, validation et capture Electron.
    // Ne pas effectuer une seconde reconstruction du candidat à l'ouverture.
    renderBlocks();
    resetHistory({markSaved:options.markSaved!==false});
    transientStatus(statusLabel,1800);
  }

  async function importJsonFile(file) {
    const text=await file.text();
    loadDefinition(JSON.parse(text),'Test KALTEST importé sans perte');
  }

  function libraryCategoryLabel(value) {
    const labels={
      mathematiques:'Mathématiques',
      francais:'Français',
      organisation:'Organisation',
      numerique:'Numérique',
      technique:'Technique',
      planification:'Planification',
      activite_pratique:'Activités pratiques',
      competences_transversales:'Compétences transversales'
    };
    const raw=String(value||'Autres');
    return labels[raw]||raw.replace(/[_-]+/g,' ').replace(/^./,char=>char.toUpperCase());
  }

  function testLibraryAdminName(item,items) {
    const count=(items||[]).filter(other=>
      other?.role==='test' && String(other.title||'')===String(item.title||'') &&
      (String(other.id)!==String(item.id) || String(other.version)!==String(item.version))).length;
    if(!count)return String(item.title||'');
    const origin=item.protectedVersion===true?'Original KALONÉO':
      String(item.id)==='planning_cantine_r48_demo'?'Essai Builder R48':'Personnalisé';
    const title=String(item.title||'');
    return (title==='Planification — Le restaurant'?'Le restaurant':title)+' — '+origin;
  }

  function renderLibraryTests(items) {
    const root=$('test-library-list');
    if(!root)return;
    const search=String($('test-library-search')?.value||'').trim().normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase();
    root.replaceChildren();
    const filtered=(items||[]).filter(item=>{
      if(item.role!=='test')return false;
      const haystack=(item.title+' '+item.category+' '+item.id).normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase();
      return !search||haystack.includes(search);
    });
    filtered.forEach(item=>{
      const row=document.createElement('article');
      row.className='test-library-item';
      const text=document.createElement('div');
      text.className='test-library-item-text';
      const title=document.createElement('strong');title.textContent=testLibraryAdminName(item,items);
      const meta=document.createElement('span');
      const duplicated=testLibraryAdminName(item,items)!==item.title;
      meta.textContent=libraryCategoryLabel(item.category)+' • v'+item.version+
        (item.protectedVersion===true?' • V1 modifiable':'')+
        (item.category==='activite_pratique'?' • activité pratique':(item.scored?' • noté':' • non noté'))+
        (duplicated?' • ID : '+item.id:'');
      text.append(title,meta);

      const actions=document.createElement('div');
      actions.className='test-library-item-actions';

      const open=document.createElement('button');
      open.type='button';
      open.className='mini-btn';
      open.textContent='Ouvrir';
      open.addEventListener('click',async()=>{
        try{
          const result=await window.sebEvalPro?.kaloneoGetTest?.(item.id,item.version);
          if(!result||result.ok!==true)throw new Error(result?.error||'Lecture impossible');
          if(!confirmDiscardChanges('Ouvrir un autre test'))return;
          loadDefinition(
            result.definition,
            item.protectedVersion===true
              ? 'V1 modifiable : enregistrez directement votre correction'
              : 'Test KALTEST ouvert depuis la bibliothèque',
            { protectedVersion:item.protectedVersion===true }
          );
          $('test-library-dialog')?.close();
        }catch(error){alert('Ouverture impossible : '+String(error?.message||error));}
      });

      const remove=document.createElement('button');
      remove.type='button';
      remove.className='mini-btn danger';
      remove.textContent='Supprimer';
      remove.disabled=item.protectedVersion===true;
      remove.title=item.protectedVersion===true?'Version fournie avec KALONÉO : suppression protégée.':'Supprimer cette version du test.';
      remove.addEventListener('click',async()=>{
        if(!confirm('Supprimer « '+item.title+' » — version '+item.version+' ?\n\nSeule cette version sera supprimée.'))return;
        try{
          const result=await window.sebEvalPro?.kaloneoDeleteTest?.(item.id,item.version);
          if(!result||result.ok!==true){
            if(result?.code==='IN_USE'&&Array.isArray(result.usages)){
              alert('Suppression impossible : ce test est utilisé dans :\n'+result.usages.map(entry=>'• '+entry.name).join('\n')+'\n\nRetirez-le d’abord de ces parcours.');
              return;
            }
            throw new Error(result?.error||'Suppression impossible');
          }
          const refreshed=await window.sebEvalPro?.kaloneoListTests?.();
          const dialog=$('test-library-dialog');
          dialog._kaloneoItems=Array.isArray(refreshed?.tests)?refreshed.tests:[];
          renderLibraryTests(dialog._kaloneoItems);
        }catch(error){alert('Suppression impossible : '+String(error?.message||error));}
      });

      actions.append(open,remove);
      row.append(text,actions);
      root.appendChild(row);
    });
    if(!filtered.length){
      const empty=document.createElement('p');empty.className='muted';empty.textContent='Aucun test trouvé.';root.appendChild(empty);
    }
  }

  async function openLibraryDialog() {
    const result=await window.sebEvalPro?.kaloneoListTests?.();
    if(!result||result.ok!==true) {
      alert('Bibliothèque inaccessible : '+String(result?.error||'erreur inconnue'));
      return;
    }
    const dialog=$('test-library-dialog');
    dialog._kaloneoItems=Array.isArray(result.tests)?result.tests:[];
    renderLibraryTests(dialog._kaloneoItems);
    dialog.showModal();
  }

  function exportDefinition(data) {
    const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    a.download=data.id+'-'+data.version+'-test.json';
    document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
  }

  async function saveToLibrary(options={}) {
    const protectedClone=state.sourceProtectedVersion===true;
    const developerEditing=protectedClone;
    const createNewVersion=protectedClone&&!developerEditing;
    const originalVersion=$('test-version')?.value||'1.0.0';
    if(createNewVersion){
      const nextVersion=await nextAdminVersion($('test-id')?.value||normalizeIdFromTitle());
      $('test-version').value=nextVersion;
    }
    refreshPreview();
    if(!validate()) {
      if(createNewVersion)$('test-version').value=originalVersion;
      alert('Le test contient encore des éléments obligatoires à corriger.');
      return false;
    }
    state.idLocked=true;
    $('test-id').value=$('test-id').value||normalizeIdFromTitle();
    let data=Core.modelToDefinition(currentModel());
    const bridge=window.sebEvalPro;
    if(!bridge || typeof bridge.kaloneoSaveTest!=='function') {
      if(options.exportJson===true) {
        exportDefinition(data);
        if(createNewVersion)$('test-version').value=originalVersion;
        saveDraft(false);
        $('draft-status').textContent='test.json généré — hors SEB EvalPro';
        setTimeout(()=>$('draft-status').textContent='Brouillon local',1800);
        return true;
      }
      if(createNewVersion)$('test-version').value=originalVersion;
      alert('L’enregistrement dans la bibliothèque est disponible depuis SEB EvalPro.');
      return false;
    }

    if(developerEditing && !confirm(
      'Enregistrer la V1 officielle « '+data.title+' » (1.0.0) ?\\n\\n' +
      'La version locale actuelle sera sauvegardée automatiquement dans les copies de sécurité.\\n' +
      'La version 1.0.0 restera modifiable en session Administrateur jusqu’à votre décision de verrouillage.'
    ))return false;
    let result;
    try {
      result=await bridge.kaloneoSaveTest(data,developerEditing,developerEditing);
      if(createNewVersion){
        // Une V1 protégée ne doit jamais écraser une V2/V3 existante.
        // Même si la liste des versions était momentanément indisponible,
        // on cherche automatiquement le prochain numéro libre.
        let attempts=0;
        while(result && result.ok===false && result.code==='EXISTS' && attempts<20){
          attempts+=1;
          const currentMajor=Math.max(1,Number(String($('test-version').value||'1').split('.')[0])||1);
          $('test-version').value=String(currentMajor+1)+'.0.0';
          data=Core.modelToDefinition(currentModel());
          result=await bridge.kaloneoSaveTest(data,false);
        }
      } else if(result && result.ok===false && result.code==='EXISTS') {
        const replace=confirm('Le test « '+data.title+' » existe déjà en version '+data.version+'. Remplacer cette version dans la bibliothèque ?');
        if(!replace) return false;
        result=await bridge.kaloneoSaveTest(data,true);
      }
    } catch(error) {
      if(createNewVersion)$('test-version').value=originalVersion;
      alert('Enregistrement impossible : '+String(error?.message||error));
      return false;
    }

    if(!result || result.ok!==true) {
      if(createNewVersion)$('test-version').value=originalVersion;
      if(result?.code==='PROTECTED_VERSION') {
        alert(
          'Cette V1 est fournie avec KALONÉO et reste protégée.\n\n' +
          'Pour conserver vos modifications, changez le numéro de version (par exemple 2.0.0) puis enregistrez.'
        );
        return false;
      }
      alert('Enregistrement impossible : '+String(result?.error||'erreur inconnue'));
      return false;
    }

    if(createNewVersion){
      state.sourceProtectedVersion=false;
      syncProtectedVersionUi();
    }
    saveDraft(false);
    markCurrentSaved();
    transientStatus(developerEditing?'V1 enregistrée avec copie de sécurité':
      createNewVersion?'Nouvelle version créée et enregistrée':'Enregistré dans la bibliothèque',2500);
    if(options.exportJson===true) exportDefinition(data);
    return true;
  }

  async function exportOfficialV1() {
    if(!developerUnlocked || !state.sourceProtectedVersion){
      alert('Ouvrez une V1 protégée et activez le mode Développeur pour l’exporter.');
      return;
    }
    if(!validate()){
      alert('V1 incomplète : corrigez les champs obligatoires avant de l’exporter.');
      return;
    }
    const definition=Core.modelToDefinition(currentModel());
    if(definition.version!=='1.0.0'){
      alert('L’export officiel doit conserver le numéro 1.0.0.');
      return;
    }
    const bridge=window.sebEvalPro;
    try {
      const result=await bridge?.kaloneoDeveloperExportV1?.(definition);
      if(result?.canceled)return;
      if(!result?.ok)throw new Error(result?.error||'Échec de l’export V1.');
      transientStatus('V1 exportée : '+result.filePath,5000);
    }catch(error){
      alert('Export V1 impossible : '+String(error?.message||error));
    }
  }

  async function openDeveloperMode() {
    if(developerUnlocked)return;
    const dialog=$('developer-unlock-dialog');
    dialog.showModal();
    $('developer-password').value='';
  }
  async function confirmDeveloperUnlock() {
    const password=$('developer-password').value;
    try {
      const status=await window.sebEvalPro?.kaloneoDeveloperUnlock?.(password);
      $('developer-password').value='';
      if(!status?.ok)throw new Error(status?.error||'Accès refusé.');
      developerUnlocked=true;
      $('developer-unlock-dialog').close();
      syncProtectedVersionUi();
      transientStatus('Mode Développeur actif',2000);
    }catch(error){
      alert('Déverrouillage refusé : '+String(error?.message||error));
    }
  }

  async function downloadJson() {
    await saveToLibrary({exportJson:true});
  }

  let pendingTypingRefresh=null;
  let pendingLiveTypingFrame=null;
  function queueLiveTypingPreview() {
    invalidateMiniPreview(); // Retirer immédiatement toute capture périmée.
    const field=document.activeElement;
    // Les modifications ciblées sont très légères : réagir pendant cette
    // touche, sans attendre une frame éventuellement suspendue dans Electron.
    if(field?.closest?.('.exercise-block') ||
       ['test-title','test-scenario','test-instruction'].includes(field?.id)) {
      if(pendingLiveTypingFrame!==null){
        cancelAnimationFrame(pendingLiveTypingFrame);
        pendingLiveTypingFrame=null;
      }
      refreshTypingPreview();
      return;
    }
    // Autres propriétés : regrouper les calculs au prochain frame.
    if(pendingLiveTypingFrame!==null)return;
    pendingLiveTypingFrame=requestAnimationFrame(()=>{
      pendingLiveTypingFrame=null;
      refreshTypingPreview();
    });
  }
  function flushTypingRefresh() {
    if(pendingTypingRefresh){clearTimeout(pendingTypingRefresh);pendingTypingRefresh=null;}
    if(pendingLiveTypingFrame!==null){
      cancelAnimationFrame(pendingLiveTypingFrame);
      pendingLiveTypingFrame=null;
    }
    saveDraft(false);
    refreshPreview(); // Validation et capture fidèle différées, après la frappe.
  }
  function changed(options={}) {
    const typing=options.typing===true||changingInputField;
    if(typing){
      // Réagir pendant la frappe sans détruire les champs de l'éditeur.
      // Le vrai moteur Electron ne capture qu'après une pause.
      queueLiveTypingPreview();
      if(pendingTypingRefresh)clearTimeout(pendingTypingRefresh);
      pendingTypingRefresh=setTimeout(flushTypingRefresh,350);
    }else{
      flushTypingRefresh();
    }
    if(!applyingHistory){
      if(typing){
        // Regrouper uniquement la saisie continue, pas les actions ponctuelles.
        builderDirty=true;
        updateDirtyIndicator();
        scheduleHistorySnapshot();
      }else{
        // Image, liste, couleur et bouton : Annuler doit être utilisable
        // immédiatement, sans attendre le délai de frappe de 350 ms.
        commitHistorySnapshot();
      }
    }
  }

  // Le Builder n'impose aucun focus lors de l'ouverture ou de la création.
  // La validation obligatoire se produit au moment de l'enregistrement.
  function ensureTitleEditable() {
    const title=$('test-title');
    if(!title)return;
    title.disabled=false;
    title.readOnly=false;
    title.removeAttribute('aria-disabled');
  }

  function startNewTest(options={}) {
    const ask=options.ask!==false;
    if(ask&&!confirmDiscardChanges('Créer un nouveau test'))return false;
    if(options.clearDraft!==false)localStorage.removeItem(DRAFT_KEY);
    state.idLocked=false;
    state.sourceDefinition=null;
    state.sourceProtectedVersion=false;
    state.blocks=[baseBlock('text')];
    state.supplementaryWindows=[];
    Supplementary?.reset();
    collapsedBlockUids.clear();
    state.blocks.forEach(block=>{if(block?.uid)collapsedBlockUids.add(block.uid);});
    ['toggle-icon-library','toggle-contract-section','toggle-page-style',
      'toggle-validation-section'].forEach(id=>setSectionExpanded(id,false));
    applyMeta(defaultMeta());
    syncProtectedVersionUi();
    renderIconPicker();
    renderBlocks();
    refreshPreview();
    resetHistory({markSaved:true});
    ensureTitleEditable();
    return true;
  }

  function reset() {
    startNewTest({ask:true,clearDraft:true});
  }

  function closeBuilder() {
    if(!confirmDiscardChanges('Fermer le Test Builder'))return;
    window.location.href='../admin-tests-parcours.html';
  }

  function installBuilderHelp(){
    const dialog=$('builder-help-dialog');
    const open=$('open-builder-help');
    const close=$('close-builder-help');
    if(!dialog||!open||!close)return;
    open.addEventListener('click',()=>{
      if(!dialog.open)dialog.showModal();
    });
    close.addEventListener('click',()=>{if(dialog.open)dialog.close();});
    // L'iframe reste en place et garde la dernière rubrique consultée.
    // Aucune modification de brouillon, de focus de champ ou de parcours.
    window.addEventListener('message',event=>{
      if(event.source!==$('builder-help-frame')?.contentWindow)return;
      if(event.data?.type==='kaloneo-builder-help-close'&&dialog.open)dialog.close();
    });
  }

  async function install() {
    installBuilderHelp();
    try {
      const status=await window.sebEvalPro?.kaloneoDeveloperStatus?.();
      developerUnlocked=status?.unlocked===true;
    }catch(_){developerUnlocked=false;}
    const params = new URLSearchParams(window.location.search || '');
    const resumeFromPreview = params.get('resume') === 'preview';
    let restored = false;

    if(resumeFromPreview && typeof window.sebEvalPro?.kaloneoConsumePreviewDefinition === 'function') {
      try {
        const preview = await window.sebEvalPro.kaloneoConsumePreviewDefinition();
        if(preview?.ok && preview.definition) {
          let protectedFromDraft=false;
          try{
            const draft=JSON.parse(localStorage.getItem(DRAFT_KEY)||'null');
            protectedFromDraft=draft?.sourceProtectedVersion===true;
          }catch(_){}
          loadDefinition(
            preview.definition,
            'Retour de l’aperçu Electron — même test restauré',
            {markSaved:false,protectedVersion:protectedFromDraft}
          );
          if(preview.editorHistory)restorePreviewHistory(preview.editorHistory);
          restorePreviewFoldState();
          restored = true;
        }
      } catch (_) {}
    }

    if(!restored && resumeFromPreview){
      restored=restoreDraft();
      if(restored)restorePreviewFoldState();
    }
    if(!resumeFromPreview){
      try{sessionStorage.removeItem(PREVIEW_FOLD_KEY);}catch(_){}
    }
    if(!restored || state.blocks.length===0) {
      state.idLocked=false;
      state.sourceDefinition=null;
      state.sourceProtectedVersion=false;
      state.blocks=[baseBlock('text')];
      state.supplementaryWindows=[];
      applyMeta(defaultMeta());
      syncProtectedVersionUi();
    }

    if(window.KaloneoIconLibrary?.count!==100) {
      alert('Bibliothèque d’icônes KALONÉO incomplète : 100 icônes attendues.');
    }
    renderIconPicker();
    initSectionFold('toggle-icon-library');
    initSectionFold('toggle-contract-section');
    installSimpleBilanLink();
    installNativeSelectPickers();
    initSectionFold('toggle-page-style');
    initSectionFold('toggle-validation-section');
    initSectionFold('toggle-exercise-section');
    Supplementary?.install({
      state,
      openImage:openImageLibrary,
      documentChanged:()=>{
        // Mise à jour documentaire sans IPC, rendu ni capture de l'aperçu.
        saveDraft(false);
        builderDirty=true;
        updateDirtyIndicator();
        scheduleHistorySnapshot();
      },
      blockChanged:()=>changed(),
      blockTyping:()=>changed({typing:true}),
      renderBlocks,
      freeze:()=>invalidateMiniPreview(),
      resume:()=>refreshPreview()
    });
    if(!resumeFromPreview){
      ['toggle-icon-library','toggle-contract-section','toggle-page-style',
        'toggle-validation-section'].forEach(id=>setSectionExpanded(id,false));
      setSectionExpanded('toggle-exercise-section',true);
      collapsedBlockUids.clear();
      state.blocks.forEach(block=>{if(block?.uid)collapsedBlockUids.add(block.uid);});
    }
    $('icon-search').addEventListener('input',renderIconPicker);
    $('clear-icon').addEventListener('click',()=>{
      $('selected-icon-id').value='';
      renderIconPicker();
      changed();
    });

    $('back-tests').addEventListener('click',closeBuilder);
    $('developer-unlock').addEventListener('click',openDeveloperMode);
    $('developer-unlock-cancel').addEventListener('click',()=>{
      $('developer-password').value='';
      $('developer-unlock-dialog').close();
    });
    $('developer-unlock-confirm').addEventListener('click',confirmDeveloperUnlock);
    $('developer-password').addEventListener('keydown',event=>{
      if(event.key==='Enter'){
        event.preventDefault();
        void confirmDeveloperUnlock();
      }
    });
    $('developer-export-v1').addEventListener('click',exportOfficialV1);
    $('undo-change').addEventListener('click',undoChange);
    $('redo-change').addEventListener('click',redoChange);
    $('open-library-test').addEventListener('click',()=>{openLibraryDialog().catch(error=>alert('Bibliothèque inaccessible : '+String(error?.message||error)));});
    $('open-library-image').addEventListener('click',()=>{
      openImageLibrary(null).catch(error=>alert('Bibliothèque d’images inaccessible : '+String(error?.message||error)));
    });
    $('close-image-library').addEventListener('click',()=>$('image-library-dialog').close());
    $('image-library-search').addEventListener('input',()=>{
      // Une recherche de 250 images ne doit pas reconstruire 250 fiches
      // à chaque caractère tapé. La saisie reste instantanée.
      if(imageSearchTimer)clearTimeout(imageSearchTimer);
      imageSearchTimer=setTimeout(()=>{
        imageSearchTimer=null;
        if($('image-library-dialog')?.open)renderImageLibrary();
      },130);
    });
    $('image-library-theme').addEventListener('change',renderImageLibrary);
    $('image-library-orientation').addEventListener('change',renderImageLibrary);
    $('image-library-import-pc').addEventListener('click',()=>{
      if(pcPickerBusy||pcImportBusy)return;
      pcPickerBusy=true;
      const button=$('image-library-import-pc');
      button.disabled=true;button.textContent='Sélection en cours…';
      $('image-library-pc-file').click();
    });
    $('image-library-pc-file').addEventListener('cancel',()=>{
      if(pcImportBusy)return;
      pcPickerBusy=false;
      const button=$('image-library-import-pc');
      button.disabled=false;button.textContent='Importer une image du PC';
    });
    $('image-library-pc-file').addEventListener('change',()=>importImageFromPc()
      .catch(error=>alert('Import de l’image impossible : '+String(error?.message||error))));
    $('close-test-library').addEventListener('click',()=>$('test-library-dialog').close());
    $('test-library-search').addEventListener('input',()=>renderLibraryTests($('test-library-dialog')._kaloneoItems||[]));

    $('make-id').addEventListener('click',()=>{
      if(state.idLocked&&$('test-id').value)return;
      $('test-id').value=normalizeIdFromTitle();
      state.idLocked=Boolean($('test-id').value);
      changed();
    });
    $('test-title').addEventListener('input',()=>{
      if(!state.idLocked)$('test-id').value=normalizeIdFromTitle();
      changed({typing:true});
    });

    document.querySelectorAll('.context-rich-field .context-format-btn').forEach(button=>{
      button.addEventListener('click',()=>{
        applyContextFormat(button.dataset.target,button.dataset.format);
      });
    });
    $('close-text-color-dialog').addEventListener('click',()=>closeTextColorPalette());
    // Esc ferme aussi le dialogue natif ; libérer sa référence sans ramener
    // tardivement le curseur si l'utilisateur a déjà changé de contrôle.
    $('text-color-dialog').addEventListener('close',()=>{
      // Chromium peut rétablir le focus sur l'ancien contrôle de la page
      // (souvent « Titre du test ») APRÈS dialog.close(). La restauration
      // synchrone à la sélection de couleur ne suffit donc pas.
      const target=paletteReturnTarget||textColorTarget;
      paletteReturnTarget=null;
      textColorTarget=null;textColorChanged=null;textColorSelection=null;
      if(target?.isConnected&&!$('text-color-dialog').open){
        // Éviter de voler le curseur si une véritable nouvelle saisie a
        // commencé avant le traitement de l'événement close.
        const active=document.activeElement;
        if(!active||active===document.body||active===$('test-title')||
           active.closest?.('#text-color-dialog')||active===target){
          try{target.focus({preventScroll:true});}catch(_){target.focus();}
        }
      }
    });
    document.querySelectorAll('[data-text-color]').forEach(button=>{
      button.addEventListener('click',()=>{
        closeTextColorPalette(String(button.dataset.textColor||''));
      });
    });

    $('choose-page-background-image').addEventListener('click',()=>{
      openImageLibrary('__page_background__').catch(error=>alert('Bibliothèque d’images inaccessible : '+String(error?.message||error)));
    });
    $('clear-page-background-image').addEventListener('click',()=>{
      const name=$('page-background-image-name');
      name.dataset.imageData='';
      name.dataset.imageName='';
      name.textContent='Aucune image';
      if($('page-background-type').value==='image')$('page-background-type').value='none';
      syncPageBackgroundOptions();
      changed();
    });

    [
      'test-version','test-category','test-scored','test-layout',
      'test-scenario','test-instruction','calculator-compatible','calculator-brand','chrono-enabled',
      'chrono-mode','chrono-min-measures','chrono-max-measures','chrono-auto-reset',
      'chrono-focus-after-stop','chrono-show-time',
      'admin-intervention','admin-instructions','autoevaluation-enabled',
      'external-material','external-material-text',
      'block1-width-chars','block2-width-chars','last-block-remainder',
      'page-background-type','page-background-color'
    ].forEach(id=>{
      const field=$(id);
      // Un seul événement par action : input pour le texte, change pour
      // les sélecteurs et cases. Une seule transaction d'historique.
      const eventName=field.matches('select,input[type="checkbox"]')?'change':'input';
      field.addEventListener(eventName,()=>{
        if(id==='test-layout'){
          $('custom-sizing-row').hidden=field.value!=='chars-rest';
          renderBlocks();
        }else{
          if(id==='test-category')syncPracticalCategory(true);
          if(['calculator-compatible','chrono-enabled','admin-intervention','external-material'].includes(id))syncCapabilityOptions();
          if(id==='page-background-type')syncPageBackgroundOptions();
        }
        changed({typing:eventName==='input'});
      });
    });

    $('add-output').addEventListener('click',()=>{
      setSectionExpanded('toggle-contract-section',true);
      let n=1;const ids=new Set(state.outputs.map(o=>o.id));
      while(ids.has('sortie_'+n))n++;
      state.outputs.push({id:'sortie_'+n,type:'number'});
      renderContractEditors();changed();
    });
    $('add-bilan-contribution').addEventListener('click',()=>{
      setSectionExpanded('toggle-contract-section',true);
      state.bilanContributions.push({lineId:'',bindings:{}});
      renderContractEditors();changed();
    });
    $('test-template').addEventListener('change',()=>applyTemplate($('test-template').value));
    $('save-block-ensemble').addEventListener('click',()=>void saveSelectedEnsemble()
      .catch(e=>alert('Enregistrement impossible : '+String(e.message||e))));
    $('insert-block-ensemble').addEventListener('click',()=>void addSavedEnsemble(state.blocks.length)
      .catch(e=>alert('Insertion impossible : '+String(e.message||e))));
    $('delete-block-ensemble').addEventListener('click',async()=>{
      const id=$('block-ensemble-select').value;
      if(!id||!confirm('Supprimer cet ensemble de ce PC ?'))return;
      try{await Workflow.templates.remove(id);await refreshEnsembles();}
      catch(e){alert('Suppression impossible : '+String(e.message||e));}
    });
    $('close-scoring-audit').addEventListener('click',()=>$('scoring-audit-dialog').close());
    $('audit-test-scoring').addEventListener('click',displayScoringAudit);
    void refreshEnsembles().catch(e=>console.warn('Stockage des ensembles indisponible',e));
    $('add-block').addEventListener('click',()=>{
      state.blocks.push(baseBlock('text'));changed();renderBlocks();
    });
    $('open-electron-preview').addEventListener('click',async()=>{
      flushTypingRefresh();
      const bridge=window.sebEvalPro;
      if(!bridge || typeof bridge.kaloneoOpenPreview!=='function') {
        alert('L’aperçu Electron est disponible depuis SEB EvalPro.');
        return;
      }
      // Arrêter la miniature avant d'ouvrir l'écran candidat interactif.
      invalidateMiniPreview();
      const definition=Core.modelToDefinition(currentModel());
      const editorHistory=capturePreviewHistory();
      savePreviewFoldState();
      try {
        const result=await bridge.kaloneoOpenPreview(definition,editorHistory);
        if(!result || result.ok!==true) {
          try{sessionStorage.removeItem(PREVIEW_FOLD_KEY);}catch(_){}
          alert('Aperçu impossible : '+String(result?.error||'erreur inconnue'));
        }
      } catch(error) {
        try{sessionStorage.removeItem(PREVIEW_FOLD_KEY);}catch(_){}
        alert('Aperçu impossible : '+String(error?.message||error));
      }
    });
    $('save-draft').addEventListener('click',()=>{ saveToLibrary(); });
    $('new-test').addEventListener('click',reset);
    document.addEventListener('keydown',event=>{
      if(!(event.ctrlKey||event.metaKey)||event.altKey)return;
      const key=String(event.key||'').toLowerCase();
      // Dans un champ actif, conserver l'annulation native du texte
      // (y compris le curseur et la sélection), pas l'historique du test.
      if(event.target?.closest?.('input,textarea,[contenteditable="true"]'))return;
      if(key==='z'&&!event.shiftKey){
        event.preventDefault();
        undoChange();
      }else if(key==='y'||(key==='z'&&event.shiftKey)){
        event.preventDefault();
        redoChange();
      }
    });

    $('candidate-preview-resolution')?.addEventListener('change',()=>{
      if(!Supplementary?.isEditing())refreshRealMiniPreview();
    });
    if(typeof ResizeObserver==='function'){
      const observer=new ResizeObserver(()=>fitMiniPreview());
      const viewport=$('candidate-preview-viewport');
      if(viewport)observer.observe(viewport);
    }else{
      window.addEventListener('resize',fitMiniPreview);
    }

    syncProtectedVersionUi();
    Supplementary?.render();
    renderBlocks();
    refreshPreview();
    if(!restored)resetHistory({markSaved:true});
    else if(historyEntries.length===0)resetHistory({markSaved:false});
    // Même après retour d'Aperçu, aucun curseur déplacé d'office.
    ensureTitleEditable();
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>{install().catch(error=>alert('Initialisation du Builder impossible : '+String(error?.message||error)));},{once:true});
  else install().catch(error=>alert('Initialisation du Builder impossible : '+String(error?.message||error)));
})();