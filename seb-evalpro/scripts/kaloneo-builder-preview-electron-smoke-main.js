const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

function fail(message, details) {
  console.error('KALONEO_BUILDER_PREVIEW_ELECTRON: FAIL — ' + message);
  if (details) console.error(JSON.stringify(details, null, 2));
  process.exit(2);
}

let state = {version:1,sessionStorage:{},localStorage:{},lastPage:'kaltest-pilot2.html',lastEvaluationPage:'kaltest-pilot2.html'};
let previewDefinition = null;
let previewEditorHistory = null;
let savedLibraryDefinition = null;
let savedLibraryPayload = null;
let savedImageCalls = 0;
const importedImages = new Map();
const BuilderCore=require('../../kaloneo/builder-core.js');
let organisationV2Fixture=null;
let zipImportCalls = 0;
let protectedLibraryMode = false;
let restaurantFixture = null;
let genreNombreFixture = null;
let genreLibraryMode = false;
let protectedOrganisation = null;
const imageLibraryData = 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="180" height="120"><rect width="180" height="120" fill="#1b6c8e"/></svg>').toString('base64');
const imageLibraryAlternativeData = 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="180" height="120"><rect width="180" height="120" fill="#e67e22"/></svg>').toString('base64');
let win = null;
let miniRenderCalls = 0;
ipcMain.handle('kaloneo-builder:render-mini-preview',()=>{
  miniRenderCalls++;
  return {ok:true,image:imageLibraryData,report:{overflowZones:0,tableHorizontalOverflow:false,brokenImages:[]}};
});

ipcMain.on('app:edition-sync', event => {
  event.returnValue = {edition:'unified',canBilan:true,canAi:true,canImport:true,canExport:true};
});
ipcMain.on('state:load-sync', event => { event.returnValue = state; });
ipcMain.on('state:save-sync', (event,payload) => {
  state={...state,...(payload||{})};
  event.returnValue={ok:true,state};
});
ipcMain.on('candidate-catalog:workspace-load-sync', event => { event.returnValue={ok:false}; });
ipcMain.on('candidate-catalog:workspace-save-sync', event => { event.returnValue={ok:true}; });
ipcMain.on('candidate-catalog:results-workspace-load-sync', event => { event.returnValue={ok:false}; });

ipcMain.handle('state:save', (_event,payload)=>{state={...state,...(payload||{})};return {ok:true,state};});
ipcMain.handle('admin:status',()=>true);
ipcMain.handle('admin:verify',()=>true);
ipcMain.handle('admin:verify-password',()=>true);
ipcMain.handle('admin:lock',()=>true);
ipcMain.handle('candidate:active',()=>null);
ipcMain.handle('candidate:set-admin-export-context',()=>true);
ipcMain.handle('candidate-catalog:workspace-save',()=>({ok:true}));
ipcMain.handle('candidate-catalog:end-bilan',()=>true);
ipcMain.handle('admin:open-candidate-browser',()=>true);
ipcMain.handle('admin:return-candidate-browser',()=>true);
ipcMain.handle('admin:open-tests-parcours',()=>true);
ipcMain.handle('admin:close-tests-parcours',()=>true);
ipcMain.handle('admin:open-bilan',()=>true);
ipcMain.handle('admin:open-candidate-results',()=>true);
ipcMain.handle('admin:return-evaluation',()=>true);
ipcMain.handle('admin:close-session',()=>true);
ipcMain.handle('admin:quit-application',()=>true);
ipcMain.handle('candidate:complete-active',()=>({ok:true}));
ipcMain.handle('ai:cancel-current',()=>({ok:true}));
ipcMain.handle('ai:status',()=>({available:true,offline:true,integrated:true}));
ipcMain.handle('ai:rewrite-synthesis',()=>({ok:false}));
ipcMain.handle('replay:capture-page',()=>({ok:true}));
ipcMain.handle('replay:list',()=>[]);
ipcMain.handle('bilan-history:list',()=>[]);
ipcMain.handle('candidate-catalog:list',()=>[]);
ipcMain.handle('candidate-catalog:sync',()=>({ok:true}));
ipcMain.handle('candidate-catalog:detail',()=>({ok:false}));
ipcMain.handle('kaloneo-library:selected-runtime',()=>({ok:false,error:'Aucun runtime candidat dans ce smoke Builder.'}));
ipcMain.handle('kaloneo-library:list-tests',()=>({
  ok:true,
  tests:(protectedLibraryMode ? [
    {id:'organisation_demenagement',version:'2.0.0',title:'Organisation d’une activité',category:'organisation',role:'test',scored:true,protectedVersion:false},
    {id:'organisation_demenagement',version:'1.0.0',title:'Organisation d’une activité',category:'organisation',role:'test',scored:true,protectedVersion:true}
  ] : []).concat(restaurantFixture?[{id:restaurantFixture.id,version:restaurantFixture.version,title:restaurantFixture.title,category:restaurantFixture.category,role:'test',scored:true,protectedVersion:false}]:[])
    .concat(genreLibraryMode&&genreNombreFixture?[{id:genreNombreFixture.id,version:genreNombreFixture.version,title:genreNombreFixture.title,category:genreNombreFixture.category,role:'test',scored:true,protectedVersion:false}]:[])
}));
ipcMain.handle('kaloneo-library:get-test',(_e,payload)=>{
  if(restaurantFixture&&payload?.id===restaurantFixture.id)return {ok:true,definition:JSON.parse(JSON.stringify(restaurantFixture))};
  if(genreLibraryMode&&genreNombreFixture&&payload?.id===genreNombreFixture.id)return {ok:true,definition:JSON.parse(JSON.stringify(genreNombreFixture))};
  if(protectedLibraryMode&&payload?.id==='organisation_demenagement'&&payload?.version==='2.0.0'&&organisationV2Fixture)
    return {ok:true,definition:JSON.parse(JSON.stringify(organisationV2Fixture))};
  if(protectedLibraryMode && payload?.id==='organisation_demenagement' && payload?.version==='1.0.0' && protectedOrganisation) {
    return {ok:true,definition:JSON.parse(JSON.stringify(protectedOrganisation))};
  }
  return {ok:false,error:'Test smoke absent'};
});
ipcMain.handle('kaloneo-library:save-test',(_e,payload)=>{
  savedLibraryDefinition=JSON.parse(JSON.stringify(payload?.definition||null));
  savedLibraryPayload={overwrite:payload?.overwrite,developerOverride:payload?.developerOverride};
  return {ok:true,replaced:false,test:{id:savedLibraryDefinition?.id,version:savedLibraryDefinition?.version,title:savedLibraryDefinition?.title}};
});
ipcMain.handle('kaloneo-library:list-images',()=>({ok:true,images:[
  {id:'img-smoke-library',name:'bibliotheque-kaloneo.svg',mime:'image/svg+xml',size:123,category:'Mes images KALONÉO',systemProvided:false,sourceName:''},
  {id:'img-smoke-alternative',name:'bibliotheque-changement.svg',mime:'image/svg+xml',size:124,category:'Mes images KALONÉO',systemProvided:false,sourceName:''},
  {id:'img-v1-posture',name:'qcm_posture.png',mime:'image/png',size:125,category:'Images exercices SEB EvalPro',systemProvided:true,sourceName:'qcm_posture.png'},
  {id:'img-tech-flacon',name:'flacon_bleu.png',mime:'image/png',size:126,category:'Images Stock',systemProvided:true,sourceName:'flacon_bleu.png'},
  ...[...importedImages.values()].map(({data,...metadata})=>metadata)
]}));
ipcMain.handle('kaloneo-library:get-image',(_e,id)=>{
  if(id==='img-smoke-library')return {ok:true,image:{id,name:'bibliotheque-kaloneo.svg',mime:'image/svg+xml',size:123,category:'Mes images KALONÉO',systemProvided:false,data:imageLibraryData}};
  if(id==='img-smoke-alternative')return {ok:true,image:{id,name:'bibliotheque-changement.svg',mime:'image/svg+xml',size:124,category:'Mes images KALONÉO',systemProvided:false,data:imageLibraryAlternativeData}};
  if(id==='img-v1-posture')return {ok:true,image:{id,name:'qcm_posture.png',mime:'image/png',size:125,category:'Images exercices SEB EvalPro',systemProvided:true,data:imageLibraryAlternativeData}};
  const image=importedImages.get(id);
  return image?{ok:true,image}:{ok:false,error:'absent'};
});
ipcMain.handle('kaloneo-library:save-image',(_e,payload)=>{
  savedImageCalls++;
  const data=String(payload?.data||'');
  const existing=[...importedImages.values()].find(item=>item.data===data);
  if(existing)return {ok:true,duplicate:true,image:existing};
  const image={id:'img-pc-'+importedImages.size,name:payload?.name||'image',mime:payload?.mime||'image/*',size:data.length,category:'Mes images KALONÉO',systemProvided:false,data};
  importedImages.set(image.id,image);
  return {ok:true,duplicate:false,image};
});
ipcMain.handle('kaloneo-library:import-image-zip',()=>{
  zipImportCalls+=1;
  return {ok:true,archive:'KALONEO_200.zip',added:200,duplicates:0,failed:0,total:200,themes:Array.from({length:20},(_,i)=>'Thème '+(i+1))};
});
ipcMain.handle('kaloneo-library:list-mask-screens',()=>({ok:true,maskScreens:[{id:'kaloneo-default',version:'1.0.0',name:'KALONÉO',systemProvided:true,hasText:true,hasImage:false}]}));
ipcMain.handle('kaloneo-library:get-mask-screen',()=>({ok:true,maskScreen:{id:'kaloneo-default',version:'1.0.0',name:'KALONÉO',content:{text:'KALONÉO',image:''}}}));
ipcMain.handle('kaloneo-library:list-parcours',()=>({ok:true,parcours:[]}));
ipcMain.handle('kaloneo-library:save-parcours',()=>({ok:true}));

const timeout=setTimeout(()=>fail('délai global dépassé'),45000);
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));

