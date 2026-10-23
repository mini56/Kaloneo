'use strict';
// Index consultable, sans importation des 100+ Mo dans le profil local.
// Les originaux restent dans app/web/bibliotheque-images (installateur).
const fs=require('node:fs'),path=require('node:path');

const CATEGORY='Images supplémentaires KALONÉO';
const IMAGE_EXT=/\.(png|jpe?g|webp|gif|svg)$/i;
const SERIES=Object.freeze({
  '02_fin_stage_01':['Fin de parcours','Fin de stage — série 1'],
  '03_fin_stage_02':['Fin de parcours','Fin de stage — série 2'],
  '04_activites_entreprise_01':['Activités professionnelles','Entreprise — série 1'],
  '05_activites_entreprise_02':['Activités professionnelles','Entreprise — série 2'],
  '06_activites_entreprise_03':['Activités professionnelles','Entreprise — série 3'],
  '07_stage_comptable_magasinier':['Comptabilité et magasinage','Stage comptable et magasinier'],
  'bandeaux':['Bandeaux et paysages','Bandeau'],
  'horaires':['Horaires et temps','Horloge']
});
function normalizeRelative(value){
  const name=String(value||'').replace(/\\/g,'/');
  if(!name||name.startsWith('/')||name.includes('\0')||
     name.split('/').some(part=>!part||part==='.'||part==='..')||
     /^[A-Za-z]:/.test(name)||!IMAGE_EXT.test(name))return '';
  return name;
}
function classify(relative){
  const name=normalizeRelative(relative);
  if(!name)return null;
  const sections=name.split('/');
  const filename=sections.at(-1);
  const stem=filename.replace(IMAGE_EXT,'');
  const ext=path.extname(filename);
  let theme='Illustrations générales',title='',orientation='';
  if(sections.length>1&&SERIES[sections[0]]){
    const [assigned,prefix]=SERIES[sections[0]];
    theme=assigned;
    title=prefix+' — '+stem.replace(/_/g,' ').trim();
    if(sections[0]==='bandeaux')orientation='Paysage';
  }else if(/^Exercices_Objets_Decors_([CHV])_(\d+)$/i.test(stem)){
    const m=stem.match(/^Exercices_Objets_Decors_([CHV])_(\d+)$/i);
    const shape={C:'carré',H:'horizontal',V:'vertical'}[m[1].toUpperCase()];
    theme='Objets et décors';
    orientation=m[1].toUpperCase()==='H'?'Paysage':m[1].toUpperCase()==='V'?'Portrait':'';
    title='Objets et décors — '+shape+' '+m[2];
  }else if(/^Bureau /i.test(stem)){
    theme='Bureaux et apprentissage';title=stem;
  }else if(/^(Achat |Couple )/i.test(stem)){
    theme='Vie quotidienne';title=stem;
  }else if(/^\d+$/i.test(stem)){
    title='Illustration générale — '+stem;
  }else{
    title=stem.replace(/_/g,' ');
  }
  const mime=ext.toLowerCase()==='.png'?'image/png':
    /\.jpe?g$/i.test(ext)?'image/jpeg':
    ext.toLowerCase()==='.webp'?'image/webp':
    ext.toLowerCase()==='.gif'?'image/gif':'image/svg+xml';
  return {theme,name:title+ext,orientation,mime,sourceName:name};
}
function loadSuppliedImages(root){
  if(!root)return [];
  const catalogFile=path.join(root,'catalogue-images.json');
  if(!fs.existsSync(catalogFile))return [];
  const data=JSON.parse(fs.readFileSync(catalogFile,'utf8'));
  if(data.format!=='kaloneo-supplied-images'||data.schemaVersion!==1||!Array.isArray(data.files))
    throw new Error('Catalogue des illustrations KALONÉO incompatible');
  const out=new Map();
  for(const file of data.files){
    const name=normalizeRelative(file?.path);
    if(!name||!(/^[a-f0-9]{40}$/i.test(file?.sha1||'')))
      throw new Error('Entrée de catalogue non sûre : '+String(file?.path||''));
    const details=classify(name);
    const id='kaloneo-fournie-'+file.sha1.slice(0,32);
    if(out.has(id))continue; // Même image exacte: une seule entrée.
    const absolute=path.resolve(root,...name.split('/'));
    if(!absolute.startsWith(path.resolve(root)+path.sep))
      throw new Error('Chemin image interdit : '+name);
    out.set(id,{...details,id,absolute,size:Number(file.bytes)||0,
      category:CATEGORY,systemProvided:true});
  }
  return [...out.values()];
}
function publicMetadata(entry){
  const {absolute,...visible}=entry;
  return {...visible};
}
module.exports={CATEGORY,classify,loadSuppliedImages,publicMetadata};
