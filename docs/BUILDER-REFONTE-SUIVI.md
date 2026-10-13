# KALONÉO — Suivi de la refonte générique du Builder

## Référence et périmètre

- Date de reprise : 13 octobre 2026.
- Référentiel de décisions : `docs/KALONEO-DECISIONS-VALIDEES.md` (registre historique ; certaines décisions récentes restent à rapprocher des échanges et du code).
- Dépôt : `mini56/SEB-EVAL-PRO-Kaloneo`.
- Branche existante : `fix-r60-tri-rearm-only-20261011`. Ne pas créer de branche pour cette intervention, ni modifier `main`.
- Version installable de secours : **R91 / Build #96**. Ne pas publier de Setup avant validation visuelle.
- Premier point contrôlé de la refonte : `43f2f625604e0f75a1c9f2823578fb54d7e998a7`, run `38399806403` (SUCCESS).
- Étape HTML Builder + aperçu Electron : `9cbef014ff4aa64d075c2bb2a6b1657cdfa123bd`, run `38416144645` (SUCCESS).

## Principes non négociables

1. Corriger le **moteur**, jamais un test particulier ; tout test nouveau doit fonctionner sans cas spécial.
2. Même structure de rendu entre Builder, aperçu et candidat, tout en préservant les comportements spécifiques légitimes (réponses, notation, éditeur Quill, sandbox).
3. Ne pas modifier les fichiers des tests V1 validés, leur barème, leurs médias, leurs réponses ou les dossiers validés.
4. Préserver Annuler/Rétablir, le focus de saisie, sauvegarde et import/export, résultats et bilans, navigation et affichage des deux colonnes.
5. Une CI verte atteste que **les contrôles automatisés réussissent**, pas que l'affichage, la fluidité et toutes les interactions sont corrects.
6. Aucun nouveau Setup / Release avant contrôle réel et validation explicite. Un numéro de build ne doit jamais être réutilisé.

## État de la mise en commun

- Colonnes, questions génériques, médias, tableaux de réponses, grilles et textes à trous : appels vers `kaloneo/shared-presentation.js`, contrôlés dans les précédentes étapes.
- HTML/JS : le Builder et l'aperçu Electron utilisaient déjà `renderHtmlFrame` ; raccordement complémentaire du **vrai moteur candidat** lors de cette reprise.
- Le Builder utilise `block.js`, le KALTEST exécuté utilise `item.script`. Le moteur commun accepte les deux sans modifier les paquets.
- Les attributs de sandbox, classes CSS et styles de corps existants restent paramétrables par écran.
- Contrôle de non-régression ajouté pour HTML et HTML/JS d'un **exercice fictif inédit** dans les trois vues ; ce contrôle n'est pas à lui seul un test visuel Electron.

## À vérifier avant de considérer la refonte terminée

- Tester visuellement dans Electron des tests entièrement nouveaux, pas seulement le catalogue ni une capture isolée.
- Vérifier largeur 50/50, 40/60, 60/40, largeurs en caractères ; textes, tableaux et grilles fusionnées ; images et médias ; textes à trous ; HTML/JS.
- Vérifier le **vrai éditeur candidat Quill** : la maquette d'éditeur du Builder et celle de l'aperçu Electron ne sont pas encore équivalentes au ruban réel NWTEXT. Ne pas remplacer Quill sans test d'interaction, de sauvegarde et de notation.
- Réexaminer les présentations historiques complexes (`multiple-tables`, `table-definition`, `legacy`) sans créer d'exception liée à un identifiant de test.
- Contrôler le focus, les pertes de curseur, Annuler/Rétablir après aperçu Electron, l'activité périodique en arrière-plan et les performances lors d'une édition prolongée.
- Vérifier régression sur NWTEXT, Tri de chevilles, Briques, Restaurant, Résultats/Bilan et export/import.

## Règle de validation

Chaque étape doit consigner **le commit, le run CI et le résultat d'une vérification fonctionnelle réelle**. Ne jamais utiliser « testé à 100 % » sur la seule base de CI. R91 reste le secours installable jusqu'à validation.
