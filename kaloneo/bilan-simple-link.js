/* Couche de liaison unique : une ligne officielle par test créé avec Builder. */
(function(root,factory){
'use strict';
const api=factory();
if(typeof module==='object'&&module.exports)module.exports=api;
if(root)root.KaloneoSimpleBilanLink=api;
})(typeof window!=='undefined'?window:null,function(){
'use strict';
const norm=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
function allowed(category,line){
 if(!line||!line.id)return false;
 const id=String(line.id),c=norm(category);
 if(c==='competences_transversales')return id==='bilan.savoirs_fondamentaux.competences_transversales.mobiliser_competences'&&line.mode==='automatic';
 if(c==='mathematiques')return id.startsWith('bilan.savoirs_fondamentaux.mathematiques.');
 if(c==='francais')return id.startsWith('bilan.savoirs_fondamentaux.expression_ecrite.');
 if(c==='numerique')return id.startsWith('bilan.tic.');
 if(c==='activite_pratique')return line.mode==='manual'&&id.startsWith('bilan.competences_techniques.');
 if(c==='organisation')return /\.gestion_logistique\.|\.planning\./.test(id);
 if(c==='planification')return /\.planning\./.test(id);
 if(c==='technique')return id.startsWith('bilan.competences_techniques.')&&line.mode!=='manual';
 return false;
}
function options(category,catalog){
 return (Array.isArray(catalog)?catalog:[]).filter(line=>allowed(category,line));
}
function contribution(line,category){
 if(!allowed(category,line))return null;
 return {lineId:String(line.id),bindings:line.mode==='manual'?{}:{score:'score',score_max:'score_max'}};
}
function validate(category,links,catalog){
 const array=Array.isArray(links)?links:[];
 if(array.length!==1)return {ok:false,error:'Choisir une seule ligne du bilan institutionnel.'};
 const match=(Array.isArray(catalog)?catalog:[]).find(x=>x.id===array[0]?.lineId);
 if(!match||!allowed(category,match))return {ok:false,error:'La ligne du bilan est incompatible avec la catégorie.'};
 return {ok:true,line:match};
}
return Object.freeze({allowed,options,contribution,validate});
});
