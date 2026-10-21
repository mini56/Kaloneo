'use strict';

const fs=require('fs');
const os=require('os');
const path=require('path');
const {
  buildBilanDocxBuffer,
  protectPlainBilanDocxBuffer,
  decryptBilanDocxBuffer,
  isEncryptedBilanDocxBuffer,
  verifyBilanDocxPassword
}=require('../src/bilan-docx-main');

(async()=>{
  const password='SVG56';
  const payload={
    filename:'Evaluation_TEST_R17.docx',
    candidate:{nom:'TEST',prenom:'R17',date:'2026-10-07'},
    rows:[
      {type:'section',text:'Compétences techniques',strong:true},
      {
        type:'row',
        id:'organisation',
        module:'Gestion logistique\nRanger le stock de produits\nCapacité à effectuer le classement des produits dans un espace de stockage en respectant les consignes.',
        level:'III',
        levelTexts:{NE:'',I:'',II:'',III:''},
        comment:'III. Réalise la tâche avec de nombreuses erreurs nécessitant un accompagnement.',
        detail:'33 erreurs'
      },
      {
        type:'row',
        id:'tri-temps',
        module:'Tri de chevilles\nCapacité à effectuer une tâche simple et répétitive en un temps imparti.\nMoyenne 11:40',
        level:'I',
        levelTexts:{NE:'',I:'-10 à 12 min',II:'12 à 14 min',III:'14 min et plus'},
        comment:'',
        detail:'',
        extra:'N°1 : 11 min 00 s\nN°2 : 11 min 40 s\nN°3 : 12 min 00 s\nN°4 : 12 min 00 s'
      }
    ],
    summary:'Synthèse de test. Autoévaluation du candidat : repères déclarés par la personne.',
    feeling:''
  };

  const encrypted=await buildBilanDocxBuffer(payload,password);
  if(!Buffer.isBuffer(encrypted)||encrypted.length<5000)throw new Error('Buffer DOCX protégé invalide ou trop petit.');
  if(!(await isEncryptedBilanDocxBuffer(encrypted)))throw new Error('Le document Word n’est pas protégé par mot de passe.');
  if(await verifyBilanDocxPassword(encrypted,'MAUVAIS'))throw new Error('Un mauvais mot de passe ouvre le document.');
  if(!(await verifyBilanDocxPassword(encrypted,password)))throw new Error('Le mot de passe administrateur ne déverrouille pas le document.');

  const plain=await decryptBilanDocxBuffer(encrypted,password);
  if(plain[0]!==0x50||plain[1]!==0x4b)throw new Error('Le contenu déchiffré n’est pas un DOCX/ZIP valide.');

  // Un ancien DOCX non protege est rechiffre avant ecriture sur le PC admin.
  const migrated=await protectPlainBilanDocxBuffer(plain,password);
  if(!(await isEncryptedBilanDocxBuffer(migrated)))
    throw new Error('La conversion de l ancien Word n a pas produit un OOXML chiffre.');
  if(!(await verifyBilanDocxPassword(migrated,password)))
    throw new Error('Mot de passe du Word migre refuse.');
  const reloaded=await decryptBilanDocxBuffer(migrated,password);
  if(!reloaded.equals(plain))throw new Error('Le Word migre a perdu du contenu.');
  console.log('LEGACY_DOCX_TO_PASSWORD_WORD=OK');

  const root=process.env.RUNNER_TEMP||os.tmpdir();
  const target=path.join(root,'seb-evalpro-r17-bilan-smoke-protected.docx');
  fs.writeFileSync(target,encrypted);
  // Aucun Word clair n'est jamais ecrit dans TEMP, meme pendant le test.

  console.log('BILAN_DOCX_SMOKE=OK');
  console.log('BILAN_DOCX_SMOKE_PATH='+target);
})().catch(error=>{
  console.error('BILAN_DOCX_SMOKE=FAIL');
  console.error(error&&error.stack||error);
  process.exit(2);
});
