'use strict';
const {app,BrowserWindow,ipcMain}=require('electron');
const path=require('node:path');
const assert=require('node:assert/strict');

let adminUnlocked=true;
let launches=0;
ipcMain.handle('admin:status',()=>adminUnlocked);
ipcMain.handle('kaloneo:candidate-start-parcours',()=>{
  if(adminUnlocked)return false;
  launches++;
  return true;
});
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const timer=setTimeout(()=>{console.error('KALONEO_WELCOME_ROLE: TIMEOUT');app.exit(2);},30000);
app.whenReady().then(async()=>{
  let win;
  try{
    const root=path.join(__dirname,'..');
    const page=path.join(root,'app','web','admin-candidats.html');
    win=new BrowserWindow({
      show:false,width:1280,height:800,
      webPreferences:{
        preload:path.join(__dirname,'kaloneo-welcome-role-test-preload.js'),
        contextIsolation:true,nodeIntegration:false,sandbox:false
      }
    });
    const check=async(options)=>{
      await win.loadFile(page,options);
      await pause(200); // L'IPC admin:status est asynchrone.
      return win.webContents.executeJavaScript(`(()=>{
        const button=document.getElementById('seb-candidate-start');
        const logo=document.getElementById('seb-admin-home-program-image');
        return {
          buttonExists:!!button,visible:!!button&&getComputedStyle(button).display!=='none',
          buttonText:button?.textContent?.trim()||'',
          title:document.getElementById('seb-welcome-title')?.textContent?.trim(),
          bodyCandidate:document.body.classList.contains('candidate-welcome'),
          logoExists:!!logo
        };
      })()`);
    };

    // Administrateur : aucun élément bouton, pas seulement un bouton caché.
    adminUnlocked=true;
    const admin=await check();
    assert(!admin.buttonExists&&!admin.bodyCandidate,'Un bouton candidat existe dans l\'accueil Administrateur');
    assert.equal(admin.title,'Espace administrateur');
    assert(admin.logoExists,'Logo Admin perdu');

    // Même en cas de query candidateWelcome, un Admin déjà authentifié reste Admin.
    const adminWithCandidateQuery=await check({query:{candidateWelcome:'1'}});
    assert(!adminWithCandidateQuery.buttonExists&&!adminWithCandidateQuery.bodyCandidate,'La query candidate force un bouton en session Admin');
    assert.equal(adminWithCandidateQuery.title,'Espace administrateur');

    // Candidat : même visuel et bouton de lancement opérationnel.
    adminUnlocked=false;
    const candidate=await check({query:{candidateWelcome:'1'}});
    assert(candidate.buttonExists&&candidate.visible&&candidate.bodyCandidate,'Bouton absent de l\'accueil Candidat');
    assert.equal(candidate.buttonText,'Débuter le parcours');
    assert.equal(candidate.title,'Espace candidat');
    assert(candidate.logoExists,'Logo Candidat perdu');
    await win.webContents.executeJavaScript("document.getElementById('seb-candidate-start').click();");
    await pause(80);
    assert.equal(launches,1,'Le départ de parcours candidat ne répond pas');

    // Retour à l'Admin : le bouton est totalement absent du nouveau DOM.
    adminUnlocked=true;
    const adminAgain=await check();
    assert(!adminAgain.buttonExists&&!adminAgain.bodyCandidate,'Le bouton Candidat persiste au retour Admin');
    assert.equal(adminAgain.title,'Espace administrateur');

    clearTimeout(timer);
    console.log('KALONEO_WELCOME_ROLE=OK',JSON.stringify({admin,adminWithCandidateQuery,candidate,adminAgain,launches}));
    win.destroy();app.exit(0);
  }catch(error){
    console.error('KALONEO_WELCOME_ROLE: FAIL',error?.stack||String(error));
    clearTimeout(timer);if(win&&!win.isDestroyed())win.destroy();app.exit(2);
  }
}).catch(error=>{console.error(error);app.exit(2);});
