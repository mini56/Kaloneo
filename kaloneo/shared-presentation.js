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
    return {left,right};
  }

  function renderQuestion({doc,question,makeAnswer,example=false,className=''}) {
    if(!doc||typeof makeAnswer!=='function')throw new TypeError('Question sans moteur de réponse.');
    const row=doc.createElement('label');
    row.className='kaloneo-shared-question'+(className?' '+className:'');
    const caption=doc.createElement('span');
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


  function renderInlineFlow({doc,wordBank=[],flow=[],makeAnswer,className='',bankClass='',flowClass=''}) {
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
    wrap.appendChild(bank);
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
  function renderResponseTable({doc,headers=[],columns=[],rows=[],renderCell,className='',wrapperClassName=''}) {
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
    table.appendChild(tbody);
    wrap.appendChild(table);
    return wrap;
  }

  // Rendu de la structure d'un tableau libre, identique dans l'éditeur
  // et dans le candidat. Le contrôle de réponse reste au client appelant.
  function renderGridTable({doc,definition={},renderCell,className='',wrapperClassName='',compactClassName='',equalClassName=''}) {
    if(!doc||typeof renderCell!=='function')throw new TypeError('Grille KALTEST invalide.');
    const wrap=doc.createElement('div');
    wrap.className='kaloneo-shared-grid-wrap'+(wrapperClassName?' '+wrapperClassName:'');
    if(definition.title){
      const title=doc.createElement('h3');
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
        const td=doc.createElement('td');
        applyColumn(td,definition.columns?.[colIndex]);
        if(definition.layoutOnly===true){
          td.style.border='0';
          td.style.background='transparent';
        }
        const rowSpan=Math.max(1,Number(cellDefinition.rowSpan)||1);
        const colSpan=Math.max(1,Number(cellDefinition.colSpan)||1);
        if(rowSpan>1)td.rowSpan=rowSpan;
        if(colSpan>1)td.colSpan=colSpan;
        const node=renderCell({cell:td,cellDefinition,rowIndex,colIndex,rowNode:tr});
        if(node&&node.nodeType)td.appendChild(node);
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

  return Object.freeze({columns,renderZones,renderQuestion,renderMedia,renderHtmlFrame,renderInlineFlow,renderResponseTable,renderGridTable,equalAutomaticColumns,applyColumn,addEqualColGroup});
});
