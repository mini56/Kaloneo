'use strict';
const {app,BrowserWindow}=require('electron'),assert=require('node:assert/strict'),path=require('node:path');
const page=path.resolve(__dirname,'../app/web/admin-kaloneo-transfer.html');
const timeout=setTimeout(()=>{console.error('R175_IMPORT_EXPORT_TIMEOUT');app.exit(2)},45000);
const fail=e=>{console.error('R175_IMPORT_EXPORT_FAIL',e?.stack||String(e));app.exit(2)};
app.whenReady().then(async()=>{
 let win;
 try{
  win=new BrowserWindow({show:false,width:1366,height:768,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:false}});
  for(const [w,h] of [[1366,768],[1200,800]]){
   win.setSize(w,h);await win.loadFile(page);
   const obs=await win.webContents.executeJavaScript(`(()=>{
    const c=[...document.querySelectorAll('.grid > .card')];
    const y=id=>document.getElementById(id).getBoundingClientRect().top;
    const im=c[2],buttons=[...im.querySelectorAll('.actions button')];
    return {titles:c.map(x=>x.querySelector('h2').textContent.trim()),
      imageLabel:im.querySelector('label')?.textContent.trim(),
      unwantedNote:im.textContent.includes('Export ZIP par thèmes, sans les images déjà fournies'),
      desc:im.querySelector('p')?.textContent.trim(),
      buttons:buttons.map(x=>x.textContent.trim()),
      test:[y('test-select'),y('export-test'),y('import-test')],
      parcours:[y('parcours-select'),y('export-parcours'),y('import-parcours')],
      image:buttons.map(x=>x.getBoundingClientRect().top),
      bottoms:c.map(x=>x.getBoundingClientRect().bottom),
      statusBottoms:c.map(x=>x.querySelector('.status').getBoundingClientRect().bottom),
      spacerPresent:!!im.querySelector('.image-export-placeholder'),
      testSelect:!!document.getElementById('test-select'),parcoursSelect:!!document.getElementById('parcours-select'),
      overflow:document.documentElement.scrollWidth>window.innerWidth+3};})()`,true);
   assert.deepEqual(obs.titles,['Tests','Parcours','Images']);
   assert.equal(obs.imageLabel,'Export ZIP');assert(!obs.unwantedNote);
   assert(obs.desc.startsWith('Transférer vos images personnelles'));
   assert.deepEqual(obs.buttons,['Exporter des images','Importer des images','Importer un ZIP par thèmes']);
   assert(obs.testSelect&&obs.parcoursSelect);assert.equal(obs.spacerPresent,false,'Ancienne zone vide persistante');
   // Comparer les TROIS boutons Images avec les TROIS lignes de commandes
   // des cartes voisines (liste déroulante, Exporter, Importer).
   for(let j=0;j<3;j++){assert(Math.abs(obs.test[j]-obs.parcours[j])<4,'Tests/Parcours '+JSON.stringify(obs));
    assert(Math.abs(obs.image[j]-obs.parcours[j])<4,'Images décalées sur la ligne '+j+' '+JSON.stringify(obs));}
   assert(obs.image[0]<obs.parcours[1],'Le premier bouton Images est encore trop bas');
   assert(obs.image[2]>obs.image[1]);assert(Math.max(...obs.bottoms)-Math.min(...obs.bottoms)<3);
   assert(Math.max(...obs.statusBottoms)-Math.min(...obs.statusBottoms)<3);
   assert(!obs.overflow,'Débordement '+JSON.stringify(obs));
   console.log('R175_IMPORT_EXPORT_'+w+'x'+h+'=SUCCESS',JSON.stringify(obs));
  }
  clearTimeout(timeout);win.destroy();app.quit();
 }catch(e){fail(e)}
}).catch(fail);
