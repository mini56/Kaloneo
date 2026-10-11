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
  wrap.append(el('label','kb-question-label',q.prompt||'Question'));
  wrap.append(makeAnswerControl({
    id:q.id,
    response:{type:q.responseType||'text',options:Core.splitValues(q.options||'')}
  }));
  if(q.unitInput){
    const unit=el('input','kb-input');
    unit.placeholder='Unité';
    unit.style.marginTop='6px';
    wrap.append(unit);
  }
  return wrap;
}

function renderResponseTable(block){
  const def=block.responseTable||{};
  const headers=Array.isArray(def.headers)&&def.headers.length?def.headers:['Question N°','Réponse','Unités'];
  const columns=Array.isArray(def.columns)?def.columns:[];
  const wrap=el('div','kb-block kb-table-wrap');
  const table=el('table','kb-table');
  const head=el('thead');const hr=el('tr');
  headers.forEach((h,i)=>{
    const th=el('th','',h);applyColumn(th,columns[i]);hr.append(th);
  });
  head.append(hr);table.append(head);
  const body=el('tbody');
  const questions=state.definition?.questions||[];
  questions.forEach((q,index)=>{
    const tr=el('tr');
    headers.forEach((h,i)=>{
      const td=el('td');
      applyColumn(td,columns[i]);
      if(i===0) td.textContent=String(index+1);
      else if(i===1) td.append(makeAnswerControl(q));
      else if(i===2&&q.unitInput){
        const input=el('input','kb-input');input.placeholder='Unité';td.append(input);
      }
      tr.append(td);
    });
    body.append(tr);
  });
  if(!questions.length){
    const tr=el('tr');const td=el('td','kb-empty','Aucune question définie');td.colSpan=headers.length;tr.append(td);body.append(tr);
  }
  table.append(body);wrap.append(table);return wrap;
}

function applyColumn(node,col){
  if(!col)return;
  if(Number(col.widthChars)>=3) node.style.width=Number(col.widthChars)+'ch';
  node.classList.add(col.align==='left'?'left':'center');
}

function equalAutomaticColumns(t){
  const count=Math.max(
    Number(t?.cols)||0,
    Array.isArray(t?.headers)?t.headers.length:0,
    ...((t?.cells||[]).map(row=>Array.isArray(row)?row.length:0))
  );
  if(count<2||t.layoutOnly===true)return 0;
  if(Array.from({length:count},(_,i)=>t.columns?.[i])
    .some(col=>Number(col?.widthChars)>=3))return 0;
  if((t.cells||[]).some(row=>(row||[]).some(cell=>
    Number(cell?.rowSpan)>1||Number(cell?.colSpan)>1)))return 0;
  return count;
}

function renderGrid(block){
  const t=block.table||{};
  const rows=Array.isArray(t.cells)?t.cells:[];
  const qmap=questionMap();
  const wrap=el('div','kb-block kb-table-wrap');
  if(t.title) wrap.append(el('div','kb-question-label',t.title));
  const table=el('table','kb-table');
  if(t.compact===true)table.classList.add('kb-compact-grid');
  const equal=equalAutomaticColumns(t);
  if(equal){
    table.classList.add('kb-grid-equal-auto');
    const group=el('colgroup');
    for(let i=0;i<equal;i++){
      const column=el('col');
      column.style.width=(100/equal)+'%';
      group.appendChild(column);
    }
    table.appendChild(group);
  }
  if(t.layoutOnly===true){table.classList.add('kaloneo-layout-only');table.style.border='0';table.style.background='transparent';}
  if(Array.isArray(t.headers)&&t.headers.length){
    const thead=el('thead');const tr=el('tr');
    t.headers.forEach((h,i)=>{const th=el('th','',h);applyColumn(th,t.columns?.[i]);tr.append(th);});
    thead.append(tr);table.append(thead);
  }
  const tbody=el('tbody');
  rows.forEach((row,r)=>{
    const tr=el('tr');
    (row||[]).forEach((cell,c)=>{
      if(cell?.hidden===true)return;
      const td=el('td');applyColumn(td,t.columns?.[c]);
      if(t.layoutOnly===true){td.style.border='0';td.style.background='transparent';}
      if(Number(cell?.rowSpan)>1) td.rowSpan=Number(cell.rowSpan);
      if(Number(cell?.colSpan)>1) td.colSpan=Number(cell.colSpan);
      const kind=String(cell?.kind||'empty');
      if(kind==='fixed-text') td.textContent=String(cell.value||'');
      else if(kind==='image'&&String(cell.value||'').startsWith('data:')){
        const img=el('img','kb-cell-media');img.src=cell.value;img.alt=cell.alt||'';td.append(img);
      } else if(kind==='audio'&&String(cell.value||'').startsWith('data:')){
        const audio=el('audio','kb-audio');audio.controls=true;audio.src=cell.value;td.append(audio);
      } else if(kind==='video'&&String(cell.value||'').startsWith('data:')){
        const video=el('video','kb-cell-media');video.controls=true;video.src=cell.value;td.append(video);
      } else if(['candidate-answer','select','unit','choice-option'].includes(kind)){
        const q=qmap.get(String(cell.questionId||''))||{
          id:cell.questionId||('cell_'+r+'_'+c),
          response:{type:cell.responseType||(kind==='select'||kind==='choice-option'?'single-choice':'text'),options:cell.options||[]}
        };
        if(kind==='choice-option'){
          const label=el('label','kb-choice');
          const input=document.createElement('input');input.type='radio';input.name='choice_'+String(q.id);
          label.append(input,document.createTextNode(String(cell.value||'')));td.append(label);
        } else td.append(makeAnswerControl(q));
      } else if(cell?.value) td.textContent=String(cell.value);
      tr.append(td);
    });
    tbody.append(tr);
  });
  table.append(tbody);wrap.append(table);return wrap;
}

