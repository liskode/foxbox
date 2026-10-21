# FoxBox — consignes du projet

- **Page « À propos » à tenir à jour** : `src/pages/prof/About.tsx` présente toutes les fonctionnalités (titre, court paragraphe, détails séparés par « - »). À chaque ajout, modification ou suppression de fonctionnalité, mettre cette page à jour dans le même commit.
- L'utilisateur (professeur de physique-chimie) ne code pas : réponses en français, concises, sans jargon ; il teste et fait des retours.
- Vocabulaire de l'interface : « flashcard » (jamais « carte »), « séquence », « séance », « Évaluations ».
- Données privées (notes, aménagements, famille, absences, notes de classe) : tables propres au professeur, protégées par les règles d'accès du serveur ; ne jamais les rendre lisibles aux élèves ni à d'autres professeurs.
- Vérifier chaque modification dans la démo locale avant publication ; publier par `git push` (déploiement GitHub Pages).
- **Nouvelle table Supabase** (à partir du 30/10/2026, Supabase ne donne plus automatiquement l'accès aux nouvelles tables) : dans la migration qui crée la table, toujours activer les règles d'accès (`alter table … enable row level security` + policies) **et** ajouter les droits explicites :
  `grant select, insert, update, delete on public.ma_table to authenticated;` et `grant select, insert, update, delete on public.ma_table to service_role;`.
  Pas de droit pour `anon` (FoxBox n'a besoin d'aucune lecture sans connexion). Sans ces lignes, l'appli reçoit « permission denied ».
- **Démo en lecture seule** (lien `#/demo`, réglée dans Réglages › Démo) : toute nouvelle table doit aussi recevoir les 3 règles restrictives `demo_readonly_ins/upd/del` (`as restrictive … not public.is_demo_session()`, voir la migration `20261025000000_demo.sql`), et toute fonction serveur qui modifie des données doit refuser les sessions de `demo_sessions`.

## Charte graphique (maquette validée le 14/10/2026)

- **Cadres** : le gros cadre noir + ombre (`.panel.strong`, `.btn.primary`) est réservé à ce qui s'ouvre ou s'exécute d'un clic. Les zones d'information sont calmes : `.panel` (filet clair, sans ombre), `.panel.calm`, `.panel.note` (notes privées, fond crème), `.panel.pop` (menus flottants, dialogues).
- **Textes** : 3 niveaux seulement — titre de page (police Londrina, `h1.title`, mots courts), titre de zone (`.panel-title`, Nunito 900), texte courant. Londrina jamais pour une phrase.
- **Couleurs, chacune un rôle** : pastels des niveaux = identité d'une classe (pastilles, bandeau de la classe) ; jaune = action principale et sélection ; vert / jaune-orangé / rouge = états, via les étiquettes `.tag.ok`, `.tag.warn`, `.tag.bad` (fond pâle, texte foncé).
- **Boutons** : principal (`.btn.primary`, un seul par zone), secondaire (`.btn`), discret (`.btn.ghost`).
- **Icônes** : `<Icon name="…" />` (src/components/Icon.tsx, icônes au trait) ; pas d'emoji dans l'interface.
- **Confirmation** : après une action, message en bas de l'écran avec `toast(texte, { undo })` (src/components/Toast.tsx), avec « Annuler » quand c'est possible.
- **Espacements** : multiples de 8 px (8, 16, 24).
- **Téléphone d'abord pour l'espace élève** : boutons de réponse en bas (rouge à gauche, vert à droite), menu en bas de l'écran.
