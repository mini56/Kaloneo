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

## Questions de l'aperçu autonome (13 octobre 2026)

- Les questions simples de l'aperçu Electron autonome passent désormais par `renderQuestion`, déjà partagé entre Builder et candidat.
- Options facultatives `rowTag` et `captionClassName` : le mode aperçu utilise `div` pour éviter une étiquette englobant d'autres étiquettes dans les QCM ; le candidat et le Builder conservent le comportement par défaut.
- Les types de réponses, options, champs d'unité et styles de l'aperçu sont maintenus.
- Contrôle d'une question fictive sans référence à un test connu.

## Protection du curseur au changement de test (13 octobre 2026)

- Run rouge `38428061612` : perte de focus après une frappe/pause et sur le sélecteur suivant.
- Protection du `requestAnimationFrame` différé de `focusTitleField()` : si un champ reçoit le focus entre-temps, la demande vers le titre est abandonnée. Applicable à tous les blocs.
- Aucun KALTEST ni barème modifié. Le contrôle Electron existant vérifie la pause et la transition de focus.

## Essai Electron sur test synthétique indépendant du catalogue (13 octobre 2026)

- Nouveau smoke `seb-evalpro/scripts/kaloneo-new-test-preview-electron-smoke-main.js` intégré à la CI.
- Construit directement un KALTEST inédit sans importer aucun test existant : grille, tableau de réponses, tableau de questions, image et deux zones.
- Contrôle dans le véritable Electron : lignes/en-têtes, géométrie des colonnes, saisies, image, fermeture, capture et absence de sauvegarde candidat.
- N'est pas une validation humaine des pixels ni de la fluidité d'une version installée.

## Parité Electron autonome / vrai moteur candidat (13 octobre 2026)

- Le smoke d'un test entièrement **inédit** charge maintenant successivement l'aperçu autonome et le **vrai moteur candidat**, avec une seule et même définition KALTEST.
- Comparaison ciblée des deux colonnes, grille, tableau de réponses, champs, médias, textes et captures ; aucun test V1 modifié.
- La présentation `table-definition` reste volontairement contrôlée au niveau des questions et non des en-têtes : son DOM historique candidat n'est pas encore harmonisé. Cette dette doit être traitée génériquement et avec contrôle visuel préalable.

## Aperçu du Builder — correction du rendu après essai R92 (13 octobre 2026)

- Retour utilisateur : le visuel dans le Builder est insuffisant, par exemple sur Tri de chevilles. C'est l'aperçu direct, pas une autorisation de modifier les V1.
- Constat dans le code : `refreshRealMiniPreview()` désactivait toujours les captures photographiées du moteur candidat. Les rendus spécialisés n'avaient donc aucun équivalent visuel dans le DOM simplifié.
- Correction générique : pendant la frappe, le DOM direct reste réactif ; après une pause, le Builder affiche le rendu réel du moteur candidat Electron grâce à la fonctionnalité déjà présente. Les anciennes captures sont masquées immédiatement à la nouvelle frappe ; le bouton Aperçu ouvre toujours le vrai écran interactif.
- Aucune modification des tests ou médias. Les demandes de capture sont déclenchées par les changements, sans polling, et sérialisées côté Electron.
- Contrôle Electron de non-régression : capture fictive pour tester le branchement de l'image, la reprise du focus et l'invalidation pendant la frappe. Une inspection visuelle humaine de l'application sera encore nécessaire.
- R92 Build #97 reste la version installable jugée correcte avant ce correctif. R91 reste le secours.

## Arrêt des processus de miniature Electron (13 octobre 2026)

