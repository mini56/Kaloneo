'use strict';
/* Même page d'accueil que l'Administrateur, seul le texte et le bouton changent.
   Aucun état du parcours ni aucune donnée candidat ne sont modifiés ici. */
(() => {
  const params=new URLSearchParams(window.location.search);
  if(params.get('candidateWelcome')!=='1')return;
  const initialize=()=>{
    document.body.classList.add('candidate-welcome');
    document.title='KALONÉO — Espace candidat';
    const heading=document.getElementById('seb-welcome-title');
    if(heading)heading.textContent='Espace candidat';
    const start=document.getElementById('seb-candidate-start');
    if(!start)return;
    start.addEventListener('click',async()=>{
      if(start.disabled)return;
      start.disabled=true;
      let ok=false;
      try{ok=await window.sebEvalPro?.kaloneoStartCandidateParcours?.()===true;}
      catch(_){ok=false;}
      if(!ok)start.disabled=false;
    });
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize,{once:true});
  else initialize();
})();
