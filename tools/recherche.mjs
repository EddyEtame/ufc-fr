/**
 * La recherche.
 *
 * Le WordPress en avait une — son balisage declarait meme une SearchAction —
 * et le site recode l'avait perdue. Sur un corpus de 90 articles c'est moins
 * un confort qu'une condition d'usage : sans recherche, tout ce qui n'est pas
 * sur la page d'accueil est introuvable.
 *
 * Pas de service, pas de dependance : un index JSON construit au build et
 * parcouru dans le navigateur. Sur cette taille de corpus, un moteur serveur
 * serait de l'infrastructure a maintenir pour un gain nul — l'index tient en
 * quelques dizaines de kilo-octets et la reponse est instantanee.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { posts, pages, categories, ROOT, SITE, esc, decode, stripTags, resume } from "./build.mjs";
import { head, header, footer } from "./render.mjs";

const catById = new Map(categories.map((c) => [c.id, c]));

/**
 * L'index. On n'embarque pas le texte integral : les titres, le resume et une
 * poignee de mots du corps suffisent a retrouver un article, et l'index reste
 * assez leger pour etre charge d'un coup sur un telephone en 4G.
 */
const index = [...posts, ...pages.filter((p) => p.slug !== "ufc-fr-mma")].map((p) => ({
  t: decode(p.title.rendered),
  u: `/${p.slug}/`,
  d: p.date.slice(0, 10),
  c: (p.categories || []).map((id) => catById.get(id)?.name).filter(Boolean),
  // Le resume curate, jamais l'extrait du CMS : celui-ci commence par la
  // legende de la photo d'ouverture, et un credit photo ne fait pas cliquer.
  r: resume(p, 170),
  // Les 700 premiers signes du corps : assez pour attraper un nom de
  // combattant cite une seule fois, sans tripler le poids du fichier.
  k: stripTags(p.content.rendered).slice(0, 700).toLowerCase(),
}));

writeFileSync(join(ROOT, "recherche-index.json"), JSON.stringify(index), "utf8");

const schema = {
  "@context": "https://schema.org",
  "@type": "SearchResultsPage",
  name: "Rechercher sur UFC.FR",
  url: `${SITE}/recherche/`,
  inLanguage: "fr-FR",
};

const html = `${head({
  title: "Rechercher — UFC.FR",
  description: `Cherchez parmi ${index.length} articles et pages d'UFC.FR : combattants, clubs, organisations, résultats, événements.`,
  canonical: "/recherche/",
  type: "website",
  schema: [schema],
})}
${header()}
  <main id="contenu">
    <section class="block">
      <div class="wrap">
        <header class="head" data-reveal>
          <div>
            <span class="kicker">Chercher</span>
            <h1>Dans ${index.length} pages</h1>
            <p class="lede">Un nom de combattant, une ville, une organisation, un événement.</p>
          </div>
        </header>

        <form class="recherche" role="search" onsubmit="return false;">
          <label class="visuallyhidden" for="q">Rechercher sur UFC.FR</label>
          <input id="q" type="search" name="q" autocomplete="off" autofocus
                 placeholder="Parnasse, Toulouse, KSW, pesée…" />
          <p class="recherche-etat" aria-live="polite" data-etat></p>
        </form>

        <div class="recherche-resultats" data-resultats></div>
      </div>
    </section>
  </main>
${footer().replace("</body>", '  <script src="/js/recherche.js" defer></script>\n</body>')}`;

mkdirSync(join(ROOT, "recherche"), { recursive: true });
writeFileSync(join(ROOT, "recherche", "index.html"), html, "utf8");

console.log(`[recherche] /recherche/ + index de ${index.length} documents (${Math.round(Buffer.byteLength(JSON.stringify(index)) / 1024)} Ko)`);
