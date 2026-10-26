'use strict';
// Le bilan enregistré reprend le vrai modèle institutionnel, jamais une grille
// recomposée à partir de textes aplatis ou de zones de saisie supplémentaires.
const {institutionalTableSource}=require('./institutional-bilan-grid');
const {normalizeErrorCounts}=require('./bilan-error-count');
function pruneEmptySections(table){
 let section=null,hasRows=false;
 for(const row of [...table.querySelectorAll('tbody tr')]){
  if(row.matches('tr.section,tr.section2')){
   if(section&&!hasRows)section.remove();section=row;hasRows=false;
  }else if(row.dataset.r)hasRows=true;
 }
 if(section&&!hasRows)section.remove();
}
function applyTriValues(table,rows){
 const byKey=new Map((rows||[]).map(row=>[row.key,row]));
 const timesRow=byKey.get('tri-temps'),errorsRow=byKey.get('tri-erreurs');
 const avg=table.querySelector('#triAvg'),times=table.querySelector('#triTimes'),errors=table.querySelector('#triErr');
 if(avg)avg.textContent=timesRow?.triAverage||String(timesRow?.moduleText||timesRow?.latestModule||'').match(/Moyenne\s+(\d{1,3}:\d{2})/i)?.[1]||'—';
 if(times){times.textContent=timesRow?.triTimes||timesRow?.extra||'Non renseigné';times.style.whiteSpace='pre-line'}
 if(errors)errors.textContent=normalizeErrorCounts(errorsRow?.triErrors||String(errorsRow?.moduleText||errorsRow?.latestModule||'').match(/\b\d+\s+erreurs?\b/i)?.[0]||'Non renseigné');
}
function officialEditorStyles(css,scope){
 const sheet=new CSSStyleSheet();sheet.replaceSync(css);
 const rules=[];
 for(const rule of sheet.cssRules){
  if(rule.type!==1)continue;
  const selectors=rule.selectorText.split(',').map(s=>s.trim()).filter(s=>/^(table|col|th|td|thead|tr|\.level|\.section|\.alt|\.csel|\.detail|\.small)/.test(s));
  if(!selectors.length)continue;
  rules.push(selectors.map(s=>s==='table'?scope+' .seb-bh-table':scope+' .seb-bh-table '+s).join(',')+'{'+rule.style.cssText+'}');
 }
 return rules.join('\n')+'\n'+scope+' .seb-bh-table{font:11pt Calibri,Arial,sans-serif}'+scope+' .seb-bh-table .seb-bh-detail{font-size:10pt;color:#111;white-space:pre-line;margin-top:3px}';
}
function createEditorTable(documentState){
 const parsed=new DOMParser().parseFromString(institutionalTableSource(),'text/html');
 const source=parsed.querySelector('table#bilan');
 if(!source)throw new Error('Modèle institutionnel introuvable.');
 const table=document.importNode(source,true);
 table.id='seb-bh-institutional-table';table.classList.add('seb-bh-table');
 const byKey=new Map((documentState.rows||[]).filter(r=>r.kind==='item').map(r=>[r.key,r]));
 for(const tr of [...table.querySelectorAll('tbody tr')]){
  if(tr.matches('tr.section,tr.section2')){tr.classList.add('seb-bh-section');continue}
  const row=byKey.get(tr.dataset.r);if(!row){tr.remove();continue}
  tr.dataset.key=row.key;tr.dataset.className=tr.className;tr.dataset.comment=row.options?.some(o=>o.value===row.comment)?'':String(row.comment||'');
  if(row.points!==null&&row.points!==undefined)tr.dataset.points=String(row.points);
  if(row.possible!==null&&row.possible!==undefined)tr.dataset.possible=String(row.possible);
  tr.dataset.assessmentMode=row.assessmentMode||'';
  const setLevel=level=>{tr.dataset.level=level||'';tr.querySelectorAll('.level').forEach(cell=>cell.classList.toggle('on',cell.dataset.l===level))};
  for(const cell of tr.querySelectorAll('.level')){
   cell.classList.add('seb-bh-level');cell.dataset.level=cell.dataset.l;
   cell.addEventListener('click',()=>{setLevel(cell.dataset.l);const select=tr.querySelector('.csel');const opt=[...(select?.options||[])].find(o=>o.dataset.l===cell.dataset.l);if(opt)select.value=opt.value});
  }
  const select=tr.querySelector('.csel');
  if(select){
   select.classList.add('seb-bh-select');
   if(row.options?.length){
    select.replaceChildren();
    for(const opt of row.options){const option=document.createElement('option');option.value=opt.value||'';option.textContent=opt.text||'';option.dataset.l=opt.level||'';select.appendChild(option)}
   }
   for(const option of select.options)option.dataset.level=option.dataset.l||'';
   const chosen=(row.preset?[...select.options].find(o=>o.value===row.preset):null)||[...select.options].find(o=>o.dataset.l===row.level);
   if(chosen)select.value=chosen.value;
   select.addEventListener('change',()=>setLevel(select.options[select.selectedIndex]?.dataset.l||''));
  }
  const detail=tr.querySelector('.detail');if(detail){detail.classList.add('seb-bh-detail');detail.textContent=normalizeErrorCounts(row.detail||'')}
  if(row.comment&&row.comment!==row.preset&&!row.options?.some(o=>o.value===row.comment)){
   const note=document.createElement('div');note.className='seb-bh-saved-comment';note.style.whiteSpace='pre-wrap';note.textContent=row.comment;tr.lastElementChild.appendChild(note);
  }
  setLevel(row.level);
 }
 pruneEmptySections(table);applyTriValues(table,documentState.rows);
 for(const tr of table.querySelectorAll('tr[data-r]'))tr.dataset.moduleText=tr.firstElementChild.innerText||tr.firstElementChild.textContent||'';
 return {table,css:officialEditorStyles(parsed.querySelector('head style')?.textContent||'','#seb-bilan-history-editor')};
}
module.exports={createEditorTable,applyTriValues,pruneEmptySections};
