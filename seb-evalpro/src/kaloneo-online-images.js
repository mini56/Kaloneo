'use strict';
// Téléchargement optionnel des images du catalogue public KALONÉO.
// Aucune donnée candidat n'est transmise, seules les images choisies sont importées.
const https = require('https');
const crypto = require('crypto');

const CATALOGUE = 'https://raw.githubusercontent.com/mini56/Kaloneo-MAJ/main/bibliotheque-images/catalogue.json';
const BASE = 'https://raw.githubusercontent.com/mini56/Kaloneo-MAJ/main/bibliotheque-images/';
const MAX_CATALOGUE = 4 * 1024 * 1024;
const MAX_IMAGE = 10 * 1024 * 1024;
const MAX_PIXELS = 20_000_000;
const {nativeImage} = require('electron');
function safeImage(bytes, url) {
  const pathname=new URL(url).pathname.toLowerCase();
  let mime;
  if (pathname.endsWith('.png') && bytes.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex'))) mime='image/png';
  else if (/\.jpe?g$/.test(pathname) && bytes[0]===0xff && bytes[1]===0xd8 && bytes[2]===0xff) mime='image/jpeg';
  else if (pathname.endsWith('.webp') && bytes.toString('ascii',0,4)==='RIFF' && bytes.toString('ascii',8,12)==='WEBP') mime='image/webp';
  else throw new Error('Format réel invalide ou non autorisé (PNG, JPEG, WebP uniquement).');
  const picture=nativeImage.createFromBuffer(bytes);
  if (picture.isEmpty()) throw new Error('Image illisible ou invalide.');
  const {width,height}=picture.getSize();
  if (!width || !height || width>8192 || height>8192 || width*height>MAX_PIXELS) throw new Error('Dimensions d’image non autorisées.');
  const sanitized=picture.toPNG();
  if (!sanitized.length || sanitized.length>MAX_IMAGE*4) throw new Error('Image décodée trop volumineuse.');
  return {buffer:sanitized,mime:'image/png'};
}
function getBytes(url, maxBytes) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    if (target.protocol !== 'https:' || target.hostname !== 'raw.githubusercontent.com' ||
        !target.pathname.startsWith('/mini56/Kaloneo-MAJ/main/')) {
      reject(new Error('Adresse de téléchargement non autorisée.')); return;
    }
    const req = https.get(target, {timeout:15000, headers:{'User-Agent':'KALONEO-image-library','Accept':'application/octet-stream'}}, res => {
      if (res.statusCode !== 200) {
        res.resume(); reject(new Error('GitHub : réponse HTTP ' + res.statusCode)); return;
      }
      const parts=[]; let size=0;
      res.on('data', chunk => {
        size+=chunk.length;
        if (size>maxBytes) {req.destroy(new Error('Fichier trop volumineux.')); return;}
        parts.push(chunk);
      });
      res.on('end',()=>resolve(Buffer.concat(parts)));
      res.on('error',reject);
    });
    req.on('timeout',()=>req.destroy(new Error('Délai de connexion dépassé.')));
    req.on('error',reject);
  });
}
function validRecord(item) {
  return item && typeof item.id==='string' && /^[a-z0-9][a-z0-9-]{0,160}$/.test(item.id) &&
    typeof item.categorie==='string' && typeof item.sha256==='string' &&
    /^[a-f0-9]{64}$/.test(item.sha256) && Number.isSafeInteger(item.taille_octets) &&
    item.taille_octets>0 && item.taille_octets<=MAX_IMAGE &&
    typeof item.miniature==='string' && /^miniatures\/[a-z0-9-]+\.webp$/.test(item.miniature) &&
    typeof item.fichier==='string';
}
function originalUrl(item) {
  const raw=item.fichier;
  const url = /^https:\/\//i.test(raw) ? raw : new URL(raw, BASE).href;
  const parsed=new URL(url);
  if (parsed.hostname!=='raw.githubusercontent.com' ||
      !parsed.pathname.startsWith('/mini56/Kaloneo-MAJ/main/')) throw new Error('Image hors du dépôt autorisé.');
  if (!/\.(png|jpe?g|webp)$/i.test(parsed.pathname)) throw new Error('Format non autorisé.');
  return url;
}
async function listOnline() {
  const data=JSON.parse((await getBytes(CATALOGUE,MAX_CATALOGUE)).toString('utf8'));
  if (!data || !Array.isArray(data.images) || !Array.isArray(data.categories)) throw new Error('Catalogue incorrect.');
  const images=data.images.filter(validRecord).map(item=>({
    id:item.id, titre:String(item.titre||item.id).slice(0,200),
    categorie:item.categorie, miniature: new URL(item.miniature,BASE).href,
    taille_octets:item.taille_octets, sha256:item.sha256
  }));
  return {ok:true,categories:data.categories,images};
}
async function downloadSelected(ids, library) {
  if (!Array.isArray(ids) || ids.length>100 || ids.some(x=>typeof x!=='string')) throw new Error('Sélection non valide.');
  // Recharger le catalogue côté processus principal, ne jamais faire confiance aux URL de l'interface.
  const data=JSON.parse((await getBytes(CATALOGUE,MAX_CATALOGUE)).toString('utf8'));
  const index=new Map(data.images.filter(validRecord).map(item=>[item.id,item]));
  const results=[];
  for(const id of new Set(ids)){
    const item=index.get(id);
    if(!item){results.push({id,ok:false,error:'Image absente du catalogue.'});continue;}
    try {
      const bytes=await getBytes(originalUrl(item),MAX_IMAGE);
      if(bytes.length!==item.taille_octets || crypto.createHash('sha256').update(bytes).digest('hex')!==item.sha256)
        throw new Error('Intégrité de l’image incorrecte.');
      // Ne jamais conserver directement le fichier distant : décoder puis
      // réencoder en PNG afin d'éliminer les données annexes.
      const clean=safeImage(bytes,originalUrl(item));
      const saved=library.saveImage({name:String(item.titre||id).slice(0,170)+'.png',category:String(item.categorie||'Images en ligne'),
        mime:clean.mime,data:'data:'+clean.mime+';base64,'+clean.buffer.toString('base64')});
      results.push({id,ok:!!saved.ok,alreadyPresent:!!saved.duplicate,error:saved.error||null});
    } catch(error) {results.push({id,ok:false,error:error.message});}
  }
  return {ok:results.every(x=>x.ok),results};
}
module.exports={listOnline,downloadSelected};
