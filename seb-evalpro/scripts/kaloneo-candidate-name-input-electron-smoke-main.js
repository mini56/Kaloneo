'use strict';
const {app,BrowserWindow}=require('electron');
const path=require('node:path');
const assert=require('node:assert/strict');

const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const stop=setTimeout(()=>{console.error('KALONEO_CANDIDATE_NAME_INPUT: TIMEOUT');app.exit(2);},60000);
app.commandLine.appendSwitch('disable-gpu');
app.whenReady().then(async()=>{
  let win;
  try{
    const html=path.resolve(__dirname,'..','app','web','kaltest-pilot2.html');
    win=new BrowserWindow({
      show:false,width:1366,height:768,
      webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,devTools:false}
    });
    win.webContents.on('console-message',(_event,level,msg)=>{
      if(level>=3)console.error('candidate DOM:',msg.slice(0,300));
    });
    await win.loadFile(html);
    await wait(450);
    const initial=await win.webContents.executeJavaScript(`(()=>{
      const a=document.getElementById('nom'),b=document.getElementById('prenom');
      return {page:document.getElementById('page-identification')?.classList.contains('visible'),
        fields:!!a&&!!b,limitA:a?.maxLength,limitB:b?.maxLength}
    })()`);
    assert(initial.fields && initial.page, 'Formulaire candidat non charge');
    assert.equal(initial.limitA,80);assert.equal(initial.limitB,80);

    const attempted=await win.webContents.executeJavaScript(`(()=>{
      const nom=document.getElementById('nom'),prenom=document.getElementById('prenom');
      nom.value='Du/pon§t!123';nom.dispatchEvent(new Event('input',{bubbles:true}));
      prenom.value='Anne/Ma§rie!';prenom.dispatchEvent(new Event('input',{bubbles:true}));
      return {nom:nom.value,prenom:prenom.value,status:document.getElementById('identity-status').textContent,
        rawSession:sessionStorage.getItem('candidat_data')}
    })()`);
    assert.equal(attempted.nom,'Dupont','Les symboles du nom doivent etre retires sans perdre les lettres');
    assert.equal(attempted.prenom,'AnneMarie','Les symboles du prenom doivent etre retires sans perdre les lettres');
    assert.match(attempted.status,/refusés/,'Message de caracteres interdits absent');
    assert.equal(attempted.rawSession,null,'Saisie non valide enregistree avant validation');

    // Une affectation programmatique doit egalement etre rejetee au clic Suivant.
    const bypass=await win.webContents.executeJavaScript(`(()=>{
      const nom=document.getElementById('nom');
      nom.value='Danger/§!'; // pas de input : contourne volontairement le filtre visuel
      document.querySelector('input[name="civilite"][value="Mme"]').checked=true;
      document.getElementById('prenom').value='Élodie';
      document.getElementById('personIdentifier').value='AB12345';
      document.getElementById('groupe').value='A';
      document.getElementById('lieu').value='Lorient';
      document.getElementById('dateEvaluation').value='2026-10-28';
      document.getElementById('identity-next').click();
      return {status:document.getElementById('identity-status').textContent,
        currentPage:document.getElementById('page-identification')?.classList.contains('visible'),
        saved:sessionStorage.getItem('candidat_data'),
        focused:document.activeElement?.id}
    })()`);
    assert(bypass.currentPage,'Un symbole injecte ne doit jamais ouvrir le parcours');
    assert(!bypass.saved,'Un symbole injecte ne doit jamais sauvegarder le candidat');
    assert.equal(bypass.focused,'nom','Le candidat doit pouvoir corriger immediatement le champ fautif');
    assert.match(bypass.status,/sans symbole/);

    const validated=await win.webContents.executeJavaScript(`(()=>{
      document.getElementById('nom').value='D\u2019Angelo';
      document.getElementById('prenom').value='Anne-Marie';
      document.getElementById('identity-next').click();
      const saved=JSON.parse(sessionStorage.getItem('candidat_data')||'null');
      return {saved,phase:window.sebKaltestPilot2?.state?.phase,
        isIntro:document.getElementById('page-intro')?.classList.contains('visible'),
        status:document.getElementById('identity-status').textContent}
    })()`);
    assert(validated.saved,'Une identite valide doit etre enregistree');
    assert.equal(validated.saved.nom,'D\u2019Angelo');
    assert.equal(validated.saved.prenom,'Anne-Marie');
    assert.equal(validated.phase,'intro','Le parcours doit continuer normalement');
    assert(validated.isIntro,'La page introduction doit etre accessible');
    assert.equal(validated.status,'','Ne pas maintenir une erreur lorsque les champs sont corriges');

    // Autres graphies legitimes : accents et espaces (sans passer par l'export).
    const unicode=await win.webContents.executeJavaScript(`(()=>{
      const nom=document.getElementById('nom'),prenom=document.getElementById('prenom');
      nom.value='Élise de La Tour';nom.dispatchEvent(new Event('input',{bubbles:true}));
      prenom.value='Łukasz';prenom.dispatchEvent(new Event('input',{bubbles:true}));
      return {nom:nom.value,prenom:prenom.value};
    })()`);
    assert.equal(unicode.nom,'Élise de La Tour');
    assert.equal(unicode.prenom,'Łukasz');

    clearTimeout(stop);
    console.log('KALONEO_CANDIDATE_NAME_INVALID_SYMBOLS_REMOVED=OK');
    console.log('KALONEO_CANDIDATE_NAME_PROGRAMMATIC_BYPASS_BLOCKED=OK');
    console.log('KALONEO_CANDIDATE_NAME_ACCENTS_COMPOUNDS_ACCEPTED=OK');
    console.log('KALONEO_CANDIDATE_NAME_INVALID_NEVER_PERSISTED=OK');
    win.destroy();app.quit();
  }catch(err){
    clearTimeout(stop);
    console.error('KALONEO_CANDIDATE_NAME_INPUT: FAIL',err?.stack||String(err));
    if(win&&!win.isDestroyed())win.destroy();
    app.exit(2);
  }
}).catch(err=>{console.error(err);app.exit(2);});
