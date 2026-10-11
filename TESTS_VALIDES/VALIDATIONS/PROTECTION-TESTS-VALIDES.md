# KALONÉO — Décision du propriétaire : préserver les tests déjà validés

**Date : 11 octobre 2026. Statut : exigence permanente du projet.**

## Décision explicite

> « Je ne veux plus devoir recontrôler un test que j'ai déjà contrôlé vingt fois et qui fonctionnait parfaitement avant des modifications non demandées. »

Un test déjà validé ne doit **jamais être modifié de manière spontanée** (moteur, comportement, saisies, chronomètre, contenus, textes, illustrations, positionnement, présentation, correction, barèmes, échanges Résultats/Bilan). Toute modification doit relever d'une demande explicite du propriétaire, sauf correction strictement nécessaire d'une régression introduite par l'équipe de développement, et cette correction doit viser la **restitution à l'identique du fonctionnement antérieurement validé**, sans « amélioration » opportuniste.

La validation antérieure ne devient pas caduque parce qu'une branche a changé.

## Responsabilité du développement

1. **Ne pas demander au propriétaire de refaire un parcours complet ni de retester un test déjà validé pour vérifier une modification non sollicitée.** La responsabilité des tests de non-régression appartient au développement.
2. **Avant chaque intégration**, comparer les changements avec la référence antérieurement validée, délimiter les fichiers/fonctions autorisés et refuser toute modification hors périmètre.
3. Pour toute correction de régression, rétablir le comportement validé, ajouter un contrôle **fonctionnel en Electron sur le vrai moteur KALTEST**, et vérifier le cas remonté par le propriétaire avant de produire un nouveau Setup.
4. Un build GitHub « vert » ne vaut **pas** à lui seul validation fonctionnelle d'un exercice. Ne pas annoncer « validé » sans contrôle comportemental approprié.
5. **Ne pas écraser** les branches de référence, les originaux V1, les sauvegardes ou les versions précédemment approuvées.
6. Consigner explicitement les résultats de la comparaison et des contrôles. Si une vérification est impossible, le dire clairement ; ne pas la transférer tacitement au propriétaire.

## Incident ayant motivé cette exigence

**Tri de chevilles, R58/R59 (11 octobre 2026).** Le moteur KALTEST a reçu sans demande une modification de la confirmation de saisie des erreurs : validation déplacée de `input` vers `change`/`Enter`. Une expression régulière a de plus été écrite `/^\\d+$/` au lieu de `/^\d+$/`. Les nombres d'erreurs `0`, `1`, etc. n'étaient plus reconnus ; le premier tri restait en attente et « Démarrer le compteur » ne se réarmait plus. Les contrôles préexistants n'ont pas détecté la panne du parcours réel.

La correction R60, dans une branche **isolée**, restaure uniquement le mécanisme de saisie de la référence R48.10. Le contrôle Electron `seb-evalpro/scripts/kaloneo-tri-rearm-r60-electron-smoke-main.js` vérifie la saisie `0`, `1`, `2`, la remise à zéro, le réarmement, la réalisation de trois tris et l'accès aux résultats, sans demander au propriétaire de refaire l'exercice.

**Toute validation ou diffusion ultérieure est conditionnée au résultat effectif de ces vérifications.** Le présent document est une obligation de travail, pas la preuve que le bug est déjà réparé.

## Règle de clôture

Le propriétaire décide de ce qui doit changer. Les fonctions déjà validées restent inchangées. Lorsqu'une régression involontaire est détectée, c'est au développement de la corriger et d'en vérifier la correction, sans imposer de nouveau test manuel à l'utilisateur.
