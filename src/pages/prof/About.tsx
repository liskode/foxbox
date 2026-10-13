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
      'codes de séquence et de séance (431, 4311…)',
      'durée de chaque séance',
      'descriptif et documents PDF téléchargeables par les élèves',
      'flashcards rattachées à chaque séance',
      'case « faite » par classe à la date du cours, qui publie les flashcards',
      'dates prévues calculées d’après l’emploi du temps et le calendrier',
      'fin de programme prévue ou retard en semaines',
      'séances d’évaluation 📝',
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
    text: 'Les flashcards de révision : création, recherche, import et codification.',
    details: [
      'code niveau + thème + origine + numéro (ex. 43MM-012)',
      'recherche par mot, code ou joker (43MM*, ??ER*)',
      'filtres par niveau, thème, tag et séquence',
      'éditeur avec le code à gauche et le rendu à droite',
      'gras (**mot**), italique, souligné',
      'formules LaTeX entre $ … $',
      'images : fichier, lien internet, collage ou glisser-déposer, sans doublon',
      'flashcard précédente ou suivante avec ← →',
      'import de paquets Anki et de planches PDF recto / verso, avec annulation',
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
      'contacts (e-mail, téléphone)',
      'notes sur la famille',
      'journal daté des échanges : téléphone, mail, entretien',
      'mail prérempli au sujet d’une évaluation, ouvert dans votre messagerie',
    ],
  },
  {
    title: 'Classes',
    text: 'La vue d’ensemble de chaque classe et ses outils.',
    details: [
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
      'réponses « Je ne sais pas », « Dur », « Facile »',
      'progrès : série, régularité, boîtes',
      'notes des évaluations rendues avec histogramme des compétences',
      'documents de cours des séances faites',
    ],
  },
  {
    title: 'Sécurité et fonctionnement',
    text: 'FoxBox fonctionne même sans réseau et protège les données personnelles.',
    details: [
      'copie locale et synchronisation automatique',
      'envois refusés mis de côté sans bloquer les autres',
      'données privées (notes, aménagements, famille, absences) lisibles par le seul professeur, protégées par le serveur',
      'hébergement en France (Paris)',
      'mise à jour signalée par un bandeau',
      'réparation automatique des images',
      'pages chargées à la demande',
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
