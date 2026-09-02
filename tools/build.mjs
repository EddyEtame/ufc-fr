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

/** Décode les entités que l'API renvoie déjà encodées dans les titres. */
const decode = (s = "") =>
  String(s)
    .replace(/&#8211;/g, "–").replace(/&#8217;|&rsquo;/g, "’").replace(/&#8230;/g, "…")
    .replace(/&laquo;/g, "«").replace(/&raquo;/g, "»").replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#039;/g, "'");

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
