'use strict';
// R169 — auditing real NSIS BMP frames and ensuring NO blank rendering gaps.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const nsis=fs.readFileSync(path.join(root,'build','installer.nsh'),'utf8');
const config=fs.readFileSync(path.join(root,'build','pilot-resources','intro-frames','intro-meta.nsh'),'utf8');
const dir=path.join(root,'build','pilot-resources','intro-frames');
const count=Number(config.match(/KALONEO_INTRO_FRAME_COUNT (\d+)/)?.[1]);
const delay=Number(config.match(/KALONEO_INTRO_FRAME_MS (\d+)/)?.[1]);
assert(count>=45&&count<=100,'FPS 12 source should have about 49 BMP images');
assert(delay>=80&&delay<=88,'Frame period should be ~83ms, not the old 125ms');
assert(nsis.includes('Var SebBrandingWelcomeImageBack'),'Second bitmap control missing');
assert(nsis.includes('Function SebIntroSwapBitmap'),'Double buffered swap missing');
assert(nsis.includes('ShowWindow $SebIntroTargetImage 1'),'New image must become visible first');
assert(nsis.includes('ShowWindow $SebIntroOldImage 0'),'Previous image must be hidden only after new image');
assert(nsis.indexOf('ShowWindow $SebIntroTargetImage 1')<nsis.indexOf('ShowWindow $SebIntroOldImage 0'),
 'A blank white interval must NEVER appear between frames');
assert(nsis.includes('user32::UpdateWindow(p $SebIntroTargetImage)'),'Draw next frame before hiding old');
assert(nsis.includes('user32::SetWindowPos(p $SebIntroBuildLabel'),'Build label must remain in front');
assert(nsis.includes('EnableWindow $SebIntroNextButton 1'),'Next button must unlock after animation');
let maxWhite=0;
for(let frame=1;frame<=count;frame++){
 const b=fs.readFileSync(path.join(dir,'frame_'+frame+'.bmp'));
 assert.equal(b.toString('ascii',0,2),'BM');
 const width=b.readInt32LE(18),height=Math.abs(b.readInt32LE(22));
 assert.equal(width,450);
 assert.equal(height,228);
 assert.equal(b.readUInt16LE(28),24);
 const start=b.readUInt32LE(10),rowBytes=(width*3+3)&~3;
 let white=0,samples=0;
 for(let y=0;y<height;y+=5)for(let x=0;x<width;x+=5){
   const i=start+y*rowBytes+x*3;
   if(b[i]>=245&&b[i+1]>=245&&b[i+2]>=245)white++;
   samples++;
 }
 const ratio=white/samples;
 maxWhite=Math.max(maxWhite,ratio);
 assert(ratio<.9,'Blank white frame detected at '+frame+': '+ratio);
}
console.log('KALONEO_R169_INSTALLER_ANIMATION=OK; fps='+Math.round(1000/delay)+
 '; frames='+count+'; whiteMax='+(maxWhite*100).toFixed(1)+'%; double buffered; Next remains usable');
