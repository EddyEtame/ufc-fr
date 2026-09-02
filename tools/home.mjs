/**
 * L'accueil, pilotée par le corpus.
 *
 * Le parti pris éditorial, et c'est le seul qui compte ici : une page
 * d'accueil de média n'est pas une grille. Une grille dit que tous les
 * sujets se valent, et le samedi 5 septembre à Bercy ne vaut pas la même
 * chose qu'un portrait de plus. La page est donc construite en paliers —
 * un événement qui occupe l'écran, un fil qui respire, des rubriques qui
 * ferment — au lieu d'un empilement de cartes identiques.
 *
 * Tous les liens pointent les slugs canoniques du corpus, jamais les
 * anciennes pages écrites à la main : c'est ce qui met fin à la
 * cannibalisation entre les deux versions d'un même sujet.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { posts, categories, ROOT, SITE, esc, decode, stripTags, dateFr, localMedia } from "./build.mjs";
import { head, header, footer } from "./render.mjs";

const catBySlug = new Map(categories.map((c) => [c.slug, c]));
const byDate = [...posts].sort((a, b) => new Date(b.date) - new Date(a.date));
const inCat = (slug) => {
  const c = catBySlug.get(slug);
  return c ? byDate.filter((p) => (p.categories || []).includes(c.id)) : [];
};
const bySlug = (s) => posts.find((p) => p.slug === s);

function media(p) {
  const fm = p?._embedded?.["wp:featuredmedia"]?.[0];
  if (!fm?.source_url) return null;
  const l = localMedia(fm.source_url);
  return { url: l ? l.url : fm.source_url, alt: fm.alt_text || "", w: fm.media_details?.width, h: fm.media_details?.height };
}
const T = (p) => esc(decode(p.title.rendered));
const X = (p, n = 130) => esc(stripTags(p.excerpt.rendered).slice(0, n)) + "…";

function pic(p, cls = "") {
  const m = media(p);
  if (!m) return "";
  return `<img src="${m.url}" alt="${esc(m.alt)}"${m.w && m.h ? ` width="${m.w}" height="${m.h}"` : ""} loading="lazy" decoding="async"${cls ? ` class="${cls}"` : ""} />`;
}

const paris = inCat("ufc-paris-2026");
const clubs = inCat("clubs-mma-francais");
const portraits = byDate.filter((p) => p.slug.startsWith("portrait-"));
const fil = byDate.filter((p) => !p.slug.startsWith("portrait-")).slice(0, 7);

// Le dossier Bercy ouvre la page : trois jours avant l'événement, c'est la
// seule hiérarchie défendable.
const une = bySlug("ufc-paris-2026-date-lieu-carte-enjeux") || paris[0];
const carte = bySlug("ufc-paris-2026-carte-complete-hooker-parnasse") || paris[1];

const schema = [
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "UFC.FR",
    alternateName: "UFC.FR — média MMA indépendant",
    url: SITE + "/",
    inLanguage: "fr-FR",
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: SITE + "/recherche/?q={search_term_string}" },
      "query-input": "required name=search_term_string",
    },
  },
  {
    "@context": "https://schema.org",
    "@type": "NewsMediaOrganization",
    name: "UFC.FR",
    url: SITE + "/",
    logo: { "@type": "ImageObject", url: SITE + "/logo/ufc.fr.jpeg" },
    description: "Média indépendant d’actualité MMA en France et à l’international. Non affilié à l’Ultimate Fighting Championship.",
    diversityPolicy: SITE + "/a-propos/",
    ethicsPolicy: SITE + "/a-propos/",
  },
  {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: "UFC Paris 2026 — Hooker vs Parnasse",
    startDate: "2026-09-05T21:00:00+02:00",
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: {
      "@type": "Place",
      name: "Accor Arena",
      address: { "@type": "PostalAddress", addressLocality: "Paris", addressCountry: "FR" },
    },
    sport: "Mixed Martial Arts",
    url: SITE + "/carte/ufc-paris-2026/",
  },
];

const html = `${head({
  title: "UFC.FR — l’actualité du MMA, en français",
  description:
    "Média MMA indépendant : UFC Paris 2026 en direct, résultats, champions de toutes les organisations, clubs français et portraits de combattants. Pas le site officiel de l’UFC.",
  canonical: "/",
  image: "/media/brand/ufc-fr-og.jpg",
  type: "website",
  schema,
})}
${header("/")}
  <main id="contenu">

  <!-- Palier 1 — l'événement. Il occupe l'écran parce qu'il a lieu dans
       trois jours et que rien d'autre sur ce site n'a cette urgence. -->
  <section class="hero">
    <div class="hero-slash"></div>
    <p class="vs">contre</p>
    <div class="fighter a">
      <img class="hero-photo" src="/img/parnasse.jpg" alt="Salahdine Parnasse, double champion KSW" width="1200" height="1600" />
      <div class="sil"></div>
      <div class="corner">
        <span class="kicker">France · Débuts UFC</span>
        <span class="name">Parnasse</span>
        <span class="div">Poids légers</span>
      </div>
    </div>
    <div class="fighter b">
      <img class="hero-photo" src="/img/hooker.jpg" alt="Dan Hooker, poids légers, Nouvelle-Zélande" width="1200" height="1600" />
      <div class="sil"></div>
      <div class="corner">
        <span class="kicker">Nouvelle-Zélande</span>
        <span class="name">Hooker</span>
        <span class="div">Poids légers</span>
      </div>
    </div>
    <div class="hero-cta">
      <p class="hero-date">Samedi 5 septembre · Accor Arena</p>
      <div class="hero-actions">
        <a class="btn btn-fill cut" href="/carte/ufc-paris-2026/">La carte, combat par combat</a>
        <a class="btn btn-line cut" href="/${une.slug}/">Le dossier</a>
      </div>
    </div>
  </section>

  <div class="ticker">
    <div class="pulse"><b></b></div>
    <div class="tick"><strong>Samedi 5 sept.</strong><span>Accor Arena, 18h / 21h</span></div>
    <div class="tick"><strong>Hooker–Parnasse</strong><span>Main event, poids légers</span></div>
    <div class="tick"><strong>Neuf Français</strong><span>Sur la carte de Bercy</span></div>
    <div class="tick"><strong>${posts.length} articles</strong><span>Toutes organisations</span></div>
  </div>

  <!-- Palier 2 — le fil. Refus de la grille égale : une pièce large, deux
       moyennes, puis une liste. La hiérarchie est l'information. -->
  <section class="block ed-week">
    <div class="wrap ed-head" data-reveal>
      <span class="kicker">À la une</span>
      <h1>L’actualité du MMA, en français</h1>
      <p class="lede">Bercy dans trois jours. Le reste du MMA n’attend pas.</p>
      <a class="more" href="/actualite-du-mma/">Tout le fil (${posts.length})</a>
    </div>
    <a class="ed-lead" href="/${carte ? carte.slug : une.slug}/" data-reveal data-reveal-media>
      <div class="ed-lead-media">${pic(carte || une)}</div>
      <div class="ed-lead-copy">
        <span class="kicker">Dossier</span>
        <h2>${T(carte || une)}</h2>
        <p>${X(carte || une, 150)}</p>
      </div>
    </a>
    <div class="wrap ed-aside">
${fil
  .slice(0, 2)
  .map(
    (p) => `      <a class="ed-aside-item" href="/${p.slug}/" data-reveal>
        ${pic(p)}
        <div>
          <span class="kicker">${esc(categories.find((c) => (p.categories || []).includes(c.id))?.name || "Actualité")}</span>
          <h3>${T(p)}</h3>
          <p>${X(p, 90)}</p>
        </div>
      </a>`
  )
  .join("\n")}
    </div>
    <div class="wrap">
      <div class="split-list home-list">
${fil
  .slice(2)
  .map(
    (p, i) => `        <a class="row" href="/${p.slug}/" data-reveal>
          <span class="pos">${String(i + 1).padStart(2, "0")}</span>
          <span class="nm">${T(p)}</span>
          <span class="rec">${dateFr(p.date).replace(/ 2026$/, "")}</span>
        </a>`
  )
  .join("\n")}
      </div>
    </div>
  </section>

  <!-- Palier 3 — les combattants. Le corpus le plus dense du site : il
       mérite sa propre respiration, pas une ligne dans un menu. -->
  <section class="block ed-roster-block">
    <div class="wrap ed-head" data-reveal>
      <span class="kicker">Les combattants</span>
      <h2>${portraits.length} portraits, sept organisations</h2>
      <p class="lede">De l’UFC au KSW. Parcours, records, style — sans classement maison.</p>
      <a class="more" href="/mma-portraits-de-champions/">Tous les portraits</a>
    </div>
    <div class="wrap">
      <div class="roster">
${portraits
  .slice(0, 12)
  .map(
    (p) => `        <a href="/${p.slug}/" data-reveal>${pic(p)}<span>${esc(
      decode(p.title.rendered).replace(/^Portrait\s*[:–-]\s*/i, "").split(/[,–]/)[0]
    )}</span></a>`
  )
  .join("\n")}
      </div>
    </div>
  </section>

  <!-- Palier 4 — les salles. Exigence du cahier des charges §9, et la seule
       rubrique où le site parle de gens qu'on peut aller voir. -->
  <section class="ed-club-full">
    <img class="split-photo" src="/img/gym.jpg" alt="Entraînement de MMA, sac et cage" width="1600" height="1067" />
    <div class="wrap ed-club-full-grid">
      <div class="ed-club-full-copy">
        <div data-reveal>
          <span class="kicker">Les salles</span>
          <h2>Où ça se boxe, en France</h2>
          <p>${clubs.length} clubs déjà couverts, de Toulouse à Rennes. On y va un par un.</p>
          <div class="ed-club-cta">
            <a class="btn btn-fill" href="/clubs-mma-francais/">Tous les clubs</a>
            <a class="btn btn-line" href="/cage-fight-toulouse-club-mma/">Cage Fight Toulouse</a>
          </div>
        </div>
        <div class="split-list">
${clubs
  .slice(0, 5)
  .map(
    (p, i) => `          <a class="row" href="/${p.slug}/" data-reveal>
            <span class="pos">${String(i + 1).padStart(2, "0")}</span>
            <span class="nm">${T(p)}</span>
          </a>`
  )
  .join("\n")}
        </div>
      </div>
    </div>
  </section>

  <!-- Palier 5 — les repères. Ce qui fait qu'on revient : les pages qui ne
       périment pas. -->
  <section class="block ed-keys">
    <div class="wrap ed-keys-grid">
      <div data-reveal>
        <span class="kicker">Repères</span>
        <h2>Pour s’y retrouver</h2>
        <ul class="ed-keys-list">
          <li><a href="/champions-mma-actuels/"><em>01</em><span><strong>Les champions, là, maintenant</strong><b>UFC, PFL, ONE, KSW, ARES, Hexagone. Daté.</b></span></a></li>
          <li><a href="/classements-ufc-aout-2026/"><em>02</em><span><strong>Les classements UFC</strong><b>Divisions par divisions, mis à jour.</b></span></a></li>
          <li><a href="/calendrier-mma-france-automne-2026/"><em>03</em><span><strong>Le calendrier français</strong><b>Hexagone, ARES, FMMAF. Ce qui arrive.</b></span></a></li>
          <li><a href="/organisation-mma-ultimate-fighting-championship/"><em>04</em><span><strong>Les organisations</strong><b>Qui organise quoi, et pour qui.</b></span></a></li>
        </ul>
      </div>
      <div class="ed-keys-photo" data-reveal data-reveal-media>
        <img src="/img/ceinture.jpg" alt="Ceinture de champion MMA" width="1200" height="800" loading="lazy" decoding="async" />
      </div>
    </div>
  </section>

  </main>
${footer()}`;

writeFileSync(join(ROOT, "index.html"), html, "utf8");
console.log("[accueil] index.html régénéré depuis le corpus");
console.log(`  une: ${une.slug}`);
console.log(`  fil: ${fil.length} · portraits: ${portraits.length} · clubs: ${clubs.length}`);