app.whenReady().then(async()=>{
  const root=path.join(__dirname,'..');
  const web=path.join(root,'app','web');
  protectedOrganisation=JSON.parse(fs.readFileSync(path.join(web,'kaltest','tests','organisation-demenagement','1.0.0','test.json'),'utf8'));
  // Une V2 dérivée du vrai moteur Builder : elle n'a plus organisationList.
  // C'est précisément le format v2.0.0 montré par l'utilisateur.
  organisationV2Fixture=BuilderCore.modelToDefinition(BuilderCore.definitionToModel(protectedOrganisation));
  organisationV2Fixture.version='2.0.0';
  if(!Array.isArray(organisationV2Fixture.presentation?.builderContent)||
     organisationV2Fixture.presentation?.organisationList)
    return fail('Le fixture V2 Organisation ne représente pas le schéma Builder attendu');
  restaurantFixture=JSON.parse(fs.readFileSync(path.join(root,'r48-demo','planning-restaurant-builder-r48.json'),'utf8'));
  genreNombreFixture=JSON.parse(fs.readFileSync(path.join(root,'source','kaltest','tests','genre-nombre','1.0.0','test.json'),'utf8'));
  const builder=path.join(web,'kaloneo-builder','test-builder.html');
  const preview=path.join(web,'kaloneo-builder','test-preview.html');
  // Contrôle de l'absence du checkpoint à 5 secondes sur les pages Builder,
  // sans désactiver la sauvegarde des vrais candidats.
  const preloadSource=fs.readFileSync(path.join(root,'src','preload.js'),'utf8');
  if(!preloadSource.includes('if (!isAdminBilanPage() && !isTestsParcoursWorkspacePage()) {')||
     !preloadSource.includes('const SAVE_CHECKPOINT_MS = 5000;'))
    return fail('Checkpoint de sauvegarde candidat encore actif dans le Builder');
  if(!fs.existsSync(builder)||!fs.existsSync(preview)) return fail('Builder ou page aperçu absent de app/web');

  ipcMain.handle('kaloneo-builder:open-preview',async(_event,definition,editorHistory)=>{
    previewDefinition=JSON.parse(JSON.stringify(definition||{}));
    previewEditorHistory=editorHistory||null;
    await win.loadFile(preview);
    return {ok:true};
  });
  ipcMain.handle('kaloneo-builder:get-preview',()=>previewDefinition?{ok:true,definition:previewDefinition}:{ok:false,error:'absent'});
  ipcMain.handle('kaloneo-builder:consume-preview',()=>{
    if(!previewDefinition)return {ok:false,error:'absent'};
    const definition=JSON.parse(JSON.stringify(previewDefinition));
    const editorHistory=previewEditorHistory;
    previewDefinition=null;
    previewEditorHistory=null;
    return {ok:true,definition,editorHistory};
  });
  ipcMain.handle('kaloneo-builder:close-preview',async()=>{
    await win.loadFile(builder,{query:{resume:'preview'}});
    return true;
  });

  win=new BrowserWindow({
    show:false,width:1366,height:768,
    webPreferences:{
      preload:path.join(root,'src','preload.js'),
      contextIsolation:true,nodeIntegration:false,sandbox:false
    }
  });
  win.webContents.on('preload-error',(_event,badPath,error)=>fail('erreur preload '+String(badPath||''),{error:String(error&&error.stack||error)}));

  try{
    await win.loadFile(builder);
    await wait(900);

    // Contrôle d'un test inédit : aucun ID/catalogue/fixture particulier.
    // Vérifier le moteur commun de colonnes et la structure Q/R partagée.
    const unknownTest=await win.webContents.executeJavaScript(`(()=>{
      const shared=window.KaloneoSharedPresentation;
      if(!shared)return {ok:false,reason:'Moteur partagé non chargé'};
      const host=document.createElement('div');
      host.className='preview-exercise layout-50-50';
      host.style.cssText='width:1180px;height:560px;position:fixed;left:-2000px;top:0;';
      document.body.appendChild(host);
      const futureDefinition={
        id:'nouveau_test_sans_code_particulier_2027',
        questions:Array.from({length:8},(_,i)=>({id:'inedite_'+i,prompt:'Question inédite '+(i+1)}))
      };
      const items=[
        {type:'image',zone:'left',alt:'Illustration libre'},
        ...futureDefinition.questions.map(q=>({type:'question',zone:'right',question:q}))
      ];
      const zones=shared.renderZones({
        host,items,layout:'50-50',zoneClass:'preview-zone',
        renderItem:item=>item.type==='question'?
          shared.renderQuestion({
            doc:document,question:item.question,className:'preview-question',
            makeAnswer:()=>{const input=document.createElement('input');input.type='text';return input;}
          }):
          Object.assign(document.createElement('div'),{textContent:item.alt})
      });
      const rows=[...zones.right.querySelectorAll('.kaloneo-shared-question')];
      const inputs=rows.map(row=>row.querySelector('input'));
      const aligned=rows.every((row,i)=>{
        const cap=row.querySelector('span')?.getBoundingClientRect();
        const inp=inputs[i]?.getBoundingClientRect();
        return cap&&inp&&inp.left>=cap.right-1;
      });
      const result={
        id:futureDefinition.id,count:rows.length,
        inputs:inputs.filter(Boolean).length,aligned,
        columns:host.style.gridTemplateColumns,
        otherZone:zones.left.textContent.includes('Illustration libre'),
        single:shared.columns('single'),
        unequal:shared.columns('40-60'),
        sizing:shared.columns('chars-rest',{blocks:[{widthChars:38},{remainder:true}]}),
        fromRealCandidateScript:Boolean(shared.renderQuestion)
      };
      host.remove();
      return result;
    })()`,true);
    if(unknownTest.count!==8||unknownTest.inputs!==8||!unknownTest.aligned||
       !unknownTest.otherZone||!unknownTest.columns.includes('1fr')||
       unknownTest.single!=='minmax(0,1fr)'||
       unknownTest.unequal!=='minmax(0,40fr) minmax(0,60fr)'||
       unknownTest.sizing!=='38ch minmax(0,1fr)')
      return fail('Moteur commun : un test inédit ne se rend pas indépendamment de son ID',unknownTest);
    console.log('KALONEO_SHARED_RENDERER_UNKNOWN_TEST_EIGHT_QUESTIONS=OK',JSON.stringify(unknownTest));
    const novelMedia=await win.webContents.executeJavaScript(`(()=>{
      const shared=window.KaloneoSharedPresentation;
      const media=shared.renderMedia({
        doc:document,type:'image',
        resource:{data:'data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22/%3E',alt:'Image libre'},
        style:{imageScale:55,imageAlign:'right'},
        className:'preview-media-block',imageClass:'preview-media'
      });
      const img=media.querySelector('img');
      const sound=shared.renderMedia({doc:document,type:'audio',resource:{data:'data:audio/wav;base64,AAA='}});
      const empty=shared.renderMedia({doc:document,type:'video',resource:{},emptyText:'Vidéo à importer'});
      return {
        image:img?.src?.startsWith('data:image/svg+xml,'),
        scale:img?.style.width,
        alignment:media.style.justifyContent,
        alt:img?.alt,
        audio:sound.querySelector('audio')?.controls===true,
        missing:empty.textContent
      };
    })()`,true);
    if(!novelMedia.image||novelMedia.scale!=='55%'||
       novelMedia.alignment!=='flex-end'||novelMedia.alt!=='Image libre'||
       !novelMedia.audio||novelMedia.missing!=='Vidéo à importer')
      return fail('Moteur commun : média d’un test inédit non rendu',novelMedia);
    console.log('KALONEO_SHARED_RENDERER_UNKNOWN_TEST_MEDIA=OK',JSON.stringify(novelMedia));
    const novelGrid=await win.webContents.executeJavaScript(`(()=>{
      const shared=window.KaloneoSharedPresentation;
      const arbitrary={title:'Tableau futur',cols:5,headers:['A','B','C','D','E'],
        cells:[Array.from({length:5},()=>({kind:'candidate-answer'}))]};
      const count=shared.equalAutomaticColumns(arbitrary);
      const table=document.createElement('table');
      shared.addEqualColGroup(table,count);
      const cell=document.createElement('td');
      shared.applyColumn(cell,{widthChars:16,align:'right'});
      const hasSpan=shared.equalAutomaticColumns({
        cols:3,cells:[[{kind:'fixed-text',colSpan:2},{kind:'fixed-text'}]]
      });
      const fixedWidth=shared.equalAutomaticColumns({
        cols:3,columns:[{widthChars:12}],cells:[]
      });
      return {
        count,cols:table.querySelectorAll('col').length,
        colWidth:table.querySelector('col')?.style.width,
        width:cell.style.width,align:cell.style.textAlign,
        hasSpan,fixedWidth
      };
    })()`,true);
    if(novelGrid.count!==5||novelGrid.cols!==5||novelGrid.colWidth!=='20%'||
       novelGrid.width!=='16ch'||novelGrid.align!=='right'||
       novelGrid.hasSpan!==0||novelGrid.fixedWidth!==0)
      return fail('Moteur commun : règles d’un tableau inédit non respectées',novelGrid);
    console.log('KALONEO_SHARED_RENDERER_UNKNOWN_TEST_GRID=OK',JSON.stringify(novelGrid));
    const futureInline=await win.webContents.executeJavaScript(`(()=>{
      const shared=window.KaloneoSharedPresentation;
      const doc=document;
      const parts=[
        {type:'text',text:'Le futur ',breakAfterSentence:false},
        {type:'question',questionId:'new_question_a'},
        {type:'text',text:' se prépare.',breakAfterSentence:true},
        {type:'question',questionId:'new_question_b'}
      ];
      const opts={doc,wordBank:['futur','stage','atelier'],
        flow:parts,makeAnswer:(id)=>{
          const input=doc.createElement('input');input.dataset.questionId=id;return input;
        }};
      const candidate=shared.renderInlineFlow({...opts,className:'kaltest-inline-work',
        bankClass:'kaltest-word-bank',flowClass:'kaltest-inline-flow'});
      const builder=shared.renderInlineFlow({...opts,className:'preview-inline-flow',
        bankClass:'preview-word-bank'});
      const summary=(el)=>({
        words:[...el.querySelectorAll('.kaloneo-shared-word-bank span')].map(x=>x.textContent),
        inputs:[...el.querySelectorAll('input')].map(x=>x.dataset.questionId),
        br:el.querySelectorAll('br').length,
        text:el.querySelector('.kaloneo-shared-flow-content')?.textContent,
        layers:el.children.length
      });
      return {candidate:summary(candidate),builder:summary(builder),
        classNames:[candidate.className,builder.className]};
    })()`,true);
    if(JSON.stringify(futureInline.candidate)!==JSON.stringify(futureInline.builder)||
       futureInline.candidate.words.join('|')!=='futur|stage|atelier'||
       futureInline.candidate.inputs.join('|')!=='new_question_a|new_question_b'||
       futureInline.candidate.br!==2||
       futureInline.candidate.text!=='Le futur  se prépare.'||
       futureInline.candidate.layers!==2)
      return fail('Moteur commun : flux à trous d’un test inédit incohérent',futureInline);
    console.log('KALONEO_SHARED_RENDERER_UNKNOWN_TEST_INLINE_FLOW=OK',JSON.stringify(futureInline));
    const futureResponseTable=await win.webContents.executeJavaScript(`(()=>{
      const shared=window.KaloneoSharedPresentation;
      const rows=Array.from({length:8},(_,i)=>({id:'future_question_'+(i+1)}));
      const headers=['N°','Réponse','Unité','Justification'];
      const options={
        doc:document,headers,columns:[{widthChars:6},null,{align:'center'},null],rows,
        renderCell:({cell,row,rowIndex,colIndex})=>{
          if(colIndex===0){cell.textContent=String(rowIndex+1);return;}
          const input=document.createElement('input');
          input.dataset.questionId=row.id;
          input.dataset.col=String(colIndex);
          cell.appendChild(input);
        }
      };
      const editor=shared.renderResponseTable({...options,
        className:'preview-grid-table',wrapperClassName:'preview-grid-wrap'});
      const candidate=shared.renderResponseTable({...options,
        className:'kaltest-table',wrapperClassName:'kaltest-table-wrap'});
      const extract=el=>({
        headers:[...el.querySelectorAll('thead th')].map(x=>x.textContent),
        rows:el.querySelectorAll('tbody tr').length,
        cells:[...el.querySelectorAll('tbody tr')].map(x=>x.cells.length),
        inputs:el.querySelectorAll('tbody input').length,
        first:el.querySelector('tbody tr td')?.textContent,
        last:el.querySelector('tbody tr:last-child td')?.textContent,
        width:el.querySelector('thead th')?.style.width,
        alignment:el.querySelector('thead th:nth-child(3)')?.style.textAlign
      });
      return {editor:extract(editor),candidate:extract(candidate)};
    })()`,true);
    if(JSON.stringify(futureResponseTable.editor)!==JSON.stringify(futureResponseTable.candidate)||
       futureResponseTable.editor.headers.length!==4||
       futureResponseTable.editor.rows!==8||
       futureResponseTable.editor.cells.some(n=>n!==4)||
       futureResponseTable.editor.inputs!==24||
       futureResponseTable.editor.first!=='1'||
       futureResponseTable.editor.last!=='8'||
       futureResponseTable.editor.width!=='6ch'||
       futureResponseTable.editor.alignment!=='center')
      return fail('Tableau de réponses générique : rendu du test inédit incorrect',futureResponseTable);
    console.log('KALONEO_SHARED_RENDERER_UNKNOWN_TEST_RESPONSE_TABLE=OK',JSON.stringify(futureResponseTable));
    const futureFreeGrid=await win.webContents.executeJavaScript(`(()=>{
      const shared=window.KaloneoSharedPresentation;
      const definition={
        title:'Grille future créée demain',compact:true,cols:3,
        headers:['Nom','Réponse','Options'],
        columns:[{widthChars:15},null,{align:'center'}],
        cells:[
          [{kind:'fixed-text',value:'Ligne A',rowSpan:2},
           {kind:'candidate-answer',questionId:'nouv1'},
           {kind:'choice-option',value:'Oui'}],
          [{kind:'select',questionId:'nouv2'},
           {kind:'fixed-text',value:'Fusion',colSpan:2}]
        ]
      };
      const cells=[];
      const renderCell=({cell,cellDefinition,rowIndex,colIndex})=>{
        cells.push({rowIndex,colIndex,kind:cellDefinition.kind});
        cell.textContent=String(cellDefinition.value||cellDefinition.kind);
      };
      const b=shared.renderGridTable({doc:document,definition,renderCell,
        className:'preview-grid-table',wrapperClassName:'preview-grid-wrap'});
      const c=shared.renderGridTable({doc:document,definition,renderCell,
        className:'kaltest-table kaltest-builder-grid',wrapperClassName:'kaltest-table-wrap',
        compactClassName:'kaltest-builder-grid-compact'});
      const extract=x=>({
        header:[...x.querySelectorAll('th')].map(h=>h.textContent),
        rowCount:x.querySelectorAll('tbody tr').length,
        cellCount:x.querySelectorAll('tbody td').length,
        rowSpan:x.querySelector('tbody tr:first-child td')?.rowSpan,
        colSpan:x.querySelector('tbody tr:last-child td:last-child')?.colSpan,
        title:x.querySelector('h3')?.textContent,
        width:x.querySelector('thead th:first-child')?.style.width,
        align:x.querySelector('thead th:last-child')?.style.textAlign
      });
      const transparent=shared.renderGridTable({doc:document,
        definition:{layoutOnly:true,cells:[[{kind:'fixed-text',value:'Simple'}]]},
        renderCell});
      return {
        builder:extract(b),candidate:extract(c),
        compact:c.querySelector('table')?.classList.contains('kaltest-builder-grid-compact'),
        transparent:transparent.querySelector('table')?.classList.contains('kaloneo-layout-only'),
        noEquals:b.querySelectorAll('col').length===0,
        calls:cells.length
      };
    })()`,true);
    if(JSON.stringify(futureFreeGrid.builder)!==JSON.stringify(futureFreeGrid.candidate)||
       futureFreeGrid.builder.rowCount!==2||futureFreeGrid.builder.cellCount!==5||
       futureFreeGrid.builder.rowSpan!==2||futureFreeGrid.builder.colSpan!==2||
       futureFreeGrid.builder.width!=='15ch'||futureFreeGrid.builder.align!=='center'||
       futureFreeGrid.builder.title!=='Grille future créée demain'||
       !futureFreeGrid.compact||!futureFreeGrid.transparent||!futureFreeGrid.noEquals||
       futureFreeGrid.calls!==11)
      return fail('Grille libre future : moteur partagé incompatible',futureFreeGrid);
    console.log('KALONEO_SHARED_RENDERER_UNKNOWN_TEST_FREE_GRID=OK',JSON.stringify(futureFreeGrid));




    const initial=await win.webContents.executeJavaScript(`(()=>{
      const title=document.getElementById('test-title');
      const editor=document.querySelector('.builder-editor');
      return {
        title:title?.value||'',
        titleDisabled:!!title?.disabled,
        titleReadOnly:!!title?.readOnly,
        activeId:document.activeElement?.id||'',
        bodyOverflow:getComputedStyle(document.body).overflowY,
        editorOverflow:getComputedStyle(editor).overflowY,
        pageScroll:document.documentElement.scrollHeight>window.innerHeight+2,
        editorCanScroll:editor.scrollHeight>=editor.clientHeight
      };
    })()`);
    if(initial.title!==''||initial.titleDisabled||initial.titleReadOnly||initial.activeId!=='test-title'||
       initial.bodyOverflow!=='hidden'||!['auto','scroll'].includes(initial.editorOverflow)||initial.pageScroll) {
      return fail('entrée R3 du Builder incorrecte',initial);
    }

    const newTest=await win.webContents.executeJavaScript(`(()=>{
      window.confirm=()=>true;
      const title=document.getElementById('test-title');
      title.value='Ancien brouillon';
      title.dispatchEvent(new Event('input',{bubbles:true}));
      document.getElementById('new-test').click();
      return new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>{
        const current=document.getElementById('test-title');
        current.value='Saisie immédiate';
        current.dispatchEvent(new Event('input',{bubbles:true}));
        resolve({
          value:current.value,
          disabled:current.disabled,
          readOnly:current.readOnly,
          activeId:document.activeElement?.id||''
        });
      })));
    })()`);
    if(newTest.value!=='Saisie immédiate'||newTest.disabled||newTest.readOnly||newTest.activeId!=='test-title') {
      return fail('Nouveau test non saisissable immédiatement',newTest);
    }

    const history=await win.webContents.executeJavaScript(`(async()=>{
      await new Promise(resolve=>setTimeout(resolve,450));
      const undo=document.getElementById('undo-change');
      const redo=document.getElementById('redo-change');
      const before={undoDisabled:undo.disabled,redoDisabled:redo.disabled,value:document.getElementById('test-title').value};
      undo.click();
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      const afterUndo={value:document.getElementById('test-title').value,undoDisabled:undo.disabled,redoDisabled:redo.disabled};
      redo.click();
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      const afterRedo={value:document.getElementById('test-title').value,undoDisabled:undo.disabled,redoDisabled:redo.disabled};
      return {before,afterUndo,afterRedo};
    })()`);
    if(history.before.undoDisabled||!history.before.redoDisabled||history.before.value!=='Saisie immédiate'||
       history.afterUndo.value!==''||!history.afterUndo.undoDisabled||history.afterUndo.redoDisabled||
       history.afterRedo.value!=='Saisie immédiate'||history.afterRedo.undoDisabled||!history.afterRedo.redoDisabled){
      return fail('Annuler / Rétablir du Builder incorrect',history);
    }
    // Audit P0 : une modification uniquement de disposition doit être
    // sauvegardée et annulable, sans double traitement input/change.
    const layoutOnly=await win.webContents.executeJavaScript(`(()=>{
      const layout=document.getElementById('test-layout');
      const before=layout.value;
      layout.value='50-50';
      layout.dispatchEvent(new Event('change',{bubbles:true}));
      const draft=JSON.parse(localStorage.getItem('kaloneo_test_builder_v2')||'null');
      const dirty=String(document.getElementById('draft-status')?.textContent||'');
      document.getElementById('undo-change').click();
      const undone=layout.value;
      document.getElementById('redo-change').click();
      const redone=layout.value;
      layout.value=before;
      layout.dispatchEvent(new Event('change',{bubbles:true}));
      return {before,draft:draft?.meta?.layout,dirty,undone,redone,reset:layout.value};
    })()`);
    if(layoutOnly.before!=='single'||layoutOnly.draft!=='50-50'||
       !/Modifications non enregistrées/.test(layoutOnly.dirty)||
       layoutOnly.undone!=='single'||layoutOnly.redone!=='50-50'||layoutOnly.reset!=='single'){
      return fail('Audit P0 : disposition seule non conservée dans le brouillon et l’historique',layoutOnly);
    }
    console.log('KALONEO_BUILDER_LAYOUT_DRAFT_UNDO_P0=OK');

    // Vérifier une frappe immédiatement visible, sans overlay ni capture Electron.
    const miniBeforeTyping=miniRenderCalls;
    const liveTyping=await win.webContents.executeJavaScript(`(async()=>{
      const block=document.querySelector('.exercise-block');
      if(block?.classList.contains('is-collapsed')){
        block.querySelector('.toggle-block').click();
      }
      const field=document.querySelector('.exercise-block .block-body textarea');
      if(!field)return {ok:false,reason:'Champ de texte initial absent'};
      field.focus();
      field.value='Texte mis à jour instantanément';
      field.setSelectionRange(field.value.length,field.value.length);
      field.dispatchEvent(new Event('input',{bubbles:true}));
      await new Promise(resolve=>setTimeout(resolve,100));
      const content=document.getElementById('preview-exercise');
      const page=document.getElementById('candidate-preview');
      const overlay=document.getElementById('candidate-preview-status');
      const snapshot=document.getElementById('candidate-preview-snapshot');
      return {
        ok:true,
        displayed:content?.textContent.includes('Texte mis à jour instantanément'),
        previewText:String(content?.textContent||'').slice(0,220),
        previewBlockCount:content?.querySelectorAll('[data-preview-uid]').length||0,
        visible:getComputedStyle(page).visibility==='visible',
        noBlueOverlay:getComputedStyle(overlay).display==='none',
        oldCaptureHidden:snapshot.hidden,
        cursorStable:document.activeElement===field&&field.isConnected&&field.selectionStart===field.value.length
      };
    })()`,true);
    if(!liveTyping.ok||!liveTyping.displayed||!liveTyping.visible||!liveTyping.noBlueOverlay||
       !liveTyping.oldCaptureHidden||!liveTyping.cursorStable||miniRenderCalls!==miniBeforeTyping){
      return fail('Aperçu direct pendant la frappe ou stabilité du curseur incorrect', {
        liveTyping,capturesBefore:miniBeforeTyping,capturesAfter:miniRenderCalls
      });
    }
    console.log('KALONEO_BUILDER_LIVE_TYPING_NO_BLUE_SCREEN=OK',JSON.stringify(liveTyping));
    // Une saisie affiche immédiatement le DOM; l'image réelle apparaît
    // seulement après une pause et disparaît à la prochaine frappe.
    const idleRealPreview=await win.webContents.executeJavaScript(`(async()=>{
      const snapshot=document.getElementById('candidate-preview-snapshot');
      await new Promise(resolve=>setTimeout(resolve,2100));
      const before={
        visible:!snapshot.hidden,hasImage:snapshot.src.startsWith('data:image/'),
        warning:document.getElementById('candidate-preview-warning')?.textContent||'',
        directVisible:getComputedStyle(document.getElementById('candidate-preview')).visibility==='visible'
      };
      const field=document.querySelector('.exercise-block .block-body textarea');
      if(!field)return {before,fieldMissing:true};
      field.focus();field.value+=' Modification suivante';
      field.dispatchEvent(new Event('input',{bubbles:true}));
      return {before,hiddenImmediately:snapshot.hidden,
        focused:document.activeElement===field,
        updated:document.getElementById('preview-exercise')?.textContent.includes('Modification suivante')};
    })()`,true);
    if(!idleRealPreview.before.visible||!idleRealPreview.before.hasImage||
       !idleRealPreview.before.directVisible||
       !/Rendu réel candidat/.test(idleRealPreview.before.warning)||
       !idleRealPreview.hiddenImmediately||!idleRealPreview.focused||
       !idleRealPreview.updated||miniRenderCalls<=miniBeforeTyping)
      return fail('Capture fidèle inactive ou perte de focus dans le Builder',idleRealPreview);
    console.log('KALONEO_BUILDER_REAL_AFTER_IDLE_STABLE_FOCUS=OK');
    const inputUndo=await win.webContents.executeJavaScript(`(()=>{
      const input=document.getElementById('test-title');
      input.focus();
      const e=new KeyboardEvent('keydown',{key:'z',ctrlKey:true,bubbles:true,cancelable:true});
      input.dispatchEvent(e);
      const ownNotBlocked=!e.defaultPrevented;
      const global=new KeyboardEvent('keydown',{key:'z',ctrlKey:true,bubbles:true,cancelable:true});
      document.dispatchEvent(global);
      return {ownNotBlocked,globalHandled:global.defaultPrevented};
    })()`);
    if(!inputUndo.ownNotBlocked||!inputUndo.globalHandled)
      return fail('Audit P2 : Ctrl+Z doit rester natif dans les champs',inputUndo);
    console.log('KALONEO_BUILDER_NATIVE_FIELD_UNDO=OK');

    // Audit A4 : simuler un stockage plein, vérifier l'alerte visible et
    // la reprise normale lorsque le stockage redevient accessible.
    const quotaFailure=await win.webContents.executeJavaScript(`(async()=>{
      const original=Storage.prototype.setItem;
      const title=document.getElementById('test-title');
      Storage.prototype.setItem=function(key,value){
        if(key==='kaloneo_test_builder_v2')
          throw new DOMException('Stockage plein (simulation)','QuotaExceededError');
        return original.call(this,key,value);
      };
      try{
        title.focus();
        title.value='Essai quota local';
        title.dispatchEvent(new Event('input',{bubbles:true}));
        await new Promise(resolve=>setTimeout(resolve,470));
        const notice=String(document.getElementById('draft-status')?.textContent||'');
        const editable=title.isConnected&&!title.disabled;
        return {notice,editable};
      }finally{Storage.prototype.setItem=original;}
    })()`,true);
    if(!/Brouillon non sauvegardé/i.test(quotaFailure.notice)||!quotaFailure.editable)
      return fail('Audit A4 : erreur de quota du brouillon non signalée',quotaFailure);
    const quotaRecovery=await win.webContents.executeJavaScript(`(async()=>{
      const title=document.getElementById('test-title');
      title.value='Saisie immédiate';
      title.dispatchEvent(new Event('input',{bubbles:true}));
      await new Promise(resolve=>setTimeout(resolve,470));
      return {
        notice:String(document.getElementById('draft-status')?.textContent||''),
        saved:JSON.parse(localStorage.getItem('kaloneo_test_builder_v2')||'null')?.meta?.title
      };
    })()`,true);
    if(/Brouillon non sauvegardé/i.test(quotaRecovery.notice)||
       quotaRecovery.saved!=='Saisie immédiate')
      return fail('Audit A4 : impossible de reprendre la sauvegarde du brouillon',quotaRecovery);
    console.log('KALONEO_BUILDER_DRAFT_QUOTA_RECOVERY=OK');



    const foldBehavior=await win.webContents.executeJavaScript(`(async()=>{
      const add=document.getElementById('add-block');
      add.click();add.click();
      let blocks=[...document.querySelectorAll('.exercise-block')];
      if(blocks.length!==3)return {ok:false,error:'Trois blocs attendus'};
      const second=blocks[1];
      second.querySelector('.block-type').value='question';
      second.querySelector('.block-type').dispatchEvent(new Event('change',{bubbles:true}));
      blocks=[...document.querySelectorAll('.exercise-block')];
      const target=blocks[1],uid=target.dataset.uid;
      const input=target.querySelector('.block-body textarea');
      if(!input)return {ok:false,error:'Question sans zone de saisie'};
      input.value='Question conservée quand le bloc est réduit';
      input.dispatchEvent(new Event('input',{bubbles:true}));
      const before=target.getBoundingClientRect().height;
      const toggle=target.querySelector('.toggle-block');
      toggle.click();
      const collapsed=target.getBoundingClientRect().height;
      const hidden=target.querySelector('.block-body').hidden;
      const expectedHeader=target.querySelector('.block-header').getBoundingClientRect().height;
      const headerFits=target.querySelector('.block-header').scrollWidth<=target.querySelector('.block-header').clientWidth+2;
      const buttons=[...target.querySelectorAll('.block-header>button')];
      const correctOrder=buttons.at(-2)?.classList.contains('remove-block')&&buttons.at(-1)?.classList.contains('toggle-block');
      const zoneControl=target.querySelector('.block-zone');
      const zoneWidth=Math.round(zoneControl.getBoundingClientRect().width);
      const zoneVisible=zoneWidth>=85&&getComputedStyle(zoneControl).display!=='none';
      const singleZone=zoneControl.disabled&&zoneControl.value==='single'&&zoneControl.selectedOptions[0]?.textContent==='Zone unique';
      const elements=[...target.querySelector('.block-header').children];
      const rects=elements.map(element=>element.getBoundingClientRect());
      const headerAligned=rects.every((r,i)=>r.width>0&&r.height>0&&
        (i===0||r.left>=rects[i-1].right-1)&&
        Math.abs((r.top+r.bottom)/2-(rects[0].top+rects[0].bottom)/2)<5);
      const remove=target.querySelector('.remove-block');
      const removeNotWrapped=remove.getBoundingClientRect().height<=36&&
        remove.scrollHeight<=remove.clientHeight+1&&
        getComputedStyle(remove).whiteSpace==='nowrap';
      const undo=document.getElementById('undo-change');
      const canUndo=!undo.disabled;
      // Changer l'ordre doit préserver l'état réduit du même bloc (UID stable).
      target.querySelector('.move-down').click();
      const moved=[...document.querySelectorAll('.exercise-block')][2];
      const moveKeptFold=moved.dataset.uid===uid&&moved.classList.contains('is-collapsed')&&moved.querySelector('.block-body').hidden;
      const movedButton=moved.querySelector('.toggle-block');
      movedButton.click();
      const expanded=moved.getBoundingClientRect().height;
      const preserved=moved.querySelector('.block-body textarea')?.value==='Question conservée quand le bloc est réduit';
      const ariaRestored=movedButton.getAttribute('aria-expanded')==='true'&&!moved.querySelector('.block-body').hidden;
      // Le choix de zone doit rester actif en deux colonnes et retrouver
      // sa valeur lorsque l'on repasse de une à deux colonnes.
      const layout=document.getElementById('test-layout');
      layout.value='50-50';
      layout.dispatchEvent(new Event('change',{bubbles:true}));
      const splitBlock=[...document.querySelectorAll('.exercise-block')].find(x=>x.dataset.uid===uid);
      const splitZone=splitBlock?.querySelector('.block-zone');
      const splitZoneVisible=!!splitZone&&!splitZone.disabled&&
        splitZone.getBoundingClientRect().width>=85&&splitZone.value==='left';
      if(splitZoneVisible){
        splitZone.value='right';
        splitZone.dispatchEvent(new Event('change',{bubbles:true}));
      }
      layout.value='single';
      layout.dispatchEvent(new Event('change',{bubbles:true}));
      const singleAgain=[...document.querySelectorAll('.exercise-block')].find(x=>x.dataset.uid===uid);
      const singleAgainZone=singleAgain?.querySelector('.block-zone');
      const uniqueZoneRestored=singleAgainZone?.disabled&&singleAgainZone.value==='single';
      layout.value='50-50';
      layout.dispatchEvent(new Event('change',{bubbles:true}));
      const splitAgain=[...document.querySelectorAll('.exercise-block')].find(x=>x.dataset.uid===uid);
      const selectedZonePreserved=splitAgain?.querySelector('.block-zone')?.value==='right';
      document.getElementById('new-test').click();
      return {
        ok:true,before,collapsed,expectedHeader,expanded,hidden,headerFits,correctOrder,
        zoneWidth,zoneVisible,singleZone,headerAligned,removeNotWrapped,
        splitZoneVisible,uniqueZoneRestored,selectedZonePreserved,
        canUndo,moveKeptFold,preserved,ariaRestored,
        newTestHasOneBlock:document.querySelectorAll('.exercise-block').length===1
      };
    })()`,true);
    if(!foldBehavior.ok||!foldBehavior.hidden||!foldBehavior.headerFits||!foldBehavior.correctOrder||
       !foldBehavior.moveKeptFold||!foldBehavior.preserved||!foldBehavior.ariaRestored||
       !foldBehavior.newTestHasOneBlock||!foldBehavior.zoneVisible||!foldBehavior.singleZone||
       !foldBehavior.headerAligned||!foldBehavior.removeNotWrapped||
       !foldBehavior.splitZoneVisible||!foldBehavior.uniqueZoneRestored||!foldBehavior.selectedZonePreserved||
       foldBehavior.zoneWidth>118||
       foldBehavior.before-foldBehavior.collapsed<125||
       Math.abs(foldBehavior.collapsed-foldBehavior.expectedHeader)>36||
       foldBehavior.expanded<foldBehavior.collapsed+125) {
      return fail('Réduction / déploiement des blocs : contenu, ordre ou dimensions incorrects',foldBehavior);
    }
    console.log('KALONEO_BLOCK_COLLAPSE_EXPAND_ELECTRON=OK',JSON.stringify(foldBehavior));

    const sectionCompact=await win.webContents.executeJavaScript(`(async()=>{
      const iconButton=document.getElementById('toggle-icon-library');
      const iconBody=document.getElementById('icon-library-content');
      const contractButton=document.getElementById('toggle-contract-section');
      const contractBody=document.getElementById('contract-section-content');
      if(!iconButton||!contractButton||!iconBody||!contractBody)return {ok:false,error:'Boutons de repli des sections absents'};
      const iconCount=document.querySelectorAll('#icon-picker .icon-choice').length;
      const outputsBefore=document.querySelectorAll('#outputs-editor .contract-item').length;
      const pageStyleButton=document.getElementById('toggle-page-style');
      const pageStyleBody=document.getElementById('page-style-content');
      const validationButton=document.getElementById('toggle-validation-section');
      const validationBody=document.getElementById('validation-content');
      const validationBox=document.querySelector('.validation-box');
      const folded=iconBody.hidden&&contractBody.hidden&&pageStyleBody?.hidden&&validationBody?.hidden&&
        iconButton.getAttribute('aria-expanded')==='false'&&
        contractButton.getAttribute('aria-expanded')==='false'&&
        pageStyleButton?.getAttribute('aria-expanded')==='false'&&
        validationButton?.getAttribute('aria-expanded')==='false';
      const noDuplicateIconButton=!document.getElementById('jump-to-icon-picker');
      const noV1Status=!document.getElementById('developer-mode-status');
      const developer=document.getElementById('developer-unlock');
      const cleanDevLabel=developer?.textContent.trim()==='Mode Développeur';
      const modelSelect=document.getElementById('test-template');
      const devInline=!!developer&&!!modelSelect&&
        Math.abs(developer.getBoundingClientRect().top-modelSelect.getBoundingClientRect().top)<14;
      const scenario=document.getElementById('test-scenario');
      const instruction=document.getElementById('test-instruction');
      const capIds=['calculator-compatible','chrono-enabled','admin-intervention',
        'autoevaluation-enabled','external-material'];
      const caps=capIds.map(id=>document.getElementById(id));
      const scenarioHiddenWhenFolded=scenario.getClientRects().length===0&&instruction.getClientRects().length===0;
      const allCapabilitiesHiddenWhenFolded=caps.every(el=>el?.getClientRects().length===0);
      const firstCapabilityState=caps.map(el=>el?.checked);
      pageStyleButton.click();
      const pageStyleOpens=!pageStyleBody.hidden&&pageStyleButton.getAttribute('aria-expanded')==='true'&&
        scenario.getClientRects().length>0&&instruction.getClientRects().length>0;
      const allCapabilitiesVisibleOnOpen=caps.every(el=>el?.getClientRects().length>0);
      pageStyleButton.click();
      const scenarioHiddenAgain=scenario.getClientRects().length===0&&instruction.getClientRects().length===0;
      const capabilitiesHiddenAgain=caps.every(el=>el?.getClientRects().length===0);
      const capabilitiesValuesRetained=caps.every((el,i)=>el.checked===firstCapabilityState[i]);
      validationButton.click();
      const validationOpens=!validationBody.hidden&&validationButton.getAttribute('aria-expanded')==='true';
      validationButton.click();
      // Un test ouvert incomplet doit être rouge. Les contrôles ne
      // deviennent verts qu'après remplissage de tous les champs requis.
      const initialRed=validationBox.dataset.validationStatus==='error';
      const title=document.getElementById('test-title');
      const savedTitle=title.value;
      title.value='Contrôle Builder valide';title.dispatchEvent(new Event('input',{bubbles:true}));
      scenario.value='Contexte de travail';scenario.dispatchEvent(new Event('input',{bubbles:true}));
      instruction.value='Effectuer une tâche';instruction.dispatchEvent(new Event('input',{bubbles:true}));
      await new Promise(resolve=>setTimeout(resolve,520));
      const green=validationBox.dataset.validationStatus==='ok';
      const titleColorGreen=getComputedStyle(document.getElementById('validation-heading')).color;
      const titleIsGreen=/25,[ ]*135,[ ]*84/.test(titleColorGreen);
      // Supprimer le titre rend ce même test rouge.
      title.value='';title.dispatchEvent(new Event('input',{bubbles:true}));
      await new Promise(resolve=>setTimeout(resolve,520));
      const red=validationBox.dataset.validationStatus==='error';
      const titleColorRed=getComputedStyle(document.getElementById('validation-heading')).color;
      const titleIsRed=/198,[ ]*40,[ ]*40/.test(titleColorRed);
      title.value=savedTitle;title.dispatchEvent(new Event('input',{bubbles:true}));
      await new Promise(resolve=>setTimeout(resolve,520));
      const stillPresent=iconCount===document.querySelectorAll('#icon-picker .icon-choice').length&&
        outputsBefore===document.querySelectorAll('#outputs-editor .contract-item').length;
      // La bibliothèque d’icônes est accessible directement dans sa section.
      iconButton.click();
      const jumpedOpen=!iconBody.hidden&&iconButton.getAttribute('aria-expanded')==='true';
      // L'ajout d'une sortie ouvre Sorties et Bilan sans perdre les précédentes.
      document.getElementById('add-output').click();
      const outputOpened=!contractBody.hidden&&contractButton.getAttribute('aria-expanded')==='true';
      const outputAdded=document.querySelectorAll('#outputs-editor .contract-item').length===outputsBefore+1;
      document.getElementById('new-test').click();
      const allExpanded=iconBody.hidden&&contractBody.hidden&&
        pageStyleBody.hidden&&validationBody.hidden;
      const first=document.querySelector('.exercise-block');
      const type=first?.querySelector('.block-type');
      if(type){type.value='multiple-tables';type.dispatchEvent(new Event('change',{bubbles:true}));}
      const header=document.querySelector('.exercise-block .block-header');
      const typeField=header?.querySelector('.block-type');
      const zone=header?.querySelector('.block-zone');
      const remove=header?.querySelector('.remove-block');
      const size=element=>Math.round(element?.getBoundingClientRect().width||0);
      const font=element=>Math.round(parseFloat(getComputedStyle(element).fontSize)||0);
      const rects=[...header?.children||[]].map(n=>n.getBoundingClientRect());
      const order=rects.every((r,i)=>r.width>0&&(i===0||r.left>=rects[i-1].right-1));
      const widthFits=header.scrollWidth<=header.clientWidth+2;
      const controls=[iconButton,contractButton,pageStyleButton,validationButton,
        document.querySelector('.exercise-block .toggle-block')];
      const foldMeasurements=controls.map(button=>({
        text:button.textContent.trim(),
        width:Math.round(button.getBoundingClientRect().width),
        height:Math.round(button.getBoundingClientRect().height),
        bg:getComputedStyle(button).backgroundColor,
        fg:getComputedStyle(button).color
      }));
      const blueUniform=foldMeasurements.every(item=>
        item.width===34&&item.height===34&&
        item.bg==='rgb(0, 78, 112)'&&item.fg==='rgb(255, 255, 255)');
      const foldRightEdges=controls.map(button=>
        Math.round(button.getBoundingClientRect().right));
      const foldedButtonsAligned=foldRightEdges.every(value=>
        Math.abs(value-foldRightEdges[1])<=2);
      const blockToggle=document.querySelector('.exercise-block .toggle-block');
      const plusWhenClosed=blockToggle?.textContent.trim()==='+';
      blockToggle?.click();
      const minusWhenOpened=blockToggle?.textContent.trim()==='−';
      blockToggle?.click();
      const values={ok:true,folded,stillPresent,jumpedOpen,outputOpened,outputAdded,
        allExpanded,pageStyleOpens,scenarioHiddenWhenFolded,scenarioHiddenAgain,
        allCapabilitiesHiddenWhenFolded,allCapabilitiesVisibleOnOpen,
        capabilitiesHiddenAgain,capabilitiesValuesRetained,
        devInline,blueUniform,foldMeasurements,foldRightEdges,
        foldedButtonsAligned,plusWhenClosed,minusWhenOpened,
        validationOpens,noDuplicateIconButton,
        noV1Status,cleanDevLabel,initialRed,green,titleIsGreen,red,titleIsRed,titleColorGreen,titleColorRed,
        viewportWidth:window.innerWidth,widthFits,order,
        kindWidth:size(typeField),zoneWidth:size(zone),deleteWidth:size(remove),
        kindFont:font(typeField),zoneFont:font(zone),deleteFont:font(remove),
        deleteText:remove?.textContent.trim(),collapsedBlocks:document.querySelectorAll('.exercise-block.is-collapsed').length};
      document.getElementById('new-test').click();
      return values;
    })()`,true);
    if(!sectionCompact.ok||!sectionCompact.folded||!sectionCompact.stillPresent||
       !sectionCompact.jumpedOpen||!sectionCompact.outputOpened||!sectionCompact.outputAdded||
       !sectionCompact.allExpanded||!sectionCompact.pageStyleOpens||
       !sectionCompact.scenarioHiddenWhenFolded||!sectionCompact.scenarioHiddenAgain||
       !sectionCompact.allCapabilitiesHiddenWhenFolded||
       !sectionCompact.allCapabilitiesVisibleOnOpen||
       !sectionCompact.capabilitiesHiddenAgain||!sectionCompact.capabilitiesValuesRetained||
       !sectionCompact.devInline||!sectionCompact.blueUniform||
       !sectionCompact.foldedButtonsAligned||
       !sectionCompact.plusWhenClosed||!sectionCompact.minusWhenOpened||
       !sectionCompact.validationOpens||
       !sectionCompact.noDuplicateIconButton||!sectionCompact.noV1Status||!sectionCompact.cleanDevLabel||
       !sectionCompact.initialRed||!sectionCompact.green||!sectionCompact.titleIsGreen||
       !sectionCompact.red||!sectionCompact.titleIsRed||
       !sectionCompact.widthFits||!sectionCompact.order||
       sectionCompact.kindWidth>182||sectionCompact.deleteWidth>85||
       (sectionCompact.viewportWidth<=1060
         ? sectionCompact.kindWidth<90||sectionCompact.zoneWidth<65
         : sectionCompact.zoneWidth<100)||
       sectionCompact.kindFont<13||sectionCompact.zoneFont<13||sectionCompact.deleteFont<13||
       sectionCompact.deleteText!=='Supprimer'){
      return fail('Sections Icônes / Sorties-Bilan ou largeur des boutons incorrectes',sectionCompact);
    }
    console.log('KALONEO_SECTION_FOLD_AND_COMPACT_BLOCK_HEADER=OK',JSON.stringify(sectionCompact));

        const typingFocus=await win.webContents.executeJavaScript(`(async()=>{
      document.getElementById('new-test').click();
      let block=document.querySelector('.exercise-block');
      let type=block.querySelector('.block-type');
      type.value='response-table';type.dispatchEvent(new Event('change',{bubbles:true}));
      block=document.querySelector('.exercise-block');
      if(block.classList.contains('is-collapsed'))block.querySelector('.toggle-block').click();
      const header=[...block.querySelectorAll('label')].find(l=>l.textContent?.includes('En-têtes du tableau'))?.querySelector('input');
      if(!header)return {ok:false,reason:'En-têtes de tableau introuvables'};
      header.focus();
      header.value='Colonne A; Colonne B; Colonne C';
      header.setSelectionRange(9,9);
      header.dispatchEvent(new Event('input',{bubbles:true}));
      const focusAfterInput=document.activeElement===header&&header.isConnected&&header.selectionStart===9;
      await new Promise(resolve=>setTimeout(resolve,410));
      const focusAfterPause=document.activeElement===header&&header.isConnected&&header.selectionStart===9;
      const focusAfterPauseDiagnostic={
        activeTag:document.activeElement?.tagName,activeId:document.activeElement?.id,
        activeLabel:document.activeElement?.closest('label')?.textContent?.slice(0,70),
        connected:header.isConnected,
        selection:header.selectionStart,
        headerValue:header.value,
        renderedValue:[...document.querySelectorAll('.exercise-block label')].find(
          l=>l.textContent?.includes('En-têtes du tableau'))?.querySelector('input')?.value
      };
      header.dispatchEvent(new Event('change',{bubbles:true}));
      const updated=!!document.querySelector('.exercise-block')&&
        document.querySelectorAll('.exercise-block .column-editor-row').length===3;
      document.getElementById('new-test').click();
      block=document.querySelector('.exercise-block');
      type=block.querySelector('.block-type');
      type.value='table-grid';type.dispatchEvent(new Event('change',{bubbles:true}));
      block=document.querySelector('.exercise-block');
      if(block.classList.contains('is-collapsed'))block.querySelector('.toggle-block').click();
      const size=[...document.querySelectorAll('.exercise-block label')].find(l=>l.textContent?.trim().startsWith('Lignes'))?.querySelector('input');
      if(!size)return {ok:false,reason:'Champ Lignes absent'};
      size.focus();
      size.value='12';size.dispatchEvent(new Event('input',{bubbles:true}));
      const gridKeepsFocus=document.activeElement===size&&size.isConnected;
      size.dispatchEvent(new Event('change',{bubbles:true}));
      const gridUpdated=!!document.querySelector('.exercise-block .cell-grid-editor');
      document.getElementById('new-test').click();
      document.getElementById('add-output').click();
      const output=document.querySelector('#outputs-editor .contract-row input');
      output.focus();
      output.value='variable_focus';
      output.dispatchEvent(new Event('input',{bubbles:true}));
      output.dispatchEvent(new Event('blur',{bubbles:true}));
      const next=document.querySelector('#outputs-editor .contract-row select');
      next.focus();
      await new Promise(resolve=>setTimeout(resolve,30));
      const nextKeepsFocus=document.activeElement===next&&next.isConnected;
      document.getElementById('new-test').click();
      return {ok:true,focusAfterInput,focusAfterPause,focusAfterPauseDiagnostic,updated,gridKeepsFocus,gridUpdated,nextKeepsFocus};
    })()`,true);
    if(!typingFocus.ok||!typingFocus.focusAfterInput||!typingFocus.focusAfterPause||
       !typingFocus.updated||!typingFocus.gridKeepsFocus||!typingFocus.gridUpdated||
       !typingFocus.nextKeepsFocus){
      return fail('Le curseur disparaît lors de la saisie dans le Builder',typingFocus);
    }
    console.log('KALONEO_BUILDER_INPUT_FOCUS_STABLE=OK',JSON.stringify(typingFocus));

            const setup=await win.webContents.executeJavaScript(`(async()=>{
      document.getElementById('test-title').value='Aperçu Electron Smoke';
      document.getElementById('test-title').dispatchEvent(new Event('input',{bubbles:true}));
      const scenario=document.getElementById('test-scenario');
      scenario.value='Scénario plein écran';
      scenario.dispatchEvent(new Event('input',{bubbles:true}));
      const sStart=scenario.value.indexOf('plein');
      scenario.setSelectionRange(sStart,sStart+'plein'.length);
      document.querySelector('.context-format-btn[data-target="test-scenario"][data-format="b"]').click();
      const colorStart=scenario.value.indexOf('Scénario');
      scenario.setSelectionRange(colorStart,colorStart+'Scénario'.length);
      document.querySelector('.context-format-btn[data-target="test-scenario"][data-format="color"]').click();
      document.querySelector('[data-text-color="#005A8D"]').click();

      const instruction=document.getElementById('test-instruction');
      instruction.value='Consigne plein écran';
      instruction.dispatchEvent(new Event('input',{bubbles:true}));
      let iStart=instruction.value.indexOf('Consigne');
      instruction.setSelectionRange(iStart,iStart+'Consigne'.length);
      document.querySelector('.context-format-btn[data-target="test-instruction"][data-format="i"]').click();
      iStart=instruction.value.indexOf('écran');
      instruction.setSelectionRange(iStart,iStart+'écran'.length);
      document.querySelector('.context-format-btn[data-target="test-instruction"][data-format="u"]').click();
      document.getElementById('calculator-compatible').checked=true;
      document.getElementById('calculator-compatible').dispatchEvent(new Event('change',{bubbles:true}));
      document.getElementById('calculator-brand').value='KALONÉO';
      document.getElementById('calculator-brand').dispatchEvent(new Event('input',{bubbles:true}));
      document.getElementById('chrono-enabled').checked=true;
      document.getElementById('chrono-enabled').dispatchEvent(new Event('change',{bubbles:true}));

      const editorBlock=document.querySelector('.exercise-block');
      if(editorBlock.classList.contains('is-collapsed'))editorBlock.querySelector('.toggle-block').click();
      const textArea=document.querySelector('.exercise-block .block-body textarea');
      textArea.value='Bloc couleur simple';
      textArea.dispatchEvent(new Event('input',{bubbles:true}));
      const blockColorStart=textArea.value.indexOf('couleur');
      textArea.setSelectionRange(blockColorStart,blockColorStart+'couleur'.length);
      document.querySelector('.exercise-block .inline-text-format-toolbar .context-color-btn').click();
      document.querySelector('[data-text-color="#1F6B3A"]').click();
      await new Promise(resolve=>setTimeout(resolve,80));
      const blockColorValue=textArea.value;
      const blockColorRendered=document.querySelector('.preview-content-block span')?.style.color||'';
      const blockMarkupOk=blockColorValue.toLowerCase().includes('[c=#1f6b3a]couleur[/c]');
      const normalizedBlockColor=blockColorRendered.toLowerCase().split(' ').join('');
      const blockRenderOk=normalizedBlockColor.includes('rgb(31,107,58)')||normalizedBlockColor.includes('#1f6b3a');
      if(!blockMarkupOk||!blockRenderOk) {
        throw new Error('Couleur texte bloc non appliquée :: '+JSON.stringify({blockColorValue,blockColorRendered,blockMarkupOk,blockRenderOk}));
      }

      // Le bloc Texte propose un seul choix d'image de fond, sans contrôles inutiles avant sélection.
      const textBackgroundChoose=document.querySelectorAll('.exercise-block .choose-background-image');
      if(textBackgroundChoose.length!==1||document.querySelector('.exercise-block .block-image-options')){
        throw new Error('Bloc Texte : image de fond dupliquée ou réglages affichés sans image');
      }
      textBackgroundChoose[0].click();
      await new Promise(resolve=>setTimeout(resolve,130));
      const textLibrary=document.getElementById('image-library-dialog');
      textLibrary?.querySelector('.image-library-use')?.click();
      await new Promise(resolve=>setTimeout(resolve,150));
      if(textLibrary.open||document.querySelectorAll('.exercise-block .choose-background-image').length!==1||
         document.querySelectorAll('.exercise-block .block-image-options').length!==1){
        throw new Error('Bloc Texte : image de fond et options avancées introuvables après sélection');
      }
      const undoText=document.getElementById('undo-change');
      const redoText=document.getElementById('redo-change');
      if(undoText.disabled)throw new Error('Annuler désactivé immédiatement après une image de fond');
      undoText.click();
      if(redoText.disabled||document.querySelector('.exercise-block .block-image-options')){
        throw new Error('Annuler ne restaure pas le bloc Texte sans image de fond');
      }
      redoText.click();
      if(document.querySelectorAll('.exercise-block .block-image-options').length!==1){
        throw new Error('Rétablir ne remet pas l’image de fond du bloc Texte');
      }
      const type=document.querySelector('.exercise-block .block-type');
      type.value='image';
      type.dispatchEvent(new Event('change',{bubbles:true}));
      await new Promise(resolve=>setTimeout(resolve,80));
      // Dans les blocs Image, une seule commande doit exister : la bibliothèque.
      if(document.querySelector('.exercise-block input[type="file"]')){
        throw new Error('Ancien sélecteur Fichier image toujours présent');
      }
      const imageChooser=document.querySelector('.exercise-block .choose-library-image');
      if(!imageChooser)throw new Error('Bouton de bibliothèque image absent');
      imageChooser.click();
      await new Promise(resolve=>setTimeout(resolve,180));
      const library=document.getElementById('image-library-dialog');
      const libraryButton=library?.querySelector('.image-library-use');
      if(!library?.open||!libraryButton)throw new Error('Bibliothèque image inaccessible');
      libraryButton.click();
      await new Promise(resolve=>setTimeout(resolve,190));
      const scaleControls=document.querySelector('.exercise-block .image-scale-controls');
      const compactButtons=[...scaleControls?.querySelectorAll('button')||[]];
      const columns=scaleControls?getComputedStyle(scaleControls).gridTemplateColumns.split(/\\s+/).filter(Boolean):[];
      if(columns.length!==5||compactButtons.length!==3||
          compactButtons.some(b=>b.getBoundingClientRect().width>58||b.getBoundingClientRect().height>36)){
        throw new Error('Boutons de taille image agrandis : '+JSON.stringify({
          columns,buttons:compactButtons.map(b=>({width:b.getBoundingClientRect().width,height:b.getBoundingClientRect().height}))
        }));
      }
      // Bloc Image : un seul sélecteur principal et aucun second fond superposé.
      if(document.querySelector('.exercise-block .choose-background-image')||
         document.querySelectorAll('.exercise-block .choose-library-image').length!==1||
         document.querySelector('.exercise-block .block-image-options')){
        throw new Error('Bloc Image : sélecteurs d’images redondants');
      }
      const alignField=[...document.querySelectorAll('.exercise-block label')].find(x=>x.textContent?.includes('Alignement de l’image'));
      const align=alignField?.querySelector('select');
      if(!align)throw new Error('Alignement du bloc Image absent');
      align.value='right';
      align.dispatchEvent(new Event('change',{bubbles:true}));
      const styleSelects=[...document.querySelectorAll('.block-style-editor select')];
      if(styleSelects.length!==1||styleSelects[0].options.length<2)throw new Error('Style du bloc Image non simplifié');
      styleSelects[0].value='#EEF9F2';
      styleSelects[0].dispatchEvent(new Event('change',{bubbles:true}));
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      document.getElementById('save-draft').click();
      await new Promise(resolve=>setTimeout(resolve,180));
      const smallImg=document.querySelector('.preview-media');
      const smallBlock=smallImg?.closest('.preview-media-block');
      const ir=smallImg?.getBoundingClientRect();
      const br=smallBlock?.getBoundingClientRect();
      return {
        button:String(document.getElementById('open-electron-preview')?.textContent||'').trim(),
        title:document.getElementById('test-title').value,
        calculatorBrand:document.getElementById('calculator-brand')?.value||'',
        calculatorOptionsHidden:document.getElementById('calculator-options')?.hidden,
        libraryStatus:String(document.getElementById('draft-status')?.textContent||'').trim(),
        imagePresent:!!smallImg,
        imageAlignedRight:smallBlock?.style.justifyContent==='flex-end',
        smallImageFits:!!(ir&&br&&ir.width<=br.width+1&&ir.height<=br.height+1),
        smallImageSize:ir?{width:Math.round(ir.width),height:Math.round(ir.height)}:null,
        smallBlockSize:br?{width:Math.round(br.width),height:Math.round(br.height)}:null,
        blockFont:smallBlock?.style.fontSize||'',
        blockBackground:smallBlock?.style.backgroundColor||'',
        obsoleteButtonsAbsent:!document.getElementById('refresh-preview')&&!document.getElementById('preview-calculator')&&!document.querySelector('.preview-footer')&&!document.getElementById('download-json')&&!document.getElementById('import-json')&&!document.getElementById('open-image-library'),
        topLabels:[...document.querySelectorAll('.builder-top-actions button')].map(node=>String(node.textContent||'').trim()),
        previewScale:Number(document.getElementById('candidate-preview')?.style.transform?.match(/scale\(([^)]+)\)/)?.[1]||1),
        viewportRect:(()=>{const r=document.getElementById('candidate-preview-viewport')?.getBoundingClientRect();return r?{width:r.width,height:r.height}:null})(),
        pageRect:(()=>{const r=document.getElementById('candidate-preview')?.getBoundingClientRect();return r?{width:r.width,height:r.height}:null})()
      };
    })()`);
    if(setup.button!=='Aperçu'||setup.title!=='Aperçu Electron Smoke'||setup.calculatorBrand!=='KALONÉO'||setup.calculatorOptionsHidden||
       !savedLibraryDefinition||savedLibraryDefinition.title!=='Aperçu Electron Smoke'||! /bibliothèque/i.test(setup.libraryStatus)||
       !setup.imagePresent||!setup.smallImageFits||!setup.imageAlignedRight||setup.blockFont!==''||!/238, 249, 242/.test(setup.blockBackground)||
       !setup.obsoleteButtonsAbsent||setup.previewScale>=1||
       !setup.viewportRect||!setup.pageRect||setup.pageRect.width>setup.viewportRect.width+1||setup.pageRect.height>setup.viewportRect.height+1||
       setup.topLabels.join('|')!=='↶ Annuler|↷ Rétablir|Bibliothèque de tests|Nouveau test|Enregistrer|Fermer') return fail('ergonomie ou aperçu miniature Builder incorrect',setup);

    // L'import passe désormais uniquement par Import / Export, pas par le bloc Image.
    if(savedImageCalls!==0) return fail('une importation directe depuis le bloc Image a réapparu',{savedImageCalls});

    const libraryPick=await win.webContents.executeJavaScript(`(async()=>{
      const choose=document.querySelector('.choose-library-image');
      if(!choose)return {ok:false,reason:'bouton absent'};
      choose.click();
      const immediateOpen=document.getElementById('image-library-dialog')?.open===true;
      choose.click(); // un double-clic ne doit pas créer de deuxième demande
      await new Promise(resolve=>setTimeout(resolve,160));
      const dialog=document.getElementById('image-library-dialog');
      if(!immediateOpen)return {ok:false,reason:'bibliothèque non affichée immédiatement'};
      const card=document.querySelector('.image-library-card');
      const img=card?.querySelector('img');
      const use=card?.querySelector('.image-library-use');
      if(!dialog?.open||!card||!use)return {ok:false,reason:'dialogue ou carte absent'};
      use.click();
      await new Promise(resolve=>setTimeout(resolve,180));
      const preview=document.querySelector('.preview-media');
      return {
        ok:true,
        dialogClosed:!dialog.open,
        cardImageLoaded:Boolean(img?.src),
        previewSrc:preview?.getAttribute('src')||''
      };
    })()`,true);
    if(!libraryPick.ok||!libraryPick.dialogClosed||!libraryPick.cardImageLoaded||libraryPick.previewSrc!==imageLibraryData) {
      return fail('sélection d’une image depuis la bibliothèque KALONÉO incorrecte',libraryPick);
    }

    const immediateImageHistory=await win.webContents.executeJavaScript(`(async()=>{
      document.querySelector('.exercise-block .choose-library-image').click();
      await new Promise(resolve=>setTimeout(resolve,130));
      const library=document.getElementById('image-library-dialog');
      const alternative=[...library.querySelectorAll('.image-library-card')].find(card=>
        card.querySelector('strong')?.textContent==='bibliotheque-changement.svg');
      alternative?.querySelector('.image-library-use')?.click();
      for(let i=0;i<18&&library.open;i++)await new Promise(resolve=>setTimeout(resolve,35));
      if(library.open)return {ok:false,error:'la sélection ne s’est pas refermée'};
      const name=()=>document.querySelector('.exercise-block .file-preview-name')?.textContent||'';
      const undo=document.getElementById('undo-change');
      const redo=document.getElementById('redo-change');
      const updatedName=name(),canUndo=!undo.disabled;
      undo.click();
      const undoneName=name(),canRedo=!redo.disabled;
      redo.click();
      const redoneName=name();
      return {ok:true,updatedName,canUndo,undoneName,canRedo,redoneName};
    })()`,true);
    if(!immediateImageHistory.ok||!immediateImageHistory.canUndo||!immediateImageHistory.canRedo||
       !immediateImageHistory.updatedName.includes('bibliotheque-changement.svg')||
       !immediateImageHistory.undoneName.includes('bibliotheque-kaloneo.svg')||
       !immediateImageHistory.redoneName.includes('bibliotheque-changement.svg')){
      return fail('R80: Annuler / Rétablir indisponible immédiatement après changement image',immediateImageHistory);
    }
    console.log('KALONEO_IMMEDIATE_IMAGE_UNDO_REDO=OK',JSON.stringify(immediateImageHistory));

        const pageBackground=await win.webContents.executeJavaScript(`(async()=>{
      document.getElementById('choose-page-background-image').click();
      await new Promise(resolve=>setTimeout(resolve,160));
      const dialog=document.getElementById('image-library-dialog');
      const use=dialog?.querySelector('.image-library-use');
      if(!dialog?.open||!use)return {ok:false,reason:'sélecteur fond absent'};
      use.click();
      await new Promise(resolve=>setTimeout(resolve,180));
      const page=document.getElementById('candidate-preview');
      return {
        ok:true,
        type:document.getElementById('page-background-type')?.value||'',
        name:String(document.getElementById('page-background-image-name')?.textContent||'').trim(),
        background:page?.style.backgroundImage||''
      };
    })()`,true);
    if(!pageBackground.ok||pageBackground.type!=='image'||pageBackground.name!=='bibliotheque-kaloneo.svg'||!pageBackground.background.includes('data:image/svg+xml')) {
      return fail('arrière-plan de page depuis la bibliothèque incorrect',pageBackground);
    }

    const imageChooserErgonomics=await win.webContents.executeJavaScript(`(()=>({
      globalImageButtonAbsent:!document.getElementById('open-image-library'),
      importImageButtonAbsent:!document.getElementById('import-images'),
      importZipButtonAbsent:!document.getElementById('import-image-zip'),
      chooserStillAvailable:!!document.querySelector('.choose-library-image')
    }))()`,true);
    if(!imageChooserErgonomics.globalImageButtonAbsent||!imageChooserErgonomics.importImageButtonAbsent||
       !imageChooserErgonomics.importZipButtonAbsent||!imageChooserErgonomics.chooserStillAvailable) {
      return fail('gestion globale des images encore présente dans le Builder',imageChooserErgonomics);
    }

    const importedFromPc=await win.webContents.executeJavaScript(`(async()=>{
      const choose=document.querySelector('.exercise-block .choose-library-image');
      choose.click();
      await new Promise(resolve=>setTimeout(resolve,140));
      const dialog=document.getElementById('image-library-dialog');
      const button=document.getElementById('image-library-import-pc');
      const picker=document.getElementById('image-library-pc-file');
      if(!dialog?.open||!button||!picker||picker.type!=='file')return {ok:false,reason:'contrôles d’import absents'};
      const realClick=picker.click.bind(picker);
      picker.click=()=>{picker.dataset.wasOpened='yes';};
      button.click();
      picker.click=realClick;
      const opened=picker.dataset.wasOpened==='yes';
      const image='<svg xmlns="http://www.w3.org/2000/svg" width="240" height="120"><rect width="240" height="120" fill="#eaba31"/></svg>';
      const selected=new File([image],'image-du-pc.svg',{type:'image/svg+xml'});
      const files=new DataTransfer();files.items.add(selected);
      picker.files=files.files;
      picker.dispatchEvent(new Event('change',{bubbles:true}));
      for(let i=0;i<15&&dialog.open;i++)await new Promise(resolve=>setTimeout(resolve,70));
      const preview=document.querySelector('.preview-media');
      const title=document.querySelector('.exercise-block .file-preview-name')?.textContent||'';
      const imageStatusCount=document.querySelectorAll('.exercise-block .block-media-status').length;
      const headerChildren=document.querySelector('.exercise-block .block-header')?.children.length;
      return {ok:true,opened,closed:!dialog.open,src:preview?.getAttribute('src')||'',
        title,imageStatusCount,headerChildren};
    })()`,true);
    if(!importedFromPc.ok||!importedFromPc.opened||!importedFromPc.closed||
       !importedFromPc.src.startsWith('data:image/svg+xml;base64,')||!importedFromPc.title.includes('image-du-pc.svg')||
       importedFromPc.imageStatusCount!==0||importedFromPc.headerChildren!==7||
       importedImages.size!==1||savedImageCalls!==1){
      return fail('Import depuis le PC vers la bibliothèque et le bloc incorrect',importedFromPc);
    }
    console.log('KALONEO_BUILDER_PC_IMAGE_IMPORT=OK',JSON.stringify({images:importedImages.size,saves:savedImageCalls}));

    // Préparer deux étapes d'historique consécutives juste avant l'aperçu :
    // Annuler doit retrouver le titre provisoire après fermeture d'Electron.
    const previewHistoryBefore=await win.webContents.executeJavaScript(`(async()=>{
      const title=document.getElementById('test-title');
      title.value='Aperçu Electron Smoke - étape annulable';
      title.dispatchEvent(new Event('input',{bubbles:true}));
      await new Promise(resolve=>setTimeout(resolve,445));
      title.value='Aperçu Electron Smoke';
      title.dispatchEvent(new Event('input',{bubbles:true}));
      await new Promise(resolve=>setTimeout(resolve,445));
      return {title:title.value,undoEnabled:!document.getElementById('undo-change').disabled};
    })()`,true);
    if(previewHistoryBefore.title!=='Aperçu Electron Smoke'||!previewHistoryBefore.undoEnabled)
      return fail('Historique pré-aperçu : modifications successives non annulables',previewHistoryBefore);

    // Régression utilisateur : les blocs repliés restent repliés après Aperçu.
    const foldsBeforePreview=await win.webContents.executeJavaScript(`(()=>{
      const blocks=[...document.querySelectorAll('.exercise-block')];
      if(!blocks.length)return {count:0};
      blocks.forEach(block=>{
        if(!block.classList.contains('is-collapsed'))block.querySelector('.toggle-block').click();
      });
      const contract=document.getElementById('toggle-contract-section');
      if(contract?.getAttribute('aria-expanded')==='true')contract.click();
      const contractCollapsed=contract?.getAttribute('aria-expanded')==='false'
        &&document.getElementById('contract-section-content')?.hidden===true;
      return {count:blocks.length,folded:[...document.querySelectorAll('.exercise-block.is-collapsed')].map(x=>x.dataset.uid),contractCollapsed};
    })()`);
    if(foldsBeforePreview.count<1||foldsBeforePreview.folded.length!==foldsBeforePreview.count||
       !foldsBeforePreview.contractCollapsed)
      return fail('Impossible de préparer les blocs repliés avant le retour Aperçu',foldsBeforePreview);
    // Le bouton déclenche une navigation Electron : programmer le clic après
    // l'accusé d'exécution JS évite la destruction du contexte pendant l'IPC.
    // La boucle suivante vérifie toujours que le nouvel écran s'est ouvert.
    await win.webContents.executeJavaScript(`(()=>{
      const button=document.getElementById('open-electron-preview');
      if(!button)throw new Error('Bouton Aperçu introuvable');
      setTimeout(()=>button.click(),80);
      return true;
    })()`);
    for(let i=0;i<30;i++){
      await wait(120);
      const p=win.webContents.getURL(); // Ne pas exécuter de JS dans un frame en cours de navigation.
      if(/test-preview\.html$/i.test(p)) break;
    }
    await wait(500);

    const shown=await win.webContents.executeJavaScript(`(()=>({
      path:location.pathname,
      title:String(document.querySelector('.kb-heading h1')?.textContent||'').trim(),
      scenario:String(document.querySelectorAll('.kb-context p')[0]?.textContent||'').trim(),
      instruction:String(document.querySelectorAll('.kb-context p')[1]?.textContent||'').trim(),
      scenarioBold:String(document.querySelectorAll('.kb-context p')[0]?.querySelector('strong')?.textContent||''),
      scenarioColor:String(document.querySelectorAll('.kb-context p')[0]?.querySelector('span')?.style.color||''),
      instructionItalic:String(document.querySelectorAll('.kb-context p')[1]?.querySelector('em')?.textContent||''),
      instructionUnderline:String(document.querySelectorAll('.kb-context p')[1]?.querySelector('u')?.textContent||''),
      close:String(document.querySelector('.close-preview')?.textContent||'').trim(),
      next:String(document.querySelector('.kb-nav-btn.next')?.textContent||'').trim(),
      calculator:String(document.querySelector('.kb-footer-center button')?.textContent||'').trim(),
      chrono:String(document.querySelector('.kb-chrono-time')?.textContent||'').trim(),
      privacy:(()=>{const p=document.getElementById('seb-evalpro-privacy-toggle');return p?getComputedStyle(p).display:'absent';})(),
      calculatorButtonShadow:getComputedStyle(document.querySelector('.kb-footer-center button')).boxShadow,
      pageBackground:document.querySelector('.kb-preview-page')?.style.backgroundImage||'',
      media:(()=>{
        const img=document.querySelector('.kb-media');
        const block=img?.closest('.kb-media-block');
        const workspace=document.querySelector('.kb-workspace');
        const ir=img?.getBoundingClientRect();
        const br=block?.getBoundingClientRect();
        return {
          present:!!img,
          rightAligned:block?.style.justifyContent==='flex-end',
          fits:!!(ir&&br&&ir.width<=br.width+1&&ir.height<=br.height+1),
          image:ir?{width:Math.round(ir.width),height:Math.round(ir.height)}:null,
          block:br?{width:Math.round(br.width),height:Math.round(br.height)}:null,
          workspaceScroll:workspace?workspace.scrollHeight>workspace.clientHeight+2:false,
          font:block?.style.fontSize||'',
          background:block?.style.backgroundColor||''
        };
      })()
    }))()`);

    if(!/test-preview\.html$/i.test(shown.path)||
       shown.title!=='Aperçu Electron Smoke'||
       shown.scenario!=='Scénario plein écran'||
       shown.instruction!=='Consigne plein écran'||
       shown.scenarioBold!=='plein'||
       !/0, 90, 141/.test(shown.scenarioColor)||
       shown.instructionItalic!=='Consigne'||
       shown.instructionUnderline!=='écran'||
       shown.close!=='Fermer l’aperçu'||
       shown.next!=='Suivant'||
       shown.calculator!=='Ouvrir la calculatrice'||
       shown.chrono!=='00:00'||
       !['none','absent'].includes(shown.privacy)||
       !shown.pageBackground.includes('data:image/svg+xml')||
       !shown.media.present||!shown.media.fits||!shown.media.rightAligned||shown.media.workspaceScroll||
       shown.media.font!==''||!/238, 249, 242/.test(shown.media.background)) {
      return fail('rendu plein écran incorrect',shown);
    }

    await win.webContents.executeJavaScript(`document.querySelector('.kb-footer-center button').click();true`);
    await wait(130);
    const calcBefore=await win.webContents.executeJavaScript(`(()=>{
      const panel=document.getElementById('calc-container');
      const bar=panel?.querySelector('.seb-calc-dragbar');
      const brand=panel?.querySelector('.seb-calc-brand');
      const labels=[...panel?.querySelectorAll('.calc-btn')||[]].map(x=>String(x.textContent||'').trim());
      if(!panel||!bar||getComputedStyle(panel).display==='none') return {open:false};
      const rect=panel.getBoundingClientRect();
      const barRect=bar.getBoundingClientRect();
      return {
        open:true,
        brand:String(brand?.textContent||'').trim(),
        dragLabel:String(bar?.querySelector('span')?.textContent||'').trim(),
        hasX:labels.includes('x'),
        hasStar:labels.includes('*'),
        left:rect.left,top:rect.top,right:rect.right,bottom:rect.bottom,
        x:Math.round(barRect.left+30),y:Math.round(barRect.top+Math.min(18,barRect.height/2)),
        viewport:[innerWidth,innerHeight]
      };
    })()`);
    if(!calcBefore.open||calcBefore.brand!=='KALONÉO'||calcBefore.dragLabel!=='Calculatrice'||!calcBefore.hasX||calcBefore.hasStar){
      return fail('calculatrice commune de l’aperçu incorrecte avant déplacement',calcBefore);
    }

    const dragTrace=await win.webContents.executeJavaScript(`(()=>{
      const bar=document.querySelector('#calc-container .seb-calc-dragbar');
      if(!bar)return {ok:false};
      const r=bar.getBoundingClientRect();
      const x=r.left+30,y=r.top+Math.min(18,r.height/2);
      const fire=(type,cx,cy,buttons)=>bar.dispatchEvent(new PointerEvent(type,{
        bubbles:true,cancelable:true,pointerId:41,pointerType:'mouse',isPrimary:true,
        button:type==='pointermove'?-1:0,buttons,clientX:cx,clientY:cy
      }));
      fire('pointerdown',x,y,1);
      fire('pointermove',x+35,y+22,1);
      fire('pointermove',x+70,y+45,1);
      fire('pointerup',x+70,y+45,0);
      return {ok:true};
    })()`,true);
    if(!dragTrace.ok)return fail('barre de déplacement de la calculatrice absente',dragTrace);
    await wait(120);

    const calcOpen=await win.webContents.executeJavaScript(`(()=>{
      const panel=document.getElementById('calc-container');
      if(!panel||getComputedStyle(panel).display==='none') return {open:false};
      const after=panel.getBoundingClientRect();
      return {
        open:true,
        moved:Math.abs(after.left-${calcBefore.left})>20||Math.abs(after.top-${calcBefore.top})>20,
        inside:after.left>=0&&after.top>=0&&after.right<=innerWidth&&after.bottom<=innerHeight,
        left:after.left,top:after.top
      };
    })()`);
    if(!calcOpen.open||!calcOpen.moved||!calcOpen.inside){
      return fail('déplacement réel souris de la calculatrice incorrect', {calcBefore,calcOpen});
    }

    await win.webContents.executeJavaScript(`(()=>{
      localStorage.setItem('kaloneo_test_builder_v2',JSON.stringify({
        idLocked:true,
        sourceDefinition:null,
        meta:{title:'Calculs de poids et volumes',id:'calculs_poids_volumes',version:'1.0.0',category:'mathematiques',layout:'single',scenario:'Ancien brouillon',instruction:'Ancienne consigne'},
        blocks:[{uid:'stale',type:'text',zone:'left',text:'ancien'}]
      }));
      return true;
    })()`,true);

    await win.webContents.executeJavaScript(`document.querySelector('.close-preview').click();true`);
    for(let i=0;i<30;i++){
      await wait(120);
      const p=win.webContents.getURL(); // Ne pas exécuter de JS dans un frame en cours de navigation.
      if(/test-builder\.html$/i.test(p)) break;
    }
    await wait(500);

    const returned=await win.webContents.executeJavaScript(`(()=>({
      path:location.pathname,
      title:document.getElementById('test-title')?.value||'',
      scenario:document.getElementById('test-scenario')?.value||'',
      instruction:document.getElementById('test-instruction')?.value||'',
      calculatorBrand:document.getElementById('calculator-brand')?.value||'',
      previewButton:String(document.getElementById('open-electron-preview')?.textContent||'').trim(),
      draftStatus:String(document.getElementById('draft-status')?.textContent||'').trim()
    }))()`);

    const foldsAfterPreview=await win.webContents.executeJavaScript(`(()=>({
      count:document.querySelectorAll('.exercise-block').length,
      collapsed:document.querySelectorAll('.exercise-block.is-collapsed').length,
      contractCollapsed:document.getElementById('toggle-contract-section')?.getAttribute('aria-expanded')==='false'
        &&document.getElementById('contract-section-content')?.hidden===true
    }))()`);
    if(foldsAfterPreview.count!==foldsBeforePreview.count||foldsAfterPreview.collapsed!==foldsBeforePreview.folded.length||
       !foldsAfterPreview.contractCollapsed)
      return fail('Retour Aperçu : les blocs repliés sont tous rouverts', {foldsBeforePreview,foldsAfterPreview});
    console.log('KALONEO_PREVIEW_PRESERVES_COLLAPSED_BLOCKS=OK',JSON.stringify(foldsAfterPreview));
    const historyAfterPreview=await win.webContents.executeJavaScript(`(()=>{
      const title=document.getElementById('test-title');
      const undo=document.getElementById('undo-change');
      const redo=document.getElementById('redo-change');
      const before=title?.value||'';
      const undoEnabled=!undo.disabled;
      undo.click();
      const afterUndo=title?.value||'';
      const redoEnabled=!redo.disabled;
      redo.click();
      const afterRedo=title?.value||'';
      return {before,undoEnabled,afterUndo,redoEnabled,afterRedo,undoEnabledAfterRedo:!undo.disabled};
    })()`,true);
    if(!historyAfterPreview.undoEnabled||!historyAfterPreview.redoEnabled||
       historyAfterPreview.before!=='Aperçu Electron Smoke'||
       historyAfterPreview.afterUndo!=='Aperçu Electron Smoke - étape annulable'||
       historyAfterPreview.afterRedo!=='Aperçu Electron Smoke'||
       !historyAfterPreview.undoEnabledAfterRedo)
      return fail('Historique Annuler/Rétablir perdu au retour de l’aperçu Electron',historyAfterPreview);
    console.log('KALONEO_PREVIEW_HISTORY_UNDO_REDO_PRESERVED=OK',JSON.stringify(historyAfterPreview));
    console.log('KALONEO_BUILDER_NO_IDLE_FIVE_SECOND_CHECKPOINT=OK');
    if(!/test-builder\.html$/i.test(returned.path)||
       returned.title!=='Aperçu Electron Smoke'||
       returned.scenario!=='[c=#005A8D]Scénario[/c] [b]plein[/b] écran'||
       returned.instruction!=='[i]Consigne[/i] plein [u]écran[/u]'||
       returned.calculatorBrand!=='KALONÉO'||
       returned.previewButton!=='Aperçu'||
       !/même test restauré|Modifications non enregistrées/i.test(returned.draftStatus)) {
      return fail('retour au Builder : le test exact de l’aperçu n’a pas été restauré',returned);
    }

    protectedLibraryMode=true;
    savedLibraryDefinition=null;
    savedLibraryPayload=null;
    const protectedV1=await win.webContents.executeJavaScript(`(async()=>{
      window.confirm=()=>true;
      document.getElementById('open-library-test').click();
      await new Promise(resolve=>setTimeout(resolve,180));
      const rows=[...document.querySelectorAll('.test-library-item')];
      const row=rows.find(node=>String(node.textContent||'').includes('v1.0.0'));
      const open=row?.querySelector('.test-library-item-actions button');
      if(!open)return {ok:false,reason:'V1 protégée absente de la bibliothèque'};
      open.click();
      await new Promise(resolve=>setTimeout(resolve,220));
      const version=document.getElementById('test-version');
      const save=document.getElementById('save-draft');
      // Reproduire la régression signalée : 8 questions visibles dans
      // l'écran candidat mais seulement 6 dans l'aperçu interne du Builder.
      const orgPreview=(()=>{
        const zone=document.querySelector('#preview-exercise .preview-zone:nth-child(2)');
        const nodes=[...zone?.querySelectorAll(':scope > .preview-question.kaloneo-shared-question')||[]];
        const texts=nodes.map(node=>node.querySelector(':scope > span')?.textContent||'');
        const inputs=nodes.map(node=>node.querySelector('input'));
        const rect=zone?.getBoundingClientRect();
        const last=nodes.at(-1)?.getBoundingClientRect();
        const inline=nodes.every((node,i)=>{
          const label=node.querySelector(':scope > span')?.getBoundingClientRect();
          const input=inputs[i]?.getBoundingClientRect();
          return label&&input&&input.left>=label.right-1&&
            Math.abs((label.top+label.bottom)/2-(input.top+input.bottom)/2)<11;
        });
        return {
          moduleLoaded:typeof window.KaloneoSharedPresentation?.renderQuestion==='function',
          rows:nodes.length,
          inputs:inputs.filter(Boolean).length,
          texts,
          inline,
          allVisible:!!rect&&!!last&&last.bottom<=rect.bottom+1&&
            nodes.every(node=>node.getBoundingClientRect().top>=rect.top-1),
          noVerticalOverflow:!!zone&&zone.scrollHeight<=zone.clientHeight+1,
          genericLayout:nodes.every(node=>node.classList.contains('kaloneo-shared-question')),
          firstBackground:nodes[0]?getComputedStyle(nodes[0]).backgroundColor:'',
          secondBackground:nodes[1]?getComputedStyle(nodes[1]).backgroundColor:''
        };
      })();
      const before={
        ok:true,
        version:version?.value||'',
        versionReadOnly:!!version?.readOnly,
        saveLabel:String(save?.textContent||'').trim(),
        saveTitle:String(save?.title||''),
        title:document.getElementById('test-title')?.value||''
      };
      const scenario=document.getElementById('test-scenario');
      scenario.value=String(scenario.value||'')+' — modification smoke';
      scenario.dispatchEvent(new Event('input',{bubbles:true}));
      save.click();
      await new Promise(resolve=>setTimeout(resolve,420));
      return {
        ok:true,
        before,
        orgPreview,
        after:{
          version:version?.value||'',
          versionReadOnly:!!version?.readOnly,
          saveLabel:String(save?.textContent||'').trim(),
          status:String(document.getElementById('draft-status')?.textContent||'').trim()
        }
      };
    })()`,true);

    const org=protectedV1.orgPreview||{};
    if(!org.moduleLoaded||org.rows!==8||org.inputs!==8||!org.inline||!org.allVisible||
       !org.noVerticalOverflow||
       org.texts[0]!==protectedOrganisation.presentation.organisationList.rows[0].text||
       org.texts[7]!==protectedOrganisation.presentation.organisationList.rows[7].text||
       !org.genericLayout) {
      return fail('Organisation : aperçu Builder ne reconstitue pas les huit lignes du candidat',org);
    }
    console.log('KALONEO_ORGANISATION_BUILDER_EIGHT_INLINE_ROWS=OK',JSON.stringify(org));
    if(!protectedV1.ok||
       protectedV1.before.version!=='1.0.0'||
       !protectedV1.before.versionReadOnly||
       protectedV1.before.saveLabel!=='Enregistrer V1'||
       !/copie de sécurité/i.test(protectedV1.before.saveTitle)||
       protectedV1.after.version!=='1.0.0'||
       !protectedV1.after.versionReadOnly||
       protectedV1.after.saveLabel!=='Enregistrer V1'||
       !savedLibraryDefinition||
       savedLibraryDefinition.id!=='organisation_demenagement'||
       savedLibraryDefinition.version!=='1.0.0'||
       savedLibraryPayload?.overwrite!==true||
       !String(savedLibraryDefinition.scenario||'').includes('modification smoke')) {
      return fail('V1 administrateur : ouverture, édition ou sauvegarde sans Développeur incorrecte',{protectedV1,savedLibraryDefinition,savedLibraryPayload});
    }


    // Une version 2.0.0 enregistrée par le Builder doit afficher, elle aussi,
    // toutes les huit lignes alignées. Le modèle V1 ne suffit pas comme test.
    const organisationV2=await win.webContents.executeJavaScript(`(async()=>{
      document.getElementById('open-library-test').click();
      await new Promise(resolve=>setTimeout(resolve,160));
      const rows=[...document.querySelectorAll('.test-library-item')];
      const row=rows.find(node=>node.textContent?.includes('Organisation d’une activité')&&node.textContent?.includes('v2.0.0'));
      const open=row?.querySelector('.test-library-item-actions button');
      if(!open)return {ok:false,reason:'V2 Organisation absente de la bibliothèque simulée'};
      open.click();
      await new Promise(resolve=>setTimeout(resolve,250));
      const zone=document.querySelector('#preview-exercise .preview-zone:nth-child(2)');
      const blocks=[...zone?.querySelectorAll(':scope > .preview-question.kaloneo-shared-question')||[]];
      const inputs=blocks.map(node=>node.querySelector('input'));
      const aligned=blocks.every((node,i)=>{
        const txt=node.querySelector(':scope > span')?.getBoundingClientRect();
        const input=inputs[i]?.getBoundingClientRect();
        return txt&&input&&input.left>=txt.right-1&&
          Math.abs((txt.top+txt.bottom)/2-(input.top+input.bottom)/2)<11;
      });
      const last=blocks.at(-1)?.getBoundingClientRect();
      const clip=zone?.getBoundingClientRect();
      return {
        ok:true,version:document.getElementById('test-version')?.value,
        count:blocks.length,inputs:inputs.filter(Boolean).length,aligned,
        allVisible:!!last&&!!clip&&last.bottom<=clip.bottom+1,
        overflow:zone?zone.scrollHeight-zone.clientHeight:null,
        first:blocks[0]?.querySelector(':scope > span')?.textContent,
        last:blocks.at(-1)?.querySelector(':scope > span')?.textContent
      };
    })()`,true);
    if(!organisationV2.ok||organisationV2.version!=='2.0.0'||
       organisationV2.count!==8||organisationV2.inputs!==8||
       !organisationV2.aligned||!organisationV2.allVisible||
       organisationV2.overflow>1||
       organisationV2.first!==protectedOrganisation.presentation.organisationList.rows[0].text||
       organisationV2.last!==protectedOrganisation.presentation.organisationList.rows[7].text){
      return fail('Organisation V2 Builder : huit lignes alignées et visibles non garanties',organisationV2);
    }
    console.log('KALONEO_ORGANISATION_V2_BUILDER_EIGHT_INLINE_ROWS=OK',JSON.stringify(organisationV2));

    // Une fenêtre Electron invisible peut être bridée à 1024 px par l'écran CI :
    // imposer le viewport utilisé par les captures utilisateur (1366×720).
    win.setContentSize(1366,720);
    await wait(200);

    // R48.2 : reproduire la vraie page Restaurant avec interligne aéré,
    // sans barre de défilement dans le planning ou la colonne gauche.
    await win.webContents.executeJavaScript("window.confirm=()=>true; document.getElementById('open-library-test').click(); true");
    await wait(400);
    const libraryOpen=await win.webContents.executeJavaScript(`(()=>{
      if(document.getElementById('r48-demo-restaurant'))return {ok:false,reason:'Bouton R48 obsolète toujours présent'};
      const row=[...document.querySelectorAll('.test-library-item')].find(node=>String(node.textContent||'').toLowerCase().includes('restaurant'));
      if(!row)return {ok:false,reason:'Restaurant absent de la bibliothèque simulée'};
      row.querySelector('.test-library-item-actions button').click();
      return {ok:true};
    })()`);
    if(!libraryOpen.ok)return fail('Ouverture du Restaurant depuis la bibliothèque impossible',libraryOpen);
    await wait(500);
    const restaurantSetup=await win.webContents.executeJavaScript(`(()=>{
      if(!String(document.getElementById('test-title')?.value||'').toLowerCase().includes('restaurant')){
        return {ok:false,reason:'Ouverture du Restaurant via bibliothèque impossible'};
      }
      const blocks=[...document.querySelectorAll('.exercise-block')];
      const labels=[...blocks.flatMap(b=>[...b.querySelectorAll('label')])];
      const interline=labels.find(x=>/Interligne/.test(x.textContent||'') && x.querySelector('select'))?.querySelector('select');
      if(!interline)return {ok:false,reason:'Réglage interligne absent'};
      interline.value='1.5';
      interline.dispatchEvent(new Event('change',{bubbles:true}));
      // Régression R72 : modifier les indications doit être transmis au véritable aperçu.
      const indicationsEditor=[...document.querySelectorAll('.exercise-block textarea')]
        .find(node=>String(node.value||'').includes('Jacqueline'));
      if(!indicationsEditor)return {ok:false,reason:'Éditeur des indications Restaurant absent'};
      indicationsEditor.value=indicationsEditor.value.replace('Jacqueline','JacquelinX');
      indicationsEditor.dispatchEvent(new Event('input',{bubbles:true}));
      if(!indicationsEditor.value.includes('JacquelinX'))return {ok:false,reason:'Saisie indications perdue'};
      // Vérification des commandes Sortie et Liaison Bilan sur une définition temporaire.
      document.getElementById('add-output').click();
      const custom=[...document.querySelectorAll('#outputs-editor .contract-row')].at(-1);
      const id=custom?.querySelector('input');
      if(!id)return {ok:false,reason:'Bouton Sortie inopérant'};
      id.value='variable_restaurant';id.dispatchEvent(new Event('input',{bubbles:true}));
      id.dispatchEvent(new Event('blur',{bubbles:true}));
      const valueType=[...document.querySelectorAll('#outputs-editor .contract-row')].at(-1)?.querySelector('select');
      if(!valueType)return {ok:false,reason:'Type de sortie absent'};
      valueType.value='integer';valueType.dispatchEvent(new Event('change',{bubbles:true}));
      document.getElementById('add-bilan-contribution').click();
      const link=[...document.querySelectorAll('#bilan-editor .contract-link-row select')].at(-1);
      if(!link)return {ok:false,reason:'Bouton Liaison Bilan inopérant'};
      link.value='bilan.competences_techniques.briques.identifier_schema';
      link.dispatchEvent(new Event('change',{bubbles:true}));
      const errorsSelect=[...document.querySelectorAll('#bilan-editor .contract-item')].at(-1)?.querySelector('.contract-bindings select');
      if(!errorsSelect)return {ok:false,reason:'Entrée erreurs de la ligne Briques absente'};
      errorsSelect.value='variable_restaurant';errorsSelect.dispatchEvent(new Event('change',{bubbles:true}));
      const preview=document.getElementById('open-electron-preview');
      if(!preview)return {ok:false,reason:'Bouton aperçu absent'};
      return {ok:true,blocks:blocks.length,interline:interline.value};
    })()`,true);
    if(!restaurantSetup.ok)return fail('R48.2 : chargement Restaurant / interligne impossible',restaurantSetup);
    // Démarrer la navigation APRÈS la promesse de préparation : évite de détruire
    // le contexte Electron pendant l'exécution asynchrone du test.
    await win.webContents.executeJavaScript("document.getElementById('open-electron-preview').click(); true");
    for(let attempt=0;attempt<30;attempt++){
      await wait(150);
      const p=win.webContents.getURL(); // Ne pas exécuter de JS dans un frame en cours de navigation.
      if(/test-preview\.html$/i.test(p)) break;
    }
    await wait(400);
    const definitionIndications=previewDefinition?.presentation?.builderContent
      ?.filter(block=>block?.type==='text').map(block=>String(block.text||'')).join(' ')||'';
    if(!previewDefinition?.outputs?.some(output=>output.id==='variable_restaurant'&&output.type==='integer')||
       !previewDefinition?.bilanContributions?.some(link=>
         link.lineId==='bilan.competences_techniques.briques.identifier_schema'&&
         link.bindings?.erreurs==='variable_restaurant')){
      return fail('Sortie et liaison Bilan non conservées dans la définition KALTEST',previewDefinition?.bilanContributions);
    }
    if(!definitionIndications.includes('JacquelinX')||definitionIndications.includes('Jacqueline')) {
      return fail('R72 : texte Restaurant modifié non transmis à la définition de l’aperçu',{definitionIndications});
    }
    const restaurantFit=await win.webContents.executeJavaScript(`(()=>{
      const zones=[...document.querySelectorAll('.kb-zone')];
      const grid=document.querySelector('.kb-table-wrap');
      const indications=zones[0]?.lastElementChild;
      const bottomLeft=zones[0]?.getBoundingClientRect().bottom||0;
      const bottomInd=indications?.getBoundingClientRect().bottom||0;
      const selects=[...document.querySelectorAll('.kb-table-wrap select')];
      const measure=node=>!node?null:{
        clientHeight:node.clientHeight,scrollHeight:node.scrollHeight,
        clientWidth:node.clientWidth,scrollWidth:node.scrollWidth,
        overflowY:getComputedStyle(node).overflowY
      };
      return {
        page:location.pathname,
        viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},
        zones:zones.map(measure),
        grid:measure(grid),
        indications:measure(indications),
        bottomLeft,bottomInd,
        selects:selects.length,
        instructionPresent:!!indications&&String(indications.textContent||'').includes('JacquelinX')&&!String(indications.textContent||'').includes('Jacqueline'),
        imagePresent:!!zones[1]?.querySelector('img')
      };
    })()`);
    if(!/test-preview\.html$/i.test(restaurantFit.page)||
      restaurantFit.viewport.width<1300||restaurantFit.viewport.height<690||
      restaurantFit.zones.length!==2||
      !restaurantFit.grid||restaurantFit.selects!==15||
      !restaurantFit.instructionPresent||!restaurantFit.imagePresent||
      restaurantFit.zones.some(z=>z.scrollHeight>z.clientHeight+2)||
      restaurantFit.grid.scrollHeight>restaurantFit.grid.clientHeight+2||
      restaurantFit.bottomInd<restaurantFit.bottomLeft-3||
      restaurantFit.bottomInd>restaurantFit.bottomLeft+3){
      return fail('R48.2 : Restaurant doit être entièrement visible sans scrollbars',restaurantFit);
    }
    console.log('R48_2_RESTAURANT_NO_SCROLL_ELECTRON=OK',JSON.stringify(restaurantFit));

    // Test ciblé sur le vrai JSON de Genre et nombre sans modifier le fichier V1.
    genreLibraryMode=true;
    await win.loadFile(builder);
    await wait(650);
    const genreFont=await win.webContents.executeJavaScript(`(async()=>{
      window.confirm=()=>true;
      document.getElementById('open-library-test').click();
      await new Promise(resolve=>setTimeout(resolve,150));
      const row=[...document.querySelectorAll('.test-library-item')].find(x=>x.textContent?.includes('Genre et nombre'));
      const open=row?.querySelector('.test-library-item-actions button');
      if(!open)return {ok:false,reason:'Genre et nombre absent de la bibliothèque simulée'};
      open.click();
      await new Promise(resolve=>setTimeout(resolve,210));
      const blocks=[...document.querySelectorAll('.exercise-block')];
      if(blocks.length!==2||blocks.some(x=>x.querySelector('.block-type')?.value!=='multiple-tables')){
        return {ok:false,reason:'Genre et nombre : tableaux historiques non conservés',blocks:blocks.length};
      }
      if(blocks.some(x=>!x.classList.contains('is-collapsed')||!x.querySelector('.block-body')?.hidden)){
        return {ok:false,reason:'Les blocs du test ouvert ne sont pas repliés par défaut'};
      }
      blocks.forEach(block=>block.querySelector('.toggle-block').click());
      const rendererLoaded=typeof window.KaloneoBuilderLegacyTablePreview?.render==='function';
      if(!rendererLoaded)return {ok:false,reason:'Module autonome des tableaux historiques non chargé'};
      const grammarTables=[...document.querySelectorAll('#preview-exercise .preview-grammar-table')];
      const grammarRows=grammarTables.map(table=>table.tBodies[0]?.rows.length||0);
      const grammarSources=grammarTables.map(table=>
        [...table.querySelectorAll('td.preview-grammar-source')].map(cell=>cell.textContent));
      const grammarInputs=grammarTables.map(table=>table.querySelectorAll('tbody input').length);
      if(grammarTables.length!==2||grammarRows.some(n=>n!==10)||
         grammarInputs.some(n=>n!==10)||
         grammarSources[0][0]!=='Des taux'||grammarSources[0][1]!=='Un monsieur'||
         grammarSources[1][0]!=='Publique'||grammarSources[1][2]!=='Blanc'){
        return {ok:false,reason:'Aperçu Builder incomplet : cellules du véritable test absentes',grammarRows,grammarSources,grammarInputs};
      }
      const label=[...blocks[0].querySelectorAll('label')].find(x=>x.textContent?.startsWith('Taille de police'));
      const font=label?.querySelector('select');
      if(!font)return {ok:false,reason:'Taille de police indisponible'};
      const tableFields=[...blocks[0].querySelectorAll('label')];
      const field=(name)=>tableFields.find(x=>x.textContent?.startsWith(name))?.querySelector('input');
      const historicalLocked=field('ID du tableau')?.readOnly===true&&
        field('En-têtes')?.readOnly===true&&
        field('Questions utilisées')?.readOnly===true;
      if(!historicalLocked)return {ok:false,reason:'IDs historiques non protégés'};
      font.value='24';font.dispatchEvent(new Event('change',{bubbles:true}));
      const selected=font.value;
      const active=font.isConnected;
      // R86 : plusieurs éditions successives ne doivent jamais détacher
      // le contrôle en cours d'utilisation (ancienne perte du curseur).
      const colorLabel=[...blocks[0].querySelectorAll('label')]
        .find(x=>x.textContent?.startsWith('Couleur du bloc'));
      const color=colorLabel?.querySelector('select');
      if(!color)return {ok:false,reason:'Couleur du bloc absente'};
      color.focus();color.value='#EEF6FD';
      color.dispatchEvent(new Event('change',{bubbles:true}));
      const colorKept=color.isConnected&&document.activeElement===color;
      const oldTitle=[...blocks[0].querySelectorAll('label')]
        .find(x=>x.textContent?.trim()==='Titre')?.querySelector('input');
      if(!oldTitle)return {ok:false,reason:'Titre du tableau introuvable'};
      oldTitle.focus();oldTitle.value='Singulier Pluriel modifié';
      oldTitle.setSelectionRange(10,10);
      oldTitle.dispatchEvent(new Event('input',{bubbles:true}));
      await new Promise(resolve=>setTimeout(resolve,480));
      const titleKept=oldTitle.isConnected&&document.activeElement===oldTitle&&
        oldTitle.selectionStart===10;
      const secondBlocks=[...document.querySelectorAll('.exercise-block')];
      const otherTitle=[...secondBlocks[1].querySelectorAll('label')]
        .find(x=>x.textContent?.trim()==='Titre')?.querySelector('input');
      otherTitle.focus();otherTitle.value='Masculin Féminin modifié';
      otherTitle.setSelectionRange(7,7);
      otherTitle.dispatchEvent(new Event('input',{bubbles:true}));
      await new Promise(resolve=>setTimeout(resolve,480));
      const secondKept=otherTitle.isConnected&&document.activeElement===otherTitle&&
        otherTitle.selectionStart===7;
      // Le changement de zone force une reconstruction structurelle ;
      // le contrôle choisi reste utilisable sans fermer le test.
      const zone=secondBlocks[1].querySelector('.block-zone');
      zone.focus();zone.value='left';
      zone.dispatchEvent(new Event('change',{bubbles:true}));
      const zoneKept=zone.isConnected&&document.activeElement===zone;
      zone.value='right';
      zone.dispatchEvent(new Event('change',{bubbles:true}));
      // Reconstruction structurelle du Builder sans changer le type des
      // tableaux historiques ni l'identité de la V1 testée.
      const firstBlock=document.querySelector('.exercise-block');
      const type=firstBlock.querySelector('.block-type');
      type.focus();
      const layout=document.getElementById('test-layout');
      layout.value='60-40';
      layout.dispatchEvent(new Event('change',{bubbles:true}));
      const restoredType=firstBlock.isConnected===false &&
        document.activeElement?.classList?.contains('block-type') &&
        document.activeElement?.closest('.exercise-block')?.dataset?.uid===firstBlock.dataset.uid;
      layout.value='50-50';
      layout.dispatchEvent(new Event('change',{bubbles:true}));
            document.getElementById('open-electron-preview').click();
      return {ok:true,selected,active,colorKept,titleKept,secondKept,zoneKept,restoredType};
    })()`,true);
    if(!genreFont.ok||genreFont.selected!=='24'||!genreFont.active||
       !genreFont.colorKept||!genreFont.titleKept||!genreFont.secondKept||
       !genreFont.zoneKept||!genreFont.restoredType) {
      return fail('Genre et nombre : perte du curseur après plusieurs modifications',genreFont);
    }
    console.log('KALONEO_GENRE_NOMBRE_MULTIPLE_EDITS_FOCUS=OK',JSON.stringify(genreFont));
    console.log('KALONEO_GENRE_NOMBRE_DIRECT_PREVIEW_COMPLETE=OK');
    for(let attempt=0;attempt<30;attempt++){
      await wait(120);
      const p=win.webContents.getURL(); // Ne pas exécuter de JS dans un frame en cours de navigation.
      if(/test-preview\.html$/i.test(p))break;
    }
    if(previewDefinition?.id!=='genre_nombre'||
       previewDefinition.presentation?.tables?.[0]?.builderStyle?.fontSize!==24||
       previewDefinition.presentation?.builderContent!==undefined||
       previewDefinition.presentation?.tables?.[1]?.builderStyle!==undefined ||
       previewDefinition.presentation?.tables?.[0]?.title!=='Singulier Pluriel modifié' ||
       previewDefinition.presentation?.tables?.[1]?.title!=='Masculin Féminin modifié' ||
       previewDefinition.questions?.length!==genreNombreFixture.questions.length) {
      return fail('Police de Genre et nombre non transmise au véritable aperçu Electron',previewDefinition?.presentation);
    }
    console.log('KALONEO_GENRE_NOMBRE_FONT_ELECTRON=OK');
    console.log('KALONEO_BUILDER_LEGACY_TABLE_TITLE_SAVED_P0=OK');

    // Régression R107 : un bloc Image neuf doit retrouver un thème fonctionnel
    // après remplacement puis suppression, sans modifier le catalogue V1.
    await win.loadFile(builder);
    await wait(650);
    const postRemovalTheme=await win.webContents.executeJavaScript(`(async()=>{
      window.confirm=()=>true;
      document.getElementById('new-test').click();
      const block=document.querySelector('.exercise-block');
      if(!block)return {ok:false,reason:'bloc neuf introuvable'};
      const type=block.querySelector('.block-type');
      type.value='image';type.dispatchEvent(new Event('change',{bubbles:true}));
      const open=async()=>{
        const btn=document.querySelector('.exercise-block .choose-library-image');
        if(!btn)throw new Error('Choisir une image absent');
        btn.click();
        const dialog=document.getElementById('image-library-dialog');
        for(let i=0;i<30;i++){
          if(dialog?.open&&dialog.querySelector('.image-library-card')&&
             !String(document.getElementById('image-library-status')?.textContent||'')
              .includes('Chargement de la bibliothèque'))return dialog;
          await new Promise(resolve=>setTimeout(resolve,40));
        }
        throw new Error('Chargement de la bibliothèque non terminé');
      };
      let dialog=await open();
      const theme=document.getElementById('image-library-theme');
      if(!dialog?.open)return {ok:false,reason:'fenêtre image absente'};
      const initialTheme=theme.value;
      const v1HiddenInitially=![...dialog.querySelectorAll('.image-library-card strong')]
        .some(x=>x.textContent==='qcm_posture.png');
      theme.value='Images V1';theme.dispatchEvent(new Event('change',{bubbles:true}));
      const stable=theme.isConnected&&theme.value==='Images V1';
      const v1Card=[...dialog.querySelectorAll('.image-library-card')]
        .find(x=>x.querySelector('strong')?.textContent==='qcm_posture.png');
      const technicalHidden=![...dialog.querySelectorAll('.image-library-card strong')]
        .some(x=>x.textContent==='flacon_bleu.png');
      if(!v1Card)return {ok:false,reason:'qcm_posture non disponible dans Images V1',initialTheme,stable};
      v1Card.querySelector('.image-library-use').click();
      for(let i=0;i<20&&dialog.open;i++)await new Promise(resolve=>setTimeout(resolve,35));
      const inserted=document.querySelector('.exercise-block .file-preview-name')?.textContent||'';
      const remove=document.querySelector('.exercise-block .remove-media');
      remove?.click();
      const emptied=document.querySelector('.exercise-block .file-preview-name')?.textContent||'';
      dialog=await open();
      const reopenedTheme=theme.value;
      const v1HiddenAfterRemoval=![...dialog.querySelectorAll('.image-library-card strong')]
        .some(x=>x.textContent==='qcm_posture.png');
      theme.value='Images V1';theme.dispatchEvent(new Event('change',{bubbles:true}));
      const v1VisibleAgain=[...dialog.querySelectorAll('.image-library-card strong')]
        .some(x=>x.textContent==='qcm_posture.png');
      dialog.querySelector('#close-image-library')?.click();
      return {ok:true,initialTheme,reopenedTheme,stable,technicalHidden,
        v1HiddenInitially,v1HiddenAfterRemoval,v1VisibleAgain,inserted,emptied};
    })()`,true);
    if(!postRemovalTheme.ok||postRemovalTheme.initialTheme!=='__current__'||
       postRemovalTheme.reopenedTheme!=='__current__'||!postRemovalTheme.stable||
       !postRemovalTheme.technicalHidden||!postRemovalTheme.v1HiddenInitially||
       !postRemovalTheme.v1HiddenAfterRemoval||!postRemovalTheme.v1VisibleAgain||
       !postRemovalTheme.inserted.includes('qcm_posture.png')||
       postRemovalTheme.emptied.includes('qcm_posture.png')){
      return fail('R107 : thème inopérant après suppression d’une image',postRemovalTheme);
    }
    console.log('KALONEO_IMAGE_THEME_AFTER_REMOVAL_ELECTRON=OK',JSON.stringify(postRemovalTheme));

    const answerLayoutCheck=await win.webContents.executeJavaScript(`(async()=>{
      const block=document.querySelector('.exercise-block');
      const type=block?.querySelector('.block-type');
      if(!type)return {ok:false,reason:'bloc non disponible'};
      type.value='question';
      type.dispatchEvent(new Event('change',{bubbles:true}));
      const current=document.querySelector('.exercise-block');
      const label=[...current.querySelectorAll('label')]
        .find(x=>x.firstChild?.textContent?.trim()==='Position de la réponse');
      const field=label?.querySelector('select');
      const width=[...current.querySelectorAll('label')]
        .find(x=>x.firstChild?.textContent?.trim()==='Largeur de la réponse (caractères)')
        ?.querySelector('input');
      if(!field||!width)return {ok:false,reason:'réglages du bloc Question absents'};
      const choices=[...field.options].map(o=>o.value);
      field.value='inline';
      field.dispatchEvent(new Event('change',{bubbles:true}));
      width.value='11';
      width.dispatchEvent(new Event('input',{bubbles:true}));
      // La saisie numérique est volontairement temporisée (350 ms) pour
      // conserver le curseur du Builder : attendre le vrai rafraîchissement.
      await new Promise(resolve=>setTimeout(resolve,430));
      const mini=document.querySelector('.preview-question.kaloneo-shared-question');
      const changedImmediately=mini?.dataset.kaloneoAnswerLayout==='inline'&&
        mini?.style.getPropertyValue('--kaloneo-answer-width')==='11ch';
      const shared=window.KaloneoSharedPresentation;
      const host=document.createElement('div');
      host.style.cssText='position:fixed;left:-1300px;top:0;width:640px;padding:0;z-index:-1';
      document.body.appendChild(host);
      const zone=document.createElement('section');
      zone.className='preview-zone';
      zone.style.width='640px';
      host.appendChild(zone);
      const row=(name,mode,w)=>{
        const question={prompt:name,answerLayout:mode,answerWidthChars:w};
        const node=shared.renderQuestion({doc:document,question,className:'preview-question',
          makeAnswer:()=>{const input=document.createElement('input');input.type='text';return input;}});
        zone.appendChild(node);return node;
      };
      const colA=row('8 + 2 =','column',16);
      const colB=row('Combien valent 200 - 190 =','column',16);
      const after=row('5 + 5 =','inline',9);
      const below=row('42 - 32 =','below',12);
      const legacy=row('9 + 1 =','',null);
      const compactA=row('Court : 1 + 9 =','compact-column',13);
      const compactB=row('La question la plus longue : 12 - 2 =','compact-column',13);
      shared.alignCompactQuestionColumns(host);
      const compactInputA=compactA.querySelector('input').getBoundingClientRect();
      const compactInputB=compactB.querySelector('input').getBoundingClientRect();
      const compactLongest=compactB.querySelector('span').getBoundingClientRect();
      const compactAligned=Math.abs(compactInputA.left-compactInputB.left)<2;
      const compactClose=compactInputB.left-compactLongest.right>=0&&
        compactInputB.left-compactLongest.right<24;
      const compactNotFarRight=compactInputA.left<host.getBoundingClientRect().right-220;
      const columnAligned=Math.abs(colA.querySelector('input').getBoundingClientRect().left-
        colB.querySelector('input').getBoundingClientRect().left)<2;
      const inlinePrompt=after.querySelector('span').getBoundingClientRect();
      const inlineInput=after.querySelector('input').getBoundingClientRect();
      const inlineAdjacent=inlineInput.left>=inlinePrompt.right&&
        inlineInput.left-inlinePrompt.right<35&&
        inlineInput.top<inlinePrompt.bottom;
      const belowPrompt=below.querySelector('span').getBoundingClientRect();
      const belowInput=below.querySelector('input').getBoundingClientRect();
      const belowPlaced=belowInput.top>=belowPrompt.bottom;
      const legacyPreserved=!legacy.dataset.kaloneoAnswerLayout;
      host.remove();
      return {ok:true,choices,changedImmediately,columnAligned,inlineAdjacent,
        belowPlaced,legacyPreserved,compactAligned,compactClose,compactNotFarRight,
        compactStart:compactInputA.left,compactEnd:compactLongest.right,
        answerWidth:width.value,
        miniLayout:mini?.dataset.kaloneoAnswerLayout||'',
        miniWidth:mini?.style.getPropertyValue('--kaloneo-answer-width')||'',
        inlineGeometry:{captionX:inlinePrompt.left,captionRight:inlinePrompt.right,
          answerX:inlineInput.left,answerTop:inlineInput.top,captionBottom:inlinePrompt.bottom}};
    })()`,true);
    if(!answerLayoutCheck.ok||answerLayoutCheck.choices.join(',')!=='column,compact-column,inline,below'||
       !answerLayoutCheck.changedImmediately||!answerLayoutCheck.columnAligned||
       !answerLayoutCheck.inlineAdjacent||!answerLayoutCheck.belowPlaced||
       !answerLayoutCheck.compactAligned||!answerLayoutCheck.compactClose||
       !answerLayoutCheck.compactNotFarRight||
       !answerLayoutCheck.legacyPreserved||answerLayoutCheck.answerWidth!=='11'){
      return fail('Quatre positions de réponses incohérentes en Electron',answerLayoutCheck);
    }
    console.log('KALONEO_ANSWER_LAYOUT_ELECTRON=OK',JSON.stringify(answerLayoutCheck));

    const colorsCheck=await win.webContents.executeJavaScript(`(()=>{
      const type=document.querySelector('.exercise-block .block-type');
      if(!type)return {ok:false,reason:'Bloc introuvable'};
      type.value='table-grid';
      type.dispatchEvent(new Event('change',{bubbles:true}));
      const column=document.querySelector('.grid-columns-editor .grid-color-input');
      const columnReset=document.querySelector('.grid-columns-editor .grid-color-reset');
      const columnText=document.querySelectorAll('.grid-columns-editor .grid-color-input')[1];
      const columnTextReset=document.querySelectorAll('.grid-columns-editor .grid-color-reset')[1];
      const line=document.querySelector('.grid-row-color-toolbar .grid-color-input');
      const lineReset=document.querySelector('.grid-row-color-toolbar .grid-color-reset');
      const lineText=document.querySelectorAll('.grid-row-color-toolbar .grid-color-input')[1];
      const lineTextReset=document.querySelectorAll('.grid-row-color-toolbar .grid-color-reset')[1];
      const selector=document.querySelector('.grid-row-color-picker');
      const cell=document.querySelector('.grid-editor-scroll .grid-cell-color-toolbar .grid-color-input');
      const cellReset=document.querySelector('.grid-editor-scroll .grid-cell-color-toolbar .grid-color-reset');
      const cellText=document.querySelectorAll('.grid-editor-scroll .grid-cell-color-toolbar .grid-color-input')[1];
      const cellTextReset=document.querySelectorAll('.grid-editor-scroll .grid-cell-color-toolbar .grid-color-reset')[1];
      if(!column||!columnReset||!line||!lineReset||!selector||!cell||!cellReset||
         !columnText||!columnTextReset||!lineText||!lineTextReset||!cellText||!cellTextReset)
        return {ok:false,reason:'Commandes de couleur de grille manquantes',
          columns:!!column,rows:!!line,cells:!!cell};
      const firstCell=()=>document.querySelector('.preview-grid-table tbody tr:first-child td:first-child');
      const read=()=>firstCell()?.style.backgroundColor||'';
      const readText=()=>firstCell()?.style.color||'';
      const trigger=(input,value)=>{
        input.value=value;
        input.dispatchEvent(new Event('input',{bubbles:true}));
      };
      trigger(column,'#dcecff');
      const fromColumn=read();
      selector.value='0';selector.dispatchEvent(new Event('change',{bubbles:true}));
      trigger(line,'#fff0cc');
      const fromRow=read();
      trigger(cell,'#f5d0e7');
      const fromCell=read();
      cellReset.click();
      const restoredRow=read();
      lineReset.click();
      const restoredColumn=read();
      columnReset.click();
      const reset=read();
      trigger(columnText,'#003399');
      const textFromColumn=readText();
      trigger(lineText,'#773300');
      const textFromRow=readText();
      trigger(cellText,'#aa0022');
      const textFromCell=readText();
      cellTextReset.click();
      const textRestoredRow=readText();
      lineTextReset.click();
      const textRestoredColumn=readText();
      columnTextReset.click();
      const textReset=readText();
      // Vérifier aussi le moteur commun utilisé dans le parcours réel.
      const shared=window.KaloneoSharedPresentation;
      const definition={
        columns:[
          {backgroundColor:'#dcecff',textColor:'#003399'},
          {backgroundColor:'#aaffdd',textColor:'#007722'}
        ],
        rowColors:['#fff0cc',null],
        rowTextColors:['#773300',null],
        cells:[
          [{kind:'fixed-text',value:'A',backgroundColor:'#f5d0e7',textColor:'#aa0022'},
           {kind:'fixed-text',value:'B'}],
          [{kind:'fixed-text',value:'C'},{kind:'fixed-text',value:'D'}]
        ]
      };
      const built=shared.renderGridTable({
        doc:document,definition,renderCell:({cell,cellDefinition})=>{
          cell.textContent=cellDefinition.value;
        }
      });
      const visual=[...built.querySelectorAll('tbody td')].map(x=>x.style.backgroundColor);
      const visualText=[...built.querySelectorAll('tbody td')].map(x=>x.style.color);
      const headerTextTest=shared.renderGridTable({
        doc:document,definition:{headers:['Colonne'],columns:[{textColor:'#118833'}],
          cells:[[{kind:'candidate-answer'}]]},
        renderCell:({cell})=>{const input=document.createElement('input');cell.appendChild(input);}
      });
      const inputText=headerTextTest.querySelector('tbody input')?.style.color||'';
      const headerText=headerTextTest.querySelector('th')?.style.color||'';
      return {ok:true,fromColumn,fromRow,fromCell,restoredRow,restoredColumn,
        reset,visual,visualText,inputText,headerText,textFromColumn,textFromRow,
        textFromCell,textRestoredRow,textRestoredColumn,textReset,
        canRestore:cellReset.disabled&&lineReset.disabled&&columnReset.disabled&&
          cellTextReset.disabled&&lineTextReset.disabled&&columnTextReset.disabled};
    })()`,true);
    if(!colorsCheck.ok||colorsCheck.fromColumn!=='rgb(220, 236, 255)'||
       colorsCheck.fromRow!=='rgb(255, 240, 204)'||
       colorsCheck.fromCell!=='rgb(245, 208, 231)'||
       colorsCheck.restoredRow!=='rgb(255, 240, 204)'||
       colorsCheck.restoredColumn!=='rgb(220, 236, 255)'||
       colorsCheck.reset!==''||!colorsCheck.canRestore||
       colorsCheck.visual.join('|')!==
         'rgb(245, 208, 231)|rgb(255, 240, 204)|rgb(220, 236, 255)|rgb(170, 255, 221)'||
       colorsCheck.textFromColumn!=='rgb(0, 51, 153)'||
       colorsCheck.textFromRow!=='rgb(119, 51, 0)'||
       colorsCheck.textFromCell!=='rgb(170, 0, 34)'||
       colorsCheck.textRestoredRow!=='rgb(119, 51, 0)'||
       colorsCheck.textRestoredColumn!=='rgb(0, 51, 153)'||
       colorsCheck.textReset!==''||
       colorsCheck.visualText.join('|')!==
         'rgb(170, 0, 34)|rgb(119, 51, 0)|rgb(0, 51, 153)|rgb(0, 119, 34)'||
       colorsCheck.inputText!=='rgb(17, 136, 51)'||
       colorsCheck.headerText!=='rgb(17, 136, 51)'){
      return fail('R110 : couleur tableau / priorités / réinitialisation incorrectes',colorsCheck);
    }
    console.log('KALONEO_GRID_COLORS_ELECTRON=OK',JSON.stringify(colorsCheck));

    const listCheck=await win.webContents.executeJavaScript(`(()=>{
      const core=window.KaloneoBuilderCore;
      const shared=window.KaloneoSharedPresentation;
      const model={meta:{title:'Liste inventée',id:'liste_test_inventee',
        version:'1.0.0',category:'mathematiques',scored:true,layout:'single'},
        blocks:[core.createGridBlock(1,1)]};
      const item=model.blocks[0].table.cells[0][0];
      Object.assign(item,{kind:'select',questionId:'liste_001',responseType:'text',
        acceptedAnswers:'12',options:['8','10','12'],points:2,
        backgroundColor:'#203040',textColor:'#ffffff'});
      const def=core.modelToDefinition(model);
      const q=def.questions[0];
      const effective=shared.gridSelectQuestion(q,item);
      const built=shared.renderGridTable({
        doc:document,definition:model.blocks[0].table,
        renderCell:({cell,cellDefinition})=>{
          const select=document.createElement('select');
          select.append(new Option('Choisir…',''));
          const result=shared.gridSelectQuestion(q,cellDefinition);
          for(const opt of result.response.options)select.append(new Option(opt,opt));
          cell.append(select);
        }
      });
      // getComputedStyle sur un nœud détaché renvoie des propriétés vides
      // dans Electron. Le placer temporairement hors écran avant la mesure.
      built.style.cssText='position:fixed;left:-1800px;top:0;';
      document.body.appendChild(built);
      const select=built.querySelector('select');
      const cell=built.querySelector('td');
      const options=[...select.options].map(o=>o.value);
      const textColor=select.style.color;
      const bg=select.style.backgroundColor;
      const displayColor=getComputedStyle(select).color;
      const displayBg=getComputedStyle(select).backgroundColor;
      built.remove();
      return {ok:core.analyzeDefinition(def).ok,
        type:q.response.type,options,score:q.points,accepted:q.acceptedAnswers,
        value:select.value,textColor,bg,displayColor,displayBg,
        effectiveType:effective.response.type};
    })()`,true);
    if(!listCheck.ok||listCheck.type!=='select'||listCheck.effectiveType!=='select'||
       listCheck.options.join(',')!==',8,10,12'||listCheck.score!==2||
       listCheck.accepted.join(',')!=='12'||listCheck.value!==''||
       listCheck.textColor!=='rgb(255, 255, 255)'||
       listCheck.bg!=='rgb(32, 48, 64)'||
       listCheck.displayColor!=='rgb(255, 255, 255)'||
       listCheck.displayBg!=='rgb(32, 48, 64)'){
      return fail('Liste déroulante ou contraste de police incorrect après rafraîchissement',listCheck);
    }
    console.log('KALONEO_GRID_SELECT_AND_TEXT_COLOR_ELECTRON=OK',JSON.stringify(listCheck));


    // Clics réellement effectués dans les contrôles du Builder :
    // vérifier que l'unité reprend l'identifiant de sa valeur, que l'auteur
    // peut régler points/type/variantes et que les paramètres persistent.
    const editorAudit=await win.webContents.executeJavaScript(`(()=>{
      const block=()=>document.querySelector('.exercise-block');
      const type=block()?.querySelector('.block-type');
      if(!type)return {ok:false,reason:'Liste types absente'};
      type.value='table-grid';type.dispatchEvent(new Event('change',{bubbles:true}));
      const visibleCell=()=>document.querySelector(
        '.grid-editor-scroll tbody tr:first-child td:not([hidden])');
      const picker=()=>document.querySelector('.grid-column-picker');
      const first=visibleCell();
      const setKind=(kind)=>{
        const sel=visibleCell()?.querySelector('.grid-cell-color-toolbar select');
        if(!sel)return false;
        sel.value=kind;sel.dispatchEvent(new Event('change',{bubbles:true}));
        return true;
      };
      if(!first||!setKind('candidate-answer'))
        return {ok:false,reason:'Impossible de créer une cellule Réponse candidat'};
      const c0=visibleCell();
      const qid=c0?.querySelector('input[placeholder="ID réponse"]')?.value;
      const expected=c0?.querySelector('input[placeholder="Réponse attendue"]');
      const typeSelector=[...c0?.querySelectorAll('label')||[]]
        .find(l=>l.textContent?.includes('Type de réponse'))?.querySelector('select');
      const points=c0?.querySelector('.grid-points-input');
      if(!qid||!expected||!typeSelector||!points)
        return {ok:false,reason:'Champs valeur incomplets',qid,
          expected:!!expected,type:!!typeSelector,points:!!points};
      expected.value='12';expected.dispatchEvent(new Event('input',{bubbles:true}));
      typeSelector.value='number';
      typeSelector.dispatchEvent(new Event('change',{bubbles:true}));
      points.value='2';points.dispatchEvent(new Event('input',{bubbles:true}));
      picker().value='1';picker().dispatchEvent(new Event('change',{bubbles:true}));
      if(!setKind('unit'))return {ok:false,reason:'Impossible de créer unité'};
      const cell=visibleCell();
      const unitId=cell?.querySelector('input[placeholder="ID réponse"]')?.value||'';
      const units=cell?.querySelector('input[placeholder^="Unités acceptées"]');
      const scored=[...cell?.querySelectorAll('label.inline-checkbox')||[]]
        .find(l=>l.textContent?.includes('Unité notée'))?.querySelector('input[type="checkbox"]');
      if(!units||!scored)return {ok:false,reason:'Unité non configurable',unitId,
        units:!!units,scored:!!scored};
      units.value='kg; kilo; kilogramme';
      units.dispatchEvent(new Event('input',{bubbles:true}));
      scored.checked=true;scored.dispatchEvent(new Event('change',{bubbles:true}));
      picker().value='0';picker().dispatchEvent(new Event('change',{bubbles:true}));
      const back=visibleCell();
      const backPoints=back.querySelector('.grid-points-input')?.value;
      const backType=[...back.querySelectorAll('label')]
        .find(l=>l.textContent?.includes('Type de réponse'))?.querySelector('select')?.value;
      const backExpected=back.querySelector('input[placeholder="Réponse attendue"]')?.value;
      picker().value='1';picker().dispatchEvent(new Event('change',{bubbles:true}));
      const unitBack=visibleCell();
      const unitBackValues=unitBack.querySelector('input[placeholder^="Unités acceptées"]')?.value;
      const unitBackScored=[...unitBack.querySelectorAll('label.inline-checkbox')]
        .find(l=>l.textContent?.includes('Unité notée'))?.querySelector('input')?.checked;
      return {ok:true,qid,unitId,backPoints,backType,backExpected,
        unitBackValues,unitBackScored,
        compact:!!unitBack.querySelector('.grid-cell-color-toolbar')};
    })()`,true);
    if(!editorAudit.ok||editorAudit.qid!==editorAudit.unitId||
       editorAudit.backPoints!=='2'||editorAudit.backType!=='number'||
       editorAudit.backExpected!=='12'||
       editorAudit.unitBackValues!=='kg; kilo; kilogramme'||
       editorAudit.unitBackScored!==true||!editorAudit.compact){
      return fail('Audit strict de la cellule Unité du vrai Builder',editorAudit);
    }
    console.log('KALONEO_BUILDER_GRID_UNIT_EDITOR_ELECTRON=OK',JSON.stringify(editorAudit));

        console.log('KALONEO_PROTECTED_V1_UI=OK');
    console.log('KALONEO_ADMIN_V1_SAVE_DIRECT=1.0.0');
    console.log('KALONEO_BUILDER_PREVIEW_ELECTRON=OK');
    console.log(JSON.stringify({setup,shown,returned,definitionId:previewDefinition&&previewDefinition.id}));
    clearTimeout(timeout);win.destroy();app.exit(0);
  }catch(error){
    fail(String(error&&error.stack||error));
  }
});
