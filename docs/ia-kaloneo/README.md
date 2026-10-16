# Kit IA KALONÉO — création de tests KALTEST

Édition du 16 octobre 2026 — Builder 2.0.0 / KALTEST format 1. Source : `kaloneo/builder-core.js`, branche `fix-r60-tri-rearm-only-20261011`.

**But :** permettre à une IA qui ne connaît pas KALONÉO de produire un `test.json` autonome, contrôlable, et importable dans le logiciel. Les postes candidats restent hors ligne.

## Utilisation

1. Fournir à l'IA **les trois fichiers** `PROMPT-MAITRE.md`, `CONTRAT-IA.md` et `exemples/calculs-stock-demo.test.json` ; le prompt seul ne suffit pas.
2. Lui demander un exercice : thème, public, niveau, nombre de questions, barème, unités, etc. Sans autre précision, niveau CAP, phrases claires et situations professionnelles.
3. Télécharger son fichier `test.json`, et vérifier avec la vraie logique du Builder : `node docs/ia-kaloneo/valider-test.js CHEMIN/test.json` depuis la racine du dépôt.
4. Importer ensuite dans **Tests / Parcours → Import / Export → Importer un test**, ouvrir le Builder et utiliser **Aperçu**.
5. Avant usage, vérifier en Electron un parcours candidat, les réponses fausses/justes, Résultats, Bilan et un export/import si nécessaire.

Le vérificateur est en lecture seule. Pour l'auto-test de ce kit : `node docs/ia-kaloneo/test-validateur.js`.

## Composition

- `PROMPT-MAITRE.md` — prompt réutilisable avec une autre IA.
- `CONTRAT-IA.md` — structure actuelle et règles de notation.
- `exemples/calculs-stock-demo.test.json` — définition de démonstration **hors du catalogue V1**.
- `valider-test.js` — garde stricte utilisant `KaloneoBuilderCore.analyzeDefinition` et un aller-retour Builder.
- `test-validateur.js` — validations positive et négatives.
- Workflow GitHub existant : déclenche les tests, sans construire de Setup.

## Limites

Le programme, pas l'IA, a toujours le dernier mot. Le contrôleur de ce kit ne peut pas prouver seul la fidélité des pixels, les performances Windows, ni un parcours candidat complet. Le contrôle actuel de l'import est volontairement plus léger que cette garde pré-import : **ne pas l'utiliser comme seul test de compatibilité**. Les images/audio/vidéo nécessitent des octets embarqués réels ; pas d'URL ni de chemins fictifs. Les V1 validées, tests de candidats et dossiers `TESTS_VALIDES` ne sont jamais modifiés par ce kit. Ne pas utiliser un ID/version déjà utilisé. Toute évolution future de KALTEST nécessite une mise à jour de ce kit.


## Extensions IA — Fractions et pourcentages en images cliquables

Un nouvel exemple autonome et hors ligne est disponible : `exemples/fractions-pourcentages-images-selection.test.json`.
Le programme candidat sait déjà afficher des groupes d'objets illustrés cliquables avec `presentation.fractionSelection`. Le candidat choisit **la bonne quantité** ; `acceptedCount` fixe le nombre exact. Les 3 groupes de l'exemple valent 3 points.

**Limite actuelle du Builder** : les groupes ne disposent pas encore d'éditeur visuel dédié. Le Builder peut montrer une liste de questions simplifiée, mais le vrai candidat affiche les objets sélectionnables. Tester la page candidat Electron avant de l'utiliser. Ne pas mélanger `fractionSelection` et `builderContent`, ce dernier désactiverait la sélection spécifique.
