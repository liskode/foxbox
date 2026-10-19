// À propos : présentation de FoxBox et de ses fonctionnalités.
// ⚠️ À tenir à jour à chaque ajout ou modification de fonctionnalité (voir CLAUDE.md).
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
      'durée de chaque séance',
      'descriptif et documents PDF téléchargeables par les élèves',
      'flashcards rattachées à chaque séance',
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
      'modèles réutilisables',
      'saisie au clavier (/ 1 2 3 4) ou en pourcentage',
      'grille façon tableur',
      'résultats : moyenne, répartition, réussite par critère et par compétence',
      'appréciations',
      'visibilité pour l’élève (note, appréciation, détail, histogramme)',
      'copie des notes pour Pronote et export CSV',
      'renvoi en boîte 1 des flashcards des critères ratés',
    ],
  },
  {
    title: 'Compétences',
    text: 'Suivre les compétences APP, ANA, REA, VAL, COM (et leurs sous-compétences) à partir des critères des évaluations.',
    details: [
      'référentiel modifiable',
      'niveaux du LSU (MI, MF, MS, TBM)',
      'tableau élèves × compétences par classe',
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
      'éditeur avec le code à gauche et le rendu à droite',
      'gras (**mot**), italique, souligné',
      'formules LaTeX entre $ … $',
      'images : fichier, lien internet, collage ou glisser-déposer, sans doublon',
      'flashcard précédente ou suivante avec ← →',
      'import de paquets Anki et de planches PDF recto / verso, avec annulation',
      'export pour Anki (.apkg) des flashcards affichées, rangées par niveau › thème › origine ou par niveau › séquence › séance',
      'lecture automatique du texte des images pour la recherche',
      'statistiques par classe : flashcards difficiles, régularité, classement',
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
      'journal daté des échanges : téléphone, mail, entretien',
      'mail prérempli au sujet d’une évaluation, ouvert dans votre messagerie',
    ],
  },
  {
    title: 'Classes',
    text: 'La vue d’ensemble de chaque classe et ses outils.',
    details: [
      'accès permanent depuis le bandeau (une pastille par classe)',
      'bandeau à la couleur du niveau avec les boutons « Faire l’appel » et « Projeter le plan »',
      'galerie des élèves (photo, prénom, photo agrandie au survol)',
      'sous-groupes (demi-groupes, îlots) avec cerclage de couleur',
      'prochain cours et séances à cocher',
      'notes sur la classe',
      'liste À faire de la classe',
      'onglets Progression, Élèves, Trombi, Plan de classe, Évaluations, Flashcards, Réglages',
      'import des élèves (CSV Pronote) et des photos (PDF trombinoscope)',
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
      'appel : un clic grise l’élève absent',
    ],
  },
  {
    title: 'Soutien scolaire',
    text: 'Suivre des élèves en dehors de ses classes (cours particuliers), avec les mêmes outils : progression, flashcards, espace élève. Module à activer dans les Réglages.',
    details: [
      'un suivi par élève, ou pour 2-3 élèves ensemble (binôme, frères et sœurs)',
      'une ou plusieurs matières, chacune avec son niveau (du collège à la Terminale)',
      'un élève déjà dans une classe garde le même compte',
      'séances : date, heure, durée, à domicile ou en ligne',
      'programme : la Progression du niveau, sans ordre imposé, avec l’état de chaque point (pas vu, vu, à retravailler, acquis)',
      'une séance peut mêler plusieurs matières',
      'contenu de la séance (saisi à l’avance ou après) et travail pour la prochaine fois, formules mathématiques comprises',
      'trois notes par séance : pour l’élève (pas pour les parents), pour les parents (pas pour l’élève), privée',
      'documents (déposés par vous ou par l’élève), liens avec description',
      'flashcards ajoutées pendant la séance (choix en plein écran, les plus récentes en haut, celles choisies grisées), et celles des points travaillés, dans les révisions de l’élève',
      'travail coché « fait » par l’élève',
      'fiche : établissement, classe, objectifs, famille',
      'tarif horaire propre à chaque élève, avec date d’effet et devise (euro, franc suisse, livre, dollar…) ; montant de chaque séance calculé au tarif en vigueur à sa date',
      'règlements : à la séance, forfait payé d’avance (avance restante en heures) ou en fin de mois ; séances réglées, en partie ou à régler',
      'relevé mensuel et attestation annuelle (séances à domicile) à imprimer, avec vos coordonnées et votre SIRET',
      'récapitulatif global par mois et par élève (heures, montants, reçu, domicile / en ligne)',
      'messages : un fil avec l’élève et un fil avec les parents, séparés ; photo, document ou mémo vocal ; pastille des messages non lus',
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
      'messages avec le professeur, que l’élève ne lit pas',
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
      'notification par e-mail des nouveaux messages (professeur, élève, parents : chacun choisit)',
      'origines des flashcards (ER, MM…)',
      'classes : création, couleurs des niveaux, archivage',
      'compte',
    ],
  },
  {
    title: 'Espace élève',
    text: 'Ce que voit l’élève sur ordinateur ou téléphone.',
    details: [
      'révision quotidienne par boîtes de Leitner (7 boîtes, objectif du jour)',
      'pensé pour le téléphone : flashcard en grand, boutons de réponse sous le pouce, menu en bas de l’écran',
      'réponses « Je ne sais pas », « Dur », « Facile »',
      'progrès : série, régularité, boîtes',
      'notes des évaluations rendues avec histogramme des compétences',
      'documents de cours des séances faites',
      'soutien : page d’arrivée des élèves suivis, avec le bouton « Je révise mes flashcards CHAQUE JOUR » avec le nombre à revoir, prochaine séance en tête (date, heure, contenu prévu, documents), consignes de la dernière séance et travail à cocher, dépôt de documents ou de photos, historique des séances avec documents, liens et note personnelle',
      'messages au professeur de soutien (photo, mémo vocal), que les parents ne lisent pas',
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
          <div className="muted">Révisions, progression, évaluations et suivi des élèves en physique-chimie — conçu par et pour un professeur.</div>
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
