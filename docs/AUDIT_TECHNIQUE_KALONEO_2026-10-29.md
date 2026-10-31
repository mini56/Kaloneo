# KALONÉO — Audit technique du 29 octobre 2026

## Portée et limite de validation

Audit statique du dépôt privé mini56/Kaloneo, branche fix-r186-kaltest-source-unique-20261027 : arborescence de 1 649 éléments, 86 workflows GitHub, configuration de build, installation NSIS, stockage/chiffrement candidats, moteur de mise à jour, intégrateur V1, gestionnaire de bibliothèque, IPC et accès Admin, configuration Electron. Comparaison avec le dernier Setup 1.00.208.

**Cet audit ne certifie pas que les 1 649 éléments ont tous été exécutés ni que chaque interaction d'interface a été testée.** La dernière Release validée correspond au run 40936787058, avant les correctifs du présent audit. Les nouveaux essais sur dépôt privé échouent AVANT attribution d'un runner Windows ; pas de test réel disponible après ces changements.

## Résultats positifs prouvés

- Release 1.00.208 : GitHub Actions run 40936787058 **SUCCESS**, incluant contrôles des V1 et bilans, installation Windows et conservation des données chiffrées.
- Publication 1.00.208 : EXE et SHA256 présents sur mini56/Kaloneo ET mini56/Kaloneo-MAJ, tailles et empreintes GitHub identiques (SHA256 EXE a62b357b2e43c32b93d13c100ac7b5839d264b8b16dfb11ed3f7c6a93914c2ba).
- Le moteur local chiffre les données candidats en AES-256-GCM ; clé protégée par safeStorage Windows/DPAPI ; export/import protégé avec mot de passe.
- L'installation NSIS conserve les données par défaut ; suppression complète soumise à confirmation, mot de passe obligatoire, y compris /S.
- Le téléchargement des MAJ valide le nom, la taille, le domaine HTTPS et le SHA256 avant exécution, après confirmation administrateur.
- Les définitions V1 de la branche active ont une source unique, sans écrasement automatique depuis main.

## Anomalies et risques prioritaires

### A01 — CRITIQUE — runners Windows non attribués sur le dépôt privé — À RÉSOUDRE CÔTÉ GITHUB

Runs 40940973633, 40940973534, 40940973525 : échec en environ 3 secondes, steps=[], runner_id=0, temps Windows facturé 0 ms, journaux inexistants (BlobNotFound). **Ce ne sont pas des échecs démontrés du code.** Causes probables : quota GitHub Actions du dépôt privé, plafond/budget, facturation ou blocage de provisionnement. Vérifier GitHub Settings > Billing and licensing > Actions et repository Settings > Actions. Envisager un runner Windows auto-hébergé sur PC dédié. Ne pas considérer le code postérieur à 1.00.208 comme validé tant qu'un runner n'a pas exécuté les tests.

### A02 — CRITIQUE — synchronisation MAJ depuis le dépôt principal devenu privé — NON RÉSOLU

Le workflow public mini56/Kaloneo-MAJ/.github/workflows/synchroniser-releases.yml utilise le GITHUB_TOKEN **du dépôt MAJ**, qui ne donne pas automatiquement le droit de lire les Releases d'un autre dépôt privé. Le run 40888603851 a déjà donné HTTP 404 pour mini56/Kaloneo lorsqu'il n'était pas accessible avec ce jeton. La copie de 1.00.208 a été réalisée avant que le dépôt principal ne repasse en privé. **La future Release risque de ne pas parvenir à l'outil de mise à jour.** Prévoir sur MAJ un jeton limité à lecture du seul dépôt privé source (secret de dépôt GitHub Actions, pas de mot de passe en clair) OU une copie déclenchée depuis le dépôt privé avec jeton MAJ à permissions minimales. Tester le scénario privé de bout en bout, EXE et SHA256.

### A03 — ÉLEVÉ — verrou natif Windows candidat désactivé — NON RÉSOLU

seb-evalpro/src/main.js définit TEMP_ALLOW_WINDOWS_RECOVERY=true et startCandidateKeyGuard() s'arrête sans démarrer le verrou. La configuration officielle de Setup n'embarque pas candidate-keyguard.exe. Le mode Electron kiosk et les filtres de touches ne suffisent pas à prouver le blocage de la touche Windows côté système. Risque d'accès au bureau Windows pendant l'évaluation. **Ne pas inverser simplement le booléen** : conserver une sortie de secours administrateur et tester sur Windows 10/11 avant tout déploiement.

### A04 — ÉLEVÉ — ancienne configuration electron-builder dans package.json — PARTIELLEMENT CORRIGÉ

