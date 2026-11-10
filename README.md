# FoxBox

**Site en ligne : https://foxbox.physifox.fr/** — présentation complète des fonctionnalités dans l'application, page « À propos ».

FoxBox est la boîte à outils d'un professeur de physique-chimie : progression (séquences et séances), flashcards
révisées chaque jour par les élèves (boîtes de Leitner), évaluations par compétences, plans de classe, trombinoscope,
suivi des élèves, soutien scolaire et espace élève / parents.

- **Essayer en local** : double-cliquer sur `Lancer FoxBox.command` (ouvre http://localhost:5173, données de démonstration dans le navigateur).
- **Code** : `src/pages/prof` (professeur), `src/pages/eleve` (élève et parents), `src/components`, `src/lib` (calculs, base locale et synchronisation).
- **Base en ligne (Supabase)** : tables et règles d'accès dans `supabase/migrations/`, fonctions serveur dans `supabase/functions/`.
- **Vérifications** : `npm test` contrôle les calculs sensibles (notes, compétences, boîtes de flashcards, facturation du soutien) ; `npm run build` contrôle le code.
- **Publication** : chaque `git push` sur `main` lance les vérifications puis met le site en ligne (GitHub Pages, `.github/workflows/deploy.yml`). Une vérification en échec bloque la publication.
- **Consignes du projet** (charte graphique, vocabulaire, règles pour les nouvelles tables) : `CLAUDE.md`.
