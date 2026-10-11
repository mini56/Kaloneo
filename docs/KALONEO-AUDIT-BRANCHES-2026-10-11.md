# Audit des branches et consolidation KALONÉO — 11 octobre 2026

**Branche de travail conservée :** `fix-v1-tri-mail-nwtexte-20261010`. Aucun changement de branche ni écrasement de version validée. **Point d'arrivée :** R59 (0.0.88), après un contrôle des comparaisons d'ascendance de toutes les branches listées (92 au total au début de l'audit).

## Conclusions vérifiables

- **Socle principal :** toutes les branches `test-builder-r3` à `r45` et la lignée R47–R48.4, R48.6–R48.7 sont des ancêtres de la branche consolidée. Leurs commits ne sont pas effacés. Cette vérification porte sur l'histoire Git, pas sur une recette fonctionnelle humaine de chaque bouton.
- **R48.10 — colonnes automatiques :** branche parallèle contenant 2 commits absents de l'histoire directe. Le correctif *général* est réintégré en R58 dans Builder, aperçu et moteur candidat, avec contrôle Electron 6 colonnes, Vendredi, 15 sélections et priorité à la largeur manuelle. Leurs deux SHA originaux restent sur leur branche.
- **R48.5 — Restaurant :** branche parallèle de 3 commits. La compression du tableau est couverte en R58 par la règle générale R48.10 (sans revenir à un traitement spécial par identifiant). Sa **protection indépendante du texte devant une image décorative** était absente ; restaurée en R59, avec contrôle Electron.
- **R48.8 / R48.9 — expériences parallèles de colonnes égales :** 2 et 4 commits non inclus dans la filiation. Ce sont des solutions spécifiques ou transitoires, remplacées par l'approche générale R48.10. Leurs branches et leur code restent archivés.
- **R46 `test-builder-r46-images-layout-typography` :** branche expérimentale contenant 19 commits et 11 images `.jpg` sous des chemins différents. La lignée R47 intégrée contient des `.webp` correspondantes référencées dans les définitions de test. Les vieux JPG ne sont pas arbitrairement mélangés aux images actuelles. L'identité pixel à pixel des deux séries n'a pas été démontrée.
- **R55 NWTEXT :** présentation validée par l'utilisateur, conservée et protégée par les contrôles de consolidation.
- **R56/R57 :** éditeur capable d'enregistrer malgré un bloc média vide et affichage d'icône sur la vraie page candidat (contrôles Node/Electron verts).
- **Import/export :** contrôles automatiques du contrat JSON et de l'embarquement des références média exécutés ; **pas** de transfert physique réel entre deux installations Windows différentes. La validité complète avec moteurs externes et bilan reste à certifier.
- **Branche `main` :** contient des originaux sous `images_tests/` et le README `TESTS_V1/` absents de la branche de travail ; ce sont des sources Git conservées sur `main`, pas des fonctions candidat à remplacer automatiquement. Aucun original n'est effacé ni publié par cette consolidation.
- **Anciennes branches `pilot` divergentes et workflows alternatifs :** comparées en ascendance et gardées en réserve ; certaines correspondent à des prototypes ou à des workflows Windows d'une autre génération, qu'il serait dangereux de fusionner automatiquement dans le programme actuel.

## Vérifications disponibles

Le workflow R59 doit passer ses tests existants (parcours historique, résultats, bilan, bibliothèque, versions protégées, pages candidat, tests d'images et rendu Electron), les tests R48.10 pour le tableau général et les vérifications supplémentaires de l'exclusion décorative R48.5.

**Limites :** une histoire Git incluse et une compilation réussie ne certifient pas tous les scénarios métier ; aucune déclaration « zéro régression sur absolument toutes les fonctions » sans une suite de tests couvrant chacune. Ne pas demander à l'utilisateur de rejouer intégralement chaque parcours : étendre les tests automatiques lorsque des lacunes sont identifiées.

**Règle pour la suite :** une seule branche de travail, des tags de release immuables, un inventaire des validations et des contrôles avant toute nouvelle livraison ; aucune modification d'un test visuellement validé sans accord explicite.
