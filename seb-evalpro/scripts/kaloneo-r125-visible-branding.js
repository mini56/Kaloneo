'use strict';
// Brand only the GENERATED HTML, never canonical V1 source tests or internal keys.
// Do NOT rename filenames, APIs, storage paths, or IDs used by old candidate data.
const fs=require('node:fs');
const path=require('node:path');
const OLD=/(?:SEB[\s-]*[eé]val[\s-]*PRO|Sauvegarde[\s-]*56)/gi;
function textBrand(x){return String(x).replace(OLD,'KALONÉO');}
function transform(html){
  let out=html;
  // Legacy on-screen logo assets: the original artwork is retained in the
  // repository for potential future "À propos", but no longer shown.
  out=out.replace(/(?:imageqcm\/seb-evalpro-privacy-screen\.jpg|sauvegarde56-logo\.svg)/gi,
    'assets/kaloneo-logo-app.png');
  // The original V1 entry screen embeds the old institution's vector logo
  // directly in its HTML. Replace ONLY the generated copy, never the V1 source.
  out=out.replace(/<svg\b(?=[^>]*\bid=["']Calque_1["'])[^>]*>[\s\S]*?<\/svg>/gi,
    '<img class="icon-svg" src="assets/kaloneo-logo-app.png" '+
    'alt="KALONÉO — Au cœur d’un nouvel élan." '+
    'style="width:165px;height:104px;object-fit:contain">');
  // HTML text nodes. Script code and identifiers stay intact; source HTML
  // contains no inline JavaScript (enforced by prepare:web guard).
  out=out.replace(/>([^<>]*)</g,(full,visible)=>'>'+textBrand(visible)+'<');
  // Only user-facing accessibility attributes, not src, class, id, data-*.
  out=out.replace(/\b(alt|title|aria-label|placeholder)=(["'])(.*?)\2/gi,
    (_,name,quote,label)=>name+'='+quote+textBrand(label)+quote);
  return out;
}
function brandGeneratedWeb(dir){
 let count=0;
 function walk(current){
   for(const entry of fs.readdirSync(current,{withFileTypes:true})){
     const name=path.join(current,entry.name);
     if(entry.isDirectory())walk(name);
     else if(/\.html?$/i.test(entry.name)){
       const old=fs.readFileSync(name,'utf8');
       const next=transform(old);
       if(next!==old){fs.writeFileSync(name,next,'utf8');count++;}
     }
   }
 }
 walk(dir);
 return count;
}
if(require.main===module){
 const dir=process.argv[2]||path.join(__dirname,'../app/web');
 console.log('KALONEO_R125_HTML_BRANDING='+brandGeneratedWeb(dir));
}
module.exports={transform,brandGeneratedWeb};
