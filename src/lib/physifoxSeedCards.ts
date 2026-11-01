// Rattachement de départ des flashcards de 4e existantes aux notions, et flashcards rédigées pour les notions non couvertes
// (programme du cycle 4). Les nouvelles flashcards restent invisibles tant qu'elles ne sont pas validées.
import type { CardDraft } from './db';

const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const links: Record<string, Record<string, number[]>> = {
  '41ER': {
    co2: [1, 2, 3],
    'corps-pur': [4, 13, 14, 16],
    'masse-volume': [6, 7, 11],
    'etats-micro': [8, 9, 10, 15],
    air: [12, ...range(17, 26), 29, 30, 31],
    'transfo-chimique': [27, 28, 65, 69, 70],
    'm-pheroc': [32],
    solubilite: [33, 37, 38],
    'densite-flottaison': [34, 35, 36, 39, 47],
    'temperature-mv': [40, 41, 44],
    'conversions-mv': [42, 43],
    'masse-volumique': [45, 46, 48],
    combustion: [...range(49, 55), 58, 59, 60, 66, 67, 68],
    'conservation-masse': [56, 57],
    equation: [61, 62, 63, 64],
  },
  '42ER': {
    trajectoire: [1, 2, 3, 4, 7, 15, 20, 21],
    vitesse: [5, 6, 8, 9, 10, 11, 12, 13, 14, 18],
    relativite: [16, 17, 19, 22, 28, 32],
    actions: [23, 24, 25, 26, 27, 29, 30, 31],
  },
  '43ER': {
    'formes-energie': [1, 2, 13, 14, 15, 16, 17, 33],
    'conversions-energie': [3, 4, 5, 6, 7, 8, 20, 28, 30],
    'unites-energie': [9, 10, 11, 12, 18, 19, 21, 22, 23, 24, 29, 31, 32],
    vitesse: [25, 26, 27],
    intensite: [34],
  },
  '43MM': {
    tension: [1, 2, 4, 6, 8, 9, ...range(10, 16)],
    intensite: [3, 5, 7, 8, 9, ...range(17, 21)],
    dipole: range(22, 28),
  },
  '44ER': {
    'son-propagation': [1, 2, 3, 12],
    'son-frequence': [4, 5, 6, 7, 8, 9, 10, 11],
    rayon: [13, 14, 16],
    'vitesse-lumiere': [15],
    schemas: [...range(17, 24), 31],
    tension: [25, 26, 29],
    intensite: [26, 27, 30],
    'lois-derivation': [28, 32],
  },
  '49ER': {
    maths: [1, 2, 3, 4, 9, 13],
    vitesse: [5, 7],
    'masse-volumique': [6, 8],
    'm-conversions': [10],
    'm-cs': [11, 12, 14, 15],
  },
};

// Code de flashcard → notions
export const SEED_LINKS: Record<string, string[]> = {};
for (const [prefix, byNotion] of Object.entries(links))
  for (const [notion, nums] of Object.entries(byNotion))
    for (const num of nums) (SEED_LINKS[`${prefix}-${String(num).padStart(3, '0')}`] ??= []).push(`n-${notion}`);

const SOURCE = 'Programme du cycle 4 (2020), à relire';
const group = (theme: string, notion: string, cards: [string, string][]): CardDraft[] =>
  cards.map(([front, back], i) => ({
    id: `draft-${notion}-${String(i + 1).padStart(2, '0')}`,
    front,
    back,
    subject: 'Physique-Chimie',
    level: '4e',
    theme,
    notionIds: [`n-${notion}`],
    source: SOURCE,
    status: 'attente',
  }));

