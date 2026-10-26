/* R18 — Bilan institutionnel : autoévaluation lisible, tri sans moyenne d’erreurs affichée */
/* KALONÉO — adaptation du parcours dynamique au Bilan institutionnel existant */
(()=>{'use strict';

const MANIFEST_KEY='seb_kaloneo_results_manifest';
const STATE_PREFIX='seb_kaltest_pilot2_state_v1';
const EXCLUDED_IDS=new Set(['fin_parcours','transition_video_f1']);

const EXISTING_ROW_SOURCES=window.KaloneoBilanRouting.LEGACY;

const CATEGORY_LABELS=Object.freeze({
  mathematiques:'Mathématiques',
  math:'Mathématiques',
  maths:'Mathématiques',
  francais:'Français',
  'expression ecrite':'Expression écrite',
  dictee:'Dictée',
  organisation:'Organisation',
  planification:'Planification',
  'activite pratique':'Activités pratiques',
  raisonnement:'Raisonnement',
  technique:'Compétences techniques',
  techniques:'Compétences techniques',
  'competences techniques':'Compétences techniques',
  tic:'Utilisation des techniques de l’information et de la communication',
  numerique:'Utilisation des techniques de l’information et de la communication',
  bureautique:'Utilisation des techniques de l’information et de la communication',
  communication:'Utilisation des techniques de l’information et de la communication',
  autoevaluation:'Autoévaluation',
  autres:'Autres',
  'competences transversales':'Compétences transversales'
});

const INSTITUTIONAL_SECTION_BY_ROW=Object.freeze({
  'fabrication-plan':'Compétences techniques',
  'fabrication-tracage':'Compétences techniques',
  'fabrication-decoupe':'Compétences techniques',
  'fabrication-assemblage':'Compétences techniques',
  'fabrication-finition':'Compétences techniques',
  'briques-identification':'Compétences techniques',
  'briques-manipulation':'Compétences techniques',
  'carre':'Compétences techniques',
  'organisation':'Compétences techniques',
  'planning':'Compétences techniques',
  'tri-temps':'Compétences techniques',
  'tri-erreurs':'Compétences techniques',
  'texte':'Utilisation des techniques de l’information et de la communication',
  'mail':'Utilisation des techniques de l’information et de la communication',
  'expression':'Savoirs fondamentaux',
  'math-enonce':'Savoirs fondamentaux',
  'math-problemes':'Savoirs fondamentaux',
  'competences-transversales':'Savoirs fondamentaux'
});

function clean(value){return String(value==null?'':value).replace(/\s+/g,' ').trim()}
function norm(value){
  let s=clean(value).toLocaleLowerCase('fr-FR');
  try{s=s.normalize('NFD').replace(/[\u0300-\u036f]/g,'')}catch(_){}
  return s.replace(/[_-]+/g,' ').replace(/\s+/g,' ').trim();
}
function json(key,fallback){try{return JSON.parse(sessionStorage.getItem(key)||'null')??fallback}catch(_){return fallback}}
function categoryFor(id,value){
  if(String(id)==='planning_cantine')return'planification';
  return norm(value)||'autres';
}
function categoryLabel(value){
  const n=norm(value);
  return CATEGORY_LABELS[n]||clean(value).replace(/[_-]+/g,' ').replace(/^./,c=>c.toUpperCase())||'Autres';
}
function catalog(){
  try{
    const payload=window.sebEvalPro?.kaloneoTestMetadataSync?.();
    const tests=payload&&payload.ok===true&&Array.isArray(payload.tests)?payload.tests:[];
    const meta=new Map();
    for(const item of tests){
      const id=String(item?.id||''),version=String(item?.version||'');
      if(!id)continue;
      meta.set(id,item);
      if(version)meta.set(id+'@'+version,item);
    }
    return meta;
  }catch(_){return new Map()}
}
function canonicalState(){
  const keys=[];
  try{
    for(let i=0;i<sessionStorage.length;i+=1){
      const key=sessionStorage.key(i);
      if(key&&key.startsWith(STATE_PREFIX))keys.push(key);
    }
  }catch(_){}
  if(!keys.length)keys.push(STATE_PREFIX);
  for(const key of keys){
    const state=json(key,null);
    if(state&&state.tests&&typeof state.tests==='object')return state;
  }
  return null;
}
function buildContext(){
  const manifest=json(MANIFEST_KEY,null);
  const state=canonicalState();
  const states=state&&state.tests&&typeof state.tests==='object'?state.tests:{};
  const meta=catalog();
  const byId=new Map();
  const order=[];

  const add=(rawTest)=>{
    if(!rawTest||!rawTest.id)return;
    const id=String(rawTest.id);
    if(EXCLUDED_IDS.has(id))return;
    const wantedVersion=String(rawTest.version||'');
    // Jamais de liaison d'une autre version du même test.
    const m=wantedVersion?(meta.get(id+'@'+wantedVersion)||{}):(meta.get(id)||{});
    const cat=categoryFor(id,rawTest.category||m.category||'autres');
    if(cat==='transition'||cat==='fin'||cat==='introduction')return;
    const test={
      id,
      title:clean(m.title||rawTest.title||id),
      category:cat,
      categoryLabel:categoryLabel(cat),
      scored:m.scored!==undefined?m.scored!==false:rawTest.scored!==false,
      activityType:clean(m.activityType||rawTest.activityType||''),
      version:clean(rawTest.version||m.version||''),
      adminModified:rawTest.adminModified===true||m.adminModified===true,
      bilanContributions:Array.isArray(rawTest.bilanContributions)
        ? rawTest.bilanContributions
        : Array.isArray(m.bilanContributions)?m.bilanContributions:[]
    };
    if(!byId.has(id))order.push(id);
    byId.set(id,test);
  };

  if(manifest&&Array.isArray(manifest.tests))manifest.tests.forEach(add);

  // Lorsqu'un manifeste existe, il définit SEUL la liste des tests
  // exécutés : d'anciens résultats encore présents en mémoire ne doivent
  // jamais ajouter un exercice Mail, Maths ou autre au Bilan du candidat.
  // Pour les tout anciens dossiers sans manifeste, l'état reste le seul
  // secours historique disponible.
  if(!(manifest&&Array.isArray(manifest.tests))) {
    Object.keys(states).forEach(id=>{
      if(EXCLUDED_IDS.has(String(id)))return;
      const m=meta.get(String(id))||{};
      add({id:String(id),title:m.title||id,category:m.category||'autres',scored:m.scored,activityType:m.activityType});
    });
  }

  const tests=order.map(id=>byId.get(id)).filter(Boolean);
  return{
    enabled:tests.length>0,
    parcoursTitle:clean(manifest?.parcoursTitle||''),
    tests,
    byId,
    ids:new Set(tests.map(test=>test.id)),
    states
  };
}

const context=buildContext();

function stateFor(id){return context.states&&context.states[id]?context.states[id]:null}
function resultFor(id){const s=stateFor(id);return s&&s.result&&typeof s.result==='object'?s.result:null}
function statusFor(id){return String(stateFor(id)?.status||'').toUpperCase()}
function has(id){return context.ids.has(String(id))}
function hasAny(ids){return (ids||[]).some(has)}
function fmtSeconds(value){
  const sec=Math.max(0,Math.round(Number(value)||0));
  return String(Math.floor(sec/60)).padStart(2,'0')+':'+String(sec%60).padStart(2,'0');
}
function scorePair(id){
  if(!has(id)||/ABANDON|SKIP|PENDING|NOT_STARTED/.test(statusFor(id)))return null;
  const result=resultFor(id);
  if(!result)return null;
  const score=Number(result.score),max=Number(result.scoreMax);
  if(!Number.isFinite(score)||!Number.isFinite(max)||max<=0)return null;
  return{score:Math.max(0,score),max:Math.max(0,max)};
}
function aggregate(ids){
  let score=0,max=0,count=0;
  for(const id of ids||[]){
    const pair=scorePair(id);
    if(!pair)continue;
    score+=pair.score;max+=pair.max;count+=1;
  }
  if(!count||max<=0)return null;
  return{score,max,pct:(score/max)*100,count};
}
function genericLevel(pct){
  const p=Number(pct);
  if(!Number.isFinite(p))return'';
  if(p>=70)return'I';
  if(p>=45)return'II';
  return'III';
}
function row(id){return document.querySelector('tr[data-r="'+CSS.escape(String(id))+'"]')}
function setLevel(target,level){
  if(!target)return;
  target.dataset.level=level||'';
  target.querySelectorAll('.level').forEach(cell=>cell.classList.toggle('on',cell.dataset.l===level));
}
function applyInstitutional(id,level,detail,numericPair=null){
  const target=row(id);
  if(!target)return;
  setLevel(target,level);
  if(numericPair&&Number.isFinite(numericPair.score)&&
     Number.isFinite(numericPair.max)&&numericPair.max>0){
    target.dataset.score=String(numericPair.score);
    target.dataset.possible=String(numericPair.max);
  }
  const select=target.querySelector('.csel');
  if(select&&level){
    const option=[...select.options].find(item=>item.dataset.l===level);
    if(option)select.value=option.value;
  }
  if(detail!==undefined){
    const node=target.querySelector('.detail');
    if(node)node.textContent=detail||'';
  }
}
function errorDetail(value){
  const n=Math.max(0,Number(value)||0);
  return'- '+n+' erreur'+(n===1?'':'s');
}
function percentDetail(value){
  const pct=Math.round(Number(value)||0);
  return pct+' %';
}
function clearAutomaticRows(){
  const manualRows=new Set([
    'fabrication-plan','fabrication-tracage','fabrication-decoupe','fabrication-assemblage','fabrication-finition',
    'briques-identification'
  ]);
  Object.keys(EXISTING_ROW_SOURCES).forEach(id=>{
    if(manualRows.has(id))return;
    const target=row(id);
    if(!target||target.hidden)return;
    setLevel(target,'');
    delete target.dataset.score;
    delete target.dataset.possible;
    const detail=target.querySelector('.detail');
    if(detail)detail.textContent='';
  });
}
function triData(){
  if(!has('tri_chevilles'))return null;
  const state=stateFor('tri_chevilles')||{};
  const result=resultFor('tri_chevilles')||{};
  let rows=Array.isArray(state.tri?.rows)?state.tri.rows.slice(0,5):[];
  rows=rows.filter(item=>Number.isFinite(Number(item?.seconds))&&item?.errors!==null&&item?.errors!==undefined&&String(item.errors).trim()!=='');
  if(!rows.length&&Array.isArray(result.tri?.temps_essais)){
    rows=result.tri.temps_essais.slice(0,5).map((seconds,index)=>({
      seconds:Number(seconds)||0,
      errors:index===0?Number(result.tri?.erreurs_total)||0:0
    }));
  }
  if(!rows.length)return null;
  const totalSeconds=rows.reduce((sum,item)=>sum+Math.max(0,Number(item.seconds)||0),0);
  const totalErrors=rows.reduce((sum,item)=>sum+Math.max(0,Number(item.errors)||0),0);
  const averageSeconds=Math.round(totalSeconds/rows.length);
  const averageErrors=totalErrors/rows.length;
  return{rows,totalSeconds,totalErrors,averageSeconds,averageErrors};
}
const AUTOEVAL_LABELS=Object.freeze({
  autoevaluation_savoirs:Object.freeze({
    ease:'Je me suis senti(e) à l’aise dans les exercices proposés.',
    difficulties:'J’ai rencontré des difficultés sur certaines consignes ou calculs.',
    progress:'Je pense avoir progressé dans mes compétences de base.',
    motivation:'Cette activité m’a donné envie d’en apprendre davantage.',
    stress:'Je me suis senti(e) stressé(e) ou bloqué(e) à certains moments.'
  }),
  autoevaluation_tic:Object.freeze({
    stress:'Traitement de texte : Je me suis senti(e) stressé(e) ou bloqué(e) à certains moments lors de cette activité.',
    outilstexte:'Traitement de texte : Je n’utilise jamais cet outil, c’est donc compliqué pour moi.',
    difficultetexte:'Traitement de texte : Je n’ai pas de difficulté avec cet outil, c’est facile pour moi.',
    stressmessage:'Messagerie : Je me suis senti(e) stressé(e) ou bloqué(e) à certains moments lors de cette activité.',
    outilsmessage:'Messagerie : Je n’utilise jamais cet outil, c’est donc compliqué pour moi.',
    difficultemessage:'Messagerie : Je n’ai pas de difficulté avec cet outil, c’est facile pour moi.'
  })
});
const AUTOEVAL_TITLES=Object.freeze({
  autoevaluation_savoirs:'Savoirs fondamentaux',
  autoevaluation_tic:'Outils numériques'
});
function collectPrimitiveStrings(value,out){
  if(Array.isArray(value)){value.forEach(item=>collectPrimitiveStrings(item,out));return}
  if(value&&typeof value==='object'){Object.values(value).forEach(item=>collectPrimitiveStrings(item,out));return}
  const s=clean(value);
  if(s)out.push(s);
}
function selfEvalText(ids){
  const sections=[];
  for(const id of ids||[]){
    if(!has(id))continue;
    const state=stateFor(id)||{};
    const labels=AUTOEVAL_LABELS[id]||{};
    const answerValues=[];
    collectPrimitiveStrings(state.answers||{},answerValues);
    const selected=[...new Set(answerValues.map(value=>labels[value]||'').filter(Boolean))];

    const supplementalValues=[];
    collectPrimitiveStrings(state.supplemental||{},supplementalValues);
    const comments=[...new Set(supplementalValues.filter(value=>!labels[value]))];

    const readable=[];
    selected.forEach(label=>readable.push('« '+label+' »'));
    comments.forEach(comment=>readable.push('Commentaire : « '+comment+' »'));
    if(readable.length){
      sections.push((AUTOEVAL_TITLES[id]||'Autoévaluation')+' — '+readable.join(' ; '));
    }
  }
  return sections.join(' | ');
}

function findSectionRows(){
  const tbody=document.querySelector('#bilan tbody');
  if(!tbody)return[];
  const groups=[];
  let current=null;
  [...tbody.children].forEach(node=>{
    if(node.matches?.('tr.section,tr.section2')){
      current={header:node,label:clean(node.textContent),rows:[]};
      groups.push(current);
    }else if(node.matches?.('tr[data-r]')&&current){
      current.rows.push(node);
    }
  });
  return groups;
}
function installInstitutionalFilter(){
  if(!context.enabled)return false;
  const tbody=document.querySelector('#bilan tbody');
  if(!tbody)return false;
  document.getElementById('bilan').dataset.parcoursTests=JSON.stringify(context.tests);
  const selected=window.KaloneoBilanRouting.selectedRows(context.tests);
  tbody.querySelectorAll('tr[data-r]').forEach(target=>{
    target.hidden=!selected.has(target.dataset.r);
    target.dataset.sebKaloneoExcluded=target.hidden?'1':'0';
  });
  findSectionRows().forEach(group=>{
    group.header.hidden=!group.rows.some(target=>!target.hidden);
    group.header.dataset.sebKaloneoExcluded=group.header.hidden?'1':'0';
  });
  return true;
}

function createLevelCell(level){
  const td=document.createElement('td');
  td.className='level';
  td.dataset.l=level;
  td.title='Attribuer le niveau '+level;
  return td;
}
function createInstitutionalRow({id,title,capacity,options,detail}){
  const tr=document.createElement('tr');
  tr.dataset.r=id;
  tr.dataset.kaloneoGenerated='1';

  const module=document.createElement('td');
  if(title){
    const strong=document.createElement('b');
    strong.textContent=title;
    module.appendChild(strong);
    if(capacity)module.append(document.createElement('br'));
  }
  if(capacity)module.appendChild(document.createTextNode(capacity));
  tr.appendChild(module);
  ['NE','I','II','III'].forEach(level=>tr.appendChild(createLevelCell(level)));

  const comments=document.createElement('td');
  const select=document.createElement('select');
  select.className='csel';
  const entries=[
    ['', 'Choisissez un élément.'],
    ['NE','Non évalué.'],
    ['I',options?.I||'I. La compétence est mobilisée de manière satisfaisante.'],
    ['II',options?.II||'II. La compétence est partiellement mobilisée et nécessite encore des repères.'],
    ['III',options?.III||'III. La compétence reste difficile à mobiliser et nécessite un accompagnement.']
  ];
  entries.forEach(([level,text])=>{
    const option=document.createElement('option');
    option.textContent=text;
    if(level)option.dataset.l=level;
    select.appendChild(option);
  });
  const detailNode=document.createElement('div');
  detailNode.className='detail';
  detailNode.textContent=detail||'';
  comments.append(select,detailNode);
  tr.appendChild(comments);
  return tr;
}
function sectionHeader(label){
  const tr=document.createElement('tr');
  tr.className='section2';
  tr.dataset.kaloneoGenerated='1';
  const td=document.createElement('td');
  td.colSpan=6;
  td.textContent=label;
  tr.appendChild(td);
  return tr;
}
function insertBeforeSectionEnd(tbody,sectionLabel,node){
  const groups=findSectionRows();
  const group=groups.find(item=>norm(item.label)===norm(sectionLabel));
  if(!group){tbody.appendChild(node);return}
  const last=group.rows[group.rows.length-1];
  if(last?.nextSibling)tbody.insertBefore(node,last.nextSibling);
  else tbody.appendChild(node);
  group.header.hidden=false;
  group.header.dataset.sebKaloneoExcluded='0';
}
function summarySelfEvaluation(){
  return selfEvalText(['autoevaluation_savoirs','autoevaluation_tic'].filter(has));
}
function knownIds(){
  const ids=new Set(['gestes_postures','autoevaluation_savoirs','autoevaluation_tic']);
  Object.values(EXISTING_ROW_SOURCES).flat().forEach(id=>ids.add(id));
  return ids;
}
function genericOptions(category){
  const cat=norm(category);
  if(cat==='activite pratique')return{
    I:'I. Réalise l’activité pratique de manière autonome et conformément aux consignes.',
    II:'II. Réalise l’activité pratique avec quelques erreurs ou avec des repères supplémentaires.',
    III:'III. Rencontre des difficultés importantes et nécessite un accompagnement dans la réalisation.'
  };
  if(cat==='organisation')return{
    I:'I. Organise la tâche de manière autonome en tenant compte des contraintes.',
    II:'II. Organise partiellement la tâche mais nécessite encore des repères.',
    III:'III. Rencontre des difficultés importantes pour organiser la tâche et prendre en compte les contraintes.'
  };
  if(cat==='planification')return{
    I:'I. Planifie les étapes de manière cohérente et autonome.',
    II:'II. Planifie les principales étapes mais commet des erreurs ou nécessite des repères.',
    III:'III. Rencontre des difficultés importantes pour ordonner et planifier les étapes.'
  };
  return{
    I:'I. Les compétences attendues dans cette section sont mobilisées de manière satisfaisante.',
    II:'II. Les compétences attendues sont partiellement mobilisées et nécessitent encore des repères.',
    III:'III. Les compétences attendues restent difficiles à mobiliser et nécessitent un accompagnement.'
  };
}
function installUnknownSections(tbody){
  const known=knownIds();
  const groups=new Map();
  context.tests.filter(test=>{
    if(known.has(test.id))return false;
    // Les tests Builder restent dans la ligne institutionnelle explicitement
    // choisie, jamais dans une deuxième section automatique par catégorie.
    if(test.adminModified || Array.isArray(test.bilanContributions)&&test.bilanContributions.length)return false;
    return true;
  }).forEach(test=>{
    const label=test.categoryLabel||categoryLabel(test.category);
    if(!groups.has(label))groups.set(label,[]);
    groups.get(label).push(test);
  });
  for(const [label,tests] of groups){
    const header=sectionHeader(label);
    header.dataset.kaloneoUnknownSection='1';
    const ids=tests.map(test=>test.id);
    const target=createInstitutionalRow({
      id:'kaloneo-section-'+norm(label).replace(/\s+/g,'-'),
      title:label,
      capacity:'Appréciation des compétences mobilisées dans les activités de cette section.',
      options:genericOptions(tests[0]?.category),
      detail:'Activités prises en compte : '+tests.map(test=>test.title).join(', ')
    });
    target.dataset.kaloneoUnknownSection='1';
    target.dataset.kaloneoSourceIds=ids.join(',');
    tbody.append(header,target);
  }
}
function autoInstitutional(){
  if(!context.enabled)return false;
  clearAutomaticRows();

  // Construction à base de briques : la lecture du schéma reste une appréciation
  // administrateur ; les erreurs de manipulation alimentent uniquement la ligne dédiée.
  if(has('construction_briques')){
    const b=resultFor('construction_briques')?.bricks;
    if(b){
      const seconds=Math.max(0,Math.floor(Number(b.temps)||0));
      const errors=Math.max(0,Math.floor(Number(b.erreurs)||0));
      const first=row('briques-identification')?.querySelector('.detail');
      if(first)first.textContent='Temps de construction : '+fmtSeconds(seconds);
      if(Number.isFinite(Number(b.erreurs))){
        const level=errors<=2?'I':errors<=4?'II':'III';
        applyInstitutional('briques-manipulation',level,errors+' erreur'+(errors===1?'':'s'));
      }
    }
  }

  if(has('gratte_ciel')){
    const pair=scorePair('gratte_ciel');
    if(pair){
      const errors=Math.max(0,pair.max-pair.score);
      applyInstitutional('carre',errors<=2?'I':errors<=4?'II':'III',errors+' erreur'+(errors===1?'':'s'),pair);
    }
  }

  // Gestion logistique « Ranger le stock » : cette ligne institutionnelle
  // est alimentée uniquement par l'exercice Ranger le stock.
  if(has('ranger_stock')){
    const pair=scorePair('ranger_stock');
    if(pair){
      const errors=Math.max(0,Math.round((pair.max-pair.score)*100)/100);
      const level=errors<=2?'I':errors<=4?'II':'III';
      applyInstitutional('organisation',level,errors+' erreur'+(errors===1?'':'s'),pair);
    }
  }

  // Gestion de plannings sous contraintes : logique institutionnelle historique.
  // Les 8 points d'Organisation d'une activité et les 15 points du Restaurant
  // s'additionnent sur cette seule ligne (maximum 23).
  if(hasAny(['organisation_demenagement','planning_cantine'])){
    const planning=aggregate(['organisation_demenagement','planning_cantine']);
    if(planning){
      const errors=Math.max(0,Math.round((planning.max-planning.score)*100)/100);
      const level=planning.score>=20?'I':planning.score>=17?'II':'III';
      applyInstitutional('planning',level,errors+' erreur'+(errors===1?'':'s'),planning);
    }
  }

  const tri=triData();
  if(tri){
    const timeLevel=tri.averageSeconds<=720?'I':tri.averageSeconds<=840?'II':'III';
    const errorLevel=tri.averageErrors<=1.6?'I':tri.averageErrors<=3.2?'II':'III';
    applyInstitutional('tri-temps',timeLevel);
    applyInstitutional('tri-erreurs',errorLevel,'');
    const avg=document.getElementById('triAvg');
    const times=document.getElementById('triTimes');
    const errors=document.getElementById('triErr');
    if(avg)avg.textContent=fmtSeconds(tri.averageSeconds);
    if(times)times.innerHTML=tri.rows.map((item,index)=>{
      const seconds=Math.max(0,Math.floor(Number(item.seconds)||0));
      const minutes=Math.floor(seconds/60);
      const rest=seconds%60;
      return'N°'+(index+1)+' : '+String(minutes).padStart(2,'0')+' min '+String(rest).padStart(2,'0')+' s';
    }).join('<br>');
    if(errors)errors.textContent=tri.totalErrors+' erreur'+(tri.totalErrors===1?'':'s');
    const detail=row('tri-erreurs')?.querySelector('.detail');
    if(detail)detail.textContent='';
  }

  if(has('traitement_texte_bureautique')){
    const pair=scorePair('traitement_texte_bureautique');
    if(pair){
      const errors=Math.max(0,pair.max-pair.score);
      applyInstitutional('texte',pair.score>=7?'I':pair.score>=3?'II':'III',errors+' erreur'+(errors===1?'':'s'),pair);
    }
  }

  if(has('redaction_email')){
    const pair=scorePair('redaction_email');
    if(pair){
      const errors=Math.max(0,pair.max-pair.score);
      applyInstitutional('mail',errors<=1?'I':errors<=3?'II':'III',errors+' erreur'+(errors===1?'':'s'),pair);
    }
  }

  const expression=aggregate(['texte_a_trous_stage_logistique','genre_nombre','paronymes_rapport','dictee_professionnelle']
    .filter(id=>['francais','expression ecrite','dictee'].includes(context.byId.get(id)?.category)));
  if(expression){
    applyInstitutional('expression',genericLevel(expression.pct),percentDetail(expression.pct),expression);
  }

  const mathStatement=aggregate(['calculs_commandes_atelier','calculs_poids_volumes']
    .filter(id=>['mathematiques','math','maths'].includes(context.byId.get(id)?.category)));
  if(mathStatement){
    applyInstitutional('math-enonce',genericLevel(mathStatement.pct),percentDetail(mathStatement.pct),mathStatement);
  }

  const mathProblems=aggregate(['horaires_reception_controle','fractions_preparation_lots','conversions_atelier_expedition']
    .filter(id=>['mathematiques','math','maths'].includes(context.byId.get(id)?.category)));
  if(mathProblems){
    applyInstitutional('math-problemes',genericLevel(mathProblems.pct),percentDetail(mathProblems.pct),mathProblems);
  }

  // La V1 Gestes et postures passe maintenant par sa liaison officielle
  // Compétences transversales dans le moteur commun ci-dessous. Aucune
  // ancienne ligne séparée « Gestes et postures » ne doit être réintroduite.

  // Les lignes d'activités pratiques, la lecture du schéma des briques et
  // l'autoévaluation restent volontairement manuelles.
  document.querySelectorAll('tr[data-kaloneo-unknown-section="1"]').forEach(target=>{
    const ids=String(target.dataset.kaloneoSourceIds||'').split(',').filter(Boolean);
    const group=aggregate(ids);
    if(!group)return;
    applyInstitutional(target.dataset.r,genericLevel(group.pct),percentDetail(group.pct),group);
  });

  // Les sorties Builder ne peuvent alimenter QUE les lignes choisies dans
  // « Liaisons vers le Bilan ». Ne jamais déduire une ligne de son seul titre.
  const routing=window.KaloneoBilanRouting?.collect(context.tests,stateFor);
  if(routing){
    for(const [rowId,entries] of routing.entries){
      const scored=entries.filter(entry=>entry.pair);
      if(!scored.length)continue; // Les réponses libres restent dans les Résultats.
      const legacySources=EXISTING_ROW_SOURCES[rowId]||[];
      const legacy=aggregate(legacySources.filter(id=>context.byId.get(id)?.adminModified!==true));
      const points=scored.reduce((sum,entry)=>sum+entry.pair.score,legacy?.score||0);
      const possible=scored.reduce((sum,entry)=>sum+entry.pair.max,legacy?.max||0);
      if(possible<=0)continue;
      const pct=100*points/possible;
      const titles=[...new Set(scored.map(entry=>entry.title))];
      applyInstitutional(rowId,genericLevel(pct),percentDetail(pct),
        {score:points,max:possible});
    }
  }

  for(const key of window.KaloneoBilanRouting.selectedRows(context.tests)){
    const sources=context.tests.filter(test=>window.KaloneoBilanRouting.selectedRows([test]).has(key));
    if(sources.length&&sources.every(test=>/ABANDON|SKIP/.test(statusFor(test.id))))
      applyInstitutional(key,'NE','Exercice abandonné.');
  }
  persist();
  const status=document.getElementById('status');
  if(status)status.textContent=(routing?.warnings?.length
    ? 'Bilan institutionnel complété. Attention : '+routing.warnings.length+
      ' liaison(s) du Builder à vérifier (catégorie ou sorties incompatibles).'
    : 'Bilan institutionnel complété avec les liaisons du Builder et les tests du parcours.');
  return true;
}
function persist(){
  const data={rows:{}};
  document.querySelectorAll('tr[data-r]').forEach(target=>{
    data.rows[target.dataset.r]={
      level:target.dataset.level||'',
      select:target.querySelector('.csel')?.value||'',
      detail:target.querySelector('.detail')?.textContent||'',
      points:target.dataset.score??null,possible:target.dataset.possible??null
    };
  });
  const avg=document.getElementById('triAvg'),err=document.getElementById('triErr'),times=document.getElementById('triTimes');
  if(avg)data.triAvg=avg.textContent;
  if(err)data.triErr=err.textContent;
  if(times)data.triTimes=times.innerHTML;
  sessionStorage.setItem('admin_bilan_state',JSON.stringify(data));
  try{window.sebEvalPro?.save?.()}catch(_){}
}
function stripExcludedFromClone(root){
  root?.querySelectorAll?.('[data-seb-kaloneo-excluded="1"]').forEach(node=>node.remove());
}
function visibleInstitutionalRows(){
  return[...document.querySelectorAll('#bilan tr[data-r]')].filter(target=>!target.hidden).map(target=>target.dataset.r);
}

window.SEB_KALONEO_BILAN=Object.freeze({
  enabled:context.enabled,
  context,
  hasTest:has,
  hasAny,
  auto:autoInstitutional,
  stripExcludedFromClone,
  summarySelfEvaluation,
  visibleTestIds:()=>context.tests.map(test=>test.id),
  visibleInstitutionalRows
});

if(context.enabled)installInstitutionalFilter();
})();
