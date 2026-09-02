# REGLES — UFC.FR

Lu au début de chaque session. Plafond dur : 25 règles. La barre est le plafond,
ce fichier est le plancher.

## Le plancher : le WordPress en ligne

1. **www.ufc.fr en ligne est le plancher, pas la maquette.** Toute page, rubrique ou
   fonction présente sur le WordPress doit exister dans le site recodé avant bascule.
   Vérifier avant de dire « prêt ».
2. Les 7 pages organisation (UFC, PFL, ONE, Cage Warriors, ARES, Hexagone, KSW) sont
   7 pages, pas une. Les fusionner en une seule est une régression SEO et éditoriale.
3. `mentions-legales-confidentialites` existe en ligne. Elle ne disparaît pas.
4. Rubriques en ligne à conserver : Calendrier MMA France, Classements UFC,
   Portraits de champions, Communauté.
5. Le filtrage par catégorie de l'accueil est une fonction, pas une décoration.

## Éditorial — non négociable (cahier des charges §2, §14, §16.3)

6. Jamais « site officiel de l'UFC ». Média indépendant, disclaimer visible.
7. Aucun résultat, vainqueur ou méthode avant le gong. La page résultats reste un
   gabarit déclaré vide jusqu'à la fin des combats.
8. Rien d'inventé : nom, record, date, horaire, citation, palmarès. Sourcer ou omettre.
9. Neuf Français sur la carte de Paris 2026, pas huit. Corriger partout, XML d'import
   compris.
10. Le lien vers club-mma-toulouse.com est contractuel (CDC §10) et doit rester une
    recommandation éditoriale, jamais un lien posé.

## Technique

11. Une page = un `<h1>`. L'accueil aussi.
12. Toute page publique porte : title < 60 car., meta description unique, canonical,
    Open Graph, favicon, et le schema qui correspond à son type.
13. Les articles portent `NewsArticle` + `BreadcrumbList` + dates lisibles machine.
14. Aucune image sans `loading="lazy"` ni dimensions intrinsèques. WebP quand il existe.
15. Le contenu ne dépend jamais du JS pour être visible. Pas de `js-motion` en dur
    dans le HTML.
16. Pages de travail (audit, redaction, seo-suivi, calendrier-editorial) : `noindex`,
    hors sitemap.
17. Aucun secret dans le dépôt. Les scripts lisent l'environnement, jamais un chemin
    Windows en dur.
18. Photos : licence connue et citée dans credits.html, ou la photo ne sort pas.

## Méthode

19. Statique = pauvre. Une page sans mouvement au scroll n'est pas finie.
20. Mobile porte le même récit que le bureau. Un seul point de rupture n'est pas du
    responsive.
21. Ouvrir la page pour de vrai avant de dire qu'elle marche. Console à zéro.
22. Corriger la classe, pas l'endroit : un défaut trouvé = balayage de tous ses frères.
23. Avant de retirer quoi que ce soit : dire pourquoi, et proposer avant d'agir.
24. La cadence de publication est un livrable (CDC §15). Une solution qui empêche
    l'équipe COM de publier a échoué, même si elle est plus belle.
25. Jamais « fini », jamais « 100 % ». Pourcentage honnête + les écarts.