export const GAP_DRAFTS: CardDraft[] = [
  ...group('Matière', 'atome-molecule', [
    ['Qu’est-ce qu’un atome ?', 'La plus petite entité d’un **élément chimique**. Toute la matière est faite d’atomes.'],
    ['Qu’est-ce qu’une molécule ?', 'Un **assemblage d’atomes liés** entre eux.'],
    ['Quelle différence entre un corps pur et un mélange, à l’échelle des molécules ?', 'Corps pur : **une seule sorte** de molécules. Mélange : **plusieurs sortes**.'],
    ['Dans une transformation physique, les molécules changent-elles ?', 'Non : elles restent **les mêmes**, seule leur disposition change.'],
  ]),
  ...group('Matière', 'formule', [
    ['Que signifie la formule $H_2O$ ?', 'Une molécule d’eau : **2 atomes d’hydrogène** et **1 atome d’oxygène**.'],
    ['Que signifie la formule $CO_2$ ?', 'Une molécule de dioxyde de carbone : **1 atome de carbone** et **2 atomes d’oxygène**.'],
    ['Quelle est la formule du dioxygène ? du diazote ?', 'Dioxygène : $O_2$. Diazote : $N_2$.'],
    ['Quelle est la formule du dihydrogène ?', '$H_2$'],
    ['Quelle est la formule du méthane ? Que contient sa molécule ?', '$CH_4$ : **1 atome de carbone** et **4 atomes d’hydrogène**.'],
    ['Quelle est la formule du protoxyde d’azote ?', '$N_2O$'],
  ]),
  ...group('Matière', 'histoire-atome', [
    ['Qui a eu le premier l’idée de l’atome, vers 400 av. J.-C. ?', '**Démocrite**. « Atome » signifie « insécable ».'],
    ['Qu’a apporté John Dalton au début du XIXe siècle ?', 'Il a repris l’idée d’atome et en a fait une **théorie scientifique**.'],
    ['Qu’a découvert Thomson en 1897 ?', 'L’**électron**, chargé négativement.'],
    ['Qu’a montré Rutherford en 1911 ?', 'L’atome possède un **noyau** très petit, chargé positivement.'],
  ]),
  ...group('Matière', 'etats-micro', [
    ['À l’échelle microscopique, comment sont les molécules d’un solide ?', '**Rangées et serrées**, presque immobiles.'],
    ['À l’échelle microscopique, comment sont les molécules d’un liquide ?', '**Proches mais désordonnées**, elles glissent les unes sur les autres.'],
    ['À l’échelle microscopique, comment sont les molécules d’un gaz ?', '**Éloignées et très agitées**, elles se déplacent dans tout l’espace.'],
    ['Lors d’un changement d’état, la masse change-t-elle ? Et le volume ?', 'La masse **se conserve**. Le volume peut **varier**.'],
  ]),
  ...group('Matière', 'tableau-periodique', [
    ['À quoi sert le tableau périodique ?', 'À classer les éléments et à retrouver leur **symbole** et leur **numéro atomique**.'],
    ['Quels sont les symboles de l’hydrogène, du carbone, de l’azote et de l’oxygène ?', 'H, C, N et O.'],
    ['Quel est le symbole du fer ? du cuivre ?', 'Fer : Fe. Cuivre : Cu.'],
  ]),
  ...group('Matière', 'effet-serre', [
    ['Citez deux gaz à effet de serre.', 'Par exemple le **dioxyde de carbone** ($CO_2$) et le **méthane** ($CH_4$). La vapeur d’eau et le protoxyde d’azote en sont aussi.'],
    ['Que font les gaz à effet de serre ?', 'Ils **absorbent le rayonnement émis par la Terre**, ce qui réchauffe l’atmosphère.'],
    ['Quelle activité humaine rejette beaucoup de $CO_2$ ?', 'La **combustion** du charbon, du pétrole et du gaz.'],
    ['Que se passe-t-il quand le $CO_2$ se dissout dans les océans ?', 'L’eau des océans devient **plus acide**.'],
  ]),
  ...group('Matière', 'solubilite', [
    ['Qu’est-ce que la solubilité d’une espèce ?', 'La **masse maximale** que l’on peut dissoudre dans un litre de solvant.'],
    ['Quelle est l’unité courante de la solubilité ?', 'Le **gramme par litre** (g/L).'],
    ['Qu’est-ce qu’une solution saturée ?', 'Une solution qui **ne peut plus dissoudre** davantage de soluté.'],
  ]),
  ...group('Matière', 'univers', [
    ['Qu’est-ce qu’une galaxie ?', 'Un immense ensemble d’**étoiles**, de gaz et de poussières. La nôtre est la **Voie lactée**.'],
    ['Qu’est-ce que le système solaire ?', 'Le **Soleil** et tout ce qui tourne autour : planètes, astéroïdes, comètes…'],
    ['Citez les 8 planètes du système solaire dans l’ordre.', 'Mercure, Vénus, Terre, Mars, Jupiter, Saturne, Uranus, Neptune.'],
    ['Quels sont les deux éléments les plus abondants de l’Univers ?', 'L’**hydrogène** et l’**hélium**.'],
    ['La matière de la Terre et celle des étoiles sont-elles de même nature ?', 'Oui : elle est **partout la même** et obéit aux mêmes lois.'],
    ['Quel est l’âge approximatif de l’Univers ? du système solaire ?', 'Univers : environ **13,8 milliards** d’années. Système solaire : environ **4,6 milliards** d’années.'],
  ]),
  ...group('Matière', 'distances-astro', [
    ['Qu’est-ce qu’une année-lumière ?', 'Une unité de **distance** : celle que parcourt la lumière en un an.'],
    ['Combien vaut une année-lumière en kilomètres ?', 'Environ **9 500 milliards de km** ($9{,}5 \\times 10^{12}$ km).'],
    ['Quelle est la distance Terre-Soleil ?', 'Environ **150 millions de km**.'],
    ['Pourquoi voit-on le passé en regardant le ciel ?', 'La lumière met du temps à nous parvenir : on voit l’astre **tel qu’il était** quand elle en est partie.'],
  ]),
  ...group('Mouvement', 'force', [
    ['Par quoi modélise-t-on une action exercée sur un objet ?', 'Par une **force**.'],
    ['Quelles sont les 4 caractéristiques d’une force ?', '**Point d’application, direction, sens et valeur.**'],
    ['Quelle est l’unité d’une force ?', 'Le **newton** (N).'],
    ['Avec quel appareil mesure-t-on une force ?', 'Un **dynamomètre**.'],
    ['Comment représente-t-on une force sur un schéma ?', 'Par une **flèche** partant du point d’application, dans la direction et le sens de la force, sa longueur indiquant la valeur.'],
    ['Quelle force fait tomber les objets vers le sol ?', 'La **force de pesanteur**, ou poids.'],
  ]),
  ...group('Énergie', 'lois-serie', [
    ['Dans un circuit en série, comment est l’intensité ?', 'La **même en tout point** du circuit : c’est la loi d’unicité de l’intensité.'],
    ['Dans un circuit en série, comment se répartissent les tensions ?', 'La tension du générateur est égale à la **somme des tensions** aux bornes des dipôles : $U = U_1 + U_2$.'],
    ['Combien de boucles compte un circuit en série ?', '**Une seule.**'],
    ['Deux lampes en série : que se passe-t-il si l’une grille ?', 'Le circuit est ouvert : l’autre **s’éteint aussi**.'],
    ['Générateur 12 V et deux dipôles en série. $U_1 = 8$ V. Combien vaut $U_2$ ?', '$U_2 = 12 - 8 = 4$ V'],
  ]),
  ...group('Énergie', 'lois-derivation', [
    ['Dans un circuit en dérivation, comment est la tension aux bornes de chaque branche ?', 'La **même** : c’est la loi d’unicité des tensions.'],
    ['Dans un circuit en dérivation, comment se répartissent les intensités ?', 'L’intensité de la branche principale est la **somme des intensités** des branches : $I = I_1 + I_2$.'],
    ['Deux lampes en dérivation : que se passe-t-il si l’une grille ?', 'L’autre **continue de briller**.'],
    ['$I = 300$ mA et $I_1 = 100$ mA, en dérivation. Combien vaut $I_2$ ?', '$I_2 = 300 - 100 = 200$ mA'],
    ['Pourquoi les appareils d’une maison sont-ils branchés en dérivation ?', 'Chacun reçoit la **même tension** et fonctionne **indépendamment** des autres.'],
  ]),
  ...group('Énergie', 'ohm', [
    ['Quelle est l’unité de la résistance électrique et son symbole ?', 'L’**ohm** ($\\Omega$).'],
    ['Quelle est la loi d’Ohm ?', '$U = R \\times I$, avec $U$ en volts, $R$ en ohms et $I$ en ampères.'],
    ['Plus la résistance est grande dans un circuit, que devient l’intensité ?', 'Elle **diminue**.'],
    ['$R = 100\\ \\Omega$ et $I = 0{,}05$ A. Combien vaut $U$ ?', '$U = 100 \\times 0{,}05 = 5$ V'],
    ['$U = 6$ V et $R = 200\\ \\Omega$. Combien vaut $I$ ?', '$I = \\frac{6}{200} = 0{,}03$ A'],
    ['Quelle courbe obtient-on en traçant $U$ en fonction de $I$ pour une résistance ?', 'Une **droite passant par l’origine** : $U$ et $I$ sont proportionnelles.'],
    ['Attention à l’intensité dans la loi d’Ohm : quelle unité utiliser ?', 'Les **ampères** : il faut convertir les milliampères.'],
  ]),
  ...group('Énergie', 'puissance-elec', [
    ['Quelle est la relation entre puissance, tension et intensité ?', '$P = U \\times I$, avec $P$ en watts, $U$ en volts et $I$ en ampères.'],
    ['Une lampe sous 6 V est traversée par 0,5 A. Quelle est sa puissance ?', '$P = 6 \\times 0{,}5 = 3$ W'],
    ['Pourquoi un fusible protège-t-il un circuit ?', 'Il **fond** et ouvre le circuit quand l’intensité devient trop grande.'],
  ]),
  ...group('Signaux', 'sources-lumiere', [
    ['Qu’est-ce qu’une source primaire de lumière ?', 'Un objet qui **produit sa propre lumière** : Soleil, lampe allumée, flamme.'],
    ['Qu’est-ce qu’un objet diffusant ?', 'Un objet qui **renvoie dans toutes les directions** la lumière qu’il reçoit.'],
    ['La Lune est-elle une source primaire ?', 'Non : c’est un **objet diffusant**, elle renvoie la lumière du Soleil.'],
    ['À quelle condition voit-on un objet ?', 'De la lumière venant de cet objet doit **entrer dans l’œil**.'],
    ['Pourquoi ne faut-il jamais regarder un laser ou le Soleil en face ?', 'Leur lumière peut **brûler la rétine**, de façon irréversible.'],
  ]),
  ...group('Signaux', 'rayon', [
    ['Comment modélise-t-on le trajet de la lumière ?', 'Par un **rayon lumineux** : une droite fléchée dans le sens de propagation.'],
    ['Comment se forme une ombre ?', 'Un objet opaque **arrête la lumière** : la zone derrière lui n’est pas éclairée.'],
  ]),
  ...group('Signaux', 'vitesse-lumiere', [
    ['Quelle relation lie distance, vitesse et durée pour la lumière ?', '$d = v \\times t$'],
    ['La lumière du Soleil met environ combien de temps pour atteindre la Terre ?', 'Environ **8 minutes**.'],
    ['Pourquoi voit-on l’éclair avant d’entendre le tonnerre ?', 'La lumière (300 000 km/s) va **bien plus vite** que le son (environ 340 m/s).'],
  ]),
  ...group('Signaux', 'rayonnement', [
    ['Citez des rayonnements invisibles pour l’œil.', 'Infrarouges, ultraviolets, ondes radio, rayons X.'],
    ['Que transporte un rayonnement ?', 'De l’**énergie**.'],
    ['Que se passe-t-il quand un objet absorbe un rayonnement ?', 'Il reçoit de l’énergie et, en général, il **s’échauffe**.'],
    ['Quel rayonnement tout objet émet-il, selon sa température ?', 'Un rayonnement **infrarouge**, que montre une caméra thermique.'],
    ['Le son et la lumière peuvent-ils transporter une information ?', 'Oui : ce sont des **signaux** (fibre optique, sonar, radio…).'],
  ]),
  ...group('Méthodes', 'm-rediger', [
    ['Quelles sont les 5 étapes pour bien rédiger un exercice ?', 'Que sait-on ? Que cherche-t-on ? Quelle formule ? Attention aux unités. Précision du résultat.'],
    ['Quelle différence entre grandeur, symbole et unité ? Exemple de la masse.', 'Grandeur : la **masse**. Symbole : $m$. Unité : le **kilogramme** (kg).'],
    ['Faut-il donner la formule avant de remplacer par les valeurs ?', 'Oui : on écrit d’abord la **formule avec ses symboles**, puis le calcul.'],
  ]),
];
