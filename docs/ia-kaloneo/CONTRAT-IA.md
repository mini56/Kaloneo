# CONTRAT-IA — structure réelle des nouveaux tests KALONÉO

Source de vérité : `kaloneo/builder-core.js` (`modelToDefinition`, `definitionToModel`, `analyzeDefinition`), et `seb-evalpro/src/kaloneo-library-main.js` pour l'import. Référence de cette édition : **2.0.0 / format 1 / minSebEvalPro 0.3.10**.

Le présent document décrit **le sous-ensemble reproductible** pour une IA externe, sans remplacer le code officiel.

## Structure JSON

Racine obligatoire :
- `kaltestFormat:1`, `minSebEvalPro:"0.3.10"`, `builderVersion:"2.0.0"`;
- `id` stable (minuscules ASCII, chiffres, underscore, commence par une lettre), `version:"1.0.0"`, `title`, `category`, `kind:"questionnaire"` ou `"complex"`, `scored:true/false`;
- `features` : capacités déclarées explicitement ; `scenario` et `instruction` : textes candidats ;
- `calculator:{"compatible":false,"defaultEnabled":false}` (ou deux true), `chrono:{"enabled":false,"engine":null}`, `adminIntervention:{"enabled":false}`, `autoevaluation:false`, `externalMaterial:{"enabled":false}`;
- `presentation`, `questions`, `outputs`, `bilanContributions`;
- `navigation:{"next":"host","abandon":"host-common"}`;
- `runtime:{"start":true,"save":true,"restore":true,"finish":true}`.

Catégories du Builder : `mathematiques`, `francais`, `organisation`, `numerique`, `technique`, `planification`, `activite_pratique`. La dernière est non notée (`scored:false`). `kind:"questionnaire"` avec des questions ; `"complex"` sans questions.

## Présentation

`presentation.layout` = `single`, `50-50`, `40-60`, `60-40` ou `chars-rest` (ce dernier exige un `blockSizing` précis : utiliser un export du Builder). `presentation.builderContent` est une liste ordonnée de blocs, avec `zone:"left"` ou `"right"`.

Types de blocs acceptés : `text`, `html`, `html-js`, `image`, `audio`, `video`, `question`, `response-table`, `table-grid`, `inline-flow`, `table-definition`, `text-editor`. Les noms internes `word-bank` et `multiple-tables` **ne sont pas** des types de `builderContent` pour les nouveaux tests.

Blocs simples sûrs :
- `{"type":"text","zone":"left","text":"Lisez l'énoncé."}`.
- `{"type":"question","zone":"right","questionId":"q1"}` ; la question `q1` doit exister une seule fois dans `questions`.
- `{"type":"image","zone":"left","resource":{"name":"carte.png","mime":"image/png","data":"data:image/png;base64,VALEUR_REELLE"}}` : remplacer la valeur par de vrais octets encodés ; ne jamais livrer ce placeholder.
- `{"type":"table-grid","zone":"left","table":{"rows":1,"cols":1,"cells":[[{"kind":"fixed-text","value":"Exemple"}]]}}`. Les grilles interactives requièrent un exemple réel avec `questionId`, colonnes, valeurs, cellules et unités.
- Pour `html`, `html-js`, `response-table`, `inline-flow`, `table-definition`, `text-editor` : charger un KALTEST de référence créé dans le Builder avant de générer leur structure interne. Ne pas improviser des données invisibles.

Images/audio/vidéo : **données embarquées** (data URL) ; pas d'URL réseau, de chemin fictif ni de ressource externe. Une image de fond dans `style.backgroundImage` ou `presentation.pageStyle.backgroundImage` doit elle aussi être embarquée.

## Questions et barèmes

Chaque entrée `questions` contient `id`, `prompt`, `response:{"type":"..."}`, `points` (nombre >= 0). Types de réponse admis :
`text`, `free-text`, `number`, `number-unit`, `duration`, `single-choice`, `multiple-choice`, `boolean`, `select`.

Exemples syntaxiques :
- `{"id":"q1","prompt":"Combien de pièces ?","response":{"type":"number"},"acceptedAnswers":["12"],"points":1}`.
- `{"id":"q2","prompt":"Choisissez une réponse","response":{"type":"select","options":["A","B"]},"acceptedAnswers":["B"],"points":1}`.
- Durée : `"response":{"type":"duration"},"acceptedMinutes":75,"points":1`.
- Choix multiple : `"response":{"type":"multiple-choice","options":["A","B","C"]},"acceptedAnswers":[["A","B"]],"points":1`.
- Unité facultative ou notée : partir d'une question `number` avec `"unitInput":true,"acceptedUnits":["kg","kilo","kilogramme"]`. Si `"unitScored":true` : **1 point d'unité** s'ajoute aux `points` attribués à la valeur numérique, même lorsque celle-ci est fausse.
- Réponse libre à examiner manuellement : `"response":{"type":"free-text"},"points":0,"manualEvaluation":true,"manualLevels":["NE","I","II","III"]`.
- Question exemple non notée : `"example":true,"points":0`.

Les champs supplémentaires, tableaux de correction, listes déroulantes et textes à trous existent, mais nécessitent le **modèle structurel exact** d'un export du Builder pour garantir la compatibilité.

## Capacités / features

Seules les valeurs suivantes existent dans le Builder actuel :
`runtime.basic`, `questionnaire.basic`, `questionnaire.table`, `questionnaire.duration-fr`, `questionnaire.supplemental-fields`, `questionnaire.inline-gaps`, `questionnaire.single-choice-table`, `questionnaire.grid`, `layout.single`, `layout.split`, `calculator.host`, `host.calculator`, `host.chrono`, `host.admin-intervention`, `host.autoevaluation`, `host.external-material`, `host.text-editor`, `media.image`, `media.audio`, `media.video`, `content.html`, `content.html-js`, `bilan.bindings`, `questionnaire.free-text-manual`.

Inclure `runtime.basic`, `questionnaire.basic` si des questions existent, puis `layout.single` ou `layout.split`. Déclarer `host.calculator` si compatible, `host.chrono` si chrono activé, `questionnaire.free-text-manual` si question manuelle, et les fonctions effectivement employées.

Chronomètre : lorsque `enabled:true`, `engine:"seb-common"` est obligatoire. La navigation `next` et `abandon` appartient au programme hôte et ne peut être recodée.

## Sorties et Bilan

Pour un questionnaire simple :
`"outputs":[{"id":"score","type":"number"},{"id":"score_max","type":"number"},{"id":"pourcentage","type":"number"},{"id":"status","type":"string"}]`.

Sans définition institutionnelle précise des lignes du Bilan : `"bilanContributions":[]`. Ne jamais inventer d'IDs de lignes.

## Règle avant import

Le système actuel contrôle à l'import surtout le format, le titre, la version, l'ID et le type de page. **Cela ne garantit pas la cohérence pédagogique ni la notation.** Exécuter `node docs/ia-kaloneo/valider-test.js fichier/test.json`, puis contrôler l'affichage et les résultats dans un vrai parcours Electron. Aucun accès aux tests validés, et aucune modification de V1.
