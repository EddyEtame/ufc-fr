/**
 * L'index des organisations.
 *
 * « Organisations » figure dans le tiroir de navigation de chacune des cent
 * soixante-trois pages, et /organisations/ n'existait pas : le lien renvoyait
 * un 404 en production. Le site portait sept fiches d'organisation et aucun
 * endroit pour les trouver.
 *
 * La page reprend l'ouverture des fiches elles-memes : pas de photographie —
 * on n'a pas de cliche propre a chaque organisation, et un visuel d'evenement
 * repris ne serait pas une illustration mais un emprunt. Le sigle est ce que
 * le lecteur reconnait ; a cote, ce que le site sait reellement : le pays,
 * l'annee de fondation, et le nombre d'articles publies sur elle.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { posts, categories, ROOT, SITE, esc, decode } from "./build.mjs";
import { head, header, footer, ORGS } from "./render.mjs";
import { ORG_FICHE, ORG_CATEGORY } from "./orgs-data.mjs";

const catById = new Map(categories.map((c) => [c.id, c]));
const pageBySlug = new Map();
for (const [href] of ORGS) pageBySlug.set(href.replace(/^\/|\/$/g, ""), href);

/** Le nombre d'articles d'une organisation, compte sur sa rubrique. */
function articles(slug) {
  const cat = ORG_CATEGORY[slug];
  if (!cat) return 0;
  return posts.filter((p) => (p.categories || []).some((id) => catById.get(id)?.slug === cat)).length;
}

const fiches = ORGS.map(([href, nom]) => {
  const slug = href.replace(/^\/|\/$/g, "");
  const f = ORG_FICHE[slug] || {};
  // `f.nom` (le nom complet) prime sur celui de la navigation.
  return { href, slug, ...f, nom: f.nom || nom, n: articles(slug) };
}).sort((a, b) => b.n - a.n || a.nom.localeCompare(b.nom, "fr"));

const total = fiches.reduce((n, f) => n + f.n, 0);
const url = "/organisations/";
const titre = "Les organisations de MMA";
const description =
  "UFC, PFL, ONE Championship, KSW, Cage Warriors, ARES, Hexagone MMA : qui organise quoi, depuis quand, et ce que nous en publions.";

const schema = [
  {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: titre,
    description,
    url: SITE + url,
    inLanguage: "fr-FR",
    hasPart: fiches.map((f) => ({
      "@type": "SportsOrganization",
      name: f.nom,
      url: SITE + f.href,
      ...(f.pays ? { location: { "@type": "Place", name: f.pays } } : {}),
      ...(f.depuis ? { foundingDate: f.depuis } : {}),
    })),
  },
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: SITE + "/" },
      { "@type": "ListItem", position: 2, name: "Organisations", item: SITE + url },
    ],
  },
];

const html = `${head({
  title: "Organisations de MMA : UFC, PFL, ONE, KSW, ARES | UFC.FR",
  description,
  canonical: url,
  type: "website",
  schema,
})}
${header(url, "")}
  <main id="contenu">
  <article class="article face-page">
    <div class="wrap-read">
      <p class="crumbs"><a href="/">Accueil</a><span class="crumb-sep"> · </span><span class="crumb-actuel">Organisations</span></p>
      <header class="ah" data-reveal>
        <span class="kicker">Qui organise</span>
        <h1>${esc(titre)}</h1>
        <p class="byline">${fiches.length} organisations suivies · ${total} articles publiés</p>
      </header>
    </div>
    <div class="wrap">
      <div class="orgs-grille">
${fiches
  .map(
    (f) => `        <a class="org-carte" href="${f.href}" data-reveal style="--sigle-lettres: ${Math.max(
      ...String(f.sigle || f.nom).split(/\s+/).map((m) => m.length)
    )}">
          <span class="org-carte-sigle">${esc(f.sigle || f.nom)}</span>
          <span class="org-carte-nom">${esc(f.nom)}</span>
          <dl class="org-carte-reperes">
            <div><dt>Pays</dt><dd>${esc(f.pays || "—")}</dd></div>
            <div><dt>Depuis</dt><dd>${esc(f.depuis || "—")}</dd></div>
            <div><dt>Chez nous</dt><dd>${f.n} article${f.n > 1 ? "s" : ""}</dd></div>
          </dl>
        </a>`
  )
  .join("\n")}
      </div>
    </div>
    <div class="wrap-read">
      <div class="prose" data-reveal>
        <p>Une organisation, ici, c’est celle qui monte les galas&nbsp;: elle signe les
        combattants, fixe les cartes, décerne les ceintures. Les sept que nous suivons
        n’ont ni la même taille ni le même terrain — l’UFC organise partout, Hexagone MMA
        et ARES construisent en France, KSW domine la Pologne, ONE Championship l’Asie.</p>
        <p>Chaque fiche dit ce que nous savons&nbsp;: le pays, l’année de fondation, ce qui
        distingue l’organisation, ses grands noms, et les articles que nous lui avons
        consacrés. Aucun classement maison&nbsp;: nous n’avons pas de quoi hiérarchiser sept
        organisations qui ne jouent pas dans la même catégorie.</p>
      </div>
    </div>
  </article>
  </main>
${footer()}`;

mkdirSync(join(ROOT, "organisations"), { recursive: true });
writeFileSync(join(ROOT, "organisations", "index.html"), html, "utf8");
console.log(`[organisations] ${fiches.length} fiches, ${total} articles`);
