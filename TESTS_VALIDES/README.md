# Référentiel de validation des tests KALONÉO

**Ce dossier ne constitue PAS encore une bibliothèque de tests validés.** Il est le point de départ de l'inventaire. Ne pas confondre fichiers présents, tests techniques et versions effectivement approuvées par l'utilisateur.

## Règles impératives

1. Ne jamais classer « VALIDÉ » un test sans référence explicite à la validation réelle de l'utilisateur et à un état Git précis (commit + fichier + images + rendu + comportement + barème).
2. Ne jamais remplacer une version validée par une démonstration, un brouillon ou un correctif en cours. Conserver les versions immuables.
3. Les builds candidats doivent utiliser une liste explicite de versions figées ; les branches de développement ne sont pas une source de vérité.
4. Un nouveau Setup nécessite des contrôles ciblés de non-régression sur les tests de référence ; les changements ne sont promus qu'après validation.
5. Les images, les ressources JS/CSS, les barèmes et les dépendances doivent être inclus avec chaque instantané validé.

## Cas à ne surtout pas confondre

- `planning_cantine` : V1 système dans `seb-evalpro/source/kaltest/tests/planning-cantine/1.0.0/test.json`.
- `planning_cantine_r48_demo` : Restaurant R48 indépendant, source `seb-evalpro/r48-demo/planning-restaurant-builder-r48.json`. Version en correction sur les captures du 11/10/2026 : **ne pas la classer validée**.
- `traitement-texte-bureautique` : corrections de barre d'outils non validées visuellement au 11/10/2026.
- `construction-briques` : comportement signalé bon ; présence de l'image LEGO vérifiée dans le code, rendu final à contrôler.
- `redaction-email` : fonctionnement signalé bon ; image finale à remettre/contrôler.

## Inventaire des définitions V1 présentes dans le code (24)

Cet inventaire indique **la présence technique**, pas l'approbation des versions.

| Identifiant | Statut | Chemin de travail (non gelé) |
|---|---|---|
| autoevaluation-savoirs | À inventorier : version dans le code, **validation non attestée par ce dossier** | `seb-evalpro/source/kaltest/tests/autoevaluation-savoirs/1.0.0/test.json` |
| autoevaluation-tic | À inventorier : version dans le code, **validation non attestée par ce dossier** | `seb-evalpro/source/kaltest/tests/autoevaluation-tic/1.0.0/test.json` |
| calculs-commandes-atelier | À inventorier : version dans le code, **validation non attestée par ce dossier** | `seb-evalpro/source/kaltest/tests/calculs-commandes-atelier/1.0.0/test.json` |
| calculs-poids-volumes | À inventorier : version dans le code, **validation non attestée par ce dossier** | `seb-evalpro/source/kaltest/tests/calculs-poids-volumes/1.0.0/test.json` |
| construction-briques | À inventorier : version dans le code, **validation non attestée par ce dossier** | `seb-evalpro/source/kaltest/tests/construction-briques/1.0.0/test.json` |
| conversions-atelier-expedition | À inventorier : version dans le code, **validation non attestée par ce dossier** | `seb-evalpro/source/kaltest/tests/conversions-atelier-expedition/1.0.0/test.json` |
| dictee-professionnelle | À inventorier : version dans le code, **validation non attestée par ce dossier** | `seb-evalpro/source/kaltest/tests/dictee-professionnelle/1.0.0/test.json` |
| fin-parcours | À inventorier : version dans le code, **validation non attestée par ce dossier** | `seb-evalpro/source/kaltest/tests/fin-parcours/1.0.0/test.json` |
| fractions-preparation-lots | À inventorier : version dans le code, **validation non attestée par ce dossier** | `seb-evalpro/source/kaltest/tests/fractions-preparation-lots/1.0.0/test.json` |
| genre-nombre | À inventorier : version dans le code, **validation non attestée par ce dossier** | `seb-evalpro/source/kaltest/tests/genre-nombre/1.0.0/test.json` |
| gestes-postures | À inventorier : version dans le code, **validation non attestée par ce dossier** | `seb-evalpro/source/kaltest/tests/gestes-postures/1.0.0/test.json` |
| gratte-ciel | À inventorier : version dans le code, **validation non attestée par ce dossier** | `seb-evalpro/source/kaltest/tests/gratte-ciel/1.0.0/test.json` |
| horaires-reception-controle | À inventorier : version dans le code, **validation non attestée par ce dossier** | `seb-evalpro/source/kaltest/tests/horaires-reception-controle/1.0.0/test.json` |
| introduction-parcours-base | À inventorier : version dans le code, **validation non attestée par ce dossier** | `seb-evalpro/source/kaltest/tests/introduction-parcours-base/1.0.0/test.json` |
| organisation-demenagement | À inventorier : version dans le code, **validation non attestée par ce dossier** | `seb-evalpro/source/kaltest/tests/organisation-demenagement/1.0.0/test.json` |
| paronymes-rapport | À inventorier : version dans le code, **validation non attestée par ce dossier** | `seb-evalpro/source/kaltest/tests/paronymes-rapport/1.0.0/test.json` |
| planning-cantine | À inventorier : version dans le code, **validation non attestée par ce dossier** | `seb-evalpro/source/kaltest/tests/planning-cantine/1.0.0/test.json` |
| ranger-stock | À inventorier : version dans le code, **validation non attestée par ce dossier** | `seb-evalpro/source/kaltest/tests/ranger-stock/1.0.0/test.json` |
| redaction-email | À inventorier : version dans le code, **validation non attestée par ce dossier** | `seb-evalpro/source/kaltest/tests/redaction-email/1.0.0/test.json` |
| structure-3d-papier | À inventorier : version dans le code, **validation non attestée par ce dossier** | `seb-evalpro/source/kaltest/tests/structure-3d-papier/1.0.0/test.json` |
| texte-a-trous-stage-logistique | À inventorier : version dans le code, **validation non attestée par ce dossier** | `seb-evalpro/source/kaltest/tests/texte-a-trous-stage-logistique/1.0.0/test.json` |
| traitement-texte-bureautique | À inventorier : version dans le code, **validation non attestée par ce dossier** | `seb-evalpro/source/kaltest/tests/traitement-texte-bureautique/1.0.0/test.json` |
| transition-video-f1 | À inventorier : version dans le code, **validation non attestée par ce dossier** | `seb-evalpro/source/kaltest/tests/transition-video-f1/1.0.0/test.json` |
| tri-chevilles | À inventorier : version dans le code, **validation non attestée par ce dossier** | `seb-evalpro/source/kaltest/tests/tri-chevilles/1.0.0/test.json` |

## Prochaine étape

Établir pour chaque exercice une fiche de version réellement approuvée, identifier le commit exact, puis copier l'ensemble de ses fichiers nécessaires dans un emplacement immuable de ce référentiel. Ne publier aucune déclaration globale de validation avant cette vérification.
