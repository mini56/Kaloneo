'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const root=path.join(__dirname,'..');
const main=fs.readFileSync(path.join(root,'src','main.js'),'utf8');
const catalog=fs.readFileSync(path.join(root,'src','candidate-catalog-main.js'),'utf8');
assert(main.includes("const filename = 'Evaluation_CAND-' + opaqueWordId + '.docx';"),
  'Un Word candidat pourrait porter le nom/prenom lisible sur disque.');
assert(main.includes("crypto.createHash('sha256')"),'Identifiant opaque Word absent.');
assert(main.includes("buildBilanDocxBuffer(payload || {}, adminSessionDocumentPassword)"),
  'Le mot de passe du Word ne doit pas etre supprime.');
assert(catalog.includes("verifyBilanDocxPassword(encrypted,password)"),
  'Le Word chiffre doit etre verifie avant ouverture.');
assert(catalog.includes('shell.openPath(full)'),
  'Le Word original chiffre doit etre ouvert directement.');
const open=catalog.slice(catalog.indexOf("ipcMain.handle('candidate-catalog:open-export'"),
  catalog.indexOf("ipcMain.handle('candidate-catalog:sync'"));
assert(!open.includes("fs.writeFileSync(temp,plain)"),
  'Copie de Word dechiffre dans TEMP Windows toujours autorisee.');
assert(catalog.includes("if (/\\.sebdoc$/i.test(safe))"),
  'Le catalogue administrateur ne sait pas ouvrir les Word historiques chiffres.');
assert(catalog.includes('decryptLocalFileBuffer(protectedHtml)'),
  'Le bilan ancien n est pas dechiffre seulement en memoire.');
assert(catalog.includes('protectPlainBilanDocxBuffer(decryptLocalFileBuffer(sealed),password)'),
  'Les DOCX historiques ne sont pas protegés avant ouverture Word.');
console.log('PRIVATE_WORD_FILENAME=OK');
console.log('NO_DECRYPTED_WORD_TEMP_ON_OPEN=OK');
