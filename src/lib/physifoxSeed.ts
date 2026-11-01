// Contenu de départ de Physifox : notions du programme de 4e, plan des chapitres, premiers textes et flashcards à valider.
// Ajouté une seule fois (voir ensureSeed) : ensuite, tout se modifie depuis l'onglet Physifox.
import type { CardDraft, PfChapter, PfNotion } from './db';

const P = 'Programme cycle 4';
const n = (id: string, theme: string, title: string, programme: string, keywords: string[], sequences: string[] = [], levels = ['4e']): PfNotion => ({
  id: `n-${id}`,
  theme,
  title,
  levels,
  programme: `${P}, ${programme}`,
  sequences,
  keywords,
});

const ATOMES = 'Représenter et décrire la matière';
const AIR = 'L’air et le dioxyde de carbone';
const COMB = 'Les combustions';
const FORCES = 'Les forces';
const TENSION = 'La tension et l’intensité électriques';
const LOIS = 'Les lois des circuits électriques';
const LUM = 'La lumière';
const SON = 'Le son';

export const SEED_NOTIONS: PfNotion[] = [
  // Matière
  n('atome-molecule', 'Matière', 'Atomes et molécules', 'p. 99', ['atome', 'molecule'], [ATOMES]),
  n('formule', 'Matière', 'Lire une formule chimique', 'p. 99', ['formule', 'H2O', 'CO2'], [ATOMES]),
  n('histoire-atome', 'Matière', 'Histoire de l’atome', 'p. 96-100', ['democrite', 'dalton', 'thomson', 'rutherford'], [ATOMES]),
  n('etats-micro', 'Matière', 'États de la matière à l’échelle microscopique', 'p. 98', ['solide', 'liquide', 'gaz', 'etat'], [ATOMES]),
  n('tableau-periodique', 'Matière', 'Symboles et classification périodique', 'p. 99', ['periodique', 'symbole', 'element'], [ATOMES]),
  n('air', 'Matière', 'Composition de l’air', 'p. 99', ['air', 'diazote', 'dioxygene'], [AIR]),
  n('solubilite', 'Matière', 'Solubilité et miscibilité', 'p. 99', ['solubilite', 'soluble', 'miscible', 'dissolution'], [AIR]),
  n('co2', 'Matière', 'Test du dioxyde de carbone', 'p. 99', ['eau de chaux', 'dioxyde de carbone'], [AIR]),
  n('effet-serre', 'Matière', 'Gaz à effet de serre', 'p. 100', ['effet de serre', 'climat', 'rechauffement'], [AIR]),
  n('masse-volume', 'Matière', 'Masse et volume : mesures et unités', 'p. 98', ['masse', 'volume', 'balance', 'eprouvette', 'capacite'], [], ['5e', '4e']),
  n('conversions-mv', 'Matière', 'Convertir masses, volumes et capacités', 'p. 98', ['convertir', 'conversion', 'litre', 'dm3'], [], ['5e', '4e']),
  n('corps-pur', 'Matière', 'Corps purs et mélanges', 'p. 98', ['corps pur', 'melange', 'palier'], [], ['5e', '4e']),
  n('masse-volumique', 'Matière', 'Masse volumique : définition et relation', 'p. 98', ['masse volumique', 'rho', 'kg/m3'], [], ['4e', '3e']),
  n('densite-flottaison', 'Matière', 'Densité : flotter ou couler', 'p. 98', ['densite', 'flotte', 'coule', 'decanter'], [], ['4e', '3e']),
  n('temperature-mv', 'Matière', 'Température, dilatation et masse volumique', 'p. 98-99', ['dilatation', 'contraction', 'kelvin', 'temperature'], [], ['4e', '3e']),
  n('transfo-chimique', 'Matière', 'Transformation chimique ou physique, mélange', 'p. 99', ['transformation', 'reactif', 'produit'], [COMB]),
  n('combustion', 'Matière', 'Combustions dans l’air', 'p. 100', ['combustion', 'combustible', 'comburant'], [COMB]),
  n('conservation-masse', 'Matière', 'Redistribution des atomes, conservation de la masse', 'p. 99', ['conservation', 'lavoisier', 'redistribution'], [COMB]),
  n('equation', 'Matière', 'Lire une équation de réaction simple', 'p. 99-101', ['equation', 'bilan'], [COMB]),
  n('univers', 'Matière', 'Structure de l’Univers et du système solaire', 'p. 100', ['galaxie', 'systeme solaire', 'planete', 'univers'], ['L’Univers']),
  n('distances-astro', 'Matière', 'Distances astronomiques et année-lumière', 'p. 100, 104', ['annee-lumiere', 'distance'], ['L’Univers']),
  // Mouvement
  n('trajectoire', 'Mouvement', 'Trajectoire et types de mouvement', 'p. 101', ['trajectoire', 'rectiligne', 'circulaire', 'curviligne', 'uniforme'], ['Rallye révisions – Mouvements'], ['5e', '4e']),
  n('vitesse', 'Mouvement', 'Vitesse, distance et durée', 'p. 101', ['vitesse', 'v = d/t', 'distance'], ['Rallye révisions – Mouvements'], ['5e', '4e']),
  n('relativite', 'Mouvement', 'Relativité du mouvement', 'p. 101', ['referentiel', 'relativite', 'observateur'], ['Rallye révisions – Mouvements'], ['5e', '4e']),
  n('actions', 'Mouvement', 'Actions de contact et à distance', 'p. 101-102', ['contact', 'a distance', 'action'], [FORCES], ['4e', '3e']),
  n('force', 'Mouvement', 'Caractériser une force', 'p. 101-102', ['force', 'newton', 'point d application', 'interaction'], [FORCES], ['4e', '3e']),
  // Énergie
  n('formes-energie', 'Énergie', 'Formes d’énergie', 'p. 102', ['forme d energie', 'cinetique', 'thermique', 'lumineuse'], ['Rallye révisions – L’énergie'], ['5e', '4e', '3e']),
  n('conversions-energie', 'Énergie', 'Transferts, conversions et conservation', 'p. 102-103', ['conversion', 'transfert', 'convertisseur', 'conservation'], ['Rallye révisions – L’énergie'], ['5e', '4e', '3e']),
  n('unites-energie', 'Énergie', 'Unités d’énergie et puissance', 'p. 103', ['joule', 'calorie', 'puissance', 'watt'], ['Rallye révisions – L’énergie'], ['4e', '3e']),
  n('tension', 'Énergie', 'La tension électrique', 'p. 103-104', ['tension', 'volt', 'voltmetre'], [TENSION], ['5e', '4e']),
  n('intensite', 'Énergie', 'L’intensité du courant', 'p. 103-104', ['intensite', 'ampere', 'amperemetre'], [TENSION], ['5e', '4e']),
  n('dipole', 'Énergie', 'Adapter un dipôle à son générateur', 'p. 103', ['dipole', 'generateur', 'adaptation'], [TENSION]),
  n('lois-serie', 'Énergie', 'Lois des circuits en série', 'p. 103', ['serie', 'additivite', 'unicite'], [LOIS]),
  n('lois-derivation', 'Énergie', 'Lois des circuits en dérivation', 'p. 103', ['derivation', 'maille', 'additivite'], [LOIS]),
  n('ohm', 'Énergie', 'Résistance et loi d’Ohm', 'p. 103', ['ohm', 'resistance', 'U = R'], [LOIS], ['4e', '3e']),
  n('puissance-elec', 'Énergie', 'Puissance électrique', 'p. 103', ['P = U', 'puissance electrique'], [LOIS], ['4e', '3e']),
  // Signaux
  n('sources-lumiere', 'Signaux', 'Sources de lumière et objets diffusants', 'p. 104', ['source primaire', 'diffusant'], [LUM]),
  n('rayon', 'Signaux', 'Propagation rectiligne et rayon lumineux', 'p. 104', ['rayon', 'rectiligne', 'ombre'], [LUM]),
  n('vitesse-lumiere', 'Signaux', 'Vitesse de la lumière', 'p. 104', ['vitesse de la lumiere', 'annee-lumiere'], [LUM]),
  n('rayonnement', 'Signaux', 'Émission, absorption et transfert d’énergie', 'p. 103-104', ['rayonnement', 'absorption', 'emission'], [LUM]),
  n('son-propagation', 'Signaux', 'Propagation du son', 'p. 104', ['son', 'propagation', 'vide'], [SON]),
  n('son-frequence', 'Signaux', 'Fréquence : audibles, infrasons, ultrasons', 'p. 104-105', ['frequence', 'hertz', 'infrason', 'ultrason'], [SON]),
  // Méthodes
  n('m-rediger', 'Méthodes', 'Bien rédiger', 'compétences, p. 97', ['rediger', 'grandeur', 'symbole'], [], ['5e', '4e', '3e']),
  n('m-conversions', 'Méthodes', 'Conversions', 'compétences, p. 97', ['convertir'], [], ['5e', '4e', '3e']),
  n('m-cs', 'Méthodes', 'Précision et chiffres significatifs', 'compétences, p. 97', ['chiffres significatifs'], [], ['5e', '4e', '3e']),
  n('m-pheroc', 'Méthodes', 'Démarche scientifique', 'compétences, p. 96-97', ['hypothese', 'protocole', 'pheroc'], [], ['5e', '4e', '3e']),
];

