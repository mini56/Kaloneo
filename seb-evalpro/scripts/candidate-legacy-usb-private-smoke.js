'use strict';
const assert=require('assert');
const fs=require('fs');
const os=require('os');
const path=require('path');
const crypto=require('crypto');
const {configureLocalKey,clearLocalKey,readJsonFile,isEncryptedLocalFileBuffer,
  decryptLocalFileBuffer}=require('../src/candidate-data-crypto');
const {createCandidateTransfer}=require('../src/candidate-transfer-main');
const {computeArchiveIntegrity}=require('../src/replay-archive-integrity');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kaloneo-legacy-usb-security-'));
const root=path.join(tmp,'pc','storage');
const usb=path.join(tmp,'usb');
const password='USB-PASSWORD-TEST-LEGACY';
const candidate={nom:'IDENTITE_LEGACY_777',prenom:'PRENOM_LEGACY_666',lieu:'Lorient',groupe:'1'};
const id='legacy-usb-candidate-001';
const b64=b=>Buffer.from(b).toString('base64');
const png=Buffer.from('89504e470d0a1a0a00112233445566','hex');
const doc=Buffer.from('<html><table><tr><td>'+candidate.nom+'</td></tr></table></html>','utf8');
const word=Buffer.from('504b03040000001122334455','hex');
try{
  configureLocalKey(Buffer.alloc(32,23));
  fs.mkdirSync(usb,{recursive:true});
  const transfer=createCandidateTransfer({dataRoot:root,documentsPath:path.join(tmp,'Documents')});
  // Construit un ancien conteneur .seb a l'aide du moteur existant, sans
  // fichier Word jamais ecrit sur le PC destinataire avant son dechiffrement.
  // Injecter les anciennes pieces uniquement dans le payload en memoire.
  const required={
    'manifest.json':{candidateId:id,shortId:'LEGACY',folderName:'CAND-LEGACY001',status:'TERMINE',candidat:candidate},
    'donnees/candidat.json':candidate,
    'donnees/evaluation-state.json':{sessionStorage:{candidat_data:JSON.stringify(candidate)},localStorage:{}},
    'donnees/progression.json':{},
    'resultats/reponses.json':{answer:'PRIVATE_ANSWER_456'},
    'resultats/scores.json':{}
  };
  const replay={schemaVersion:2,type:'SEB_EVALPRO_PARCOURS_ARCHIVE',readOnly:true,
    archiveMode:'VISUAL_FROZEN_SLIDES',futureVersionIndependent:true,build:'147',
    archivedAt:'2026-10-21T00:00:00.000Z',candidate,snapshot:{},slides:[{
      order:1,pageKey:'page',title:'Page',file:'001_PAGE.png',width:100,height:100,
      capturedAt:'2026-10-21T00:00:00.000Z',sha256:crypto.createHash('sha256').update(png).digest('hex')
    }]};
  replay.integritySha256=computeArchiveIntegrity(replay);
  const entries=[
    ...Object.entries(required).map(([rel,v])=>({type:'json',rel,data:b64(JSON.stringify(v))})),
    {type:'dir',rel:'donnees'},{type:'dir',rel:'resultats'},
    {type:'dir',rel:'replay'},{type:'dir',rel:'replay/REPLAY-OLD'},
    {type:'dir',rel:'replay/REPLAY-OLD/slides'},
    {type:'json',rel:'replay/REPLAY-OLD/manifest.json',data:b64(JSON.stringify(replay))},
    {type:'file',rel:'replay/REPLAY-OLD/slides/001_PAGE.png',data:b64(png)},
    {type:'dir',rel:'bilan'},{type:'dir',rel:'bilan/historique'},
    {type:'json',rel:'bilan/historique/'+candidate.nom+'_BILAN_R00.json',
      data:b64(JSON.stringify({type:'SEB_EVALPRO_BILAN_ARCHIVE',candidate,comment:'Bilan prive'}))},
    {type:'dir',rel:'bilan/exports'},
    {type:'file',rel:'bilan/exports/Evaluation_'+candidate.nom+'_OLD.doc',data:b64(doc)},
    {type:'file',rel:'bilan/exports/Evaluation_'+candidate.nom+'_OLD.docx',data:b64(word)}
  ];
  // Le format USB v1 est un JSON gzip chiffre scrypt AES-GCM; la fonction
  // d'import exposee prend un fichier existant, donc generation via le
  // service de transfert de reference pour assurer la compatibilite.
  const payload={schemaVersion:1,type:'SEB_EVALPRO_CANDIDATE_TRANSFER',candidateId:id,
    shortId:'LEGACY',status:'TERMINE',exportedAt:'2026-10-21T12:00:00.000Z',entries};
  const {createCipheriv,randomBytes,scryptSync}=crypto;
  const zlib=require('zlib');
  const salt=randomBytes(16),iv=randomBytes(12),key=scryptSync(password,salt,32,{N:32768,r:8,p:1});
  const encrypted=zlib.gzipSync(Buffer.from(JSON.stringify(payload),'utf8'));
  const cipher=createCipheriv('aes-256-gcm',key,iv);
  const aad=Buffer.from('SEB-EvalPro/candidate-transfer/v1','utf8');
  cipher.setAAD(aad);
  const encryptedBody=Buffer.concat([cipher.update(encrypted),cipher.final()]);
  const packet={format:'SEB-EVALPRO-USB-1',kdf:'scrypt',cipher:'aes-256-gcm',
    salt:salt.toString('base64'),iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),
    data:encryptedBody.toString('base64')};
  fs.writeFileSync(path.join(usb,'CAND-LEGACY.seb'),JSON.stringify(packet));
  const result=transfer.importAll(usb,password);
  assert.strictEqual(result.added,1);
  const target=result.copied[0].candidateDir;
  const exports=fs.readdirSync(path.join(target,'bilan','exports'));
  assert(exports.some(x=>x.endsWith('.sebdoc'))&&exports.some(x=>x.endsWith('.sebword')));
  assert(exports.every(x=>!x.includes(candidate.nom)));
  for(const entry of exports){
    const data=fs.readFileSync(path.join(target,'bilan','exports',entry));
    assert(isEncryptedLocalFileBuffer(data));
  }
  const hist=fs.readdirSync(path.join(target,'bilan','historique'));
  assert(hist.length===1&&!hist[0].includes(candidate.nom));
  const image=fs.readFileSync(path.join(target,'replay','REPLAY-OLD','slides','001_PAGE.png'));
  assert(isEncryptedLocalFileBuffer(image));
  assert(decryptLocalFileBuffer(image).equals(png));
  const reparsed=readJsonFile(path.join(target,'replay','REPLAY-OLD','manifest.json'));
  assert.strictEqual(reparsed.slides[0].sha256,crypto.createHash('sha256').update(image).digest('hex'));
  assert.strictEqual(reparsed.integritySha256,computeArchiveIntegrity(reparsed));
  console.log('LEGACY_SEB_USB_DOC_WORD_PNG_CHIFFRES_AVANT_DISQUE=OK');
  console.log('LEGACY_SEB_USB_NOMS_CANDIDAT_MASQUES=OK');
}finally{clearLocalKey();fs.rmSync(tmp,{recursive:true,force:true})}