- Les trois tests réels montrés par l'utilisateur (Puzzle Gratte-Ciel, Stock et Tri de chevilles) affichent correctement le rendu candidat dans le Builder R93. **Préserver ce rendu visuel.**
- Le processus invisible `kaloneoMiniPreviewWorker` conservait une page candidat après la capture avec `backgroundThrottling:false` et `offscreen:true`. Des scripts pouvaient continuer en arrière-plan.
- Correction générale : libérer le worker dans un bloc `finally` après capture ou erreur, effacer sa définition et prévenir la suppression de la référence d'un worker plus récent par un événement `closed` tardif. La capture déjà affichée est conservée.
- Contrôle du vrai handler IPC avec quatre tests fictifs : succès, page non prête, erreur de capture puis nouveau succès, plus contrôle de file sérialisée et refus d'appel non autorisé.
- L'origine exacte de l'activité périodique Windows n'est pas encore établie. Aucun fichier V1, image, barème ni CSS changé. Aucune nouvelle Release ni Setup pour cette étape.

## Rafales de saisie et demandes de capture périmées (13 octobre 2026)

- Pour tous les tests présents et futurs, les demandes de capture Electron sont maintenant identifiées par une génération. Avant d'ouvrir un moteur caché, la file abandonne les demandes remplacées par une édition plus récente.
- Même lorsqu'une capture a commencé, les étapes coûteuses suivantes sont évitées si une nouvelle édition est arrivée ; le `finally` ferme toujours le processus.
- Au début d'un travail sorti de la file, l'accès administrateur et l'absence d'un candidat actif sont recontrôlés : un aperçu devenu inautorisé ne peut pas démarrer plus tard.
- Régression fictive étendue à quatre demandes en rafale : seule la dernière capture en attente démarre ; les moteurs obsolètes ne sont pas créés et tous ceux démarrés sont détruits. Aucun changement de CSS, des images, du catalogue, des V1 ou des barèmes.

## Test futur avec 12 formats de blocs (13 octobre 2026)

- Un essai entièrement inédit combinant bloc Question et cellule de grille a révélé une définition produite avec deux questions de même ID. `analyzeDefinition` la rejetait : vrai problème de compatibilité des futurs tests.
- La collecte des questions est désormais unique pour les nouveaux tests comme pour ceux modifiés après import. Les répétitions dans les grilles sont des références, et le bloc Question explicite fournit prioritairement le barème complet sans déplacer l'ordre.
- Contrôle du cycle Builder chargement → sauvegarde → rechargement avec douze blocs différents, références de grille, scripts, image et mise à l'échelle, textes à trous, et exercice inventé ; aucune modification des KALTEST validés.

## Préservation des barèmes canoniques dans les grilles (13 octobre 2026)

- Une grille enregistrée peut comporter une cellule qui fait référence à une question déjà définie. Au retour du Builder, les valeurs implicites du champ de grille (réponse vide, 1 point) ne doivent pas remplacer les réponses et points canoniques.
- Lors de la conversion d'une définition importée, le moteur compare désormais les valeurs de grille à leurs valeurs d'origine. Seuls les champs réellement modifiés dans la grille mettent à jour la question ; les autres données de correction restent inchangées.
- Ce traitement s'applique à tous les ID de question et types de grille, sans aucune exception pour un test historique. Le test synthétique vérifie le barème d'origine, une modification des points et la modification d'une réponse attendue.

## Audit automatique du catalogue complet (13 octobre 2026)

- Le premier audit manuel sur les 24 définitions du catalogue a confirmé que leur passage par le Builder sans édition conserve les identifiants de questions et les champs de notation.
- Nouveau garde-fou CI `kaloneo-catalog-roundtrip-score-guard.js` : découvre automatiquement tous les `test.json` du catalogue, y compris les futurs, sans condition par ID.
- Il vérifie la présence, l'ordre et l'unicité des questions, leurs réponses/barèmes/types, les sorties et contributions Bilan, ainsi que les contenus image/audio/vidéo embarqués ; aucun fichier de test n'est modifié.
- Ce contrôle vérifie l'intégrité des données, **pas** l'équivalence visuelle de tous les écrans ; les captures réelles validées par l'utilisateur restent la référence.

## Préparation de la livraison R94 (13 octobre 2026)

