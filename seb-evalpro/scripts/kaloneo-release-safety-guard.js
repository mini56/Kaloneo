'use strict';
// Controle statique, sans runner : les anciens workflows restent executables
// pour leurs tests, mais ne peuvent publier aucune Release historique.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const appRoot=path.resolve(__dirname,'..');
const repoRoot=path.resolve(appRoot,'..');
const read=relative=>fs.readFileSync(path.join(repoRoot,relative),'utf8');
const main=read('seb-evalpro/src/main.js');
const previewStart=main.indexOf('if(isUnlocked && kaloneoBuilderPreviewFullscreenActive) {');
const previewEnd=main.indexOf('\n  if (isUnlocked) {',previewStart);
assert(previewStart>=0&&previewEnd>previewStart,'Branche aperçu Builder Admin introuvable');
const preview=main.slice(previewStart,previewEnd);
assert(preview.includes('mainWindow.setSkipTaskbar(false)'),'Apercu Builder masque dans la barre des taches');
assert(preview.includes('mainWindow.setFullScreen(true)'),'Apercu Builder ne conserve pas sa surface candidat');
assert(main.includes('kaloneoBuilderPreviewFullscreenActive=true;'),'Ouverture apercu Builder introuvable');
assert(main.includes('kaloneoBuilderPreviewFullscreenActive=false;'),'Fermeture apercu Builder introuvable');
assert(main.includes('mainWindow.setSkipTaskbar(true)'),'Protection barre des taches candidat retiree');
assert(main.includes('allowSeedOverwrite:payload?.overwrite===true && adminSessionUnlocked && developerSessionUnlocked'),
  'Une V1 systeme peut etre remplacee sans mode Developpeur');

const pkg=JSON.parse(read('seb-evalpro/package.json'));
assert.equal(pkg.main,'src/kaltest-pilot21-main.js','Point d entree KALONEO different du Setup');
assert.equal(pkg.build?.appId,'fr.sauvegarde56.kaloneo','Identite electron-builder historique encore active');
assert(pkg.build?.nsis?.artifactName?.includes('NON-VALIDE'),
  'Un Setup non audite ne doit pas porter le nom officiel');
assert(pkg.scripts?.['dist:win']?.includes('--config build/kaloneo-auto-release.yml'),
  'Compilation npm Windows sans la configuration officielle');
const official=read('.github/workflows/publish-kaloneo-next-version.yml');
assert(/contents:\s*write/.test(official),'Workflow officiel sans droit de publication');
assert(official.includes('--config build/kaloneo-auto-release.yml'),
  'Workflow officiel electron-builder sans configuration');
const archived=["audit-r172-data-preservation.yml","audit-r173-final-setup.yml","audit-r174-final-setup.yml","audit-r175-final-setup.yml","audit-r176-final-setup.yml","audit-r177-final-setup.yml","audit-r178-final-setup.yml","audit-r179-final-setup.yml","audit-r180-final-setup.yml","audit-r181-final-setup.yml","audit-r182-final-setup.yml","audit-r183-final-setup.yml","audit-r184-final-setup.yml","publish-kaloneo-v1-00-189-release.yml","publish-kaloneo-v1-00-190.yml","publish-r185-tested-release.yml"];
for(const filename of archived){
  const file=read('.github/workflows/'+filename);
  assert(/contents:\s*read/.test(file)&&!/contents:\s*write/.test(file),
    'Ancien workflow avec droits de publication : '+filename);
  const lines=file.split(/\r?\n/);
  const release=lines.findIndex(line=>/gh release create\s/.test(line));
  assert(release>=0,'Ancienne publication introuvable : '+filename);
  let step=-1;
  for(let i=release;i>=0;i--)if(/^      - name:/.test(lines[i])){step=i;break;}
  assert(step>=0,'Etape historique de publication sans titre : '+filename);
  assert(lines.slice(step+1,release).some(line=>line.trim()==='if: $'+'{{ false }}'),
    'Etape de publication historique non neutralisee : '+filename);
}
console.log('KALONEO_RELEASE_SAFETY=SUCCESS ; preview Admin ; identite Windows ; '+archived.length+' anciens workflows en lecture seule');
