// À propos : présentation de FoxBox et de ses fonctionnalités.
// ⚠️ À tenir à jour à chaque ajout ou modification de fonctionnalité (voir CLAUDE.md).
import { useState } from 'react';
import { Icon } from '../../components/Icon';
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
      'révision quotidienne des flashcards par boîtes, toutes matières mélangées (objectif du jour)',
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
      'plusieurs matières (physique-chimie, mathématiques, tchèque…) avec leurs thèmes, niveaux du lycée pour le soutien et niveau A pour les langues (thèmes Vocabulaire et Grammaire)',
      'codes de séquence et de séance (431, 4311…)',
      'physique-chimie de la 6e à la terminale (programme de spécialité de terminale)',
      'en 2nde, 1re et terminale, une séance 0 « Prérequis » en tête de chaque séquence (2110, T110…) : révision des flashcards des niveaux précédents utiles pour la séquence, d’après leur point d’introduction',
      'flashcard suspendue dans une séance : elle y reste, grisée et visible du professeur seul, mais n’est pas donnée aux élèves (boutons « Suspendre » / « Réactiver »)',
      'nouvelle flashcard ajoutée à une séance : elle prend la séquence comme point d’introduction et rejoint automatiquement, suspendue, les séances 0 des niveaux supérieurs',
      'durée de chaque séance',
      'descriptif et documents pour les élèves : PDF téléchargeables et animations HTML (par exemple faites avec Claude), qui s’ouvrent en plein écran dans FoxBox, isolées du reste du site',
      'flashcards rattachées à chaque séance (au moment d’en ajouter, celles déjà dans une autre séance de la progression du niveau sont grisées avec la séance où elles sont, mais peuvent être ajoutées aussi ; une case permet de les masquer ; en soutien, celles déjà données à l’élève)',
      'filtre « Niveaux précédents, absentes de cette progression » au moment d’ajouter des flashcards : retrouver celles retirées d’une séance 0',
      'au moment de choisir des flashcards, verso affiché au survol de la souris',
      'case « faite » par classe à la date du cours, qui publie les flashcards',
      'message de confirmation avec « Annuler »',
      'dates prévues calculées d’après l’emploi du temps et le calendrier',
      'fin de programme prévue ou retard en semaines',
      'séances d’évaluation',
      'masquer ce qui est terminé',
      'réordonner (↑ ↓) avec renumérotation ; les documents dont le nom commence par le numéro (« 2112 … - Cours.pdf ») sont renommés en même temps',
      'fiches de cours et d’exercices avec un code définitif matière-niveau-numéro-type (MAT-2nde-017-C), qui ne change pas quand la séance bouge ; le code libre suivant est proposé dans le descriptif de la séance',
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
      'niveaux du LSU (MI, MF, MS, TBM) au survol ; dans la fiche élève, détail des compétences en barres horizontales (longueur = points évalués, vert = réussi), sur la même échelle pour les points de cours et les sous-compétences',
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
    title: 'Communication',
    text: 'Écrire aux élèves et aux parents de toutes les classes, et organiser les rencontres parents-professeurs.',
    details: [
      'messagerie comme en soutien : une conversation par élève, destinataires cochés (l’élève, ses parents), photos, documents, mémos vocaux ; conversations récentes et messages non lus',
      'les parents écrivent depuis leur onglet Messages (accès parent créé dans la fiche Famille) ; les élèves d’une classe seulement si la case « Les élèves peuvent m’écrire » est cochée dans les réglages de la classe (sinon ils lisent vos messages sans pouvoir répondre) ; en soutien, toujours',
      'rendez-vous parents : plages de disponibilité sur un ou plusieurs jours, durée d’un rendez-vous, classes concernées, lieu, message, date limite de réservation ; nombre de rencontres à prévoir (élèves des classes choisies) face au nombre de créneaux, en vert s’il y en a assez',
      'les parents choisissent un créneau libre, le changent ou l’annulent ; ils voient les créneaux pris, jamais par qui ; deux familles ne peuvent pas prendre le même créneau',
      'planning : une ligne par rendez-vous, dans l’ordre des jours et des heures, avec l’élève, sa classe et les coordonnées de la famille (téléphone cliquable, fiche Famille) ; inscrire soi-même une famille (élèves par classe puis par prénom), annuler ; familles sans rendez-vous par classe ; impression',
    ],
  },
  {
    title: 'Élèves',
    text: 'Retrouver un élève en quelques lettres et accéder à tout ce qui le concerne.',
    details: [
      'recherche par nom ou prénom sans accents',
      'fiche élève : photo, identifiant et mot de passe (réinitialisable)',
      'bouton « Élève parti le… » sur la fiche élève (à côté de Supprimer) : date du départ, nouvelle classe ou autre établissement ; l’élève sort des listes, de l’appel et des nouvelles évaluations, mais ses notes, absences et flashcards sont conservées ; une ligne est ajoutée à sa note (« Élève ayant quitté la classe … le … ») ; il reste grisé dans la liste des élèves de la classe (avec « Réintégrer ») et dans les évaluations passées, pour consulter ses notes',
      'note privée',
      'aménagements (tiers temps, ULIS, ordinateur)',
      'évaluations et histogramme des compétences',
      'absences avec date, séance et motif',
      'connexions de l’élève et de ses parents : date, heure, durée',
      'flashcards, comme en soutien : objectif par jour et règle d’erreur modifiables dans le récapitulatif (série, jours, réussite, score, régularité, boîtes, dernières révisions), puis toutes ses flashcards boîte par boîte et les flashcards difficiles, avec le bandeau à la couleur du niveau',
      '« suspendre » sur une flashcard : elle sort des révisions de cet élève sans être supprimée, et « reprendre » la remet dans sa boîte ; les suspendues sont comptées dans les histogrammes (barre grise « Susp. » à gauche des nouvelles), avec la mention « par l’élève » quand c’est lui qui l’a retirée',
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
      'Réglages : case « Les élèves peuvent retirer des flashcards de leur pile » (autorisé dès qu’une classe ou un soutien en cours de l’élève l’autorise)',
    ],
  },
  {
    title: 'Co-enseignement',
    text: 'Partager une classe ou une séquence avec un collègue, en lecture seule ou avec le droit de modifier.',
    details: [
      'ajout d’un collègue par son adresse e-mail et son droit (Réglages de la classe) : sans compte FoxBox, son compte est créé aussitôt et vous recevez le message à lui envoyer (adresse du site, identifiant, mot de passe provisoire), à copier d’un clic',
      'à sa première connexion, le collègue choisit son propre mot de passe',
      'droit de chaque collègue modifiable à tout moment : pas d’accès, lecture seule ou modification',
      'lecture seule : il voit les élèves, la progression, les séances faites, les évaluations de la classe et les résultats, avec un bandeau « lecture seule »',
      'modification : il peut aussi cocher les séances faites, corriger les copies, modifier les évaluations de la classe et les séquences, séances et flashcards du niveau',
      'partage d’une seule séquence en modification (case « Partager la modification » sur la séquence)',
      'restent privés : notes, aménagements, coordonnées des familles, absences, notes de classe, messages aux parents',
      'seul le professeur principal choisit les co-enseignants, supprime la classe ou un élève et gère les comptes parents',
      'rien ne change pour les élèves et les familles : messages et notes restent au nom du professeur principal',
      'règles vérifiées par le serveur',
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
      'onglet Flashcards : objectif par jour et règle d’erreur modifiables, série, jours, réussite et score, régularité, boîtes et 7 dernières séances de révision (date, heure) sur une ligne, puis toutes les flashcards en cours, boîte par boîte (de 1 à 7), et celles en attente (pas encore vues), avec le bandeau à la couleur du niveau',
      'suspendre une flashcard pour un élève : elle sort de ses révisions sans être supprimée, et reprend plus tard dans sa boîte',
      'case « Peut retirer des flashcards de sa pile » dans le récapitulatif de l’onglet Flashcards',
      'une ou plusieurs matières, chacune avec son niveau (du collège à la Terminale, ou niveau A pour une langue)',
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
      'modules à activer (soutien scolaire ; onglet Physifox et ouverture du site public pour l’administrateur du site), coordonnées des relevés et attestations',
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
      'révision quotidienne par boîtes de Leitner (7 boîtes, objectif du jour par matière) : un seul bouton « Commencer » mélange toutes les matières ; cases à décocher pour ne réviser qu’une partie des matières',
      'le jour de révision change à 3 h du matin (et non à minuit), à l’heure de l’élève : celle du fuseau fixé dans son suivi de soutien, sinon celle de son appareil',
      'pensé pour le téléphone : flashcard en grand, boutons de réponse sous le pouce, menu en bas de l’écran',
      'réponses « Je ne sais pas », « J’hésite… », « Facile »',
      'langues : bouton haut-parleur au verso des flashcards de vocabulaire, qui lit la réponse avec la voix de l’appareil (tchèque : voix « Zuzana » sur iPhone, iPad et Mac) ; aussi sur la fiche d’une flashcard côté professeur',
      'progrès : série, régularité, boîtes (avec les flashcards suspendues), toutes matières confondues ou matière par matière',
      'si sa classe ou son soutien l’autorise : bouton « Retirer cette flashcard de ma pile » au-dessus de la flashcard pendant la révision, et bloc « Retirées de ma pile » sur l’accueil pour les reprendre',
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
      'site public fermé ou ouvert d’un clic (Réglages › Modules) : fermé, les visiteurs voient « Bientôt de retour » et ne peuvent plus rien lire, l’administrateur voit tout',
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
      'copie locale et synchronisation automatique, qui rattrape aussi les changements envoyés au même moment depuis un autre appareil',
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

// Présentation visuelle (captures faites avec des élèves fictifs dans la démo locale : public/apropos)
const IMG = (name: string) => `./apropos/${name}.jpg`;

function Shot({ name, alt, phone }: { name: string; alt: string; phone?: boolean }) {
  return (
    <a href={IMG(name)} target="_blank" rel="noreferrer" className={phone ? 'ab-phone' : 'ab-shot'} title="Agrandir">
      <img src={IMG(name)} alt={alt} loading="lazy" />
    </a>
  );
}

const LOOP: { icon: string; title: string; text: string }[] = [
  { icon: 'check', title: 'Je fais cours', text: 'Je coche la séance « faite » pour la classe.' },
  { icon: 'cards', title: 'Les flashcards arrivent', text: 'Celles de la séance rejoignent la pile de chaque élève.' },
  { icon: 'phone', title: 'L’élève révise', text: 'Quelques minutes par jour, sur son téléphone, par boîtes.' },
  { icon: 'eval', title: 'Le DS vérifie', text: 'Une question ratée renvoie ses flashcards en boîte 1.' },
];

const FEATURES: { kicker: string; title: string; text: string; points: string[]; shots: { name: string; alt: string; phone?: boolean }[]; signature?: boolean }[] = [
  {
    kicker: 'La signature de FoxBox',
    signature: true,
    title: 'Une erreur au DS relance les bonnes révisions',
    text: 'Chaque question du barème est reliée aux flashcards qu’elle évalue. Pendant la correction, une question ratée remet automatiquement ces flashcards en boîte 1 pour l’élève concerné : il les reverra dès le lendemain. L’erreur devient du travail ciblé, sans rien préparer de plus.',
    points: ['0 % à une question : ses flashcards repartent en boîte 1', '40 % : elles reculent d’une boîte', 'chaque question est aussi reliée aux compétences et aux séances à restituer'],
    shots: [{ name: 'bareme2', alt: 'Barème : chaque critère est relié à des compétences et à des flashcards' }],
  },
  {
    kicker: 'Côté élève',
    title: 'Réviser un peu chaque jour, sur son téléphone',
    text: 'L’élève retrouve les flashcards des séances faites en classe, au bon moment grâce aux boîtes de Leitner : ce qu’il sait revient de moins en moins souvent, ce qu’il oublie revient vite. Un seul bouton pour réviser toutes ses matières mélangées, un objectif du jour, une série de jours, un calendrier de régularité : de quoi garder le rythme.',
    points: ['réponses sous le pouce : rouge à gauche, vert à droite', 'formules, images et schémas sur les flashcards', 'vous voyez qui révise et qui décroche'],
    shots: [
      { name: 'eleve', alt: 'Accueil de l’élève : objectif du jour, série, régularité', phone: true },
      { name: 'rev2', alt: 'Une flashcard retournée, avec les trois boutons de réponse', phone: true },
    ],
  },
  {
    kicker: 'Correction',
    title: 'Corriger au clavier, copie par copie',
    text: 'Les touches 1, 2, 3, 4 notent chaque critère et passent au suivant. La note, l’histogramme des compétences et la grille de la classe se mettent à jour en direct. Une appréciation vocale peut accompagner chaque copie : l’élève l’écoute dans son espace et peut répondre.',
    points: ['grille façon tableur, réussite par question et par compétence', 'copie des notes pour Pronote', 'modèles d’évaluation réutilisables d’une année sur l’autre'],
    shots: [{ name: 'ev', alt: 'Correction d’une copie : critères, niveaux, histogramme des compétences' }],
  },
  {
    kicker: 'Original',
    signature: true,
    title: 'L’élève s’autocorrige avant de voir sa note',
    text: 'Quand les copies sont rendues, l’élève reprend sa copie et dit d’abord comment il pense avoir réussi, avec quatre renards, puis estime chaque question. Il découvre ensuite la correction du professeur en face de la sienne, et écrit ce qu’il a compris. Vous voyez qui se surestime ou se sous-estime.',
    points: ['ressenti global et commentaire', 'note estimée et note du professeur côte à côte', 'bilan : « ce que je n’avais pas compris, ce que j’ai compris »'],
    shots: [
      { name: 'auto2', alt: 'Autocorrection : quatre renards pour dire comment on pense avoir réussi', phone: true },
      { name: 'notes', alt: 'Note estimée par l’élève et note du professeur, critère par critère', phone: true },
    ],
  },
  {
    kicker: 'Préparer',
    title: 'Une progression qui calcule ses dates',
    text: 'Séquences et séances de chaque niveau, dans l’ordre réel de l’année. D’après l’emploi du temps Pronote et le calendrier, FoxBox prévoit la date de chaque séance pour chaque classe et vous dit si vous êtes dans les temps ou en retard.',
    points: ['avancement de chaque classe d’un coup d’œil', 'flashcards, descriptif et documents rattachés à chaque séance', 'codes de séance stables pour les fiches de cours'],
    shots: [{ name: 'prog', alt: 'Progression : une colonne par niveau, avancement et dates prévues par classe' }],
  },
  {
    kicker: 'Enseigner',
    title: 'Des animations interactives dans le cours',
    text: 'Une animation HTML, faite par exemple avec Claude, se joint à une séance comme un PDF. Elle s’ouvre en plein écran dans FoxBox, en classe comme chez l’élève, isolée du reste du site.',
    points: ['même endroit que les documents de cours', 'disponible pour les élèves dès que la séance est faite'],
    shots: [{ name: 'anim', alt: 'Animation interactive comparant un circuit électrique et un circuit d’eau' }],
  },
  {
    kicker: 'Suivre',
    title: 'Chaque classe en un coup d’œil',
    text: 'Trombinoscope, prochain cours, avancement, appel, plans de classe et notes privées : tout ce qu’il faut avant d’entrer en salle. La fiche de chaque élève réunit ses évaluations, ses compétences, ses révisions et ses absences.',
    points: ['appel en un clic depuis la photo', 'plans de classe et sous-groupes', 'aménagements et notes visibles par vous seul'],
    shots: [{ name: 'classe', alt: 'Page d’une classe : trombinoscope, prochain cours, progression' }],
  },
];

const ALSO: { icon: string; title: string; text: string }[] = [
  { icon: 'handshake', title: 'Cours particuliers', text: 'Séances, travail à faire, règlements, attestations.' },
  { icon: 'family', title: 'Parents', text: 'Suivi du soutien, messagerie, rendez-vous.' },
  { icon: 'users', title: 'Co-enseignement', text: 'Une classe partagée avec un collègue, en lecture ou en modification.' },
  { icon: 'laptop', title: 'Physifox', text: 'Un site public de cours avec flashcards.' },
  { icon: 'message', title: 'Messagerie', text: 'Photos et mémos vocaux, avec élèves et familles.' },
  { icon: 'target', title: 'Compétences', text: 'Référentiel modifiable, niveaux du LSU.' },
  { icon: 'cards', title: 'Import Anki et PDF', text: 'Récupérer ses paquets et ses planches.' },
  { icon: 'sync', title: 'Même sans réseau', text: 'Copie locale et synchronisation automatique.' },
  { icon: 'lock', title: 'Données protégées', text: 'Hébergées en France, notes privées lisibles par vous seul.' },
];

export function About() {
  const [details, setDetails] = useState(false);
  if (details) return <AboutDetails onBack={() => setDetails(false)} />;
  return (
    <div className="page stack ab" style={{ maxWidth: 1100, gap: 48 }}>
      <section className="ab-hero">
        <div className="stack" style={{ gap: 16 }}>
          <div className="row" style={{ gap: 16 }}>
            <img src="./logo.png" alt="" style={{ width: 72 }} />
            <h1 className="title" style={{ margin: 0 }}>FoxBox</h1>
          </div>
          <p className="ab-lead">Vos élèves retiennent ce que vous enseignez.</p>
          <p className="muted" style={{ margin: 0, fontSize: '1.05rem', lineHeight: 1.5 }}>
            Progression, flashcards, évaluations et suivi des élèves dans un seul outil, conçu par un professeur de physique-chimie. Chaque partie nourrit les autres :
            ce qui est fait en classe arrive dans les révisions, et ce qui est raté au DS y revient.
          </p>
          <div className="row" style={{ gap: 8 }}>
            <span className="tag plain">en classe</span>
            <span className="tag plain">en cours particuliers</span>
            <span className="tag plain">sur ordinateur et téléphone</span>
          </div>
        </div>
        <Shot name="dash" alt="Tableau de bord du professeur : emploi du temps, alertes, liste À faire" />
      </section>

      <section className="stack" style={{ gap: 16 }}>
        <h2 className="ab-h2">La boucle FoxBox</h2>
        <div className="ab-loop">
          {LOOP.map((s, i) => (
            <div key={s.title} className="ab-step">
              <div className="ab-num">{i + 1}</div>
              <Icon name={s.icon} size={22} />
              <b>{s.title}</b>
              <span className="muted small">{s.text}</span>
            </div>
          ))}
        </div>
      </section>

      {FEATURES.map((f, i) => (
        <section key={f.title} className={`ab-feature${i % 2 ? ' ab-rev' : ''}${f.shots.every((s) => s.phone) ? ' phones' : ''}`}>
          <div className="stack" style={{ gap: 8 }}>
            <span className={`ab-kicker${f.signature ? ' sig' : ''}`}>{f.kicker}</span>
            <h2 className="ab-h2">{f.title}</h2>
            <p style={{ margin: 0, lineHeight: 1.55 }}>{f.text}</p>
            <ul className="ab-points">
              {f.points.map((p) => (
                <li key={p}>
                  <Icon name="check" size={16} /> {p}
                </li>
              ))}
            </ul>
          </div>
          <div className="ab-shots">
            {f.shots.map((s) => (
              <Shot key={s.name} {...s} />
            ))}
          </div>
        </section>
      ))}

      <section className="stack" style={{ gap: 16 }}>
        <h2 className="ab-h2">Et aussi</h2>
        <div className="ab-also">
          {ALSO.map((a) => (
            <div key={a.title} className="panel calm stack" style={{ gap: 4 }}>
              <b className="row" style={{ gap: 8 }}>
                <Icon name={a.icon} size={18} /> {a.title}
              </b>
              <span className="muted small">{a.text}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="panel stack" style={{ alignItems: 'center', textAlign: 'center', gap: 8 }}>
        <b style={{ fontSize: '1.1rem' }}>Envie de tout savoir ?</b>
        <span className="muted">La liste complète des fonctionnalités, rubrique par rubrique.</span>
        <button className="btn" onClick={() => (setDetails(true), window.scrollTo(0, 0))}>
          Voir toutes les fonctionnalités
        </button>
        <span className="muted small">Captures réalisées avec des élèves fictifs.</span>
      </section>
    </div>
  );
}

// Liste exhaustive des fonctionnalités (derrière le lien « Voir toutes les fonctionnalités »)
function AboutDetails({ onBack }: { onBack: () => void }) {
  return (
    <div className="page stack" style={{ maxWidth: 900 }}>
      <button className="btn ghost small" style={{ alignSelf: 'flex-start' }} onClick={onBack}>
        ← Présentation
      </button>
      <h1 className="title" style={{ margin: 0 }}>
        Fonctionnalités
      </h1>
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
