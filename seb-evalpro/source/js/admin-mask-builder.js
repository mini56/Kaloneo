(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const state = { image:'', imageName:'', video:'', videoName:'', editing:null, masks:[] };
  const previewPlayer = window.KaloneoMaskMedia.createPlayer({
    stage:$('mask-preview-media-stage'), video:$('mask-preview-video'),
    image:$('mask-preview-image'), text:$('mask-preview-text')
  });

  function cleanId(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'') || 'ecran-masquage';
  }

  function setStatus(message, error=false) {
    const node=$('mask-status');
    node.textContent=String(message||'');
    node.style.color=error?'#a00000':'#1b6b31';
  }

  function updatePreview() {
    previewPlayer.show({
      name:String($('mask-name').value||''),
      content:{text:$('mask-text').value, image:state.image, video:state.video}
    });
    $('mask-image-name').textContent=state.imageName||'';
    $('mask-video-name').textContent=state.videoName||'';
  }

  function reset() {
    state.editing=null;
    state.image='';
    state.imageName='';
    state.video='';
    state.videoName='';
    $('mask-name').value='';
    $('mask-id').value='';
    $('mask-version').value='1.0.0';
    $('mask-text').value='';
    $('mask-name').readOnly=false;
    $('mask-version').readOnly=false;
    $('mask-text').readOnly=false;
    $('mask-image-file').disabled=false;
    $('remove-mask-image').disabled=false;
    $('mask-video-file').disabled=false;
    $('remove-mask-video').disabled=false;
    $('save-mask').disabled=false;
    setStatus('');
    updatePreview();
    requestAnimationFrame(()=>$('mask-name').focus());
  }

  function applyDefinition(value, statusMessage='Écran ouvert') {
    value=value||{};
    state.editing=value.id?{id:value.id,version:value.version||'1.0.0',systemProvided:value.systemProvided===true}:null;
    state.image=String(value.content?.image||'');
    state.imageName=String(value.content?.imageName||'')||(state.image?'Image embarquée':'');
    state.video=String(value.content?.video||'');
    state.videoName=String(value.content?.videoName||'')||(state.video?'Vidéo embarquée':'');
    $('mask-name').value=String(value.name||'');
    $('mask-id').value=String(value.id||'');
    $('mask-version').value=String(value.version||'1.0.0');
    $('mask-text').value=String(value.content?.text||'');
    const locked=value.systemProvided===true;
    $('mask-name').readOnly=locked;
    $('mask-version').readOnly=locked;
    $('mask-text').readOnly=locked;
    $('mask-image-file').disabled=locked;
    $('remove-mask-image').disabled=locked;
    $('mask-video-file').disabled=locked;
    $('remove-mask-video').disabled=locked;
    $('save-mask').disabled=locked;
    setStatus(locked?'Écran KALONÉO par défaut — protégé':statusMessage);
    updatePreview();
  }

  async function openMask(meta) {
    const result=await window.sebEvalPro?.kaloneoGetMaskScreen?.({id:meta.id,version:meta.version});
    if(!result||result.ok!==true) return setStatus(result?.error||'Lecture impossible.',true);
    applyDefinition(result.maskScreen||{});
  }

  function currentDefinition() {
    const name=String($('mask-name').value||'').trim()||'Aperçu écran de masquage';
    const version=String($('mask-version').value||'1.0.0').trim()||'1.0.0';
    const id=String($('mask-id').value||cleanId(name));
    return {
      format:'kaloneo-mask-screen',
      schemaVersion:1,
      id,version,name,
      systemProvided:Boolean(state.editing?.systemProvided),
      content:{
        text:String($('mask-text').value||''),image:state.image,imageName:state.imageName,
        video:state.video,videoName:state.videoName
      }
    };
  }

  async function openRealPreview() {
    const definition=currentDefinition();
    if(!definition.content.text.trim()&&!definition.content.image&&!definition.content.video) {
      return setStatus('Ajoutez un texte, une image ou une vidéo avant l’aperçu.',true);
    }
    if(definition.content.video&&!definition.content.image) {
      return setStatus('Choisissez une image finale pour la vidéo.',true);
    }
    const result=await window.sebEvalPro?.kaloneoOpenMaskPreview?.(definition);
    if(!result||result.ok!==true) setStatus(result?.error||'Aperçu impossible.',true);
  }

  function renderList() {
    const root=$('mask-list');
    root.replaceChildren();
    for(const meta of state.masks) {
      const button=document.createElement('button');
      button.type='button';
      button.className='mask-item'+(meta.systemProvided?' system':'');
      const title=document.createElement('strong');
      title.textContent=meta.name;
      const info=document.createElement('span');
      const modes=[];
      if(meta.hasText)modes.push('texte');
      if(meta.hasVideo)modes.push('vidéo → 3 s → fondu');
      if(meta.hasImage)modes.push('image');
      info.textContent='v'+meta.version+' • '+modes.join(' + ')+(meta.systemProvided?' • par défaut':'');
      button.append(title,info);
      button.addEventListener('click',()=>openMask(meta));
      root.appendChild(button);
    }
  }

  async function refreshList() {
    const result=await window.sebEvalPro?.kaloneoListMaskScreens?.();
    if(!result||result.ok!==true) throw new Error(result?.error||'Lecture de la bibliothèque impossible.');
    state.masks=Array.isArray(result.maskScreens)?result.maskScreens:[];
    renderList();
  }

  async function loadImage(file) {
    if(!file)return;
    if(!String(file.type||'').startsWith('image/')) throw new Error('Le fichier choisi doit être une image.');
    const data=await new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onload=()=>resolve(String(reader.result||''));
      reader.onerror=()=>reject(reader.error||new Error('Lecture image impossible.'));
      reader.readAsDataURL(file);
    });
    state.image=data;
    state.imageName=file.name;
    updatePreview();
  }

  async function loadVideo(file) {
    if(!file)return;
    const mime=String(file.type||'').toLowerCase();
    if(!['video/mp4','video/webm','video/ogg'].includes(mime)&&!/\.(mp4|webm|ogg)$/i.test(file.name)) {
      throw new Error('Choisissez une vidéo MP4, WEBM ou OGG.');
    }
    if(file.size>30*1024*1024) throw new Error('Vidéo trop volumineuse (maximum 30 Mo).');
    const data=await new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onload=()=>resolve(String(reader.result||''));
      reader.onerror=()=>reject(reader.error||new Error('Lecture de la vidéo impossible.'));
      reader.readAsDataURL(file);
    });
    state.video=data;
    state.videoName=file.name;
    updatePreview();
  }

  async function save() {
    const name=String($('mask-name').value||'').trim();
    const version=String($('mask-version').value||'1.0.0').trim();
    const text=String($('mask-text').value||'');
    if(!name)return setStatus('Le nom est obligatoire.',true);
    if(!text.trim()&&!state.image&&!state.video)return setStatus('Ajoutez du texte, une image ou une vidéo.',true);
    if(state.video&&!state.image)return setStatus('Une image finale est obligatoire après la vidéo.',true);

    const id=String($('mask-id').value||cleanId(name));
    $('mask-id').value=id;
    const payload={id,version,name,content:{
      text,image:state.image,imageName:state.imageName,video:state.video,videoName:state.videoName
    }};

    let result=await window.sebEvalPro?.kaloneoSaveMaskScreen?.(payload,false);
    if(result&&result.ok===false&&result.code==='EXISTS') {
      if(!confirm('Cette version existe déjà. La remplacer ?')) return;
      result=await window.sebEvalPro?.kaloneoSaveMaskScreen?.(payload,true);
    }
    if(!result||result.ok!==true)return setStatus(result?.error||'Enregistrement impossible.',true);

    setStatus('Écran enregistré dans la bibliothèque.');
    state.editing={id,version,systemProvided:false};
    await refreshList();
  }

  async function ready() {
    $('back-tests-parcours').addEventListener('click',()=>{window.location.href='admin-tests-parcours.html';});
    $('new-mask').addEventListener('click',reset);
    $('mask-name').addEventListener('input',()=>{
      if(!state.editing)$('mask-id').value=cleanId($('mask-name').value);
      updatePreview();
    });
    $('mask-text').addEventListener('input',updatePreview);
    $('mask-image-file').addEventListener('change',async()=>{
      try{await loadImage($('mask-image-file').files?.[0]);}
      catch(error){setStatus(error?.message||String(error),true);}
      finally{$('mask-image-file').value='';}
    });
    $('remove-mask-image').addEventListener('click',()=>{
      if(state.video)return setStatus('Retirez d’abord la vidéo avant de retirer son image finale.',true);
      state.image='';state.imageName='';updatePreview();
    });
    $('mask-video-file').addEventListener('change',async()=>{
      try{await loadVideo($('mask-video-file').files?.[0]);}
      catch(error){setStatus(error?.message||String(error),true);}
      finally{$('mask-video-file').value='';}
    });
    $('remove-mask-video').addEventListener('click',()=>{state.video='';state.videoName='';updatePreview();});
    $('save-mask').addEventListener('click',()=>{save().catch(error=>setStatus(error?.message||String(error),true));});
    $('open-real-mask-preview').addEventListener('click',()=>{openRealPreview().catch(error=>setStatus(error?.message||String(error),true));});
    reset();
    try { await refreshList(); }
    catch(error) { setStatus(error?.message||String(error),true); }

    if(new URLSearchParams(location.search).get('resume')==='preview') {
      const result=await window.sebEvalPro?.kaloneoConsumeMaskPreview?.();
      if(result&&result.ok===true&&result.definition) {
        applyDefinition(result.definition,'Retour de l’aperçu réel.');
      }
    }
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{ready();},{once:true});else ready();
})();
