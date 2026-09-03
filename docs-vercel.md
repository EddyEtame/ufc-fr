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
