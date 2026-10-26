'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {normalizeErrorCounts}=require('../src/bilan-error-count');
const {projectDocument}=require('../src/bilan-parcours');
const {OFFICIAL,wordRows}=require('../src/institutional-bilan-grid');
const {aggregateGeneralBilan}=require('../src/general-bilan-aggregation');
const root=path.resolve(__dirname,'..');
for(const [input,expected] of [
 ['0 erreurs','0 erreur'],['1 erreurs','1 erreur'],['2 erreurs','2 erreurs'],
 ['0 erreur','0 erreur'],['1 erreur','1 erreur'],['12 erreurs','12 erreurs'],
 ['7 erreurs et 1 erreurs','7 erreurs et 1 erreur'],
 ['0 ERREURS et 1 ERREUR','0 erreur et 1 erreur']
])assert.equal(normalizeErrorCounts(input),expected);
const html=fs.readFileSync(path.join(root,'overrides/admin-bilan.html'),'utf8');
const row=html.match(/<tr\s+data-r="tri-erreurs"[^>]*>([\s\S]*?)<\/tr>/)?.[1]||'';
assert(row,'Ligne Tri erreurs absente du vrai modèle institutionnel.');
assert(/<td><b>Nombre d’erreurs effectuées<\/b><\/td>/.test(row),'Libellé seul dans la colonne Modules.');
assert(row.includes('<div id="triErr"'),'Compteur dans les commentaires.');
assert(row.indexOf('id="triErr"')>row.indexOf('</select>'),'Compteur sous la liste de fiabilité.');
const buttons=html.match(/<div class="bilan-bottom-actions"[^>]*>([\s\S]*?)<\/div>/)?.[1]||'';
for(const id of ['auto','save','word','close-bilan-top'])assert(buttons.includes('id="'+id+'"'),'Bouton non placé en bas : '+id);
assert(/\.bilan-bottom-actions\{position:fixed;left:0;right:0;bottom:0/.test(html));
const document={title:'Bilan institutionnel',rows:OFFICIAL.map(r=>r.kind==='section'
 ?{kind:'section',sectionText:r.label}
 :{kind:'item',key:r.key,moduleText:r.label,level:'NE',points:null,possible:null,
 triErrors:r.key==='tri-erreurs'?'1 erreurs':''})};
const session={seb_kaloneo_results_manifest:JSON.stringify({tests:[{id:'tri_chevilles',category:'technique'}]}),
 seb_kaltest_pilot2_state_v1:JSON.stringify({tests:{tri_chevilles:{status:'COMPLETED',tri:{rows:[
 {seconds:10,errors:1},{seconds:12,errors:0},{seconds:13,errors:0},{seconds:10,errors:0},{seconds:14,errors:0}
 ]}}}})};
const projection=projectDocument(document,session);
assert.equal(projection.rows.find(x=>x.key==='tri-erreurs').triErrors,'1 erreur','Ancien bilan corrigé sans inventer un score.');
const general=aggregateGeneralBilan([{candidateId:'test',session,archive:{document:projection}}]);
const word=wordRows(general).find(row=>row.key==='tri-erreurs');
assert(word,'La ligne du tri doit être présente dans le Word.');
assert.equal(word.module,'Nombre d’erreurs effectuées');
assert.equal(word.extra,'1 erreur','Le nombre doit être dans la colonne de droite du Word.');
assert.equal(normalizeErrorCounts('Tri : 0 erreurs (1 erreurs avant reprise)'),'Tri : 0 erreur (1 erreur avant reprise)');
const history=fs.readFileSync(path.join(root,'src/bilan-history-preload.js'),'utf8');
assert(history.includes('.seb-bh-editor-body{flex:1;min-height:0;overflow:auto'));
assert(history.includes('.seb-bh-editor-foot{display:flex;flex:none;'));
const wordPreview=fs.readFileSync(path.join(root,'src/candidate-catalog-preload.js'),'utf8');
assert(wordPreview.includes('footer.appendChild(close)')&&wordPreview.includes('panel.appendChild(footer)'));
console.log('TRI_WORD_FOOTER=OK — colonne droite, 0/1/2 erreurs, archives/Word, boutons bas fixes');
