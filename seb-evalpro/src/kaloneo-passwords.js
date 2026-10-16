'use strict';
// Réglages locaux des accès administrateur/développeur : aucun mot de passe en clair.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ROLES = new Set(['admin','developer']);
const canonical = value => String(value || '').trim().toUpperCase();
const legacyDigest = value => crypto.createHash('sha256').update(canonical(value), 'utf8').digest('hex');
const safeEqual = (a,b) => {
  const left=Buffer.from(String(a),'hex'),right=Buffer.from(String(b),'hex');
  return left.length===right.length && crypto.timingSafeEqual(left,right);
};
function createPasswordStore(options) {
  const filename=path.join(options.directory,'kaloneo-access-settings.json');
  const defaults={admin:options.adminHash,developer:options.developerHash};
  function read() {
    if(!fs.existsSync(filename))return {schema:1,roles:{}};
    const state=JSON.parse(fs.readFileSync(filename,'utf8'));
    if(!state||state.schema!==1||!state.roles||typeof state.roles!=='object')throw new Error('Fichier des accès KALONÉO illisible.');
    return state;
  }
  function verify(role,password) {
    if(!ROLES.has(role))return false;
    const state=read();
    const stored=state.roles[role];
    if(stored) {
      if(stored.algorithm!=='scrypt' || !/^[0-9a-f]{32}$/.test(stored.salt||'') ||
          !/^[0-9a-f]{128}$/.test(stored.hash||''))throw new Error('Réglage du mot de passe KALONÉO invalide.');
      const derived=crypto.scryptSync(canonical(password),Buffer.from(stored.salt,'hex'),64).toString('hex');
      return safeEqual(derived,stored.hash);
    }
    return safeEqual(legacyDigest(password),defaults[role]);
  }
  function change(role,currentPassword,nextPassword) {
    if(!ROLES.has(role))return {ok:false,error:'Type d’accès inconnu.'};
    if(!verify(role,currentPassword))return {ok:false,error:'Mot de passe actuel incorrect.'};
    const next=canonical(nextPassword);
    if(next.length<8||next.length>128)return {ok:false,error:'Le nouveau mot de passe doit contenir entre 8 et 128 caractères.'};
    if(next===canonical(currentPassword))return {ok:false,error:'Choisissez un nouveau mot de passe différent.'};
    const state=read();
    const salt=crypto.randomBytes(16).toString('hex');
    state.roles[role]={algorithm:'scrypt',salt,hash:crypto.scryptSync(next,Buffer.from(salt,'hex'),64).toString('hex')};
    fs.mkdirSync(path.dirname(filename),{recursive:true});
    const tmp=filename+'.'+process.pid+'.tmp';
    try {
      fs.writeFileSync(tmp,JSON.stringify(state,null,2),{mode:0o600,flag:'wx'});
      fs.renameSync(tmp,filename);
    } catch(error) {
      try{fs.unlinkSync(tmp);}catch(_){}
      throw error;
    }
    return {ok:true};
  }
  return {verify,change};
}
module.exports={createPasswordStore};
