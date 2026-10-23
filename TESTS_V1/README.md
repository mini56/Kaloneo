# TESTS_V1 — références officielles des tests KALONÉO

Ce dossier contient **uniquement les tests V1 validés** devant remplacer, lors des prochaines compilations, leurs équivalents fournis initialement avec SEB EvalPro.

## Dépôt d'une correction

1. Ouvrir le test dans le Builder, avec les droits Développeur.
2. Corriger et contrôler la page dans l'aperçu Electron réel.
3. Exporter le test complet en JSON, sans changer son **identifiant** ni sa **version 1.0.0**.
4. Déposer le fichier sous le nom exact **`<identifiant>.json`** dans ce dossier, sur la branche `main`. Exemple : `planning_cantine.json`, contenant `"id":"planning_cantine"`.

Une compilation raccordée au mécanisme TESTS_V1 doit contrôler les fichiers puis utiliser les V1 présentes ici en priorité sur les V1 historiques. Un test absent de ce dossier conserve la V1 historique. Les versions V2 ou ultérieures ne sont jamais remplacées.

**Important :** déposer un fichier ici ne modifie pas rétroactivement une application déjà installée. La compilation suivante doit embarquer la nouvelle référence, et la mise à jour doit synchroniser la bibliothèque locale. Les branches de compilation doivent également récupérer la version courante de ce dossier depuis `main` (un ancien checkout de branche n'est pas à jour automatiquement).

Ne jamais déposer de dossier de candidat, de données personnelles ou de secrets dans ce répertoire. Les images propres au test doivent être incluses dans l'export JSON.

Les fichiers V1 historiques restent conservés dans `seb-evalpro/source/kaltest/tests/` pour permettre des comparaisons et des restaurations. La validation d'un nouveau fichier TESTS_V1 doit se faire dans Electron avant toute compilation diffusée.
