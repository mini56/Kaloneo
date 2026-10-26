'use strict';
// Audit exhaustif de la capture du 26/10 : cellule niveau I verte / phrase II,
// sans retoucher les barèmes et sans supprimer les annotations de l'administrateur.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {OFFICIAL}=require('../src/institutional-bilan-grid');
const {alignedPreset,alignBilanRow,alignBilanRows}=require('../src/bilan-level-consistency');
const {projectDocument}=require('../src/bilan-parcours');
const source=fs.readFileSync(path.join(__dirname,'..','overrides','admin-bilan.html'),'utf8');
const rows=[...source.matchAll(/<tr\b[^>]*data-r="([^"]+)"[^>]*>([\s\S]*?)<\/tr>/g)];
const keys=OFFICIAL.filter(x=>x.kind==='row').map(x=>x.key);
assert.equal(keys.length,18,'Grille institutionnelle figée à 18 lignes.');
assert.deepEqual(rows.map(m=>m[1]),keys,'Aucune ligne inventée ou manquante.');
const seen=new Set();
for(const [,key,html]of rows){
 assert(!seen.has(key),'Doublon institutionnel '+key);seen.add(key);
 const options=[...html.matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option>/g)].map(m=>({
   value:m[2],text:m[2],level:m[1].match(/data-l="(NE|I|II|III)"/)?.[1]||''
 }));
 for(const level of ['NE','I','II','III'])assert(options.some(o=>o.level===level),'Niveau '+level+' absent : '+key);
 for(const level of ['NE','I','II','III']){
   for(const other of ['NE','I','II','III'].filter(l=>l!==level)){
    const wrong=options.find(o=>o.level===other).value;
    const right=options.find(o=>o.level===level).value;
    const test={kind:'item',key,level,preset:wrong,comment:wrong,detail:'100 % de réponses correctes.',points:3,possible:3,options};
    const aligned=alignBilanRow(test);
    assert.equal(aligned.preset,right,key+' : phrase '+other+' doit devenir '+level);
    assert.equal(aligned.comment,right,key+' : commentaire redondant corrigé');
    assert.equal(aligned.level,level);
    assert.equal(aligned.points,3);assert.equal(aligned.possible,3);
    assert.equal(aligned.detail,'100 % de réponses correctes.');
   }
   const correct=options.find(o=>o.level===level).value;
   const free=alignBilanRow({kind:'item',key,level,preset:correct,comment:'Note spécifique de l’administrateur',options});
   assert.equal(free.preset,correct);assert.equal(free.comment,'Note spécifique de l’administrateur');
   const divergent=alignBilanRow({kind:'item',key,level,preset:options.find(o=>o.level==='II').value,comment:'Observation distincte validée',options});
   assert.equal(divergent.comment,'Observation distincte validée','Ne pas effacer une appréciation libre.');
 }
}
assert.equal(alignBilanRows([]).length,0);
assert.equal(alignedPreset('','texte sans niveau',[{value:'texte sans niveau',level:''}]),'texte sans niveau');
const transversale=rows.find(m=>m[1]==='competences-transversales');
const opts=[...transversale[2].matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option>/g)].map(m=>({value:m[2],text:m[2],level:m[1].match(/data-l="(NE|I|II|III)"/)?.[1]||''}));
const gesture={id:'gestes_postures',version:'1.0.0',title:'Gestes et postures',category:'competences_transversales',
 bilanContributions:[{lineId:'bilan.savoirs_fondamentaux.competences_transversales.mobiliser_competences',bindings:{score:'score',score_max:'score_max'}}]};
const current={parcoursTests:[gesture],rows:[{kind:'section',sectionText:'Savoirs fondamentaux'},
 {kind:'item',key:'competences-transversales',level:'I',preset:opts.find(x=>x.level==='II').value,
 comment:'',detail:'100 % de réponses correctes.',points:3,possible:3,options:opts}]};
const projected=projectDocument(current,{seb_kaltest_pilot2_state_v1:JSON.stringify({tests:{
 gestes_postures:{status:'COMPLETED',result:{score:3,scoreMax:3,percentage:100}}}})});
const result=projected.rows.find(row=>row.key==='competences-transversales');
assert(result,'Gestes et postures doit alimenter la ligne officielle.');
assert.equal(result.level,'I');assert.equal(result.preset,opts.find(x=>x.level==='I').value);
assert.equal(result.detail,'100 % de réponses correctes.');assert.equal(result.points,3);
assert.equal(result.possible,3);
console.log('KALONEO_BILAN_18_LINES_LEVEL_COMMENT=OK — 18 lignes, 4 niveaux, 216 incohérences rectifiées; commentaires libres et points préservés; Gestes 3/3=I');
