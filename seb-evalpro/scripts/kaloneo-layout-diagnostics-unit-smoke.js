'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {inspectCandidateOverflow}=require('../src/kaloneo-layout-diagnostics');
function makeElement(cls,opts={}){
 const styles={overflowX:'visible',overflowY:'visible',...(opts.style||{})};
 return {
   classList:{contains:name=>name===cls},
   scrollWidth:opts.scrollWidth??100,clientWidth:opts.clientWidth??100,
   scrollHeight:opts.scrollHeight??100,clientHeight:opts.clientHeight??100,
   getClientRects:()=>[{}],styleInfo:styles,parentElement:null,
   contains(el){return this===el||el?.parentElement===this},
   querySelectorAll:()=>[],querySelector:()=>null
 };
}
function auditCases(zone,wrap=null,table=null){
 const root=makeElement('root');
 zone.parentElement=root;
 if(wrap)wrap.parentElement=zone;
 if(table)table.parentElement=wrap;
 root.contains=el=>el===root||el===zone||el===wrap||el===table;
 root.querySelectorAll=()=>[zone,...(wrap?[wrap]:[])];
 root.querySelector=()=>table;
 const doc={getElementById:id=>id==='kaltest-content'?root:null,
   defaultView:{getComputedStyle:node=>node.styleInfo}};
 return inspectCandidateOverflow(doc);
}
const scrolling=makeElement('kaltest-builder-runtime-zone',{
 scrollHeight:500,clientHeight:150,style:{overflowY:'auto',overflowX:'auto'}});
const normal=auditCases(scrolling);
assert.equal(normal.overflowZones,0);
assert.equal(normal.scrollableZones,1);
assert.equal(normal.tableHorizontalOverflow,false);
const forbidden=makeElement('kaltest-builder-content-item',{
 scrollHeight:500,clientHeight:150,style:{overflowY:'hidden'}});
const blocked=auditCases(forbidden);
assert.equal(blocked.overflowZones,1);
assert.equal(blocked.clippedAreas[0].target,'bloc');
const clipped=makeElement('kaltest-builder-grid-wrap',{
 scrollWidth:400,clientWidth:100,style:{overflowX:'hidden'}});
const scrollWrap=makeElement('kaltest-builder-grid-wrap',{
 scrollWidth:400,clientWidth:100,style:{overflowX:'auto'}});
const grid=makeElement('kaltest-builder-grid',{scrollWidth:400,clientWidth:100});
assert.equal(auditCases(scrolling,scrollWrap,grid).tableHorizontalOverflow,false);
assert.equal(auditCases(scrolling,clipped,grid).tableHorizontalOverflow,true);
const main=fs.readFileSync(path.join(__dirname,'../src/main.js'),'utf8');
const builder=fs.readFileSync(path.join(__dirname,'../../kaloneo/test-builder.js'),'utf8');
assert(main.includes('inspectCandidateOverflow.toString()'));
assert(!main.includes('z.scrollHeight>z.clientHeight+2'));
assert(builder.includes("warnings.push('contenu coupé ou inaccessible')"));
assert(!builder.includes("warnings.push('débordement de bloc')"));
console.log('KALONEO_LAYOUT_R124=OK : scroll autorisé, contenu coupé, grille inaccessible, Builder');
