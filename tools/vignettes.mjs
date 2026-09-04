/**
 * Les vignettes.
 *
 * Une carte de liste affiche son image sur 430 px de large au plus, et le
 * site lui servait l'original — souvent 1 600 px, parfois 2 500. Le
 * navigateur telecharge alors huit fois trop d'octets, puis decode huit fois
 * trop de pixels pour les reduire a l'affichage. Sur le fil complet, qui
 * porte quatre-vingt-douze cartes, c'est la premiere cause de hachage au
 * defilement : le decodage se fait sur le fil principal.
 *
 * On fabrique donc une version de 640 px de large — le double de la taille
 * d'affichage, pour rester net sur un ecran a forte densite — et les listes
 * la servent. Les pages d'article gardent l'original : la photo d'ouverture
 * y occupe toute la colonne.
 *
 * Aucun outil d'image n'est installe sur la machine ; le navigateur en est
 * un. C'est lent (une image a la fois) mais ca ne tourne qu'a la demande, et
 * le resultat est commite.
 */
import { chromium } from "playwright-core";
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join, dirname, extname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SORTIE = join(ROOT, "media", "vignettes");
/** Le suffixe d'une largeur : 640 reste sans suffixe, par compatibilite des
 *  adresses deja publiees et deja commitees. */
const suffixe = (L) => (L === 640 ? "" : `-${L}`);
/* Deux largeurs, pas une.
 *
 * 640 px sert les cartes de liste, qui s'affichent sur 430 px au plus.
 * 1 280 px sert les photos d'ouverture d'article : sur un telephone a forte
 * densite, la colonne fait 390 px CSS, soit 780 px reels — la vignette de
 * 640 y serait floue, et l'original de 1 800 fait telecharger deux fois
 * trop. C'est la mesure qui l'a montre : la photo d'ouverture de l'article
 * Bercy pesait 224 Ko a elle seule, sur 608 Ko de page. */
const LARGEURS = [640, 960, 1280];
const MIME = { ".jpg": "jpeg", ".jpeg": "jpeg", ".png": "png", ".webp": "webp" };

/** Toutes les images que le site peut servir en vignette. */
function sources() {
  const out = [];
  for (const dossier of [join(ROOT, "media"), join(ROOT, "img")]) {
    if (!existsSync(dossier)) continue;
    (function marche(d) {
      for (const n of readdirSync(d)) {
        if (n === "vignettes" || n === "brand" || n === "from-wp") continue;
        const f = join(d, n);
        if (statSync(f).isDirectory()) marche(f);
        else if (MIME[extname(n).toLowerCase()]) out.push(f);
      }
    })(dossier);
  }
  return out;
}

mkdirSync(SORTIE, { recursive: true });
const fichiers = sources();
const nav = await chromium.launch({ executablePath: process.env.CHROME || "/opt/pw-browsers/chromium" });
const page = await nav.newPage();

let faites = 0, sautees = 0, avant = 0, apres = 0;
for (const f of fichiers) {
 for (const LARGEUR of LARGEURS) {
  const nom = basename(f).replace(/\.[a-z]+$/i, "") + suffixe(LARGEUR) + ".webp";
  const dest = join(SORTIE, nom);
  const src = readFileSync(f);
  // On ne refait pas ce qui existe et qui est plus recent que sa source.
  if (existsSync(dest) && statSync(dest).mtimeMs >= statSync(f).mtimeMs) { sautees++; continue; }

  const r = await page.evaluate(
    async ({ b64, mime, L }) => {
      const img = new Image();
      img.src = `data:image/${mime};base64,${b64}`;
      await img.decode();
      if (img.naturalWidth <= L) return null; // deja assez petite
      const e = L / img.naturalWidth;
      const c = document.createElement("canvas");
      c.width = L;
      c.height = Math.round(img.naturalHeight * e);
      const x = c.getContext("2d");
      x.imageSmoothingQuality = "high";
      x.drawImage(img, 0, 0, c.width, c.height);
      return c.toDataURL("image/webp", 0.78);
    },
    { b64: src.toString("base64"), mime: MIME[extname(f).toLowerCase()], L: LARGEUR }
  );
  if (!r) { sautees++; continue; }
  const buf = Buffer.from(r.split(",")[1], "base64");
  writeFileSync(dest, buf);
  avant += src.length;
  apres += buf.length;
  faites++;
 }
}
await nav.close();
console.log(
  `[vignettes] ${faites} fabriquees, ${sautees} inutiles ou a jour` +
    (faites ? ` — ${Math.round(avant / 1024)} Ko d'originaux rendus en ${Math.round(apres / 1024)} Ko` : "")
);
