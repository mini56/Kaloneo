(()=>{const KEY='admin_bilan_state';const $=s=>document.querySelector(s),row=id=>$('tr[data-r="'+id+'"]');
function json(k,d){try{return JSON.parse(sessionStorage.getItem(k)||'null')??d}catch{return d}}function status(t){$('#status').textContent=t}
function level(r,l){if(!r)return;r.querySelectorAll('.level').forEach(c=>c.classList.toggle('on',c.dataset.l===l));r.dataset.level=l||''}
function syncComment(r,l){if(!r)return;const s=r.querySelector('.csel');if(!s)return;const o=Array.from(s.options).find(opt=>opt.dataset.l===l);if(o)s.value=o.value;else if(!l)s.selectedIndex=0}function apply(id,l,detail){const r=row(id);if(!r)return;level(r,l);syncComment(r,l);if(detail!==undefined)r.querySelector('.detail').textContent=detail||''}function errorDetail(n){const v=Math.max(0,Number(n)||0);return '- '+v+' erreur'+(v===1?'':'s')}
function save(){const data={rows:{}};document.querySelectorAll('tr[data-r]').forEach(r=>{const l=r.dataset.level||r.querySelector('.level.on')?.dataset.l||'';const s=r.querySelector('.csel');if(s&&String(s.options[s.selectedIndex]?.dataset.l||'')!==l)syncComment(r,l);data.rows[r.dataset.r]={level:l,select:s?.value||'',detail:r.querySelector('.detail')?.textContent||'',points:r.dataset.score??null,possible:r.dataset.possible??null}});data.triAvg=$('#triAvg').textContent;data.triErr=$('#triErr').textContent;data.triTimes=$('#triTimes').innerHTML;sessionStorage.setItem(KEY,JSON.stringify(data));window.sebEvalPro?.save?.();status('Modifications enregistrées')}
function restore(){const d=json(KEY,null);if(!d)return;Object.entries(d.rows||{}).forEach(([id,v])=>{const r=row(id);if(!r)return;level(r,v.level);if(v.points!==null&&v.points!==undefined)r.dataset.score=String(v.points);if(v.possible!==null&&v.possible!==undefined)r.dataset.possible=String(v.possible);const s=r.querySelector('.csel'),x=r.querySelector('.detail');if(s){s.value=v.select||'';if(String(s.options[s.selectedIndex]?.dataset.l||'')!==String(v.level||''))syncComment(r,v.level||'')}if(x)x.textContent=v.detail||''});if(d.triAvg)$('#triAvg').textContent=d.triAvg;if(d.triErr)$('#triErr').textContent=d.triErr;if(d.triTimes)$('#triTimes').innerHTML=d.triTimes}
function auto(){if(window.SEB_KALONEO_BILAN?.enabled&&window.SEB_KALONEO_BILAN.auto())return;const sc=json('scores_data',{});const brique=json('eval_brique',null);if(brique&&brique.niveau!==undefined&&brique.niveau!==null&&String(brique.niveau)!==''){const be=parseInt(brique.niveau,10);if(!isNaN(be)){const bl=be<=2?'I':be<=4?'II':'III';apply('briques-identification',bl,'');apply('briques-manipulation',bl,errorDetail(be))}}const carre=parseInt(sessionStorage.getItem('carre_magique_erreurs'),10);if(!isNaN(carre))apply('carre',carre<=2?'I':carre<=4?'II':'III',errorDetail(carre));const stok=parseInt(sessionStorage.getItem('stockCorrect'),10),tot=parseInt(sessionStorage.getItem('stockTotal'),10);if(!isNaN(stok)){const e=Math.max(0,(isNaN(tot)?34:tot)-stok);apply('organisation',e<=2?'I':e<=4?'II':'III',errorDetail(e))}let page5=0,hasPage5=false;for(let i=1;i<=8;i++){const k='page5_q'+i;if(Object.hasOwn(sc,k)){hasPage5=true;page5+=+sc[k]||0}}const psRaw=sessionStorage.getItem('planningScore'),hasPlanning=psRaw!==null&&Number.isFinite(+psRaw);if(hasPlanning||hasPage5){const pv=hasPlanning?Math.max(0,Math.min(15,+psRaw)):0,ov=Math.max(0,Math.min(8,page5)),combined=pv+ov,errors=23-combined;apply('planning',combined>=20?'I':combined>=17?'II':'III',errorDetail(errors))}
const tri=json('tri_cheville_data',null);if(Array.isArray(tri?.tris)){let sum=0,n=0,err=0,lines=[];tri.tris.slice(0,5).forEach((t,i)=>{const m=+t?.minutes||0,s=+t?.secondes||0,e=+t?.erreurs||0;if(m||s){sum+=m*60+s;n++;err+=e;lines.push('N°'+(i+1)+' : '+String(m).padStart(2,'0')+' min '+String(s).padStart(2,'0')+' s')}});if(n>0){const sec=Math.round(sum/n),avg=String(Math.floor(sec/60)).padStart(2,'0')+':'+String(sec%60).padStart(2,'0'),errAvg=err/n;$('#triAvg').textContent=avg;$('#triTimes').innerHTML=lines.join('<br>');apply('tri-temps',sec<=720?'I':sec<=840?'II':'III');$('#triErr').textContent=err+' erreur'+(err===1?'':'s');apply('tri-erreurs',errAvg<=1.6?'I':errAvg<=3.2?'II':'III','')}}
if(Object.hasOwn(sc,'page7')){const v=Math.max(0,Math.min(8,+sc.page7||0)),errors=8-v;apply('texte',v>=7?'I':v>=3?'II':'III',errorDetail(errors))}const md=json('page8_data',null);let ms=md?.score_total!==undefined?+md.score_total:(Object.hasOwn(sc,'page8')?+sc.page8:null);if(ms!==null&&Number.isFinite(ms)){const e=Math.max(0,6-ms);apply('mail',e<=1?'I':e<=3?'II':'III',errorDetail(e))}
const dictee=json('dictee_data',null),abs=json('seb_evalpro_abandons',[]);const dicteeOK=dictee?.status==='verified'&&Number.isFinite(+dictee.scoreSur20);const hasTexteTrous=Object.hasOwn(sc,'pageTexteTrous'),hasPar=sessionStorage.getItem('paronymes_score')!==null,hasGenre=sessionStorage.getItem('erreurs_exercice')!==null,expAbandon=Array.isArray(abs)&&abs.some(r=>/paronyme|genre|texte à trous|dictee|dictée/i.test(String(r?.key||'')+' '+String(r?.exercice||'')));const exp=hasTexteTrous||hasPar||hasGenre||dicteeOK||expAbandon;if(exp){const tr=hasTexteTrous?Math.max(0,Math.min(15,+sc.pageTexteTrous||0)):0,p=hasPar?Math.max(0,Math.min(20,+sessionStorage.getItem('paronymes_score')||0)):0,g=hasGenre?Math.max(0,Math.min(20,20-(+sessionStorage.getItem('erreurs_exercice')||0))):0,d=dicteeOK?Math.max(0,Math.min(20,+dictee.scoreSur20)):0,v=tr+p+g+d,pc=Math.round(v/75*100);apply('expression',pc>=70?'I':pc>=45?'II':'III','- '+pc+' % de réponses correctes')}
let e=0,he=false;for(let i=1;i<=5;i++){if(Object.hasOwn(sc,'page2_q'+i))he=true;e+=+sc['page2_q'+i]||0}for(let i=6;i<=10;i++){if(Object.hasOwn(sc,'page2_1_q'+i))he=true;e+=+sc['page2_1_q'+i]||0}if(he){const p=Math.round(e/10*100);apply('math-enonce',p>=70?'I':p>=45?'II':'III','- '+p+' % de réponses correctes')}let pr=0,hp=false;for(let i=1;i<=14;i++){if(Object.hasOwn(sc,'page3_q'+i))hp=true;pr+=+sc['page3_q'+i]||0}for(let i=1;i<=10;i++){if(Object.hasOwn(sc,'page6_q'+i))hp=true;pr+=+sc['page6_q'+i]||0}if(Object.hasOwn(sc,'page4')){hp=true;pr+=+sc.page4||0}if(hp){const p=Math.round(pr/27*100);apply('math-problemes',p>=70?'I':p>=45?'II':'III','- '+p+' % de réponses correctes')}save();status('Bilan complété automatiquement - complétez les lignes manuelles')}
function cand(){const c=json('candidat_data',{});return{nom:String(c.nom||''),prenom:String(c['prénom']||c.prenom||''),date:String(c.date||c.dateTest||'')}}function safe(s){return(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z0-9_-]+/g,'_').replace(/^_+|_+$/g,'')||'CANDIDAT'}function base(){const c=cand(),d=/^\d{4}-\d{2}-\d{2}$/.test(c.date)?c.date:new Date().toISOString().slice(0,10);return'Evaluation_'+safe(c.nom).toUpperCase()+'_'+safe(c.prenom).toUpperCase()+'_'+d}function esc(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function wordPaint(el,bg,fg){if(!el)return;el.style.backgroundColor=bg;el.setAttribute('bgcolor',bg);if(fg){el.style.color=fg;el.setAttribute('color',fg)}}function prepareWordColours(t){const h=t.querySelectorAll('thead th');wordPaint(h[0],'#0070C0','#FFFFFF');wordPaint(h[1],'#CCFFFF','#000000');wordPaint(h[2],'#92D050','#000000');wordPaint(h[3],'#ED7D31','#FFFFFF');wordPaint(h[4],'#C00000','#FFFFFF');wordPaint(h[5],'#0070C0','#FFFFFF');t.querySelectorAll('tr.section td').forEach(el=>wordPaint(el,'#9CC2E5','#000000'));t.querySelectorAll('tr.section2 td').forEach(el=>wordPaint(el,'#B8CCE4','#000000'));t.querySelectorAll('tr.alt td').forEach(el=>wordPaint(el,'#F2F2F2','#000000'));const colours={NE:['#CCFFFF','#000000'],I:['#92D050','#000000'],II:['#ED7D31','#FFFFFF'],III:['#C00000','#FFFFFF']};t.querySelectorAll('.level.on[data-l]').forEach(el=>{const l=el.dataset.l,c=colours[l];if(c)wordPaint(el,c[0],c[1]);})}function wordRows(){
  const out=[],tbody=$('#bilan')?.querySelector('tbody');
  if(!tbody)return out;
  [...tbody.children].forEach(tr=>{
    if(!tr||tr.hidden||tr.dataset.sebKaloneoExcluded==='1'||tr.dataset.kaloneoAutoevaluation==='1')return;
    if(tr.matches('.seb-admin-abandon-section,.seb-admin-abandon-row'))return;
    if(tr.matches('tr.section,tr.section2')){
      out.push({type:'section',text:String(tr.innerText||tr.textContent||'').trim(),strong:tr.classList.contains('section')});
      return;
    }
    if(!tr.matches('tr[data-r]'))return;
    const cells=[...tr.children];
    if(cells.length<6)return;
    const levelTexts={};
    tr.querySelectorAll('.level[data-l]').forEach(cell=>{levelTexts[cell.dataset.l]=String(cell.innerText||cell.textContent||'').trim()});
    const select=tr.querySelector('.csel');
    const level=String(tr.dataset.level||tr.querySelector('.level.on')?.dataset.l||'');
    let selectedComment=String(select?.value||'').trim();
    if(!selectedComment&&select&&level){
      const option=[...select.options].find(item=>item.dataset.l===level);
      selectedComment=String(option?.value||option?.textContent||'').trim();
    }
    const detail=String(tr.querySelector('.detail')?.innerText||tr.querySelector('.detail')?.textContent||'').trim();
    const triTimes=String(tr.querySelector('#triTimes')?.innerText||tr.querySelector('#triTimes')?.textContent||'').trim();
    out.push({
      type:'row',
      id:String(tr.dataset.r||''),
      module:String(cells[0]?.innerText||cells[0]?.textContent||'').trim(),
      level,
      levelTexts,
      comment:selectedComment,
      detail,
      extra:triTimes,
      alternate:tr.classList.contains('alt')
    });
  });
  return out;
}
async function word(){
  save();
  if(!window.sebEvalPro?.exportBilanDocx){status('Export Word indisponible');return}
  const c=cand();
  const summaryText=window.sebV7SingleSummary
    ? window.sebV7SingleSummary(String(sessionStorage.getItem('seb_evalpro_bilan_synthese')||''))
    : String(sessionStorage.getItem('seb_evalpro_bilan_synthese')||'').trim();
  const feeling=String(sessionStorage.getItem('seb_evalpro_bilan_ressenti')||'').trim();
  const payload={
    filename:base()+'.docx',
    candidate:c,
    rows:wordRows(),
    summary:summaryText,
    feeling,
    feelingTitle:window.sebEvalProFeelingTitle?window.sebEvalProFeelingTitle():'Ressenti de la personne sur son plateau technique'
  };
  status('Création du document Word…');
  try{
    const result=await window.sebEvalPro.exportBilanDocx(payload);
    if(!result||result.ok!==true){status('Export Word impossible : '+String(result?.error||'erreur inconnue'));return}
    status('Document Word créé : '+String(result.filename||payload.filename));
  }catch(error){
    status('Export Word impossible : '+String(error&&error.message?error.message:error));
  }
}
document.addEventListener('DOMContentLoaded',()=>{const c=cand();$('#nom').textContent=c.nom;$('#prenom').textContent=c.prenom;$('#date').textContent=c.date;restore();document.querySelectorAll('.level').forEach(x=>x.onclick=()=>{const r=x.closest('tr');level(r,x.dataset.l);syncComment(r,x.dataset.l);save()});document.querySelectorAll('.csel').forEach(x=>x.onchange=()=>{const r=x.closest('tr'),o=x.options[x.selectedIndex];if(o.dataset.l)level(r,o.dataset.l);save()});$('#auto').onclick=auto;$('#save').onclick=save;$('#word').onclick=word});})();
