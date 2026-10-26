'use strict';
// Une seule règle de cohérence pour le bilan courant, archivé, la révision
// et l'export Word. Le niveau officiel (cellule colorée) prime toujours sur
// un ancien commentaire déroulant devenu incompatible. Ne modifie AUCUN score.
const LEVELS=new Set(['NE','I','II','III']);
function alignedPreset(level,preset,options){
 const original=String(preset||'');
 const target=String(level||'');
 if(!LEVELS.has(target))return original;
 if(!Array.isArray(options)||!options.length)return original; // vieux dossiers sans choix conservés
 const found=options.find(opt=>String(opt?.value||'')===original);
 if(found&&String(found.level||'')===target)return original;
 const match=options.find(opt=>String(opt?.level||'')===target);
 return match?String(match.value||''):original;
}
function alignBilanRow(row){
 if(!row||row.kind==='section')return row;
 const next=alignedPreset(row.level,row.preset,row.options);
 if(next===String(row.preset||''))return row;
 const normalized={...row,preset:next};
 // Les anciens éditeurs copiaient parfois le choix dans comment.
 // Une remarque écrite librement ne doit jamais être écrasée.
 if(String(row.comment||'')===String(row.preset||''))normalized.comment=next;
 return normalized;
}
function alignBilanRows(rows){return Array.isArray(rows)?rows.map(alignBilanRow):[]}
module.exports={LEVELS,alignedPreset,alignBilanRow,alignBilanRows};
