'use strict';
// Mises à jour KALONÉO : réseau uniquement après clic Administrateur.
// Aucun candidat, identifiant ou document local n'est envoyé sur Internet.
const https=require('node:https');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {Transform}=require('node:stream');
const {pipeline}=require('node:stream/promises');

const RELEASES_API='https://api.github.com/repos/mini56/Kaloneo-MAJ/releases?per_page=30';
const TRUSTED_HOSTS=new Set(['github.com','release-assets.githubusercontent.com','objects.githubusercontent.com','github-releases.githubusercontent.com']);
const VERSION_RE=/^kaloneo-(\d+)\.(\d+)\.(\d+)$/;
const SHA_RE=/^sha256:([a-f0-9]{64})$/i;
const MAX_DOWNLOAD=1024*1024*1024;

function versionTuple(value){
  const match=String(value||'').replace(/^kaloneo-/i,'').match(/^(\d+)\.(\d+)\.(\d+)$/);
  return match?match.slice(1).map(Number):null;
}
function compareVersions(a,b){
  const x=versionTuple(a),y=versionTuple(b);
  if(!x||!y)throw new Error('Numéro de version KALONÉO non reconnu.');
  for(let i=0;i<3;i++)if(x[i]!==y[i])return x[i]>y[i]?1:-1;
  return 0;
}
function fetchReleases(){
  return new Promise((resolve,reject)=>{
    const request=https.get(RELEASES_API,{
      headers:{'User-Agent':'KALONEO-Windows-Update-Checker','Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},
      timeout:10000
    },response=>{
      if(response.statusCode!==200){response.resume();reject(new Error('GitHub ne répond pas (HTTP '+response.statusCode+').'));return;}
      let bytes=0;const chunks=[];
      response.on('data',chunk=>{
        bytes+=chunk.length;
        if(bytes>2*1024*1024){request.destroy(new Error('Réponse des mises à jour trop volumineuse.'));return;}
        chunks.push(chunk);
      });
      response.on('end',()=>{
        try{resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));}
        catch(_){reject(new Error('Réponse GitHub non valide.'));}
      });
      response.on('error',reject);
    });
    request.on('timeout',()=>request.destroy(new Error('Délai de connexion dépassé.')));
    request.on('error',reject);
  });
}
function findLatestRelease(releases){
  if(!Array.isArray(releases))throw new Error('Catalogue des mises à jour incorrect.');
  const valid=[];
  for(const release of releases){
    if(release.draft===true||!VERSION_RE.test(String(release.tag_name||'')))continue;
    const version=release.tag_name.slice('kaloneo-'.length);
    const filename='KALONEO-Setup-'+version+'.exe';
    const asset=(Array.isArray(release.assets)?release.assets:[]).find(a=>a.name===filename);
    const hash=String(asset?.digest||'').match(SHA_RE);
    const size=Number(asset?.size);
    if(!hash||!Number.isSafeInteger(size)||size<40*1024*1024||size>MAX_DOWNLOAD)continue;
    const url='https://github.com/mini56/Kaloneo-MAJ/releases/download/'+encodeURIComponent(release.tag_name)+'/'+encodeURIComponent(filename);
    const digest=hash[1].toLowerCase();
    valid.push({version,tag:release.tag_name,filename,url,size,sha256:digest,
      releaseUrl:'https://github.com/mini56/Kaloneo-MAJ/releases/tag/'+encodeURIComponent(release.tag_name)});
  }
  valid.sort((a,b)=>compareVersions(b.version,a.version));
  return valid[0]||null;
}
async function checkUpdates(currentVersion,options={}){
  const releases=await (options.fetchReleases||fetchReleases)();
  const latest=findLatestRelease(releases);
  const installed=versionTuple(currentVersion);
  if(!installed)throw new Error('Version installée inconnue.');
  if(!latest)return {ok:true,status:'no_release',installedVersion:currentVersion};
  return {ok:true,status:compareVersions(latest.version,currentVersion)>0?'available':'current',
    installedVersion:currentVersion,latest};
}
function validateDownload(update){
  if(!update||!VERSION_RE.test(String(update.tag||'')))throw new Error('Mise à jour non vérifiée.');
  const version=update.tag.substring('kaloneo-'.length);
  const filename='KALONEO-Setup-'+version+'.exe';
  if(update.filename!==filename||typeof update.sha256!=='string'||!/^[a-f0-9]{64}$/i.test(update.sha256))
    throw new Error('Intégrité de la mise à jour non vérifiable.');
  const exact='https://github.com/mini56/Kaloneo-MAJ/releases/download/'+encodeURIComponent(update.tag)+'/'+encodeURIComponent(filename);
  if(update.url!==exact)throw new Error('Adresse de téléchargement interdite.');
  if(!Number.isSafeInteger(update.size)||update.size<40*1024*1024||update.size>MAX_DOWNLOAD)
    throw new Error('Taille de fichier incorrecte.');
}
async function responseFor(url,redirects=0){
  if(redirects>5)throw new Error('Trop de redirections de téléchargement.');
  const address=new URL(url);
  if(address.protocol!=='https:'||!TRUSTED_HOSTS.has(address.hostname))
    throw new Error('Serveur de téléchargement non autorisé.');
  return new Promise((resolve,reject)=>{
    const req=https.get(address,{headers:{'User-Agent':'KALONEO-Windows-Update-Checker','Accept':'application/octet-stream'},timeout:25000},res=>{
      if([301,302,303,307,308].includes(res.statusCode)){
        const next=res.headers.location;
        res.resume();
        if(!next){reject(new Error('Redirection du téléchargement incorrecte.'));return;}
        responseFor(new URL(next,address).href,redirects+1).then(resolve,reject);
        return;
      }
      if(res.statusCode!==200){res.resume();reject(new Error('Téléchargement indisponible (HTTP '+res.statusCode+').'));return;}
      resolve(res);
    });
    req.on('timeout',()=>req.destroy(new Error('Le téléchargement ne répond plus.')));
    req.on('error',reject);
  });
}
async function downloadVerified(update,target,options={}){
  validateDownload(update);
  const destination=path.resolve(String(target||''));
  if(path.basename(destination)!==update.filename)
    throw new Error('Conservez le nom officiel du Setup pour la vérification.');
  const temp=destination+'.kaloneo-download';
  let total=0;const hash=crypto.createHash('sha256');
  try{
    const response=await (options.responseFor||responseFor)(update.url);
    const counter=new Transform({transform(chunk,encoding,callback){
      total+=chunk.length;
      if(total>MAX_DOWNLOAD||total>update.size){callback(new Error('Taille de téléchargement anormale.'));return;}
      hash.update(chunk);callback(null,chunk);
    }});
    await pipeline(response,counter,fs.createWriteStream(temp,{flags:'wx'}));
    const digest=hash.digest('hex').toLowerCase();
    if(total!==update.size||digest!==update.sha256.toLowerCase())
      throw new Error('Contrôle SHA256 échoué : le Setup reçu ne correspond pas à la Release.');
    await fs.promises.rename(temp,destination);
    return {ok:true,filePath:destination,sha256:digest,bytes:total};
  }catch(error){
    await fs.promises.rm(temp,{force:true}).catch(()=>{});
    throw error;
  }
}
module.exports={compareVersions,findLatestRelease,checkUpdates,validateDownload,downloadVerified};
