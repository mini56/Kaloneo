'use strict';
// Réglages locaux disponibles uniquement en mode Administrateur.
function installAdminSettings({ipcRenderer,bar,button,buildNumber,releaseVersion,author}) {
  if(!button)return;
  let layer=null;
  const webRoot=()=>new URL(location.pathname.includes('/kaloneo-builder/')?'../':'./',location.href);
  function close(){if(layer){layer.remove();layer=null;}}
  async function countLibraries(){
    const target=layer?.querySelector('#kaloneo-setting-count');
    if(!target)return;
    const [t,i]=await Promise.all([
      ipcRenderer.invoke('kaloneo-library:list-tests').catch(()=>null),
      ipcRenderer.invoke('kaloneo-library:list-images').catch(()=>null)
    ]);
    if(!target.isConnected)return;
    const length=(data,names)=>{
      if(Array.isArray(data))return data.length;
      for(const n of names)if(Array.isArray(data?.[n]))return data[n].length;
      return null;
    };
    const tests=length(t,['tests','items','entries']),images=length(i,['images','items','entries']);
    target.textContent=(tests===null?'Catalogue de tests':'Tests : '+tests)+
      ' ; '+(images===null?'Bibliothèque d’images':'Images : '+images)+
      '. Icônes, parcours et ressources intégrés.';
  }
  function selectTab(tab){
    if(!layer)return;
    for(const b of layer.querySelectorAll('[data-tab]'))
      b.setAttribute('aria-selected',String(b.dataset.tab===tab));
    for(const section of layer.querySelectorAll('[data-section]')){
      section.hidden=section.dataset.section!==tab;
      if(!section.hidden&&(tab==='admin'||tab==='builder')){
        const frame=section.querySelector('iframe');
        if(frame&&!frame.getAttribute('src'))
          frame.src=new URL('kaloneo-builder/'+(tab==='admin'?'admin-help/':'help/')+'index.html',webRoot()).href;
      }
    }
    if(tab==='about')countLibraries();
  }
  async function open(){
    if(layer||!await ipcRenderer.invoke('admin:status').catch(()=>false))return;
    layer=document.createElement('div');
    layer.id='seb-evalpro-settings-dialog';
    layer.innerHTML=
      '<div class="kaloneo-settings-card" role="dialog" aria-modal="true" aria-label="Réglages internes de KALONÉO">'+
      '<header><h2>⚙ Réglages internes de KALONÉO</h2><button type="button" data-close>Fermer</button></header>'+
      '<nav aria-label="Rubriques">'+
      '<button type="button" data-tab="passwords">Mots de passe</button>'+
      '<button type="button" data-tab="admin">Aide du programme</button>'+
      '<button type="button" data-tab="builder">Aide du Builder</button>'+
      '<button type="button" data-tab="about">À propos</button></nav>'+
      '<main>'+
      '<section data-section="passwords"><h3>Gestion des accès</h3>'+
      '<p>Modifiez séparément le mot de passe Administrateur ou Développeur, après vérification de celui actuellement utilisé.</p>'+
      '<form id="kaloneo-setting-form">'+
      '<label>Accès<select name="role"><option value="admin">Administrateur</option><option value="developer">Développeur</option></select></label>'+
      '<label>Mot de passe actuel<input type="password" name="currentPassword" autocomplete="off" required></label>'+
      '<label>Nouveau mot de passe<input type="password" name="nextPassword" autocomplete="new-password" minlength="8" maxlength="128" required></label>'+
      '<label>Confirmer<input type="password" name="confirmation" autocomplete="new-password" minlength="8" maxlength="128" required></label>'+
      '<p class="wide">Minimum 8 caractères. Les modifications sont conservées sur ce PC après mise à jour et ne changent pas les accès des autres postes.</p>'+
      '<div class="wide"><button type="submit">Enregistrer le nouveau mot de passe</button></div>'+
      '<p class="wide" id="kaloneo-setting-status" role="status" aria-live="polite"></p></form></section>'+
      '<section data-section="admin" hidden><h3>Aide du programme KALONÉO</h3>'+
      '<iframe title="Manuel administrateur" loading="lazy"></iframe></section>'+
      '<section data-section="builder" hidden><h3>Aide du Builder KALONÉO</h3>'+
      '<iframe title="Manuel du Builder" loading="lazy"></iframe></section>'+
      '<section data-section="about" hidden><h3>À propos de KALONÉO</h3><dl>'+
      '<dt>Application</dt><dd>KALONÉO — SEB EvalPro</dd>'+
      '<dt>Développeur</dt><dd id="kaloneo-setting-author"></dd>'+
      '<dt>Version installée</dt><dd id="kaloneo-setting-version"></dd>'+
      '<dt>Compilation</dt><dd id="kaloneo-setting-build"></dd>'+
      '<dt>Fonctions incluses</dt><dd>Tests KALTEST, images, icônes, parcours, saisie candidat, notation, Résultats, Bilan, import et export.</dd>'+
      '<dt>Contenus locaux</dt><dd id="kaloneo-setting-count">Chargement…</dd>'+
      '<dt>Utilisation</dt><dd>Application locale hors connexion. Les données des candidats sont conservées sur le PC.</dd>'+
      '</dl></section></main></div>';
    const style=document.createElement('style');
    style.textContent=
      '#seb-evalpro-settings-dialog{position:fixed;inset:0;z-index:2147483647;background:#173b58a8;display:grid;place-items:center;font-family:Arial,sans-serif;color:#153a53}'+
      '#seb-evalpro-settings-dialog *{box-sizing:border-box}'+
      '#seb-evalpro-settings-dialog .kaloneo-settings-card{width:min(1000px,94vw);height:min(790px,92vh);background:#fff;border-radius:12px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 14px 55px #0005}'+
      '#seb-evalpro-settings-dialog header{display:flex;align-items:center;justify-content:space-between;padding:14px 20px;background:#eaf3fa}'+
      '#seb-evalpro-settings-dialog h2{font-size:21px;margin:0;color:#004e70}'+
      '#seb-evalpro-settings-dialog h3{font-size:19px;color:#004e70}'+
      '#seb-evalpro-settings-dialog nav{display:flex;gap:8px;flex-wrap:wrap;padding:12px 20px;border-bottom:1px solid #cbdce9}'+
      '#seb-evalpro-settings-dialog button{cursor:pointer;font-size:14px;border:1px solid #16719a;border-radius:7px;background:#fff;color:#004e70;font-weight:700;padding:9px 12px}'+
      '#seb-evalpro-settings-dialog button[aria-selected=true]{background:#006da4;color:#fff}'+
      '#seb-evalpro-settings-dialog main{flex:1;overflow:auto;padding:14px 22px;min-height:0}'+
      '#seb-evalpro-settings-dialog section{height:100%}'+
      '#seb-evalpro-settings-dialog section[hidden]{display:none!important}'+
      '#seb-evalpro-settings-dialog iframe{width:100%;height:calc(100% - 50px);border:1px solid #a9c8db;border-radius:7px}'+
      '#seb-evalpro-settings-dialog form{display:grid;grid-template-columns:1fr 1fr;gap:14px;max-width:850px}'+
      '#seb-evalpro-settings-dialog form label{display:flex;flex-direction:column;gap:5px;font-weight:700}'+
      '#seb-evalpro-settings-dialog input,#seb-evalpro-settings-dialog select{padding:8px;font:inherit;border:1px solid #94b3c7;border-radius:5px}'+
      '#seb-evalpro-settings-dialog .wide{grid-column:1/-1}'+
      '#seb-evalpro-settings-dialog dl{display:grid;grid-template-columns:180px 1fr;gap:12px}'+
      '#seb-evalpro-settings-dialog dt{font-weight:700}'+
      '#seb-evalpro-settings-dialog dd{margin:0}';
    layer.appendChild(style);
    document.body.appendChild(layer);
    layer.querySelector('#kaloneo-setting-author').textContent=author||'Non renseigné';
    layer.querySelector('#kaloneo-setting-version').textContent=releaseVersion||'Non renseignée';
    layer.querySelector('#kaloneo-setting-build').textContent='Build #'+buildNumber;
    layer.querySelector('[data-close]').addEventListener('click',close);
    layer.addEventListener('click',event=>{if(event.target===layer)close();});
    layer.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();close();}});
    layer.querySelectorAll('[data-tab]').forEach(btn=>btn.addEventListener('click',()=>selectTab(btn.dataset.tab)));
    selectTab('passwords');
    const form=layer.querySelector('#kaloneo-setting-form');
    form.addEventListener('submit',async event=>{
      event.preventDefault();
      const submit=form.querySelector('[type=submit]'),status=layer?.querySelector('#kaloneo-setting-status');
      if(!status)return;
      const values=Object.fromEntries(new FormData(form).entries());
      submit.disabled=true;
      try{
        const result=await ipcRenderer.invoke('kaloneo-settings:change-password',values);
        status.textContent=result?.ok?'Mot de passe enregistré sur ce PC.':(result?.error||'Modification impossible.');
        if(result?.ok)form.reset();
      }catch(_){status.textContent='Impossible de modifier le mot de passe.';}
      finally{submit.disabled=false;}
    });
  }
  button.addEventListener('click',open);
  return {close};
}
module.exports={installAdminSettings};
