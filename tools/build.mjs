/**
 * Générateur UFC.FR — rend les 107 documents extraits du WordPress dans la
 * direction artistique du site recodé.
 *
 * Pourquoi un générateur et pas des pages à la main : le cahier des charges
 * demande plusieurs articles par semaine indéfiniment (§15) avec un pipeline
 * assisté (§16). Écrire chaque article en HTML condamne la cadence. Ici, un
 * article = un objet dans data/wp/, et la mise en page est appliquée une fois.
 *
 * Pourquoi les slugs du WordPress : le domaine www.ufc.fr va basculer sur ce
 * site. En rendant /organisation-mma-ksw/ à l'identique, les URL déjà indexées
 * survivent sans une seule redirection — donc sans perte de position au moment
 * exact où le trafic arrive.
 *
 * Règle absolue : rien dans le HTML rendu ne doit trahir WordPress. Ni chemin
 * wp-content, ni classe wp-*, ni marquage Elementor. Le CMS a été la source,
 * il n'est pas l'histoire.
 */
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "data", "wp");
const SITE = "https://www.ufc.fr";
const BRAND = "UFC.FR";

const read = (f) => JSON.parse(readFileSync(join(DATA, f), "utf8"));
const posts = read("posts.json");
const pages = read("pages.json");
const categories = read("categories.json");
const mediaManifest = existsSync(join(DATA, "media-manifest.json")) ? read("media-manifest.json") : [];

/* ------------------------------------------------------- articles maison --
 * Le cahier des charges demande plusieurs articles par semaine, indefiniment
 * (§15), avec un pipeline assiste (§16). Tant que le corpus se limitait a
 * l'extraction du CMS, ecrire un nouvel article voulait dire retoucher le
 * generateur — c'est-a-dire ne pas pouvoir en ecrire.
 *
 * Un article maison est un fichier JSON dans data/articles/. Il est traduit
 * ici dans la forme d'un article du CMS, puis rejoint le corpus : page
 * dediee, rubrique, fil, recherche, sitemap, corpus machine et serveur MCP le
 * reprennent sans une ligne de plus.
 */
const DIR_MAISON = join(ROOT, "data", "articles");
const catParSlug = new Map(categories.map((c) => [c.slug, c]));

function articlesMaison() {
  if (!existsSync(DIR_MAISON)) return [];
  return readdirSync(DIR_MAISON)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      const a = JSON.parse(readFileSync(join(DIR_MAISON, f), "utf8"));
      const ids = [a.categorie, ...(a.categories_secondaires || [])]
        .map((slug) => catParSlug.get(slug)?.id)
        .filter(Boolean);

      // Le chapo ouvre l'article et sert de resume ; la mention de source et
      // le lien vers le club ferment le corps. Les assembler ici plutot que
      // dans le JSON garde les fiches lisibles et la mise en forme unique.
      const corps =
        `<p class="chapo">${a.chapo}</p>\n` +
        a.corps +
        (a.lien_club
          ? `\n<p class="renvoi">Horaires, tarifs et inscriptions changent d’une saison à l’autre : le club les tient à jour sur <a href="${a.lien_club.url}" rel="noopener">${a.lien_club.texte}</a>.</p>`
          : "") +
        (a.source ? `\n<p class="source-note">${a.source}</p>` : "");

      return {
        id: 900000 + Math.abs([...a.slug].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7)) % 90000,
        slug: a.slug,
        date: `${a.date}T09:00:00`,
        date_gmt: `${a.date}T07:00:00`,
        modified: `${a.date}T09:00:00`,
        modified_gmt: `${a.date}T07:00:00`,
        title: { rendered: a.titre },
        content: { rendered: corps },
        excerpt: { rendered: `<p>${a.chapo}</p>` },
        categories: ids,
        maison: true,
        yoast_head_json: { title: `${a.titre} | UFC.FR`, description: a.meta_description },
        _embedded: a.image
          ? {
              "wp:featuredmedia": [
                {
                  source_url: a.image,
                  alt_text: a.image_alt || "",
                  title: { rendered: a.image_alt || "" },
                  credit: a.image_credit || "",
                  media_details: {},
                },
              ],
            }
          : undefined,
      };
    });
}

