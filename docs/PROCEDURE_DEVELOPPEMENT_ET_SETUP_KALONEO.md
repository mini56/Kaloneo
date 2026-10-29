# KALONÉO — Procédure permanente de développement, tests et publication

Date de référence : 29 octobre 2026.

## Règles impératives

1. **Une seule chaîne officielle pour publier** : `.github/workflows/publish-kaloneo-next-version.yml`, configuration `seb-evalpro/build/kaloneo-auto-release.yml`. Ne jamais appeler `electron-builder` sans `--config` dans un workflow de publication.
2. **Aucune régression acceptée** : ajouter une V1 ne donne jamais le droit de modifier une V1 déjà validée, le moteur, les bilans, les données candidats, les mots de passe ou l'installateur.
3. **Source et branche claires** : identifier la version validée de chaque test avant tout déplacement. Depuis le correctif `d3fe8265`, `seb-evalpro/scripts/kaloneo-testsv1.js` utilise exclusivement les fichiers `TESTS_V1` présents dans la branche compilée (`fix-r186-kaltest-source-unique-20261027`). L'import destructeur depuis `main` a été supprimé. Conserver ce principe et vérifier toute nouvelle V1 avant publication. Ne jamais déplacer ou supprimer des fichiers de `main` sans adapter et tester cette dépendance.
4. **Identifiants différents des chemins** : un ID tel que `planning_trimestriel` peut être installé sous `planning-trimestriel/1.0.0/test.json`. Ne pas deviner les chemins dans les workflows : vérifier les chemins générés selon les conventions de `loadOfficialOverrides` ou le manifeste `TESTS_V1-manifest.json`.
5. **Contrôles avant compilation** : valider tous les JSON, les images réellement présentes et utilisables, les IDs, questions, barèmes et liaisons officielles des bilans; contrôler le nombre réel de tests et la documentation hors ligne. Échouer avec un message précis sans modifier les données.
6. **Tests de non-régression** : lancer les vérifications automatiques existantes des anciennes V1, du Builder et du focus Windows, des bilans Word, du chiffrement candidats et Replay, de l'installation et de la mise à jour réelle. Ne pas supprimer un test bloquant pour obtenir du vert.
7. **Ressources Windows** : générer les icônes, médias et ressources NSIS par les scripts officiels; vérifier leurs chemins avant `electron-builder`.
8. **Publication** : numéro automatique cohérent dans programme et Setup, binaire validé, fichier SHA256, puis copie vérifiée dans `mini56/Kaloneo-MAJ`. Une étape rouge signifie : pas de nouvelle mise à jour annoncée comme disponible.
9. **Traçabilité** : enregistrer dans le commit le diagnostic, les fichiers touchés, les résultats des contrôles et le numéro de run. Conserver l'historique des échecs. Documenter toute modification des règles de compilation.
10. **Pas d'essais successifs improvisés** : avant de relancer un run rouge, lire l'erreur exacte, vérifier les vrais chemins et les branches, faire une correction ciblée, puis relancer **une fois**. Ne pas lancer de workflows concurrents pour le même Setup.

## Incident ayant motivé cette procédure

Le 29 octobre 2026, plusieurs workflows échouaient alors que des V1 avaient déjà été validées :
- Un ancien workflow lançait `electron-builder` sans configuration officielle, entraînant l'absence de `build/app-icon.ico` et l'utilisation des métadonnées historiques SEB.
- La synchronisation de `TESTS_V1` depuis `main` remplaçait la définition validée du test Bon de transport par une ancienne version (champ durée).
- Un contrôle supposait un dossier `planning_trimestriel` alors que l'intégrateur générait `planning-trimestriel`.

Ces causes sont des erreurs du processus de livraison, **pas des motifs pour altérer les V1 validées**.

## Procédure opérationnelle pour chaque nouvelle V1

1. Ajouter uniquement le JSON et les images nécessaires dans la source officielle choisie.
2. Comparer le catalogue avant/après : seules les V1 explicitement ajoutées ou autorisées doivent changer.
3. Générer les ressources et importer les V1 via le mécanisme existant; contrôler le manifeste et le contenu de `app/web/kaltest/tests`.
4. Lancer les tests de non-régression et conserver leurs résultats.
5. Déclencher le workflow unique de release seulement après cette validation.
6. Vérifier que l'ensemble du run est vert, que le Setup et le SHA256 sont publiés dans `Kaloneo-MAJ` et que la mise à jour est réellement accessible au programme.

**Cette procédure ne remplace pas les protections techniques** : l'étape suivante consiste à automatiser les comparaisons des V1 validées et les contrôles des chemins à partir du manifeste, sans chemins codés en dur.
