/**
 * Émission des pages. Un document extrait → un dossier /slug/index.html.
 *
 * Le choix du dossier plutôt que slug.html n'est pas cosmétique : c'est ce qui
 * reproduit exactement l'URL déjà indexée par Google sur le WordPress. Le jour
 * de la bascule, aucune redirection n'est nécessaire et aucune position n'est
 * perdue.
 */
import { writeFileSync, mkdirSync, copyFileSync, existsSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import {
  posts, pages, categories, ROOT, SITE, mediaManifest,
  cleanContent, esc, decode, stripTags, dateFr, metaDesc, localMedia,
} from "./build.mjs";
import { head, header, footer, ORGS } from "./render.mjs";

const written = [];

function emit(slugPath, html) {
  const dir = join(ROOT, slugPath);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "index.html"), html, "utf8");
  written.push("/" + slugPath.replace(/\\/g, "/") + "/");
}

/* ----------------------------------------------------------------- médias --
 * On recopie les binaires en conservant l'arborescence /YYYY/MM/ de WordPress.
 * Garder cette structure évite les collisions de noms entre deux années et
 * correspond aux chemins déjà présents dans le corps des articles.
 */
function copyMedia() {
  let n = 0;
  for (const m of mediaManifest) {
    const src = join(ROOT, m.local);
    if (!existsSync(src)) continue;
    const rel = new URL(m.source_url).pathname.replace(/^\/wp-content\/uploads\//, "");
    const dest = join(ROOT, "media", rel);
    mkdirSync(dirname(dest), { recursive: true });
    if (!existsSync(dest)) copyFileSync(src, dest);
    n++;
  }
  return n;
}

/* ---------------------------------------------------------------- schémas --
 * Ce que les robots — Google et les moteurs de réponse — peuvent citer. Le
 * WordPress émettait déjà Organization + WebSite + BreadcrumbList ; on ne
 * descend pas en dessous, et on ajoute NewsArticle, absent de l'ancien site.
 */
const publisher = {
  "@type": "NewsMediaOrganization",
  name: "UFC.FR",
  url: SITE + "/",
  logo: { "@type": "ImageObject", url: SITE + "/logo/ufc.fr.jpeg" },
  description:
    "Média indépendant d’actualité MMA en France et à l’international. Non affilié à l’Ultimate Fighting Championship.",
};

function breadcrumb(trail) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map(([name, url], i) => ({
      "@type": "ListItem",
      position: i + 1,
      name,
      item: SITE + url,
    })),
  };
}

function newsArticle(doc, url, image) {
  return {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: decode(doc.title.rendered).slice(0, 110),
    description: metaDesc(doc),
    datePublished: doc.date_gmt + "Z",
    dateModified: doc.modified_gmt + "Z",
    author: { "@type": "Organization", name: "Rédaction UFC.FR", url: SITE + "/a-propos/" },
    publisher,
    mainEntityOfPage: { "@type": "WebPage", "@id": SITE + url },
    ...(image ? { image: [SITE + image] } : {}),
    inLanguage: "fr-FR",
    isAccessibleForFree: true,
  };
}

/* ------------------------------------------------------------------ rendu */

const catById = new Map(categories.map((c) => [c.id, c]));

/** Quelle rubrique alimente la grille de chaque page organisation. */
const ORG_CATEGORY = {
  "organisation-mma-ultimate-fighting-championship": "ufc",
  "organisation-mma-professional-fighters-league": "pfl",
  "organisation-mma-one-championship": "one-championship",
  "organisation-mma-cage-warriors": "cage-warriors",
  "organisation-mma-ares-fighting-championship": "ares",
  "organisation-hexagone-mma": "hexagone-mma",
  "organisation-mma-ksw": "ksw",
};

function featuredImage(doc) {
  const fm = doc._embedded?.["wp:featuredmedia"]?.[0];
  if (!fm?.source_url) return null;
  const local = localMedia(fm.source_url);
  return {
    url: local ? local.url : fm.source_url,
    alt: fm.alt_text || stripTags(fm.title?.rendered || ""),
    width: fm.media_details?.width,
    height: fm.media_details?.height,
  };
}

