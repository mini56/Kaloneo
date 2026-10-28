'use strict';
/* Même présentation visuelle pour les accueils, mais des rôles distincts.
   Le bouton « Débuter le parcours » n'existe QUE sur l'accueil candidat.
   Aucun état du parcours ni aucune donnée candidat ne sont modifiés ici. */
(() => {
  const params=new URLSearchParams(window.location.search);
  if(params.get('candidateWelcome')!=='1')return;
  const initialize=async()=>{
    // Ne jamais déduire les droits d'une simple query string : le processus
    // principal est l'autorité, y compris si la page est ouverte après déverrouillage.
    const bridge=window.sebEvalPro;
    if(typeof bridge?.kaloneoIsAdminSession!=='function')return;
    let unlocked=true;
    try{unlocked=await bridge.kaloneoIsAdminSession();}
    catch(_){return;}
    if(unlocked!==false)return; // Fail closed : aucun bouton côté Admin.
    document.body.classList.add('candidate-welcome');
    document.title='KALONÉO — Espace candidat';
    const heading=document.getElementById('seb-welcome-title');
    if(heading)heading.textContent='Espace candidat';
    const main=document.querySelector('body > main');
    if(!main)return;
    const start=document.createElement('button');
    start.id='seb-candidate-start';
    start.type='button';
    start.textContent='Débuter le parcours';
    main.appendChild(start);
    start.addEventListener('click',async()=>{
      if(start.disabled)return;
      start.disabled=true;
      let ok=false;
      try{ok=await bridge.kaloneoStartCandidateParcours?.()===true;}
      catch(_){ok=false;}
      if(!ok)start.disabled=false;
    });
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{void initialize();},{once:true});
  else void initialize();
})();
