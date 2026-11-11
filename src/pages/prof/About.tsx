// À propos : présentation de FoxBox et de ses fonctionnalités.
// ⚠️ À tenir à jour à chaque ajout ou modification de fonctionnalité (voir CLAUDE.md).
// Page « Démo » : ce que chaque profil peut découvrir (à tenir à jour avec les sections ci-dessous)
export const DEMO_COLUMNS: { key: 'prof' | 'eleve' | 'soutien' | 'parent'; icon: string; title: string; sub: string; features: string[] }[] = [
  {
    key: 'prof',
    icon: 'screen',
    title: 'Professeur',
    sub: 'Préparer, enseigner, suivre ses classes',
    features: [
      'tableau de bord : emploi du temps A / B, alertes, liste À faire',
      'progression par niveau, séquences et séances, dates prévues selon l’emploi du temps',
      'évaluations par critères et compétences, correction au clavier, résultats',
      'flashcards : création (formules, images), import Anki et PDF, export Anki',
      'classes : trombinoscope, plans de classe, appel, notes privées',
      'fiches élèves : évaluations, compétences, absences, famille',
      'module « Soutien » pour les cours particuliers : séances, programme, règlements, messagerie',
    ],
  },
  {
    key: 'eleve',
    icon: 'cap',
    title: 'Élève en classe',
    sub: 'Réviser un peu chaque jour',
    features: [
      'révision quotidienne des flashcards par boîtes (objectif du jour)',
      'pensé pour le téléphone : réponses sous le pouce',
      'progrès : série, régularité, avancement',
      'notes des évaluations et histogramme des compétences',
      'documents de cours des séances faites, et documents et liens de chaque séance de soutien (onglet Documents)',
    ],
  },
  {
    key: 'soutien',
    icon: 'handshake',
    title: 'Élève en soutien',
    sub: 'Module « Soutien » : cours particuliers',
    features: [
      'prochaine séance : date, heure, contenu prévu, documents',
      'travail à faire et bouton « Travail fait ? »',
      'flashcards de chaque séance, à réviser chaque jour',
      'dépôt de documents ou de photos',
      'évaluations de son établissement : signaler un DS, suivre ses notes',
      'messagerie avec le professeur',
    ],
  },
  {
    key: 'parent',
    icon: 'family',
    title: 'Parent',
    sub: 'Suivre le soutien de son enfant',
    features: [
      'séances : contenu, travail donné et fait, documents',
      'note du professeur pour les parents',
      'évaluations, copies, notes et graphique de progression',
      'règlements et relevé du mois',
      'messagerie avec le professeur',
    ],
  },
];

