const { app, BrowserWindow } = require('electron');
const path = require('path');

const root = path.resolve(__dirname, '..');
const page = path.join(root, 'app', 'web', 'nvmail.html');

function fail(message, detail) {
  console.error('NVMAIL_FUNCTIONAL_SMOKE: FAIL — ' + message);
  if (detail) console.error(detail);
  app.exit(2);
}

async function waitForPage(win) {
  for (let i = 0; i < 80; i += 1) {
    const ready = await win.webContents.executeJavaScript(
      "Boolean(window.sebNvmail && window.sebParcours && document.getElementById('formEmail') && document.getElementById('nvmail-file-picker'))",
      true
    );
    if (ready) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('Contrôleur nvmail non initialisé.');
}

async function runScenario(win) {
  return win.webContents.executeJavaScript(`
    (async function(){
      const assert=(value,message)=>{if(!value)throw new Error(message);};
      sessionStorage.clear();
      sessionStorage.setItem('candidat_data', JSON.stringify({
        nom:'XX',
        prénom:'YY',
        lieu:'Lorient',
        groupe:'7',
        date:'2026-09-26'
      }));

      const send=document.getElementById('nvmail-send');
      const browse=document.getElementById('nvmail-file-picker');
      const form=document.getElementById('formEmail');
      const consignes=document.querySelector('.nvmail-consigne-details').textContent;
      assert(form.contains(send)&&send.type==='submit','Envoyer doit être le bouton de validation DANS le formulaire.');
      assert(send.classList.contains('seb-btn-functional'),'Envoyer doit employer le style fonctionnel KALONÉO.');
      assert(send.compareDocumentPosition(browse)&Node.DOCUMENT_POSITION_PRECEDING,'Envoyer doit être sous Parcourir.');
      assert(consignes.includes('conseil.perso@kaloneo.org'),'Conseiller : adresse attendue manquante.');
      assert(consignes.includes('stage-pro@kaloneo.org'),'Responsable de stage : adresse attendue manquante.');
      assert(consignes.includes('Prénom* Mail-Kalonéo'),'Objet exact et accent attendus absents.');
      assert(consignes.includes('01.02.34.56.78**'),'Les deux étoiles après le numéro fictif sont obligatoires.');
      assert(consignes.includes('** utilisez un numéro de téléphone fictif.'),'La note sur le téléphone fictif est absente.');

      const to=document.getElementById('to');
      const cc=document.getElementById('cc');
      const subject=document.getElementById('subject');
      const message=document.getElementById('message');
      to.value='conseil.perso@kaloneo.org';
      cc.value='stage-pro@kaloneo.org';
      subject.value='YY Mail-Kalonéo';
      message.value='Bonjour, voici mon rapport. Cordialement, YY XX 01.02.34.56.78';

      document.getElementById('nvmail-file-picker').click();
      assert(document.getElementById('modalFichier').style.display==='block','Fenêtre de pièce jointe non ouverte.');
      document.querySelector('[data-seb-file="Rapport_stage.docx"]').click();
      assert(document.getElementById('fichierSelectionne').textContent.trim()==='Rapport_stage.docx','Pièce jointe non sélectionnée.');

      send.click(); // Validation via le vrai bouton candidat, jamais via la barre de navigation.
      const data=JSON.parse(sessionStorage.getItem('page8_data')||'null');
      assert(data,'page8_data absent.');
      assert(data.score_total===6,'Score mail attendu 6/6, obtenu '+data.score_total);
      for(const key of ['score_to','score_cc','score_subject','score_file','score_signature','score_telephone']){
        assert(data[key]===1,'Critère mail non validé: '+key);
      }
      assert(document.getElementById('resultatScore').textContent.includes('Message envoyé'),'Confirmation envoi absente.');

      const wrongCase=window.sebNvmail.saveEmailAnswers(
        'Conseil.perso@kaloneo.org',
        'stage-pro@kaloneo.org',
        'YY Mail-Kalonéo',
        message.value,
        'Rapport_stage.docx'
      );
      assert(wrongCase.score_to===0,'Adresse À ne doit pas accepter une casse différente.');

      const wrongSubject=window.sebNvmail.saveEmailAnswers(
        'conseil.perso@kaloneo.org',
        'stage-pro@kaloneo.org',
        'Mail-Kalonéo YY',
        message.value,
        'Rapport_stage.docx'
      );
      assert(wrongSubject.score_subject===0,'Objet inversé accepté à tort.');

      const obsolete=window.sebNvmail.saveEmailAnswers(
        'conseil.perso@sauvegarde56.org',
        'stage-pro@sauvegarde56.org',
        'YY Mail-SEB',
        message.value,
        'Rapport_stage.docx'
      );
      assert(obsolete.score_to===0&&obsolete.score_cc===0&&obsolete.score_subject===0,
        'Les anciennes réponses Sauvegarde56 / Mail-SEB ne doivent plus être acceptées.');
      const finalData=window.sebNvmail.saveEmailAnswers(
        'conseil.perso@kaloneo.org',
        'stage-pro@kaloneo.org',
        'yy mail-kalonéo',
        message.value,
        'Rapport_stage.docx'
      );
      assert(finalData.score_total===6,'Objet normalisé valide non accepté.');
      assert(window.sebParcours.nextFile('nvmail')==='autoeval2.html','Route nvmail -> autoeval2 incorrecte.');

      return {score:finalData.score_total,route:window.sebParcours.nextFile('nvmail')};
    })()
  `, true);
}

async function verifyReload(win) {
  await win.reload();
  await waitForPage(win);
  return win.webContents.executeJavaScript(`
    (function(){
      const data=JSON.parse(sessionStorage.getItem('page8_data')||'null');
      const fields={
        to:document.getElementById('to').value,
        cc:document.getElementById('cc').value,
        subject:document.getElementById('subject').value,
        message:document.getElementById('message').value,
        file:document.getElementById('fichierSelectionne').textContent.trim()
      };
      if(!data||data.score_total!==6)throw new Error('page8_data perdu après rechargement.');
      if(fields.to!=='conseil.perso@kaloneo.org'||fields.cc!=='stage-pro@kaloneo.org')throw new Error('Adresses non restaurées.');
      if(fields.subject!=='yy mail-kalonéo')throw new Error('Objet non restauré.');
      if(fields.file!=='Rapport_stage.docx')throw new Error('Pièce jointe non restaurée.');
      if(!fields.message.includes('YY XX'))throw new Error('Message non restauré.');
      return {score:data.score_total,route:window.sebParcours.nextFile('nvmail')};
    })()
  `, true);
}

app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');

async function verifyGreenMailIllustration(win,width,height){
  win.setSize(width,height);
  await new Promise(resolve=>setTimeout(resolve,400));
  const ui=await win.webContents.executeJavaScript(`(()=>{
    const left=document.querySelector('#left.nvmail-left-panel');
    const right=document.querySelector('#right.nvmail-right-panel');
    const illustration=left?.querySelector('img.nvmail-workspace-image');
    const card=left?.querySelector('.nvmail-consigne-panel');
    const form=right?.querySelector('#formEmail');
    const imageBox=illustration?.getBoundingClientRect();
    const leftBox=left?.getBoundingClientRect();
    const textBox=card?.getBoundingClientRect();
    const styleLeft=left?getComputedStyle(left):null;
    const styleRight=right?getComputedStyle(right):null;
    const styleForm=form?getComputedStyle(form):null;
    return {
      imageComplete:!!illustration?.complete && illustration.naturalWidth>0 && illustration.naturalHeight>0,
      src:illustration?.getAttribute('src'),
      leftRgb:styleLeft?.backgroundColor,
      rightRgb:styleRight?.backgroundColor,
      formRgb:styleForm?.backgroundImage,
      visible:!!imageBox && imageBox.width>80 && imageBox.height>45,
      insideLeft:!!imageBox && imageBox.left>=leftBox.left && imageBox.right<=leftBox.right && imageBox.bottom<=leftBox.bottom+1,
      belowText:!!imageBox && imageBox.top>=textBox.bottom-1,
      withinScreen:!!imageBox && imageBox.bottom<=innerHeight+1,
      bodyScroll:document.documentElement.scrollWidth>innerWidth+2
    };
  })()`);
  const assert=require('node:assert/strict');
  assert.equal(ui.imageComplete,true,'Image e-mail non chargée: '+JSON.stringify(ui));
  assert.equal(decodeURIComponent(ui.src),'imageqcm/Espace de travail dédié aux e-mails.png');
  assert.equal(ui.leftRgb,'rgb(234, 247, 237)','Le bloc gauche doit être vert clair.');
  assert.equal(ui.rightRgb,'rgb(234, 247, 237)','Le bloc droit doit être vert clair.');
  assert(ui.formRgb.includes('242, 251, 243'),'Le formulaire droit doit avoir un fond vert clair.');
  assert(ui.visible && ui.insideLeft && ui.belowText && ui.withinScreen,
    'L’image doit être sous les consignes, entièrement visible dans le bloc gauche : '+JSON.stringify(ui));
  assert.equal(ui.bodyScroll,false,'Débordement horizontal de page.');
}

async function verifyButtonGeometry(win,width,height){
  win.setSize(width,height);
  await new Promise(resolve=>setTimeout(resolve,400));
  const box=await win.webContents.executeJavaScript(`(()=>{
    const b=document.getElementById('nvmail-send'),p=document.getElementById('nvmail-file-picker'),
      f=document.getElementById('formEmail'),r=document.getElementById('right');
    const send=b.getBoundingClientRect(),pick=p.getBoundingClientRect(),form=f.getBoundingClientRect(),right=r.getBoundingClientRect();
    return {
      parent:f.contains(b),buttonVisible:send.width>0&&send.height>0,
      belowBrowse:send.top>pick.bottom,
      insideForm:send.bottom<=form.bottom+1&&send.left>=form.left-1,
      insideRight:send.bottom<=right.bottom+1,
      withinViewport:send.top>=0&&send.bottom<=innerHeight+1,
      page:document.body.dataset.kaloneoPage
    };
  })()`,true);
  if(!box.parent||!box.buttonVisible||!box.belowBrowse||!box.insideForm||!box.insideRight||!box.withinViewport)
    throw new Error('Envoyer invisible/mal positionné en '+width+'x'+height+' : '+JSON.stringify(box));
  return box;
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show:false,
    width:1600,
    height:900,
    webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true,devTools:false}
  });
  try {
    await win.loadFile(page);
    await waitForPage(win);
    await verifyGreenMailIllustration(win,1600,900);
    await verifyButtonGeometry(win,1600,900);
    await verifyGreenMailIllustration(win,1366,768);
    await verifyButtonGeometry(win,1366,768);
    const first=await runScenario(win);
    const reloaded=await verifyReload(win);
    console.log('NVMAIL_FUNCTIONAL_SMOKE: OK');
    console.log('NVMAIL_SCORE='+first.score+'/6');
    console.log('NVMAIL_RELOAD_SCORE='+reloaded.score+'/6');
    console.log('NVMAIL_ROUTE='+reloaded.route);
    win.destroy();
    app.exit(0);
  } catch(error) {
    try{if(!win.isDestroyed())win.destroy();}catch(_){}
    fail(error&&error.message?error.message:String(error),error&&error.stack?error.stack:'');
  }
}).catch((error)=>fail('Electron initialization failed',error&&error.stack?error.stack:String(error)));

setTimeout(()=>fail('Timeout global du smoke test nvmail.'),45000);
