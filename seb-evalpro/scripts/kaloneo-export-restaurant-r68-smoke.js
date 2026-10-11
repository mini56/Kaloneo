'use strict';
// R68: verify that the installed application's web resources can be embedded
// in the exported Restaurant test, without touching any existing test JSON.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { embedTestImages } = require('../src/kaloneo-test-portability');

const appWebRoot = path.resolve(__dirname, '../app/web');
const imagePaths = [
  'imageqcm/r48-plateau-repas.png',
  'imageqcm/r48-cantine-cuisinieres.png'
];
const definition = {
  kaltestFormat:1, id:'planning_cantine_r48_demo',
  version:'3.0.0', title:'Planification — Le restaurant',
  scored:false, images:imagePaths
};
const { definition:portable, embeddedCount }=embedTestImages(definition, appWebRoot);
assert.equal(embeddedCount, imagePaths.length, 'Both restaurant images must be embedded.');
for (let i=0;i<imagePaths.length;i++) {
  const image=portable.images[i];
  assert.match(image, /^data:image\/png;base64,/, 'Image must be portable PNG data.');
  const decoded=Buffer.from(image.slice('data:image/png;base64,'.length), 'base64');
  assert.deepEqual(decoded, fs.readFileSync(path.join(appWebRoot, imagePaths[i])), 'Exported bytes must match packaged image.');
}
assert.deepEqual(definition.images, imagePaths, 'Source test must remain unchanged.');
const main=fs.readFileSync(path.join(__dirname, '../src/main.js'), 'utf8');
assert.ok(main.includes("embedTestImages(result.definition, path.resolve(__dirname, '../app/web'))"), 'Export IPC handler must read packaged app/web.');
const builder=fs.readFileSync(path.join(__dirname, '../build/kaloneo-v1-fixes-r68-builder.yml'), 'utf8');
assert.ok(builder.includes('  - app/**/*'), 'Setup must contain packaged app/web resources.');
console.log('R68: Restaurant v3 export — two bundled images verified; export handler reads app/web — OK.');
