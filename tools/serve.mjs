/**
 * Serveur local. Sert les dossiers en resolvant /slug/ vers son index.html,
 * exactement comme Vercel : sans ca, on developpe contre un comportement
 * different de la production et on decouvre les 404 apres le deploiement.
 *
 * Il compresse aussi le texte, pour la meme raison. Vercel le fait ; sans
 * cela, `tools/perf.mjs` mesurait 143 Ko de feuille de style la ou le lecteur
 * en recoit 24, et le plus gros poste de chaque page etait un artefact du
 * serveur de developpement. Une mesure prise dans des conditions que
 * personne ne connait ne mesure rien.
 */
import { createServer } from "node:http";
import { gzipSync } from "node:zlib";
import { readFile, stat } from "node:fs/promises";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = process.env.PORT || 4321;
const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json", ".xml": "application/xml", ".svg": "image/svg+xml",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
  ".webp": "image/webp", ".gif": "image/gif", ".ico": "image/x-icon",
};

createServer(async (req, res) => {
  const url = decodeURIComponent(req.url.split("?")[0]);
  const candidates = url.endsWith("/") ? [join(ROOT, url, "index.html")] : [join(ROOT, url), join(ROOT, url, "index.html")];
  for (const file of candidates) {
    try {
      const info = await stat(file);
      if (!info.isFile()) continue;
      const type = TYPES[extname(file)] || "application/octet-stream";
      let corps = await readFile(file);
      const entetes = { "Content-Type": type };
      // Les images et les polices sont deja compressees : les repasser au
      // gzip coute du temps et rend des octets en plus.
      if (/^(text\/|application\/(json|xml|javascript))/.test(type) &&
          /\bgzip\b/.test(req.headers["accept-encoding"] || "")) {
        corps = gzipSync(corps);
        entetes["Content-Encoding"] = "gzip";
      }
      entetes["Content-Length"] = corps.length;
      res.writeHead(200, entetes);
      res.end(corps);
      return;
    } catch { /* candidat suivant */ }
  }
  res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
  res.end("<h1>404</h1>");
}).listen(PORT, () => console.log(`UFC.FR → http://localhost:${PORT}`));
