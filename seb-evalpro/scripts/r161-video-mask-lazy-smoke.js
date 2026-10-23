'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createKaloneoLibrary}=require('../src/kaloneo-library-main');
const app=path.resolve(__dirname,'..');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'kaloneo-r161-media-'));
try{
  const seedMedia=path.join(temp,'mask-media');
  fs.mkdirSync(seedMedia,{recursive:true});
  fs.writeFileSync(path.join(seedMedia,'welcome.mp4'),Buffer.from('mock-video-data'));
  fs.writeFileSync(path.join(seedMedia,'ending.png'),Buffer.from('mock-image-data'));
  const lib=createKaloneoLibrary({
    dataRoot:path.join(temp,'profile'),
    seedTestsRoot:path.join(app,'source','kaltest','tests'),
    seedMaskMediaRoot:seedMedia
  });
  const defaultRef={id:'kaloneo-default',version:'1.0.0'};
  assert.equal(lib.getMaskScreen(defaultRef).ok,true,'Default mask initialization fails');
  let videoJsonReads=0;
  const readFile=fs.readFileSync;
  fs.readFileSync=function(file,...args){
    if(String(file||'').includes('kaloneo-video-image')) videoJsonReads++;
    return readFile.call(this,file,...args);
  };
  try{
    for(let i=0;i<3;i++){
      assert.equal(lib.getMaskScreen(defaultRef).ok,true);
      assert.equal(lib.getSelectedParcours().ok,true);
    }
    assert.equal(videoJsonReads,0,'Default mask must not read embedded video mask JSON');
    const video=lib.getMaskScreen({id:'kaloneo-video-image',version:'1.0.0'});
    assert.equal(video.ok,true,'Real video mask must still be available');
    assert.match(video.maskScreen.content.video,/^data:video\/mp4;base64,/);
    assert.match(video.maskScreen.content.image,/^data:image\/png;base64,/);
    assert(videoJsonReads>0,'Explicit video request must load the video');
  }finally{
    fs.readFileSync=readFile;
  }
  const preload=fs.readFileSync(path.join(app,'src','preload.js'),'utf8');
  assert(preload.includes('if (!privacyMaskLoaded) void loadPrivacyMask();'),
    'Privacy overlay must lazy-load media only on demand');
  const start=preload.indexOf('function startPrivacy(){');
  assert(start>=0);
  assert(!preload.slice(start,start+230).includes('    loadPrivacyMask();'),
    'Admin page initialization must not load video masking media');
  console.log('KALONEO_R161_VIDEO_MASK_LAZY=OK — Admin/default masking avoids embedded video, explicit media remains functional');
}finally{
  fs.rmSync(temp,{recursive:true,force:true});
}
