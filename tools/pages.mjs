/**
 * Prepare une copie du site pour GitHub Pages.
 *
 * Pourquoi une copie et pas le depot tel quel : Pages sert le site sous
 * `/<nom-du-depot>/`, alors que toutes nos URL internes sont absolues depuis
 * la racine (`/css/site.css`, `/media/...`). Servies telles quelles sous un
 * sous-chemin, elles pointent toutes a cote.
 *
 * Plutot que de faire passer un prefixe a travers les cinq generateurs — ce
 * qui compliquerait le code principal pour un besoin de secours — on
 * post-traite : on copie le site rendu et on reecrit les chemins absolus.
 * Le depot, lui, reste intact pour l'hebergeur principal.
 */
import { readdirSync, statSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = process.env.OUT || join(ROOT, ".pages");
const BASE = process.env.BASE_PATH ?? "/ufc";

const IGNORE = new Set([".git", "node_modules", "data", "UFC", "tools", "mcp", ".registre", ".research", ".pages"]);
const TEXTE = new Set([".html", ".xml", ".txt", ".json", ".css", ".js", ".mjs"]);

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

let fichiers = 0;
(function copier(dir, rel = "") {
  for (const nom of readdirSync(dir)) {
    if (IGNORE.has(nom) || nom.startsWith(".git")) continue;
    const src = join(dir, nom);
    const dst = join(OUT, rel, nom);
    if (statSync(src).isDirectory()) {
      mkdirSync(dst, { recursive: true });
      copier(src, join(rel, nom));
      continue;
    }

    if (TEXTE.has(extname(nom))) {
      let t = readFileSync(src, "utf8");
      // Uniquement les attributs de chemin : on ne touche ni au texte
      // redactionnel ni aux URL absolues vers un autre domaine.
      t = t.replace(/(href|src)="\/(?!\/)/g, `$1="${BASE}/`);
      t = t.replace(/url\("\/(?!\/)/g, `url("${BASE}/`);
      writeFileSync(dst, t, "utf8");
    } else {
      copyFileSync(src, dst);
    }
    fichiers++;
  }
})(ROOT);

// Sans ce fichier, Pages passe le site dans Jekyll, qui ignore les dossiers
// commencant par un tiret bas et reecrit certaines pages.
writeFileSync(join(OUT, ".nojekyll"), "", "utf8");

console.log(`[pages] ${fichiers} fichiers prepares dans ${OUT} sous ${BASE}/`);
