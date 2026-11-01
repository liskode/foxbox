// Schémas repris des documents de cours Canva (dossier 4ème) : partie du chapitre → figures, servies depuis public/physifox.
import type { PfFigure } from './db';

const fig = (name: string, alt: string): PfFigure => ({ src: `./physifox/${name}.jpg`, alt });

export const SEED_FIGURES: Record<string, Record<string, PfFigure[]>> = {
  'c4-tension-intensite': {
    'ti-dipoles': [fig('elec-symboles', 'Symboles normalisés : générateur, pile, interrupteur, résistance, lampe, moteur, diode, DEL, voltmètre et ampèremètre')],
    'ti-grandeurs': [fig('elec-train', 'Analogie entre un circuit électrique et un circuit de wagons de pain entre une boulangerie et un supermarché')],
    'ti-multimetre': [
      fig('elec-multimetre', 'Le multimètre utilisé en voltmètre, branché en dérivation, et en ampèremètre, branché en série'),
      fig('elec-branchement', 'Schéma d’un circuit avec un ampèremètre en série et un voltmètre en dérivation'),
    ],
  },
  'c4-circuits': {
    'ci-reconnaitre': [
      fig('elec-serie', 'Deux lampes en série : une seule boucle de courant'),
      fig('elec-derivation', 'Deux lampes en dérivation : deux boucles de courant'),
      fig('elec-mixte', 'Circuit à deux boucles : L1 et L2 en série, L3 et L4 en dérivation'),
    ],
  },
  'c4-energie': {
    'en-formes': [fig('en-formes', 'Les six formes d’énergie : thermique, mécanique, chimique, lumineuse, électrique et nucléaire')],
    'en-transferts': [
      fig('en-conversion', 'Conversion : une lampe reçoit de l’énergie électrique et donne de l’énergie lumineuse'),
      fig('en-transfert', 'Transfert : une plaque de cuisson donne de l’énergie thermique à une casserole'),
    ],
    'en-diagramme': [fig('en-chaine', 'Diagramme d’énergie d’une lampe : énergie électrique reçue du réseau, énergies lumineuse et thermique données')],
    'en-unites': [fig('en-unites', 'Correspondances entre wattheure, watt-seconde, joule, calorie et kilocalorie')],
  },
  'c4-mouvement': {
    'mo-referentiel': [
      fig('mo-bateau', 'Chute d’une balle depuis le mât d’un bateau : verticale vue du bateau, courbe vue du quai'),
      fig('mo-referentiels', 'Référentiels héliocentrique, géocentrique et terrestre'),
    ],
  },
  'c4-forces': {
    'fo-actions': [
      fig('mo-distance', 'Exemples d’interactions à distance : gravitation, magnétisme et force électrique'),
      fig('mo-doi', 'Diagramme objet-interaction d’une bille posée sur le sol et attirée par un aimant'),
    ],
  },
  'c4-combustions': {
    'tc-modifications': [fig('tc-arbre', 'Arbre de décision : transformation physique, transformation chimique ou réaction nucléaire')],
    'tc-combustion': [
      fig('tc-triangle', 'Le triangle du feu : combustible, comburant et énergie'),
      fig('tc-molecules', 'Combustion complète du carbone : carbone et dioxygène donnent du dioxyde de carbone'),
      fig('tc-co', 'Combustion incomplète du carbone : formation de monoxyde de carbone, un gaz mortel'),
    ],
  },
  'c4-atomes': {
    'at-formules': [fig('tc-modeles', 'Symboles et modèles des atomes, puis formules, modèles et composition de quelques molécules')],
  },
  'c4-masse-volumique': {
    'mv-masse': [fig('mv-masses', 'Tableau de conversion des masses')],
    'mv-volume': [fig('mv-volumes', 'Tableau de conversion des volumes et des capacités')],
  },
};
