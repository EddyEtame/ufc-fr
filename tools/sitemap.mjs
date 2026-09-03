/**
 * Sitemap unique, construit depuis ce qui existe réellement sur le disque.
 * Le générer à partir d'une liste tenue à la main, c'est garantir qu'un jour
 * il décrira un site qui n'existe plus.
 */
import { readdirSync, statSync, writeFileSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = "https://www.ufc.fr";
const IGNORE = new Set([".git", "node_modules", "data", "media", "UFC", "tools", "mcp", "img", "css", "js", "logo", ".registre", ".research", ".pages"]);

const urls = new Set(["/"]);
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (IGNORE.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full);
    else if (name.endsWith(".html")) {
      const rel = full.slice(ROOT.length + 1);
      // Les coulisses sont en noindex : les lister serait se contredire.
      if (/noindex/.test(readFileSync(full, "utf8").slice(0, 1500))) continue;
      urls.add(rel === "index.html" ? "/" : rel.endsWith("/index.html") ? "/" + rel.replace(/index\.html$/, "") : "/" + rel);
    }
  }
})(ROOT);

const body = [...urls].sort().map((u) => `  <url><loc>${SITE}${u}</loc></url>`).join("\n");
writeFileSync(join(ROOT, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`, "utf8");
console.log(`[sitemap] ${urls.size} URL`);
