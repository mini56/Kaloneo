(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  if(root) root.KaloneoBuilderCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const VERSION='2.0.0';
  const SUPPORTED_FEATURES=new Set([
    'runtime.basic','questionnaire.basic','questionnaire.table','questionnaire.duration-fr',
    'questionnaire.supplemental-fields','questionnaire.inline-gaps','questionnaire.single-choice-table',
    'questionnaire.grid','layout.single','layout.split','calculator.host','host.calculator','host.chrono',
    'host.admin-intervention','host.autoevaluation','host.external-material','host.text-editor','media.image','media.audio',
    'media.video','content.html','content.html-js','bilan.bindings','questionnaire.free-text-manual'
  ]);
  const RESPONSE_TYPES=new Set([
    'text','free-text','number','number-unit','duration','single-choice','multiple-choice','boolean','select'
  ]);
  const LAYOUTS=new Set(['single','50-50','40-60','60-40','chars-rest']);
  const LEGACY_LAYOUTS=new Set(['single-block']);
  const BUILDER_CONTENT_TYPES=new Set([
    'text','html','html-js','image','audio','video','question',
    'response-table','table-grid','inline-flow','table-definition','text-editor'
  ]);

  function clone(value){ return JSON.parse(JSON.stringify(value==null?null:value)); }
  function cleanId(value){
    return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'').replace(/_+/g,'_');
  }
  function splitValues(value){
    if(Array.isArray(value)) return value.map(v=>String(v)).filter(Boolean);
    return String(value||'').split(';').map(v=>v.trim()).filter(Boolean);
  }
  function clearMediaBlock(block){
    if(!block||!['image','audio','video'].includes(block.type)) return block;
    block.mediaName='';
    block.mediaType='';
    block.mediaData='';
    block.mediaAlt='';
    block.mediaPlaceholder='';
    return block;
  }
  function layoutFromDefinition(def){
    const direct=def?.presentation?.layout;
    if(typeof direct==='string'&&LAYOUTS.has(direct)) return direct;
    const ratio=def?.presentation?.kaloneoLayout?.ratio||def?.presentation?.layout?.ratio;
    if(ratio==='50/50') return '50-50';
    if(ratio==='40/60') return '40-60';
    if(ratio==='60/40') return '60-40';
    return 'single';
  }
  function questionToBlock(q,zone='left'){
    return {
      uid:'q_'+String(q.id||cleanId(q.prompt)||Math.random().toString(36).slice(2)),
      type:'question',
      zone,
      question:{
        id:String(q.id||''),
        prompt:String(q.prompt||''),
        responseType:String(q.response?.type||'text'),
        // Anciennes V1 sans ce champ : aucun changement de présentation.
        answerLayout:['column','inline','below'].includes(q.answerLayout)?q.answerLayout:'',
        answerWidthChars:Number(q.answerWidthChars)>=6&&Number(q.answerWidthChars)<=30
          ?Number(q.answerWidthChars):'',
        manualEvaluation:Boolean(q.manualEvaluation)||String(q.response?.type||'')==='free-text',
        normalizer:q.response?.normalizer||'',
        acceptedAnswers:q.response?.type==='multiple-choice'
          ? ((Array.isArray(q.acceptedAnswers?.[0])?q.acceptedAnswers[0]:q.acceptedAnswers)||[]).join('; ')
          : (q.acceptedAnswers||[]).join('; '),
        acceptedMinutes:Number.isInteger(q.acceptedMinutes)?q.acceptedMinutes:'',
        units:(q.acceptedUnits||q.units||[]).join('; '),
        points:Number(q.points==null?1:q.points),
        example:Boolean(q.example),
        options:(q.response?.options||[]).join('; '),
        unitInput:q.unitInput===true,
        unitScored:q.unitScored===true,
        supplementalFields:clone(q.supplementalFields||[])
      }
    };
  }
  function makeGridCell(kind='empty',value=''){
    return {kind,value,questionId:'',acceptedAnswers:'',responseType:'text',points:1,rowSpan:1,colSpan:1};
  }
  function createGridBlock(rows=6,cols=6){
    rows=Math.max(1,Number(rows)||1); cols=Math.max(1,Number(cols)||1);
    return {
      uid:'grid_'+Math.random().toString(36).slice(2,10),
      type:'table-grid',
      zone:'left',
      table:{
        title:'',
        rows,
        cols,
        columns:Array.from({length:cols},(_,i)=>({id:'c'+(i+1),widthChars:'',align:'center',remainder:i===cols-1})),
        cells:Array.from({length:rows},()=>Array.from({length:cols},()=>makeGridCell()))
      }
    };
  }
  function cellFromSchedule(cell){
    if(typeof cell==='string') return makeGridCell(cell?'fixed-text':'empty',cell);
    if(cell&&cell.questionId){
      const out=makeGridCell('candidate-answer','');
      out.questionId=cell.questionId;
      return out;
    }
    return makeGridCell();
  }
  function scheduleToGrid(def){
    const t=def.presentation.table;
    const rows=(t.rows||[]).map(row=>(row.cells||[]).map(cellFromSchedule));
    const cols=Math.max((t.headers||[]).length,...rows.map(r=>r.length),1);
    while(rows.length===0) rows.push(Array.from({length:cols},()=>makeGridCell()));
    rows.forEach(r=>{while(r.length<cols)r.push(makeGridCell());});
    return {
      uid:'grid_schedule',
      type:'table-grid',
      zone:def.presentation?.kaloneoLayout?.type==='visual-schedule'?'right':'left',
      table:{
        title:'',
        headers:clone(t.headers||[]),
        rows:rows.length,
        cols,
        columns:Array.from({length:cols},(_,i)=>({id:'c'+(i+1),widthChars:'',align:i===0?'left':'center',remainder:i===cols-1})),
        cells:rows
      }
    };
  }
  function inlineToBlock(def){
    return {
      uid:'inline_flow',
      type:'inline-flow',
      zone:def.presentation?.kaloneoLayout?.type==='visual-inline-gaps'?'right':'left',
      wordBank:clone(def.presentation?.wordBank||[]),
      flow:clone(def.presentation?.inlineFlow||[])
    };
  }
  function choiceToGrid(def){
    const questions=def.questions||[];
    const headers=def.presentation?.choiceTable?.columns||['Mot','Proposition 1'];
    const cols=headers.length;
    const cells=questions.map(q=>{
      const row=[makeGridCell('fixed-text',String(q.prompt||'').replace(/^.*?«\s*([^»]+)\s*».*$/,'$1'))];
      const opts=q.response?.options||[];
      for(let i=1;i<cols;i++){
        const cell=makeGridCell('choice-option',String(opts[i-1]||''));
        cell.questionId=q.id;
        cell.acceptedAnswers=(q.acceptedAnswers||[]).join('; ');
        cell.responseType='single-choice';
        cell.points=Number(q.points==null?1:q.points);
        row.push(cell);
      }
      return row;
    });
    return {
      uid:'grid_choice',
      type:'table-grid',
      zone:'left',
      table:{
        title:'',
        headers:clone(headers),
        rows:cells.length||1,
        cols,
        columns:Array.from({length:cols},(_,i)=>({id:'c'+(i+1),widthChars:'',align:i===0?'left':'center',remainder:i===cols-1})),
        cells:cells.length?cells:[Array.from({length:cols},()=>makeGridCell())],
        mode:'single-choice-table'
      }
    };
  }
  function tablesToBlocks(def){
    return (def.presentation?.tables||[]).map((table,index)=>withBuilderStyle({
      uid:'multi_table_'+index,
      type:'multiple-tables',
      zone:index===0?'left':'right',
      tableDefinition:clone(table)
    },{style:table.builderStyle||{}}));
  }
  function responseTableBlock(def){
    return {
      uid:'response_table',
      type:'response-table',
      zone:'left',
      responseTable:clone(def.presentation?.responseTable||{
        headers:['Question N°','Réponse','Unités'],
        columns:[]
      })
    };
  }

  function organisationToBlocks(def){
    const organisation=def.presentation?.organisationList;
    if(!organisation||!Array.isArray(organisation.rows)) return [];
    const blocks=[];
    const visual=organisation.visual||{};
    if(visual.type==='image'&&visual.src){
      blocks.push({
        uid:'organisation_visual',
        type:'image',
        zone:'left',
        mediaName:String(visual.src||''),
        mediaType:'image/*',
        mediaData:String(visual.src||''),
        mediaAlt:String(visual.alt||''),
        mediaPlaceholder:'Illustration'
      });
    }
    const byId=new Map((def.questions||[]).map(q=>[String(q.id),q]));
    for(const row of organisation.rows){
      const q=byId.get(String(row?.questionId||''));
      if(!q) continue;
      const block=questionToBlock(q,'right');
      if(row?.text) block.question.prompt=String(row.text);
      blocks.push(block);
    }
    return blocks;
  }
  function visualBlock(def){
    const k=def.presentation?.kaloneoLayout;
    if(!k) return null;
    const side=k.left?.type==='image'?'left':k.right?.type==='image'?'right':null;
    const visual=side==='left'?k.left:k.right;
    if(!side||!visual) return null;
    return {
      uid:'visual',
      type:'image',
      zone:side,
      mediaName:visual.src||'',
      mediaType:'image/*',
      mediaData:visual.src||'',
      mediaAlt:visual.alt||'',
      mediaPlaceholder:visual.placeholder||'Image'
    };
  }

  function withBuilderStyle(block,item){
    const style=item?.style||{};
    block.fontSize=Number(style.fontSize)||'';
    if(block.type==='image'){
      block.imageScale=Number.isFinite(Number(style.imageScale))&&Number(style.imageScale)>=10&&Number(style.imageScale)<=100?Number(style.imageScale):100;
      block.imageAlign=['left','right'].includes(style.imageAlign)?style.imageAlign:'center';
    }
    block.backgroundColor=String(style.backgroundColor||'');
    block.textAlign=block.type==='text' && ['left','center','right'].includes(style.textAlign)?style.textAlign:'';
    block.lineHeight=block.type==='text' && ['1','1.2','1.5','1.8'].includes(String(style.lineHeight||''))?String(style.lineHeight):'';
    block.backgroundImage=String(style.backgroundImage||'');
    block.backgroundFit=String(style.backgroundFit||'decorative');
    block.backgroundPosition=String(style.backgroundPosition||'right bottom');
    block.backgroundOpacity=Number.isFinite(Number(style.backgroundOpacity))?Number(style.backgroundOpacity):100;
    block.backgroundScale=Number(style.backgroundScale)>=10&&Number(style.backgroundScale)<=100?Number(style.backgroundScale):100;
    return block;
  }

  function builderItemStyle(block){
    const style={};
    const fontSize=Number(block?.fontSize);
    const backgroundColor=String(block?.backgroundColor||'').trim();
    if(Number.isFinite(fontSize)&&fontSize>=10&&fontSize<=40) style.fontSize=fontSize;
    if(backgroundColor) style.backgroundColor=backgroundColor;
    if(block?.type==='image'){
      if(Number(block.imageScale)>=10&&Number(block.imageScale)<100)style.imageScale=Math.round(Number(block.imageScale));
      if(['left','right'].includes(block.imageAlign))style.imageAlign=block.imageAlign;
    }
    if(block?.type==='text'){
      if(['left','center','right'].includes(block.textAlign))style.textAlign=block.textAlign;
      if(['1','1.2','1.5','1.8'].includes(String(block.lineHeight||'')))style.lineHeight=String(block.lineHeight);
    }
    if(block?.backgroundImage){
      style.backgroundImage=String(block.backgroundImage);
      style.backgroundFit=['decorative','contain','cover'].includes(block.backgroundFit)?block.backgroundFit:'decorative';
      style.backgroundPosition=String(block.backgroundPosition||'right bottom');
      style.backgroundOpacity=Math.max(0,Math.min(100,Number(block.backgroundOpacity??100)||0));
      if(Number(block.backgroundScale)>=10&&Number(block.backgroundScale)<100)style.backgroundScale=Math.round(Number(block.backgroundScale));
    }
    return Object.keys(style).length?style:undefined;
  }

  function pageStyleFromMeta(meta){
    const m=meta||{};
    if(m.pageBackgroundType==='image'&&String(m.pageBackgroundImage||'')){
      return {
        backgroundImage:String(m.pageBackgroundImage||''),
        backgroundName:String(m.pageBackgroundName||''),
        backgroundFit:'cover'
      };
    }
    if(m.pageBackgroundType==='color'&&String(m.pageBackgroundColor||'')){
      return {backgroundColor:String(m.pageBackgroundColor||'')};
    }
    return undefined;
  }

  function builderContentToBlocks(def){
    const byId=new Map((def.questions||[]).map(q=>[q.id,q]));
    return (def.presentation?.builderContent||[]).map((item,index)=>{
      const type=String(item?.type||'text');
      const zone=item?.zone||'left';
      if(type==='question'){
        const q=byId.get(item.questionId)||{id:item.questionId||'',prompt:'',response:{type:'text'},acceptedAnswers:[],points:1};
        return withBuilderStyle(questionToBlock(q,zone),item);
      }
      if(type==='text') return withBuilderStyle({uid:'content_'+index,type,zone,text:item.text||''},item);
      if(type==='html') return withBuilderStyle({uid:'content_'+index,type,zone,html:item.html||''},item);
      if(type==='html-js') return withBuilderStyle({uid:'content_'+index,type,zone,html:item.html||'',js:item.script||'',preset:item.preset||''},item);
      if(['image','audio','video'].includes(type)){
        const r=item.resource||{};
        return withBuilderStyle({
          uid:'content_'+index,type,zone,
          mediaName:r.name||'',mediaType:r.mime||'',mediaData:r.data||'',
          mediaAlt:r.alt||'',mediaPlaceholder:r.placeholder||''
        },item);
      }
      if(type==='response-table') return withBuilderStyle({uid:'content_'+index,type,zone,responseTable:clone(item.definition||{})},item);
      if(type==='inline-flow') return withBuilderStyle({
        uid:'content_'+index,type,zone,wordBank:clone(item.wordBank||[]),flow:clone(item.flow||[])
      },item);
      if(type==='table-definition') return withBuilderStyle({
        uid:'content_'+index,type:'multiple-tables',zone,tableDefinition:clone(item.definition||{})
      },item);
      if(type==='table-grid') return withBuilderStyle({
        uid:'content_'+index,type,zone,table:clone(item.table||{})
      },item);
      if(type==='text-editor') return withBuilderStyle({
        uid:'content_'+index,type,zone,
        config:Object.assign({fileSimulation:true,imageSimulation:true,scoringProfile:'none'},clone(item.config||{}))
      },item);
      return withBuilderStyle({uid:'content_'+index,type,zone,config:clone(item.config||{})},item);
    });
  }

  function definitionToModel(definition){
    const def=clone(definition);
    const blocks=[];
    const visual=visualBlock(def);
    if(visual) blocks.push(visual);

    if(Array.isArray(def.presentation?.builderContent)){
      blocks.push(...builderContentToBlocks(def));
    } else if(def.presentation?.organisationList&&Array.isArray(def.presentation.organisationList.rows)){
      blocks.push(...organisationToBlocks(def));
    } else if(Array.isArray(def.presentation?.inlineFlow)){
      blocks.push(inlineToBlock(def));
    } else if(def.presentation?.choiceTable){
      blocks.push(choiceToGrid(def));
    } else if(def.presentation?.table?.rows){
      blocks.push(scheduleToGrid(def));
      const averageIds=new Set(def.presentation?.averages||[]);
      (def.questions||[]).filter(q=>averageIds.has(q.id)).forEach(q=>blocks.push(questionToBlock(q,'right')));
    } else if(Array.isArray(def.presentation?.tables)){
      blocks.push(...tablesToBlocks(def));
    } else {
      (def.questions||[]).forEach(q=>blocks.push(questionToBlock(q,'left')));
      if(def.presentation?.responseTable) blocks.push(responseTableBlock(def));
    }

    return {
      idLocked:Boolean(def.id),
      sourceDefinition:def,
      meta:{
        title:def.title||'',
        id:def.id||'',
        version:def.version||'1.0.0',
        category:def.category||'mathematiques',
        scored:def.scored!==false,
        icon:def.icon?clone(def.icon):null,
        layout:layoutFromDefinition(def),
        legacyFullPage:def.presentation?.legacyFullPage===true,
        scenario:def.scenario||'',
        instruction:def.instruction||'',
        calculatorCompatible:def.calculator?.compatible===true,
        calculatorDefaultEnabled:def.calculator?.defaultEnabled===true,
        calculatorBrand:String(def.calculator?.brandLabel ?? 'KALONÉO'),
        chronoEnabled:def.chrono?.enabled===true||def.features?.includes('host.chrono'),
        chronoMode:def.chrono?.mode||'simple',
        chronoMinMeasures:Math.max(1,Number(def.chrono?.minMeasures)||1),
        chronoMaxMeasures:Math.max(1,Number(def.chrono?.maxMeasures)||1),
        chronoAutoReset:Boolean(def.chrono?.autoReset),
        chronoFocusAfterStop:Boolean(def.chrono?.focusAfterStop),
        chronoShowTime:def.chrono?.showTime!==false,
        adminIntervention:Boolean(def.adminIntervention?.enabled ?? def.adminIntervention)||def.features?.includes('host.admin-intervention'),
        adminInstructions:typeof def.adminIntervention==='object'?(def.adminIntervention.instructions||''):'',
        autoevaluation:Boolean(def.autoevaluation)||def.features?.includes('host.autoevaluation'),
        externalMaterial:Boolean(def.externalMaterial?.enabled ?? def.externalMaterial)||def.features?.includes('host.external-material'),
        externalMaterialText:typeof def.externalMaterial==='object'?(def.externalMaterial.material||''):'',
        outputs:clone(def.outputs||[]),
        bilanContributions:clone(def.bilanContributions||[]),
        template:def.presentation?.kaloneoLayout?.type||(
          def.presentation?.choiceTable?'full-width-choice-table':
          def.presentation?.tables?'two-tables-50-50':
          def.presentation?.table?'schedule-table':
          def.presentation?.inlineFlow?'inline-flow':
          'generic'
        ),
        block1WidthChars:def.presentation?.blockSizing?.blocks?.[0]?.widthChars||'',
        block2WidthChars:def.presentation?.blockSizing?.blocks?.[1]?.widthChars||'',
        lastBlockRemainder:def.presentation?.blockSizing?.blocks?.[1]?.remainder!==false,
        pageBackgroundType:def.presentation?.pageStyle?.backgroundImage?'image':(def.presentation?.pageStyle?.backgroundColor?'color':'none'),
        pageBackgroundColor:String(def.presentation?.pageStyle?.backgroundColor||'#EEF6FD'),
        pageBackgroundImage:String(def.presentation?.pageStyle?.backgroundImage||''),
        pageBackgroundName:String(def.presentation?.pageStyle?.backgroundName||'')
      },
      blocks
    };
  }

  function blockQuestion(block,index){
    const q=block.question||{};
    const id=String(q.id||('ID'+(index+1)+'_'+cleanId(q.prompt||'question')));
    const response={type:q.responseType||'text'};
    const options=splitValues(q.options);
    if(options.length) response.options=options;
    if(q.normalizer) response.normalizer=q.normalizer;
    const manual=response.type==='free-text'||q.manualEvaluation===true;
    const out={
      id,
      prompt:q.prompt||'',
      response,
      points:(q.example||manual)?0:Math.max(0,Number(q.points)||0),
      example:Boolean(q.example)
    };
    // Paramètres purement visuels : aucun effet sur la notation.
    if(['column','inline','below'].includes(q.answerLayout))out.answerLayout=q.answerLayout;
    const answerWidth=Number(q.answerWidthChars);
    if(q.answerWidthChars!==''&&q.answerWidthChars!=null&&
       Number.isInteger(answerWidth)&&answerWidth>=6&&answerWidth<=30){
      out.answerWidthChars=answerWidth;
    }
    if(manual) {
      out.manualEvaluation=true;
      out.manualLevels=['NE','I','II','III'];
    }
    if(response.type==='duration'){
      out.acceptedMinutes=Math.max(0,Number(q.acceptedMinutes)||0);
    } else if(response.type==='multiple-choice'){
      out.acceptedAnswers=[splitValues(q.acceptedAnswers)];
    } else if(response.type!=='free-text') {
      out.acceptedAnswers=splitValues(q.acceptedAnswers);
    }
    const units=splitValues(q.units);
    if(units.length) out.acceptedUnits=units;
    if(q.unitInput===true) out.unitInput=true;
    if(q.unitScored===true) out.unitScored=true;
    if(Array.isArray(q.supplementalFields)&&q.supplementalFields.length) out.supplementalFields=clone(q.supplementalFields);
    return out;
  }

  function gridQuestions(block,startIndex){
    const out=[];
    const seen=new Set();
    const table=block.table||{};
    for(const row of table.cells||[]){
      for(const cell of row||[]){
        if(!cell||!['candidate-answer','select','choice-option','unit'].includes(cell.kind)) continue;
        const id=String(cell.questionId||('id'+(startIndex+out.length+1)+'_grille'));
        if(seen.has(id)) continue;
        seen.add(id);
        const response={type:cell.responseType||((cell.kind==='select'||cell.kind==='choice-option')?'single-choice':'text')};
        if(Array.isArray(cell.options)&&cell.options.length) response.options=clone(cell.options);
        out.push({
          id,
          prompt:cell.prompt||('Réponse '+id),
          response,
          acceptedAnswers:splitValues(cell.acceptedAnswers),
          points:Math.max(0,Number(cell.points)||0)
        });
      }
    }
    return out;
  }

  function updateImportedQuestions(def,model){
    const byId=new Map((def.questions||[]).map(q=>[q.id,q]));
    let index=0;
    for(const block of model.blocks||[]){
      if(block.type!=='question') continue;
      const built=blockQuestion(block,index++);
      const target=byId.get(built.id);
      if(!target) continue;
      target.prompt=built.prompt;
      target.response=built.response;
      if(built.response?.type==='duration'){
        target.acceptedMinutes=built.acceptedMinutes;
        if(Object.prototype.hasOwnProperty.call(target,'acceptedAnswers')) delete target.acceptedAnswers;
      } else if(built.response?.type==='free-text') {
        if(Object.prototype.hasOwnProperty.call(target,'acceptedAnswers')) delete target.acceptedAnswers;
        if(Object.prototype.hasOwnProperty.call(target,'acceptedMinutes')) delete target.acceptedMinutes;
      } else {
        if(Object.prototype.hasOwnProperty.call(target,'acceptedAnswers') ||
           (Array.isArray(built.acceptedAnswers) && built.acceptedAnswers.length)) {
          target.acceptedAnswers=built.acceptedAnswers;
        }
        if(Object.prototype.hasOwnProperty.call(target,'acceptedMinutes')) delete target.acceptedMinutes;
      }
      if(built.manualEvaluation===true) {
        target.manualEvaluation=true;
        target.manualLevels=clone(built.manualLevels||['NE','I','II','III']);
      } else if(target.manualEvaluation===true) {
        delete target.manualEvaluation;
        if(Object.prototype.hasOwnProperty.call(target,'manualLevels')) delete target.manualLevels;
      }
      if(Object.prototype.hasOwnProperty.call(target,'points') || built.points!==1) target.points=built.points;
      if(Object.prototype.hasOwnProperty.call(target,'example') || built.example) target.example=built.example;
      if(built.acceptedUnits) target.acceptedUnits=built.acceptedUnits;
      if(Object.prototype.hasOwnProperty.call(built,'unitInput')) target.unitInput=built.unitInput;
      if(Object.prototype.hasOwnProperty.call(built,'unitScored')) target.unitScored=built.unitScored;
      if(built.supplementalFields) target.supplementalFields=built.supplementalFields;
    }
  }

  function genericPresentation(model){
    const m=model.meta||{};
    const styled=(item,block)=>{
      const style=builderItemStyle(block);
      if(style)item.style=style;
      return item;
    };
    // Un bloc média sans fichier ni emplacement n'est pas un contenu de test.
    // Il reste éditable dans le brouillon, mais n'est pas exporté comme ressource cassée.
    const content=(model.blocks||[])
      .filter(block=>!['image','audio','video'].includes(block.type) ||
        Boolean(block.mediaData||block.mediaName||block.mediaPlaceholder))
      .map((block,index)=>{
      if(block.type==='question'){
        const q=blockQuestion(block,index);
        return styled({type:'question',zone:block.zone||'left',questionId:q.id},block);
      }
      if(block.type==='text') return styled({type:'text',zone:block.zone||'left',text:block.text||''},block);
      if(block.type==='html') return styled({type:'html',zone:block.zone||'left',html:block.html||''},block);
      if(block.type==='html-js') return styled({type:'html-js',zone:block.zone||'left',html:block.html||'',script:block.js||'',preset:block.preset||undefined},block);
      if(['image','audio','video'].includes(block.type)) return styled({
        type:block.type,zone:block.zone||'left',
        resource:{name:block.mediaName||'',mime:block.mediaType||'',data:block.mediaData||'',alt:block.mediaAlt||'',...(block.mediaPlaceholder?{placeholder:block.mediaPlaceholder}:{})}
      },block);
      if(block.type==='response-table') return styled({type:'response-table',zone:block.zone||'left',definition:clone(block.responseTable||{})},block);
      if(block.type==='inline-flow') return styled({type:'inline-flow',zone:block.zone||'left',wordBank:clone(block.wordBank||[]),flow:clone(block.flow||[])},block);
      if(block.type==='multiple-tables') return styled({type:'table-definition',zone:block.zone||'left',definition:clone(block.tableDefinition||{})},block);
      if(block.type==='table-grid') return styled({type:'table-grid',zone:block.zone||'left',table:clone(block.table||{})},block);
      if(block.type==='text-editor') return styled({
        type:'text-editor',zone:block.zone||'left',
        config:Object.assign({fileSimulation:true,imageSimulation:true,scoringProfile:'none'},clone(block.config||{}))
      },block);
      return styled({type:block.type,zone:block.zone||'left'},block);
    });
    return {
      layout:m.layout||'single',
      legacyFullPage:(m.legacyFullPage || model.sourceDefinition?.presentation?.legacyFullPage === true) ? true : undefined,
      blockSizing:m.layout==='chars-rest'?{
        mode:'characters-and-remainder',
        blocks:[
          {widthChars:Number(m.block1WidthChars)||null},
          {widthChars:Number(m.block2WidthChars)||null,remainder:Boolean(m.lastBlockRemainder)}
        ]
      }:undefined,
      pageStyle:pageStyleFromMeta(m),
      builderContent:content
    };
  }

  // Une question peut être affichée simultanément comme bloc Question et
  // comme cellule de grille. La définition KALTEST ne doit pourtant la
  // déclarer qu'une fois. Un bloc Question porte les champs de notation
  // complets et a priorité sur sa représentation simplifiée dans une grille.
  function collectBuilderQuestions(blocks){
    const questions=[];
    const positions=new Map();
    const explicit=new Set();
    let questionIndex=0;
    for(const block of blocks||[]){
      let candidates=[];
      if(block.type==='question')candidates=[blockQuestion(block,questionIndex++)];
      if(block.type==='table-grid'){
        candidates=gridQuestions(block,questionIndex);
        questionIndex+=candidates.length;
      }
      for(const question of candidates){
        const id=String(question.id);
        const position=positions.get(id);
        if(position===undefined){
          positions.set(id,questions.length);
          questions.push(question);
          if(block.type==='question')explicit.add(id);
        }else if(block.type==='question'){
          // Mettre à jour l'objet canonique sans déplacer l'ordre des
          // questions, même si le bloc explicite est placé après la grille.
          questions[position]=question;
          explicit.add(id);
        }else if(!explicit.has(id)){
          // Plusieurs grilles référençant la même question conservent sa
          // première déclaration ; les répétitions sont des vues.
        }
      }
    }
    return questions;
  }

  function rebuildBuilderQuestions(def,model){
    const existing=new Map((def.questions||[]).map(q=>[q.id,q]));
    const rebuilt=collectBuilderQuestions(model.blocks);
    const explicitIds=new Set((model.blocks||[])
      .filter(b=>b.type==='question').map(b=>String(b.question?.id||'')));
    // Pour les grilles déjà enregistrées, comparer les métadonnées d'origine
    // plutôt que d'écraser une correction complète par leurs valeurs par défaut.
    const initialGrids=(model.sourceDefinition?.presentation?.builderContent||[])
      .filter(item=>item.type==='table-grid')
      .map(item=>({type:'table-grid',table:item.table||{}}));
    const initialGridQuestions=new Map(collectBuilderQuestions(initialGrids)
      .map(question=>[String(question.id),question]));
    const presetKeepsQuestions=(model.blocks||[]).some(block=>block.type==='html-js'&&block.preset);
    if(presetKeepsQuestions&&rebuilt.length===0){
      def.questions=clone(def.questions||[]);
    }else if(rebuilt.length||Object.prototype.hasOwnProperty.call(def,'questions')){
      def.questions=rebuilt.map(q=>{
        const previous=existing.get(q.id);
        const initial=initialGridQuestions.get(String(q.id));
        if(previous&&!explicitIds.has(String(q.id))&&initial){
          // La grille contient une référence à la question canonique. Un
          // champ de grille ne la modifie que s'il a réellement changé depuis
          // son import. Préserver ainsi réponses, unités, points et correction
          // d'origine, même avec plusieurs cellules montrant la même question.
          const result=clone(previous);
          for(const key of ['prompt','response','acceptedAnswers','points']){
            if(JSON.stringify(q[key])!==JSON.stringify(initial[key])){
              result[key]=clone(q[key]);
            }
          }
          return result;
        }
        // R48.1: une grille importée peut conserver ses libellés historiques.
        // L'éditeur ne doit pas les écraser par « Réponse id » lors d'un changement de style.
        const prompt=(previous?.prompt && q.prompt==='Réponse '+q.id)?previous.prompt:q.prompt;
        return Object.assign({},previous||{},q,{prompt});
      });
    }else if(Object.prototype.hasOwnProperty.call(def,'questions')){
      delete def.questions;
    }
  }

  function modelToDefinition(model){
    const m=model.meta||{};
    if(model.sourceDefinition){
      const def=clone(model.sourceDefinition);
      def.title=m.title||def.title;
      def.id=m.id||def.id;
      def.version=m.version||def.version;
      def.category=m.category||def.category;
      const practical=def.category==='activite_pratique';
      def.scored=practical?false:(m.scored!==false);
      if(practical){
        def.activityType='practical';
        def.allowEmptyCompletion=true;
        def.behavior=Object.assign({},def.behavior||{},{practicalActivity:true});
      }else{
        if(def.activityType==='practical') delete def.activityType;
        if(def.behavior?.practicalActivity===true){
          def.behavior=Object.assign({},def.behavior);
          delete def.behavior.practicalActivity;
        }
      }
      if(m.icon) def.icon=clone(m.icon);
      else if(Object.prototype.hasOwnProperty.call(def,'icon')) delete def.icon;
      def.scenario=m.scenario||'';
      def.instruction=m.instruction||'';
      def.calculator=Object.assign({},def.calculator||{},{
        compatible:Boolean(m.calculatorCompatible),
        defaultEnabled:Boolean(m.calculatorCompatible&&m.calculatorDefaultEnabled)
      });
      const calculatorBrand=String(m.calculatorBrand ?? 'KALONÉO').trim();
      if(Object.prototype.hasOwnProperty.call(def.calculator,'brandLabel') || calculatorBrand!=='KALONÉO') {
        def.calculator.brandLabel=calculatorBrand;
      }
      if(m.chronoEnabled||def.chrono) {
        const chrono=Object.assign({},def.chrono||{},{
          enabled:Boolean(m.chronoEnabled),
          engine:m.chronoEnabled?'seb-common':null
        });
        if(m.chronoEnabled) {
          if(m.chronoMode&&m.chronoMode!=='simple') chrono.mode=m.chronoMode;
          else if(Object.prototype.hasOwnProperty.call(chrono,'mode')) chrono.mode=m.chronoMode||'simple';
          if(Number(m.chronoMinMeasures)>1||Object.prototype.hasOwnProperty.call(chrono,'minMeasures')) chrono.minMeasures=Math.max(1,Number(m.chronoMinMeasures)||1);
          if(Number(m.chronoMaxMeasures)>1||Object.prototype.hasOwnProperty.call(chrono,'maxMeasures')) chrono.maxMeasures=Math.max(1,Number(m.chronoMaxMeasures)||1);
          if(m.chronoAutoReset||Object.prototype.hasOwnProperty.call(chrono,'autoReset')) chrono.autoReset=Boolean(m.chronoAutoReset);
          if(m.chronoFocusAfterStop||Object.prototype.hasOwnProperty.call(chrono,'focusAfterStop')) chrono.focusAfterStop=Boolean(m.chronoFocusAfterStop);
          if(m.chronoShowTime===false||Object.prototype.hasOwnProperty.call(chrono,'showTime')) chrono.showTime=m.chronoShowTime!==false;
        }
        def.chrono=chrono;
      }
      if(m.adminIntervention||Object.prototype.hasOwnProperty.call(def,'adminIntervention')) {
        if(typeof def.adminIntervention==='object'||m.adminInstructions) {
          const admin=Object.assign({},typeof def.adminIntervention==='object'?def.adminIntervention:{});
          admin.enabled=Boolean(m.adminIntervention);
          if(m.adminInstructions||Object.prototype.hasOwnProperty.call(admin,'instructions')) admin.instructions=m.adminInstructions||'';
          def.adminIntervention=admin;
        } else def.adminIntervention=Boolean(m.adminIntervention);
      }
      if(m.autoevaluation||Object.prototype.hasOwnProperty.call(def,'autoevaluation')) def.autoevaluation=Boolean(m.autoevaluation);
      if(m.externalMaterial||Object.prototype.hasOwnProperty.call(def,'externalMaterial')) {
        if(typeof def.externalMaterial==='object'||m.externalMaterialText) {
          const external=Object.assign({},typeof def.externalMaterial==='object'?def.externalMaterial:{});
          external.enabled=Boolean(m.externalMaterial);
          if(m.externalMaterialText||Object.prototype.hasOwnProperty.call(external,'material')) external.material=m.externalMaterialText||'';
          def.externalMaterial=external;
        } else def.externalMaterial=Boolean(m.externalMaterial);
      }
      if(Array.isArray(m.outputs)) def.outputs=clone(m.outputs);
      if(Array.isArray(m.bilanContributions)) def.bilanContributions=clone(m.bilanContributions);
      def.presentation=Object.assign({},def.presentation||{});
      const pageStyle=pageStyleFromMeta(m);
      if(pageStyle) def.presentation.pageStyle=pageStyle;
      else if(Object.prototype.hasOwnProperty.call(def.presentation,'pageStyle')) delete def.presentation.pageStyle;
      const usesTextEditor=(model.blocks||[]).some(block=>block.type==='text-editor');
      const usesHtmlJs=(model.blocks||[]).some(block=>block.type==='html-js');
      const featureSet=new Set(def.features||[]);
      if(usesTextEditor) featureSet.add('host.text-editor'); else featureSet.delete('host.text-editor');
      if(usesHtmlJs) featureSet.add('content.html-js'); else featureSet.delete('content.html-js');
      def.features=[...featureSet];

      const existingBuilderContent=Array.isArray(def.presentation?.builderContent);
      const legacyOrganisation=Boolean(def.presentation?.organisationList&&Array.isArray(def.presentation.organisationList.rows));
      if(existingBuilderContent||legacyOrganisation){
        const generated=genericPresentation(model);
        def.presentation=Object.assign({},def.presentation||{},generated);
        if(legacyOrganisation) delete def.presentation.organisationList;
        rebuildBuilderQuestions(def,model);
      }else{
        // Les tableaux historiques (ex. Genre et nombre) conservent leur
        // rendu et leur schéma d'origine. Les styles du Builder sont
        // enregistrés par tableau, sans conversion destructrice en
        // builderContent et sans toucher aux tests V1 d'origine.
        if(Array.isArray(def.presentation.tables)){
          const tableBlocks=(model.blocks||[]).filter(block=>block.type==='multiple-tables');
          def.presentation.tables.forEach((table,index)=>{
            const block=tableBlocks.find(entry=>entry.tableDefinition?.id===table.id) || tableBlocks[index];
            if(!block)return;
            // Les métadonnées des tableaux historiques sont réellement
            // sauvegardées. Les identifiants/en-têtes sont protégés par
            // l'éditeur pour éviter de modifier la logique de correction.
            if(block.tableDefinition&&typeof block.tableDefinition.title==='string')
              table.title=block.tableDefinition.title;
            const style=builderItemStyle(block);
            if(style) table.builderStyle=style;
            else if(Object.prototype.hasOwnProperty.call(table,'builderStyle')) delete table.builderStyle;
          });
        }
        updateImportedQuestions(def,model);
      }
      return def;
    }

    const questions=collectBuilderQuestions(model.blocks);
    const features=['runtime.basic'];
    if(questions.length) features.push('questionnaire.basic');
    if(questions.some(q=>q.response?.type==='free-text'||q.manualEvaluation===true)) features.push('questionnaire.free-text-manual');
    if((model.blocks||[]).some(b=>['table-grid','response-table','multiple-tables'].includes(b.type))) features.push('questionnaire.table');
    if((model.blocks||[]).some(b=>b.type==='table-grid')) features.push('questionnaire.grid');
    if((model.blocks||[]).some(b=>b.type==='inline-flow')) features.push('questionnaire.inline-gaps');
    if((model.blocks||[]).some(b=>b.type==='html')) features.push('content.html');
    if((model.blocks||[]).some(b=>b.type==='html-js')) features.push('content.html-js');
    for(const type of ['image','audio','video']) if((model.blocks||[]).some(b=>b.type===type)) features.push('media.'+type);
    if(m.calculatorCompatible) features.push('host.calculator');
    if(m.chronoEnabled) features.push('host.chrono');
    if(m.adminIntervention) features.push('host.admin-intervention');
    if(m.autoevaluation) features.push('host.autoevaluation');
    if(m.externalMaterial) features.push('host.external-material');
    if((model.blocks||[]).some(b=>b.type==='text-editor')) features.push('host.text-editor');
    if(m.layout==='single') features.push('layout.single'); else features.push('layout.split');

    return {
      kaltestFormat:1,
      minSebEvalPro:'0.3.10',
      builderVersion:'2.0.0',
      id:m.id||cleanId(m.title),
      version:m.version||'1.0.0',
      title:m.title||'',
      category:m.category||'',
      activityType:m.category==='activite_pratique'?'practical':undefined,
      kind:questions.length?'questionnaire':'complex',
      scored:m.category==='activite_pratique'?false:(m.scored!==false),
      allowEmptyCompletion:m.category==='activite_pratique'?true:undefined,
      behavior:m.category==='activite_pratique'?{practicalActivity:true}:undefined,
      icon:m.icon?clone(m.icon):undefined,
      features:[...new Set(features)],
      scenario:m.scenario||'',
      instruction:m.instruction||'',
      calculator:{
        compatible:Boolean(m.calculatorCompatible),
        defaultEnabled:Boolean(m.calculatorCompatible&&m.calculatorDefaultEnabled),
        brandLabel:String(m.calculatorBrand ?? 'KALONÉO').trim()
      },
      chrono:m.chronoEnabled?{
        enabled:true,
        engine:'seb-common',
        mode:m.chronoMode||'simple',
        minMeasures:Math.max(1,Number(m.chronoMinMeasures)||1),
        maxMeasures:Math.max(1,Number(m.chronoMaxMeasures)||1),
        autoReset:Boolean(m.chronoAutoReset),
        focusAfterStop:Boolean(m.chronoFocusAfterStop),
        showTime:m.chronoShowTime!==false
      }:{enabled:false,engine:null},
      adminIntervention:m.adminIntervention?{enabled:true,instructions:m.adminInstructions||''}:{enabled:false},
      autoevaluation:Boolean(m.autoevaluation),
      externalMaterial:m.externalMaterial?{enabled:true,material:m.externalMaterialText||''}:{enabled:false},
      presentation:genericPresentation(model),
      navigation:{next:'host',abandon:'host-common'},
      runtime:{start:true,save:true,restore:true,finish:true},
      questions,
      outputs:Array.isArray(m.outputs)?clone(m.outputs):[
        {id:'score',type:'number'},{id:'score_max',type:'number'},{id:'pourcentage',type:'number'},{id:'status',type:'string'}
      ],
      bilanContributions:Array.isArray(m.bilanContributions)?clone(m.bilanContributions):[]
    };
  }

  function analyzeDefinition(def){
    const errors=[];
    if(Number(def?.kaltestFormat)!==1) errors.push('kaltestFormat non supporté');
    for(const feature of def?.features||[]){
      if(!SUPPORTED_FEATURES.has(feature)) errors.push('fonction non supportée: '+feature);
    }
    const questions=def?.questions||[];
    const questionIds=new Set();
    for(const q of questions){
      const type=q?.response?.type||'text';
      if(!RESPONSE_TYPES.has(type)) errors.push('type de réponse non supporté: '+type);
      if(!q?.id) errors.push('question sans ID');
      else if(questionIds.has(q.id)) errors.push('ID de question dupliqué: '+q.id);
      else questionIds.add(q.id);
    }

    const presentation=def?.presentation||{};
    if(typeof presentation.layout==='string'&&!LAYOUTS.has(presentation.layout)&&!LEGACY_LAYOUTS.has(presentation.layout)) {
      errors.push('layout Builder non supporté: '+presentation.layout);
    }
    const ratio=presentation?.kaloneoLayout?.ratio||presentation?.layout?.ratio;
    if(ratio&&!['50/50','40/60','60/40','100/100'].includes(ratio)) errors.push('ratio non supporté: '+ratio);
    const ktype=presentation?.kaloneoLayout?.type;
    if(ktype&&![
      'questions-table-visual','visual-inline-gaps','work-visual','visual-schedule',
      'full-width-choice-table','visual-choice-table'
    ].includes(ktype)) errors.push('gabarit KALONÉO non supporté: '+ktype);

    const columns=presentation?.responseTable?.columns||[];
    columns.forEach((col,index)=>{
      if(col.widthChars!=null&&Number(col.widthChars)<3) errors.push('colonne '+(index+1)+': widthChars < 3');
      if(col.align&&!['left','center'].includes(col.align)) errors.push('colonne '+(index+1)+': alignement non supporté');
    });

    if(Array.isArray(presentation.builderContent)){
      presentation.builderContent.forEach((item,index)=>{
        const type=String(item?.type||'');
        if(!BUILDER_CONTENT_TYPES.has(type)) {
          errors.push('bloc Builder non supporté '+(index+1)+': '+type);
          return;
        }
        if(type==='question'&&!questionIds.has(item.questionId)) {
          errors.push('bloc Question sans questionId valide: '+String(item.questionId||''));
        }
        if(['image','audio','video'].includes(type)){
          const resource=item.resource||{};
          if(!resource.data&&!resource.name&&!resource.placeholder) errors.push('média Builder sans ressource: bloc '+(index+1));
        }
        if(type==='table-grid'){
          const table=item.table||{};
          if(!Number(table.rows)||!Number(table.cols)) errors.push('grille Builder sans dimensions valides');
          const cells=Array.isArray(table.cells)?table.cells:[];
          if(cells.length!==Number(table.rows)) errors.push('grille Builder: nombre de lignes incohérent');
          cells.forEach((row,rowIndex)=>{
            if(!Array.isArray(row)||row.length!==Number(table.cols)) errors.push('grille Builder: ligne '+(rowIndex+1)+' incohérente');
            (row||[]).forEach(cell=>{
              if(cell&&['candidate-answer','select','unit','choice-option'].includes(cell.kind)&&!questionIds.has(cell.questionId)) {
                errors.push('grille Builder: questionId inconnu '+String(cell.questionId||''));
              }
            });
          });
        }
      });
    }

    if(def?.chrono?.enabled===true&&def?.chrono?.engine!=='seb-common') {
      errors.push('chronomètre local interdit: moteur seb-common requis');
    }
    if(def?.navigation){
      if(def.navigation.next&&def.navigation.next!=='host') errors.push('navigation suivante doit être fournie par l’hôte');
      if(def.navigation.abandon&&def.navigation.abandon!=='host-common') errors.push('abandon doit utiliser le composant commun');
    }
    return {ok:errors.length===0,errors};
  }

  function canRoundTrip(def){
    const analysis=analyzeDefinition(def);
    if(!analysis.ok) return analysis;
    const model=definitionToModel(def);
    const rebuilt=modelToDefinition(model);
    const stable=JSON.stringify(rebuilt)===JSON.stringify(def);
    return {ok:stable,errors:stable?[]:['aller-retour Builder non fidèle'],model,rebuilt};
  }

  return Object.freeze({
    VERSION,SUPPORTED_FEATURES:[...SUPPORTED_FEATURES],RESPONSE_TYPES:[...RESPONSE_TYPES],LAYOUTS:[...LAYOUTS],
    BUILDER_CONTENT_TYPES:[...BUILDER_CONTENT_TYPES],
    clone,cleanId,splitValues,clearMediaBlock,createGridBlock,definitionToModel,modelToDefinition,analyzeDefinition,canRoundTrip
  });
});
