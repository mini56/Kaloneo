/* KALONÉO : fenêtres complémentaires du Builder.
   Aucun minuteur Electron ni capture candidate : état et miniature DOM autonomes. */
(()=>{
'use strict';
let state=null;
let hooks=null;
let activeId=null;
const openPanels=new Set();
const el=id=>document.getElementById(id);
const current=()=>state?.supplementaryWindows?.find(item=>item.id===activeId)||null;
const makeId=()=> 'document_'+Math.random().toString(36).slice(2,11);
function create(){
  const windows=state.supplementaryWindows;
  const item={id:makeId(),title:'Document '+(windows.length+1),type:'text',
    text:'',imageData:'',imageName:'',imageAlt:''};
  windows.push(item);
  return item;
}
function thumbnail(){
  const host=el('supplementary-thumbnails');
  if(!host)return;
  host.replaceChildren();
  if(!state.supplementaryWindows.length){
    const hint=document.createElement('span');
    hint.className='muted';
    hint.textContent='Aucune fenêtre. Cliquez sur « + Fenêtre » pour en créer une.';
    host.appendChild(hint);
    return;
  }
  state.supplementaryWindows.forEach((item,index)=>{
    const button=document.createElement('button');
    button.type='button';
    button.className='supplementary-thumbnail'+(activeId===item.id?' is-active':'');
    const icon=document.createElement('span');
    icon.className='supplementary-thumb-icon';
    icon.textContent=({text:'▤',list:'☷',table:'▦',image:'▧'})[item.type]||'▤';
    const label=document.createElement('span');
    label.textContent=item.title||'Document '+(index+1);
    button.title=(index+1)+' — '+label.textContent;
    button.append(icon,label);
    button.addEventListener('click',()=>select(item.id));
    host.appendChild(button);
  });
}
function editor(){
  const item=current();
  const panel=el('supplementary-editor');
  if(!panel)return;
  panel.hidden=!item;
  el('supplementary-main').disabled=!item;
  const preview=el('candidate-preview-viewport')?.closest('.builder-preview');
  if(preview)preview.dataset.supplementaryMode=item?'true':'false';
  if(!item)return;
  el('supplementary-title').value=item.title||'';
  el('supplementary-type').value=item.type||'text';
  el('supplementary-text').value=item.text||'';
  const image=item.type==='image';
  el('supplementary-text-label').hidden=image;
  el('supplementary-image-actions').hidden=!image;
  el('supplementary-image-name').textContent=item.imageName||'Aucune image';
  el('supplementary-clear-image').disabled=!Boolean(item.imageData);
}
function render(){thumbnail();editor();}
function select(id){
  const wasEditing=Boolean(activeId);
  activeId=state.supplementaryWindows.some(item=>item.id===id)?id:null;
  if(activeId)hooks.freeze();
  render();
  if(wasEditing&&!activeId)hooks.resume();
}
function notify(){
  hooks.documentChanged();
}
function setImage(id,image){
  const item=state.supplementaryWindows.find(x=>x.id===id);
  if(!item||!image?.data)return false;
  item.imageData=image.data;
  item.imageName=image.name||'Image';
  item.imageAlt=item.title||item.imageName;
  render();
  notify();
  return true;
}
function addBlockControls(block,body){
  const details=document.createElement('details');
  details.className='builder-supplementary-button-panel';
  details.open=openPanels.has(block.uid);
  details.addEventListener('toggle',()=>{
    if(details.open)openPanels.add(block.uid);
    else openPanels.delete(block.uid);
  });
  const buttons=Array.isArray(block.supplementaryButtons)?block.supplementaryButtons:[];
  const heading=document.createElement('summary');
  heading.textContent='Fenêtres complémentaires'+
    (buttons.length?' ('+buttons.length+' bouton'+(buttons.length>1?'s':'')+')':'');
  details.appendChild(heading);
  const createButton=document.createElement('button');
  createButton.type='button';
  createButton.className='mini-btn';
  createButton.textContent='+ Ajouter un bouton documentaire';
  createButton.addEventListener('click',()=>{
    if(!state.supplementaryWindows.length){
      const first=create();
      select(first.id);
    }
    if(!Array.isArray(block.supplementaryButtons))block.supplementaryButtons=[];
    block.supplementaryButtons.push({label:'Consulter le document',
      windowId:state.supplementaryWindows[0].id,position:'after'});
    openPanels.add(block.uid);
    hooks.blockChanged();
    hooks.renderBlocks();
    render();
  });
  details.appendChild(createButton);
  buttons.forEach((button,index)=>{
    const row=document.createElement('div');
    row.className='builder-supplementary-button-row';
    const label=document.createElement('label');
    label.textContent='Texte du bouton';
    const field=document.createElement('input');
    field.type='text';
    field.value=button.label||'';
    field.maxLength=140;
    field.addEventListener('input',()=>{
      button.label=field.value;
      hooks.blockTyping();
    });
    label.appendChild(field);
    const destination=document.createElement('select');
    destination.title='Fenêtre ouverte par le bouton';
    for(const doc of state.supplementaryWindows){
      const option=document.createElement('option');
      option.value=doc.id;
      option.textContent=doc.title||'Document';
      destination.appendChild(option);
    }
    destination.value=button.windowId||'';
    destination.addEventListener('change',()=>{
      button.windowId=destination.value;
      hooks.blockChanged();
    });
    const position=document.createElement('select');
    position.title='Position du bouton dans le bloc';
    for(const [value,text] of [['after','Après le contenu'],['before','Avant le contenu']]){
      const option=document.createElement('option');
      option.value=value;option.textContent=text;position.appendChild(option);
    }
    position.value=button.position==='before'?'before':'after';
    position.addEventListener('change',()=>{
      button.position=position.value;
      hooks.blockChanged();
    });
    const remove=document.createElement('button');
    remove.type='button';remove.className='mini-btn danger';
    remove.textContent='Retirer ce bouton';
    remove.addEventListener('click',()=>{
      block.supplementaryButtons.splice(index,1);
      hooks.blockChanged();
      hooks.renderBlocks();
    });
    row.append(label,destination,position,remove);
    details.appendChild(row);
  });
  body.appendChild(details);
}
function install(bridge){
  if(state)return;
  state=bridge.state;
  hooks=bridge;
  el('supplementary-main').addEventListener('click',()=>select(null));
  el('supplementary-return').addEventListener('click',()=>select(null));
  el('supplementary-add').addEventListener('click',()=>{
    const item=create();
    select(item.id);
    notify();
  });
  el('supplementary-title').addEventListener('input',()=>{
    const item=current();if(!item)return;
    item.title=el('supplementary-title').value;
    // Actualisation du seul libellé, sans reconstruire l'éditeur ni l'aperçu.
    const label=el('supplementary-thumbnails').querySelector('.is-active span:last-child');
    if(label)label.textContent=item.title;
    notify();
  });
  el('supplementary-type').addEventListener('change',()=>{
    const item=current();if(!item)return;
    item.type=el('supplementary-type').value;
    render();
    notify();
  });
  el('supplementary-text').addEventListener('input',()=>{
    const item=current();if(!item)return;
    item.text=el('supplementary-text').value;
    notify();
  });
  el('supplementary-select-image').addEventListener('click',()=>{
    const item=current();if(!item)return;
    Promise.resolve(hooks.openImage('__supplementary__:'+item.id))
      .catch(error=>alert('Bibliothèque inaccessible : '+String(error?.message||error)));
  });
  el('supplementary-clear-image').addEventListener('click',()=>{
    const item=current();if(!item)return;
    item.imageData='';item.imageName='';item.imageAlt='';
    render();notify();
  });
  el('supplementary-delete').addEventListener('click',()=>{
    const item=current();if(!item)return;
    const linked=state.blocks.reduce((total,block)=>total+
      (block.supplementaryButtons||[]).filter(button=>button.windowId===item.id).length,0);
    if(!confirm('Supprimer « '+item.title+' » ?'+
       (linked?'\n'+linked+' bouton(s) lié(s) seront retirés.':'')))return;
    state.supplementaryWindows=state.supplementaryWindows.filter(other=>other.id!==item.id);
    for(const block of state.blocks)if(Array.isArray(block.supplementaryButtons))
      block.supplementaryButtons=block.supplementaryButtons.filter(button=>button.windowId!==item.id);
    if(state.supplementaryWindows.length){
      select(state.supplementaryWindows[0].id);
    } else {
      select(null);
    }
    hooks.renderBlocks();
    notify();
  });
  render();
}
function reset(){
  activeId=null;
  if(state)render(); // L'ouverture de retour Aperçu précède parfois install().
}
window.KaloneoSupplementaryBuilder=Object.freeze({
  install,render,reset,isEditing:()=>Boolean(activeId),
  active:()=>activeId,select,setImage,addBlockControls
});
})();
