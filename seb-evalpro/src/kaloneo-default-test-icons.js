'use strict';
// Icônes d'affichage : jamais de mutation des 24 V1 officielles.
// Les PNG existants sont tous référencés dans la bibliothèque d'icônes du Builder.
const fs=require('node:fs');
const path=require('node:path');
const byId=Object.freeze({
  autoevaluation_savoirs:'test_autoevaluation_progression',
  autoevaluation_tic:'test_autoevaluation_progression',
  calculs_commandes_atelier:'test_calculs_arithmetiques',
  calculs_poids_volumes:'test_poids_volumes',
  construction_briques:'test_montage_briques',
  conversions_atelier_expedition:'test_conversion_mesures',
  dictee_professionnelle:'test_dictee_orthographe',
  fin_parcours:'test_autoevaluation_progression',
  fractions_preparation_lots:'test_fractions_proportions',
  genre_nombre:'test_redaction_ecrite',
  gestes_postures:'test_securite_chantier',
  gratte_ciel:'test_construction_gratte_ciel',
  horaires_reception_controle:'test_planning_horaires',
  introduction_parcours_base:'test_lecture_comprehension',
  organisation_demenagement:'test_organisation_demenagement',
  paronymes_rapport:'test_lecture_comprehension',
  planning_cantine:'test_planning_cantine',
  ranger_stock:'test_stock_inventaire',
  redaction_email:'test_message_email',
  structure_3d_papier:'test_structure_papier',
  texte_a_trous_stage_logistique:'test_texte_a_trous',
  traitement_texte_bureautique:'test_traitement_texte',
  transition_video_f1:'test_ecoute_audio',
  tri_chevilles:'test_tri_chevilles'
});
const byCategory=Object.freeze({
  mathematiques:'test_calculs_arithmetiques',francais:'test_lecture_comprehension',
  expression_ecrite:'test_redaction_ecrite',tic:'test_traitement_texte',
  numerique:'test_traitement_texte',organisation:'test_organisation_etapes',
  planification:'test_organisation_planning',technique:'test_securite_chantier',
  activite_pratique:'test_structure_papier',competences_transversales:'test_securite_chantier',
  autoevaluation:'test_autoevaluation_progression',raisonnement:'test_puzzle_logique',
  introduction:'test_lecture_comprehension',fin:'test_autoevaluation_progression',
  systeme:'test_autoevaluation_progression',transition:'test_ecoute_audio'
});
const cache=new Map();
const folders=[
  path.resolve(__dirname,'..','app','web','kaloneo-builder','icons-tests'),
  path.resolve(__dirname,'..','..','kaloneo','icons-tests')
];
function iconForDefinition(definition){
  if(typeof definition?.icon?.data==='string' && /^data:image\//i.test(definition.icon.data))return definition.icon;
  const name=byId[String(definition?.id||'')]||byCategory[String(definition?.category||'')]||'test_organisation_etapes';
  if(cache.has(name))return cache.get(name);
  const file=folders.map(folder=>path.join(folder,name+'.png')).find(fs.existsSync);
  if(!file)return null;
  const icon={id:name,label:name.replace(/^test_/,'').replace(/_/g,' '),
    data:'data:image/png;base64,'+fs.readFileSync(file).toString('base64')};
  cache.set(name,icon);
  return icon;
}
module.exports={iconForDefinition,byId,byCategory};
