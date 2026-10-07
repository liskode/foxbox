# FoxBox

Cartes de révision (boîte de Leitner) pilotées par le professeur : le professeur crée et publie les cartes
séquence par séquence, les élèves révisent chaque jour, et le professeur suit la progression.

## Lancer la démonstration

Double-cliquez sur **`Lancer FoxBox.command`** (la première fois, macOS peut demander une confirmation :
clic droit › Ouvrir). Le navigateur s'ouvre sur http://localhost:5173.

- Compte professeur de démonstration : `prof` / `foxbox`
- Les identifiants élèves sont générés à l'import des classes (onglet Classes › Élèves, ou les fiches à imprimer).

Dans cette version, **toutes les données restent dans le navigateur** utilisé (rien n'est envoyé en ligne).
Changer de navigateur = repartir de zéro. Le bouton « Tout effacer » (onglet Import) remet l'outil à vide.

## Parcours conseillé

1. Import › choisir le paquet `.apkg` (175 cartes de 4e importées en 1 seconde).
2. La lecture du texte des images démarre seule en arrière-plan (≈ 2 min) ; la recherche par mot-clé s'améliore au fur et à mesure.
3. Import › « Générer les données de démo » : deux classes fictives, des séquences par thème, 30 jours de révisions simulées.
4. Explorer : Classes › 4e A (classement, cartes difficiles, élèves à relancer), fiche d'un élève, Séquences (publier, ajouter des cartes).
5. Se déconnecter et se connecter avec un identifiant élève (affiché sur l'écran de connexion) pour tester une séance.

## Règles retenues (cahier des charges v1)

- Codification d'origine `NTPFCnn` : N = niveau, T = thème (1 Matière, 2 Mouvement, 3 Énergie, 4 Signaux, 9 Outils
  mathématiques), P/nn = planche papier (conservé comme simple référence). Chaque carte reçoit aussi un code FoxBox unique `C0001`.
- Découpage : Séquence › Séance. Une carte peut appartenir à plusieurs séquences ; elle n'est jamais révisée en double.
- Publication d'une séquence ou d'une séance pour une classe, à une date choisie (possible à l'avance).
- Leitner 7 boîtes, intervalles 1-2-4-8-16-32-64 jours.
  - Vert « Facile » : boîte suivante. Orange « Dur » : reste dans sa boîte. Rouge « Je ne sais pas » : boîte 1 (règle
    stricte, par défaut) ou boîte précédente (règle douce), réglable élève par élève par le professeur.
  - Nouvelle carte : vert → boîte 2, orange/rouge → boîte 1.
- Objectif quotidien par matière, réglable par l'élève et par le professeur. Cartes en retard d'abord, puis les nouvelles.
- Score de classement (visible du professeur seul) : 50 % régularité (jours avec révision sur 30 j) + 50 % réussite (vert + orange).
- Carte difficile (élève) : vue au moins 2 fois et ratée au moins une fois sur deux. Carte difficile (classe) : vue au
  moins 3 fois, triée par taux de réussite.
- Les élèves restent en base d'une année sur l'autre (pas de doublon à l'import CSV) et gardent leurs cartes ; une classe peut être archivée.

## Photos et Trombi

- Photo de l'élève affichée partout où apparaît son nom (classement, liste, fiche, accueil élève, fiches identifiants).
- Import groupé : sélectionner plusieurs photos nommées « DUPONT Marie.jpg », « marie.dupont.png »… ; association
  automatique (un nom ambigu n'est pas associé et est signalé). Clic sur un avatar pour ajouter/changer une photo.
  Les photos sont réduites à 400 px.
- Onglet **Trombi** (professeur) : galerie par classe (noms masquables) et entraînement Leitner pour mémoriser les
  prénoms (séances de 20, un visage oublié revient en fin de séance). Progression propre à chaque professeur.
- Données de démo : avatars dessinés (pas de vraies photos).
- RGPD / droit à l'image : photos d'élèves mineurs = données personnelles ; usage interne au professeur, avec
  l'accord de l'établissement. En ligne, elles seront dans un espace de stockage privé, visibles des seuls professeurs de l'élève (et de l'élève).

## Prochaines étapes

- Mise en ligne : base Supabase (comptes, données partagées entre ordinateurs et téléphones) + hébergement GitHub Pages.
- Comptes professeurs multiples, établissements, invitations de collègues.
- Export / import de paquets entre professeurs.

## Technique (pour mémoire)

React + TypeScript (Vite). Données locales : IndexedDB (Dexie), schéma calqué sur le futur schéma Supabase
(`src/lib/db.ts`). Import Anki : JSZip + zstd + sql.js (`src/lib/apkg.ts`). Lecture des images : tesseract.js (`src/lib/ocr.ts`).
Moteur de révision : `src/lib/leitner.ts`. Statistiques : `src/lib/stats.ts`.
