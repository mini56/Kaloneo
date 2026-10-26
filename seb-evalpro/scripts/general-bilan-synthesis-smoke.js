'use strict';
const assert=require('node:assert/strict');
const {generateGeneralSynthesis}=require('../src/general-bilan-synthesis');
const {OFFICIAL}=require('../src/institutional-bilan-grid');
const person={nom:'TEST',prenom:'SYNTHESE',civilite:'Mme'};
const general=(rows,extra={})=>({sourceDigest:'source-validée',institutionalRows:rows.map(row=>({kind:'row',...row})),...extra});
const math=general([{key:'math-enonce',level:'II',detail:'66,67 % de réponses correctes.'},{key:'math-problemes',level:'I',detail:'80 % de réponses correctes.'}]);
const original=JSON.stringify(math);
const out=generateGeneralSynthesis(person,math);
assert(out.text.includes('différents parcours'));
assert(/mathématiques/.test(out.text));
assert(/66,67|66\.67/.test(out.text));
assert(out.text.includes('80 %'));
assert(!/fabrication|messagerie|briques|traitement de texte|expression écrite/i.test(out.text),'Aucun domaine absent ne doit être ajouté.');
assert.equal(JSON.stringify(math),original,'Générer ne modifie ni les niveaux ni les scores.');
assert.equal(out.sourceDigest,math.sourceDigest);
assert.equal(out.text,generateGeneralSynthesis(person,math).text,'Même consolidation = même synthèse.');
const arbitrary={...math,notes:[{summary:'RUBRIQUE_ET_INTERPRETATION_A_NE_PAS_COPIER'}]};
assert(!generateGeneralSynthesis(person,arbitrary).text.includes('RUBRIQUE_ET_INTERPRETATION'));
for(const level of ['I','II','III','NE']){
 const t=generateGeneralSynthesis(person,general([{key:'competences-transversales',level}]));
 assert(/compétences transversales/.test(t.text),'La dix-huitième ligne doit être couverte.');
 if(level==='NE')assert(/hors interprétation/.test(t.text));
}
const ne=generateGeneralSynthesis(person,general([{key:'math-problemes',level:'NE',detail:'Exercice abandonné.'}]));
assert(/hors interprétation|interromp/.test(ne.text));
assert(!/80 %|0 %|maîtris|satisfaisant/.test(ne.text),'Aucun score ou acquis inventé pour un abandon NE.');
const warn=generateGeneralSynthesis(person,general([{key:'math-enonce',level:'NE'}],{institutionalWarnings:[{line:'math-enonce'}]}));
assert(warn.text.includes('consolidation reste partielle'));
for(const level of ['I','II','III','NE']){
 const rows=OFFICIAL.filter(row=>row.kind==='row').map(row=>({...row,level,comment:'',detail:''}));
 const all=generateGeneralSynthesis(person,{sourceDigest:'all-'+level,institutionalRows:rows});
 assert(all.text.length>100);
 assert(!/undefined|null|diagnostic|profil psychologique/.test(all.text));
 assert(all.text.includes('compétences transversales'));
}
assert.throws(()=>generateGeneralSynthesis(person,general([])),/Aucune ligne/);
console.log('GENERAL_BILAN_SYNTHESIS=OK — consolidation réelle, maths seules, 18 lignes, NE, aucune copie des anciens textes, aucune mutation');
