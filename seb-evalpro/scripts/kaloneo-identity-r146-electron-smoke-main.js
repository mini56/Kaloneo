'use strict';
const {app,BrowserWindow}=require('electron');
const path=require('path');
const root=path.resolve(__dirname,'..');
const page=path.join(root,'app','web','kaltest-pilot2.html');
const timeout=setTimeout(()=>{console.error('R146_IDENTITE_ELECTRON_TIMEOUT');process.exit(2)},70000);
app.commandLine.appendSwitch('disable-gpu');
app.whenReady().then(async()=>{
 try {
   for (const [width,height] of [[1366,768],[1200,800],[1024,768]]) {
     const win=new BrowserWindow({width,height,show:false,webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true}});
     try {
       win.webContents.on('console-message',(_event,...args)=>{
         const message=typeof args[0]==='object' ? args[0]?.message : args[1];
         if(message)console.log('R146_PAGE_CONSOLE '+String(message).slice(0,300));
       });
       win.webContents.on('did-fail-load',(_event,code,description)=>console.log('R146_LOAD_ERROR '+code+' '+description));
       await win.loadFile(page);
       await new Promise(resolve=>setTimeout(resolve,400));
       const result=await win.webContents.executeJavaScript(`(()=>{
         const grid=document.querySelector('#page-identification .pilot2-form-grid');
         const cols=[...grid.children];
         const rows=cols.map(c=>[...c.children].map(x=>x.getBoundingClientRect()));
         const radios=[...document.querySelectorAll('input[name="civilite"]')];
         const rect=grid.getBoundingClientRect();
         return {
           columns:cols.length,
           rows:rows.map(r=>r.length),
           firstAligned:Math.abs(rows[0][0].top-rows[1][0].top)<3,
           within:grid.scrollWidth<=grid.clientWidth+2,
           radios:radios.length,
           horizontal:radios.every(r=>Math.abs(r.getBoundingClientRect().top-radios[0].getBoundingClientRect().top)<3),
           born:Boolean(document.getElementById('naissance')),
           bottom:document.querySelector('.pilot2-identification-actions').getBoundingClientRect().bottom,
           height:window.innerHeight,
           usable:rect.width>500
         };
       })()`,true);
       if (result.columns!==2||result.rows.join(',')!=='4,4'||!result.firstAligned||!result.within||
           result.radios!==3||!result.horizontal||result.born||result.bottom>height+5||!result.usable) {
         throw Error('Identité 2x4 invalide en '+width+'x'+height+': '+JSON.stringify(result));
       }
       if(width===1366){
         const data=await win.webContents.executeJavaScript(`(()=>{
           document.querySelector('input[name="civilite"][value="Autre"]').checked=true;
           document.getElementById('nom').value='DUPONT';
           document.getElementById('prenom').value='Emma';
           document.getElementById('personIdentifier').value='ABC1234';
           document.getElementById('groupe').value='G1';
           document.getElementById('lieu').value='Lorient';
           document.getElementById('dateEvaluation').value='2026-10-22';
           document.getElementById('identity-next').click();
           const candidate=JSON.parse(sessionStorage.getItem('candidat_data')||'{}');
           return {civilite:candidate.civilite,hasBirth:Object.hasOwn(candidate,'naissance'),phase:document.querySelector('#page-intro')?.classList.contains('visible'),status:document.getElementById('identity-status')?.textContent,disabled:document.getElementById('identity-next')?.disabled,globalReady:Boolean(window.sebKaltestPilot2),radio:document.querySelector('input[name="civilite"]:checked')?.value,formValues:['nom','prenom','personIdentifier','groupe','lieu','dateEvaluation'].map(k=>[k,document.getElementById(k)?.value])};
         })()`,true);
         if(data.civilite!=='Autre'||data.hasBirth||!data.phase)throw Error('Civilité non sauvegardée dans le parcours: '+JSON.stringify(data));
       }
       console.log('R146_IDENTITE_ELECTRON=OK '+width+'x'+height);
     }finally{win.destroy()}
   }
   clearTimeout(timeout);app.quit();
 } catch(e) {console.error('R146_IDENTITE_ELECTRON_FAILURE '+(e?.stack||e));process.exit(2)}
}).catch(e=>{console.error(e);process.exit(2)});
