'use strict';
// Security regression checks (no network, fake Electron decoder).
const assert=require('node:assert/strict');
const fs=require('fs');
const vm=require('vm');
const crypto=require('crypto');
const source=fs.readFileSync(require('path').join(__dirname,'../src/kaloneo-online-images.js'),'utf8');
function harness(catalogue, fakeBytes){
 let calls=[], saved=[];
 const https={get(url,opts,onResponse){
  const {EventEmitter}=require('events');
  const request=new EventEmitter();request.destroy=e=>request.emit('error',e);
  request._timer=setImmediate(()=>{
   calls.push(String(url));
   const response=new EventEmitter();response.statusCode=200;response.resume=()=>{};
   onResponse(response);
   const data=String(url).endsWith('catalogue.json')?Buffer.from(JSON.stringify(catalogue)):fakeBytes;
   response.emit('data',data);response.emit('end');
  });
  return request;
 }};
 const clean=Buffer.from('89504e470d0a1a0a','hex');
 const mockElectron={nativeImage:{createFromBuffer(b){return {isEmpty:()=>false,getSize:()=>({width:10,height:10}),toPNG:()=>clean}}}};
 const context={module:{exports:{}},Buffer,URL,require(name){if(name==='https')return https;if(name==='crypto')return crypto;if(name==='electron')return mockElectron;throw Error(name)}};
 vm.runInNewContext(source,context,{filename:'kaloneo-online-images.js'});
 return {api:context.module.exports,calls,saved,library:{saveImage(x){saved.push(x);return {ok:true,duplicate:false}}}};
}
const hex='89504e470d0a1a0a';
const bytes=Buffer.concat([Buffer.from(hex,'hex'),Buffer.from('test')]);
const hash=crypto.createHash('sha256').update(bytes).digest('hex');
const item={id:'test-1',titre:'Essai',categorie:'divers',sha256:hash,taille_octets:bytes.length,miniature:'miniatures/test-1.webp',fichier:'https://raw.githubusercontent.com/mini56/Kaloneo-MAJ/main/essai.png'};
const cat={images:[item],categories:[{id:'divers',nom:'Divers'}]};
async function rejectWithoutSave(c,b=bytes){
 const h=harness(c,b);
 const out=await h.api.downloadSelected(['test-1'],h.library);
 assert.equal(h.saved.length,0);
 assert.equal(out.results[0].ok,false);
}
(async()=>{
 const h=harness(cat,bytes);
 const list=await h.api.listOnline();
 assert.equal(list.images.length,1);
 const ok=await h.api.downloadSelected(['test-1'],h.library);
 assert.equal(ok.results[0].ok,true);
 assert.equal(h.saved.length,1);
 assert.match(h.saved[0].data,/^data:image\/png;base64,/);
 await rejectWithoutSave({...cat,images:[{...item,sha256:'0'.repeat(64)}]});
 await rejectWithoutSave({...cat,images:[{...item,fichier:'https://evil.example/test.png'}]});
 await rejectWithoutSave({...cat,images:[{...item,taille_octets:1}]});
 await rejectWithoutSave(cat,Buffer.from('<script>alert(1)</script>'));
 await rejectWithoutSave({...cat,images:[{...item,fichier:'https://raw.githubusercontent.com/mini56/Kaloneo-MAJ/main/evil.svg'}]});
 console.log('PASS: catalogue, hash, hôte, taille, extension, signature et import PNG normalisé');
})().catch(e=>{console.error(e);process.exitCode=1});
