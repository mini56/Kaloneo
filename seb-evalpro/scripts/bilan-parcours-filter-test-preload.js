'use strict';
require('../src/preload');
const {contextBridge}=require('electron');
// Test uniquement : ouvrir l'éditeur de production avec une archive fournie.
contextBridge.exposeInMainWorld('bilanFilterTest',{
 open:(archive)=>require('../src/bilan-history-preload').openEditor('test.json',archive)
});
