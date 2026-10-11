'use strict';
const {app,BrowserWindow,ipcMain}=require('electron');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const web=path.join(root,'app','web');
const definition=JSON.parse(fs.readFileSync(path.join(root,'r48-demo','planning-restaurant-builder-r48.json'),'utf8'));
definition.id='generic_builder_six_column_grid_smoke';
let saved=0, replaySaved=0, closed=0;
const realRuntime={ok:true,runtime:{
 id:'kaloneo-builder-preview-only',title:'Restaurant aperçu',builderPreview:true,
 launchOptions:{showCorrectionsDuringParcours:false},introduction:null,tests:[definition],fin:null
}};
const ok={ok:true};
ipcMain.on('app:edition-sync',e=>e.returnValue={edition:'unified',canBilan:true,canAi:true,canImport:true,canExport:true});
ipcMain.on('state:load-sync',e=>e.returnValue={version:1,sessionStorage:{},localStorage:{},lastPage:'kaltest-pilot2.html'});
ipcMain.on('state:save-sync',e=>{saved++;e.returnValue=ok;});
ipcMain.on('candidate-catalog:workspace-load-sync',e=>e.returnValue={ok:false});
ipcMain.on('candidate-catalog:workspace-save-sync',e=>e.returnValue=ok);
ipcMain.on('candidate-catalog:results-workspace-load-sync',e=>e.returnValue={ok:false});
ipcMain.on('kaloneo-library:selected-runtime-sync',e=>e.returnValue=realRuntime);
ipcMain.handle('kaloneo-library:selected-runtime',()=>realRuntime);
ipcMain.handle('kaloneo-builder:close-preview',()=>{closed++;return true;});
ipcMain.handle('admin:status',()=>true);
ipcMain.handle('admin:verify',()=>true);
ipcMain.handle('admin:lock',()=>true);
ipcMain.handle('candidate:active',()=>null);
ipcMain.handle('state:save',()=>{saved++;return ok;});
ipcMain.handle('replay:capture-page',()=>{replaySaved++;return ok;});
ipcMain.handle('replay:list',()=>[]);
ipcMain.handle('bilan-history:list',()=>[]);
ipcMain.handle('candidate-catalog:list',()=>[]);
ipcMain.handle('candidate-catalog:sync',()=>ok);
ipcMain.handle('candidate-catalog:detail',()=>({ok:false}));
ipcMain.handle('candidate-catalog:workspace-save',()=>ok);
ipcMain.handle('candidate-catalog:end-bilan',()=>ok);
ipcMain.handle('ai:status',()=>({available:false}));
ipcMain.handle('ai:cancel-current',()=>ok);
ipcMain.handle('kaloneo-library:get-mask-screen',()=>({ok:false}));
ipcMain.handle('kaloneo-library:list-tests',()=>({ok:true,tests:[]}));
ipcMain.handle('kaloneo-library:list-mask-screens',()=>({ok:true,maskScreens:[]}));
const wait=t=>new Promise(resolve=>setTimeout(resolve,t));
const timeout=setTimeout(()=>{console.error('R48_10_REAL_PREVIEW: TIMEOUT');app.exit(2);},90000);
const fail=(error)=>{console.error('R48_10_REAL_PREVIEW: FAIL',error?.stack||String(error));app.exit(2);};
app.whenReady().then(async()=>{
 try{
  const win=new BrowserWindow({show:true,width:1366,height:768,webPreferences:{preload:path.join(root,'src','preload.js'),nodeIntegration:false,contextIsolation:true,sandbox:false}});
  win.webContents.on('preload-error',(_e,p,error)=>fail(new Error('Preload '+p+': '+error)));
  await win.loadFile(path.join(web,'kaltest-pilot2.html'),{query:{kaloneoPreview:'1'}});
  await wait(1100);
  const result=await win.webContents.executeJavaScript(`(()=>{
    const target=document.getElementById('kaltest-content');
    const selectors=[...target.querySelectorAll('select')];
    const photos=[...target.querySelectorAll('img.seb-media-image')];
    const bg=[...target.querySelectorAll('*')].filter(el=>getComputedStyle(el).backgroundImage.includes('r48-plateau-repas'));
    return {
      realCandidateEngine:Boolean(window.sebKaltestPilot2),
      testId:document.body.dataset.sebKaltestId,
      preview:document.body.classList.contains('kaloneo-real-candidate-preview'),
      title:document.getElementById('kaltest-title')?.textContent,
      phase:window.sebKaltestPilot2?.state?.phase,
      selectCount:selectors.length,
      selectValues:selectors.map(el=>el.value),
      photos:photos.map(el=>({src:el.getAttribute('src'),loaded:el.complete&&el.naturalWidth>0})),
      backgroundCount:bg.length,
      closeLabel:document.getElementById('kaltest-next')?.textContent,
      visible:document.getElementById('page-exercise')?.classList.contains('visible')
    };
  })()`);
  assert.equal(result.realCandidateEngine,true);
  assert.equal(result.testId,definition.id);
  assert.equal(result.preview,true);
  assert.equal(result.phase,'exercise');
  assert.equal(result.visible,true);
  assert.equal(result.selectCount,15);
  assert.equal(result.photos.length,1);
  assert.equal(result.photos[0].loaded,true,'restaurant candidate image not loaded');
  assert.ok(result.backgroundCount>0,'plateau background missing');
  assert.ok(result.closeLabel.includes('Fermer l’aperçu'),'close button label missing');
  const visibleExit=await win.webContents.executeJavaScript(`(()=>{
    const el=document.getElementById('kaloneo-builder-preview-exit');
    if(!el)return {exists:false};
    const r=el.getBoundingClientRect(), x=r.left+r.width/2, y=r.top+r.height/2;
    const bar=document.getElementById('seb-evalpro-topbar');
    return {exists:true,text:el.textContent,
      visible:getComputedStyle(el).display!=='none' && getComputedStyle(el).visibility==='visible',
      clickable:document.elementFromPoint(x,y)===el,
      position:[r.left,r.top,r.width,r.height], viewport:[innerWidth,innerHeight],
      toolbarHidden:!bar || getComputedStyle(bar).display==='none'};
  })()`);
  assert.equal(visibleExit.exists,true,'dedicated exit button missing');
  assert.equal(visibleExit.visible,true,'exit button invisible');
  assert.equal(visibleExit.clickable,true,'exit button cannot receive mouse clicks');
  assert.ok(visibleExit.position[1]<40 && visibleExit.position[2]>125,'exit should be visible top right');
  assert.equal(visibleExit.toolbarHidden,true,'admin toolbar should not cover candidate preview');
  console.log('R48_10_EXIT_BUTTON_VISIBLE=OK',JSON.stringify(visibleExit));

  assert.equal(saved,0,'preview must not save candidate state');
  assert.equal(replaySaved,0,'preview must not capture candidate replay');

  // Verify that the miniature is captured by the same real candidate engine
  // at precisely 1366×768 without the Windows taskbar constraining the page.
  const worker=new BrowserWindow({
    show:false,width:1366,height:768,useContentSize:true,frame:false,
    skipTaskbar:true,paintWhenInitiallyHidden:true,
    webPreferences:{preload:path.join(root,'src','preload.js'),
      nodeIntegration:false,contextIsolation:true,sandbox:false,
      offscreen:true,backgroundThrottling:false}
  });
  const bounds=worker.getContentBounds();
  const factor=Math.min(1,bounds.width/1366,bounds.height/768);
  worker.webContents.setZoomFactor(factor);
  worker.setContentSize(Math.round(1366*factor),Math.round(768*factor));
  await worker.loadFile(path.join(web,'kaltest-pilot2.html'),{query:{kaloneoPreview:'1'}});
  worker.webContents.setZoomFactor(factor);
  const snapMetrics=await worker.webContents.executeJavaScript(`(async()=>{
    await document.fonts.ready;
    await Promise.all([...document.images].map(img=>img.complete?
      Promise.resolve():new Promise(resolve=>{
        img.addEventListener('load',resolve,{once:true});
        img.addEventListener('error',resolve,{once:true});
      })));
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const grid=document.querySelector('.kaltest-builder-grid');
    const zones=[...document.querySelectorAll('.kaltest-builder-runtime-zone')];
    return {
      width:innerWidth,height:innerHeight,
      real:!!window.sebKaltestPilot2 && document.body.classList.contains('kaloneo-real-candidate-preview'),
      questions:document.querySelectorAll('#kaltest-content select').length,
      friday:[...grid.querySelectorAll('th')].some(h=>h.textContent==='Vendredi'),
      equal:grid.classList.contains('kaltest-builder-grid-equal-auto'),
      widths:[...grid.querySelectorAll('th')].map(h=>h.getBoundingClientRect().width),
      right:[...grid.querySelectorAll('th')].map(h=>h.getBoundingClientRect().right),
      zoneRight:zones[0]?.getBoundingClientRect().right,
      gridOverflow:grid.scrollWidth-grid.clientWidth,
      zoneOverflow:zones[0]?.scrollWidth-zones[0]?.clientWidth,
      clipped:[...grid.querySelectorAll('select')].filter(s=>s.getBoundingClientRect().right>s.parentElement.getBoundingClientRect().right+1).length,
      overflowZones:zones.filter(z=>z.scrollWidth>z.clientWidth+2||z.scrollHeight>z.clientHeight+2).length
    };
  })()`,true);
  assert.equal(snapMetrics.real,true);
  console.log('R48_10_DEBUG_VIEWPORT',JSON.stringify({factor,bounds,
    contentBounds:worker.getContentBounds(),zoom:worker.webContents.getZoomFactor(),
    metrics:snapMetrics}));
  assert.ok(Math.abs(snapMetrics.width-1366)<=2 && Math.abs(snapMetrics.height-768)<=2,
    'hidden Window must use full candidate CSS resolution');
  assert.equal(snapMetrics.questions,15);
  assert.equal(snapMetrics.friday,true);
  assert.equal(snapMetrics.equal,true,'automatic Builder columns must be equal independent of test ID');
  assert.equal(snapMetrics.widths.length,6,'six columns');
  assert.ok(Math.max(...snapMetrics.widths)-Math.min(...snapMetrics.widths)<=2,'unequal columns '+JSON.stringify(snapMetrics.widths));
  assert.ok(snapMetrics.right[5]<=snapMetrics.zoneRight+2,'Friday clipped');
  assert.ok(snapMetrics.gridOverflow<=2 && snapMetrics.zoneOverflow<=2,'horizontal scrolling');
  assert.equal(snapMetrics.clipped,0,'dropdown clipped in its own cell');
  console.log('R48_10_GENERIC_AUTO_WIDTH=OK',JSON.stringify(snapMetrics));
  const picture=await worker.webContents.capturePage();
  assert.ok(!picture.isEmpty(),'candidate miniature screenshot is empty');
  const size=picture.getSize();
  assert.ok(Math.abs(size.width/size.height-1366/768)<0.025,
    'candidate miniature screenshot was cropped by Windows');
  assert.equal(saved,0,'rendering the miniature must not save candidate state');
  definition.presentation.builderContent[0].table.columns[1].widthChars=12;
  await worker.loadFile(path.join(web,'kaltest-pilot2.html'),{query:{kaloneoPreview:'1'}});
  worker.webContents.setZoomFactor(factor);
  const manual=await worker.webContents.executeJavaScript(`(()=>{
    const grid=document.querySelector('.kaltest-builder-grid');
    return {equal:grid.classList.contains('kaltest-builder-grid-equal-auto'),
      manualWidth:grid.querySelectorAll('th')[1]?.style.width};
  })()`);
  assert.equal(manual.equal,false,'manual width must override automatic widths');
  assert.equal(manual.manualWidth,'12ch','Builder character width must be preserved');
  assert.equal(saved,0,'no candidate state may be persisted in preview');
  console.log('R48_10_MANUAL_WIDTH=OK',JSON.stringify(manual));
  worker.destroy();
  // The full-screen transition must be reversible by an Admin preview close.
  win.setFullScreen(true);
  win.setKiosk(true);
  assert.ok(win.isFullScreen()||win.isKiosk(),'candidate-size fullscreen not enabled');
  win.setKiosk(false);
  win.setFullScreen(false);
  console.log('R48_10_MINI_REAL_CAPTURE=OK',
    JSON.stringify({viewport:[snapMetrics.width,snapMetrics.height],
      screenshot:[size.width,size.height],selects:snapMetrics.questions,
      overflowZones:snapMetrics.overflowZones,saved,replaySaved}));
  await win.webContents.executeJavaScript("document.getElementById('kaloneo-builder-preview-exit').click()");
  await wait(180);
  assert.equal(closed,1,'visible exit button not wired');
  await win.webContents.reload();
  await wait(700);
  await win.webContents.executeJavaScript(
    "document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}))");
  await wait(180);
  assert.equal(closed,2,'Escape shortcut must close full-screen preview');
  assert.equal(saved,0,'close preview must not save candidate state');
  console.log('R48_10_REAL_CANDIDATE_PREVIEW: OK',JSON.stringify({selects:result.selectCount,image:result.photos[0].src,background:result.backgroundCount,saved,closed}));
  clearTimeout(timeout);win.destroy();app.quit();
 }catch(e){fail(e);}
}).catch(fail);
