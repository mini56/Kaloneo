'use strict';
/* Modèle institutionnel figé — exactement 18 lignes et 3 sections.
 * Les libellés sont copiés du tableau historique admin-bilan.html.
 * Seule la 18e ligne transversale est un ajout officiel, partagé par tous les bilans.
 */
const OFFICIAL=Object.freeze([
  {
    "kind": "section",
    "label": "Compétences techniques"
  },
  {
    "kind": "row",
    "key": "fabrication-plan",
    "label": "Fabrication d’une structure 3D en papier — Capacités Visuo-constructives : — Capacité à lire un plan et comprendre un modèle ou un gabarit.",
    "mode": "manual"
  },
  {
    "kind": "row",
    "key": "fabrication-tracage",
    "label": "Capacité à effectuer : — Les opérations de traçage et de repérage",
    "mode": "manual"
  },
  {
    "kind": "row",
    "key": "fabrication-decoupe",
    "label": "Capacité à effectuer : — Les opérations de découpe",
    "mode": "manual"
  },
  {
    "kind": "row",
    "key": "fabrication-assemblage",
    "label": "Capacité à effectuer : — Les opérations de pliage et d’assemblage",
    "mode": "manual"
  },
  {
    "kind": "row",
    "key": "fabrication-finition",
    "label": "Capacité à effectuer : — Les opérations de finition",
    "mode": "manual"
  },
  {
    "kind": "row",
    "key": "briques-identification",
    "label": "Construction à base de briques — Capacités Visuo-spatiales : — Capacité à identifier, décoder et interpréter un schéma simple",
    "mode": "automatic"
  },
  {
    "kind": "row",
    "key": "briques-manipulation",
    "label": "Capacité à manipuler et assembler",
    "mode": "automatic"
  },
  {
    "kind": "row",
    "key": "carre",
    "label": "Carré magique — Capacités de résolution de problèmes structurés par contraintes",
    "mode": "automatic"
  },
  {
    "kind": "row",
    "key": "organisation",
    "label": "Gestion logistique — ‘’Ranger le stock de produits’’ — Capacité à effectuer le classement des produits dans un espace de stockage en respectant les consignes.",
    "mode": "automatic"
  },
  {
    "kind": "row",
    "key": "planning",
    "label": "Gestion de plannings sous contraintes — ‘’Le restaurant’’ — Capacité à effectuer la répartition de tâches selon des contraintes données.",
    "mode": "automatic"
  },
  {
    "kind": "row",
    "key": "tri-temps",
    "label": "Tri de chevilles — Capacité à effectuer une tâche simple et répétitive en un temps imparti. — Moyenne 00:00",
    "mode": "automatic"
  },
  {
    "kind": "row",
    "key": "tri-erreurs",
    "label": "Nombre d’erreurs effectuées — 0 erreur",
    "mode": "automatic"
  },
  {
    "kind": "section",
    "label": "Utilisation des techniques de l'information et de la communication"
  },
  {
    "kind": "row",
    "key": "texte",
    "label": "Traitement de texte — Capacité à utiliser l’outil informatique pour présenter un travail",
    "mode": "automatic"
  },
  {
    "kind": "row",
    "key": "mail",
    "label": "Messagerie électronique — Capacité à échanger avec les technologies de l’information et de la communication",
    "mode": "automatic"
  },
  {
    "kind": "section",
    "label": "Savoirs fondamentaux"
  },
  {
    "kind": "row",
    "key": "expression",
    "label": "Expression écrite — Maîtrise des règles de grammaire, d'orthographe et de conjugaison, ... et aptitudes à communiquer sous forme écrite.",
    "mode": "automatic"
  },
  {
    "kind": "row",
    "key": "math-enonce",
    "label": "Mathématiques — Capacité à comprendre un énoncé et une consigne",
    "mode": "automatic"
  },
  {
    "kind": "row",
    "key": "math-problemes",
    "label": "Capacité à résoudre des problèmes en lien avec le domaine professionnel, d’autres disciplines ou la vie courante",
    "mode": "automatic"
  },
  {
    "kind": "row",
    "key": "competences-transversales",
    "label": "Compétences transversales — Capacité à mobiliser des connaissances et des compétences dans différentes situations de travail ou de la vie quotidienne.",
    "mode": "automatic"
  }
]);

