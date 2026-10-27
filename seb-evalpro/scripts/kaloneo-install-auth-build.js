'use strict';
// Build-time secret -> only salted SHA-256 DWORDs in NSIS. Never persist the plaintext.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const password=String(process.env.KALONEO_INSTALL_PASSWORD||'');
if(password.length<12||password.length>120||/[\u0000-\u001f]/.test(password)){
  console.error('KALONEO_INSTALL_AUTH=ERROR : GitHub Actions secret KALONEO_INSTALL_PASSWORD absent ou invalide (12 à 120 caractères).');
  process.exit(2);
}
const salt=crypto.randomBytes(16).toString('hex');
const digest=crypto.createHash('sha256').update(Buffer.from(salt+password,'utf16le')).digest();
const items=['; Generated in GitHub Actions from KALONEO_INSTALL_PASSWORD; never commit this file.',
  '!define KALONEO_PASSWORD_SALT "'+salt+'"'];
for(let i=0;i<8;i++)items.push('!define KALONEO_PASSWORD_WORD'+i+' "0x'+digest.readUInt32LE(i*4).toString(16).padStart(8,'0')+'"');
const directory=path.join(__dirname,'..','build','pilot-resources');
fs.mkdirSync(directory,{recursive:true});
const output=path.join(directory,'kaloneo-password-hash.nsh');
fs.writeFileSync(output,items.join('\n')+'\n',{mode:0o600});
console.log('KALONEO_INSTALL_AUTH=READY : empreinte salée SHA256 construite, secret non affiché.');
