# KALONÉO — Audit des branches et consolidation R58 (11/10/2026)

## Source de vérité
- Branche de travail unique conservée : `fix-v1-tri-mail-nwtexte-20261010`.
- Release technique test : `seb-kaloneo-v1-fixes-r58-test`.
- **Commit figé du Setup R58 :** `cb2598e7d3ff16f3ae6cdc1a246d21909aeaa7a6`.
- Setup : `SEB-EvalPro-Kaloneo-PILOTE-22-R58-0.0.87-Windows-Setup.exe`.
- Exécution GitHub Actions : `38131370800`, conclusion **SUCCESS**.

## Inventaire
Les 92 branches connues ont été recensées ; les 91 branches autres que la branche active ont été comparées par leur historique Git, sans fusion aveugle. Les commits des étapes validées R33 à R48.7 sont dans l'ascendance de la branche actuelle. Les travaux de R48.10 qui manquaient ont été réintégrés en R58. Les variantes R48.5, R48.8 et R48.9 restent des branches expérimentales distinctes et ne sont pas promues à la place du rendu R48.10.

Des branches historiques pilot et des développements parallèles possèdent des commits divergents. Ils ne constituent pas automatiquement des validations et ne doivent pas être fusionnés sans examen fonctionnel ciblé.

## Vérifications factuelles
- Parmi les **24 JSON V1** présents dans R47, **23 sont identiques octet pour octet** dans R58 (même SHA Git) ; seule la définition `redaction-email/1.0.0/test.json` a changé pour la correction demandée de NWMAIL.
- R58 a récupéré la règle générale R48.10 : largeur automatiquement égale pour toutes les colonnes non définies, dans l'éditeur, ses aperçus et le rendu réel candidat. Le test Electron générique R48.10 est passé.
- NWTEXT : la présentation sur deux rangées approuvée en R55 reste la référence visuelle. Le moteur Quill et ses raccordements restent dans le programme.
- Icônes : la sélection du Builder est visible dans la page candidat ; un smoke Electron spécifique est passé.
- Enregistrement Builder avec média vide, portabilité JSON, régression consolidée et contrôles généraux : étapes automatiques **SUCCESS** dans le run R58.

## Images
Les **14 fichiers originaux HD** qui étaient présents sous `images_tests/` sur la branche `main` sont repris ici sous les **mêmes chemins**, avec les **mêmes Git blob SHA**, par référence aux objets existants : aucun fichier binaire n'a été recréé ou recompressé. Ceci ne modifie pas les images déjà affichées par les tests ni le contenu du Setup R58.

## Limites : ne pas faire de fausse validation
Cette consolidation ne prouve pas que l'ensemble des fonctions de 92 branches a été exécuté sur les postes candidats. Les tests automatiques contrôlent les régressions couvertes. Un transfert complet entre deux installations Windows (images et résultats/bilan) n'est pas encore certifié, et la validation visuelle par l'utilisateur ne concerne que les parties explicitement approuvées.

**Règle :** ne pas remplacer les tests et ressources approuvés sans autorisation ; tout changement ultérieur doit être testé avant un nouveau Setup. Les documents sous `TESTS_VALIDES` ne remplacent pas automatiquement les exports JSON autonomes certifiés.
