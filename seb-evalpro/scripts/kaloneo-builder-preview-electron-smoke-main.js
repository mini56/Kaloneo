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
let savedLibraryDefinition = null;
let savedLibraryPayload = null;
let savedImageCalls = 0;
let zipImportCalls = 0;
let protectedLibraryMode = false;
let restaurantFixture = null;
let protectedOrganisation = null;
const imageLibraryData = 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="180" height="120"><rect width="180" height="120" fill="#1b6c8e"/></svg>').toString('base64');
let win = null;

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
  tests:protectedLibraryMode ? [
    {id:'organisation_demenagement',version:'2.0.0',title:'Organisation d’une activité',category:'organisation',role:'test',scored:true,protectedVersion:false},
    {id:'organisation_demenagement',version:'1.0.0',title:'Organisation d’une activité',category:'organisation',role:'test',scored:true,protectedVersion:true}
  ] : []).concat(restaurantFixture?[{id:restaurantFixture.id,version:restaurantFixture.version,title:restaurantFixture.title,category:restaurantFixture.category,role:'test',scored:true,protectedVersion:false}]:[])
}));
ipcMain.handle('kaloneo-library:get-test',(_e,payload)=>{
  if(restaurantFixture&&payload?.id===restaurantFixture.id)return {ok:true,definition:JSON.parse(JSON.stringify(restaurantFixture))};
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
  {id:'img-smoke-library',name:'bibliotheque-kaloneo.svg',mime:'image/svg+xml',size:123,category:'Mes images KALONÉO',systemProvided:false,sourceName:''}
]}));
ipcMain.handle('kaloneo-library:get-image',(_e,id)=>id==='img-smoke-library'
  ? {ok:true,image:{id,name:'bibliotheque-kaloneo.svg',mime:'image/svg+xml',size:123,category:'Mes images KALONÉO',systemProvided:false,data:imageLibraryData}}
  : {ok:false,error:'absent'});
