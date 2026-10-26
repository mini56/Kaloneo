(function(){
  'use strict';
  const articles=[...document.querySelectorAll('main article[id]')];
  const navigation=document.getElementById('help-navigation');
  const search=document.getElementById('help-search');
  const clear=document.getElementById('clear-search');
  const status=document.getElementById('search-status');
  const empty=document.getElementById('empty-search');
  const main=document.getElementById('guide-articles');
  const normalize=value=>String(value||'').normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('fr-FR')
    .replace(/œ/g,'oe').replace(/æ/g,'ae').replace(/\s+/g,' ').trim();
  const groups=new Map(),links=new Map();
  for(const article of articles){
    const category=article.dataset.group||'Autres';
    if(!groups.has(category)){
      const group=document.createElement('section');
      group.className='nav-group';
      const title=document.createElement('h2');
      title.textContent=category;group.append(title);
      navigation.append(group);groups.set(category,group);
    }
    const link=document.createElement('a');
    link.href='#'+encodeURIComponent(article.id);
    link.textContent=article.querySelector('h2')?.textContent.replace(/^\s*\d+\s*/,'').trim()||article.id;
    link.addEventListener('click',()=>{
      selectActive(article.id);
      // Le fragment d'URL permet aussi de partager une rubrique.
    });
    groups.get(category).append(link);
    links.set(article.id,link);
    article.dataset.searchText=normalize([
      article.querySelector('h2')?.textContent,article.dataset.tags,
      article.textContent,article.querySelector('img')?.alt
    ].filter(Boolean).join(' '));
  }
  function selectActive(id){
    for(const [name,link] of links)link.classList.toggle('active',name===id);
  }
  function update(){
    const query=normalize(search.value);
    const terms=query.split(' ').filter(Boolean);
    let count=0;
    for(const article of articles){
      const match=!terms.length||terms.every(term=>article.dataset.searchText.includes(term));
      article.hidden=!match;
      links.get(article.id).hidden=!match;
      if(match)count++;
    }
    for(const group of groups.values()){
      group.hidden=![...group.querySelectorAll('a')].some(link=>!link.hidden);
    }
    status.textContent=query?count+' rubrique'+(count!==1?'s':'')+' trouvée'+(count!==1?'s':''):
      articles.length+' rubriques disponibles';
    empty.hidden=count!==0;
    clear.hidden=!query;
    if(query&&count){
      const selected=articles.find(a=>a.id===decodeURIComponent(location.hash.slice(1))&&!a.hidden);
      selectActive(selected?.id||articles.find(a=>!a.hidden).id);
    }else if(!query){
      selectActive(decodeURIComponent(location.hash.slice(1))||articles[0].id);
    }
    // Ne jamais forcer le focus vers un article à chaque frappe.
  }
  search.addEventListener('input',update);
  clear.addEventListener('click',()=>{search.value='';update();search.focus();});
  document.getElementById('reset-search').addEventListener('click',()=>{
    search.value='';update();search.focus();
  });
  if(new URLSearchParams(location.search).has('settings'))document.getElementById('close-help').style.display='none';
  document.getElementById('print-help').addEventListener('click',()=>window.print());
  document.getElementById('close-help').addEventListener('click',()=>{
    // Compatible aussi lorsque ce fichier est ouvert seul hors de KALONÉO.
    if(window.parent!==window){
      window.parent.postMessage({type:'kaloneo-builder-help-close'},'*');
    }else if(history.length>1){history.back();}
  });
  document.addEventListener('keydown',event=>{
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){
      event.preventDefault();search.focus();search.select();
    }
    if(event.key==='Escape'&&document.activeElement===search&&search.value){
      event.stopPropagation();search.value='';update();
    }
  });
  window.addEventListener('hashchange',()=>{
    const id=decodeURIComponent(location.hash.slice(1));
    if(!links.has(id))return;
    if(document.getElementById(id)?.hidden){search.value='';update();}
    selectActive(id);
  });
  const zoom=document.getElementById('help-image-dialog');
  const zoomImage=document.getElementById('help-image-large');
  document.getElementById('close-image-dialog').addEventListener('click',()=>zoom.close());
  document.querySelectorAll('figure.help-photo img').forEach(img=>{
    img.setAttribute('tabindex','0');img.setAttribute('role','button');
    img.setAttribute('aria-label',img.alt+' — agrandir');
    const open=()=>{
      if(window.parent!==window && new URLSearchParams(location.search).has('settings')){
        window.parent.postMessage({type:'kaloneo-help-photo-open',
          src:img.getAttribute('src'),alt:img.alt},'*');
        return;
      }
      zoomImage.src=img.currentSrc||img.src;
      zoomImage.alt=img.alt;
      zoom.showModal();
    };
    img.addEventListener('click',open);
    img.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();open();}});
  });
  update();
  if(location.hash){
    const id=decodeURIComponent(location.hash.slice(1));
    if(links.has(id))selectActive(id);
  }
})();
