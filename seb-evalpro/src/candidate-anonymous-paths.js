'use strict';
// Identifiants de transport sans information personnelle ni hash stable.
const crypto=require('crypto');
function createPrivateExportFolderName(){
  return 'KALONEO-EXPORT-'+crypto.randomBytes(16).toString('hex').toUpperCase();
}
function createPrivateTransferFilename(){
  return 'CAND-'+crypto.randomBytes(16).toString('hex').toUpperCase()+'.seb';
}
module.exports={createPrivateExportFolderName,createPrivateTransferFilename};