const chapter = (id: string, theme: string, order: number, title: string, summary: string, notions: string[]): PfChapter => ({
  id: `c4-${id}`,
  slug: `4e-${id}`,
  level: '4e',
  theme,
  order,
  title,
  summary,
  published: false,
  status: 'a-faire',
  notionIds: notions.map((x) => `n-${x}`),
  sections: [],
  updatedAt: 0,
});

const MASSE_VOLUMIQUE: Pick<PfChapter, 'status' | 'sections'> = {
  status: 'brouillon',
  sections: [
    {
      id: 'mv-masse',
      kind: 'rappel',
      title: 'Rappel de 5e : la masse',
      body: `La masse se mesure avec une **balance**. Son unité est le **kilogramme (kg)** dans le Système international ; on utilise aussi le gramme et ses dérivés.
Quelques ordres de grandeur :
- une bouteille d’eau de 1 L : 1 kg
- une voiture : 1 à 2 tonnes (1 t = 1 000 kg)
- un morceau de sucre : 5 g
Pour bien utiliser une balance : l’allumer et vérifier l’unité, poser le récipient, appuyer sur « TARE » pour remettre à zéro, puis ajouter ce que l’on veut peser.`,
    },
    {
      id: 'mv-volume',
      kind: 'rappel',
      title: 'Rappel de 5e : le volume',
      body: `Le volume est l’espace occupé par un solide, un liquide ou un gaz. Son unité est le **mètre cube (m³)**.
La **capacité** d’un récipient est le volume qu’il peut contenir ; elle s’exprime en **litres (L)**. À retenir : **1 L = 1 dm³**.
| m³ | | | dm³ | | | cm³ | | | mm³ |
| | hL | daL | **L** | dL | cL | mL | | | |
On mesure un volume avec une éprouvette graduée, une burette graduée ou une fiole jaugée. Le bécher, même gradué, est trop peu précis.`,
    },
    {
      id: 'mv-corps-pur',
      kind: 'rappel',
      title: 'Rappel de 5e : corps purs et mélanges',
      body: `Un **corps pur** est constitué d’une seule espèce chimique (eau distillée, fer). Pendant un changement d’état, sa température reste constante : c’est un **palier**. L’eau pure gèle à 0 °C et bout à 100 °C.
Un **mélange** contient plusieurs espèces chimiques (air, eau salée, bronze). Pendant un changement d’état, sa température continue de varier : pas de vrai palier.`,
    },
    {
      id: 'mv-definition',
      kind: 'cours',
      title: 'La masse volumique',
      body: `La masse volumique est la **masse d’un objet divisée par son volume**. Elle se note $\\rho$ (la lettre grecque « rhô »).
$$\\rho = \\frac{m}{V}$$
| Grandeur | Symbole | Unité |
| Masse volumique | $\\rho$ | kg/m³ (ou g/mL, kg/L…) |
| Masse | $m$ | kg |
| Volume | $V$ | m³ |
C’est une **unité composée**, comme le km/h pour la vitesse : on dit « kilogramme **par** mètre cube ».
À partir de cette relation, on peut aussi calculer une masse ($m = \\rho \\times V$) ou un volume ($V = m / \\rho$).
La masse volumique permet de **distinguer des matériaux** : deux objets du même volume, mais de matières différentes, n’ont pas la même masse.`,
    },
    {
      id: 'mv-convertir',
      kind: 'methode',
      title: 'Convertir une masse volumique',
      body: `L’unité est composée : on l’écrit sous forme de fraction, puis on fait deux conversions séparées.
- **Étape 1** : écrire la masse volumique en fraction. 30 g/mL signifie que chaque mL a une masse de 30 g.
- **Étape 2** : convertir le **numérateur** (la masse) et le **dénominateur** (le volume) avec les tableaux.
- **Étape 3** : calculer le résultat de la fraction.
Exemple : $\\rho = 1\\,200$ g/L, en kg/L. On a 1 200 g = 1,2 kg, pour un volume de 1 L. Donc $\\rho = 1,2$ kg/L.`,
    },
    {
      id: 'mv-flotter',
      kind: 'cours',
      title: 'Ça flotte ou ça coule ?',
      body: `On compare la masse volumique de l’objet à celle du liquide :
- si elle est **plus petite**, l’objet **flotte**
- si elle est **plus grande**, l’objet **coule**
La masse volumique de l’eau est 1 g/mL (soit 1 kg/L ou 1 000 kg/m³).
La **densité** $d$ est la masse d’un objet divisée par la masse du même volume d’eau. Elle n’a **pas d’unité**. Exprimée en g/mL, la masse volumique a la même valeur que la densité.
Des liquides non miscibles se rangent par masse volumique, les plus denses au fond : c’est le principe de l’**ampoule à décanter**.`,
    },
    {
      id: 'mv-temperature',
      kind: 'cours',
      title: 'L’influence de la température',
      body: `En général, un corps chauffé se **dilate** : la même masse occupe un plus grand volume, sa masse volumique diminue. C’est pour cela que l’air chaud d’une montgolfière monte.
Cas particulier de l’eau : en gelant, son volume **augmente**. La glace est donc moins dense que l’eau liquide, ce qui explique que les glaçons et les icebergs flottent.
La dilatation de l’eau des océans quand ils se réchauffent est l’une des causes de l’élévation du niveau des mers.
La **température** (en °C ou en kelvins) n’est pas la **chaleur**, qui est une quantité d’énergie (en joules). On écrit 288 K (« kelvins »), sans le mot degré : $T(\\text{K}) = T(°\\text{C}) + 273,15$.`,
    },
  ],
};

