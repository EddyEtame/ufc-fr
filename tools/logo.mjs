/**
 * Le logo sur fond transparent.
 *
 * Le fichier d'origine est un JPEG : format sans canal alpha, donc fond
 * blanc. La feuille de style compensait avec `mix-blend-mode: multiply`,
 * qui rend le blanc invisible sur un fond clair — sauf que l'en-tete porte
 * un `backdrop-filter`, lequel ouvre un contexte d'empilement : le melange
 * ne trouvait plus le fond de la page, et un rectangle blanc de 172 px
 * entourait le logo sur les cent soixante-trois pages du site.
 *
 * On enleve donc le blanc pour de bon. Le logo est noir et rouge sur blanc :
 * l'opacite de chaque point vaut ce qu'il lui manque pour etre blanc, et la
 * couleur est retablie en annulant le melange avec le blanc — c'est
 * l'inverse exact de la composition d'origine, pas un seuil.
 */
import { chromium } from "playwright-core";
import { readFileSync, writeFileSync } from "node:fs";

const SRC = "logo/ufc.fr.jpeg";
const DEST = "logo/ufc-fr.webp";
const DEST_CLAIR = "logo/ufc-fr-clair.webp";

const nav = await chromium.launch({ executablePath: process.env.CHROME || "/opt/pw-browsers/chromium" });
const page = await nav.newPage();
const r = await page.evaluate(async (b64) => {
  const img = new Image();
  img.src = "data:image/jpeg;base64," + b64;
  await img.decode();
  const c = document.createElement("canvas");
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const x = c.getContext("2d");
  x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height);
  const p = d.data;
  for (let i = 0; i < p.length; i += 4) {
    const a = 255 - Math.min(p[i], p[i + 1], p[i + 2]);
    if (a === 0) { p[i + 3] = 0; continue; }
    // Annulation du melange avec le blanc : c = c' * a + 255 * (1 - a).
    const f = a / 255;
    p[i] = Math.max(0, Math.min(255, Math.round((p[i] - 255 * (1 - f)) / f)));
    p[i + 1] = Math.max(0, Math.min(255, Math.round((p[i + 1] - 255 * (1 - f)) / f)));
    p[i + 2] = Math.max(0, Math.min(255, Math.round((p[i + 2] - 255 * (1 - f)) / f)));
    p[i + 3] = a;
  }
  x.putImageData(d, 0, 0);
  // Rognage : le JPEG porte une marge blanche que rien ne justifie une fois
  // le fond retire, et qui decale le logo dans son cadre.
  let x0 = c.width, y0 = c.height, x1 = 0, y1 = 0;
  for (let j = 0; j < c.height; j++)
    for (let i = 0; i < c.width; i++) {
      if (p[(j * c.width + i) * 4 + 3] < 12) continue;
      if (i < x0) x0 = i;
      if (i > x1) x1 = i;
      if (j < y0) y0 = j;
      if (j > y1) y1 = j;
    }
  // Le logo s'affiche sur 44 px de haut au plus. On sert le double pour les
  // ecrans a forte densite, pas les 832 px de l'original : un logo de 167 Ko
  // charge sur chacune des cent soixante-trois pages est un defaut de
  // performance, pas un detail.
  const lg = x1 - x0 + 1, ht = y1 - y0 + 1;
  // 320 px : le logo s'affiche sur 40 px de haut, soit 141 de large ; a
  // densite double cela fait 282. Servir 480 px, c'etait 33 Ko par variante
  // et deux variantes chargees des qu'on defile sur une page a heros sombre.
  const L = Math.min(lg, 320);
  const c2 = document.createElement("canvas");
  c2.width = L;
  c2.height = Math.round((ht / lg) * L);
  const x2 = c2.getContext("2d");
  x2.imageSmoothingQuality = "high";
  x2.drawImage(c, x0, y0, lg, ht, 0, 0, c2.width, c2.height);
  const sombre = c2.toDataURL("image/webp", 0.92);

  /* La version claire, pour les en-tetes poses sur une photo sombre.
     Le site y dessinait jusqu'ici un autre logo — une icone plus un « UFC.FR »
     compose en police d'affichage — si bien que la marque n'etait pas la meme
     sur l'accueil et sur un article. Une marque, un dessin.
     L'encre noire passe en couleur papier ; le rouge est laisse tel quel,
     c'est lui qui identifie. Le tri se fait sur la saturation, pas sur un
     seuil de luminosite : le contour rouge de l'octogone est sombre lui
     aussi, et un seuil l'aurait blanchi. */
  const d2 = x2.getImageData(0, 0, c2.width, c2.height);
  const q = d2.data;
  for (let i = 0; i < q.length; i += 4) {
    if (q[i + 3] === 0) continue;
    const max = Math.max(q[i], q[i + 1], q[i + 2]);
    const min = Math.min(q[i], q[i + 1], q[i + 2]);
    if (max - min > 40) continue; // colore : c'est le rouge de la marque
    q[i] = 247; q[i + 1] = 244; q[i + 2] = 238;
  }
  x2.putImageData(d2, 0, 0);
  const clair = c2.toDataURL("image/webp", 0.92);

  // WebP garde le canal alpha et pese le quart du PNG a l'oeil nu.
  return { url: sombre, clair, w: c2.width, h: c2.height, ow: c.width, oh: c.height };
}, readFileSync(SRC).toString("base64"));

const buf = Buffer.from(r.url.split(",")[1], "base64");
const bufClair = Buffer.from(r.clair.split(",")[1], "base64");
writeFileSync(DEST, buf);
writeFileSync(DEST_CLAIR, bufClair);
console.log(
  `[logo] ${r.ow}x${r.oh} opaque -> ${r.w}x${r.h} transparent · ` +
    `${(buf.length / 1024).toFixed(0)} Ko sombre, ${(bufClair.length / 1024).toFixed(0)} Ko clair`
);
await nav.close();
