/*
 * Moteur commun des présentations KALTEST génériques.
 * Pas de liste de tests, de données candidat, ni de barème ici.
 * Le même code est chargé dans le Builder et dans le vrai moteur candidat.
 */
(function(root,factory){
  'use strict';
  const api=factory();
  if(root)root.KaloneoSharedPresentation=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window==='undefined'?null:window,function(){
  'use strict';

  function columns(layout,sizing){
    if(layout==='single'||!layout)return 'minmax(0,1fr)';
    if(layout==='50-50')return 'minmax(0,1fr) minmax(0,1fr)';
    if(layout==='40-60')return 'minmax(0,40fr) minmax(0,60fr)';
    if(layout==='60-40')return 'minmax(0,60fr) minmax(0,40fr)';
    if(layout==='chars-rest'){
      const widths=sizing?.blocks||[];
      const a=Number(widths[0]?.widthChars),b=Number(widths[1]?.widthChars);
      return (Number.isFinite(a)&&a>=3?a+'ch':'minmax(0,1fr)')+' '+
        (widths[1]?.remainder===true?'minmax(0,1fr)':
          Number.isFinite(b)&&b>=3?b+'ch':'minmax(0,1fr)');
    }
    return 'minmax(0,1fr) minmax(0,1fr)';
  }

  function renderZones({host,items,layout,blockSizing,renderItem,zoneClass=''}){
    if(!host||typeof renderItem!=='function')throw new TypeError('Hôte de présentation invalide.');
    const doc=host.ownerDocument;
    const single=layout==='single'||!layout;
    host.style.gridTemplateColumns=columns(layout,blockSizing);
    const left=doc.createElement('section');
    const right=doc.createElement('section');
    left.className=right.className=zoneClass;
    for(const item of items||[]){
      const rendered=renderItem(item);
      if(rendered)(single||item?.zone!=='right'?left:right).appendChild(rendered);
    }
    host.appendChild(left);
    if(!single)host.appendChild(right);
    watchCompactQuestionColumns(host);
    return {left,right};
  }


  // Un groupe par zone ; la réponse démarre après l'intitulé le plus long.
  function alignCompactQuestionColumns(host){
    if(!host?.children)return;
    const win=host.ownerDocument?.defaultView;
    for(const zone of host.children){
      const rows=[...zone.querySelectorAll?.('.kaloneo-shared-question[data-kaloneo-answer-layout="compact-column"]')||[]]
        .filter(row=>row.children.length>=2);
      if(!rows.length)continue;
      let longest=0,free=Infinity;
      for(const row of rows){
        const label=row.firstElementChild,answer=row.children[1];
        if(!label||!answer)continue;
        const initial=label.style.cssText;
        label.style.position='absolute';
        label.style.width='max-content';
        label.style.maxWidth='none';
        label.style.whiteSpace='nowrap';
        longest=Math.max(longest,Math.ceil(label.scrollWidth||label.offsetWidth||0));
        label.style.cssText=initial;
        const css=win?.getComputedStyle?.(row);
        const padding=(parseFloat(css?.paddingLeft)||0)+(parseFloat(css?.paddingRight)||0);
        const gap=parseFloat(css?.columnGap)||9;
        if(row.clientWidth>0)free=Math.min(free,row.clientWidth-padding-(answer.offsetWidth||0)-gap-2);
      }
      if(!Number.isFinite(free)||longest<=0)continue;
      const width=Math.max(20,Math.min(longest+2,Math.max(20,free)));
      for(const row of rows)row.style.setProperty('--kaloneo-compact-caption-width',width+'px');
    }
  }

  // Un observateur de redimensionnement par hôte ; aucun polling.
  const compactObservers=new WeakMap();
  function watchCompactQuestionColumns(host){
    compactObservers.get(host)?.disconnect();
    compactObservers.delete(host);
    if(!host?.querySelector?.('[data-kaloneo-answer-layout="compact-column"]'))return;
    const win=host.ownerDocument?.defaultView;
    const apply=()=>{if(host.isConnected)alignCompactQuestionColumns(host);};
    if(typeof win?.ResizeObserver==='function'){
      const observer=new win.ResizeObserver(apply);
      observer.observe(host);
      compactObservers.set(host,observer);
    }
    if(typeof win?.requestAnimationFrame==='function')win.requestAnimationFrame(apply);
    else apply();
  }

  // Interprétation canonique du balisage de contexte KALTEST.
  // Uniquement le DOM : aucun accès à la notation, au stockage ni aux tests.
  function renderRichContext(target,value){
    if(!target)return;
    target.replaceChildren();
    const doc=target.ownerDocument;
    const source=String(value||'').replace(/\\n/g,'\n');
    const token=/\[(\/)?(b|i|u|c)(?:=(#[0-9a-f]{6}))?\]/gi;
    const stack=[{node:target,tag:null}];
    const appendText=text=>{
      const parts=String(text).split('\n');
      parts.forEach((part,index)=>{
        if(part)stack.at(-1).node.appendChild(doc.createTextNode(part));
        if(index<parts.length-1)stack.at(-1).node.appendChild(doc.createElement('br'));
      });
    };
    let cursor=0,match;
    while((match=token.exec(source))){
      appendText(source.slice(cursor,match.index));
      const closing=Boolean(match[1]);
      const tag=String(match[2]||'').toLowerCase();
      if(!closing){
        let element;
        if(tag==='c'){
          element=doc.createElement('span');
          if(/^#[0-9a-f]{6}$/i.test(String(match[3]||'')))element.style.color=match[3];
        }else{
          element=doc.createElement(tag==='b'?'strong':tag==='i'?'em':'u');
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

  function renderQuestion({doc,question,makeAnswer,example=false,className='',rowTag='label',captionClassName=''}) {
    if(!doc||typeof makeAnswer!=='function')throw new TypeError('Question sans moteur de réponse.');
    const row=doc.createElement(rowTag);
    row.className='kaloneo-shared-question'+(className?' '+className:'');
    // La disposition est portée par la définition KALTEST et non par le nom
    // d'un test. Si elle est absente (V1), le CSS historique reste inchangé.
    const layout=String(question?.answerLayout||'');
    if(['column','compact-column','inline','below'].includes(layout)){
      row.dataset.kaloneoAnswerLayout=layout;
    }
    const width=Number(question?.answerWidthChars);
    if(question?.answerWidthChars!==''&&question?.answerWidthChars!=null&&
       Number.isInteger(width)&&width>=6&&width<=30){
      row.dataset.kaloneoAnswerWidth='custom';
      row.style.setProperty('--kaloneo-answer-width',width+'ch');
    }
    const caption=doc.createElement('span');
    caption.className=captionClassName;
    caption.textContent=String(question?.prompt||'');
    if(example){
      const tag=doc.createElement('strong');
      tag.className='example-tag';tag.textContent='Exemple';
      caption.appendChild(tag);
    }
    const answer=makeAnswer(question);
    if(answer)row.append(caption,answer);
    else row.appendChild(caption);
    return row;
  }

  // Le candidat conserve le HTML du KALTEST (script), tandis que le Builder
  // édite ce même bloc sous la forme js. Aucune dépendance à un test précis.
  function renderHtmlFrame({doc,block={},className='',emptyText='Bloc HTML vide',
    sandbox='allow-scripts',bodyStyle='font-family:Calibri,Arial,sans-serif;margin:10px'}) {
    if(!doc)throw new TypeError('Document HTML absent.');
    const frame=doc.createElement('iframe');
    frame.className=className;
    frame.sandbox=sandbox;
    const markup=block.html|| (emptyText?'<em>'+emptyText+'</em>':'');
    const scriptSource=block.js??block.script;
    const script=block.type==='html-js'&&scriptSource
      ?'<script>'+String(scriptSource).replace(/<\/script/gi,'<\\/script')+'</script>'
      :'';
    const bodyAttribute=bodyStyle?' style="'+String(bodyStyle).replace(/"/g,'&quot;')+'"':'';
    frame.srcdoc='<!doctype html><html><body'+bodyAttribute+'>'+
      markup+script+'</body></html>';
    return frame;
  }

  function renderMedia({doc,type,resource={},style={},className='',imageClass='',videoClass='',resolveSource,emptyText=''}) {
    if(!doc||!['image','audio','video'].includes(type))
      throw new TypeError('Média KALTEST inconnu.');
    const wrap=doc.createElement('div');
    wrap.className='kaloneo-shared-media'+(className?' '+className:'');
    const raw=String(resource.data||resource.name||'');
    if(!raw){
      if(emptyText)wrap.textContent=emptyText;
      return wrap;
    }
    const source=typeof resolveSource==='function'?resolveSource(raw):raw;
    if(type==='image'){
      const img=doc.createElement('img');
      img.src=source;
      img.alt=resource.alt||resource.name||'';
      if(imageClass)img.className=imageClass;
      const scale=Number(style.imageScale);
      if(Number.isFinite(scale)&&scale>=10&&scale<100){
        img.style.width=scale+'%';
        img.style.height='auto';
        img.style.maxHeight='100%';
      }
      if(['left','right'].includes(style.imageAlign)){
        wrap.style.justifyContent=style.imageAlign==='left'?'flex-start':'flex-end';
        img.style.margin='auto 0';
      }
      wrap.appendChild(img);
    }else if(type==='audio'){
      const audio=doc.createElement('audio');
      audio.controls=true;
      audio.src=source;
      wrap.appendChild(audio);
    }else{
      const video=doc.createElement('video');
      video.controls=true;
      video.src=source;
      if(videoClass)video.className=videoClass;
      wrap.appendChild(video);
    }
    return wrap;
  }


  function renderInlineFlow({doc,wordBank=[],flow=[],makeAnswer,className='',bankClass='',flowClass='',omitEmptyBank=false}) {
    if(!doc||typeof makeAnswer!=='function')
      throw new TypeError('Flux de réponse KALTEST invalide.');
    const wrap=doc.createElement('div');
    wrap.className='kaloneo-shared-inline-flow'+(className?' '+className:'');
    const bank=doc.createElement('div');
    bank.className='kaloneo-shared-word-bank'+(bankClass?' '+bankClass:'');
    for(const word of wordBank||[]){
      const span=doc.createElement('span');
      span.textContent=String(word);
      bank.appendChild(span);
    }
    if(!omitEmptyBank||(wordBank||[]).length)wrap.appendChild(bank);
    const content=doc.createElement('div');
    content.className='kaloneo-shared-flow-content'+(flowClass?' '+flowClass:'');
    for(const part of flow||[]){
      if(part?.type==='text'){
        content.appendChild(doc.createTextNode(String(part.text||'')));
        if(part.breakAfterSentence===true){
          content.append(doc.createElement('br'),doc.createElement('br'));
        }
      }else if(part?.type==='question'){
        const answer=makeAnswer(part.questionId,part);
        if(answer)content.appendChild(answer);
      }
    }
    wrap.appendChild(content);
    return wrap;
  }

  // Tableau de réponses générique. Le squelette des lignes, en-têtes et
  // dimensions est commun ; seuls les champs spécifiques à l'éditeur ou
  // au candidat sont fournis par une fonction de rappel.
  function renderResponseTable({doc,headers=[],columns=[],rows=[],renderCell,renderEmptyRow,className='',wrapperClassName=''}) {
    if(!doc||typeof renderCell!=='function')
      throw new TypeError('Tableau de réponses KALTEST invalide.');
    const wrap=doc.createElement('div');
    wrap.className='kaloneo-shared-response-wrap'+(wrapperClassName?' '+wrapperClassName:'');
    const table=doc.createElement('table');
    table.className='kaloneo-shared-response-table'+(className?' '+className:'');
    const thead=doc.createElement('thead');
    const head=doc.createElement('tr');
    for(let i=0;i<headers.length;i++){
      const th=doc.createElement('th');
      th.textContent=String(headers[i]||'');
      applyColumn(th,columns[i]);
      head.appendChild(th);
    }
    thead.appendChild(head);
    table.appendChild(thead);
    const tbody=doc.createElement('tbody');
    for(const [rowIndex,rowData] of rows.entries()){
      const tr=doc.createElement('tr');
      for(let colIndex=0;colIndex<headers.length;colIndex++){
        const td=doc.createElement('td');
        applyColumn(td,columns[colIndex]);
        const value=renderCell({cell:td,row:rowData,rowIndex,colIndex});
        if(value&&value.nodeType)td.appendChild(value);
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    if(!rows.length&&typeof renderEmptyRow==='function'){
      const cells=renderEmptyRow({doc,headers,columns});
      if(Array.isArray(cells)&&cells.length){
        const empty=doc.createElement('tr');
        for(const cell of cells)if(cell)empty.appendChild(cell);
        tbody.appendChild(empty);
      }
    }
    table.appendChild(tbody);
    wrap.appendChild(table);
    return wrap;
  }

  // Structure unique des tableaux de questions pour les vues d'aperçu.
  // Chaque vue décide seulement du contenu des cellules : texte ou réponses.
  function renderQuestionTable({doc,definition={},wrapperClassName='',tableClassName='',
    titleTag='h3',titleClassName='',titleFallback='',questionById,renderCells,renderEmptyRow}) {
    if(!doc||typeof renderCells!=='function')
      throw new TypeError('Tableau de questions KALTEST invalide.');
    const wrap=doc.createElement('div');
    wrap.className=wrapperClassName;
    const title=definition.title||titleFallback;
    if(title){
      const heading=doc.createElement(titleTag);
      heading.className=titleClassName;
      heading.textContent=String(title);
      wrap.appendChild(heading);
    }
    const table=doc.createElement('table');
    table.className=tableClassName;
    const headers=Array.isArray(definition.headers)?definition.headers:[];
    if(headers.length){
      const thead=doc.createElement('thead');
      const tr=doc.createElement('tr');
      for(const heading of headers){
        const th=doc.createElement('th');
        th.textContent=String(heading||'');
        tr.appendChild(th);
      }
      thead.appendChild(tr);
      table.appendChild(thead);
    }
    const tbody=doc.createElement('tbody');
    const ids=Array.isArray(definition.questionIds)?definition.questionIds:[];
    for(const [index,id] of ids.entries()){
      const question=typeof questionById==='function'?questionById(id):null;
      const cells=renderCells({doc,id,question,index,headers});
      if(!Array.isArray(cells)||!cells.length)continue;
      const tr=doc.createElement('tr');
      for(const cell of cells)if(cell)tr.appendChild(cell);
      tbody.appendChild(tr);
    }
    if(!ids.length&&typeof renderEmptyRow==='function'){
      const cells=renderEmptyRow({doc,headers});
      if(Array.isArray(cells)&&cells.length){
        const tr=doc.createElement('tr');
        for(const cell of cells)if(cell)tr.appendChild(cell);
        tbody.appendChild(tr);
      }
    }
    table.appendChild(tbody);
    wrap.appendChild(table);
    return wrap;
  }


  // Définitions purement visuelles. La priorité est :
  // cellule > ligne > colonne > style global du bloc / CSS historique.
  function normalizeGridColor(value){
    const raw=String(value||'').trim();
    return /^#[0-9a-f]{6}$/i.test(raw)?raw.toLowerCase():'';
  }
  function gridCellBackground(definition,rowIndex,colIndex,cellDefinition){
    const own=normalizeGridColor(cellDefinition?.backgroundColor);
    const row=normalizeGridColor(definition?.rowColors?.[rowIndex]);
    const column=normalizeGridColor(definition?.columns?.[colIndex]?.backgroundColor);
    return own||row||column||'';
  }

  // La couleur de police est indépendante de celle du fond. La priorité
  // suit les mêmes règles que la couleur de fond.
  function gridCellTextColor(definition,rowIndex,colIndex,cellDefinition){
    const own=normalizeGridColor(cellDefinition?.textColor);
    const row=normalizeGridColor(definition?.rowTextColors?.[rowIndex]);
    const column=normalizeGridColor(definition?.columns?.[colIndex]?.textColor);
    return own||row||column||'';
  }

  // Un choix dans une grille est une liste déroulante, même si la
  // question enregistrée avait historiquement le type générique 'text'.
  // L'identifiant, la réponse et les points de la question sont conservés.
  function gridSelectQuestion(question,cellDefinition){
    const original=question||{};
    const source=original.response||{};
    const options=Array.isArray(cellDefinition?.options)
      ?cellDefinition.options
      :(Array.isArray(source.options)?source.options:[]);
    return {...original,
      id:String(original.id||cellDefinition?.questionId||''),
      response:{...source,type:'select',options:options.slice()}
    };
  }

  // Rendu de la structure d'un tableau libre, identique dans l'éditeur
  // et dans le candidat. Le contrôle de réponse reste au client appelant.
  function renderGridTable({doc,definition={},renderCell,className='',wrapperClassName='',compactClassName='',equalClassName='',titleTag='h3',titleClassName='',skipHiddenCells=false}) {
    if(!doc||typeof renderCell!=='function')throw new TypeError('Grille KALTEST invalide.');
    const wrap=doc.createElement('div');
    wrap.className='kaloneo-shared-grid-wrap'+(wrapperClassName?' '+wrapperClassName:'');
    if(definition.title){
      const title=doc.createElement(titleTag);
      title.className=titleClassName;
      title.textContent=String(definition.title);
      wrap.appendChild(title);
    }
    const table=doc.createElement('table');
    table.className='kaloneo-shared-grid-table'+(className?' '+className:'');
    if(definition.compact===true&&compactClassName)table.classList.add(compactClassName);
    const equal=equalAutomaticColumns(definition);
    if(equal){
      if(equalClassName)table.classList.add(equalClassName);
      addEqualColGroup(table,equal);
    }
    if(definition.layoutOnly===true){
      table.classList.add('kaloneo-layout-only');
      table.style.border='0';
      table.style.background='transparent';
    }
    if(Array.isArray(definition.headers)&&definition.headers.length){
      const thead=doc.createElement('thead');
      const tr=doc.createElement('tr');
      definition.headers.forEach((value,index)=>{
        const th=doc.createElement('th');
        th.textContent=String(value||'');
        applyColumn(th,definition.columns?.[index]);
        const headerBackground=normalizeGridColor(definition.columns?.[index]?.backgroundColor);
        if(headerBackground)th.style.backgroundColor=headerBackground;
        const headerText=normalizeGridColor(definition.columns?.[index]?.textColor);
        if(headerText)th.style.color=headerText;
        tr.appendChild(th);
      });
      thead.appendChild(tr);
      table.appendChild(thead);
    }
    const tbody=doc.createElement('tbody');
    for(const [rowIndex,definitionRow] of (definition.cells||[]).entries()){
      const tr=doc.createElement('tr');
      for(const [colIndex,cellDefinitionRaw] of (definitionRow||[]).entries()){
        const cellDefinition=cellDefinitionRaw||{};
        if(skipHiddenCells&&cellDefinition.hidden===true)continue;
        const td=doc.createElement('td');
        applyColumn(td,definition.columns?.[colIndex]);
        if(definition.layoutOnly===true){
          td.style.border='0';
          td.style.background='transparent';
        }
        const background=gridCellBackground(definition,rowIndex,colIndex,cellDefinition);
        if(background)td.style.backgroundColor=background;
        const textColor=gridCellTextColor(definition,rowIndex,colIndex,cellDefinition);
        if(textColor)td.style.color=textColor;
        const rowSpan=Math.max(1,Number(cellDefinition.rowSpan)||1);
        const colSpan=Math.max(1,Number(cellDefinition.colSpan)||1);
        if(rowSpan>1)td.rowSpan=rowSpan;
        if(colSpan>1)td.colSpan=colSpan;
        const node=renderCell({cell:td,cellDefinition,rowIndex,colIndex,rowNode:tr});
        if(node&&node.nodeType)td.appendChild(node);
        // Certains champs de réponse possèdent une couleur explicite dans leur
        // feuille CSS : leur police suit également le choix de la cellule.
        if(textColor&&typeof td.querySelectorAll==='function'){
          td.querySelectorAll('input, select, textarea').forEach(control=>{
            control.style.color=textColor;
            // Sous Windows un <select> conserve autrement un fond blanc :
            // « Choisir… » semble disparaître si la police choisie est blanche.
            // Le champ prend le fond de sa cellule lorsqu'il est personnalisé.
            // Sans fond de cellule, fournir un fond lisible aux polices claires.
            const channels=textColor.match(/[0-9a-f]{2}/gi)||[];
            const isLight=channels.length===3&&
              ((parseInt(channels[0],16)*299+parseInt(channels[1],16)*587+
                parseInt(channels[2],16)*114)/1000)>=175;
            const controlBackground=background||(isLight?'#263442':'#ffffff');
            control.style.backgroundColor=controlBackground;
            if(control.tagName==='SELECT'){
              for(const option of control.options){
                option.style.color=textColor;
                option.style.backgroundColor=controlBackground;
              }
            }
          });
        }
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    wrap.appendChild(table);
    return wrap;
  }

  function equalAutomaticColumns(table){
    const count=Math.max(
      Number(table?.cols)||0,
      Array.isArray(table?.headers)?table.headers.length:0,
      ...((table?.cells||[]).map(row=>Array.isArray(row)?row.length:0))
    );
    if(count<2||table?.layoutOnly===true)return 0;
    if(Array.from({length:count},(_,i)=>table.columns?.[i])
      .some(column=>Number(column?.widthChars)>=3))return 0;
    if((table.cells||[]).some(row=>(row||[]).some(cell=>
      Number(cell?.rowSpan)>1||Number(cell?.colSpan)>1)))return 0;
    return count;
  }

  function applyColumn(cell,column){
    if(!cell||!column)return;
    const width=Number(column.widthChars);
    if(Number.isFinite(width)&&width>=3){
      cell.style.width=width+'ch';
      cell.style.minWidth=width+'ch';
      cell.style.maxWidth=width+'ch';
    }
    if(['left','center','right'].includes(column.align))
      cell.style.textAlign=column.align;
  }

  function addEqualColGroup(table,count){
    if(!table||count<2)return;
    const group=table.ownerDocument.createElement('colgroup');
    for(let i=0;i<count;i++){
      const col=table.ownerDocument.createElement('col');
      col.style.width=(100/count)+'%';
      group.appendChild(col);
    }
    table.appendChild(group);
  }

  // Rendu natif partagé. Le moteur candidat gère l'enregistrement et la correction.
  // Aucune exécution de scripts fournis par un test.
  function renderImageSelection({doc,block,selected=[],onChange,disabled=false}){
    const outer=doc.createElement('section');
    outer.className='kaltest-image-selection kaltest-fraction-row';
    outer.dataset.questionId=String(block.questionId||'');
    outer.style.cssText='box-sizing:border-box;min-width:0;padding:12px;border-radius:10px;border:1px solid #b8d0e4;background:#f7fbff;';
    const title=doc.createElement('strong');
    title.textContent=String(block.label||'Sélectionnez les images');
    title.style.cssText='display:block;margin-bottom:10px;color:#183c5c;';
    outer.appendChild(title);
    const total=Math.max(1,Math.min(60,Math.floor(Number(block.totalItems)||4)));
    const values=new Set(Array.isArray(selected)?selected.map(String):[]);
    const grid=doc.createElement('div');
    grid.className='kaltest-fraction-items kaltest-image-selection-items';
    grid.style.cssText='display:flex;flex-wrap:wrap;gap:9px;align-items:flex-start;min-height:64px;';
    if(block.cloud===true){grid.style.justifyContent='space-around';grid.style.rowGap='22px';}
    const image=String(block.resource?.data||block.itemImage||'');
    for(let i=1;i<=total;i++){
      const id=String(i);
      const button=doc.createElement('button');
      button.type='button';button.className='kaltest-fraction-item kaltest-image-selection-item';
      button.dataset.itemIndex=id;
      if(block.cloud===true)button.style.transform='translateY('+(((i*13)%19)-8)+'px)';
      button.setAttribute('aria-label',String(block.label||'Image')+' — objet '+id);
      button.style.cssText='box-sizing:border-box;flex:0 0 62px;width:62px;height:62px;border:2px solid #9ab3c9;border-radius:9px;background:#ffffff;cursor:pointer;transition:border-color .15s,background-color .15s;';
      if(/^data:image\//i.test(image)){
        button.style.backgroundImage='url('+JSON.stringify(image)+')';
        button.style.backgroundSize='contain';button.style.backgroundRepeat='no-repeat';button.style.backgroundPosition='center';
      }
      const update=()=>{
        const active=values.has(id);
        button.classList.toggle('selected',active);
        button.setAttribute('aria-pressed',String(active));
        button.style.borderColor=active?'#147d48':'#9ab3c9';
        button.style.backgroundColor=active?'#d9f3e4':'#ffffff';
        button.style.boxShadow=active?'inset 0 0 0 3px #147d48':'none';
      };
      update();
      button.disabled=disabled;
      if(!disabled)button.addEventListener('click',()=>{
        if(values.has(id))values.delete(id);else values.add(id);
        update();
        if(typeof onChange==='function')onChange([...values]);
      });
      grid.appendChild(button);
    }
    outer.appendChild(grid);
    return outer;
  }

  return Object.freeze({renderImageSelection,columns,renderZones,alignCompactQuestionColumns,renderRichContext,renderQuestion,renderMedia,renderHtmlFrame,renderInlineFlow,renderResponseTable,renderQuestionTable,renderGridTable,equalAutomaticColumns,applyColumn,addEqualColGroup,
    normalizeGridColor,gridCellBackground,gridCellTextColor,gridSelectQuestion});
});
