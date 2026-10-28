'use strict';
// Windows GUI integration: prove Electron's native ShellExecute actually opens a file.
const {app,shell}=require('electron');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {setTimeout:pause}=require('node:timers/promises');

async function main(){
  if(process.platform!=='win32')throw new Error('Test du lancement de mise à jour réservé à Windows');
  await app.whenReady();
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'kaloneo-setup-shell-'));
  const script=path.join(folder,'launch-proof.cmd');
  const marker=path.join(folder,'opened.txt');
  try{
    // This is an inert local command, NOT a real KALONÉO installer.
    // The test observes that Windows actually starts the opened file.
    fs.writeFileSync(script,'@echo off\r\necho launched > "'+marker+'"\r\n','utf8');
    const error=await shell.openPath(script);
    assert.equal(error,'','Native Windows shell must accept and start the file');
    let opened=false;
    for(let i=0;i<50;i++){
      if(fs.existsSync(marker)){opened=true;break;}
      await pause(100);
    }
    assert(opened,'ShellExecute returned but the target was not actually launched');
    assert(fs.readFileSync(marker,'utf8').includes('launched'));
    console.log('KALONEO_UPDATER_NATIVE_WINDOWS_SHELL=SUCCESS: actual launch verified on Windows; no hidden PowerShell');
  }finally{
    fs.rmSync(folder,{recursive:true,force:true});
    app.quit();
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;app.quit();});
