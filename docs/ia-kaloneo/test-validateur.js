#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {inspect}=require('./valider-test.js');
const src=JSON.parse(fs.readFileSync(path.join(__dirname,'exemples','calculs-stock-demo.test.json'),'utf8'));
const clone=x=>JSON.parse(JSON.stringify(x));
const good=inspect(src);
assert.equal(good.ok,true,'Exemple KALTEST refusé : '+good.errors.join(' | '));
assert.equal(good.scoreMax,5,'Point séparé de l’unité manquant dans le score maximal.');
const cases=[
  ['ID dupliqué',x=>x.questions.push(clone(x.questions[0]))],
  ['Référence inconnue',x=>x.presentation.builderContent[1].questionId='q_absente'],
  ['Unité notée sans liste',x=>delete x.questions[1].acceptedUnits],
  ['Option non proposée',x=>x.questions[2].acceptedAnswers=['Inconnue']],
  ['Points négatifs',x=>x.questions[0].points=-1],
  ['Média externe',x=>x.presentation.builderContent.push({type:'image',zone:'left',resource:{name:'image.png',data:'https://example.org/img.png'}})],
  ['Bloc non supporté',x=>x.presentation.builderContent.push({type:'generation-magique',zone:'left'})],
  ['Feature inventée',x=>x.features.push('ai.magic')],
  ['Navigation locale',x=>x.navigation.next='lien-test'],
  ['Format invalide',x=>x.kaltestFormat=999],
  ['Consigne vide',x=>x.instruction=''],
  ['Pas de restauration',x=>x.runtime.restore=false]
];
for(const [label,mutate] of cases){
  const x=clone(src);
  mutate(x);
  const result=inspect(x);
  assert.equal(result.ok,false,'Erreur non détectée : '+label);
  assert.ok(result.errors.length,'Absence de message : '+label);
}
console.log('KALONEO_AI_KIT_VALIDATOR=OK '+JSON.stringify({scenarios:cases.length+1,scoreMax:good.scoreMax}));

const fractions=JSON.parse(fs.readFileSync(path.join(__dirname,'exemples','fractions-pourcentages-images-selection.test.json'),'utf8'));
const vf=inspect(fractions);
assert.equal(vf.ok,true,'Exemple fractions-images refusé : '+vf.errors.join(' | '));
assert.equal(vf.scoreMax,3,'Trois groupes doivent représenter 3 points.');
const mutantImages=[
 ['ID absent',x=>x.presentation.fractionSelection.groups[0].questionId='unknown'],
 ['Compte impossible',x=>x.questions[0].acceptedCount=5],
 ['Fraction non entière',x=>x.questions[0].acceptedCount=1.5],
 ['Image distante',x=>x.presentation.fractionSelection.groups[0].itemImage='https://exemple.fr/photo.png'],
 ['Options partielles',x=>x.questions[1].response.options.pop()],
 ['builderContent prioritaire',x=>x.presentation.builderContent=[]],
 ['Groupe perdu',x=>x.presentation.fractionSelection.groups.pop()]
];
for(const [label,change] of mutantImages){
  const mutant=clone(fractions);change(mutant);
  assert.equal(inspect(mutant).ok,false,'Anomalie fractions non bloquée : '+label);
}
console.log('KALONEO_AI_FRACTION_SELECTION_VALIDATOR=OK',JSON.stringify({scenarios:1+mutantImages.length,scoreMax:vf.scoreMax}));
