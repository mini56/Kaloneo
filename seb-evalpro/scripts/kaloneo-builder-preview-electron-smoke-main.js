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
const importedImages = new Map();
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
  return {ok:false,error:'Capture Electron simulée pour le test du Builder'};
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
  ...[...importedImages.values()].map(({data,...metadata})=>metadata)
]}));
ipcMain.handle('kaloneo-library:get-image',(_e,id)=>{
  if(id==='img-smoke-library')return {ok:true,image:{id,name:'bibliotheque-kaloneo.svg',mime:'image/svg+xml',size:123,category:'Mes images KALONÉO',systemProvided:false,data:imageLibraryData}};
  if(id==='img-smoke-alternative')return {ok:true,image:{id,name:'bibliotheque-changement.svg',mime:'image/svg+xml',size:124,category:'Mes images KALONÉO',systemProvided:false,data:imageLibraryAlternativeData}};
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
  restaurantFixture=JSON.parse(fs.readFileSync(path.join(root,'r48-demo','planning-restaurant-builder-r48.json'),'utf8'));
  genreNombreFixture=JSON.parse(fs.readFileSync(path.join(root,'source','kaltest','tests','genre-nombre','1.0.0','test.json'),'utf8'));
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
    // Vérifier une frappe immédiatement visible, sans overlay ni capture Electron.
    const miniBeforeTyping=miniRenderCalls;
    const liveTyping=await win.webContents.executeJavaScript(`(async()=>{
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

    const sectionCompact=await win.webContents.executeJavaScript(`(()=>{
      const iconButton=document.getElementById('toggle-icon-library');
      const iconBody=document.getElementById('icon-library-content');
      const contractButton=document.getElementById('toggle-contract-section');
      const contractBody=document.getElementById('contract-section-content');
      if(!iconButton||!contractButton||!iconBody||!contractBody)return {ok:false,error:'Boutons de repli des sections absents'};
      const iconCount=document.querySelectorAll('#icon-picker .icon-choice').length;
      const outputsBefore=document.querySelectorAll('#outputs-editor .contract-item').length;
      iconButton.click();contractButton.click();
      const folded=iconBody.hidden&&contractBody.hidden&&
        iconButton.getAttribute('aria-expanded')==='false'&&
        contractButton.getAttribute('aria-expanded')==='false';
      const stillPresent=iconCount===document.querySelectorAll('#icon-picker .icon-choice').length&&
        outputsBefore===document.querySelectorAll('#outputs-editor .contract-item').length;
      // Le bouton Icône existant doit ré-ouvrir la section repliée.
      document.getElementById('jump-to-icon-picker').click();
      const jumpedOpen=!iconBody.hidden&&iconButton.getAttribute('aria-expanded')==='true';
      // L'ajout d'une sortie ouvre Sorties et Bilan sans perdre les précédentes.
      document.getElementById('add-output').click();
      const outputOpened=!contractBody.hidden&&contractButton.getAttribute('aria-expanded')==='true';
      const outputAdded=document.querySelectorAll('#outputs-editor .contract-item').length===outputsBefore+1;
      document.getElementById('new-test').click();
      const allExpanded=!iconBody.hidden&&!contractBody.hidden;
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
      const values={ok:true,folded,stillPresent,jumpedOpen,outputOpened,outputAdded,
        allExpanded,widthFits,order,kindWidth:size(typeField),zoneWidth:size(zone),deleteWidth:size(remove),
        kindFont:font(typeField),zoneFont:font(zone),deleteFont:font(remove),
        deleteText:remove?.textContent.trim(),collapsedBlocks:document.querySelectorAll('.exercise-block.is-collapsed').length};
      document.getElementById('new-test').click();
      return values;
    })()`,true);
    if(!sectionCompact.ok||!sectionCompact.folded||!sectionCompact.stillPresent||
       !sectionCompact.jumpedOpen||!sectionCompact.outputOpened||!sectionCompact.outputAdded||
       !sectionCompact.allExpanded||!sectionCompact.widthFits||!sectionCompact.order||
       sectionCompact.kindWidth>182||sectionCompact.zoneWidth<100||sectionCompact.deleteWidth>85||
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
      const header=[...block.querySelectorAll('label')].find(l=>l.textContent?.includes('En-têtes du tableau'))?.querySelector('input');
      if(!header)return {ok:false,reason:'En-têtes de tableau introuvables'};
      header.focus();
      header.value='Colonne A; Colonne B; Colonne C';
      header.setSelectionRange(9,9);
      header.dispatchEvent(new Event('input',{bubbles:true}));
      const focusAfterInput=document.activeElement===header&&header.isConnected&&header.selectionStart===9;
      await new Promise(resolve=>setTimeout(resolve,410));
      const focusAfterPause=document.activeElement===header&&header.isConnected&&header.selectionStart===9;
      header.dispatchEvent(new Event('change',{bubbles:true}));
      const updated=!!document.querySelector('.exercise-block')&&
        document.querySelectorAll('.exercise-block .column-editor-row').length===3;
      document.getElementById('new-test').click();
      block=document.querySelector('.exercise-block');
      type=block.querySelector('.block-type');
      type.value='table-grid';type.dispatchEvent(new Event('change',{bubbles:true}));
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
      return {ok:true,focusAfterInput,focusAfterPause,updated,gridKeepsFocus,gridUpdated,nextKeepsFocus};
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
      const imageStatus=document.querySelector('.exercise-block .block-media-status')?.textContent||'';
      return {ok:true,opened,closed:!dialog.open,src:preview?.getAttribute('src')||'',title,imageStatus};
    })()`,true);
    if(!importedFromPc.ok||!importedFromPc.opened||!importedFromPc.closed||
       !importedFromPc.src.startsWith('data:image/svg+xml;base64,')||!importedFromPc.title.includes('image-du-pc.svg')||
       !importedFromPc.imageStatus.includes('image-du-pc.svg')||
       importedImages.size!==1||savedImageCalls!==1){
      return fail('Import depuis le PC vers la bibliothèque et le bloc incorrect',importedFromPc);
    }
    console.log('KALONEO_BUILDER_PC_IMAGE_IMPORT=OK',JSON.stringify({images:importedImages.size,saves:savedImageCalls}));

        await win.webContents.executeJavaScript(`document.getElementById('open-electron-preview').click();true`);
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

    // Régression utilisateur : les blocs repliés restent repliés après Aperçu.
    const foldsBeforePreview=await win.webContents.executeJavaScript(`(()=>{
      const blocks=[...document.querySelectorAll('.exercise-block')];
      if(blocks.length<2)return {count:blocks.length};
      blocks[0].querySelector('.toggle-block').click();
      blocks.at(-1).querySelector('.toggle-block').click();
      return {count:blocks.length,folded:[...document.querySelectorAll('.exercise-block.is-collapsed')].map(x=>x.dataset.uid)};
    })()`);
    if(foldsBeforePreview.count<2||foldsBeforePreview.folded.length<2)
      return fail('Impossible de préparer les blocs repliés avant le retour Aperçu',foldsBeforePreview);
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
      collapsed:document.querySelectorAll('.exercise-block.is-collapsed').length
    }))()`);
    if(foldsAfterPreview.count!==foldsBeforePreview.count||foldsAfterPreview.collapsed!==foldsBeforePreview.folded.length)
      return fail('Retour Aperçu : les blocs repliés sont tous rouverts', {foldsBeforePreview,foldsAfterPreview});
    console.log('KALONEO_PREVIEW_PRESERVES_COLLAPSED_BLOCKS=OK',JSON.stringify(foldsAfterPreview));
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
      const label=[...blocks[0].querySelectorAll('label')].find(x=>x.textContent?.startsWith('Taille de police'));
      const font=label?.querySelector('select');
      if(!font)return {ok:false,reason:'Taille de police indisponible'};
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
    for(let attempt=0;attempt<30;attempt++){
      await wait(120);
      const p=win.webContents.getURL(); // Ne pas exécuter de JS dans un frame en cours de navigation.
      if(/test-preview\.html$/i.test(p))break;
    }
    if(previewDefinition?.id!=='genre_nombre'||
       previewDefinition.presentation?.tables?.[0]?.builderStyle?.fontSize!==24||
       previewDefinition.presentation?.builderContent!==undefined||
       previewDefinition.presentation?.tables?.[1]?.builderStyle!==undefined ||
       previewDefinition.questions?.length!==genreNombreFixture.questions.length) {
      return fail('Police de Genre et nombre non transmise au véritable aperçu Electron',previewDefinition?.presentation);
    }
    console.log('KALONEO_GENRE_NOMBRE_FONT_ELECTRON=OK');

        console.log('KALONEO_PROTECTED_V1_UI=OK');
    console.log('KALONEO_ADMIN_V1_SAVE_DIRECT=1.0.0');
    console.log('KALONEO_BUILDER_PREVIEW_ELECTRON=OK');
    console.log(JSON.stringify({setup,shown,returned,definitionId:previewDefinition&&previewDefinition.id}));
    clearTimeout(timeout);win.destroy();app.exit(0);
  }catch(error){
    fail(String(error&&error.stack||error));
  }
});
