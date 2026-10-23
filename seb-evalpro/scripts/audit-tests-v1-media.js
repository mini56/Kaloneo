'use strict';
// Diagnostic sans modification des V1. Mesure les médias encodés et les doublons.
// Exécution: node seb-evalpro/scripts/audit-tests-v1-media.js
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const repo=path.resolve(__dirname,'..','..');
const names=['affiche_promotions_prix','calcul_arithmetique','organisation_demenagement','p','planning_cantine'];
const seen=new Map(),reports=[];
const toMb=n=>Math.round(n/10000)/100;
function walk(value,address,fn){
  if(typeof value==='string')return fn(value,address);
  if(Array.isArray(value))return value.forEach((v,i)=>walk(v,address+'['+i+']',fn));
  if(value&&typeof value==='object')for(const [k,v] of Object.entries(value))walk(v,address+'.'+k,fn);
}
function dimensions(buf,mime){
  if(mime==='image/png'&&buf.length>=24&&buf.subarray(1,4).toString()==='PNG')return buf.readUInt32BE(16)+'x'+buf.readUInt32BE(20);
  if(mime==='image/gif'&&buf.length>=10)return buf.readUInt16LE(6)+'x'+buf.readUInt16LE(8);
  if(mime==='image/webp'&&buf.length>=30&&buf.toString('ascii',12,16)==='VP8X')return (1+buf.readUIntLE(24,3))+'x'+(1+buf.readUIntLE(27,3));
  return '?';
}
for(const name of names){
  const file=path.join(repo,'TESTS_V1',name+'-1.0.0-test.json');
  if(!fs.existsSync(file))throw new Error('Source GitHub manquante : '+name);
  const text=fs.readFileSync(file,'utf8'),definition=JSON.parse(text);
  if(definition.id!==name||definition.version!=='1.0.0')throw new Error('Identifiant/version incohérents: '+name);
  const media=[];
  walk(definition,'$',(value,location)=>{
    if(!/data:(?:image|video|audio)\//i.test(value))return;
    const matches=[...value.matchAll(/data:((?:image|video|audio)\/[a-z0-9+.-]+)(?:;charset=[a-z0-9-]+)?;base64,([a-z0-9+\/=\s]+)/gi)];
    if(!matches.length)throw new Error('URI média non reconnue : '+name+': '+location);
    for(const match of matches){
      const bytes=Buffer.from(match[2].replace(/\s/g,''),'base64');
      const hash=crypto.createHash('sha256').update(bytes).digest('hex');
      const one={location,mime:match[1],size:bytes.length,encodedChars:match[0].length,hash:hash.slice(0,16),
        dimensions:dimensions(bytes,match[1]),standalone:value.trim()===match[0].trim(),
        reused:seen.has(hash)};
      media.push(one);
      if(!seen.has(hash))seen.set(hash,{mime:one.mime,bytes:bytes.length,first:name+':'+location});
    }
  });
  reports.push({id:name,title:definition.title,sourceBytes:Buffer.byteLength(text),jsonMb:toMb(Buffer.byteLength(text)),
    questions:Array.isArray(definition.questions)?definition.questions.length:0,
    mediaCount:media.length,embeddedMb:toMb(media.reduce((n,x)=>n+x.encodedChars,0)),
    rawMediaMb:toMb(media.reduce((n,x)=>n+x.size,0)),media});
}
const totalJson=reports.reduce((n,x)=>n+x.sourceBytes,0);
const uniqueBinary=[...seen.values()].reduce((n,x)=>n+x.bytes,0);
const totalOccurrences=reports.reduce((n,x)=>n+x.mediaCount,0);
const standalone=reports.flatMap(x=>x.media).filter(x=>x.standalone).length;
console.log('TESTS_V1_MEDIA_AUDIT_BEGIN');
for(const test of reports)console.log(JSON.stringify(test));
console.log('TESTS_V1_MEDIA_SUMMARY='+JSON.stringify({
  count:reports.length,totalJsonBytes:totalJson,totalJsonMb:toMb(totalJson),
  totalMediaOccurrences:totalOccurrences,standaloneOccurrences:standalone,
  uniqueImages:seen.size,uniqueBinaryBytes:uniqueBinary,uniqueBinaryMb:toMb(uniqueBinary),
  theoreticalRawReductionMb:toMb(totalJson-uniqueBinary),
  duplicateOccurrences:totalOccurrences-seen.size
}));
console.log('TESTS_V1_MEDIA_AUDIT_END');
