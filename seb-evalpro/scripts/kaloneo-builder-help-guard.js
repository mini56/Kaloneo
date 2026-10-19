'use strict';
// Chaque fonctionnalité visible du Builder doit avoir une entrée dans l'aide
// hors ligne. Le contrôle est bloquant dans npm run prepare:web / chaque Setup.
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..','..');
const help=path.join(root,'kaloneo','help');
const read=file=>fs.readFileSync(file,'utf8');
const fail=reason=>{console.error('KALONEO_BUILDER_HELP: FAIL — '+reason);process.exit(2);};
const present=file=>{
  if(!fs.existsSync(file)||!fs.statSync(file).size)fail('Fichier d’aide absent/vide : '+path.relative(root,file));
  return read(file);
};
const page=present(path.join(help,'index.html'));
const js=present(path.join(help,'help.js'));
const css=present(path.join(help,'help.css'));
const builder=present(path.join(root,'kaloneo','test-builder.html'));
const builderJs=present(path.join(root,'kaloneo','test-builder.js'));
const builderCss=present(path.join(root,'kaloneo','test-builder.css'));
if(!builder.includes('id="open-builder-help"')||
   !builder.includes('id="builder-help-dialog"')||
   !builder.includes('src="help/index.html"')||
   !builderJs.includes('installBuilderHelp();')||
   !builderJs.includes('dialog.showModal()')||
   !builderCss.includes('.builder-help-button'))fail('Bouton Aide vert ou dialogue hors ligne non raccordé');
for(const id of ['help-search','help-navigation','search-status','clear-search','reset-search','print-help','close-help']){
  if(!page.includes('id="'+id+'"'))fail('Contrôle du manuel manquant : '+id);
}
for(const token of ['normalize=value=>','dataset.searchText','article.hidden','search.addEventListener',
  "document.getElementById('print-help')",'hashchange']){
  if(!js.includes(token))fail('Recherche, navigation ou impression incomplète : '+token);
}
const articles=[...page.matchAll(/<article\b[^>]*\bid="([^"]+)"[^>]*>/g)]
  .map(m=>({id:m[1],opening:m[0]}));
if(articles.length<25)fail('Le manuel doit contenir les rubriques utilisateur complètes');
if(new Set(articles.map(x=>x.id)).size!==articles.length)fail('Rubriques avec ID dupliqué');
const groups=new Set(articles.map(a=>a.opening.match(/\bdata-group="([^"]+)"/)?.[1]));
if(groups.size<4||groups.has(undefined))fail('Rubriques mal organisées');
const keywords=['premiers-pas','nouveau-test','definition','presentation','ajouter-bloc','gerer-blocs',
  'inserer-dupliquer','ensembles','questions','unites','tableaux','images','selection-images',
  'icones','multimedia','texte-et-style','options-test','sorties-bilan','barème','apercu',
  'enregistrer','bibliotheque-tests','historique','developpeur','depannage'];
for(const id of keywords)if(!articles.some(a=>a.id===id))fail('Rubrique de référence non documentée : '+id);
// Chaque nouveau bouton statique doit être rattaché à un chapitre d'aide,
// faute de quoi la compilation Windows est bloquée.
const documentedControls=new Set(articles.flatMap(x=>
  (x.opening.match(/\bdata-controls="([^"]*)"/)?.[1]||'').split(/\s+/).filter(Boolean)));
const builderButtons=[...builder.matchAll(/<button\b[^>]*\bid="([^"]+)"[^>]*>/g)].map(x=>x[1]);
const helpButtons=[...page.matchAll(/<button\b[^>]*\bid="([^"]+)"[^>]*>/g)]
  .map(x=>x[1]).filter(x=>['close-help','print-help'].includes(x));
for(const id of [...builderButtons,...helpButtons]){
  if(!documentedControls.has(id))fail('Bouton non documenté dans une rubrique : #'+id);
}
for(const id of documentedControls){
  if(!builderButtons.includes(id)&&!helpButtons.includes(id))
    fail('Manuel : lien vers un bouton inexistant : #'+id);
}
// Les types de blocs visibles dans la liste sont eux aussi couverts :
// un nouveau type impose une modification de la documentation.
const opts=builder.match(/<select class="block-type">([\s\S]*?)<\/select>/)?.[1]||'';
const optionLabels=[...opts.matchAll(/<option\b[^>]*>([^<]+)<\/option>/g)].map(x=>x[1]);
const normalize=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .toLowerCase().replace(/\s+/g,' ').trim();
const categories=page.match(/<article id="ajouter-bloc"[\s\S]*?<\/article>/)?.[0]||'';
const normalized=normalize(categories);
for(const label of optionLabels){
  let stem=label.replace(/\s*\([^)]*\).*/, '').replace(/\s*\/\s*.*/, '').trim();
  // Variantes raccourcies dans les listes pédagogiques.
  if(stem==='HTML + JavaScript')stem='HTML + JavaScript';
  if(stem==='Sélection d’images')stem='Sélection d’images';
  if(stem==='Tableau / grille cellule par cellule')stem='Tableau/grille';
  if(stem==='Texte à trous / flux continu')stem='Texte à trous';
  if(!normalized.includes(normalize(stem)))
    fail('Nouveau type de bloc sans explication : '+label);
}
// Les 12 captures validées doivent exister et rester hors ligne.
const screenshots=[...page.matchAll(/<img\b[^>]*src="(captures\/B\d{2}\.png)"[^>]*>/g)];
const unique=new Set(screenshots.map(m=>m[1]));
for(let i=1;i<=12;i++){
 const name='captures/B'+String(i).padStart(2,'0')+'.png';
 if(!unique.has(name))fail('Capture Builder absente : '+name);
}
for(const name of unique){
 const file=path.resolve(help,name);
 if(!file.startsWith(path.resolve(help)+path.sep))fail('Capture hors dossier');
 const png=fs.readFileSync(file);
 if(png.length<1000||!png.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))
   fail('Capture PNG invalide : '+name);
}
if(!page.includes('link rel="stylesheet" href="help.css"')||
   !page.includes('src="help.js"')||css.length<1200)
  fail('Style ou fonctionnement de l’aide absent');
if(/https?:\/\/[^" ]+\.(?:js|css|png|jpg|svg)/i.test(page))
  fail('Une dépendance Internet empêche le fonctionnement hors ligne');
const compiled=path.join(root,'seb-evalpro','app','web','kaloneo-builder','help','index.html');
if(fs.existsSync(path.join(root,'seb-evalpro','app','web','kaloneo-builder','test-builder.html'))&&
   !fs.existsSync(compiled))fail('Guide absent du Builder compilé');
console.log('KALONEO_BUILDER_HELP: OK — '+articles.length+' rubriques, '+
  documentedControls.size+' commandes documentées, '+unique.size+' captures réelles hors ligne');
