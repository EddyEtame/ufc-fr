# Le déploiement, et pourquoi ce `vercel.json` est écrit comme ça

Ce fichier existe parce que JSON n'accepte pas de commentaires — et parce que
**Vercel refuse tout fichier de configuration contenant une propriété qu'il ne
connaît pas.** Les explications avaient d'abord été mises dans des clés
`_note_trailingSlash` et `_note_build`, ce qui paraissait inoffensif. Ça ne
l'était pas : l'import échouait avec

```
Invalid request: should NOT have additional property `_note_trailingSlash`.
```

et plus aucun déploiement ne partait. Le site est resté seize heures sur une
version périmée sans que la cause soit visible ailleurs que dans cette
fenêtre d'import. **Rien d'autre que le schéma de Vercel ne doit entrer dans
`vercel.json`.**

## `trailingSlash: true`

Ce n'est pas un détail de confort. Toutes les URL déjà indexées par Google sur
l'ancien WordPress se terminent par une barre oblique : `/cage-fight-toulouse-club-mma/`.
Passer à `false` ferait répondre `308` à chacune d'elles — ce qui annulerait la
raison même d'avoir conservé les slugs d'origine lors de la migration.

Si un jour la production répond `308` sur une URL en `/…/`, c'est que ce
réglage a sauté ou qu'un vieux build est encore en ligne.

## Aucune construction côté Vercel

`buildCommand` et `installCommand` ne font rien volontairement. Le site est
généré ici, par `npm run build`, et le résultat est commité. Faire construire
Vercel ajouterait un point de rupture entre le push et la mise en ligne, à
deux jours de l'événement, pour un gain nul : il n'y a aucune dépendance à
installer.

La conséquence : **il faut lancer `npm run build` avant de commiter**, sinon
c'est l'ancien HTML qui part en ligne.

## En-têtes de cache

Les médias sont immuables (un an) parce que leur nom contient leur chemin
d'origine et ne change jamais sans que le contenu change. Le CSS et le JS sont
revalidés toutes les heures : ce sont eux qui bougent.

## `redirects` — les sept adresses mortes

Le prototype écrit à la main posait ses pages en fichiers `.html` à la racine :
`resultats.html`, `analyses.html`, `combattants.html`… La navigation, elle, a
toujours pointé vers `/resultats/`, `/analyses/`, `/combattants/`. Or **ni le
serveur local ni Vercel ne convertissent `/resultats/` en `resultats.html`** —
vérifié sur l'adresse publiée, pas supposé :

```
/resultats/          404
/ufc-paris-2026/     404
/combattants/        404
/organisations/      404
/evenements/         404
/analyses/           404
/interviews/         404
```

Sept adresses, cent vingt-six pages chacune : **882 liens morts**, dont
« Résultats » dans la barre principale et le bouton rouge « Paris 2026 »,
présent sur chaque page du site.

La navigation pointe désormais vers les pages qui existent — les rubriques
générées, sous `/categorie/…/` — et `/organisations/` est devenue une vraie
page (`tools/organisations.mjs`). Les redirections ci-dessous rattrapent les
anciennes adresses si quelqu'un les a notées quelque part.

`npm run check` refuse maintenant tout lien de page dont le document n'existe
pas. L'ancienne règle ne regardait que les fichiers portant une extension —
images, feuilles, scripts — et n'a donc jamais vu la navigation.