seb-evalpro/package.json possède toujours un bloc build avec appId fr.sauvegarde56.sebevalpro, icône build/app-icon.ico et artefact SEB-eval-PRO. Une invocation brute de electron-builder sans --config peut générer une mauvaise identité ou échouer. Le script npm dist:win a été corrigé pour utiliser explicitement build/kaloneo-auto-release.yml, préparer les ressources et refuser un Setup sans le secret ; le risque des appels directs reste à éliminer après validation sur runner. Ne pas modifier le bloc historique au hasard sans audit de ses consommateurs.

### A05 — ÉLEVÉ — remplacement d'une V1 système possible depuis la session Admin — CORRIGÉ, TESTS À REFAIRE

seb-evalpro/src/main.js : l'IPC kaloneo-library:save-test utilisait allowSeedOverwrite avec le seul état adminSessionUnlocked, alors que la bibliothèque exige un privilège spécial pour modifier une V1 officielle. Corrigé commit 27067ae : exigence supplémentaire developerSessionUnlocked. Protéger avec un test IPC Electron Admin ≠ Développeur ; vérifier également l'import, l'export et les versions personnalisées.

### A06 — ÉLEVÉ — démarrage local différent du Setup officiel — CORRIGÉ, TESTS À REFAIRE

seb-evalpro/package.json pointait sur src/main.js pendant que la Release Windows démarre par src/kaltest-pilot21-main.js (qui initialise le dossier KALONEO, le mode Admin et les parcours). Corrigé commit e0b83cc : même point d'entrée dans les deux contextes. Vérifier npm start et l'absence de dossiers historiques au prochain run Windows.

### A07 — ÉLEVÉ — multiplicité d'anciens workflows de publication — NON RÉSOLU

86 workflows sont conservés ; plusieurs audit-r172…r185-final-setup.yml et les anciens publish-kaloneo-v1-00-189 / 190 possèdent encore workflow_dispatch, contents:write et des commandes gh release create. Ils peuvent théoriquement être lancés manuellement malgré leur ancienneté. Conserver leurs tests de non-régression, mais retirer progressivement les pouvoirs de publication des workflows historiques, après relevé exhaustif des usages ; une seule chaîne officielle publiable.

### A08 — MOYEN — contrôles V1 liés à des chemins codés en dur — CORRIGÉ DANS LE CODE, TEST WINDOWS À REFAIRE

publish-kaloneo-next-version.yml vérifie explicitement offre et planning_trimestriel, en calculant le dossier via remplacement de l'underscore. Une autre V1 peut suivre une convention différente ; TESTS_V1-manifest.json contient pourtant le chemin exact et le SHA256. Remplacer les suppositions par une vérification générique du manifeste, des fichiers préparés, de leurs IDs, versions, sommes et images ; conserver en plus le contrôle du Bon de transport.

### A09 — MOYEN — procédures de dépôt V1 contradictoires — CORRIGÉ

TESTS_V1/README.md demandait encore de déposer les V1 sur main puis de synchroniser la branche. Corrigé commit 4bc1c107 : la branche de compilation active est la seule source intégrée. Le guide ne doit plus prescrire un écrasement de source.

### A10 — MOYEN — durcissement Electron à contrôler — À TESTER

La fenêtre candidate utilise contextIsolation=true, nodeIntegration=false, bloque les URL réseau et interdit les nouvelles fenêtres, ce qui est positif. Elle conserve toutefois sandbox=false afin de permettre le preload historique. Tester sur des contenus Builder malformés / importés et documenter les exceptions de sécurité avant d'envisager sandbox=true ; ne pas l'activer sans tests de compatibilité.

## Modifications réalisées pendant cet audit

- 4bc1c107 : corriger les consignes de dépôt/synchronisation TESTS_V1.
- a8fa6a84 : rediriger npm run dist:win vers la configuration officielle et les préparatifs nécessaires.
- 27067ae9 : interdire l'écrasement d'une V1 officielle en mode simple Admin.
- e0b83cc9 : unifier le point d'entrée Electron local et celui du Setup.

Aucun de ces commits ne publie de nouveau Setup. Les fichiers candidats, les bilans et les définitions V1 n'ont pas été modifiés par ces correctifs.

## Suite indispensable avant prochaine publication

1. Rétablir l'exécution des runners GitHub sur dépôt privé, ou configurer le runner Windows local.
2. Tester les quatre corrections ci-dessus dans un audit Electron Windows, avec vérification complète des bilans, des dossiers chiffrés, du Builder et de la modification V1 Admin/Développeur.
3. Corriger la lecture inter-dépôts privés pour Kaloneo-MAJ et tester une mise à jour de bout en bout.
4. Ajouter des tests systématiques du manifeste V1, des chemins et des médias, puis neutraliser les anciens workflows publiables en préservant leurs contrôles.
5. Vérifier le mode candidat et la touche Windows sur de vrais PC Windows 10/11.
6. Recompiler et publier uniquement après une exécution entièrement verte du workflow officiel et une copie SHA256 validée sur MAJ.

