'use strict';
// Réglages locaux disponibles uniquement en mode Administrateur.
function installAdminSettings({ipcRenderer,bar,button,buildNumber,releaseVersion,author}) {
  if(!button)return;
  let layer=null;
  const webRoot=()=>new URL(location.pathname.includes('/kaloneo-builder/')?'../':'./',location.href);
  const iconUrl=new URL('kaloneo-builder/assets/settings-28.png',webRoot()).href;
  // Official assets shipped with the application. S56 credit is exclusive to À propos.
  const kaloneoLogoUrl=new URL('assets/kaloneo-logo-app.png',webRoot()).href;
  const sauvegarde56LogoUrl=new URL('sauvegarde56-logo.svg',webRoot()).href;
  // Future structures can be added as records without changing the page layout.
  const associatedStructures=[{name:'Sauvegarde 56',logo:sauvegarde56LogoUrl,alt:'Logo de Sauvegarde 56'}];
  button.textContent='';
  const icon=document.createElement('img');
  icon.className='seb-admin-settings-icon';icon.src=iconUrl;icon.width=28;icon.height=28;icon.alt='';
  icon.setAttribute('aria-hidden','true');button.appendChild(icon);
  // L'aide au survol est gérée par l'infobulle uniforme de la barre Admin.
  // Le title natif affichait une deuxième bulle au style Windows.
  button.removeAttribute('title');
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
    for(const b of layer.querySelectorAll('[data-tab]')){
      const active=b.dataset.tab===tab;
      b.setAttribute('aria-selected',String(active));
      // Verrouille la sélection visuelle après chaque clic, même sur l’accueil Admin.
      b.style.setProperty('background-color',active?'#0571a6':'transparent','important');
      b.style.setProperty('color',active?'#ffffff':'#25546b','important');
      b.style.setProperty('border-color',active?'#0571a6':'transparent','important');
    }
    for(const section of layer.querySelectorAll('[data-section]')){
      section.hidden=section.dataset.section!==tab;
      if(!section.hidden&&(tab==='admin'||tab==='builder')){
        const frame=section.querySelector('iframe');
        if(frame&&!frame.getAttribute('src'))
          frame.src=new URL('kaloneo-builder/'+(tab==='admin'?'admin-help/':'help/')+'index.html?settings=1',webRoot()).href;
      }
    }
    if(tab==='about'){
      const aboutSection=layer.querySelector('[data-section="about"]');
      if(aboutSection)aboutSection.scrollTop=0;
      countLibraries();
    }
  }
  async function open(){
    if(layer||!await ipcRenderer.invoke('admin:status').catch(()=>false))return;
    layer=document.createElement('div');
    layer.id='seb-evalpro-settings-dialog';
    layer.innerHTML=
      '<div class="kaloneo-settings-card" role="dialog" aria-modal="true" aria-label="Réglages internes de KALONÉO">'+
      '<header class="settings-header"><div class="settings-header-title"><img data-settings-header-icon width="28" height="28" alt=""><div><h2>Réglages internes de KALONÉO</h2><p>Administration et documentation du programme</p></div></div><div class="settings-header-actions"><button class="settings-close" type="button" data-close>× Fermer</button></div></header>'+
      '<div class="settings-layout"><nav class="settings-nav" aria-label="Rubriques"><p class="settings-nav-caption">MENU DES RÉGLAGES</p>'+
      '<button type="button" data-tab="passwords" aria-selected="true">Mots de passe</button>'+
      '<button type="button" data-tab="admin">Aide du programme</button>'+
      '<button type="button" data-tab="builder">Aide du Builder</button>'+
      '<button type="button" data-tab="about">À propos</button><div class="settings-nav-brand"><img data-kaloneo-about-logo alt="Logo KALONÉO"></div></nav>'+
      '<div class="settings-main" role="region" aria-label="Contenu des réglages">'+
      '<section data-section="passwords"><div class="settings-intro"><h3>Gestion des accès</h3>'+
      '<p>Modifiez séparément le mot de passe Administrateur ou Développeur, après vérification de celui actuellement utilisé.</p></div>'+
      '<form id="kaloneo-setting-form">'+
      '<label>Accès<select name="role"><option value="admin">Administrateur</option><option value="developer">Développeur</option></select></label>'+
      '<label>Mot de passe actuel<input type="password" name="currentPassword" autocomplete="off" required></label>'+
      '<label>Nouveau mot de passe<input type="password" name="nextPassword" autocomplete="new-password" minlength="8" maxlength="128" required></label>'+
      '<label>Confirmer<input type="password" name="confirmation" autocomplete="new-password" minlength="8" maxlength="128" required></label>'+
      '<p class="wide settings-note">Minimum 8 caractères. Les modifications sont conservées sur ce PC après mise à jour et ne changent pas les accès des autres postes.</p>'+
      '<div class="wide"><button type="submit">Enregistrer le nouveau mot de passe</button></div>'+
      '<p class="wide" id="kaloneo-setting-status" role="status" aria-live="polite"></p></form></section>'+
      '<section class="settings-help" data-section="admin" hidden><div class="settings-help-head"><h3>Aide du programme KALONÉO</h3><p>Guide administrateur, recherche et impression</p></div>'+
      '<iframe title="Manuel administrateur" loading="lazy"></iframe></section>'+
      '<section class="settings-help" data-section="builder" hidden><div class="settings-help-head"><h3>Aide du Builder KALONÉO</h3><p>Mode d’emploi illustré de la création de tests</p></div>'+
      '<iframe title="Manuel du Builder" loading="lazy"></iframe></section>'+
      '<section data-section="about" hidden><div class="settings-intro"><h3>À propos de KALONÉO</h3><p>Informations sur la version installée et les ressources du programme.</p></div><dl class="settings-about">'+
      '<div class="settings-property"><dt>Application</dt><dd>KALONÉO</dd></div>'+ 
      '<div class="settings-property"><dt>Créateur et développeur</dt><dd id="kaloneo-setting-author"></dd></div>'+
      '<div class="settings-property settings-wide"><dt>Structure associée :</dt><dd><ul class="settings-structure-list" data-associated-structures></ul></dd></div>'+ 
      '<div class="settings-property"><dt>Version installée</dt><dd id="kaloneo-setting-version"></dd></div>'+ 
      '<div class="settings-property"><dt>Compilation</dt><dd id="kaloneo-setting-build"></dd></div>'+ 
      '<div class="settings-property settings-wide"><dt>Fonctions incluses</dt><dd>Tests KALTEST, images, icônes, parcours, saisie candidat, notation, Résultats, Bilan, import et export.</dd></div>'+ 
      '<div class="settings-property settings-wide"><dt>Contenus locaux</dt><dd id="kaloneo-setting-count">Chargement…</dd></div>'+ 
      '<div class="settings-property settings-wide"><dt>Utilisation</dt><dd>Application locale hors connexion. Les données des candidats sont conservées sur le PC.</dd></div>'+ 
      '</dl></section></div></div></div>';
    const style=document.createElement('style');
    style.textContent="\n#seb-evalpro-settings-dialog{position:fixed;inset:0;z-index:2147483647;background:rgba(8,32,51,.72);display:grid;place-items:center;font-family:\"Segoe UI\",Arial,sans-serif;color:#173b53}\n#seb-evalpro-settings-dialog *{box-sizing:border-box}\n#seb-evalpro-settings-dialog .kaloneo-settings-card{width:min(1320px,96vw);height:min(820px,94vh);min-height:400px;background:#fff;border-radius:16px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 22px 66px #001b3560}\n#seb-evalpro-settings-dialog .settings-header{flex:none;display:flex;align-items:center;justify-content:space-between;gap:15px;padding:14px 22px;background:linear-gradient(90deg,#edf7fc,#fff);border-bottom:1px solid #cbdde8}\n#seb-evalpro-settings-dialog .settings-header-title{display:flex;align-items:center;gap:14px}\n#seb-evalpro-settings-dialog .settings-header-title img{width:36px;height:36px;object-fit:contain}\n#seb-evalpro-settings-dialog h2{margin:0;font-size:22px;color:#06486b}\n#seb-evalpro-settings-dialog .settings-header-title p{margin:4px 0 0;color:#56778a;font-size:12px}\n#seb-evalpro-settings-dialog h3{margin:0 0 15px;color:#075271;font-size:22px}\n#seb-evalpro-settings-dialog button{cursor:pointer;font-size:14px;border:1px solid #97bdcf;border-radius:9px;background:#fff;color:#075473;font-weight:700;padding:11px 13px;font-family:inherit}\n#seb-evalpro-settings-dialog button:hover{background:#e8f4fa}\n#seb-evalpro-settings-dialog button:focus-visible,#seb-evalpro-settings-dialog input:focus-visible,#seb-evalpro-settings-dialog select:focus-visible{outline:3px solid #e5b64a;outline-offset:2px}\n#seb-evalpro-settings-dialog .settings-close{background:#fff;color:#b32832;border-color:#e7bec2}\n#seb-evalpro-settings-dialog .settings-layout{flex:1;min-height:0;display:flex;min-width:0}\n#seb-evalpro-settings-dialog .settings-nav{width:235px;flex:0 0 235px;background:#f1f7fa;border-right:1px solid #d0e0e9;display:flex;flex-direction:column;gap:7px;padding:23px 12px;overflow-y:auto}\n#seb-evalpro-settings-dialog .settings-nav-caption{margin:0 12px 12px;font-size:11px;font-weight:800;color:#6d8998;letter-spacing:.1em}\n#seb-evalpro-settings-dialog .settings-nav button{text-align:left;padding:15px;font-size:15px;border-color:transparent;background:transparent;color:#25546b;white-space:normal;flex-shrink:0}\n#seb-evalpro-settings-dialog .settings-nav button[aria-selected=true]{background:#0571a6;color:#fff;border-color:#0571a6;box-shadow:0 3px 10px #1a526526}\n#seb-evalpro-settings-dialog .settings-nav button:hover:not([aria-selected=true]){background:#deedf5}\n#seb-evalpro-settings-dialog .settings-main{flex:1;min-width:0;min-height:0;overflow:hidden;padding:0}\n#seb-evalpro-settings-dialog .settings-main>section{height:100%;min-height:0;overflow:auto;padding:28px clamp(22px,3vw,42px)}\n#seb-evalpro-settings-dialog .settings-main>section[hidden]{display:none!important}\n#seb-evalpro-settings-dialog .settings-main>section.settings-help{display:flex;flex-direction:column;overflow:hidden;padding:0}\n#seb-evalpro-settings-dialog .settings-help-head{flex:none;padding:14px 24px;border-bottom:1px solid #deebf1;background:#fff}\n#seb-evalpro-settings-dialog .settings-help-head h3{font-size:19px;margin:0}\n#seb-evalpro-settings-dialog .settings-help-head p{margin:4px 0 0;color:#607b8a;font-size:13px}\n#seb-evalpro-settings-dialog .settings-help iframe{display:block;flex:1;min-height:0;width:100%;height:100%;border:0;background:#f7fafc}\n#seb-evalpro-settings-dialog form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px;max-width:940px}\n#seb-evalpro-settings-dialog form label{display:flex;flex-direction:column;gap:9px;font-weight:700;font-size:14px}\n#seb-evalpro-settings-dialog input,#seb-evalpro-settings-dialog select{width:100%;padding:11px;font:inherit;border:1px solid #a7c4d5;border-radius:7px;min-height:45px}\n#seb-evalpro-settings-dialog .wide{grid-column:1/-1}\n#seb-evalpro-settings-dialog form p.wide{background:#eff7fc;border-left:4px solid #197aa9;border-radius:5px;padding:13px 16px;color:#365f75;margin:0;line-height:1.5}\n#seb-evalpro-settings-dialog form .wide button[type=submit]{background:#0678a8;color:#fff;border-color:#0678a8;padding:13px 22px}\n#seb-evalpro-settings-dialog form .wide button:disabled{opacity:.6}\n#seb-evalpro-settings-dialog #kaloneo-setting-status{margin:0}\n#seb-evalpro-settings-dialog dl{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:15px;margin:0}\n#seb-evalpro-settings-dialog dt{font-size:12px;letter-spacing:.055em;color:#65899d;text-transform:uppercase;font-weight:800;margin-bottom:8px}\n#seb-evalpro-settings-dialog dd{margin:0;line-height:1.55;overflow-wrap:anywhere}\n#seb-evalpro-settings-dialog dl dt:nth-of-type(5),#seb-evalpro-settings-dialog dl dt:nth-of-type(6){font-size:13px}\n@media(max-width:850px){#seb-evalpro-settings-dialog .kaloneo-settings-card{width:98vw;height:96vh}#seb-evalpro-settings-dialog .settings-layout{flex-direction:column}#seb-evalpro-settings-dialog .settings-nav{width:100%;flex:0 0 auto;flex-direction:row;flex-wrap:wrap;border-right:0;border-bottom:1px solid #d0e0e9;padding:8px}#seb-evalpro-settings-dialog .settings-nav-caption{display:none}#seb-evalpro-settings-dialog .settings-nav button{font-size:13px;padding:10px}#seb-evalpro-settings-dialog .settings-header{padding:10px 14px}}\n@media(max-width:520px){#seb-evalpro-settings-dialog form,#seb-evalpro-settings-dialog dl{grid-template-columns:1fr}#seb-evalpro-settings-dialog .settings-header-title p{display:none}#seb-evalpro-settings-dialog h2{font-size:17px}}\n";
    style.textContent += "\n/* R120: isolation of the settings panel from global Admin main styles. */\n#seb-evalpro-settings-dialog .settings-main{display:block;flex:1 1 0%;width:auto;max-width:none;min-width:0;min-height:0;padding:0;margin:0;align-self:stretch;align-items:stretch;justify-content:flex-start;text-align:left;border:0;box-shadow:none;border-radius:0;background:#fff}\n#seb-evalpro-settings-dialog .settings-main>section{width:100%;max-width:none;min-width:0;align-items:stretch;justify-content:flex-start;text-align:left}\n#seb-evalpro-settings-dialog .settings-main>section.settings-help{display:flex;align-items:stretch;width:100%;max-width:none}\n#seb-evalpro-settings-dialog .settings-help iframe{width:100%;max-width:none;min-width:0;align-self:stretch}\n#seb-evalpro-settings-dialog .settings-intro{max-width:850px;margin:0 0 25px;padding-bottom:18px;border-bottom:1px solid #dbe7ee;text-align:left}\n#seb-evalpro-settings-dialog .settings-intro h3{text-align:left;margin:0 0 12px;font-size:24px}\n#seb-evalpro-settings-dialog .settings-intro p{margin:0;color:#52738a;font-size:15px;line-height:1.6;text-align:left}\n#seb-evalpro-settings-dialog form{max-width:850px;margin:0;text-align:left}\n#seb-evalpro-settings-dialog form label{text-align:left}\n#seb-evalpro-settings-dialog form p.settings-note{margin:0;padding:13px 17px;background:#edf6fa;border-left:4px solid #2181a9;border-radius:6px;text-align:left}\n#seb-evalpro-settings-dialog #kaloneo-setting-status:empty{display:none}\n#seb-evalpro-settings-dialog #kaloneo-setting-status:not(:empty){background:#eaf7f1;color:#185b43;border-radius:7px;padding:12px 16px}\n#seb-evalpro-settings-dialog .settings-about{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:15px;max-width:940px;width:100%;margin:0}\n#seb-evalpro-settings-dialog .settings-property{display:block;min-width:0;background:#f3f8fb;border:1px solid #d6e7ef;border-radius:12px;padding:18px 20px;text-align:left}\n#seb-evalpro-settings-dialog .settings-property.settings-wide{grid-column:1/-1}\n#seb-evalpro-settings-dialog .settings-property dt{margin:0 0 8px;text-align:left;font-weight:800;font-size:12px;letter-spacing:.06em;color:#578096}\n#seb-evalpro-settings-dialog .settings-property dd{margin:0;text-align:left;font-size:16px;line-height:1.55;color:#1b4b65}\n#seb-evalpro-settings-dialog .settings-nav button{transition:none!important}\n#seb-evalpro-settings-dialog .settings-nav button[aria-selected=true]{background:#0571a6!important;color:#fff!important;border-color:#0571a6!important}\n@media(max-width:680px){#seb-evalpro-settings-dialog .settings-about{grid-template-columns:1fr}#seb-evalpro-settings-dialog .settings-property.settings-wide{grid-column:1}}\n";
    style.textContent += `
#seb-evalpro-settings-dialog .settings-header-actions{display:flex;align-items:center;gap:18px;flex:none}
#seb-evalpro-settings-dialog .settings-nav-brand{flex:0 0 auto;width:100%;min-width:0;padding:10px 5px 8px;text-align:center}
#seb-evalpro-settings-dialog .settings-nav-brand img{display:block;width:100%;height:auto;max-height:200px;object-fit:contain;object-position:center top}
#seb-evalpro-settings-dialog .settings-structure-list{display:flex;flex-direction:column;gap:16px;list-style:none;margin:0;padding:0}
#seb-evalpro-settings-dialog .settings-structure-item{display:flex;flex-direction:column;align-items:flex-start;gap:10px;min-width:0}
#seb-evalpro-settings-dialog .settings-structure-item+.settings-structure-item{border-top:1px solid #d6e7ef;padding-top:16px}
#seb-evalpro-settings-dialog .settings-structure-name{display:block;font-size:16px;font-weight:700;color:#1b4b65}
#seb-evalpro-settings-dialog .settings-structure-item img{display:block;width:auto;height:auto;max-width:100%;max-height:90px;object-fit:contain;object-position:left center}
@media(max-width:680px){#seb-evalpro-settings-dialog .settings-header-actions{gap:8px}#seb-evalpro-settings-dialog .settings-nav-brand{padding:8px 4px}}
/* R140: this logo is a real child of the LEFT navigation, even on narrow windows. */
@media(max-width:850px){
#seb-evalpro-settings-dialog .settings-layout{flex-direction:row}
#seb-evalpro-settings-dialog .settings-nav{width:190px;flex:0 0 190px;flex-direction:column;flex-wrap:nowrap;border-right:1px solid #d0e0e9;border-bottom:0;padding:12px 8px;gap:6px}
#seb-evalpro-settings-dialog .settings-nav-caption{display:block;margin:0 6px 6px}
#seb-evalpro-settings-dialog .settings-nav button{font-size:13px;padding:11px}
#seb-evalpro-settings-dialog .settings-main{min-width:0}
}
@media(max-width:520px){
#seb-evalpro-settings-dialog .settings-nav{width:140px;flex-basis:140px;padding:9px 5px}
#seb-evalpro-settings-dialog .settings-nav button{font-size:12px;padding:9px 6px}
#seb-evalpro-settings-dialog .settings-main>section{padding:16px}
}

`;
    layer.appendChild(style);
    document.body.appendChild(layer);
    layer.querySelector('[data-settings-header-icon]').src=iconUrl;
    layer.querySelector('[data-kaloneo-about-logo]').src=kaloneoLogoUrl;
    const structureList=layer.querySelector('[data-associated-structures]');
    for(const structure of associatedStructures){
      const item=document.createElement('li');
      item.className='settings-structure-item';
      const name=document.createElement('strong');
      name.className='settings-structure-name';
      name.textContent=structure.name;
      const image=document.createElement('img');
      image.src=structure.logo;
      image.alt=structure.alt;
      item.append(name,image);
      structureList.appendChild(item);
    }
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
