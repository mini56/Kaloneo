'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const grid=require('../src/institutional-bilan-grid');
const {aggregateGeneralBilan,wordRows}=require('../src/general-bilan-aggregation');
const builderLink=require('../../kaloneo/bilan-simple-link');
const official=grid.OFFICIAL;
const rowIds=official.filter(x=>x.kind==='row').map(x=>x.key);
assert.equal(rowIds.length,18);
assert.equal(new Set(rowIds).size,18);
assert.equal(official.filter(x=>x.kind==='section').length,3);
const html=fs.readFileSync(path.join(__dirname,'..','overrides','admin-bilan.html'),'utf8');
const htmlIds=[...html.matchAll(/<tr[^>]*data-r="([^"]+)"[^>]*>/g)].map(x=>x[1]);
assert.deepEqual(rowIds,htmlIds,'Grille générale différente du véritable bilan individuel.');
const fake={id:'unknown-custom',title:'Nouveauté',category:'mathématiques',scored:true};
const archive=(rows)=>({document:{rows:rows.map(r=>({kind:'item',...r}))}});
const evals=[
 {candidateId:'a',date:'2026-10-18',parcours:'P1',session:{},
  archive:archive([
   {key:'math-problemes',points:3,possible:5,level:'II'},
   {key:'expression',points:7,possible:10,level:'II'},
   {key:'competences-transversales',points:4,possible:5,level:'I'},
   {key:'fabrication-decoupe',level:'III'},
   {key:'act_pratique_inventee',level:'I'}
  ])},
 {candidateId:'b',date:'2026-10-21',parcours:'P2',session:{},
  archive:archive([
   {key:'math-problemes',points:7,possible:10,level:'I'},
   {key:'expression',points:8,possible:10,level:'I'},
   {key:'competences-transversales',points:5,possible:10,level:'II'},
   {key:'fabrication-decoupe',level:'II'}
  ])}
];
const data=aggregateGeneralBilan(evals);
const row=key=>data.institutionalRows.find(r=>r.key===key);
assert.equal(data.institutionalRows.length,21,'3 sections + 18 official lines');
assert.equal(row('math-problemes').points,10);
assert.equal(row('math-problemes').possible,15);
assert.equal(row('math-problemes').percent,66.67,'Additionner les points, pas les pourcentages.');
assert.equal(row('math-problemes').level,'II');
assert.equal(row('expression').percent,75);
assert.equal(row('competences-transversales').points,9);
assert.equal(row('competences-transversales').possible,15);
assert.equal(row('competences-transversales').percent,60);
assert.equal(row('competences-transversales').level,'II');
assert(row('competences-transversales').comment.startsWith('II.'));
assert.equal(row('competences-transversales').detail,'60 % de réponses correctes.');
assert.equal(row('fabrication-decoupe').percent,null);
assert.equal(row('fabrication-decoupe').level,'II','Dernier jugement validé par l’administrateur, sans recalcul fictif.');
assert(!row('act_pratique_inventee'),'Une rubrique inventée ne peut apparaître.');
assert(row('math-problemes').comment.includes('II.'),'Même commentaire que dans le bilan individuel.');
assert.equal(row('fabrication-decoupe').comment,'','Aucun commentaire pratique inventé.');
const word=wordRows(data);
assert.equal(word.length,21);
assert.deepEqual(word.filter(x=>x.type==='row').map(x=>x.key),rowIds);
assert(!word.some(x=>/TOTAL|parcours|passage/i.test(x.module||'')));
assert(word.find(x=>x.key==='math-problemes').comment.includes('II.'),'Le commentaire provient du vrai tableau institutionnel.');
assert(word.find(x=>x.key==='math-problemes').detail.includes('66,67 % de réponses correctes.'),'Pourcentage + phrase attendue.');
assert(word.find(x=>x.key==='fabrication-decoupe').comment==='');
assert.equal(word.find(x=>x.key==='competences-transversales').detail,'60 % de réponses correctes.');
const incomplete=grid.aggregateInstitutionalRows([{archive:archive([{key:'math-problemes',level:'I'}])}]);
assert(incomplete.warnings.length>0);
assert.equal(incomplete.rows.find(x=>x.key==='math-problemes').percent,null,'Pas de pourcentage inventé.');
const scope={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','..','kaloneo','bilan-catalog.js'),'utf8'),scope);
const catalog=scope.window.KaloneoBilanCatalog;
assert.equal(catalog.length,18);
for(const [category,expected] of [
  ['mathematiques','bilan.savoirs_fondamentaux.mathematiques.'],
  ['francais','bilan.savoirs_fondamentaux.expression_ecrite.'],
  ['numerique','bilan.tic.'],
  ['competences_transversales','bilan.savoirs_fondamentaux.competences_transversales.'],
  ['activite_pratique','bilan.competences_techniques.']
]){
 const options=builderLink.options(category,catalog);
 assert(options.length>0,'Aucune ligne pour '+category);
 assert(options.every(l=>l.id.startsWith(expected)),'Mauvais domaine pour '+category);
 const link=builderLink.contribution(options[0],category);
 assert(builderLink.validate(category,[link],catalog).ok);
 if(category==='activite_pratique')assert.deepEqual(link.bindings,{});
 else assert.deepEqual(link.bindings,{score:'score',score_max:'score_max'});
}
assert(!builderLink.validate('mathematiques',[{lineId:'bilan.savoirs_fondamentaux.competences_transversales.mobiliser_competences'}],catalog).ok,'Ne pas affecter la catégorie transversale aux mathématiques.');
assert(!builderLink.validate('mathematiques',[],catalog).ok,'La liaison doit être obligatoire.');
assert(!builderLink.validate('mathematiques',[
 {lineId:'bilan.savoirs_fondamentaux.expression_ecrite.maitrise',bindings:{}}
],catalog).ok,'Pas de mathématiques dans Expression écrite.');
assert(!builderLink.validate('mathematiques',[
 {lineId:'bilan.savoirs_fondamentaux.mathematiques.comprendre_enonce_consigne'},
 {lineId:'bilan.savoirs_fondamentaux.mathematiques.resoudre_problemes'}
],catalog).ok,'Une seule ligne à la création du test.');
const builderHTML=fs.readFileSync(path.join(__dirname,'..','..','kaloneo','test-builder.html'),'utf8');
assert(builderHTML.includes('id="bilan-simple-line"'));
assert(builderHTML.includes('src="bilan-simple-link.js"'));
const builderJS=fs.readFileSync(path.join(__dirname,'..','..','kaloneo','test-builder.js'),'utf8');
assert(builderJS.includes('installSimpleBilanLink()'));
assert(builderJS.includes('KaloneoSimpleBilanLink.validate('));
const generalUI=fs.readFileSync(path.join(__dirname,'..','src','candidate-catalog-preload.js'),'utf8');
assert(generalUI.includes('renderInstitutionalGeneralTable('),'Le bilan général doit réutiliser le tableau source.');
assert(generalUI.includes('institutionalTableSource()'),'Le bilan général doit lire le véritable HTML institutionnel.');
assert(generalUI.includes('Bilan de parcour complet'));
assert(!generalUI.includes('<table class="seb-gb-table"'),'La copie simplifiée du tableau doit disparaître.');
assert(generalUI.includes('general.institutionalRows'));
assert(!generalUI.includes('general.evaluationCount} PARCOURS'));
assert(!generalUI.includes('Résultats regroupés par catégorie'));
const wordMain=fs.readFileSync(path.join(__dirname,'..','src','candidate-catalog-main.js'),'utf8');
assert(!wordMain.includes("'BILAN GENERAL DE '+general.evaluationCount"));
console.log('KALONEO_R152_INSTITUTIONAL_GRID=OK — 18 lignes, Builder obligatoire, bilan consolidé en lecture seule et Word fidèle');
