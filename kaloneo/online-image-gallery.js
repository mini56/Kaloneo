(() => {
  'use strict';
  // Galerie optionnelle : seules les miniatures sont affichées.
  const $ = id => document.getElementById(id);
  const chosen = new Set();
  let rows = [];
  const status = text => { $('online-image-status').textContent = text; };
  const draw = () => {
    const host=$('online-image-grid');host.replaceChildren();
    const category=$('online-image-category').value;
    const query=$('online-image-search').value.toLocaleLowerCase('fr').trim();
    const visible=rows.filter(x=>(!category||x.categorie===category)&&
      (!query||(x.titre+' '+x.categorie).toLocaleLowerCase('fr').includes(query)));
    for(const item of visible){
      const cell=document.createElement('label');cell.className='online-image-cell';
      const image=document.createElement('img');image.loading='lazy';image.alt=item.titre;
      image.referrerPolicy='no-referrer';
      // URL validée contre le domaine public attendu.
      const url=new URL(item.miniature);
      if(url.protocol==='https:'&&url.hostname==='raw.githubusercontent.com'&&
         url.pathname.startsWith('/mini56/Kaloneo-MAJ/main/bibliotheque-images/miniatures/'))image.src=url.href;
      const line=document.createElement('span');line.className='online-image-caption';
      const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.checked=chosen.has(item.id);
      checkbox.addEventListener('change',()=>{if(checkbox.checked)chosen.add(item.id);else chosen.delete(item.id);count();});
      const name=document.createElement('span');name.textContent=item.titre;
      line.append(checkbox,name);cell.append(image,line);host.append(cell);
    }
    if(!visible.length)status('Aucune image pour ces critères.');
    count();
  };
  const count=()=>{$('online-image-download').textContent='Télécharger la sélection ('+chosen.size+')';
    $('online-image-download').disabled=chosen.size===0;};
  async function load() {
    status('Chargement des miniatures depuis GitHub…');
    $('online-image-grid').replaceChildren();chosen.clear();count();
    try{
      const response=await window.sebEvalPro?.kaloneoListOnlineImages?.();
      if(!response?.ok)throw new Error(response?.error||'Catalogue indisponible');
      rows=response.images||[];
      const select=$('online-image-category');select.replaceChildren(new Option('Toutes les catégories',''));
      for(const category of response.categories||[]){
        if(rows.some(x=>x.categorie===category.id))select.add(new Option(category.nom,category.id));
      }
      status(rows.length+' images disponibles sur GitHub. Sélectionnez celles à importer.');
      draw();
    }catch(error){status('Connexion impossible : '+String(error?.message||error));}
  }
  document.addEventListener('DOMContentLoaded',()=>{
    const dialog=$('online-image-dialog');
    $('open-online-images').addEventListener('click',()=>{dialog.showModal();load();});
    $('online-image-close').addEventListener('click',()=>dialog.close());
    $('online-image-search').addEventListener('input',draw);
    $('online-image-category').addEventListener('change',draw);
    $('online-image-download').addEventListener('click',async()=>{
      const button=$('online-image-download');button.disabled=true;
      status('Téléchargement des '+chosen.size+' images sélectionnées…');
      try{
        const result=await window.sebEvalPro?.kaloneoDownloadOnlineImages?.([...chosen]);
        if(!result)throw new Error('Import indisponible');
        const successful=(result.results||[]).filter(x=>x.ok).length;
        const failures=(result.results||[]).filter(x=>!x.ok);
        status(successful+' image(s) importée(s) dans KALONÉO.'+
          (failures.length?' '+failures.length+' erreur(s) : '+failures.slice(0,3).map(x=>x.error).join(' ; '):''));
        (result.results||[]).filter(x=>x.ok).forEach(x=>chosen.delete(x.id));
        count();
        // Signaler au Builder que sa bibliothèque locale doit être rafraîchie.
        window.dispatchEvent(new Event('kaloneo-online-images-imported'));
      }catch(error){status('Échec : '+String(error?.message||error));count();}
    });
  });
})();
