'use strict';
// Une même sélection pour l'archive, son éditeur, le Word et la consolidation.
const fs=require('fs'),path=require('path');
const bundled=path.join(__dirname,'..','app','web','js','kaloneo-bilan-routing.js');
const routing=require(fs.existsSync(bundled)?bundled:'../source/js/kaloneo-bilan-routing');
function decode(value){if(value&&typeof value==='object')return value;try{return JSON.parse(value||'null')}catch(_){return null}}
function statesFrom(session){
  for(const [key,value] of Object.entries(session||{})){
    if(!key.startsWith('seb_kaltest_pilot2_state_v1'))continue;
    const state=decode(value);if(state?.tests)return state.tests;
  }
  return {};
}
function testsFrom(document,session,metadata=[]){
  const frozen=Array.isArray(document?.parcoursTests)?document.parcoursTests:null;
  const manifest=decode(session?.seb_kaloneo_results_manifest);
  const tests=frozen|| (Array.isArray(manifest?.tests)?manifest.tests:null);
  if(!tests)return null; // Les dossiers sans manifeste restent lisibles, sans inventer un parcours.
  return tests.map(test=>{
    const meta=metadata.find(m=>m.id===test.id&&(!test.version||m.version===test.version))||{};
    return {...meta,...test,
      adminModified:typeof test.adminModified==='boolean'?test.adminModified:meta.adminModified===true,
      bilanContributions:Array.isArray(test.bilanContributions)?test.bilanContributions:(meta.bilanContributions||[])};
  });
}
function validPair(row){return row?.points!==null&&row?.points!==undefined&&row?.possible!==null&&row?.possible!==undefined&&Number.isFinite(Number(row.points))&&Number.isFinite(Number(row.possible))&&Number(row.possible)>0&&Number(row.points)>=0&&Number(row.points)<=Number(row.possible)}
function resultState(states,id){
  const state=states[id];
  return routing.nonEvaluated(state)?null:state;
}
function rowScores(tests,states){
  const sums=new Map();
  const add=(key,pair)=>{if(!pair)return;const sum=sums.get(key)||{score:0,max:0};sum.score+=pair.score;sum.max+=pair.max;sums.set(key,sum)};
  for(const [key,ids] of Object.entries(routing.LEGACY)){
    if(key.startsWith('fabrication-')||key.startsWith('briques-')||key.startsWith('tri-'))continue;
    for(const test of tests.filter(t=>ids.includes(t.id)&&!t.adminModified)){
      add(key,routing.scoreOf(resultState(states,test.id)?.result,{score:'score',score_max:'score_max'}));
    }
  }
  const linked=routing.collect(tests,id=>resultState(states,id));
  for(const [key,entries] of linked.entries)for(const entry of entries)add(key,entry.pair);
  return sums;
}
function projectDocument(document,session={},metadata=[]){
  const tests=testsFrom(document,session,metadata);
  if(!document||!tests)return document;
  const states=statesFrom(session);
  const selected=routing.selectedRows(tests),scores=rowScores(tests,states);
  const rows=[];let section=null,sectionAdded=false;
  for(const original of document.rows||[]){
    if(original.kind==='section'){section=original;sectionAdded=false;continue}
    if(!selected.has(original.key))continue;
    if(section&&!sectionAdded){rows.push({...section});sectionAdded=true}
    const row={...original};
    const sources=tests.filter(t=>routing.selectedRows([t]).has(row.key));
    const abandoned=sources.length&&sources.every(t=>/ABANDON|SKIP/i.test(String(states[t.id]?.status||''))&&routing.nonEvaluated(states[t.id]));
    if(abandoned){row.level='NE';row.points=null;row.possible=null;row.preset='';row.comment='';row.detail='Exercice abandonné.'}
    const pair=scores.get(row.key);
    if(!validPair(row)&&pair){row.points=pair.score;row.possible=pair.max}
    // Temps du tri et appréciations sans barème numérique restent des niveaux,
    // jamais des pourcentages fabriqués à partir de I / II / III.
    if(!validPair(row)&&(/^(fabrication-|briques-|tri-)/.test(row.key)))row.assessmentMode='level';
    rows.push(row);
  }
  return {...document,parcoursTests:tests,rows};
}
function projectArchive(archive,session,metadata){
  return {...archive,document:projectDocument(archive.document,session,metadata)};
}
module.exports={projectDocument,projectArchive,testsFrom,statesFrom,rowScores,validPair,nonEvaluated:routing.nonEvaluated};
