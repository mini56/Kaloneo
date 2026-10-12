(() => {
  'use strict';

  const Core = window.KaloneoBuilderCore;
  if (!Core) throw new Error('KALONÉO Builder Core absent.');

  const DRAFT_KEY = 'kaloneo_test_builder_v2';
  const state = {
    idLocked: false,
    sourceDefinition: null,
    blocks: [],
    imageLibraryTargetUid: null,
    imageLibraryItems: [],
    sourceProtectedVersion: false,
    outputs: [],
    bilanContributions: []
  };
  let developerUnlocked=false;
  let textColorTarget = null;
  let textColorChanged = null;

  const HISTORY_LIMIT = 30;
  const SAVED_FINGERPRINT_KEY = 'kaloneo_test_builder_saved_fingerprint';
  let historyEntries = [];
  let historyIndex = -1;
  let historyTimer = null;
  let applyingHistory = false;
  const activeGridEditorColumn=new Map(); // UI only: never saved into KALTEST
  const collapsedBlockUids=new Set(); // état d'affichage uniquement, jamais écrit dans les tests
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
    const section=button.closest('.icon-library-panel,.builder-contract-section');
    content.hidden=!expanded;
    section?.classList.toggle('is-collapsed',!expanded);
    button.textContent=expanded?'▴':'▾';
    button.setAttribute('aria-expanded',String(expanded));
    const name=buttonId==='toggle-icon-library'?'la bibliothèque d’icônes':'Sorties et Bilan';
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
    return {
      title:$('test-title').value.trim(),
      id:$('test-id').value.trim(),
      version:$('test-version').value.trim() || '1.0.0',
      category,
      scored:category==='activite_pratique' ? false : $('test-scored').value === 'true',
      icon:selectedIcon(),
      layout:$('test-layout').value,
      template:$('test-template').value,
      scenario:$('test-scenario').value.trim(),
      instruction:$('test-instruction').value.trim(),
      calculatorCompatible:$('calculator-compatible').checked,
      calculatorDefaultEnabled:false,
      calculatorBrand:$('calculator-brand').value.trim(),
      chronoEnabled:$('chrono-enabled').checked,
      chronoMode:$('chrono-mode').value,
      chronoMinMeasures:Math.max(1,Number($('chrono-min-measures').value)||1),
      chronoMaxMeasures:Math.max(1,Number($('chrono-max-measures').value)||1),
      chronoAutoReset:$('chrono-auto-reset').checked,
      chronoFocusAfterStop:$('chrono-focus-after-stop').checked,
      chronoShowTime:$('chrono-show-time').checked,
      adminIntervention:$('admin-intervention').checked,
      adminInstructions:$('admin-instructions').value.trim(),
      autoevaluation:$('autoevaluation-enabled').checked,
      externalMaterial:$('external-material').checked,
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

  function syncPracticalCategory() {
    const practical=$('test-category').value==='activite_pratique';
    if(practical) $('test-scored').value='false';
    $('test-scored').disabled=practical;
  }

  function displayMultiline(value) {
    return String(value || '').replace(/\\n/g,'\n');
  }

  function renderRichContext(target,value) {
    if(!target)return;
    target.replaceChildren();
    const source=displayMultiline(value);
    const token=/\[(\/)?(b|i|u|c)(?:=(#[0-9a-f]{6}))?\]/gi;
    const stack=[{node:target,tag:null}];
    let cursor=0;
    const appendText=text=>{
      const parts=String(text).split('\n');
      parts.forEach((part,index)=>{
        if(part)stack.at(-1).node.appendChild(document.createTextNode(part));
        if(index<parts.length-1)stack.at(-1).node.appendChild(document.createElement('br'));
      });
    };
    let match;
    while((match=token.exec(source))){
      appendText(source.slice(cursor,match.index));
      const closing=Boolean(match[1]);
      const tag=String(match[2]||'').toLowerCase();
      if(!closing){
        let element;
        if(tag==='c'){
          element=document.createElement('span');
          if(/^#[0-9a-f]{6}$/i.test(String(match[3]||''))) element.style.color=match[3];
        }else{
          element=document.createElement(tag==='b'?'strong':tag==='i'?'em':'u');
        }
        stack.at(-1).node.appendChild(element);
        stack.push({node:element,tag});
      }else{
        for(let i=stack.length-1;i>0;i-=1){
          if(stack[i].tag===tag){stack.length=i;break;}
        }
      }
      cursor=token.lastIndex;
    }
    appendText(source.slice(cursor));
  }

  function applyMarkupToTextarea(input,format,onChanged,color='') {
    if(!input)return;
    const start=Number.isFinite(input.selectionStart)?input.selectionStart:input.value.length;
    const end=Number.isFinite(input.selectionEnd)?input.selectionEnd:start;
    const open=format==='c'?'[c='+color+']':'['+format+']';
    const close='[/'+format+']';
    const selected=input.value.slice(start,end);
    input.value=input.value.slice(0,start)+open+selected+close+input.value.slice(end);
    const nextStart=start+open.length;
    const nextEnd=nextStart+selected.length;
    input.focus();
    input.setSelectionRange(nextStart,nextEnd);
    if(typeof onChanged==='function') onChanged(input.value);
    changed();
  }

  function openTextColorPalette(input,onChanged) {
    textColorTarget=input||null;
    textColorChanged=typeof onChanged==='function'?onChanged:null;
    $('text-color-dialog')?.showModal();
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
      blocks:Core.clone(state.blocks)
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
    const json=JSON.stringify(currentModel());
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
    status.classList.toggle('dirty',builderDirty);
    status.textContent=builderDirty?'Modifications non enregistrées':'Enregistré';
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
    const entry=captureHistoryEntry();
    historyEntries=[entry];
    historyIndex=0;
    if(options.markSaved===true){
      savedFingerprint=entry.fingerprint;
      localStorage.setItem(SAVED_FINGERPRINT_KEY,savedFingerprint);
      builderDirty=false;
    }else{
      setDirtyFromFingerprint(entry.fingerprint);
    }
    syncHistoryButtons();
    updateDirtyIndicator();
  }

  function markCurrentSaved() {
    commitHistorySnapshot();
    const entry=historyEntries[historyIndex]||captureHistoryEntry();
    savedFingerprint=entry.fingerprint;
    localStorage.setItem(SAVED_FINGERPRINT_KEY,savedFingerprint);
    builderDirty=false;
    updateDirtyIndicator();
  }

  function applyHistoryEntry(entry) {
    if(!entry)return;
    applyingHistory=true;
    try{
      const model=JSON.parse(entry.json);
      state.idLocked=Boolean(model.idLocked);
      state.sourceDefinition=model.sourceDefinition||null;
      state.sourceProtectedVersion=model.sourceProtectedVersion===true;
      state.blocks=Array.isArray(model.blocks)?model.blocks:[];
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
    localStorage.setItem(DRAFT_KEY, JSON.stringify(currentModel()));
    if(showStatus)transientStatus('Brouillon local sauvegardé',1200);
  }

  function restoreDraft() {
    try {
      const data=JSON.parse(localStorage.getItem(DRAFT_KEY)||'null');
      if (!data || !data.meta) return false;
      state.idLocked=Boolean(data.idLocked);
      state.sourceDefinition=data.sourceDefinition||null;
      state.sourceProtectedVersion=data.sourceProtectedVersion===true;
      state.blocks=Array.isArray(data.blocks)?data.blocks:[];
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
      if(block.type==='question'&&block.question?.id) ids.add(block.question.id);
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
    row1.append(
      inputField('ID automatique / stable',q.id,()=>{},{readOnly:true,title:'Identifiant généré automatiquement. Il reste stable même si la question est déplacée ou reformulée.'}),
      inputField('Question',q.prompt,value=>{q.prompt=value;changed();},{multiline:true,title:'Entrez le texte de la question présenté au candidat.'})
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

    const row3=document.createElement('div');
    row3.className='field-row cols-3';
    row3.append(
      inputField('Unité(s)',q.units,value=>{q.units=value;changed();},{placeholder:'Séparer par ;',title:'Indiquez les écritures d’unité acceptées, séparées par ;. Laissez vide si aucune unité n’est demandée.'}),
      checkboxField('Champ unité affiché',q.unitInput,value=>{q.unitInput=value;changed();}),
      checkboxField('Unité notée',q.unitScored,value=>{q.unitScored=value;changed();})
    );
    body.appendChild(row3);

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
  function equalAutomaticColumns(table) {
    const count=Math.max(
      Number(table?.cols)||0,
      Array.isArray(table?.headers)?table.headers.length:0,
      ...((table?.cells||[]).map(row=>Array.isArray(row)?row.length:0))
    );
    if(count<2||table.layoutOnly===true)return 0;
    if(Array.from({length:count},(_,i)=>table.columns?.[i])
      .some(column=>Number(column?.widthChars)>=3))return 0;
    if((table.cells||[]).some(row=>(row||[]).some(cell=>
      Number(cell?.rowSpan)>1||Number(cell?.colSpan)>1)))return 0;
    return count;
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
      row.append(label,width,align,rest);
      columns.appendChild(row);
    });
    body.appendChild(columns);
    const widthExplanation=document.createElement('p');
    widthExplanation.className='muted builder-grid-width-explanation';
    const updateWidthExplanation=()=>{
      const equal=equalAutomaticColumns(table);
      widthExplanation.textContent=equal?
        'Largeurs automatiques : les '+equal+' colonnes ont exactement la même largeur.':
        'Les largeurs saisies sont prioritaires ; une colonne sans largeur peut prendre le reste.';
    };
    updateWidthExplanation();
    columns.querySelectorAll('input[type="number"]').forEach(input=>
      input.addEventListener('input',updateWidthExplanation));
    body.appendChild(widthExplanation);

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
          cell.kind=kind.value;
          if(['candidate-answer','select','choice-option','unit'].includes(cell.kind)&&!cell.questionId) {
            cell.questionId=nextQuestionId();
          }
          changed();renderBlocks();
        });
        td.appendChild(kind);

        if(cell.kind==='fixed-text'||cell.kind==='choice-option') {
          const value=document.createElement('input');
          value.type='text';
          value.placeholder=cell.kind==='fixed-text'?'Texte affiché':'Option affichée';
          value.value=cell.value||'';
          value.addEventListener('input',()=>{cell.value=value.value;changed();});
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
            alt.addEventListener('input',()=>{cell.alt=alt.value;changed();});
            td.appendChild(alt);
          }
        }

        if(['candidate-answer','select','choice-option','unit'].includes(cell.kind)) {
          const qid=document.createElement('input');
          qid.type='text';qid.placeholder='ID réponse';qid.value=cell.questionId||'';
          qid.title='ID stable de la réponse. Pour un choix unique en ligne, les cellules options peuvent partager le même ID.';
          qid.addEventListener('input',()=>{cell.questionId=Core.cleanId(qid.value);changed();});
          td.appendChild(qid);

          const expected=document.createElement('input');
          expected.type='text';expected.placeholder='Réponse attendue';expected.value=cell.acceptedAnswers||'';
          expected.addEventListener('input',()=>{cell.acceptedAnswers=expected.value;changed();});
          td.appendChild(expected);

          if(cell.kind==='select'||cell.kind==='choice-option') {
            const options=document.createElement('input');
            options.type='text';options.placeholder='Choix séparés par ;';options.value=(cell.options||[]).join('; ');
            options.addEventListener('input',()=>{cell.options=splitValues(options.value);changed();});
            td.appendChild(options);
          }
        }

        const span=document.createElement('div');
        span.className='cell-span-editor';
        const rs=document.createElement('input');rs.type='number';rs.min='1';rs.value=cell.rowSpan||1;rs.title='Fusion verticale';
        const cs=document.createElement('input');cs.type='number';cs.min='1';cs.value=cell.colSpan||1;cs.title='Fusion horizontale';
        rs.addEventListener('input',()=>{cell.rowSpan=Math.max(1,Number(rs.value)||1);changed();});
        cs.addEventListener('input',()=>{cell.colSpan=Math.max(1,Number(cs.value)||1);changed();});
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
  }

  function renderMultipleTableEditor(block,body) {
    const t=block.tableDefinition||(block.tableDefinition={id:uid('tabledef'),title:'',headers:['Colonne 1','Colonne 2'],questionIds:[]});
    const row=document.createElement('div');
    row.className='field-row cols-3';
    row.append(
      inputField('ID du tableau',t.id||'',value=>{t.id=Core.cleanId(value);changed();}),
      inputField('Titre',t.title||'',value=>{t.title=value;changed();}),
      inputField('En-têtes', (t.headers||[]).join('; '),value=>{t.headers=splitValues(value);changed();})
    );
    body.appendChild(row);
    body.appendChild(inputField('Questions utilisées — IDs séparés par ;',(t.questionIds||[]).join('; '),value=>{
      t.questionIds=splitValues(value);changed();
    },{placeholder:'question_1; question_2'}));
  }

  function normalizedSearch(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  }

  function blockByUid(uidValue) {
    return state.blocks.find(block => String(block.uid) === String(uidValue || '')) || null;
  }

  async function useLibraryImage(imageId) {
    const result=await window.sebEvalPro?.kaloneoGetImage?.(imageId);
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

    if(String(state.imageLibraryTargetUid||'').startsWith('__block_background__:')){
      const uidValue=String(state.imageLibraryTargetUid).slice('__block_background__:'.length);
      const block=blockByUid(uidValue);
      if(!block)return false;
      block.backgroundImage=result.image.data;
      changed();renderBlocks();$('image-library-dialog')?.close();return true;
    }
    const target=blockByUid(state.imageLibraryTargetUid);
    if(!target || target.type!=='image') return false;
    target.mediaName=result.image.name||'image';
    target.mediaType=result.image.mime||'image/*';
    target.mediaData=result.image.data;
    target.mediaAlt=target.mediaAlt||result.image.name||'Image';
    target.mediaPlaceholder='';
    changed();
    renderBlocks();
    $('image-library-dialog')?.close();
    return true;
  }

  function renderImageLibrary() {
    const root=$('image-library-list');
    if(!root)return;
    const search=normalizedSearch($('image-library-search')?.value||'');
    // Galerie de conception : exclure les ressources techniques et regrouper les copies.
    // Ne jamais modifier state.imageLibraryItems, les fichiers stockés ni les IDs utilisés par les tests.
    const gallery=window.KaloneoImageGallery.prepare(state.imageLibraryItems||[]);
    const visibleImages=gallery.images;
    const themeSelect=$('image-library-theme');
    const selectedTheme=String(themeSelect?.value||'');
    const themes=[...new Set(visibleImages.map(item=>String(item.theme||item.category||'')).filter(Boolean))]
      .sort((a,b)=>a.localeCompare(b,'fr'));
    if(themeSelect){
      const previous=selectedTheme;
      themeSelect.replaceChildren(new Option('Tous les thèmes',''));
      themes.forEach(theme=>themeSelect.append(new Option(theme,theme)));
      themeSelect.value=themes.includes(previous)?previous:'';
    }
    const themeFilter=String(themeSelect?.value||'');
    const orientationFilter=String($('image-library-orientation')?.value||'');
    const items=visibleImages.filter(item=>{
      const itemTheme=String(item.theme||item.category||'');
      if(themeFilter&&itemTheme!==themeFilter)return false;
      if(orientationFilter&&String(item.orientation||'')!==orientationFilter)return false;
      const haystack=normalizedSearch([item.name,item.category,item.theme,item.orientation,item.sourceName].filter(Boolean).join(' '));
      return !search||haystack.includes(search);
    });
    root.replaceChildren();
    const status=$('image-library-status');
    if(status){
      const shown=Math.min(items.length,250);
      status.textContent=shown+' image'+(shown>1?'s':'')+' affichée'+(shown>1?'s':'')+
        (items.length>shown?' sur '+items.length+' disponibles':'')+
        (gallery.hiddenTechnical?', '+gallery.hiddenTechnical+' image'+(gallery.hiddenTechnical>1?'s':'')+' du programme masquée'+(gallery.hiddenTechnical>1?'s':''):'')+
        (gallery.duplicates?', '+gallery.duplicates+' doublon'+(gallery.duplicates>1?'s':'')+' regroupé'+(gallery.duplicates>1?'s':''):'')+
        (state.imageLibraryTargetUid?' — choisissez une image pour le bloc courant.':' — bibliothèque générale.');
    }

    items.slice(0,250).forEach(item=>{
      const card=document.createElement('article');
      card.className='image-library-card';
      const preview=document.createElement('div');
      preview.className='image-library-preview';
      const img=document.createElement('img');
      img.alt=item.name||'Image';
      img.loading='lazy';
      preview.appendChild(img);
      const info=document.createElement('div');
      info.className='image-library-info';
      const title=document.createElement('strong');title.textContent=item.name||item.id;
      const meta=document.createElement('span');
      meta.textContent=[item.theme||item.category||'Images',item.orientation,item.systemProvided?'système':'personnelle'].filter(Boolean).join(' • ');
      info.append(title,meta);
      card.append(preview,info);

      if(state.imageLibraryTargetUid){
        const use=document.createElement('button');
        use.type='button';
        use.className='mini-btn image-library-use';
        use.textContent='Utiliser';
        use.addEventListener('click',()=>useLibraryImage(item.id).catch(error=>alert('Image impossible à utiliser : '+String(error?.message||error))));
        card.appendChild(use);
      }

      window.sebEvalPro?.kaloneoGetImage?.(item.id).then(result=>{
        if(result?.ok&&result.image?.data)img.src=result.image.data;
      }).catch(()=>{});
      root.appendChild(card);
    });
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
    state.imageLibraryTargetUid=targetUid||null;
    await reloadImageLibrary();
    $('image-library-dialog')?.showModal();
    requestAnimationFrame(()=>$('image-library-search')?.focus());
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
    if(!file)return;
    const result=await importImages([file]);
    if(result?.firstImageId){
      if(state.imageLibraryTargetUid)await useLibraryImage(result.firstImageId);
      return;
    }
    if(result?.failed)alert('Cette image n’a pas pu être importée. Choisissez un fichier image valide.');
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

    if(block.type==='image'){
      const choose=document.createElement('button');
      choose.type='button';choose.className='mini-btn choose-library-image';
      choose.textContent=block.mediaData?'Changer l’image':'Choisir une image';
      choose.addEventListener('click',()=>openImageLibrary(block.uid).catch(error=>alert('Bibliothèque d’images inaccessible : '+String(error?.message||error))));
      body.appendChild(choose);
      appendImageScaleControls(body,block,'imageScale','Taille de l’image dans le bloc');
      body.appendChild(selectField('Alignement de l’image',String(block.imageAlign||'center'),[
        ['center','Centré'],['left','Gauche'],['right','Droite']
      ],value=>{block.imageAlign=value;changed();renderBlocks();}));
    }
    body.appendChild(inputField('Texte alternatif',block.mediaAlt||'',value=>{block.mediaAlt=value;changed();}));

    const name=document.createElement('div');
    name.className='file-preview-name';
    name.textContent=block.mediaName?'Embarqué : '+block.mediaName:(block.mediaPlaceholder||'Aucun fichier sélectionné');
    body.appendChild(name);

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
    body.appendChild(remove);
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

    requestAnimationFrame(()=>{
      const target=document.querySelector('[data-uid="'+questionBlock.uid+'"] textarea');
      target?.focus();
    });
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
      block.backgroundColor=value;
      changed();
      renderBlocks();
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
      if(block.type==='text')appendImageScaleControls(more,block,'backgroundScale','Taille de l’image de fond');
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

  function renderBlockBody(block,body,index) {
    body.innerHTML='';
    renderBlockStyleEditor(block,body);
    if(block.type==='text') {
      const field=inputField('Texte',block.text,value=>{block.text=value;changed({typing:true});},{
        multiline:true,
        placeholder:'Texte affiché au candidat',
        title:'Écrivez le contenu librement. Placez le curseur puis utilisez « Insérer une Question au curseur ».'
      });
      body.appendChild(field);
      const textarea=field.querySelector('textarea');
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
  function renderContractEditors(){
    const outHost=$('outputs-editor'),bilanHost=$('bilan-editor');
    if(!outHost||!bilanHost)return;
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
  }
  function validateContract(add){
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

  function renderBlocks() {
    const host=$('blocks-editor');
    host.innerHTML='';
    const split=$('test-layout').value!=='single';

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
        zone.title='Choisir la zone de ce bloc';
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
      frag.querySelector('.remove-block').addEventListener('click',()=>{
        if(!confirm('Supprimer le bloc complet '+(index+1)+' ? Tout le contenu de ce bloc sera perdu.')) return;
        collapsedBlockUids.delete(block.uid);
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
        foldButton.textContent=collapsed?'▾':'▴';
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
    });

    refreshPreview();
  }

  function createQuestionPreview(block) {
    const q=block.question||{};
    const wrap=document.createElement('div');
    wrap.className='preview-question';
    const label=document.createElement('label');
    label.textContent=q.prompt||'Question sans texte';
    wrap.appendChild(label);
    if(q.example) {
      const tag=document.createElement('span');
      tag.className='example-tag';
      tag.textContent='Exemple';
      label.appendChild(tag);
    }
    if(['single-choice','select','boolean'].includes(q.responseType)) {
      const select=document.createElement('select');
      const empty=document.createElement('option');empty.textContent='Choisir…';select.appendChild(empty);
      const values=q.responseType==='boolean'?['Vrai','Faux']:splitValues(q.options);
      values.forEach(v=>{const o=document.createElement('option');o.textContent=v;select.appendChild(o);});
      wrap.appendChild(select);
    } else if(q.responseType==='multiple-choice') {
      const choices=document.createElement('div');
      splitValues(q.options).forEach(v=>{const l=document.createElement('label');l.className='inline-checkbox';const cb=document.createElement('input');cb.type='checkbox';l.append(cb,document.createTextNode(' '+v));choices.appendChild(l);});
      wrap.appendChild(choices);
    } else if(q.responseType==='free-text') {
      const input=document.createElement('textarea');
      input.rows=5;
      input.className='preview-free-text';
      input.placeholder='Votre réponse';
      wrap.appendChild(input);
    } else {
      const input=document.createElement('input');
      input.type='text';
      input.placeholder=q.responseType==='duration'?'Ex. 9h15':'Votre réponse';
      wrap.appendChild(input);
    }
    return wrap;
  }

  function applyPreviewColumn(cell,col) {
    if(!cell||!col)return;
    if(Number(col.widthChars)>=3) {
      cell.style.width=Number(col.widthChars)+'ch';
      cell.style.minWidth=Number(col.widthChars)+'ch';
      cell.style.maxWidth=Number(col.widthChars)+'ch';
    }
    if(col.align) cell.style.textAlign=col.align;
  }

  function gridPreview(block) {
    const t=block.table||{};
    const wrap=document.createElement('div');
    wrap.className='preview-grid-wrap';
    if(t.title) {const h=document.createElement('h3');h.textContent=t.title;wrap.appendChild(h);}
    const table=document.createElement('table');
    table.className='preview-grid-table';
    const equal=equalAutomaticColumns(t);
    if(equal){
      table.classList.add('preview-grid-equal-auto');
      const group=document.createElement('colgroup');
      for(let i=0;i<equal;i++){
        const col=document.createElement('col');
        col.style.width=(100/equal)+'%';
        group.appendChild(col);
      }
      table.appendChild(group);
    }
    if(t.layoutOnly===true){table.classList.add('kaloneo-layout-only');table.style.border='0';table.style.background='transparent';}
    if(Array.isArray(t.headers)&&t.headers.length) {
      const tr=document.createElement('tr');
      t.headers.forEach((h,i)=>{const th=document.createElement('th');th.textContent=h;applyPreviewColumn(th,t.columns?.[i]);tr.appendChild(th);});
      const thead=document.createElement('thead');thead.appendChild(tr);table.appendChild(thead);
    }
    const tbody=document.createElement('tbody');
    (t.cells||[]).forEach(row=>{
      const tr=document.createElement('tr');
      row.forEach((cell,i)=>{
        const td=document.createElement('td');
        if(t.layoutOnly===true){td.style.border='0';td.style.background='transparent';}
        applyPreviewColumn(td,t.columns?.[i]);
        if((cell.rowSpan||1)>1) td.rowSpan=cell.rowSpan;
        if((cell.colSpan||1)>1) td.colSpan=cell.colSpan;
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
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
    return wrap;
  }

  function responseTablePreview(block) {
    const t=ensureResponseColumns(block);
    const wrap=document.createElement('div');
    wrap.className='preview-grid-wrap';
    const table=document.createElement('table');
    table.className='preview-grid-table';
    const tr=document.createElement('tr');
    t.headers.forEach((h,i)=>{const th=document.createElement('th');th.textContent=h;applyPreviewColumn(th,t.columns[i]);tr.appendChild(th);});
    const thead=document.createElement('thead');thead.appendChild(tr);table.appendChild(thead);
    const tbody=document.createElement('tbody');
    const questions=state.blocks.filter(b=>b.type==='question');
    questions.forEach((q,index)=>{
      const row=document.createElement('tr');
      t.headers.forEach((h,i)=>{
        const td=document.createElement('td');applyPreviewColumn(td,t.columns[i]);
        if(i===0) td.textContent=String(index+1);
        else {const input=document.createElement('input');input.type='text';td.appendChild(input);}
        row.appendChild(td);
      });
      tbody.appendChild(row);
    });
    table.appendChild(tbody);wrap.appendChild(table);
    return wrap;
  }

  function inlinePreview(block) {
    const wrap=document.createElement('div');
    wrap.className='preview-inline-flow';
    const bank=document.createElement('div');bank.className='preview-word-bank';
    (block.wordBank||[]).forEach(w=>{const s=document.createElement('span');s.textContent=w;bank.appendChild(s);});
    wrap.appendChild(bank);
    const flow=document.createElement('div');
    (block.flow||[]).forEach(item=>{
      if(item.type==='text') {
        flow.appendChild(document.createTextNode(item.text||''));
        if(item.breakAfterSentence) {flow.appendChild(document.createElement('br'));flow.appendChild(document.createElement('br'));}
      } else if(item.type==='question') {
        const input=document.createElement('input');input.type='text';input.placeholder=item.questionId||'';flow.appendChild(input);
      }
    });
    wrap.appendChild(flow);
    return wrap;
  }

  function blockPreview(block) {
    const wrap=document.createElement('div');
    wrap.className='preview-content-block';
    let node=wrap;

    if(block.type==='text') {
      renderRichContext(wrap,block.text||'Bloc texte vide');
    } else if(block.type==='html'||block.type==='html-js') {
      const frame=document.createElement('iframe');
      frame.className='preview-html-frame';frame.sandbox='allow-scripts';
      frame.srcdoc='<!doctype html><html><body style="font-family:Calibri,Arial,sans-serif;margin:10px">'+
        (block.html||'<em>Bloc HTML vide</em>')+
        (block.type==='html-js'&&block.js?'<script>'+block.js.replace(/<\/script/gi,'<\\/script')+'</script>':'')+
        '</body></html>';
      wrap.appendChild(frame);
    } else if(block.type==='image'&&block.mediaData) {
      wrap.classList.add('preview-media-block');
      const img=document.createElement('img');img.className='preview-media';img.src=String(block.mediaData).startsWith('imageqcm/')?'../'+block.mediaData:block.mediaData;img.alt=block.mediaAlt||block.mediaName||'Image';
      const scale=Number(block.imageScale);if(scale>=10&&scale<100){img.style.width=scale+'%';img.style.height='auto';img.style.maxHeight='100%';}
      if(['left','right'].includes(block.imageAlign)){
        wrap.style.justifyContent=block.imageAlign==='left'?'flex-start':'flex-end';
        img.style.margin='auto 0';
      }
      wrap.appendChild(img);
    } else if(block.type==='audio'&&block.mediaData) {
      const a=document.createElement('audio');a.controls=true;a.src=block.mediaData;a.style.width='100%';wrap.appendChild(a);
    } else if(block.type==='video'&&block.mediaData) {
      wrap.classList.add('preview-media-block');
      const v=document.createElement('video');v.controls=true;v.src=block.mediaData;v.className='preview-media';wrap.appendChild(v);
    } else if(['image','audio','video'].includes(block.type)) {
      wrap.textContent=block.mediaPlaceholder||'Aucun média sélectionné';
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
    } else if(block.type==='question') {
      node=createQuestionPreview(block);
    } else if(block.type==='table-grid') {
      node=gridPreview(block);
    } else if(block.type==='response-table') {
      node=responseTablePreview(block);
    } else if(block.type==='inline-flow') {
      node=inlinePreview(block);
    } else if(block.type==='multiple-tables') {
      const h=document.createElement('h3');h.textContent=block.tableDefinition?.title||'Tableau';
      wrap.appendChild(h);
      const p=document.createElement('div');p.textContent=(block.tableDefinition?.headers||[]).join(' | ');wrap.appendChild(p);
    }
    node.classList.add('preview-content-block');
    return applyPreviewBlockStyle(node,block);
  }

  const MINI_PREVIEW_WIDTH=1366;
  const MINI_PREVIEW_HEIGHT=768;
  let miniPreviewTimer=null;
  let miniPreviewRevision=0;
  function refreshRealMiniPreview() {
    const revision=++miniPreviewRevision;
    if(miniPreviewTimer)clearTimeout(miniPreviewTimer);
    const image=$('candidate-preview-snapshot');
    const status=$('candidate-preview-status');
    if(!image||!status)return;
    // Garder la dernière capture visible pendant la frappe ; la nouvelle la remplace dès qu'elle est prête.
    // Une seule capture sera lancée après la pause de saisie, jamais à chaque caractère.
    status.textContent='Actualisation du rendu candidat…';
    status.hidden=false;
    miniPreviewTimer=setTimeout(async()=>{
      const bridge=window.sebEvalPro;
      if(!bridge?.kaloneoRenderMiniPreview) {
        status.textContent='Miniature fidèle disponible uniquement dans Electron.';
        return;
      }
      try {
        const result=await bridge.kaloneoRenderMiniPreview(Core.modelToDefinition(currentModel()));
        if(revision!==miniPreviewRevision)return; // capture précédente obsolète
        if(!result?.ok||!result.image) {
          status.textContent='Aperçu indisponible : '+String(result?.error||'rendu candidat non reçu');
          return;
        }
        image.src=result.image;
        image.hidden=false;
        status.hidden=true;
        const warnings=[];
        if(result.report?.overflowZones)warnings.push('débordement de bloc');
        if(result.report?.tableHorizontalOverflow)warnings.push('tableau trop large');
        if(result.report?.brokenImages?.length)warnings.push('image introuvable');
        const alert=$('candidate-preview-warning');
        if(alert){
          alert.textContent=warnings.length?
            'À corriger dans le rendu candidat : '+warnings.join(', ')+'.':
            'Réduction fidèle du rendu candidat 1366 × 768.';
        }
      } catch(error) {
        if(revision===miniPreviewRevision)status.textContent='Impossible de calculer le rendu : '+String(error?.message||error);
      }
    },850);
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

  function refreshPreview() {
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

    if(m.layout==='single') {
      const zone=document.createElement('div');zone.className='preview-zone';
      state.blocks.forEach(block=>zone.appendChild(blockPreview(block)));
      host.appendChild(zone);
    } else {
      const left=document.createElement('div');left.className='preview-zone';
      const right=document.createElement('div');right.className='preview-zone';
      if(m.layout==='chars-rest') {
        const a=Number(m.block1WidthChars);
        const b=Number(m.block2WidthChars);
        host.style.gridTemplateColumns=(a>=3?a+'ch':'minmax(0,1fr)')+' '+(m.lastBlockRemainder?'minmax(0,1fr)':(b>=3?b+'ch':'minmax(0,1fr)'));
      } else {
        host.style.removeProperty('grid-template-columns');
      }
      state.blocks.forEach(block=>(block.zone==='right'?right:left).appendChild(blockPreview(block)));
      host.append(left,right);
    }
    validate();
    requestAnimationFrame(fitMiniPreview);
    refreshRealMiniPreview();
  }

  function validate() {
    const m=collectMeta();
    const items=[];
    const add=(ok,text)=>items.push({ok:Boolean(ok),text});
    add(Boolean(m.title),'Titre renseigné');
    add(Boolean(m.id),'Identifiant du test créé');
    add(Boolean(m.scenario),'Scénario renseigné');
    add(Boolean(m.instruction),'Consigne renseignée');
    add(state.blocks.some(b=>!['image','audio','video'].includes(b.type) ||
      Boolean(b.mediaData||b.mediaName||b.mediaPlaceholder)),'Au moins un bloc Exercice');

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

    const ul=$('validation-list');
    ul.innerHTML='';
    items.forEach(item=>{
      const li=document.createElement('li');
      li.className=item.ok?'ok':'error';
      li.textContent=(item.ok?'OK — ':'À corriger — ')+item.text;
      ul.appendChild(li);
    });
    return items.every(item=>item.ok);
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
    const stateText=$('developer-mode-status');
    if(exportV1)exportV1.hidden=!(developerEditing&&developerUnlocked);
    if(stateText)stateText.textContent='V1 modifiables et enregistrables en session Administrateur';
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
    collapsedBlockUids.clear(); // chaque nouveau test s'ouvre déployé
    applyMeta(model.meta);
    syncProtectedVersionUi();
    renderIconPicker();
    $('test-template').value=model.meta.template && Array.from($('test-template').options).some(o=>o.value===model.meta.template)
      ? model.meta.template : 'generic';
    saveDraft(false);
    renderBlocks();
    refreshPreview();
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
      activite_pratique:'Activités pratiques'
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
    requestAnimationFrame(()=>$('test-library-search')?.focus());
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
    requestAnimationFrame(()=>$('developer-password').focus());
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
  function flushTypingRefresh() {
    if(pendingTypingRefresh){clearTimeout(pendingTypingRefresh);pendingTypingRefresh=null;}
    saveDraft(false);
    refreshPreview();
  }
  function changed(options={}) {
    const typing=options.typing===true||changingInputField;
    if(typing){
      // Le moteur de capture Electron recharge une vraie page candidat : ne jamais le lancer pendant la frappe.
      // Conserver immédiatement la valeur dans le modèle, puis enregistrer et prévisualiser après une courte pause.
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

  function focusTitleField() {
    requestAnimationFrame(() => {
      const title = $('test-title');
      if (!title) return;
      title.disabled = false;
      title.readOnly = false;
      title.removeAttribute('aria-disabled');
      try {
        title.focus({ preventScroll:true });
        title.setSelectionRange(0, title.value.length);
      } catch (_) {
        title.focus();
      }
    });
  }

  function startNewTest(options={}) {
    const ask=options.ask!==false;
    if(ask&&!confirmDiscardChanges('Créer un nouveau test'))return false;
    if(options.clearDraft!==false)localStorage.removeItem(DRAFT_KEY);
    state.idLocked=false;
    state.sourceDefinition=null;
    state.sourceProtectedVersion=false;
    state.blocks=[baseBlock('text')];
    collapsedBlockUids.clear();
    applyMeta(defaultMeta());
    syncProtectedVersionUi();
    renderIconPicker();
    renderBlocks();
    refreshPreview();
    resetHistory({markSaved:true});
    focusTitleField();
    return true;
  }

  function reset() {
    startNewTest({ask:true,clearDraft:true});
  }

  function closeBuilder() {
    if(!confirmDiscardChanges('Fermer le Test Builder'))return;
    window.location.href='../admin-tests-parcours.html';
  }

  async function install() {
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
          restored = true;
        }
      } catch (_) {}
    }

    if(!restored && resumeFromPreview) restored = restoreDraft();
    if(!restored || state.blocks.length===0) {
      state.idLocked=false;
      state.sourceDefinition=null;
      state.sourceProtectedVersion=false;
      state.blocks=[baseBlock('text')];
      applyMeta(defaultMeta());
      syncProtectedVersionUi();
    }

    if(window.KaloneoIconLibrary?.count!==100) {
      alert('Bibliothèque d’icônes KALONÉO incomplète : 100 icônes attendues.');
    }
    renderIconPicker();
    initSectionFold('toggle-icon-library');
    initSectionFold('toggle-contract-section');
    $('jump-to-icon-picker')?.addEventListener('click',()=>{
      setSectionExpanded('toggle-icon-library',true);
      $('icon-picker')?.closest('.icon-library-panel')?.scrollIntoView({block:'start',behavior:'smooth'});
      $('icon-search')?.focus({preventScroll:true});
    });
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
    $('close-image-library').addEventListener('click',()=>$('image-library-dialog').close());
    $('image-library-search').addEventListener('input',renderImageLibrary);
    $('image-library-theme').addEventListener('change',renderImageLibrary);
    $('image-library-orientation').addEventListener('change',renderImageLibrary);
    $('image-library-import-pc').addEventListener('click',()=>$('image-library-pc-file').click());
    $('image-library-pc-file').addEventListener('change',()=>importImageFromPc().catch(error=>alert('Import de l’image impossible : '+String(error?.message||error))));
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
      changed();
    });

    document.querySelectorAll('.context-rich-field .context-format-btn').forEach(button=>{
      button.addEventListener('click',()=>{
        applyContextFormat(button.dataset.target,button.dataset.format);
      });
    });
    $('close-text-color-dialog').addEventListener('click',()=>$('text-color-dialog').close());
    document.querySelectorAll('[data-text-color]').forEach(button=>{
      button.addEventListener('click',()=>{
        const color=String(button.dataset.textColor||'');
        if(textColorTarget&&/^#[0-9a-f]{6}$/i.test(color)) {
          applyMarkupToTextarea(textColorTarget,'c',textColorChanged,color);
        }
        $('text-color-dialog').close();
        textColorTarget=null;
        textColorChanged=null;
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
      $(id).addEventListener('input',()=>{
        if(id==='test-layout') {
          $('custom-sizing-row').hidden=$('test-layout').value!=='chars-rest';
          renderBlocks();
        } else {
          if(id==='test-category') syncPracticalCategory();
          if(['calculator-compatible','chrono-enabled','admin-intervention','external-material'].includes(id)) syncCapabilityOptions();
          if(id==='page-background-type') syncPageBackgroundOptions();
          changed();
        }
      });
      $(id).addEventListener('change',()=>{
        if(id==='test-layout') {
          $('custom-sizing-row').hidden=$('test-layout').value!=='chars-rest';
          renderBlocks();
        } else {
          if(id==='test-category') syncPracticalCategory();
          if(['calculator-compatible','chrono-enabled','admin-intervention','external-material'].includes(id)) syncCapabilityOptions();
          if(id==='page-background-type') syncPageBackgroundOptions();
          changed();
        }
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
      const definition=Core.modelToDefinition(currentModel());
      try {
        const result=await bridge.kaloneoOpenPreview(definition);
        if(!result || result.ok!==true) {
          alert('Aperçu impossible : '+String(result?.error||'erreur inconnue'));
        }
      } catch(error) {
        alert('Aperçu impossible : '+String(error?.message||error));
      }
    });
    $('save-draft').addEventListener('click',()=>{ saveToLibrary(); });
    $('new-test').addEventListener('click',reset);
    document.addEventListener('keydown',event=>{
      if(!(event.ctrlKey||event.metaKey)||event.altKey)return;
      const key=String(event.key||'').toLowerCase();
      if(key==='z'&&!event.shiftKey){
        event.preventDefault();
        undoChange();
      }else if(key==='y'||(key==='z'&&event.shiftKey)){
        event.preventDefault();
        redoChange();
      }
    });

    if(typeof ResizeObserver==='function'){
      const observer=new ResizeObserver(()=>fitMiniPreview());
      const viewport=$('candidate-preview-viewport');
      if(viewport)observer.observe(viewport);
    }else{
      window.addEventListener('resize',fitMiniPreview);
    }

    syncProtectedVersionUi();
    renderBlocks();
    refreshPreview();
    if(!restored)resetHistory({markSaved:true});
    else if(historyEntries.length===0)resetHistory({markSaved:false});
    if(!resumeFromPreview)focusTitleField();
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>{install().catch(error=>alert('Initialisation du Builder impossible : '+String(error?.message||error)));},{once:true});
  else install().catch(error=>alert('Initialisation du Builder impossible : '+String(error?.message||error)));
})();