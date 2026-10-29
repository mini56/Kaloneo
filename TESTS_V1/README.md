# TESTS_V1 — références officielles des tests KALONÉO

Ce dossier contient **uniquement les tests V1 validés** devant remplacer, lors des prochaines compilations, leurs équivalents fournis initialement avec SEB EvalPro.

## Dépôt d'une correction

1. Ouvrir le test dans le Builder, avec les droits Développeur.
2. Corriger et contrôler la page dans l'aperçu Electron réel.
3. Exporter le test complet en JSON, sans changer son **identifiant** ni sa **version 1.0.0**.
4. Déposer le fichier dans `TESTS_V1/` sur la **branche de compilation active `fix-r186-kaltest-source-unique-20261027`**. Utiliser le nom exporté par le Builder, par exemple `planning_trimestriel-1.0.0-test.json` (ou l'ancien format `planning_trimestriel.json`). L'identifiant contenu dans le fichier doit correspondre au nom.

Une compilation raccordée au mécanisme TESTS_V1 doit contrôler les fichiers puis utiliser les V1 présentes ici en priorité sur les V1 historiques. Un test absent de ce dossier conserve la V1 historique. Les versions V2 ou ultérieures ne sont jamais remplacées.

**Important :** déposer un fichier ici ne modifie pas rétroactivement une application déjà installée. La compilation suivante doit embarquer la nouvelle référence, et la mise à jour doit synchroniser la bibliothèque locale. La compilation lit exclusivement `TESTS_V1` dans la branche compilée. **Ne pas synchroniser automatiquement depuis `main`** : cette pratique a provoqué la régression du Bon de transport le 29 octobre 2026. Les tests sont transférés vers la branche de compilation par commit vérifié, sans écrasement silencieux.

Ne jamais déposer de dossier de candidat, de données personnelles ou de secrets dans ce répertoire. Les images propres au test peuvent être incluses dans l'export JSON : le préparateur les extrait en fichiers média dédiés pour le Setup. Vérifier leur restitution et leur intégrité dans l'aperçu Electron et dans le Setup.

Les fichiers V1 historiques restent conservés dans `seb-evalpro/source/kaltest/tests/` pour permettre des comparaisons et des restaurations. La validation d'un nouveau fichier TESTS_V1 doit se faire dans Electron avant toute compilation diffusée.