- Dernier code de référence : `e07cd5752059997aeacabfdc96e29ca3ef330e64`, run `38445356377` (SUCCESS).
- L'utilisateur a déjà validé dans la R93 le rendu photographié du vrai candidat pour Gratte-ciel, Rangement du stock et Tri de chevilles. La R94 ne modifie aucun des styles et rendus candidat : elle ajoute le nettoyage des processus, la gestion des captures obsolètes, la correction générique des IDs de questions et les gardes des barèmes/ressources.
- Préparer une Release R94 / Build #99 / 0.0.123 distincte ; conserver les Releases R93 et R91. Ne jamais compiler deux fois avec le même numéro. L'autorisation finale des interfaces appartient à l'utilisateur après test local.

## Alerte critique — Résultats de la R94 (13 octobre 2026)

- L'utilisateur a exécuté un parcours complet : le candidat fonctionne, MAIS les fiches de la page Résultats mélangent parfois des réponses Mail avec d'autres tests. Les bilans non vérifiés de la R94 ne sont pas fiables.
- Cause trouvée : `qcm-runtime.js` reconstruisait d'abord les anciens résultats de pages 2–8 puis les regroupait heuristiquement selon les textes des titres. Des fragments DOM hérités pouvaient migrer sous le mauvais test. Des scores anciens pouvaient même être calculés avant regroupement.
- Correction générique : quand le manifeste enregistré du parcours existe, `afficherResultat()` produit immédiatement les fiches à partir de `state.tests[id]`, strictement pour les IDs du manifeste. Aucune réutilisation du DOM historique, ni regroupement par mots-clés. Les réponses non notées (courriel, textes, commentaires) restent accessibles dans leur fiche d'origine, comme texte échappé ; aucune limite arbitraire de 12 détails.
- Si le manifeste manque mais qu'un état KALTEST existe, la page refuse de fabriquer des notes à partir d'anciens scores. Cela privilégie l'intégrité de l'évaluation.
- Le code candidat, les barèmes, les fichiers V1, les images et la miniature du Builder ne sont pas modifiés. Une validation Electron sur données volontairement contaminées est nécessaire avant la livraison.

## Contrôle Electron des résultats isolés par test (13 octobre 2026)

- Test volontairement contaminé : trois activités inédites (dont Mail et Inventaire), quatrième exercice non exécuté, ancien DOM mélangeant des scores et anciennes valeurs `page8` stockées.
- Vérifier que chaque fiche ne contient que les données `state.tests[id]` correspondantes, que les données fantômes ou issues d'anciennes pages n'apparaissent pas, qu'une nouvelle catégorie fonctionne et qu'un message HTML du candidat ne peut créer un faux titre.
- Test d'absence de manifeste : la page doit avertir au lieu d'utiliser des scores historiques.

## Étanchéité Résultats / Bilan (13 octobre 2026)

- Le Bilan institutionnel ajoutait à la liste du manifeste tous les IDs trouvés dans le stockage de résultats, même lorsqu'ils n'avaient jamais fait partie du parcours exécuté.
- Correction : quand la liste du manifeste du parcours est présente, elle est seule autoritaire ; aucun test additionnel du stockage n'est autorisé à créer une rubrique ou une note au Bilan. Le mode historique sans manifeste est conservé pour les anciens dossiers.
- Le smoke Electron du Bilan contient désormais un résultat Mail et un exercice complètement inédit **absents du parcours** : ils doivent rester invisibles, tout comme la transition F1, sans altérer les scores légitimes.

## R95 — contrôle des résultats sur une vraie évaluation (13 octobre 2026)

- Les runs `38472934898` (Résultats) et `38473430288` (Bilan) sont VERTS. Une correction stricte protège le lien entre identifiant de test et résultat ; Bilan ignore les données d'autres tests hors du manifeste.
- Préparation d'une Release de test R95 / Build #100 / 0.0.124, isolée des anciens Setups R94 et R93, avec compilation conditionnée aux essais Electron de contamination et à toutes les régressions existantes.
- Les visuels du Builder, les fichiers KALTEST, les barèmes, la navigation et les images ne sont pas modifiés dans cette livraison.
- Les résultats de la R94 doivent être considérés comme provisoires jusqu'à comparaison des résultats après ouverture du même dossier candidat dans la R95.

