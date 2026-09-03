/**
 * Controle avant livraison. Ce qui est verifie ici correspond aux defauts
 * qui ont deja ete constates sur ce projet : c'est un registre executable,
 * pas une liste de bonnes pratiques generiques.
 */
import { readdirSync, statSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SKIP = new Set([".git", "node_modules", "data", "UFC", "tools", "mcp", ".registre", ".research", ".pages"]);
const pages = [];
(function walk(d) {
  for (const n of readdirSync(d)) {
    if (SKIP.has(n)) continue;
    const f = join(d, n);
    statSync(f).isDirectory() ? walk(f) : n.endsWith(".html") && pages.push(f);
  }
})(ROOT);

let fails = 0;
const fail = (m) => { console.log("  ✗ " + m); fails++; };

console.log(`[controle] ${pages.length} pages`);

// 1. Aucune trace du CMS d'origine.
for (const p of pages) {
  const h = readFileSync(p, "utf8");
  const rel = p.slice(ROOT.length + 1);
  if (/wp-content|wp-json|class="[^"]*wp-|elementor/i.test(h)) fail(`trace CMS dans ${rel}`);
  if (/class="js-motion"/.test(h)) fail(`js-motion code en dur dans ${rel}`);
  if (!/rel="icon"/.test(h)) fail(`favicon absent de ${rel}`);
  if (!/og:title/.test(h)) fail(`Open Graph absent de ${rel}`);
  // Un gabarit mal echappe laisse `${...}` dans le document : le lien
  // devient inatteignable et rien d'autre ne le signale.
  if (/\$\{/.test(h)) fail(`litteral de gabarit non evalue dans ${rel}`);
  const h1 = (h.match(/<h1[\s>]/g) || []).length;
  if (h1 !== 1 && !/name="robots" content="noindex/.test(h)) fail(`${h1} h1 dans ${rel}`);
  // 2. Aucune image repetee dans une page.
  //    Ajoute apres avoir livre une galerie ou neuf combattants differents
  //    portaient la meme photo de ceinture : rien ne le signalait, ni le
  //    build, ni les liens morts, ni la console.
  // Les copies mises en noindex sont des pages superseedees qu'on garde
  // accessibles sans les entretenir : leur repetition d'images ne se corrige
  // pas, elle disparaitra avec elles.
  if (/name="robots" content="noindex/.test(h)) { /* controle allege */ }
  else {
  // La marque revient en en-tete et en pied : c'est voulu, elle est exclue.
  const imgs = [...h.matchAll(/<img[^>]+src="([^"]+)"/g)]
    .map((m) => m[1])
    .filter((src) => !/logo\/|media\/brand\//.test(src));
  const compte = {};
  for (const src of imgs) compte[src] = (compte[src] || 0) + 1;
  for (const [src, n] of Object.entries(compte)) {
    if (n > 1) fail(`${src} apparait ${n} fois dans ${rel}`);
  }
  }

  // 3. Aucune reference locale morte.
  for (const a of new Set([...h.matchAll(/(?:src|href)="(\/[^"]+\.(?:jpg|jpeg|png|webp|css|js|gif|svg))"/g)].map((m) => m[1]))) {
    if (!existsSync(join(ROOT, a))) fail(`${a} manquant (${rel})`);
  }
}
console.log(fails ? `\n${fails} defaut(s).` : "\nAucun defaut.");
process.exit(fails ? 1 : 0);
