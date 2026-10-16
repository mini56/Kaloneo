(()=>{
'use strict';

const Core=window.KaloneoBuilderCore;
const root=document.getElementById('kaloneo-real-preview');
if(!Core||!root) throw new Error('KALONÉO : moteur Builder indisponible.');

const state={definition:null,model:null,chrono:null,statusTimer:null};
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined&&text!==null)n.textContent=text;return n;};

function flash(message){
  let box=document.querySelector('.kb-status');
  if(!box){box=el('div','kb-status');document.body.append(box);}
  box.textContent=message;
  clearTimeout(state.statusTimer);
  state.statusTimer=setTimeout(()=>box.remove(),1700);
}

function questionMap(){
  return new Map((state.definition?.questions||[]).map(q=>[String(q.id||''),q]));
}

function makeAnswerControl(question){
  const type=String(question?.response?.type||'text');
  const options=Array.isArray(question?.response?.options)?question.response.options:[];
  if(type==='select'){
    const select=el('select','kb-select');
    select.append(new Option('— Choisir —',''));
    options.forEach(v=>select.append(new Option(v,v)));
    return select;
  }
  if(type==='single-choice'||type==='multiple-choice'||type==='boolean'){
    const wrap=el('div','kb-choice-list');
    const values=type==='boolean'?['Vrai','Faux']:options;
    values.forEach((value,index)=>{
      const label=el('label','kb-choice');
      const input=document.createElement('input');
      input.type=type==='multiple-choice'?'checkbox':'radio';
      input.name='preview_'+String(question?.id||'q')+'_'+(type==='multiple-choice'?index:'one');
      input.value=value;
      label.append(input,document.createTextNode(value));
      wrap.append(label);
    });
    return wrap;
  }
  const input=el('input','kb-input');
  input.type='text';
  if(['number','number-unit'].includes(type)) input.inputMode='decimal';
  if(type==='duration') input.placeholder='Ex. 9h15';
  return input;
}

function renderQuestion(block){
  const q=block.question||{};
  const wrap=el('section','kb-block');
  wrap.append(window.KaloneoSharedPresentation.renderQuestion({
    doc:document,question:{
      id:q.id,prompt:q.prompt||'Question',
      answerLayout:q.answerLayout||'',
      answerWidthChars:q.answerWidthChars??''
    },
    // Un bloc multi-choix ne doit pas être contenu dans une étiquette <label>.
    rowTag:'div',captionClassName:'kb-question-label',
    makeAnswer:()=>makeAnswerControl({
      id:q.id,response:{type:q.responseType||'text',options:Core.splitValues(q.options||'')}
    })
  }));
  if(q.unitInput){
    const unit=el('input','kb-input');unit.placeholder='Unité';
    unit.style.marginTop='6px';wrap.append(unit);
  }
  return wrap;
}

function renderResponseTable(block){
  const definition=block.responseTable||{};
  const headers=Array.isArray(definition.headers)&&definition.headers.length
    ?definition.headers:['Question N°','Réponse','Unités'];
  const columns=Array.isArray(definition.columns)?definition.columns:[];
  const questions=state.definition?.questions||[];
  return window.KaloneoSharedPresentation.renderResponseTable({
    doc:document,headers,columns,rows:questions,
    className:'kb-table',wrapperClassName:'kb-block kb-table-wrap',
    renderCell:({cell,row:question,rowIndex,colIndex})=>{
      if(colIndex===0)cell.textContent=String(rowIndex+1);
      else if(colIndex===1)cell.appendChild(makeAnswerControl(question));
      else if(colIndex===2&&question.unitInput){
        const unit=el('input','kb-input');unit.placeholder='Unité';cell.appendChild(unit);
      }else if(colIndex>=3&&question.supplementalFields?.[colIndex-3]){
        const extra=el('input','kb-input');
        extra.placeholder=question.supplementalFields[colIndex-3].label||headers[colIndex]||'';
        cell.appendChild(extra);
      }
    },
    renderEmptyRow:({doc,headers})=>{
      const cell=doc.createElement('td');
      cell.className='kb-empty';cell.textContent='Aucune question définie';
      cell.colSpan=headers.length;
      return [cell];
    }
  });
}

