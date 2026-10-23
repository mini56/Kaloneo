'use strict';
// Vérifie dans le vrai moteur Electron le tableau général repris du bilan institutionnel.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {app,BrowserWindow}=require('electron');
const {aggregateInstitutionalRows,wordRows,OFFICIAL}=require('../src/institutional-bilan-grid');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'overrides','admin-bilan.html'),'utf8');
const preload=fs.readFileSync(path.join(root,'src','candidate-catalog-preload.js'),'utf8');
const from=preload.indexOf('function renderInstitutionalGeneralTable(');
const to=preload.indexOf('\nasync function openGeneralBilan(',from);
assert(from>=0&&to>from,'Le rendu du tableau officiel est absent');
const renderer=preload.slice(from,to);
const evaluations=[
 {date:'2026-10-18',archive:{document:{rows:[
  {kind:'item',key:'math-problemes',level:'II',points:3,possible:5},
  {kind:'item',key:'fabrication-decoupe',level:'II',comment:'II. Les découpes ne sont pas droites ou incomplètes.'}
 ]}}},
 {date:'2026-10-21',archive:{document:{rows:[
  {kind:'item',key:'math-problemes',level:'I',points:7,possible:10},
  {kind:'item',key:'expression',level:'I',points:9,possible:10}
 ]}}}
];
const rows=aggregateInstitutionalRows(evaluations).rows;
assert.equal(rows.length,20);
assert.equal(wordRows({institutionalRows:rows}).length,20);
const manual=rows.find(x=>x.key==='fabrication-decoupe');
const math=rows.find(x=>x.key==='math-problemes');
assert.equal(manual.comment,'II. Les découpes ne sont pas droites ou incomplètes.');
assert.equal(math.percent,66.67);
assert.equal(math.level,'II');
assert(math.comment.startsWith('II.'));
assert(math.detail.includes('66,67 % de réponses correctes.'));
const timeout=setTimeout(()=>{console.error('KALONEO_R153_ORIGINAL_TABLE=TIMEOUT');app.exit(2)},45000);
async function run(){
 const win=new BrowserWindow({show:false,width:1366,height:768,webPreferences:{sandbox:false}});
 try {
  await win.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent('<!doctype html><html><body><main id="host"></main></body></html>'));
  const script=[
    '(()=>{',
    'const institutionalTableSource=()=>'+JSON.stringify(html)+';',
    renderer,
    'const host=document.getElementById("host");',
    'renderInstitutionalGeneralTable(host,'+JSON.stringify(rows)+');',
    'const shadow=host.shadowRoot;',
    'const table=shadow.querySelector("table");',
    'const all=[...table.querySelectorAll("tbody tr[data-r]")];',
    'const find=(key)=>all.find(row=>row.dataset.r===key);',
    'const manual=find("fabrication-decoupe"),math=find("math-problemes");',
    'return {headers:[...table.querySelectorAll("thead th")].map(x=>x.textContent.trim()),',
    'keys:all.map(r=>r.dataset.r),',
    'sections:table.querySelectorAll("tbody tr.section,tbody tr.section2").length,',
    'manual:{level:manual.querySelector(".level.on")?.dataset.l,comment:manual.querySelector("select").value,disabled:manual.querySelector("select").disabled},',
    'math:{level:math.querySelector(".level.on")?.dataset.l,comment:math.querySelector("select").value,detail:math.querySelector(".detail").textContent,disabled:math.querySelector("select").disabled},',
    'allReadOnly:[...table.querySelectorAll("select.csel")].every(s=>s.disabled),',
    'sectionBlue:getComputedStyle(table.querySelector("tbody tr.section td")).backgroundColor};',
    '})()'
  ].join('\n');
  const actual=await win.webContents.executeJavaScript(script,true);
  assert.deepEqual(actual.headers,['Modules','NE','I','II','III','Commentaires']);
  assert.deepEqual(actual.keys,OFFICIAL.filter(x=>x.kind==='row').map(x=>x.key));
  assert.equal(actual.sections,3);
  assert.equal(actual.manual.level,'II');assert.equal(actual.manual.comment,manual.comment);
  assert(actual.manual.disabled);
  assert.equal(actual.math.level,'II');assert.equal(actual.math.comment,math.comment);
  assert.equal(actual.math.detail,math.detail);assert(actual.math.disabled&&actual.allReadOnly);
  assert.notEqual(actual.sectionBlue,'rgba(0, 0, 0, 0)','Feuille institutionnelle absente');
  console.log('KALONEO_R153_ORIGINAL_TABLE=OK — 6 colonnes, 17 lignes, 3 sections, commentaires, pourcentages et lecture seule');
 } finally {win.destroy()}
}
app.whenReady().then(()=>run().then(()=>{clearTimeout(timeout);app.quit()}).catch(e=>{console.error('KALONEO_R153_ORIGINAL_TABLE=FAIL',e.stack||e);app.exit(2)}));
