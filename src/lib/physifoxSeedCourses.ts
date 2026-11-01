// Textes de départ des chapitres repris des cours Canva de Physifox. Ils restent « À relire » et hors ligne jusqu'à validation.
import type { PfChapter } from './db';

export const SEED_COURSES: Record<string, Pick<PfChapter, 'status' | 'sections'>> = {
  'c4-energie': {
    status: 'brouillon',
    sections: [
      {
        id: 'en-formes',
        kind: 'cours',
        title: 'Les formes d’énergie',
        body: `L’énergie existe sous 6 formes :
- **thermique** : liée à la température
- **mécanique** : liée au mouvement (cinétique) ou à la position (potentielle). Le son en fait partie.
- **chimique** : stockée dans les molécules (aliments, piles, carburants), libérée lors de transformations chimiques
- **lumineuse** : transportée par la lumière et les autres rayonnements (infrarouges, ultraviolets, ondes radio, rayons X)
- **électrique** : celle qui fait fonctionner les appareils branchés ou à piles
- **nucléaire** : contenue dans le noyau des atomes, libérée par fission ou par fusion
**L’énergie se conserve** : on ne peut ni en créer ni en faire disparaître.`,
      },
      {
        id: 'en-transferts',
        kind: 'cours',
        title: 'Transferts et conversions',
        body: `**Transfert** : l’énergie passe d’un objet à un autre **sans changer de forme**. Une plaque chauffante transfère de l’énergie thermique à la casserole.
**Conversion** : l’énergie **change de forme**, grâce à un convertisseur.
- une flamme : énergie chimique convertie en énergies thermique et lumineuse
- le Soleil : énergie nucléaire convertie en énergies thermique et lumineuse
- la dynamo d’un vélo : énergie mécanique convertie en énergie électrique par l’alternateur, puis en énergie lumineuse par la lampe`,
      },
      {
        id: 'en-diagramme',
        kind: 'methode',
        title: 'Le diagramme d’énergie',
        body: `On représente le parcours de l’énergie avec 3 éléments :
- un **rectangle** pour un réservoir d’énergie
- un **ovale** pour un convertisseur
- une **flèche** pour un transfert, en indiquant la forme d’énergie
Exemple du phare de vélo : mouvement du vélo → (énergie mécanique) → alternateur → (énergie électrique) → lampe → (énergie lumineuse) → lumière.`,
      },
      {
        id: 'en-unites',
        kind: 'cours',
        title: 'Les unités d’énergie',
        body: `Dans le Système international, l’énergie s’exprime en **joules (J)**. On utilise aussi :
| Unité | Usage | Correspondance |
| calorie (cal) | chaleur | 1 cal = 4,184 J |
| Calorie (Cal) ou kilocalorie (kcal) | alimentation | 1 Cal = 1 kcal = 1 000 cal |
| wattheure (Wh) | électricité | 1 Wh = 3 600 J |
| kilowattheure (kWh) | électricité | 1 kWh = 3,6 MJ |
La calorie est l’énergie nécessaire pour élever de 1 °C la température de 1 g d’eau. Attention à la majuscule sur les étiquettes !`,
      },
      {
        id: 'en-mecanique',
        kind: 'cours',
        title: 'L’énergie mécanique',
        body: `- **Énergie cinétique** : celle d’un objet en mouvement. Elle dépend de sa masse et de sa vitesse : $E_c = \\frac{1}{2} m v^2$
- **Énergie potentielle de pesanteur** : elle augmente quand l’objet s’élève. Elle dépend de sa masse, de sa hauteur et de la pesanteur.
Un objet qui tombe convertit son énergie potentielle en énergie cinétique : sa vitesse augmente.
À toi : quelle est l’énergie cinétique d’une Formule 1 de 800 kg lancée à 210 km/h ? (Réponse : 1,36 MJ. Attention aux unités !)`,
      },
      {
        id: 'en-puissance',
        kind: 'cours',
        title: 'La puissance',
        body: `La puissance d’un convertisseur est sa **vitesse de conversion de l’énergie**.
$$P = \\frac{E}{t}$$
Avec $P$ en watts (W), $E$ en joules (J) et $t$ en secondes (s). 1 W = 1 J/s.
L’énergie électrique consommée se compte souvent en kilowattheures : 1 kWh = 1 000 W × 3 600 s = 3,6 MJ.`,
      },
    ],
  },
  'c4-mouvement': {
    status: 'brouillon',
    sections: [
      {
        id: 'mo-caracteriser',
        kind: 'cours',
        title: 'Caractériser un mouvement',
        body: `La **trajectoire** est l’ensemble des positions successives d’un objet. Sa forme donne le type de mouvement : **rectiligne** (tout droit), **circulaire** (cercle ou portion de cercle) ou **curviligne** (ni l’un ni l’autre).
Si la vitesse est toujours la même, le mouvement est **uniforme**. Sinon, il est **accéléré** (en freinant, on parle d’accélération négative).
| Exemple | Forme | Vitesse |
| Vélo tout droit à 20 km/h | rectiligne | uniforme |
| Lune autour de la Terre | circulaire | uniforme |
| Pendule | circulaire | accéléré |
| Mouche qui vole | curviligne | accéléré |`,
      },
      {
        id: 'mo-vitesse',
        kind: 'cours',
        title: 'Caractériser une vitesse',
        body: `À un instant donné, la vitesse a 3 caractéristiques : une **direction** (une droite), un **sens** et une **valeur**. On la représente par une flèche, à l’aide d’une échelle.
La **vitesse moyenne** se calcule sur tout le trajet : pauses et ralentissements sont moyennés.`,
      },
      {
        id: 'mo-calcul',
        kind: 'methode',
        title: 'Calculer une vitesse',
        body: `$$v = \\frac{d}{t}$$
On en déduit $d = v \\times t$ et $t = \\frac{d}{v}$. On écrit $v$ et $t$ en minuscules, pour ne pas les confondre avec le volume et la température.
Les unités doivent correspondre : une vitesse en km/h va avec une distance en kilomètres et une durée en heures ; une vitesse en m/s va avec des mètres et des secondes.
Pour convertir : de km/h en m/s on **divise par 3,6** ; de m/s en km/h on **multiplie par 3,6**.`,
      },
      {
        id: 'mo-durees',
        kind: 'methode',
        title: 'Heures, minutes et secondes',
        body: `1 j = 24 h, 1 h = 60 min, 1 min = 60 s.
Attention : 1 h 12 min n’est pas 1,12 h. C’est 1 + 12/60 = **1,2 h**.
0,5 h = 30 min ; 0,5 j = 12 h. En cas de doute, fais un tableau de proportionnalité.`,
      },
      {
        id: 'mo-referentiel',
        kind: 'cours',
        title: 'Le mouvement dépend de l’observateur',
        body: `Pour étudier un mouvement, il faut d’abord choisir un **référentiel** : l’objet par rapport auquel on observe.
Un chien dans le panier d’un vélo est immobile par rapport au cycliste, mais en mouvement pour une personne au bord de la route.
La pédale d’un vélo a un mouvement circulaire par rapport au cadre, mais pas pour quelqu’un qui regarde le vélo passer.`,
      },
      {
        id: 'mo-exercices',
        kind: 'exercice',
        title: 'Je m’entraîne',
        body: `- Un cycliste parcourt 15 km en 40 min. Quelle est sa vitesse moyenne en km/h ?
- Un avion à 900 km/h doit parcourir 240 km. Combien de temps lui faut-il ?
- Un cycliste roule à 26 km/h pendant 2,5 min. Quelle distance parcourt-il en mètres ?
- Un train parcourt 180 km en 2 h 30, fait une pause de 15 min, puis roule 3 h à 100 km/h. Quelle est sa vitesse moyenne ?
**Réponses** : 22,5 km/h ; 16 min ; 1 083 m ; 83,5 km/h.`,
      },
    ],
  },
  'c4-combustions': {
    status: 'brouillon',
    sections: [
      {
        id: 'tc-modifications',
        kind: 'cours',
        title: 'Reconnaître une transformation',
        body: `On compare l’état initial et l’état final :
| | Molécules modifiées ? | Atomes modifiés ? | Exemples |
| Transformation physique | non | non | glace qui fond, sucre dans l’eau |
| Transformation chimique | **oui** | non | bougie qui brûle, vinaigre et bicarbonate |
| Réaction nucléaire | oui | **oui** | centrale nucléaire, Soleil |`,
      },
      {
        id: 'tc-bilan',
        kind: 'cours',
        title: 'Le bilan d’une transformation chimique',
        body: `Les **réactifs** disparaissent : leur quantité diminue. Les **produits** apparaissent : leur quantité augmente.
On écrit les réactifs, une **flèche** (pas un signe =), puis les produits :
- mercure + dioxygène → oxyde de mercure (expérience de Lavoisier)
- dihydrogène + dioxygène → eau (moteur à hydrogène)
- carbone + dioxygène → dioxyde de carbone
L’énergie n’est pas de la matière : on ne l’écrit pas dans le bilan.`,
      },
      {
        id: 'tc-combustion',
        kind: 'cours',
        title: 'Les combustions',
        body: `Pour démarrer une combustion, il faut 3 éléments : un **combustible** (ce qui brûle), un **comburant** (presque toujours le dioxygène de l’air) et une **énergie d’activation**.
- Combustion **complète** : flamme bleue.
- Combustion **incomplète** : flamme jaune-orangé, avec de la suie ou du **monoxyde de carbone**, un gaz mortel, inodore et invisible. Il prend la place du dioxygène dans le sang : d’où les détecteurs dans les logements.`,
      },
      {
        id: 'tc-masse',
        kind: 'cours',
        title: 'La conservation de la masse',
        body: `Dans une transformation chimique, les atomes ne sont pas modifiés : ils se réorganisent. Chacun garde sa masse, donc :
**masse des réactifs = masse des produits**
Comme le résume Lavoisier : « Rien ne se perd, rien ne se crée, tout se transforme. »
Attention : si un gaz s’échappe, la balance indique une masse qui diminue. Il faut fermer le récipient pour observer la conservation.`,
      },
      {
        id: 'tc-equation',
        kind: 'methode',
        title: 'L’équation de réaction',
        body: `Avec les formules chimiques, le bilan devient une équation : $C + O_2 \\rightarrow CO_2$.
Elle doit compter autant d’atomes de chaque sorte de chaque côté, car les atomes se conservent. Exemple : $CH_4 + 2\\,O_2 \\rightarrow CO_2 + 2\\,H_2O$.`,
      },
      {
        id: 'tc-exercices',
        kind: 'exercice',
        title: 'Je m’entraîne',
        body: `On fait brûler 18 g de carbone dans 48 g de dioxygène. Il se forme du dioxyde de carbone.
- Écrire le bilan de la réaction.
- Quelle est la masse de dioxyde de carbone formé ?
- Si 44 g de ce gaz occupent 24 L, quel est le volume produit ?
**Réponses** : carbone + dioxygène → dioxyde de carbone ; 18 + 48 = 66 g ; 66 × 24 / 44 = 36 L.`,
      },
    ],
  },
  'c4-methodes': {
    status: 'brouillon',
    sections: [
      {
        id: 'me-rediger',
        kind: 'methode',
        title: 'Bien rédiger en 5 points',
        body: `- **Que sait-on ?** J’associe à chaque donnée une grandeur et un symbole.
- **Que cherche-t-on ?** J’identifie la grandeur recherchée et son symbole.
- **Quelle formule ?** Je l’écris avec les symboles avant de l’utiliser.
- **Attention aux unités !** Je les précise et je fais les conversions nécessaires.
- **Précision du résultat** : il ne peut pas être plus précis que les données.
Exemple : un voilier à $v$ = 18 km/h navigue $t$ = 10 min. On cherche la distance $d$. On sait que $d = v \\times t$. La vitesse est en km/h, donc 10 min = 10/60 = 0,17 h. $d = 18 \\times 0,17$ = 3,0 km.`,
      },
      {
        id: 'me-conversions',
        kind: 'methode',
        title: 'Conversions',
        body: `- Je trace le tableau des unités.
- Je place le chiffre des unités dans la colonne de l’unité de départ, puis les autres chiffres à sa gauche et à sa droite, **sans la virgule**.
- Je lis le résultat en imaginant la virgule à droite de l’unité d’arrivée.
Exemple : 24,5 dag = 0,245 kg.
Pour une vitesse ou une masse volumique, l’unité est composée : on l’écrit en fraction et on convertit le haut et le bas séparément.`,
      },
      {
        id: 'me-cs',
        kind: 'methode',
        title: 'Précision et chiffres significatifs',
        body: `On compte les chiffres à partir du premier chiffre **non nul** en partant de la gauche. Les zéros à gauche ne comptent pas, ceux à droite comptent.
10,3 mL et 0,0103 L ont tous deux 3 chiffres significatifs.
**La loi du moins précis** : le résultat garde autant de chiffres significatifs que la donnée la moins précise.
Les nombres entiers qui comptent des objets ont une précision totale : si un stylo pèse 21,3 g, 10 stylos pèsent 213 g.`,
      },
      {
        id: 'me-pheroc',
        kind: 'methode',
        title: 'La démarche scientifique : P.H.E.R.O.C.',
        body: `- **Problème** : la question que l’on se pose.
- **Hypothèse** : un avis a priori, à vérifier.
- **Expérience** : un protocole (un point par action, verbes à l’infinitif) et des schémas légendés.
- **Réalisation** : on suit le protocole.
- **Observation** : on note les résultats, sans interpréter.
- **Conclusion** : on interprète, et on répond à la question de départ.
Pour retenir : « féroce », écrit PHEROC.`,
      },
    ],
  },
};
