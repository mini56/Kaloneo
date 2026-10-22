'use strict';
/* Modèle institutionnel figé — exactement 17 lignes et 3 sections.
 * Les libellés sont copiés du tableau historique admin-bilan.html.
 * Aucun test, catégorie ou parcours ne peut en ajouter.
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
  }
]);
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
  let points=0,possible=0,scored=0,missing=0,manual=null;
  for(const item of sorted){
   const rows=Array.isArray(item.archive?.document?.rows)?item.archive.document.rows:[];
   const src=rows.find(row=>row?.kind==='item'&&row.key===line.key);
   if(!src)continue;
   const obtained=src.points,maximum=src.possible;
   const isNumeric=obtained!==null&&obtained!==undefined&&maximum!==null&&maximum!==undefined&&
     Number.isFinite(Number(obtained))&&Number.isFinite(Number(maximum))&&
     Number(maximum)>0&&Number(obtained)>=0&&Number(obtained)<=Number(maximum);
   if(isNumeric){
     points+=Number(obtained);
     possible+=Number(maximum);
     scored++;
   }else if(LEVELS.has(src.level)&&src.level!=='NE'){
     if(line.mode==='manual')manual=src.level; // dernière évaluation administrateur (chronologique)
     else missing++;
   }
  }
  if(missing)warnings.push({line:line.key,
    message:'Un pré-bilan comporte un niveau sans points numériques. Il doit être recalculé pour contribuer au pourcentage.'});
  const percent=possible>0?100*points/possible:null;
  result.push({...line,points,possible,scored,percent:percent===null?null:Math.round(percent*100)/100,
    level:percent===null?(manual||'NE'):percentLevel(percent),
    missing,display:percent===null?'':fmt(percent)});
 }
 return {rows:result,warnings};
}
function wordRows(general){
 const entries=Array.isArray(general?.institutionalRows)?general.institutionalRows:[];
 return entries.map(line=>line.kind==='section'
   ?{type:'section',text:line.label,strong:true}
   :{type:'row',key:line.key,module:line.label,level:line.level||'NE',
     comment:line.display||'',detail:''});
}
module.exports={OFFICIAL,aggregateInstitutionalRows,wordRows,percentLevel};
