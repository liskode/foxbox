// Chapitres de 4e rédigés d'après le programme du cycle 4, le livre scolaire (pages Bilan) et le cours d'électricité Canva.
// Reformulés, sans reprise de texte ni d'illustration du livre. Ils restent « À relire » et hors ligne jusqu'à validation.
import type { PfChapter } from './db';

export const SEED_COURSES_2: Record<string, Pick<PfChapter, 'status' | 'sections'>> = {
  'c4-atomes': {
    status: 'brouillon',
    sections: [
      {
        id: 'at-histoire',
        kind: 'cours',
        title: 'Une idée vieille de 2 400 ans',
        body: `- Vers 400 av. J.-C., **Démocrite** imagine que la matière est faite de grains insécables, les atomes. L’idée reste longtemps écartée au profit de celle d’Aristote.
- En 1805, **Dalton** en fait une théorie scientifique.
- En 1897, **Thomson** découvre l’électron.
- En 1911, **Rutherford** montre que l’atome possède un noyau, puis Bohr et d’autres affinent le modèle.`,
      },
      {
        id: 'at-atomes',
        kind: 'cours',
        title: 'Atomes et molécules',
        body: `Un **atome** est la brique de base de la matière. Chaque sorte d’atome a un nom et un symbole : H pour l’hydrogène, C pour le carbone, O pour l’oxygène.
Une **molécule** est un assemblage d’atomes liés, comme une construction faite de briques.
Le **tableau périodique** classe les éléments : on y retrouve le symbole d’un élément à partir de son nom, et son numéro atomique.`,
      },
      {
        id: 'at-formules',
        kind: 'methode',
        title: 'Lire une formule chimique',
        body: `Une formule indique les atomes d’une molécule et leur nombre : le chiffre en indice porte sur l’atome juste avant lui. Sans chiffre, il y en a un seul.
| Molécule | Formule | Composition |
| eau | $H_2O$ | 2 H et 1 O |
| dioxyde de carbone | $CO_2$ | 1 C et 2 O |
| dioxygène | $O_2$ | 2 O |
| diazote | $N_2$ | 2 N |
| dihydrogène | $H_2$ | 2 H |
| méthane | $CH_4$ | 1 C et 4 H |
| protoxyde d’azote | $N_2O$ | 2 N et 1 O |`,
      },
      {
        id: 'at-etats',
        kind: 'cours',
        title: 'Les états de la matière à l’échelle microscopique',
        body: `| État | Organisation des molécules | Ce qu’on observe |
| Solide | serrées, liées, elles vibrent sur place | forme propre |
| Liquide | proches, elles glissent les unes sur les autres | pas de forme propre, surface plane et horizontale |
| Gaz | éloignées, désordonnées, rapides | pas de forme propre, compressible |
Lors d’un changement d’état, les molécules restent les mêmes : seule leur organisation change. La **masse se conserve**, mais le volume peut varier.`,
      },
      {
        id: 'at-rappel',
        kind: 'rappel',
        title: 'Rappel : dissolution et mélanges',
        body: `Quand un solide se dissout, ses molécules se dispersent parmi celles du solvant, sans être modifiées. C’est une transformation physique : la masse totale se conserve.`,
      },
    ],
  },
  'c4-air': {
    status: 'brouillon',
    sections: [
      {
        id: 'ai-composition',
        kind: 'cours',
        title: 'Ce que contient l’air',
        body: `L’air est un **mélange de gaz** :
- environ **78 %** de diazote ($N_2$)
- environ **21 %** de dioxygène ($O_2$)
- environ **1 %** d’autres gaz, dont l’argon, la vapeur d’eau et le dioxyde de carbone
En arrondissant : 4/5 de diazote et 1/5 de dioxygène.
La fumée n’est pas un gaz : ce sont de fines particules solides en suspension.`,
      },
      {
        id: 'ai-masse',
        kind: 'cours',
        title: 'L’air a une masse',
        body: `Un ballon pèse plus lourd une fois gonflé : l’air possède donc une masse.
Dans les conditions habituelles, **1 L d’air a une masse d’environ 1,3 g**. Cette valeur varie avec la température, la pression et l’humidité.
Sa masse volumique est donc d’environ 1,3 g/L. L’air chaud, moins dense, s’élève.`,
      },
      {
        id: 'ai-separation',
        kind: 'cours',
        title: 'Séparer les gaz de l’air',
        body: `En refroidissant fortement l’air, on le rend liquide. On le réchauffe ensuite doucement : chaque gaz redevient gazeux à sa propre température. C’est la **distillation**, utilisée dans l’industrie.
Un gaz liquéfié prend beaucoup moins de place, ce qui facilite son stockage.`,
      },
      {
        id: 'ai-solubilite',
        kind: 'cours',
        title: 'Solubilité et miscibilité',
        body: `La **solubilité** est la masse maximale d’une espèce que l’on peut dissoudre dans un litre de solvant, en g/L. Au-delà, la solution est **saturée**.
Les gaz aussi se dissolvent : les boissons gazeuses contiennent du dioxyde de carbone dissous.
Deux liquides sont **miscibles** s’ils forment un mélange homogène, comme l’eau et l’alcool. L’eau et l’huile ne le sont pas.`,
      },
      {
        id: 'ai-co2',
        kind: 'methode',
        title: 'Reconnaître le dioxyde de carbone',
        body: `Le dioxyde de carbone **trouble l’eau de chaux**.
Pour l’eau, on utilise le sulfate de cuivre anhydre : cette poudre blanche devient bleue à son contact.`,
      },
      {
        id: 'ai-serre',
        kind: 'cours',
        title: 'Les gaz à effet de serre',
        body: `Le Soleil réchauffe la Terre, qui émet à son tour un rayonnement infrarouge. Le dioxyde de carbone, le méthane, le protoxyde d’azote et la vapeur d’eau en **absorbent** une partie : l’atmosphère se réchauffe.
L’effet de serre est naturel et rend la Terre habitable. Mais les activités humaines, surtout la combustion du charbon, du pétrole et du gaz, le renforcent : c’est une cause du **réchauffement climatique**.
Le $CO_2$ qui se dissout dans les océans les rend aussi plus acides.`,
      },
    ],
  },
  'c4-univers': {
    status: 'brouillon',
    sections: [
      {
        id: 'un-formation',
        kind: 'cours',
        title: 'La formation de l’Univers',
        body: `Les galaxies s’éloignent les unes des autres : l’Univers est en **expansion**. Cela conduit au scénario du **Big Bang** : il y a environ 13,8 milliards d’années, l’Univers était extrêmement dense et chaud.
Le système solaire s’est formé il y a environ 4,6 milliards d’années.
La matière est partout de même nature et obéit aux mêmes lois. L’hydrogène et l’hélium dominent l’Univers ; les éléments plus lourds, comme l’oxygène, le carbone ou le fer, se sont formés dans les étoiles.`,
      },
      {
        id: 'un-structure',
        kind: 'cours',
        title: 'Se repérer dans l’Univers',
        body: `- **Système solaire** : une étoile, le Soleil, autour de laquelle tournent 8 planètes et une multitude d’autres corps.
- **Planètes** : Mercure, Vénus, Terre, Mars (rocheuses) ; Jupiter, Saturne, Uranus, Neptune (géantes gazeuses ou glacées).
- **Galaxie** : un immense ensemble d’étoiles. La nôtre est la **Voie lactée**.
- **Univers** : d’innombrables galaxies, séparées par de grands vides.`,
      },
      {
        id: 'un-distances',
        kind: 'cours',
        title: 'Mesurer les distances',
        body: `| Unité | Valeur | Usage |
| unité astronomique (UA) | environ 150 millions de km : la distance Terre-Soleil | système solaire |
| année-lumière (a.l.) | environ 9 500 milliards de km : la distance parcourue par la lumière en un an | au-delà |
L’année-lumière est une unité de **distance**, pas de durée.
La lumière met du temps à nous parvenir : observer un astre lointain, c’est le voir **tel qu’il était** dans le passé.`,
      },
    ],
  },
  'c4-forces': {
    status: 'brouillon',
    sections: [
      {
        id: 'fo-actions',
        kind: 'cours',
        title: 'Actions et interactions',
        body: `Une action peut mettre un objet en mouvement, modifier son mouvement ou le déformer.
- Action **de contact** : la main sur un ballon.
- Action **à distance** : la Terre sur une pomme, un aimant sur un clou.
Si A agit sur B, alors B agit aussi sur A : on parle d’**interaction**.
Le **diagramme objet-interaction** les représente : des ronds pour les objets, une double flèche continue pour un contact, une double flèche pointillée pour une action à distance.`,
      },
      {
        id: 'fo-force',
        kind: 'cours',
        title: 'Caractériser une force',
        body: `On modélise une action par une **force**, définie par :
- son **point d’application**
- sa **direction** (une droite, par exemple verticale)
- son **sens** (par exemple vers le bas)
- sa **valeur**, en **newtons (N)**
On la représente par une **flèche**, dont la longueur est proportionnelle à la valeur.
On note $F_{A/B}$ la force exercée par A sur B.`,
      },
      {
        id: 'fo-dynamometre',
        kind: 'methode',
        title: 'Mesurer une force',
        body: `On utilise un **dynamomètre**. Il contient un ressort qui s’allonge d’autant plus que la force est grande : une échelle graduée en newtons donne directement la valeur.`,
      },
      {
        id: 'fo-equilibre',
        kind: 'cours',
        title: 'L’équilibre',
        body: `Un objet soumis à deux forces est à l’équilibre si elles se compensent : **même direction, sens opposés, même valeur**.
Exemple : une lampe suspendue est soumise à son poids (vers le bas) et à la force exercée par le fil (vers le haut).
Si les forces ne se compensent pas, le mouvement de l’objet est modifié.`,
      },
    ],
  },
  'c4-tension-intensite': {
    status: 'brouillon',
    sections: [
      {
        id: 'ti-dipoles',
        kind: 'rappel',
        title: 'Les dipôles et les schémas',
        body: `Un dipôle a deux bornes. Le **générateur** (pile, alimentation) fournit l’énergie ; les **récepteurs** (lampe, moteur, résistance, diode, DEL) la reçoivent.
Dans un schéma normalisé, les fils sont des traits verticaux ou horizontaux, et les dipôles ne sont pas placés dans les angles.
Le courant sort par la borne + du générateur et revient par la borne −. Une diode ou une DEL ne le laisse passer que dans un sens.
Attention : un interrupteur **fermé** laisse passer le courant, un interrupteur **ouvert** l’arrête.`,
      },
      {
        id: 'ti-grandeurs',
        kind: 'cours',
        title: 'Deux grandeurs à ne pas confondre',
        body: `| | Tension | Intensité |
| Symbole | $U$ | $I$ |
| Unité | volt (V) | ampère (A) |
| Où ? | entre deux points | en un point du circuit |
| Appareil | voltmètre | ampèremètre |
| Branchement | **en dérivation** | **en série** |
Une image : la pompe d’un circuit d’eau joue le rôle du générateur. La tension ressemble à la **pression** de l’eau, et l’intensité à son **débit** : l’intensité représente le débit d’électrons.
Conversions : 1 V = 1 000 mV ; 1 A = 1 000 mA.`,
      },
      {
        id: 'ti-multimetre',
        kind: 'methode',
        title: 'Utiliser un multimètre',
        body: `**Pour une tension** : fil rouge sur V, fil noir sur COM, multimètre en dérivation aux bornes du dipôle.
**Pour une intensité** : fil rouge sur A ou mA, fil noir sur COM ; on ouvre le circuit pour insérer l’appareil en série.
**Le calibre** : on commence par le plus grand, puis on descend tant que la valeur reste inférieure au calibre. Le plus petit calibre possible donne la mesure la plus précise.
On écrit : symbole = valeur + unité, par exemple $U$ = 5,9 V.`,
      },
      {
        id: 'ti-adaptation',
        kind: 'cours',
        title: 'Adapter un dipôle à son générateur',
        body: `Sur une lampe, « 6 V – 100 mA » indique ses **valeurs nominales** : celles de son fonctionnement normal.
- Tension trop faible : **sous-tension**, la lampe brille peu.
- Tension trop forte : **surtension**, elle brille trop et risque de griller.
- Tension égale à la tension nominale : le dipôle est **adapté**.`,
      },
    ],
  },
  'c4-circuits': {
    status: 'brouillon',
    sections: [
      {
        id: 'ci-reconnaitre',
        kind: 'methode',
        title: 'Série ou dérivation ?',
        body: `Deux dipôles sont **en série** s’ils sont sur la même boucle : le courant qui traverse l’un traverse forcément l’autre.
Ils sont **en dérivation** s’ils sont sur des boucles différentes. Un même circuit peut mélanger les deux.`,
      },
      {
        id: 'ci-lois',
        kind: 'cours',
        title: 'Les lois des circuits',
        body: `| | En série | En dérivation |
| Intensité | **la même partout** : $I = I_1 = I_2$ | **elle s’additionne** : $I = I_1 + I_2$ |
| Tension | **elle s’additionne** : $U = U_1 + U_2$ | **la même partout** : $U = U_1 = U_2$ |
Si une lampe grille en série, l’autre s’éteint. En dérivation, l’autre continue de briller : c’est pourquoi les appareils d’une maison sont en dérivation.`,
      },
      {
        id: 'ci-resistance',
        kind: 'cours',
        title: 'La résistance',
        body: `Les matériaux ne laissent pas tous passer le courant aussi facilement. La **résistance** d’un dipôle, notée $R$, indique à quel point il s’oppose au courant. Elle s’exprime en **ohms** ($\\Omega$).
Ajouter une résistance en série fait diminuer l’intensité : une lampe brille moins.
On la mesure avec un **ohmmètre**, hors du circuit.
1 k$\\Omega$ = 1 000 $\\Omega$ ; 1 M$\\Omega$ = 1 000 000 $\\Omega$.`,
      },
      {
        id: 'ci-ohm',
        kind: 'cours',
        title: 'La loi d’Ohm',
        body: `La tension aux bornes d’une résistance est proportionnelle à l’intensité qui la traverse :
$$U = R \\times I$$
avec $U$ en volts, $R$ en ohms et $I$ en **ampères**. Pensez à convertir les milliampères !
La courbe de $U$ en fonction de $I$ est une droite qui passe par l’origine.
Exemple : $R$ = 100 $\\Omega$ et $I$ = 0,05 A donnent $U$ = 5 V.`,
      },
      {
        id: 'ci-joule',
        kind: 'cours',
        title: 'L’effet Joule et la sécurité',
        body: `Une résistance convertit de l’énergie électrique en énergie thermique : c’est l’**effet Joule**. Il est utile dans un radiateur ou un grille-pain, mais c’est une perte ailleurs.
Un **fusible** fond quand l’intensité devient trop grande : il ouvre le circuit et le protège.
Un court-circuit ou trop d’appareils sur une même prise peuvent provoquer un échauffement, voire un incendie.`,
      },
      {
        id: 'ci-puissance',
        kind: 'cours',
        title: 'La puissance électrique',
        body: `$$P = U \\times I$$
avec $P$ en watts, $U$ en volts et $I$ en ampères. Une lampe sous 6 V traversée par 0,5 A a une puissance de 3 W.`,
      },
    ],
  },
  'c4-lumiere': {
    status: 'brouillon',
    sections: [
      {
        id: 'lu-voir',
        kind: 'cours',
        title: 'Comment voit-on un objet ?',
        body: `- Une **source primaire** produit sa propre lumière : Soleil, lampe allumée, flamme.
- Un **objet diffusant** renvoie dans toutes les directions la lumière qu’il reçoit : Lune, table, livre.
On voit un objet quand de la lumière venant de lui **entre dans notre œil**. Dans le noir total, on ne voit rien.`,
      },
      {
        id: 'lu-rayon',
        kind: 'cours',
        title: 'La lumière se propage en ligne droite',
        body: `Dans un milieu transparent et homogène, et dans le vide, la lumière va en ligne droite. On représente son trajet par un **rayon lumineux** : une droite avec une flèche dans le sens de propagation.
Un objet opaque arrête la lumière : derrière lui se forme une **ombre**. Le rayon qui frôle l’objet permet de prédire la taille de l’ombre.`,
      },
      {
        id: 'lu-vitesse',
        kind: 'cours',
        title: 'La vitesse de la lumière',
        body: `Dans le vide et dans l’air, la lumière va à environ **300 000 km/s**. Elle va moins vite dans l’eau ou le verre.
Avec $d = v \\times t$, on calcule une distance ou une durée. La lumière du Soleil met environ 8 minutes à nous parvenir.
Pour un signal réfléchi (télémètre laser, sonar), le trajet est un aller-retour : $2d = v \\times t$.`,
      },
      {
        id: 'lu-rayonnement',
        kind: 'cours',
        title: 'Rayonnement et énergie',
        body: `La lumière visible n’est qu’une partie des rayonnements : il y a aussi les infrarouges, les ultraviolets, les ondes radio et les rayons X.
Un rayonnement transporte de l’**énergie**. Un objet qui l’absorbe reçoit cette énergie et, en général, s’échauffe.
Tout objet émet un rayonnement selon sa température : c’est ce que montre une caméra thermique.
Un signal lumineux ou radio peut aussi transporter une **information**.`,
      },
      {
        id: 'lu-dangers',
        kind: 'cours',
        title: 'Protéger ses yeux',
        body: `L’œil est fragile : une lumière trop intense peut causer des lésions **définitives**.
Ne regardez jamais directement, ni par réflexion, le Soleil, un laser ou un arc de soudure.`,
      },
    ],
  },
  'c4-son': {
    status: 'brouillon',
    sections: [
      {
        id: 'so-nature',
        kind: 'cours',
        title: 'Qu’est-ce qu’un son ?',
        body: `Un son est une **vibration mécanique** de la matière. Il naît d’un objet qui vibre : cordes vocales, membrane de haut-parleur, corde de guitare. Cet objet est la source sonore.`,
      },
      {
        id: 'so-propagation',
        kind: 'cours',
        title: 'La propagation du son',
        body: `Les particules mises en mouvement transmettent la vibration à leurs voisines. Le son a donc besoin d’un milieu matériel : gaz, liquide ou solide.
**Le son ne se propage pas dans le vide.** Un réveil sous une cloche dont on retire l’air devient presque inaudible.
Dans l’air à 15 °C, sa vitesse est d’environ **340 m/s**, soit environ 1 km en 3 s. Il va plus vite dans l’eau et dans les solides.
En comptant les secondes entre l’éclair et le tonnerre, puis en divisant par 3, on estime la distance de l’orage en kilomètres.`,
      },
      {
        id: 'so-frequence',
        kind: 'cours',
        title: 'Fréquence : grave ou aigu',
        body: `La **fréquence** est le nombre de vibrations par seconde, en **hertz (Hz)**. Plus elle est élevée, plus le son est aigu.
| Son | Fréquence |
| infrasons (inaudibles) | moins de 20 Hz |
| sons audibles par l’humain | de 20 Hz à 20 000 Hz |
| ultrasons (inaudibles) | plus de 20 000 Hz |
Les chauves-souris utilisent les ultrasons pour se repérer, tout comme le sonar.`,
      },
      {
        id: 'so-niveau',
        kind: 'cours',
        title: 'Le niveau sonore',
        body: `Le volume d’un son se mesure avec un **sonomètre**, en **décibels (dB)**.
L’oreille est fragile : au-delà de 80 dB, il faut limiter la durée d’écoute. Éloignez-vous des haut-parleurs, faites des pauses et baissez le volume de vos écouteurs.`,
      },
    ],
  },
};