function renderInline(block){
  const wrap=el('section','kb-block');
  const bank=el('div','kb-word-bank');
  (block.wordBank||[]).forEach(word=>bank.append(el('span','',word)));
  if(block.wordBank?.length) wrap.append(bank);
  const flow=el('div','kb-inline-flow');
  (block.flow||[]).forEach(item=>{
    if(item.type==='text'){
      flow.append(document.createTextNode(item.text||''));
      if(item.breakAfterSentence){flow.append(document.createElement('br'));flow.append(document.createElement('br'));}
    } else if(item.type==='question'){
      const input=el('input');input.placeholder=String(item.questionId||'');flow.append(input);
    }
  });
  wrap.append(flow);return wrap;
}

function renderMultipleTable(block){
  const d=block.tableDefinition||{};
  const wrap=el('div','kb-block kb-table-wrap');
  if(d.title) wrap.append(el('div','kb-question-label',d.title));
  const table=el('table','kb-table');
  const headers=Array.isArray(d.headers)?d.headers:[];
  if(headers.length){
    const head=el('thead');const tr=el('tr');headers.forEach(h=>tr.append(el('th','',h)));head.append(tr);table.append(head);
  }
  const body=el('tbody');
  const qmap=questionMap();
  (d.questionIds||[]).forEach(id=>{
    const q=qmap.get(String(id))||{id,prompt:String(id),response:{type:'text'}};
    const tr=el('tr');tr.append(el('td','left',q.prompt||String(id)));
    const td=el('td');td.append(makeAnswerControl(q));tr.append(td);
    body.append(tr);
  });
  if(!(d.questionIds||[]).length){
    const tr=el('tr');const td=el('td','kb-empty','Tableau à compléter');td.colSpan=Math.max(1,headers.length);tr.append(td);body.append(tr);
  }
  table.append(body);wrap.append(table);return wrap;
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
  const wrap=el('section','kb-block kb-media-block');
  const data=String(block.mediaData||'');
  if(!data){wrap.append(el('div','kb-empty',block.mediaPlaceholder||'Aucun média sélectionné'));return wrap;}
  if(block.type==='image'){
    const img=el('img','kb-media');img.src=String(data).startsWith('imageqcm/')?'../'+data:data;img.alt=block.mediaAlt||block.mediaName||'Image';wrap.append(img);
  }else if(block.type==='audio'){
    const audio=el('audio','kb-audio');audio.controls=true;audio.src=data;wrap.append(audio);
  }else{
    const video=el('video','kb-media');video.controls=true;video.src=data;wrap.append(video);
  }
  return wrap;
}

function multilineText(value){
  return String(value||'').replace(/\\n/g,'\n');
}

function renderRichContext(target,value){
  if(!target)return;
  target.replaceChildren();
  const source=multilineText(value);
  const token=/\[(\/)?(b|i|u|c)(?:=(#[0-9a-f]{6}))?\]/gi;
  const stack=[{node:target,tag:null}];
  const appendText=text=>{
    const parts=String(text).split('\n');
    parts.forEach((part,index)=>{
      if(part)stack.at(-1).node.appendChild(document.createTextNode(part));
      if(index<parts.length-1)stack.at(-1).node.appendChild(document.createElement('br'));
    });
  };
  let cursor=0;
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
      node.style.backgroundSize=block.backgroundFit==='cover'?'cover':block.backgroundFit==='contain'?'contain':'auto 78%';
    }

  return node;
}

function renderBlock(block){
  let node;
  if(block.type==='text'){
    node=el('section','kb-block kb-text');
    renderRichContext(node,block.text||'Bloc texte vide');
  }
  else if(block.type==='html'||block.type==='html-js'){
    const wrap=el('section','kb-block');const frame=el('iframe','kb-frame');frame.sandbox='allow-scripts';
    const script=block.type==='html-js'&&block.js?'<script>'+String(block.js).replace(/<\/script/gi,'<\\/script')+'<\/script>':'';
    frame.srcdoc='<!doctype html><html><body style="font-family:Calibri,Arial,sans-serif;margin:10px">'+(block.html||'<em>Bloc HTML vide</em>')+script+'</body></html>';
    wrap.append(frame);node=wrap;
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
  if(m.layout==='50-50')layout.classList.add('r50-50');
  else if(m.layout==='40-60')layout.classList.add('r40-60');
  else if(m.layout==='60-40')layout.classList.add('r60-40');
  else if(m.layout==='chars-rest'){
    layout.classList.add('r50-50');
    const a=Number(m.block1WidthChars);
    const b=Number(m.block2WidthChars);
    layout.style.gridTemplateColumns=(a>=3?a+'ch':'minmax(0,1fr)')+' '+(m.lastBlockRemainder?'minmax(0,1fr)':(b>=3?b+'ch':'minmax(0,1fr)'));
  }else layout.classList.add('single');

  if(m.layout==='single'){
    const zone=el('div','kb-zone');
    state.model.blocks.forEach(block=>zone.append(renderBlock(block)));
    if(!state.model.blocks.length)zone.append(el('div','kb-empty','Aucun bloc Exercice'));
    layout.append(zone);
  }else{
    const left=el('div','kb-zone'),right=el('div','kb-zone');
    state.model.blocks.forEach(block=>(block.zone==='right'?right:left).append(renderBlock(block)));
    if(!left.childNodes.length)left.append(el('div','kb-empty','Zone gauche vide'));
    if(!right.childNodes.length)right.append(el('div','kb-empty','Zone droite vide'));
    layout.append(left,right);
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