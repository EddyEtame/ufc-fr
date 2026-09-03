/**
 * Fabrique une page autonome a partir du site rendu.
 *
 * Le besoin : donner une URL regardable sans hebergeur, sans permission et
 * sans deploiement. Une page autonome — CSS, JS et images embarques — se
 * publie n'importe ou et se regarde tout de suite.
 *
 * Ce n'est pas le site : c'est une page, prise telle qu'elle est rendue, avec
 * ses dependances repliees dedans. Les liens internes sont neutralises plutot
 * que supprimes, pour que la mise en page reste exactement celle du site.
 */
import { readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = process.env.PAGE || "index.html";
const SORTIE = process.env.OUT || join(ROOT, ".research", "apercu.html");

const MIME = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif", ".svg": "image/svg+xml" };

let html = readFileSync(join(ROOT, SOURCE), "utf8");
let embarques = 0;
let octets = 0;

/** Replie un fichier local en URI de donnees. */
function enDonnees(chemin) {
  const f = join(ROOT, chemin.replace(/^\//, ""));
  if (!existsSync(f)) return null;
  const type = MIME[extname(f).toLowerCase()];
  if (!type) return null;
  octets += statSync(f).size;
  embarques++;
  return `data:${type};base64,${readFileSync(f).toString("base64")}`;
}

// 1. Les feuilles de style et les scripts locaux passent en ligne. L'ordre
//    compte : le CSS avant le corps, les scripts a la fin, comme dans la page.
html = html.replace(/<link rel="stylesheet" href="(\/[^"]+)"\s*\/?>/g, (tag, href) => {
  const f = join(ROOT, href.replace(/^\//, ""));
  if (!existsSync(f)) return tag;
  let css = readFileSync(f, "utf8");
  // Les images citees depuis le CSS suivent le meme chemin.
  css = css.replace(/url\("(\/[^"]+)"\)/g, (u, p) => {
    const d = enDonnees(p);
    return d ? `url("${d}")` : u;
  });
  return `<style>\n${css}\n</style>`;
});

html = html.replace(/<script src="(\/[^"]+)"[^>]*><\/script>/g, (tag, src) => {
  const f = join(ROOT, src.replace(/^\//, ""));
  if (!existsSync(f)) return tag;
  return `<script>\n${readFileSync(f, "utf8")}\n</script>`;
});

// 2. Les images.
html = html.replace(/src="(\/[^"]+\.(?:jpe?g|png|webp|gif|svg))"/g, (tag, p) => {
  const d = enDonnees(p);
  return d ? `src="${d}"` : tag;
});

// 3. Les liens internes ne menent nulle part dans une page isolee : on les
//    neutralise sans les retirer, pour ne rien changer a la mise en page.
html = html.replace(/href="(\/[^"]*)"/g, 'href="#" data-lien="$1"');

// 4. Bandeau d'avertissement : cette page est un apercu, pas le site. Le dire
//    evite de la prendre pour une livraison.
html = html.replace(
  "<body",
  `<style>
.apercu-note{position:fixed;left:0;right:0;bottom:0;z-index:9999;display:flex;
gap:14px;align-items:center;justify-content:center;padding:9px 16px;
background:#0E0E0E;color:#F7F4EE;font:500 11px/1.4 Outfit,system-ui,sans-serif;
letter-spacing:.14em;text-transform:uppercase}
.apercu-note b{color:#E10613;font-weight:600}
.apercu-note span{color:#6A6A6A;text-transform:none;letter-spacing:0}
</style><body`
);
html = html.replace(
  "</body>",
  `  <div class="apercu-note"><b>Aperçu</b><span>Page autonome — la navigation est désactivée. Le site complet fait 160 pages.</span></div>
</body>`
);

writeFileSync(SORTIE, html, "utf8");
const mo = (Buffer.byteLength(html) / 1048576).toFixed(2);
console.log(`[apercu] ${SOURCE} → ${SORTIE}`);
console.log(`  ${embarques} fichiers embarques (${(octets / 1048576).toFixed(2)} Mo bruts) — page finale ${mo} Mo`);