## Résultats R95 — présentation des vraies réponses (14 octobre 2026)

- Retour sur parcours réel R95 : NWTEXT exposait `text_editor_html` brut ; autoévaluations affichaient des codes `progress` et des croix erronées ; Tri et Briques perdaient temps/erreurs ; courriel n'affichait pas son corps ; à l'ouverture, la page 0 historique apparaissait brièvement.
- Correction générale du rendu par structure des données de `state.tests[id]` : `result.tri` + `state.tri.rows` avec temps, erreurs et moyennes ; `result.bricks` avec temps et erreurs ; tableaux, messages, sélections et commentaires ; texte NWTEXT sans HTML ; réponses notées séparées des réponses non notées (pas de faux X).
- Traduction des choix et des intitulés au moyen de la définition correspondant **exactement à l'ID et à la version du manifeste**, chargée en lecture seule ; sans définition, laisser le code enregistré plutôt que fabriquer un mauvais libellé. Règle applicable à tous les nouveaux tests et aux V1, sans exception basée sur le nom du test.
- Le chemin administratif des résultats masque l'ancienne page pendant l'initialisation, puis rétablit la visibilité après installation des éléments de lecture seule.
- Aucune modification de résultat ni barème candidat, V1, images, scores ou présentation du Builder. Contrôle Electron renforcé encore nécessaire avant Setup.

## Contrôle Electron réaliste de la page Résultats (14 octobre 2026)

- Nouveau parcours entièrement synthétique, cinq tests inconnus du catalogue : rédaction, autoévaluation avec phrase et commentaire, manipulation avec chrono/erreurs, tri avec trois essais et moyennes, et courriel complet.
- Test sous le vrai Electron en lecture seule avec définition obtenue par IPC. Vérifie les libellés et commentaires exacts, le texte sans code HTML, les durées et erreurs, l'absence de doublon du courriel, la séparation stricte des tests et l'ouverture directement sur la page Résultats.
- Corrige le double affichage du corps de courriel lorsque sa saisie répond à plusieurs critères de notation : un champ de texte partagé n'est présenté qu'une fois.
- Aucun changement du modèle de notation ni des données sauvegardées.

## Complément d'affichage des stations pratiques (14 octobre 2026)

- Pour les stations pratiques et toute future autoévaluation, les textes des choix cochés proviennent de `presentation.triStation.autoStatements`, `presentation.bricksStation.autoStatements` ou `presentation.autoevaluationForm.statements` selon le type de données, jamais d'un ID de test codé en dur.
- Les questions internes de validation (`*_ready`, `*_complete`) sont masquées dans la page Résultats : elles ne doivent pas être présentées comme une question fausse du candidat.
- Le nouveau smoke Electron vérifie les phrases complètes pour les deux activités pratiques et l'absence de l'indicateur interne, en plus des temps, erreurs et commentaires.

## R96 de contrôle réel des Résultats (14 octobre 2026)

- Run `38523480047` VERT (branche habituelle). Les tests Electron de restitution vérifient texte NWTEXT, réponses et commentaires autoévaluation, tri (temps + erreurs + moyennes), Briques et courriel intégral sur cinq tests synthétiques aux IDs inconnus, avec absence de faux statuts et écran d'accueil historique.
- Préparation d'une seule Release R96, Build #101, version 0.0.125, distincte de la R95 Build #100.
- Les fichiers de tests, images, présentations du candidat et barèmes ne sont pas modifiés ; les anciens dossiers candidats ne doivent pas être effacés ou recalculés.
- La validation manuelle sur l'ancien dossier candidat reste indispensable avant tout usage institutionnel.
