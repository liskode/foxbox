# FoxBox — consignes du projet

- **Page « À propos » à tenir à jour** : `src/pages/prof/About.tsx` présente toutes les fonctionnalités (titre, court paragraphe, détails séparés par « - »). À chaque ajout, modification ou suppression de fonctionnalité, mettre cette page à jour dans le même commit.
- L'utilisateur (professeur de physique-chimie) ne code pas : réponses en français, concises, sans jargon ; il teste et fait des retours.
- Vocabulaire de l'interface : « flashcard » (jamais « carte »), « séquence », « séance », « Évaluations ».
- Données privées (notes, aménagements, famille, absences, notes de classe) : tables propres au professeur, protégées par les règles d'accès du serveur ; ne jamais les rendre lisibles aux élèves ni à d'autres professeurs.
- Vérifier chaque modification dans la démo locale avant publication ; publier par `git push` (déploiement GitHub Pages).
