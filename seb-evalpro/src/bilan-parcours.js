'use strict';
// Une même sélection pour l'archive, son éditeur, le Word et la consolidation.
const fs=require('fs'),path=require('path');
const bundled=path.join(__dirname,'..','app','web','js','kaloneo-bilan-routing.js');
const routing=require(fs.existsSync(bundled)?bundled:'../source/js/kaloneo-bilan-routing');
const {normalizeErrorCounts}=require('./bilan-error-count');
const {alignBilanRow}=require('./bilan-level-consistency');
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
// Récupération des mesures d'une ancienne archive depuis SON état enregistré.
// Les valeurs déjà figées dans le bilan restent prioritaires.
function restoreTri(document,session){
 if(!document)return document;
 const state=statesFrom(session).tri_chevilles||{};
 let attempts=Array.isArray(state.tri?.rows)?state.tri.rows.slice(0,5):[];
 attempts=attempts.filter(r=>r?.seconds!==null&&r?.seconds!==undefined&&Number.isFinite(Number(r.seconds))&&Number(r.seconds)>=0&&r.errors!==null&&r.errors!==undefined&&String(r.errors).trim()!==''&&Number.isFinite(Number(r.errors)));
 if(!attempts.length&&Array.isArray(state.result?.tri?.temps_essais)){
  attempts=state.result.tri.temps_essais.slice(0,5).filter(x=>x!==null&&Number.isFinite(Number(x))&&Number(x)>=0).map((seconds,i)=>({seconds:Number(seconds),errors:i===0?state.result.tri.erreurs_total:0}));
 }
 if(!attempts.length){
  const legacy=decode(session?.tri_cheville_data);
  attempts=(legacy?.tris||[]).slice(0,5).filter(r=>Number(r.minutes)||Number(r.secondes)).map(r=>({seconds:(Number(r.minutes)||0)*60+(Number(r.secondes)||0),errors:r.erreurs}));
 }
 const pad=x=>String(x).padStart(2,'0');
 const seconds=attempts.length?Math.round(attempts.reduce((sum,r)=>sum+Number(r.seconds),0)/attempts.length):null;
 const total=attempts.length&&attempts.every(r=>r.errors!==null&&r.errors!==undefined&&Number.isFinite(Number(r.errors)))?attempts.reduce((sum,r)=>sum+Number(r.errors),0):null;
 return {...document,rows:(document.rows||[]).map(row=>{
  if(row.key==='tri-temps')return {...row,
   triTimes:row.triTimes||(attempts.length?attempts.map((r,i)=>'N°'+(i+1)+' : '+pad(Math.floor(r.seconds/60))+' min '+pad(r.seconds%60)+' s').join('\n'):''),
   triAverage:row.triAverage||String(row.moduleText||'').match(/Moyenne\s+(\d{1,3}:\d{2})/i)?.[1]||(seconds!==null?pad(Math.floor(seconds/60))+':'+pad(seconds%60):'')};
  if(row.key==='tri-erreurs')return {...row,triErrors:normalizeErrorCounts(row.triErrors||String(row.moduleText||'').match(/\b\d+\s+erreurs?\b/i)?.[0]||(total!==null?total+' erreur'+(total===1?'':'s'):''))};
  return row;
 })};
}
function projectDocument(document,session={},metadata=[]){
  document=restoreTri(document,session);
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
    if(!validPair(row)&&pair){
      row.points=pair.score;row.possible=pair.max;
      // Une archive autrefois marquée NE faute de liaison retrouve son niveau
      // réel à partir des résultats sauvegardés. Un niveau validé par
      // l'administrateur n'est pas remplacé silencieusement.
      if((!row.level||row.level==='NE')&&!(/^(fabrication-|briques-|tri-)/.test(row.key))){
        const pct=100*pair.score/pair.max;
        row.level=pct>=70?'I':pct>=45?'II':'III';
        row.detail=pct.toLocaleString('fr-FR',{maximumFractionDigits:2})+' % de réponses correctes.';
      }
    }
    // Temps du tri et appréciations sans barème numérique restent des niveaux,
    // jamais des pourcentages fabriqués à partir de I / II / III.
    if(!validPair(row)&&(/^(fabrication-|briques-|tri-)/.test(row.key)))row.assessmentMode='level';
    rows.push(alignBilanRow(row));
  }
  return {...document,parcoursTests:tests,rows};
}
function projectArchive(archive,session,metadata){
  return {...archive,document:projectDocument(archive.document,session,metadata)};
}
module.exports={projectDocument,projectArchive,testsFrom,statesFrom,rowScores,validPair,nonEvaluated:routing.nonEvaluated};
