'use strict';
// Vérification réelle des alignements : ligne de libellés, menus, et trois commandes.
const {app,BrowserWindow}=require('electron');
const assert=require('node:assert/strict');
const path=require('node:path');
const page=path.resolve(__dirname,'../app/web/admin-kaloneo-transfer.html');
const timer=setTimeout(()=>{console.error('KALONEO_EXPORT_ALIGNMENT=TIMEOUT');app.exit(2)},60000);
const fail=e=>{console.error('KALONEO_EXPORT_ALIGNMENT=FAIL',e?.stack||String(e));app.exit(2)};
app.whenReady().then(async()=>{
 let win;
 try {
  win=new BrowserWindow({show:false,width:1649,height:928,
   webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:false}});
  for(const [width,height] of [[1649,928],[1366,768],[1200,800],[1024,768]]){
   win.setSize(width,height);
   await win.loadFile(page);
   const got=await win.webContents.executeJavaScript(`(()=>{
     const cards=[...document.querySelectorAll('.grid>.card')];
     const names=cards.map(c=>c.querySelector('h2')?.textContent.trim());
     const rect=el=>{const r=el.getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:r.height,left:r.left}};
     const ids=[['test-select','export-test','import-test'],
                ['parcours-select','export-parcours','import-parcours'],
                ['export-images','import-images','import-image-zip']];
     return {names,labels:cards.map(c=>rect(c.querySelector('.field-label'))),
       buttons:ids.map(row=>row.map(id=>rect(document.getElementById(id)))),
       texts:['export-images','import-images','import-image-zip'].map(id=>document.getElementById(id).textContent.trim()),
       statuses:cards.map(c=>rect(c.querySelector('.status'))),
       cards:cards.map(rect),
       columns:getComputedStyle(document.querySelector('.grid')).gridTemplateColumns,
       leftoverPlaceholder:!!cards[2].querySelector('.image-export-placeholder'),
       description:cards[2].querySelector('p').textContent.trim(),
       labelText:cards[2].querySelector('.field-label').textContent.trim(),
       overflow:document.documentElement.scrollWidth>window.innerWidth+3};})()`,true);
   assert.deepEqual(got.names,['Tests','Parcours','Images']);
   assert.deepEqual(got.texts,['Exporter des images','Importer des images','Importer un ZIP par thèmes']);
   assert.equal(got.labelText,'Export ZIP');
   assert(got.description.startsWith('Transférer vos images personnelles'));
   assert(!got.leftoverPlaceholder,'Un faux espace vide subsiste');
   assert(!got.overflow,'Débordement horizontal en '+width+': '+JSON.stringify(got));
   // Comparer les niveaux, pas seulement la présence ou l'ordre des commandes.
   const tolerance=0.7;
   for(const [index,row] of got.buttons.entries()){
    for(let j=0;j<3;j++){
      assert(Math.abs(row[j].height-42)<tolerance,'Commande non haute de 42px');
      if(width>1050){
        assert(Math.abs(got.labels[index].top-got.labels[0].top)<tolerance,'Libellés désalignés');
        assert(Math.abs(row[j].top-got.buttons[0][j].top)<tolerance,
          'DÉCALAGE VISUEL ligne '+(j+1)+' en '+width+'px : '+JSON.stringify(got));
        assert(Math.abs(row[j].bottom-got.buttons[0][j].bottom)<tolerance,
          'Bas de commande non aligné en '+width+'px : '+JSON.stringify(got));
      }else{
        assert(row[j].top>got.labels[index].top,'Commandes de la carte empilée avant le libellé');
      }
    }
   }
   if(width>1050){
    assert(Math.max(...got.cards.map(c=>c.bottom))-Math.min(...got.cards.map(c=>c.bottom))<tolerance,
      'Les trois cartes doivent avoir la même hauteur');
    assert(Math.max(...got.statuses.map(c=>c.top))-Math.min(...got.statuses.map(c=>c.top))<tolerance,
      'Les statuts doivent rester sur la même ligne');
   }
   console.log('KALONEO_EXPORT_ALL_THREE_ROWS_'+width+'x'+height+'=SUCCESS');
  }
  clearTimeout(timer);win.destroy();app.quit();
 }catch(e){fail(e)}
}).catch(fail);