## Vérification différentielle avec la Release 1.00.208

La comparaison GitHub `kaloneo-1.00.208...fix-r186-kaltest-source-unique-20261027` confirme que les changements postérieurs à cette Release se limitent aux guides, au workflow officiel (commentaires), à `seb-evalpro/package.json` et à `seb-evalpro/src/main.js`. **Aucun fichier de définition de test V1, de bilan, de stockage candidat ou d'installateur NSIS n'a été modifié dans cet intervalle.**

Après les correctifs, plusieurs contrôles CI déclenchés sur le dépôt privé (notamment 40941406187, 40941406157 et 40941406075) ont tous échoué avec `runner_id=0` et **zéro étape exécutée**. Ils ne valident ni n'invalident les corrections ; leur exécution sur un runner fonctionnel est obligatoire.

## Correctif V1 vérifiable sans runner

Le 30 octobre 2026, un contrôle générique `seb-evalpro/scripts/kaloneo-official-v1-manifest-smoke.js` a été ajouté à la publication officielle et à `npm run dist:win`. Il lit `TESTS_V1-manifest.json`, vérifie chaque V1 depuis son vrai chemin, compare intégralement le JSON généré à la définition issue de la source, puis contrôle les SHA256 des médias référencés. Il conserve l'exigence explicite des trois V1 `l`, `offre` et `planning_trimestriel` ; le smoke spécialisé Bon de transport demeure indépendant.

Le contrôle a ensuite été corrigé pour reconnaître les images présentes dans la bibliothèque existante, sans duplication. Il a été exécuté avec succès par GitHub Actions sous Windows (run 41127031106), puis intégré à la compilation officielle et validé dans la Release 1.00.209 (run 41127345796). Les essais locaux évoqués antérieurement ne disposaient pas de trace d'exécution vérifiable et ne sont pas retenus comme preuve.

## Actualisation du 31 octobre 2026 — suite à la Release 1.00.209

**État de référence :** `kaloneo-1.00.209`, compilation et distribution entièrement vertes, run `41127345796`. Le dépôt de distribution publique contient le Setup et son SHA256 identiques à la source.

**Correctifs enregistrés APRÈS cette Release** (ils ne sont pas encore dans le Setup 1.00.209) :

- **Aperçu Builder** : `seb-evalpro/src/main.js`, `setSkipTaskbar(false)` réservé à l'aperçu Administrateur ; le mode candidat conserve `setSkipTaskbar(true)`. Commit `d03571e`. Contrôle d'interface Windows à faire sur PC utilisateur.
- **Anciens workflows** : 16 workflows historiques de publication R172–R184, R185 et 1.00.189/190 en `contents: read`, avec étape `gh release create` explicitement désactivée (`if: false`). Les tests préexistants restent actifs. **Le workflow officiel n'est pas désactivé.**
- **Configuration electron-builder de secours** : `seb-evalpro/package.json` réaligné avec `fr.sauvegarde56.kaloneo`, le point d'entrée KALONÉO, les ressources et l'icône. Les artefacts construits hors du workflow officiel portent le nom `KALONEO-NON-VALIDE` ; seul le workflow officiel peut publier une version reconnue par le moteur de mise à jour.
- **Antirégression** : nouveau `seb-evalpro/scripts/kaloneo-release-safety-guard.js`, exécuté dans `npm run prepare:web`. Il vérifie l'icône d'aperçu, la protection des V1 et les 16 workflows historiques.
- **MAJ depuis un dépôt privé** : le workflow du dépôt public `mini56/Kaloneo-MAJ` accepte le secret facultatif `KALONEO_SOURCE_READ_TOKEN`, jeton fine-grained limité à la lecture de `mini56/Kaloneo`. Le fonctionnement de copie depuis le dépôt public demeure inchangé. **Ce secret doit être configuré par le propriétaire avant de rendre la source privée si l'on veut continuer les nouvelles synchronisations.**

**Contrôles Windows automatiques après modifications** : runs `41185367446` (KALTEST), `41185367323` (numérotation) et `41185367279` (MAJ / SHA256) tous **success**. Ces audits ne remplacent pas une installation manuelle et ne constituent pas un nouveau Setup.

