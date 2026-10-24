const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const repoRoot = path.resolve(root, '..');
const sourceDir = path.join(root, 'source');
const overridesDir = path.join(root, 'overrides');
const kaloneoBuilderDir = path.join(repoRoot, 'kaloneo');
const outputDir = path.join(root, 'app', 'web');
const {writeOfficialSeedOverrides}=require('./kaloneo-testsv1');

function fail(message) {
  console.error('SEB EvalPro prepare:web: ' + message);
  process.exit(2);
}

function copyTree(source, destination, skipNames = new Set()) {
  if (!fs.existsSync(source)) return;
  fs.mkdirSync(destination, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    if (skipNames.has(entry.name)) continue;
    const from = path.join(source, entry.name);
    const to = path.join(destination, entry.name);
    if (entry.isDirectory()) copyTree(from, to, skipNames);
    else fs.copyFileSync(from, to);
  }
}

function htmlFiles(directory) {
  let out = [];
  if (!fs.existsSync(directory)) return out;
  for (const entry of fs.readdirSync(directory, { withFileTypes:true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) out = out.concat(htmlFiles(full));
    else if (/\.html?$/i.test(entry.name)) out.push(full);
  }
  return out;
}

function assertCleanHtml(directory, label) {
  for (const file of htmlFiles(directory)) {
    const html = fs.readFileSync(file, 'utf8');
    if (/<script(?![^>]*\bsrc=)[^>]*>/i.test(html)) fail(label + ': script inline interdit dans ' + path.relative(root,file));
    if (/\son(?:click|change|input|submit|ended|load|error|blur|focus|keydown|keyup|keypress|mouseover|mouseout|mouseenter|mouseleave)\s*=/i.test(html)) {
      fail(label + ': événement inline interdit dans ' + path.relative(root,file));
    }
    if (/href\s*=\s*["']javascript:/i.test(html)) fail(label + ': URL javascript: interdite dans ' + path.relative(root,file));
  }
}

for (const required of ['qcmv1.0.html','bilan.html','dictee.html']) {
  if (!fs.existsSync(path.join(sourceDir,required))) fail('source obligatoire absente: ' + required);
}
for (const required of ['admin-bilan.html','admin-candidats.html','admin-tests-parcours.html','admin-mask-builder.html','admin-mask-preview.html','admin-kaloneo-transfer.html']) {
  if (!fs.existsSync(path.join(overridesDir,required))) fail('override obligatoire absent: ' + required);
}

assertCleanHtml(sourceDir,'source');
assertCleanHtml(overridesDir,'overrides');

fs.rmSync(outputDir,{recursive:true,force:true});
fs.mkdirSync(outputDir,{recursive:true});
copyTree(sourceDir,outputDir,new Set(['QCM.lnk','README.md']));
copyTree(overridesDir,outputDir);
// Le moteur média est partagé sans duplication entre Preload, Builder et aperçu.
fs.copyFileSync(path.join(root,'src','kaloneo-mask-media.js'),path.join(outputDir,'js','kaloneo-mask-media.js'));
// Les fichiers fournis par l'administrateur ne sont pas ajoutés à la bibliothèque d'images.
// N'embarquer que l'image statique. Le MP4 reste conservé sur GitHub
// comme source historique, mais n'entre plus dans l'installateur Windows.
copyTree(path.join(repoRoot,'video_ecran_mq'),path.join(outputDir,'mask-media-seed'),
  new Set(fs.readdirSync(path.join(repoRoot,'video_ecran_mq')).filter(name=>! /\.png$/i.test(name))));
// Les cinq V1 sont à nouveau intégrées : JSON allégés et images en fichiers
// partagés, sans modifier ni supprimer les cinq exports officiels GitHub.
if(process.env.KALONEO_SKIP_OFFICIAL_V1 === '1'){
  const manifestFile=path.join(outputDir,'kaltest','TESTS_V1-manifest.json');
  fs.writeFileSync(manifestFile,JSON.stringify({
    format:'kaloneo-official-v1-overrides',version:1,tests:[]
  },null,2)+'\n','utf8');
  console.log('KALONEO R160: five TESTS_V1 excluded from comparison Setup');
}else{
  writeOfficialSeedOverrides({
    repoRoot,sourceTestsDir:path.join(sourceDir,'kaltest','tests'),
    outputTestsDir:path.join(outputDir,'kaltest','tests')
  });
}
if (!fs.existsSync(kaloneoBuilderDir)) fail('générateur KALONÉO canonique absent: kaloneo/');
copyTree(kaloneoBuilderDir,path.join(outputDir,'kaloneo-builder'));
require('./kaloneo-r125-visible-branding').brandGeneratedWeb(outputDir);
// R168 : au lieu d'altérer des originaux, générer des copies d'affichage
// WebP/photos et des ressources internes allégées APRÈS la copie de source/.
const {spawnSync}=require('node:child_process');
const python=process.platform==='win32'?'python':'python3';
const optimized=spawnSync(python,[path.join(root,'scripts','optimize-test-image-assets.py')],{
  cwd:root,encoding:'utf8',timeout:120000
});
if(optimized.stdout)process.stdout.write(optimized.stdout);
if(optimized.status!==0){
  const message='KALONÉO : génération des images de rendu indisponible : '+String(optimized.stderr||optimized.error||'Pillow absent');
  if(process.env.KALONEO_STRICT_RENDER_IMAGES==='1')fail(message);
  console.warn(message+' (développement : les originaux restent utilisables).');
}
assertCleanHtml(outputDir,'app/web');

console.log('SEB EvalPro: app/web reconstruit par copie des sources canoniques + générateur KALONÉO compilé, sans patch fonctionnel.');
