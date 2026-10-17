'use strict';
// Audit géométrique du rendu CANDIDAT, indépendant des tests du catalogue.
// Cette fonction est sérialisée dans executeJavaScript : pas de dépendances externes.
function inspectCandidateOverflow(doc) {
  const root=doc.getElementById('kaltest-content');
  if(!root)return {overflowZones:0,scrollableZones:0,clippedAreas:[],
    tableHorizontalOverflow:false};
  const view=doc.defaultView;
  const nodes=[root,...root.querySelectorAll(
    '.kaltest-builder-runtime-layout, .kaltest-builder-runtime-zone, '+
    '.kaltest-builder-grid-wrap, .kaltest-builder-content-item, '+
    '.kaltest-builder-media, .kaltest-builder-html, .kaltest-table')];
  const blocked=[],scrollable=[];
  const checked=new Set();
  const tolerance=3; // Sous-pixels Chromium, bordures et arrondis.
  for(const node of nodes) {
    if(checked.has(node)||!node.getClientRects().length)continue;
    checked.add(node);
    const style=view.getComputedStyle(node);
    const axes=[
      ['horizontal',node.scrollWidth-node.clientWidth,style.overflowX],
      ['vertical',node.scrollHeight-node.clientHeight,style.overflowY]
    ];
    for(const [axis,excess,policy] of axes){
      if(excess<=tolerance)continue;
      const target=node===root?'contenu':(
        node.classList?.contains('kaltest-builder-runtime-zone')?'colonne':
        node.classList?.contains('kaltest-builder-runtime-layout')?'disposition':
        node.classList?.contains('kaltest-builder-grid-wrap')?'tableau':'bloc');
      if(policy==='hidden'||policy==='clip') {
        blocked.push({target,axis,excess:Math.ceil(excess)});
      } else if(policy==='auto'||policy==='scroll') {
        // Le contenu supplémentaire reste accessible via le défilement.
        scrollable.push({target,axis});
      }
      // overflow:visible se propage au parent : ce n'est pas un écrêtage.
    }
  }
  // Ne pas confondre une grande grille avec un tableau tronqué :
  // toute largeur accessible par le scroll d'un ancêtre est licite.
  let tableHorizontalOverflow=false;
  const table=root.querySelector('.kaltest-builder-grid');
  if(table&&table.scrollWidth>table.clientWidth+tolerance) {
    let ancestor=table.parentElement,scrollAccessible=false;
    while(ancestor&&root.contains(ancestor)) {
      const policy=view.getComputedStyle(ancestor).overflowX;
      if((policy==='auto'||policy==='scroll') &&
         ancestor.scrollWidth>ancestor.clientWidth+tolerance) {
        scrollAccessible=true;
        break;
      }
      if((policy==='hidden'||policy==='clip') &&
         ancestor.scrollWidth>ancestor.clientWidth+tolerance) {
        tableHorizontalOverflow=true;
        break;
      }
      ancestor=ancestor.parentElement;
    }
    if(scrollAccessible)tableHorizontalOverflow=false;
  }
  return {overflowZones:blocked.length,scrollableZones:scrollable.length,
    clippedAreas:blocked.slice(0,12),tableHorizontalOverflow};
}
module.exports={inspectCandidateOverflow};
