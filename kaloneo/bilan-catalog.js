/* Choix de l'éditeur depuis le catalogue officiel Bilan SEB 1.0.0. */
window.KaloneoBilanCatalog=Object.freeze([
  {
    "id": "bilan.competences_techniques.fabrication.plan",
    "label": "Capacité à lire un plan et comprendre un modèle ou un gabarit.",
    "mode": "manual",
    "section": "Compétences techniques",
    "subsection": "Fabrication d’une structure 3D en papier",
    "inputs": []
  },
  {
    "id": "bilan.competences_techniques.fabrication.tracage_reperage",
    "label": "Les opérations de traçage et de repérage",
    "mode": "manual",
    "section": "Compétences techniques",
    "subsection": "Fabrication d’une structure 3D en papier",
    "inputs": []
  },
  {
    "id": "bilan.competences_techniques.fabrication.decoupe",
    "label": "Les opérations de découpe",
    "mode": "manual",
    "section": "Compétences techniques",
    "subsection": "Fabrication d’une structure 3D en papier",
    "inputs": []
  },
  {
    "id": "bilan.competences_techniques.fabrication.pliage_assemblage",
    "label": "Les opérations de pliage et d’assemblage",
    "mode": "manual",
    "section": "Compétences techniques",
    "subsection": "Fabrication d’une structure 3D en papier",
    "inputs": []
  },
  {
    "id": "bilan.competences_techniques.fabrication.finition",
    "label": "Les opérations de finition",
    "mode": "manual",
    "section": "Compétences techniques",
    "subsection": "Fabrication d’une structure 3D en papier",
    "inputs": []
  },
  {
    "id": "bilan.competences_techniques.briques.identifier_schema",
    "label": "Capacité à identifier, décoder et interpréter un schéma simple",
    "mode": "automatic",
    "section": "Compétences techniques",
    "subsection": "Construction à base de briques",
    "inputs": [
      {
        "id": "erreurs",
        "type": "integer",
        "required": true
      }
    ]
  },
  {
    "id": "bilan.competences_techniques.briques.manipuler_assembler",
    "label": "Capacité à manipuler et assembler",
    "mode": "automatic",
    "section": "Compétences techniques",
    "subsection": "Construction à base de briques",
    "inputs": [
      {
        "id": "erreurs",
        "type": "integer",
        "required": true
      }
    ]
  },
  {
    "id": "bilan.competences_techniques.carre_magique.resolution_contraintes",
    "label": "Capacités de résolution de problèmes structurés par contraintes",
    "mode": "automatic",
    "section": "Compétences techniques",
    "subsection": "Carré magique",
    "inputs": [
      {
        "id": "erreurs",
        "type": "integer",
        "required": true
      }
    ]
  },
  {
    "id": "bilan.competences_techniques.gestion_logistique.classement_multicritere",
    "label": "Capacité à effectuer le classement des produits dans un espace de stockage en respectant les consignes.",
    "mode": "automatic",
    "section": "Compétences techniques",
    "subsection": "Gestion logistique — Ranger le stock de produits",
    "inputs": [
      {
        "id": "erreurs",
        "type": "integer",
        "required": true
      }
    ]
  },
  {
    "id": "bilan.competences_techniques.planning.repartition_taches",
    "label": "Capacité à effectuer la répartition de tâches selon des contraintes données.",
    "mode": "automatic",
    "section": "Compétences techniques",
    "subsection": "Gestion de plannings sous contraintes — Le restaurant",
    "inputs": [
      {
        "id": "score",
        "type": "number",
        "required": true
      },
      {
        "id": "score_max",
        "type": "number",
        "required": true
      }
    ]
  },
  {
    "id": "bilan.competences_techniques.tri_chevilles.temps",
    "label": "Capacité à effectuer une tâche simple et répétitive en un temps imparti.",
    "mode": "automatic",
    "section": "Compétences techniques",
    "subsection": "Tri de chevilles",
    "inputs": [
      {
        "id": "temps_moyen",
        "type": "duration",
        "required": true
      },
      {
        "id": "temps_essais",
        "type": "duration-list",
        "required": false
      }
    ]
  },
  {
    "id": "bilan.competences_techniques.tri_chevilles.erreurs",
    "label": "Nombre d’erreurs effectuées",
    "mode": "automatic",
    "section": "Compétences techniques",
    "subsection": "Tri de chevilles",
    "inputs": [
      {
        "id": "moyenne_erreurs",
        "type": "number",
        "required": true
      },
      {
        "id": "erreurs_total",
        "type": "integer",
        "required": false
      }
    ]
  },
  {
    "id": "bilan.tic.traitement_texte.presenter_travail",
    "label": "Capacité à utiliser l’outil informatique pour présenter un travail",
    "mode": "automatic",
    "section": "Utilisation des techniques de l'information et de la communication",
    "subsection": "Traitement de texte",
    "inputs": [
      {
        "id": "score",
        "type": "number",
        "required": true
      },
      {
        "id": "score_max",
        "type": "number",
        "required": true
      }
    ]
  },
  {
    "id": "bilan.tic.messagerie.echanger",
    "label": "Capacité à échanger avec les technologies de l’information et de la communication",
    "mode": "automatic",
    "section": "Utilisation des techniques de l'information et de la communication",
    "subsection": "Messagerie électronique",
    "inputs": [
      {
        "id": "erreurs",
        "type": "integer",
        "required": true
      }
    ]
  },
  {
    "id": "bilan.savoirs_fondamentaux.expression_ecrite.maitrise",
    "label": "Maîtrise des règles de grammaire, d'orthographe et de conjugaison, ... et aptitudes à communiquer sous forme écrite.",
    "mode": "automatic",
    "section": "Savoirs fondamentaux",
    "subsection": "Expression écrite",
    "inputs": [
      {
        "id": "score",
        "type": "number",
        "required": true
      },
      {
        "id": "score_max",
        "type": "number",
        "required": true
      }
    ]
  },
  {
    "id": "bilan.savoirs_fondamentaux.mathematiques.comprendre_enonce_consigne",
    "label": "Capacité à comprendre un énoncé et une consigne",
    "mode": "automatic",
    "section": "Savoirs fondamentaux",
    "subsection": "Mathématiques",
    "inputs": [
      {
        "id": "score",
        "type": "number",
        "required": true
      },
      {
        "id": "score_max",
        "type": "number",
        "required": true
      }
    ]
  },
  {
    "id": "bilan.savoirs_fondamentaux.mathematiques.resoudre_problemes",
    "label": "Capacité à résoudre des problèmes en lien avec le domaine professionnel, d’autres disciplines ou la vie courante",
    "mode": "automatic",
    "section": "Savoirs fondamentaux",
    "subsection": "Mathématiques",
    "inputs": [
      {
        "id": "score",
        "type": "number",
        "required": true
      },
      {
        "id": "score_max",
        "type": "number",
        "required": true
      }
    ]
  }
]);