export const SEED_CHAPTERS: PfChapter[] = [
  chapter('atomes', 'Matière', 1, 'Atomes et molécules', 'De quoi la matière est-elle faite ? Des premières idées sur l’atome aux formules chimiques.', ['atome-molecule', 'formule', 'histoire-atome', 'etats-micro', 'tableau-periodique']),
  chapter('air', 'Matière', 2, 'L’air et le CO₂', 'Ce que contient l’air, la dissolution des gaz, le test du dioxyde de carbone et l’effet de serre.', ['air', 'solubilite', 'co2', 'effet-serre']),
  {
    ...chapter('masse-volumique', 'Matière', 3, 'La masse volumique', 'Relier masse et volume pour reconnaître un matériau et prévoir s’il flotte ou s’il coule.', ['masse-volume', 'conversions-mv', 'corps-pur', 'masse-volumique', 'densite-flottaison', 'temperature-mv']),
    ...MASSE_VOLUMIQUE,
  },
  chapter('combustions', 'Matière', 4, 'Transformations chimiques et combustions', 'Reconnaître une transformation chimique, comprendre une combustion et écrire son bilan.', ['transfo-chimique', 'combustion', 'conservation-masse', 'equation']),
  chapter('univers', 'Matière', 5, 'L’Univers', 'Des planètes aux galaxies : se repérer dans l’Univers et mesurer ses distances.', ['univers', 'distances-astro']),
  chapter('mouvement', 'Mouvement', 6, 'Mouvement et vitesse', 'Décrire une trajectoire, caractériser un mouvement et calculer une vitesse.', ['trajectoire', 'vitesse', 'relativite']),
  chapter('forces', 'Mouvement', 7, 'Les forces', 'Reconnaître les actions et les modéliser par des forces.', ['actions', 'force']),
  chapter('energie', 'Énergie', 8, 'Formes et conversions d’énergie', 'Les formes d’énergie, comment elles se transforment, et pourquoi l’énergie se conserve.', ['formes-energie', 'conversions-energie', 'unites-energie']),
  chapter('tension-intensite', 'Énergie', 9, 'Tension et intensité', 'Mesurer et comprendre les deux grandeurs clés de l’électricité.', ['tension', 'intensite', 'dipole']),
  chapter('circuits', 'Énergie', 10, 'Lois des circuits', 'Circuits en série et en dérivation, loi d’Ohm et puissance électrique.', ['lois-serie', 'lois-derivation', 'ohm', 'puissance-elec']),
  chapter('lumiere', 'Signaux', 11, 'La lumière', 'Comment la lumière se propage, à quelle vitesse, et ce qu’elle transporte.', ['sources-lumiere', 'rayon', 'vitesse-lumiere', 'rayonnement']),
  chapter('son', 'Signaux', 12, 'Le son', 'Comment le son se propage et ce qui distingue les sons audibles, les infrasons et les ultrasons.', ['son-propagation', 'son-frequence']),
  chapter('methodes', 'Méthodes', 13, 'Fiches méthodes', 'Bien rédiger, convertir, respecter la précision, suivre la démarche scientifique.', ['m-rediger', 'm-conversions', 'm-cs', 'm-pheroc']),
];

