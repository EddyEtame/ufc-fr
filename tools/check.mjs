/**
 * Controle avant livraison. Ce qui est verifie ici correspond aux defauts
 * qui ont deja ete constates sur ce projet : c'est un registre executable,
 * pas une liste de bonnes pratiques generiques.
 */
import { readdirSync, statSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SKIP = new Set([".git", "node_modules", "data", "UFC", "tools", ".registre"]);
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
  const h1 = (h.match(/<h1[\s>]/g) || []).length;
  if (h1 !== 1 && !/name="robots" content="noindex/.test(h)) fail(`${h1} h1 dans ${rel}`);
  // 2. Aucune reference locale morte.
  for (const a of new Set([...h.matchAll(/(?:src|href)="(\/[^"]+\.(?:jpg|jpeg|png|webp|css|js|gif|svg))"/g)].map((m) => m[1]))) {
    if (!existsSync(join(ROOT, a))) fail(`${a} manquant (${rel})`);
  }
}
console.log(fails ? `\n${fails} defaut(s).` : "\nAucun defaut.");
process.exit(fails ? 1 : 0);
