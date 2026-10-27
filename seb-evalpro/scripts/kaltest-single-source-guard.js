'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const assert=(value,message)=>{if(!value)throw Error('KALTEST_SINGLE_SOURCE: '+message)};
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');
const mail=JSON.parse(read('source/kaltest/tests/redaction-email/1.0.0/test.json'));
const word=JSON.parse(read('source/kaltest/tests/traitement-texte-bureautique/1.0.0/test.json'));
for(const file of ['nwtexte.html','nvmail.html'])for(const base of ['source','app/web'])
  assert(!fs.existsSync(path.join(root,base,file)),'ancienne page encore présente : '+base+'/'+file);
const text=mail.presentation.mailComposer.instructions.join('\n');
for(const token of ['conseil.perso@kaloneo.org','stage-pro@kaloneo.org','Prénom* Mail-Kalonéo','01.02.34.56.78**','** utilisez un numéro de téléphone fictif.'])
  assert(text.includes(token),'consigne e-mail : '+token);
for(const id of ['mail_to','mail_cc'])assert(mail.questions.find(q=>q.id===id)?.acceptedAnswers?.[0]?.endsWith('@kaloneo.org'),'correction e-mail : '+id);
assert(fs.existsSync(path.join(root,'source',mail.presentation.mailComposer.illustration)),'image e-mail manquante');
const content=word.presentation.builderContent.find(x=>x.type==='text').text;
const config=word.presentation.builderContent.find(x=>x.type==='text-editor').config;
assert(word.instruction.includes('dossier Kalonéo')&&content.includes('Nom*_Evaluation_Kalonéo'),'consignes traitement de texte');
assert(config.expectedSaveFolder==='Bureau\\Kalonéo'&&config.expectedFilenameSuffix==='_Evaluation_Kalonéo','correction enregistrement');
const arch=JSON.parse(fs.readFileSync(path.resolve(root,'..','kaloneo','archetype-registry.json'),'utf8'));
for(const kind of ['traitement_texte','redaction_email']){
 const files=arch.archetypes.find(x=>x.id===kind)?.source||[];
 assert(files.some(x=>x.includes('/kaltest/tests/'))&&!files.some(x=>/source\/(nwtexte|nvmail)\.html/.test(x)),'archétype Builder pointant vers une ancienne page : '+kind);
}
const runtime=read('source/js/kaltest-pilot2-runtime.js');
assert(!runtime.includes('@sauvegarde56.org')&&!runtime.includes('mail seb'),'correction runtime e-mail encore obsolète');
assert(runtime.includes('kaltest-mail-send')&&runtime.includes('definition.illustration'),'bouton ou image absents du runtime KALTEST');
assert(runtime.includes('expectedSaveFolder:config.expectedSaveFolder'),'règles de fichier non lues dans KALTEST');
if(fs.existsSync(path.join(root,'app/web/js/kaltest-pilot2-data.js'))){
const packed=read('app/web/js/kaltest-pilot2-data.js');
assert(packed.includes('stage-pro@kaloneo.org')&&packed.includes('Nom*_Evaluation_Kalonéo'),'données générées anciennes');
}
console.log('KALTEST_SINGLE_SOURCE=SUCCESS');
