'use strict';
const {app,BrowserWindow,ipcMain}=require('electron');
const path=require('node:path'),fs=require('node:fs'),assert=require('node:assert/strict');
let metadata=[],smokeState={},captured=null,revision=null,wordHtml='';
const deadline=setTimeout(()=>{console.error('BILAN_FILTER_ELECTRON_TIMEOUT');app.exit(2)},60000);
ipcMain.on('app:edition-sync',event=>{event.returnValue={edition:'admin',canBilan:true,canAi:true,canImport:true,canExport:true}});
ipcMain.on('state:load-sync',event=>{event.returnValue=smokeState});
ipcMain.on('state:save-sync',(event,payload)=>{smokeState={...smokeState,...(payload||{})};event.returnValue={ok:true,state:smokeState}});
ipcMain.on('candidate-catalog:workspace-load-sync',event=>{event.returnValue={ok:false}});
ipcMain.on('candidate-catalog:results-workspace-load-sync',event=>{event.returnValue={ok:false}});
ipcMain.on('candidate-catalog:workspace-save-sync',event=>{event.returnValue={ok:true}});
ipcMain.on('kaloneo-library:test-metadata-sync',event=>{event.returnValue={ok:true,tests:metadata}});

ipcMain.handle('state:save',(_event,payload)=>{smokeState={...smokeState,...(payload||{})};return{ok:true,state:smokeState}});
ipcMain.handle('admin:status',()=>true);
ipcMain.handle('admin:verify',()=>true);
ipcMain.handle('admin:verify-password',()=>false);
ipcMain.handle('admin:lock',()=>true);
ipcMain.handle('admin:open-bilan',()=>false);
ipcMain.handle('admin:open-candidate-results',()=>false);
ipcMain.handle('admin:return-evaluation',()=>false);
ipcMain.handle('admin:close-session',()=>false);
ipcMain.handle('ai:status',()=>({available:false,offline:true}));
ipcMain.handle('ai:rewrite-synthesis',()=>({ok:false}));

