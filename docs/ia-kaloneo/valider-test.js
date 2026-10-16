#!/usr/bin/env node
'use strict';
// Génération IA KALONÉO : validation stricte en lecture seule.
// Core est le vrai moteur de validation du Builder ; jamais de copie d'une liste arbitraire de features.
const fs=require('node:fs');
const path=require('node:path');
const Core=require('../../kaloneo/builder-core.js');
const CATEGORY=new Set(['mathematiques','francais','organisation','numerique','technique','planification','activite_pratique']);
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const nonempty=x=>typeof x==='string'&&x.trim().length>0;
const strings=x=>Array.isArray(x)&&x.length>0&&x.every(nonempty);
const has=(x,k)=>Object.prototype.hasOwnProperty.call(x,k);
function inspect(def){
  const errors=[],add=s=>errors.push(s);
  if(!object(def))return {ok:false,errors:['Objet JSON racine manquant.'],scoreMax:0};
  const core=Core.analyzeDefinition(def);
  core.errors.forEach(e=>add('Builder : '+e));
  if(def.kaltestFormat!==1||def.builderVersion!=='2.0.0'||def.minSebEvalPro!=='0.3.10')add('Versions de contrat incompatibles avec ce kit (1 / 2.0.0 / 0.3.10).');
  if(!/^[a-z][a-z0-9_]*$/.test(String(def.id||'')))add('Identifiant du test non conforme.');
  if(!/^\d+\.\d+\.\d+$/.test(String(def.version||'')))add('Version du test non conforme.');
  if(!nonempty(def.title)||!CATEGORY.has(def.category))add('Titre ou catégorie inconnu.');
  if(!['questionnaire','complex'].includes(def.kind)||typeof def.scored!=='boolean')add('Nature du test ou noté/non noté invalide.');
  if(def.category==='activite_pratique'&&def.scored!==false)add('Activité pratique automatiquement non notée.');
  if(!nonempty(def.scenario)||!nonempty(def.instruction))add('Scénario et consignes obligatoires.');
  if(!object(def.calculator)||typeof def.calculator.compatible!=='boolean'||typeof def.calculator.defaultEnabled!=='boolean')add('Configuration de calculatrice incomplète.');
  else if(def.calculator.defaultEnabled&&!def.calculator.compatible)add('Calculatrice activée mais incompatible.');
  if(!object(def.runtime)||['start','save','restore','finish'].some(k=>def.runtime[k]!==true))add('Sauvegarde/restauration du moteur obligatoires.');
  if(!object(def.navigation)||def.navigation.next!=='host'||def.navigation.abandon!=='host-common')add('Navigation du composant hôte obligatoire.');
  if(!Array.isArray(def.features)||!def.features.includes('runtime.basic')||def.features.some(f=>!Core.SUPPORTED_FEATURES.includes(f)))add('Features inconnues ou runtime.basic absent.');
  const pres=object(def.presentation)?def.presentation:{};
  const fractions=object(pres.fractionSelection);
  const blocksPresent=Array.isArray(pres.builderContent)&&pres.builderContent.length>0;
  if(!object(def.presentation)||!Core.LAYOUTS.includes(pres.layout)||(!blocksPresent&&!fractions))add('Présentation Builder ou fractionSelection manquante.');
  if(fractions&&Array.isArray(pres.builderContent))add('fractionSelection incompatible avec builderContent : le sélecteur candidat serait masqué.');
  const questions=Array.isArray(def.questions)?def.questions:[];
  if(!Array.isArray(def.questions))add('Tableau de questions absent.');
  if(def.kind==='questionnaire'&&questions.length===0)add('Questionnaire sans questions.');
  if(def.kind==='complex'&&questions.length)add('kind=complex incompatible avec des questions.');
  const ids=new Set();
  let scoreMax=0;
  for(const [i,q] of questions.entries()){
    const label='Question '+(i+1);
    if(!object(q)){add(label+' : objet manquant.');continue;}
    if(!nonempty(q.id)||ids.has(q.id))add(label+' : ID manquant/dupliqué.');
    ids.add(q.id);
    if(!nonempty(q.prompt))add(label+' : intitulé vide.');
    const type=q.response&&q.response.type;
    if(!Core.RESPONSE_TYPES.includes(type))add(label+' : type de réponse inconnu.');
    if(typeof q.points!=='number'||!Number.isFinite(q.points)||q.points<0)add(label+' : points invalides.');
    if(q.example===true&&q.points!==0)add(label+' : exemple noté.');
    if(type==='free-text'){
      if(q.points!==0||q.manualEvaluation!==true)add(label+' : texte libre doit être évalué manuellement.');
    }else if(type==='duration'){
      if(!Number.isInteger(q.acceptedMinutes)||q.acceptedMinutes<0)add(label+' : durée attendue (minutes) invalide.');
    }else if(type==='multiple-choice'){
      if(!Array.isArray(q.acceptedAnswers)||!strings(q.acceptedAnswers[0]))add(label+' : acceptedAnswers doit contenir un tableau de choix.');
    }else if(!strings(q.acceptedAnswers))add(label+' : réponses attendues manquantes.');
    if(['select','single-choice','multiple-choice'].includes(type)){
      const opts=q.response.options;
      if(!strings(opts))add(label+' : options manquantes.');
      else{
        const norm=s=>s.trim().toLocaleLowerCase('fr-FR');
        const offered=new Set(opts.map(norm));
        const accepted=type==='multiple-choice'?q.acceptedAnswers&&q.acceptedAnswers[0]:q.acceptedAnswers;
        if(Array.isArray(accepted))accepted.forEach(v=>{if(nonempty(v)&&!offered.has(norm(v)))add(label+' : bonne réponse absente des options : '+v);});
      }
    }
    if(q.unitInput===true&&!strings(q.acceptedUnits))add(label+' : unités acceptées manquantes.');
    if(q.unitScored===true){
      if(q.unitInput!==true||!strings(q.acceptedUnits))add(label+' : unité notée sans saisie ou valeurs acceptées.');
      if(!['number','number-unit'].includes(type))add(label+' : unité notée non numérique.');
      scoreMax+=1;
    }
    if(typeof q.points==='number'&&q.points>=0&&Number.isFinite(q.points))scoreMax+=q.points;
  }
  if(fractions) {
    const groups=pres.fractionSelection.groups;
    if(!Array.isArray(groups)||!groups.length)add('fractionSelection : groups manquant.');
    else {
      const seen=new Set();
      for(const [i,g] of groups.entries()) {
        const label='fractionSelection groupe '+(i+1);
        if(!object(g)){add(label+' : objet manquant.');continue;}
        if(!nonempty(g.questionId)||seen.has(g.questionId))add(label+' : questionId absent/dupliqué.');
        seen.add(g.questionId);
        if(!nonempty(g.label))add(label+' : label manquant.');
        if(!Number.isInteger(g.totalItems)||g.totalItems<1||g.totalItems>120)add(label+' : totalItems invalide (1–120).');
        if(!nonempty(g.itemImage)||!g.itemImage.startsWith('data:image/'))add(label+' : vraie image embarquée requise.');
        const q=questions.find(q=>q&&q.id===g.questionId);
        if(!q){add(label+' : question introuvable.');continue;}
        if(q.response?.type!=='multiple-choice')add(label+' : type multiple-choice requis.');
        if(!Number.isInteger(q.acceptedCount)||q.acceptedCount<0||q.acceptedCount>g.totalItems)add(label+' : quantité acceptedCount impossible.');
        const expected=Array.from({length:Number.isInteger(g.totalItems)&&g.totalItems<=120?g.totalItems:0},(_,i)=>String(i+1));
        if(JSON.stringify(q.response?.options)!==JSON.stringify(expected))add(label+' : response.options doit contenir 1 à totalItems.');
        if(!Array.isArray(q.acceptedAnswers)||!Array.isArray(q.acceptedAnswers[0])||q.acceptedAnswers[0].length!==q.acceptedCount)add(label+' : acceptedAnswers incohérent avec acceptedCount.');
      }
      for(const q of questions)if(q&&!seen.has(q.id))add('fractionSelection : question sans groupe '+q.id);
    }
    const visual=pres.fractionSelection.visual;
    if(visual?.src&&(!nonempty(visual.src)||!visual.src.startsWith('data:image/')))add('Image de contexte non embarquée.');
  }
  const blocks=object(def.presentation)&&Array.isArray(def.presentation.builderContent)?def.presentation.builderContent:[];
  for(const [i,b] of blocks.entries()){
    const label='Bloc '+(i+1);
    if(!object(b)||!Core.BUILDER_CONTENT_TYPES.includes(b.type)){add(label+' : type de bloc inexistant.');continue;}
    if(!['left','right'].includes(b.zone))add(label+' : zone gauche/droite absente.');
    if(b.type==='question'&&!ids.has(b.questionId))add(label+' : questionId non défini.');
    if(b.type==='text'&&!nonempty(b.text))add(label+' : texte vide.');
    if(['image','audio','video'].includes(b.type)){
      const r=b.resource;
      if(!object(r)||!nonempty(r.data)||!r.data.startsWith('data:'+b.type+'/'))add(label+' : média non embarqué (data URL exigée).');
    }
    if(object(b.style)&&has(b.style,'backgroundImage')&&!String(b.style.backgroundImage).startsWith('data:image/'))add(label+' : image de fond non embarquée.');
  }
  if(object(def.presentation)&&object(def.presentation.pageStyle)&&has(def.presentation.pageStyle,'backgroundImage')&&!String(def.presentation.pageStyle.backgroundImage).startsWith('data:image/'))add('Image de fond de page non embarquée.');
  if(!Array.isArray(def.outputs)||!def.outputs.some(x=>x&&x.id==='score')||!def.outputs.some(x=>x&&x.id==='score_max'))add('Sorties score et score_max nécessaires.');
  if(!Array.isArray(def.bilanContributions))add('bilanContributions doit être un tableau (vide si inconnu).');
  const needed=[
    ['questionnaire.basic',questions.length>0],
    ['host.calculator',Boolean(def.calculator&&def.calculator.compatible)],
    ['host.chrono',Boolean(def.chrono&&def.chrono.enabled)],
    ['questionnaire.grid',blocks.some(b=>b.type==='table-grid')],
    ['questionnaire.inline-gaps',blocks.some(b=>b.type==='inline-flow')],
    ['questionnaire.free-text-manual',questions.some(q=>q.response&&q.response.type==='free-text')],
    ['media.image',blocks.some(b=>b.type==='image')],
    ['media.audio',blocks.some(b=>b.type==='audio')],
    ['media.video',blocks.some(b=>b.type==='video')],
    ['content.html-js',blocks.some(b=>b.type==='html-js')],
    [def.presentation&&def.presentation.layout==='single'?'layout.single':'layout.split',true]
  ];
  for(const [feature,active]of needed)if(active&&!def.features.includes(feature))add('Feature requise absente : '+feature);
  // Vérifier que le véritable Builder charge, sauvegarde et conserve les corrections.
  if(errors.length===0){
    try{
      const model=Core.definitionToModel(JSON.parse(JSON.stringify(def)));
      const saved=Core.modelToDefinition(model);
      const again=Core.analyzeDefinition(saved);
      if(!again.ok)add('Aller-retour Builder non conforme : '+again.errors.join('; '));
      if(fractions&&JSON.stringify(saved.presentation?.fractionSelection)!==JSON.stringify(pres.fractionSelection))add('Aller-retour Builder : fractionSelection altérée.');
      const before=new Map(questions.map(q=>[q.id,q]));
      const after=new Map((saved.questions||[]).map(q=>[q.id,q]));
      if(before.size!==after.size)add('Aller-retour : nombre de questions différent.');
      for(const [id,q]of before){
        const n=after.get(id);
        if(!n){add('Aller-retour : question perdue '+id);continue;}
        for(const k of ['response','acceptedAnswers','acceptedMinutes','acceptedUnits','unitInput','unitScored','points','manualEvaluation']){
          const left=has(q,k)?q[k]:null,right=has(n,k)?n[k]:null;
          if(JSON.stringify(left)!==JSON.stringify(right))add('Aller-retour : champ perdu '+id+'.'+k);
        }
      }
    }catch(e){add('Aller-retour Builder impossible : '+String(e.message||e));}
  }
  return {ok:errors.length===0,errors,scoreMax};
}
function main(args){
  if(args.length!==1){console.error('Usage : node docs/ia-kaloneo/valider-test.js CHEMIN/test.json');return 2;}
  let definition;
  try{definition=JSON.parse(fs.readFileSync(path.resolve(args[0]),'utf8'));}
  catch(e){console.error('JSON illisible : '+String(e.message||e));return 2;}
  const r=inspect(definition);
  if(!r.ok){console.error('KALONEO_IA_JSON=REFUSE\n- '+r.errors.join('\n- '));return 1;}
  console.log('KALONEO_IA_JSON=OK '+JSON.stringify({id:definition.id,version:definition.version,questions:definition.questions.length,scoreMax:r.scoreMax}));
  return 0;
}
if(require.main===module)process.exitCode=main(process.argv.slice(2));
module.exports={inspect,main};
