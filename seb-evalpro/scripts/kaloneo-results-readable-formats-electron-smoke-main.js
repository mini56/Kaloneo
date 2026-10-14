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
  {id:'future_message_2060',version:'2.0.0',title:'Message futur',category:'communication',scored:true},
  {id:'future_placements_2060',version:'2.0.0',title:'Rangement futur',category:'organisation',scored:true},
  {id:'future_fractions_2060',version:'2.0.0',title:'Fractions inédites',category:'math',scored:true}
];
const formId='question_of_future';
const definitions={
 future_text_2060:{evaluation:{nwtexteRules:true,scoreMax:8},
  presentation:{builderContent:[{type:'text-editor'}]}},
 future_fractions_2060:{questions:[
  {id:'f_count_1',prompt:'Choisir une partie 3/4',response:{type:'multiple-choice'},acceptedCount:3},
  {id:'f_count_2',prompt:'Choisir une partie 1/2',response:{type:'multiple-choice'},acceptedCount:3},
  {id:'f_count_3',prompt:'Choisir une partie 2/8',response:{type:'multiple-choice'},acceptedCount:3}
 ],presentation:{fractionSelection:{groups:[
  {questionId:'f_count_1',totalItems:4},
  {questionId:'f_count_2',totalItems:6},
  {questionId:'f_count_3',totalItems:12}
 ]}}},
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
 future_placements_2060:{presentation:{stockBoard:{
   pots:Array.from({length:33},(_,i)=>({id:i+1,code:'Demo'+(i+1),
     percentage:20+i,questionId:'pot_future_'+(i+1),example:false})),
   shelves:[{id:1,title:'Casier de démonstration',levels:[{id:2,label:'Niveau intermédiaire',cases:10}]}]
  }},questions:Array.from({length:33},(_,i)=>({
   id:'pot_future_'+(i+1),prompt:'Flacon démo '+(i+1)
  }))},
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
    result:{score:3,scoreMax:8,percentage:37.5,details:{},textEditor:{analyse:{score:{
      titre_present:1,titre_gras:0,titre_police:0,titre_taille:0,
      texte_lignes:1,texte_police:0,texte_taille:0,enregistrement:1,total:3
    }}}}
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
   future_placements_2060:{
    status:'COMPLETED',
    answers:Object.fromEntries(Array.from({length:33},(_,i)=>[
      'pot_future_'+(i+1), i===0?'case:1:2:1':'source'
    ])),
    result:{score:1,scoreMax:33,percentage:100/33,
      details:Object.fromEntries(Array.from({length:33},(_,i)=>[
        'pot_future_'+(i+1),{value:i===0?'case:1:2:1':'source',correct:i===0,points:i===0?1:0}
      ]))}
   },
   future_fractions_2060:{
    status:'COMPLETED',
    answers:{f_count_1:['1','2','3'],f_count_2:['1','3'],f_count_3:[]},
    result:{score:1,scoreMax:3,percentage:100/3,details:{
      f_count_1:{value:['1','2','3'],correct:true,points:1},
      f_count_2:{value:['1','3'],correct:false,points:1},
      f_count_3:{value:[],correct:false,points:1}
    }}
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
    beforePage:document.getElementById('page0')?.classList.contains('visible'),
    criteria:[...document.querySelectorAll('article[data-test-id="future_text_2060"] [data-criterion-status]')]
      .map(n=>({name:n.previousElementSibling?.textContent,value:n.dataset.criterionStatus})),
    stockDetailsOpen:document.querySelector('article[data-test-id="future_placements_2060"] .seb-report-stock-details')?.open,
    stockDetailsRows:document.querySelectorAll('article[data-test-id="future_placements_2060"] .seb-report-stock-details tr').length
   };
  };
  const read=await win.webContents.executeJavaScript('('+inspect.toString()+')()',true);
  assert.equal(read.count,7,JSON.stringify(read));
  assert.equal(read.hiddenBody,false,'Page bloquée invisible');
  assert.equal(read.currentlyVisible,'pageFinale','Ancienne page affichée');
  assert.equal(read.beforePage,false,'Ancienne page 0 active');
  const text=read.byId.future_text_2060;
  assert(text.includes('MON_TEXTE_VISIBLE')&&text.includes('Deuxième ligne'));
  assert(!text.includes('text_editor_html')&&!read.htmlRaw,'Le HTML brut a été affiché');
  assert(text.includes('Détail des critères de notation'),'Critères NWTEXT absents');
  assert.equal(read.criteria.length,8,'Il manque des critères NWTEXT');
  assert.equal(read.criteria.filter(n=>n.value==='valid').length,3,'La notation NWTEXT a été altérée');
  assert.equal(read.criteria.filter(n=>n.value==='invalid').length,5,'Les échecs NWTEXT sont masqués');
  assert(read.criteria.some(n=>n.name==='Titre en gras'&&n.value==='invalid'));
  assert(read.criteria.some(n=>n.name==='Enregistrement conforme'&&n.value==='valid'));
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
  const stock=read.byId.future_placements_2060;
  assert(stock.includes('Placements corrects : 1 sur 33'),stock);
  assert(stock.includes('Score : 1/33'),stock);
  assert(stock.includes('Moyenne de réussite : 3,03 %'),stock);
  assert(!stock.includes('case:')&&!stock.includes('source')&&!stock.includes('pot_future_'),
    'Les déplacements internes du stock sont visibles : '+stock);
  assert(stock.includes('Consulter les réponses (33 placements)'),
    'Le détail consultable du stock est absent : '+stock);
  assert.equal(read.stockDetailsOpen,false,'Le stock doit rester replié à l’ouverture');
  assert.equal(read.stockDetailsRows,34,'Le détail ne doit montrer que les flacons de ce test');
  assert(stock.includes('Casier de démonstration — Niveau intermédiaire — emplacement 1'));
  assert(stock.includes('Zone de départ — non placé'));
  const fractions=read.byId.future_fractions_2060;
  assert(fractions.includes('Choisir une partie 3/4')&&fractions.includes('3 objets sur 4 objets'),fractions);
  assert(fractions.includes('Choisir une partie 1/2')&&fractions.includes('2 objets sur 6 objets'),fractions);
  assert(fractions.includes('Choisir une partie 2/8')&&fractions.includes('0 objets sur 12 objets'),fractions);
  assert(fractions.includes('Correct')&&fractions.includes('Incorrect'));
  assert(!fractions.includes('Choix enregistré'),'Les fractions affichent des codes inutiles');
  const checkToggle=()=>{
    const box=document.querySelector('article[data-test-id="future_placements_2060"] .seb-report-stock-details');
    box.querySelector('summary').click();
    return box.open;
  };
  assert.equal(await win.webContents.executeJavaScript('('+checkToggle.toString()+')()',true),
    true,'Le détail des placements doit pouvoir s’ouvrir');
  for(const [id,value] of Object.entries(read.byId)){
   if(id!=='future_message_2060')assert(!value.includes('BONJOUR_MESSAGE_COMPLET'),
     'Mail contaminant '+id);
  }
  console.log('KALONEO_RESULTS_READABLE_FORMATS_ELECTRON: OK',JSON.stringify({
    cases:read.count,triTimes:true,bricks:true,autoLabels:true,mailBody:true,
    editorWithoutHtml:true,showResultsOnly:true,stockDetailsOptional:true,
    fractionCounts:true,nwtexteEightCriteria:true
  }));
  clearTimeout(timer);win.destroy();app.quit();
 }catch(e){fail(e);}
}).catch(fail);
