/* KALONÉO — sélection visuelle des images destinées aux tests.
   Les fichiers et identifiants restent inchangés dans la bibliothèque interne. */
(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.KaloneoImageGallery=api;
})(typeof window==='object'?window:(typeof globalThis==='object'?globalThis:null),function(){
  'use strict';
  const technicalFileNames=new Set([
    'avatar_transparant','avatar_icon','scenario','puce','casecoche',
    'stabilot','seb-evalpro-privacy-screen','image_cover'
  ]);
  const normalized=value=>String(value||'').normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const basename=value=>normalized(value).replace(/\\/g,'/').split('/').pop()
    .replace(/\.(?:png|jpe?g|webp|gif|svg|ico)$/i,'');
  function isTechnical(item){
    if(!item||item.systemProvided!==true)return false;
    const category=normalized(item.category);
    // Cette catégorie provient de app/web/assets : logos, poubelles et outils d'interface.
    if(category==='images kaloneo'||category==='images systeme kaloneo')return true;
    const file=basename(item.sourceName&&item.sourceName!=='test.json'?item.sourceName:item.name);
    return technicalFileNames.has(file)||file.startsWith('candidate-trash-')||
      file.startsWith('kaloneo-logo-');
  }
  function duplicateKey(item){
    const name=basename(item.name||item.sourceName)
      .replace(/(?:[\s._-]*(?:copie|copy)(?:[\s._-]*\d+)?|\s*\(\d+\))$/,'')
      .replace(/[\s._]+/g,'-');
    // Les noms génériques ne permettent pas d'identifier une même illustration.
    if(!name||/^(image|photo|illustration|scan|sans-nom|image-test)$/.test(name))
      return 'id:'+String(item.id||'');
    return 'name:'+name+':'+normalized(item.orientation);
  }
  function rank(item){
    const imported=item.systemProvided!==true?100000000:0;
    const webp=/\.webp$/i.test(item.name||'')?100000:0;
    const size=Math.min(99999,Math.max(0,Number(item.size)||0));
    return imported+webp+size;
  }
  function prepare(items){
    const buckets=new Map();
    let hiddenTechnical=0,duplicates=0;
    for(const item of Array.isArray(items)?items:[]){
      if(isTechnical(item)){hiddenTechnical++;continue;}
      const key=duplicateKey(item);
      if(!buckets.has(key)){buckets.set(key,item);continue;}
      duplicates++;
      const previous=buckets.get(key);
      if(rank(item)>rank(previous))buckets.set(key,item);
    }
    return {images:[...buckets.values()],hiddenTechnical,duplicates};
  }
  return Object.freeze({prepare,isTechnical,duplicateKey});
});
