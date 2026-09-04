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
import { posts, categories, ROOT, SITE, esc, decode, stripTags, dateFr, metaDesc, localMedia, resume, imageMaison , vignette} from "./build.mjs";
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

/**
 * Une carte d'article.
 *
 * La premiere carte de la liste porte une image plus grande que les autres
 * (`min-height: 420px`) : c'est elle, le plus grand element de l'ecran, donc
 * c'est elle que Google mesure. Elle etait en `loading="lazy"` comme ses
 * voisines — c'est-a-dire qu'elle attendait la mise en page pour commencer a
 * se telecharger, derriere les polices et la feuille de style. Cinq secondes
 * sur un telephone en 4G la ou le reste de la page tient en deux.
 *
 * Elle se charge donc en priorite, et seulement elle : passer toutes les
 * cartes en `eager` ferait la course a douze images pour rien.
 */
function card(p, vues, tete = false, rang = 0) {
  const t = thumb(p, vues);
  /* Le devoilement s'arrete apres la premiere rangee.
   *
   * Le mouvement informe, il ne decore pas — et quatre-vingt-douze cartes
   * qui se devoilent une a une decorent. Mesure sur le fil, processeur
   * divise par quatre : 18 trames longues sur 116 avec le devoilement sur
   * toutes les cartes, 3 sans. Chaque carte qui entre cree puis detruit une
   * couche de composition, et un defilement rapide en fait entrer dix a la
   * fois.
   *
   * Les trois premieres le gardent : c'est la que le lecteur regarde quand
   * la page se pose, et c'est la que le geste dit quelque chose. */
  const anime = rang < 3;
  // « Actualite » passe en dernier : c'est la rubrique fourre-tout, et une
  // carte qui l'affiche n'apprend rien de plus que le titre.
  const cat = (p.categories || [])
    .map((id) => catById.get(id))
    .filter(Boolean)
    .sort((a, b) => (a.slug === "actualite") - (b.slug === "actualite"))[0];
  /* Une carte sans image n'est pas une carte ratee : c'est une breve. Elle
   * porte sa propre classe, et la feuille lui donne la hauteur des autres —
   * sans quoi une rangee entiere de cartes de texte laissait un trou de
   * 280 px dans la grille, ce qu'on lisait comme une page cassee et non
   * comme du rythme. */
  return `        <a class="card${t ? "" : " card-breve"}" href="/${p.slug}/"${anime ? " data-reveal" : ""}>
          ${
            t
              // Vignette et non original : la carte fait 430 px de large.
              ? `<div class="media"${anime ? " data-reveal-media" : ""}><img src="${vignette(t.url)}" alt="${esc(t.alt)}"${
                  t.w && t.h ? ` width="${t.w}" height="${t.h}"` : ""
                } ${tete ? 'fetchpriority="high" decoding="sync"' : 'loading="lazy" decoding="async"'} /></div>`
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

/**
 * Le nombre d'articles reellement publies dans une rubrique.
 *
 * Le champ `count` vient de l'API du CMS et ne connait que les articles du
 * CMS. Depuis que le corpus accueille des articles maison, il ment : le rail
 * annoncait « Clubs de MMA francais 14 » au-dessus d'une liste de seize. On
 * compte ce qu'on affiche.
 */
const compte = new Map();
for (const p of posts) for (const id of p.categories || []) compte.set(id, (compte.get(id) || 0) + 1);
const reel = (c) => compte.get(c.id) || 0;

/** Le rail de filtres : la fonction du WordPress, rendue en liens réels —
 *  donc crawlable, partageable et sans JavaScript. */
/**
 * Le rail de rubriques.
 *
 * « Tout » ne s'allume que sur le fil. Les portraits n'ont pas de rubrique —
 * ils traversent les sept organisations — et le rail les annoncait donc comme
 * « Tout », c'est-a-dire comme le fil complet : le seul repere de la page
 * designait une autre page.
 */
function filters(activeSlug) {
  const live = categories.filter((c) => reel(c) > 0).sort((a, b) => reel(b) - reel(a));
  return `      <nav class="filters" aria-label="Filtrer par rubrique">
        <a href="/actualite-du-mma/"${activeSlug === "tout" ? ' class="on" aria-current="page"' : ""}>Tout <b>${posts.length}</b></a>
${live
  .map(
    (c) =>
      `        <a href="/categorie/${c.slug}/"${
        c.slug === activeSlug ? ' class="on" aria-current="page"' : ""
      }>${esc(c.name)} <b>${reel(c)}</b></a>`
  )
  .join("\n")}
      </nav>`;
}

function listPage({ slug, title, seoTitle, description, kicker, lede, items, activeSlug, compte, unite }) {
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
    <section class="block block-liste">
      <div class="wrap">
        <header class="head tete-liste" data-reveal>
          <div>
            <span class="kicker">${esc(kicker)}</span>
            <h1>${esc(title)}</h1>
            <p class="lede">${esc(lede)}</p>
          </div>
${
  // Le nombre d'articles est une donnee, pas une phrase. « 27 articles dans
  // cette rubrique » occupait la ligne ou aurait du se lire ce que la
  // rubrique couvre ; le chiffre part a droite, ou la page etait vide.
  compte
    ? `          <p class="tete-compte"><b>${compte}</b><span>${esc(unite || (compte > 1 ? "articles" : "article"))}</span></p>`
    : ""
}
        </header>
${filters(activeSlug)}
        <div class="cards grid-3">
${(() => { const vues = new Set(); return items.map((p, i) => card(p, vues, i === 0, i)).join("\n"); })()}
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
    lede: "Tout ce que nous publions, du dernier gala français à la carte de Bercy.",
    items: byDate,
    compte: posts.length,
    activeSlug: "tout",
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
    lede: "De l’UFC au KSW. Parcours, records, style — et aucun classement maison.",
    items: portraits,
    compte: portraits.length,
    unite: "portraits",
  })
);

// Une page par rubrique : c'est le filtre du WordPress transformé en URL
// propre, donc en surface indexable.
for (const c of categories.filter((x) => reel(x) > 0)) {
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
      /* Chaque rubrique porte deja une description ecrite dans le CMS —
       * « Resultats MMA officiels uniquement. Pas de score invente : on
       * attend l'annonce UFC / orga. » Elle partait dans la balise meta,
       * invisible, pendant que la page affichait « 27 articles dans cette
       * rubrique ». Le lecteur voit maintenant ce que la rubrique couvre ;
       * le compte est a cote, en chiffre. */
      lede:
        stripTags(c.description) ||
        `Tout ce que UFC.FR publie sous ${c.name}.`,
      items,
      compte: items.length,
      activeSlug: c.slug,
    })
  );
}

console.log(`[listes] ${emitted.length} pages de liste rendues`);
console.log(emitted.map((u) => "  " + u).join("\n"));
