'use strict';
// Strict static audit of the full five-page user-provided licence:
// one consistent document in NSIS and About, explicit opt-in only.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const license=read('build/pilot-resources/KALONEO-LICENCE.txt').replace(/^\uFEFF/,'');
const html=read('source/assets/KALONEO-LICENCE.html');
const settings=read('src/kaloneo-admin-settings.js');
const nsis=read('build/installer.nsh');
const yaml=read('build/kaloneo-r173-final-setup.yml');
assert(license.length>15000,'La licence complete de cinq pages ne doit pas etre tronquee');
for(const clause of [
 'KALONÉO Licence propriétaire d’utilisation',
 'CONDITIONS PARTICULIÈRES :',
 'Concédant proposé : Claude LESPAGNOL.',
 'Contact pour la licence et l’assistance: abmc56@free.fr',
 'Sites et établissements autorisés : Sauvegarde56.',
 'Date d’effet : 1/10/2026.',
 '1. OBJET ET PÉRIMÈTRE','2. DROIT D’UTILISATION ACCORDÉ',
 '3. COPIES, DIFFUSION ET RESTRICTIONS','4. DROITS LÉGAUX PRÉSERVÉS',
 '5. TESTS, PARCOURS, BILANS ET CONTENUS DES UTILISATEURS',
 '6. MISES À JOUR ET MOTS DE PASSE',
 '7. BIBLIOTHÈQUE D’IMAGES ET CONTENUS TÉLÉCHARGEABLES',
 '8. COMPOSANTS TIERS ET LICENCES LIBRES',
 '9. DONNÉES ET RESPONSABILITÉS D’USAGE',
 '10. ASSISTANCE, GARANTIES ET RESPONSABILITÉ',
 '11. MANQUEMENT ET FIN DE LICENCE',
 '12. ACCEPTATION ET ÉVOLUTION DES CONDITIONS',
 '13. DROIT APPLICABLE',
 'ACCEPTATION DE LA LICENCE',
 'J’ai lu et j’accepte la'
]){
 assert(license.includes(clause),'Section du document d origine perdue: '+clause);
}
assert(!license.includes('Projet à compléter avant diffusion'),
 'La mauvaise licence de six pages a ete reutilisee');
assert(html.includes('KALONÉO-LICENCE')||html.includes('Licence d’utilisation de KALONÉO'),
 'Le texte de licence doit etre present dans À propos');
assert(html.includes('13. DROIT APPLICABLE'));
assert(settings.includes('data-license-toggle'));
assert(settings.includes("assets/KALONEO-LICENCE.html"));
assert(settings.includes("licenseDocument.hidden=!showing"));
assert(settings.includes("aria-expanded"));
assert(nsis.includes('!insertmacro MUI_PAGE_LICENSE "${BUILD_RESOURCES_DIR}\\KALONEO-LICENCE.txt"'),
 'La licence complete manque dans la page d installation');
assert(nsis.includes('!define MUI_LICENSEPAGE_CHECKBOX'),
 'Consentement par case NON pre-cochee absent');
assert(nsis.includes('!define MUI_LICENSEPAGE_CHECKBOX_TEXT'),
 'Libelle de la case d acceptation absent');
assert(nsis.includes('!define MUI_PAGE_CUSTOMFUNCTION_LEAVE KaloneoLicensePageLeave'),
 'Pas de confirmation de consentement en fin de page');
assert(nsis.includes('StrCpy $KaloneoLicenseExplicitlyAccepted "0"'),
 'Acceptation initiale non refusee');
assert(!nsis.includes('!undef MUI_PAGE_CUSTOMFUNCTION_LEAVE'),
 'La macro MUI_PAGE_LICENSE supprime automatiquement ce define; tout !undef supplémentaire provoque le warning NSIS 6155 bloquant.');
assert(nsis.includes('LicenseAcceptedDate'));
assert(nsis.includes('LicenseAcceptedRevision'));
assert(yaml.includes('buildResources: build/pilot-resources'),
 'Chemin NSIS de licence incoherent avec les ressources de compilation');
console.log('KALONEO_R174_LICENCE_COMPLETE_CORRECTE=OK;DOCUMENT=5_PAGES;ABOUT=OK;CASE_NON_PRECOCHEE=OK;SETUP_NON_PUBLIE');
