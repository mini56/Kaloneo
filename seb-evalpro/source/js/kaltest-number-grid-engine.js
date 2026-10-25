(function(root,factory){
'use strict';
const engine=factory();
if(typeof module==='object'&&module.exports)module.exports=engine;
if(root)root.KaloneoNumberGrid=engine;
})(typeof window!=='undefined'?window:null,function(){
'use strict';
// Correction indépendante de l'orientation de la solution ; aucun calcul
// arbitraire et aucune image requise dans le Builder.
function evaluate(config,answers){
 const ids=Array.isArray(config?.questionIds)?config.questionIds.map(String):[];
 const solutions=Array.isArray(config?.solutions)?config.solutions:[];
 if(ids.length!==9||new Set(ids).size!==9||solutions.length===0)
   throw new Error('Grille mathématique : correction à neuf cases manquante');
 const values=ids.map(id=>{
   const raw=String(answers?.[id]??'').trim();
   return /^[1-9]$/.test(raw)?Number(raw):null;
 });
 let best=null,bestCount=-1;
 for(const solution of solutions){
   if(!Array.isArray(solution)||solution.length!==9||new Set(solution).size!==9||
     solution.some(v=>!Number.isInteger(v)||v<1||v>9))
     throw new Error('Grille mathématique : solution de référence invalide');
   const n=solution.reduce((total,v,i)=>total+(values[i]===v?1:0),0);
   if(n>bestCount){bestCount=n;best=solution;}
 }
 const details={};
 ids.forEach((id,i)=>{details[id]=values[i]!==null&&values[i]===best[i]});
 return {details,correct:bestCount,total:9,fullyCorrect:bestCount===9};
}
return Object.freeze({evaluate});
});
