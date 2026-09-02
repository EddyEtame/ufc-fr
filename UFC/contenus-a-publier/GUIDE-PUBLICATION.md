# Publication sur ufc.fr — guide COM

Les textes HTML de ce dossier sont prêts à coller dans WordPress (éditeur texte / bloc HTML personnalisé). **Les laisser en brouillon** tant qu’une relecture humaine n’a pas validé noms, records et horaires.

## Connexion bloquée de mon côté

- L’identifiant fourni (e-mail admin) a été **refusé** par wp-login (`The username or password you entered is incorrect`).
- **Wordfence** protège la connexion (reCAPTCHA / 2FA possible).
- L’API REST n’accepte pas le mot de passe du compte (il faut un **mot de passe d’application**).
- XML-RPC authentifié ne répond pas (protection brute-force probable).

### Pour que je publie directement

1. Connectez-vous sur https://www.ufc.fr/wp-admin/ (dans le navigateur, avec le bon identifiant WordPress — ce n’est pas forcément l’e-mail).
2. Aller dans **Utilisateurs → Profil**.
3. Section **Mots de passe d’application** : nommer `Cursor-UFC` → Créer.
4. Coller ici le mot de passe du type `xxxx xxxx xxxx xxxx xxxx xxxx` **et** le vrai identifiant WordPress (login, pas l’e-mail s’ils diffèrent).

Ne renvoyez pas le mot de passe du compte dans le chat. Un mot de passe d’application suffit, et se révoque en un clic.

## Fichiers à publier (ordre)

| Fichier | Type | Slug | Priorité |
|---|---|---|---|
| 01-ufc-paris-2026-presentation.html | Article | `ufc-paris-2026-date-lieu-carte-enjeux` | Critique |
| 02-ufc-paris-2026-carte.html | Article | `ufc-paris-2026-carte-complete-hooker-parnasse` | Critique |
| 03-ufc-paris-combattants-francais.html | Article | `ufc-paris-2026-combattants-francais` | Critique |
| 04-cage-fight-toulouse.html | Article | `cage-fight-toulouse-club-mma` | Haute |
| 05-page-champions-actuels.html | Page | `champions-mma-actuels` | Haute |
| 06-page-clubs-mma-francais.html | Page | `clubs-mma-francais` | Haute |

Les metas Yoast (title + description) sont en commentaire HTML en tête de chaque fichier.

## Catégories à créer

1. `UFC Paris 2026` (slug `ufc-paris-2026`)
2. `Clubs de MMA français` (slug `clubs-mma-francais`)
3. `Résultats` (slug `resultats`)
4. `Événements` (slug `evenements`)
5. `Analyses` (slug `analyses`)
6. `Combattants` (slug `combattants`) — y ranger aussi les portraits existants progressivement

Garder les catégories organisations (UFC, PFL, ONE, etc.).

## Menu recommandé

- Actualités
- UFC Paris 2026
- Résultats
- Champions actuels
- Clubs de MMA français
- Organisations (sous-menu existant)
- Combattants / portraits

## Pied de page (obligatoire cahier des charges)

Ajouter une phrase du type :

> UFC.FR est un média indépendant d’actualité MMA. Il n’est pas affilié à l’Ultimate Fighting Championship.

## Accueil Elementor (à faire à la main)

Le home est une page Elementor (`ufc-fr-mma`). Remplacer les blocs figés :

- hero / premier article → dossier UFC Paris 2026
- « Actualités à venir » → carte Hooker vs Parnasse (plus UFC 316 / PFL Nashville 2025)
- « Portrait du moment » → Parnasse ou Sola, plus Yagshimuradov

## Après le 5 septembre

1. Article résultats combat par combat (catégorie Résultats + UFC Paris 2026)
2. Bilan des Français
3. Analyse Hooker vs Parnasse
4. MAJ page champions si une ceinture KSW bouge

## Forum (phase 2)

bbPress ou wpForo, après l’événement. Inscriptions, règles, modération, anti-spam. Pas avant la couverture Paris 2026.