const fs=require('fs'),path=require('path');
// Une seule source de libellés, choix de commentaires et tableau : le bilan
// institutionnel existant. app/web est embarqué dans l'installateur Windows.
function institutionalTableSource(){
 const candidates=[
  path.join(__dirname,'..','app','web','admin-bilan.html'),
  path.join(__dirname,'..','overrides','admin-bilan.html')
 ];
 const filename=candidates.find(file=>fs.existsSync(file));
 if(!filename)throw new Error('Tableau institutionnel officiel introuvable.');
 const html=fs.readFileSync(filename,'utf8');
 if(!/<table\s+id="bilan"/i.test(html))
  throw new Error('Le tableau institutionnel officiel est absent.');
 return html;
}
function plainHtml(value){
 return String(value||'').replace(/<br\s*\/?>/gi,'\n')
  .replace(/<[^>]+>/g,'').replace(/&nbsp;/gi,' ')
  .replace(/&amp;/gi,'&').replace(/&quot;/gi,'"')
  .replace(/&#39;|&apos;/gi,"'").replace(/&lt;/gi,'<').replace(/&gt;/gi,'>')
  .replace(/\n[ \t]+/g,'\n').trim();
}
let officialHtmlRows=null;
function officialRowDefinitions(){
 if(officialHtmlRows)return officialHtmlRows;
 const html=institutionalTableSource();
 const table=html.match(/<table\s+id="bilan"[\s\S]*?<\/table>/i)?.[0]||'';
 const rows=new Map();
 for(const match of table.matchAll(/<tr\b([^>]*\bdata-r="([^"]+)"[^>]*)>([\s\S]*?)<\/tr>/gi)){
  const key=match[2],inner=match[3];
  const moduleHtml=inner.match(/<td\b[^>]*>([\s\S]*?)<\/td>/i)?.[1]||'';
  const comments={};
  for(const opt of inner.matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option>/gi)){
   const level=opt[1].match(/data-l="(NE|I|II|III)"/i)?.[1];
   if(level)comments[level]=plainHtml(opt[2]);
  }
  const levelTexts={};
  for(const cell of inner.matchAll(/<td\b([^>]*\bclass="level"[^>]*)>([\s\S]*?)<\/td>/gi)){
   const level=cell[1].match(/data-l="(NE|I|II|III)"/i)?.[1];
   if(level)levelTexts[level]=plainHtml(cell[2]);
  }
  rows.set(key,{module:plainHtml(moduleHtml),comments,levelTexts,
    alternate:/\bclass="[^"]*\balt\b/.test(match[1])});
 }
 const expected=OFFICIAL.filter(x=>x.kind==='row').map(x=>x.key);
 if(rows.size!==expected.length||expected.some(key=>!rows.has(key)))
  throw new Error('Le tableau institutionnel ne contient pas exactement les 18 lignes officielles.');
 officialHtmlRows=rows;
 return rows;
}

const LEVELS=new Set(['NE','I','II','III']);
const NUMERIC_THRESHOLD={I:70,II:45};
function percentLevel(value){
 if(!Number.isFinite(value))return 'NE';
 return value>=NUMERIC_THRESHOLD.I?'I':value>=NUMERIC_THRESHOLD.II?'II':'III';
}
function fmt(value){return Number(value).toLocaleString('fr-FR',{maximumFractionDigits:2})+' %'}
function aggregateInstitutionalRows(evaluations){
 const sorted=[...(Array.isArray(evaluations)?evaluations:[])].sort((a,b)=>
   String(a.date||'').localeCompare(String(b.date||'')));
 const result=[],warnings=[];
 for(const line of OFFICIAL){
  if(line.kind==='section'){result.push({...line});continue;}
  let points=0,possible=0,scored=0,missing=0,manual=null,manualComment='',manualDetail='',latestModule='';
  for(const item of sorted){
   const rows=Array.isArray(item.archive?.document?.rows)?item.archive.document.rows:[];
   const src=rows.find(row=>row?.kind==='item'&&row.key===line.key);
   if(!src)continue;
   if(src.moduleText)latestModule=String(src.moduleText);
   const obtained=src.points,maximum=src.possible;
   const isNumeric=obtained!==null&&obtained!==undefined&&maximum!==null&&maximum!==undefined&&
     Number.isFinite(Number(obtained))&&Number.isFinite(Number(maximum))&&
     Number(maximum)>0&&Number(obtained)>=0&&Number(obtained)<=Number(maximum);
   if(isNumeric&&line.mode!=='manual'){
     points+=Number(obtained);
     possible+=Number(maximum);
     scored++;
   }else if(LEVELS.has(src.level)&&src.level!=='NE'){
     if(line.mode==='manual'){
       manual=src.level; // Dernière validation humaine, sans calcul de points fictifs.
       manualComment=String(src.comment||'');
       manualDetail=String(src.detail||'');
     }else missing++;
   }
  }
  if(missing)warnings.push({line:line.key,
    message:'Un pré-bilan comporte un niveau sans points numériques. Il doit être recalculé pour contribuer au pourcentage.'});
  const percent=possible>0?100*points/possible:null;
  const level=percent===null?(manual||'NE'):percentLevel(percent);
  const definition=officialRowDefinitions().get(line.key);
  // La formule choisit une phrase institutionnelle existante pour la note
  // consolidée. Les commentaires manuels proviennent du dernier pré-bilan.
  const comment=level==='NE'?'':line.mode==='manual'
    ?manualComment
    :(definition.comments[level]||'');
  const display=percent===null?'':fmt(percent);
  const detail=percent===null?manualDetail:(display+' de réponses correctes.');
  result.push({...line,points,possible,scored,percent:percent===null?null:Math.round(percent*100)/100,
    level,missing,display,comment,detail,
    moduleText:definition.module,latestModule});
 }
 return {rows:result,warnings};
}
function wordRows(general){
 const entries=Array.isArray(general?.institutionalRows)?general.institutionalRows:[];
 return entries.map(line=>line.kind==='section'
   ?{type:'section',text:line.label,strong:line.label==='Compétences techniques'}
   :{type:'row',key:line.key,module:line.moduleText||officialRowDefinitions().get(line.key)?.module||line.label,
     level:line.level||'NE',levelTexts:officialRowDefinitions().get(line.key)?.levelTexts||{},
     alternate:!!officialRowDefinitions().get(line.key)?.alternate,
     comment:line.comment||'',detail:line.detail||''});
}
module.exports={OFFICIAL,aggregateInstitutionalRows,wordRows,percentLevel,institutionalTableSource,officialRowDefinitions};
