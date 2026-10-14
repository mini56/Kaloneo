'use strict';
const {app,BrowserWindow,ipcMain}=require('electron');
const assert=require('node:assert/strict');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
// Tous les IDs sont imaginaires, avec des définitions neuves. Ce contrôle
// vérifie les structures enregistrées, et non des exceptions sur des V1.
const tests=[
  {id:'future_text_2060',version:'2.0.0',title:'Écrit futur',category:'tic',scored:true},
  {id:'future_reflection_2060',version:'2.0.0',title:'Réflexion future',category:'autoevaluation',scored:false},
  {id:'future_brix_2060',version:'2.0.0',title:'Assemblage futur',category:'technique',scored:false},
  {id:'future_sort_2060',version:'2.0.0',title:'Tri futur',category:'technique',scored:false},
  {id:'future_message_2060',version:'2.0.0',title:'Message futur',category:'communication',scored:true}
];
const formId='question_of_future';
const definitions={
 future_reflection_2060:{presentation:{autoevaluationForm:{
   questionId:formId,commentFieldId:'commentaire',
   statements:[{value:'progress_code_2060',label:'Le candidat se sent plus à l’aise dans les tâches proposées.'}],
   groups:[{title:'Ressenti personnel',values:['progress_code_2060']}]
 }},questions:[{id:formId,prompt:'Ressenti du candidat'}]},
 future_brix_2060:{presentation:{bricksStation:{autoStatements:[
   {value:'future_bricks_feedback',label:'J’ai terminé l’assemblage avec difficulté.'}
 ]}}},
 future_sort_2060:{presentation:{triStation:{autoStatements:[
   {value:'future_sort_feedback',label:'Je me suis amélioré pendant mes tris.'}
 ]}}},
 future_message_2060:{presentation:{mailComposer:{fields:{
   to:'to_code',cc:'cc_code',subject:'subject_code',signature:'body_code',
   phone:'phone_code',file:'attachment_code'
 }}},questions:[]}
};
const snapshot={
 version:1,
 sessionStorage:{
  seb_kaloneo_results_manifest:JSON.stringify({
   schemaVersion:1,parcoursId:'parcours_future_2060',
   parcoursTitle:'Parcours synthétique sans ancien test',tests
  }),
  candidat_data:JSON.stringify({nom:'EXEMPLE',prenom:'FICTIF'}),
  seb_kaltest_pilot2_state_v1:JSON.stringify({tests:{
   future_text_2060:{
    status:'COMPLETED',
    answers:{text_editor_html:'<p><strong>HTML_RAW_NEVER_SHOW</strong></p>',
      text_editor_text:'MON_TEXTE_VISIBLE\nDeuxième ligne du candidat'},
    result:{score:3,scoreMax:8,percentage:37.5,details:{}}
   },
   future_reflection_2060:{
    status:'COMPLETED',
    answers:{[formId]:['progress_code_2060']},
    supplemental:{[formId]:{commentaire:'COMMENTAIRE_PERSONNEL_VISIBLE'}},
    result:{score:0,scoreMax:0,details:{
      [formId]:{value:['progress_code_2060'],correct:false,points:0}
    }}
   },
   future_brix_2060:{
    status:'COMPLETED',answers:{brique_ready:'1'},
    brique:{chronoSeconds:140,errors:3,autoSelections:['future_bricks_feedback'],
      commentaire:'COMMENTAIRE_BRIQUES_VISIBLE'},
    result:{score:0,scoreMax:0,details:{},
      bricks:{temps:140,erreurs:3,autoevaluation:{
        selections:['future_bricks_feedback'],commentaire:'COMMENTAIRE_BRIQUES_VISIBLE'
      }}}
   },
   future_sort_2060:{
    status:'COMPLETED',answers:{future_ready:'1'},tri:{rows:[{seconds:65,errors:2},
      {seconds:92,errors:1},{seconds:130,errors:0}],autoSelections:['future_sort_feedback'],
      commentaire:'COMMENTAIRE_TRI_VISIBLE'},
    result:{score:0,scoreMax:0,details:{future_ready:{value:'1',correct:false,points:0}},
      tri:{completedCount:3,temps_moyen:96,erreurs_total:3,moyenne_erreurs:1,
        temps_essais:[65,92,130]}}
   },
   future_message_2060:{
    status:'COMPLETED',answers:{
      to_code:'destinataire@example.org',cc_code:'copie@example.org',
      subject_code:'OBJET_MESSAGE_VISIBLE',attachment_code:'Fichier-test.docx',
      body_code:'BONJOUR_MESSAGE_COMPLET\nMerci, signé',
      phone_code:'BONJOUR_MESSAGE_COMPLET\nMerci, signé'
    },
    result:{score:4,scoreMax:6,percentage:66,details:{}}
   }
  }})
 },
 localStorage:{},lastPage:'qcmv1.0.html'
};
ipcMain.on('app:edition-sync',e=>e.returnValue={edition:'admin',canBilan:true,canAi:true,canImport:true,canExport:true});
ipcMain.on('state:load-sync',e=>e.returnValue=snapshot);
ipcMain.on('state:save-sync',e=>e.returnValue={ok:true});
ipcMain.on('kaloneo-library:test-metadata-sync',e=>e.returnValue={ok:true,tests});
ipcMain.on('candidate-catalog:results-workspace-load-sync',e=>e.returnValue={
 ok:true,state:snapshot,candidateId:'future-person-2060'
});
ipcMain.on('candidate-catalog:workspace-load-sync',e=>e.returnValue={ok:false});
ipcMain.handle('kaloneo-library:get-test',(_e,payload)=>{
 const item=tests.find(t=>t.id===payload?.id&&t.version===payload?.version);
 return item?{ok:true,definition:{...item,...definitions[item.id]}}:{ok:false};
});
ipcMain.handle('admin:status',()=>true);
ipcMain.handle('admin:verify',()=>true);
ipcMain.handle('admin:lock',()=>true);
ipcMain.handle('state:save',()=>({ok:true}));
const timer=setTimeout(()=>{console.error('KALONEO_RESULTS_READABLE: TIMEOUT');app.exit(2);},45000);
function fail(e){console.error('KALONEO_RESULTS_READABLE: FAIL',e?.stack||e);app.exit(2);}
app.whenReady().then(async()=>{
 try{
  const win=new BrowserWindow({show:false,width:1366,height:768,
   webPreferences:{preload:path.join(root,'src','preload.js'),
    contextIsolation:true,nodeIntegration:false,sandbox:false}});
  await win.loadFile(path.join(root,'app','web','qcmv1.0.html'));
  await new Promise(r=>setTimeout(r,350));
  const inspect=()=>{
   const cards=[...document.querySelectorAll('article[data-test-id]')];
   const byId=Object.fromEntries(cards.map(c=>[c.dataset.testId,c.textContent]));
   const body=document.body,html=document.documentElement;
   return {
    byId,count:cards.length,heading:document.querySelector('.visible h2')?.textContent,
    currentlyVisible:document.querySelector('.page.visible')?.id,
    hiddenBody:html.style.visibility==='hidden',
    htmlRaw:body.textContent.includes('HTML_RAW_NEVER_SHOW'),
    realHtmlElement:[...cards].some(c=>c.querySelector('strong')?.textContent==='HTML_RAW_NEVER_SHOW'),
    workNote:document.getElementById('seb-admin-results-readonly')?.textContent,
    beforePage:document.getElementById('page0')?.classList.contains('visible')
   };
  };
  const read=await win.webContents.executeJavaScript('('+inspect.toString()+')()',true);
  assert.equal(read.count,5,JSON.stringify(read));
  assert.equal(read.hiddenBody,false,'Page bloquée invisible');
  assert.equal(read.currentlyVisible,'pageFinale','Ancienne page affichée');
  assert.equal(read.beforePage,false,'Ancienne page 0 active');
  const text=read.byId.future_text_2060;
  assert(text.includes('MON_TEXTE_VISIBLE')&&text.includes('Deuxième ligne'));
  assert(!text.includes('text_editor_html')&&!read.htmlRaw,'Le HTML brut a été affiché');
  const a=read.byId.future_reflection_2060;
  assert(a.includes('Ressenti personnel')&&a.includes('Le candidat se sent plus à l’aise'));
  assert(a.includes('COMMENTAIRE_PERSONNEL_VISIBLE'));
  assert(!a.includes('✗'),'Une autoévaluation a été corrigée à tort');
  const b=read.byId.future_brix_2060;
  assert(b.includes('02:20')&&b.includes('Nombre d’erreurs : 3'));
  assert(b.includes('COMMENTAIRE_BRIQUES_VISIBLE'));
  assert(b.includes('J’ai terminé l’assemblage avec difficulté.'));
  assert(!b.includes('brique_ready'));
  const tri=read.byId.future_sort_2060;
  assert(tri.includes('01:05')&&tri.includes('01:32')&&tri.includes('02:10'));
  assert(tri.includes('Temps moyen : 01:36'));
  assert(tri.includes('Total des erreurs : 3'));
  assert(tri.includes('Moyenne des erreurs par tri : 1'));
  assert(tri.includes('COMMENTAIRE_TRI_VISIBLE'));
  assert(tri.includes('Je me suis amélioré pendant mes tris.'));
  assert(!tri.includes('tri_ready'),'État technique affiché au candidat');
  const mail=read.byId.future_message_2060;
  assert(mail.includes('OBJET_MESSAGE_VISIBLE')&&mail.includes('BONJOUR_MESSAGE_COMPLET'));
  assert.equal(mail.split('BONJOUR_MESSAGE_COMPLET').length-1,1,'Message en double');
  for(const [id,value] of Object.entries(read.byId)){
   if(id!=='future_message_2060')assert(!value.includes('BONJOUR_MESSAGE_COMPLET'),
     'Mail contaminant '+id);
  }
  console.log('KALONEO_RESULTS_READABLE_FORMATS_ELECTRON: OK',JSON.stringify({
    cases:read.count,triTimes:true,bricks:true,autoLabels:true,mailBody:true,
    editorWithoutHtml:true,showResultsOnly:true
  }));
  clearTimeout(timer);win.destroy();app.quit();
 }catch(e){fail(e);}
}).catch(fail);
