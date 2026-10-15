'use strict';
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const runtime=fs.readFileSync(path.join(__dirname,'..','source','js',
  'kaltest-pilot2-runtime.js'),'utf8');
const extract=(start,end)=>{
  const a=runtime.indexOf(start),b=runtime.indexOf(end,a);
  assert(a>=0&&b>a,'Impossible de localiser le moteur réel : '+start);
  return runtime.slice(a,b);
};
const normalize=value=>String(value==null?'':value).replace(/\u00a0/g,' ')
  .trim().replace(/\s+/g,' ').toLocaleLowerCase('fr-FR');
const normalizeNumber=value=>{
  const raw=String(value==null?'':value).trim().replace(/\s+/g,'')
    .replace(',','.');
  return /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw)?Number(raw):null;
};
const qCode=extract('  function evaluateQuestion(question, value) {',
  '\n  function showCorrectionDuringParcours()');
const evaluateQuestion=new Function('normalizeText','normalizeNumber','parseDurationFr',
  qCode+'\nreturn evaluateQuestion')(normalize,normalizeNumber,()=>null);
const testCode=extract('  function evaluateTest(test, testState) {',
  '\n  function testStateFor(');
const evaluateTest=new Function('evaluateQuestion','normalizeText','window',
  'sessionStorage',testCode+'\nreturn evaluateTest')(
    evaluateQuestion,normalize,{}, {getItem(){return null}});
const question={id:'poids_futur',prompt:'Poids du colis',
  response:{type:'number'},acceptedAnswers:['12'],
  acceptedUnits:['kg','KG','kilo','kilogramme'],unitInput:true,
  unitScored:true,points:2};
const test={id:'unite_inedite',scored:true,questions:[question]};
const evaluate=(answer,unit,settings={})=>evaluateTest(
  {...test,questions:[{...question,...settings}]},
  {answers:{poids_futur:answer},units:{poids_futur:unit}});
for(const [answer,unit,score] of [
  ['12','kg',3],['12','KILO',3],['11','kilogramme',1],
  ['12','m',2],['11','m',0],['11','',0]
]){
  const result=evaluate(answer,unit);
  assert.equal(result.score,score,'Erreur de notation : '+answer+' '+unit);
  assert.equal(result.scoreMax,3);
  assert.equal(result.details.poids_futur.unitCorrect,score===3 ||
    (answer==='11'&&unit==='kilogramme'));
}
const unscored=evaluate('12','kg',{unitScored:false});
assert.equal(unscored.score,2);
assert.equal(unscored.scoreMax,2);
assert.equal(unscored.details.poids_futur.unitCorrect,null);
const noInput=evaluate('12','kg',{unitInput:false});
assert.equal(noInput.score,2);
assert.equal(noInput.scoreMax,2);
const example=evaluate('12','kg',{example:true});
assert.equal(example.score,0);
assert.equal(example.scoreMax,0);
const ungraded=evaluateTest({...test,scored:false},
  {answers:{poids_futur:'12'},units:{poids_futur:'kg'}});
assert.equal(ungraded.score,0);
assert.equal(ungraded.scoreMax,0);
console.log('KALONEO_UNIT_SCORING_INDEPENDENT=OK: points, accents, casse, non-note, exemple');
