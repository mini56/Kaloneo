'use strict';
const {app,BrowserWindow}=require('electron');
const path=require('node:path'),assert=require('node:assert/strict');
const file=path.resolve(__dirname,'..','app','web','kaloneo-builder','test-builder.html');
const timeout=setTimeout(()=>{console.error('R152_BUILDER_TIMEOUT');app.exit(2)},65000);
app.commandLine.appendSwitch('disable-gpu');
app.on('window-all-closed',()=>{});
app.whenReady().then(async()=>{
 let win;
 try{
  for(const [width,height] of [[1366,768],[1200,800]]){
   win=new BrowserWindow({show:true,width,height,webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true}});
   await win.loadFile(file);
   win.show();
   await new Promise(resolve=>setTimeout(resolve,750));
   const result=await win.webContents.executeJavaScript(`(()=>{
     const category=document.getElementById('test-category');
     const line=document.getElementById('bilan-simple-line');
     const scored=document.getElementById('test-scored');
     const validate=(cat)=>{
       category.value=cat;
       category.dispatchEvent(new Event('change',{bubbles:true}));
       const options=[...line.options].filter(o=>o.value).map(o=>o.value);
       if(options.length) {
         line.value=options[0];
         line.dispatchEvent(new Event('change',{bubbles:true}));
       }
       return {cat,options,current:line.value,scored:scored.value,
         help:document.getElementById('bilan-simple-help').textContent.trim()};
     };
     return {linePresent:Boolean(line),math:validate('mathematiques'),
       french:validate('francais'),practice:validate('activite_pratique'),
       categoryValues:[...category.options].map(o=>o.value),
       advancedOutputButtonVisible:getComputedStyle(document.getElementById('add-output')).display!=='none',
       advancedLinkButtonVisible:getComputedStyle(document.getElementById('add-bilan-contribution')).display!=='none'};
   })()`,true);
   assert(result.linePresent,'La liaison institutionnelle simple manque.');
   assert(result.math.options.length===2&&result.math.options.every(x=>x.includes('mathematiques')));
   assert(result.french.options.length===1&&result.french.options[0].includes('expression_ecrite'));
   assert(result.practice.options.length===5&&result.practice.scored==='false');
   assert(!result.advancedOutputButtonVisible&&!result.advancedLinkButtonVisible);
   assert(result.practice.help.includes('administrateur'));
   console.log('R152_BUILDER_UI=OK '+width+'x'+height);
   win.destroy();win=null;
  }
  clearTimeout(timeout);app.quit();
 }catch(error){console.error('R152_BUILDER_UI=FAIL '+(error.stack||error));try{win?.destroy()}catch{}app.exit(2)}
}).catch(e=>{console.error(e);app.exit(2)});
