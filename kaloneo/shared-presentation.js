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
    // Le mode historique répartit TOUS les blocs entre deux colonnes :
    // on le conserve strictement quand aucun bloc n'est pleine largeur.
    // Avec un bloc "full", chaque segment gauche/droite est encadré
    // par des lignes transversales, dans l'ordre du Builder.
    const mixed=!single&&(items||[]).some(item=>item?.zone==='full');
    if(mixed){
      host.classList.add('kaloneo-mixed-rows');
      const rows=[];
      let active=null;
      let firstLeft=null,firstRight=null;
      const zone=kind=>{
        const part=doc.createElement('section');
        part.className=zoneClass;
        part.dataset.kaloneoZone=kind;
        if(kind==='full'){
          part.style.gridColumn='1 / -1';
          part.classList.add('kaloneo-full-width-zone');
        }
        return part;
      };
      for(const item of items||[]){
        const node=renderItem(item);
        if(!node)continue;
        if(item?.zone==='full'){
          active=null;
          const full=zone('full');
          full.appendChild(node);
          host.appendChild(full);
          rows.push({full});
          continue;
        }
        if(!active){
          const left=zone('left'),right=zone('right');
          host.append(left,right);
          active={left,right};
          rows.push(active);
          if(!firstLeft){firstLeft=left;firstRight=right;}
        }
        (item?.zone==='right'?active.right:active.left).appendChild(node);
      }
      watchCompactQuestionColumns(host);
      return {left:firstLeft,right:firstRight,rows,mixed:true};
    }
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

  // Nuage UNIQUE KALONÉO : algorithme historique Fractions V1, sans chevauchement,
  // positions normalisées persistantes et régénération uniquement après vrai redimensionnement.
  // Utilisé dans la V1 ET les nouveaux blocs image-selection (Builder, aperçu, candidat).
  function prepareFractionCloud(items){
    items.classList.add('cloud');
    const view=items.ownerDocument?.defaultView;
    const computed=view?.getComputedStyle?.(items);
    // Dans le candidat, les classes de la V1 apportent ces dimensions.
    // Dans les aperçus Builder sans feuille CSS candidat, reproduire la même géométrie.
    if(computed?.position!=='relative'||computed?.display!=='block'){
      items.style.position='relative';
      items.style.display='block';
      items.style.width='100%';
      items.style.height='clamp(190px,28vh,260px)';
      items.style.minHeight='190px';
      items.style.border='1px dashed #b8c0ca';
      items.style.borderRadius='9px';
      items.style.background='rgba(255,255,255,.72)';
      items.style.overflow='hidden';
    }
    for(const button of items.querySelectorAll('.kaltest-fraction-item')){
      button.style.position='absolute';
      button.style.margin='0';
    }
  }

  function fractionCloudOverlap(points, itemSize, margin) {
    for (let i = 0; i < points.length; i += 1) {
      for (let j = i + 1; j < points.length; j += 1) {
        if (
          Math.abs(points[i].x - points[j].x) < itemSize + margin &&
          Math.abs(points[i].y - points[j].y) < itemSize + margin
        ) return true;
      }
    }
    return false;
  }

  function randomFractionCloudPoints(count, width, height, itemSize, margin) {
    const maxX = Math.max(0, width - itemSize);
    const maxY = Math.max(0, height - itemSize);
    const points = [];
    const maxAttempts = Math.max(800, count * 350);
    let attempts = 0;

    while (points.length < count && attempts < maxAttempts) {
      attempts += 1;
      const candidate = {
        x:Math.random() * maxX,
        y:Math.random() * maxY
      };
      const collides = points.some(point =>
        Math.abs(point.x - candidate.x) < itemSize + margin &&
        Math.abs(point.y - candidate.y) < itemSize + margin
      );
      if (!collides) points.push(candidate);
    }

    if (points.length === count) return points;

    // Garde de secours : grille légèrement décalée, utilisée uniquement si
    // l'espace devient trop petit pour le placement aléatoire par rejet.
    const columns = Math.max(1, Math.floor((width + margin) / (itemSize + margin)));
    const rows = Math.max(1, Math.ceil(count / columns));
    const stepX = columns > 1 ? maxX / (columns - 1) : 0;
    const stepY = rows > 1 ? maxY / (rows - 1) : 0;
    const fallback = [];
    for (let index = 0; index < count; index += 1) {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const jitterX = Math.min(Math.max(0, stepX * 0.16), Math.max(0, stepX - itemSize - margin));
      const jitterY = Math.min(Math.max(0, stepY * 0.16), Math.max(0, stepY - itemSize - margin));
      fallback.push({
        x:Math.max(0, Math.min(maxX, column * stepX + ((row % 2) ? jitterX : 0))),
        y:Math.max(0, Math.min(maxY, row * stepY + ((column % 2) ? jitterY : 0)))
      });
    }
    return fallback;
  }

  function layoutFractionCloud(items, options = {}) {
    // Ne jamais écraser un nuage restauré pendant la destruction/recréation
    // d'une page, ni avec les dimensions nulles d'un élément invisible.
    if (!items?.isConnected) return false;
    const allowRegenerateSaved = options.allowRegenerateSaved === true;
    const buttons = Array.from(items.querySelectorAll('.kaltest-fraction-item'));
    if (!buttons.length) return false;

    const width = Math.max(1, items.clientWidth || items.getBoundingClientRect().width || 1);
    const height = Math.max(1, items.clientHeight || items.getBoundingClientRect().height || 1);
    const itemSize = Math.max(1, buttons[0].getBoundingClientRect().width || buttons[0].offsetWidth || 54);
    // Marge volontairement large : un objet sélectionné grossit légèrement
    // (transform:scale), le nuage doit rester sans contact même dans cet état.
    const margin = 16;
    if(width<itemSize+margin||height<itemSize+margin)return false;
    const maxX = Math.max(0, width - itemSize);
    const maxY = Math.max(0, height - itemSize);
    const saved = typeof options.getSaved==='function'
      ? options.getSaved() : items.__kaloneoCloudPositions;
    let points = null;
    if (Array.isArray(saved) && saved.length === buttons.length) {
      const restored = saved.map(position => ({
        x:Math.max(0, Math.min(maxX, Number(position?.x || 0) * maxX)),
        y:Math.max(0, Math.min(maxY, Number(position?.y || 0) * maxY))
      }));
      // Comme l'ancien qcm-page4.js : au rechargement, on conserve
      // strictement le nuage enregistré. Un contrôle de chevauchement pendant
      // la stabilisation d'Electron peut être faux et ne doit pas remélanger
      // les 12 images. Seul un vrai redimensionnement stable peut régénérer.
      if (!allowRegenerateSaved || !fractionCloudOverlap(restored, itemSize, margin)) points = restored;
    }

    let generated = false;
    if (!points) {
      points = randomFractionCloudPoints(buttons.length, width, height, itemSize, margin);
      const normalized=points.map(point => ({
        x:maxX > 0 ? point.x / maxX : 0,
        y:maxY > 0 ? point.y / maxY : 0
      }));
      if(typeof options.setSaved==='function')options.setSaved(normalized);
      else items.__kaloneoCloudPositions=normalized;
      generated = true;
    }

    buttons.forEach((button, index) => {
      const point = points[index] || { x:0, y:0 };
      button.style.left = point.x + 'px';
      button.style.top = point.y + 'px';
    });
    items.dataset.cloudReady = '1';

    // Le rappel setSaved conserve le stockage historique candidat ; dans le Builder, état local seulement.
    return true;
  }

  function installFractionCloud(items, options={}) {
    if(!items)return;
    let resizeTimer = null;
    let stableWidth = 0;
    let stableHeight = 0;
    let settled = false;

    const restore = () => {prepareFractionCloud(items);return layoutFractionCloud(items, {...options,allowRegenerateSaved:false});};
    requestAnimationFrame(restore);

    // On mémorise la géométrie une fois la page stabilisée. Les premiers
    // ResizeObserver émis pendant le chargement ne doivent jamais remélanger
    // un nuage restauré.
    setTimeout(() => {
      if(!items.isConnected)return;
      prepareFractionCloud(items);
      stableWidth = items.clientWidth || 0;
      stableHeight = items.clientHeight || 0;
      settled = true;
      // Stabiliser la taille sans modifier les positions sauvegardées :
      // seule une véritable modification de taille par ResizeObserver
      // autorise une nouvelle répartition si les objets se chevauchent.
      layoutFractionCloud(items, {...options,allowRegenerateSaved:false});
    }, 220);

    if (typeof ResizeObserver === 'function' && !items.__sebFractionCloudObserver) {
      const observer = new ResizeObserver(() => {
        clearTimeout(resizeTimer);
        if(!items.isConnected){
          observer.disconnect();
          items.__sebFractionCloudObserver=null;
          return;
        }
        resizeTimer = setTimeout(() => {
          if(!items.isConnected){
            observer.disconnect();
            items.__sebFractionCloudObserver=null;
            return;
          }
          if (!settled) {
            restore();
            return;
          }
          const width = items.clientWidth || 0;
          const height = items.clientHeight || 0;
          const realResize = Math.abs(width - stableWidth) > 2 || Math.abs(height - stableHeight) > 2;
          stableWidth = width;
          stableHeight = height;
          layoutFractionCloud(items, {...options,allowRegenerateSaved:realResize});
        }, 120);
      });
      observer.observe(items);
      items.__sebFractionCloudObserver = observer;
    }
  }

  // Rendu natif partagé. Le moteur candidat gère l'enregistrement et la correction.
  // Aucune exécution de scripts fournis par un test.
  function renderImageSelection({doc,block,selected=[],onChange,disabled=false,cloudState={}}){
    const outer=doc.createElement('section');
    outer.className='kaltest-image-selection kaltest-fraction-row';
    outer.dataset.questionId=String(block.questionId||'');
    // Rendu identique à la ligne des fractions historiques, y compris dans les aperçus.
    outer.style.cssText='box-sizing:border-box;display:grid;grid-template-columns:minmax(105px,145px) minmax(0,1fr);gap:10px;align-items:'+((block.cloud===true)?'start':'center')+';min-width:0;';
    if(block.cloud===true)outer.classList.add('cloud-row');
    const title=doc.createElement('div');
    title.className='kaltest-fraction-title';
    title.style.cssText='min-height:42px;display:flex;align-items:center;justify-content:center;gap:7px;padding:5px 7px;border:1px solid rgba(0,78,112,.28);border-radius:9px;background:rgba(0,78,112,.08);color:#004E70;';
    const label=doc.createElement('strong');
    label.textContent=String(block.label||'Sélectionnez les images');
    title.appendChild(label);
    const image=String(block.resource?.data||block.itemImage||'');
    if(/^data:image\//i.test(image)){
      const icon=doc.createElement('img');icon.src=image;icon.alt='';
      icon.style.cssText='width:34px;height:34px;object-fit:contain;';
      title.appendChild(icon);
    }
    outer.appendChild(title);
    const total=Math.max(1,Math.min(60,Math.floor(Number(block.totalItems)||4)));
    const values=new Set(Array.isArray(selected)?selected.map(String):[]);
    const grid=doc.createElement('div');
    grid.className='kaltest-fraction-items kaltest-image-selection-items'+(block.cloud===true?' cloud':'');
    grid.style.cssText=block.cloud===true
      ?'min-width:0;'
      :'min-width:0;display:flex;flex-wrap:wrap;align-items:center;gap:8px;';
    for(let i=1;i<=total;i++){
      const id=String(i);
      const button=doc.createElement('button');
      button.type='button';button.className='kaltest-fraction-item kaltest-image-selection-item';
      button.dataset.itemIndex=id;
      button.setAttribute('aria-label',String(block.label||'Image')+' — objet '+id);
      // Mêmes dimensions que le test Fractions V1, y compris écran bas.
      const size=doc.defaultView?.matchMedia?.('(max-height:760px)')?.matches?46:54;
      button.style.cssText='box-sizing:border-box;flex:0 0 '+size+'px;width:'+size+'px;height:'+size+'px;border:3px solid #c5cbd2;border-radius:9px;background:#ffffff;cursor:pointer;';
      if(/^data:image\//i.test(image)){
        button.style.backgroundImage='url('+JSON.stringify(image)+')';
        button.style.backgroundSize='contain';
        button.style.backgroundRepeat='no-repeat';
        button.style.backgroundPosition='center';
      }
      const update=()=>{
        const active=values.has(id);
        button.classList.toggle('selected',active);
        button.setAttribute('aria-pressed',String(active));
        button.style.borderColor=active?'#F9B233':'#c5cbd2';
        button.style.transform=active?'scale(1.08)':'';
        button.style.boxShadow=active?'0 4px 10px rgba(0,0,0,.14)':'';
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
    if(block.cloud===true)installFractionCloud(grid,cloudState);
    return outer;
  }

  return Object.freeze({installFractionCloud,renderImageSelection,columns,renderZones,alignCompactQuestionColumns,renderRichContext,renderQuestion,renderMedia,renderHtmlFrame,renderInlineFlow,renderResponseTable,renderQuestionTable,renderGridTable,equalAutomaticColumns,applyColumn,addEqualColGroup,
    normalizeGridColor,gridCellBackground,gridCellTextColor,gridSelectQuestion});
});