ipcMain.handle('bilan-history:save-current',(_event,payload)=>{captured=payload.document;return{ok:true,filename:'test.json'}});
ipcMain.handle('bilan-history:save-revision',(_event,payload)=>{revision=payload.document;return{ok:true,filename:'test.json',revision:0}});
ipcMain.on('bilan-history:get-word-template-sync',event=>{event.returnValue={ok:true,html:fs.readFileSync(path.join(__dirname,'..','app','web','admin-bilan.html'),'utf8')}});
ipcMain.on('bilan-history:write-word-sync',(event,payload)=>{wordHtml=payload.html;event.returnValue={ok:true,filename:'test.sebdoc'}});
app.on('window-all-closed',()=>{}); // Plusieurs fenêtres testées successivement.
ipcMain.handle('candidate:active',()=>null);
app.commandLine.appendSwitch('disable-gpu');
const pause=()=>new Promise(resolve=>setTimeout(resolve,700));
app.whenReady().then(async()=>{
 let win;
 try{
  const custom={id:'math-future-abandonnee',version:'1.0.0',title:'Maths abandonnées',category:'mathematiques',adminModified:true,
   bilanContributions:[{lineId:'bilan.savoirs_fondamentaux.mathematiques.resoudre_problemes',bindings:{score:'score',score_max:'score_max'}}]};
  for(const onlyAbandoned of [false,true]){
   metadata=onlyAbandoned?[custom]:[{id:'calculs_commandes_atelier',category:'mathematiques'},custom,{id:'conversions_atelier_expedition',category:'mathematiques'}];
   smokeState={version:1,sessionStorage:{
    candidat_data:JSON.stringify({nom:'TEST',prenom:'FILTRE',date:'2026-10-26'}),
    seb_kaloneo_results_manifest:JSON.stringify({tests:metadata}),
    seb_kaltest_pilot2_state_v1:JSON.stringify({tests:{
     calculs_commandes_atelier:{status:'COMPLETED',result:{score:2,scoreMax:3}},
     conversions_atelier_expedition:{status:'COMPLETED',result:{score:4,scoreMax:5}},
     'math-future-abandonnee':{status:'ABANDONED'},
     redaction_email:{status:'COMPLETED',result:{score:6,scoreMax:6}}
    }})},localStorage:{},lastPage:'admin-bilan.html'};
   win=new BrowserWindow({show:false,width:1366,height:768,webPreferences:{preload:path.join(__dirname,'bilan-parcours-filter-test-preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:false}});
   await win.loadFile(path.join(__dirname,'..','app','web','admin-bilan.html'));await pause();
   const visible=await win.webContents.executeJavaScript(`(()=>({rows:window.SEB_KALONEO_BILAN.visibleInstitutionalRows(),sections:[...document.querySelectorAll('#bilan tr.section,#bilan tr.section2')].filter(r=>!r.hidden).map(r=>r.textContent.trim())}))()`);
   const expected=onlyAbandoned?['math-problemes']:['math-enonce','math-problemes'];
   assert.deepEqual(visible.rows,expected);
   assert.deepEqual(visible.sections,['Savoirs fondamentaux']);
   await win.webContents.executeJavaScript("document.getElementById('auto').click();document.getElementById('save').click()");await pause();
   assert(captured,'Le bouton Enregistrer doit capturer le bilan réel.');
   assert.deepEqual(captured.rows.filter(r=>r.kind==='item').map(r=>r.key),expected);
   assert.equal(captured.rows.filter(r=>r.kind==='section').length,1);
   if(onlyAbandoned){
    assert.equal(captured.rows.find(r=>r.key==='math-problemes').level,'NE');
   }else{
    assert.deepEqual(captured.rows.filter(r=>r.kind==='item').map(r=>[r.points,r.possible]),[[2,3],[4,5]]);
   }
   assert.equal(captured.parcoursTests.length,metadata.length,'Les liaisons du parcours doivent être figées avec le bilan.');
   await win.webContents.executeJavaScript(`window.bilanFilterTest.open(${JSON.stringify({candidate:{nom:'TEST',prenom:'FILTRE'},originalBuild:181,document:captured})})`);
   await win.webContents.executeJavaScript("document.getElementById('seb-bh-save-revision').click()");await pause();
   assert.deepEqual(revision.rows.filter(r=>r.kind==='item').map(r=>[r.key,r.points,r.possible]),captured.rows.filter(r=>r.kind==='item').map(r=>[r.key,r.points,r.possible]),'La révision doit conserver les points.');
   assert.deepEqual(revision.parcoursTests,captured.parcoursTests);
   await win.webContents.executeJavaScript("document.getElementById('seb-bh-export').click()");await pause();
   assert(wordHtml,'Le Word du bilan courant doit être produit.');
   assert.deepEqual([...wordHtml.matchAll(/data-r="([^"]+)"/g)].map(m=>m[1]),expected,'Le Word ne doit pas réintroduire les lignes du modèle complet.');
   assert(!wordHtml.includes('Messagerie électronique')&&!wordHtml.includes('Expression écrite'));
   win.destroy();win=null;
  }
  // Comparaison de la vraie grille complète avant/après sauvegarde : mêmes
  // dimensions, gras/italiques, seuils, couleurs et mesures, à largeur égale.
  metadata=[];smokeState={version:1,sessionStorage:{candidat_data:JSON.stringify({nom:'TEST',prenom:'GRILLE'})},localStorage:{},lastPage:'admin-bilan.html'};
  win=new BrowserWindow({show:false,width:1366,height:900,webPreferences:{preload:path.join(__dirname,'bilan-parcours-filter-test-preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:false}});
  await win.loadFile(path.join(__dirname,'..','app','web','admin-bilan.html'));await pause();
  const initialPlacement=await win.webContents.executeJavaScript(`(()=>{const tr=document.querySelector('[data-r="tri-erreurs"]'),e=document.getElementById('triErr');const tools=document.querySelector('.bilan-bottom-actions .tools');return {column:e.closest('td').cellIndex,title:tr.cells[0].textContent.trim(),errors:e.textContent,position:getComputedStyle(document.querySelector('.bilan-bottom-actions')).position,buttons:[...tools.querySelectorAll('button')].map(b=>b.id)}})()`);
  assert.deepEqual(initialPlacement,{column:5,title:'Nombre d’erreurs effectuées',errors:'0 erreur',position:'fixed',buttons:['auto','save','word','close-bilan-top']},'Compteur à droite, barre des actions fixée en bas.');
  // Régression toutes rubriques : niveau I vert, ancien menu II (copie d'un
  // état incohérent). Sauvegarder doit réaligner les 18 commentaires sans
  // changer le niveau, et sans désactiver les appréciations manuelles.
  const allRows=await win.webContents.executeJavaScript(`(()=>{
   const rows=[...document.querySelectorAll('#bilan tbody tr[data-r]')];
   for(const tr of rows.filter(x=>x.querySelector('.csel'))){
    const select=tr.querySelector('.csel');
    const i=[...select.options].find(o=>o.dataset.l==='I');
    const ii=[...select.options].find(o=>o.dataset.l==='II');
    if(!i||!ii)throw new Error('Option institutionnelle absente : '+tr.dataset.r);
    tr.dataset.level='I';tr.querySelectorAll('.level').forEach(c=>c.classList.toggle('on',c.dataset.l==='I'));
    select.value=ii.value; // le bug de la capture (vert I, phrase II)
   }
   const eligible=rows.filter(tr=>tr.querySelector('.csel'));
   const initial=eligible.filter(tr=>tr.querySelector('.csel').selectedOptions[0]?.dataset.l!=='I').length;
   document.getElementById('save').click();
   return {count:rows.length,eligible:eligible.length,initial,
    remaining:eligible.filter(tr=>tr.querySelector('.csel').selectedOptions[0]?.dataset.l!=='I').map(tr=>tr.dataset.r)};
  })()`);await pause();
  assert.equal(allRows.count,18,'Toutes les rubriques officielles doivent être contrôlées.');
  assert.equal(allRows.eligible,17,'Tri temps a cinq durées mais aucune liste de commentaire.');
  assert.equal(allRows.initial,17,'La régression I/II doit être réellement reproduite.');
  assert.deepEqual(allRows.remaining,[],'Tous les niveaux doivent avoir le commentaire de la bonne couleur.');
  assert.equal(captured.rows.filter(r=>r.kind==='item').length,18);
  for(const row of captured.rows.filter(r=>r.kind==='item')){
   if(!row.options.some(o=>o.level==='I'))continue; // Tri temps n'a pas de menu.
   const opt=row.options.find(o=>o.value===row.preset);
   assert.equal(row.level,'I','Le niveau validé reste I : '+row.key);
   assert.equal(opt?.level,'I','La capture archive le bon commentaire : '+row.key);
  }
  const times=[5,8,11,7,9].map((s,i)=>'N°'+(i+1)+' : 00 min '+String(s).padStart(2,'0')+' s').join('\n');
  await win.webContents.executeJavaScript(`(()=>{
   document.querySelector('#bilan').style.width='1100px';
   document.querySelector('#triTimes').innerText=${JSON.stringify(times)};
   document.querySelector('#triAvg').textContent='00:08';document.querySelector('#triErr').textContent='2 erreurs';
   const reliability=document.querySelector('[data-r="tri-erreurs"] .csel');reliability.value=[...reliability.options].find(o=>o.dataset.l==='I').value;reliability.dispatchEvent(new Event('change',{bubbles:true}));
   document.querySelector('[data-r="briques-identification"] .detail').textContent='Temps : 06:23';
   document.querySelector('[data-r="briques-manipulation"] .detail').textContent='1 erreur';
   document.getElementById('save').click();
  })()`);await pause();
  assert.equal(captured.rows.filter(r=>r.kind==='item').length,18);
  assert.equal(captured.rows.find(r=>r.key==='tri-temps').triTimes,times);
  const measure=`table=>[...table.querySelectorAll('tbody tr')].map(tr=>({height:tr.getBoundingClientRect().height,cells:[...tr.cells].map(td=>({width:td.getBoundingClientRect().width,bold:td.querySelectorAll('b').length,italic:td.querySelectorAll('i').length,background:getComputedStyle(td).backgroundColor,font:getComputedStyle(td).fontSize,padding:getComputedStyle(td).padding})),thresholds:[...tr.querySelectorAll('.level')].map(x=>x.textContent.trim())}))`;
  const before=await win.webContents.executeJavaScript(`(${measure})(document.querySelector('#bilan'))`);
  let archived=JSON.parse(JSON.stringify(captured));
  const oldErrorRow=archived.rows.find(r=>r.key==='tri-erreurs');oldErrorRow.comment=oldErrorRow.preset; // ancien éditeur : copie redondante du choix
  // Une archive historique peut encore conserver une phrase II avec niveau I.
  // Le rendu du bilan enregistre et son export ne doivent jamais la propager.
  for(const row of archived.rows.filter(r=>r.kind==='item')){
   row.preset=row.options.find(o=>o.level==='II')?.value||row.preset;
   row.comment=row.preset; // historique où l'ancien choix avait été recopié
  }
  for(let cycle=0;cycle<2;cycle++){
   await win.webContents.executeJavaScript(`window.bilanFilterTest.open(${JSON.stringify({candidate:{nom:'TEST',prenom:'GRILLE'},originalBuild:182,document:archived})})`);
   await win.webContents.executeJavaScript("document.querySelector('#seb-bh-institutional-table').style.width='1100px'");
   const after=await win.webContents.executeJavaScript(`(${measure})(document.querySelector('#seb-bh-institutional-table'))`);
   assert.deepEqual(after,before,'La grille enregistrée doit conserver exactement la géométrie et la mise en forme validées.');
   const coherence=await win.webContents.executeJavaScript(`(()=>[...document.querySelectorAll('#seb-bh-institutional-table tr[data-r]')].map(tr=>({key:tr.dataset.r,color:tr.querySelector('.level.on')?.dataset.l,comment:tr.querySelector('.csel')?.selectedOptions[0]?.dataset.l})))()`);
   assert.equal(coherence.length,18);
   for(const row of coherence)if(row.comment!==undefined)assert.equal(row.comment,row.color,'Bilan enregistre I/II incoherent : '+row.key);
   const tri=await win.webContents.executeJavaScript(`(()=>{const table=document.querySelector('#seb-bh-institutional-table');return {times:table.querySelector('#triTimes').innerText,average:table.querySelector('#triAvg').textContent,errors:table.querySelector('#triErr').textContent,errorColumn:table.querySelector('#triErr').closest('td').cellIndex,emptyTextareas:table.querySelectorAll('textarea').length}})()`);
   assert.deepEqual(tri,{times,average:'00:08',errors:'2 erreurs',errorColumn:5,emptyTextareas:0});
   for(const level of ['II','I']){
    const selection=await win.webContents.executeJavaScript(`(()=>{const r=document.querySelector('#seb-bh-institutional-table [data-r="tri-erreurs"]'),s=r.querySelector('select');s.value=[...s.options].find(o=>o.dataset.l==='${level}').value;s.dispatchEvent(new Event('change',{bubbles:true}));return r.querySelector('.level.on').dataset.l})()`);
    assert.equal(selection,level,'Le changement de commentaire synchronise le niveau.');
   }
   await win.webContents.executeJavaScript("document.getElementById('seb-bh-save-revision').click()");await pause();
   assert.equal(revision.rows.find(r=>r.key==='tri-temps').triTimes,times);
   assert.equal(revision.rows.find(r=>r.key==='tri-erreurs').triErrors,'2 erreurs');
   for(const row of revision.rows.filter(r=>r.kind==='item'&&r.options.some(o=>o.level==='I')))
    assert.equal(row.options.find(o=>o.value===row.preset)?.level,row.level,
      'La sauvegarde de la revision doit rectifier le commentaire : '+row.key);
   const footer=await win.webContents.executeJavaScript(`(()=>{const w=document.querySelector('.seb-bh-editor-card'),body=w.querySelector('.seb-bh-editor-body'),f=w.querySelector('.seb-bh-editor-foot');body.scrollTop=body.scrollHeight;return {footerVisible:f.getBoundingClientRect().bottom<=innerHeight,bodyScroll:body.scrollTop,footerBelowBody:f.getBoundingClientRect().top>=body.getBoundingClientRect().bottom-1}})()`);
   assert(footer.footerVisible&&footer.footerBelowBody,'Les boutons enregistrer / Word / fermer restent visibles en bas du bilan enregistré.');
   assert.equal(revision.rows.find(r=>r.key==='briques-identification').detail,'Temps : 06:23');
   await win.webContents.executeJavaScript("document.getElementById('seb-bh-export').click()");await pause();
   assert(wordHtml.includes('00:08')&&wordHtml.includes('2 erreurs'));
   const wordRow=wordHtml.split('data-r="tri-erreurs"')[1]?.split('</tr>')[0]||'';
   assert(wordRow.includes('id="triErr"')&&wordRow.includes('2 erreurs'),
    'Le Word doit placer le compteur dans la colonne Commentaires.');
   assert(!wordRow.includes('</b><br><span id="triErr"'),
    'La première colonne Word ne doit pas contenir un saut suivi du compteur.');
   assert(wordHtml.includes(revision.rows.find(r=>r.key==='tri-erreurs').preset),'Le commentaire validé doit rester dans le Word.');
   for(const line of times.split('\n'))assert(wordHtml.includes(line),'Le Word doit garder chaque temps : '+line);
   archived=JSON.parse(JSON.stringify(revision));
   await win.webContents.executeJavaScript("document.getElementById('seb-bilan-history-editor').remove()");
  }
  win.destroy();win=null;
  console.log('BILAN_FILTER_ELECTRON=OK — maths seules, abandon seul, sections, capture réelle, éditeur, conservation des points et Word filtré');
  clearTimeout(deadline);app.exit(0);
 }catch(error){console.error(error.stack||error);clearTimeout(deadline);if(win)win.destroy();app.exit(2)}
});
