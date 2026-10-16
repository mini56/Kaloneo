# Entretien obligatoire du mode d’emploi KALONÉO — Test Builder

Le guide utilisateur est un **composant fonctionnel** du Builder, et non une documentation facultative.

## Sources

- `kaloneo/help/index.html` : rubriques, explications, exemples, mots-clés et rattachement des boutons.
- `kaloneo/help/help.js` : recherche instantanée, navigation, impression et utilisation hors ligne.
- `kaloneo/help/help.css` : style et impression.
- `kaloneo/help/figures/*.svg` : schémas techniques locaux (pas des captures réelles).
- `kaloneo/test-builder.html`, `.js` et `.css` : bouton vert Aide et dialogue.
- `seb-evalpro/scripts/kaloneo-builder-help-guard.js` : contrôle bloquant appelé par la vérification de parité Builder durant `npm run prepare:web`.

## Règle de livraison

Toute fonction **nouvelle ou modifiée** du Builder doit, dans le même changement :
1. mettre à jour une rubrique ou créer une rubrique pédagogique ;
2. décrire les étapes visibles par une personne débutante, le résultat et les erreurs possibles ;
3. indexer les mots-clés dans `data-tags` ;
4. rattacher chaque nouveau bouton statique à une rubrique via `data-controls` ;
5. actualiser les schémas locaux lorsque l’interface change ;
6. obtenir un test automatique et un essai Electron.

Le contrôle bloquant détecte les boutons statiques et les types de blocs non documentés, l’absence d’une rubrique essentielle, les erreurs de recherche et les ressources illustrées manquantes. Il ne peut pas déceler chaque évolution de comportement interne : **une revue du texte d’aide reste obligatoire à chaque modification fonctionnelle**.

## Précautions

- Aucun changement aux tests V1 validés, aux images ou aux données du parcours candidat.
- Ne pas toucher à la gestion du focus du moteur candidat.
- Aide utilisable entièrement hors ligne, sans CDN ni police externe.
- Ne pas expliquer ou promettre de fonctions inexistantes.
- Conserver le fichier HTML autonome, en plus de sa fenêtre intégrée.
- Ne pas forcer le curseur à l’ouverture de l’aide dans le Builder.
- Pas de nouvelle branche ni de Setup sans accord explicite.

## Vérifications avant publication

Depuis le répertoire `seb-evalpro`, lancer `npm run prepare:web`, `node scripts/kaloneo-builder-help-guard.js` et les contrôles Electron du Builder.

Tester manuellement les recherches « bloc », « barème », « unité », « image », le suivi des liens, les six schémas hors ligne et la fermeture de l’aide sans altérer le test en cours.