const SECTIONS: { title: string; text: string; details: string[] }[] = [
  {
    title: 'Tableau de bord',
    text: "La page d'accueil du professeur : tout ce qui compte aujourd'hui en un coup d'œil.",
    details: [
      'tuiles Progression, Évaluations, Flashcards et Élève avec leurs alertes',
      'classes en retard sur le programme',
      'copies à corriger',
      'élèves à relancer (aucune révision depuis 5 jours)',
      'recherche rapide d’un élève',
      'emploi du temps du jour et de la semaine',
      'liste À faire',
    ],
  },
  {
    title: 'Emploi du temps et calendrier',
    text: "L'emploi du temps Pronote (semaines A et B) et le calendrier de l'année servent à afficher les cours et à prévoir les dates des séances.",
    details: [
      'import des PDF Pronote semaine A et semaine B',
      'calendrier A / B / vacances modifiable au clic',
      'jours fériés',
      'jours de présence',
      'cours « hors progression » (HP) : devoirs faits, orientation…',
      'un clic sur un cours ouvre la classe',
    ],
  },
  {
    title: 'Progression',
    text: 'Les séquences et séances de chaque niveau, dans l’ordre réel de la progression, avec l’avancement de chaque classe et les dates prévues.',
    details: [
      'une colonne par niveau, thèmes du programme et « hors thème »',
      'plusieurs matières (physique-chimie, mathématiques…) avec leurs thèmes, et niveaux du lycée pour le soutien',
      'codes de séquence et de séance (431, 4311…)',
      'physique-chimie de la 6e à la terminale (programme de spécialité de terminale)',
      'en 2nde, 1re et terminale, une séance 0 « Prérequis » en tête de chaque séquence (2110, T110…) : révision des flashcards des niveaux précédents utiles pour la séquence, d’après leur point d’introduction',
      'flashcard suspendue dans une séance : elle y reste, grisée et visible du professeur seul, mais n’est pas donnée aux élèves (boutons « Suspendre » / « Réactiver »)',
      'nouvelle flashcard ajoutée à une séance : elle prend la séquence comme point d’introduction et rejoint automatiquement, suspendue, les séances 0 des niveaux supérieurs',
      'durée de chaque séance',
      'descriptif et documents PDF téléchargeables par les élèves',
      'flashcards rattachées à chaque séance (au moment d’en ajouter, celles déjà dans une autre séance de la progression du niveau sont grisées avec la séance où elles sont, mais peuvent être ajoutées aussi ; une case permet de les masquer ; en soutien, celles déjà données à l’élève)',
      'filtre « Niveaux précédents, absentes de cette progression » au moment d’ajouter des flashcards : retrouver celles retirées d’une séance 0',
      'au moment de choisir des flashcards, verso affiché au survol de la souris',
      'case « faite » par classe à la date du cours, qui publie les flashcards',
      'message de confirmation avec « Annuler »',
      'dates prévues calculées d’après l’emploi du temps et le calendrier',
      'fin de programme prévue ou retard en semaines',
      'séances d’évaluation',
      'masquer ce qui est terminé',
      'réordonner (↑ ↓) avec renumérotation',
    ],
  },
  {
    title: 'Évaluations',
    text: 'Construire une évaluation par critères, corriger copie par copie au clavier et analyser les résultats, classe par classe.',
    details: [
      'une colonne par niveau avec l’état de chaque classe (prévue, à corriger, corrigée)',
      'barème par critère avec compétences et flashcards liées',
      'sujet et corrigé en PDF',
      'variantes selon les classes',
      'modèles réutilisables, qui gardent le sujet et le corrigé (un PDF retiré d’une évaluation reste dans le modèle, et inversement) : un clic sur le modèle l’ouvre en édition ; cocher une classe crée son évaluation et la place dans la Progression, à la fin de la séquence choisie (dans la séance d’évaluation qui s’y trouve déjà, sinon dans une nouvelle)',
      'grille façon tableur, élèves rangés par classe : colonne « Tous » (réussite moyenne par question), puis pour chaque classe sa colonne de moyennes et ses élèves, repliables ; note /20 sous chaque élève, appréciation au survol ; réussite par compétence (en gras) et par sous-compétence, repliables par compétence ; couleurs de réussite réglables dans les Réglages (6 couleurs pour les moyennes, 4 pour les cases élève × critère, seuils en %)',
      'résultats : moyenne, répartition, réussite par critère et par compétence',
      'appréciations',
      'appréciation vocale de chaque copie, réécoutée avant envoi (« Recommencer » possible) : l’élève l’écoute dans son espace, on voit s’il l’a écoutée (date et heure), il peut répondre par écrit ou par un vocal ; nouvelles réponses signalées dans la liste des copies',
      'recherche d’un élève par son prénom dans la liste des copies (Entrée ouvre sa copie)',
      'visibilité pour l’élève (note, appréciation, détail, histogramme)',
      'copie des notes pour Pronote et export CSV',
      'notation en 4 niveaux (touches 1 2 3 4 = 0, 40, 80, 100 %) ou saisie libre',
      'flashcards des critères ratés : retour en boîte 1 (0 %) ou une boîte en arrière (40 %)',
      'autocorrection par l’élève, copie sous les yeux, une fois les copies rendues pour sa classe : ressenti global (4 renards : en pleurs, contrarié, souriant, à lunettes de soleil) et commentaire, puis chaque critère estimé avec 4 visages ; il voit ensuite sa note estimée et la correction du professeur en face, et écrit son bilan',
      'dans la liste des copies : ressenti, note estimée (s’il se surestime ou se sous-estime), estimation de chaque critère et bilan de l’élève',
    ],
  },
  {
    title: 'Compétences',
    text: 'Suivre les compétences RES, ANA, REA, VAL, COM (et leurs sous-compétences) à partir des critères des évaluations.',
    details: [
      'référentiel collège R2026 : RES, ANA, REA, VAL, COM et leurs 20 sous-compétences, modifiable',
      'dans le barème, un clic sur une pastille déplie ses sous-compétences avec leur intitulé, à cocher ; un second clic replie',
      'RES : dans le barème, la séance ou la séquence de la progression à restituer ; dans la grille, une ligne par séance sous RES (points de cours à revoir)',
      'fiche élève : note privée, absences (date et commentaire) et histogramme des compétences côte à côte ; évaluations sur une ligne ; détail en 2 colonnes : points de cours à restituer (les moins réussis d’abord) et sous-compétences ; flashcards ; connexions en bas',
      'tableau de la classe par sous-compétence, avec la part des élèves au-dessus du 2e seuil des critères de réussite',
      'niveaux du LSU (MI, MF, MS, TBM) au survol et dans la fiche élève',
      'tableau élèves × compétences par classe : pourcentage arrondi, aux couleurs et seuils des critères de réussite (Réglages › Évaluations) ; colonnes étroites, intitulés dans le référentiel à gauche, sous-compétences séparées d’un filet',
      'sur les couleurs réglables (grille de correction, compétences), le texte s’écrit en noir sur fond clair et en blanc sur fond foncé',
      'histogramme par compétence pondéré par le barème (correction, résultats, fiche élève, espace élève)',
      'niveau retenu : moyenne des 3 évaluations les plus récentes',
    ],
  },
  {
    title: 'Flashcards',
    text: 'Les flashcards de révision : création, recherche, import, export et codification.',
    details: [
      'code niveau + thème + origine + numéro (ex. 43MM-012)',
      'matière de chaque flashcard, avec les thèmes propres aux mathématiques (nombres, fonctions, statistiques, géométrie, algorithmique)',
      'recherche par mot, code ou joker (43MM*, ??ER*)',
      'filtres par niveau, thème, tag et séquence',
      'point d’introduction de chaque flashcard de physique-chimie (séquence où elle est vue pour la première fois) : onglet « Introduction », propositions d’après sa séance ou son contenu, validées par lot ou corrigées une à une',
      'bas de chaque flashcard à la couleur de son niveau d’introduction (sinon de son niveau), avec la matière, le thème et le code en petit, chez le professeur comme dans les révisions des élèves',
      'éditeur avec le code à gauche et le rendu à droite',
      'gras (**mot**), italique, souligné',
      'formules LaTeX entre $ … $',
      'images : fichier, lien internet, collage ou glisser-déposer, sans doublon',
      'flashcard précédente ou suivante avec ← → (◀ ▶), partout où une flashcard s’ouvre : liste, séquence, séance de soutien, fiche élève, statistiques',
      'import de paquets Anki et de planches PDF recto / verso, avec annulation',
      'export pour Anki (.apkg) des flashcards affichées, rangées par niveau › thème › origine ou par niveau › séquence › séance',
      'lecture automatique du texte des images pour la recherche',
      'statistiques par classe : flashcards difficiles, régularité, classement',
      'calendrier de régularité : 7 semaines, une ligne par semaine, du lundi au dimanche (la semaine en cours en bas)',
    ],
  },
  {
    title: 'Élèves',
    text: 'Retrouver un élève en quelques lettres et accéder à tout ce qui le concerne.',
    details: [
      'recherche par nom ou prénom sans accents',
      'fiche élève : photo, identifiant et mot de passe (réinitialisable)',
      'note privée',
      'aménagements (tiers temps, ULIS, ordinateur)',
      'évaluations et histogramme des compétences',
      'absences avec date, séance et motif',
      'connexions de l’élève et de ses parents : date, heure, durée',
      'flashcards : objectif, règle d’erreur, régularité, boîtes, flashcards difficiles',
      'fiches identifiants à imprimer',
    ],
  },
  {
    title: 'Famille',
    text: "Les coordonnées de la famille et le suivi de tous les échanges, au même endroit (privé).",
    details: [
      'contacts : lien avec l’élève, prénom et nom, e-mail, téléphone',
      'création de l’accès parent de chaque contact (élèves suivis en soutien)',
      'notes sur la famille',
      'journal privé et daté des échanges : téléphone, mail, entretien (rien n’est envoyé aux parents)',
      'bouton « Message FoxBox » vers la conversation de l’élève suivi en soutien',
      'mail prérempli au sujet d’une évaluation, ouvert dans votre messagerie',
    ],
  },
  {
    title: 'Classes',
    text: 'La vue d’ensemble de chaque classe et ses outils.',
    details: [
      'accès permanent depuis le bandeau (une pastille par classe)',
      'bandeau à la couleur du niveau avec les boutons « Faire l’appel » et « Projeter le plan » (choix de la salle quand la classe a plusieurs plans)',
      'galerie des élèves (photo, prénom, photo agrandie au survol)',
      'sous-groupes (demi-groupes, îlots) avec cerclage de couleur',
      'prochain cours et séances à cocher',
      'notes sur la classe',
      'liste À faire de la classe',
      'onglets Progression, Élèves, Trombi, Plan de classe, Évaluations, Flashcards, Réglages',
      'import des élèves (CSV Pronote) et des photos (PDF trombinoscope)',
      'export de la liste des élèves en texte « Nom, Prénom » (pour Plickers par exemple)',
    ],
  },
  {
    title: 'Plans de classe et appel',
    text: 'Placer les élèves dans chaque salle, projeter le plan au tableau et faire l’appel.',
    details: [
      'salles dessinées en cochant un quadrillage',
      'un ou plusieurs plans par classe, salle et sous-groupe',
      'placement au clic, échange, ordre alphabétique ou hasard',
      'vue depuis le bureau',
      'sauvegardes datées avec commentaire et restauration',
      'affichage en grand dans une fenêtre pour le tableau (petite photo, prénom en grand, sans aménagements)',
      'impression A4 portrait',
      'appel : un clic grise l’élève absent, sur le plan ou dans la liste des élèves non placés',
      'commentaire facultatif pour chaque absent (motif, justificatif…) dans le cadre Appel, repris sur sa fiche',
    ],
  },
  {
    title: 'Soutien scolaire',
    text: 'Suivre des élèves en dehors de ses classes (cours particuliers), avec les mêmes outils : progression, flashcards, espace élève. Module à activer dans les Réglages.',
    details: [
      'accueil : un tableau de bord par suivi (messages non lus, documents déposés non vus, évaluations nouvelles, solde des règlements, régularité et boîtes des flashcards, dernières séances de révision (date, heure, nombre), échéances : séances et évaluations à venir)',
      'évaluations de l’élève dans son établissement : signalées par l’élève, un parent ou vous, avec programme, documents et note ; repérées dans l’onglet Programme',
      'fuseaux horaires : séances à l’heure locale de l’élève et des parents, et double heure pour vous (« 16 h (10 h à Ottawa) »)',
      'un suivi par élève, ou un groupe de plusieurs élèves (binôme, frères et sœurs, petit groupe) ; élèves ajoutés ou retirés en cours d’année',
      'onglet Flashcards : série, jours et réussite, régularité, boîtes et 7 dernières séances de révision (date, heure) sur une ligne, puis toutes les flashcards en cours, boîte par boîte (de 1 à 7), et celles en attente (pas encore vues)',
      'suspendre une flashcard pour un élève : elle sort de ses révisions sans être supprimée, et reprend plus tard dans sa boîte',
      'une ou plusieurs matières, chacune avec son niveau (du collège à la Terminale)',
      'un élève déjà dans une classe garde le même compte',
      'séances : date, heure, durée, à domicile (avec l’adresse) ou en ligne',
      'séances de groupe : contenu, documents, programme et flashcards communs ; présents cochés ; seuls les présents reçoivent le contenu de la séance (un absent peut le recevoir d’un clic, « Lui envoyer le contenu ») ; un élève arrivé en cours d’année peut recevoir les séances précédentes ; notes, révisions et règlements restent propres à chaque élève, et les absents ne sont pas facturés',
      'programme : la Progression du niveau, sans ordre imposé, avec l’état de chaque point (pas vu, vu, à retravailler, acquis)',
      'une séance peut mêler plusieurs matières',
      'contenu de la séance (saisi à l’avance ou après) et travail pour la prochaine fois, formules mathématiques comprises',
      'trois notes par séance : pour l’élève (pas pour les parents), pour les parents (pas pour l’élève), privée',
      'documents (déposés par vous ou par l’élève), liens avec description',
      'flashcards ajoutées pendant la séance (choix en plein écran, les plus récentes en haut, celles choisies grisées), et celles des points travaillés, dans les révisions de l’élève',
      'travail à faire : l’élève répond « Fait ! », « En grande partie », « J’ai essayé mais c’était dur » ou « Pas eu le temps », visible par vous et les parents',
      'fiche : établissement, classe, objectifs, famille',
      'tarif horaire propre à chaque élève, avec date d’effet et devise (euro, franc suisse, livre, dollar…) ; montant de chaque séance calculé au tarif en vigueur à sa date',
      'règlements : à la séance, forfait payé d’avance (avance restante en heures) ou en fin de mois ; séances réglées, en partie ou à régler',
      'tarif à 0 (soutien gratuit) : aucun règlement ni montant affiché, ni pour vous ni pour les parents',
      'relevé mensuel et attestation annuelle (séances à domicile) à imprimer, avec vos coordonnées et votre SIRET',
      'récapitulatif global par mois et par élève (heures, montants, reçu, domicile / en ligne)',
      'messages : une conversation par élève, avec un petit rond à côté de chaque message (photo de l’élève, code du parent, votre photo ou logo), destinataires cochés à chaque message (l’élève, un ou plusieurs parents) ; chacun ne lit que ce qui lui est adressé ; photo, document ou mémo vocal (réécouté avant d’être joint, aide « ? » si le micro ne marche pas) ; message corrigeable après envoi ; pastille des messages non lus',
      'groupe : un fil commun au professeur et aux élèves du groupe (pas aux parents), où chacun peut écrire, en plus de la conversation privée de chaque élève',
    ],
  },
  {
    title: 'Espace parents',
    text: 'Un accès pour chaque parent, créé depuis la fiche Famille : il suit le soutien de son enfant sur téléphone ou ordinateur.',
    details: [
      'identifiant : l’adresse e-mail du parent, ou parent.prenom.nom',
      'un même compte pour plusieurs enfants (frères et sœurs)',
      'séances : date, heure, durée, lieu, réglée ou non, contenu de la séance, travail donné et fait, documents, liens',
      'note pour les parents (jamais celle pour l’élève ni la note privée)',
      'règlements, avance ou reste à payer, relevé du mois',
      'messages avec le professeur : « répondre à tous » coché par défaut, chaque destinataire peut être décoché',
      'évaluations de l’enfant : signaler un DS à venir, voir les copies, les notes et le graphique de progression',
    ],
  },
  {
    title: 'Trombi',
    text: 'Apprendre les prénoms de ses élèves et imprimer le trombinoscope.',
    details: [
      'entraînement par boîtes (comme les flashcards)',
      'entraînement libre',
      'par classe ou toutes classes',
      'impression A4 avec visages recadrés',
    ],
  },
  {
    title: 'Réglages',
    text: 'Ce que l’on modifie rarement.',
    details: [
      'emploi du temps et calendrier',
      'salles',
      'référentiel de compétences',
      'modules à activer (soutien scolaire), coordonnées des relevés et attestations',
      'démo en lecture seule : lien à partager, profils proposés (professeur, élève en classe, élève en soutien, parent), mot d’accueil, fermeture de la démo',
      'messages : votre photo ou logo, interlocuteurs de la famille et leur code (Mère M, Père P, Grand-mère GM…)',
      'notification par e-mail des nouveaux messages (professeur, élève, parents : chacun choisit)',
      'origines des flashcards (ER, MM…)',
      'classes : couleurs des niveaux (de la 6e à la terminale) dans les Réglages ; renommage, archivage et suppression dans l’onglet Réglages de la classe (la couleur suit le niveau du nouveau nom) ; page Élèves : une tuile compacte par classe (couleur du niveau, nombre d’élèves) et une tuile « + » pour en créer une',
      'choix des couleurs dans une palette standard (couleurs vives, gris, 12 teintes du foncé au pâle)',
      'compte',
    ],
  },
  {
    title: 'Espace élève',
    text: 'Ce que voit l’élève sur ordinateur ou téléphone.',
    details: [
      'révision quotidienne par boîtes de Leitner (7 boîtes, objectif du jour)',
      'le jour de révision change à 3 h du matin (et non à minuit), à l’heure de l’élève : celle du fuseau fixé dans son suivi de soutien, sinon celle de son appareil',
      'pensé pour le téléphone : flashcard en grand, boutons de réponse sous le pouce, menu en bas de l’écran',
      'réponses « Je ne sais pas », « J’hésite… », « Facile »',
      'progrès : série, régularité, boîtes',
      'onglet Évaluations (élèves suivis en soutien) : « Signaler un DS à venir » (date, matière, programme par points cochés, texte ou capture Pronote), puis copie, corrigé et note ; graphique de progression par matière ; notes des évaluations rendues en classe',
      'documents de cours des séances faites',
      'soutien : page d’arrivée des élèves suivis, avec le bouton « Je révise mes flashcards CHAQUE JOUR » avec le nombre à revoir, prochaine séance en tête (date, heure, contenu prévu, documents), consignes de la dernière séance et bouton « Travail fait ? » (4 réponses possibles), dépôt de documents ou de photos, historique des séances avec documents, liens et note personnelle',
      'messages au professeur de soutien (photo, mémo vocal), lus seulement par les destinataires cochés',
    ],
  },
  {
    title: 'Physifox',
    text: 'Votre site public de cours : les visiteurs consultent les chapitres, ajoutent les flashcards à leur Deck et s’entraînent. Vous suivez tout depuis l’onglet Physifox.',
    details: [
      'chapitres consultables sans compte, modifiables et publiés un par un, avec leurs schémas',
      'flashcards rattachées à des notions du programme : changer de progression ne les touche pas',
      'inscription avec e-mail et pseudo ; classe, établissement et pays facultatifs',
      'comptes visiteurs séparés des élèves, sans aucun accès au reste de FoxBox',
      'Deck et entraînement par boîtes de Leitner, adaptés au téléphone',
      'bouton « Signaler » sur chaque flashcard et messagerie privée avec le professeur',
      'passage en revue des nouvelles flashcards : valider, corriger (formules, images collées) ou écarter avant qu’elles soient visibles, depuis l’onglet Physifox ou l’onglet Flashcards (« À valider »)',
      'dans l’onglet Physifox, sous chaque partie du cours : ses flashcards, à modifier, déplacer vers une autre partie ou compléter (nouvelle flashcard, ou flashcard existante retrouvée par mot-clé)',
      'statistiques : visiteurs, activité, flashcards les plus ratées',
      'suppression du compte par le visiteur, page de confidentialité',
    ],
  },
  {
    title: 'Sécurité et fonctionnement',
    text: 'FoxBox fonctionne même sans réseau et protège les données personnelles.',
    details: [
      'copie locale et synchronisation automatique',
      'envois refusés mis de côté sans bloquer les autres',
      'données privées (notes, aménagements, famille, absences, notes de séance de soutien) lisibles par le seul professeur, protégées par le serveur',
      'hébergement en France (Paris)',
      'mise à jour signalée par un bandeau',
      'sur téléphone : menu déroulant (pages, classes, réglages) à la place du bandeau, onglets en menu déroulant, pages sur une colonne, grands tableaux qui défilent dans leur cadre',
      'réparation automatique des images',
      'pages chargées à la demande',
      'charte graphique commune (cadres, couleurs d’état, icônes au trait)',
    ],
  },
];

export function About() {
  return (
    <div className="page stack" style={{ maxWidth: 900 }}>
      <div className="row" style={{ gap: 16 }}>
        <img src="./logo.png" alt="" style={{ width: 80 }} />
        <div>
          <h1 className="title" style={{ margin: 0 }}>
            FoxBox
          </h1>
          <div className="muted">Révisions, progression, évaluations et suivi des élèves, en classe et en cours particuliers — conçu par et pour un professeur.</div>
        </div>
      </div>
      {SECTIONS.map((s) => (
        <div key={s.title} className="stack" style={{ gap: 4 }}>
          <b style={{ fontSize: '1.1rem' }}>{s.title}</b>
          <div>{s.text}</div>
          <div className="muted" style={{ fontSize: '0.75rem', lineHeight: 1.4 }}>
            {s.details.join(' - ')}
          </div>
        </div>
      ))}
    </div>
  );
}
