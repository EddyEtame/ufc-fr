#!/usr/bin/env node
/**
 * Crée un brouillon d'article à partir du template.
 * Usage: node tools/new-article.mjs mon-slug "Titre" "Kicker"
 * Rien n'est publié tout seul : relecture humaine obligatoire.
 */
const fs = require("fs");
const path = require("path");

const [slug, title, kicker] = process.argv.slice(2);
if (!slug || !title) {
  console.error('Usage: node tools/new-article.mjs slug "Titre" "Kicker"');
  process.exit(1);
}
if (!/^[a-z0-9-]+$/.test(slug)) {
  console.error("Slug: minuscules, chiffres, tirets uniquement.");
  process.exit(1);
}

const root = path.join(__dirname, "..");
const dest = path.join(root, "articles", `${slug}.html`);
if (fs.existsSync(dest)) {
  console.error("Le fichier existe déjà:", dest);
  process.exit(1);
}

const today = new Date().toISOString().slice(0, 10);
const kick = kicker || "Actualité";
let html = fs.readFileSync(path.join(__dirname, "template-article.html"), "utf8");
html = html
  .replace(/SLUG/g, slug)
  .replace(/TITLE_SEO/g, title)
  .replace(/META_DESC/g, title)
  .replace(/TITRE_COURT/g, title)
  .replace(/>TITRE</g, `>${title}<`)
  .replace(/KICKER/g, kick)
  .replace(/DATE/g, today)
  .replace(/CHAPO/g, "À rédiger — vérifier chaque fait avant publication.");

fs.writeFileSync(dest, html);
console.log("Brouillon créé:", dest);
console.log("Ensuite: relire, maillage, sitemap.xml, lien depuis actualites.html");
