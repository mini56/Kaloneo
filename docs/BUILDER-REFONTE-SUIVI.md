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

## Contrôle Electron ajouté le 13 octobre 2026

- Script de test : `seb-evalpro/scripts/kaloneo-shared-html-candidate-electron-smoke-main.js` ; déclenché par `.github/workflows/verify-tri-rearm-r60.yml`.
- Construction à l'exécution d'un exercice inédit à deux colonnes, avec HTML simple et HTML/JS ; aucun KALTEST validé n'est modifié.
- Vérifie le DOM candidat, la taille et la position visibles des iframes, l'isolation du HTML simple, l'exécution du script HTML/JS, une capture Electron non vide et l'absence de sauvegarde candidat.
- Ce contrôle complète mais **ne remplace pas** une comparaison visuelle humaine entre le Builder, Electron et l'application installée.

## Textes enrichis : nouvelle étape de refonte

- Suppression des trois interpréteurs dupliqués des balises de texte `[b]`, `[i]`, `[u]`, `[c=#RRGGBB]` et des retours de ligne.
- Fonction unique `renderRichContext` dans `kaloneo/shared-presentation.js`, appelée par le Builder, l'aperçu et le véritable moteur candidat ; aucun changement de la structure KALTEST, des barèmes ou du CSS.
- Contrôle générique Node ajouté (imbrication, couleurs, sauts de ligne, rafraîchissement), complété par un contrôle du DOM réel Electron sur un exercice fictif.
- Ne pas annoncer une parité visuelle complète sur la seule base de ces contrôles.

## Dépendance du moteur commun dans l'aperçu Electron

- Le contrôleur de l'aperçu autonome consommait déjà des fonctions partagées, mais sa page HTML n'importait pas `shared-presentation.js`.
- La page `test-preview.html` importe désormais le moteur commun avant `test-preview.js`.
- Une garde CI vérifie cet ordre. Le contrôle réel Electron reste obligatoire avant toute validation de cette étape.

## Aperçu Electron — colonnes génériques raccordées

- La fonction `buildLayout` ne répartit plus elle-même les blocs dans les zones : elle délègue à `KaloneoSharedPresentation.renderZones`, utilisé aussi dans le Builder et le candidat.
- Les anciennes classes visuelles `kb-layout`, `kb-zone`, `r50-50`, `r40-60`, `r60-40` sont préservées ; le calcul des largeurs passe par la définition KALTEST ou son modèle.
- Les messages de zone vide sont conservés et ne sont pas enregistrés dans les tests.
- Tests génériques de ratios ajoutés, avec contrôle Electron existant bloquant.

## Texte à trous de l'aperçu autonome

- Le bloc `inline-flow` de l'aperçu Electron ne reconstruit plus la banque de mots et les champs avec un renderer parallèle : il délègue à `renderInlineFlow`.
- Une option générique `omitEmptyBank` préserve le rendu historique sans banque visible lorsque la liste est vide ; le Builder et le candidat conservent leur mode antérieur par défaut.
- Garde CI avec une question nouvelle, indépendante du catalogue.

## Tableaux de questions (13 octobre 2026)

- Nouveau squelette générique `renderQuestionTable` dans `shared-presentation.js`.
- Le Builder (aperçu direct des tableaux historiques) et l'aperçu Electron autonome délèguent la structure des titres, en-têtes et lignes au même module. Le rendu de chaque cellule reste un adaptateur, sans référence à un identifiant de test.
- La vue candidat `table-definition` conserve provisoirement sa présentation existante, pour éviter de modifier sans test visuel les V1 historiques.
- Un contrôle de matrice totalement inédite vérifie les lignes, en-têtes et états vides. **Cela ne vaut pas validation visuelle finale.**

## Grilles de l'aperçu Electron autonome (13 octobre 2026)

- Suppression du calcul de colonnes et de la construction des cellules en double dans `test-preview.js`.
- Cet aperçu délègue désormais ses grilles au même `renderGridTable` que le Builder et le candidat.
- Adaptateurs de cellules de l'aperçu conservés : texte fixe, image, audio, vidéo, champ, choix ; `skipHiddenCells` est local à cette vue pour maintenir son comportement antérieur.
- Les paramètres `titleTag` / `titleClassName` conservent les styles préexistants dans la fenêtre Electron autonome.
- Nouveau contrôle générique : titres, en-têtes, cellules visibles et masquées dans une grille qui n'appartient pas au catalogue.

## Tableaux de réponses de l'aperçu autonome (13 octobre 2026)

- L'aperçu Electron autonome utilise maintenant `renderResponseTable`, déjà appelé par le Builder et le candidat.
- Préservation de la ligne vide « Aucune question définie », du libellé, de l'unité et des champs de réponse propres à l'aperçu.
- Aucun changement des barèmes, des réponses ni des V1. Contrôles structurels ajoutés avec une question inexistante dans le catalogue.

## Médias de l'aperçu Electron autonome (13 octobre 2026)

- Les médias image/audio/vidéo du dernier aperçu autonome délèguent à `renderMedia` comme le Builder et le candidat.
- Conserve les chemins d'images `imageqcm/`, la taille et l'alignement, les classes CSS `kb-media`/`kb-audio`, les commandes des lecteurs et le bloc vide.
- Contrôle générique d'une image fictive, avec taille 65 % et alignement à droite ; aucune ressource du catalogue n'a été modifiée.