const maison = articlesMaison();
posts.push(...maison);

/* ---------------------------------------------------------------- médias --
 * Les binaires vivent dans /media/ à la racine. On garde le nom de fichier
 * d'origine : les slugs WP sont déjà descriptifs, et c'est ce qui permet de
 * retrouver une image à l'œil dans le dépôt.
 */
const mediaByUrl = new Map();
for (const m of mediaManifest) {
  const path = new URL(m.source_url).pathname;
  const name = basename(path);
  // Un seul chemin canonique : /media/AAAA/MM/fichier, exactement l'arborescence
  // que WordPress servait. Toute autre convention finit par diverger de ce que
  // le corps des articles contient deja en dur, et produit des images mortes.
  const rel = path.replace(/^\/wp-content\/uploads\//, "");
  mediaByUrl.set(m.source_url, { url: `/media/${rel}`, ...m });
  // WordPress sert aussi des variantes redimensionnées (-1024x768) et « -scaled ».
  // Elles pointent le même fichier source : on les rabat toutes sur l'original.
  const stem = name.replace(/\.[a-z0-9]+$/i, "");
  mediaByUrl.set(stem, { url: `/media/${rel}`, ...m });
}

/* ------------------------------------------------------------- curation --
 * Les images a la une venues du CMS sont generiques : la facade de Bercy et
 * un octogone de stock illustrent la moitie du corpus, y compris des articles
 * sur une personne nommee. Le depot, lui, contient les vraies photos.
 *
 * On rapproche donc le sujet de l'article de sa photo : si le slug nomme
 * quelqu'un dont on a le portrait, c'est ce portrait qui illustre. C'est la
 * difference entre un site alimente et un site tenu.
 */
/* ------------------------------------------------ photos attribuees --
 * Une photo nommee pour un slug precis, sans devinette ni motif.
 *
 * Douze reportages de club partageaient la meme photo d'illustration : un
 * boxeur generique servait de facade a Toulouse, Paris, Lille et Nantes a la
 * fois. C'est le meme defaut que la galerie de ceintures — une image qui ne
 * montre pas ce dont l'article parle ne l'illustre pas, elle le remplit.
 *
 * Chaque salle a desormais sa photo, prise sur le site du club et creditee.
 * Le credit n'est pas une politesse : on publie l'image de quelqu'un d'autre,
 * on dit de qui elle vient. Nice reste sans photo — son site n'en publie
 * aucune — et garde donc le repli : mieux vaut un manque qu'un faux.
 */
const PHOTOS_EXACTES = {
  "cage-fight-toulouse-club-mma": ["/media/clubs/cage-fight-toulouse.webp", "Photo Cage Fight Toulouse"],
  "unlock-paris-17-club-mma": ["/media/clubs/unlock-paris-17.webp", "Photo Unlock Paris 17"],
  "nrfight-paris-club-mma": ["/media/clubs/nrfight-paris.webp", "Photo NRFight Paris"],
  "fondation-mma-marseille-club": ["/media/clubs/fondation-mma-marseille.webp", "Photo Fondation MMA Marseille"],
  "team-ezbiri-lyon-club-mma": ["/media/clubs/team-ezbiri-lyon.webp", "Photo Team Ezbiri"],
  "panthers-club-lille-mma": ["/media/clubs/panthers-club-lille.webp", "Photo Panthers Club Lille"],
  "parabellum-nantes-club-mma": ["/media/clubs/parabellum-nantes.webp", "Photo Julia Briend · Parabellum Combat Club"],
  "fight-n-fit-bordeaux-club-mma": ["/media/clubs/fight-n-fit-bordeaux.webp", "Photo Fight\u2019n\u2019Fit Bordeaux"],
  "cage-training-montpellier-lattes": ["/media/clubs/cage-training-lattes.webp", "Photo Cage Training"],
  "apex-mma-strasbourg": ["/media/clubs/apex-mma-strasbourg.webp", "Photo Apex MMA Strasbourg"],
  "monkey-gym-rennes-saint-gregoire": ["/media/clubs/monkey-gym-rennes.webp", "Photo Monkey Gym"],
  "coachs-cage-fight-toulouse-jerome-tancrede-yannis": ["/media/clubs/coachs-cage-fight-toulouse.webp", "Photo Cage Fight Toulouse"],
  // La page de rubrique s'ouvrait sur une cage polonaise de banque d'images,
  // et la partageait avec deux articles. Une salle francaise vide, avant le
  // cours, dit mieux ce dont la page parle.
  "clubs-mma-francais": ["/media/clubs/rubrique-clubs.webp", "Photo Panthers Club Lille"],
  // ARES et Hexagone partageaient la meme photo « organisations » : cote a
  // cote dans une grille, les deux pages se ressemblaient au point de sembler
  // la meme. Le depot contenait deja une dizaine de photos jamais servies.
  "organisation-mma-ares-fighting-championship": ["/img/octagon.jpg", ""],
};

const PORTRAITS_MAISON = {
  parnasse: "/img/parnasse.jpg", hooker: "/img/hooker.jpg", ziam: "/img/ziam.jpg",
  sola: "/img/sola.jpg", charriere: "/img/charriere.jpg", sy: "/img/sy.jpg",
  cornolle: "/img/cornolle.jpg", duclos: "/img/duclos.jpg", aljarouj: "/img/aljarouj.jpg",
  benouaich: "/img/benouaich.jpg", gane: "/img/gane.jpg", imavov: "/img/imavov.jpg",
  zebo: "/img/zebo.jpg",
  "saint-denis": "/img/saint-denis.jpg",
};

// Par sujet, et UNIQUEMENT quand le document n'est pas un portrait.
//
// La faute que ces trois lignes reparent : `portrait-one-championship-tang-kai`
// contient « champion ». Le repli s'appliquait donc a toute la galerie ONE
// Championship, et neuf combattants differents affichaient la meme
// photographie de ceinture. Un repli generique doit etre le dernier recours,
// jamais un filet qui attrape ce qui allait bien.
const SUJETS_MAISON = [
  [/(^|-)(club|gym|academy|salle)(-|$)|(^|-)team-/, "/img/gym.jpg"],
  [/(^|-)pesee(-|$)/, "/img/pesee.jpg"],
  [/(^|-)classements?(-|$)/, "/img/ceinture.jpg"],
  [/(^|-)(organisation|differences)(-|$)/, "/img/organisations.jpg"],
  [/(^|-)(calendrier|gala)(-|$)/, "/img/arena-exterieur.jpg"],
];

/**
 * L'image d'un document, curatee. Renvoie `null` si rien de mieux que
 * l'image du CMS n'existe — l'appelant garde alors la sienne.
 */
export function imageMaison(slug) {
  const s = String(slug || "").toLowerCase();
  // Un article maison apporte sa propre photo : aucun repli ne s'y applique.
  if (s.startsWith("boxing-center-")) return null;
  // La photo d'une salle est nommee, pas devinee : elle prime sur tout.
  if (PHOTOS_EXACTES[s]) return { url: PHOTOS_EXACTES[s][0], credit: PHOTOS_EXACTES[s][1], unique: true };
  // Le nom retenu est celui qui apparait le PLUS TOT dans le slug, pas le
  // premier de la liste : « dan-hooker-citations-ufc-paris-parnasse » parle
  // de Hooker, et une correspondance par ordre de declaration y mettait la
  // photo de Parnasse. Le sujet d'un article est nomme en tete de son slug.
  let meilleur = null;
  for (const [nom, chemin] of Object.entries(PORTRAITS_MAISON)) {
    // Le nom doit etre un segment du slug, pas une sous-chaine : « sy »
    // apparait dans « physique » et illustrerait n'importe quoi.
    const m = s.match(new RegExp(`(^|-)${nom}(-|$)`));
    if (m && (meilleur === null || m.index < meilleur.index)) meilleur = { index: m.index, chemin };
  }
  if (meilleur) return { url: meilleur.chemin, unique: true };
  // Un portrait garde toujours l'image du CMS : c'est la photo de la personne.
  // Lui appliquer un repli par sujet, c'est remplacer un visage par un objet.
  if (s.startsWith("portrait-")) return null;

  // Les replis par sujet sont generiques par construction : trois articles de
  // classement recevraient la meme ceinture. Ils passent donc au
  // dedoublonnage comme les images du CMS.
  for (const [motif, chemin] of SUJETS_MAISON) if (motif.test(s)) return { url: chemin, unique: false };
  return null;
}

/** Ramène n'importe quelle variante d'URL WordPress vers le fichier local. */
function localMedia(src) {
  if (!src) return null;
  if (mediaByUrl.has(src)) return mediaByUrl.get(src);
  const name = basename(src.split("?")[0]);
  const stem = name.replace(/-\d+x\d+(?=\.[a-z0-9]+$)/i, "").replace(/\.[a-z0-9]+$/i, "");
  if (mediaByUrl.has(stem)) return mediaByUrl.get(stem);
  const scaled = stem.replace(/-scaled$/, "");
  if (mediaByUrl.has(scaled)) return mediaByUrl.get(scaled);
  return null;
}

/* --------------------------------------------------------------- nettoyage */

/**
 * Débarrasse le HTML WordPress de tout ce qui le désigne, et rend les images
 * conformes : chemin local, lazy-loading, dimensions réservées (sans quoi la
 * page saute au chargement — le CLS est un défaut de design, pas un détail).
 */
function cleanContent(html) {
  let out = html;

  // 1. Les grilles « articles lies » du CMS.
  //
  // Le theme ajoutait en fin d'article une grille d'articles connexes, rendue
  // en HTML dans le corps. Elle contient des images, des titres et des liens
  // dupliques — et notre gabarit propose deja sa propre suite de lecture, tiree
  // du corpus.
  //
  // Elle etait jusqu'ici nettoyee de ses classes plutot que supprimee : il en
  // restait des blocs vides porteurs d'images, invisibles a l'ecran mais bien
  // presents dans 116 pages. Retirer les attributs d'un bloc mort ne le tue
  // pas, ca le camoufle. On coupe le corps a l'endroit ou la grille commence.
  const marqueur = out.search(/wpr-grid|data-overlay-link|data-elementor-type/);
  if (marqueur > 0) {
    // On remonte a l'ouverture de la balise qui la porte, sinon on laisse un
    // fragment de tag ouvert qui casse le reste du document.
    const debut = out.lastIndexOf("<", marqueur);
    if (debut > 0) out = out.slice(0, debut);
  }

  // Images : source locale + attributs de performance.
  out = out.replace(/<img\b([^>]*)>/gi, (tag, attrs) => {
    const src = (attrs.match(/\ssrc="([^"]+)"/i) || [])[1];
    const alt = (attrs.match(/\salt="([^"]*)"/i) || [])[1] || "";
    const found = localMedia(src);
    if (!found) return tag; // image externe : on n'y touche pas
    const w = found.media_details?.width;
    const h = found.media_details?.height;
    const dims = w && h ? ` width="${w}" height="${h}"` : "";
    return `<img src="${found.url}" alt="${esc(alt)}" loading="lazy" decoding="async"${dims} />`;
  });

  // srcset WordPress : inutile une fois l'original servi, et il réintroduit
  // des chemins wp-content. On le supprime plutôt que de le réécrire.
  out = out.replace(/\s(srcset|sizes)="[^"]*"/gi, "");

  // Liens internes : absolus vers le domaine → relatifs à la racine.
  out = out.replace(/href="https?:\/\/(?:www\.)?ufc\.fr\/([^"]*)"/gi, 'href="/$1"');

  // Toute trace résiduelle de l'ancien CMS.
  out = out.replace(/\s(?:class|id)="[^"]*\b(?:wp-|elementor|has-|is-layout)[^"]*"/gi, "");
  out = out.replace(/https?:\/\/(?:www\.)?ufc\.fr\/wp-content\/uploads\//gi, "/media/");
  // Elementor et Royal Addons signent leur passage dans des attributs data-*
  // et des classes wpr-*. On retire les attributs plutôt que les balises : un
  // <div> nu est inerte, alors que supprimer une balise ouvrante sans sa
  // fermante casserait la structure du document.
  out = out.replace(/\sdata-(?:elementor|widget|settings|wpr|id|element_type)[a-z_-]*="[^"]*"/gi, "");
  out = out.replace(/\s(?:class|id)="[^"]*\bwpr-[^"]*"/gi, "");
  out = out.replace(/<div\s*>/gi, "<div>");

  // Restes des grilles dynamiques : leur pagination pointait l'API REST. Le
  // widget ne survit pas a l'extraction, on retire ses debris plutot que de
  // laisser une URL de CMS dans le document.
  out = out.replace(/<a[^>]*href="[^"]*wp-json[^"]*"[^>]*>[\s\S]*?<\/a>/gi, "");
  out = out.replace(/<div[^>]*data-pages="[^"]*"[^>]*>[\s\S]*?<\/div>/gi, "");
  out = out.replace(/<span[^>]*current-page[^>]*>[\s\S]*?<\/span>/gi, "");

  // Le corps venu du CMS porte parfois son propre <h1> : le theme WordPress
  // ne rendait pas de titre au-dessus, l'auteur l'a donc ecrit dans le texte.
  // Notre gabarit fournit le h1, celui du corps est retrograde en h2 — deux
  // h1 sur une page, c'est un signal contradictoire envoye a l'indexation.
  out = out.replace(/<(\/?)h1(\s|>)/gi, "<$1h2$2");

  return out.trim();
}

const esc = (s = "") =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Décode les entités que l'API renvoie déjà encodées dans les titres.
 *
 * Les numériques sont traitées par la règle générale plutôt qu'une par une :
 * une table écrite à la main laissait passer tout ce qu'elle n'avait pas
 * prévu — « cage 5&#215;5 » s'affichait tel quel dans une fiche de club.
 * `&amp;` se décode en dernier, sinon « &amp;#215; » deviendrait un ×.
 */
const decode = (s = "") =>
  String(s)
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&rsquo;/g, "’").replace(/&lsquo;/g, "‘")
    .replace(/&ldquo;/g, "“").replace(/&rdquo;/g, "”")
    .replace(/&hellip;/g, "…").replace(/&ndash;/g, "–").replace(/&mdash;/g, "—")
    .replace(/&laquo;/g, "«").replace(/&raquo;/g, "»")
    .replace(/&nbsp;/g, " ").replace(/&times;/g, "×").replace(/&eacute;/g, "é")
    .replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

