'use strict';
// Electron peut sortir avec 0 lors de la fermeture de sa dernière fenêtre.
// Une exécution ne vaut succès qu'après le marqueur final des assertions.
const {spawnSync}=require('node:child_process');
const [script,marker]=process.argv.slice(2);
if(!script||!marker)throw new Error('Script et marqueur final requis.');
const result=spawnSync(require('electron'),['--no-sandbox',script],{encoding:'utf8',timeout:90000,maxBuffer:8*1024*1024});
process.stdout.write(result.stdout||'');process.stderr.write(result.stderr||'');
if(result.error||result.status!==0||!(result.stdout||'').includes(marker)){
 console.error('BILAN_ELECTRON_INCOMPLETE',result.error?.message||result.status,'marqueur attendu :',marker);
 process.exit(2);
}
