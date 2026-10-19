'use strict';
// R141 — No external images, no candidate identities, all screenshots packaged.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..','..');
const get=p=>fs.readFileSync(path.join(root,p),'utf8');
const pages=[
  {path:'kaloneo/help/index.html',directory:'help',prefix:'B',ids:Array.from({length:12},(_,i)=>'B'+String(i+1).padStart(2,'0'))},
  {path:'kaloneo/admin-help/index.html',directory:'admin-help',prefix:'A',ids:['A01','A02','A03','A04','A06','A07']}
];
for(const page of pages){
 const html=get(page.path);
 assert(html.includes('id="help-image-dialog"'),'Image zoom dialog absent: '+page.path);
 assert(!/https?:\/\/[^" ]+\.(?:png|jpg|js|css)/i.test(html),'External dependency: '+page.path);
 for(const id of page.ids){
  const rel='captures/'+id+'.png';
  assert(html.includes('src="'+rel+'"'),'Capture missing from guide: '+rel);
  const full=path.join(root,'kaloneo',page.directory,rel);
  const png=fs.readFileSync(full);
  assert(png.length>1000&&png.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),'Invalid PNG '+full);
  assert(png.readUInt32BE(16)>=500&&png.readUInt32BE(20)>=250,'Unreadable screenshot '+full);
  const compiled=path.join(root,'seb-evalpro','app','web','kaloneo-builder',page.directory,rel);
  if(fs.existsSync(path.join(root,'seb-evalpro','app','web','kaloneo-builder','help','index.html')))
    assert(fs.existsSync(compiled),'PNG missing from Windows app: '+compiled);
 }
}
const admin=get('kaloneo/admin-help/index.html');
assert(!admin.includes('captures/A05.png'),'Incomplete Results/Bilan view not to be illustrated');
assert(!admin.includes('captures/A08.png'),'Non-anonymized candidate listing not to be packaged');
const builder=get('kaloneo/help/index.html');
assert(!builder.includes('schémas explicatifs'),'Old Builder guide text');
assert(!admin.includes('notamment par des captures'),'Old Admin guide text');
console.log('KALONEO_R141_HELP_GUIDES=OK — 12 Builder and 6 Admin PNG, accessible offline and included in installer.');