function renderGrid(block){
  const definition=block.table||{};
  const questions=questionMap();
  return window.KaloneoSharedPresentation.renderGridTable({
    doc:document,definition,
    wrapperClassName:'kb-block kb-table-wrap',className:'kb-table',
    compactClassName:'kb-compact-grid',equalClassName:'kb-grid-equal-auto',
    titleTag:'div',titleClassName:'kb-question-label',skipHiddenCells:true,
    renderCell:({cell:td,cellDefinition,rowIndex,colIndex})=>{
      const column=definition.columns?.[colIndex];
      td.classList.add(column?.align==='left'?'left':'center');
      const kind=String(cellDefinition.kind||'empty');
      if(kind==='fixed-text') td.textContent=String(cellDefinition.value||'');
      else if(['image','audio','video'].includes(kind)){
        const source=String(cellDefinition.value||'');
        const accepted=(kind==='image'&&/^data:image\//i.test(source))||
          (kind==='audio'&&/^data:audio\//i.test(source))||
          (kind==='video'&&/^data:video\//i.test(source));
        // Ne jamais montrer le contenu encodé ou un chemin technique comme
        // du texte de la cellule. L'aperçu candidat rend la même ressource.
        if(accepted){
          const node=el(kind==='image'?'img':kind,'kb-cell-media');
          if(kind!=='image')node.controls=true;
          node.src=source;
          if(kind==='image')node.alt=cellDefinition.alt||'';
          td.append(node);
        }else{
          const placeholder=el('span','kb-empty');
          placeholder.textContent=cellDefinition.mediaName
            ?'Média : '+String(cellDefinition.mediaName):'Média à importer';
          td.append(placeholder);
        }
      }else if(['candidate-answer','select','unit','choice-option'].includes(kind)){
        const question=questions.get(String(cellDefinition.questionId||''))||{
          id:cellDefinition.questionId||('cell_'+rowIndex+'_'+colIndex),
          response:{type:cellDefinition.responseType||(kind==='select'||kind==='choice-option'?'single-choice':'text'),
            options:cellDefinition.options||[]}
        };
        if(kind==='choice-option'){
          const label=el('label','kb-choice');
          const input=document.createElement('input');input.type='radio';
          input.name='choice_'+String(question.id);
          label.append(input,document.createTextNode(String(cellDefinition.value||'')));
          td.append(label);
        }else if(kind==='unit'){
          const unit=el('input','kb-input');unit.type='text';
          unit.placeholder='Unité';
          td.append(unit);
        }else{
          const effective=kind==='select'
            ?window.KaloneoSharedPresentation.gridSelectQuestion(question,cellDefinition)
            :question;
          td.append(makeAnswerControl(effective));
        }
      }else if(cellDefinition.value)td.textContent=String(cellDefinition.value);
    }
  });
}

function renderInline(block){
  return window.KaloneoSharedPresentation.renderInlineFlow({
    doc:document,
    wordBank:block.wordBank||[],
    flow:block.flow||[],
    className:'kb-block',
    bankClass:'kb-word-bank',
    flowClass:'kb-inline-flow',
    // L'aperçu historique masquait la banque lorsqu'elle était vide.
    // Les autres vues gardent leur comportement précédent.
    omitEmptyBank:true,
    makeAnswer:questionId=>{
      const input=el('input');
      input.placeholder=String(questionId||'');
      return input;
    }
  });
}

function renderMultipleTable(block){
  const definition=block.tableDefinition||{};
  const questions=questionMap();
  return window.KaloneoSharedPresentation.renderQuestionTable({
    doc:document,definition,wrapperClassName:'kb-block kb-table-wrap',
    tableClassName:'kb-table',titleTag:'div',titleClassName:'kb-question-label',
    questionById:id=>questions.get(String(id)),
    renderCells:({doc,id,question,headers})=>{
      const q=question||{id,prompt:String(id),response:{type:'text'}};
      const left=doc.createElement('td');left.className='left';
      left.textContent=q.prompt||String(id);
      const right=doc.createElement('td');right.appendChild(makeAnswerControl(q));
      const extra=(headers||[]).slice(2).map((header,index)=>{
        const cell=doc.createElement('td');
        if(q.supplementalFields?.[index]){
          const input=el('input','kb-input');
          input.placeholder=String(header||'');
          cell.append(input);
        }
        return cell;
      });
      return [left,right,...extra];
    },
    renderEmptyRow:({doc,headers})=>{
      const cell=doc.createElement('td');
      cell.className='kb-empty';cell.textContent='Tableau à compléter';
      cell.colSpan=Math.max(1,headers.length);
      return [cell];
    }
  });
}

function renderTextEditor(block){
  const wrap=el('section','kb-block');
  const toolbar=el('div','kb-editor-toolbar');
  const labels=['Fichier','G','I','U'];
  labels.forEach(label=>{const b=el('button','',label);b.type='button';toolbar.append(b);});
  const font=document.createElement('select');font.append(new Option('Arial'),new Option('Calibri'));toolbar.append(font);
  const size=document.createElement('select');['10','11','12','14','16'].forEach(v=>size.append(new Option(v)));size.value='12';toolbar.append(size);
  const image=el('button','','Image');image.type='button';toolbar.append(image);
  const page=el('div','kb-editor-page');page.contentEditable='true';page.setAttribute('role','textbox');page.dataset.placeholder='Zone de rédaction du candidat';
  wrap.append(toolbar,page);
  if(block.config?.scoringProfile&&block.config.scoringProfile!=='none') wrap.append(el('small','',block.config.scoringProfile));
  return wrap;
}

function renderMedia(block){
  // La même construction de média est utilisée dans les trois vues.
  // Seuls les chemins et classes de l'aperçu autonome lui appartiennent.
  const source=String(block.mediaData||'');
  const wrap=window.KaloneoSharedPresentation.renderMedia({
    doc:document,type:block.type,
    resource:{data:source,alt:block.mediaAlt||block.mediaName||'Image'},
    style:{imageScale:block.imageScale,imageAlign:block.imageAlign},
    className:'kb-block kb-media-block',imageClass:'kb-media',
    videoClass:'kb-media',
    emptyText:'',
    resolveSource:value=>value.startsWith('imageqcm/')?'../'+value:value
  });
  if(!source)wrap.appendChild(el('div','kb-empty',block.mediaPlaceholder||'Aucun média sélectionné'));
  if(block.type==='audio'){
    const audio=wrap.querySelector('audio');
    if(audio)audio.className='kb-audio';
  }
  return wrap;
}

const renderRichContext=window.KaloneoSharedPresentation.renderRichContext;

function applyBlockStyle(node,block){
  if(!node)return node;
  node.classList.add('kb-stylable-block');
  const size=Number(block?.fontSize);
  if(Number.isFinite(size)&&size>=10&&size<=40){
    node.style.fontSize=size+'px';
    node.dataset.kaloneoFontSize=String(size);
  }
  const background=String(block?.backgroundColor||'').trim();
  if(background){
    node.style.backgroundColor=background;
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

function renderBlock(block){
  let node;
  if(block.type==='image-selection'){
    node=window.KaloneoSharedPresentation.renderImageSelection({
      doc:document,block:{
        label:block.label||block.question?.prompt||'Sélectionnez les images',
        questionId:block.question?.id||'',totalItems:block.totalItems,cloud:block.cloud===true,
        resource:{data:block.mediaData||''}
      }
    });
  }
  else if(block.type==='text'){
    node=el('section','kb-block kb-text');
    renderRichContext(node,block.text||'Bloc texte vide');
  }
  else if(block.type==='html'||block.type==='html-js'){
    const wrap=el('section','kb-block');
    wrap.append(window.KaloneoSharedPresentation.renderHtmlFrame({
      doc:document,block,className:'kb-frame'
    }));
    node=wrap;
  }
  else if(['image','audio','video'].includes(block.type)) node=renderMedia(block);
  else if(block.type==='question') node=renderQuestion(block);
  else if(block.type==='response-table') node=renderResponseTable(block);
  else if(block.type==='table-grid') node=renderGrid(block);
  else if(block.type==='inline-flow') node=renderInline(block);
  else if(block.type==='multiple-tables') node=renderMultipleTable(block);
  else if(block.type==='text-editor') node=renderTextEditor(block);
  else node=el('section','kb-block kb-empty','Bloc '+String(block.type||'inconnu'));
  return applyBlockStyle(node,block);
}

function buildLayout(page){
  const m=state.model.meta||{};
  const workspace=el('section','kb-workspace');
  const layout=el('div','kb-layout');
  const supported=['50-50','40-60','60-40','chars-rest'];
  const mode=supported.includes(m.layout)?m.layout:'single';
  if(mode==='50-50')layout.classList.add('r50-50');
  else if(mode==='40-60')layout.classList.add('r40-60');
  else if(mode==='60-40')layout.classList.add('r60-40');
  else if(mode==='chars-rest')layout.classList.add('r50-50');
  else layout.classList.add('single');

  // Rendu structurel identique au Builder et au candidat : seules les classes
  // visuelles propres à cette fenêtre Electron restent locales.
  const zones=window.KaloneoSharedPresentation.renderZones({
    host:layout,
    items:state.model.blocks||[],
    layout:mode,
    blockSizing:state.definition?.presentation?.blockSizing||{
      blocks:[{widthChars:m.block1WidthChars},
        {widthChars:m.block2WidthChars,remainder:m.lastBlockRemainder!==false}]
    },
    zoneClass:'kb-zone',
    renderItem:block=>renderBlock(block)
  });
  if(!zones.mixed&&!zones.left.childNodes.length){
    zones.left.append(el('div','kb-empty',mode==='single'?'Aucun bloc Exercice':'Zone gauche vide'));
  }
  if(!zones.mixed&&zones.right&&!zones.right.childNodes.length){
    zones.right.append(el('div','kb-empty','Zone droite vide'));
  }
  workspace.append(layout);
  page.append(workspace);
}

function installChrono(parent){
  if(!state.definition?.chrono?.enabled)return;
  const strip=el('div','kb-tool-strip');
  strip.append(el('strong','','Compteur KALONÉO'));
  const time=el('div','kb-chrono-time','00:00');
  const start=el('button','kb-tool-btn start','Démarrer le compteur');
  const stop=el('button','kb-tool-btn stop','Arrêter le compteur');
  let startedAt=0,timer=null;
  const render=()=>{
    const seconds=Math.max(0,Math.floor((Date.now()-startedAt)/1000));
    const m=String(Math.floor(seconds/60)).padStart(2,'0'),s=String(seconds%60).padStart(2,'0');time.textContent=m+':'+s;
  };
  start.onclick=()=>{clearInterval(timer);startedAt=Date.now();time.textContent='00:00';timer=setInterval(render,250);};
  stop.onclick=()=>{render();clearInterval(timer);timer=null;};
  state.chrono={stop:()=>clearInterval(timer)};
  strip.append(time,start,stop);
  parent.prepend(strip);
}

function calculator(){
  let panel=document.querySelector('.kb-calculator');
  if(panel){panel.hidden=!panel.hidden;return;}
  panel=el('section','kb-calculator');
  const display=el('div','kb-calc-display','0');
  const grid=el('div','kb-calc-grid');let expr='';
  ['7','8','9','/','4','5','6','*','1','2','3','-','0','.','=','+'].forEach(v=>{
    const b=el('button','',v);b.type='button';b.onclick=()=>{
      if(v==='='){
        try{if(!/^[0-9+*/(). -]+$/.test(expr))throw new Error();const out=Function('"use strict";return ('+expr+')')();display.textContent=Number.isFinite(out)?String(out):'ERR';expr=Number.isFinite(out)?String(out):'';}catch(_){display.textContent='ERR';expr='';}
      }else{expr+=v;display.textContent=expr||'0';}
    };grid.append(b);
  });
  const actions=el('div','kb-calc-actions');
  const clear=el('button','','C');clear.onclick=()=>{expr='';display.textContent='0';};
  const close=el('button','','Fermer');close.onclick=()=>panel.hidden=true;
  actions.append(clear,close);panel.append(display,grid,actions);document.body.append(panel);
}

function footer(page){
  const foot=el('footer','kb-footer');
  const left=el('div','kb-footer-left');
  const brand=el('div','kb-brand');
  const logo=el('img');logo.src='../assets/kaloneo-logo-bar.svg';logo.alt='KALONÉO';brand.append(logo,el('span','','KALONÉO'));
  const abandon=el('button','kb-nav-btn abandon','Abandonner l’exercice');abandon.type='button';abandon.onclick=()=>flash('Aperçu : aucun abandon n’est enregistré.');
  left.append(brand,abandon);

  const center=el('div','kb-footer-center');
  if(state.definition?.calculator?.compatible){
    const calc=el('button','seb-action-btn seb-btn-calculator','Ouvrir la calculatrice');
    calc.type='button';
    calc.dataset.sebAction='open-calculator';
    center.append(calc);
  }

  const right=el('div','kb-footer-right');
  const next=el('button','kb-nav-btn next','Suivant');next.type='button';next.onclick=()=>flash('Aperçu : aucune navigation de parcours.');
  const close=el('button','kb-nav-btn close-preview','Fermer l’aperçu');close.type='button';
  close.onclick=async()=>{
    state.chrono?.stop?.();
    try { window.closeCalculator?.(); } catch (_) {}
    close.disabled=true;
    try{
      const ok=await window.sebEvalPro?.kaloneoClosePreview?.();
      if(!ok){close.disabled=false;flash('Impossible de fermer l’aperçu.');}
    }catch(_){close.disabled=false;flash('Impossible de fermer l’aperçu.');}
  };
  right.append(next,close);
  foot.append(left,center,right);page.append(foot);
}

function render(){
  root.innerHTML='';
  const def=state.definition||{};
  const m=state.model.meta||{};
  const page=el('div','kb-preview-page');
  const pageStyle=def.presentation?.pageStyle||{};
  if(pageStyle.backgroundImage||pageStyle.backgroundColor)page.classList.add('kb-custom-page-background');
  if(pageStyle.backgroundImage){
    page.style.backgroundImage='url("'+String(pageStyle.backgroundImage).replace(/"/g,'%22')+'")';
    page.style.backgroundSize=pageStyle.backgroundFit==='contain'?'contain':'cover';
    page.style.backgroundPosition='center';
    page.style.backgroundRepeat='no-repeat';
  }else if(pageStyle.backgroundColor){
    page.style.background=String(pageStyle.backgroundColor);
  }
  const heading=el('header','kb-heading');
  const main=el('div','kb-heading-main');
  if(def.icon?.data){const icon=el('img','kb-heading-icon');icon.src=def.icon.data;icon.alt=def.icon.label||'';main.append(icon);}
  main.append(el('h1','',m.title||def.title||'Nouveau test'));heading.append(main,el('span','kb-preview-badge','APERÇU ELECTRON'));
  page.append(heading);

  const contexts=el('div','kb-contexts');
  const scenario=el('section','kb-context');const si=el('img');si.src='../imageqcm/scenario.png';si.alt='';const sb=el('div');const sp=el('p');renderRichContext(sp,m.scenario||'Le scénario apparaîtra ici.');sb.append(el('strong','','Scénario : '),sp);scenario.append(si,sb);
  const instruction=el('section','kb-context');const ii=el('img');ii.src='../imageqcm/avatar_transparant.png';ii.alt='';const ib=el('div');const ip=el('p');renderRichContext(ip,m.instruction||'La consigne apparaîtra ici.');ib.append(el('strong','','Consigne : '),ip);instruction.append(ii,ib);
  contexts.append(scenario,instruction);page.append(contexts);

  buildLayout(page);
  installChrono(page.querySelector('.kb-workspace'));
  footer(page);
  root.append(page);
}

async function install(){
  try{
    const bridge=window.sebEvalPro;
    if(!bridge||typeof bridge.kaloneoGetPreviewDefinition!=='function')throw new Error('Ouvrez cet aperçu depuis SEB EvalPro.');
    const result=await bridge.kaloneoGetPreviewDefinition();
    if(!result?.ok||!result.definition)throw new Error(result?.error||'Définition d’aperçu absente.');
    state.definition=result.definition;
    state.model=Core.definitionToModel(result.definition);
    try { window.setCalculatorBrand?.(result.definition?.calculator?.brandLabel ?? 'KALONÉO'); } catch (_) {}
    render();
  }catch(error){
    const box=el('div','kb-error');const card=el('div','kb-error-box');card.append(el('h2','','Aperçu indisponible'),el('p','',String(error?.message||error)));
    const close=el('button','kb-nav-btn close-preview','Fermer l’aperçu');close.onclick=()=>window.sebEvalPro?.kaloneoClosePreview?.();card.append(close);box.append(card);root.append(box);
  }
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();