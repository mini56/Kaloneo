'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createKaloneoLibrary}=require('../src/kaloneo-library-main');
const app=path.resolve(__dirname,'..');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'kaloneo-r162-static-mask-'));
try{
 const seed=path.join(root,'seed');fs.mkdirSync(seed,{recursive:true});
 const png=fs.readdirSync(path.join(app,'app','web','mask-media-seed')).find(x=>/\.png$/i.test(x));
 assert(png,'Image PNG absente du Setup');
 const original=fs.readFileSync(path.join(app,'app','web','mask-media-seed',png));
 assert(!fs.readdirSync(path.join(app,'app','web','mask-media-seed')).some(x=>/\.mp4$/i.test(x)),
   'MP4 toujours embarqué dans le programme');
 fs.writeFileSync(path.join(seed,png),original);
 const dataRoot=path.join(root,'data');
 const lib=createKaloneoLibrary({dataRoot,seedMaskMediaRoot:seed,
   seedTestsRoot:path.join(app,'source','kaltest','tests')});
 const ref={id:'kaloneo-video-image',version:'1.0.0'};
 let mask=lib.getMaskScreen(ref);
 assert(mask.ok&&mask.maskScreen.content.image.startsWith('data:image/png;base64,'));
 assert(!mask.maskScreen.content.video,'Vidéo présente dans le masque fixe');
 const legacyMask={id:'ancien',version:'1.0.0',name:'Ancienne vidéo',content:{
   text:'',image:mask.maskScreen.content.image,video:'data:video/mp4;base64,AAAA',videoName:'old.mp4'
 }};
 let old=lib.saveMaskScreen(legacyMask);
 assert(old.ok,old.error);
 assert(!lib.getMaskScreen({id:'ancien',version:'1.0.0'}).maskScreen.content.video);
 assert.equal(lib.listMaskScreens().some(x=>x.hasVideo),false);
 // Mise à jour sans effacer le profil ni modifier le pointeur du parcours.
 const file=path.join(dataRoot,'KALONEO','Ecrans-masquage',ref.id,ref.version,'mask.json');
 const stored=JSON.parse(fs.readFileSync(file,'utf8'));
 stored.content.video='data:video/mp4;base64,AAAA';stored.content.videoName='old.mp4';
 fs.writeFileSync(file,JSON.stringify(stored));
 const libUpdated=createKaloneoLibrary({dataRoot,seedMaskMediaRoot:seed});
 mask=libUpdated.getMaskScreen(ref);
 assert(mask.ok&&!mask.maskScreen.content.video&&!mask.maskScreen.content.videoName);
 assert.equal(Buffer.from(mask.maskScreen.content.image.split(',')[1],'base64').equals(original),true,
   'L image du masquage ne correspond plus au PNG original');
 const base=lib.getParcoursDetails('parcours-de-base');
 assert(base.ok,'Parcours de base absent du catalogue de test');
 assert.equal(base.details.maskScreen.id,'kaloneo-video-image',
   'Le parcours de base doit sélectionner KALONÉO — image fixe');
 assert.equal(base.details.maskScreenMeta.name,'KALONÉO — image fixe');
 // Simuler une ancienne référence de masque sur un modèle existant.
 const baseFile=path.join(dataRoot,'KALONEO','Parcours','parcours-de-base.json');
 const savedBase=JSON.parse(fs.readFileSync(baseFile,'utf8'));
 savedBase.maskScreen={id:'kaloneo-default',version:'1.0.0'};
 fs.writeFileSync(baseFile,JSON.stringify(savedBase));
 const upgradedBase=createKaloneoLibrary({dataRoot,seedMaskMediaRoot:seed});
 const migrated=upgradedBase.getParcoursDetails('parcours-de-base');
 assert.equal(migrated.details.maskScreen.id,'kaloneo-video-image',
   'Ancienne référence du masque non corrigée lors de la mise à jour');
 assert.equal(migrated.details.maskScreenMeta.name,'KALONÉO — image fixe');
 const ui=fs.readFileSync(path.join(app,'app','web','admin-mask-builder.html'),'utf8');
 assert(ui.includes('id="back-tests-parcours" class="seb-action-btn seb-btn-functional" type="button">Fermer</button>'),
   'Bouton de retour masque non renommé Fermer');
 assert(!ui.includes('id="mask-video-file"'),'Bouton import vidéo toujours visible');
 console.log('KALONEO_R162_IMAGE_ONLY=OK — PNG seul, anciennes vidéos vidées, profil candidat conservé');
}finally{fs.rmSync(root,{recursive:true,force:true});}
