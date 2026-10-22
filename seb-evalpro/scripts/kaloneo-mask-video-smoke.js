'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {createKaloneoLibrary}=require('../src/kaloneo-library-main');
const {createPlayer,FREEZE_MS,FADE_MS}=require('../src/kaloneo-mask-media');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'kaloneo-mask-video-'));
const sample=path.join(root,'seed');
fs.mkdirSync(sample,{recursive:true});
fs.writeFileSync(path.join(sample,'essai.mp4'),Buffer.from('synthetic-smoke-mp4'));
fs.writeFileSync(path.join(sample,'fin.png'),Buffer.from('synthetic-smoke-png'));
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function media() {
 return {
  hidden:true,style:{},src:'',complete:true,naturalWidth:64,alt:'',
  pause(){this.paused=true;},
  play(){this.paused=false;return Promise.resolve();},
  load(){},removeAttribute(name){if(name==='src')this.src='';}
 };
}
(async()=>{
 const raf=global.requestAnimationFrame;
 global.requestAnimationFrame=cb=>cb();
 try {
  assert.equal(FREEZE_MS,3000);
  assert.equal(FADE_MS,1000);
  const lib=createKaloneoLibrary({dataRoot:root,seedMaskMediaRoot:sample});
  const masks=lib.listMaskScreens();
  assert(masks.some(x=>x.id==='kaloneo-default'&&x.systemProvided));
  const item=masks.find(x=>x.id==='kaloneo-video-image');
  assert(item&&!item.systemProvided&&item.hasVideo&&item.hasImage,'Exemple vidéo/import non disponible.');
  const sampleMask=lib.getMaskScreen({id:item.id,version:item.version}).maskScreen;
  assert(sampleMask.content.video.startsWith('data:video/mp4;base64,'));
  assert(sampleMask.content.image.startsWith('data:image/png;base64,'));
  assert.equal(lib.saveMaskScreen({id:'erreur',version:'1.0.0',name:'Sans fin',
    content:{video:sampleMask.content.video,image:''}}).ok,false,'Image finale obligatoire.');
  const custom=lib.saveMaskScreen({id:'autre',version:'1.0.0',name:'Autre',
    content:{video:sampleMask.content.video,image:sampleMask.content.image,text:'Bonjour'}});
  assert(custom.ok,custom.error);
  assert.equal(lib.getMaskScreen({id:'autre',version:'1.0.0'}).maskScreen.content.video,sampleMask.content.video);
  const second=createKaloneoLibrary({dataRoot:root,seedMaskMediaRoot:sample});
  assert(second.listMaskScreens().some(x=>x.id==='autre'&&x.hasVideo));

  const stage={hidden:true}, video=media(),image=media(),text={hidden:true, textContent:''};
  const player=createPlayer({stage,video,image,text,freezeMs:90,fadeMs:45});
  const value={name:'Essai',content:{video:sampleMask.content.video,image:sampleMask.content.image,text:''}};
  player.show(value);
  assert(!video.hidden&&!stage.hidden&&image.style.opacity==='0');
  assert.equal(typeof video.onended,'function');
  video.onended();
  await sleep(35);
  player.show(value); // Les mises à jour du masque ne réinitialisent pas le compteur.
  assert(!video.hidden&&image.style.opacity==='0','Dernière frame préservée avant le délai.');
  await sleep(70);
  assert(!video.hidden&&image.style.opacity==='1','Fondu après le délai sur la dernière frame.');
  await sleep(135);
  assert(video.hidden,'Vidéo masquée uniquement après le fondu.');
  player.stop();
  assert(stage.hidden&&player.active===false);
  player.show(value);
  video.onended();
  player.stop();
  await sleep(110);
  assert(stage.hidden,'La fermeture doit annuler toute transition différée.');
  console.log('KALONEO_MASK_VIDEO=OK — fichiers embarqués, portabilité, 3000 ms / fondu 1000 ms, gestion des reprises');
 }finally{
  global.requestAnimationFrame=raf;
  fs.rmSync(root,{recursive:true,force:true});
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
