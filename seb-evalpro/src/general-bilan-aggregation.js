'use strict';
// Bilan general : une personne -> N parcours distincts -> une occurrence
// par identifiant de test, aggregation des points obtenus / points possibles.
// Aucune moyenne des niveaux I/II/III; les tests non evalues ne valent jamais zero.
const crypto=require('crypto');
const {aggregateInstitutionalRows,wordRows:institutionalWordRows}=require('./institutional-bilan-grid');
const LEVELS=Object.freeze({NE:'NE',I:'I',II:'II',III:'III'});
const EXCLUDED=new Set(['fin_parcours','transition_video_f1','qcm-1','qcm-finale']);
const LABELS=Object.freeze({
  mathematiques:'Mathématiques',math:'Mathématiques',maths:'Mathématiques',
  francais:'Français',expression:'Expression écrite',dictee:'Dictée',
  organisation:'Organisation',planification:'Planification',
  'activite pratique':'Activités pratiques',technique:'Compétences techniques',
  techniques:'Compétences techniques',raisonnement:'Raisonnement',
  tic:'Outils numériques',numerique:'Outils numériques',
  bureautique:'Outils numériques',communication:'Communication',
  autoevaluation:'Autoévaluation',
  'competences transversales':'Compétences transversales',
  autres:'Autres'
});
function clean(v){return String(v==null?'':v).replace(/\s+/g,' ').trim()}
function norm(v){return clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[_-]/g,' ').replace(/\s+/g,' ').trim()}
function categoryFor(test){const raw=clean(test.category||'autres'),key=norm(raw);return key==='planification'||String(test.id)==='planning_cantine'?'Planification':(LABELS[key]||raw||'Autres')}
function percentLevel(p){return !Number.isFinite(p)?LEVELS.NE:p>=70?LEVELS.I:p>=45?LEVELS.II:LEVELS.III}
function json(v){if(v&&typeof v==='object')return v;try{return JSON.parse(String(v||'{}'))||{}}catch(_){return {}}}
function stateFromSession(session){
  for(const [key,value] of Object.entries(session||{})){
    if(key.startsWith('seb_kaltest_pilot2_state_v1')){
      const decoded=json(value);
      if(decoded&&decoded.tests&&typeof decoded.tests==='object')return decoded.tests;
    }
  }
  return {};
}
function sourceDigest(evaluations){
  const short=evaluations.map(e=>({candidateId:e.candidateId,manifest:e.manifest||{},session:e.session||{},archive:e.archive||null}));
  return crypto.createHash('sha256').update(JSON.stringify(short)).digest('hex');
}
function aggregateGeneralBilan(evaluations){
  if(!Array.isArray(evaluations)||!evaluations.length)throw new Error('Aucune evaluation disponible.');
  const ids=new Set(),groups=new Map(),testCategoryById=new Map(),sources=[],notes=[];
  for(const item of evaluations){
    const id=clean(item.candidateId);
    if(!id||ids.has(id))throw new Error('Identifiant evaluation absent ou en double.');
    ids.add(id);
    const session=item.session||{};
    const states=stateFromSession(session);
    const manifest=json(session.seb_kaloneo_results_manifest);
    const provided=Array.isArray(manifest.tests)?manifest.tests:null;
    const fallback=provided?[]:Object.entries(states).filter(([key,value])=>value&&value.result).map(([key])=>({id:key}));
    const tests=provided||fallback;
    const visited=new Set();
    const source={candidateId:id,parcours:clean(item.parcours)||'Parcours',date:clean(item.date),testCount:0,scoredCount:0};
    for(const meta of tests){
      const testId=clean(meta&&meta.id);
      if(!testId||EXCLUDED.has(testId)||visited.has(testId))continue;
      visited.add(testId);
      const state=states[testId]||{};
      const result=state.result||{};
      const actual=Number(result.score),possible=Number(result.scoreMax);
      const scored=Number.isFinite(actual)&&Number.isFinite(possible)&&possible>0&&actual>=0&&actual<=possible;
      const completed=Boolean(state.result)||(String(state.status||'').toUpperCase()==='COMPLETED');
      if(!completed)continue;
      source.testCount++;
      const proposedCategory=categoryFor({id:testId,category:meta.category||state.category||'autres'});
      // Une meme cle KALTEST ne doit jamais se retrouver dans deux categories
      // si une edition du parcours a modifie ses metadonnees.
      if(!testCategoryById.has(testId))testCategoryById.set(testId,proposedCategory);
      const category=testCategoryById.get(testId);
      const title=clean(meta.title||state.title||testId);
      if(!groups.has(category))groups.set(category,new Map());
      const categoryTests=groups.get(category);
      if(!categoryTests.has(testId))categoryTests.set(testId,{id:testId,title,category,points:0,possible:0,scoredPassages:0,passages:0,sources:[],manualLevels:[]});
      const target=categoryTests.get(testId);
      target.passages++;
      const individualLevel=['NE','I','II','III'].includes(String(result.level||''))?String(result.level):null;
      if(individualLevel)target.manualLevels.push(individualLevel);
      const trace={candidateId:id,parcours:source.parcours,date:source.date,scored};
      if(scored){
        source.scoredCount++;
        target.points+=actual;
        target.possible+=possible;
        target.scoredPassages++;
        trace.score=actual;trace.scoreMax=possible;
      }
      target.sources.push(trace);
    }
    if(item.archive&&item.archive.document){
      const doc=item.archive.document;
      // Les criteres manuels sont repris des bilans precedents, avec leur
      // commentaire et leur niveau d'origine, sans convertir I/II/III en points.
      let section='Compétences techniques';
      const manualIds=new Set(['fabrication-plan','fabrication-tracage',
        'fabrication-decoupe','fabrication-assemblage','fabrication-finition',
        'briques-identification']);
      for(const r of Array.isArray(doc.rows)?doc.rows:[]){
        if(!r||typeof r!=='object')continue;
        if(r.kind==='section'){
          const label=clean(r.sectionText);
          if(label)section=label;
          continue;
        }
        const key=clean(r.key),level=clean(r.level);
        if(!key||!['I','II','III'].includes(level))continue;
        if(!key.startsWith('kaltest-manuel-')&&!manualIds.has(key))continue;
        const criterionId='MANUAL:'+key;
        const label=clean(r.moduleText)||key;
        const category=section;
        if(!groups.has(category))groups.set(category,new Map());
        const criteria=groups.get(category);
        if(!criteria.has(criterionId))
          criteria.set(criterionId,{id:criterionId,title:label,category,points:0,
            possible:0,scoredPassages:0,passages:0,sources:[],manualLevels:[]});
        const criterion=criteria.get(criterionId);
        criterion.passages++;
        criterion.manualLevels.push(level);
        criterion.sources.push({candidateId:id,parcours:source.parcours,date:source.date,
          scored:false,level,comment:clean(r.comment),detail:clean(r.detail)});
      }
      const summary=clean(doc.summary);
      if(summary)notes.push({candidateId:id,parcours:source.parcours,date:source.date,summary});
    }
    sources.push(source);
  }
  const categories=[];
  for(const [name,tests] of groups){
    const children=[...tests.values()].map(t=>{
      // Score cumule uniquement sur les passages disposant d'un bareme numerique.
      const pct=t.possible>0?t.points/t.possible*100:null;
      const agreedLevel=t.manualLevels.length&&t.manualLevels.every(level=>level===t.manualLevels[0])
        ? t.manualLevels[0] : 'NE';
      const level=pct===null?agreedLevel:percentLevel(pct);
      return {...t,percent:pct===null?null:Math.round(pct*100)/100,level,percentRaw:pct,points:Math.round(t.points*10000)/10000,possible:Math.round(t.possible*10000)/10000};
    }).sort((a,b)=>a.title.localeCompare(b.title,'fr'));
    const scored=children.filter(t=>t.percent!==null);
    // Chaque test DISTINCT a le meme poids dans sa categorie :
    // un test passe trois fois ne supplante pas un test passe une seule fois.
    const categoryPercent=scored.length
      ? scored.reduce((sum,t)=>sum+t.percentRaw,0)/scored.length:null;
    categories.push({
      name,tests:children,testCount:children.length,scoredTestCount:scored.length,
      percent:categoryPercent===null?null:Math.round(categoryPercent*100)/100,
      level:categoryPercent===null?'NE':percentLevel(categoryPercent)
    });
  }
  categories.sort((a,b)=>a.name.localeCompare(b.name,'fr'));
  const totalTests=categories.reduce((sum,c)=>sum+c.testCount,0);
  const institutional=aggregateInstitutionalRows(evaluations);
  return {schemaVersion:2,evaluationCount:evaluations.length,testCount:totalTests,
    categories,sources,notes,sourceDigest:sourceDigest(evaluations),
    institutionalRows:institutional.rows,institutionalWarnings:institutional.warnings};
}
function wordRows(general){
  // Le Word est STRICTEMENT la grille de 17 lignes institutionnelles.
  // Aucune rubrique calculée à partir des noms de catégorie, aucun TOTAL,
  // aucune mention du nombre de parcours ou de passages dans cette grille.
  return institutionalWordRows(general);
}

module.exports={aggregateGeneralBilan,wordRows,percentLevel,categoryFor,stateFromSession};