/**
 * Le resume d'un document.
 *
 * L'extrait fourni par le CMS commence a la premiere ligne du corps — or les
 * articles ouvrent sur une <figure>, donc l'extrait commençait par la
 * legende : « Accor Arena, Paris. Photo Vilacor, Wikimedia Commons, licence
 * CC BY 4.0. » sur chaque carte du fil. Un credit photo n'a jamais donne
 * envie de cliquer. On prend le premier vrai paragraphe.
 */
export function resume(doc, n = 150) {
  const corps = String(doc.content?.rendered || "")
    .replace(/<figure[\s\S]*?<\/figure>/gi, "")
    .replace(/<figcaption[\s\S]*?<\/figcaption>/gi, "");
  const paras = [...corps.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map((m) => stripTags(m[1]));
  // Un premier paragraphe de moins de 60 signes est presque toujours un
  // chapeau technique ou une mention de source : on passe au suivant.
  const texte = paras.find((t) => t.length > 60) || paras[0] || stripTags(doc.excerpt?.rendered || "");
  if (!texte) return "";
  if (texte.length <= n) return texte;
  const coupe = texte.slice(0, n);
  return coupe.slice(0, coupe.lastIndexOf(" ")) + "…";
}

const stripTags = (s = "") => decode(String(s).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim());

const MOIS = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
function dateFr(iso) {
  const d = new Date(iso);
  const j = d.getUTCDate();
  return `${j === 1 ? "1er" : j} ${MOIS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** Coupe une description à la longueur que Google affiche réellement. */
function metaDesc(doc) {
  const y = doc.yoast_head_json?.description;
  const raw = y || stripTags(doc.excerpt?.rendered || doc.content?.rendered || "");
  if (raw.length <= 160) return raw;
  const cut = raw.slice(0, 157);
  return cut.slice(0, cut.lastIndexOf(" ")) + "…";
}

export { cleanContent, localMedia, esc, decode, stripTags, dateFr, metaDesc, posts, pages, categories, SITE, BRAND, ROOT, mediaManifest };
