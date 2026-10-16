/*
 * KALONÉO — opérations communes d'édition, indépendantes des tests existants.
 * Aucune modification des V1, aucune règle liée à un identifiant de test.
 */
(function(root,factory){
  'use strict';
  const api=factory();
  if(root)root.KaloneoBuilderWorkflow=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window==='undefined'?null:window,function(){
  'use strict';
  const clone=value=>JSON.parse(JSON.stringify(value));
  const ZONES=new Set(['left','right','full']);
  function lines(blocks){
    const groups=[];let i=0;
    while(i<blocks.length){
      const first=blocks[i];
      if(first?.zone==='full'){groups.push({start:i,end:i+1,zone:'full'});i++;continue;}
      const next=blocks[i+1];
      if(next&&next.zone!=='full'&&next.zone!==first.zone&&
        ZONES.has(String(next.zone))&&ZONES.has(String(first.zone))){
        groups.push({start:i,end:i+2,zone:'pair'});i+=2;
      }else{groups.push({start:i,end:i+1,zone:'single'});i++;}
    }
    return groups;
  }
  function groupAt(blocks,index){
    return lines(blocks).find(group=>group.start<=index&&index<group.end)||null;
  }
  function moveLine(blocks,index,direction){
    if(direction!==-1&&direction!==1)throw new TypeError('Direction invalide');
    const groups=lines(blocks),current=groups.findIndex(g=>g.start<=index&&index<g.end);
    const other=current+direction;
    if(current<0||other<0||other>=groups.length)return clone(blocks);
    const portions=groups.map(g=>blocks.slice(g.start,g.end));
    [portions[current],portions[other]]=[portions[other],portions[current]];
    return portions.flat();
  }
  // Les ID de questions appartiennent aux blocs Question/Sélection et aux
  // cellules de réponse des grilles. Les références non copiées restent liées
  // à leurs questions existantes, jamais renommées arbitrairement.
  function ownedQuestionIds(blocks){
    const ids=new Set();
    for(const b of blocks){
      if(['question','image-selection'].includes(b.type)&&b.question?.id)ids.add(String(b.question.id));
      if(b.type==='table-grid')for(const row of b.table?.cells||[])
        for(const cell of row||[]){
          if(cell?.questionId&&['candidate-answer','select','unit','choice-option'].includes(cell.kind))
            ids.add(String(cell.questionId));
        }
    }
    return ids;
  }
  function allQuestionIds(blocks){
    const ids=ownedQuestionIds(blocks);
    for(const b of blocks)if(b.type==='inline-flow')for(const part of b.flow||[])
      if(part?.questionId)ids.add(String(part.questionId));
    return ids;
  }
  function copyBlocks(source,existing,makeUid){
    if(!Array.isArray(source)||!source.length)throw new TypeError('Aucun bloc à reproduire');
    if(typeof makeUid!=='function')throw new TypeError('Générateur UID manquant');
    const result=clone(source);
    const used=allQuestionIds(existing||[]);
    const owned=ownedQuestionIds(source);
    const remap=new Map();
    let n=1;
    for(const original of owned){
      let id;
      do{id='copie_'+n++;}while(used.has(id)||remap.has(id));
      remap.set(original,id);used.add(id);
    }
    const uids=new Set((existing||[]).map(b=>String(b.uid)));
    for(const b of result){
      let fresh;do{fresh=String(makeUid());}while(!fresh||uids.has(fresh));
      b.uid=fresh;uids.add(fresh);
      if(b.tableDefinition?.id)b.tableDefinition.id=fresh+'_table';
      if(['question','image-selection'].includes(b.type)&&b.question?.id)
        b.question.id=remap.get(String(b.question.id))||b.question.id;
      if(b.type==='table-grid')for(const row of b.table?.cells||[])for(const cell of row||[])
        if(cell?.questionId&&remap.has(String(cell.questionId)))
          cell.questionId=remap.get(String(cell.questionId));
      if(b.type==='inline-flow')for(const part of b.flow||[])
        if(part?.questionId&&remap.has(String(part.questionId)))
          part.questionId=remap.get(String(part.questionId));
      if(b.type==='multiple-tables'&&Array.isArray(b.tableDefinition?.questionIds))
        b.tableDefinition.questionIds=b.tableDefinition.questionIds.map(id=>remap.get(String(id))||id);
    }
    return result;
  }
  function insertBlocks(blocks,index,added){
    if(!Number.isInteger(index)||index<0||index>blocks.length)
      throw new RangeError('Position d’insertion invalide');
    return [...blocks.slice(0,index),...added,...blocks.slice(index)];
  }
  // Même normalisation et mêmes types que evaluateQuestion du moteur candidat.
  const text=value=>String(value==null?'':value).replace(/\u00a0/g,' ')
    .replace(/[’‘]/g,"'").trim().replace(/\s+/g,' ').toLocaleLowerCase('fr-FR');
  const number=value=>{
    const raw=String(value==null?'':value).replace(/\u00a0/g,' ').replace(/\s+/g,'').replace(',','.');
    return /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw)&&Number.isFinite(Number(raw))?Number(raw):null;
  };
  const minutes=value=>{
    let t=text(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .replace(/heures?/g,'h').replace(/heurs?/g,'h').replace(/hrs?/g,'h')
      .replace(/minutes?/g,'m').replace(/mins?/g,'m').replace(/mn/g,'m')
      .replace(/\bet\b/g,' ').replace(/[.;]+$/g,'').replace(/\s+/g,' ').trim();
    let m=t.match(/^(\d+)\s*m$/);if(m)return Number(m[1]);
    m=t.match(/^(\d+)\s*h$/);if(m)return Number(m[1])*60;
    m=t.match(/^(\d+)\s*(?:h|:)\s*(\d{1,2})\s*m?$/)||t.match(/^(\d+)\s+(\d{1,2})$/);
    return m&&Number(m[2])<60?Number(m[1])*60+Number(m[2]):null;
  };
  function evaluate(q,value){
    const type=q?.response?.type||'text';
    if(type==='free-text'||q.manualEvaluation===true)return null;
    if(type==='duration')return minutes(value)!==null&&minutes(value)===Number(q.acceptedMinutes);
    if(type==='number'||type==='number-unit'){
      const n=number(value);
      return n!==null&&(q.acceptedAnswers||[]).some(v=>number(v)!==null&&Math.abs(n-number(v))<1e-9);
    }
    if(type==='multiple-choice'){
      const actual=Array.isArray(value)?value.map(text).sort():[];
      if(Number.isInteger(Number(q.acceptedCount)))return actual.length===Number(q.acceptedCount);
      return (q.acceptedAnswers||[]).some(v=>JSON.stringify(actual)===JSON.stringify(
        (Array.isArray(v)?v:[]).map(text).sort()));
    }
    return (q.acceptedAnswers||[]).some(v=>text(value)===text(v));
  }
  function scoringAudit(def,analyze){
    const errors=[],rows=[];
    const formal=typeof analyze==='function'?analyze(def):{ok:true,errors:[]};
    if(!formal.ok)errors.push(...formal.errors);
    let maximum=0,earned=0;
    const scored=def.scored!==false;
    const special=Boolean(def.evaluation&&(
      def.evaluation.mailRules||def.evaluation.bricksRules||def.evaluation.nwtexteRules||
      def.evaluation.dictationEngine||def.evaluation.stockRules||def.evaluation.uniqueGroups?.length
    ));
    for(const q of def.questions||[]){
      const manual=q.manualEvaluation===true||q.response?.type==='free-text';
      const example=q.example===true;
      const type=q.response?.type||'text';
      const points=manual?0:Number(q.points||0);
      const unit=scored&&!manual&&!example&&q.unitInput===true&&q.unitScored===true;
      const max=scored&&!manual&&!example?points+(unit?1:0):0;
      maximum+=max;
      if(manual||example||!scored){
        rows.push({id:q.id,type,points:max,status:'ignore',reason:manual?'Évaluation manuelle':example?'Exemple non noté':'Test non noté'});
        continue;
      }
      const expected=type==='duration'?Math.floor(Number(q.acceptedMinutes)||0)+' m':
        type==='multiple-choice'?
          Number.isInteger(Number(q.acceptedCount))?
            (q.response?.options||[]).slice(0,Number(q.acceptedCount)):
            (q.acceptedAnswers||[])[0]:
          (q.acceptedAnswers||[])[0];
      const wrong=type==='multiple-choice'&&Number.isInteger(Number(q.acceptedCount))?
        Array.from({length:Number(q.acceptedCount)===0?1:0},(_,i)=>'__wrong_'+i):
        type==='multiple-choice'?[]:'__kaloneo_incorrect__';
      const isGood=evaluate(q,expected),isBad=evaluate(q,wrong);
      const units=Array.isArray(q.acceptedUnits)?q.acceptedUnits:[];
      const unitOk=!unit||Boolean(units.length&&units.some(x=>text(x)===text(units[0]))&&
        !units.some(x=>text(x)==='__kaloneo_incorrect__'));
      const valid=isGood===true&&isBad===false&&unitOk&&Number.isFinite(points)&&points>=0;
      if(!valid)errors.push('Question '+q.id+' : simulation de correction incohérente.');
      if(valid)earned+=max;
      rows.push({id:q.id,type,points:max,status:valid?'ok':'error',expected,wrong,
        correct:isGood===true,incorrect:isBad===false,unitOk});
    }
    if(special)rows.push({id:'moteur_spécialisé',status:'unsupported',
      reason:'Règles spécialisées : vérification individuelle dans Electron requise'});
    return {ok:errors.length===0&&!special,errors,rows,maximum,earned,
      standardOk:errors.length===0,special,formalOk:formal.ok};
  }
  const DB_NAME='kaloneo-builder-ensembles-v1';
  const STORE='ensembles';
  function openDb(){
    return new Promise((resolve,reject)=>{
      if(typeof indexedDB==='undefined'){reject(new Error('Stockage local des ensembles indisponible'));return;}
      const req=indexedDB.open(DB_NAME,1);
      req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))
        req.result.createObjectStore(STORE,{keyPath:'id'});};
      req.onerror=()=>reject(req.error||new Error('Stockage impossible'));
      req.onsuccess=()=>resolve(req.result);
    });
  }
  async function operate(mode,key,entry){
    const db=await openDb();
    try{
      return await new Promise((resolve,reject)=>{
        const tx=db.transaction(STORE,mode==='get'||mode==='all'?'readonly':'readwrite');
        const store=tx.objectStore(STORE);
        let req;
        if(mode==='get')req=store.get(key);
        else if(mode==='all')req=store.getAll();
        else if(mode==='put')req=store.put(entry);
        else if(mode==='delete')req=store.delete(key);
        else throw new TypeError('Opération indisponible');
        req.onsuccess=()=>resolve(req.result);
        req.onerror=()=>reject(req.error||new Error('Opération impossible'));
        tx.onabort=()=>reject(tx.error||new Error('Stockage annulé'));
      });
    }finally{db.close();}
  }
  const templates={
    list:async()=>operate('all'),
    get:async id=>operate('get',id),
    put:async entry=>{
      if(!entry||!String(entry.name||'').trim()||!Array.isArray(entry.blocks)||!entry.blocks.length)
        throw new TypeError('Ensemble incomplet');
      const id=entry.id||'ens_'+Date.now()+'_'+Math.random().toString(36).slice(2,9);
      await operate('put',null,{id,name:String(entry.name).trim(),blocks:clone(entry.blocks),updatedAt:Date.now()});
      return id;
    },
    remove:async id=>operate('delete',id)
  };
  return Object.freeze({lines,groupAt,moveLine,ownedQuestionIds,copyBlocks,insertBlocks,
    evaluate,scoringAudit,templates});
});