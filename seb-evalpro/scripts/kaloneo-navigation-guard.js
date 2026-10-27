const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
function fail(message){
  console.error('SEB EvalPro garde navigation KALONÉO: ' + message);
  process.exit(2);
}
function read(rel){
  const file=path.join(root,rel);
  if(!fs.existsSync(file)) fail('fichier introuvable: '+rel);
  return fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');
}

const runtime=read('app/web/js/seb-ui-runtime.js');
const marker='// KALONEO_STABLE_BOTTOM_BAR_V16';
const markerIndex=runtime.indexOf(marker);
if(markerIndex<0) fail('barre stable V16 absente');
const stable=runtime.slice(markerIndex);

for(const token of [
  'const BAR_HEIGHT=52;',
  '--kaloneo-bottom-bar-height:${BAR_HEIGHT}px',
  'Barre de navigation KALONÉO',
  'id="kaloneo-nav-left"',
  'id="kaloneo-nav-brand"',
  'id="kaloneo-nav-logo-img"',
  'KALONEO_BAR_ICON_DATA',
  'KALONÉO',
  'id="kaloneo-nav-center"',
  'id="kaloneo-nav-right"',
  'id="kaloneo-nav-time"',
  'id="kaloneo-nav-date"',
  'grid-template-columns:minmax(285px,320px) minmax(0,1fr) minmax(295px,340px)',
  'background:linear-gradient(90deg,#003B57 0%,#004E70 48%,#356787 100%)',
  '--kaloneo-work-height:calc(100dvh - var(--kaloneo-bottom-bar-height))',
  'height:var(--kaloneo-work-height)!important',
  'id="kaloneo-nav-abandon"',
  'id="kaloneo-nav-home"',
  ':not(#pilot2-calculator-test-open)',
  'seb-kaloneo-global-source',
  "setInterval(updateClock,60000)",
  'content:"•  "',
  '#modalFichier ul>li::marker',
  '#kaloneo-common-navigation button[hidden]'
]) if(!stable.includes(token)) fail('contrat stable absent: '+token);

for(const forbidden of [
  'sourceToProxy',
  'makeProxy(',
  'data-kaloneo-proxy-for',
  'new MutationObserver(',
  "document.querySelectorAll('button').forEach"
]) if(stable.includes(forbidden)) fail('ancien mécanisme dynamique encore présent dans la barre: '+forbidden);

for(const id of [
  'kaltest-calculator','page4Next','stockActionBtn','btnValider','btnSuivant','btnNextGenreNombre','seb-dictee-action',
  'seb-tri-auto-validate','seb-tri-next','btn-score','nvmail-next','autoeval1-validate',
  'autoeval2-validate','btnNextParonymes','btnValidate','btnNext'
]) if(!stable.includes(id)) fail('action courante non déclarée: '+id);

const protectedButtons={
  'app/web/stock.html':['id="stockActionBtn"','Vérifier'],
  'app/web/planning.html':['id="btnValider"','id="btnSuivant"'],
  'app/web/genrenombres.html':['id="btnCheck"','id="btnNextGenreNombre"'],
  'app/web/dictee.html':['id="verifyBtn"','id="nextBtn"'],
  'app/web/tri_de_cheville.html':['id="calc"','id="seb-tri-next"'],
  'app/web/carre.html':['id="btnValidate"','id="btnNext"']
};
for(const [file,tokens] of Object.entries(protectedButtons)){
  const html=read(file);
  for(const token of tokens) if(!html.includes(token)) fail('fonction de parcours supprimée dans '+file+': '+token);
}

const mailRuntime=read('app/web/js/kaltest-pilot2-runtime.js');
if(!mailRuntime.includes('kaltest-mail-attachment')||!mailRuntime.includes('kaltest-mail-send')) fail('formulaire KALTEST e-mail incomplet');

console.log('SEB EvalPro garde navigation KALONÉO: barre V16 52 px, vrai logo, gradient bleu, horloge, calculatrice intégrable, actions uniques et viewport réservé — OK.');
