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
  cleanContent, esc, decode, stripTags, dateFr, metaDesc, localMedia, imageMaison,
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

/**
 * Le visage d'un document.
 *
 * Un media se reconnait a ce que ses formats ont des visages differents. Un
 * portrait de combattant, un resultat de gala et un reportage de salle ne se
 * lisent pas de la meme facon : le portrait est une personne, le resultat est
 * une chronologie, le reportage est un lieu. Servir les trois dans le meme
 * gabarit, c'est le defaut qui fait dire « site genere ».
 *
 * La detection s'appuie sur le slug puis sur la rubrique — dans cet ordre,
 * parce qu'un portrait range par erreur dans « actualite » reste un portrait.
 */
function faceOf(doc, cats) {
  const slug = doc.slug;
  const slugs = cats.map((c) => c.slug);
  if (slug.startsWith("portrait-")) return "portrait";
  if (slugs.includes("clubs-mma-francais") || /club|gym|academy|team-/.test(slug)) return "lieu";
  if (slugs.includes("resultats") || /resultat|-\d{3}-|vs-/.test(slug)) return "resultat";
  if (/citations/.test(slug)) return "citations";
  return "recit";
}

/** L'organisation d'un portrait, tiree de son slug : portrait-ufc-x → UFC. */
const ORG_LABEL = {
  ufc: "UFC", pfl: "PFL", ksw: "KSW", ares: "ARES",
  one: "ONE Championship", "one-championship": "ONE Championship",
  "cage-warriors": "Cage Warriors", "cage-wrarriors": "Cage Warriors",
  "hexagone-mma": "Hexagone MMA",
};
function orgOf(slug) {
  const m = slug.match(/^portrait-(one-championship|cage-wrarriors|cage-warriors|hexagone-mma|ufc|pfl|ksw|ares|one)-/);
  return m ? ORG_LABEL[m[1]] : null;
}

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
  // Une photo maison, quand le sujet en a une, passe avant l'image du CMS.
  const maison = imageMaison(doc.slug);
  if (maison) return { url: maison.url, alt: decode(doc.title.rendered) };
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
  const face = isPage ? "page" : faceOf(doc, cats);
  const org = face === "portrait" ? orgOf(doc.slug) : null;
  const kicker = org || cats[0]?.name || (isPage ? "Rubrique" : "Actualité");

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
  let rosterBloc = "";

  // Le corps importe s'ouvre sur une <figure> qui porte l'image a la une —
  // celle que le gabarit affiche deja juste au-dessus. Chaque article montrait
  // donc deux fois la meme photo, l'une sous l'autre. On retire celle du
  // corps : le gabarit la presente mieux, en pleine largeur, et la legende
  // qu'elle portait est un credit, pas une information de lecture.
  if (img) {
    body = body.replace(/^\s*<figure[^>]*>[\s\S]*?<\/figure>/i, (bloc) =>
      bloc.includes(img.url) || /wp-content|\/media\//.test(bloc) ? "" : bloc
    ).trim();
  }

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
      // Rendu comme un bloc distinct, hors de `.prose`. Tant qu'il etait
      // concatene au corps, il heritait de la largeur de lecture (720 px) :
      // cinq portraits se serraient dans le tiers gauche d'un ecran large, et
      // aucune regle de debordement ne tenait contre le `max-width` du
      // conteneur. La structure regle ce que le CSS n'arrivait pas a forcer.
      rosterBloc = `\n<h2>Les combattants de cette organisation</h2>\n<div class="roster">\n${roster
        .map((p) => {
          const t = featuredImage(p);
          return `  <a href="/${p.slug}/">${
            t ? `<img src="${t.url}" alt="${esc(t.alt)}" loading="lazy" decoding="async" />` : ""
          }<div class="meta"><h3>${esc(decode(p.title.rendered).replace(/^Portrait\s*[:\u2013-]\s*/i, "").split(/[,\u2013]/)[0])}</h3></div></a>`;
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
  <article class="article face-${face}">
    <div class="wrap-read">
      <p class="crumbs">${trail
        .map(([n, u], i) => (i === trail.length - 1 ? esc(n) : `<a href="${u}">${esc(n)}</a>`))
        .join(" · ")}</p>
      <header class="ah" data-reveal>
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
          ? `<figure class="figure lead" data-reveal data-reveal-media><img src="${img.url}" alt="${esc(img.alt)}"${
              img.width && img.height ? ` width="${img.width}" height="${img.height}"` : ""
            } decoding="async" />${
              face === "portrait" && org ? `<figcaption class="lead-org">${esc(org)}</figcaption>` : ""
            }</figure>`
          : ""
      }
      <div class="prose" data-reveal>
${body}
      </div>
${rosterBloc ? `    </div>
    <div class="wrap roster-bloc" data-reveal>${rosterBloc}
    </div>
    <div class="wrap-read${sibs.length ? "" : " wrap-read-vide"}">` : ""}
${
  sibs.length
    ? `      <aside class="related" data-reveal>
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
