'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const main=fs.readFileSync(path.join(__dirname,'../src/main.js'),'utf8');
const preload=fs.readFileSync(path.join(__dirname,'../src/preload.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'../../kaloneo/test-builder.html'),'utf8');
const builder=fs.readFileSync(path.join(__dirname,'../../kaloneo/test-builder.js'),'utf8');
const match=main.match(/function adaptiveZoomForDimensions\(width,height\) \{[\s\S]*?\n\}/);
assert(match,'Shared candidate zoom formula missing');
// Pure geometry test, never starts the application.
const zoom=new Function('DESIGN_WIDTH','DESIGN_HEIGHT','MIN_ZOOM_FACTOR',
  match[0]+'\nreturn adaptiveZoomForDimensions;')(1600,900,0.60);
for(const [w,h,expected] of [
 [1920,1080,1],[1600,900,1],[1366,768,0.85],
 [1280,720,0.8],[1200,800,0.75],[1024,768,0.64]
])assert.equal(zoom(w,h),expected,w+' × '+h);
for(const preset of ['1200x800','1280x720','1366x768','1600x900','1920x1080']){
 assert(html.includes('value="'+preset+'"'),preset);
 assert(main.includes("'"+preset+"':["),preset);
}
assert(html.includes('value="reference"'));
assert(builder.includes("?.value||'reference'"));
assert(builder.includes('const imageFit=Math.min(1366/imageWidth,768/imageHeight)'));
assert(preload.includes("definition, viewportMode='reference'"));
assert(main.includes('const workerZoom=factor*candidateZoom'));
assert(main.includes('const cssWidth=previewWidth/candidateZoom'));
assert(main.includes('screenScale=${candidateZoom}'));
assert(main.includes('imageWidth:${previewWidth}'));
console.log('KALONEO_PREVIEW_RESOLUTION_R142=OK : shared zoom unchanged, dimensions whitelist, legacy preview default');