const SOURCE = 'Cours Physifox « Masse volumique » et programme du cycle 4';
const draft = (id: string, notion: string, front: string, back: string): CardDraft => ({
  id: `draft-mv-${id}`,
  front,
  back,
  subject: 'Physique-Chimie',
  level: '4e',
  theme: 'Matière',
  notionIds: [`n-${notion}`],
  source: SOURCE,
  status: 'attente',
});

export const SEED_DRAFTS: CardDraft[] = [
  draft('01', 'masse-volumique', 'Qu’est-ce que la masse volumique d’un objet ?', 'La **masse de l’objet divisée par son volume**.'),
  draft('02', 'masse-volumique', 'Quelle est la relation entre masse volumique, masse et volume ?', '$\\rho = \\frac{m}{V}$'),
  draft('03', 'masse-volumique', 'Quelle est l’unité de la masse volumique dans le Système international ?', 'Le **kilogramme par mètre cube** (kg/m³).'),
  draft('04', 'masse-volumique', 'Comment calculer une masse à partir de la masse volumique et du volume ?', '$m = \\rho \\times V$'),
  draft('05', 'masse-volumique', 'Comment calculer un volume à partir de la masse et de la masse volumique ?', '$V = \\frac{m}{\\rho}$'),
  draft('06', 'masse-volumique', 'Un objet a une masse de 300 g et un volume de 100 mL. Quelle est sa masse volumique ?', '$\\rho = \\frac{300}{100} = 3$ g/mL'),
  draft('07', 'masse-volumique', 'À quoi sert la masse volumique pour identifier un matériau ?', 'Chaque matériau a sa propre masse volumique : la mesurer permet de le **reconnaître**.'),
  draft('08', 'densite-flottaison', 'Quelle est la masse volumique de l’eau en g/mL ? En kg/m³ ?', '1 g/mL, soit 1 000 kg/m³.'),
  draft('09', 'densite-flottaison', 'Comment prévoir si un objet flotte dans un liquide ?', 'On compare les masses volumiques : plus petite que celle du liquide, il **flotte** ; plus grande, il **coule**.'),
  draft('10', 'densite-flottaison', 'Quelle est l’unité de la densité ?', 'Aucune : la densité est **sans unité**.'),
  draft('11', 'densite-flottaison', 'Dans une ampoule à décanter, quel liquide est en bas ?', 'Le liquide **le plus dense**.'),
  draft('12', 'conversions-mv', 'Combien vaut 1 L en dm³ ?', '1 L = **1 dm³**'),
  draft('13', 'conversions-mv', 'Combien de mm³ y a-t-il dans 1 cm³ ?', '1 cm³ = 10 × 10 × 10 = **1 000 mm³**'),
  draft('14', 'conversions-mv', 'Convertir 1 200 g/L en kg/L.', '1 200 g = 1,2 kg, donc **1,2 kg/L**'),
  draft('15', 'masse-volume', 'Avec quel instrument mesure-t-on précisément le volume d’un liquide ? Lequel éviter ?', 'Éprouvette graduée, burette ou fiole jaugée. À éviter : le **bécher**, trop peu précis.'),
  draft('16', 'corps-pur', 'Comment reconnaître un corps pur lors d’un changement d’état ?', 'Sa température reste **constante** : c’est un palier.'),
  draft('17', 'temperature-mv', 'Que devient la masse volumique d’un corps chauffé, en général ? Pourquoi ?', 'Elle **diminue** : le corps se dilate, la même masse occupe un plus grand volume.'),
  draft('18', 'temperature-mv', 'Pourquoi les glaçons flottent-ils ?', 'En gelant, le volume de l’eau augmente : la glace est **moins dense** que l’eau liquide.'),
  draft('19', 'temperature-mv', 'Convertir 15 °C en kelvins.', '15 + 273,15 = **288,15 K**'),
];