/** Trois articles proches, choisis par catégorie partagée puis par fraîcheur. */
function related(doc, pool, n = 3) {
  const mine = new Set(doc.categories || []);
  return pool
    .filter((p) => p.id !== doc.id)
    .map((p) => ({ p, score: (p.categories || []).filter((c) => mine.has(c)).length }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || new Date(b.p.date) - new Date(a.p.date))
    .slice(0, n)
    .map((x) => x.p);
}

function renderDocument(doc, { isPage }) {
  const url = `/${doc.slug}/`;
  const title = decode(doc.title.rendered);
  const seoTitle = decode(doc.yoast_head_json?.title || `${title} | UFC.FR`);
  const img = featuredImage(doc);
  const cats = (doc.categories || []).map((id) => catById.get(id)).filter(Boolean);
  const kicker = cats[0]?.name || (isPage ? "Rubrique" : "Actualité");

  const trail = [["Accueil", "/"]];
  if (cats[0]) trail.push([cats[0].name, `/categorie/${cats[0].slug}/`]);
  trail.push([title, url]);

  const schema = [breadcrumb(trail)];
  if (!isPage) schema.push(newsArticle(doc, url, img?.url));
  else
    schema.push({
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: title,
      description: metaDesc(doc),
      url: SITE + url,
      dateModified: doc.modified_gmt + "Z",
      publisher,
      inLanguage: "fr-FR",
    });

  const sibs = related(doc, posts);

  // Le corps de l'article est du HTML issu du CMS : il a été nettoyé de toute
  // trace WordPress en amont, jamais réécrit sur le fond. On ne touche pas au
  // texte d'un rédacteur.
  let body = cleanContent(doc.content.rendered);

  // Les pages organisation portaient une grille de portraits alimentee par le
  // CMS. On la regenere a partir du corpus : meme fonction, mais en liens
  // reels, donc indexables et sans JavaScript.
  const orgCat = ORG_CATEGORY[doc.slug];
  if (orgCat) {
    const roster = posts
      .filter((p) => (p.categories || []).some((id) => catById.get(id)?.slug === orgCat))
      .filter((p) => p.slug.startsWith("portrait-"))
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    if (roster.length) {
      body += `\n<h2>Les combattants de cette organisation</h2>\n<div class="roster">\n${roster
        .map((p) => {
          const t = featuredImage(p);
          return `  <a href="/${p.slug}/">${
            t ? `<img src="${t.url}" alt="${esc(t.alt)}" loading="lazy" decoding="async" />` : ""
          }<span>${esc(decode(p.title.rendered).replace(/^Portrait\s*[:\u2013-]\s*/i, ""))}</span></a>`;
        })
        .join("\n")}\n</div>`;
    }
  }

  return `${head({
    title: seoTitle,
    description: metaDesc(doc),
    canonical: url,
    image: img?.url,
    type: isPage ? "website" : "article",
    schema,
  })}
${header()}
  <main id="contenu">
  <article class="article">
    <div class="wrap-read">
      <p class="crumbs">${trail
        .map(([n, u], i) => (i === trail.length - 1 ? esc(n) : `<a href="${u}">${esc(n)}</a>`))
        .join(" · ")}</p>
      <header class="ah">
        <span class="kicker">${esc(kicker)}</span>
        <h1>${esc(title)}</h1>
        <p class="byline">Rédaction UFC.FR · Publié le <time datetime="${doc.date.slice(0, 10)}">${dateFr(doc.date)}</time>${
          doc.modified.slice(0, 10) !== doc.date.slice(0, 10)
            ? ` · Mis à jour le <time datetime="${doc.modified.slice(0, 10)}">${dateFr(doc.modified)}</time>`
            : ""
        }</p>
      </header>
      ${
        img
          ? `<figure class="figure lead"><img src="${img.url}" alt="${esc(img.alt)}"${
              img.width && img.height ? ` width="${img.width}" height="${img.height}"` : ""
            } decoding="async" /></figure>`
          : ""
      }
      <div class="prose">
${body}
      </div>
${
  sibs.length
    ? `      <aside class="related">
        <h2>À lire ensuite</h2>
        <ul class="related-list">
${sibs.map((s) => `          <li><a href="/${s.slug}/">${esc(decode(s.title.rendered))}</a></li>`).join("\n")}
        </ul>
      </aside>`
    : ""
}
    </div>
  </article>
  </main>
${footer()}`;
}

/* ------------------------------------------------------------- exécution  */

console.log("[médias] copie…");
console.log(`  ${copyMedia()} fichiers en place sous /media/`);

console.log("[articles]");
for (const p of posts) emit(p.slug, renderDocument(p, { isPage: false }));
console.log(`  ${posts.length} articles rendus`);

console.log("[pages]");
const skip = new Set(["ufc-fr-mma"]); // l'accueil Elementor : remplacé par notre propre accueil
for (const p of pages) {
  if (skip.has(p.slug)) continue;
  emit(p.slug, renderDocument(p, { isPage: true }));
}
console.log(`  ${pages.length - skip.size} pages rendues`);

/* Sitemap : uniquement la surface publique réellement rendue. */
const urls = written.map(
  (u) => `  <url><loc>${SITE}${u}</loc></url>`
).join("\n");
writeFileSync(
  join(ROOT, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${SITE}/</loc><priority>1.0</priority></url>\n${urls}\n</urlset>\n`,
  "utf8"
);
console.log(`[sitemap] ${written.length + 1} URL`);
console.log("\nTerminé.");
