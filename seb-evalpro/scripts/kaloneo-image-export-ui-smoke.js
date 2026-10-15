'use strict';
// Vérifie la continuité UI -> preload -> IPC -> bibliothèque : aucun bouton factice.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const page=read('overrides/admin-kaloneo-transfer.html');
const ui=read('source/js/admin-kaloneo-transfer.js');
const preload=read('src/preload.js');
const main=read('src/main.js');
const lib=read('src/kaloneo-library-main.js');
const zip=read('src/kaloneo-image-export.js');

for(const id of ['export-images','import-images','import-image-zip'])
  assert.match(page,new RegExp('id="'+id+'"'),'Bouton manquant : '+id);
assert.match(page,/<button id="export-images" class="primary"/);
assert.match(ui,/byId\('export-images'\)\.addEventListener\('click'/);
assert.match(ui,/kaloneoExportImageZip\?\.\(\)/);
assert.match(preload,/kaloneoExportImageZip: \(\) => ipcRenderer\.invoke\('kaloneo-library:export-image-zip'\)/);
assert.match(main,/ipcMain\.handle\('kaloneo-library:export-image-zip'/);
assert.match(main,/getCandidateStore\(\)\.getActiveCandidate\(\)/);
assert.match(main,/showSaveDialog\(mainWindow/);
assert.match(lib,/function exportImageZip\(zipFile\)/);
assert.match(lib,/record\.value\.systemProvided!==true/);
assert.match(zip,/writeUInt32LE\(0x06054b50,0\)/);
assert.match(zip,/crc32\(payload\)/);
assert.match(ui,/kaloneoImportImageZip\?\.\(\)/);
console.log('KALONEO_TRANSFER_IMAGES_UI=OK — Export ZIP effectif et import ZIP existant raccordés.');