**Restent à traiter avec validation Windows et précautions** :
- verrou natif de la touche Windows pendant l'évaluation : `TEMP_ALLOW_WINDOWS_RECOVERY=true` actuellement ; ne pas activer brutalement le verrou sans mécanisme de secours opérationnel ;
- étude du passage des fenêtres utilisant `sandbox:false` vers un contexte plus isolé : tests d'import JSON, Builder, images et preload nécessaires ;
- confirmer sur Windows 10/11 que l'aperçu apparaît bien dans la barre des tâches et restitue la navigation au Builder ;
- configuration réelle du jeton de lecture avant passage du dépôt principal en privé, et test de synchronisation des Releases privées ;
- validation finale des bilans Word, Replay et candidats sur les deux PC après la prochaine version.

**Aucune nouvelle Release ne doit être demandée automatiquement par ces modifications** : déclencher le workflow officiel uniquement après vérifications fonctionnelles.

## Contrôle Electron et IPC — 31 octobre 2026

**Périmètre :** `src/main.js`, `src/preload.js`, `src/candidate-catalog-main.js`, `src/replay-main.js`, `src/bilan-history-main.js`, `src/session-close.js`, fenêtres Builder, aperçu KALTEST et gestion des navigations.

**Constat confirmé :** l'isolation `contextIsolation:true` et `nodeIntegration:false` est déjà active, mais certaines commandes IPC sensibles contrôlaient uniquement le booléen global `adminSessionUnlocked`. La fenêtre principale charge également les pages d'aperçu candidat avec le preload général. Un contenu d'aperçu ne doit pas pouvoir profiter d'une session Admin ouverte pour appeler des commandes réservées aux pages Admin.

**Correctifs ajoutés au dépôt (postérieurs à la 1.00.209) :**

- `src/kaloneo-ipc-sender-guard.js` : validation du WebContents principal, de son cadre principal (pas d'iframe), de l'URL `file:` et du chemin exact des pages Administrateur dans `app/web`. Le moteur candidat `kaltest-pilot2.html` et l'accueil `candidateWelcome=1` n'ont jamais droit aux commandes privilégiées, même pendant un aperçu Admin. `qcmv1.0.html` n'est autorisé qu'en contexte explicite de résultats administratifs.
- `src/main.js` : filtrage de 20 commandes sensibles (V1, images, import/export, parcours, Word, prévisualisations) et d'un canal synchrone de métadonnées ; conservation du passage Admin normal et des fonctions candidat.
- `src/candidate-catalog-main.js` : filtrage des opérations portant sur les identités, les bilans, les Word, les sauvegardes et la corbeille, y compris les IPC synchrones de sauvegarde.
- `src/replay-main.js`, `src/bilan-history-main.js`, `src/session-close.js` : filtrage des demandes de lecture Replay, de sauvegarde de bilans et d'arrêt de l'application depuis une page non administrative.
- Navigation locale : les pages de tests ne peuvent plus forcer `window.location` vers le Builder ou une page Admin ; le retour à la page d'accueil candidat reste permis. Les appels `mainWindow.loadFile()` du programme ne sont pas modifiés.
- `scripts/kaloneo-ipc-security-smoke.js` : test sans navigateur des refus de demandes depuis un test, une iframe, une fenêtre secondaire, un fichier local non autorisé ou un site Web ; vérification du maintien des parcours Admin légitimes. Le contrôle est intégré à `npm run prepare:web`.

**Vérifications automatiques exécutées sous Windows :**

- <https://github.com/mini56/Kaloneo/actions/runs/41187901570> : **SUCCESS** ; préparation web, nouveau contrôle IPC, intégration KALTEST et véritables essais Electron.
- <https://github.com/mini56/Kaloneo/actions/runs/41187845451> : **SUCCESS** ; menus Builder Type / Zone et insertion de blocs avec souris, fichiers candidats chiffrés, protection des exports et aperçu miniature.
- Aucun JSON de test V1, aucun barème, aucune grille de bilan et aucun contenu de la page Builder n'a été modifié.

**Limites restantes :** ce contrôle ne constitue pas un audit d'intrusion complet, ne prouve pas l'impossibilité de tout XSS provenant d'un test ou d'un champ libre, et ne remplace pas les essais manuels sur les deux PC Windows. `sandbox:false` reste nécessaire au preload existant tant qu'il utilise `require` et les modules Node liés aux dossiers/replay. Ne pas activer le sandbox sans refonte dédiée du preload et tests de régression. Les canaux candidat autorisés (état de parcours, Replay en cours) conservent leur architecture ; ils pourront faire l'objet d'une revue plus fine séparée.

**Publication :** aucun nouveau Setup n'a été demandé. La Release publique 1.00.209 demeure la version distribuée ; les corrections de sécurité sont dans la branche de développement uniquement.
