/* KALONÉO — règles partagées de raccordement des tests Builder au bilan.
 * La grille contient 18 lignes explicites et aucune réponse libre n'est notée.
 */
(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.KaloneoBilanRouting=api;
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  const ROWS=Object.freeze({
    'bilan.competences_techniques.fabrication.plan':'fabrication-plan',
    'bilan.competences_techniques.fabrication.tracage_reperage':'fabrication-tracage',
    'bilan.competences_techniques.fabrication.decoupe':'fabrication-decoupe',
    'bilan.competences_techniques.fabrication.pliage_assemblage':'fabrication-assemblage',
    'bilan.competences_techniques.fabrication.finition':'fabrication-finition',
    'bilan.competences_techniques.briques.identifier_schema':'briques-identification',
    'bilan.competences_techniques.briques.manipuler_assembler':'briques-manipulation',
    'bilan.competences_techniques.carre_magique.resolution_contraintes':'carre',
    'bilan.competences_techniques.gestion_logistique.classement_multicritere':'organisation',
    'bilan.competences_techniques.planning.repartition_taches':'planning',
    'bilan.competences_techniques.tri_chevilles.temps':'tri-temps',
    'bilan.competences_techniques.tri_chevilles.erreurs':'tri-erreurs',
    'bilan.tic.traitement_texte.presenter_travail':'texte',
    'bilan.tic.messagerie.echanger':'mail',
    'bilan.savoirs_fondamentaux.expression_ecrite.maitrise':'expression',
    'bilan.savoirs_fondamentaux.mathematiques.comprendre_enonce_consigne':'math-enonce',
    'bilan.savoirs_fondamentaux.mathematiques.resoudre_problemes':'math-problemes',
    'bilan.savoirs_fondamentaux.competences_transversales.mobiliser_competences':'competences-transversales'
  });
  function normalize(s){
    return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .toLowerCase().replace(/[_-]/g,' ').trim();
  }
  function compatible(category,lineId){
    const cat=normalize(category);
    if(lineId==='bilan.savoirs_fondamentaux.competences_transversales.mobiliser_competences')return cat==='competences transversales';
    if(lineId.includes('.mathematiques.'))return cat==='mathematiques'||cat==='maths'||cat==='math';
    if(lineId.includes('.expression_ecrite.'))return cat==='francais'||cat==='expression ecrite'||cat==='dictee';
    if(lineId.includes('.competences_techniques.'))return ['technique','techniques','competences techniques','organisation','planification','activite pratique','activite_pratique','raisonnement'].includes(cat);
    if(lineId.includes('.tic.'))return ['tic','bureautique','numerique','communication'].includes(cat);
    return false;
  }
  function links(test){
    return (Array.isArray(test?.bilanContributions)?test.bilanContributions:[])
      .filter(x=>x&&typeof x.lineId==='string'&&Boolean(ROWS[x.lineId]));
  }
  function rowFor(lineId){return ROWS[String(lineId||'')]||''}
  function numeric(value){
    if(value===null||value===undefined||String(value).trim()==='')return null;
    const n=Number(value);return Number.isFinite(n)?n:null;
  }
  function scoreOf(result,bindings){
    if(!result||typeof result!=='object'||!bindings||typeof bindings!=='object')return null;
    const scoreBinding=String(bindings.score||'');
    const maxBinding=String(bindings.score_max||'');
    const pct=(()=>{
      const explicit=numeric(result.percentage);
      if(explicit!==null)return explicit;
      const score=numeric(result.score),max=numeric(result.scoreMax);
      return score!==null&&max!==null&&max>0?(score/max)*100:null;
    })();
    // Le Builder permettait de lier les deux entrées à « pourcentage ».
    // Cela ne signifie surtout pas 50/50=100 % : la base est toujours 100.
    if(scoreBinding==='pourcentage'&&maxBinding==='pourcentage'&&pct!==null)
      return {score:Math.max(0,Math.min(100,pct)),max:100};
    const values={score:result.score,score_max:result.scoreMax,pourcentage:pct};
    const score=numeric(values[scoreBinding]),max=numeric(values[maxBinding]);
    if(score===null||max===null||max<=0)return null;
    // Valeur pourcentage en numérateur => dénominateur 100.
    if(scoreBinding==='pourcentage')return {score:Math.max(0,Math.min(100,score)),max:100};
    return {score:Math.max(0,Math.min(max,score)),max};
  }
  function collect(tests,stateFor){
    const entries=new Map(),warnings=[];
    for(const test of tests||[]){
      // Les V1 sont déjà traitées par les barèmes historiques validés.
      // Seuls les tests issus du Builder passent par ce moteur générique :
      // ne jamais compter une V1 deux fois.
      if(test?.adminModified!==true)continue;
      for(const link of links(test)){
        const rowId=rowFor(link.lineId);
        if(!compatible(test.category,link.lineId)){
          warnings.push({testId:test.id,rowId,reason:'Categorie incompatible avec la ligne du bilan'});
          continue;
        }
        if(!entries.has(rowId))entries.set(rowId,[]);
        const result=typeof stateFor==='function'?stateFor(test.id)?.result:null;
        const pair=scoreOf(result,link.bindings);
        entries.get(rowId).push({testId:test.id,title:test.title||test.id,pair,
          manual:!link.bindings||!Object.keys(link.bindings).length});
        if(!pair&&!link.lineId.includes('.fabrication.'))
          warnings.push({testId:test.id,rowId,reason:'Aucune note automatique valide pour ce raccordement'});
      }
    }
    return {entries,warnings};
  }
  return Object.freeze({rowFor,compatible,links,scoreOf,collect});
});
