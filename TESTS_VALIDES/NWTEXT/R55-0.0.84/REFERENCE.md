# NWTEXT — référence approuvée R55 / 0.0.84

**Validation par l'utilisateur : 11 octobre 2026 — présentation visuelle uniquement.**

La définition réelle du test, copiée sans modification de la release R55, est : [test.json](test.json).

- Identifiant : `traitement_texte_bureautique`
- Version de la définition : `1.0.0`
- Release immuable : `seb-kaloneo-v1-fixes-r55-test`
- Commit exact : `7307989d9ee4fcef1a1afd591e4ba66f6a8e9478`
- Git SHA du `test.json` approuvé : `82d78865c0110a4d63d6d40ce7e6bcb8523f13b1`

## Présentation à préserver

Deux rangées de boutons alignés verticalement, un long emplacement blanc inactif à droite de chaque rangée, photographie réelle de la machine à écrire, scénarios/consignes et surface d'édition conformes à la capture validée par l'utilisateur.

## Dépendances de référence (au commit R55 exact)

Ces éléments définissent l'affichage et le comportement du test. Ils restent stockés dans leurs dossiers existants pour éviter des doubles copies et ne pas perturber le programme.

| Élément | Chemin canonique | Git SHA |
|---|---|---|
| Mise en page de la page candidat / barre d'outils | `seb-evalpro/source/css/kaltest-pilot2.css` | `136cfb1355061bba2b215414aff9231de1c41c1f` |
| Structure de l'éditeur | `seb-evalpro/source/js/kaltest-pilot2-runtime.js` | `5c4c67abc44d48029e5ae2a6c59062ee3423124c` |
| Moteur Quill | `seb-evalpro/source/js/nwtexte-quill-engine.js` | `f745143848c18ded104893183cd2ce4df3cf05e4` |
| Fenêtres d'ouverture | `seb-evalpro/source/js/nwtexte-closed-dialogs.js` | `96569007798558caaa9f24033c787fe7ef67fde2` |
| Enregistrement | `seb-evalpro/source/js/nwtexte-save-simulation.js` | `2bdf297459d5fa5250f37b26f941e04767ca7224` |
| Photo validée, unique source | `seb-evalpro/source/assets/typewriter-reference.png` | `4e8054b00be6ffda45806f6418bbe9b230a186ae` |

## Périmètre de validation et portabilité

**Ce fichier test.json est bien une copie de la définition R55 et contient la déclaration des résultats et du bilan. Ce n'est pas encore un export autonome certifié.** La photo est référencée par la feuille de style et le moteur d'édition se trouve dans le programme, pas dans ce fichier. Le réimport sur un autre PC ne doit pas être déclaré testé sans un contrôle de bout en bout (image, édition, score sur 8, Résultats et Bilan).

**Aucune modification directe de la version de référence.** Toute évolution nécessite une nouvelle version candidate et un contrôle de non-régression contre la R55. Ne pas confondre cette validation de présentation avec la validation fonctionnelle intégrale.
