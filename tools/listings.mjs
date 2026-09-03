/**
 * Pages de liste : fil d'actualité, portraits, rubriques par catégorie.
 *
 * Ces pages existaient sur le WordPress sous forme de widgets dynamiques
 * (grilles Royal Addons) qui interrogeaient la base à chaque affichage. Elles
 * ne s'aspirent pas : un widget extrait ne ramène que sa pagination cassée.
 * On les reconstruit donc à partir du corpus lui-même — ce qui, au passage,
 * les rend indexables, alors que la version WordPress ne l'était qu'à moitié.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { posts, categories, ROOT, SITE, esc, decode, stripTags, dateFr, metaDesc, localMedia, resume, imageMaison } from "./build.mjs";
import { head, header, footer } from "./render.mjs";

const byDate = [...posts].sort((a, b) => new Date(b.date) - new Date(a.date));
const catById = new Map(categories.map((c) => [c.id, c]));

/**
 * La vignette d'une carte.
 *
 * `vues` porte les images deja placees dans la liste en cours : plusieurs
 * articles partagent la meme photo d'illustration generique (la facade de
 * Bercy, l'octogone des Marines), et deux cartes voisines avec la meme image
 * font passer la page pour cassee. La deuxieme occurrence devient une carte
 * de texte, ce qui cree en prime du rythme dans la grille.
 */
function thumb(p, vues) {
  const maison = imageMaison(p.slug);
  if (maison) {
    // Le dedoublonnage est universel dans une liste. Un portrait est unique
    // par personne, pas par article : cinq articles sur Parnasse affichaient
    // cinq fois la meme photo. Le premier la garde, les suivants deviennent
    // des cartes de texte — ce qui cree du rythme au lieu d'une repetition.
    if (vues) {
      if (vues.has(maison.url)) return null;
      vues.add(maison.url);
    }
    return { url: maison.url, alt: decode(p.title.rendered) };
  }
  const fm = p._embedded?.["wp:featuredmedia"]?.[0];
  if (!fm?.source_url) return null;
  if (vues) {
    if (vues.has(fm.source_url)) return null;
    vues.add(fm.source_url);
  }
  const l = localMedia(fm.source_url);
  return {
    url: l ? l.url : fm.source_url,
    alt: fm.alt_text || stripTags(fm.title?.rendered || ""),
    w: fm.media_details?.width,
    h: fm.media_details?.height,
  };
}

/** Une carte d'article, dans le système de composants existant du site. */
function card(p, vues) {
  const t = thumb(p, vues);
  const cat = (p.categories || []).map((id) => catById.get(id)).filter(Boolean)[0];
  return `        <a class="card" href="/${p.slug}/" data-reveal>
          ${
            t
              ? `<div class="media" data-reveal-media><img src="${t.url}" alt="${esc(t.alt)}"${
                  t.w && t.h ? ` width="${t.w}" height="${t.h}"` : ""
                } loading="lazy" decoding="async" /></div>`
              : ""
          }
          <div class="card-body">
            <span class="kicker">${esc(cat?.name || "Actualité")}</span>
            <h3>${esc(decode(p.title.rendered))}</h3>
            <p>${esc(resume(p, 130))}</p>
            <time datetime="${p.date.slice(0, 10)}">${dateFr(p.date)}</time>
          </div>
        </a>`;
}

/** Le rail de filtres : la fonction du WordPress, rendue en liens réels —
 *  donc crawlable, partageable et sans JavaScript. */
function filters(activeSlug) {
  const live = categories.filter((c) => c.count > 0).sort((a, b) => b.count - a.count);
  return `      <nav class="filters" aria-label="Filtrer par rubrique">
        <a href="/actualite-du-mma/"${!activeSlug ? ' class="on" aria-current="page"' : ""}>Tout <b>${posts.length}</b></a>
${live
  .map(
    (c) =>
      `        <a href="/categorie/${c.slug}/"${
        c.slug === activeSlug ? ' class="on" aria-current="page"' : ""
      }>${esc(c.name)} <b>${c.count}</b></a>`
  )
  .join("\n")}
      </nav>`;
}

function listPage({ slug, title, seoTitle, description, kicker, lede, items, activeSlug }) {
  const url = `/${slug}/`;
  const schema = [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: title,
      description,
      url: SITE + url,
      inLanguage: "fr-FR",
      isPartOf: { "@type": "WebSite", name: "UFC.FR", url: SITE + "/" },
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: items.length,
        itemListElement: items.slice(0, 30).map((p, i) => ({
          "@type": "ListItem",
          position: i + 1,
          url: `${SITE}/${p.slug}/`,
          name: decode(p.title.rendered),
        })),
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Accueil", item: SITE + "/" },
        { "@type": "ListItem", position: 2, name: title, item: SITE + url },
      ],
    },
  ];
  const html = `${head({ title: seoTitle, description, canonical: url, type: "website", schema })}
${header()}
  <main id="contenu">
    <section class="block">
      <div class="wrap">
        <header class="head" data-reveal>
          <span class="kicker">${esc(kicker)}</span>
          <h1>${esc(title)}</h1>
          <p class="lede">${esc(lede)}</p>
        </header>
${filters(activeSlug)}
        <div class="cards grid-3">
${(() => { const vues = new Set(); return items.map((p) => card(p, vues)).join("\n"); })()}
        </div>
      </div>
    </section>
  </main>
${footer()}`;
  const dir = join(ROOT, slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "index.html"), html, "utf8");
  return url;
}

const emitted = [];

// Le fil complet.
emitted.push(
  listPage({
    slug: "actualite-du-mma",
    title: "L’actualité du MMA",
    seoTitle: "Actualité MMA : résultats, galas, combattants | UFC.FR",
    description:
      "Tout le fil UFC.FR : résultats d’événements, galas français, portraits de combattants, analyses et calendrier. Média MMA indépendant.",
    kicker: "Le fil",
    lede: `${posts.length} articles, du dernier gala français à la carte de Bercy.`,
    items: byDate,
  })
);

// Les portraits : le corpus le plus dense du site, 60+ fiches combattants.
const portraits = byDate.filter((p) => p.slug.startsWith("portrait-"));
emitted.push(
  listPage({
    slug: "mma-portraits-de-champions",
    title: "Portraits de champions",
    seoTitle: "Portraits de champions MMA : UFC, PFL, ONE, KSW, ARES | UFC.FR",
    description: `${portraits.length} portraits de combattants et de championnes et champions, toutes organisations confondues. Parcours, records, style de combat.`,
    kicker: "Les combattants",
    lede: `${portraits.length} fiches, de l’UFC au KSW, sans classement maison.`,
    items: portraits,
  })
);

// Une page par rubrique : c'est le filtre du WordPress transformé en URL
// propre, donc en surface indexable.
for (const c of categories.filter((x) => x.count > 0)) {
  const items = byDate.filter((p) => (p.categories || []).includes(c.id));
  if (!items.length) continue;
  emitted.push(
    listPage({
      slug: `categorie/${c.slug}`,
      title: c.name,
      seoTitle: `${c.name} — actualité MMA | UFC.FR`,
      description:
        stripTags(c.description) ||
        `Tous les articles UFC.FR classés dans ${c.name} : ${items.length} publications.`,
      kicker: "Rubrique",
      lede: `${items.length} article${items.length > 1 ? "s" : ""} dans cette rubrique.`,
      items,
      activeSlug: c.slug,
    })
  );
}

console.log(`[listes] ${emitted.length} pages de liste rendues`);
console.log(emitted.map((u) => "  " + u).join("\n"));