ipcMain.handle('kaloneo-library:save-image',(_e,payload)=>{
  savedImageCalls+=1;
  return {ok:true,duplicate:false,image:{id:'img-saved-'+savedImageCalls,name:payload?.name||'image',mime:payload?.mime||'image/*',size:1,category:'Mes images KALONÉO',systemProvided:false}};
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
  restaurantFixture=JSON.parse(fs.readFileSync(path.join(root,'r48-demo','planning-restaurant-builder-r48.json'),'utf8'));
  const builder=path.join(web,'kaloneo-builder','test-builder.html');
  const preview=path.join(web,'kaloneo-builder','test-preview.html');
  if(!fs.existsSync(builder)||!fs.existsSync(preview)) return fail('Builder ou page aperçu absent de app/web');

  ipcMain.handle('kaloneo-builder:open-preview',async(_event,definition)=>{
    previewDefinition=JSON.parse(JSON.stringify(definition||{}));
    await win.loadFile(preview);
    return {ok:true};
  });
  ipcMain.handle('kaloneo-builder:get-preview',()=>previewDefinition?{ok:true,definition:previewDefinition}:{ok:false,error:'absent'});
  ipcMain.handle('kaloneo-builder:consume-preview',()=>{
    if(!previewDefinition)return {ok:false,error:'absent'};
    const definition=JSON.parse(JSON.stringify(previewDefinition));
    previewDefinition=null;
    return {ok:true,definition};
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

      const type=document.querySelector('.exercise-block .block-type');
      type.value='image';
      type.dispatchEvent(new Event('change',{bubbles:true}));
      await new Promise(resolve=>setTimeout(resolve,80));
      const mediaInput=document.querySelector('.exercise-block input[type="file"]');
      const svg='<svg xmlns="http://www.w3.org/2000/svg" width="320" height="340"><rect width="320" height="340" fill="#dceff5"/><circle cx="160" cy="170" r="80" fill="#f9b233"/></svg>';
      const mediaFile=new File([svg],'image-test-r3.svg',{type:'image/svg+xml'});
      const dt=new DataTransfer();
      dt.items.add(mediaFile);
      mediaInput.files=dt.files;
      mediaInput.dispatchEvent(new Event('change',{bubbles:true}));
      await new Promise(resolve=>setTimeout(resolve,180));
      const styleSelects=[...document.querySelectorAll('.block-style-editor select')];
      if(styleSelects[0]){
        styleSelects[0].value='22';
        styleSelects[0].dispatchEvent(new Event('change',{bubbles:true}));
      }
      if(styleSelects[1]){
        styleSelects[1].value='#EEF9F2';
        styleSelects[1].dispatchEvent(new Event('change',{bubbles:true}));
      }
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
    if(!/vraie page/i.test(setup.button)||setup.title!=='Aperçu Electron Smoke'||setup.calculatorBrand!=='KALONÉO'||setup.calculatorOptionsHidden||
       !savedLibraryDefinition||savedLibraryDefinition.title!=='Aperçu Electron Smoke'||! /bibliothèque/i.test(setup.libraryStatus)||
       !setup.imagePresent||!setup.smallImageFits||setup.blockFont!=='22px'||!/238, 249, 242/.test(setup.blockBackground)||
       !setup.obsoleteButtonsAbsent||setup.previewScale>=1||
       !setup.viewportRect||!setup.pageRect||setup.pageRect.width>setup.viewportRect.width+1||setup.pageRect.height>setup.viewportRect.height+1||
       setup.topLabels.join('|')!=='↶ Annuler|↷ Rétablir|Bibliothèque de tests|Nouveau test|Enregistrer|Fermer') return fail('ergonomie ou aperçu miniature Builder incorrect',setup);

    if(savedImageCalls<1) return fail('une image importée directement dans un bloc ne rejoint pas automatiquement la bibliothèque',{savedImageCalls});

    const libraryPick=await win.webContents.executeJavaScript(`(async()=>{
      const choose=document.querySelector('.choose-library-image');
      if(!choose)return {ok:false,reason:'bouton absent'};
      choose.click();
      await new Promise(resolve=>setTimeout(resolve,160));
      const dialog=document.getElementById('image-library-dialog');
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

    await win.webContents.executeJavaScript(`document.getElementById('open-electron-preview').click();true`);
    for(let i=0;i<30;i++){
      await wait(120);
      const p=await win.webContents.executeJavaScript('location.pathname');
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
       !shown.media.present||!shown.media.fits||shown.media.workspaceScroll||
       shown.media.font!=='22px'||!/238, 249, 242/.test(shown.media.background)) {
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
      const p=await win.webContents.executeJavaScript('location.pathname');
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

    if(!/test-builder\.html$/i.test(returned.path)||
       returned.title!=='Aperçu Electron Smoke'||
       returned.scenario!=='[c=#005A8D]Scénario[/c] [b]plein[/b] écran'||
       returned.instruction!=='[i]Consigne[/i] plein [u]écran[/u]'||
       returned.calculatorBrand!=='KALONÉO'||
       !/vraie page/i.test(returned.previewButton)||
       !/même test restauré/i.test(returned.draftStatus)) {
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
        after:{
          version:version?.value||'',
          versionReadOnly:!!version?.readOnly,
          saveLabel:String(save?.textContent||'').trim(),
          status:String(document.getElementById('draft-status')?.textContent||'').trim()
        }
      };
    })()`,true);

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


    // Une fenêtre Electron invisible peut être bridée à 1024 px par l'écran CI :
    // imposer le viewport utilisé par les captures utilisateur (1366×720).
    win.setContentSize(1366,720);
    await wait(200);

    // R48.2 : reproduire la vraie page Restaurant avec interligne aéré,
    // sans barre de défilement dans le planning ou la colonne gauche.
    const restaurantSetup=await win.webContents.executeJavaScript(`(async()=>{
      window.confirm=()=>true;
      if(document.getElementById('r48-demo-restaurant'))return {ok:false,reason:'Bouton R48 obsolète toujours présent'};
      document.getElementById('open-library-test').click();
      await new Promise(resolve=>setTimeout(resolve,170));
      const row=[...document.querySelectorAll('.test-library-item')]
        .find(node=>String(node.textContent||'').includes('Restaurant'));
      if(!row)return {ok:false,reason:'Restaurant absent de la bibliothèque simulée'};
      row.querySelector('.test-library-item-actions button').click();
      await new Promise(resolve=>setTimeout(resolve,220));
      if(!String(document.getElementById('test-title')?.value||'').includes('Restaurant')){
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
      preview.click();
      return {ok:true,blocks:blocks.length,interline:interline.value};
    })()`,true);
    if(!restaurantSetup.ok)return fail('R48.2 : chargement Restaurant / interligne impossible',restaurantSetup);
    for(let attempt=0;attempt<30;attempt++){
      await wait(150);
      const p=await win.webContents.executeJavaScript('location.pathname');
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

    console.log('KALONEO_PROTECTED_V1_UI=OK');
    console.log('KALONEO_ADMIN_V1_SAVE_DIRECT=1.0.0');
    console.log('KALONEO_BUILDER_PREVIEW_ELECTRON=OK');
    console.log(JSON.stringify({setup,shown,returned,definitionId:previewDefinition&&previewDefinition.id}));
    clearTimeout(timeout);win.destroy();app.exit(0);
  }catch(error){
    fail(String(error&&error.stack||error));
  }
});
